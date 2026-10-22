/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression tests. */
// node --test scripts/check-design-icons.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const DesignContext = React.createContext(null);
const source = fs.readFileSync(path.join(__dirname, "..", "lib/icons.tsx"), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
const icons = {};
vm.runInNewContext(output, { exports: icons, require: (name) => name === "@/contexts/DesignPresetContext" ? { DesignContext } : require(name) });
const presets = ["original", "shadcn", "radix", "material"];

function render(name, preset, props = {}) {
  const icon = React.createElement(icons[name], props);
  return renderToStaticMarkup(preset ? React.createElement(DesignContext.Provider, { value: { preset } }, icon) : icon);
}

test("all 91 shared icons render a single SVG in every preset", () => {
  assert.equal(Object.keys(icons).length, 91);
  for (const name of Object.keys(icons)) for (const preset of presets) {
    const html = render(name, preset, { size: 20, className: "h-5 w-5", "aria-label": "icon label", title: "icon title" });
    assert.equal((html.match(/<svg\b/g) || []).length, 1, `${name}/${preset}`);
    for (const text of [`data-icon-family="${preset}"`, 'class="h-5 w-5"', 'aria-label="icon label"', '<title>icon title</title>', 'width="20"', 'height="20"']) assert.ok(html.includes(text), `${name}/${preset}: ${text}`);
  }
});

test("navigation icons have four distinct drawings, not just different colors", () => {
  for (const name of ["Home", "Calendar", "Settings", "Bell", "Users", "Search", "FileText"]) {
    const drawings = presets.map((preset) => render(name, preset).replace(/data-icon-family="[^"]+"/g, ""));
    assert.equal(new Set(drawings).size, 4, name);
  }
});

test("original remains unchanged and components outside a provider fall back safely", () => {
  const original = renderToStaticMarkup(React.createElement(require("react-icons/pi").PiHouseLineBold));
  assert.equal(render("Home", "original").replace(' data-icon-family="original"', ""), original);
  assert.equal(render("Home"), render("Home", "original"));
});

test("spinner animations and decorative accessibility properties survive the switch", () => {
  for (const preset of presets) {
    const html = render("Loader2", preset, { className: "animate-spin h-4 w-4", "aria-hidden": true });
    assert.ok(html.includes('class="animate-spin h-4 w-4"'));
    assert.ok(html.includes('aria-hidden="true"'));
  }
});

test("each option preview uses its own preset without changing the surrounding page", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "components/DesignIconPreview.tsx"), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => name === "@/contexts/DesignPresetContext" ? { DesignContext } : name === "@/lib/icons" ? icons : require(name) });
  const html = renderToStaticMarkup(React.createElement(DesignContext.Provider, { value: { preset: "material" } },
    React.createElement(React.Fragment, null, React.createElement(exports.DesignIconPreview, { preset: "radix" }), React.createElement(icons.Home))));
  assert.equal((html.match(/data-icon-family="radix"/g) || []).length, 4);
  assert.equal((html.match(/data-icon-family="material"/g) || []).length, 1);
});
