/* 클럽 라운지 — 서버와 주고받는 것만 모았다 (표·정책·함수는 supabase/club_lounge.sql).

   원칙
   - 회원·클럽을 바꾸는 일은 전부 RPC(club_*) 로만 한다. 표에 직접 쓰지 않는다
   - 글·댓글·반응·투표·일정 참여는 표에 직접 쓴다 (정책이 작성자·클럽을 확인한다)
   - 원본 덱 저장(user_settings)은 이 파일이 절대 건드리지 않는다.
     클럽장이 보는 덱은 클럽원이 따로 올린 요약본(club_decks)이다 */
import { supabase } from './supabase.js';

function sb() {
  if (!supabase) throw new Error('서버에 연결돼 있지 않아요');
  return supabase;
}
/* Postgres 가 던진 문구를 보여 준다 — 함수들은 한국어로 던지게 만들어 두었다.
   표 정책(RLS) · 중복 · 통신 오류는 영어 원문이 그대로 나오던 것을 한국어로 바꾼다 (2026-10-18) */
function fail(error) {
  var m = (error && (error.message || error.error_description)) || String(error || '알 수 없는 오류');
  var code = error && error.code;
  if (/JWT|not authenticated/i.test(m)) m = '로그인이 풀렸어요. 다시 로그인해 주세요.';
  else if (code === '42501' || /row-level security|permission denied/i.test(m)) m = '할 수 없는 일이에요. 클럽에서 나갔거나 글이 지워졌을 수 있어요 — 새로 보기를 눌러 주세요.';
  else if (code === '23505' || /duplicate key|unique constraint/i.test(m)) m = '이미 처리된 일이에요. 새로 보기를 눌러 주세요.';
  else if (code === '23503' || /foreign key/i.test(m)) m = '대상이 이미 지워졌어요. 새로 보기를 눌러 주세요.';
  else if (code === '23514' || /check constraint/i.test(m)) m = '넣은 값이 허용 범위를 벗어났어요.';
  else if (code === '22007' || code === '22P02' || /invalid input syntax/i.test(m)) m = '글에 들어 있는 값의 형식이 맞지 않아 처리하지 못했어요.';
  else if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) m = '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
  /* 그래도 한글이 하나도 없는 원문이면 짧은 한국어 안내로 (원문은 오류 번호만 덧붙인다) */
  else if (!/[가-힣]/.test(m)) m = '처리하지 못했어요. 새로 보기 뒤 다시 해 주세요.' + (code ? ' (오류 ' + code + ')' : '');
  var e = new Error(m); e.raw = error; return e;
}
async function rpc(name, args) {
  var r = await sb().rpc(name, args || {});
  if (r.error) throw fail(r.error);
  return r.data;
}
async function rows(q) {
  var r = await q;
  if (r.error) throw fail(r.error);
  return r.data || [];
}
async function myId() {
  var r = await sb().auth.getSession();
  var u = r && r.data && r.data.session && r.data.session.user;
  if (!u) throw new Error('로그인이 필요해요');
  return u.id;
}

/* ── 내 상태 ───────────────────────────────────────────── */

/* 회원 줄(있으면) · 그 클럽 · 가장 최근 클럽장 신청 */
export async function loadMe() {
  var me = await myId();
  var mem = (await rows(sb().from('club_members').select('*').eq('user_id', me)))[0] || null;
  var club = null;
  if (mem) club = (await rows(sb().from('clubs').select('*').eq('id', mem.club_id)))[0] || null;
  var app = (await rows(sb().from('club_applications').select('*').eq('user_id', me)
    .order('created_at', { ascending: false }).limit(1)))[0] || null;
  shareCache = { uid: me, deckId: mem && mem.status === 'active' ? mem.share_deck_id : null };
  return { uid: me, member: mem, club: club, app: app };
}

/* ── 클럽장 인증 ──────────────────────────────────────── */

export function startApplication(clubName, nickname) {
  return rpc('club_start_application', { p_club_name: clubName, p_nickname: nickname });
}
export function cancelApplication(id) { return rpc('club_cancel_application', { p_id: id }); }

