-- ================================================================
-- 클럽 라운지 4차 (2026-10-16) — 클럽 정원 22명 (클럽장 포함, 사용자 지정)
--
-- 정원은 clubs.capacity 한 칸으로 정해진다. 가입 승인 · 초대 코드 가입 함수가
-- '활동 중인 클럽원 수(클럽장 포함) >= capacity' 이면 '클럽 정원이 찼어요' 로 막는다 (club_lounge.sql).
-- 화면의 '클럽원 n / 정원' 도 이 칸을 그대로 보여 준다 — 화면은 바꿀 것이 없다.
--
-- 이미 22명을 넘은 클럽이 있어도 지금 클럽원은 그대로 두고, 새 가입만 막는다.
-- 다시 실행해도 된다.
-- ================================================================

set lock_timeout = '5s';

update public.clubs set capacity = 22 where capacity is distinct from 22;
alter table public.clubs alter column capacity set default 22;
alter table public.clubs drop constraint if exists clubs_capacity_check;
alter table public.clubs add constraint clubs_capacity_check check (capacity between 1 and 22);

-- ── 확인 겸 현황 (읽기만) — 맨 위 줄이 합계 ─────────────────────────
with s as (
  select c.name, c.capacity, c.created_at,
         count(m.user_id) filter (where m.status = 'active')  as active_n,
         count(m.user_id) filter (where m.status = 'pending') as pending_n
  from public.clubs c
  left join public.club_members m on m.club_id = c.id
  group by c.id
)
select '합계 (' || count(*) || '개 클럽)' as 클럽, null::int as 정원,
       coalesce(sum(active_n), 0)::int as 활동_클럽원, coalesce(sum(pending_n), 0)::int as 가입_신청중, null::date as 만든_날
from s
union all
select name, capacity, active_n::int, pending_n::int, created_at::date from s
order by 3 desc, 1;
