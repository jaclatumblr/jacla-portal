/* eslint-disable @typescript-eslint/no-require-imports -- Standalone home regression tests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, require: (name) => {
    if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
    if (name === "@/lib/icons") return new Proxy({}, { get: () => (props) => React.createElement("svg", { ...props, "aria-hidden": "true" }) });
    if (name.startsWith("@/")) {
      const file = [".tsx", ".ts"].map((ext) => name.slice(2) + ext).find((candidate) => fs.existsSync(path.join(root, candidate)));
      if (file) return load(file);
    }
    return require(name);
  }, console });
  return exports;
}
const { nextHomeEvent, homeCalendarSelection } = load("lib/homeEvents.ts");
const { NextHomeEvent } = load("components/NextHomeEvent.tsx");
const event = (id, overrides = {}) => ({ id, name: "春ライブ", date: "2026-10-20", venue: "ホール", status: "recruiting", openTime: "17:00:00", startTime: "18:00:00", ...overrides });
const render = (props = {}) => renderToStaticMarkup(React.createElement(NextHomeEvent, { event: null, loading: false, error: null, today: "2026-10-20", onRetry() {}, ...props }));

test("next event excludes past, closed and draft events, including drafts visible to administrators", () => {
  const events = [event("past", { date: "2026-10-19" }), event("draft", { status: "draft" }), event("closed", { status: "closed" }), event("later", { date: "2026-11-01" }), event("next", { date: "2026-10-21", status: "fixed" })];
  const originalOrder = events.map((event) => event.id).join();
  assert.equal(nextHomeEvent(events, "2026-10-20").id, "next");
  assert.equal(events.map((event) => event.id).join(), originalOrder);
  assert.equal(nextHomeEvent([], "2026-10-20"), null);
  assert.equal(nextHomeEvent([event("draft", { status: "draft" })], "2026-10-20"), null);
});
test("today remains visible all day and ties sort by time, with unknown times last", () => {
  const events = [event("unknown", { startTime: null, openTime: null }), event("later"), event("opening", { startTime: null, openTime: "09:00:00" }), event("earliest", { startTime: "08:00:00" })];
  assert.equal(nextHomeEvent(events, "2026-10-20").id, "earliest");
  assert.equal(nextHomeEvent(events, "2026-10-21"), null);
});
test("event card shows Japanese status, explicit opening/start times and working destinations", () => {
  const html = render({ event: event("upcoming", { date: "2026-10-21" }) });
  for (const label of ["次のイベント", "春ライブ", "募集中", "開場 17:00", "開演 18:00", "ホール", "マイバンド", "自分のシフト"]) assert.ok(html.includes(label), label);
  for (const href of ["/events/upcoming", "/me/bands", "/me/tasks"]) assert.ok(html.includes(`href="${href}"`), href);
  assert.ok(render({ event: event("today") }).includes("本日のイベント"));
  const missing = render({ event: event("unknown", { venue: "  ", openTime: null, startTime: null }) });
  assert.ok(missing.includes("会場未定")); assert.ok(missing.includes("時間未定"));
});
test("loading, failure with retry, and empty state remain distinct", () => {
  const loading = render({ loading: true });
  assert.ok(loading.includes('role="status"')); assert.ok(!loading.includes("今後のイベントはまだありません"));
  const failed = render({ error: "イベントを読み込めませんでした。" });
  assert.ok(failed.includes('role="alert"')); assert.ok(failed.includes("再読み込み")); assert.ok(!failed.includes("今後のイベントはまだありません"));
  const empty = render();
  assert.ok(empty.includes("今後のイベントはまだありません")); assert.ok(empty.includes('href="/events"'));
});

test("calendar selects an actual event date instead of an empty today panel", () => {
  const dates = ["2026-10-22", "2026-10-25"];
  assert.equal(homeCalendarSelection(dates, null, "2026-10-21"), "2026-10-22");
  assert.equal(homeCalendarSelection(dates, "2026-10-25", "2026-10-21"), "2026-10-25");
  assert.equal(homeCalendarSelection(dates, "2026-09-30", "2026-10-25"), "2026-10-25");
  assert.equal(homeCalendarSelection([], null, "2026-10-21"), null);
});
