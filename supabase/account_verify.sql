-- ================================================================
-- 게임 계정 인증 · 덱 최신화 (2026-11) — Supabase SQL 편집기에서 한 번 실행한다 (다시 실행해도 된다)
--
-- 무엇이 생기나
--   표      game_verify_requests  인증 신청 (캡처 1장 · 닉네임 · 구단) — 관리자가 승인 / 반려
--           game_accounts         인증된 연결 (사이트 계정 1 = 게임 닉네임 1)
--           deck_refresh          덱 최신화 요청 → 운영자가 게임에서 읽어 '도착한 덱'으로 보냄
--   저장소  game-verify (인증 캡처, 비공개 — 본인과 관리자만)
--
-- 권한 원칙 (클럽 라운지와 같다)
--   · 읽기는 RLS — 본인 줄과 관리자만. 익명(anon)에게는 아무것도 주지 않는다
--   · 쓰기는 전부 아래 함수(RPC)로만. 표에 직접 쓰는 권한은 주지 않는다
--   · 운영자 일(심사 · 수집 결과 보내기)은 관리자 로그인 또는 service_role 이 같은 함수를 부른다
--   · user_settings(원본 덱 저장)는 이 기능이 전혀 건드리지 않는다.
--     도착한 덱은 유저가 화면에서 '반영'을 눌러야 평소 저장 길로 들어간다
--
-- 기존 표(profiles · user_settings · global_* · club_*)의 정책 · 권한은 바꾸지 않는다.
-- 관리자 판정은 profiles 의 본인 행 읽기에 기댄다 (클럽 라운지 club_is_admin 과 같은 식).
-- ================================================================

set lock_timeout = '5s';

-- ── 표 ──────────────────────────────────────────────────────────

/* 인증 신청. pending = 심사 대기. 한 사람에게 열린 신청은 하나 */
create table if not exists public.game_verify_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  nickname      text not null check (char_length(btrim(nickname)) between 1 and 20),
  team          text not null check (team in ('LG','KT','SSG','NC','두산','기아','롯데','삼성','한화','키움')),
  shot          text not null default '',
  checks        jsonb,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','cancelled','revoked')),
  reason        text not null default '' check (char_length(reason) <= 200),
  prev          jsonb,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  shot_purged   boolean not null default false
);
create unique index if not exists game_verify_open_uq on public.game_verify_requests (user_id) where status = 'pending';
create index if not exists game_verify_user on public.game_verify_requests (user_id, created_at desc);

/* 인증된 연결 — 승인할 때 생기고, 본인이 풀거나 관리자가 해제하면 지운다.
   prev = 심사 때 캡처에서 읽은 이전 시즌 {score, rank, w, d, l, tier} (덱을 찾는 열쇠) */
create table if not exists public.game_accounts (
  user_id      uuid primary key,
  nickname     text not null check (char_length(btrim(nickname)) between 1 and 20),
  team         text not null check (team in ('LG','KT','SSG','NC','두산','기아','롯데','삼성','한화','키움')),
  request_id   uuid,
  prev         jsonb,
  linked_at    timestamptz not null default now()
);
/* 게임 닉네임 하나는 사이트 계정 하나에만 */
create unique index if not exists game_accounts_nick_uq on public.game_accounts (lower(btrim(nickname)));

/* 덱 최신화 요청.
   requested → working(운영자가 수집 시작) → arrived(도착한 덱) → applied(유저가 반영) / discarded(유저가 버림)
   failed = 못 찾음 · 못 읽음 (횟수에 안 듦), cancelled = 유저가 거둠
   counted = 그 달 횟수에 들었는가 — 덱이 도착할 때 true. 한 달(한국 시각 달력, 요청한 달)에 한 번 — 11-21 사용자: POTM 주기가 월 단위 */
create table if not exists public.deck_refresh (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  nickname      text not null,
  team          text not null,
  target        text not null default 'new' check (target in ('new','deck')),
  deck_id       text,
  deck_label    text not null default '' check (char_length(deck_label) <= 40),
  memo          text not null default '' check (char_length(memo) <= 100),
  status        text not null default 'requested'
                check (status in ('requested','working','arrived','applied','discarded','failed','cancelled')),
  payload       jsonb,
  summary       jsonb,
  reason        text not null default '' check (char_length(reason) <= 200),
  counted       boolean not null default false,
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  delivered_at  timestamptz,
  closed_at     timestamptz
);
create unique index if not exists deck_refresh_open_uq on public.deck_refresh (user_id) where status in ('requested','working');
create index if not exists deck_refresh_user on public.deck_refresh (user_id, requested_at desc);
create index if not exists deck_refresh_queue on public.deck_refresh (status, requested_at);

