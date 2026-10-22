-- ─────────────────────────────────────────────────────────────
-- 클럽 라운지 6차 (2026-10-21) — 점수 기준이 바뀌면 '주간 변화' 기준점을 새 점수로 다시 잡는다
--
-- 왜: 제구 반영 업데이트(랭킹챌린지 스킬점수표 v1.1)로 같은 덱의 TOTAL SCORE 가 달라진다.
--     덱 현황의 '주간 변화'는 (지금 TOTAL − 7일 기준점)이라, 기준점이 옛 점수로 잡혀 있으면
--     덱을 하나도 안 바꿨는데도 일주일 동안 ▲ · ▼ 가 떠 보인다.
-- 어떻게: 앱이 덱 요약본에 점수 기준(sv, 예: "v11")을 실어 보낸다. 지난번 요약본과 sv 가 다르면
--     그때의 TOTAL 을 새 기준점으로 삼는다 (그 주의 주간 변화는 0 부터 다시 센다).
--
-- 화면 배포보다 먼저 실행한다 — 나중에 실행하면, 그 사이 새 화면으로 한 번 올라간 덱은 sv 가 이미 같아져서
-- 그 덱의 기준점이 옛 점수로 남는다 (7일이 지나면 저절로 풀리기는 한다).
-- 옛 화면은 sv 를 보내지 않으므로 먼저 실행해도 지금과 똑같이 돈다. 두 번 실행해도 된다.
--
-- 시험: scratchpad pgtest/test6.mjs (1~5차 위에 6차를 두 번 얹고 기준점 다시 잡기 · 7일 넘김 · 클럽 옮김을 본다)
-- ─────────────────────────────────────────────────────────────

create or replace function public.club_publish_deck(p_deck jsonb, p_total numeric, p_set_point int, p_filled int)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  m public.club_members;
  old public.club_decks;
  rebase boolean;
begin
  select * into m from public.club_members where user_id = me and status = 'active';
  if not found or m.share_deck_id is null then raise exception '덱 공개가 꺼져 있어요'; end if;
  if pg_column_size(p_deck) > 20000 then raise exception '덱 정보가 너무 커요'; end if;
  select * into old from public.club_decks where user_id = me;
  if not found then
    insert into public.club_decks (user_id, club_id, deck, total, set_point, filled, week_base, week_base_at)
    values (me, m.club_id, p_deck, p_total, p_set_point, p_filled, p_total, now());
  else
    /* 점수 기준이 바뀌었다 — 옛 기준의 TOTAL 과 빼면 덱이 안 바뀌어도 변화가 생겨 보인다 */
    rebase := coalesce(old.deck->>'sv', '') <> coalesce(p_deck->>'sv', '');
    update public.club_decks set
      club_id = m.club_id, deck = p_deck, total = p_total, set_point = p_set_point,
      filled = p_filled, saved_at = now(),
      week_base    = case when rebase then p_total
                          when old.week_base_at is null or old.week_base_at < now() - interval '7 days'
                            or old.club_id <> m.club_id then old.total else old.week_base end,
      week_base_at = case when rebase or old.week_base_at is null or old.week_base_at < now() - interval '7 days'
                            or old.club_id <> m.club_id then now() else old.week_base_at end
    where user_id = me;
  end if;
end $$;

-- 확인 — 아래 1줄이 true 면 적용된 것
select '덱 요약본 점수 기준(sv)이 바뀌면 주간 기준점 다시' as 항목, position('->>''sv''' in prosrc) > 0 as 적용
  from pg_proc where proname = 'club_publish_deck';
