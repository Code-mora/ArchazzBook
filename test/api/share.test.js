const test = require('node:test');
const assert = require('node:assert/strict');

const share = require('../../api/share');

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
    send(body) {
      this.body = body;
      return this;
    },
  };
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

test('renders fallback metadata when no book id is given', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(() => {
    throw new Error('fetch should not be called');
  });

  try {
    await share({ query: {} }, res);
  } finally {
    fetchStub.restore();
  }

  assert.equal(fetchStub.calls.length, 0);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(res.headers['Cache-Control'], 's-maxage=60, stale-while-revalidate=300');
  assert.match(res.body, /<title>Read on ArchazzBook<\/title>/);
  assert.match(res.body, /og:description" content="Discover and read captivating digital stories/);
  assert.match(res.body, /window\.location\.replace\("\/reader\.html"\)/);
});

test('injects Open Graph tags from the fetched book', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({
    ok: true,
    json: async () => [
      { title: 'The Long Night', preview: 'A gripping tale', cover_url: 'https://cdn.test/c.png' },
    ],
  }));

  try {
    await share({ query: { id: '42', chapter_id: '7' } }, res);
  } finally {
    fetchStub.restore();
  }

  const { url, options } = fetchStub.calls[0];
  assert.match(url, /\/rest\/v1\/books\?id=eq\.42&select=title,cover_url,preview,chapters$/);
  assert.ok(options.headers.apikey, 'anon key sent');
  assert.equal(options.headers.Authorization, `Bearer ${options.headers.apikey}`);

  assert.match(res.body, /<title>The Long Night - ArchazzBook<\/title>/);
  assert.match(res.body, /og:description" content="A gripping tale"/);
  assert.match(res.body, /og:image" content="https:\/\/cdn\.test\/c\.png"/);
  assert.match(res.body, /twitter:image" content="https:\/\/cdn\.test\/c\.png"/);
  assert.match(res.body, /og:url" content="https:\/\/archazzbook\.vercel\.app\/reader\.html\?id=42"/);
  assert.match(res.body, /window\.location\.replace\("\/reader\.html\?id=42&chapter_id=7"\)/);
});

test('escapes double quotes in meta tag content', async () => {
  const res = createResponse();
  const fetchStub = stubFetch(async () => ({
    ok: true,
    json: async () => [{ title: 'The "Best" Book', preview: 'He said "hi"' }],
  }));

  try {
    await share({ query: { id: '1' } }, res);
  } finally {
    fetchStub.restore();
  }

  assert.match(res.body, /og:title" content="The &quot;Best&quot; Book - ArchazzBook"/);
  assert.match(res.body, /og:description" content="He said &quot;hi&quot;"/);
});

test('keeps fallbacks when the book is missing or Supabase errors', async () => {
  const emptyRes = createResponse();
  let fetchStub = stubFetch(async () => ({ ok: true, json: async () => [] }));
  try {
    await share({ query: { id: '404' } }, emptyRes);
  } finally {
    fetchStub.restore();
  }
  assert.match(emptyRes.body, /<title>Read on ArchazzBook<\/title>/);

  const notOkRes = createResponse();
  fetchStub = stubFetch(async () => ({ ok: false, json: async () => [] }));
  try {
    await share({ query: { id: '500' } }, notOkRes);
  } finally {
    fetchStub.restore();
  }
  assert.match(notOkRes.body, /<title>Read on ArchazzBook<\/title>/);

  const throwingRes = createResponse();
  fetchStub = stubFetch(async () => {
    throw new Error('network down');
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    await share({ query: { id: '1' } }, throwingRes);
  } finally {
    fetchStub.restore();
    console.error = originalError;
  }
  assert.equal(throwingRes.statusCode, 200);
  assert.match(throwingRes.body, /<title>Read on ArchazzBook<\/title>/);
  assert.match(throwingRes.body, /window\.location\.replace\("\/reader\.html\?id=1"\)/);
});