-- ── 판정 함수 ───────────────────────────────────────────────────

create or replace function public.gv_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

/* 운영자 — 관리자 로그인이거나 service_role 키(운영자 도구) */
create or replace function public.gv_operator() returns boolean
language sql stable security definer set search_path = public as $$
  select public.gv_is_admin()
      or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
$$;

create or replace function public.gv_need_login() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  return auth.uid();
end $$;

/* 다음 최신화를 할 수 있는 때 (없으면 null = 지금 가능) — 한 달에 한 번.
   이번 달(한국 시각)에 요청해서 덱이 도착한(횟수에 든) 줄이 있으면 다음 달 1일 0시(한국 시각)부터.
   요청한 달로 센다 — 11월 30일에 요청해 12월 1일에 도착해도 11월 몫이다. 남의 것은 운영자만 본다 */
drop function if exists public.dr_cooldown_days();
create or replace function public.dr_next_at(p_user uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select (date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul'
   where exists (select 1 from public.deck_refresh
                  where user_id = p_user and counted and (p_user = auth.uid() or public.gv_operator())
                    and date_trunc('month', requested_at at time zone 'Asia/Seoul') = date_trunc('month', now() at time zone 'Asia/Seoul'))
$$;

-- ── 읽기 정책 ──────────────────────────────────────────────────

alter table public.game_verify_requests enable row level security;
alter table public.game_accounts        enable row level security;
alter table public.deck_refresh         enable row level security;

drop policy if exists gv_req_read on public.game_verify_requests;
create policy gv_req_read on public.game_verify_requests for select to authenticated
  using (user_id = auth.uid() or public.gv_is_admin());
drop policy if exists gv_acc_read on public.game_accounts;
create policy gv_acc_read on public.game_accounts for select to authenticated
  using (user_id = auth.uid() or public.gv_is_admin());
drop policy if exists dr_read on public.deck_refresh;
create policy dr_read on public.deck_refresh for select to authenticated
  using (user_id = auth.uid() or public.gv_is_admin());

revoke all on public.game_verify_requests, public.game_accounts, public.deck_refresh from anon, authenticated;
grant select on public.game_verify_requests, public.game_accounts, public.deck_refresh to authenticated;
/* 운영자 도구(service_role)는 대기열 · 캡처 경로를 읽기만 한다 — 바꾸는 일은 아래 함수로.
   이 프로젝트는 새 표에 권한이 자동으로 붙지 않는다 (coffee_gifts.sql 과 같은 방식) */
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select on public.game_verify_requests, public.game_accounts, public.deck_refresh to service_role';
  end if;
end $$;

-- ── 유저 함수 ──────────────────────────────────────────────────

/* ① 인증 신청 — 캡처는 먼저 game-verify/<내 id>/… 에 올려 두고 그 경로를 넘긴다.
   같은 닉네임이 다른 계정에 이미 연결돼 있어도 신청은 받는다 (관리자 심사 카드에 표시 — 되찾기).
   다시 올리면 앞 신청은 '거둠'으로 두고 새 줄을 만든다 — 관리자가 보고 있던 신청(번호)이 바뀌어 다른 닉네임이 승인되는 일이 없게.
   p_checks(올린 원본 간단 점검)는 작은 객체만 받는다 — 이상한 값은 버린다 (관리자 화면이 그 값을 읽는다) */
create or replace function public.gv_submit(p_nickname text, p_team text, p_shot text, p_checks jsonb default null)
returns public.game_verify_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.gv_need_login();
  nick text := btrim(coalesce(p_nickname, ''));
  chk jsonb := case when p_checks is not null and jsonb_typeof(p_checks) = 'object' and octet_length(p_checks::text) <= 4000
                    then p_checks end;
  r public.game_verify_requests;
begin
  if char_length(nick) not between 1 and 20 then raise exception '게임 닉네임을 1 ~ 20자로 적어 주세요'; end if;
  if coalesce(p_team, '') not in ('LG','KT','SSG','NC','두산','기아','롯데','삼성','한화','키움') then raise exception '구단을 골라 주세요'; end if;
  if p_shot is null or split_part(p_shot, '/', 1) <> me::text or p_shot !~ '^[0-9a-f-]+/[A-Za-z0-9._-]+$' then
    raise exception '캡처 경로가 올바르지 않아요';
  end if;
  if exists (select 1 from public.game_accounts where user_id = me and lower(btrim(nickname)) = lower(nick) and team = p_team) then
    raise exception '이미 이 닉네임으로 인증돼 있어요';
  end if;
  if (select count(*) from public.game_verify_requests where user_id = me and created_at > now() - interval '1 day') >= 10 then
    raise exception '오늘은 더 신청할 수 없어요 — 내일 다시 해 주세요';
  end if;
  update public.game_verify_requests set status = 'cancelled', reason = '다시 올림', reviewed_at = now()
   where user_id = me and status = 'pending';
  insert into public.game_verify_requests (user_id, nickname, team, shot, checks)
  values (me, nick, p_team, p_shot, chk) returning * into r;
  return r;
end $$;

create or replace function public.gv_cancel() returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.gv_need_login();
begin
  update public.game_verify_requests set status = 'cancelled', reviewed_at = now()
   where user_id = me and status = 'pending';
  if not found then raise exception '거둘 신청이 없어요 — 심사가 이미 끝났을 수 있어요. 새로 보기를 눌러 주세요'; end if;
end $$;

/* 연결 풀기 — 기다리는 최신화 요청도 거둔다. 도착해 있던 덱은 그대로 둔다 (반영 · 버리기는 할 수 있다) */
create or replace function public.gv_unlink() returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.gv_need_login();
begin
  delete from public.game_accounts where user_id = me;
  update public.deck_refresh set status = 'cancelled', closed_at = now(), reason = '인증을 풀어 거둠'
   where user_id = me and status in ('requested','working');
end $$;

/* ② 덱 최신화 요청 — 인증된 사람만, 열린 요청은 하나, 한 달(한국 시각)에 한 번 */
create or replace function public.dr_request(p_target text, p_deck_id text default null,
                                             p_deck_label text default '', p_memo text default '')
returns public.deck_refresh
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.gv_need_login();
  acc public.game_accounts;
  nx timestamptz;
  r public.deck_refresh;
begin
  select * into acc from public.game_accounts where user_id = me;
  if not found then raise exception '게임 계정 인증을 먼저 해 주세요'; end if;
  if p_target not in ('new','deck') then raise exception '받을 곳을 골라 주세요'; end if;
  if p_target = 'deck' and coalesce(btrim(p_deck_id), '') = '' then raise exception '덮어쓸 덱을 골라 주세요'; end if;
  if char_length(coalesce(p_deck_id, '')) > 60 then raise exception '덱 번호가 이상해요'; end if;
  if exists (select 1 from public.deck_refresh where user_id = me and status in ('requested','working')) then
    raise exception '이미 요청한 최신화가 처리를 기다리고 있어요';
  end if;
  nx := public.dr_next_at(me);
  if nx is not null then
    raise exception '이번 달 최신화는 이미 했어요 — % 부터 다시 할 수 있어요', to_char(nx at time zone 'Asia/Seoul', 'FMMM"월" FMDD"일"');
  end if;
  insert into public.deck_refresh (user_id, nickname, team, target, deck_id, deck_label, memo)
  values (me, acc.nickname, acc.team, p_target, case when p_target = 'deck' then btrim(p_deck_id) end,
          left(coalesce(p_deck_label, ''), 40), left(btrim(coalesce(p_memo, '')), 100))
  returning * into r;
  return r;
end $$;

create or replace function public.dr_cancel(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.gv_need_login();
begin
  update public.deck_refresh set status = 'cancelled', closed_at = now()
   where id = p_id and user_id = me and status = 'requested';
  if not found then raise exception '거둘 수 있는 요청이 아니에요 (이미 수집을 시작했을 수 있어요)'; end if;
end $$;

/* ③ 도착한 덱을 반영했다 / 버렸다 — 덱 내용은 화면이 평소 저장 길로 넣는다. 여기는 표시만 바꾼다 */
create or replace function public.dr_close(p_id uuid, p_applied boolean, p_deck_id text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.gv_need_login();
begin
  update public.deck_refresh
     set status = case when p_applied then 'applied' else 'discarded' end,
         deck_id = case when p_applied and coalesce(btrim(p_deck_id), '') <> '' then btrim(p_deck_id) else deck_id end,
         closed_at = now()
   where id = p_id and user_id = me and status = 'arrived';
  if not found then raise exception '도착한 덱이 아니에요'; end if;
end $$;

-- ── 운영자 함수 (관리자 로그인 또는 service_role) ───────────────

/* 인증 심사 — 승인하면 연결이 생긴다. p_prev = 캡처에서 읽은 이전 시즌 기록(선택) */
create or replace function public.gv_review(p_id uuid, p_approve boolean, p_reason text default '', p_prev jsonb default null)
returns public.game_verify_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  r public.game_verify_requests;
  other uuid;
begin
  if not public.gv_operator() then raise exception '관리자만 심사할 수 있어요'; end if;
  select * into r from public.game_verify_requests where id = p_id for update;
  if not found or r.status <> 'pending' then raise exception '심사할 신청이 아니에요'; end if;
  if not p_approve then
    update public.game_verify_requests
       set status = 'rejected', reason = left(coalesce(p_reason, ''), 200), reviewed_at = now(), reviewed_by = auth.uid()
     where id = p_id returning * into r;
    return r;
  end if;
  select user_id into other from public.game_accounts
   where lower(btrim(nickname)) = lower(btrim(r.nickname)) and user_id <> r.user_id;
  if found then
    raise exception '이 닉네임은 다른 사이트 계정에 연결돼 있어요 — 그 연결을 먼저 해제해 주세요';
  end if;
  insert into public.game_accounts (user_id, nickname, team, request_id, prev, linked_at)
  values (r.user_id, btrim(r.nickname), r.team, r.id, p_prev, now())
  on conflict (user_id) do update
     set nickname = excluded.nickname, team = excluded.team, request_id = excluded.request_id,
         prev = excluded.prev, linked_at = excluded.linked_at;
  /* 닉네임이 바뀌었으면 기다리는 최신화 요청도 새 닉네임으로 찾는다 */
  update public.deck_refresh set nickname = btrim(r.nickname), team = r.team
   where user_id = r.user_id and status in ('requested','working');
  update public.game_verify_requests
     set status = 'approved', reason = left(coalesce(p_reason, ''), 200), prev = p_prev, reviewed_at = now(), reviewed_by = auth.uid()
   where id = p_id returning * into r;
  return r;
end $$;

/* 연결 해제 (도용 · 되찾기 판정 뒤). 그 사람의 마지막 승인 신청에 사유를 남기고, 기다리는 요청은 거둔다 */
create or replace function public.gv_revoke(p_user uuid, p_reason text default '') returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  delete from public.game_accounts where user_id = p_user;
  if not found then raise exception '연결된 게임 계정이 없어요'; end if;
  update public.game_verify_requests set status = 'revoked', reason = left(coalesce(p_reason, ''), 200), reviewed_at = now(), reviewed_by = auth.uid()
   where id = (select id from public.game_verify_requests where user_id = p_user and status = 'approved'
                order by reviewed_at desc nulls last limit 1);
  update public.deck_refresh set status = 'cancelled', closed_at = now(), reason = '인증 해제'
   where user_id = p_user and status in ('requested','working');
end $$;

/* 30일 지난 캡처를 지운 뒤 표시 (파일 삭제는 화면 · 도구가 저장소에 직접) */
create or replace function public.gv_mark_purged(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  update public.game_verify_requests set shot_purged = true, shot = '' where id = p_id;
end $$;

/* 수집 시작 — 유저 화면에 '수집 중'으로 보인다 */
create or replace function public.dr_start(p_id uuid) returns public.deck_refresh
language plpgsql volatile security definer set search_path = public as $$
declare r public.deck_refresh;
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  update public.deck_refresh set status = 'working', started_at = now()
   where id = p_id and status = 'requested' returning * into r;
  if not found then raise exception '기다리는 요청이 아니에요'; end if;
  return r;
end $$;

/* 수집을 못 끝냈으면 다시 기다리는 줄로 */
create or replace function public.dr_requeue(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  update public.deck_refresh set status = 'requested', started_at = null where id = p_id and status = 'working';
  if not found then raise exception '수집 중인 요청이 아니에요'; end if;
end $$;

/* 도착 — 사이트 덱 형식(players · lineupMap · sdConfig)과 요약을 보낸다. 이때 그 달 횟수에 든다 */
create or replace function public.dr_deliver(p_id uuid, p_payload jsonb, p_summary jsonb default null)
returns public.deck_refresh
language plpgsql volatile security definer set search_path = public as $$
declare r public.deck_refresh;
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  if coalesce(jsonb_typeof(p_payload), '') <> 'object' or coalesce(jsonb_typeof(p_payload -> 'players'), '') <> 'array'
     or coalesce(jsonb_typeof(p_payload -> 'lineupMap'), '') <> 'object' or coalesce(jsonb_typeof(p_payload -> 'sdConfig'), '') <> 'object' then
    raise exception '덱 형식이 아니에요 (players · lineupMap · sdConfig)';
  end if;
  if jsonb_array_length(p_payload -> 'players') not between 1 and 40 then raise exception '선수 수가 이상해요'; end if;
  if octet_length(p_payload::text) > 400000 then raise exception '덱이 너무 커요'; end if;
  update public.deck_refresh
     set status = 'arrived', payload = p_payload, summary = p_summary, counted = true, delivered_at = now(), reason = ''
   where id = p_id and status in ('requested','working') returning * into r;
  if not found then raise exception '보낼 수 있는 요청이 아니에요 (거뒀거나 이미 보냄)'; end if;
  return r;
end $$;

/* 실패 — 지난 시즌 구단 100위 안에서 못 찾음 · 화면을 못 읽음 등. 보통 횟수에 안 든다 */
create or replace function public.dr_fail(p_id uuid, p_reason text, p_count boolean default false) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  update public.deck_refresh
     set status = 'failed', reason = left(coalesce(p_reason, ''), 200), counted = coalesce(p_count, false),
         delivered_at = case when coalesce(p_count, false) then now() else delivered_at end, closed_at = now()
   where id = p_id and status in ('requested','working','arrived');   -- 도착한 덱이 반영할 수 없는 덱이면 운영자가 실패 처리해 횟수를 돌려준다 (2026-11-25)
  if not found then raise exception '처리 중이거나 도착한 요청이 아니에요'; end if;
end $$;

/* 함수 실행 권한 — 로그인 사용자 + 운영자 도구(service_role). 익명은 못 부른다 */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'gv\_%' or p.proname like 'dr\_%') loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f.sig);
    end if;
  end loop;
end $$;

-- ── 저장소 ─────────────────────────────────────────────────────
-- game-verify/<신청자 id>/<시각>.jpg   — 본인과 관리자만

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-verify', 'game-verify', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists game_verify_insert on storage.objects;
create policy game_verify_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'game-verify' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists game_verify_read on storage.objects;
create policy game_verify_read on storage.objects for select to authenticated
  using (bucket_id = 'game-verify'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.gv_is_admin()));
drop policy if exists game_verify_delete on storage.objects;
create policy game_verify_delete on storage.objects for delete to authenticated
  using (bucket_id = 'game-verify'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.gv_is_admin()));

-- ── 확인 (실행 결과 맨 아래 표 6줄 — 모두 true 면 끝) ───────────────
select '표 3개' as 확인, (select count(*) from pg_tables where schemaname = 'public'
         and tablename in ('game_verify_requests','game_accounts','deck_refresh')) = 3 as 적용
union all select '읽기 정책 3개', (select count(*) from pg_policies where schemaname = 'public'
         and policyname in ('gv_req_read','gv_acc_read','dr_read')) = 3
union all select '함수 17개', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('gv_is_admin','gv_operator','gv_need_login','dr_next_at',
           'gv_submit','gv_cancel','gv_unlink','dr_request','dr_cancel','dr_close','gv_review','gv_revoke','gv_mark_purged',
           'dr_start','dr_requeue','dr_deliver','dr_fail')) = 17
union all select '저장소 game-verify', exists (select 1 from storage.buckets where id = 'game-verify' and not public)
union all select '익명은 표를 못 읽음', not has_table_privilege('anon', 'public.deck_refresh', 'select')
union all select '운영자 도구(service_role)는 읽기', not exists (select 1 from pg_roles where rolname = 'service_role')
         or has_table_privilege('service_role', 'public.game_verify_requests', 'select');
