/* eslint-disable @typescript-eslint/no-require-imports -- Node regression runner loads TypeScript in isolated contexts. */
// Run with: node --test scripts/check-uncommitted-regressions.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

function load(file, { imports = {}, globals = {}, expose = "", transform = (s) => s } = {}) {
  const source = transform(fs.readFileSync(path.join(root, file), "utf8"));
  const output = ts.transpileModule(`${source}\n${expose}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports, require: (name) => name in imports ? imports[name] : require(name),
    process, Buffer, console, AbortController, TextDecoder, TextEncoder, setTimeout, clearTimeout, queueMicrotask,
    ...globals,
  }, { filename: file });
  return exports;
}

function stateHarness() {
  const values = [];
  let cursor = 0;
  const effects = [];
  return {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
        return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
      },
      useRef(initial) {
        const index = cursor++;
        if (!(index in values)) values[index] = { current: initial };
        return values[index];
      },
      useCallback: (callback) => callback,
      useMemo: (callback) => callback(),
      useEffect() {},
      useLayoutEffect(callback) { effects.push(callback); },
    },
    render(callback) {
      cursor = 0;
      effects.length = 0;
      const result = callback();
      effects.forEach((effect) => effect());
      return result;
    },
  };
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test("event B stays visible when event A finishes later, and stale callbacks cannot reload A", async () => {
  const state = stateHarness();
  const requests = new Map();
  const supabase = { from(table) {
    if (table === "band_members") return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
    let eventId;
    const query = {
      select() { return query; },
      eq(column, value) { if (column === "event_id") eventId = value; return query; },
      order() { const request = deferred(); requests.set(eventId, request); return request.promise; },
    };
    return query;
  } };
  const { useEventBands } = load("app/bands/hooks/useEventBands.ts", { imports: {
    react: state.react, "@/lib/supabaseClient": { supabase },
    "@/contexts/AuthContext": { useAuth: () => ({ session: { user: { id: "user" } } }) },
    "@/lib/toast": { toast: { error() {} } },
  } });
  let view = state.render(() => useEventBands({ initialEventId: "A" }));
  const staleRefresh = view.refreshEventBands;
  const first = staleRefresh();
  view.setSelectedEventId("B");
  view = state.render(() => useEventBands({ initialEventId: "A" }));
  assert.equal(view.eventBands.length, 0);
  const second = view.refreshEventBands();
  requests.get("B").resolve({ data: [{ id: "band-B", name: "B" }], error: null });
  await second;
  requests.get("A").resolve({ data: [{ id: "band-A", name: "A" }], error: null });
  await first;
  await staleRefresh();
  view = state.render(() => useEventBands({ initialEventId: "A" }));
  assert.equal(view.eventBands[0].id, "band-B");
  assert.equal(view.loading, false);
});

test("closed and expired events block regular members; privileged roles can continue", () => {
  for (const [event, privileged, blocked] of [
    [{ repertoire_is_closed: true }, false, true],
    [{ repertoire_deadline: "2000-01-01T00:00:00Z" }, false, true],
    [{ repertoire_is_closed: true }, true, false],
    [{ repertoire_deadline: "2999-01-01T00:00:00Z" }, false, false],
    [null, true, true],
  ]) {
    const state = stateHarness();
    const { useBandWriteAccess } = load("app/bands/hooks/useBandWriteAccess.ts", { imports: {
      react: state.react, "@/lib/useRoleFlags": { useRoleFlags: () => ({ canAccessAdmin: privileged, loading: false }) },
    } });
    assert.equal(state.render(() => useBandWriteAccess(event)).blocked, blocked);
  }
});

test("repeated join clicks send one insert and release the button after completion", async () => {
  const state = stateHarness();
  const request = deferred();
  let inserts = 0;
  const componentStubs = new Proxy({}, { get: (_target, name) => name });
  const imports = {
    react: state.react,
    "@/contexts/AuthContext": { useAuth: () => ({ session: { user: { id: "user" } } }) },
    "@/lib/useRoleFlags": { useRoleFlags: () => ({ isAdmin: false }) },
    "../hooks/useBandWriteAccess": { useBandWriteAccess: () => ({ blocked: false, reason: null }) },
    "../types": { formatDate: () => "" },
    "@/lib/supabaseClient": { supabase: { from: () => ({ insert: () => { inserts++; return request.promise; } }) } },
    "@/lib/toast": { toast: { error() {}, success() {} } },
  };
  for (const name of ["@/lib/icons", "@/components/ui/button", "@/components/ui/input", "@/components/ui/card", "@/components/ui/dialog"]) imports[name] = componentStubs;
  const { EventBandList } = load("app/bands/components/EventBandList.tsx", { imports });
  const props = { events: [{ id: "event" }], selectedEventId: "event", bands: [{ id: "band", name: "band", memberNames: [], isMember: false }],
    selfPart: "Gt.", subPartsByProfileId: {}, getFilteredProfiles: () => [], onRefresh: async () => {} };
  const findJoin = (tree) => {
    if (!tree || typeof tree !== "object") return null;
    if (tree.type === "Button" && ["参加する", "処理中..."].includes(tree.props.children)) return tree;
    for (const child of [tree.props?.children].flat(Infinity)) { const match = findJoin(child); if (match) return match; }
    return null;
  };
  const render = () => findJoin(state.render(() => EventBandList(props)));
  const initial = render();
  initial.props.onClick();
  initial.props.onClick();
  assert.equal(inserts, 1);
  assert.equal(render().props.disabled, true);
  request.resolve({ error: null });
  await new Promise(setImmediate);
  assert.equal(render().props.disabled, false);
});

function metadata(fetch) {
  return load("app/api/repertoire/metadata/route.ts", {
    globals: { fetch }, expose: "exports.fetchBody = fetchWithTimeout;",
    transform: (source) => source.replace("8_000", "25").replace("1_000_000", "16"),
  }).fetchBody;
}

test("metadata timeout covers a stalled response body", async () => {
  let aborted = false;
  const fetchBody = metadata(async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener("abort", () => { aborted = true; controller.error(new Error("aborted")); });
    },
  })));
  await assert.rejects(fetchBody("https://example.test"), /aborted/);
  assert.equal(aborted, true);
});

test("metadata rejects oversized chunked responses before reading the full body", async () => {
  let cancelled = false;
  const fetchBody = metadata(async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(10)); },
    cancel() { cancelled = true; },
  })));
  await assert.rejects(fetchBody("https://example.test"), /Response too large/);
  assert.equal(cancelled, true);
});

test("metadata decodes multibyte text split across chunks", async () => {
  const bytes = new TextEncoder().encode("日本語");
  const fetchBody = metadata(async () => new Response(new ReadableStream({ start(controller) {
    controller.enqueue(bytes.slice(0, 2)); controller.enqueue(bytes.slice(2)); controller.close();
  } })));
  assert.equal((await fetchBody("https://example.test")).text, "日本語");
});

function pdfHarness() {
  const layout = load("lib/voxSetlistLayout.ts");
  const pages = [];
  const chars = Array.from(new Set(Array.from("照明要望セット図日本語あア漢", (c) => c.codePointAt(0)).concat(Array.from({ length: 128 }, (_, i) => i))));
  const font = { getCharacterSet: () => chars, encodeText() {}, widthOfTextAtSize: (text, size) => text.length * size / 2 };
  const page = () => {
    const drawn = [];
    return { drawn, getSize: () => ({ width: 595, height: 842 }), drawText: (text, options) => drawn.push({ text, ...options }),
      drawPage() {}, drawEllipse() {}, drawLine() {}, drawRectangle() {}, drawCircle() {} };
  };
  const pdfLib = require("pdf-lib");
  const api = load("app/api/admin/match-vox-setlist-template/route.ts", { imports: {
    "@/lib/voxSetlistLayout": layout,
    "@/lib/stagePlot": { readStagePlotData: () => ({}) },
    "pdf-lib": { ...pdfLib, PDFDocument: {
      load: async () => ({ getPage: page }),
      create: async () => ({ embedFont: async () => font, registerFontkit() {}, embedPage: async () => ({}),
        addPage() { const result = page(); pages.push(result); return result; }, save: async () => new Uint8Array() }),
    } },
  }, expose: "exports.build = buildPdf; exports.draw = drawBandPage;" });
  const band = { name: "band", appearanceOrder: 1, plannedStartTime: "18:00", plannedEndTime: "18:30",
    lightingNote: "LIGHTING", soundNote: "SOUND", stagePlotSummary: "SUMMARY",
    stagePlotItems: [], memberPlotItems: [], carryEquipment: [],
    songs: Array.from({ length: 21 }, (_, i) => ({ title: `TRACK-${i + 1}-END`, entryType: i === 1 ? "mc" : "song", orderIndex: i, durationSec: 60, paNote: "", lightingNote: "", lightingStrobe: "" })),
  };
  return { api, layout: layout.defaultVoxSetlistLayout, pages, page, font, band };
}

test("PDF keeps all 21 entries over three pages with continued song numbering", async () => {
  const h = pdfHarness();
  await h.api.build(Buffer.from("%PDF"), h.layout, "event", "2026/10/20", [h.band]);
  assert.equal(h.pages.length, 3);
  for (let i = 0; i < 21; i++) assert.ok(h.pages[Math.floor(i / 10)].drawn.some(({ text }) => text === `TRACK-${i + 1}-END`));
  assert.ok(h.pages[1].drawn.some(({ text, y }) => text === "10" && y === 405));
  assert.ok(h.pages[2].drawn.some(({ text }) => text === "3/3"));
});

test("PDF renders stage summary and applies each editable note position", () => {
  const h = pdfHarness();
  const layout = structuredClone(h.layout);
  layout.notes.pa.x = 123;
  layout.notes.lighting.x = 234;
  layout.notes.stageSummary.x = 345;
  const page = h.page();
  h.api.draw(page, h.font, layout, "event", "2026/10/20", h.band, 1);
  for (const [marker, x] of [["SOUND", 123], ["LIGHTING", 234], ["SUMMARY", 345]]) {
    assert.ok(page.drawn.some((entry) => entry.text.includes(marker) && Math.abs(entry.x - x) < 1));
  }
});

test("saved legacy note defaults migrate without replacing custom coordinates", () => {
  const { normalizeVoxSetlistLayout, defaultVoxSetlistLayout } = load("lib/voxSetlistLayout.ts");
  const saved = {
    notes: {
      pa: { x: 76, y: 103, maxWidth: 280, size: 7, align: "left" },
      lighting: { x: 250, y: 170, maxWidth: 140, size: 8, align: "left" },
    },
  };
  const result = normalizeVoxSetlistLayout(saved);
  assert.equal(result.notes.pa.y, defaultVoxSetlistLayout.notes.pa.y);
  assert.equal(result.notes.lighting.x, 250);
  assert.equal(result.notes.lighting.y, 170);
});