/* 캡처를 줄여서 올린다 — 글자가 읽히도록 긴 변 2000px, 품질 높게 */
export async function uploadVerifyShot(appId, file, n) {
  var me = await myId();
  var blob = await shrinkImage(file, 2000, 0.9);
  var path = me + '/' + appId + '-' + n + '-' + Date.now() + '.jpg';
  var r = await sb().storage.from('club-verify').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw fail(r.error);
  return path;
}
/* checks — 올린 캡처의 간단 점검 결과 (shot-check.js). 관리자 심사 카드에 참고로 뜬다 */
export function submitApplication(id, paths, checks) {
  return rpc('club_submit_application', { p_id: id, p_shots: paths, p_checks: checks || null });
}

/* 관리자 — "대기" 는 새 클럽 신청만. 되찾기·재인증은 분쟁 탭(adminDisputes)이 따로 모은다 */
export async function adminApplications(status) {
  var q = sb().from('club_applications').select('*').eq('status', status);
  if (status === 'pending') q = q.eq('kind', 'new');
  return rows(q.order(status === 'pending' ? 'submitted_at' : 'reviewed_at', { ascending: status === 'pending' }).limit(100));
}

/* 분쟁 — 되찾기 신청(claim)이 들어왔거나 재인증(reverify)을 걸어 둔 클럽마다 한 묶음.
   돌려주는 것: [{ clubId, club(없으면 null — 이미 닫힘), leaderNick, members, original(처음 인증 신청),
                  reverify(진행 중인 재인증), claims: [되찾기 신청…] }] */
export async function adminDisputes() {
  var open = await rows(sb().from('club_applications').select('*').in('kind', ['claim', 'reverify'])
    .in('status', ['draft', 'pending']).order('created_at', { ascending: true }));
  /* 되찾기는 캡처까지 낸 것만 (코드만 받아 둔 것은 아직 판정할 게 없다) */
  open = open.filter(function (a) { return a.kind === 'reverify' || a.status === 'pending'; });
  var ids = []; open.forEach(function (a) { if (a.target_club_id && ids.indexOf(a.target_club_id) < 0) ids.push(a.target_club_id); });
  var clubs = ids.length ? await rows(sb().from('clubs').select('*').in('id', ids)) : [];
  var mems = ids.length ? await rows(sb().from('club_members').select('club_id,user_id,nickname,role,status').in('club_id', ids)) : [];
  var orig = ids.length ? await rows(sb().from('club_applications').select('*').eq('kind', 'new').eq('status', 'approved').in('club_id', ids)) : [];
  return ids.map(function (id) {
    var c = clubs.find(function (x) { return x.id === id; }) || null;
    var ms = mems.filter(function (m) { return m.club_id === id; });
    var lead = c ? ms.find(function (m) { return m.user_id === c.leader_id; }) : null;
    return {
      clubId: id, club: c, leaderNick: lead ? lead.nickname : '',
      members: ms.filter(function (m) { return m.status === 'active'; }).length,
      original: orig.find(function (a) { return a.club_id === id; }) || null,
      reverify: open.find(function (a) { return a.kind === 'reverify' && a.target_club_id === id; }) || null,
      claims: open.filter(function (a) { return a.kind === 'claim' && a.target_club_id === id; }),
      name: c ? c.name : ((open.find(function (a) { return a.target_club_id === id; }) || {}).club_name || '')
    };
  });
}
export function requestReverify(clubId, hours) { return rpc('club_request_reverify', { p_club: clubId, p_hours: hours || 48 }); }
/* 사진은 처리가 끝난 뒤에 지운다 — 예전에는 먼저 지워서, 처리가 실패하면 클럽은 남고 사진만 사라졌다.
   클럽이 없어진 뒤에도 관리자는 그 폴더를 지울 수 있다 (club_media_delete 정책) */
