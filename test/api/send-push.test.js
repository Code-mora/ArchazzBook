const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const admin = require('firebase-admin');

const HANDLER_PATH = require.resolve('../../api/send-push');

const SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'archazzbook-test',
  client_email: 'test@archazzbook.iam.gserviceaccount.com',
  private_key: 'fake-key',
});

// firebase-admin exposes its namespaces through getters, so plain assignment
// would be ignored; redefine the property instead.
function stubProperty(target, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { value, configurable: true, writable: true });
  return () => {
    if (descriptor) Object.defineProperty(target, name, descriptor);
    else delete target[name];
  };
}

// The handler initializes Firebase Admin at require time, so each scenario
// re-requires it with the module-level dependencies stubbed out.
function loadHandler({ serviceAccount, certThrows = false } = {}) {
  const previousEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccount === undefined) {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  } else {
    process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
  }

  const restoreCert = stubProperty(admin.credential, 'cert', () => {
    if (certThrows) throw new Error('invalid credential');
    return { type: 'stub-credential' };
  });
  const restoreInit = stubProperty(admin, 'initializeApp', () => ({ name: 'stub-app' }));

  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  delete require.cache[HANDLER_PATH];

  restoreCert();
  restoreInit();
  if (previousEnv === undefined) {
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
  } else {
    process.env.FIREBASE_SERVICE_ACCOUNT = previousEnv;
  }

  return { handler };
}

function createResponse() {
  return {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

// The handler calls admin.messaging() at request time, so keep the stub
// installed while the request runs.
async function callHandler(loaded, req, res, messagingStub) {
  const restore = messagingStub ? stubProperty(admin, 'messaging', messagingStub) : () => {};
  try {
    await loaded.handler(req, res);
  } finally {
    restore();
  }
}

test('rejects non-POST methods', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT });
  const res = createResponse();

  await callHandler(loaded, { method: 'GET', body: {} }, res);

  assert.equal(res.statusCode, 405);
  assert.deepEqual(res.payload, { error: 'Method not allowed. Use POST.' });
});

test('reports a configuration error when the service account is missing', async () => {
  const loaded = loadHandler({ serviceAccount: undefined });
  const res = createResponse();

  await callHandler(loaded, { method: 'POST', body: { token: 'abc' } }, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.error, /FIREBASE_SERVICE_ACCOUNT environment variable is missing/);
});

test('reports a configuration error when the credential is rejected', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT, certThrows: true });
  const res = createResponse();

  await callHandler(loaded, { method: 'POST', body: { token: 'abc' } }, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.payload.error, /invalid credential/);
});

test('requires an FCM token', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT });
  const res = createResponse();

  await callHandler(loaded, { method: 'POST', body: {} }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, { error: 'Missing FCM token' });
});

test('sends a message built from the request body', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT });
  const res = createResponse();
  const sent = [];

  await callHandler(
    loaded,
    {
      method: 'POST',
      body: {
        token: 'device-token',
        title: 'New chapter',
        body: 'Chapter 3 is live',
        icon: '/assets/images/custom.png',
        url: '/reader.html?id=5',
      },
    },
    res,
    () => ({
      send: async (message) => {
        sent.push(message);
        return 'projects/test/messages/42';
      },
    }),
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload, { success: true, messageId: 'projects/test/messages/42' });
  assert.deepEqual(sent[0], {
    token: 'device-token',
    notification: { title: 'New chapter', body: 'Chapter 3 is live' },
    webpush: {
      fcmOptions: { link: '/reader.html?id=5' },
      notification: { icon: '/assets/images/custom.png' },
    },
  });
});

test('applies defaults for title, body, icon and link', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT });
  const res = createResponse();
  const sent = [];

  await callHandler(loaded, { method: 'POST', body: { token: 't' } }, res, () => ({
    send: async (message) => {
      sent.push(message);
      return 'id';
    },
  }));

  assert.deepEqual(sent[0], {
    token: 't',
    notification: { title: 'New Notification', body: '' },
    webpush: {
      fcmOptions: { link: '/' },
      notification: { icon: '/assets/images/logo-archazz.png' },
    },
  });
});

test('surfaces Firebase send failures as 500 responses', async () => {
  const loaded = loadHandler({ serviceAccount: SERVICE_ACCOUNT });
  const res = createResponse();
  const originalError = console.error;
  console.error = () => {};

  try {
    await callHandler(loaded, { method: 'POST', body: { token: 'bad' } }, res, () => ({
      send: async () => {
        throw new Error('registration-token-not-registered');
      },
    }));
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.payload, {
    success: false,
    error: 'registration-token-not-registered',
  });
});

test('handler module lives at the expected Vercel function path', () => {
  assert.equal(path.basename(HANDLER_PATH), 'send-push.js');
});
