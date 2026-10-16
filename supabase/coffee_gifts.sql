-- ================================================================
-- 개발자에게 커피 (2026-10-16) — Supabase SQL 편집기에서 한 번 실행한다
--
-- 무엇이 생기나
--   표    coffee_gifts — 카카오톡 선물하기 '선물코드'를 받아 두는 곳 (화면: src/coffee-gift.jsx)
--   함수  coffee_is_admin()       관리자 판정 (profiles.is_admin)
--         coffee_before_insert()  보낸 사람 채우기 · 하루 5번 제한
--
-- 권한 원칙
--   · 보내기(insert): 로그인한 사람만. 보낸 사람(user_id)은 서버가 채운다 — 남의 이름으로 못 보낸다
--   · 읽기 · 등록 표시(select · update): 관리자만. 코드는 돈과 같다
--   · 지우기: 정책이 없어 화면에서는 아무도 못 한다 (필요하면 관리자가 이 편집기에서)
--   · 로그인 안 한 접속(anon)은 아무것도 못 한다
--   · 기존 표(profiles · user_settings · global_* · club_*)의 정책은 바꾸지 않는다
--
-- 이 SQL 을 먼저 실행한 뒤에 화면을 배포한다 (표가 없으면 보내기에 '준비 중' 안내가 뜬다)
-- 다시 실행해도 된다 (if not exists · or replace · drop ... if exists)
-- ================================================================

set lock_timeout = '5s';

-- ── 표 ──────────────────────────────────────────────────────────
create table if not exists public.coffee_gifts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid default auth.uid(),
  code        text not null check (code ~ '^[A-Za-z0-9-]{6,40}$'),   -- 화면과 같은 규칙 (영문 · 숫자 · - 6~40자)
  message     text check (message is null or char_length(message) <= 40),
  used        boolean not null default false                          -- 카카오톡 선물함에 등록했는지 (관리자가 체크)
);
create index if not exists coffee_gifts_user_time on public.coffee_gifts (user_id, created_at desc);

alter table public.coffee_gifts enable row level security;

-- ── 함수 ────────────────────────────────────────────────────────
-- 관리자 판정 — club_is_admin() 과 같은 식이지만 기능끼리 서로 기대지 않게 따로 둔다
create or replace function public.coffee_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 보낼 때: 보낸 사람 · 시각 · 등록 표시는 서버가 정하고, 한 사람이 24시간에 5번까지만
create or replace function public.coffee_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id    := auth.uid();
  new.created_at := now();
  new.used       := false;
  if new.user_id is null then
    raise exception '로그인이 필요해요';
  end if;
  if (select count(*) from public.coffee_gifts
        where user_id = new.user_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception '하루에 5번까지 보낼 수 있어요';
  end if;
  return new;
end $$;

drop trigger if exists coffee_before_insert on public.coffee_gifts;
create trigger coffee_before_insert before insert on public.coffee_gifts
  for each row execute function public.coffee_before_insert();

-- ── 정책 ────────────────────────────────────────────────────────
drop policy if exists coffee_send on public.coffee_gifts;
create policy coffee_send on public.coffee_gifts for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists coffee_read on public.coffee_gifts;
create policy coffee_read on public.coffee_gifts for select to authenticated
  using (public.coffee_is_admin());

drop policy if exists coffee_mark on public.coffee_gifts;
create policy coffee_mark on public.coffee_gifts for update to authenticated
  using (public.coffee_is_admin()) with check (public.coffee_is_admin());

-- ── 표 권한 — 이 프로젝트는 새 표에 권한이 자동으로 붙지 않는다 (클럽 라운지 SQL 과 같은 방식) ──
-- 2026-10-16: 처음 실행본에 이 부분이 빠져 permission denied 가 났다. 이 덩어리만 따로 실행해도 된다
revoke all on public.coffee_gifts from anon, authenticated;
grant insert (code, message) on public.coffee_gifts to authenticated;   -- 보내기는 코드 · 한마디만
grant select on public.coffee_gifts to authenticated;                   -- 실제로 보이는 줄은 정책이 관리자로 거른다
grant update (used) on public.coffee_gifts to authenticated;            -- 관리자의 '등록함' 체크만
grant select on public.coffee_gifts to service_role;                    -- 운영 점검 · 백업용 읽기
do $$ begin
  execute format('grant usage on sequence %s to authenticated', pg_get_serial_sequence('public.coffee_gifts', 'id'));
end $$;
revoke all on function public.coffee_is_admin() from public, anon;
grant execute on function public.coffee_is_admin() to authenticated;

-- ── 실행 뒤 확인 ────────────────────────────────────────────────
-- 정책 3줄 (coffee_mark · coffee_read · coffee_send)
select policyname, cmd, roles from pg_policies where tablename = 'coffee_gifts' order by policyname;
-- 권한 5줄 — authenticated: SELECT · INSERT code · INSERT message · UPDATE used / service_role: SELECT
select grantee, privilege_type, null as column_name from information_schema.role_table_grants
  where table_name = 'coffee_gifts' and grantee in ('anon', 'authenticated', 'service_role')
union all
select grantee, privilege_type, column_name from information_schema.column_privileges
  where table_name = 'coffee_gifts' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE')
order by 1, 2, 3;
