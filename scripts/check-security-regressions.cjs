/* eslint-disable @typescript-eslint/no-require-imports -- Isolated regression tests, no real accounts or external requests. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");
function load(file, imports = {}, globals = {}, expose = "") {
  const exports = {};
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8") + "\n" + expose, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(output, { exports, require: (name) => imports[name] ?? (name === "@/lib/accountAccess" ? { requireActivePortalAccount: async () => null } : require(name)), console, process, ...globals });
  return exports;
}
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function authHarness(blocked = false) {
  const values = [], effects = [], timers = new Map(), records = [], logs = [], markers = new Map([["loginLogged:legacy.token.copy", "1"]]);
  let cursor = 0, mounted = false, callback, insideAuthCallback = false, timerId = 0;
  const initial = deferred();
  const storage = { get length() { return markers.size; }, key: (index) => [...markers.keys()][index], getItem(key) { if (blocked) throw Error("blocked"); return markers.get(key) ?? null; }, setItem(key, value) { if (blocked) throw Error("blocked"); markers.set(key, value); }, removeItem(key) { if (blocked) throw Error("blocked"); markers.delete(key); } };
  const globals = { window: { sessionStorage: storage }, navigator: { userAgent: "test" }, setTimeout: (job) => { timers.set(++timerId, job); return timerId; }, clearTimeout: (id) => timers.delete(id), console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) } };
  const storageApi = load("lib/browserStorage.ts", {}, globals);
  const { AuthProvider } = load("contexts/AuthContext.tsx", {
    react: { createContext: () => ({ Provider: "provider" }), useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (value) => { values[index] = value; }]; }, useEffect(effect) { if (!mounted) effects.push(effect); } },
    "@/lib/browserStorage": storageApi,
    "@/lib/supabaseClient": { supabase: { auth: { getSession: () => initial.promise, onAuthStateChange(fn) { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; } }, from() { assert.equal(insideAuthCallback, false); return { insert: async (rows) => { records.push(...rows); return { error: null }; } }; } } },
  }, globals);
  return { initial, records, markers, logs,
    render() { cursor = 0; const result = AuthProvider({ children: null }).props.value; if (!mounted) { mounted = true; effects.forEach((run) => run()); } return result; },
    emit(event, session) { insideAuthCallback = true; callback(event, session); insideAuthCallback = false; },
    async flush() { const jobs = [...timers.values()]; timers.clear(); jobs.forEach((job) => job()); await tick(); },
  };
}
const session = (id) => ({ user: { id, email: `${id}@example.test` }, expires_at: 1000, access_token: "test-secret-access-token", refresh_token: "test-secret-refresh-token" });
test("auth events win over late initial session responses; token contents never become logs or storage keys", async () => {
  const h = authHarness(); h.render();
  h.emit("SIGNED_IN", session("B"));
  assert.equal(h.records.length, 0);
  h.initial.resolve({ data: { session: session("A") }, error: null }); await tick(); await h.flush();
  assert.equal(h.render().session.user.id, "B"); assert.equal(h.render().loading, false);
  assert.equal(h.records.length, 1);
  assert.equal(h.markers.has("loginLogged:legacy.token.copy"), false);
  assert.ok(!JSON.stringify([...h.markers.keys(), ...h.logs]).includes("test-secret"));
});
test("blocked session storage does not break login or duplicate login history; rejected restore releases loading", async () => {
  const h = authHarness(true); h.render();
  h.initial.reject(Error("offline")); await tick(); assert.equal(h.render().loading, false);
  h.emit("SIGNED_IN", session("A")); await h.flush();
  h.emit("SIGNED_IN", session("A")); await h.flush();
  assert.equal(h.records.length, 1); assert.equal(h.render().session.user.id, "A");
  h.emit("SIGNED_IN", session("B")); h.emit("SIGNED_OUT", null); await h.flush();
  assert.equal(h.records.length, 1); assert.equal(h.render().session, null);
});
test("query caches and rendered page trees are isolated by account", () => {
  const cleanup = [], instances = [];
  let userId = "A";
  const { QueryProvider } = load("components/QueryProvider.tsx", {
    react: { useState: (factory) => [factory(), () => {}], useEffect: (effect) => cleanup.push(effect()) },
    "@/contexts/AuthContext": { useAuth: () => ({ session: userId ? session(userId) : null }) },
    "@/lib/queryClient": { createQueryClient() { const client = new (require("@tanstack/react-query").QueryClient)(); instances.push(client); return client; } },
  });
  const a = QueryProvider({ children: "page" }); a.type(a.props); instances[0].setQueryData(["events"], ["private-A"]);
  userId = "B"; const b = QueryProvider({ children: "page" }); b.type(b.props);
  assert.notEqual(a.key, b.key); assert.equal(instances[1].getQueryData(["events"]), undefined);
  cleanup[0](); assert.equal(instances[0].getQueryData(["events"]), undefined);
  userId = null; assert.notEqual(QueryProvider({ children: null }).key, b.key);
});

function workerHarness({ blockedCache = false, networkFails = false, cacheControl = "public, max-age=60" } = {}) {
  const listeners = new Map(), puts = [], removed = [], waits = [];
  const cache = { match: async () => undefined, put: async (request) => puts.push(request.url), addAll: async () => {} };
  const globals = { URL, Response, caches: { open: async () => { if (blockedCache) throw Error("blocked"); return cache; }, match: async () => { if (blockedCache) throw Error("blocked"); return new Response("offline"); }, keys: async () => ["jacla-pwa-runtime-v1", "jacla-pwa-runtime-v2", "other-app"], delete: async (key) => removed.push(key) }, fetch: async () => { if (networkFails) throw Error("offline"); return new Response("network", { headers: { "cache-control": cacheControl } }); }, self: { location: { origin: "https://portal.example" }, clients: { claim() {} }, skipWaiting() {}, addEventListener: (name, callback) => listeners.set(name, callback) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8"), globals);
  return { puts, removed, async request(pathname, { mode = "cors", headers = {} } = {}) { let result; listeners.get("fetch")({ request: { url: `https://portal.example${pathname}`, method: "GET", mode, headers: new Headers(headers) }, respondWith: (promise) => { result = promise; }, waitUntil: (promise) => waits.push(promise) }); const response = result ? await result : undefined; await Promise.all(waits); return response; }, async activate() { const jobs = []; listeners.get("activate")({ waitUntil: (promise) => jobs.push(promise) }); await Promise.all(jobs); } };
}
test("service worker never shares page, RSC, authenticated or arbitrary data responses", async () => {
  const h = workerHarness();
  assert.equal(await (await h.request("/", { mode: "navigate" })).text(), "network");
  for (const url of ["/api/private", "/auth/callback", "/?_rsc=secret", "/member-export.json", "/private/photo.png"]) assert.equal(await h.request(url), undefined);
  assert.equal(await h.request("/images/avatar.png", { headers: { authorization: "Bearer test" } }), undefined);
  assert.equal(await h.request("/", { headers: { rsc: "1" } }), undefined);
  assert.equal(h.puts.length, 0);
  await h.request("/fonts/design/inter.woff2"); assert.equal(h.puts.length, 1);
  await h.activate(); assert.equal(h.removed.join(), "jacla-pwa-runtime-v1");
});
test("private static responses are not cached and cache failures cannot break network/offline responses", async () => {
  const privateWorker = workerHarness({ cacheControl: "private, no-store" });
  await privateWorker.request("/images/logo.png"); assert.equal(privateWorker.puts.length, 0);
  assert.equal(await (await workerHarness({ blockedCache: true }).request("/images/logo.png")).text(), "network");
  assert.equal(await (await workerHarness({ networkFails: true }).request("/", { mode: "navigate" })).text(), "offline");
  assert.equal((await workerHarness({ blockedCache: true, networkFails: true }).request("/images/logo.png")).type, "error");
});
test("metadata rejects IPv4-mapped loopback and revalidates DNS at connection time", async () => {
  let addresses = [{ address: "93.184.216.34", family: 4 }];
  const api = load("app/api/repertoire/metadata/route.ts", { "node:dns/promises": { lookup: async () => addresses } }, {}, "exports.privateHost = isPrivateHost; exports.publicLookup = publicLookup; exports.youtubeDuration = extractYouTubeDuration; exports.spotifyDuration = extractSpotifyDuration; exports.appleDuration = extractAppleMusicDuration;");
  for (const host of ["127.0.0.1", "::ffff:7f00:1", "::ffff:192.168.1.1", "fc00::1", "64:ff9b::7f00:1", "::1"]) assert.equal(api.privateHost(host), true, host);
  assert.equal(api.privateHost("2606:4700:4700::1111"), false);
  const resolve = () => new Promise((yes, no) => api.publicLookup("attacker.example", { all: true }, (error, value) => error ? no(error) : yes(value)));
  assert.equal((await resolve())[0].address, "93.184.216.34");
  addresses = [{ address: "127.0.0.1", family: 4 }]; await assert.rejects(resolve(), /Blocked/);
  assert.equal(api.youtubeDuration('{"lengthSeconds": "180"}'), 180);
  assert.equal(api.spotifyDuration('{"duration_ms": 180000}'), 180);
  assert.equal(api.appleDuration('{"durationInMillis": 180000}'), 180);
});

test("invalid API bodies return 400 without mutations; malformed deletion JSON never falls back to deleting the caller", async () => {
  const actor = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const mutations = [];
  const client = { auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }), admin: { deleteUser: async (id) => { mutations.push(["auth-delete", id]); return { error: null }; } } }, from(table) {
    const query = { select() { return query; }, eq() { return query; }, update() { mutations.push(["update", table]); return query; }, delete() { mutations.push(["delete", table]); return query; }, maybeSingle: async () => ({ data: table === "portal_accounts" ? { status: "active" } : { leader: "none" }, error: null }), then: (yes, no) => Promise.resolve({ data: [], error: null }).then(yes, no) };
    return query;
  } };
  const imports = { "@/lib/accountAccess": { requireActivePortalAccount: async () => null }, "@supabase/supabase-js": { createClient: () => client }, "@/lib/phone": { formatPhoneNumber: (value) => value }, "@/lib/profileGender": { normalizeProfileGender: () => null }, "@/lib/supabaseErrors": { isMissingColumnError: () => false } };
  const globals = { process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon", SUPABASE_SERVICE_ROLE_KEY: "test-service" } } };
  const request = (body) => new Request("https://portal.example/api/test", { method: "POST", headers: { authorization: "Bearer test-token", "content-type": "application/json" }, body });
  for (const file of ["app/api/account/delete/route.ts", "app/api/feedback/route.ts", "app/api/admin/profile-private/route.ts", "app/api/admin/profile-private/batch/route.ts"]) {
    const api = load(file, imports, globals);
    for (const body of ["invalid json", "null", "[]", "123"]) assert.equal((await api.POST(request(body))).status, 400, `${file} / ${body}`);
  }
  const deletion = load("app/api/account/delete/route.ts", imports, globals);
  for (const targetUserId of [null, "", 0, {}, "not-a-uuid"]) assert.equal((await deletion.POST(request(JSON.stringify({ targetUserId })))).status, 400);
  assert.equal((await deletion.POST(request(JSON.stringify({ targetUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" })))).status, 403);
  assert.equal(mutations.length, 0);
  assert.equal((await deletion.POST(request("{}"))).status, 200);
  assert.ok(mutations.some(([kind, id]) => kind === "auth-delete" && id === actor));
});
