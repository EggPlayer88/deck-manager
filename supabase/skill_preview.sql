-- ================================================================
-- 비공개 스킬점수표 미리보기 (2026-11) — 관리자와 관리자가 고른 계정만 (11-27: 게임 계정 인증과 상관없이 — 클럽 도파민 · 엔도르핀 가입자 등)
-- Supabase SQL 편집기에서 한 번 실행한다 (다시 실행해도 된다).
-- account_verify.sql 이 먼저 적용돼 있어야 한다 (gv_is_admin · gv_operator · game_accounts 를 쓴다).
--
-- 무엇이 생기나
--   표  skill_preview         표 본문 한 줄(id 'current') — 새 가중치 · 새 산정 근거로 매긴 스킬점수표
--       skill_preview_access  열람 권한 (사이트 계정 하나 = 한 줄, 기한은 비우면 무기한)
--       skill_preview_views   열람 기록 (같은 사람 · 같은 판은 10분에 한 줄만)
--       skill_preview_customs '내 가중치' 계산 기록 (누가 · 언제 · 어떤 가중치 — 한 사람 한 시간에 120번까지)
--
-- 내 가중치 (2026-11-27)
--   · 화면의 산정 기준에 능력치 가중치 숫자를 보여 주고, 열람자가 바꿔 '확인'을 누르면 그 가중치로 다시 매긴 점수를 보여 준다
--   · 스킬별 능력치 몫(parts)은 skill_preview.parts 에만 두고 화면으로 보내지 않는다 — skp_custom 이 점수만 돌려준다
--     (가중치를 하나씩 바꿔 보면 몫을 거꾸로 셀 수는 있어서, 누가 몇 번 계산했는지 남겨 관리자 목록에 보여 준다)
--   · 점수 = 표 점수 + (내 가중치로 합친 몫 − 비공개 가중치로 합친 몫) → 비공개 가중치 그대로면 표와 똑같다
--   · 타자 · 투수 가중치 합은 각각 비공개 판의 합(2.40)과 같아야 한다 — 비중만 바꿔 보는 기능(상대 깎기 배율은 합에 안 들어감)
--
-- 권한 원칙
--   · 세 표 모두 RLS 를 켜고 정책을 두지 않으며 anon · authenticated 권한도 모두 회수한다
--     → 표로는 누구도 못 읽는다. 표 내용은 사이트 코드(JS)에도 없고, 아래 함수로만 나간다
--   · 볼 수 있는 사람 = 관리자, 또는 (권한 줄이 있고 · 기한 안인 사람) — 게임 계정 인증은 조건이 아니다(11-27 사용자:
--     "내가 특정 유저들에게만 특별히 보여주고 싶은 정보"). 거두면(skp_revoke) 바로 못 본다
--   · 권한을 줄 수 있는 계정 = 사이트에서 확인되는 계정(게임 계정 인증 · 클럽 가입 회원 · 가입한 계정(profiles))
--   · 권한 주기 · 거두기 · 목록 · 표 올리기는 운영자(관리자 로그인 · service_role)만
--   · 권한이 없는 사람에게는 '없음'만 돌려준다 — 판 이름 · 날짜 · 다른 사람 권한 여부도 안 알려 준다
--
-- 기존 표(profiles · user_settings · global_* · club_* · game_*)의 정책 · 권한은 바꾸지 않는다.
-- ================================================================

set lock_timeout = '5s';

-- ── 표 ──────────────────────────────────────────────────────────

