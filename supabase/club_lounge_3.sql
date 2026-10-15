-- ================================================================
-- 클럽 라운지 3차 (2026-10-15) — 베타 기간 인증 간소화
--
-- 새 클럽·되찾기 신청은 인증 코드 없이 "클럽장임이 보이는 인게임 캡처 1장" 으로 받는다.
-- 올릴 때 화면이 캡처를 간단히 점검(편집 프로그램·AI 생성 흔적, 스크린샷다운가)해서
-- 그 결과를 checks 에 함께 넣고, 관리자 심사 카드에 표시한다. 신청을 막지는 않는다.
-- 점검 결과는 화면이 보낸 값이라 참고용이다 (조작할 수 있다).
-- 분쟁 때 기존 클럽장에게 거는 재인증(reverify)은 그대로 코드를 쓴다.
--
-- 이 SQL 을 먼저 실행한 뒤에 화면을 배포해야 한다 (화면이 p_checks 를 보낸다)
-- ================================================================

set lock_timeout = '5s';

alter table public.club_applications add column if not exists checks jsonb
  check (checks is null or pg_column_size(checks) < 8000);

/* 2-인자 판을 지우고 3-인자 판만 둔다 — 둘 다 있으면 2-인자로 부를 때 어느 쪽인지 모호해진다 */
drop function if exists public.club_submit_application(uuid, text[]);

create or replace function public.club_submit_application(p_id uuid, p_shots text[], p_checks jsonb default null)
returns public.club_applications
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  r public.club_applications;
  s text;
begin
  select * into r from public.club_applications where id = p_id and user_id = me for update;
  if not found or r.status <> 'draft' then raise exception '제출할 신청이 없어요'; end if;
  if coalesce(cardinality(p_shots), 0) not between 1 and 2 then
    raise exception '캡처를 올려 주세요';
  end if;
  foreach s in array p_shots loop
    if split_part(s, '/', 1) <> me::text then raise exception '캡처 경로가 올바르지 않아요'; end if;
  end loop;
  update public.club_applications
     set shots = p_shots, checks = p_checks, status = 'pending', submitted_at = now()
   where id = p_id returning * into r;
  return r;
end $$;

revoke all on function public.club_submit_application(uuid, text[], jsonb) from public, anon;
grant execute on function public.club_submit_application(uuid, text[], jsonb) to authenticated;
