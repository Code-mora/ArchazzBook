const test = require('node:test');
const assert = require('node:assert/strict');
const { loadScript } = require('./helpers/load-script');
const { toPlain } = require('./helpers/fake-dom');

// A chainable stand-in for the PostgREST query builder. Every call is recorded
// so tests can assert on the query that was built, and the builder resolves to
// the configured `result` when awaited.
function createQueryBuilder(result, calls, table) {
  const record = (method, args) => calls.push({ table, method, args });

  const builder = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
        }
        return (...args) => {
          record(prop, args);
          return builder;
        };
      },
    },
  );

  return builder;
}

function createSupabaseStub({ result = { data: [], error: null }, storage = {} } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push({ table, method: 'from', args: [table] });
      return createQueryBuilder(typeof result === 'function' ? result(table) : result, calls, table);
    },
    storage: {
      from(bucket) {
        calls.push({ table: bucket, method: 'storage.from', args: [bucket] });
        return {
          upload: async (...args) => {
            calls.push({ table: bucket, method: 'upload', args });
            return storage.upload || { data: { path: args[0] }, error: null };
          },
          getPublicUrl: (...args) => {
            calls.push({ table: bucket, method: 'getPublicUrl', args });
            return storage.getPublicUrl || { data: { publicUrl: `https://cdn.test/${args[0]}` } };
          },
          remove: async (...args) => {
            calls.push({ table: bucket, method: 'remove', args });
            return storage.remove || { error: null };
          },
        };
      },
    },
    auth: {
      signInWithPassword: async (credentials) => {
        calls.push({ method: 'signInWithPassword', args: [credentials] });
        return client.auth._signIn || { data: { user: { email: credentials.email } }, error: null };
      },
      signOut: async () => {
        calls.push({ method: 'signOut', args: [] });
        return client.auth._signOut || { error: null };
      },
      getSession: async () => {
        calls.push({ method: 'getSession', args: [] });
        return client.auth._getSession || { data: { session: null }, error: null };
      },
    },
  };
  return { client, calls };
}

function loadConfig(stub) {
  return loadScript('supabase-config.js', {
    globals: {
      window: {
        supabase: { createClient: () => stub.client },
      },
    },
  });
}

test('initializes a Supabase client and exposes the API surface', () => {
  const stub = createSupabaseStub();
  const env = loadConfig(stub);

  assert.equal(env.window.supabaseClient, stub.client);
  assert.deepEqual(Object.keys(env.window.SupabaseAPI).sort(), [
    'addReaction',
    'countHappyReaders',
    'createBook',
    'createComment',
    'deleteBook',
    'deleteComment',
    'deleteCover',
    'deleteReaction',
    'fetchBooks',
    'fetchComments',
    'fetchReactions',
    'getSession',
    'incrementViews',
    'signIn',
    'signOut',
    'updateBook',
    'updateComment',
    'uploadCover',
  ]);
});

test('fetchBooks selects books newest first and returns [] on error', async () => {
  const stub = createSupabaseStub({ result: { data: [{ id: 1 }], error: null } });
  const env = loadConfig(stub);

  assert.deepEqual(toPlain(await env.window.SupabaseAPI.fetchBooks()), [{ id: 1 }]);
  assert.deepEqual(toPlain(stub.calls.map((c) => c.method)), [
    'from',
    'select',
    'order',
  ]);
  assert.deepEqual(toPlain(stub.calls[2].args), ['created_at', { ascending: false }]);

  const failing = createSupabaseStub({ result: { data: null, error: { message: 'boom' } } });
  const failingEnv = loadConfig(failing);
  assert.deepEqual(toPlain(await failingEnv.window.SupabaseAPI.fetchBooks()), []);
});

test('createBook inserts and returns the created row', async () => {
  const stub = createSupabaseStub({ result: { data: { id: 5, title: 'New' }, error: null } });
  const env = loadConfig(stub);

  const created = await env.window.SupabaseAPI.createBook({ title: 'New' });

  assert.equal(created.id, 5);
  assert.deepEqual(toPlain(stub.calls.map((c) => c.method)), [
    'from',
    'insert',
    'select',
    'single',
  ]);
  assert.deepEqual(toPlain(stub.calls[1].args), [[{ title: 'New' }]]);
});

test('createBook rethrows Supabase errors', async () => {
  const stub = createSupabaseStub({ result: { data: null, error: { message: 'duplicate' } } });
  const env = loadConfig(stub);

  await assert.rejects(() => env.window.SupabaseAPI.createBook({ title: 'x' }));
});