export async function resolveDispute(claimId, winner, ban, reason, clubId) {
  var r = await rpc('club_resolve_dispute', { p_claim: claimId, p_winner: winner, p_ban: !!ban, p_reason: reason || '' });
  if (winner === 'claimant' && clubId) await purgeClubMedia(clubId);
  return r;
}
export async function settleReverify(clubId, okay, ban, reason) {
  var r = await rpc('club_settle_reverify', { p_club: clubId, p_ok: !!okay, p_ban: !!ban, p_reason: reason || '' });
  if (!okay) await purgeClubMedia(clubId);
  return r;
}
export async function adminCloseClub(clubId, ban, reason) {
  var r = await rpc('club_admin_close', { p_club: clubId, p_ban: !!ban, p_reason: reason || '' });
  await purgeClubMedia(clubId);
  return r;
}
/* 클럽을 없애기 전에 그 클럽의 글 사진을 지운다 (club-media/<클럽>/<사람>/<파일>). 실패해도 클럽 닫기는 계속한다 */
async function purgeClubMedia(clubId) {
  try {
    var st = sb().storage.from('club-media');
    var top = await st.list(clubId, { limit: 1000 });
    if (top.error) return;
    var all = [];
    for (var i = 0; i < (top.data || []).length; i++) {
      var d = top.data[i];
      var sub = await st.list(clubId + '/' + d.name, { limit: 1000 });
      (sub.data || []).forEach(function (f) { all.push(clubId + '/' + d.name + '/' + f.name); });
    }
    if (all.length) await st.remove(all);
  } catch (e) { /* 지우지 못한 사진은 남는다 — 클럽이 없어지면 아무도 못 읽는다 */ }
}

/* 신고 */
export async function reportClub(clubId, kind, reason, postId) {
  var me = await myId();
  var r = await sb().from('club_reports').insert({ club_id: clubId, reporter_id: me, kind: kind, reason: reason || '', post_id: postId || null });
  if (r.error) {
    if (/duplicate|unique/i.test(r.error.message || '')) throw new Error('이미 신고했어요. 관리자가 확인하고 있어요');
    throw fail(r.error);
  }
}
/* 관리자 — 처리 안 된 신고. 클럽 이름·신고한 사람·글 내용을 붙여서 */
export async function adminReports() {
  var list = await rows(sb().from('club_reports').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(200));
  var cids = []; list.forEach(function (r) { if (cids.indexOf(r.club_id) < 0) cids.push(r.club_id); });
  var clubs = cids.length ? await rows(sb().from('clubs').select('id,name,leader_id').in('id', cids)) : [];
  var mems = cids.length ? await rows(sb().from('club_members').select('club_id,user_id,nickname').in('club_id', cids)) : [];
  var pids = list.map(function (r) { return r.post_id; }).filter(Boolean);
  var posts = pids.length ? await rows(sb().from('club_posts').select('*').in('id', pids)) : [];
  var nick = function (c, u) { var m = mems.find(function (x) { return x.club_id === c && x.user_id === u; }); return m ? m.nickname : '떠난 회원'; };
  return list.map(function (r) {
    var c = clubs.find(function (x) { return x.id === r.club_id; }) || null;
    return Object.assign({}, r, { club: c, reporterNick: nick(r.club_id, r.reporter_id),
      leaderNick: c ? nick(c.id, c.leader_id) : '', post: posts.find(function (p) { return p.id === r.post_id; }) || null });
  });
}
export function closeReport(id, note) { return rpc('club_close_report', { p_id: id, p_note: note || '' }); }
/* 관리자 — 클럽장 신청 제한 목록. 그 사람이 마지막으로 낸 신청의 닉네임·클럽 이름을 붙인다 */
export async function adminBans() {
  var list = await rows(sb().from('club_bans').select('*').order('created_at', { ascending: false }));
  var uids = list.map(function (b) { return b.user_id; });
  var apps = uids.length ? await rows(sb().from('club_applications').select('user_id,nickname,club_name,created_at').in('user_id', uids).order('created_at', { ascending: false })) : [];
  return list.map(function (b) { var a = apps.find(function (x) { return x.user_id === b.user_id; }); return Object.assign({}, b, { nickname: a ? a.nickname : '', clubName: a ? a.club_name : '' }); });
}
export function unban(userId) { return rpc('club_unban', { p_user: userId }); }
export async function adminClubNames() {
  return rows(sb().from('clubs').select('id,name'));
}
/* 관리자 — 클럽 현황. 모든 클럽 · 클럽원 · 최근 활동을 한 번에 읽는다 (관리자는 정책상 모든 클럽을 읽을 수 있고,
   관리자가 아니면 서버가 자기 클럽 것만 돌려준다 — 화면을 고쳐 열어도 남의 클럽은 안 보인다).
   글은 최근 30일 · 댓글은 최근 7일 것만 센다. 서버가 한 번에 1000줄까지만 주므로 그만큼 차면 capped 로 알린다 */
