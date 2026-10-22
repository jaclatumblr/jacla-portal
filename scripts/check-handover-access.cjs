/* eslint-disable @typescript-eslint/no-require-imports -- Test the real hook with isolated auth and database state. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

async function access({ roles = [], primary = "none", leadersError = null, profileError = null, positions = [], positionError = null, suppress = false } = {}) {
  const states = [];
  const effects = [];
  const filters = [];
  let cursor = 0;
  let session = { user: { id: "current-user" } };
  let runEffects = true;
  const queryFor = table => ({
    select() { return this; },
    eq(column, value) { if (table === "profile_positions") filters.push([column, value]); return this; },
    maybeSingle: async () => ({ data: { leader: primary }, error: profileError }),
    then(resolve, reject) {
      if (table === "profile_leaders") return Promise.resolve({ data: roles.map(leader => ({ leader })), error: leadersError }).then(resolve, reject);
      return Promise.resolve({ data: positions.map(position => ({ position })), error: positionError }).then(resolve, reject);
    },
  });
  const imports = {
    react: {
      useState(initial) {
        const index = cursor++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
        return [states[index], value => { states[index] = value; }];
      },
      useEffect(effect) { if (runEffects) effects.push(effect); },
    },
    "@/contexts/AuthContext": { useAuth: () => ({ session, loading: false }) },
    "@/contexts/AdminModeContext": { useAdminMode: () => ({ suppressPrivilegedAccess: suppress, loading: false }) },
    "@/lib/supabaseClient": { supabase: { from: queryFor } },
  };
  const leaderExports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/leaderRoles.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: leaderExports, require: name => imports[name], console: { error() {} } });
  imports["@/lib/leaderRoles"] = leaderExports;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync("lib/useRoleFlags.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: name => imports[name], console: { error() {} } });
  const render = () => { cursor = 0; return exports.useRoleFlags(); };
  const pending = render();
  assert.equal(pending.canViewHandover, false);
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  runEffects = false;
  const result = render();
  session = null;
  assert.equal(render().canViewHandover, false, "logout must hide previously authorized content");
  return { result, filters };
}

for (const role of ["Administrator", "Supervisor", "PA Leader", "Lighting Leader"]) {
  test(`${role} can read handover`, async () => {
    const { result } = await access({ roles: [role] });
    assert.equal(result.canViewHandover, true);
  });
}

test("Treasurer can read handover without gaining management permissions", async () => {
  const { result, filters } = await access({ positions: ["Treasurer"] });
  assert.equal(result.canViewHandover, true);
  assert.equal(result.canAccessAdmin, false);
  assert.equal(result.isAdmin, false);
  assert.deepEqual(filters, [["profile_id", "current-user"], ["position", "Treasurer"]]);
});

test("ordinary members and part leaders cannot read handover", async () => {
  for (const roles of [[], ["Part Leader"]]) {
    assert.equal((await access({ roles })).result.canViewHandover, false);
  }
});

test("failed position lookup does not grant access", async () => {
  assert.equal((await access({ positions: ["Treasurer"], positionError: { message: "denied" } })).result.canViewHandover, false);
});

test("General mode suppresses handover access", async () => {
  assert.equal((await access({ roles: ["Administrator"], suppress: true })).result.canViewHandover, false);
});

function renderPage(file, exportName, flags, { mobileOpen = false } = {}) {
  let stateIndex = 0;
  const stub = () => null;
  const generic = new Proxy({ __esModule: true, default: stub }, { get: (target, key) => target[key] ?? stub });
  const imports = {
    react: {
      useState(initial) { const index = stateIndex++; return [mobileOpen && index === 1 ? true : typeof initial === "function" ? initial() : initial, stub]; },
      useEffect: stub, useLayoutEffect: stub, useRef: () => ({ current: null }), useCallback: fn => fn,
    },
    "next/link": { __esModule: true, default: "test-link" },
    "next/navigation": { usePathname: () => "/admin/handover", useRouter: () => ({}) },
    "react-markdown": { __esModule: true, default: "test-markdown" },
    "@/lib/useRoleFlags": { useRoleFlags: () => flags },
    "@/contexts/AuthContext": { useAuth: () => ({ session: { user: { id: "current-user", user_metadata: {} } } }) },
    "@/contexts/DesignPresetContext": { useDesignPreset: () => ({ preset: "original" }) },
    "@/lib/utils": { cn: (...args) => args.filter(value => typeof value === "string").join(" ") },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] ?? (name === "react/jsx-runtime" ? require(name) : generic), console });
  const flatten = node => Array.isArray(node) ? node.flatMap(flatten) : !node || typeof node !== "object" ? [] : [node, ...flatten(node.props?.children)];
  return flatten(exports[exportName]({ content: "## 運用手順\n本文" }));
}

for (const role of ["Supervisor", "PA Leader", "Lighting Leader"]) {
  for (const source of ["multiple roles", "legacy primary", "table unavailable"]) {
    test(`${role}: ${source} reaches desktop/mobile entry, dashboard and document`, async () => {
      const { result } = await access(source === "multiple roles" ? { roles: ["Part Leader", role] }
        : { primary: role, leadersError: source === "table unavailable" ? { code: "PGRST205" } : null });
      assert.equal(result.canViewHandover, true);
      assert.equal(result.canAccessAdmin, true);
      assert.equal(result.isAdmin, role === "Supervisor");
      const desktop = renderPage("components/SideNav.tsx", "SideNav", result);
      const mobile = renderPage("components/SideNav.tsx", "SideNav", result, { mobileOpen: true });
      assert.ok(desktop.some(node => node.props?.href === "/admin"));
      assert.ok(mobile.filter(node => node.props?.href === "/admin").length >= 2);
      const dashboard = renderPage("app/admin/page.tsx", "default", result);
      assert.ok(dashboard.some(node => node.props?.href === "/admin/handover"));
      const document = renderPage("app/admin/handover/HandoverPageClient.tsx", "HandoverPageClient", result);
      assert.ok(document.some(node => node.type === "test-markdown"));
    });
  }
}

test("failed role lookup blocks the document and dashboard entry", async () => {
  const { result } = await access({ leadersError: { message: "denied" }, profileError: { message: "denied" } });
  assert.equal(result.canViewHandover, false);
  assert.ok(!renderPage("app/admin/page.tsx", "default", result).some(node => node.props?.href === "/admin/handover"));
  assert.ok(!renderPage("app/admin/handover/HandoverPageClient.tsx", "HandoverPageClient", result).some(node => node.type === "test-markdown"));
});

test("Treasurer dashboard exposes only the handover management link", async () => {
  const { result } = await access({ positions: ["Treasurer"] });
  const links = renderPage("app/admin/page.tsx", "default", result).filter(node => node.props?.href?.startsWith("/admin"));
  assert.deepEqual(links.map(node => node.props.href), ["/admin/handover"]);
});

async function guardRedirects(role, { open = true, phone = "09000000000" } = {}) {
  const redirects = [];
  const effects = [];
  const dataFor = table => table === "profile_leaders" ? [{ leader: role }]
    : table === "site_settings" ? { is_open: open }
      : table === "profiles" ? { display_name: "Member", real_name: "Member Name", part: "Gt.", leader: role }
        : { student_id: "test-id", enrollment_year: 2026, phone_number: phone };
  const imports = {
    react: { useEffect: effect => effects.push(effect) },
    "@/contexts/AuthContext": { useAuth: () => ({ session: { user: { id: "current-user", email: "member@edu.teu.ac.jp" } }, loading: false }) },
    "next/navigation": { useRouter: () => ({ replace: url => redirects.push(url) }), usePathname: () => "/admin/handover" },
    "@/lib/authEmail": { getUserEmail: user => user.email, hasAllowedEmail: () => true, isGmailAddress: () => false },
    "@/lib/supabaseClient": { supabase: { from(table) {
      const query = { select() { return this; }, eq() { return this; },
        maybeSingle: async () => ({ data: dataFor(table), error: null }),
        then: (resolve, reject) => Promise.resolve({ data: dataFor(table), error: null }).then(resolve, reject) };
      return query;
    } } },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync("lib/AuthGuard.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => imports[name] ?? require(name), console });
  exports.AuthGuard({ children: "document" });
  effects.forEach(effect => effect());
  await new Promise(resolve => setImmediate(resolve));
  return redirects;
}

for (const role of ["Supervisor", "PA Leader", "Lighting Leader"]) {
  test(`${role}: common auth guard allows completed university account while open`, async () => {
    assert.deepEqual(await guardRedirects(role), []);
  });
  test(`${role}: closed site follows existing administrator-only policy`, async () => {
    assert.deepEqual(await guardRedirects(role, { open: false }), role === "Supervisor" ? [] : ["/closed"]);
  });
  test(`${role}: missing phone requires profile completion`, async () => {
    assert.deepEqual(await guardRedirects(role, { phone: "" }), ["/me/profile/edit?required=phone"]);
  });
}