create table if not exists public.skill_preview (
  id          text primary key default 'current' check (id = 'current'),
  version     text not null check (char_length(btrim(version)) between 1 and 40),
  payload     jsonb not null,
  parts       jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table public.skill_preview add column if not exists parts jsonb;   -- 앞 판 SQL 을 이미 돌린 곳도 칸이 생기게

create table if not exists public.skill_preview_access (
  user_id     uuid primary key,
  note        text not null default '' check (char_length(note) <= 60),
  granted_at  timestamptz not null default now(),
  granted_by  uuid,
  expires_at  timestamptz
);

create table if not exists public.skill_preview_views (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  version    text not null,
  viewed_at  timestamptz not null default now()
);
create index if not exists skill_preview_views_user on public.skill_preview_views (user_id, viewed_at desc);

create table if not exists public.skill_preview_customs (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  version    text not null,
  w          jsonb not null,
  at         timestamptz not null default now()
);
create index if not exists skill_preview_customs_user on public.skill_preview_customs (user_id, at desc);

alter table public.skill_preview         enable row level security;
alter table public.skill_preview_access  enable row level security;
alter table public.skill_preview_views   enable row level security;
alter table public.skill_preview_customs enable row level security;
/* 정책을 일부러 두지 않는다 — 읽기 · 쓰기는 모두 아래 함수(security definer)로만 */
revoke all on public.skill_preview, public.skill_preview_access, public.skill_preview_views, public.skill_preview_customs from anon, authenticated;
/* 운영자 도구(service_role)는 읽기만 — 올린 표 확인 · 열람 기록 보기. 바꾸는 일은 아래 함수로.
   이 프로젝트는 새 표에 권한이 자동으로 붙지 않는다 (account_verify.sql 과 같은 방식) */
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on public.skill_preview, public.skill_preview_access, public.skill_preview_views, public.skill_preview_customs from service_role';
    execute 'grant select on public.skill_preview, public.skill_preview_access, public.skill_preview_views, public.skill_preview_customs to service_role';
  end if;
end $$;

-- ── 판정 (안쪽에서만 쓴다 — 아무에게도 실행 권한을 주지 않는다) ─────
/* 권한 줄이 있고 기한 안이면 본다 — 게임 계정 인증은 보지 않는다(11-27) */
create or replace function public.skp_can_view(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_user is not null and exists (
    select 1 from public.skill_preview_access a
     where a.user_id = p_user and (a.expires_at is null or a.expires_at > now()))
$$;

/* 몫 한 칸(레벨 하나) × 가중치 — {칸: [자기 · 팀 몫, 상대 깎기 몫], "x": 기타}. 반올림 없이(skp_custom 이 차이만 더한 뒤 반올림) */
create or replace function public.skp_i_dot(p_lv jsonb, p_w jsonb, p_m numeric) returns numeric
language sql immutable set search_path = public as $$
  select coalesce((select sum(((e.value ->> 0)::numeric + p_m * (e.value ->> 1)::numeric) * coalesce((p_w ->> e.key)::numeric, 0))
                     from jsonb_each(p_lv) e where e.key <> 'x'), 0)
       + coalesce((p_lv ->> 'x')::numeric, 0)
$$;

-- ── 유저 함수 ──────────────────────────────────────────────────

/* ① 내 권한 — 화면이 메뉴(데이터센터 탭)를 보일지 정할 때 부른다. 가볍다(표 본문은 안 줌).
   권한이 없으면 {"ok": false} 만. 있으면 판 이름 · 올린 때 · 내 기한 · 관리자인지 */
create or replace function public.skp_access() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean; v_ver text; v_at timestamptz; v_until timestamptz;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false); end if;
  v_admin := public.gv_is_admin();
  if not (v_admin or public.skp_can_view(auth.uid())) then return jsonb_build_object('ok', false); end if;
  select version, updated_at into v_ver, v_at from public.skill_preview where id = 'current';
  select expires_at into v_until from public.skill_preview_access where user_id = auth.uid();
  return jsonb_build_object('ok', true, 'admin', v_admin, 'version', v_ver, 'updated_at', v_at, 'until', v_until);
end $$;

/* ② 표 받기 — 권한이 없으면 오류. 관리자가 아니면 열람 기록을 남긴다(같은 판은 10분에 한 번).
   viewer = 내 게임 닉네임, 없으면 클럽 닉네임(화면 워터마크용 — 본인 화면에만 보인다) */
create or replace function public.skp_get() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_admin boolean; r public.skill_preview%rowtype; v_nick text;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  v_admin := public.gv_is_admin();
  if not (v_admin or public.skp_can_view(auth.uid())) then
    raise exception '열람 권한이 없어요' using errcode = '42501';
  end if;
  select * into r from public.skill_preview where id = 'current';
  if not found then return jsonb_build_object('version', null, 'payload', null); end if;
  if not v_admin and not exists (select 1 from public.skill_preview_views
                                  where user_id = auth.uid() and version = r.version and viewed_at > now() - interval '10 minutes') then
    insert into public.skill_preview_views (user_id, version) values (auth.uid(), r.version);
  end if;
  select nickname into v_nick from public.game_accounts where user_id = auth.uid();
  if v_nick is null then select nickname into v_nick from public.club_members where user_id = auth.uid() and status = 'active'; end if;
  return jsonb_build_object('version', r.version, 'updated_at', r.updated_at, 'payload', r.payload,
                            'viewer', coalesce(v_nick, case when v_admin then '운영자' else '' end));
end $$;

/* ②-2 내 가중치로 다시 매기기 — p_w = {"파": 0.85, …, "opp": 1.05} (없는 칸은 비공개 값). 점수만 돌려준다(몫은 안 줌).
   rows / extra = 표와 같은 순서 · 레벨 6칸. null 줄 = 가중치와 상관없는 줄(표 값 그대로). 관리자가 아니면 기록을 남기고 한 시간 120번까지 */
create or replace function public.skp_custom(p_w jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare v_admin boolean; r public.skill_preview%rowtype; v_w jsonb; v_m numeric; v_w0 jsonb; v_m0 numeric; k text; v_x numeric;
        v_s numeric; v_s0 numeric; g record;
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  v_admin := public.gv_is_admin();
  if not (v_admin or public.skp_can_view(auth.uid())) then
    raise exception '열람 권한이 없어요' using errcode = '42501';
  end if;
  select * into r from public.skill_preview where id = 'current';
  if not found or r.parts is null then raise exception '내 가중치 계산 자료가 아직 없어요'; end if;
  if p_w is null or jsonb_typeof(p_w) <> 'object' then raise exception '가중치 모양이 아니에요'; end if;
  v_w0 := r.parts -> 'w0'; v_m0 := (r.parts ->> 'm0')::numeric; v_w := v_w0; v_m := v_m0;
  for k in select jsonb_object_keys(p_w) loop
    if jsonb_typeof(p_w -> k) <> 'number' then raise exception '가중치는 숫자로 넣어 주세요 (%)', k; end if;
    v_x := (p_w ->> k)::numeric;
    if k = 'opp' then
      if v_x < 0 or v_x > 3 then raise exception '상대 깎기 배율은 0 ~ 3 이에요'; end if;
      v_m := v_x;
    elsif v_w0 ? k then
      if v_x < 0 or v_x > 5 then raise exception '가중치는 0 ~ 5 예요 (%)', k; end if;
      v_w := jsonb_set(v_w, array[k], to_jsonb(v_x));
    else raise exception '모르는 칸이에요 (%)', k;
    end if;
  end loop;
  /* 가중치 합 — 타자 · 투수 각각 비공개 판의 합과 같아야(2.40). 비중만 바꿔 보는 기능이라 */
  for g in select * from (values ('타자', array['파','정','선','인','주','수']), ('투수', array['속','변','구','제','지','투'])) t(nm, cols) loop
    select coalesce(sum((v_w ->> c)::numeric), 0), coalesce(sum((v_w0 ->> c)::numeric), 0) into v_s, v_s0
      from unnest(g.cols) c where v_w0 ? c;
    if abs(v_s - v_s0) > 0.0005 then
      raise exception '% 가중치 합은 % 이어야 해요 (지금 %)', g.nm, to_char(v_s0, 'FM990.00'), to_char(v_s, 'FM990.00');
    end if;
  end loop;
  if not v_admin then
    if (select count(*) from public.skill_preview_customs where user_id = auth.uid() and at > now() - interval '1 hour') >= 120 then
      raise exception '내 가중치 계산은 한 시간에 120번까지예요 — 잠시 뒤에 다시 해 주세요';
    end if;
    insert into public.skill_preview_customs (user_id, version, w)
    values (auth.uid(), r.version, v_w || jsonb_build_object('opp', v_m));
  end if;
  return jsonb_build_object('version', r.version, 'w', v_w, 'opp', v_m,
    'rows', (select coalesce(jsonb_agg(
                case when jsonb_typeof(pr.v) <> 'array' then 'null'::jsonb
                     else (select jsonb_agg(case when jsonb_typeof(pl.v) <> 'object' then to_jsonb(0)
                                                 else to_jsonb(round((r.payload -> 'rows' -> (pr.n - 1)::int -> 3 ->> (pl.n - 1)::int)::numeric
                                                                     + public.skp_i_dot(pl.v, v_w, v_m) - public.skp_i_dot(pl.v, v_w0, v_m0), 2)) end
                                           order by pl.n)
                             from jsonb_array_elements(pr.v) with ordinality pl(v, n)) end order by pr.n), '[]'::jsonb)
               from jsonb_array_elements(r.parts -> 'rows') with ordinality pr(v, n)),
    'extra', (select coalesce(jsonb_agg(
                (select jsonb_agg(case when jsonb_typeof(pl.v) <> 'object' then to_jsonb(0)
                                       else to_jsonb(round((r.payload -> 'extra' -> (pe.n - 1)::int -> 2 ->> (pl.n - 1)::int)::numeric
                                                           + public.skp_i_dot(pl.v, v_w, v_m) - public.skp_i_dot(pl.v, v_w0, v_m0), 2)) end
                                 order by pl.n)
                   from jsonb_array_elements(pe.v) with ordinality pl(v, n)) order by pe.n), '[]'::jsonb)
               from jsonb_array_elements(r.parts -> 'extra') with ordinality pe(v, n)));
end $$;

-- ── 운영자 함수 ────────────────────────────────────────────────

/* ③ 권한 주기 · 고치기 — 사이트에서 확인되는 계정(게임 계정 인증 · 클럽 가입 회원 · 가입한 계정). p_days 비우면 무기한(1 ~ 366일) */
create or replace function public.skp_grant(p_user uuid, p_note text default '', p_days int default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  if p_user is null or not (exists (select 1 from public.game_accounts where user_id = p_user)
                         or exists (select 1 from public.club_members where user_id = p_user and status = 'active')
                         or exists (select 1 from public.profiles where id = p_user)) then
    raise exception '사이트 계정을 찾을 수 없어요';
  end if;
  if p_days is not null and (p_days < 1 or p_days > 366) then raise exception '기한은 1 ~ 366일이에요'; end if;
  insert into public.skill_preview_access (user_id, note, granted_by, expires_at)
  values (p_user, left(btrim(coalesce(p_note, '')), 60), auth.uid(),
          case when p_days is null then null else now() + make_interval(days => p_days) end)
  on conflict (user_id) do update
     set note = excluded.note, granted_by = excluded.granted_by, granted_at = now(), expires_at = excluded.expires_at;
end $$;

/* ④ 권한 거두기 (열람 기록은 남긴다) */
create or replace function public.skp_revoke(p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  delete from public.skill_preview_access where user_id = p_user;
  if not found then raise exception '열람 권한이 없는 계정이에요'; end if;
end $$;

/* ⑤ 목록 — 고를 수 있는 계정(게임 계정 인증 · 클럽 가입 회원) + 권한 준 계정, 권한 여부 · 열람 수 · 마지막 열람 · 내 가중치 계산 수.
   nickname = 게임 닉네임(없으면 클럽 닉네임) · team = 게임 구단(없으면 클럽 이름) · club = 가입한 클럽 · verified = 게임 계정 인증.
   linked 는 옛 화면(b948b8d)과 맞추려고 늘 true — 11-27 부터 인증이 열람 조건이 아니라 '인증이 풀려 못 봄' 표시가 뜨면 안 된다 */
drop function if exists public.skp_list();
create or replace function public.skp_list()
returns table (user_id uuid, nickname text, team text, linked boolean, linked_at timestamptz,
               granted boolean, note text, granted_at timestamptz, expires_at timestamptz, views int, last_view timestamptz, customs int,
               club text, verified boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.gv_operator() then raise exception '관리자만 볼 수 있어요'; end if;
  return query
    with v as (select vv.user_id, count(*)::int n, max(vv.viewed_at) last_at from public.skill_preview_views vv group by vv.user_id),
         c as (select cc.user_id, count(*)::int n from public.skill_preview_customs cc group by cc.user_id),
         cm as (select m.user_id, m.nickname, cl.name as club from public.club_members m join public.clubs cl on cl.id = m.club_id where m.status = 'active'),
         ids as (select g.user_id from public.game_accounts g union select cm.user_id from cm union select a.user_id from public.skill_preview_access a)
    select i.user_id, coalesce(g.nickname, cm.nickname, ''), coalesce(g.team, cm.club, ''), true, g.linked_at,
           a.user_id is not null, coalesce(a.note, ''), a.granted_at, a.expires_at, coalesce(v.n, 0), v.last_at, coalesce(c.n, 0),
           coalesce(cm.club, ''), g.user_id is not null
      from ids i
      left join public.game_accounts g on g.user_id = i.user_id
      left join cm on cm.user_id = i.user_id
      left join public.skill_preview_access a on a.user_id = i.user_id
      left join v on v.user_id = i.user_id
      left join c on c.user_id = i.user_id
     order by (a.user_id is not null) desc, coalesce(g.nickname, cm.nickname, '');
end $$;

/* ⑥ 표 올리기 — 같은 줄('current')을 바꿔 끼운다. 모양 · 크기만 확인한다(내용 검사는 운영자 도구가 한다).
   p_parts = 내 가중치 계산용 몫(서버에만 — 화면으로 안 나감). 비우면 내 가중치 계산은 꺼진다 */
drop function if exists public.skp_publish(text, jsonb);
create or replace function public.skp_publish(p_version text, p_payload jsonb, p_parts jsonb default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.gv_operator() then raise exception '관리자만 할 수 있어요'; end if;
  if p_version is null or char_length(btrim(p_version)) not between 1 and 40 then raise exception '판 이름은 1 ~ 40자예요'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or jsonb_typeof(p_payload -> 'rows') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'rows') = 0 then
    raise exception '표 모양이 아니에요';
  end if;
  if octet_length(p_payload::text) > 400000 then raise exception '표가 너무 커요 (400KB 까지)'; end if;
  if p_parts is not null and (jsonb_typeof(p_parts) <> 'object' or jsonb_typeof(p_parts -> 'w0') is distinct from 'object'
     or jsonb_typeof(p_parts -> 'm0') is distinct from 'number'
     or jsonb_typeof(p_parts -> 'rows') is distinct from 'array' or jsonb_typeof(p_parts -> 'extra') is distinct from 'array'
     or jsonb_array_length(p_parts -> 'rows') <> jsonb_array_length(p_payload -> 'rows')
     or jsonb_array_length(p_parts -> 'extra') <> coalesce(jsonb_array_length(case when jsonb_typeof(p_payload -> 'extra') = 'array' then p_payload -> 'extra' end), 0)) then
    raise exception '몫 자료 모양이 표와 안 맞아요';
  end if;
  if p_parts is not null and octet_length(p_parts::text) > 900000 then raise exception '몫 자료가 너무 커요 (900KB 까지)'; end if;
  insert into public.skill_preview (id, version, payload, parts, updated_by)
  values ('current', btrim(p_version), p_payload, p_parts, auth.uid())
  on conflict (id) do update
     set version = excluded.version, payload = excluded.payload, parts = excluded.parts, updated_at = now(), updated_by = excluded.updated_by;
end $$;

-- ── 함수 실행 권한 ─────────────────────────────────────────────

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'skp\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not in ('skp_can_view', 'skp_i_dot') then
      execute format('grant execute on function %s to authenticated', f.sig);
      if exists (select 1 from pg_roles where rolname = 'service_role') then
        execute format('grant execute on function %s to service_role', f.sig);
      end if;
    elsif exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('revoke all on function %s from service_role', f.sig);
    end if;
  end loop;
end $$;

-- ── 확인 (모두 true 여야 한다 — 6줄) ───────────────────────────
select '표 4개' as 항목, (select count(*) from pg_tables where schemaname = 'public'
         and tablename in ('skill_preview','skill_preview_access','skill_preview_views','skill_preview_customs')) = 4 as 적용
union all select 'RLS 켜짐 · 정책 없음', (select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname in ('skill_preview','skill_preview_access','skill_preview_views','skill_preview_customs'))
         and not exists (select 1 from pg_policies where schemaname = 'public'
         and tablename in ('skill_preview','skill_preview_access','skill_preview_views','skill_preview_customs'))
union all select '표 직접 읽기 막힘(anon · authenticated)', not exists (select 1 from information_schema.role_table_grants
         where table_schema = 'public' and table_name in ('skill_preview','skill_preview_access','skill_preview_views','skill_preview_customs')
           and grantee in ('anon','authenticated'))
union all select '함수 9개 · 옛 올리기 함수 없음', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname in ('skp_can_view','skp_i_dot','skp_access','skp_get','skp_custom','skp_grant','skp_revoke','skp_list','skp_publish')) = 9
         and to_regprocedure('public.skp_publish(text, jsonb)') is null
union all select '안쪽 함수는 유저가 못 부름', not has_function_privilege('authenticated', 'public.skp_can_view(uuid)', 'execute')
         and not has_function_privilege('authenticated', 'public.skp_i_dot(jsonb, jsonb, numeric)', 'execute')
         and not has_function_privilege('anon', 'public.skp_get()', 'execute')
union all select '내 가중치는 로그인한 사람만 부름(권한은 안에서 확인)', has_function_privilege('authenticated', 'public.skp_custom(jsonb)', 'execute')
         and not has_function_privilege('anon', 'public.skp_custom(jsonb)', 'execute');
