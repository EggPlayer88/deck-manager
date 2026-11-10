/* 불펜 가중치 넣기 — 가중치 파일을 읽어 검사하고 src/deck-manager.jsx 의 '▼ 불펜 가중치 (자동 생성) ▼' 칸을 다시 쓴다.

   node scripts/bullpen-weights.mjs --six <6명.json> [--more <7·8명.json>] [--few <4·5명.json>] --stage1 <선발·마무리.json> [--name "이름"] [--check]

   --six     중계 6명 편성 — 목록(사이트 편성 순서: 1/1/4 1/2/3 1/3/2 2/1/3 2/2/2 2/3/1 3/1/2 3/2/1 3/3/0 2/4/0 1/4/1 4/1/1 4/2/0)
             또는 { "2/2/2": {...}, ... } 처럼 편성 이름으로.
   --more    중계 7 · 8명 편성 — { "2/2/3": {...}, "4/4/0": {...}, ... } (없으면 7 · 8명은 '가중치 준비 중'으로 막힌다)
   --few     중계 4 · 5명 편성 — { "1/1/2": {...}, "3/2/0": {...}, ... } 같은 모양 (2026-11-10, 없으면 4 · 5명은 막힌다)
   --stage1  { "sp": { "기본": [선발 5], "적극": [...], "분업": [...] }, "cp": 마무리, "rpSum"?: { "기본": 중계 합, ... } }
   --name    화면 · 기록용 이름 (예: "6판 한도110")
   --check   검사만 하고 파일은 안 바꾼다

   편성 하나 = { "승리조/추격조": [등판 차례대로 중계 인원만큼], ... }. 전술 열쇠는 기본 · 적극 · 분업 / 기본 · 적극.
   게임에서 고를 수 있는 조합만 넣는다 (게임 규칙, 2026-11-02 정정): 승리조 적극은 1명부터 · 분업은 3명부터, 추격조 적극은 2명부터.
   그 밖의 칸(예: 추격조 1명 편성의 '기본/적극')은 있어도 버리고 개수만 알린다. 고를 수 있는 조합이 빠졌거나 칸 수가 틀리면 멈춘다.
   중계 합은 10 − 선발 합 − 마무리와 같아야 한다 (0.006 넘게 어긋나면 알린다). 편성이 통째로 없으면 그 편성은 화면에서 막힌다. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'deck-manager.jsx');
const BEGIN = '/* ▼ 불펜 가중치 (자동 생성) ▼ */';
const END = '/* ▲ 불펜 가중치 (자동 생성) ▲ */';
const PIT_TOTAL = 10;

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--check') args.check = true;
  else if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
if (!args.six) die('--six 가 필요해요');
if (!args.stage1) die('--stage1 이 필요해요');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch (e) { die(f + ' 를 못 읽었어요: ' + e.message); } };

const raw = fs.readFileSync(SRC, 'utf8');
const crlf = raw.includes('\r\n');
const src = raw.replace(/\r\n/g, '\n');
const bm = /var BPC = (\[.*\]);/.exec(src);
if (!bm) die('deck-manager.jsx 에서 BPC 를 못 찾았어요');
const BPC = Function('"use strict"; return (' + bm[1] + ');')();
const nOf = (c) => c.w + c.l + c.r;
const WIN = ['기본', '적극', '분업'], CHASE = ['기본', '적극'];
const winOk = (c, t) => (t === '분업' ? c.w >= 3 : t === '적극' ? c.w >= 1 : true);
const chaseOk = (c, t) => (t === '적극' ? c.l >= 2 : true);

/* 6명 목록의 순서 — 사이트 편성 순서 그대로 (BPC 앞 13개가 6명 편성) */
const SIX = BPC.filter((c) => nOf(c) === 6).map((c) => c.label);
const byLabel = {};
const six = readJson(args.six);
if (Array.isArray(six)) {
  if (six.length > SIX.length) die('6명 목록이 ' + six.length + '개예요 (최대 ' + SIX.length + ')');
  six.forEach((e, i) => { if (e) byLabel[SIX[i]] = e; });
} else Object.assign(byLabel, six);
for (const opt of ['more', 'few']) {
  if (!args[opt]) continue;
  const more = readJson(args[opt]);
  if (Array.isArray(more)) die('--' + opt + ' 는 { "편성": {...} } 모양이어야 해요');
  for (const k of Object.keys(more)) { if (byLabel[k]) die(k + ' 가 두 파일에 다 있어요'); byLabel[k] = more[k]; }
}
const known = new Set(BPC.map((c) => c.label));
const unknown = Object.keys(byLabel).filter((k) => !known.has(k));
if (unknown.length) die('게임에 없는 편성: ' + unknown.join(', '));

const st = readJson(args.stage1);
const sp = st.sp || {};
for (const t of WIN) {
  if (!Array.isArray(sp[t]) || sp[t].length !== 5 || sp[t].some((v) => typeof v !== 'number' || !isFinite(v) || v < 0)) die('선발 배율 ' + t + ' 은 숫자 5개여야 해요');
}
const cp = st.cp;
if (typeof cp !== 'number' || !isFinite(cp) || cp < 0) die('마무리(cp)는 숫자여야 해요');
const spSum = (t) => sp[t].reduce((a, b) => a + b, 0);
const expect = (t) => Math.round((PIT_TOTAL - spSum(t) - cp) * 1000) / 1000;