export async function adminOverview() {
  var t = Date.now(), DAY = 864e5;
  var since = function (ms) { return new Date(t - ms).toISOString(); };
  var r = await Promise.all([
    rows(sb().from('clubs').select('id,name,leader_id,invite_code,intro,capacity,created_at').order('created_at', { ascending: true }).limit(1000)),
    rows(sb().from('club_members').select('club_id,user_id,nickname,role,status,share_deck_id,created_at,joined_at').limit(1000)),
    rows(sb().from('club_posts').select('club_id,created_at').gte('created_at', since(30 * DAY)).order('created_at', { ascending: false }).limit(1000)),
    rows(sb().from('club_comments').select('club_id,created_at').gte('created_at', since(7 * DAY)).limit(1000)),
    rows(sb().from('club_decks').select('club_id,user_id,total,saved_at').limit(1000)),
    rows(sb().from('club_events').select('club_id,starts_at').gte('starts_at', since(6 * 3600e3)).limit(1000)),
    rows(sb().from('club_reports').select('club_id').eq('status', 'open').limit(1000)),
    rows(sb().from('club_applications').select('kind,status,target_club_id').in('kind', ['new', 'claim', 'reverify']).in('status', ['draft', 'pending']).limit(1000))
  ]);
  return { clubs: r[0], members: r[1], posts: r[2], comments: r[3], decks: r[4], events: r[5], reports: r[6], apps: r[7], at: t,
    capped: r[1].length >= 1000 || r[2].length >= 1000 || r[3].length >= 1000 };
}
export function reviewApplication(id, approve, reason) {
  return rpc('club_review_application', { p_id: id, p_approve: !!approve, p_reason: reason || '' });
}
export async function verifyShotUrls(paths) {
  if (!paths || !paths.length) return [];
  var r = await sb().storage.from('club-verify').createSignedUrls(paths, 3600);
  if (r.error) throw fail(r.error);
  return (r.data || []).map(function (x) { return x.signedUrl || ''; });
}
/* 승인·반려 30일이 지난 캡처를 지운다 — 관리자가 심사 화면을 열 때 조용히 돈다 */
export async function purgeOldShots() {
  var cut = new Date(Date.now() - 30 * 864e5).toISOString();
  var old = await rows(sb().from('club_applications').select('id,shots')
    .in('status', ['approved', 'rejected', 'cancelled']).eq('shots_purged', false).lt('created_at', cut).limit(50));
  for (var i = 0; i < old.length; i++) {
    var a = old[i];
    var stale = (a.shots || []);
    if (stale.length) {
      var r = await sb().storage.from('club-verify').remove(stale);
      if (r.error) continue;
    }
    await rpc('club_mark_shots_purged', { p_id: a.id });
  }
  return old.length;
}

/* ── 가입 ─────────────────────────────────────────────── */

export async function lookupClub(code) {
  var d = await rpc('club_lookup', { p_code: code });
  return (d && d[0]) || null;
}
export function requestJoin(code, nickname) { return rpc('club_request_join', { p_code: code, p_nickname: nickname }); }
export function cancelJoin() { return rpc('club_cancel_join'); }

/* ── 클럽 운영 ────────────────────────────────────────── */

export async function loadMembers(clubId) {
  return rows(sb().from('club_members').select('*').eq('club_id', clubId).order('joined_at', { ascending: true }));
}
export function decideMember(clubId, userId, approve) { return rpc('club_decide', { p_club: clubId, p_user: userId, p_approve: !!approve }); }
export function kickMember(clubId, userId) { return rpc('club_kick', { p_club: clubId, p_user: userId }); }
export function leaveClub() { return rpc('club_leave'); }
export function transferLeader(clubId, userId) { return rpc('club_transfer', { p_club: clubId, p_user: userId }); }
export function regenInvite(clubId) { return rpc('club_regen_invite', { p_club: clubId }); }
export function updateIntro(clubId, intro) { return rpc('club_update_intro', { p_club: clubId, p_intro: intro }); }
export function setNickname(nick) { return rpc('club_set_nickname', { p_nickname: nick }); }
export function disbandClub(clubId) { return rpc('club_disband', { p_club: clubId }); }

