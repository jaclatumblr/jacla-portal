/* eslint-disable @typescript-eslint/no-require-imports -- Standalone component regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const DesignContext = React.createContext(null);
const cache = new Map();

function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  cache.set(file, exports);
  vm.runInNewContext(output, { exports, require: (name) => {
    if (name === "@/contexts/DesignPresetContext") return { DesignContext };
    if (name.startsWith("@/")) {
      const stem = name.slice(2);
      const file = [".tsx", ".ts"].map((extension) => stem + extension).find((candidate) => fs.existsSync(path.join(root, candidate)));
      if (file) return load(file);
    }
    return require(name);
  } });
  return exports;
}

test("labeled input associates caption, value, hint and validation for every theme", () => {
  const { Input } = load("components/ui/input.tsx");
  for (const preset of ["original", "shadcn", "radix", "material"]) {
    const html = renderToStaticMarkup(React.createElement(DesignContext.Provider, { value: { preset } }, React.createElement(Input, {
      id: "band-name", label: "バンド名", supportingText: "入力例です", defaultValue: "Jacla", "aria-invalid": true,
    })));
    assert.ok(html.includes('for="band-name"'));
    assert.ok(html.includes('id="band-name"'));
    assert.ok(html.includes('data-labeled="true"'));
    assert.ok(html.includes('value="Jacla"'));
    assert.ok(html.includes('aria-invalid="true"'));
    const hintId = html.match(/aria-describedby="([^"]+)"/)[1];
    assert.ok(html.includes(`id="${hintId}"`));
  }
});

test("existing plain input remains a single input and preserves explicit height", () => {
  const { Input } = load("components/ui/input.tsx");
  const html = renderToStaticMarkup(React.createElement(Input, { className: "h-8 w-20", type: "number", min: 0, "aria-label": "時間" }));
  assert.equal((html.match(/<input/g) || []).length, 1);
  assert.ok(!html.includes('<div'));
  assert.ok(html.includes('data-fixed-height="true"'));
  assert.ok(html.includes('min="0"'));
});

test("supporting text without a visible label still renders its described-by target", () => {
  const { Input } = load("components/ui/input.tsx");
  const html = renderToStaticMarkup(React.createElement(Input, { supportingText: "補足説明", "aria-label": "入力" }));
  const hintId = html.match(/aria-describedby="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${hintId}"`)); assert.ok(html.includes("補足説明"));
});

test("button variants and link composition retain one interactive element", () => {
  const { Button } = load("components/ui/button.tsx");
  const html = renderToStaticMarkup(React.createElement(Button, { asChild: true, variant: "outline", size: "sm", className: "h-8" }, React.createElement("a", { href: "/events" }, "イベント")));
  assert.equal((html.match(/<a\b/g) || []).length, 1);
  assert.ok(!html.includes('<button'));
  for (const value of ['data-variant="outline"', 'data-size="sm"', 'data-fixed-height="true"', 'href="/events"']) assert.ok(html.includes(value));
});

test("product fonts are self-hosted variable WOFF2 files with included licenses", () => {
  for (const name of ["geist", "inter", "roboto"]) {
    const font = fs.readFileSync(path.join(root, `public/fonts/design/${name}.woff2`));
    assert.equal(font.subarray(0, 4).toString(), "wOF2");
    assert.ok(font.length > 10000 && font.length < 100000);
    const license = fs.readFileSync(path.join(root, `public/fonts/design/${name}-OFL.txt`), "utf8");
    assert.ok(license.includes("SIL OPEN FONT LICENSE"));
  }
});

test("desktop navigation widths drive content offsets; mobile overrides stay scoped", () => {
  const css = fs.readFileSync(path.join(root, "app/design-presets.css"), "utf8");
  assert.ok(css.includes('margin-left: var(--design-nav-width)'));
  assert.ok(css.includes('width: var(--design-nav-width)'));
  assert.ok(css.includes('@media (min-width: 768px)'));
  assert.ok(css.includes('@media (max-width: 767px)'));
  assert.ok(css.includes('[data-slot="mobile-navigation"]'));
});
