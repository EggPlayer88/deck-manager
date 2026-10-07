/* 줄 읽기·쓰기(src/supabase.js 의 loadUserRow · saveUserRow)가 기대는 supabase-js 동작을 확인한다.
   supabase-js 를 올릴 때 다시 돌려 본다. 실제 서버로는 아무것도 보내지 않는다 (fetch 를 가로챈다).
     node test/pin-token.check.mjs

   1) 요청에 직접 붙인 Authorization 이 그대로 나가는가
      세션이 없으면 supabase-js 는 anon 키를 붙여 보낸다. 직접 붙인 토큰이 그 자리를 지켜야
      "행이 없음"이라는 답을 그 계정의 것으로 믿을 수 있다.
   2) "읽은 뒤로 바뀌지 않았을 때만" 쓰는 조건이 주소에 제대로 실리는가
      서버가 준 시각(…+00:00)의 + 가 %2B 로 실려야 한다. 그대로 나가면 서버는 빈칸으로 읽어 조건이 어긋난다. */
import { createClient } from '@supabase/supabase-js';

const seen = [];
const fakeFetch = async (url, init) => {
  const h = new Headers(init && init.headers);
  seen.push({ url: String(url), method: (init && init.method) || 'GET', auth: h.get('Authorization'), prefer: h.get('Prefer') });
  if (init && init.method === 'PATCH') return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ code: 'PGRST116', message: 'no rows' }), { status: 406, headers: { 'Content-Type': 'application/json' } });
};
const sb = createClient('https://example.supabase.co', 'ANON_KEY', { global: { fetch: fakeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
const UID = '11111111-2222-4333-8444-555555555555';
const q = () => sb.from('user_settings').select('sd_state,updated_at').eq('user_id', UID).eq('key', 'settings');

const plain = await q().single();
const pinned = await q().setHeader('Authorization', 'Bearer USER_TOKEN').single();
const STAMP = '2026-10-07T02:04:44.7+00:00';
const upd = await sb.from('user_settings').update({ sd_state: { a: 1 }, updated_at: new Date().toISOString() })
  .eq('user_id', UID).eq('key', 'settings').eq('updated_at', STAMP).select('updated_at').setHeader('Authorization', 'Bearer USER_TOKEN');

const results = [
  [seen[0].auth === 'Bearer ANON_KEY', '세션이 없으면 anon 키로 나간다 (이것을 신규 유저로 받아들이면 안 되는 까닭)'],
  [seen[1].auth === 'Bearer USER_TOKEN', '읽기 — 직접 붙인 토큰은 그대로 나간다'],
  [plain.error && plain.error.code === 'PGRST116' && pinned.error && pinned.error.code === 'PGRST116', '행이 없으면 PGRST116 으로 돌아온다'],
  [seen[2].method === 'PATCH' && seen[2].auth === 'Bearer USER_TOKEN', '쓰기 — PATCH 로 나가고 직접 붙인 토큰이 그대로 나간다'],
  [new URL(seen[2].url).searchParams.get('updated_at') === 'eq.' + STAMP && /updated_at=eq\.[^&]*%2B00/.test(seen[2].url), '쓰기 — 시각 조건이 그대로 실린다 (+ 는 %2B 로)'],
  [/return=representation/.test(seen[2].prefer || ''), '쓰기 — 바뀐 줄을 돌려받는다 (0줄이면 그 사이 줄이 바뀐 것)'],
  [!upd.error && Array.isArray(upd.data) && upd.data.length === 0, '쓰기 — 조건에 맞는 줄이 없으면 오류가 아니라 빈 목록'],
];
results.forEach(([ok, label]) => console.log((ok ? 'ok  ' : 'FAIL') + ' ' + label));
if (results.some((r) => !r[0])) { console.log('받은 값:', JSON.stringify(seen, null, 1)); process.exit(1); }