/* ── 덱 공개 ──────────────────────────────────────────── */

/* 공개할 덱 id 를 기억해 둔다 — 저장할 때마다 서버에 물어보지 않으려고 */
var shareCache = { uid: null, deckId: null };
var lastSent = { key: '', at: 0 };

export async function setShare(deckId) {
  await rpc('club_set_share', { p_deck_id: deckId || null });
  shareCache.deckId = deckId || null;
  lastSent = { key: '', at: 0 };
}
export async function loadClubDecks(clubId) {
  return rows(sb().from('club_decks').select('*').eq('club_id', clubId));
}
export async function loadMyDeck() {
  var me = await myId();
  return (await rows(sb().from('club_decks').select('*').eq('user_id', me)))[0] || null;
}

/* 덱이 바뀌었을 때 앱이 부른다. 공개 중인 덱이 지금 열린 덱이면 요약본을 올린다.
   summaryFn 은 실제로 올릴 때만 부른다 (점수 계산이 공짜가 아니다).
   같은 내용이면 다시 보내지 않는다 */
export async function autoPublish(userId, curDeckId, summaryFn, force) {
  if (!supabase || !userId || !curDeckId) return false;
  if (shareCache.uid !== userId) {
    /* 앱을 열 때 한 번만 묻는다 — 클럽이 없는 사람에게는 이 한 번이 전부다 */
    var r = await sb().from('club_members').select('status,share_deck_id').eq('user_id', userId);
    if (r.error) return false;
    var m = (r.data || [])[0];
    shareCache = { uid: userId, deckId: m && m.status === 'active' ? m.share_deck_id : null };
  }
  if (!shareCache.deckId || shareCache.deckId !== curDeckId) return false;
  var s = summaryFn();
  if (!s) return false;
  var key = JSON.stringify([s.deck, s.total, s.setPoint, s.filled]);
  if (!force && key === lastSent.key) return false;
  await rpc('club_publish_deck', { p_deck: s.deck, p_total: s.total, p_set_point: s.setPoint, p_filled: s.filled });
  lastSent = { key: key, at: Date.now() };
  return true;
}
export function forgetShareCache() { shareCache = { uid: null, deckId: null }; lastSent = { key: '', at: 0 }; }

/* ── 라운지 글 ────────────────────────────────────────── */

var FEED_PAGE = 20;

/* 고정 글 + 최신 글 한 쪽. before 를 주면 그보다 오래된 글을 더.
   kind(말머리)를 주면 서버에서 거르고, 그때는 고정 글도 목록에 섞는다 (고정된 투표도 '투표'에서 보이게).
   고정 글은 20개까지 읽는다 — 예전에는 5개만 읽어 6번째 고정 글부터 아무 데도 안 보였다 (화면이 3개 넘으면 접는다) */
export async function loadFeed(clubId, before, kind) {
  var q = sb().from('club_posts').select('*').eq('club_id', clubId);
  q = kind ? q.eq('kind', kind) : q.eq('pinned', false);
  q = q.order('created_at', { ascending: false }).limit(FEED_PAGE);
  if (before) q = q.lt('created_at', before);
  var list = await rows(q);
  var pinned = before || kind ? [] : await rows(sb().from('club_posts').select('*').eq('club_id', clubId).eq('pinned', true)
    .order('created_at', { ascending: false }).limit(20));
  var all = pinned.concat(list);
  var extra = await postExtras(all.map(function (p) { return p.id; }));
  return { pinned: pinned, posts: list, more: list.length === FEED_PAGE, extra: extra };
}
export async function loadPost(postId) {
  var p = (await rows(sb().from('club_posts').select('*').eq('id', postId)))[0] || null;
  if (!p) return null;
  var extra = await postExtras([p.id]);
  return { post: p, extra: extra };
}
/* 글마다 댓글 수 · 반응 · 투표 */
/* 서버는 한 번에 1000줄까지만 돌려준다 — 글이 많으면 개수가 잘리지 않게 20개씩 나눠 한꺼번에 묻는다 */
async function postExtras(ids) {
  var out = { comments: {}, reactions: {}, votes: {} };
  if (!ids.length) return out;
  var parts = [];
  for (var i = 0; i < ids.length; i += 20) parts.push(ids.slice(i, i + 20));
  var res = await Promise.all(parts.map(function (part) {
    return Promise.all([
      rows(sb().from('club_comments').select('post_id').in('post_id', part)),
      rows(sb().from('club_reactions').select('post_id,user_id,emoji').in('post_id', part)),
      rows(sb().from('club_votes').select('post_id,user_id,choice').in('post_id', part))
    ]);
  }));
  res.forEach(function (r) {
    r[0].forEach(function (c) { out.comments[c.post_id] = (out.comments[c.post_id] || 0) + 1; });
    r[1].forEach(function (x) { (out.reactions[x.post_id] = out.reactions[x.post_id] || []).push(x); });
    r[2].forEach(function (v) { (out.votes[v.post_id] = out.votes[v.post_id] || []).push(v); });
  });
  return out;
}

