/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the actual role editor with isolated hooks and database mocks. */
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function harness(initialRoles, storedRoles = initialRoles) {
 const primary=initialRoles[0]??'none';
 const chiefs=initialRoles.flatMap(role=>role==='PA Leader'?['PA Chief']:role==='Lighting Leader'?['Lighting Chief']:[]);
 const profile={id:'target',display_name:'member',real_name:'Member Name',email:null,leader:primary,crew:'User',part:'Gt.',muted:false};
 const values={0:[profile],2:'target',3:{crew:'User',muted:false},4:{displayName:'member',realNameFamily:'Member',realNameGiven:'Name',email:''},5:[...initialRoles],7:[...chiefs],10:'Gt.',19:false};
 const writes=[],messages=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return [values[i],next=>values[i]=typeof next==='function'?next(values[i]):next];},useMemo:fn=>fn(),useEffect(){},useRef:()=>({current:null}),startTransition:fn=>fn()};
 const client={from(table){let action='read';const query={select(){return query;},eq(){return query;},in(column,ids){if(action==='delete')writes.push({table,action,ids});return query;},update(payload){action='update';writes.push({table,action,payload});return query;},upsert(payload){action='upsert';writes.push({table,action,payload});return query;},delete(){action='delete';return query;},maybeSingle:async()=>({data:profile,error:null}),then(yes,no){const data=action!=='read'?[]:table==='profile_leaders'?storedRoles.map((leader,i)=>({id:'role'+i,leader})):table==='profile_positions'?chiefs.map((position,i)=>({id:'position'+i,position})):[];return Promise.resolve({data,error:null}).then(yes,no);}};return query;}};
 const stubs=new Proxy({__esModule:true},{get:(target,key)=>key in target?target[key]:(()=>null)});
 const imports={react,'next/navigation':{useRouter:()=>({})},'@/lib/useRoleFlags':{useRoleFlags:()=>({isAdmin:true,canAccessAdmin:true,loading:false})},'@/contexts/AuthContext':{useAuth:()=>({session:{user:{id:'admin'},access_token:'mock'}})},'@/lib/supabaseClient':{supabase:client},'@/lib/utils':{cn:(...args)=>args.filter(value=>typeof value==='string').join(' ')},'@/lib/toast':{toast:{success:message=>messages.push(message),error:message=>{throw Error(message);}}},'@/lib/phone':{formatPhoneNumber:value=>value},'@/lib/profileGender':{profileGenderOptions:[],getProfileGenderLabel:()=>'',normalizeProfileGender:()=>null},'@/lib/supabaseErrors':{isMissingColumnError:()=>false}};
 const exports={};const source=ts.transpileModule(fs.readFileSync('app/admin/roles/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>imports[name]??(name==='react/jsx-runtime'?require(name):stubs),console,fetch:async()=>({ok:true}),window:{confirm:()=>true}});
 function flatten(node){if(Array.isArray(node))return node.flatMap(flatten);if(!node||typeof node!=='object')return [];return [node,...flatten(node.props?.children)];}
 let nodes=[];
 return {writes,messages,render(){cursor=0;nodes=flatten(exports.default());},uncheck(role){const label=nodes.find(node=>node.type==='label'&&flatten(node).some(child=>child.type==='span'&&child.props.children===role));assert.ok(label,role);flatten(label).find(node=>node.type==='input').props.onChange();},chiefChecked(name){const label=nodes.find(node=>node.type==='label'&&flatten(node).some(child=>child.type==='span'&&Array.isArray(child.props.children)&&child.props.children[0]===name));assert.ok(label,name);return flatten(label).find(node=>node.type==='input').props.checked;},save(){const button=nodes.find(node=>node.props?.onClick?.name==='handleSave');assert.ok(button);return button.props.onClick();}};
}
for(const [role,label] of [['PA Leader','PA長'],['Lighting Leader','照明長']]) {
 test(role+' removal clears its automatic chief position before save',async()=>{
 const h=harness([role]);h.render();assert.equal(h.chiefChecked(label),true);h.uncheck(role);h.render();assert.equal(h.chiefChecked(label),false);await h.save();
 assert.ok(h.writes.some(write=>write.table==='profile_leaders'&&write.action==='delete'&&write.ids.includes('role0')));
 assert.ok(h.writes.some(write=>write.table==='profile_positions'&&write.action==='delete'&&write.ids.includes('position0')));
 assert.ok(h.messages.length);
 });
}
test('removing PA retains an independently selected Lighting role and chief',async()=>{
 const h=harness(['PA Leader','Lighting Leader']);h.render();h.uncheck('PA Leader');h.render();assert.equal(h.chiefChecked('PA長'),false);assert.equal(h.chiefChecked('照明長'),true);await h.save();
 const roles=h.writes.find(write=>write.table==='profile_leaders'&&write.action==='delete');assert.deepEqual(roles.ids,['role0']);
 const positions=h.writes.find(write=>write.table==='profile_positions'&&write.action==='delete');assert.deepEqual(positions.ids,['position0']);
});
for(const role of ['PA Leader','Lighting Leader']) {
 test('legacy primary-only '+role+' is cleared in the database even without a role row to delete',async()=>{
  const h=harness([role],[]);h.render();h.uncheck(role);h.render();await h.save();
  assert.ok(h.writes.some(write=>write.table==='profiles'&&write.action==='update'&&write.payload.leader==='none'));
  assert.ok(h.writes.some(write=>write.table==='profile_positions'&&write.action==='delete'));
 });
}
