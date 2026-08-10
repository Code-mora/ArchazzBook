// Minimal, dependency-free DOM/browser stub used by the unit tests.
// It implements only the small surface of the DOM that the browser scripts
// of this project touch (elements, classList, dataset, innerHTML text
// extraction, localStorage, event listeners).

class ClassList {
  constructor(element) {
    this.element = element;
    this.tokens = new Set();
  }

  add(...names) {
    names.forEach((name) => this.tokens.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.tokens.delete(name));
  }

  toggle(name) {
    if (this.tokens.has(name)) {
      this.tokens.delete(name);
      return false;
    }
    this.tokens.add(name);
    return true;
  }

  contains(name) {
    return this.tokens.has(name);
  }

  get value() {
    return [...this.tokens].join(' ');
  }
}

function htmlToText(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.style = { cssText: '', display: '' };
    this.dataset = {};
    this.classList = new ClassList(this);
    this.listeners = new Map();
    this.attributes = {};
    this.value = '';
    this._textContent = '';
    this._innerHTML = '';
    this.scrollIntoViewCalls = 0;
  }

  get className() {
    return this.classList.value;
  }

  set className(value) {
    this.classList.tokens = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value);
    this._textContent = htmlToText(value);
    this.children = [];
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children.map((child) => child.textContent).join('');
    }
    return this._textContent;
  }

  set textContent(value) {
    this._textContent = String(value);
    this._innerHTML = String(value);
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    if (child.id) this.ownerDocument.register(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
    if (this.id) this.ownerDocument.unregister(this);
    this.removed = true;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(type, event = {}) {
    (this.listeners.get(type) || []).forEach((handler) => handler.call(this, event));
  }

  scrollIntoView() {
    this.scrollIntoViewCalls += 1;
  }

  reset() {
    this.value = '';
    this.wasReset = true;
  }

  closest() {
    return null;
  }

  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    return this.tagName === selector.toUpperCase();
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  querySelectorAll(selector) {
    return this.descendants().filter((el) => el.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class FakeDocument {
  // autoCreate: getElementById transparently creates missing elements so the
  // scripts under test can run without a full HTML fixture.
  constructor({ autoCreate = true } = {}) {
    this.autoCreate = autoCreate;
    this.elements = new Map();
    this.listeners = new Map();
    this.body = this.createElement('body');
    this.head = this.createElement('head');
  }

  register(element) {
    if (element.id) this.elements.set(element.id, element);
  }

  unregister(element) {
    if (element.id && this.elements.get(element.id) === element) {
      this.elements.delete(element.id);
    }
  }

  createElement(tagName) {
    const element = new FakeElement(tagName, this);
    Object.defineProperty(element, 'id', {
      get: () => element._id || '',
      set: (value) => {
        element._id = value;
        this.register(element);
      },
      configurable: true,
    });
    return element;
  }

  // Creates and registers an element with a given id, for test fixtures.
  addElement(id, tagName = 'div') {
    const element = this.createElement(tagName);
    element.id = id;
    return element;
  }

  getElementById(id) {
    if (!this.elements.has(id) && this.autoCreate) this.addElement(id);
    return this.elements.get(id) || null;
  }

  querySelectorAll(selector) {
    const roots = [this.body, this.head, ...this.elements.values()];
    const all = roots.flatMap((root) => [root, ...root.descendants()]);
    const unique = [...new Set(all)];
    return unique.filter((el) => el.matches(selector));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  dispatchEvent(type, event = {}) {
    return Promise.all(
      (this.listeners.get(type) || []).map((handler) => handler.call(this, event)),
    );
  }
}

class FakeLocalStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

// Builds a sandbox object that can be used as a vm context global.
function createBrowserEnv({ autoCreate = true, url = 'https://archazzbook.test/index.html' } = {}) {
  const document = new FakeDocument({ autoCreate });
  const localStorage = new FakeLocalStorage();
  const logs = { log: [], warn: [], error: [] };

  const parsed = new URL(url);
  // A plain object (not a URL) so assignments to `href` record relative
  // navigations exactly as the scripts perform them.
  const location = {
    href: url,
    origin: parsed.origin,
    pathname: parsed.pathname,
    search: parsed.search,
    replace(next) {
      location.href = next;
    },
    toString() {
      return new URL(location.href, parsed.origin).toString();
    },
  };

  const window = {
    document,
    localStorage,
    location,
    innerWidth: 1280,
    scrollY: 0,
    listeners: new Map(),
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(handler);
    },
    dispatchEvent(type, event = {}) {
      (this.listeners.get(type) || []).forEach((handler) => handler.call(this, event));
    },
    history: { pushState() {} },
    alerts: [],
    confirmResponses: [],
    prompts: [],
    promptResponses: [],
  };

  const sandbox = {
    window,
    document,
    localStorage,
    location,
    navigator: { userAgent: 'node-test' },
    console: {
      log: (...args) => logs.log.push(args.join(' ')),
      warn: (...args) => logs.warn.push(args.join(' ')),
      error: (...args) => logs.error.push(args.join(' ')),
    },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
    clearInterval,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    URL,
    URLSearchParams,
    Map,
    Set,
    Date,
    Math,
    JSON,
    Promise,
    alert: (message) => window.alerts.push(message),
    confirm: (message) => {
      window.prompts.push(message);
      return window.confirmResponses.length ? window.confirmResponses.shift() : true;
    },
    prompt: (message) => {
      window.prompts.push(message);
      return window.promptResponses.length ? window.promptResponses.shift() : null;
    },
    logs,
  };

  window.window = window;
  return sandbox;
}

// Deep-equality helpers cannot compare values created inside a vm context
// with host values, because the intrinsics differ. Round-tripping through
// JSON re-creates them with the host realm's prototypes.
function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  toPlain,
  ClassList,
  FakeElement,
  FakeDocument,
  FakeLocalStorage,
  createBrowserEnv,
  htmlToText,
};
