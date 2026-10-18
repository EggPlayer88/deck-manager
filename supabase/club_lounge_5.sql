-- ─────────────────────────────────────────────────────────────
-- 클럽 라운지 5차 (2026-10-18) — 직접 써 보기 점검에서 나온 서버 쪽 보강 (사용자 지시: "오류는 없어야 할 것")
--
-- 화면은 이 SQL 없이도 돌아간다. 여기 있는 것은 모두 "서버가 막는 것"이라 화면 배포 앞뒤 어느 쪽에 실행해도 된다.
-- 두 번 실행해도 된다.
--
-- 1. 글 — 투표 선택지는 1~40자 글자만 · 사진은 내 폴더(클럽/나/…) 것만 · 글과 댓글 시각은 서버 시각
--    (개발자 도구로 선택지에 글자가 아닌 값을 넣으면 그 클럽 화면이 하얗게 되던 것, 시각을 미래로 넣어 맨 위에 박던 것,
--     남의 사진 경로를 붙여 그 글이 지워질 때 남의 사진까지 지워지던 것)
-- 2. 마감된 투표에서 표를 빼지 못하게
-- 3. 재인증은 본인이 취소하지 못하게 · 재인증이나 되찾기 심사 중에는 클럽장을 넘기지 못하게
-- 4. 가입 승인이 동시에 들어와도 정원을 넘지 않게 (클럽 줄을 잠그고 센다)
-- 5. 내보내기 · 탈퇴하면 그 사람의 일정 참여도 지운다 (참여 수가 클럽원 수를 넘던 것)
-- 6. 클럽장이 클럽을 닫거나 혼자 남아 나가면 그 클럽에 걸린 재인증 요청도 닫는다 (다시 신청이 막히던 것)
-- 7. 투표 마감 시각은 날짜로 읽히는 것만 (날짜가 아닌 값이 든 투표는 표를 넣을 때 영어 오류가 나던 것)
-- 8. 예전에 남은 것 정리 — 클럽은 없어졌는데 열려 있는 재인증 신청 (3번으로 본인이 끌 수 없게 됐으므로 여기서 닫는다)
--
-- 시험: scratchpad pgtest/test5.mjs (1~4차 + 5차, 기존 1차 85개 · 2차 40개도 5차 적용 뒤 다시 통과)
-- 운영 적용: 2026-10-19 사용자가 SQL 편집기에서 실행 — 맨 끝 확인 8줄 모두 true
-- ─────────────────────────────────────────────────────────────

-- ── 1. 글 ──────────────────────────────────────────────────────
/* 날짜로 읽히면 그 시각, 아니면 null — 정책 안에서 변환 오류가 나지 않게 */
create or replace function public.club_try_ts(p text) returns timestamptz
language plpgsql stable set search_path = public as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end $$;
revoke all on function public.club_try_ts(text) from public, anon;
grant execute on function public.club_try_ts(text) to authenticated;

