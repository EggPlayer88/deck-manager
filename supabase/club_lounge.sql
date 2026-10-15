-- ================================================================
-- 클럽 라운지 (2026-10) — Supabase SQL 편집기에서 한 번 실행한다
--
-- 무엇이 생기나
--   표      clubs · club_applications · club_members · club_decks
--           club_posts · club_comments · club_reactions · club_votes
--           club_events · club_event_rsvps
--   저장소  club-verify (클럽장 인증 캡처, 비공개) · club-media (글 사진, 비공개)
--
-- 권한 원칙
--   · 읽기는 RLS 로 — 같은 클럽의 활동 회원만. 덱 요약은 본인과 클럽장만
--   · 회원·클럽을 바꾸는 쓰기는 전부 아래 함수(RPC)로만 — 표에 직접 쓰는 권한은 주지 않는다
--     (역할을 스스로 leader 로 바꾸는 식의 틈을 정책 조합으로 막으려 하지 않는다)
--   · 글·댓글·반응·투표·일정 참여는 표에 직접 쓰되, 정책이 작성자=나·같은 클럽을 확인한다
--   · user_settings(원본 덱 저장)는 이 기능이 전혀 건드리지 않는다
--
-- 기존 표(profiles·user_settings·global_*)의 정책은 바꾸지 않는다.
-- 관리자 판정은 profiles 의 본인 행 읽기에 기댄다 (deck-manager-rls-hardening).
-- ================================================================

set lock_timeout = '5s';

-- ── 표 ──────────────────────────────────────────────────────────

create table if not exists public.clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 20),
  leader_id    uuid not null,
  invite_code  text not null unique,
  intro        text not null default '' check (char_length(intro) <= 200),
  capacity     int  not null default 30 check (capacity between 1 and 100),
  created_at   timestamptz not null default now()
);
create unique index if not exists clubs_name_uq on public.clubs (lower(btrim(name)));

/* 클럽장 인증 신청. draft = 코드를 받았고 아직 캡처 전, pending = 관리자 확인 대기 */
create table if not exists public.club_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null,
  club_name     text not null check (char_length(btrim(club_name)) between 1 and 20),
  nickname      text not null check (char_length(btrim(nickname)) between 1 and 20),
  code          text not null,
  shots         text[] not null default '{}',
  status        text not null default 'draft'
                check (status in ('draft','pending','approved','rejected','cancelled')),
  reason        text not null default '',
  club_id       uuid,
  created_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  shots_purged  boolean not null default false
);
/* 한 사람에게 열려 있는 신청은 하나 */
create unique index if not exists club_app_open_uq on public.club_applications (user_id)
  where status in ('draft','pending');

/* 회원. pending = 가입 신청, active = 승인됨. 한 계정은 한 클럽에만 (신청 중 포함) */
create table if not exists public.club_members (
  club_id        uuid not null references public.clubs(id) on delete cascade,
  user_id        uuid not null,
  nickname       text not null check (char_length(btrim(nickname)) between 1 and 20),
  role           text not null default 'member' check (role in ('leader','member')),
  status         text not null default 'pending' check (status in ('pending','active')),
  share_deck_id  text,
  created_at     timestamptz not null default now(),
  joined_at      timestamptz,
  primary key (club_id, user_id)
);
create unique index if not exists club_members_one_club on public.club_members (user_id);

/* 클럽에 공개한 덱 요약본 — 한 사람에 한 줄. 원본(user_settings)과 별개다 */
create table if not exists public.club_decks (
  user_id       uuid primary key,
  club_id       uuid not null references public.clubs(id) on delete cascade,
  deck          jsonb not null,
  total         numeric not null default 0,
  set_point     int not null default 0,
  filled        int not null default 0,
  week_base     numeric,
  week_base_at  timestamptz,
  saved_at      timestamptz not null default now()
);
create index if not exists club_decks_club on public.club_decks (club_id);