test('updateBook targets the given id', async () => {
  const stub = createSupabaseStub({ result: { data: { id: 7 }, error: null } });
  const env = loadConfig(stub);

  await env.window.SupabaseAPI.updateBook(7, { title: 'Renamed' });

  const eq = stub.calls.find((c) => c.method === 'eq');
  assert.deepEqual(toPlain(eq.args), ['id', 7]);
});

test('deleteBook resolves true and rethrows on failure', async () => {
  const ok = createSupabaseStub({ result: { error: null } });
  const env = loadConfig(ok);
  assert.equal(await env.window.SupabaseAPI.deleteBook(3), true);

  const failing = createSupabaseStub({ result: { error: { message: 'nope' } } });
  const failingEnv = loadConfig(failing);
  await assert.rejects(() => failingEnv.window.SupabaseAPI.deleteBook(3));
});

test('uploadCover stores the file and returns its public URL', async () => {
  const stub = createSupabaseStub();
  const env = loadConfig(stub);

  const url = await env.window.SupabaseAPI.uploadCover({ name: 'c.png' }, 'cover-1.png');

  assert.equal(url, 'https://cdn.test/cover-1.png');
  const upload = stub.calls.find((c) => c.method === 'upload');
  assert.equal(upload.table, 'book-covers');
  assert.deepEqual(toPlain(upload.args[2]), { cacheControl: '3600', upsert: false });
});

test('uploadCover rethrows storage errors', async () => {
  const stub = createSupabaseStub({
    storage: { upload: { data: null, error: { message: 'too big' } } },
  });
  const env = loadConfig(stub);

  await assert.rejects(() => env.window.SupabaseAPI.uploadCover({}, 'cover.png'));
});

test('deleteCover returns false instead of throwing', async () => {
  const stub = createSupabaseStub({ storage: { remove: { error: { message: 'missing' } } } });
  const env = loadConfig(stub);

  assert.equal(await env.window.SupabaseAPI.deleteCover('cover.png'), false);

  const ok = createSupabaseStub();
  const okEnv = loadConfig(ok);
  assert.equal(await okEnv.window.SupabaseAPI.deleteCover('cover.png'), true);
});

test('incrementViews reads then writes the incremented count', async () => {
  const stub = createSupabaseStub({ result: { data: { views: 4 }, error: null } });
  const env = loadConfig(stub);

  assert.equal(await env.window.SupabaseAPI.incrementViews(9), true);

  const update = stub.calls.find((c) => c.method === 'update');
  assert.deepEqual(toPlain(update.args), [{ views: 5 }]);
});

test('incrementViews treats a missing views column as zero', async () => {
  const stub = createSupabaseStub({ result: { data: {}, error: null } });
  const env = loadConfig(stub);

  await env.window.SupabaseAPI.incrementViews(9);

  const update = stub.calls.find((c) => c.method === 'update');
  assert.deepEqual(toPlain(update.args), [{ views: 1 }]);
});

test('incrementViews returns false when the lookup fails', async () => {
  const stub = createSupabaseStub({ result: { data: null, error: { message: 'gone' } } });
  const env = loadConfig(stub);

  assert.equal(await env.window.SupabaseAPI.incrementViews(9), false);
});

test('fetchComments filters by chapter only when one is requested', async () => {
  const withChapter = createSupabaseStub({ result: { data: [{ id: 1 }], error: null } });
  const env = loadConfig(withChapter);
  await env.window.SupabaseAPI.fetchComments(3, 2);
  assert.deepEqual(
    toPlain(withChapter.calls.filter((c) => c.method === 'eq').map((c) => c.args)),
    [['book_id', 3], ['chapter_id', 2]],
  );

  const allChapters = createSupabaseStub({ result: { data: [], error: null } });
  const allEnv = loadConfig(allChapters);
  await allEnv.window.SupabaseAPI.fetchComments(3);
  assert.deepEqual(
    toPlain(allChapters.calls.filter((c) => c.method === 'eq').map((c) => c.args)),
    [['book_id', 3]],
  );
});

