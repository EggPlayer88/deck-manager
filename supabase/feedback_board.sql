-- ================================================================
-- 고객센터 게시판 (2026-10-19) — Supabase SQL 편집기에서 한 번 실행한다
--   공지사항 · 업데이트 내역(운영자만 씀) · 건의사항 · 오류 제보(누구나). 사용설명서는 화면에 들어 있어 표가 없다
--
-- 무엇이 생기나
--   표     feedback_posts — 오류 제보 · 건의사항 · 공지 · 업데이트 내역 (화면: src/feedback-board.jsx)
--          feedback_votes — 공감 (한 사람이 글마다 한 번)
--   함수   feedback_is_admin()          관리자 판정 (profiles.is_admin)
--          feedback_before_insert()     글쓴이 · 시각 · 상태 · 답변 · 공감 수는 서버가 채운다 · 하루 5개 · 사진 경로 확인
--          feedback_vote_guard()        공감 — 내 글 · 공지 · 업데이트 내역 · 비밀글에는 못 한다
--          feedback_vote_count()        공감 수는 서버가 센다
--          feedback_admin_update(...)   운영자 — 상태 · 답변 · 고정
--          feedback_edit_post(...)      글 고치기 — 쓴 사람은 내 글, 운영자는 공지 · 업데이트 내역 (제목 · 내용만)
--          feedback_can_see_image(...)  사진 — 그 글이 보이는 사람만
--          feedback_post_env(...)       기기 정보 — 쓴 사람과 운영자만 (표에서 env 칸은 아무도 직접 못 읽는다)
--   저장소 feedback-media/<글쓴이 id>/<파일>
--   첫 글  공지 '고객센터를 열었어요' · 업데이트 내역 9개(9/27 ~ 10/19) — 공지 · 업데이트 글이 하나도 없을 때만 넣는다
--
-- 권한 원칙
--   · 읽기: 공개 글은 누구나(로그인 안 해도). 비밀글은 쓴 사람과 운영자만
--     기기 정보(env)는 칸째 닫고 feedback_post_env 로만 준다 — 화면이 '나와 운영자만 봐요'라고 약속하므로
--   · 쓰기: 로그인한 사람만. 화면이 보낸 글쓴이 · 상태 · 답변 · 공감 수는 믿지 않고 서버가 정한다
--   · 공지 · 업데이트 내역 · 고정 · '운영자' 표시는 운영자만. 운영자 · 관리자 같은 닉네임은 남이 못 쓴다
--   · 지우기: 쓴 사람과 운영자. 표를 직접 고치기(update)는 아무도 못 한다
--     — 제목 · 내용은 feedback_edit_post, 답변 · 상태 · 고정은 feedback_admin_update 로만
--   · 기존 표(profiles · user_settings · global_* · club_* · coffee_gifts)의 정책은 바꾸지 않는다
--
-- 이 SQL 을 먼저 실행한 뒤에 화면을 배포한다 (표가 없으면 게시판에 '준비 중' 안내가 뜬다)
-- 다시 실행해도 된다 (if not exists · or replace · drop ... if exists · 첫 글은 한 번만)
-- 맨 끝의 확인 15줄이 모두 true 면 끝
-- ================================================================

set lock_timeout = '5s';

-- ── 표 ──────────────────────────────────────────────────────────
create table if not exists public.feedback_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null default auth.uid(),
  nickname     text not null default '익명' check (char_length(btrim(nickname)) between 1 and 12),
  by_admin     boolean not null default false,
  kind         text not null check (kind in ('bug', 'idea', 'notice', 'update')),
  title        text not null check (char_length(btrim(title)) between 1 and 60),
  body         text not null default '' check (char_length(body) <= 3000),
  images       text[] not null default '{}' check (cardinality(images) <= 2),
  secret       boolean not null default false,
  env          jsonb check (env is null or pg_column_size(env) < 2000),
  status       text not null default 'open' check (status in ('open', 'progress', 'done', 'hold')),
  answer       text not null default '' check (char_length(answer) <= 3000),
  answered_at  timestamptz,
  pinned       boolean not null default false,
  votes        int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists feedback_posts_list on public.feedback_posts (created_at desc);
create index if not exists feedback_posts_author on public.feedback_posts (author_id, created_at desc);