export async function createPost(clubId, post, files) {
  var me = await myId();
  var images = [];
  for (var i = 0; i < (files || []).length && i < 4; i++) images.push(await uploadMedia(clubId, me, files[i]));
  var row = {
    club_id: clubId, author_id: me, kind: post.kind, title: post.title || '', body: post.body || '',
    deck: post.deck || null, poll: post.poll || null, images: images,
    allow_copy: post.allowCopy !== false, pinned: !!post.pinned
  };
  var r = await sb().from('club_posts').insert(row).select('*');
  if (r.error) {
    if (images.length) await sb().storage.from('club-media').remove(images);
    throw fail(r.error);
  }
  return r.data[0];
}
export async function deletePost(post) {
  var r = await sb().from('club_posts').delete().eq('id', post.id).select('id');
  if (r.error) throw fail(r.error);
  if (!r.data || !r.data.length) throw new Error('지우지 못했어요 (권한 없음)');
  if (post.images && post.images.length) await sb().storage.from('club-media').remove(post.images);
}
export function pinPost(postId, on) { return rpc('club_pin', { p_post: postId, p_pinned: !!on }); }

export async function loadComments(postId) {
  return rows(sb().from('club_comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }));
}
export async function addComment(post, body, suggestion) {
  var me = await myId();
  var r = await sb().from('club_comments').insert({
    post_id: post.id, club_id: post.club_id, author_id: me, body: body || '', suggestion: suggestion || null
  }).select('*');
  if (r.error) throw fail(r.error);
  return r.data[0];
}
export async function deleteComment(id) {
  var r = await sb().from('club_comments').delete().eq('id', id).select('id');
  if (r.error) throw fail(r.error);
  if (!r.data || !r.data.length) throw new Error('지우지 못했어요 (권한 없음)');
}

export async function setReaction(post, emoji, on) {
  var me = await myId();
  var r = on
    ? await sb().from('club_reactions').insert({ post_id: post.id, club_id: post.club_id, user_id: me, emoji: emoji })
    : await sb().from('club_reactions').delete().eq('post_id', post.id).eq('user_id', me).eq('emoji', emoji);
  if (r.error && !/duplicate/i.test(r.error.message || '')) throw fail(r.error);
}
/* 투표 바꾸기 = 지우고 다시 넣기. choice 가 null 이면 취소 */
export async function vote(post, choice) {
  var me = await myId();
  var d = await sb().from('club_votes').delete().eq('post_id', post.id).eq('user_id', me);
  if (d.error) throw fail(d.error);
  if (choice === null || choice === undefined) return;
  var r = await sb().from('club_votes').insert({ post_id: post.id, club_id: post.club_id, user_id: me, choice: choice });
  if (r.error) throw fail(r.error);
}

/* ── 일정 ─────────────────────────────────────────────── */

export async function loadEvents(clubId) {
  var since = new Date(Date.now() - 6 * 3600e3).toISOString();
  var ev = await rows(sb().from('club_events').select('*').eq('club_id', clubId).gte('starts_at', since)
    .order('starts_at', { ascending: true }).limit(10));
  var rs = ev.length ? await rows(sb().from('club_event_rsvps').select('event_id,user_id').in('event_id', ev.map(function (e) { return e.id; }))) : [];
  return { events: ev, rsvps: rs };
}
export async function createEvent(clubId, title, startsAt) {
  var me = await myId();
  var r = await sb().from('club_events').insert({ club_id: clubId, title: title, starts_at: startsAt, created_by: me });
  if (r.error) throw fail(r.error);
}
export async function deleteEvent(id) {
  var r = await sb().from('club_events').delete().eq('id', id);
  if (r.error) throw fail(r.error);
}
export async function setRsvp(ev, on) {
  var me = await myId();
  var r = on
    ? await sb().from('club_event_rsvps').insert({ event_id: ev.id, club_id: ev.club_id, user_id: me })
    : await sb().from('club_event_rsvps').delete().eq('event_id', ev.id).eq('user_id', me);
  if (r.error && !/duplicate/i.test(r.error.message || '')) throw fail(r.error);
}

/* ── 사진 ─────────────────────────────────────────────── */

async function uploadMedia(clubId, me, file) {
  var blob = await shrinkImage(file, 1600, 0.85);
  var path = clubId + '/' + me + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  var r = await sb().storage.from('club-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw fail(r.error);
  return path;
}
var mediaUrlCache = {};
export async function mediaUrls(paths) {
  var need = (paths || []).filter(function (p) { var c = mediaUrlCache[p]; return !c || c.exp < Date.now(); });
  if (need.length) {
    var r = await sb().storage.from('club-media').createSignedUrls(need, 3600);
    if (!r.error) (r.data || []).forEach(function (x, i) {
      if (x.signedUrl) mediaUrlCache[need[i]] = { url: x.signedUrl, exp: Date.now() + 50 * 60e3 };
    });
  }
  var out = {};
  (paths || []).forEach(function (p) { if (mediaUrlCache[p]) out[p] = mediaUrlCache[p].url; });
  return out;
}

/* 긴 변을 max 로 줄여 JPEG 로. 이미 작으면 크기만 유지하고 다시 담는다 (사진 속 위치 정보도 빠진다) */
function shrinkImage(file, max, quality) {
  return new Promise(function (resolve, reject) {
    if (!file || !/^image\//.test(file.type || '')) { reject(new Error('그림 파일만 올릴 수 있어요')); return; }
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      var x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function (b) { b ? resolve(b) : reject(new Error('그림을 줄이지 못했어요')); }, 'image/jpeg', quality);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('그림을 읽지 못했어요')); };
    img.src = url;
  });
}

/* ── 메뉴 알림 (클럽라운지 메뉴의 빨간 점) ───────────────── */

/* 클럽장: 내 클럽에 들어온 가입 신청 수 (관리 탭 숫자와 같다).
   관리자: 심사 화면의 대기 + 분쟁 + 신고 수 — 라운지 안 '인증 심사' 버튼 숫자와 같은 기준.
   줄 수만 센다 (분쟁만 클럽을 가리려고 몇 칸 읽는다). 실패해도 0 으로 — 메뉴가 깨지면 안 된다 */
export async function loadAlerts(isAdmin) {
  var out = { join: 0, review: 0, leader: false };
  if (!supabase) return out;
  var me = null;
  try { me = await myId(); } catch (e) { return out; }
  var count = async function (q) { var r = await q; if (r.error) throw fail(r.error); return r.count || 0; };
  var m = (await rows(sb().from('club_members').select('club_id,role,status').eq('user_id', me)))[0];
  if (m && m.role === 'leader' && m.status === 'active') {
    out.leader = true;
    out.join = await count(sb().from('club_members').select('user_id', { count: 'exact', head: true })
      .eq('club_id', m.club_id).eq('status', 'pending'));
  }
  if (isAdmin) {
    var r = await Promise.all([
      count(sb().from('club_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('kind', 'new')),
      rows(sb().from('club_applications').select('kind,status,target_club_id').in('kind', ['claim', 'reverify']).in('status', ['draft', 'pending'])),
      count(sb().from('club_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'))
    ]);
    /* 분쟁은 클럽마다 하나 — 되찾기는 캡처까지 낸 것만, 재인증은 요청 중인 것도 (adminDisputes 와 같은 기준) */
    var disputes = {};
    r[1].forEach(function (a) { if (a.target_club_id && (a.kind === 'reverify' || a.status === 'pending')) disputes[a.target_club_id] = 1; });
    out.review = r[0] + Object.keys(disputes).length + r[2];
  }
  return out;
}