test('comment mutations report success and swallow failures where expected', async () => {
  const created = createSupabaseStub({ result: { data: { id: 11 }, error: null } });
  const createdEnv = loadConfig(created);
  assert.equal((await createdEnv.window.SupabaseAPI.createComment({ content: 'hi' })).id, 11);

  const failedCreate = createSupabaseStub({ result: { data: null, error: { message: 'rls' } } });
  const failedCreateEnv = loadConfig(failedCreate);
  await assert.rejects(() => failedCreateEnv.window.SupabaseAPI.createComment({}));

  const okDelete = createSupabaseStub({ result: { error: null } });
  const okDeleteEnv = loadConfig(okDelete);
  assert.equal(await okDeleteEnv.window.SupabaseAPI.deleteComment(4), true);

  const failedDelete = createSupabaseStub({ result: { error: { message: 'rls' } } });
  const failedDeleteEnv = loadConfig(failedDelete);
  assert.equal(await failedDeleteEnv.window.SupabaseAPI.deleteComment(4), false);

  const okUpdate = createSupabaseStub({ result: { error: null } });
  const okUpdateEnv = loadConfig(okUpdate);
  assert.equal(await okUpdateEnv.window.SupabaseAPI.updateComment(4, 'edited'), true);
  const update = okUpdate.calls.find((c) => c.method === 'update');
  assert.deepEqual(toPlain(update.args), [{ content: 'edited' }]);

  const failedUpdate = createSupabaseStub({ result: { error: { message: 'rls' } } });
  const failedUpdateEnv = loadConfig(failedUpdate);
  assert.equal(await failedUpdateEnv.window.SupabaseAPI.updateComment(4, 'edited'), false);
});

test('addReaction upserts on the composite key', async () => {
  const stub = createSupabaseStub({ result: { data: { emoji: '🔥' }, error: null } });
  const env = loadConfig(stub);

  await env.window.SupabaseAPI.addReaction(1, 2, 'browser-1', '🔥');

  const upsert = stub.calls.find((c) => c.method === 'upsert');
  assert.deepEqual(toPlain(upsert.args), [
    [{ book_id: 1, chapter_id: 2, browser_id: 'browser-1', emoji: '🔥' }],
    { onConflict: 'book_id,chapter_id,browser_id' },
  ]);
});

test('deleteReaction matches book, browser and chapter', async () => {
  const stub = createSupabaseStub({ result: { error: null } });
  const env = loadConfig(stub);

  assert.equal(await env.window.SupabaseAPI.deleteReaction(1, 2, 'browser-1'), true);
  assert.deepEqual(
    toPlain(stub.calls.filter((c) => c.method === 'eq').map((c) => c.args)),
    [['book_id', 1], ['browser_id', 'browser-1']],
  );
  assert.deepEqual(toPlain(stub.calls.find((c) => c.method === 'is').args), ['chapter_id', 2]);
});

test('fetchReactions returns [] for null data and on error', async () => {
  const nullData = createSupabaseStub({ result: { data: null, error: null } });
  const env = loadConfig(nullData);
  assert.deepEqual(toPlain(await env.window.SupabaseAPI.fetchReactions(1)), []);

  const failing = createSupabaseStub({ result: { data: null, error: { message: 'x' } } });
  const failingEnv = loadConfig(failing);
  assert.deepEqual(toPlain(await failingEnv.window.SupabaseAPI.fetchReactions(1, 3)), []);
});

test('countHappyReaders returns the exact count, or 0 when unavailable', async () => {
  const stub = createSupabaseStub({ result: { count: 27, error: null } });
  const env = loadConfig(stub);
  assert.equal(await env.window.SupabaseAPI.countHappyReaders(), 27);
  const select = stub.calls.find((c) => c.method === 'select');
  assert.deepEqual(toPlain(select.args), ['browser_id', { count: 'exact', head: true }]);

  const empty = createSupabaseStub({ result: { count: null, error: null } });
  assert.equal(await loadConfig(empty).window.SupabaseAPI.countHappyReaders(), 0);

  const failing = createSupabaseStub({ result: { count: null, error: { message: 'x' } } });
  assert.equal(await loadConfig(failing).window.SupabaseAPI.countHappyReaders(), 0);
});

test('auth helpers wrap sign in, sign out and session lookup', async () => {
  const stub = createSupabaseStub();
  const env = loadConfig(stub);

  const data = await env.window.SupabaseAPI.signIn('author@archazz.com', 'pw');
  assert.equal(data.user.email, 'author@archazz.com');
  assert.deepEqual(toPlain(stub.calls.find((c) => c.method === 'signInWithPassword').args), [
    { email: 'author@archazz.com', password: 'pw' },
  ]);

  assert.equal(await env.window.SupabaseAPI.signOut(), true);
  assert.equal(await env.window.SupabaseAPI.getSession(), null);
});

test('auth helpers degrade gracefully on errors', async () => {
  const stub = createSupabaseStub();
  stub.client.auth._signIn = { data: null, error: { message: 'invalid' } };
  stub.client.auth._signOut = { error: { message: 'offline' } };
  stub.client.auth._getSession = { data: null, error: { message: 'expired' } };
  const env = loadConfig(stub);

  await assert.rejects(() => env.window.SupabaseAPI.signIn('a', 'b'));
  assert.equal(await env.window.SupabaseAPI.signOut(), false);
  assert.equal(await env.window.SupabaseAPI.getSession(), null);
});
