-- ================================================================
-- 클럽 라운지 2차 (2026-10-15) — club_lounge.sql 을 이미 돌린 DB 에 이어서 한 번 실행한다
--
-- 1. 클럽 이름은 대소문자까지 그대로 비교한다 (인게임: 이름은 겹칠 수 없고, 대소문자만 달라도 다른 이름)
-- 2. 클럽 되찾기 — 이미 등록된 이름으로 인증을 신청하면 막지 않고 "되찾기(claim)" 로 받는다.
--    관리자는 기존 클럽장에게 새 코드로 재인증을 요청(reverify)할 수 있다.
--    가짜로 판정된 쪽이 기존 클럽장이면 그 클럽은 통째로 없애고(클럽원도 가짜 코드로 들어온 사람들이라서),
--    진짜 클럽장이 같은 이름으로 새로 연다
-- 3. 클럽장 신청 제한 목록 (club_bans)
-- 4. 클럽원 신고 (club_reports) — 가짜 클럽장 의심 · 글 · 기타
-- ================================================================

set lock_timeout = '5s';

-- ── 1. 이름 ────────────────────────────────────────────────────
drop index if exists public.clubs_name_uq;
create unique index if not exists clubs_name_exact_uq on public.clubs (btrim(name));

-- ── 2. 신청 종류 ──────────────────────────────────────────────
alter table public.club_applications add column if not exists kind text not null default 'new'
  check (kind in ('new', 'claim', 'reverify'));
alter table public.club_applications add column if not exists target_club_id uuid;
alter table public.club_applications add column if not exists due_at timestamptz;

-- ── 3. 신청 제한 ──────────────────────────────────────────────
create table if not exists public.club_bans (
  user_id     uuid primary key,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid
);
alter table public.club_bans enable row level security;
drop policy if exists club_bans_read on public.club_bans;
create policy club_bans_read on public.club_bans for select to authenticated
  using (public.club_is_admin());
revoke all on public.club_bans from anon, authenticated;
grant select on public.club_bans to authenticated;