const errs = [], warns = [];
let dropped = 0, combos = 0;
const table = BPC.map((c, idx) => {
  const e = byLabel[c.label];
  if (!e) return null;
  if (typeof e !== 'object') { errs.push(c.label + ' 가 표 모양이 아니에요'); return null; }
  const n = nOf(c), out = {};
  for (const w of WIN) for (const ch of CHASE) {
    const key = w + '/' + ch, v = e[key];
    if (!(winOk(c, w) && chaseOk(c, ch))) { if (Array.isArray(v)) dropped++; continue; }
    if (!Array.isArray(v)) { errs.push(c.label + ' ' + key + ' 가 없어요 (게임에서 고를 수 있는 조합)'); continue; }
    if (v.length !== n) { errs.push(c.label + ' ' + key + ' 칸이 ' + v.length + '개예요 (중계 ' + n + '명)'); continue; }
    if (v.some((x) => typeof x !== 'number' || !isFinite(x) || x < 0)) { errs.push(c.label + ' ' + key + ' 에 숫자가 아닌 값 · 음수가 있어요'); continue; }
    const sum = v.reduce((a, b) => a + b, 0), want = expect(w);
    if (Math.abs(sum - want) > 0.006) warns.push(c.label + ' ' + key + ' 중계 합 ' + sum.toFixed(3) + ' (10 − 선발 − 마무리 = ' + want.toFixed(3) + ')');
    if (st.rpSum && typeof st.rpSum[w] === 'number' && Math.abs(st.rpSum[w] - want) > 0.006) warns.push('rpSum ' + w + ' ' + st.rpSum[w] + ' 가 10 − 선발 − 마무리(' + want + ')와 달라요');
    out[key] = v.slice();
    combos++;
  }
  for (const key of Object.keys(e)) if (!/^(기본|적극|분업)\/(기본|적극)$/.test(key)) warns.push(c.label + ' 의 모르는 열쇠 "' + key + '" 는 버렸어요');
  return out;
});
const uniqWarn = [...new Set(warns)];
const ready = (i) => !!(table[i] && table[i]['기본/기본']);
const count = (n) => { const ids = BPC.map((c, i) => i).filter((i) => nOf(BPC[i]) === n); return ids.filter(ready).length + ' / ' + ids.length; };
console.log('편성 준비 — 중계 4명 ' + count(4) + ' · 5명 ' + count(5) + ' · 6명 ' + count(6) + ' · 7명 ' + count(7) + ' · 8명 ' + count(8) + ' · 조합 ' + combos + '개'
  + (dropped ? ' · 게임에서 못 고르는 조합 ' + dropped + '칸은 버림' : ''));
console.log('선발 합 기본 ' + spSum('기본').toFixed(3) + ' · 적극 ' + spSum('적극').toFixed(3) + ' · 분업 ' + spSum('분업').toFixed(3) + ' · 마무리 ' + cp
  + ' → 중계 합 ' + WIN.map((t) => t + ' ' + expect(t).toFixed(3)).join(' · '));
const missing = BPC.filter((c, i) => !table[i]).map((c) => c.label);
if (missing.length) console.log('가중치 없는 편성(화면에서 막힘) ' + missing.length + '개: ' + missing.join(' '));
uniqWarn.slice(0, 30).forEach((w) => console.log('  ⚠ ' + w));
if (uniqWarn.length > 30) console.log('  ⚠ … 그 밖에 ' + (uniqWarn.length - 30) + '개');
if (errs.length) { errs.slice(0, 40).forEach((e) => console.error('  ✗ ' + e)); die('고칠 것이 ' + errs.length + '개 있어 넣지 않았어요'); }

const fmt = (v) => '[' + v.map((x) => String(x)).join(', ') + ']';
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const name = args.name || path.basename(args.six, '.json');
const lines = [BEGIN,
  '/* ' + today + ' · "' + name + '" · 원본 ' + [args.six, args.more, args.few, args.stage1].filter(Boolean).map((f) => path.basename(f)).join(' · ')
    + ' — node scripts/bullpen-weights.mjs 로 다시 만든다 */',
  'var BP_W_INFO = { name: ' + JSON.stringify(name) + ', made: "' + today + '" };',
  'var RP_WEIGHTS = ['];
BPC.forEach((c, i) => {
  const t = table[i], tag = '/* ' + String(i).padStart(2, ' ') + ' · ' + c.label + ' */ ';
  if (!t) { lines.push('  ' + tag + 'null,'); return; }
  const keys = Object.keys(t);
  lines.push('  ' + tag + '{ ' + keys.map((k) => JSON.stringify(k) + ': ' + fmt(t[k])).join(', ') + ' },');
});
lines.push('];');
lines.push('var SP_MULT = {');
WIN.forEach((t) => lines.push('  ' + JSON.stringify(t) + ': ' + fmt(sp[t]) + ',   /* 합 ' + spSum(t).toFixed(3) + ' */'));
lines.push('};');
lines.push('var CP_MULT = ' + cp + ';');
lines.push(END);
const block = lines.join('\n');

const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < a) die('deck-manager.jsx 에서 자동 생성 칸(▼ ▲)을 못 찾았어요');
const next = src.slice(0, a) + block + src.slice(b + END.length);
if (args.check) { console.log('검사만 했어요 (--check) — 파일은 그대로'); process.exit(0); }
fs.writeFileSync(SRC, crlf ? next.replace(/\n/g, '\r\n') : next);
console.log('✓ src/deck-manager.jsx 불펜 가중치 칸을 다시 썼어요 — "' + name + '"');
