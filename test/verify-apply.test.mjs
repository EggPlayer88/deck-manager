/* 게임 계정 인증 — 도착한 덱 얹기 시험 (src/verify-apply.js)
   실행:  node test/verify-apply.test.mjs */
import { checkPayload, asNewDeck, mergeIntoDeck, diffSlots, slotOrder, BAT_SLOTS, nextRefreshAt, deckApplied } from '../src/verify-apply.js';

let pass = 0, fail = 0;
function ok(label, cond, info) {
  if (cond) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, info === undefined ? '' : JSON.stringify(info)); }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* 도착한 덱 — 타자 9 · 선발 5 · 중계 6 · 마무리 · 후보 6 */
const SLOTS = BAT_SLOTS.concat(['SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6', 'CP', 'BN1', 'BN2', 'BN3', 'BN4', 'BN5', 'BN6']);
const pit = (s) => /^(SP|RP|CP)/.test(s);
function payload() {
  const players = SLOTS.map((s) => ({ id: 'gv_' + s, dbId: 'card-' + s, name: '선수' + s, cardType: '골든글러브', role: pit(s) ? '투수' : '타자',
    trainP: 3, specPower: 2, enhance: '9각성', ...(pit(s) ? { trainVel: 9, specVel: 1 } : {}), skill1: '스킬A', s1Lv: 7, sLvManual: true, pot1: 'S', potType1: pit(s) ? '장타억제' : '풀스윙',
    pot3: s === 'C' ? '' : undefined, isFa: false, isWildcard: false, _enh0: s === 'BN6' ? true : undefined,
    ...(pit(s) ? { position: s.startsWith('SP') ? '선발' : s === 'CP' ? '마무리' : '중계', subPosition: s } : {}) }));
  const lineupMap = Object.fromEntries(SLOTS.map((s) => [s, 'gv_' + s]));
  const sdConfig = { bpcIdx: 3, rpOrder: ['RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6'], s30: 'L', s40: 'R', s180: 'R:2017', pt_C: { level: 6, r0: 1, r1: 0, r2: 0, r3: 0 },
    uniP: 3, uniVel: 1, capBatId: 'gv_SS', capBatP: 2, capPitId: 'gv_SP3', capPitC: 5, capPitVel: 2, capLv: 20, capPitLv: 18, liveSetPo: 4, synLive: false,
    batOrder: ['DH', 'SS', '3B', 'LF', 'RF', '1B', 'CF', '2B', 'C'] };
  return { v: 1, team: '롯데', players, lineupMap, sdConfig };
}

console.log('[1. 모양 점검]');
ok('정상 덱', checkPayload(payload()) === '');
ok('없음', checkPayload(null) !== '');
ok('선수 없음', checkPayload({ players: [], lineupMap: {}, sdConfig: {} }) !== '');
{ const p = payload(); p.lineupMap.C = 'nope'; ok('없는 선수를 가리킴', /라인업/.test(checkPayload(p))); }
{ const p = payload(); p.players[1].id = p.players[0].id; ok('선수 번호 겹침', /번호/.test(checkPayload(p))); }
{ const p = payload(); delete p.lineupMap.DH; ok('타자 8칸', /타자 9칸/.test(checkPayload(p))); }

console.log('\n[2. 새 덱으로]');
{
  const n = asNewDeck(payload(), 1700);
  ok('선수 27명', n.players.length === 27);
  ok('번호를 새로', n.players.every((p) => /^gv1700_/.test(p.id)));
  ok('라인업이 새 번호를 가리킴', SLOTS.every((s) => n.lineupMap[s] === 'gv1700_' + s));
  ok('주장 · 조장 번호도 새로', n.sdConfig.capBatId === 'gv1700_SS' && n.sdConfig.capPitId === 'gv1700_SP3');
  ok('밑줄 칸(_enh0)은 뺌', n.players.every((p) => !('_enh0' in p)));
  ok('라인업 순서로 늘어섬', n.players[0].id === 'gv1700_C' && n.players[9].id === 'gv1700_SP1' && n.players[26].id === 'gv1700_BN6');
  ok('덱 설정 그대로 (타순 · 셋포 구간)', same(n.sdConfig.batOrder, payload().sdConfig.batOrder) && n.sdConfig.s180 === 'R:2017');
  ok('payload 를 고치지 않음', (() => { const p = payload(); asNewDeck(p, 1); return p.players[0].id === 'gv_C'; })());
}

