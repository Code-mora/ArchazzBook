// Loads the project's browser scripts into an isolated vm context backed by
// the fake DOM, so they can be unit tested in plain Node without a browser.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createBrowserEnv } = require('./fake-dom');

const ROOT_DIR = path.join(__dirname, '..', '..');

// Top-level `let`/`const` bindings are lexical and therefore invisible from
// outside the script. The epilogue exposes them through getters/setters so
// tests can inspect and seed module state.
function buildBindingEpilogue(names) {
  if (names.length === 0) return '';
  const accessors = names
    .map((name) => `  get ${name}() { return ${name}; },\n  set ${name}(v) { ${name} = v; },`)
    .join('\n');
  return `\n;globalThis.__bindings = {\n${accessors}\n};\n`;
}

/**
 * @param {string} file Script path relative to the repository root.
 * @param {object} options
 * @param {string[]} options.bindings Top-level let/const names to expose.
 * @param {object} options.globals Extra globals merged into the sandbox.
 * @param {boolean} options.autoCreate Auto-create missing DOM elements by id.
 */
function loadScript(file, { bindings = [], globals = {}, autoCreate = true } = {}) {
  const env = createBrowserEnv({ autoCreate });
  const { window: windowGlobals, ...rest } = globals;
  Object.assign(env, rest);
  if (windowGlobals) Object.assign(env.window, windowGlobals);

  const filename = path.join(ROOT_DIR, file);
  const source = fs.readFileSync(filename, 'utf8');
  const context = vm.createContext(env);
  // The absolute filename makes the script show up in V8 coverage reports.
  vm.runInContext(source + buildBindingEpilogue(bindings), context, { filename });

  env.bindings = env.__bindings || {};
  return env;
}

/**
 * Loads an ES module (notifications.js) into the same fake browser sandbox.
 * Its remote CDN imports are replaced by synthetic modules built from
 * `moduleStubs`, keyed by import specifier.
 *
 * Requires Node's --experimental-vm-modules flag; returns null without it so
 * callers can skip.
 *
 * @returns {Promise<object|null>} The sandbox, with `namespace` set to the
 *   module's exports.
 */
async function loadModule(file, { globals = {}, moduleStubs = {}, autoCreate = true } = {}) {
  if (typeof vm.SourceTextModule !== 'function') return null;

  const env = createBrowserEnv({ autoCreate });
  const { window: windowGlobals, ...rest } = globals;
  Object.assign(env, rest);
  if (windowGlobals) Object.assign(env.window, windowGlobals);

  const context = vm.createContext(env);
  const filename = path.join(ROOT_DIR, file);
  const source = fs.readFileSync(filename, 'utf8');
  const module = new vm.SourceTextModule(source, { context, identifier: filename });

  await module.link((specifier) => {
    const exports = moduleStubs[specifier];
    if (!exports) throw new Error(`Unstubbed import: ${specifier}`);
    const names = Object.keys(exports);
    return new vm.SyntheticModule(
      names,
      function evaluateSynthetic() {
        names.forEach((name) => this.setExport(name, exports[name]));
      },
      { context, identifier: specifier },
    );
  });
  await module.evaluate();

  env.namespace = module.namespace;
  return env;
}

module.exports = { loadScript, loadModule, ROOT_DIR };
