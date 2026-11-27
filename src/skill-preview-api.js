/* 비공개 스킬점수표 미리보기 — 서버와 주고받는 것만 (표 · 함수는 supabase/skill_preview.sql)

   원칙
   - 표 내용은 사이트 코드(JS)에 없다. 권한이 있는 사람이 skp_get() 을 부를 때만 서버가 준다
   - 권한 확인(skp_access)은 가볍게 — 실패하면(SQL 실행 전 · 인터넷 끊김) 조용히 '권한 없음'으로 본다.
     그래서 이 기능이 서버에 아직 없어도 다른 화면은 아무 영향이 없다
   - 권한 주기 · 거두기 · 목록은 관리자만 (서버 함수가 한 번 더 막는다) */
import { supabase } from './supabase.js';

function sb() {
  if (!supabase) throw new Error('서버에 연결돼 있지 않아요');
  return supabase;
}
function fail(error) {
  var m = (error && (error.message || error.error_description)) || String(error || '알 수 없는 오류');
  var code = error && error.code;
  if (/skp_|skill_preview/.test(m) && /does not exist|not find|schema cache/i.test(m)) m = '아직 준비 중인 기능이에요.';
  else if (/JWT|not authenticated/i.test(m)) m = '로그인이 풀렸어요. 다시 로그인해 주세요.';
  else if (code === '42501' || /permission denied|열람 권한/i.test(m)) m = '열람 권한이 없어요.';
  else if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) m = '인터넷 연결이 불안정해요. 잠시 뒤 다시 해 주세요.';
  else if (!/[가-힣]/.test(m)) m = '처리하지 못했어요. 잠시 뒤 다시 해 주세요.' + (code ? ' (오류 ' + code + ')' : '');
  var e = new Error(m); e.raw = error; return e;
}
async function rpc(name, args) {
  var r = await sb().rpc(name, args || {});
  if (r.error) throw fail(r.error);
  return r.data;
}

/* 내 권한 — { ok, admin, version, updated_at, until }. 어떤 오류든 { ok: false } */
export async function skpAccess() {
  try {
    var a = await rpc('skp_access');
    return a && a.ok ? a : { ok: false };
  } catch (e) { return { ok: false }; }
}
/* 표 받기 — { version, updated_at, payload, viewer } (권한이 없으면 오류) */
export async function skpGet() { return await rpc('skp_get'); }
/* 내 가중치로 다시 매기기 — w = { 파: 0.85, …, opp: 1.05 } → { version, w, opp, rows, extra } (점수만 — 능력치별 몫은 서버에만 있다) */
export async function skpCustom(w) { return await rpc('skp_custom', { p_w: w }); }

/* ── 관리자 ── */
export async function skpList() { return (await rpc('skp_list')) || []; }
export async function skpGrant(userId, note, days) {
  return await rpc('skp_grant', { p_user: userId, p_note: note || '', p_days: days || null });
}
export async function skpRevoke(userId) { return await rpc('skp_revoke', { p_user: userId }); }