create table if not exists public.club_posts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  author_id   uuid not null default auth.uid(),
  kind        text not null check (kind in ('talk','deck','question','poll','brag','notice')),
  title       text not null default '' check (char_length(title) <= 60),
  body        text not null default '' check (char_length(body) <= 2000),
  deck        jsonb check (deck is null or pg_column_size(deck) < 20000),
  poll        jsonb check (poll is null or pg_column_size(poll) < 4000),
  images      text[] not null default '{}' check (cardinality(images) <= 4),
  allow_copy  boolean not null default true,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists club_posts_feed on public.club_posts (club_id, created_at desc);

create table if not exists public.club_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.club_posts(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  author_id   uuid not null default auth.uid(),
  body        text not null default '' check (char_length(body) <= 1000),
  suggestion  jsonb check (suggestion is null or pg_column_size(suggestion) < 20000),
  created_at  timestamptz not null default now()
);
create index if not exists club_comments_post on public.club_comments (post_id, created_at);

create table if not exists public.club_reactions (
  post_id     uuid not null references public.club_posts(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  emoji       text not null check (emoji in ('heart','fire','eyes','party','clap')),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists club_reactions_club on public.club_reactions (club_id);

create table if not exists public.club_votes (
  post_id     uuid not null references public.club_posts(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  choice      int not null check (choice between 0 and 5),
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists club_votes_club on public.club_votes (club_id);

create table if not exists public.club_events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 40),
  starts_at   timestamptz not null,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists club_events_club on public.club_events (club_id, starts_at);

create table if not exists public.club_event_rsvps (
  event_id    uuid not null references public.club_events(id) on delete cascade,
  club_id     uuid not null references public.clubs(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

/* 글·댓글에 쓴 사람 이름을 같이 적어 둔다 — 떠난 회원의 글도 이름이 남게.
   화면이 보낸 값은 믿지 않고 회원표에서 채운다 */
alter table public.club_posts    add column if not exists author_name text not null default '';
alter table public.club_comments add column if not exists author_name text not null default '';

create or replace function public.club_fill_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce((select nickname from public.club_members
                               where club_id = new.club_id and user_id = new.author_id), '');
  return new;
end $$;
drop trigger if exists club_posts_author on public.club_posts;
create trigger club_posts_author before insert on public.club_posts
  for each row execute function public.club_fill_author();
drop trigger if exists club_comments_author on public.club_comments;
create trigger club_comments_author before insert on public.club_comments
  for each row execute function public.club_fill_author();

-- ── 판정 함수 (정책 안에서 쓰인다. definer 라 정책끼리 서로 부르며 맴돌지 않는다) ──

create or replace function public.club_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.club_is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members
                 where club_id = cid and user_id = auth.uid() and status = 'active')
$$;

create or replace function public.club_is_leader(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clubs where id = cid and leader_id = auth.uid())
$$;

/* 신청 중이어도 클럽 이름은 보여야 한다 (가입 대기 화면) */
create or replace function public.club_has_row(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members where club_id = cid and user_id = auth.uid())
$$;

/* 저장소 경로의 첫 칸(클럽 id 글자)으로 회원인지 — 이상한 글자면 거짓 */
create or replace function public.club_member_of_path(seg text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.club_is_member(seg::uuid);
exception when others then
  return false;
end $$;

create or replace function public.club_leader_of_path(seg text) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  return public.club_is_leader(seg::uuid);
exception when others then
  return false;
end $$;

-- ── 읽기 정책 ──────────────────────────────────────────────────

alter table public.clubs              enable row level security;
alter table public.club_applications  enable row level security;
alter table public.club_members       enable row level security;
alter table public.club_decks         enable row level security;
alter table public.club_posts         enable row level security;
alter table public.club_comments      enable row level security;
alter table public.club_reactions     enable row level security;
alter table public.club_votes         enable row level security;
alter table public.club_events        enable row level security;
alter table public.club_event_rsvps   enable row level security;

drop policy if exists clubs_read on public.clubs;
create policy clubs_read on public.clubs for select to authenticated
  using (public.club_has_row(id) or public.club_is_admin());

drop policy if exists club_apps_read on public.club_applications;
create policy club_apps_read on public.club_applications for select to authenticated
  using (user_id = auth.uid() or public.club_is_admin());

/* 같은 클럽 활동 회원끼리는 서로 보인다. 가입 신청(pending)은 본인·클럽장·관리자만 */
drop policy if exists club_members_read on public.club_members;
create policy club_members_read on public.club_members for select to authenticated
  using (user_id = auth.uid()
         or (status = 'active' and public.club_is_member(club_id))
         or public.club_is_leader(club_id)
         or public.club_is_admin());

/* 덱 요약본은 본인과 그 클럽의 클럽장만 */
drop policy if exists club_decks_read on public.club_decks;
create policy club_decks_read on public.club_decks for select to authenticated
  using (user_id = auth.uid() or public.club_is_leader(club_id) or public.club_is_admin());

-- ── 글·댓글·반응·투표·일정 ────────────────────────────────────

drop policy if exists club_posts_read on public.club_posts;
create policy club_posts_read on public.club_posts for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_posts_write on public.club_posts;
create policy club_posts_write on public.club_posts for insert to authenticated
  with check (author_id = auth.uid() and public.club_is_member(club_id)
              and (kind <> 'notice' or public.club_is_leader(club_id))
              and (pinned = false or public.club_is_leader(club_id))
              and (kind <> 'poll' or (poll is not null
                   and jsonb_typeof(poll->'options') = 'array'
                   and jsonb_array_length(poll->'options') between 2 and 6)));
drop policy if exists club_posts_delete on public.club_posts;
create policy club_posts_delete on public.club_posts for delete to authenticated
  using (author_id = auth.uid() or public.club_is_leader(club_id) or public.club_is_admin());

drop policy if exists club_comments_read on public.club_comments;
create policy club_comments_read on public.club_comments for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_comments_write on public.club_comments;
create policy club_comments_write on public.club_comments for insert to authenticated
  with check (author_id = auth.uid() and public.club_is_member(club_id)
              and exists (select 1 from public.club_posts p
                          where p.id = post_id and p.club_id = club_comments.club_id));
drop policy if exists club_comments_delete on public.club_comments;
create policy club_comments_delete on public.club_comments for delete to authenticated
  using (author_id = auth.uid() or public.club_is_leader(club_id) or public.club_is_admin());

drop policy if exists club_reactions_read on public.club_reactions;
create policy club_reactions_read on public.club_reactions for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_reactions_write on public.club_reactions;
create policy club_reactions_write on public.club_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.club_is_member(club_id)
              and exists (select 1 from public.club_posts p
                          where p.id = post_id and p.club_id = club_reactions.club_id));
drop policy if exists club_reactions_delete on public.club_reactions;
create policy club_reactions_delete on public.club_reactions for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists club_votes_read on public.club_votes;
create policy club_votes_read on public.club_votes for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_votes_write on public.club_votes;
create policy club_votes_write on public.club_votes for insert to authenticated
  with check (user_id = auth.uid() and public.club_is_member(club_id)
              and exists (select 1 from public.club_posts p
                          where p.id = post_id and p.club_id = club_votes.club_id
                            and p.kind = 'poll'
                            and choice < jsonb_array_length(p.poll->'options')
                            and (p.poll->>'closes_at' is null
                                 or (p.poll->>'closes_at')::timestamptz > now())));
drop policy if exists club_votes_delete on public.club_votes;
create policy club_votes_delete on public.club_votes for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists club_events_read on public.club_events;
create policy club_events_read on public.club_events for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_events_write on public.club_events;
create policy club_events_write on public.club_events for insert to authenticated
  with check (created_by = auth.uid() and public.club_is_leader(club_id));
drop policy if exists club_events_delete on public.club_events;
create policy club_events_delete on public.club_events for delete to authenticated
  using (public.club_is_leader(club_id) or public.club_is_admin());

drop policy if exists club_rsvps_read on public.club_event_rsvps;
create policy club_rsvps_read on public.club_event_rsvps for select to authenticated
  using (public.club_is_member(club_id) or public.club_is_admin());
drop policy if exists club_rsvps_write on public.club_event_rsvps;
create policy club_rsvps_write on public.club_event_rsvps for insert to authenticated
  with check (user_id = auth.uid() and public.club_is_member(club_id)
              and exists (select 1 from public.club_events e
                          where e.id = event_id and e.club_id = club_event_rsvps.club_id));
drop policy if exists club_rsvps_delete on public.club_event_rsvps;
create policy club_rsvps_delete on public.club_event_rsvps for delete to authenticated
  using (user_id = auth.uid());

-- ── 표 권한 — 익명(anon)에게는 아무것도 주지 않는다 ─────────────

revoke all on public.clubs, public.club_applications, public.club_members, public.club_decks,
  public.club_posts, public.club_comments, public.club_reactions, public.club_votes,
  public.club_events, public.club_event_rsvps from anon, authenticated;

grant select on public.clubs, public.club_applications, public.club_members, public.club_decks
  to authenticated;
grant select, insert, delete on public.club_posts, public.club_comments, public.club_reactions,
  public.club_votes, public.club_events, public.club_event_rsvps to authenticated;

-- ── 작업 함수 (RPC) ────────────────────────────────────────────

create or replace function public.club_gen_invite() returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..8 loop
      c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1);
      if i = 4 then c := c || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.clubs where invite_code = c);
  end loop;
  return c;
end $$;

create or replace function public.club_need_login() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요해요'; end if;
  return auth.uid();
end $$;

/* ① 클럽장 신청 — 인증 코드를 받는다. 열려 있는 신청이 있으면 그 줄을 고쳐 쓰고 코드는 그대로 */
create or replace function public.club_start_application(p_club_name text, p_nickname text)
returns public.club_applications
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  r public.club_applications;
begin
  if exists (select 1 from public.club_members where user_id = me and status = 'active') then
    raise exception '이미 클럽에 소속돼 있어요';
  end if;
  if exists (select 1 from public.clubs where lower(btrim(name)) = lower(btrim(p_club_name))) then
    raise exception '같은 이름의 클럽이 이미 등록돼 있어요';
  end if;
  select * into r from public.club_applications where user_id = me and status in ('draft','pending');
  if found then
    update public.club_applications
       set club_name = btrim(p_club_name), nickname = btrim(p_nickname), status = 'draft'
     where id = r.id returning * into r;
  else
    insert into public.club_applications (user_id, club_name, nickname, code)
    values (me, btrim(p_club_name), btrim(p_nickname),
            'DM-' || lpad((floor(random() * 10000))::int::text, 4, '0'))
    returning * into r;
  end if;
  return r;
end $$;

/* ② 캡처를 올린 뒤 제출 — 경로는 반드시 내 폴더(club-verify/<내 id>/…) */
create or replace function public.club_submit_application(p_id uuid, p_shots text[])
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
    raise exception '캡처를 1~2장 올려 주세요';
  end if;
  foreach s in array p_shots loop
    if split_part(s, '/', 1) <> me::text then raise exception '캡처 경로가 올바르지 않아요'; end if;
  end loop;
  update public.club_applications
     set shots = p_shots, status = 'pending', submitted_at = now()
   where id = p_id returning * into r;
  return r;
end $$;

create or replace function public.club_cancel_application(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  update public.club_applications set status = 'cancelled'
   where id = p_id and user_id = me and status in ('draft','pending');
end $$;

/* ③ 관리자 심사 — 승인하면 클럽이 열리고 신청자가 클럽장이 된다 */
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
  if not p_approve then
    update public.club_applications
       set status = 'rejected', reason = coalesce(p_reason, ''), reviewed_at = now(), reviewed_by = me
     where id = p_id;
    return null;
  end if;
  if exists (select 1 from public.club_members where user_id = r.user_id and status = 'active') then
    raise exception '신청자가 이미 다른 클럽에 소속돼 있어요';
  end if;
  if exists (select 1 from public.clubs where lower(btrim(name)) = lower(btrim(r.club_name))) then
    raise exception '같은 이름의 클럽이 이미 있어요';
  end if;
  /* 다른 클럽에 넣어 둔 가입 신청은 거둔다 */
  delete from public.club_members where user_id = r.user_id and status = 'pending';
  insert into public.clubs (name, leader_id, invite_code)
  values (btrim(r.club_name), r.user_id, public.club_gen_invite()) returning id into cid;
  insert into public.club_members (club_id, user_id, nickname, role, status, joined_at)
  values (cid, r.user_id, r.nickname, 'leader', 'active', now());
  update public.club_applications
     set status = 'approved', club_id = cid, reason = coalesce(p_reason, ''),
         reviewed_at = now(), reviewed_by = me
   where id = p_id;
  return cid;
end $$;

/* 관리자가 30일 지난 캡처를 지운 뒤 표시해 둔다 (파일 삭제는 화면이 저장소에 직접) */
create or replace function public.club_mark_shots_purged(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not public.club_is_admin() then raise exception '관리자만 할 수 있어요'; end if;
  update public.club_applications set shots_purged = true, shots = '{}' where id = p_id;
end $$;

/* 초대 코드로 클럽 찾기 — 회원이 아니어도 이름·인원은 보여야 신청할 수 있다 */
create or replace function public.club_lookup(p_code text)
returns table (id uuid, name text, intro text, members int, capacity int)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.intro,
         (select count(*)::int from public.club_members m where m.club_id = c.id and m.status = 'active'),
         c.capacity
    from public.clubs c
   where auth.uid() is not null and c.invite_code = upper(btrim(p_code))
$$;

create or replace function public.club_request_join(p_code text, p_nickname text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  c public.clubs;
begin
  if exists (select 1 from public.club_members where user_id = me) then
    raise exception '이미 클럽에 소속돼 있거나 가입 신청 중이에요';
  end if;
  if exists (select 1 from public.club_applications where user_id = me and status = 'pending') then
    raise exception '클럽장 인증 신청 중에는 가입할 수 없어요';
  end if;
  select * into c from public.clubs where invite_code = upper(btrim(p_code));
  if not found then raise exception '초대 코드를 찾지 못했어요'; end if;
  if (select count(*) from public.club_members where club_id = c.id and status = 'active') >= c.capacity then
    raise exception '클럽 정원이 찼어요';
  end if;
  insert into public.club_members (club_id, user_id, nickname)
  values (c.id, me, btrim(p_nickname));
  return c.id;
end $$;

create or replace function public.club_cancel_join() returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  delete from public.club_members where user_id = me and status = 'pending';
end $$;

/* 클럽장 — 가입 신청 승인·거절 */
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
    select capacity into cap from public.clubs where id = p_club;
    if (select count(*) from public.club_members where club_id = p_club and status = 'active') >= cap then
      raise exception '클럽 정원이 찼어요';
    end if;
    update public.club_members set status = 'active', joined_at = now()
     where club_id = p_club and user_id = p_user;
  else
    delete from public.club_members where club_id = p_club and user_id = p_user;
  end if;
end $$;

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
    delete from public.clubs where id = m.club_id;
    return;
  end if;
  delete from public.club_decks where user_id = me;
  delete from public.club_members where user_id = me;
end $$;

create or replace function public.club_transfer(p_club uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  if not public.club_is_leader(p_club) then raise exception '클럽장만 할 수 있어요'; end if;
  if not exists (select 1 from public.club_members
                 where club_id = p_club and user_id = p_user and status = 'active') then
    raise exception '활동 중인 클럽원에게만 넘길 수 있어요';
  end if;
  update public.club_members set role = 'member' where club_id = p_club and user_id = me;
  update public.club_members set role = 'leader' where club_id = p_club and user_id = p_user;
  update public.clubs set leader_id = p_user where id = p_club;
end $$;

create or replace function public.club_regen_invite(p_club uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  perform public.club_need_login();
  if not public.club_is_leader(p_club) then raise exception '클럽장만 할 수 있어요'; end if;
  c := public.club_gen_invite();
  update public.clubs set invite_code = c where id = p_club;
  return c;
end $$;

create or replace function public.club_update_intro(p_club uuid, p_intro text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not public.club_is_leader(p_club) then raise exception '클럽장만 할 수 있어요'; end if;
  update public.clubs set intro = left(coalesce(p_intro, ''), 200) where id = p_club;
end $$;

create or replace function public.club_set_nickname(p_nickname text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  update public.club_members set nickname = btrim(p_nickname) where user_id = me;
end $$;

/* 덱 공개 — 공개할 덱을 고른다. null 이면 공개를 끄고 요약본도 지운다 */
create or replace function public.club_set_share(p_deck_id text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare me uuid := public.club_need_login();
begin
  update public.club_members set share_deck_id = nullif(p_deck_id, '')
   where user_id = me and status = 'active';
  if nullif(p_deck_id, '') is null then
    delete from public.club_decks where user_id = me;
  end if;
end $$;

/* 덱 요약본 올리기. 주간 변화는 7일마다 기준점을 옮겨 센다 */
create or replace function public.club_publish_deck(p_deck jsonb, p_total numeric, p_set_point int, p_filled int)
returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  me uuid := public.club_need_login();
  m public.club_members;
  old public.club_decks;
begin
  select * into m from public.club_members where user_id = me and status = 'active';
  if not found or m.share_deck_id is null then raise exception '덱 공개가 꺼져 있어요'; end if;
  if pg_column_size(p_deck) > 20000 then raise exception '덱 정보가 너무 커요'; end if;
  select * into old from public.club_decks where user_id = me;
  if not found then
    insert into public.club_decks (user_id, club_id, deck, total, set_point, filled, week_base, week_base_at)
    values (me, m.club_id, p_deck, p_total, p_set_point, p_filled, p_total, now());
  else
    update public.club_decks set
      club_id = m.club_id, deck = p_deck, total = p_total, set_point = p_set_point,
      filled = p_filled, saved_at = now(),
      week_base    = case when old.week_base_at is null or old.week_base_at < now() - interval '7 days'
                          or old.club_id <> m.club_id then old.total else old.week_base end,
      week_base_at = case when old.week_base_at is null or old.week_base_at < now() - interval '7 days'
                          or old.club_id <> m.club_id then now() else old.week_base_at end
    where user_id = me;
  end if;
end $$;

create or replace function public.club_pin(p_post uuid, p_pinned boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare cid uuid;
begin
  perform public.club_need_login();
  select club_id into cid from public.club_posts where id = p_post;
  if cid is null or not public.club_is_leader(cid) then raise exception '클럽장만 고정할 수 있어요'; end if;
  update public.club_posts set pinned = p_pinned where id = p_post;
end $$;

/* 클럽 닫기 — 클럽장 또는 관리자 */
create or replace function public.club_disband(p_club uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.club_need_login();
  if not (public.club_is_leader(p_club) or public.club_is_admin()) then
    raise exception '클럽장만 할 수 있어요';
  end if;
  delete from public.clubs where id = p_club;
end $$;

/* 함수 실행 권한 — 로그인 사용자만 */
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'club\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- ── 저장소 ─────────────────────────────────────────────────────
-- club-verify/<신청자 id>/<신청 id>-<n>.jpg   — 본인과 관리자만
-- club-media/<클럽 id>/<올린 사람 id>/<파일>   — 그 클럽 회원만

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-verify', 'club-verify', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-media', 'club-media', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists club_verify_insert on storage.objects;
create policy club_verify_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-verify' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists club_verify_read on storage.objects;
create policy club_verify_read on storage.objects for select to authenticated
  using (bucket_id = 'club-verify'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.club_is_admin()));
drop policy if exists club_verify_delete on storage.objects;
create policy club_verify_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-verify'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.club_is_admin()));

drop policy if exists club_media_insert on storage.objects;
create policy club_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'club-media'
              and public.club_member_of_path((storage.foldername(name))[1])
              and (storage.foldername(name))[2] = auth.uid()::text);
drop policy if exists club_media_read on storage.objects;
create policy club_media_read on storage.objects for select to authenticated
  using (bucket_id = 'club-media'
         and (public.club_member_of_path((storage.foldername(name))[1]) or public.club_is_admin()));
drop policy if exists club_media_delete on storage.objects;
create policy club_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'club-media'
         and ((storage.foldername(name))[2] = auth.uid()::text
              or public.club_leader_of_path((storage.foldername(name))[1])
              or public.club_is_admin()));
