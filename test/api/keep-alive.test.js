const test = require('node:test');
const assert = require('node:assert/strict');

const keepAlive = require('../../api/keep-alive');

function createResponse() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function createRequest({ method = 'GET', headers = {} } = {}) {
  return { method, headers };
}

function stubFetch(impl) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return impl(url, options);
  };
  return {
    calls,
    restore() {
      global.fetch = original;
    },
  };
}

function withEnv(name, value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, name);
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return (async () => {
    try {
      return await fn();
    } finally {
      if (had) process.env[name] = previous;
      else delete process.env[name];
    }
  })();
}

function silenceConsoleError() {
  const original = console.error;
  const messages = [];
  console.error = (...args) => messages.push(args.join(' '));
  return {
    messages,
    restore() {
      console.error = original;
    },
  };
}

test('pings the books table and reports success', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({ ok: true, status: 200 }));

  try {
    await keepAlive(createRequest(), res);
  } finally {
    fetchStub.restore();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.table, 'books');
  assert.equal(typeof res.body.duration_ms, 'number');
  assert.ok(!Number.isNaN(Date.parse(res.body.checked_at)));

  assert.equal(fetchStub.calls.length, 1, 'stops after the first success');
  const { url, options } = fetchStub.calls[0];
  assert.match(url, /\/rest\/v1\/books\?select=id&limit=1$/);
  assert.ok(options.headers.apikey, 'sends the anon key');
  assert.equal(options.headers.Authorization, `Bearer ${options.headers.apikey}`);
});

test('uses the configured Supabase project when env vars are set', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({ ok: true, status: 200 }));

  try {
    await withEnv('SUPABASE_URL', 'https://example.supabase.co', () =>
      withEnv('SUPABASE_ANON_KEY', 'env-key', async () => {
        delete require.cache[require.resolve('../../api/keep-alive')];
        const handler = require('../../api/keep-alive');
        await handler(createRequest(), res);
      }),
    );
  } finally {
    fetchStub.restore();
    delete require.cache[require.resolve('../../api/keep-alive')];
  }

  assert.match(fetchStub.calls[0].url, /^https:\/\/example\.supabase\.co\//);
  assert.equal(fetchStub.calls[0].options.headers.apikey, 'env-key');
});

test('falls through to the next table when one is unavailable', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async (url) => {
    if (url.includes('/books')) return { ok: false, status: 404 };
    if (url.includes('/comments')) throw new Error('socket hang up');
    return { ok: true, status: 200 };
  });

  try {
    await keepAlive(createRequest(), res);
  } finally {
    fetchStub.restore();
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.table, 'reactions');
  assert.equal(fetchStub.calls.length, 3);
});

test('reports a bad gateway with every failure when Supabase is unreachable', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => {
    throw new Error('getaddrinfo ENOTFOUND');
  });
  const logs = silenceConsoleError();

  try {
    await keepAlive(createRequest(), res);
  } finally {
    fetchStub.restore();
    logs.restore();
  }

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.failures.length, 3);
  assert.match(res.body.failures[0], /^books: getaddrinfo ENOTFOUND$/);
  assert.equal(logs.messages.length, 1);
});

test('reports HTTP failures per table', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({ ok: false, status: 503 }));
  const logs = silenceConsoleError();

  try {
    await keepAlive(createRequest(), res);
  } finally {
    fetchStub.restore();
    logs.restore();
  }

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body.failures, [
    'books: HTTP 503',
    'comments: HTTP 503',
    'reactions: HTTP 503',
  ]);
});

test('accepts POST as well as the cron GET', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({ ok: true, status: 200 }));

  try {
    await keepAlive(createRequest({ method: 'POST' }), res);
  } finally {
    fetchStub.restore();
  }

  assert.equal(res.statusCode, 200);
});

test('rejects other methods', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(() => {
    throw new Error('fetch should not be called');
  });

  try {
    await keepAlive(createRequest({ method: 'DELETE' }), res);
  } finally {
    fetchStub.restore();
  }

  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET, POST');
  assert.equal(fetchStub.calls.length, 0);
});

test('requires the cron secret once CRON_SECRET is configured', async () => {
  const fetchStub = stubFetch(async () => ({ ok: true, status: 200 }));

  try {
    await withEnv('CRON_SECRET', 's3cret', async () => {
      const denied = createResponse();
      await keepAlive(createRequest({ headers: { authorization: 'Bearer nope' } }), denied);
      assert.equal(denied.statusCode, 401);

      const anonymous = createResponse();
      await keepAlive(createRequest(), anonymous);
      assert.equal(anonymous.statusCode, 200);
      assert.deepEqual(
        { ok: anonymous.body.ok, protected: anonymous.body.protected },
        { ok: true, protected: true },
      );
      assert.equal(anonymous.body.table, undefined, 'status page does not report a ping');
      assert.equal(fetchStub.calls.length, 0, 'no Supabase call without the secret');

      const allowed = createResponse();
      await keepAlive(createRequest({ headers: { authorization: 'Bearer s3cret' } }), allowed);
      assert.equal(allowed.statusCode, 200);
    });
  } finally {
    fetchStub.restore();
  }
});
