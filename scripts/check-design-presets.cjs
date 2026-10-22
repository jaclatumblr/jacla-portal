/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression tests. */
// node --test scripts/check-design-presets.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const exports = {};
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, require: (name) => imports[name] ?? require(name), console, queueMicrotask, ...globals });
  return exports;
}
const definitions = load("lib/designPresets.ts");
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function environment(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    document: { documentElement: { dataset: {} } },
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) },
    values,
  };
}

test("only four known presets are accepted; account preference wins over device cache", () => {
  for (const option of definitions.DESIGN_PRESETS) assert.equal(definitions.isDesignPreset(option.id), true);
  for (const value of [null, undefined, {}, "invalid", '<script>alert(1)</script>']) assert.equal(definitions.isDesignPreset(value), false);
  assert.equal(definitions.resolveDesignPreset("material", "shadcn"), "material");
  assert.equal(definitions.resolveDesignPreset(undefined, "radix"), "radix");
  assert.equal(definitions.resolveDesignPreset("bad", "bad"), "original");
});

test("first-paint bootstrap restores only the active account and tolerates blocked storage", () => {
  const env = environment({ [definitions.DESIGN_ACTIVE_USER_KEY]: "A", [definitions.designStorageKey("A")]: "material", [definitions.designStorageKey("B")]: "radix" });
  vm.runInNewContext(definitions.designPresetBootstrap, env);
  assert.equal(env.document.documentElement.dataset.design, "material");
  env.localStorage.setItem(definitions.designStorageKey("A"), "unknown");
  env.document.documentElement.dataset = {};
  vm.runInNewContext(definitions.designPresetBootstrap, env);
  assert.equal(env.document.documentElement.dataset.design, undefined);
  vm.runInNewContext(definitions.designPresetBootstrap, { document: env.document, localStorage: { getItem() { throw new Error("blocked"); } } });
});

function providerHarness() {
  const env = environment();
  const values = [];
  const effectSlots = [];
  let cursor = 0;
  let effects = [];
  let session = { user: { id: "A", user_metadata: {} } };
  const saves = [];
  const refresh = deferred();
  const react = {
    createContext: () => ({ Provider: "provider" }), useContext() {},
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = typeof initial === "function" ? initial() : initial; return [values[i], (next) => { values[i] = typeof next === "function" ? next(values[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
    useEffect(callback, deps) {
      const i = cursor++;
      const slot = effectSlots[i];
      if (!slot || deps.some((dep, index) => !Object.is(dep, slot.deps[index]))) effects.push(() => { slot?.cleanup?.(); effectSlots[i] = { deps, cleanup: callback() }; });
    },
  };
  const { DesignPresetProvider } = load("contexts/DesignPresetContext.tsx", {
    react, "@/contexts/AuthContext": { useAuth: () => ({ session, loading: false }) },
    "@/lib/designPresets": definitions,
    "@/lib/supabaseClient": { supabase: { auth: {
      getUser: () => refresh.promise,
      updateUser: (payload) => { const request = deferred(); saves.push({ ...request, payload }); return request.promise; },
    } } },
  }, env);
  return { env, saves, refresh,
    switchAccount(id, preset) { session = id ? { user: { id, user_metadata: { [definitions.DESIGN_METADATA_KEY]: preset } } } : null; },
    render() { cursor = 0; effects = []; const result = DesignPresetProvider({ children: null }).props.value; effects.forEach((run) => run()); return result; },
  };
}

test("selection applies immediately, saves once, and late account refresh cannot overwrite it", async () => {
  const h = providerHarness();
  h.render(); await tick();
  const view = h.render();
  assert.equal(view.ready, true);
  const save = view.setPreset("material");
  void view.setPreset("radix");
  assert.equal(h.saves.length, 1);
  assert.equal(h.env.document.documentElement.dataset.design, "material");
  assert.equal(h.render().saving, true);
  h.refresh.resolve({ data: { user: { id: "A", user_metadata: { portal_design_preset: "shadcn" } } }, error: null });
  await tick();
  assert.equal(h.render().preset, "material");
  h.saves[0].resolve({ error: null }); await save;
  assert.equal(h.render().saving, false);
  assert.equal(h.env.values.get(definitions.designStorageKey("A")), "material");
});

test("failed account save leaves the appearance usable and supports retry", async () => {
  const h = providerHarness(); h.render(); await tick();
  const save = h.render().setPreset("radix");
  h.saves[0].resolve({ error: new Error("offline") }); await save;
  const failed = h.render();
  assert.equal(failed.preset, "radix"); assert.ok(failed.error); assert.equal(failed.saving, false);
  const retry = failed.setPreset("radix");
  h.saves[1].resolve({ error: null }); await retry;
  assert.equal(h.render().error, null);
});

test("switching accounts and logout isolate preferences and stale saves", async () => {
  const h = providerHarness(); h.render(); await tick();
  const save = h.render().setPreset("radix");
  h.switchAccount("B", "shadcn"); h.render(); await tick();
  assert.equal(h.render().preset, "shadcn");
  h.saves[0].resolve({ error: new Error("late failure") }); await save;
  assert.equal(h.render().error, null);
  assert.equal(h.env.document.documentElement.dataset.design, "shadcn");
  h.switchAccount(null); h.render(); await tick();
  assert.equal(h.render().preset, "original");
  assert.equal(h.env.values.has(definitions.DESIGN_ACTIVE_USER_KEY), false);
});

test("a fresh account preference restores on another device without a local cache", async () => {
  const h = providerHarness(); h.render(); await tick();
  h.refresh.resolve({ data: { user: { id: "A", user_metadata: { portal_design_preset: "material" } } }, error: null });
  await tick();
  assert.equal(h.render().preset, "material");
});

test("A to B to A switch cannot let the first A save unlock or fail the new A save", async () => {
  const h = providerHarness(); h.render(); await tick();
  const oldSave = h.render().setPreset("radix");
  h.switchAccount("B", "original"); h.render(); await tick();
  h.switchAccount("A", "original"); h.render(); await tick();
  const currentSave = h.render().setPreset("radix");
  h.saves[0].resolve({ error: new Error("stale failure") }); await oldSave;
  assert.equal(h.render().saving, true); assert.equal(h.render().error, null);
  void h.render().setPreset("material"); assert.equal(h.saves.length, 2);
  h.saves[1].resolve({ error: null }); await currentSave;
  assert.equal(h.render().saving, false);
});

test("all new light/dark palettes keep normal text and primary buttons at 4.5:1 contrast", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "app/design-presets.css"), "utf8");
  const luminance = (hex) => {
    const channels = hex.match(/[0-9a-f]{2}/gi).map((v) => parseInt(v, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  for (const preset of ["shadcn", "radix", "material"]) for (const dark of [false, true]) {
    const selector = `:root[data-design="${preset}"]${dark ? ".dark" : ""} {`;
    const block = css.split(selector)[1].split("}")[0];
    const color = (key) => block.match(new RegExp(`--preset-${key}: (#[0-9a-f]{6})`))[1];
    for (const [fg, bg] of [["fg", "bg"], ["muted", "card"], ["primary", "on-primary"]]) assert.ok(contrast(color(fg), color(bg)) >= 4.5, `${preset}/${dark}: ${fg}/${bg}`);
  }
});