create table if not exists public.feedback_votes (
  post_id     uuid not null references public.feedback_posts(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

/* 고친 시각 — 글쓴이(공지 · 업데이트 내역은 운영자)가 제목 · 내용을 고치면 feedback_edit_post 가 적는다 */
alter table public.feedback_posts add column if not exists edited_at timestamptz;

/* 예전 판(오류 · 건의 게시판)을 이미 실행했어도 종류 검사를 새로 맞춘다 */
alter table public.feedback_posts drop constraint if exists feedback_posts_kind_check;
alter table public.feedback_posts add constraint feedback_posts_kind_check check (kind in ('bug', 'idea', 'notice', 'update'));

alter table public.feedback_posts enable row level security;
alter table public.feedback_votes enable row level security;

-- ── 함수 ────────────────────────────────────────────────────────
-- 관리자 판정 — club_is_admin · coffee_is_admin 과 같은 식이지만 기능끼리 서로 기대지 않게 따로 둔다
create or replace function public.feedback_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- 글쓸 때: 서버가 정할 것은 서버가 정한다
create or replace function public.feedback_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  adm boolean := public.feedback_is_admin();
  p   text;
begin
  if me is null then raise exception '로그인이 필요해요'; end if;
  new.author_id   := me;
  new.by_admin    := adm;
  new.created_at  := now();
  new.status      := 'open';
  new.answer      := '';
  new.answered_at := null;
  new.votes       := 0;
  new.edited_at   := null;
  new.nickname    := coalesce(nullif(btrim(new.nickname), ''), '익명');
  if not adm and lower(replace(new.nickname, ' ', '')) ~ '(운영자|관리자|개발자|admin|덱매니저)' then
    raise exception '이 닉네임은 쓸 수 없어요';
  end if;
  if new.kind in ('notice', 'update') and not adm then raise exception '공지 · 업데이트 내역은 운영자만 쓸 수 있어요'; end if;
  /* 운영자가 닉네임을 비우고 쓴 공지 · 업데이트 내역은 '운영자'로 */
  if adm and new.kind in ('notice', 'update') and new.nickname = '익명' then new.nickname := '운영자'; end if;
  if not adm then new.pinned := false; end if;
  if new.kind in ('notice', 'update') then new.secret := false; end if;
  /* 사진은 내 폴더(feedback-media/<내 id>/…)에 올린 것만 붙일 수 있다 */
  foreach p in array coalesce(new.images, '{}') loop
    if p is null or split_part(p, '/', 1) <> me::text or position('..' in p) > 0 then
      raise exception '사진 경로가 올바르지 않아요';
    end if;
  end loop;
  if not adm and (select count(*) from public.feedback_posts
                  where author_id = me and created_at > now() - interval '24 hours') >= 5 then
    raise exception '하루에 5개까지 쓸 수 있어요. 내일 다시 남겨 주세요';
  end if;
  return new;
end $$;
drop trigger if exists feedback_before_insert on public.feedback_posts;
create trigger feedback_before_insert before insert on public.feedback_posts
  for each row execute function public.feedback_before_insert();

-- 공감할 때: 누른 사람 · 시각은 서버가. 내 글 · 공지 · 업데이트 내역 · 비밀글에는 못 한다
create or replace function public.feedback_vote_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r  public.feedback_posts;
begin
  if me is null then raise exception '로그인이 필요해요'; end if;
  new.user_id := me;
  new.created_at := now();
  select * into r from public.feedback_posts where id = new.post_id;
  if not found then raise exception '글이 없어요'; end if;
  if r.kind in ('notice', 'update') then raise exception '공지 · 업데이트 내역에는 공감할 수 없어요'; end if;
  if r.secret then raise exception '비밀글에는 공감할 수 없어요'; end if;
  if r.author_id = me then raise exception '내 글에는 공감할 수 없어요'; end if;
  return new;
end $$;
drop trigger if exists feedback_vote_guard on public.feedback_votes;
create trigger feedback_vote_guard before insert on public.feedback_votes
  for each row execute function public.feedback_vote_guard();

-- 공감 수는 서버가 센다 (화면은 votes 칸을 읽기만)
create or replace function public.feedback_vote_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.feedback_posts set votes = votes + 1 where id = new.post_id;
  else
    update public.feedback_posts set votes = greatest(0, votes - 1) where id = old.post_id;
  end if;
  return null;
end $$;
drop trigger if exists feedback_vote_count on public.feedback_votes;
create trigger feedback_vote_count after insert or delete on public.feedback_votes
  for each row execute function public.feedback_vote_count();

-- 운영자: 상태 · 답변 · 고정 (답변을 새로 쓰거나 고치면 답변 시각이 바뀐다 — 글쓴이 알림이 이 시각을 본다)
create or replace function public.feedback_admin_update(p_id uuid, p_status text, p_answer text, p_pinned boolean)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  r public.feedback_posts;
  a text := coalesce(p_answer, '');
begin
  if not public.feedback_is_admin() then raise exception '운영자만 할 수 있어요'; end if;
  select * into r from public.feedback_posts where id = p_id for update;
  if not found then raise exception '글이 없어요'; end if;
  if p_status is not null and p_status not in ('open', 'progress', 'done', 'hold') then
    raise exception '상태 값이 올바르지 않아요';
  end if;
  if char_length(a) > 3000 then raise exception '답변은 3000자까지예요'; end if;
  update public.feedback_posts set
    status      = coalesce(p_status, status),
    answer      = a,
    answered_at = case when btrim(a) = '' then null
                       when a is distinct from r.answer then now()
                       else answered_at end,
    pinned      = coalesce(p_pinned, pinned)
  where id = p_id;
end $$;

-- 글 고치기: 제목 · 내용만. 쓴 사람은 내 글을, 운영자는 공지 · 업데이트 내역을 고친다 (남의 건의 · 제보는 운영자도 못 고친다 — 지우기만)
create or replace function public.feedback_edit_post(p_id uuid, p_title text, p_body text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  me  uuid := auth.uid();
  r   public.feedback_posts;
  t   text := btrim(coalesce(p_title, ''));
  b   text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception '로그인이 필요해요'; end if;
  select * into r from public.feedback_posts where id = p_id for update;
  if not found then raise exception '글이 없어요'; end if;
  if not (r.author_id = me or (r.kind in ('notice', 'update') and public.feedback_is_admin())) then
    raise exception '내가 쓴 글만 고칠 수 있어요';
  end if;
  if char_length(t) < 1 or char_length(t) > 60 then raise exception '제목은 1~60자로 적어 주세요'; end if;
  if char_length(b) > 3000 then raise exception '내용은 3000자까지예요'; end if;
  if r.kind in ('bug', 'idea') and char_length(b) < 5 then raise exception '내용을 조금만 더 적어 주세요 (5자 이상)'; end if;
  if t = r.title and b = r.body then return; end if;   -- 바뀐 것이 없으면 '수정됨'도 붙이지 않는다
  update public.feedback_posts set title = t, body = b, edited_at = now() where id = p_id;
end $$;

-- 사진: 그 사진이 붙은 글을 볼 수 있는 사람만
create or replace function public.feedback_can_see_image(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feedback_posts p
                 where p_name = any(p.images)
                   and (not p.secret or p.author_id = auth.uid() or public.feedback_is_admin()))
$$;

-- 기기 정보: 쓴 사람과 운영자만 (아니면 null). 표의 env 칸은 아래 권한에서 닫는다
create or replace function public.feedback_post_env(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select p.env from public.feedback_posts p
  where p.id = p_id and (p.author_id = auth.uid() or public.feedback_is_admin())
$$;

-- ── 정책 ────────────────────────────────────────────────────────
drop policy if exists feedback_read on public.feedback_posts;
create policy feedback_read on public.feedback_posts for select to anon, authenticated
  using (not secret or author_id = auth.uid() or public.feedback_is_admin());

drop policy if exists feedback_write on public.feedback_posts;
create policy feedback_write on public.feedback_posts for insert to authenticated
  with check (author_id = auth.uid());

drop policy if exists feedback_delete on public.feedback_posts;
create policy feedback_delete on public.feedback_posts for delete to authenticated
  using (author_id = auth.uid() or public.feedback_is_admin());

drop policy if exists feedback_votes_read on public.feedback_votes;
create policy feedback_votes_read on public.feedback_votes for select to authenticated
  using (user_id = auth.uid());

drop policy if exists feedback_votes_write on public.feedback_votes;
create policy feedback_votes_write on public.feedback_votes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists feedback_votes_delete on public.feedback_votes;
create policy feedback_votes_delete on public.feedback_votes for delete to authenticated
  using (user_id = auth.uid());

-- ── 표 · 함수 권한 — 이 프로젝트는 새 표에 권한이 자동으로 붙지 않는다 (커피 · 클럽 라운지 SQL 과 같은 방식) ──
revoke all on public.feedback_posts, public.feedback_votes from anon, authenticated;
/* 읽기는 칸을 골라서 — 기기 정보(env)만 뺀다. 줄은 정책이 거르고, env 는 feedback_post_env 로만.
   (화면은 select('*') 대신 칸 이름을 적어 읽는다 — feedback-api.js 의 COLS) */
grant select (id, author_id, nickname, by_admin, kind, title, body, images, secret, status, answer, answered_at, pinned, votes, created_at, edited_at)
  on public.feedback_posts to anon, authenticated;
grant insert (nickname, kind, title, body, images, secret, env, pinned) on public.feedback_posts to authenticated;
grant delete on public.feedback_posts to authenticated;
grant select, delete on public.feedback_votes to authenticated;
grant insert (post_id) on public.feedback_votes to authenticated;

revoke all on function public.feedback_is_admin() from public;
grant execute on function public.feedback_is_admin() to anon, authenticated;
revoke all on function public.feedback_can_see_image(text) from public;
grant execute on function public.feedback_can_see_image(text) to anon, authenticated;
revoke all on function public.feedback_post_env(uuid) from public, anon;
grant execute on function public.feedback_post_env(uuid) to authenticated;
revoke all on function public.feedback_admin_update(uuid, text, text, boolean) from public, anon;
grant execute on function public.feedback_admin_update(uuid, text, text, boolean) to authenticated;
revoke all on function public.feedback_edit_post(uuid, text, text) from public, anon;
grant execute on function public.feedback_edit_post(uuid, text, text) to authenticated;
revoke all on function public.feedback_before_insert() from public, anon, authenticated;
revoke all on function public.feedback_vote_guard() from public, anon, authenticated;
revoke all on function public.feedback_vote_count() from public, anon, authenticated;

-- ── 저장소 ──────────────────────────────────────────────────────
-- feedback-media/<글쓴이 id>/<파일> — 올리기 · 지우기는 내 폴더만(운영자는 지우기 가능), 보기는 그 글이 보이는 사람
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-media', 'feedback-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists feedback_media_insert on storage.objects;
create policy feedback_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feedback-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists feedback_media_read on storage.objects;
create policy feedback_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'feedback-media'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.feedback_can_see_image(name)));
drop policy if exists feedback_media_delete on storage.objects;
create policy feedback_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feedback-media'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.feedback_is_admin()));

-- ── 첫 글 — 공지 1개 · 업데이트 내역 9개 ─────────────────────────
-- 공지 · 업데이트 글이 하나도 없을 때만 넣는다 (다시 실행해도 또 생기지 않는다). 글쓴이는 운영자(profiles.is_admin) 계정.
-- 시각을 그날로 적으려고 글쓰기 트리거를 잠시 끄고 넣는다 — 이 파일 전체가 한 묶음으로 돌아서 중간에 실패하면 끈 것도 되돌아간다
alter table public.feedback_posts disable trigger feedback_before_insert;
insert into public.feedback_posts (author_id, nickname, by_admin, kind, title, body, pinned, created_at)
select a.id, '운영자', true, v.kind, v.title, v.body, v.pinned, v.at
from (select id from public.profiles where is_admin order by id limit 1) a
cross join (values
  ('notice', '고객센터를 열었어요',
   E'덱 매니저를 쓰다가 궁금한 점, 이상한 점, 바라는 기능이 있으면 이곳에 남겨 주세요. 하나씩 읽고 답을 달게요.\n\n· 📢 공지사항 · 🆕 업데이트 내역 — 바뀐 점과 소식을 모아 둬요\n· 📖 사용설명서 — 메뉴마다 무엇을 하는지, 점수는 어떻게 계산되는지\n· 💡 건의사항 — 바라는 기능을 남기고, 다른 사람 건의에는 👍 공감을 눌러 주세요\n· 🐞 오류 제보 — 어떤 화면에서 · 무엇을 했을 때 · 어떻게 됐는지 적어 주세요. 화면 캡처가 있으면 훨씬 빨리 찾아요\n\n글쓰기 · 공감은 구글 로그인한 분만 할 수 있어요. 비밀글로 쓰면 나와 운영자만 봐요.\n고객센터를 열면서 개인정보처리방침에 「고객센터에 쓴 글」 항목을 더했어요.',
   true, now()),
  ('update', '10/19 업데이트 — 불펜 전술 나누기 · 발사각 보너스 · 라이브 시너지',
   E'· 불펜 전술을 승리조 · 추격조 따로 골라요 — 승리조 기본 · 적극 · 분업(승리조 3명일 때), 추격조 기본 · 적극\n· 롱릴리프가 0명인 편성(3/3/0 · 2/4/0)은 빈 칸을 빼서 선발 줄과 불펜 줄 폭을 맞췄어요. 폰에서 추격조 4명이 잘리던 것도 고쳤어요\n· 발사각 보너스를 새 기준으로 — 필요파워 13~16도 162 · 17도 165 · 18도 168 (그 뒤 1도마다 +3), 스킬점수 45점부터 3점마다 파워 +1 로 보정, 보너스 +3 / +7 / +5\n· 라이브 시너지에 올스타 카드도 셉니다 (라이브 · 국가대표 · 올스타 합쳐 7장)\n· 옛 이름 스킬(컨택트히터(타순O) 등)이 타순 보정에서 바뀐 것처럼 보이던 것을 고쳤어요\n· 클럽 라운지 — 오류를 고치고 보기 편하게 다듬었어요. 가입 신청이 오면 클럽장 메뉴에 빨간 점이 떠요',
   false, timestamptz '2026-10-19 16:30:00+09'),
  ('update', '10/16 업데이트 — 분업 가중치 · 개발자에게 커피 한 잔',
   E'· 중계 분업의 승리조 가중치를 0.45 · 0.60 · 0.75 로 바꿨어요 — 6회 → 7회 → 8회가 같은 폭으로 중요해지게\n· 메뉴 구석에 「개발자에게 커피 한 잔」을 달았어요 (카카오톡 선물코드를 받는 작은 창)',
   false, timestamptz '2026-10-16 12:40:00+09'),
  ('update', '10/15 업데이트 — 클럽 라운지(β) · 중계 등판 순서',
   E'· 클럽 라운지(β) 시범 운영 — 클럽장 인증 뒤 클럽원끼리 덱 · 글 · 댓글 · 투표 · 일정을 나눠요. 덱 연구소의 덱을 공유하고 수정 제안도 보낼 수 있어요\n· 중계 등판 순서를 자리와 따로 정해요 — 카드 아래 화살표로 같은 조 안에서만. 자리(RP1~6)는 포지션 특훈을, 배율은 등판 차례를 따릅니다\n· 분업이면 승리조 2 · 3번째로 나오는 투수가 셋업1 · 셋업2 스킬을 받아요',
   false, timestamptz '2026-10-15 21:18:00+09'),
  ('update', '10/12 업데이트 — 좌타 감점 · 중계 전술 표시',
   E'· 좌타자 감점을 2.5 → 4 로 바꿨어요\n· 중계 전술(적극 · 분업)로 오르는 능력치는 라인업 숫자에는 안 보이고 점수에만 들어가요 — 인게임 덱 화면 수치와 같게',
   false, timestamptz '2026-10-12 01:26:00+09'),
  ('update', '10/11 업데이트 — 저장 안정화',
   E'· 여러 탭 · 여러 기기에서 같은 계정을 쓸 때 덱이 서로 덮이지 않게 저장 방식을 보강했어요 (10/7 · 10/11)\n· 덱을 다 읽어 오기 전에는 저장하지 않게 막았어요',
   false, timestamptz '2026-10-11 23:35:00+09'),
  ('update', '10/2 업데이트 — 덱 연구소 카드 고르기',
   E'· 덱 연구소 카드 고르기를 「표준 점수순」으로 — 내 라인업과 상관없이 모든 카드를 같은 잣대로 잰 순서예요\n· 덱 연구소에서 임팩트 카드의 종류를 보여 줘요',
   false, timestamptz '2026-10-02 23:19:00+09'),
  ('update', '10/1 업데이트 — 스쿼드 공유 새 디자인 · 구단주 배너',
   E'· 스쿼드 공유 그림을 스티커북 디자인으로 바꾸고 선수 사진을 넣었어요\n· 라인업 화면에 KBO 구단주(β) 소개 배너를 달았어요\n· 좁은 폰에서 로그인 화면이 옆으로 넘치던 것을 고쳤어요',
   false, timestamptz '2026-10-01 14:39:00+09'),
  ('update', '9/30 업데이트 — KBO 구단주(β) · 새 스킬 슬로우 스타트',
   E'· KBO 구단주(β)를 구글 로그인한 모두에게 열었어요 (메뉴의 클럽라운지 아래)\n· 새 스킬 「슬로우 스타트」 (타자 · 선발 · 불펜)\n· 선수 사진을 팀별로 붙일 수 있게 했어요 — 같은 이름의 다른 팀 카드도 맞는 사진으로\n· 덱 연구소 마지막 줄이 폰 아래 메뉴에 가려지던 것, 게스트가 오류 화면에 막히던 것을 고쳤어요',
   false, timestamptz '2026-09-30 16:42:00+09'),
  ('update', '9/29 업데이트 — 타순 스킬 자동 맞춤 · 올스타 각성',
   E'· 타순에 따라 컨택트히터 · 핵타선 스킬과 발사각을 자동으로 맞춰요 (9/28)\n· 타순을 타는 스킬 넷 더 — 공포의하위타선 · 수비안정성 · 리드오프 · 빈틈없는타선 (9/29)\n· 중계 · 마무리의 원투펀치는 배치X 값으로 셉니다 (9/28)\n· 올스타 카드도 각성 잠재력을 넣을 수 있어요 · 전력공유 그림에 강화 / 각성 딱지 (9/27)',
   false, timestamptz '2026-09-29 00:20:00+09')
) as v(kind, title, body, pinned, at)
where not exists (select 1 from public.feedback_posts where kind in ('notice', 'update'));
alter table public.feedback_posts enable trigger feedback_before_insert;

-- ── 확인 — 아래 줄이 모두 true 면 끝 ─────────────────────────────
select '표 두 개' as "확인", (to_regclass('public.feedback_posts') is not null and to_regclass('public.feedback_votes') is not null) as "적용"
union all select '표 보호(RLS) 켜짐', (select bool_and(relrowsecurity) from pg_class where oid in ('public.feedback_posts'::regclass, 'public.feedback_votes'::regclass))
union all select '정책 6개', (select count(*) = 6 from pg_policy where polrelid in ('public.feedback_posts'::regclass, 'public.feedback_votes'::regclass))
union all select '로그인 안 해도 공개 글 읽기', has_column_privilege('anon', 'public.feedback_posts', 'title', 'select')
union all select '기기 정보 칸은 아무도 직접 못 읽음', (not has_column_privilege('anon', 'public.feedback_posts', 'env', 'select') and not has_column_privilege('authenticated', 'public.feedback_posts', 'env', 'select'))
union all select '기기 정보 함수', exists (select 1 from pg_proc where proname = 'feedback_post_env')
union all select '로그인 안 하면 못 씀', not has_table_privilege('anon', 'public.feedback_posts', 'insert')
union all select '아무도 직접 못 고침', not has_table_privilege('authenticated', 'public.feedback_posts', 'update')
union all select '글쓰기 트리거 (켜져 있음)', exists (select 1 from pg_trigger where tgname = 'feedback_before_insert' and tgenabled <> 'D')
union all select '공감 트리거 두 개', (select count(*) = 2 from pg_trigger where tgname in ('feedback_vote_guard', 'feedback_vote_count'))
union all select '운영자 함수', exists (select 1 from pg_proc where proname = 'feedback_admin_update')
union all select '글 고치기 함수', exists (select 1 from pg_proc where proname = 'feedback_edit_post')
union all select '사진 저장소', exists (select 1 from storage.buckets where id = 'feedback-media')
union all select '업데이트 내역 종류', exists (select 1 from pg_constraint where conname = 'feedback_posts_kind_check' and pg_get_constraintdef(oid) like '%update%')
union all select '첫 글 (공지 · 업데이트 내역)', (exists (select 1 from public.feedback_posts where kind = 'notice') and exists (select 1 from public.feedback_posts where kind = 'update'));