-- ── 4. 신고 ──────────────────────────────────────────────────
create table if not exists public.club_reports (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references public.clubs(id) on delete cascade,
  reporter_id  uuid not null default auth.uid(),
  kind         text not null check (kind in ('fake_leader', 'post', 'other')),
  post_id      uuid references public.club_posts(id) on delete set null,
  reason       text not null default '' check (char_length(reason) <= 500),
  status       text not null default 'open' check (status in ('open', 'closed')),
  note         text not null default '',
  created_at   timestamptz not null default now(),
  closed_at    timestamptz,
  closed_by    uuid
);
create index if not exists club_reports_open on public.club_reports (status, created_at desc);
/* 같은 사람이 같은 일로 여러 번 신고하지 못하게 — 처리되면 다시 할 수 있다 */
create unique index if not exists club_reports_once on public.club_reports
  (reporter_id, club_id, kind, coalesce(post_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status = 'open';
alter table public.club_reports enable row level security;
drop policy if exists club_reports_read on public.club_reports;
create policy club_reports_read on public.club_reports for select to authenticated
  using (reporter_id = auth.uid() or public.club_is_admin());
drop policy if exists club_reports_write on public.club_reports;
create policy club_reports_write on public.club_reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open' and public.club_is_member(club_id)
              and (post_id is null or exists (select 1 from public.club_posts p
                                              where p.id = post_id and p.club_id = club_reports.club_id)));
revoke all on public.club_reports from anon, authenticated;
grant select, insert on public.club_reports to authenticated;

-- ── 함수 ─────────────────────────────────────────────────────

/* 클럽장 신청 — 이미 있는 이름이면 되찾기(claim)로 받는다. 제한된 계정은 막는다 */
create or replace function public.club_start_application(p_club_name text, p_nickname text)
returns public.club_applications
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  r public.club_applications;
  c public.clubs;
  k text;
begin
  if exists (select 1 from public.club_bans where user_id = me) then
    raise exception '클럽장 신청이 제한된 계정이에요. 관리자에게 문의해 주세요';
  end if;
  if exists (select 1 from public.club_members where user_id = me and status = 'active') then
    raise exception '이미 클럽에 소속돼 있어요';
  end if;
  select * into c from public.clubs where btrim(name) = btrim(p_club_name);
  k := case when c.id is null then 'new' else 'claim' end;
  select * into r from public.club_applications
   where user_id = me and status in ('draft','pending') and kind <> 'reverify';
  if found then
    update public.club_applications
       set club_name = btrim(p_club_name), nickname = btrim(p_nickname), status = 'draft',
           kind = k, target_club_id = c.id
     where id = r.id returning * into r;
  else
    insert into public.club_applications (user_id, club_name, nickname, code, kind, target_club_id)
    values (me, btrim(p_club_name), btrim(p_nickname),
            'DM-' || lpad((floor(random() * 10000))::int::text, 4, '0'), k, c.id)
    returning * into r;
  end if;
  return r;
end $$;

/* 새 클럽 심사 — 되찾기·재인증은 분쟁 처리(club_resolve_dispute)로 */
create or replace function public.club_review_application(p_id uuid, p_approve boolean, p_reason text default '')
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  r public.club_applications;
  cid uuid;
begin
  if not public.club_is_admin() then raise exception '관리자만 심사할 수 있어요'; end if;
  select * into r from public.club_applications where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception '심사할 신청이 아니에요'; end if;
  if r.kind <> 'new' then raise exception '되찾기·재인증 신청은 분쟁 탭에서 처리해 주세요'; end if;
  if not p_approve then
    update public.club_applications
       set status = 'rejected', reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
     where id = p_id;
    return null;
  end if;
  if exists (select 1 from public.club_members where user_id = r.user_id and status = 'active') then
    raise exception '신청자가 이미 다른 클럽에 소속돼 있어요';
  end if;
  if exists (select 1 from public.clubs where btrim(name) = btrim(r.club_name)) then
    raise exception '같은 이름의 클럽이 이미 있어요';
  end if;
  delete from public.club_members where user_id = r.user_id and status = 'pending';
  insert into public.clubs (name, leader_id, invite_code)
  values (btrim(r.club_name), r.user_id, public.club_gen_invite()) returning id into cid;
  insert into public.club_members (club_id, user_id, nickname, role, status, joined_at)
  values (cid, r.user_id, r.nickname, 'leader', 'active', now());
  update public.club_applications
     set status = 'approved', club_id = cid, reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
   where id = p_id;
  return cid;
end $$;

/* 관리자 — 기존 클럽장에게 새 코드로 재인증을 요청한다. 이미 요청 중이면 코드와 기한을 새로 */
create or replace function public.club_request_reverify(p_club uuid, p_hours int default 48)
returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  c public.clubs;
  nick text;
  code text := 'DM-' || lpad((floor(random() * 10000))::int::text, 4, '0');
begin
  perform public.club_need_login();
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into c from public.clubs where id = p_club;
  if not found then raise exception '클럽이 없어요'; end if;
  select nickname into nick from public.club_members where club_id = c.id and user_id = c.leader_id;
  update public.club_applications set status = 'cancelled'
   where user_id = c.leader_id and status in ('draft','pending');
  insert into public.club_applications (user_id, club_name, nickname, code, kind, target_club_id, due_at)
  values (c.leader_id, c.name, coalesce(nick, '클럽장'), code, 'reverify', c.id,
          now() + make_interval(hours => greatest(1, least(p_hours, 24 * 14))));
  return code;
end $$;

create or replace function public.club_ban(p_user uuid, p_reason text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  insert into public.club_bans (user_id, reason, created_by) values (p_user, coalesce(p_reason, ''), me)
  on conflict (user_id) do update set reason = excluded.reason, created_at = now(), created_by = me;
  update public.club_applications set status = 'cancelled'
   where user_id = p_user and status in ('draft','pending') and kind <> 'reverify';
end $$;

create or replace function public.club_unban(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  delete from public.club_bans where user_id = p_user;
end $$;

/* 관리자 — 분쟁 판정.
   p_winner = 'claimant' : 되찾기 신청자가 진짜. 기존 클럽을 통째로 없애고 같은 이름으로 새로 연다
   p_winner = 'leader'   : 기존 클럽장이 진짜. 되찾기 신청을 반려한다
   p_ban 이면 진 쪽을 클럽장 신청 제한 목록에 올린다 */
create or replace function public.club_resolve_dispute(p_claim uuid, p_winner text, p_ban boolean default false, p_reason text default '')
returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  a public.club_applications;
  c public.clubs;
  cid uuid;
begin
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into a from public.club_applications where id = p_claim for update;
  if not found or a.kind <> 'claim' or a.status not in ('draft','pending') then
    raise exception '처리할 되찾기 신청이 아니에요';
  end if;
  select * into c from public.clubs where id = a.target_club_id;

  if p_winner = 'leader' then
    update public.club_applications
       set status = 'rejected', reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
     where id = a.id;
    if p_ban then perform public.club_ban(a.user_id, coalesce(nullif(p_reason, ''), '클럽 되찾기 위조')); end if;
    if c.id is not null then
      update public.club_applications set status = 'approved', reviewed_at = now(), reviewed_by = me
       where kind = 'reverify' and target_club_id = c.id and status = 'pending';
      update public.club_applications set status = 'cancelled'
       where kind = 'reverify' and target_club_id = c.id and status = 'draft';
    end if;
    return c.id;
  end if;

  if p_winner <> 'claimant' then raise exception '판정 값이 올바르지 않아요'; end if;
  if exists (select 1 from public.club_members where user_id = a.user_id and status = 'active'
             and (c.id is null or club_id <> c.id)) then
    raise exception '신청자가 이미 다른 클럽에 소속돼 있어요';
  end if;
  if c.id is not null then
    if p_ban then perform public.club_ban(c.leader_id, coalesce(nullif(p_reason, ''), '클럽장 인증 위조')); end if;
    update public.club_applications set status = 'rejected', reviewed_at = now(), reviewed_by = me,
           reason = coalesce(nullif(p_reason, ''), '다른 신청자가 진짜 클럽장으로 확인됐어요')
     where kind = 'reverify' and target_club_id = c.id and status in ('draft','pending');
    /* 다른 되찾기 신청자들도 함께 정리한다 — 이 이름의 주인이 정해졌다 */
    update public.club_applications set status = 'rejected', reviewed_at = now(), reviewed_by = me,
           reason = '다른 신청자가 진짜 클럽장으로 확인됐어요'
     where kind = 'claim' and target_club_id = c.id and status in ('draft','pending') and id <> a.id;
    delete from public.clubs where id = c.id;
  end if;
  delete from public.club_members where user_id = a.user_id;
  insert into public.clubs (name, leader_id, invite_code)
  values (btrim(a.club_name), a.user_id, public.club_gen_invite()) returning id into cid;
  insert into public.club_members (club_id, user_id, nickname, role, status, joined_at)
  values (cid, a.user_id, a.nickname, 'leader', 'active', now());
  update public.club_applications
     set status = 'approved', club_id = cid, reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
   where id = a.id;
  return cid;
end $$;

/* 관리자 — 신고 처리 끝 */
create or replace function public.club_close_report(p_id uuid, p_note text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  update public.club_reports set status = 'closed', note = coalesce(p_note, ''), closed_at = now(), closed_by = me
   where id = p_id;
end $$;

/* 관리자 — 클럽 닫기 + (선택) 클럽장 신청 제한. 신고로 가짜가 드러났을 때 */
create or replace function public.club_admin_close(p_club uuid, p_ban boolean default false, p_reason text default '')
returns void
language plpgsql volatile security definer set search_path = public as $$
declare c public.clubs;
begin
  perform public.club_need_login();
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  select * into c from public.clubs where id = p_club;
  if not found then return; end if;
  if p_ban then perform public.club_ban(c.leader_id, coalesce(nullif(p_reason, ''), '클럽장 인증 위조')); end if;
  update public.club_applications set status = 'cancelled'
   where kind = 'reverify' and target_club_id = c.id and status in ('draft','pending');
  delete from public.clubs where id = p_club;
end $$;

/* 관리자 — 되찾기 신청자 없이(신고로) 건 재인증을 판정한다.
   p_ok 면 재인증 통과, 아니면 클럽을 닫는다 (p_ban 이면 클럽장 신청 제한) */
create or replace function public.club_settle_reverify(p_club uuid, p_ok boolean, p_ban boolean default false, p_reason text default '')
returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  update public.club_applications
     set status = case when p_ok then 'approved' else 'rejected' end,
         reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
   where kind = 'reverify' and target_club_id = p_club and status in ('draft','pending');
  if not p_ok then perform public.club_admin_close(p_club, p_ban, p_reason); end if;
end $$;

/* 함수 실행 권한 — 로그인 사용자만 (새로 만든 함수 포함) */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'club\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
