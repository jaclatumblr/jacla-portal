/* eslint-disable @typescript-eslint/no-require-imports -- Isolated route and account-access regression tests. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,imports={},globals={}){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,require:name=>imports[name]??require(name),Buffer,Request,Response,URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,console,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://db.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',CRON_SECRET:'cron-test'}},...globals});return exports;}
const A='10000000-0000-0000-0000-000000000001',B='10000000-0000-0000-0000-000000000002',SID='20000000-0000-0000-0000-000000000001';
const token='signed.'+Buffer.from(JSON.stringify({session_id:SID})).toString('base64url')+'.verified';
const request=(path,method='GET',body)=>new Request('https://portal.test'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
test('account access requires both active status and a live session; DB failures fail closed',async()=>{
 let result={data:true,error:null};const calls=[];
 const {requireActivePortalAccount}=load('lib/accountAccess.ts',{'@supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return result;}})}});
 assert.equal(await requireActivePortalAccount(A,token),null);assert.equal(calls[0][1].p_session_id,SID);
 result={data:false,error:null};assert.equal((await requireActivePortalAccount(A,token)).status,403);
 result={data:true,error:{message:'offline'}};assert.equal((await requireActivePortalAccount(A,token)).status,503);
 assert.notEqual(await requireActivePortalAccount(A,'invalid'),null);
});
test('service-role routes reject inactive accounts before any profile reads or writes',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:A}},error:null})},from(){throw Error('Unexpected data access');}};
 const imports={'@/lib/safeRedirect':load('lib/safeRedirect.ts'),'@/lib/discordOAuth':load('lib/discordOAuth.ts'),'@/lib/baseUrl':{getBaseUrl:()=> 'https://portal.test'},'@/lib/accountAccess':{requireActivePortalAccount:async()=>Response.json({error:'inactive'},{status:403})},'@supabase/supabase-js':{createClient:()=>client},'@/lib/phone':{formatPhoneNumber:value=>value},'@/lib/profileGender':{normalizeProfileGender:()=>null},'@/lib/supabaseErrors':{isMissingColumnError:()=>false}};
 for(const file of ['app/api/account/delete/route.ts','app/api/feedback/route.ts','app/api/discord/connect/route.ts','app/api/discord/disconnect/route.ts','app/api/admin/profile-private/route.ts','app/api/admin/profile-private/batch/route.ts','app/api/admin/member-roster-template/route.ts','app/api/admin/match-vox-setlist-template/route.ts']){
  // Template modules have extensive independent dependencies. Their access guard is checked below.
  if(file.includes('template')){const source=fs.readFileSync(file,'utf8');assert.ok(source.indexOf('await requireActivePortalAccount')>source.indexOf('await authClient.auth.getUser'));continue;}
  const api=load(file,imports,{process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://db.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',DISCORD_CLIENT_ID:'id',DISCORD_CLIENT_SECRET:'secret'}}});assert.equal((await api.POST(request('/api/test','POST',{}))).status,403,file);
 }
 const auth=load('lib/adminApiAuth.ts',imports);const result=await auth.requireAdminApiAuth(request('/api/admin/test'));assert.equal(result.authorized,false);assert.equal(result.response.status,403);
});
test('account management validates changes and prevents self-deactivation',async()=>{
 const mutations=[];let authorized=true;
 const imports={'@/lib/adminApiAuth':{requireAdminApiAuth:async()=>authorized?{authorized:true,userId:A}:{authorized:false,response:Response.json({}, {status:403})}},'@/lib/accountLifecycle':load('lib/accountLifecycle.ts'),'@supabase/supabase-js':{createClient:()=>({rpc:async(name,args)=>{mutations.push([name,args]);return {error:null};}})}};
 const api=load('app/api/admin/accounts/route.ts',imports);
 for(const body of [null,[],{}, {profileId:B,status:'deleted',reason:'x'},{expectedChangedAt:'2026-10-22T00:00:00Z',profileId:B,status:'graduated',reason:''}])assert.equal((await api.PATCH(request('/api/admin/accounts','PATCH',body))).status,400);
 assert.equal((await api.PATCH(request('/api/admin/accounts','PATCH',{profileId:A,status:'dormant',reason:'x',expectedChangedAt:'2026-10-22T00:00:00Z'}))).status,409);
 assert.equal(mutations.length,0);
 assert.equal((await api.PATCH(request('/api/admin/accounts','PATCH',{expectedChangedAt:'2026-10-22T00:00:00Z',profileId:B,status:'graduated',reason:'卒業'}))).status,200);assert.equal(mutations[0][1].p_actor_id,A);
 authorized=false;assert.equal((await api.PATCH(request('/api/admin/accounts','PATCH',{profileId:B,status:'active',reason:'x'}))).status,403);assert.equal(mutations.length,1);
});
test('background access checks never record activity, while foreground use does',async()=>{
 let touches=0;
 const imports={'@/lib/accountAccess':{requireActivePortalAccount:async()=>null},'@supabase/supabase-js':{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:A}},error:null})},rpc:async()=>{touches++;return {error:null};}})}};
 const api=load('app/api/account/activity/route.ts',imports);
 assert.equal((await api.GET(request('/api/account/activity'))).status,200);assert.equal(touches,0);
 assert.equal((await api.POST(request('/api/account/activity','POST'))).status,200);assert.equal(touches,1);
});
test('daily job requires its dedicated secret and executes only the inactivity procedure',async()=>{
 const calls=[];const api=load('app/api/cron/inactive-accounts/route.ts',{'@supabase/supabase-js':{createClient:()=>({rpc:async name=>{calls.push(name);return {data:{warned:2,suspended:0},error:null};}})}});
 assert.equal((await api.GET(request('/api/cron/inactive-accounts'))).status,401);assert.equal(calls.length,0);
 const response=await api.GET(new Request('https://portal.test/api/cron/inactive-accounts',{headers:{authorization:'Bearer cron-test'}}));assert.equal(response.status,200);assert.equal(calls[0],'portal_process_inactive_accounts');
});
function trackerHarness() {
 const values=[], effects=[], pending=[], handlers=new Map(), timers=new Map(), calls=[], redirects=[];
 let holdNext=false, releaseFetch;
 let cursor=0, serial=0, now=2000000, status=200, user={user:{id:A},access_token:'first-token'},signouts=0;
 const router={replace:path=>redirects.push(path)};
 const react={useRef(initial){const slot=cursor++;return values[slot]??(values[slot]={current:initial});},useEffect(fn,deps){const slot=cursor++;const old=effects[slot];if(!old||deps.some((value,index)=>value!==old.deps[index])){old?.cleanup?.();effects[slot]={deps};pending.push(()=>effects[slot].cleanup=fn());}}};
 const surface={addEventListener(name,fn){handlers.set(name,fn);},removeEventListener(name){handlers.delete(name);},setInterval(fn){timers.set(++serial,fn);return serial;},clearInterval:id=>timers.delete(id)};
 const document={...surface,visibilityState:'visible'};
 const {AccountActivityTracker}=load('components/AccountActivityTracker.tsx',{react,'next/navigation':{usePathname:()=> '/',useRouter:()=>router},'@/contexts/AuthContext':{useAuth:()=>({session:user})},'@/lib/supabaseClient':{supabase:{auth:{signOut:async()=>{signouts++;},refreshSession:async()=>{status=200;return {data:{session:{user:{id:A},access_token:'renewed-token'}},error:null};}}}}},{window:surface,document,Date:{now:()=>now},fetch:async(url,options)=>{calls.push([url,options]);if(holdNext){holdNext=false;await new Promise(resolve=>releaseFetch=resolve);}return {status,ok:status===200};}});
 return {hold:()=>holdNext=true,release:()=>releaseFetch(),focus:()=>handlers.get('focus')(),calls,redirects,signouts:()=>signouts,render(){cursor=0;AccountActivityTracker();while(pending.length)pending.shift()();},refresh(){user={...user,access_token:'refreshed-token'};},poll(){for(const job of timers.values())job();},activity(){now+=16*60000;handlers.get('pointerdown')();},setStatus:value=>status=value};
}
const tick=()=>new Promise(setImmediate);
test('token refresh and background polls do not extend activity; real interaction does',async()=>{
 const h=trackerHarness();h.render();await tick();assert.equal(h.calls.length,1);assert.equal(h.calls[0][1].method,'POST');
 h.refresh();h.render();await tick();assert.equal(h.calls.length,1);
 h.poll();await tick();assert.equal(h.calls[1][1].method,'GET');assert.equal(h.calls[1][1].headers.Authorization,'Bearer refreshed-token');
 h.activity();await tick();assert.equal(h.calls[2][1].method,'POST');
 h.setStatus(403);h.poll();await tick();assert.equal(h.signouts(),1);assert.match(h.redirects[0],/^\/login\?error=/);
});

test('focus checks access within the activity throttle; interaction during polling is queued',async()=>{
 const h=trackerHarness();h.render();await tick();h.focus();await tick();assert.equal(h.calls[1][1].method,'GET');
 h.hold();h.poll();await tick();h.activity();assert.equal(h.calls.length,3);h.release();await tick();await tick();assert.equal(h.calls[3][1].method,'POST');
});
test('an expired foreground token is refreshed once instead of signing the user out',async()=>{
 const h=trackerHarness();h.render();await tick();h.setStatus(401);h.focus();await tick();await tick();
 assert.equal(h.signouts(),0);assert.equal(h.redirects.length,0);assert.equal(h.calls.at(-1)[1].headers.Authorization,'Bearer renewed-token');
});
