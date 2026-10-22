/* eslint-disable @typescript-eslint/no-require-imports -- Isolated staged-rollout regression tests. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,imports={},globals={}) { const exports={};const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(source,{exports,require:name=>imports[name]??(name==='@/lib/accountSchema'?load('lib/accountSchema.ts'):require(name)),Buffer,URL,console,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://db.test',NEXT_PUBLIC_SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}},...globals});return exports; }
const missingTable={code:'PGRST205',message:"Could not find the table 'public.portal_accounts' in the schema cache"};
const missingFunction={code:'PGRST202',message:'Could not find the function public.portal_user_has_access in the schema cache'};
const profiles=[{id:'A'},{id:'B'},{id:'C'}];
const {fetchDirectoryProfiles}=load('lib/directoryProfiles.ts');
function directoryClient(accounts) {return {from(table){const result=table==='profiles'?{data:profiles,error:null}:accounts;return {select(){return this;},order(){return this;},then:(yes,no)=>Promise.resolve(result).then(yes,no)};}};}
test('pre-migration directory uses existing profiles without the missing join',async()=>{
 const result=await fetchDirectoryProfiles(directoryClient({data:null,error:missingTable}),'id',true);assert.equal(result.error,null);assert.equal(result.data.length,3);
});
test('installed directory excludes archived people; an empty state table never enables legacy mode',async()=>{
 const result=await fetchDirectoryProfiles(directoryClient({data:[{profile_id:'A',status:'active'},{profile_id:'B',status:'graduated'},{profile_id:'C',status:'dormant'}],error:null}),'id');assert.equal(result.data.length,1);assert.equal(result.data[0].id,'A');
 const empty=await fetchDirectoryProfiles(directoryClient({data:[],error:null}),'id');assert.equal(empty.data.length,0);
});
test('directory permission and network errors never return all profiles',async()=>{
 for(const error of [{code:'42501',message:'permission denied'},{code:'',message:'fetch failed'}]){const result=await fetchDirectoryProfiles(directoryClient({data:null,error}),'id');assert.equal(result.data,null);assert.equal(result.error,error);}
});
const userId='10000000-0000-0000-0000-000000000001';const token='verified.'+Buffer.from(JSON.stringify({session_id:'20000000-0000-0000-0000-000000000001'})).toString('base64url')+'.signature';
function accessHarness({rpcError=missingFunction,accountError=missingTable,account=null,profile={id:userId},profileError=null}={}) {
 const scopedHeaders=[];let reads=0;
 const access=load('lib/accountAccess.ts',{'@supabase/supabase-js':{createClient(url,key,options){return {rpc:async()=>({data:null,error:rpcError}),from(table){if(table==='profiles'){reads++;assert.equal(key,'anon');scopedHeaders.push(options.global.headers.Authorization);}return {select(){return this;},eq(){return this;},maybeSingle:async()=>table==='profiles'?{data:profile,error:profileError}:{data:account,error:accountError}};}};}}});
 return {access,scopedHeaders,reads:()=>reads};
}
test('legacy API access requires the caller JWT and a readable own profile',async()=>{
 const h=accessHarness();const result=await h.access.checkPortalAccountAccess(userId,token);assert.equal(result.response,null);assert.equal(result.lifecycleInstalled,false);assert.equal(h.scopedHeaders[0],'Bearer '+token);
});
test('partial migrations and archived accounts cannot use legacy API access',async()=>{
 const partial=accessHarness({accountError:null,account:{status:'active'}});assert.equal((await partial.access.requireActivePortalAccount(userId,token)).status,503);assert.equal(partial.reads(),0);
 const archived=accessHarness({accountError:null,account:{status:'graduated'}});assert.equal((await archived.access.requireActivePortalAccount(userId,token)).status,403);assert.equal(archived.reads(),0);
});
test('an unavailable access function never bypasses RLS, errors or a missing own profile',async()=>{
 for(const config of [{profile:null},{profile:{id:'different-user'}},{profileError:{code:'42501',message:'denied'}},{rpcError:{code:'XX000',message:'database failure'}}]){const h=accessHarness(config);assert.equal((await h.access.requireActivePortalAccount(userId,token)).status,503);}
});
test('legacy activity checks skip the uninstalled activity RPC',async()=>{
 let writes=0;
 const route=load('app/api/account/activity/route.ts',{'@/lib/accountAccess':{checkPortalAccountAccess:async()=>({response:null,lifecycleInstalled:false})},'@supabase/supabase-js':{createClient:()=>({auth:{getUser:async()=>({data:{user:{id:userId}},error:null})},rpc:async()=>{writes++;throw Error('Must not run');}})}});
 const response=await route.POST(new Request('https://portal.test/api/account/activity',{method:'POST',headers:{authorization:'Bearer '+token}}));assert.equal(response.status,200);assert.equal(writes,0);assert.equal((await response.json()).lifecycleInstalled,false);
});