console.log('\n[3. 지금 덱에 얹기]');
{
  /* 지금 덱 — C 자리에 같은 카드(흰존 · 사진 있음), SS 는 다른 카드, 1B 카드는 '내 선수'에만 있음, 라인업 밖 선수 둘, 중계 7명(RP7) */
  const old = [
    { id: 'p_C', dbId: 'card-C', name: '선수C', trainP: 0, enhance: '5강', whiteZone: 3, photoUrl: 'x.png', skill1: '옛스킬', s1Lv: 5, pot3: 'A', potType3: '뜬공형' },
    { id: 'p_SS', dbId: 'card-OLD-SS', name: '옛유격' },
    { id: 'p_mine1B', dbId: 'card-1B', name: '선수1B', trainP: 1, subPosition: '1B' },
    { id: 'p_bench', dbId: 'card-zzz', name: '남는선수' },
    { id: 'p_RP7', dbId: 'card-rp7', name: '중계7', role: '투수', position: '중계' },
  ];
  for (const s of ['DH', '3B', 'LF', 'RF', 'CF', '2B']) old.push({ id: 'p_' + s, dbId: 'card-' + s, name: '선수' + s });
  const oldLm = { C: 'p_C', SS: 'p_SS', RP7: 'p_RP7', DH: 'p_DH', '3B': 'p_3B', LF: 'p_LF', RF: 'p_RF', CF: 'p_CF', '2B': 'p_2B', BN1: 'p_bench' };
  const oldSd = { teamName: '롯데', isWinSplit: true, rpActive: true, rpChaseActive: false, pts_C: ['파워히터', '', ''], potmOn: ['x'], natBat: '6렙', yearBat: true, capBatVel: 3, capLv: 7, capPitLv: 12,
    s30: 'R', s45: 'L', pt_C: { level: 3 }, pt_RP7: { level: 2 }, synLive: true, synSig: true, uniP: 1, capBatId: 'p_SS', bpcIdx: 5,
    rpOrder: ['RP7', 'RP6', 'RP5', 'RP4', 'RP3', 'RP2', 'RP1'],
    /* 1~2번 묶음 (SS · DH) — SS 카드가 바뀜 → 새 순서 / 3~5번 (3B · LF · RF) 같은 카드 → 지금 순서 / 6~9번 (1B 가 새로 들어옴) → 새 순서 */
    batOrder: ['SS', 'DH', 'RF', 'LF', '3B', '1B', 'C', '2B', 'CF'] };
  const cur = { players: old, lineupMap: oldLm, sdState: oldSd };
  const m = mergeIntoDeck(cur, payload(), 1800);
  const byId = Object.fromEntries(m.players.map((p) => [p.id, p]));
  ok('같은 카드는 그 선수를 고쳐 씀 (번호 그대로)', m.lineupMap.C === 'p_C');
  ok('  훈련 · 강화 · 스킬은 게임대로', byId.p_C.trainP === 3 && byId.p_C.enhance === '9각성' && byId.p_C.skill1 === '스킬A' && byId.p_C.s1Lv === 7);
  ok('  흰존 · 사진은 지킴', byId.p_C.whiteZone === 3 && byId.p_C.photoUrl === 'x.png');
  ok('  게임에 없는 각성 잠재는 지움', !('pot3' in byId.p_C) || byId.p_C.pot3 === '' , byId.p_C.pot3);
  ok('내 선수에만 있던 같은 카드를 데려다 씀', m.lineupMap['1B'] === 'p_mine1B' && byId.p_mine1B.trainP === 3);
  ok('  타자 수비 자리(subPosition)는 지킴', byId.p_mine1B.subPosition === '1B');
  ok('바뀐 카드는 새 선수', /^gv1800_SS$/.test(m.lineupMap.SS) && byId.gv1800_SS.dbId === 'card-SS');
  ok('옛 카드 선수는 내 선수에 남음', !!byId.p_SS && !!byId.p_bench && !!byId.p_RP7);
  ok('새 선수는 맨 위', m.players[0].id.startsWith('gv1800_'));
  ok('라인업은 도착한 덱 칸만 (RP7 빠짐)', !('RP7' in m.lineupMap) && Object.keys(m.lineupMap).length === 27);
  ok('라인업 칸이 모두 있는 선수', Object.values(m.lineupMap).every((id) => !!byId[id]));
  ok('선수 번호 겹침 없음', new Set(m.players.map((p) => p.id)).size === m.players.length);
  ok('지금 덱 선수 수 + 새로 든 수', m.players.length === old.length + m.report.added, [m.players.length, old.length, m.report]);
  const sd = m.sdConfig;
  ok('전술은 지킴', sd.isWinSplit === true && sd.rpActive === true && sd.rpChaseActive === false);
  ok('포특 스킬 · POTM · 국대에이스 직접 값 · 연도덱은 지킴', same(sd.pts_C, ['파워히터', '', '']) && same(sd.potmOn, ['x']) && sd.natBat === '6렙' && sd.yearBat === true);
  ok('셋포 구간은 게임대로 (없던 s45 는 지움)', sd.s30 === 'L' && sd.s40 === 'R' && sd.s180 === 'R:2017' && !('s45' in sd));
  ok('포특 레벨은 게임대로 (RP7 칸 지움)', sd.pt_C.level === 6 && !('pt_RP7' in sd));
  ok('시너지 직접 값: 게임이 끈 라이브만 남고 시그는 자동으로', sd.synLive === false && !('synSig' in sd));
  ok('라커룸 · 주장 번호는 새 번호로', sd.uniP === 3 && sd.capBatId === 'gv1800_SS' && sd.capPitId === 'gv1800_SP3');
  ok('구속(유니폼 · 조장)도 게임대로 · 지금 덱에 있던 주장 구속은 지움', sd.uniVel === 1 && sd.capPitVel === 2 && !('capBatVel' in sd));
  ok('리더 레벨(주장 · 투수 조장)도 게임대로 (지금 덱의 7 · 12 → 20 · 18)', sd.capLv === 20 && sd.capPitLv === 18, [sd.capLv, sd.capPitLv]);
  { const sp1 = byId[m.lineupMap.SP1]; ok('투수 훈련 · 특훈 구속도 게임대로', !!sp1 && sp1.trainVel === 9 && sp1.specVel === 1, sp1 && [sp1.trainVel, sp1.specVel]); }
  ok('덱 설정에 teamName 을 넣지 않음', !('teamName' in sd));
  ok('타순 1~2번 묶음은 새 순서 (카드 바뀜)', sd.batOrder[0] === 'DH' && sd.batOrder[1] === 'SS');
  ok('타순 3~5번 묶음은 지금 순서 (같은 카드)', same(sd.batOrder.slice(2, 5), ['RF', 'LF', '3B']));
  ok('타순 6~9번 묶음은 새 순서 (1B 새로)', same(sd.batOrder.slice(5), ['1B', 'CF', '2B', 'C']));
  ok('타순 9칸 모두 한 번씩', new Set(sd.batOrder).size === 9 && sd.batOrder.every((s) => BAT_SLOTS.includes(s)));
  ok('중계 칸이 달라졌으면(7 → 6명) 등판 순서 · 편성은 도착한 덱', same(sd.rpOrder, ['RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6']) && sd.bpcIdx === 3 && !m.report.keptRp);
  ok('보고: 지킨 묶음 · 새 묶음', same(m.report.keptOrder, [1]) && same(m.report.newOrder, [0, 2]));
  ok('지금 덱을 고치지 않음', old[0].trainP === 0 && oldSd.s45 === 'L' && oldLm.RP7 === 'p_RP7');
  const d = diffSlots(cur, m, (p) => p.name);
  const k = Object.fromEntries(d.map((x) => [x.slot, x.kind]));
  ok('비교: C 능력 바뀜 · SS 카드 바뀜 · 1B 새로 · RP7 빠짐 · BN1 카드 바뀜', k.C === 'stat' && k.SS === 'card' && k['1B'] === 'new' && k.RP7 === 'gone' && k.BN1 === 'card', k);
  ok('비교 줄은 칸 순서', d[0].slot === 'C' && d[d.length - 1].slot === 'BN6');
}
{
  /* 같은 편성 · 같은 중계 칸이면 등판 순서를 지킨다 · 타순 묶음이 모두 같으면 전부 지킨다 */
  const p = payload();
  const players = p.players.map((x) => ({ ...x, id: 'q_' + x.id.slice(3) }));
  const lm = Object.fromEntries(SLOTS.map((s) => [s, 'q_' + s]));
  const sd = { bpcIdx: 3, rpOrder: ['RP6', 'RP5', 'RP4', 'RP3', 'RP2', 'RP1'], batOrder: ['SS', 'DH', 'RF', 'LF', '3B', 'C', '2B', 'CF', '1B'] };
  const m = mergeIntoDeck({ players, lineupMap: lm, sdState: sd }, p, 1900);
  ok('같은 덱이면 새 선수 없음', m.report.added === 0 && m.report.kept === 27);
  ok('등판 순서 지킴', same(m.sdConfig.rpOrder, sd.rpOrder) && m.report.keptRp);
  ok('타순 모두 지킴', same(m.sdConfig.batOrder, sd.batOrder));
  ok('비교: 모두 같음', diffSlots({ players, lineupMap: lm }, m).every((x) => x.kind === 'same'));
}
{
  /* 빈 덱(덱을 새로 만든 직후)에 얹기 = 새 덱과 같은 결과 */
  const m = mergeIntoDeck({ players: [], lineupMap: {}, sdState: { liveSetPo: 0 } }, payload(), 2000);
  const n = asNewDeck(payload(), 2000);
  ok('빈 덱에 얹으면 새 덱과 같은 라인업', same(Object.keys(m.lineupMap).sort(), Object.keys(n.lineupMap).sort()) && m.players.length === 27);
  ok('  타순 · 등판 순서 = 도착한 덱', same(m.sdConfig.batOrder, payload().sdConfig.batOrder) && same(m.sdConfig.rpOrder, payload().sdConfig.rpOrder));
}
console.log('\n[4. 검토 뒤 보강 (11-21)]');
{ const p = payload(); p.lineupMap.SP2 = p.lineupMap.SP1; ok('한 선수가 두 칸 → 막음', /두 칸/.test(checkPayload(p))); }
{ const p = payload(); p.sdConfig.batOrder = ['C', 'C', 'C', 'C', 'C', 'C', 'C', 'C', 'C']; ok('타순이 9칸 순서가 아님 → 막음', /타순/.test(checkPayload(p))); }
{ const p = payload(); p.lineupMap.BN6 = null; ok('빈 칸(null)은 없는 칸으로 봄 → 통과', checkPayload(p) === '');
  const n = asNewDeck(p, 5); ok('  새 덱: 빈 칸은 라인업에 안 넣음', !('BN6' in n.lineupMap) && Object.values(n.lineupMap).every((id) => n.players.some((x) => x.id === id)));
  const m = mergeIntoDeck({ players: [], lineupMap: {}, sdState: {} }, p, 6); ok('  얹기: 빈 칸은 라인업에 안 넣음', !('BN6' in m.lineupMap)); }
{ const p = payload(); p.players.push({ id: 'SP1', dbId: 'card-extra', name: '라인업 밖' });
  const n = asNewDeck(p, 7); ok('새 덱: 선수 번호가 칸 이름과 겹쳐도 번호 겹침 없음', new Set(n.players.map((x) => x.id)).size === n.players.length); }
{
  /* 별칭 카드 — 지금 덱의 선수는 옛 도감 번호(old-C), 도착한 덱은 새 번호(card-C) */
  const canon = (id) => (id === 'old-C' ? 'card-C' : id);
  const cur = { players: [{ id: 'p_C', dbId: 'old-C', name: '선수C', whiteZone: 1 }], lineupMap: { C: 'p_C' }, sdState: {} };
  const m = mergeIntoDeck(cur, payload(), 8, canon);
  ok('별칭 카드도 같은 카드로 보고 그 선수를 고쳐 씀', m.lineupMap.C === 'p_C' && m.players.filter((x) => x.dbId === 'old-C' || x.dbId === 'card-C').length === 1);
  ok('  비교: 같은 카드(능력만 바뀜)', diffSlots(cur, m, null, canon).find((x) => x.slot === 'C').kind === 'stat');
  const m2 = mergeIntoDeck(cur, payload(), 9);
  ok('  canon 없으면 다른 카드로 봄 (예전 동작)', m2.lineupMap.C !== 'p_C');
}
{
  /* 게임에서 못 옮긴 자리(시즌 카드) — 지금 그 자리 선수를 그대로 둔다 */
  const p = payload(); delete p.lineupMap.BN3; p.players = p.players.filter((x) => x.id !== 'gv_BN3'); p.missing = ['BN3'];
  const cur = { players: [{ id: 'p_season', dbId: 'custom-season', name: '시즌카드' }], lineupMap: { BN3: 'p_season' }, sdState: {} };
  const m = mergeIntoDeck(cur, p, 10);
  ok('못 옮긴 자리는 지금 선수 유지', m.lineupMap.BN3 === 'p_season' && m.report.keptMissing.join() === 'BN3');
  const m2 = mergeIntoDeck({ players: [], lineupMap: {}, sdState: {} }, p, 11);
  ok('  지금 선수가 없으면 빈 칸', !('BN3' in m2.lineupMap));
}
{
  /* 11-25 — 타자 자리 도감 밖 카드: 검사 통과 · 덮어쓰기는 지금 선수 · 그 선수가 주장이면 주장 유지 · 그 자리 포특 레벨 유지 · 새 덱은 빈 칸 */
  const p = payload(); delete p.lineupMap['1B']; p.players = p.players.filter((x) => x.id !== 'gv_1B'); p.missing = ['1B'];
  p.sdConfig.capBatId = null; delete p.sdConfig.pt_1B;
  ok('타자 자리 못 옮김(missing) → 검사 통과', checkPayload(p) === '');
  const q = payload(); delete q.lineupMap['1B']; q.players = q.players.filter((x) => x.id !== 'gv_1B');
  ok('  missing 에 없으면 → 타자 8칸으로 막음', /타자 9칸/.test(checkPayload(q)));
  const cur = { players: [{ id: 'p_s1b', dbId: 'custom-s1b', name: '시즌1루', role: '타자' }], lineupMap: { '1B': 'p_s1b' },
    sdState: { capBatId: 'p_s1b', pt_1B: { level: 9, r0: 0, r1: 0, r2: 0, r3: 0 } } };
  const m = mergeIntoDeck(cur, p, 12);
  ok('  덮어쓰기: 1B 는 지금 선수', m.lineupMap['1B'] === 'p_s1b');
  ok('  그 선수가 주장이고 도착한 덱에 주장이 없으면 주장 유지', m.sdConfig.capBatId === 'p_s1b', m.sdConfig.capBatId);
  ok('  그 자리 포특 레벨 유지', !!m.sdConfig.pt_1B && m.sdConfig.pt_1B.level === 9, m.sdConfig.pt_1B);
  const p2 = payload(); delete p2.lineupMap['1B']; p2.players = p2.players.filter((x) => x.id !== 'gv_1B'); p2.missing = ['1B'];
  const m2 = mergeIntoDeck(cur, p2, 13);
  ok('  도착한 덱에 주장이 있으면 그 주장(게임 값)', m2.sdConfig.capBatId === m2.lineupMap.SS);
  const n = asNewDeck(p, 14);
  ok('  새 덱: 1B 는 비어 있음', !('1B' in n.lineupMap));
}
console.log('\n[4b. 반영 확인 — 서버에 정말 들어갔나 (deckApplied)]');
{
  const p = payload();
  const m = mergeIntoDeck({ players: [], lineupMap: {}, sdState: {} }, p, 30);
  const srv = JSON.parse(JSON.stringify({ players: m.players, lineupMap: m.lineupMap, sdConfig: m.sdConfig }));
  ok('서버가 같으면 true', deckApplied(m, srv) === true);
  const s2 = JSON.parse(JSON.stringify(srv)); s2.players.find((x) => x.id === m.lineupMap.SP1).trainVel = 0;
  ok('  라인업 칸은 같아도 훈련이 옛 값이면 false', deckApplied(m, s2) === false);
  const s3 = JSON.parse(JSON.stringify(srv)); s3.sdConfig.capLv = 0;
  ok('  덱 설정 게임 칸(리더 레벨)이 다르면 false', deckApplied(m, s3) === false);
  const s4 = JSON.parse(JSON.stringify(srv)); s4.sdConfig.s30 = 'R';
  ok('  셋포 구간이 다르면 false', deckApplied(m, s4) === false);
  const s5 = JSON.parse(JSON.stringify(srv)); s5.sdConfig.tacticMemo = 'x'; s5.players.forEach((x) => { x.memo = 'a'; });
  ok('  게임 칸 밖(메모 등)이 달라도 true', deckApplied(m, s5) === true);
  const s6 = JSON.parse(JSON.stringify(srv)); s6.lineupMap.C = 'other';
  ok('  라인업 칸이 다르면 false', deckApplied(m, s6) === false);
  ok('  서버 덱이 없으면 false', deckApplied(m, null) === false && deckApplied(m, {}) === false);
  /* 이미 얹힌 덱에 다시 얹으면 같은 내용 — 되돌리기 사본을 다시 뜨지 않는 조건 */
  const again = mergeIntoDeck({ players: m.players, lineupMap: m.lineupMap, sdState: m.sdConfig }, p, 31);
  ok('  이미 얹힌 덱에 다시 얹음 → 지금 덱과 같다고 봄', deckApplied(again, { players: m.players, lineupMap: m.lineupMap, sdConfig: m.sdConfig }) === true);
  const fresh = mergeIntoDeck({ players: [], lineupMap: {}, sdState: {} }, p, 32);
  ok('  처음 얹는 덱 → 지금 덱(빈 덱)과 다르다고 봄', deckApplied(fresh, { players: [], lineupMap: {}, sdConfig: {} }) === false);
}
console.log('\n[5. 한 달에 한 번 (한국 시각 달력 · 요청한 달)]');
{
  const T = (s) => new Date(s).getTime();
  const iso = (d) => (d ? d.toISOString() : null);
  const now = T('2026-11-21T03:00:00Z');   // 11월 21일 12:00 KST
  ok('요청 없으면 지금 가능', nextRefreshAt([], now) === null);
  ok('이번 달 요청이 도착(counted) → 12월 1일 0시 KST', iso(nextRefreshAt([{ counted: true, requested_at: '2026-11-20T16:00:00Z' }], now)) === '2026-11-30T15:00:00.000Z',
    iso(nextRefreshAt([{ counted: true, requested_at: '2026-11-20T16:00:00Z' }], now)));
  ok('실패(횟수 안 듦)는 지금 가능', nextRefreshAt([{ counted: false, requested_at: '2026-11-20T16:00:00Z' }], now) === null);
  ok('지난달 요청(이번 달에 도착했어도)은 지금 가능', nextRefreshAt([{ counted: true, requested_at: '2026-10-31T14:00:00Z', delivered_at: '2026-11-01T01:00:00Z' }], now) === null);
  const dec1 = T('2026-11-30T15:30:00Z');   // 12월 1일 00:30 KST
  ok('11월 30일 23시 KST 요청 → 12월 1일 00:30 KST 에는 다시 가능', nextRefreshAt([{ counted: true, requested_at: '2026-11-30T14:00:00Z' }], dec1) === null);
  ok('11월 30일 23시 KST 요청 → 11월 30일 23:30 KST 에는 12월 1일부터', iso(nextRefreshAt([{ counted: true, requested_at: '2026-11-30T14:00:00Z' }], T('2026-11-30T14:30:00Z'))) === '2026-11-30T15:00:00.000Z');
  ok('12월 요청 → 다음 해 1월 1일 0시 KST', iso(nextRefreshAt([{ counted: true, requested_at: '2026-12-05T00:00:00Z' }], T('2026-12-20T00:00:00Z'))) === '2026-12-31T15:00:00.000Z');
}
ok('칸 순서: C < DH < SP1 < RP1 < CP < BN1', slotOrder('C') < slotOrder('DH') && slotOrder('DH') < slotOrder('SP1') && slotOrder('SP5') < slotOrder('RP1') && slotOrder('RP8') < slotOrder('CP') && slotOrder('CP') < slotOrder('BN1'));

console.log('\n통과', pass, '· 실패', fail);
process.exit(fail ? 1 : 0);
