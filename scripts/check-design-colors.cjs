/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, require: (name) => imports[name] ?? require(name), console, queueMicrotask, ...globals });
  return exports;
}
const definitions = load("lib/designColors.ts");
const wheel = load("lib/colorWheel.ts");
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
function environment(initial = {}) {
  const values = new Map(Object.entries(initial));
  const styles = new Map();
  return { document: { documentElement: { dataset: {}, style: { setProperty: (key, value) => styles.set(key, value), removeProperty: (key) => styles.delete(key) } } }, localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }, values, styles };
}
test("validate colors and let explicit account reset override old local colors", () => {
  assert.equal(definitions.normalizeDesignColor("#ABCDEF"), "#abcdef");
  for (const bad of [null, {}, "red", "#fff", "#123456;background:red", "</script>"]) assert.equal(definitions.normalizeDesignColor(bad), null);
  assert.equal(definitions.resolveDesignColor(null, "#123456"), null);
  assert.equal(definitions.resolveDesignColor(undefined, "#123456"), "#123456");
});
test("4096 sampled colors remain readable in light and dark modes", () => {
  const lum = (hex) => hex.slice(1).match(/../g).reduce((sum, part, i) => { const v = parseInt(part, 16) / 255; return sum + (v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i]; }, 0);
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + .05) / (Math.min(lum(a), lum(b)) + .05);
  for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) {
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    const palette = definitions.designColorPalette(hex);
    for (const bg of ["#ffffff", "#f3edf7", "#edf2f8", palette.lightBackground, palette.lightCard, palette.lightSoft]) assert.ok(contrast(palette.light, bg) >= 4.5, `${hex} light ${bg}`);
    for (const bg of ["#141414", "#36343b", "#30313a", palette.darkBackground, palette.darkCard, palette.darkSoft]) assert.ok(contrast(palette.dark, bg) >= 4.5, `${hex} dark ${bg}`);
    const hsv = wheel.hexToHsv(hex);
    assert.equal(wheel.hsvToHex(hsv.hue, hsv.saturation, hsv.brightness), hex);
  }
});
test("bootstrap and runtime apply the same palette; logout removes overrides", () => {
  const env = environment({ "jacla:design:active-user": "A", [definitions.colorStorageKey("A")]: "#ff00ff", [definitions.colorStorageKey("B")]: "#000000" });
  vm.runInNewContext(definitions.designColorBootstrap, env);
  assert.equal(env.document.documentElement.dataset.customColor, "#ff00ff");
  assert.equal(env.styles.get("--custom-color-dark"), definitions.designColorPalette("#ff00ff").dark);
  assert.equal(env.styles.get("--custom-color-light-background"), definitions.designColorPalette("#ff00ff").lightBackground);
  const runtime = load("lib/designColors.ts", {}, env);
  runtime.applyDesignColor(null);
  assert.equal(env.styles.size, 0);
  assert.equal(env.document.documentElement.dataset.customColor, undefined);
  vm.runInNewContext(definitions.designColorBootstrap, { document: env.document, localStorage: { getItem() { throw Error("blocked"); } } });
});
test("wheel geometry matches its conic gradient; HSV handles grayscale and hue wrapping", () => {
  for (const [x, y, hue] of [[0, -1, 0], [1, 0, 90], [0, 1, 180], [-1, 0, 270]]) assert.equal(wheel.pointToHue(x, y), hue);
  assert.equal(wheel.hsvToHex(360, 100, 100), "#ff0000");
  assert.equal(wheel.hsvToHex(-120, 100, 100), "#0000ff");
  assert.equal(wheel.hsvToHex(200, 0, 100), "#ffffff");
  assert.equal(wheel.hsvToHex(200, 100, 0), "#000000");
});
test("wheel supports dragging, keyboard selection, and disabled state", () => {
  const changes = [];
  const { ColorWheel } = load("components/ColorWheel.tsx", { react: { useState: (initial) => [initial, () => {}] }, "@/lib/colorWheel": wheel });
  const slider = ColorWheel({ color: "#ff0000", disabled: false, onChange: (value) => changes.push(value) }).props.children[0].props;
  assert.equal(slider.role, "slider"); assert.equal(slider.tabIndex, 0);
  slider.onKeyDown({ key: "ArrowLeft", preventDefault() {} });
  assert.equal(changes.pop(), wheel.hsvToHex(359, 100, 100));
  let captured = false;
  const currentTarget = { focus() {}, setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; }, getBoundingClientRect() { return { left: 0, top: 0, width: 208, height: 208 }; } };
  slider.onPointerDown({ button: 0, pointerId: 1, clientX: 208, clientY: 104, currentTarget, preventDefault() {} });
  assert.equal(changes.pop(), "#80ff00");
  slider.onPointerMove({ pointerId: 1, clientX: 104, clientY: 208, currentTarget });
  assert.equal(changes.pop(), "#00ffff");
  slider.onPointerUp({ pointerId: 1, currentTarget }); assert.equal(captured, false);
  const disabled = ColorWheel({ color: "#ff0000", disabled: true, onChange: (value) => changes.push(value) }).props.children[0].props;
  disabled.onKeyDown({ key: "Home", preventDefault() {} });
  disabled.onPointerDown({ button: 0 });
  assert.equal(disabled.tabIndex, -1); assert.equal(changes.length, 0);
});
test("brightness can return from black without losing the chosen hue or saturation", () => {
  let selection, currentColor = "#ff0000";
  const { ColorWheel } = load("components/ColorWheel.tsx", { react: { useState(initial) { selection ??= typeof initial === "function" ? initial() : initial; return [selection, (value) => { selection = value; }]; } }, "@/lib/colorWheel": wheel });
  const render = () => ColorWheel({ color: currentColor, disabled: false, onChange: (color) => { currentColor = color; } });
  const brightness = () => render().props.children[1].props.children[2].props.children[1].props;
  brightness().onChange({ target: { value: "0" } });
  assert.equal(currentColor, "#000000");
  brightness().onChange({ target: { value: "100" } });
  assert.equal(currentColor, "#ff0000");
});
function harness() {
  const env = environment();
  const values = [], slots = [], saves = [];
  let cursor = 0, effects = [], session = { user: { id: "A", user_metadata: {} } };
  const refresh = deferred();
  const react = {
    createContext: () => ({ Provider: "provider" }),
    useState(initial) { const i = cursor++; if (!(i in values)) values[i] = initial; return [values[i], (next) => { values[i] = next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in values)) values[i] = { current: initial }; return values[i]; },
    useEffect(callback, deps) { const i = cursor++, slot = slots[i]; if (!slot || deps.some((v, j) => !Object.is(v, slot.deps[j]))) effects.push(() => { slot?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; }); },
  };
  const { DesignColorProvider } = load("contexts/DesignColorContext.tsx", { react, "@/contexts/AuthContext": { useAuth: () => ({ session, loading: false }) }, "@/lib/designColors": load("lib/designColors.ts", {}, env), "@/lib/supabaseClient": { supabase: { auth: { getUser: () => refresh.promise, updateUser: (payload) => { const request = deferred(); saves.push({ ...request, payload }); return request.promise; } } } } }, env);
  return { env, saves, refresh, switchAccount(id, color) { session = id ? { user: { id, user_metadata: { portal_design_color: color } } } : null; }, render() { cursor = 0; effects = []; const view = DesignColorProvider({ children: null }).props.value; effects.forEach((run) => run()); return view; } };
}
test("save is immediate, prevents double submits, ignores stale fetches, retries, and resets", async () => {
  const h = harness(); h.render(); await tick();
  const save = h.render().saveColor("#123456");
  void h.render().saveColor("#654321"); assert.equal(h.saves.length, 1);
  assert.equal(h.env.document.documentElement.dataset.customColor, "#123456");
  h.refresh.resolve({ data: { user: { id: "A", user_metadata: { portal_design_color: "#aaaaaa" } } }, error: null }); await tick();
  assert.equal(h.render().color, "#123456");
  h.saves[0].resolve({ error: Error("offline") }); await save;
  assert.ok(h.render().error);
  const retry = h.render().saveColor("#123456"); h.saves[1].resolve({ error: null }); await retry;
  assert.equal(h.render().error, null);
  const reset = h.render().saveColor(null); h.saves[2].resolve({ error: null }); await reset;
  assert.equal(h.saves[2].payload.data.portal_design_color, null);
  assert.equal(h.env.document.documentElement.dataset.customColor, undefined);
});
test("account switch and logout clear overrides and ignore a previous account's save failure", async () => {
  const h = harness(); h.render(); await tick();
  const save = h.render().saveColor("#123456");
  h.switchAccount("B", "#abcdef"); h.render(); await tick();
  h.saves[0].resolve({ error: Error("late") }); await save;
  assert.equal(h.render().color, "#abcdef"); assert.equal(h.render().error, null);
  h.switchAccount(null); h.render(); await tick();
  assert.equal(h.env.document.documentElement.dataset.customColor, undefined);
});
