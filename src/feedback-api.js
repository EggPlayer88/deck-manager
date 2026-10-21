/* 고객센터(공지사항 · 업데이트 내역 · 건의사항 · 오류 제보) — 서버와 주고받는 것만 모았다 (표 · 정책 · 함수는 supabase/feedback_board.sql).

   원칙
   - 공개 글은 로그인하지 않아도 읽는다. 쓰기 · 공감은 구글 로그인한 사람만
   - 글쓴이 · 상태 · 답변 · 공감 수 · '운영자' 표시는 서버가 정한다 (화면이 보낸 값은 믿지 않는다)
   - 답변 · 상태 · 고정은 운영자 함수(feedback_admin_update)로만 바꾼다 */
import { supabase } from './supabase.js';

var PAGE = 20;
/* 읽는 칸 — 기기 정보(env)는 표에서 닫혀 있어 'select *' 가 안 된다. env 는 loadPost 가 feedback_post_env 로 따로 받는다 */
var COLS = 'id,author_id,nickname,by_admin,kind,title,body,images,secret,status,answer,answered_at,pinned,votes,created_at,edited_at';

function sb() {
  if (!supabase) throw new Error('서버에 연결돼 있지 않아요');
  return supabase;
}
/* Postgres 문구를 한국어로 — 함수들은 한국어로 던지게 만들어 두었다 (club-api 와 같은 규칙) */
function fail(error) {
  var m = (error && (error.message || error.error_description)) || String(error || '알 수 없는 오류');
  var code = error && error.code;
  if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(m)) m = '게시판을 준비하고 있어요. 조금 뒤에 다시 와 주세요.';
  else if (/JWT|not authenticated/i.test(m)) m = '로그인이 풀렸어요. 다시 로그인해 주세요.';
  else if (code === '42501' || /row-level security|permission denied/i.test(m)) m = '할 수 없는 일이에요. 새로 보기를 누른 뒤 다시 해 주세요.';
  else if (code === '23505' || /duplicate key|unique constraint/i.test(m)) m = '이미 처리됐어요.';
  else if (code === '23514' || /check constraint/i.test(m)) m = '넣은 내용이 너무 길거나 비어 있어요.';
  else if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) m = '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
  else if (!/[가-힣]/.test(m)) m = '처리하지 못했어요. 잠시 뒤 다시 해 주세요.' + (code ? ' (오류 ' + code + ')' : '');
  var e = new Error(m); e.raw = error; return e;
}
async function rows(q) {
  var r = await q;
  if (r.error) throw fail(r.error);
  return r.data || [];
}
/* 로그인 안 했으면 null (읽기는 그대로 된다) */
async function myId() {
  try {
    var r = await sb().auth.getSession();
    var u = r && r.data && r.data.session && r.data.session.user;
    return u ? u.id : null;
  } catch (e) { return null; }
}
async function myVotes(ids) {
  var me = await myId();
  if (!me || !ids.length) return {};
  var out = {};
  (await rows(sb().from('feedback_votes').select('post_id').in('post_id', ids))).forEach(function (v) { out[v.post_id] = 1; });
  return out;
}

