/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, imports = {}, globals = {}) {
 const exports = {};
 const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>imports[name]??require(name),Buffer,URL,URLSearchParams,AbortSignal,Date,...globals});return exports;
}
const safe = load('lib/safeRedirect.ts');
const oauth = load('lib/discordOAuth.ts');
const secret = 'test-secret';
const payload = () => ({sub:'12345678-1234-1234-1234-123456789abc',sid:'12345678-1234-1234-1234-123456789abd',next:'/me/profile/edit',iat:Date.now(),nonce:'a'.repeat(64)});
const sign = p => {const encoded = Buffer.from(JSON.stringify(p)).toString('base64url');return encoded+'.'+crypto.createHmac('sha256',secret).update(encoded).digest('base64url');};
test('redirects reject external origins, backslashes, controls and script schemes',()=>{
 for(const value of ['//evil.test','/\\evil.test','/\nevil.test','javascript:alert(1)',null,'https://evil.test']) assert.equal(safe.safeInternalPath(value),'/');
 assert.equal(safe.safeInternalPath('/events?q=hello%20world'),'/events?q=hello%20world');
});
test('signed state validates format, identity, expiration and timestamp',()=>{
 assert.equal(oauth.verifyDiscordState(sign(payload()),secret).sub,payload().sub);
 for(const p of [null,{}, {...payload(),iat:Date.now()+10000},{...payload(),iat:Date.now()-610000},{...payload(),sub:'someone'},{...payload(),nonce:'x'}]) assert.equal(oauth.verifyDiscordState(sign(p),secret),null);
 for(const state of [sign(payload())+'.extra','abc.'+'あ'.repeat(43),sign(payload()).slice(0,-1)+'!']) assert.equal(oauth.verifyDiscordState(state,secret),null);
});
function callbackHarness(fail = false) {
 let fetches=0,updates=0;
 const NextResponse = {redirect(url){return {url:String(url),headers:new Headers(),cookies:{set(...args){this.value=args;}}};}};
 const route=load('app/auth/discord/callback/route.ts',{'next/server':{NextResponse},'@/lib/baseUrl':{getBaseUrl:()=> 'https://portal.test'},'@/lib/discordOAuth':oauth,'@/lib/safeRedirect':safe,'@supabase/supabase-js':{createClient:()=>({rpc:async()=>({data:true,error:null}),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:"active"},error:null})})}),update:()=>({eq:async()=>{updates++;return {error:null};}})})})}}, {Headers,process:{env:{DISCORD_CLIENT_ID:'id',DISCORD_CLIENT_SECRET:secret,NEXT_PUBLIC_SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'test'}},fetch:async()=>{fetches++;if(fail)throw Error('offline');return {ok:true,json:async()=> fetches===1?{access_token:'test-token'}:{id:'123456789',username:'mock'}};}});
 return {route,counts:()=>({fetches,updates})};
}
test('Discord callback rejects copied state without browser cookie before network or writes',async()=>{
 const h=callbackHarness();const state=sign(payload());const result=await h.route.GET(new Request('https://portal.test/auth/discord/callback?code=test&state='+state));assert.match(result.url,/discord=error/);assert.deepEqual(h.counts(),{fetches:0,updates:0});
});
test('Discord successful link uses bound state, clears cookie and confines redirect',async()=>{
 const h=callbackHarness();const state=sign({...payload(),next:'/\\evil.test'});const result=await h.route.GET(new Request('https://portal.test/auth/discord/callback?code=test&state='+state,{headers:{cookie:oauth.discordStateCookie+'='+state}}));assert.equal(new URL(result.url).origin,'https://portal.test');assert.match(result.url,/discord=connected/);assert.equal(result.cookies.value[2].maxAge,0);assert.deepEqual(h.counts(),{fetches:2,updates:1});
});
test('Discord network failures produce recoverable error and no database write',async()=>{
 const h=callbackHarness(true);const state=sign(payload());const result=await h.route.GET(new Request('https://portal.test/auth/discord/callback?code=test&state='+state,{headers:{cookie:oauth.discordStateCookie+'='+state}}));assert.match(result.url,/discord=error/);assert.equal(h.counts().updates,0);
});
function hookHarness(file, exportName) {
 const values=[], effects=[], jobs=[], requests=[];let cursor=0,user='A';
 const react={useState(initial){const slot=cursor++;if(!(slot in values))values[slot]=typeof initial==='function'?initial():initial;return [values[slot],value=>{values[slot]=typeof value==='function'?value(values[slot]):value;}];},useEffect(fn,deps){const slot=cursor++;const old=effects[slot];if(!old||deps.some((value,index)=>value!==old.deps[index])){old?.cleanup?.();effects[slot]={deps};jobs.push(()=>{effects[slot].cleanup=fn();});}},useCallback:fn=>fn,useMemo:fn=>fn(),createContext:()=>({Provider:'provider'}),useContext:()=>({})};
 const fetchLeaderRoles=id=>new Promise((resolve,reject)=>requests.push({id,resolve,reject}));
 const storage=load('lib/browserStorage.ts',{}, {window:{get localStorage(){throw Error('blocked');}}});
 const compiled=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};const imports={react,'@/contexts/AuthContext':{useAuth:()=>({session:user?{user:{id:user}}:null,loading:false})},'@/contexts/AdminModeContext':{useAdminMode:()=>({suppressPrivilegedAccess:false,loading:false})},'@/lib/leaderRoles':{fetchLeaderRoles},'@/lib/browserStorage':storage};
 vm.runInNewContext(compiled,{exports,require:name=>imports[name]??require(name),window:{addEventListener(){},removeEventListener(){}},console:{error(){}}});
 return {requests,setUser:value=>user=value,render(){cursor=0;const result=exports[exportName]({children:null});while(jobs.length)jobs.shift()();return result.props?.value??result;}};
}
const tick=()=>new Promise(setImmediate);
test('role flags are hidden immediately on account change, logout and fetch failure',async()=>{
 const h=hookHarness('lib/useRoleFlags.ts','useRoleFlags');h.render();h.requests[0].resolve(['Administrator']);await tick();assert.equal(h.render().isAdministrator,true);
 h.setUser('B');assert.equal(h.render().isAdministrator,false);h.requests[1].reject(Error('offline'));await tick();assert.equal(h.render().canAccessAdmin,false);assert.equal(h.render().loading,false);
 h.setUser(null);assert.equal(h.render().isAdministrator,false);
});
test('administrator mode does not cross accounts and blocked storage preserves fetched roles',async()=>{
 const h=hookHarness('contexts/AdminModeContext.tsx','AdminModeProvider');h.render();h.requests[0].resolve(['Administrator']);await tick();let value=h.render();assert.equal(value.actualIsAdministrator,true);value.setMode('general');assert.equal(h.render().mode,'general');
 h.setUser('B');value=h.render();assert.equal(value.canToggleMode,false);assert.equal(value.mode,'administrator');assert.equal(value.loading,true);h.requests[1].resolve([]);await tick();assert.equal(h.render().actualIsAdministrator,false);
 h.setUser('A');assert.equal(h.render().canToggleMode,false);h.requests[2].resolve(['Administrator']);await tick();assert.equal(h.render().canToggleMode,true);
});
function callbackPageHarness(errorDescription = null) {
 const timers=new Map(),redirects=[];let callback,cleanup,serial=0,signouts=0,inside=false,queryInside=false,resolveRole;
 const role=new Promise(resolve=>resolveRole=resolve);
 const supabase={auth:{onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>({data:{session:null}})},from(){queryInside ||= inside;return {select:()=>({eq:()=>role})};}};
 const exports={};let source=fs.readFileSync('app/auth/callback/page.tsx','utf8').replace('function AuthCallbackContent()', 'export function AuthCallbackContent()');source=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const imports={react:{useEffect:fn=>cleanup=fn()},'next/navigation':{useRouter:()=>({replace:path=>redirects.push(path)}),useSearchParams:()=>({get:()=>errorDescription})},'@/lib/supabaseClient':{supabase,safeSignOut:async()=>{signouts++;}},'@/lib/authEmail':{getUserEmail:user=>user.email,hasAllowedEmail:user=>user.email.endsWith('@allowed.test'),isGmailAddress:email=>email.endsWith('@gmail.com'),emailPolicyMessage:'denied'}};
 vm.runInNewContext(source,{exports,require:name=>imports[name]??require(name),window:{setTimeout(fn,delay){timers.set(++serial,{fn,delay});return serial;},clearTimeout:id=>timers.delete(id)},console});exports.AuthCallbackContent();
 return {redirects,resolveRole,cleanup:()=>cleanup?.(),signouts:()=>signouts,queryInside:()=>queryInside,emit(session){inside=true;callback('SIGNED_IN',session);inside=false;},flush(){for(const [id,job] of timers)if(job.delay===0){timers.delete(id);job.fn();}}};
}
test('auth callback accepts literal percent errors without double decoding',()=>{
 const h=callbackPageHarness('Bad % input');assert.equal(new URL(h.redirects[0],'https://portal.test').searchParams.get('error'),'Bad % input');
});
test('auth role checks are deferred and obsolete account checks cannot sign out a new user',async()=>{
 const h=callbackPageHarness();h.emit({user:{id:'A',email:'a@gmail.com'}});h.flush();assert.equal(h.queryInside(),false);
 h.emit({user:{id:'B',email:'b@allowed.test'}});h.flush();h.resolveRole({data:[{leader:'none'}],error:null});await tick();assert.deepEqual(h.redirects,['/']);assert.equal(h.signouts(),0);h.cleanup();
});
