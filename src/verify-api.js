/* 게임 계정 인증 · 덱 최신화 — 서버와 주고받는 것만 모았다 (표 · 정책 · 함수는 supabase/account_verify.sql).

   원칙
   - 신청 · 요청 · 심사는 전부 RPC(gv_* · dr_*) 로만 한다. 표에 직접 쓰지 않는다
   - 원본 덱 저장(user_settings)은 이 파일이 절대 건드리지 않는다.
     도착한 덱은 화면(App)이 '반영'을 누른 뒤 평소 저장 길(savePlayers · saveLineupMap · saveSdState)로 넣는다 */
import { supabase } from './supabase.js';
import { nextRefreshAt } from './verify-apply.js';
export { nextRefreshAt };
var BUCKET = 'game-verify';
/* 화면에 보일 줄 — 덱 내용(payload)은 크니 '살펴보기'를 누를 때만 따로 읽는다 */
var DR_COLS = 'id,user_id,nickname,team,target,deck_id,deck_label,memo,status,summary,reason,counted,requested_at,started_at,delivered_at,closed_at';

function sb() {
  if (!supabase) throw new Error('서버에 연결돼 있지 않아요');
  return supabase;
}
/* Postgres 가 던진 문구를 보여 준다 — 함수들은 한국어로 던진다. 표가 아직 없으면(SQL 실행 전) 준비 중으로 */
function fail(error) {
  var m = (error && (error.message || error.error_description)) || String(error || '알 수 없는 오류');
  var code = error && error.code;
  if (/game_verify_requests|game_accounts|deck_refresh|gv_submit|dr_request/.test(m) && /does not exist|not find|schema cache/i.test(m)) m = '아직 준비 중인 기능이에요. 조금 뒤에 다시 해 주세요.';
  else if (/JWT|not authenticated/i.test(m)) m = '로그인이 풀렸어요. 다시 로그인해 주세요.';
  else if (code === '42501' || /row-level security|permission denied/i.test(m)) m = '할 수 없는 일이에요. 새로 보기 뒤 다시 해 주세요.';
  else if (code === '23505' || /duplicate key|unique constraint/i.test(m)) m = '이미 처리된 일이에요. 새로 보기를 눌러 주세요.';
  else if (code === '23514' || /check constraint/i.test(m)) m = '넣은 값이 허용 범위를 벗어났어요.';
  else if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) m = '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
  else if (!/[가-힣]/.test(m)) m = '처리하지 못했어요. 잠시 뒤 다시 해 주세요.' + (code ? ' (오류 ' + code + ')' : '');
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
function asRow(x) { return Array.isArray(x) ? (x[0] || null) : (x || null); }


/* ── 내 상태 ───────────────────────────────────────────── */

/* 연결(있으면) · 가장 최근 인증 신청 · 최근 최신화 요청 10개 · 다음 가능 시각 */
export async function loadMine() {
  var me = await myId();
  var r = await Promise.all([
    rows(sb().from('game_accounts').select('*').eq('user_id', me)),
    rows(sb().from('game_verify_requests').select('id,nickname,team,status,reason,created_at,reviewed_at').eq('user_id', me)
      .order('created_at', { ascending: false }).limit(1)),
    rows(sb().from('deck_refresh').select(DR_COLS).eq('user_id', me).order('requested_at', { ascending: false }).limit(10))
  ]);
  return { uid: me, account: r[0][0] || null, request: r[1][0] || null, refresh: r[2], nextAt: nextRefreshAt(r[2]) };
}

/* 캡처를 줄여서 올린다 — 글자가 읽히도록 긴 변 2000px, 품질 높게 (사진 속 위치 정보 등은 빠진다) */
export async function uploadShot(file) {
  var me = await myId();
  var blob = await shrinkImage(file, 2000, 0.9);
  var path = me + '/' + Date.now() + '.jpg';
  var r = await sb().storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (r.error) throw fail(r.error);
  return path;
}
/* checks — 올린 원본의 간단 점검 결과 (shot-check.js). 관리자 심사 카드에 참고로 뜬다 */
export function submitVerify(nickname, team, path, checks) {
  return rpc('gv_submit', { p_nickname: nickname, p_team: team, p_shot: path, p_checks: checks || null }).then(asRow);
}
export function cancelVerify() { return rpc('gv_cancel'); }
export function unlinkAccount() { return rpc('gv_unlink'); }
/* 내 캡처 지우기 — 신청이 안 된 업로드를 치울 때 (실패해도 그만) */
export async function removeMyShot(path) {
  if (!path) return;
  try { await sb().storage.from(BUCKET).remove([path]); } catch (e) { /* 무시 */ }
}