/* 찾는 말 — 제목 · 내용에서 찾는다. 걸러 쓰는 문법(쉼표 · 괄호 · 따옴표 · 와일드카드)을 깨는 글자는 빼고 쓴다 */
function searchTerm(s) {
  return String(s || '').replace(/[,()*%\\:"'.]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/* 목록 — o: { kind: ''|'bug'|'idea'|'notice'|'update', kinds: [...], status, mine, q: 찾는 말, sort: 'new'|'votes', offset, limit }.
   고정 글은 그 종류의 첫 쪽 맨 위에 따로 둔다 (상태 · 내 글 · 찾기로 거를 때는 섞지 않는다) */
export async function loadPosts(o) {
  o = o || {};
  var me = await myId();
  var off = o.offset || 0;
  var size = o.limit || PAGE;
  var term = searchTerm(o.q);
  var plain = !o.status && !o.mine && !term;
  var q = sb().from('feedback_posts').select(COLS);
  if (o.kind) q = q.eq('kind', o.kind);
  else if (o.kinds && o.kinds.length) q = q.in('kind', o.kinds);
  if (o.status) q = q.eq('status', o.status);
  if (term) q = q.or('title.ilike.*' + term + '*,body.ilike.*' + term + '*');
  if (o.mine) { if (!me) return { pinned: [], posts: [], more: false, voted: {}, me: null }; q = q.eq('author_id', me); }
  /* 첫 쪽 목록은 고정 글을 따로 맨 위에 두므로 본문 목록에서는 뺀다 (홈의 '최근 n개'는 고정 글도 섞어 최신순) */
  if (plain && !o.limit) q = q.eq('pinned', false);
  q = o.sort === 'votes' ? q.order('votes', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at', { ascending: false });
  var list = await rows(q.range(off, off + size - 1));
  var pq = sb().from('feedback_posts').select(COLS).eq('pinned', true);
  if (o.kind) pq = pq.eq('kind', o.kind);
  var pinned = plain && !off && !o.limit ? await rows(pq.order('created_at', { ascending: false }).limit(10)) : [];
  var voted = await myVotes(pinned.concat(list).map(function (p) { return p.id; }));
  return { pinned: pinned, posts: list, more: list.length === size, voted: voted, me: me };
}
export async function loadPost(id) {
  var p = (await rows(sb().from('feedback_posts').select(COLS).eq('id', id)))[0] || null;
  if (!p) return null;
  var me = await myId();
  /* 기기 정보 — 쓴 사람 · 운영자에게만 서버가 돌려준다 (아니면 null). 실패해도 글은 보여 준다 */
  p.env = null;
  if (me) { try { var r = await sb().rpc('feedback_post_env', { p_id: id }); if (!r.error) p.env = r.data || null; } catch (e) { /* 무시 */ } }
  return { post: p, voted: !!(await myVotes([id]))[id], me: me };
}

/* 글쓰기 — 사진은 먼저 올리고(feedback-media/<내 id>/…), 글이 실패하면 올린 사진을 지운다 */
export async function createPost(post, files) {
  var me = await myId();
  if (!me) throw new Error('구글 계정으로 로그인해야 쓸 수 있어요');
  var images = [];
  try {
    for (var i = 0; i < (files || []).length && i < 2; i++) images.push(await uploadImage(me, files[i]));
    var r = await sb().from('feedback_posts').insert({
      nickname: post.nickname || '', kind: post.kind, title: post.title, body: post.body || '',
      images: images, secret: !!post.secret, env: post.env || null, pinned: !!post.pinned
    }).select(COLS);
    if (r.error) throw fail(r.error);
    return r.data[0];
  } catch (e) {
    if (images.length) { try { await sb().storage.from('feedback-media').remove(images); } catch (x) { /* 무시 */ } }
    throw e;
  }
}
export async function deletePost(post) {
  var r = await sb().from('feedback_posts').delete().eq('id', post.id).select('id');
  if (r.error) throw fail(r.error);
  if (!r.data || !r.data.length) throw new Error('지우지 못했어요 (권한 없음)');
  if (post.images && post.images.length) { try { await sb().storage.from('feedback-media').remove(post.images); } catch (e) { /* 무시 */ } }
}
export async function vote(post, on) {
  var me = await myId();
  if (!me) throw new Error('구글 계정으로 로그인해야 공감할 수 있어요');
  var r = on
    ? await sb().from('feedback_votes').insert({ post_id: post.id })
    : await sb().from('feedback_votes').delete().eq('post_id', post.id).eq('user_id', me);
  if (r.error && !/duplicate/i.test(r.error.message || '')) throw fail(r.error);
}
/* 글 고치기 — 제목 · 내용만. 쓴 사람은 내 글, 운영자는 공지 · 업데이트 내역 (서버 함수가 다시 확인한다) */
export async function editPost(id, title, body) {
  var r = await sb().rpc('feedback_edit_post', { p_id: id, p_title: title || '', p_body: body || '' });
  if (r.error) throw fail(r.error);
}
/* 운영자 — 상태 · 답변 · 고정 (null 이면 그대로) */
export async function adminUpdate(id, status, answer, pinned) {
  var r = await sb().rpc('feedback_admin_update', { p_id: id, p_status: status, p_answer: answer || '', p_pinned: pinned === undefined ? null : pinned });
  if (r.error) throw fail(r.error);
}

/* ── 사진 ─────────────────────────────────────────────── */

async function uploadImage(me, file) {
  var blob = await shrinkImage(file, 1600, 0.85);
  var path = me + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  var r = await sb().storage.from('feedback-media').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw fail(r.error);
  return path;
}
var urlCache = {};
export async function mediaUrls(paths) {
  var need = (paths || []).filter(function (p) { var c = urlCache[p]; return !c || c.exp < Date.now(); });
  if (need.length) {
    var r = await sb().storage.from('feedback-media').createSignedUrls(need, 3600);
    if (!r.error) (r.data || []).forEach(function (x, i) {
      if (x.signedUrl) urlCache[need[i]] = { url: x.signedUrl, exp: Date.now() + 50 * 60e3 };
    });
  }
  var out = {};
  (paths || []).forEach(function (p) { if (urlCache[p]) out[p] = urlCache[p].url; });
  return out;
}
/* 긴 변을 max 로 줄여 JPEG 로 (사진 속 위치 정보도 빠진다) */
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

/* ── 메뉴 알림 (오류 · 건의 메뉴의 빨간 점) ───────────────
   운영자: 아직 '접수' 상태인 오류 · 건의 수 (공지 · 업데이트 내역 빼고).
   글쓴이: 마지막으로 게시판을 본 뒤(seenAt) 내 글에 달린 답변 수.
   줄 수만 센다. 실패해도 0 — 메뉴가 깨지면 안 된다 */
export async function loadBoardAlerts(isAdmin, seenAt) {
  var out = { open: 0, answered: 0 };
  if (!supabase) return out;
  var me = await myId();
  if (!me) return out;
  var count = async function (q) { var r = await q; if (r.error) throw fail(r.error); return r.count || 0; };
  try {
    if (isAdmin) out.open = await count(sb().from('feedback_posts').select('id', { count: 'exact', head: true }).eq('status', 'open').in('kind', ['bug', 'idea']));
    if (seenAt) out.answered = await count(sb().from('feedback_posts').select('id', { count: 'exact', head: true })
      .eq('author_id', me).gt('answered_at', new Date(seenAt).toISOString()));
  } catch (e) { /* 표가 아직 없으면 0 */ }
  return out;
}
