const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadModule } = require('./helpers/load-script');
const { toPlain } = require('./helpers/fake-dom');

const FIREBASE_APP = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
const FIREBASE_MESSAGING = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// notifications.js is an ES module importing Firebase from a CDN; it needs the
// vm modules API to be loadable in a sandbox.
const needsVmModules = {
  skip: typeof vm.SourceTextModule !== 'function'
    ? 'run with --experimental-vm-modules'
    : false,
};

function createFirebaseStubs(overrides = {}) {
  const calls = { getToken: [], deleteToken: [], onMessage: [] };
  return {
    calls,
    stubs: {
      [FIREBASE_APP]: { initializeApp: () => ({ name: 'stub-app' }) },
      [FIREBASE_MESSAGING]: {
        getMessaging: () => ({ name: 'stub-messaging' }),
        getToken: async (...args) => {
          calls.getToken.push(args);
          return overrides.token !== undefined ? overrides.token : 'fcm-token';
        },
        deleteToken: async (...args) => {
          calls.deleteToken.push(args);
          return true;
        },
        onMessage: (messaging, handler) => {
          calls.onMessage.push(handler);
        },
      },
    },
  };
}

function supabaseStub(result = { error: null }) {
  const upserts = [];
  return {
    upserts,
    client: {
      from() {
        return {
          upsert: async (...args) => {
            upserts.push(args);
            return result;
          },
        };
      },
    },
  };
}

async function loadNotifications({ overrides = {}, windowGlobals = {}, extra = {} } = {}) {
  const firebase = createFirebaseStubs(overrides);
  const globals = {
    Notification: { permission: 'default', requestPermission: async () => 'granted' },
    caches: { keys: async () => [], delete: async () => true },
    crypto: { randomUUID: () => '11111111-2222-4333-8444-555555555555' },
    ...extra,
  };
  const env = await loadModule('notifications.js', {
    moduleStubs: firebase.stubs,
    globals: {
      ...globals,
      window: {
        supabaseClient: supabaseStub().client,
        // The script feature-detects via `'Notification' in window`.
        Notification: globals.Notification,
        caches: globals.caches,
        ...windowGlobals,
      },
    },
  });
  return { env, firebase };
}

test('getBrowserId generates and persists a v4 UUID', needsVmModules, async () => {
  const { env } = await loadNotifications();

  const id = env.namespace.getBrowserId();

  assert.match(id, UUID_RE);
  assert.equal(env.localStorage.getItem('archazz_browser_id'), id);
  assert.equal(env.namespace.getBrowserId(), id, 'stable across calls');
});

test('getBrowserId replaces a malformed stored id', needsVmModules, async () => {
  const { env } = await loadNotifications();
  env.localStorage.setItem('archazz_browser_id', 'not-a-uuid');

  const id = env.namespace.getBrowserId();

  assert.match(id, UUID_RE);
  assert.notEqual(id, 'not-a-uuid');
});

test('getBrowserId falls back to the polyfill without crypto.randomUUID', needsVmModules, async () => {
  const { env } = await loadNotifications({ extra: { crypto: {} } });

  const id = env.namespace.getBrowserId();

  assert.match(id, UUID_RE);
});

test('getBrowserId still returns a UUID when the first write fails', needsVmModules, async () => {
  const { env } = await loadNotifications();
  const original = env.localStorage.setItem.bind(env.localStorage);
  let failed = false;
  env.localStorage.setItem = (key, value) => {
    if (!failed) {
      failed = true;
      throw new Error('storage disabled');
    }
    original(key, value);
  };

  assert.match(env.namespace.getBrowserId(), UUID_RE);
  assert.equal(failed, true);
});

test('setupNotifications stores the FCM token in Supabase', needsVmModules, async () => {
  const supabase = supabaseStub();
  const registration = { active: true, scope: '/' };
  const { env, firebase } = await loadNotifications({
    windowGlobals: { supabaseClient: supabase.client },
    extra: {
      navigator: {
        userAgent: 'x'.repeat(300),
        serviceWorker: {
          register: async () => registration,
          ready: Promise.resolve(registration),
          getRegistrations: async () => [],
        },
      },
    },
  });

  assert.equal(await env.namespace.setupNotifications('vapid-key'), true);

  assert.equal(firebase.calls.getToken.length, 1);
  assert.deepEqual(toPlain(firebase.calls.getToken[0][1].vapidKey), 'vapid-key');
  assert.equal(supabase.upserts.length, 1);
  const [row, options] = supabase.upserts[0];
  assert.equal(row.fcm_token, 'fcm-token');
  assert.match(row.browser_id, UUID_RE);
  assert.equal(row.device_info.length, 200, 'user agent truncated');
  assert.deepEqual(toPlain(options), { onConflict: 'browser_id' });
});

test('setupNotifications returns false when permission is denied', needsVmModules, async () => {
  const { env } = await loadNotifications({
    extra: {
      Notification: { permission: 'denied', requestPermission: async () => 'denied' },
      navigator: { userAgent: 'test', serviceWorker: { getRegistrations: async () => [] } },
    },
  });

  assert.equal(await env.namespace.setupNotifications('vapid-key'), false);
});

test('setupNotifications rejects when notifications are unsupported', needsVmModules, async () => {
  const { env } = await loadNotifications();
  delete env.window.Notification;

  await assert.rejects(() => env.namespace.setupNotifications('vapid-key'));
});

test('setupNotifications returns false when no token is issued', needsVmModules, async () => {
  const registration = { active: true };
  const { env } = await loadNotifications({
    overrides: { token: null },
    extra: {
      navigator: {
        userAgent: 'test',
        serviceWorker: {
          register: async () => registration,
          ready: Promise.resolve(registration),
          getRegistrations: async () => [],
        },
      },
    },
  });

  assert.equal(await env.namespace.setupNotifications('vapid-key'), false);
});

test('hardReset unregisters service workers and clears caches', needsVmModules, async () => {
  const unregistered = [];
  const deletedCaches = [];
  const { env, firebase } = await loadNotifications({
    extra: {
      navigator: {
        userAgent: 'test',
        serviceWorker: {
          getRegistrations: async () => [
            { scope: '/a', unregister: async () => unregistered.push('/a') },
            { scope: '/b', unregister: async () => unregistered.push('/b') },
          ],
        },
      },
      caches: {
        keys: async () => ['cache-1'],
        delete: async (key) => deletedCaches.push(key),
      },
    },
  });

  await env.window.NotifManager.hardReset();

  assert.deepEqual(toPlain(unregistered), ['/a', '/b']);
  assert.deepEqual(toPlain(deletedCaches), ['cache-1']);
  assert.equal(firebase.calls.deleteToken.length, 1);
});

test('foreground messages are surfaced to the reader', needsVmModules, async () => {
  const { env, firebase } = await loadNotifications();

  assert.equal(firebase.calls.onMessage.length, 1, 'listener registered on load');
  firebase.calls.onMessage[0]({ notification: { title: 'New chapter', body: 'Go read it' } });

  assert.deepEqual(toPlain(env.window.alerts), ['🔔 New chapter\n\nGo read it']);
});

test('NotifManager is exposed on window', needsVmModules, async () => {
  const { env } = await loadNotifications();

  assert.deepEqual(Object.keys(env.window.NotifManager).sort(), [
    'getBrowserId',
    'hardReset',
    'setup',
  ]);
});