export function requestRefresh(target, deckId, deckLabel, memo) {
  return rpc('dr_request', { p_target: target, p_deck_id: deckId || null, p_deck_label: deckLabel || '', p_memo: memo || '' }).then(asRow);
}
export function cancelRefresh(id) { return rpc('dr_cancel', { p_id: id }); }
/* 도착한 덱만 연다 — 이미 반영했거나 버린 덱이면 막는다 (같은 덱을 두 번 반영해 되돌리기 사본이 덮이지 않게) */
export async function loadPayload(id) {
  var r = await rows(sb().from('deck_refresh').select('id,payload,summary,status').eq('id', id));
  if (!r[0]) throw new Error('도착한 덱을 읽지 못했어요');
  if (r[0].status !== 'arrived') throw new Error('이미 반영했거나 버린 덱이에요 — 새로 보기를 눌러 주세요');
  if (!r[0].payload) throw new Error('도착한 덱을 읽지 못했어요');
  return r[0];
}
export function closeRefresh(id, applied, deckId) {
  return rpc('dr_close', { p_id: id, p_applied: !!applied, p_deck_id: deckId || null });
}

/* ── 관리자 ───────────────────────────────────────────── */

/* 심사 대기 — 같은 닉네임이 이미 다른 계정에 연결돼 있으면 conflict 로 붙인다 */
export async function adminPending() {
  var list = await rows(sb().from('game_verify_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(100));
  var accs = list.length ? await rows(sb().from('game_accounts').select('user_id,nickname,team,linked_at')) : [];
  var key = function (s) { return String(s || '').trim().toLowerCase(); };
  return list.map(function (a) {
    var c = accs.filter(function (x) { return key(x.nickname) === key(a.nickname) && x.user_id !== a.user_id; })[0] || null;
    var mine = accs.filter(function (x) { return x.user_id === a.user_id; })[0] || null;
    return Object.assign({}, a, { conflict: c, current: mine });
  });
}
export function reviewVerify(id, approve, reason, prev) {
  return rpc('gv_review', { p_id: id, p_approve: !!approve, p_reason: reason || '', p_prev: prev || null }).then(asRow);
}
export async function adminAccounts() {
  return rows(sb().from('game_accounts').select('*').order('linked_at', { ascending: false }).limit(500));
}
export function revokeAccount(userId, reason) { return rpc('gv_revoke', { p_user: userId, p_reason: reason || '' }); }
/* 최신화 대기열 — 기다림 · 수집 중 전부와 최근 2주의 도착 · 실패 */
export async function adminQueue() {
  var open = await rows(sb().from('deck_refresh').select(DR_COLS).in('status', ['requested', 'working']).order('requested_at', { ascending: true }).limit(200));
  var since = new Date(Date.now() - 14 * 864e5).toISOString();
  var done = await rows(sb().from('deck_refresh').select(DR_COLS).in('status', ['arrived', 'applied', 'discarded', 'failed']).gte('requested_at', since)
    .order('requested_at', { ascending: false }).limit(100));
  return { open: open, done: done };
}
export function failRefresh(id, reason) { return rpc('dr_fail', { p_id: id, p_reason: reason || '', p_count: false }); }
export async function shotUrls(paths) {
  var ps = (paths || []).filter(Boolean);
  if (!ps.length) return {};
  var r = await sb().storage.from(BUCKET).createSignedUrls(ps, 3600);
  if (r.error) throw fail(r.error);
  var out = {}; (r.data || []).forEach(function (x, i) { if (x.signedUrl) out[ps[i]] = x.signedUrl; });
  return out;
}
/* 심사 30일이 지난 캡처를 지운다 — 관리자가 심사 화면을 열 때 조용히 돈다 */
export async function purgeOldShots() {
  var cut = new Date(Date.now() - 30 * 864e5).toISOString();
  var old = await rows(sb().from('game_verify_requests').select('id,shot').in('status', ['approved', 'rejected', 'cancelled', 'revoked'])
    .eq('shot_purged', false).lt('created_at', cut).limit(50));
  for (var i = 0; i < old.length; i++) {
    if (old[i].shot) { var r = await sb().storage.from(BUCKET).remove([old[i].shot]); if (r.error) continue; }
    await rpc('gv_mark_purged', { p_id: old[i].id });
  }
  return old.length;
}

/* ── 알림 (계정 단추 빨간 점) — 실패해도 0 으로. 메뉴가 깨지면 안 된다 ───── */
export async function loadAlerts(isAdmin) {
  var out = { arrived: 0, review: 0, queue: 0, verified: false, pending: false };
  if (!supabase) return out;
  try { await myId(); } catch (e) { return out; }
  var count = async function (q) { var r = await q; if (r.error) throw fail(r.error); return r.count || 0; };
  try {
    var me = await myId();
    var r = await Promise.all([
      count(sb().from('deck_refresh').select('id', { count: 'exact', head: true }).eq('user_id', me).eq('status', 'arrived')),
      rows(sb().from('game_accounts').select('user_id').eq('user_id', me)),
      count(sb().from('game_verify_requests').select('id', { count: 'exact', head: true }).eq('user_id', me).eq('status', 'pending'))
    ]);
    out.arrived = r[0]; out.verified = r[1].length > 0; out.pending = r[2] > 0;
    if (isAdmin) {
      var a = await Promise.all([
        count(sb().from('game_verify_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
        count(sb().from('deck_refresh').select('id', { count: 'exact', head: true }).in('status', ['requested', 'working']))
      ]);
      out.review = a[0]; out.queue = a[1];
    }
  } catch (e) { /* 표가 아직 없으면(SQL 실행 전) 조용히 0 */ }
  return out;
}

/* 긴 변을 max 로 줄여 JPEG 로 (club-api 와 같은 방식) */
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