drop policy if exists club_posts_write on public.club_posts;
create policy club_posts_write on public.club_posts for insert to authenticated
  with check (author_id = auth.uid() and public.club_is_member(club_id)
              and (kind <> 'notice' or public.club_is_leader(club_id))
              and (pinned = false or public.club_is_leader(club_id))
              and (kind <> 'poll' or (poll is not null
                   and jsonb_typeof(poll->'options') = 'array'
                   and jsonb_array_length(poll->'options') between 2 and 6
                   and not exists (select 1 from jsonb_array_elements(poll->'options') o
                                   where jsonb_typeof(o) <> 'string'
                                      or char_length(btrim(o #>> '{}')) not between 1 and 40)
                   and (poll->>'closes_at' is null or public.club_try_ts(poll->>'closes_at') is not null)))
              and not exists (select 1 from unnest(images) as i(p)
                              where split_part(i.p, '/', 1) <> club_id::text
                                 or split_part(i.p, '/', 2) <> auth.uid()::text));

/* 쓴 사람 이름과 함께 시각도 서버가 채운다 — 화면이 보낸 시각은 믿지 않는다 */
create or replace function public.club_fill_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce((select nickname from public.club_members
                               where club_id = new.club_id and user_id = new.author_id), '');
  new.created_at := now();
  return new;
end $$;

-- ── 2. 마감된 투표 ─────────────────────────────────────────────
/* 넣기 — 1차와 같고, 마감 시각만 변환 오류 없이 읽는다 */
drop policy if exists club_votes_write on public.club_votes;
create policy club_votes_write on public.club_votes for insert to authenticated
  with check (user_id = auth.uid() and public.club_is_member(club_id)
              and exists (select 1 from public.club_posts p
                          where p.id = post_id and p.club_id = club_votes.club_id
                            and p.kind = 'poll'
                            and choice < jsonb_array_length(p.poll->'options')
                            and (p.poll->>'closes_at' is null
                                 or public.club_try_ts(p.poll->>'closes_at') > now())));
/* 빼기 — 마감 전에만 */
drop policy if exists club_votes_delete on public.club_votes;
create policy club_votes_delete on public.club_votes for delete to authenticated
  using (user_id = auth.uid()
         and exists (select 1 from public.club_posts p
                     where p.id = post_id
                       and (p.poll->>'closes_at' is null or public.club_try_ts(p.poll->>'closes_at') > now())));

-- ── 3. 재인증 · 되찾기 심사 중 ─────────────────────────────────
create or replace function public.club_cancel_application(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  /* 재인증은 관리자가 건 확인이라 본인이 끄지 못한다 */
  update public.club_applications set status = 'cancelled'
   where id = p_id and user_id = me and status in ('draft','pending') and kind <> 'reverify';
end $$;

create or replace function public.club_transfer(p_club uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  if not public.club_is_leader(p_club) then raise exception '클럽장만 할 수 있어요'; end if;
  if exists (select 1 from public.club_applications
             where target_club_id = p_club
               and ((kind = 'reverify' and status in ('draft','pending')) or (kind = 'claim' and status = 'pending'))) then
    raise exception '클럽장 확인(재인증 · 되찾기 심사)이 끝난 뒤에 넘길 수 있어요';
  end if;
  if not exists (select 1 from public.club_members
                 where club_id = p_club and user_id = p_user and status = 'active') then
    raise exception '활동 중인 클럽원에게만 넘길 수 있어요';
  end if;
  update public.club_members set role = 'member' where club_id = p_club and user_id = me;
  update public.club_members set role = 'leader' where club_id = p_club and user_id = p_user;
  update public.clubs set leader_id = p_user where id = p_club;
end $$;

-- ── 4. 정원 — 클럽 줄을 잠그고 센다 ────────────────────────────
create or replace function public.club_decide(p_club uuid, p_user uuid, p_approve boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare cap int;
begin
  perform public.club_need_login();
  if not (public.club_is_leader(p_club) or public.club_is_admin()) then
    raise exception '클럽장만 할 수 있어요';
  end if;
  if not exists (select 1 from public.club_members
                 where club_id = p_club and user_id = p_user and status = 'pending') then
    raise exception '대기 중인 신청이 아니에요';
  end if;
  if p_approve then
    /* 두 사람을 동시에 승인해도 한쪽은 기다렸다가 센다 */
    select capacity into cap from public.clubs where id = p_club for update;
    if (select count(*) from public.club_members where club_id = p_club and status = 'active') >= cap then
      raise exception '클럽 정원이 찼어요';
    end if;
    update public.club_members set status = 'active', joined_at = now()
     where club_id = p_club and user_id = p_user;
  else
    delete from public.club_members where club_id = p_club and user_id = p_user;
  end if;
end $$;

-- ── 5. 내보내기 · 탈퇴 ─────────────────────────────────────────
create or replace function public.club_kick(p_club uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not (public.club_is_leader(p_club) or public.club_is_admin()) then
    raise exception '클럽장만 할 수 있어요';
  end if;
  if exists (select 1 from public.clubs where id = p_club and leader_id = p_user) then
    raise exception '클럽장은 내보낼 수 없어요';
  end if;
  delete from public.club_event_rsvps where club_id = p_club and user_id = p_user;
  delete from public.club_decks where user_id = p_user and club_id = p_club;
  delete from public.club_members where club_id = p_club and user_id = p_user;
end $$;

/* 탈퇴 — 클럽장은 다른 회원이 남아 있으면 먼저 넘겨야 한다. 혼자면 클럽이 닫힌다 */
create or replace function public.club_leave() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  m public.club_members;
begin
  select * into m from public.club_members where user_id = me and status = 'active';
  if not found then return; end if;
  if m.role = 'leader' then
    if exists (select 1 from public.club_members
               where club_id = m.club_id and user_id <> me and status = 'active') then
      raise exception '클럽장을 넘긴 뒤에 나갈 수 있어요';
    end if;
    update public.club_applications set status = 'cancelled'
     where target_club_id = m.club_id and kind = 'reverify' and status in ('draft','pending');
    delete from public.clubs where id = m.club_id;
    return;
  end if;
  delete from public.club_event_rsvps where club_id = m.club_id and user_id = me;
  delete from public.club_decks where user_id = me;
  delete from public.club_members where user_id = me;
end $$;

-- ── 6. 클럽 닫기 ───────────────────────────────────────────────
create or replace function public.club_disband(p_club uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not (public.club_is_leader(p_club) or public.club_is_admin()) then
    raise exception '클럽장만 할 수 있어요';
  end if;
  update public.club_applications set status = 'cancelled'
   where target_club_id = p_club and kind = 'reverify' and status in ('draft','pending');
  delete from public.clubs where id = p_club;
end $$;

-- ── 8. 예전에 남은 것 정리 ─────────────────────────────────────
update public.club_applications set status = 'cancelled'
 where kind = 'reverify' and status in ('draft','pending')
   and not exists (select 1 from public.clubs c where c.id = target_club_id);

-- 확인 — 아래 8줄이 모두 true 면 적용된 것
select 'posts_write 선택지 검사' as 항목, position('jsonb_array_elements' in pg_get_expr(polwithcheck, polrelid)) > 0 as 적용
  from pg_policy where polname = 'club_posts_write'
union all select 'votes_delete 마감 검사', position('closes_at' in pg_get_expr(polqual, polrelid)) > 0 from pg_policy where polname = 'club_votes_delete'
union all select 'fill_author 서버 시각', position('created_at := now()' in prosrc) > 0 from pg_proc where proname = 'club_fill_author'
union all select 'cancel_application 재인증 제외', position('reverify' in prosrc) > 0 from pg_proc where proname = 'club_cancel_application'
union all select 'transfer 심사 중 막기', position('target_club_id' in prosrc) > 0 from pg_proc where proname = 'club_transfer'
union all select 'decide 잠금', position('for update' in prosrc) > 0 from pg_proc where proname = 'club_decide'
union all select 'votes_write 마감 시각 안전하게', position('club_try_ts' in pg_get_expr(polwithcheck, polrelid)) > 0 from pg_policy where polname = 'club_votes_write'
union all select '클럽 없는 재인증 0건', not exists (select 1 from public.club_applications a where a.kind = 'reverify' and a.status in ('draft','pending')
                                                   and not exists (select 1 from public.clubs c where c.id = a.target_club_id));
