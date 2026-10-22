/* eslint-disable @typescript-eslint/no-require-imports -- Runs the actual migration in an isolated PostgreSQL engine. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PGlite } = require(process.env.JACLA_PGLITE_MODULE || path.join(os.tmpdir(),'jacla-lifecycle-db-tests/node_modules/@electric-sql/pglite'));
const migration=fs.readFileSync(path.join(__dirname,'../SQL/AccountLifecycle.sql'),'utf8');
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002', C='10000000-0000-0000-0000-000000000003';
const SA='20000000-0000-0000-0000-000000000001', SB='20000000-0000-0000-0000-000000000002';
async function setup() {
 const db=new PGlite();
 await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;
 create schema auth; create schema storage;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
 create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
 create table auth.users(id uuid primary key, banned_until timestamptz);
 create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id) on delete cascade, not_after timestamptz);
 create type leader_role as enum ('none','Administrator','Supervisor','PA Leader','Lighting Leader','Part Leader');
 create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,leader leader_role default 'none');
 create table public.profile_leaders(profile_id uuid references public.profiles(id) on delete cascade,leader leader_role);
 create table public.profile_positions(profile_id uuid references public.profiles(id) on delete cascade,position text);
 create table public.band_members(id int primary key,user_id uuid references public.profiles(id) on delete cascade,band_id int);
 create table public.secrets(id int primary key, value text);
 create table storage.objects(id int primary key);
 alter table public.secrets enable row level security;
 create policy existing_read on public.secrets for select to authenticated using(true);
 create policy existing_write on public.secrets for all to authenticated using(true) with check(true);
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 grant execute on all functions in schema auth to authenticated,service_role;
 grant select,insert,update,delete on public.secrets to authenticated;
 create function public.is_admin_or_supervisor(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=uid and leader in ('Administrator','Supervisor')) or exists(select 1 from public.profile_leaders where profile_id=uid and leader in ('Administrator','Supervisor')) $$;
 insert into auth.users(id) values('${A}'),('${B}'),('${C}');
 insert into auth.sessions(id,user_id) values('${SA}','${A}'),('${SB}','${B}');
 insert into public.profiles values('${A}','管理者','Administrator'),('${B}','卒業予定','Supervisor'),('${C}','一般部員','none');
 insert into public.profile_leaders values('${A}','Administrator'),('${B}','Supervisor');
 insert into public.profile_positions values('${B}','Web Secretary');
 insert into public.band_members values(1,'${B}',10);
 insert into public.secrets values(1,'部内限定');
 `);
 await db.exec(fs.readFileSync(path.join(__dirname,'../SQL/ProfileLeaders.sql'),'utf8'));
 await db.exec(migration);
 return db;
}
async function scalar(db,sql,params=[]) {return Object.values((await db.query(sql,params)).rows[0])[0];}
async function asUser(db,userId,sessionId) {await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:'authenticated',sub:userId,session_id:sessionId})]);await db.exec('set role authenticated');}
async function reset(db) {await db.exec('reset role');await db.query("select set_config('request.jwt.claims','{}',false)");}

test('migration is repeatable, initializes grace period and protects service-only procedures',async()=>{
 const db=await setup();try {
 assert.equal(await scalar(db,'select count(*) from public.portal_accounts where status=\'active\' and last_active_at > now()-interval \'1 minute\''),3);
 await db.exec(migration);
 assert.equal(await scalar(db,'select count(*) from public.portal_accounts'),3);
 await asUser(db,A,SA);
 await assert.rejects(db.query("select public.portal_set_account_status($1,'graduated',$2,'test')",[B,A]),/permission denied/);
 await assert.rejects(db.query('select public.portal_process_inactive_accounts()'),/permission denied/);
 await assert.rejects(db.query("update public.portal_accounts set status='active' where profile_id=$1",[B]),/permission denied/);
 assert.equal(await scalar(db,'select count(*) from public.secrets'),1);
 } finally {await db.close();}
});
test('archival retains names and bands, bans sign-in, revokes sessions and roles atomically; restoration needs fresh session',async()=>{
 const db=await setup();try {
 await db.query("select public.portal_set_account_status($1,'graduated',$2,'卒業')",[B,A]);
 assert.equal(await scalar(db,'select display_name from public.profiles where id=$1',[B]),'卒業予定');
 assert.equal(await scalar(db,'select count(*) from public.band_members where user_id=$1',[B]),1);
 assert.equal(await scalar(db,'select count(*) from auth.sessions where user_id=$1',[B]),0);
 assert.equal(await scalar(db,'select banned_until > now() from auth.users where id=$1',[B]),true);
 assert.equal(await scalar(db,'select leader from public.profiles where id=$1',[B]),'none');
 assert.equal(await scalar(db,'select count(*) from public.profile_leaders where profile_id=$1',[B]),0);
 assert.equal(await scalar(db,'select count(*) from public.profile_positions where profile_id=$1',[B]),0);
 assert.equal(await scalar(db,'select count(*) from public.portal_account_events where profile_id=$1',[B]),1);
 await assert.rejects(db.query('delete from auth.users where id=$1',[B]),/Archived member history/);
 await assert.rejects(db.query("insert into public.profile_leaders values($1,'Supervisor')",[B]),/Restore this member/);
 await assert.rejects(db.query('insert into public.band_members values(2,$1,20)',[B]),/Member is archived/);
 await asUser(db,B,SB);
 assert.equal(await scalar(db,'select count(*) from public.secrets'),0);
 await assert.rejects(db.query('insert into public.secrets values(2,\'bad\')'),/row-level security/);
 await assert.rejects(db.query('select public.portal_check_access()'),/inactive or session was revoked/);
 await assert.rejects(db.query('select public.portal_touch_activity()'),/Account inactive/);
 await reset(db);
 await db.query("select public.portal_set_account_status($1,'active',$2,'本人確認済み')",[B,A]);
 assert.equal(await scalar(db,'select banned_until is null from auth.users where id=$1',[B]),true);
 assert.equal(await scalar(db,'select public.portal_user_has_access($1,$2)',[B,SB]),false);
 const restoredSession='20000000-0000-0000-0000-000000000099';
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[restoredSession,B]);
 assert.equal(await scalar(db,'select public.portal_user_has_access($1,$2)',[B,restoredSession]),true);
 assert.equal(await scalar(db,'select public.portal_user_has_access($1,$2)',[B,SB]),false);
 assert.equal(await scalar(db,'select leader from public.profiles where id=$1',[B]),'none');
 } finally {await db.close();}
});
test('daily job warns first, respects 30-day grace, resets on real use and is idempotent',async()=>{
 const db=await setup();try {
 await db.query("update public.portal_accounts set last_active_at=now()-interval '7 months' where profile_id=$1",[B]);
 let result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.warned,1);assert.equal(result.suspended,0);
 result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.warned,0);assert.equal(result.suspended,0);
 await asUser(db,B,SB);await db.query('select public.portal_touch_activity()');await reset(db);
 assert.equal(await scalar(db,'select warning_at is null from public.portal_accounts where profile_id=$1',[B]),true);
 await db.query("update public.portal_accounts set last_active_at=now()-interval '7 months',warning_at=now()-interval '31 days' where profile_id=$1",[B]);
 result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.suspended,1);
 assert.equal(await scalar(db,'select status from public.portal_accounts where profile_id=$1',[B]),'dormant');
 result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.suspended,0);
 // The last active administrator remains available for recovery.
 await db.query("update public.portal_accounts set last_active_at=now()-interval '7 months',warning_at=now()-interval '31 days' where profile_id=$1",[A]);
 result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.skipped_last_admin,1);
 } finally {await db.close();}
});
test('new profiles get records and self-service or inactive administrators cannot change states',async()=>{
 const db=await setup();try {
 const D='10000000-0000-0000-0000-000000000004';await db.query('insert into auth.users(id) values($1)',[D]);await db.query("insert into public.profiles(id,display_name) values($1,'new')",[D]);
 assert.equal(await scalar(db,'select status from public.portal_accounts where profile_id=$1',[D]),'active');
 await assert.rejects(db.query("select public.portal_set_account_status($1,'dormant',$1,'self')",[A]),/own account/);
 await assert.rejects(db.query("select public.portal_set_account_status($1,'dormant',$2,'not admin')",[B,C]),/permission required/);
 await db.query("select public.portal_set_account_status($1,'graduated',$2,'卒業')",[B,A]);
 await assert.rejects(db.query("select public.portal_set_account_status($1,'active',$2,'stale admin')",[C,B]),/permission required/);
 } finally {await db.close();}
});

test('archived membership cannot be moved into a new band through UPDATE',async()=>{
 const db=await setup();try {
 await db.query("select public.portal_set_account_status($1,'graduated',$2,'archive')",[B,A]);
 await assert.rejects(db.query('update public.band_members set band_id=20 where id=1'),/Member is archived/);
 await db.query('update public.band_members set band_id=10 where id=1');
 assert.equal(await scalar(db,'select band_id from public.band_members where id=1'),10);
 } finally {await db.close();}
});
test('stale administrator edits cannot overwrite a newer status change',async()=>{
 const db=await setup();try {
 const original=await scalar(db,'select status_changed_at::text from public.portal_accounts where profile_id=$1',[B]);
 await db.query("select public.portal_set_account_status($1,'graduated',$2,'archive',$3)",[B,A,original]);
 await assert.rejects(db.query("select public.portal_set_account_status($1,'active',$2,'stale restore',$3)",[B,A,original]),/changed by another administrator/);
 assert.equal(await scalar(db,'select status from public.portal_accounts where profile_id=$1',[B]),'graduated');
 assert.equal(await scalar(db,'select count(*) from public.portal_account_events where profile_id=$1',[B]),1);
 } finally {await db.close();}
});
test('expired sessions and externally banned accounts cannot access the database',async()=>{
 const db=await setup();try {
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[SB]);
 assert.equal(await scalar(db,'select public.portal_user_has_access($1,$2)',[B,SB]),false);
 await asUser(db,B,SB);assert.equal(await scalar(db,'select count(*) from public.secrets'),0);await reset(db);
 await db.query('update auth.sessions set not_after=null where id=$1',[SB]);
 await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[B]);
 assert.equal(await scalar(db,'select public.portal_user_has_access($1,$2)',[B,SB]),false);
 await asUser(db,B,SB);assert.equal(await scalar(db,'select count(*) from public.secrets'),0);
 } finally {await db.close();}
});
test('a banned administrator is not counted as a replacement for the last available admin',async()=>{
 const db=await setup();try {
 await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[B]);
 await db.query("update public.portal_accounts set last_active_at=now()-interval '7 months',warning_at=now()-interval '31 days' where profile_id=$1",[A]);
 const result=await scalar(db,'select public.portal_process_inactive_accounts()');assert.equal(result.skipped_last_admin,1);
 assert.equal(await scalar(db,'select status from public.portal_accounts where profile_id=$1',[A]),'active');
 } finally {await db.close();}
});
