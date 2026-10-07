/* loadUserData 가 기대는 supabase-js 동작을 확인한다 — 요청에 직접 붙인 Authorization 이 그대로 나가는가.
   세션이 없으면 supabase-js 는 anon 키를 붙여 보낸다. 직접 붙인 토큰이 그 자리를 지켜야
   "행이 없음"이라는 답을 그 계정의 것으로 믿을 수 있다. supabase-js 를 올릴 때 다시 돌려 본다.
   실제 서버로는 아무것도 보내지 않는다 (fetch 를 가로챈다).  node test/pin-token.check.mjs */
import { createClient } from '@supabase/supabase-js';

const seen = [];
const fakeFetch = async (url, init) => {
  seen.push(new Headers(init && init.headers).get('Authorization'));
  return new Response(JSON.stringify({ code: 'PGRST116', message: 'no rows' }), { status: 406, headers: { 'Content-Type': 'application/json' } });
};
const sb = createClient('https://example.supabase.co', 'ANON_KEY', { global: { fetch: fakeFetch }, auth: { persistSession: false, autoRefreshToken: false } });
const q = () => sb.from('user_settings').select('sd_state').eq('user_id', '11111111-2222-4333-8444-555555555555').eq('key', 'settings');

const plain = await q().single();
const pinned = await q().setHeader('Authorization', 'Bearer USER_TOKEN').single();
const ok1 = seen[0] === 'Bearer ANON_KEY';
const ok2 = seen[1] === 'Bearer USER_TOKEN';
const ok3 = plain.error && plain.error.code === 'PGRST116' && pinned.error && pinned.error.code === 'PGRST116';
console.log((ok1 ? 'ok  ' : 'FAIL') + ' 세션이 없으면 anon 키로 나간다 (이것을 신규 유저로 받아들이면 안 되는 까닭)');
console.log((ok2 ? 'ok  ' : 'FAIL') + ' 직접 붙인 토큰은 그대로 나간다');
console.log((ok3 ? 'ok  ' : 'FAIL') + ' 행이 없으면 PGRST116 으로 돌아온다');
if (!(ok1 && ok2 && ok3)) { console.log('받은 값:', seen); process.exit(1); }
