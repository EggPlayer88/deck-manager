/* 덱 보정 시트(260814) 대조 회귀 테스트
   실행:  node test/calc.test.mjs
   calc-extract.mjs 는 src/deck-manager.jsx 에서 순수 계산 함수만 뽑아낸 것이다.
   (재생성이 필요하면 시트 분석 스크립트의 mkharness 를 다시 돌린다) */
import {
  pctFromDist, histFromDist, skillDistKey, slotGroupOf, isWinGroupSlot, rpGroupOf, batMult, BAT_MULT, strMult, strRanks, STR_MULT, getRPWeight, rpTactic, spMult, rpBudget, SP_MULT, skillSlotHint, skillRoleOf, variantAllowed, pickPaegi, isNatOnlySkill, natSkillMismatch, buffName, skillPickable, canonSkillName, canonPlayerName, playerNameGroup, PLAYER_RENAME, PLAYER_RENAME_BY_TEAM, PLAYER_NAME_GROUPS, choseong, isChoQuery, dexHay, dexScore, buildDexIndex, dexFitsSlot, dexRank, dexSearch, skillAllowedAt, DEFAULT_MAJOR, calcSDBonus, sdPick, buildDist, TRAIN_POINTS, TRAIN_MY_STATS, hasTrainInput, getPercentile, PEAK_SKILLS, PEAK_TRAIN, PEAK_SPEC, PEAK_POT, PEAK_AWK, peakPl, peakSkillSum, peakBuffState,
  __setLiveWeights, __setGlobalPotm, resolveSkills, DEFAULT_SKILLS, getEnhVal, calcBat, calcPit, getSkillScore,
  getPotScoreByType, awkTypesFor, POT_GRADES_AWK, POT_TYPES_AWK_BAT, POT_TYPES_AWK_PIT,
  potmKey, isPotmFor, getPotmBonus, maxSkillLv, autoSkillLv, effSkillLv, isLvManual, parseHotColdZone, zonesFromRow,
  launchAngleReq, launchAngleBonus, launchAngleGain, zonePenalty, getW, makeDeckWriter,
} from './calc-extract.mjs';

let pass = 0, fail = 0;
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
function eq(label, got, want, tol) {
  if (near(got, want, tol)) { pass++; console.log(`  ok   ${label}  = ${got}`); }
  else { fail++; console.log(`  FAIL ${label}  got ${got}, want ${want}`); }
}

console.log('\n[가중치] 시트 260814 기준');
const w = getW();
eq('파워', w.p, 1.0); eq('정확', w.a, 0.85); eq('선구', w.e, 0.4);
eq('인내', w.n, 0.15);
eq('변화', w.c, 1.05); eq('구위', w.s, 1.35);

console.log('\n[스킬점수] 시트 스킬점수표와 일치해야 한다');
eq('정밀타격 Lv5', getSkillScore('정밀타격', 5, '타자'), 20.7);
eq('정밀타격 Lv10', getSkillScore('정밀타격', 10, '타자'), 40.15);
eq('스위치히터(양타) Lv5', getSkillScore('스위치히터(양타)', 5, '타자'), 21.9);
eq('좌승사자(좌투) Lv10', getSkillScore('좌승사자(좌투)', 10, '선발'), 57.32);
eq('마당쇠(불펜) Lv5', getSkillScore('마당쇠(불펜)', 5, '중계'), 24.45);

console.log('\n[스킬 개명] 구 이름으로도 조회돼야 한다');
eq('철완(지구력140-149) → 철완(140149)', getSkillScore('철완(지구력140-149)', 5, '선발'), getSkillScore('철완(140149)', 5, '선발'));
eq('약속의8회 → 약속의 8회', getSkillScore('약속의8회', 5, '마무리'), getSkillScore('약속의 8회', 5, '마무리'));
eq('오버페이스(중계 카테고리)', getSkillScore('오버페이스', 5, '중계'), getSkillScore('오버페이스(중계)', 5, '중계'));

console.log('\n[발사각] 필요파워 = |16-발사각|*3+160, 보너스 = MIN(5, ...)');
eq('발사각 12 → 미달(null)', launchAngleReq(12) === null ? 1 : 0, 1);
eq('발사각 13 필요파워', launchAngleReq(13), 169);
eq('발사각 16 필요파워', launchAngleReq(16), 160);
eq('발사각 20 필요파워', launchAngleReq(20), 172);
eq('발사각 13 보너스', launchAngleBonus(13), 1);
eq('발사각 16 보너스', launchAngleBonus(16), 4);
eq('발사각 20 보너스', launchAngleBonus(20), 5);   /* 4+(20-16)*0.5 = 6 → 상한 5 */
eq('발사각 30 보너스', launchAngleBonus(30), 5);
eq('파워 미달이면 0', launchAngleGain(20, 171), 0);
eq('파워 충족이면 지급', launchAngleGain(20, 172), 5);

console.log('\n[핫콜존 파싱] 선수도감 양식의 「핫콜존」 칸 (흰=흰존, 파=콜존)');
/* 실제 파일에 나온 20가지 형식을 모두 확인한다 */
const hz = (v) => { const r = parseHotColdZone(v); return r.whiteZone * 10 + r.coldZone; };  /* 흰*10+콜 로 압축 비교 */
eq('빈칸', hz(''), 0);
eq('null', hz(null), 0);
eq('"0"', hz('0'), 0);
eq('숫자 0', hz(0), 0);
eq('흰1', hz('흰1'), 10);
eq('흰4', hz('흰4'), 40);
eq('파1', hz('파1'), 1);
eq('파5', hz('파5'), 5);
eq('파1흰1', hz('파1흰1'), 11);
eq('파2흰2', hz('파2흰2'), 22);
eq('파1흰3', hz('파1흰3'), 31);
eq('파3흰1', hz('파3흰1'), 13);
eq('파4흰2', hz('파4흰2'), 24);
eq('공백 섞임', hz(' 파2 흰1 '), 12);
/* 감점으로 이어지는지 */
eq('파2흰1 감점 = -7.5', zonePenalty(parseHotColdZone('파2흰1')), -7.5);
eq('흰3 감점 = -4.5', zonePenalty(parseHotColdZone('흰3')), -4.5);

console.log('\n[양식 호환] 「핫콜존」 한 칸이든 「흰존」·「콜존」 두 칸이든 받는다');
const zr = (row) => { const r = zonesFromRow(row); return r.whiteZone * 10 + r.coldZone; };
eq('핫콜존 한 칸', zr({ '핫콜존': '파1흰2' }), 21);
eq('흰존/콜존 두 칸', zr({ '흰존': 2, '콜존': 1 }), 21);
eq('두 칸이 있으면 우선', zr({ '흰존': 3, '콜존': 0, '핫콜존': '파9흰9' }), 30);
eq('흰존만 있어도 동작', zr({ '흰존': 4 }), 40);
eq('콜존만 있어도 동작', zr({ '콜존': 2 }), 2);
eq('둘 다 비면 핫콜존으로', zr({ '흰존': '', '콜존': '', '핫콜존': '흰1' }), 10);
eq('아무것도 없으면 0', zr({}), 0);

console.log('\n[흰존/콜존] 흰존 -1.5, 콜존 -3');
eq('흰존 2 · 콜존 1', zonePenalty({ whiteZone: 2, coldZone: 1 }), -6);
eq('없으면 0', zonePenalty({}), 0);

console.log('\n[calcBat] 손계산 대조');
/* 파워200 정확100 선구50, 좌타, 발사각20, 흰존2 콜존1, 강화없음, 스킬없음
   200*1.0 + 100*0.85 + 50*0.4 = 305
   좌타 -2.5 → 302.5 / 존 -6 → 296.5 / 발사각 +5 → 301.5 */
const batL = calcBat(
  { hand: '좌', power: 200, accuracy: 100, eye: 50, launchAngle: 20, whiteZone: 2, coldZone: 1, cardType: '시즌' },
  {}, null);
eq('좌타 종합', batL.total, 301.5);
eq('발사각 필요파워', batL.laReq, 172);
eq('발사각 획득', batL.laGain, 5);

/* 같은 조건에 우타면 좌타 감점 2.5가 없다 */
const batR = calcBat(
  { hand: '우', power: 200, accuracy: 100, eye: 50, launchAngle: 20, whiteZone: 2, coldZone: 1, cardType: '시즌' },
  {}, null);
eq('우타 종합', batR.total, 304);
eq('좌타 감점 폭', batR.total - batL.total, 2.5);

/* 양타는 감점 대상이 아니다 (시트는 "좌"만 검사) */
const batS = calcBat({ hand: '양', power: 200, accuracy: 100, eye: 50, cardType: '시즌' }, {}, null);
eq('양타 = 우타와 동일', batS.total, calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌' }, {}, null).total);

console.log('\n[인내] 시트 J15 의 인내 × 0.15');
/* 파워200 정확100 선구50 인내60 → 305 + 60*0.15 = 314 */
const batN = calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, patience: 60, cardType: '시즌' }, {}, null);
eq('인내 60 반영', batN.total, 314);
eq('최종 인내 노출', batN.patience, 60);
/* 훈련(trainN) + 특훈(specPatience) 도 인내에 합산된다 */
const batN2 = calcBat(
  { hand: '우', power: 200, accuracy: 100, eye: 50, patience: 60, specPatience: 10, cardType: '시즌' },
  { trainN: 20 }, null);
eq('인내 60+훈련20+특훈10 = 90', batN2.patience, 90);
eq('종합 = 305 + 90*0.15', batN2.total, 305 + 13.5);
/* 인내가 없으면 예전과 동일해야 한다 */
eq('인내 0이면 영향 없음', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌' }, {}, null).total, 305);

console.log('\n[강화표 인내] 인게임 「강화 능력치 표」(5성) 누적값');
eq('시즌 5강', getEnhVal('시즌', '인내', '5강'), 7);
eq('시즌 10강', getEnhVal('시즌', '인내', '10강'), 17);
eq('라이브 10강', getEnhVal('라이브', '인내', '10강'), 20);
eq('올스타 10강', getEnhVal('올스타', '인내', '10강'), 20);
eq('임팩트 5강', getEnhVal('임팩트', '인내', '5강'), 5);
eq('임팩트 10강', getEnhVal('임팩트', '인내', '10강'), 10);
eq('시그니처 10강', getEnhVal('시그니처', '인내', '10강'), 20);
eq('국가대표 10강', getEnhVal('국가대표', '인내', '10강'), 20);
eq('골든글러브 10강', getEnhVal('골든글러브', '인내', '10강'), 21);

console.log('\n[각성표 인내] 「각성 능력치 표」 = 10강값 + 누적 델타');
/* 골글: 3각 +2, 4각 +2, 8각 +2  →  21 / 21 / 23 / 25 … 27 */
eq('골글 1각', getEnhVal('골든글러브', '인내', '1각성'), 21);
eq('골글 3각', getEnhVal('골든글러브', '인내', '3각성'), 23);
eq('골글 4각', getEnhVal('골든글러브', '인내', '4각성'), 25);
eq('골글 9각', getEnhVal('골든글러브', '인내', '9각성'), 27);
/* 임팩: 4각 +1, 8각 +1 */
eq('임팩 3각', getEnhVal('임팩트', '인내', '3각성'), 10);
eq('임팩 4각', getEnhVal('임팩트', '인내', '4각성'), 11);
eq('임팩 9각', getEnhVal('임팩트', '인내', '9각성'), 12);
/* 시그·국대: 3각 +1, 4각 +1, 8각 +2 */
eq('시그 9각', getEnhVal('시그니처', '인내', '9각성'), 24);
eq('국대 9각', getEnhVal('국가대표', '인내', '9각성'), 24);
/* 강화 단계만 있는 카드는 각성에서 마지막 값이 유지된다 (다른 스탯과 동일 규칙) */
eq('시즌 9각 = 10강 유지', getEnhVal('시즌', '인내', '9각성'), 17);

console.log('\n[기존 스탯 무영향] 인내를 넣어도 다른 능력치는 그대로여야 한다');
eq('시즌 파워 10강', getEnhVal('시즌', '파워', '10강'), 18);
eq('라이브 정확 10강', getEnhVal('라이브', '정확', '10강'), 24);
eq('골글 파워 9각', getEnhVal('골든글러브', '파워', '9각성'), 31);
eq('임팩 구위 8각', getEnhVal('임팩트', '구위', '8각성'), 14);

console.log('\n[강화 포함 종합] 골든글러브 9각성 타자');
/* 파워100+31=131, 정확80+31=111, 선구60+29=89, 인내40+27=67
   131*1.0 + 111*0.85 + 89*0.4 + 67*0.15 = 131 + 94.35 + 35.6 + 10.05 = 271 */
const batEnh = calcBat(
  { hand: '우', power: 100, accuracy: 80, eye: 60, patience: 40, cardType: '골든글러브' },
  { enhance: '9각성' }, null);
eq('최종 파워', batEnh.power, 131);
eq('최종 인내', batEnh.patience, 67);
eq('종합', batEnh.total, 271);

console.log('\n[calcPit] 손계산 대조');
/* 변화150 구위180: 150*1.05 + 180*1.35 = 157.5 + 243 = 400.5, 좌완 +1 */
const pitL = calcPit({ hand: '좌', change: 150, stuff: 180, position: '선발', cardType: '시즌' }, {}, null);
const pitR = calcPit({ hand: '우', change: 150, stuff: 180, position: '선발', cardType: '시즌' }, {}, null);
eq('우완 종합', pitR.total, 400.5);
eq('좌완 종합', pitL.total, 401.5);
eq('좌완 가산 폭', pitL.total - pitR.total, 1);

console.log('\n[가중치 하위호환] 예전에 저장된 가중치에 없는 키는 기본값으로 채워야 한다');
/* 인내(n)가 추가되기 전에 저장된 가중치. 그대로 쓰면 인내가 통째로 0이 된다. */
__setLiveWeights({ p: 1.0, a: 0.85, e: 0.4, c: 1.05, s: 1.35 });
eq('빠진 인내는 기본값', getW().n, 0.15);
eq('저장된 값은 유지', getW().a, 0.85);
eq('레거시 가중치에서도 인내 반영',
   calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, patience: 60, cardType: '시즌' }, {}, null).total, 314);
/* 관리자가 인내를 0으로 명시했다면 그 값이 이긴다 */
__setLiveWeights({ p: 1.0, a: 0.85, e: 0.4, n: 0, c: 1.05, s: 1.35 });
eq('명시한 0은 존중', getW().n, 0);
__setLiveWeights(null);

console.log('\n[스킬표 승계] 낡은 저장본은 새 표로 바뀌되 관리자 설정은 살아남아야 한다');
/* 배포 전 상태를 흉내낸 저장본: 구 성분식 스킬 + 구 가중치 + 관리자 커스터마이징 */
const legacyStored = {
  '타자': { '정밀타격': [{ pV: 0, pF: 1, aV: 6, aF: 1, eV: 6, eF: 1, cV: 5, cF: 1, sV: 5, sF: 1 }] },
  '선발': {}, '중계': {}, '마무리': {},
  weights: { p: 1.0, a: 0.9, e: 0.3, c: 1.175, s: 1.275 },
  potScoresByType: { '풀스윙': { 'SR+': 99 } },
  _major: { '타자': { '정밀타격': true } },
};
const resolved = resolveSkills(legacyStored);
eq('스킬표가 새 값으로', resolved['타자']['정밀타격'][0], 20.7);
eq('타자 스킬 수', Object.keys(resolved['타자']).length, 91);
eq('신규 스킬 반영', resolved['타자']['빈틈없는타선(타순O)'][1], 23.83);
eq('국대 테이블세터', resolved['타자']['국대 테이블세터'][0], 14.97);
eq('대타스페셜 점수 생김', resolved['타자']['대타스페셜'][5], 11.54);
eq('매의눈 점수 생김', resolved['타자']['매의눈'][5], 6);
eq('투수 신규 - 타순공략', resolved['선발']['타순공략'][1], 24.5);
eq('투수 신규 - 위기탈출', resolved['중계']['위기탈출'][0], 19.9);
eq('2레벨짜리는 Lv6 이 상한', maxSkillLv('빈틈없는타선(타순O)', '타자'), 6);
eq('가중치도 새 값으로', resolved.weights.a, 0.85);
eq('인내 가중치 포함', resolved.weights.n, 0.15);
/* v3 부터는 잠재력 등급별 점수를 시트 기준으로 통일한다 — 예전 입력값은 덮인다 */
eq('잠재력 점수는 시트값으로 통일', resolved.potScoresByType['풀스윙']['SR+'], 14);
eq('주요스킬 표시 보존', resolved._major['타자']['정밀타격'] ? 1 : 0, 1);
/* 이미 최신이면 그대로 둔다 (관리자가 나중에 손댄 값을 덮지 않는다) */
const current = JSON.parse(JSON.stringify(DEFAULT_SKILLS));
current['타자']['정밀타격'] = [1, 2, 3, 4, 5, 6];
eq('최신본은 건드리지 않음', resolveSkills(current)['타자']['정밀타격'][0], 1);
/* 저장본이 없으면 기본값 */
eq('빈 저장본 → 기본값', resolveSkills(null)['타자']['정밀타격'][0], 20.7);

/* 2026-09 새 스킬 — 소방수 (마무리 전용, 메이저) */
eq('소방수 Lv5', DEFAULT_SKILLS['마무리']['소방수'][0], 22.91);
eq('소방수 Lv10', DEFAULT_SKILLS['마무리']['소방수'][5], 52.65);
eq('소방수 6레벨 다 참', DEFAULT_SKILLS['마무리']['소방수'].filter(v => v > 0).length, 6);
eq('소방수 상한은 Lv10', maxSkillLv('소방수', '마무리'), 10);
eq('소방수는 메이저', DEFAULT_MAJOR['마무리']['소방수'] ? 1 : 0, 1);
/* 마무리 전용 — 다른 세 분류에는 없어야 한다 */
eq('타자엔 없음', DEFAULT_SKILLS['타자']['소방수'] === undefined ? 1 : 0, 1);
eq('선발엔 없음', DEFAULT_SKILLS['선발']['소방수'] === undefined ? 1 : 0, 1);
eq('중계엔 없음', DEFAULT_SKILLS['중계']['소방수'] === undefined ? 1 : 0, 1);
eq('마무리 스킬 수', Object.keys(DEFAULT_SKILLS['마무리']).length, 69);
/* 총점은 파1.0 정0.85 변1.05 구1.35 로 맞아떨어진다 (Lv10: 파7.7 정7.7 변16 구16) */
eq('소방수 Lv10 검산',
   Math.round((7.7 * 1.0 + 7.7 * 0.85 + 16 * 1.05 + 16 * 1.35) * 100) / 100, 52.65, 0.01);
/* 낡은 저장본에도 새 스킬이 들어가야 한다 */
eq('낡은 저장본에 소방수 반영', resolveSkills(legacyStored)['마무리']['소방수'][5], 52.65);

console.log('\n[각성 잠재력] 등급은 C~S 만, 타자/투수 종류가 다르다');
eq('등급 7개', POT_GRADES_AWK.length, 7);
eq('마지막 등급 S', POT_GRADES_AWK[6] === 'S' ? 1 : 0, 1);
eq('SS 없음', POT_GRADES_AWK.indexOf('SS') < 0 ? 1 : 0, 1);
eq('타자 종류 6개', POT_TYPES_AWK_BAT.length, 6);
eq('투수 종류 6개', POT_TYPES_AWK_PIT.length, 6);
eq('타자는 좌투선호', awkTypesFor('타자').indexOf('좌투선호') >= 0 ? 1 : 0, 1);
eq('투수는 좌타선호', awkTypesFor('투수').indexOf('좌타선호') >= 0 ? 1 : 0, 1);
eq('타자에 좌타선호 없음', awkTypesFor('타자').indexOf('좌타선호') < 0 ? 1 : 0, 1);
eq('땅볼형은 양쪽 공용', (POT_TYPES_AWK_BAT.indexOf('땅볼형') >= 0 && POT_TYPES_AWK_PIT.indexOf('땅볼형') >= 0) ? 1 : 0, 1);
/* C 3 / C+ 6.5 에서 사이 등급 0.2 씩, S 는 10 */
eq('C 점수', getPotScoreByType('C', '속구대처', null), 3);
eq('C+ 점수', getPotScoreByType('C+', '속구대처', null), 6.5);
eq('B 점수', getPotScoreByType('B', '좌투선호', null), 6.7);
eq('A+ 점수', getPotScoreByType('A+', '땅볼형', null), 7.3);
eq('S 점수', getPotScoreByType('S', '좌투선호', null), 10);
eq('투수 종류도 같은 표', getPotScoreByType('S', '변화구연마', null), 10);
eq('총점에 반영', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', pot3: 'S', potType3: '좌투선호' }, {}, null).total, 315);

console.log('\n[잠재력 등급별 점수] 종류마다 표가 다르다');
eq('풀스윙 C 는 감점', getPotScoreByType('C', '풀스윙', null), -5);
eq('침착 C 는 -3', getPotScoreByType('C', '침착', null), -3);
eq('등급 미입력은 0', getPotScoreByType('', '풀스윙', null), 0);
eq('각성 C 는 3 유지', getPotScoreByType('C', '좌투선호', null), 3);
eq('풀스윙 C+', getPotScoreByType('C+', '풀스윙', null), 1);
eq('풀스윙 A+', getPotScoreByType('A+', '풀스윙', null), 2);
eq('풀스윙 S', getPotScoreByType('S', '풀스윙', null), 5);
eq('풀스윙 SR+', getPotScoreByType('SR+', '풀스윙', null), 14);
eq('침착 S', getPotScoreByType('S', '침착', null), 3);
eq('침착 SR+', getPotScoreByType('SR+', '침착', null), 9);
/* 클러치 = 침착 + S 이상 구간에 1점씩 */
eq('클러치 A+ = 침착 A+', getPotScoreByType('A+', '클러치', null), getPotScoreByType('A+', '침착', null));
eq('클러치 S = 침착 S + 1', getPotScoreByType('S', '클러치', null), getPotScoreByType('S', '침착', null) + 1);
eq('클러치 SR = 침착 SR + 1', getPotScoreByType('SR', '클러치', null), getPotScoreByType('SR', '침착', null) + 1);
/* 장타억제 = 풀스윙, 단 SR+ 는 별도 (확인 전이라 SR 과 동일) */
eq('장타억제 S = 풀스윙 S', getPotScoreByType('S', '장타억제', null), getPotScoreByType('S', '풀스윙', null));
eq('장타억제 SR = 풀스윙 SR', getPotScoreByType('SR', '장타억제', null), getPotScoreByType('SR', '풀스윙', null));
eq('장타억제 SR+ 는 풀스윙보다 높다', getPotScoreByType('SR+', '장타억제', null), 16);
/* 어드민이 점수를 채우면 곧바로 반영된다 */
eq('점수 지정 시 반영', getPotScoreByType('S', '좌투선호', { potScoresByType: { '좌투선호': { 'S': 4 } } }), 4);
eq('종류 없으면 0', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', pot3: 'S' }, {}, null).total, 305);
eq('등급 없으면 0', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', potType3: '좌투선호' }, {}, null).total, 305);

console.log('\n[스킬 레벨 자동 설정] 카드 종류 기본값 + 포지션 특훈 보너스');
/* 기본값: 골글·라이브 6/6/6, 올스타 8/7/7, 그 외 6/5/5 */
eq('골글 1번', autoSkillLv('정밀타격', '골든글러브', 1, '타자', []), 6);
eq('골글 3번', autoSkillLv('정밀타격', '골든글러브', 3, '타자', []), 6);
eq('라이브 2번', autoSkillLv('정밀타격', '라이브', 2, '타자', []), 7);
eq('라이브 1번', autoSkillLv('정밀타격', '라이브', 1, '타자', []), 7);
eq('라이브 3번', autoSkillLv('정밀타격', '라이브', 3, '타자', []), 7);
eq('올스타 1번', autoSkillLv('정밀타격', '올스타', 1, '타자', []), 8);
eq('올스타 2번', autoSkillLv('정밀타격', '올스타', 2, '타자', []), 7);
eq('올스타 3번', autoSkillLv('정밀타격', '올스타', 3, '타자', []), 7);
eq('시즌 1번', autoSkillLv('정밀타격', '시즌', 1, '타자', []), 6);
eq('시즌 2번', autoSkillLv('정밀타격', '시즌', 2, '타자', []), 5);
eq('임팩트 3번', autoSkillLv('정밀타격', '임팩트', 3, '타자', []), 5);
/* 포지션 특훈 스킬 보너스 → +1 */
eq('보너스 걸리면 +1', autoSkillLv('정밀타격', '시즌', 1, '타자', ['정밀타격']), 7);
eq('다른 스킬이면 그대로', autoSkillLv('정밀타격', '시즌', 1, '타자', ['대도']), 6);
/* 스킬 최고 레벨을 넘지 않는다 — 황금세대는 Lv6 까지만 값이 있다 */
eq('황금세대 최고 레벨', maxSkillLv('황금세대', '타자'), 6);
eq('정밀타격 최고 레벨', maxSkillLv('정밀타격', '타자'), 10);
eq('올스타 황금세대는 6에서 멈춤', autoSkillLv('황금세대', '올스타', 1, '타자', []), 6);
eq('보너스 있어도 6 초과 안 함', autoSkillLv('황금세대', '올스타', 1, '타자', ['황금세대']), 6);
eq('스킬 없으면 0', autoSkillLv('', '올스타', 1, '타자', []), 0);
/* 수동 지정이면 저장값을 그대로 쓴다 */
eq('수동 우선', effSkillLv('정밀타격', 10, true, '시즌', 1, '타자', ['정밀타격']), 10);
eq('자동이면 계산값', effSkillLv('정밀타격', 10, false, '시즌', 1, '타자', ['정밀타격']), 7);

console.log('\n[기존 선수 보존] sLvManual 이 없으면 수동으로 본다');
eq('필드 없으면 수동', isLvManual({ cardType: '시즌' }) ? 1 : 0, 1);
eq('false 면 자동', isLvManual({ sLvManual: false }) ? 1 : 0, 0);
eq('true 면 수동', isLvManual({ sLvManual: true }) ? 1 : 0, 1);
/* 기존 선수(필드 없음)는 저장된 Lv8 을 출발점으로 쓴다 */
const plLegacy = { hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자' };
eq('기존 선수는 저장값이 출발점',
   calcBat(plLegacy, { skill1: '정밀타격', s1Lv: 8 }, { p:0,a:0,e:0,n:0, ptSkills: [] }).total, 337.37);
/* 포지션 특훈 보너스는 카드 속성이 아니라 배치 효과라, 수동 선수에도 얹힌다 */
eq('수동 선수에도 특훈 보너스 +1',
   calcBat(plLegacy, { skill1: '정밀타격', s1Lv: 8 }, { p:0,a:0,e:0,n:0, ptSkills: ['정밀타격'] }).total, 341.26);
eq('수동 Lv8 + 보너스 = Lv9', effSkillLv('정밀타격', 8, true, '시즌', 1, '타자', ['정밀타격']), 9);
eq('수동 Lv10 은 상한', effSkillLv('정밀타격', 10, true, '시즌', 1, '타자', ['정밀타격']), 10);
eq('수동 Lv6 황금세대는 6에서 멈춤', effSkillLv('황금세대', 6, true, '시즌', 1, '타자', ['황금세대']), 6);
eq('레벨 미설정(0)이면 0', effSkillLv('정밀타격', 0, true, '시즌', 1, '타자', ['정밀타격']), 0);

console.log('\n[자동 레벨이 점수에 반영]');
const plAuto = { hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', sLvManual: false };
const luAuto = { skill1: '정밀타격' };
eq('보너스 없음 = 305 + Lv6(24.59)', calcBat(plAuto, luAuto, { p:0,a:0,e:0,n:0, ptSkills: [] }).total, 329.59);
eq('보너스 있음 = 305 + Lv7(28.48)', calcBat(plAuto, luAuto, { p:0,a:0,e:0,n:0, ptSkills: ['정밀타격'] }).total, 333.48);
const plMan = Object.assign({}, plAuto, { sLvManual: true });
eq('수동은 저장값 유지', calcBat(plMan, { skill1: '정밀타격', s1Lv: 10 }, { p:0,a:0,e:0,n:0, ptSkills: ['정밀타격'] }).total, 345.15);


console.log('\n[세트덱 인내] "타자 +1" 은 파·정·선·인 넷 다 오른다');
var sdBat = function(sp, side, extra){
  var st = {}; if (side) st["s" + sp] = side;
  if (extra) for (var k in extra) st[k] = extra[k];
  return calcSDBonus({ role:"타자", cardType:"시즌", stars:5, year:"2020" }, "DH", st, sp, 8);
};
var sdPit = function(sp, side){
  var st = {}; if (side) st["s" + sp] = side;
  return calcSDBonus({ role:"투수", cardType:"시즌", stars:5, position:"선발" }, "SP1", st, sp);
};
/* 포지션 특훈·유니폼 등이 같이 들어오므로 "고른 것과 안 고른 것의 차이"로 본다 */
eq('40 좌 - 인내도 +1', sdBat(40, "L").n - sdBat(40, "").n, 1);
eq('40 좌 - 파워도 +1', sdBat(40, "L").p - sdBat(40, "").p, 1);
eq('200 좌 - 인내 +2', sdBat(200, "L").n - sdBat(200, "").n, 2);
var atSP = function(sp){ return calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "DH", {}, sp, 8); };
eq('30 자동 - 인내 +1', atSP(30).n - atSP(29).n, 1);
eq('90 자동 - 인내 +2', atSP(90).n - atSP(89).n, 2);
eq('110 자동 - 인내 +1', atSP(110).n - atSP(109).n, 1);
eq('150 자동 - 인내 +2', atSP(150).n - atSP(149).n, 2);
eq('170 자동 - 인내 +1', atSP(170).n - atSP(169).n, 1);
eq('투수는 인내 없음', sdPit(40, "R").n === undefined ? 1 : 0, 1);

console.log('\n[세트덱 95·125] 자동에서 좌우 선택으로');
eq('저장값 없으면 95 는 예전대로 우', sdPick({}, 95) === "R" ? 1 : 0, 1);
eq('저장값 없으면 125 는 예전대로 좌', sdPick({}, 125) === "L" ? 1 : 0, 1);
eq('고르면 그 값', sdPick({ s95:"L" }, 95) === "L" ? 1 : 0, 1);
eq('빈 문자열이면 아무것도 안 켠다', sdPick({ s95:"" }, 95) === "" ? 1 : 0, 1);
/* 95 좌 = 내야+포수 인내 +2, 우 = 외야+지명 선구 +2 */
var in95 = calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "SS", { s95:"L" }, 95, 0);
var of95 = calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "RF", { s95:"L" }, 95, 0);
eq('95 좌 - 내야는 인내 +2', in95.n - calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "SS", { s95:"" }, 95, 0).n, 2);
eq('95 좌 - 외야는 안 받음', of95.n - calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "RF", { s95:"" }, 95, 0).n, 0);
eq('95 우 - 외야 선구 +2', calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "RF", { s95:"R" }, 95, 0).e
   - calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "RF", { s95:"" }, 95, 0).e, 2);
/* 125 좌 = 4성 타자 정·선·인 +2, 우 = 5성 타자 인내 +1 */
var b4 = { role:"타자", cardType:"시즌", stars:4 }, b5 = { role:"타자", cardType:"시즌", stars:5 };
eq('125 좌 - 4성 인내 +2', calcSDBonus(b4, "DH", { s125:"L", s95:"" }, 125, 8).n - calcSDBonus(b4, "DH", { s125:"", s95:"" }, 125, 8).n, 2);
eq('125 우 - 5성 인내 +1', calcSDBonus(b5, "DH", { s125:"R", s95:"" }, 125, 8).n - calcSDBonus(b5, "DH", { s125:"", s95:"" }, 125, 8).n, 1);
eq('125 우 - 4성은 안 받음', calcSDBonus(b4, "DH", { s125:"R", s95:"" }, 125, 8).n - calcSDBonus(b4, "DH", { s125:"", s95:"" }, 125, 8).n, 0);
/* 65 우 = 4성 타자 정확 +2 · 인내 +2 */
eq('65 우 - 4성 타자 정확 +2', calcSDBonus(b4, "DH", { s65:"R", s95:"" }, 65, 8).a - calcSDBonus(b4, "DH", { s65:"", s95:"" }, 65, 8).a, 2);
eq('65 우 - 4성 타자 인내 +2', calcSDBonus(b4, "DH", { s65:"R", s95:"" }, 65, 8).n - calcSDBonus(b4, "DH", { s65:"", s95:"" }, 65, 8).n, 2);
/* 155 = 1~2번 파·선·인 +2 / 175 = 타자 파·선·인 +1 */
eq('155 좌 - 1번타자 인내 +2', calcSDBonus(b5, "C", { s155:"L", s95:"" }, 155, 0).n - calcSDBonus(b5, "C", { s155:"", s95:"" }, 155, 0).n, 2);
eq('155 좌 - 3번타자는 안 받음', calcSDBonus(b5, "C", { s155:"L", s95:"" }, 155, 2).n - calcSDBonus(b5, "C", { s155:"", s95:"" }, 155, 2).n, 0);
/* 포지션 특훈 레벨 0 = 보너스 없음. 예전엔 || 때문에 만렙으로 둔갑했다 */
var ptAt = function(lv){ var st = { s95:"", s125:"" }; if (lv !== null) st.pt_DH = { level: lv, r0:0, r1:0, r2:0, r3:0 };
  return calcSDBonus({ role:"타자", cardType:"시즌", stars:5 }, "DH", st, 0, 8); };
console.log('\n[국가대표 전용 스킬] 표에 Lv7 이상 값이 없으면 국대 전용이다');
eq('황금세대는 Lv6 상한', maxSkillLv('황금세대', '타자'), 6);
eq('빈틈없는타선도 국대 전용', isNatOnlySkill('빈틈없는타선(타순O)', '타자') ? 1 : 0, 1);
eq('타순공략(투수)도 국대 전용', isNatOnlySkill('타순공략', '선발') ? 1 : 0, 1);
eq('정밀타격은 아니다', isNatOnlySkill('정밀타격', '타자') ? 1 : 0, 0);
/* 포지션 특훈 +1 이 상한을 넘기지 못한다 */
eq('국대 스킬은 보너스를 받아도 6', effSkillLv('황금세대', 6, true, '국가대표', 1, '타자', ['황금세대']), 6);
eq('일반 스킬은 보너스로 7', effSkillLv('정밀타격', 6, true, '국가대표', 1, '타자', ['정밀타격']), 7);
/* 수동으로 Lv10 을 적어도 국대 스킬은 6 으로 깎인다 */
eq('수동 Lv10 도 6 으로', effSkillLv('황금세대', 10, true, '시그니처', 1, '타자', []), 6);
eq('자동 레벨도 6 상한', autoSkillLv('황금세대', '올스타', 1, '타자', []), 6);
/* 국민계투 도 Lv6 상한 — 국대 전용으로 분류된다 */
eq('국민계투 국대 전용', isNatOnlySkill('국민계투', '중계') ? 1 : 0, 1);
eq('해결사 국대 전용', isNatOnlySkill('해결사', '마무리') ? 1 : 0, 1);
/* 표 끝이 비었다고 다 국대는 아니다 — 패기(임팩)은 Lv8 까지 값이 있다 */
eq('패기(임팩)은 국대 아님', isNatOnlySkill('패기(임팩)', '타자') ? 1 : 0, 0);

console.log('\n[포지션 제한 스킬] 해당 포지션에만 뜬다');
eq('포수리드는 포수만', skillAllowedAt('포수리드(버프포함)', '타자', false) ? 1 : 0, 0);
eq('포수면 뜬다', skillAllowedAt('포수리드(버프포함)', '타자', true) ? 1 : 0, 1);
eq('마당쇠는 선발에 안 뜬다', skillAllowedAt('마당쇠(불펜)', '선발', false) ? 1 : 0, 0);
eq('마당쇠는 중계에 뜬다', skillAllowedAt('마당쇠(불펜)', '중계', false) ? 1 : 0, 1);
eq('집념은 선발만', skillAllowedAt('집념', '중계', false) ? 1 : 0, 0);
eq('라이징스타는 마무리에 안 뜬다', skillAllowedAt('라이징스타(추격조)', '마무리', false) ? 1 : 0, 0);
eq('국민계투는 선발에 안 뜬다', skillAllowedAt('국민계투', '선발', false) ? 1 : 0, 0);
eq('제한 없는 스킬은 어디서나', skillAllowedAt('정밀타격', '타자', false) ? 1 : 0, 1);

console.log('%s[조건부 변형] 그 선수에게 실제로 뜨는 하나만 풀에 넣는다');
var cB = function(h, buff){ return { hand:h, cardType:"골든글러브", cat:"타자", catchBuff:!!buff }; };
var cP = function(h, ct, cat){ return { hand:h, cardType:ct||"골든글러브", cat:cat||"선발" }; };
eq('우타는 스위치히터(우타)만', variantAllowed('스위치히터(우타)', cB('우')) ? 1 : 0, 1);
eq('우타에 양타는 안 뜬다', variantAllowed('스위치히터(양타)', cB('우')) ? 1 : 0, 0);
eq('양타는 양타만', variantAllowed('스위치히터(양타)', cB('양')) ? 1 : 0, 1);
eq('좌투는 좌승사자(좌투)', variantAllowed('좌승사자(좌투)', cP('좌')) ? 1 : 0, 1);
eq('우투에 좌승사자(좌투) 안 뜬다', variantAllowed('좌승사자(좌투)', cP('우')) ? 1 : 0, 0);
/* 고정 가정 — 주루·지구력 2구간, 타순·선발 배치, 5성 */
eq('5툴플레이어는 267274 만', variantAllowed('5툴플레이어(267274)', cB('우')) ? 1 : 0, 1);
eq('5툴플레이어 275299 는 제외', variantAllowed('5툴플레이어(275299)', cB('우')) ? 1 : 0, 0);
eq('철완은 134139 만', variantAllowed('철완(134139)', cP('우')) ? 1 : 0, 1);
eq('선봉장은 타순배치+주루2구간', variantAllowed('선봉장(타순배치,주루130~141)', cB('우')) ? 1 : 0, 1);
eq('선봉장 미배치는 제외', variantAllowed('선봉장(타순배치X,주루142+)', cB('우')) ? 1 : 0, 0);
eq('핵타선은 타순O', variantAllowed('핵타선(타순O)', cB('우')) ? 1 : 0, 1);
eq('원투펀치는 배치O', variantAllowed('원투펀치(배치O)', cP('우')) ? 1 : 0, 1);
eq('도전정신은 5성', variantAllowed('도전정신(5성)', cB('우')) ? 1 : 0, 1);
/* 패기는 카드종류·역할로 갈린다 */
eq('타자 임팩 패기', pickPaegi('타자', '임팩트') === '패기(임팩)' ? 1 : 0, 1);
eq('중계 임팩 패기는 불펜', pickPaegi('중계', '임팩트') === '패기(임팩불펜)' ? 1 : 0, 1);
eq('선발 시그 패기', pickPaegi('선발', '시그니처') === '패기(시그/올스타선발)' ? 1 : 0, 1);
/* 포수리드는 이름으로 고정하지 않는다 — 버프 포함 여부는 getSkillScore 의 withBuff 가 정한다.
   목록에서는 skillPickable 이 버프포함본을 숨기므로 뽑기 풀에는 '포수리드' 하나만 남는다 */
eq('포수리드는 이름 고정 안 함', variantAllowed('포수리드', cB('우')) ? 1 : 0, 1);
eq('버프포함본은 목록에서 숨김', skillPickable('포수리드(버프포함)', '타자') ? 1 : 0, 0);
eq('조건 없는 스킬은 통과', variantAllowed('정밀타격', cB('우')) ? 1 : 0, 1);

console.log('\n[분포 조회] 미리 구운 분위수에서 상위 % 를 뽑는다');
/* 0,1,2,...,100 을 101개 분위점으로 둔 배열 — 값 v 의 상위 % 는 100-v 여야 한다 */
var d101 = []; for (var _i = 0; _i <= 100; _i++) d101.push(_i);
eq('중앙값은 상위 50%', pctFromDist(d101, 50), 50);
/* "상위 0%" 는 말이 안 되므로 바닥을 0.1 로 둔다 */
eq('최댓값은 상위 0.1%', pctFromDist(d101, 100), 0.1);
eq('최솟값은 상위 100%', pctFromDist(d101, 0), 100);
eq('범위를 넘으면 0.1%', pctFromDist(d101, 999), 0.1);
eq('범위 아래면 100%', pctFromDist(d101, -5), 100);
eq('사이값은 보간', pctFromDist(d101, 90), 10);
eq('빈 배열이면 null', pctFromDist([], 5) === null ? 1 : 0, 1);
eq('히스토그램 20구간', histFromDist(d101, 20).length, 20);
eq('히스토그램 합 = 100%', Math.round(histFromDist(d101, 20).reduce(function(a,b){return a+b.pct;},0)), 100);
eq('분포 키', skillDistKey('타자','임팩트','좌',false) === '타자|임팩트|좌|-' ? 1 : 0, 1);
eq('포수는 키가 다르다', skillDistKey('타자','임팩트','좌',true) === '타자|임팩트|좌|포수' ? 1 : 0, 1);
eq('투수는 포수 구분 없음', skillDistKey('선발','임팩트','좌',true) === '선발|임팩트|좌|-' ? 1 : 0, 1);

console.log('\n[슬롯 자리 판정] 앱의 패전조 = 스킬의 추격조');
eq('2/2/2 RP1 은 승리조', slotGroupOf('RP1', 4, false) === '승리조' ? 1 : 0, 1);
eq('2/2/2 RP3 은 패전조', slotGroupOf('RP3', 4, false) === '패전조' ? 1 : 0, 1);
eq('2/2/2 RP5 은 롱릴리프', slotGroupOf('RP5', 4, false) === '롱릴리프' ? 1 : 0, 1);
eq('CP 는 마무리', slotGroupOf('CP', 4, false) === '마무리' ? 1 : 0, 1);
eq('SP1 은 선발', slotGroupOf('SP1', 4, false) === '선발' ? 1 : 0, 1);
eq('3/3/0 분업이면 RP1 은 셋업', slotGroupOf('RP1', 8, true) === '셋업' ? 1 : 0, 1);
eq('분업 꺼져 있으면 승리조', slotGroupOf('RP1', 8, false) === '승리조' ? 1 : 0, 1);

console.log('\n[자리 불일치] 라인업을 옮기면 조용히 틀어지는 것을 잡는다');
eq('승리조에 긴급투입(추격조)', skillSlotHint('긴급투입(추격조)', '승리조', '중계') === '긴급투입(필승조/마무리)' ? 1 : 0, 1);
eq('패전조면 맞다', skillSlotHint('긴급투입(추격조)', '패전조', '중계') === '' ? 1 : 0, 1);
eq('승리조에 수호신(셋업2)', skillSlotHint('수호신(셋업2)', '승리조', '중계') === '수호신(승리조)' ? 1 : 0, 1);
eq('셋업에 수호신(승리조)', skillSlotHint('수호신(승리조)', '셋업', '중계') === '수호신(셋업2)' ? 1 : 0, 1);
eq('불펜에 마당쇠(선발)', skillSlotHint('마당쇠(선발)', '패전조', '중계') === '마당쇠(불펜)' ? 1 : 0, 1);
eq('조건 괄호는 자리가 아니다', skillSlotHint('철완(134139)', '승리조', '중계') === '' ? 1 : 0, 1);
eq('괄호 없는 스킬도 통과', skillSlotHint('파이어볼', '승리조', '중계') === '' ? 1 : 0, 1);
eq('타자는 검사하지 않는다', skillSlotHint('컨택트히터(타순배치)', '타자', '타자') === '' ? 1 : 0, 1);

console.log('\n[배치 자리별 변형] 포지션마다 대표 자리 하나로 고정한다');
var vc = function(cat){ return { hand:"우", cardType:"골든글러브", cat:cat }; };
eq('중계 수호신은 승리조', variantAllowed('수호신(승리조)', vc('중계')) ? 1 : 0, 1);
eq('중계 수호신 셋업2는 제외', variantAllowed('수호신(셋업2)', vc('중계')) ? 1 : 0, 0);
eq('중계 긴급투입은 추격조', variantAllowed('긴급투입(추격조)', vc('중계')) ? 1 : 0, 1);
eq('중계 승리의함성은 필승조', variantAllowed('승리의함성(필승조)', vc('중계')) ? 1 : 0, 1);
eq('중계 기선제압은 셋업제외', variantAllowed('기선제압(셋업제외불펜)', vc('중계')) ? 1 : 0, 1);
eq('선발 라이징스타는 3~5선발', variantAllowed('라이징스타(3~5선발)', vc('선발')) ? 1 : 0, 1);
eq('마무리 타선지원은 (마무리)', variantAllowed('타선지원(마무리)', vc('마무리')) ? 1 : 0, 1);
eq('마무리 수호신은 그대로', variantAllowed('수호신(마무리)', vc('마무리')) ? 1 : 0, 1);

console.log('\n[역할별 변형] 포지션을 고르면 그 역할 변형만 남는다');
var pool = function(names, pos){ return names.filter(function(n){ return skillAllowedAt(n, pos, false); }); };
var 기선 = ['기선제압(선발)','기선제압(셋업/마무리)','기선제압(셋업제외불펜)'];
eq('선발은 (선발) 하나', pool(기선, '선발').join('|') === '기선제압(선발)' ? 1 : 0, 1);
eq('마무리는 (셋업/마무리) 하나', pool(기선, '마무리').join('|') === '기선제압(셋업/마무리)' ? 1 : 0, 1);
eq('중계는 둘 — 셋업 여부로 갈린다', pool(기선, '중계').length, 2);
var 수호 = ['수호신(선발)','수호신(셋업1)','수호신(셋업2)','수호신(승리조)','수호신(추격조/롱릴리프)','수호신(마무리)'];
eq('수호신 선발은 1개', pool(수호, '선발').length, 1);
eq('수호신 마무리는 1개', pool(수호, '마무리').length, 1);
eq('수호신 중계는 4개', pool(수호, '중계').length, 4);
eq('긴급투입 추격조는 선발에 안 뜬다', skillAllowedAt('긴급투입(추격조)', '선발', false) ? 1 : 0, 0);
/* 역할이 아닌 괄호는 걸러지면 안 된다 */
eq('철완 구간은 역할이 아니다', skillRoleOf('철완(134139)') === null ? 1 : 0, 1);
eq('좌투는 역할이 아니다', skillRoleOf('좌승사자(좌투)') === null ? 1 : 0, 1);
eq('4성도 역할이 아니다', skillRoleOf('도전정신(4성)') === null ? 1 : 0, 1);
eq('카드종류 접두는 떼고 본다', skillRoleOf('패기(임팩불펜)').join(',').indexOf('중계') >= 0 ? 1 : 0, 1);
eq('타자 괄호는 역할 취급 안 함', skillAllowedAt('컨택트히터(타순배치)', '타자', false) ? 1 : 0, 1);

console.log('\n[메이저 분류] 확정본');
eq('타자 메이저 75개', Object.keys(DEFAULT_MAJOR['타자']).length, 75);
eq('선발 메이저 59개', Object.keys(DEFAULT_MAJOR['선발']).length, 59);
/* 검토에서 잡힌 두 건 — 킬러 계열은 전부 일반, 흐름끊기는 역할 전부 메이저 */
eq('우완킬러 일반', DEFAULT_MAJOR['타자']['우완킬러'] ? 1 : 0, 0);
eq('좌완킬러도 일반', DEFAULT_MAJOR['타자']['좌완킬러'] ? 1 : 0, 0);
eq('우타킬러(좌투) 일반', DEFAULT_MAJOR['선발']['우타킬러(좌투)'] ? 1 : 0, 0);
eq('흐름끊기(선발) 메이저', DEFAULT_MAJOR['선발']['흐름끊기(선발)'] ? 1 : 0, 1);
eq('흐름끊기(셋업/마무리) 메이저', DEFAULT_MAJOR['중계']['흐름끊기(셋업/마무리)'] ? 1 : 0, 1);
eq('스위치히터(양타) 메이저', DEFAULT_MAJOR['타자']['스위치히터(양타)'] ? 1 : 0, 1);
eq('포수리드(버프포함) 메이저', DEFAULT_MAJOR['타자']['포수리드(버프포함)'] ? 1 : 0, 1);
eq('타선연결은 비메이저', DEFAULT_MAJOR['타자']['타선연결'] ? 1 : 0, 0);
eq('투수 타순공략 메이저', DEFAULT_MAJOR['선발']['타순공략'] ? 1 : 0, 1);
eq('투수 평정심은 비메이저', DEFAULT_MAJOR['선발']['평정심'] ? 1 : 0, 0);

eq('포특 레벨 0 이면 파워 보너스 없음', ptAt(0).p, 0);
eq('포특 레벨 0 이면 인내 보너스 없음', ptAt(0).n, 0);
eq('포특 레벨 안 정했으면 만렙', ptAt(null).p, ptAt(20).p);
eq('포특 만렙 DH 인내 +7', ptAt(20).n, 7);
eq('175 좌 - 타자 인내 +1', calcSDBonus(b5, "DH", { s175:"L", s95:"" }, 175, 8).n - calcSDBonus(b5, "DH", { s175:"", s95:"" }, 175, 8).n, 1);

console.log('\n[POTM] 전역 명단 + 덱별 사용자 설정');
const potmPl = { name: '홍길동', team: '키움', cardType: '라이브', stars: 5 };
eq('키 형식', potmKey(potmPl) === '홍길동|키움' ? 1 : 0, 1);
__setGlobalPotm([{ name: '홍길동', team: '키움' }]);
eq('전역 POTM 인정', isPotmFor(potmPl, {}) ? 1 : 0, 1);
eq('라이브 5성 보너스', getPotmBonus(potmPl, { teamName: '키움' }), 6);
eq('구단 다르면 0', getPotmBonus(potmPl, { teamName: '삼성' }), 0);
/* 유저가 끄면 이 덱에서는 POTM 이 아니다 */
eq('사용자 해제', getPotmBonus(potmPl, { teamName: '키움', potmOff: ['홍길동|키움'] }), 0);
/* 전역에 없어도 유저가 켜면 POTM */
__setGlobalPotm([]);
eq('전역에 없으면 0', getPotmBonus(potmPl, { teamName: '키움' }), 0);
eq('사용자 지정', getPotmBonus(potmPl, { teamName: '키움', potmOn: ['홍길동|키움'] }), 6);
eq('사용자 지정도 구단 일치 필요', getPotmBonus(potmPl, { teamName: '삼성', potmOn: ['홍길동|키움'] }), 0);
/* 끄기가 켜기보다 우선 */
eq('해제가 우선', getPotmBonus(potmPl, { teamName: '키움', potmOn: ['홍길동|키움'], potmOff: ['홍길동|키움'] }), 0);
/* 카드 종류별 보너스 */
eq('임팩트', getPotmBonus({ name: 'A', team: '키움', cardType: '임팩트' }, { teamName: '키움', potmOn: ['A|키움'] }), 2);
eq('골든글러브', getPotmBonus({ name: 'A', team: '키움', cardType: '골든글러브' }, { teamName: '키움', potmOn: ['A|키움'] }), 1);
eq('라이브 4성', getPotmBonus({ name: 'A', team: '키움', cardType: '라이브', stars: 4 }, { teamName: '키움', potmOn: ['A|키움'] }), 12);
__setGlobalPotm([]);


console.log('\n[팀 버프 스킬] 라인업은 버프 뺀 값, 데이터센터는 넣은 값');
eq('포수리드 버프X', getSkillScore('포수리드', 5, '타자'), 5);
eq('포수리드 버프O', getSkillScore('포수리드', 5, '타자', true), 13.51);
/* 어느 쪽 이름이 저장돼 있든 결과가 같아야 마이그레이션이 필요 없다 */
eq('구 이름도 버프X 로', getSkillScore('포수리드(버프포함)', 5, '타자'), 5);
eq('구 이름도 버프O 로', getSkillScore('포수리드(버프포함)', 5, '타자', true), 13.51);
eq('Lv10 버프O', getSkillScore('포수리드', 10, '타자', true), 46.46);
/* 버프포함 항목은 고를 수 있는 선택지가 아니다 */
eq('버프포함은 목록에서 숨김', skillPickable('포수리드(버프포함)', '타자') ? 1 : 0, 0);
eq('포수리드는 고를 수 있다', skillPickable('포수리드', '타자') ? 1 : 0, 1);
eq('다른 스킬은 그대로', skillPickable('정밀타격', '타자') ? 1 : 0, 1);
eq('버프 없는 스킬은 양쪽 같음',
   getSkillScore('정밀타격', 7, '타자', true) - getSkillScore('정밀타격', 7, '타자'), 0);

console.log('\n[패기(임팩)] Lv9/10 이 채워졌다');
eq('Lv8', getSkillScore('패기(임팩)', 8, '타자'), 14.4);
eq('Lv9', getSkillScore('패기(임팩)', 9, '타자'), 15.84);
eq('Lv10', getSkillScore('패기(임팩)', 10, '타자'), 17.28);
eq('이제 국대로 오인 안 함', isNatOnlySkill('패기(임팩)', '타자') ? 1 : 0, 0);

console.log('\n[국대 오배치 경고]');
eq('시그에 황금세대는 경고', natSkillMismatch('황금세대', '타자', '시그니처') ? 1 : 0, 1);
eq('국대면 경고 없음', natSkillMismatch('황금세대', '타자', '국가대표') ? 1 : 0, 0);
eq('일반 스킬은 경고 없음', natSkillMismatch('정밀타격', '타자', '시그니처') ? 1 : 0, 0);


console.log('\n[띄어쓰기 다른 옛 이름] 표에서 못 찾아 0점 되던 것을 맞춰준다');
eq('"포수 리드" 도 찾는다', getSkillScore('포수 리드', 6, '타자'), 6);
eq('버프도 같이 돈다', getSkillScore('포수 리드', 6, '타자', true), 25.44);
eq('공백 여러 개도', getSkillScore('포 수 리 드', 6, '타자'), 6);
eq('반대로 붙여 쓴 것도', getSkillScore('국대테이블세터', 6, '타자'), 22.9);
eq('역할별 표기가 갈린 것도', getSkillScore('약속의8회', 6, '선발'), 15.12);
eq('maxSkillLv 도', maxSkillLv('포수 리드', '타자'), 10);
eq('국대 판정도', isNatOnlySkill('황금 세대', '타자') ? 1 : 0, 1);
/* 없는 이름은 여전히 0 이어야 한다 — 아무 이름이나 붙는 일은 없어야 */
eq('없는 이름은 그대로 0', getSkillScore('없는스킬입니다', 6, '타자'), 0);
eq('정확히 있는 이름은 그대로', canonSkillName('정밀타격', '타자') === '정밀타격' ? 1 : 0, 1);


console.log('\n[중계 전술] 적극 = 승리조·추격조 +1 / 분업 = 승리조만 +2');
var rp = { role:"투수", position:"중계", cardType:"시즌", stars:5 };
/* 2/2/2 편성(bpcIdx 4) → RP1,RP2 가 승리조 */
var off = { bpcIdx:4, s95:"", s125:"" };
var on  = { bpcIdx:4, s95:"", s125:"", rpActive:true };
eq('승리조 RP1 변화 +1', calcSDBonus(rp,"RP1",on,0).c - calcSDBonus(rp,"RP1",off,0).c, 1);
eq('승리조 RP1 구위 +1', calcSDBonus(rp,"RP1",on,0).s - calcSDBonus(rp,"RP1",off,0).s, 1);
eq('승리조 RP2 도 오름', calcSDBonus(rp,"RP2",on,0).s - calcSDBonus(rp,"RP2",off,0).s, 1);
eq('추격조 RP3 도 +1', calcSDBonus(rp,"RP3",on,0).s - calcSDBonus(rp,"RP3",off,0).s, 1);
eq('롱릴리프 RP5 는 안 받음', calcSDBonus(rp,"RP5",on,0).s - calcSDBonus(rp,"RP5",off,0).s, 0);
var cp = { role:"투수", position:"마무리", cardType:"시즌", stars:5 };
eq('마무리는 안 받음', calcSDBonus(cp,"CP",on,0).s - calcSDBonus(cp,"CP",off,0).s, 0);
var sp = { role:"투수", position:"선발", cardType:"시즌", stars:5 };
eq('선발도 안 받음', calcSDBonus(sp,"SP1",on,0).s - calcSDBonus(sp,"SP1",off,0).s, 0);
var bat = { role:"타자", cardType:"시즌", stars:5 };
eq('타자는 무관', calcSDBonus(bat,"C",on,0,0).p - calcSDBonus(bat,"C",off,0,0).p, 0);
/* 편성이 바뀌면 승리조 자리도 바뀐다 — 3/1/2(bpcIdx 6) 이면 RP3 까지 승리조 */
var on3 = { bpcIdx:6, s95:"", s125:"", rpActive:true };
var off3 = { bpcIdx:6, s95:"", s125:"" };
eq('3/1/2 면 RP3 도 승리조', calcSDBonus(rp,"RP3",on3,0).s - calcSDBonus(rp,"RP3",off3,0).s, 1);
eq('3/1/2 의 RP4 는 추격조라 +1', calcSDBonus(rp,"RP4",on3,0).s - calcSDBonus(rp,"RP4",off3,0).s, 1);
eq('3/1/2 의 RP5 는 롱릴이라 0', calcSDBonus(rp,"RP5",on3,0).s - calcSDBonus(rp,"RP5",off3,0).s, 0);
/* 분업 — 승리조만 +2. 추격조·롱릴·마무리는 받지 않는다 */
var onSplit = { bpcIdx:6, s95:"", s125:"", isWinSplit:true };
eq('분업이면 승리조 +2', calcSDBonus(rp,"RP1",onSplit,0).s - calcSDBonus(rp,"RP1",off3,0).s, 2);
eq('분업이면 3번째 승리조도 +2', calcSDBonus(rp,"RP3",onSplit,0).s - calcSDBonus(rp,"RP3",off3,0).s, 2);
eq('분업은 추격조를 안 올린다', calcSDBonus(rp,"RP4",onSplit,0).s - calcSDBonus(rp,"RP4",off3,0).s, 0);
eq('분업은 마무리도 안 올린다', calcSDBonus(cp,"CP",onSplit,0).s - calcSDBonus(cp,"CP",off3,0).s, 0);
eq('승리조 판정 자체', isWinGroupSlot("RP1", 4) ? 1 : 0, 1);
eq('RP3 은 2/2/2 에서 승리조 아님', isWinGroupSlot("RP3", 4) ? 1 : 0, 0);
eq('CP 는 승리조 아님', isWinGroupSlot("CP", 4) ? 1 : 0, 0);
eq('RP4 는 3/1/2 에서 패전조', rpGroupOf("RP4", 6) === "패전조" ? 1 : 0, 1);
eq('RP5 는 3/1/2 에서 롱릴리프', rpGroupOf("RP5", 6) === "롱릴리프" ? 1 : 0, 1);
eq('CP 는 불펜조가 아님', rpGroupOf("CP", 6) === "" ? 1 : 0, 1);

console.log('\n[타순 가중치] 자리의 값 — 3~4번이 정점, 6번부터 내려간다');
eq('1~2번 1.100', batMult(0), 1.100);
eq('3~4번 1.150', batMult(2), 1.150);
eq('5번 1.000', batMult(4), 1.000);
eq('6~7번 0.900', batMult(5), 0.900);
eq('8~9번 0.850', batMult(8), 0.850);
eq('타순 가중치 합', Math.round(BAT_MULT.reduce(function(a,b){return a+b;},0)*1000)/1000, 9.000);
/* 5번이 1~2번보다 낮다 — 클린업을 3~4번으로 좁힌 결과다 */
eq('5번 < 1번', batMult(4) < batMult(0) ? 1 : 0, 1);

console.log('\n[강함 가중치] 라인업 안에서 점수 높은 순으로 곱한다');
eq('1~2위 1.350', strMult(0), 1.350);
eq('3~5위 1.200', strMult(4), 1.200);
eq('6~7위 1.000', strMult(6), 1.000);
eq('8~9위 0.850', strMult(8), 0.850);
eq('강함 가중치 합', Math.round(STR_MULT.reduce(function(a,b){return a+b;},0)*1000)/1000, 10.000);
/* 순위 매기기 — 점수가 같으면 앞선 자리가 위로 간다 */
eq('가장 강한 자리가 0위', strRanks([300,500,400])[1], 0);
eq('가장 약한 자리가 꼴찌', strRanks([300,500,400])[0], 2);
eq('동점이면 앞자리 우선', strRanks([400,400])[0], 0);
eq('빈 자리(0점)는 꼴찌', strRanks([0,350,340])[0], 2);
/* 최적 배치에서 타순 x 강함 합 */
var sortedOrd = BAT_MULT.slice().sort(function(a,b){ return b-a; });
/* 투수 10.00 보다 1.9% 높다 — 배치를 잘 한 덱이 그만큼 대우받게 한 확인된 값이다 */
eq('최적 배치 Σ(타순x강함)',
   Math.round(sortedOrd.reduce(function(t,w,i){ return t + w*STR_MULT[i]; },0)*1000)/1000, 10.190);
/* 최대 = 최강 타자를 3번에 / 최소 = 최약 타자를 8~9번에 */
eq('최대 배율', Math.round(Math.max.apply(null,BAT_MULT)*Math.max.apply(null,STR_MULT)*10000)/10000, 1.5525);
eq('최소 배율', Math.round(Math.min.apply(null,BAT_MULT)*Math.min.apply(null,STR_MULT)*10000)/10000, 0.7225);
eq('최대/최소 비', Math.round(1.5525/0.7225*100)/100, 2.15);


console.log('\n[투수 가중치] 총합 10 · 마무리 0.8 고정 · 선발이 깎인 만큼 중계가 가져간다');
var RPS = ["RP1","RP2","RP3","RP4","RP5","RP6"];
var sumSP = function(t){ var a=SP_MULT[t], s=0; for(var i=0;i<a.length;i++) s+=a[i]; return s; };
var sumRP = function(i,t){ var s=0; RPS.forEach(function(sl){ s+=getRPWeight(i,sl,t); }); return s; };
eq('선발 기본 합 7.00', sumSP('기본'), 7);
eq('선발 적극 합 6.66', sumSP('적극'), 6.66);
eq('선발 분업 합 6.331', sumSP('분업'), 6.331);
eq('중계 기본 몫', Math.round(sumRP(4,'기본')*1000)/1000, 2.2);
eq('중계 적극 몫', Math.round(sumRP(4,'적극')*1000)/1000, 2.54);
eq('중계 분업 몫', Math.round(sumRP(6,'분업')*1000)/1000, 2.87);
/* 편성 11종 어디서나 총합이 예산과 맞아야 한다 */
for (var bi = 0; bi < 11; bi++) {
  eq('편성 ' + bi + ' 기본 합', Math.round(sumRP(bi,'기본')*1000)/1000, 2.2);
  eq('편성 ' + bi + ' 적극 합', Math.round(sumRP(bi,'적극')*1000)/1000, 2.54);
}
/* 투수 전체 합 = 10 */
eq('투수 총합 기본', Math.round((sumSP('기본') + sumRP(4,'기본') + 0.8)*1000)/1000, 10);
eq('투수 총합 적극', Math.round((sumSP('적극') + sumRP(4,'적극') + 0.8)*1000)/1000, 10);
/* 분업은 중계 몫을 2.869 가 아니라 2.870 으로 적어 총합이 10.001 이다 (0.01%, 그대로 둔다) */
eq('투수 총합 분업', Math.round((sumSP('분업') + sumRP(6,'분업') + 0.8)*1000)/1000, 10.001);
/* 전술 표는 자리마다 손으로 잡은 값이라 "승리조만 커진다" 같은 규칙은 없다.
   총 몫이 커진다는 것과, 분업에서 승리조 순서가 뒤집힌다는 것만 고정한다. */
eq('적극이면 중계 몫이 커진다', sumRP(4,'적극') > sumRP(4,'기본') ? 1 : 0, 1);
eq('분업이면 더 커진다', sumRP(6,'분업') > sumRP(6,'적극') ? 1 : 0, 1);
eq('편성마다 값이 다르다', getRPWeight(0,'RP2','기본') === getRPWeight(3,'RP2','기본') ? 1 : 0, 0);
eq('없는 분업 표는 기본으로 떨어진다', getRPWeight(4,'RP1','분업'), getRPWeight(4,'RP1','기본'));
/* 분업은 승리조 순서가 뒤집힌다 (셋업 배치) */
eq('분업이면 3번째 승리조가 가장 큼', getRPWeight(6,'RP3','분업') > getRPWeight(6,'RP1','분업') ? 1 : 0, 1);
eq('기본이면 1번째가 가장 큼', getRPWeight(6,'RP1','기본') > getRPWeight(6,'RP3','기본') ? 1 : 0, 1);
/* 전술 판정 */
eq('아무것도 아니면 기본', rpTactic({}) === '기본' ? 1 : 0, 1);
eq('rpActive 면 적극', rpTactic({rpActive:true}) === '적극' ? 1 : 0, 1);
/* 분업은 승리조 3명 편성(6,7,8 = 3/1/2, 3/2/1, 3/3/0)에서만 성립한다 */
eq('3/1/2 + isWinSplit 이면 분업', rpTactic({isWinSplit:true, bpcIdx:6}) === '분업' ? 1 : 0, 1);
eq('분업이 적극보다 우선', rpTactic({isWinSplit:true, rpActive:true, bpcIdx:6}) === '분업' ? 1 : 0, 1);
/* 시트 가져오기가 2/4/0 + 분업 같은 조합을 넣어도 편성이 이기게 한다.
   안 걸러내면 선발만 분업 배율(6.331)을 쓰고 중계는 기본(2.200)으로 떨어져
   투수 합이 9.331 이 된다. */
eq('2/4/0 + isWinSplit 이면 기본', rpTactic({isWinSplit:true, bpcIdx:9}) === '기본' ? 1 : 0, 1);
eq('2/4/0 + 분업 + 적극이면 적극', rpTactic({isWinSplit:true, rpActive:true, bpcIdx:9}) === '적극' ? 1 : 0, 1);
/* 어떤 편성/전술 조합이 와도 투수 합은 10 근처여야 한다 */
for (var bpc = 0; bpc < 11; bpc++) {
  for (var fl = 0; fl < 4; fl++) {
    var st = { bpcIdx: bpc, isWinSplit: !!(fl & 1), rpActive: !!(fl & 2) };
    var tac = rpTactic(st);
    var tot = sumSP(tac) + sumRP(bpc, tac) + 0.8;
    eq('편성' + bpc + ' 분업' + (fl&1?'O':'X') + ' 적극' + (fl&2?'O':'X') + ' 합',
       Math.round(tot * 10) / 10, 10);
  }
}
/* 선발 배율 */
eq('1선발 기본', spMult('기본',0), 1.5);
eq('5선발 분업', spMult('분업',4), 1.18);


console.log('\n[선수 개명] 옛 이름으로 적힌 시트·도감도 같은 선수로 본다');
eq('벤릭 → 벤자민', canonPlayerName('벤릭') === '벤자민' ? 1 : 0, 1);
eq('로우먼 → 로건S', canonPlayerName('로우먼') === '로건S' ? 1 : 0, 1);
eq('새 이름은 그대로', canonPlayerName('벤자민') === '벤자민' ? 1 : 0, 1);
eq('앞뒤 공백 제거', canonPlayerName('  벤릭 ') === '벤자민' ? 1 : 0, 1);
eq('상관없는 이름은 그대로', canonPlayerName('김도영') === '김도영' ? 1 : 0, 1);
eq('빈 값은 빈 값', canonPlayerName('') === '' ? 1 : 0, 1);
eq('null 도 안전', canonPlayerName(null) === '' ? 1 : 0, 1);
/* 비슷한 이름을 잘못 끌어오지 않는지 — 로건B 는 다른 선수다 */
eq('로건B 는 건드리지 않는다', canonPlayerName('로건B') === '로건B' ? 1 : 0, 1);

/* 2026-09 개명 — 같은 선수는 어느 카드에서든 이름이 하나여야 한다 */
eq('조용호 → 조용호S', canonPlayerName('조용호') === '조용호S' ? 1 : 0, 1);
eq('조용호S 는 그대로', canonPlayerName('조용호S') === '조용호S' ? 1 : 0, 1);
eq('레이예스 → 레이예스S', canonPlayerName('레이예스') === '레이예스S' ? 1 : 0, 1);
eq('레이예스S 는 그대로', canonPlayerName('레이예스S') === '레이예스S' ? 1 : 0, 1);

/* 이진영은 동명이인이라 팀으로 갈린다 — 한화가 S, 나머지가 B */
eq('이진영 + 한화 → 이진영S', canonPlayerName('이진영', '한화') === '이진영S' ? 1 : 0, 1);
eq('이진영 + SSG → 이진영B', canonPlayerName('이진영', 'SSG') === '이진영B' ? 1 : 0, 1);
eq('이진영 + LG → 이진영B', canonPlayerName('이진영', 'LG') === '이진영B' ? 1 : 0, 1);
eq('이진영 + KT → 이진영B', canonPlayerName('이진영', 'KT') === '이진영B' ? 1 : 0, 1);
eq('팀을 모르면 이진영B', canonPlayerName('이진영') === '이진영B' ? 1 : 0, 1);
eq('이진영B 는 팀을 줘도 그대로', canonPlayerName('이진영B', '한화') === '이진영B' ? 1 : 0, 1);
eq('이진영S 는 팀을 줘도 그대로', canonPlayerName('이진영S', 'SSG') === '이진영S' ? 1 : 0, 1);
/* 팀 인자는 다른 이름에 영향이 없어야 한다 */
eq('팀 인자가 벤릭을 흔들지 않는다', canonPlayerName('벤릭', '한화') === '벤자민' ? 1 : 0, 1);

/* 팀이 안 적힌 보관함 시트는 두 이진영을 다 후보로 봐야 한다 */
eq('이진영B 무리는 둘', playerNameGroup('이진영B').length, 2);
eq('이진영S 도 같은 무리', playerNameGroup('이진영S').join('|') === '이진영B|이진영S' ? 1 : 0, 1);
eq('보통 선수는 무리가 자기 하나', playerNameGroup('김도영').join('|') === '김도영' ? 1 : 0, 1);
eq('개명한 선수도 무리는 자기 하나', playerNameGroup('벤자민').length, 1);

/* 2026-09 접미사 정리 — 도감 44명. 대표만 짚어 본다 */
eq('양현종 → 양현종B', canonPlayerName('양현종') === '양현종B' ? 1 : 0, 1);
eq('김태균 → 김태균S', canonPlayerName('김태균') === '김태균S' ? 1 : 0, 1);
eq('마틴 → 마틴C', canonPlayerName('마틴') === '마틴C' ? 1 : 0, 1);
eq('이상훈 → 이상훈C', canonPlayerName('이상훈') === '이상훈C' ? 1 : 0, 1);
eq('페르난데스 → 페르난데스S', canonPlayerName('페르난데스') === '페르난데스S' ? 1 : 0, 1);
eq('개명 안 한 선수는 그대로', canonPlayerName('김도영') === '김도영' ? 1 : 0, 1);
eq('이미 접미사가 붙었으면 그대로', canonPlayerName('김상진B') === '김상진B' ? 1 : 0, 1);

/* 팀으로 갈리는 7명 — 기본값과 예외가 둘 다 맞아야 한다 */
eq('김상훈 + 기아 → 김상훈S', canonPlayerName('김상훈', '기아') === '김상훈S' ? 1 : 0, 1);
eq('김상훈 + LG → 김상훈B', canonPlayerName('김상훈', 'LG') === '김상훈B' ? 1 : 0, 1);
eq('박찬호 + 기아 → 박찬호S', canonPlayerName('박찬호', '기아') === '박찬호S' ? 1 : 0, 1);
eq('박찬호 + 한화 → 박찬호B', canonPlayerName('박찬호', '한화') === '박찬호B' ? 1 : 0, 1);
eq('윤석민 + 기아 → 윤석민S', canonPlayerName('윤석민', '기아') === '윤석민S' ? 1 : 0, 1);
eq('윤석민 + KT → 윤석민B', canonPlayerName('윤석민', 'KT') === '윤석민B' ? 1 : 0, 1);
eq('이승호 + SSG → 이승호S', canonPlayerName('이승호', 'SSG') === '이승호S' ? 1 : 0, 1);
eq('이승호 + 키움 → 이승호C', canonPlayerName('이승호', '키움') === '이승호C' ? 1 : 0, 1);
eq('정대현 + 두산 → 정대현S', canonPlayerName('정대현', '두산') === '정대현S' ? 1 : 0, 1);
eq('정대현 + SSG → 정대현B', canonPlayerName('정대현', 'SSG') === '정대현B' ? 1 : 0, 1);
eq('최원준 + 기아 → 최원준B', canonPlayerName('최원준', '기아') === '최원준B' ? 1 : 0, 1);
eq('최원준 + 두산 → 최원준S', canonPlayerName('최원준', '두산') === '최원준S' ? 1 : 0, 1);
eq('팀을 모르면 기본값', canonPlayerName('이승호') === '이승호S' ? 1 : 0, 1);
/* 팀 인자가 갈리지 않는 이름을 흔들면 안 된다 */
eq('팀 인자가 양현종을 흔들지 않는다', canonPlayerName('양현종', '키움') === '양현종B' ? 1 : 0, 1);

/* 팀 칸이 없는 보관함 시트는 갈라진 이름을 다 후보로 봐야 한다 */
eq('갈라진 이름 무리 7개', PLAYER_NAME_GROUPS.length, 7);
eq('최원준 무리', playerNameGroup('최원준S').join('|') === '최원준B|최원준S' ? 1 : 0, 1);
eq('이승호 무리', playerNameGroup('이승호C').join('|') === '이승호C|이승호S' ? 1 : 0, 1);
eq('안 갈라진 이름은 무리가 자기 하나', playerNameGroup('김태균S').length, 1);
/* 무리마다 서로 다른 이름 둘 이상 — 표가 꼬이면 여기서 걸린다 */
eq('무리 원소가 모두 2개', PLAYER_NAME_GROUPS.filter(g => g.length === 2).length, 7);
/* 팀별 예외의 목적지는 전부 기본값과 달라야 한다 */
eq('팀 예외가 기본값과 겹치지 않는다',
   Object.keys(PLAYER_RENAME_BY_TEAM).every(k =>
     Object.values(PLAYER_RENAME_BY_TEAM[k]).every(v => v !== PLAYER_RENAME[k])) ? 1 : 0, 1);
/* 개명 결과가 또 개명 대상이면 무한 꼬임 — 그런 항목이 없어야 한다 */
eq('개명 결과는 더 안 바뀐다',
   Object.values(PLAYER_RENAME).every(v => PLAYER_RENAME[v] === undefined) ? 1 : 0, 1);

console.log('\n[도감 검색] 이름·팀·임팩트종류·초성으로 찾고, 센 카드부터 보여준다');
eq('초성 — 김도영', choseong('김도영') === 'ㄱㄷㅇ' ? 1 : 0, 1);
eq('초성 — 쌍자음', choseong('쌍둥이') === 'ㅆㄷㅇ' ? 1 : 0, 1);
eq('초성 — 한글 아닌 글자는 그대로', choseong('로하스B') === 'ㄹㅎㅅB' ? 1 : 0, 1);
eq('초성 — 빈 값', choseong('') === '' ? 1 : 0, 1);
eq('초성질의 판정 O', isChoQuery('ㄱㄷㅇ') ? 1 : 0, 1);
eq('초성질의 판정 X (완성형)', isChoQuery('김도') ? 1 : 0, 0);
eq('초성질의 판정 X (섞임)', isChoQuery('ㄱ도') ? 1 : 0, 0);

const W = { p: 1.0, a: 0.85, e: 0.4, n: 0.15, c: 1.05, s: 1.35 };
const DEX = [
  { id: 'a', name: '김도영', role: '타자', cardType: '임팩트', team: '기아', impactType: '여름사나이',
    subPosition: '3B', power: 90, accuracy: 85, eye: 70, patience: 60 },
  { id: 'b', name: '김도영', role: '타자', cardType: '시그니처', team: '기아', year: '2024',
    subPosition: '3B', power: 70, accuracy: 70, eye: 60, patience: 55 },
  { id: 'c', name: '최정', role: '타자', cardType: '임팩트', team: 'SSG', impactType: '여름사나이',
    subPosition: '3B', power: 87, accuracy: 85, eye: 73, patience: 64 },
  { id: 'd', name: '양현종B', role: '투수', cardType: '임팩트', team: '기아', position: '선발',
    impactType: '여름사나이', change: 64, stuff: 66 },
  { id: 'e', name: '박준표', role: '투수', cardType: '임팩트', team: '기아', position: '중계',
    impactType: '여름사나이', change: 78, stuff: 77 },
];
const IX = buildDexIndex(DEX, W);
const ids = (arr) => arr.map(x => x.sp.id).join('');

eq('인덱스 길이', IX.length, 5);
eq('검색용 한 줄에 임팩트종류가 들어간다', dexHay(DEX[0]).indexOf('여름사나이') >= 0 ? 1 : 0, 1);
eq('검색용 한 줄에 팀이 들어간다', dexHay(DEX[0]).indexOf('기아') >= 0 ? 1 : 0, 1);
eq('타자 점수 = 파1 정0.85 선0.4 인0.15',
   Math.round(dexScore(DEX[0], W) * 100) / 100, Math.round((90 + 85 * 0.85 + 70 * 0.4 + 60 * 0.15) * 100) / 100);
eq('투수 점수 = 변1.05 구1.35',
   Math.round(dexScore(DEX[3], W) * 100) / 100, Math.round((64 * 1.05 + 66 * 1.35) * 100) / 100);

/* 자리 구분 — 투수는 보직까지 맞아야 한다 */
eq('타자 자리엔 타자만', ids(dexSearch(IX, '타자', '', '', '')) === 'acb' ? 1 : 0, 1);
eq('선발 자리엔 선발만', ids(dexSearch(IX, '선발', '', '', '')) === 'd' ? 1 : 0, 1);
eq('중계 자리엔 중계만', ids(dexSearch(IX, '중계', '', '', '')) === 'e' ? 1 : 0, 1);
eq('마무리는 없음', dexSearch(IX, '마무리', '', '', '').length, 0);

/* 질의 없으면 센 카드부터 */
eq('점수 내림차순', ids(dexSearch(IX, '타자', '', '', '')) === 'acb' ? 1 : 0, 1);

/* 이름으로 찾으면 그 선수 카드가 뭉친다 */
eq('이름 검색', ids(dexSearch(IX, '타자', '김도영', '', '')) === 'ab' ? 1 : 0, 1);
eq('초성 검색', ids(dexSearch(IX, '타자', 'ㄱㄷㅇ', '', '')) === 'ab' ? 1 : 0, 1);
eq('임팩트종류 검색', ids(dexSearch(IX, '타자', '여름사나이', '', '')) === 'ac' ? 1 : 0, 1);
eq('팀 검색', ids(dexSearch(IX, '타자', 'SSG', '', '')) === 'c' ? 1 : 0, 1);
eq('연도 검색', ids(dexSearch(IX, '타자', '2024', '', '')) === 'b' ? 1 : 0, 1);
eq('카드종류 검색', ids(dexSearch(IX, '타자', '시그니처', '', '')) === 'b' ? 1 : 0, 1);
eq('없는 말', dexSearch(IX, '타자', '없는말', '', '').length, 0);
eq('앞뒤 공백·대소문자', ids(dexSearch(IX, '투수', '', '', '')) === '' ? 1 : 0, 1);

/* 이름 일치가 다른 항목 일치보다 위 */
eq('이름 일치가 먼저', dexRank(IX[0], '김도영', false) < dexRank(IX[0], '여름사나이', false) ? 1 : 0, 1);
eq('앞부분 일치가 부분 일치보다 위', dexRank(IX[0], '김도', false) < dexRank(IX[0], '도영', false) ? 1 : 0, 1);
eq('안 맞으면 3', dexRank(IX[0], '없는말', false), 3);

/* 칩 필터 */
eq('카드종류 칩', ids(dexSearch(IX, '타자', '', '임팩트', '')) === 'ac' ? 1 : 0, 1);
eq('팀 칩', ids(dexSearch(IX, '타자', '', '', '기아')) === 'ab' ? 1 : 0, 1);
eq('칩 두 개 겹치기', ids(dexSearch(IX, '타자', '', '시그니처', '기아')) === 'b' ? 1 : 0, 1);
eq('칩 + 검색어', ids(dexSearch(IX, '타자', 'ㄱㄷㅇ', '임팩트', '기아')) === 'a' ? 1 : 0, 1);
eq('칩이 결과를 다 걸러내면 0', dexSearch(IX, '타자', '', '라이브', '').length, 0);

/* 자리 판정 단독 */
eq('dexFitsSlot 타자', dexFitsSlot(IX[0], '타자') ? 1 : 0, 1);
eq('dexFitsSlot 타자에 투수 아님', dexFitsSlot(IX[3], '타자') ? 1 : 0, 0);
eq('dexFitsSlot 선발', dexFitsSlot(IX[3], '선발') ? 1 : 0, 1);
eq('dexFitsSlot 선발에 중계 아님', dexFitsSlot(IX[4], '선발') ? 1 : 0, 0);


console.log('\n[최대 훈련 포인트] 2026-09 국가대표 66 · 올스타 90');
eq('골든글러브 75', TRAIN_POINTS['골든글러브'], 75);
eq('시그니처 75', TRAIN_POINTS['시그니처'], 75);
eq('라이브 75', TRAIN_POINTS['라이브'], 75);
eq('임팩트 54', TRAIN_POINTS['임팩트'], 54);
eq('국가대표 66', TRAIN_POINTS['국가대표'], 66);
eq('올스타 90', TRAIN_POINTS['올스타'], 90);
eq('훈련 포인트는 전부 3 단위', Object.values(TRAIN_POINTS).every(v => v % 3 === 0) ? 1 : 0, 1);
{
  /* 유효 능력치로 가는 비율은 카드마다 같으니, 중앙값은 훈련 포인트에 비례해야 한다 */
  const D = buildDist({}, 20000);
  const med = (k) => D[k][Math.floor(D[k].length / 2)];
  eq('분포 키 24개 (훈련 12 + 특훈 12)', Object.keys(D).length, 24);
  eq('올스타 타자 / 골글 타자 ≈ 90/75', Math.round(med('train_bat_올스타') / med('train_bat_골든글러브') * 100) / 100, 1.2, 0.05);
  eq('올스타 투수 / 골글 투수 ≈ 90/75', Math.round(med('train_pit_올스타') / med('train_pit_골든글러브') * 100) / 100, 1.2, 0.05);
  eq('국대 타자 / 골글 타자 ≈ 66/75', Math.round(med('train_bat_국가대표') / med('train_bat_골든글러브') * 100) / 100, 0.88, 0.04);
  eq('국대 투수 / 골글 투수 ≈ 66/75', Math.round(med('train_pit_국가대표') / med('train_pit_골든글러브') * 100) / 100, 0.88, 0.04);
  eq('라이브 = 골글 (둘 다 75)', Math.round(med('train_bat_라이브') / med('train_bat_골든글러브') * 100) / 100, 1.0, 0.03);
  /* 상한 — 수비 하나가 고정이라 유효 칸에 전부 몰아도 올스타 90pt 를 넘을 수 없다 */
  const top = (k) => D[k][D[k].length - 1];
  eq('올스타 타자 최댓값 ≤ 90', top('train_bat_올스타') <= 90 ? 1 : 0, 1);
  eq('국대 타자 최댓값 ≤ 66', top('train_bat_국가대표') <= 66 ? 1 : 0, 1);
  /* 특훈은 훈련 포인트와 무관 — 올스타·라이브는 특훈 분포가 없어야 한다 */
  eq('올스타 특훈 분포 없음', D['spec_bat_올스타'] === undefined ? 1 : 0, 1);
  eq('국대 특훈 분포 있음', Array.isArray(D['spec_bat_국가대표']) ? 1 : 0, 1);
}

console.log('\n[훈재분 계산기 — 내 입력 판정]');
eq('타자 입력칸 = 파워·정확·선구·인내', TRAIN_MY_STATS['타자'].join(',') === '파워,정확,선구,인내' ? 1 : 0, 1);
eq('투수 입력칸 = 변화·구위', TRAIN_MY_STATS['투수'].join(',') === '변화,구위' ? 1 : 0, 1);
eq('타자 값만 있으면 투수는 미입력', hasTrainInput({ 파워: 12, 정확: 12, 선구: 12, 인내: 12 }, '투수') ? 1 : 0, 0);
eq('투수 값만 있으면 타자는 미입력', hasTrainInput({ 변화: 15, 구위: 15 }, '타자') ? 1 : 0, 0);
eq('타자 입력 인식', hasTrainInput({ 파워: 12 }, '타자') ? 1 : 0, 1);
eq('인내만 넣어도 입력', hasTrainInput({ 인내: 3 }, '타자') ? 1 : 0, 1);
eq('투수 입력 인식 (반대쪽 값이 남아 있어도)', hasTrainInput({ 파워: 12, 구위: 9 }, '투수') ? 1 : 0, 1);
eq('0 은 입력이 아님', hasTrainInput({ 변화: 0, 구위: 0 }, '투수') ? 1 : 0, 0);
eq('빈 입력', hasTrainInput({}, '타자') ? 1 : 0, 0);
eq('알 수 없는 포지션', hasTrainInput({ 파워: 5 }, '포수') ? 1 : 0, 0);

console.log('\n[고점판독기] 가정값은 전부 메이저이고 실제로 뜰 수 있는 조합, 상위 0.5% 안이어야 한다');
{
  __setLiveWeights(null);
  /* 앱이 백분위를 보여 줄 때 쓰는 구워 둔 분포를 소스에서 그대로 읽는다 */
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/deck-manager.jsx', import.meta.url), 'utf8');
  const obj = (name) => { const i = src.indexOf('var ' + name + ' = '); return JSON.parse(src.slice(src.indexOf('{', i), src.indexOf('};', i) + 1)); };
  const SKD = obj('PREBUILT_SKILL_DIST'), TRD = obj('PREBUILT_DIST');
  const LV = { '골든글러브': [6, 6, 6], '라이브': [7, 7, 7], '올스타': [8, 7, 7], '시그니처': [6, 5, 5], '국가대표': [6, 5, 5], '임팩트': [6, 5, 5] };
  const base = (n) => n.replace(/\(.*?\)/g, '').trim();
  /* 조건부 스킬 — 배치·타순·능력치 구간·성급·불펜 자리·이닝에 따라 켜지고 꺼진다.
     베스트포지션은 선호 스킬이라 쓴다 (사용자 지정) */
  const COND = ['철완', '5툴플레이어', '선봉장', '도전정신', '라이징스타', '국대에이스', '리드오프', '핵타선', '공포의하위타선', '수비안정성', '빈틈없는타선', '컨택트히터',
    '원투펀치', '수호신', '긴급투입', '승리의함성', '원포인트릴리프', '얼리스타트', '흐름끊기', '기선제압', '타선지원', '대타스페셜', '약속의8회', '약속의 8회'];

  eq('스킬 경우 72가지 (구워 둔 스킬 분포와 같은 키)', Object.keys(PEAK_SKILLS).filter(k => SKD[k]).length, 72);
  let bad = [];
  for (const [key, names] of Object.entries(PEAK_SKILLS)) {
    const [cat, ct, hand, c] = key.split('|');
    const fixed = ct === '임팩트' || ct === '올스타';
    if (names.length !== 3) bad.push(key + ' 개수');
    const cond = { hand, cardType: ct, cat };
    names.forEach(n => {
      if (!DEFAULT_SKILLS[cat][n]) bad.push(key + ' 표에 없음 ' + n);
      if (!DEFAULT_MAJOR[cat][n]) bad.push(key + ' 메이저 아님 ' + n);
      if (!skillPickable(n, cat) || !skillAllowedAt(n, cat, c === '포수') || !variantAllowed(n, cond)) bad.push(key + ' 뜰 수 없음 ' + n);
      if (ct !== '국가대표' && isNatOnlySkill(n, cat)) bad.push(key + ' 국대 전용 ' + n);
      if (COND.includes(base(n))) bad.push(key + ' 조건부 ' + n);
      if (base(n) === '패기' && (ct === '라이브' || ct === '국가대표')) bad.push(key + ' 다른 카드 이름의 패기 ' + n);
    });
    if (new Set(names.map(base)).size !== 3) bad.push(key + ' 같은 스킬 중복');
    /* 1옵션 — 포수는 포수리드, 임팩트·올스타는 사용자 지정, 나머지는 손잡이·보직 대표 스킬 */
    const role = cat === '타자' ? '정밀타격' : cat === '선발' ? (hand === '좌' ? '좌승사자(좌투)' : '저니맨') : '마당쇠(불펜)';
    const handSig = cat === '타자' ? (({ '좌': '좌타해결사(좌타)', '양': '스위치히터(양타)' })[hand] || '정밀타격') : undefined;
    const want1 = c === '포수' ? '포수리드' : fixed ? role : (handSig || role);
    if (names[0] !== want1) bad.push(key + ' 1옵션 ' + names[0]);
    /* 우타 포수의 정밀타격은 1점 낮추기에서 빠질 수 있다 */
    if (handSig && !names.includes(handSig) && !(c === '포수' && hand === '우')) bad.push(key + ' 손잡이 스킬 없음');
    /* 백분위 — 임팩트·올스타는 1옵션을 빼고 2·3옵션만으로 */
    const sc = Math.round(names.reduce((t2, n, k) => t2 + ((fixed && k === 0) ? 0 : getSkillScore(n, LV[ct][k], cat, true)), 0) * 100) / 100;
    const pct = pctFromDist(SKD[key], sc);
    if (!(pct <= 0.5)) bad.push(key + ' 백분위 ' + pct);
    if (sc >= SKD[key][SKD[key].length - 1]) bad.push(key + ' 표본 최고점 이상 ' + sc);
  }
  eq('스킬 72가지 — 메이저·실제로 뜸·1옵션 규칙·상위 0.5% 안 (' + (bad.slice(0, 3).join(' / ') || '문제 없음') + ')', bad.length, 0);
  eq('기준 — 골글 우타는 정밀타격·대표타자·베스트포지션', PEAK_SKILLS['타자|골든글러브|우|-'].join(',') === '정밀타격,대표타자,베스트포지션' ? 1 : 0, 1);
  eq('마무리 12가지 모두 마당쇠·소방수·위닝샷', Object.entries(PEAK_SKILLS).filter(([k, v]) => k.startsWith('마무리|') && v.join(',') === '마당쇠(불펜),소방수,위닝샷').length, 12);
  eq('양타 12가지 모두 스위치히터', Object.entries(PEAK_SKILLS).filter(([k, v]) => k.split('|')[0] === '타자' && k.split('|')[2] === '양' && v.includes('스위치히터(양타)')).length, 12);
  eq('타자 36가지 중 대표타자·베스트포지션이 든 조합이 절반 넘게', Object.entries(PEAK_SKILLS).filter(([k, v]) => k.startsWith('타자|') && v.some(n => n === '대표타자' || n === '베스트포지션')).length > 18 ? 1 : 0, 1);
  eq('포수 18가지 모두 1옵션 포수리드', Object.entries(PEAK_SKILLS).filter(([k, v]) => k.endsWith('|포수') && v[0] === '포수리드').length, 18);
  eq('좌타 12가지 모두 좌타해결사', Object.entries(PEAK_SKILLS).filter(([k, v]) => k.split('|')[0] === '타자' && k.split('|')[2] === '좌' && v.includes('좌타해결사(좌타)')).length, 12);

  bad = [];
  for (const [key, v] of Object.entries(PEAK_TRAIN)) {
    const [role, ct] = key.split('_');
    const sc = role === 'bat' ? v[0] * 1 + v[1] * 0.85 + v[2] * 0.4 + v[3] * 0.15 : v[0] * 1.05 + v[1] * 1.35;
    if (v.reduce((a, b) => a + b, 0) > TRAIN_POINTS[ct]) bad.push(key + ' 포인트 초과');
    const pct = getPercentile(TRD['train_' + key], Math.round(sc * 100) / 100);
    if (!(pct >= 0.1 && pct <= 0.5)) bad.push(key + ' 백분위 ' + pct);
  }
  eq('훈련 12가지 — 포인트 안이고 상위 0.1~0.5% (' + (bad.join(' / ') || '문제 없음') + ')', bad.length + (Object.keys(PEAK_TRAIN).length === 12 ? 0 : 100), 0);

  bad = [];
  for (const [key, v] of Object.entries(PEAK_SPEC)) {
    const parts = key.split('_'), role = parts[0], fa = parts[1] === 'fa', ct = parts[parts.length - 1];
    const b0 = fa ? 5 : 3;
    const trials = fa ? 5 : ct === '국가대표' ? 4 : 3;
    const perTrial = ct === '임팩트' ? 2 : 3;
    if (v.some(x => x > 15)) bad.push(key + ' 15 초과');
    if (v[role === 'bat' ? 0 : 1] < b0) bad.push(key + ' 기본값 미만');
    if (v.reduce((a, b) => a + b, 0) - b0 > trials * perTrial) bad.push(key + ' 시행 초과');
    const sc = role === 'bat' ? v[0] * 1 + v[1] * 0.85 + v[2] * 0.4 + v[3] * 0.15 : v[0] * 1.05 + v[1] * 1.35;
    const pct = getPercentile(TRD['spec_' + key], Math.round(sc * 100) / 100);
    if (!(pct >= 0.1 && pct <= 0.5)) bad.push(key + ' 백분위 ' + pct);
  }
  eq('특훈 12가지 — 15 이하·기본값 포함·상위 0.1~0.5% (' + (bad.join(' / ') || '문제 없음') + ')', bad.length + (Object.keys(PEAK_SPEC).length === 12 ? 0 : 100), 0);

  eq('잠재력 — 풀스윙·장타억제 SR+, 클러치·침착 A', PEAK_POT['풀스윙'] === 'SR+' && PEAK_POT['장타억제'] === 'SR+' && PEAK_POT['클러치'] === 'A' && PEAK_POT['침착'] === 'A' ? 1 : 0, 1);
  eq('각성 — 임팩트만 S', PEAK_AWK['임팩트'] === 'S' && Object.keys(PEAK_AWK).length === 1 ? 1 : 0, 1);

  /* peakPl */
  const bat = { id: 'x', role: '타자', cardType: '골든글러브', hand: '우', name: '가', team: 'LG', power: 80, accuracy: 80, eye: 70, patience: 60,
    enhance: '9각성', sLvManual: false, skill1: '', skill2: '', skill3: '', pot1: '', pot2: '' };
  const snap = JSON.stringify(bat);
  const pb = peakPl(bat, '1B');
  const sk3 = (p) => [p.skill1, p.skill2, p.skill3].join(',');
  eq('원본은 그대로', JSON.stringify(bat) === snap ? 1 : 0, 1);
  eq('골글 우타 — 스킬', sk3(pb) === PEAK_SKILLS['타자|골든글러브|우|-'].join(',') ? 1 : 0, 1);
  eq('골글 우타 — 레벨 6/6/6 (수동)', pb.sLvManual && pb.s1Lv === 6 && pb.s2Lv === 6 && pb.s3Lv === 6 ? 1 : 0, 1);
  eq('골글 우타 — 훈련', [pb.trainP, pb.trainA, pb.trainE, pb.trainN].join(',') === PEAK_TRAIN.bat_골든글러브.join(',') ? 1 : 0, 1);
  eq('골글 우타 — 특훈', [pb.specPower, pb.specAccuracy, pb.specEye, pb.specPatience].join(',') === PEAK_SPEC.bat_골든글러브.join(',') ? 1 : 0, 1);
  eq('타자 잠재력 — 풀스윙 SR+ · 클러치 A', pb.pot1 === 'SR+' && pb.pot2 === 'A' && pb.potType1 === '풀스윙' && pb.potType2 === '클러치' ? 1 : 0, 1);
  eq('각성 — 골글은 A, 종류가 없으면 첫 종류', pb.pot3 === 'A' && pb.potType3 === POT_TYPES_AWK_BAT[0] ? 1 : 0, 1);
  eq('잠재력 종류를 바꿔 둔 칸은 종류대로', (() => { const q = peakPl({ ...bat, potType1: '클러치', potType2: '풀스윙' }, '1B'); return q.pot1 === 'A' && q.pot2 === 'SR+'; })() ? 1 : 0, 1);
  eq('강화·카드 정보는 그대로', pb.enhance === '9각성' && pb.name === '가' && pb.team === 'LG' && pb.power === 80 ? 1 : 0, 1);
  eq('포수 자리는 포수 조합 — 1옵션 포수리드 Lv6', (() => { const q = peakPl(bat, 'C'); return sk3(q) === PEAK_SKILLS['타자|골든글러브|우|포수'].join(',') && q.skill1 === '포수리드' && q.s1Lv === 6; })() ? 1 : 0, 1);
  eq('좌타는 좌타해결사부터', peakPl({ ...bat, hand: '좌' }, 'RF').skill1 === '좌타해결사(좌타)' ? 1 : 0, 1);
  eq('양타는 스위치히터부터', peakPl({ ...bat, hand: '양' }, 'DH').skill1 === '스위치히터(양타)' ? 1 : 0, 1);
  eq('빈 선수는 그대로', peakPl(null, 'C') === null ? 1 : 0, 1);

  /* 임팩트·올스타 — 1옵션도 지정값으로 */
  const imp = { ...bat, cardType: '임팩트', skill1: '대표타자', s1Lv: 0, sLvManual: false };
  const pi = peakPl(imp, 'LF');
  eq('임팩트 타자 — 1옵션 정밀타격 Lv6', pi.skill1 === '정밀타격' && pi.s1Lv === 6 ? 1 : 0, 1);
  eq('임팩트 타자 — 2·3옵션 Lv5', pi.skill2 === PEAK_SKILLS['타자|임팩트|우|-'][1] && pi.s2Lv === 5 && pi.s3Lv === 5 ? 1 : 0, 1);
  eq('임팩트 좌타 — 정밀타격 + 좌타해결사', (() => { const q = peakPl({ ...imp, hand: '좌' }, 'LF'); return q.skill1 === '정밀타격' && q.skill2 === '좌타해결사(좌타)'; })() ? 1 : 0, 1);
  eq('임팩트 각성 — S', pi.pot3 === 'S' ? 1 : 0, 1);
  eq('임팩트 포수 — 1옵션 포수리드, 2옵션 정밀타격', (() => { const q = peakPl(imp, 'C'); return q.skill1 === '포수리드' && q.s1Lv === 6 && q.skill2 === '정밀타격' && q.s2Lv === 5; })() ? 1 : 0, 1);
  const impM = { ...imp, sLvManual: true, s1Lv: 7 };
  eq('FA 시그 — FA 특훈', peakPl({ ...bat, cardType: '시그니처', isFa: true }, '1B').specPower === PEAK_SPEC.bat_fa_시그니처[0] ? 1 : 0, 1);
  eq('라이브 — 특훈 없음, 내 값 그대로', peakPl({ ...bat, cardType: '라이브', specPower: 2 }, '1B').specPower === 2 ? 1 : 0, 1);
  const season = peakPl({ ...bat, cardType: '시즌', trainP: 4 }, '1B');
  eq('시즌 — 스킬은 시그니처 표, 훈련 그대로, 각성 A', sk3(season) === PEAK_SKILLS['타자|시그니처|우|-'].join(',') && season.trainP === 4 && season.pot3 === 'A' ? 1 : 0, 1);

  /* 투수 */
  const pit = { id: 'p', role: '투수', position: '선발', cardType: '골든글러브', hand: '좌', change: 80, stuff: 80, enhance: '9각성', sLvManual: false };
  const pp = peakPl(pit, 'SP1');
  eq('선발 좌투 — 좌승사자부터', sk3(pp) === PEAK_SKILLS['선발|골든글러브|좌|-'].join(',') && pp.skill1 === '좌승사자(좌투)' ? 1 : 0, 1);
  eq('선발 — 훈련·특훈', pp.trainC === PEAK_TRAIN.pit_골든글러브[0] && pp.specStuff === PEAK_SPEC.pit_골든글러브[1] ? 1 : 0, 1);
  eq('투수 잠재력 — 장타억제 SR+ · 침착 A, 각성 A', pp.pot1 === 'SR+' && pp.pot2 === 'A' && pp.potType1 === '장타억제' && pp.potType2 === '침착' && pp.pot3 === 'A' && pp.potType3 === POT_TYPES_AWK_PIT[0] ? 1 : 0, 1);
  eq('올스타 좌투 선발 — 좌승사자 Lv8', (() => { const q = peakPl({ ...pit, cardType: '올스타' }, 'SP1'); return q.skill1 === '좌승사자(좌투)' && q.s1Lv === 8; })() ? 1 : 0, 1);
  eq('임팩트 우투 선발 — 저니맨', peakPl({ ...pit, cardType: '임팩트', hand: '우' }, 'SP2').skill1 === '저니맨' ? 1 : 0, 1);
  eq('임팩트 중계·마무리 — 마당쇠', peakPl({ ...pit, cardType: '임팩트', position: '중계' }, 'RP1').skill1 === '마당쇠(불펜)' && peakPl({ ...pit, cardType: '임팩트', position: '마무리' }, 'CP').skill1 === '마당쇠(불펜)' ? 1 : 0, 1);
  eq('마무리 자리 — 마당쇠·소방수·위닝샷', sk3(peakPl({ ...pit, position: '마무리', hand: '우' }, 'CP')) === '마당쇠(불펜),소방수,위닝샷' ? 1 : 0, 1);
  eq('임팩트 마무리도 같은 조합 (1옵 마당쇠 Lv6, 2·3옵 Lv5)', (() => { const q = peakPl({ ...pit, cardType: '임팩트', position: '마무리' }, 'CP'); return sk3(q) === '마당쇠(불펜),소방수,위닝샷' && q.s1Lv === 6 && q.s2Lv === 5 && q.s3Lv === 5; })() ? 1 : 0, 1);

  /* 내 값이 더 좋으면 그대로 */
  const strong = { ...bat, sLvManual: true, skill1: '정밀타격', s1Lv: 10, skill2: '워크에식', s2Lv: 10, skill3: '빅게임헌터', s3Lv: 10,
    trainP: 40, trainA: 30, specPower: 15, specAccuracy: 15, pot1: 'SR+', pot2: 'S', potType3: '속구대처', pot3: 'S' };
  const ps = peakPl(strong, '1B');
  eq('더 좋은 스킬은 그대로', ps.skill3 === '빅게임헌터' && ps.s1Lv === 10 ? 1 : 0, 1);
  eq('더 좋은 훈련은 그대로', ps.trainP === 40 && ps.trainA === 30 ? 1 : 0, 1);
  eq('더 좋은 특훈은 그대로', ps.specPower === 15 ? 1 : 0, 1);
  eq('잠재력은 칸마다 — 클러치 S 는 A 보다 좋아 그대로', ps.pot1 === 'SR+' && ps.pot2 === 'S' ? 1 : 0, 1);
  eq('각성 — 내 S 가 A 보다 좋아 그대로', ps.potType3 === '속구대처' && ps.pot3 === 'S' ? 1 : 0, 1);
  const pw = peakPl({ ...bat, pot1: 'C', pot2: 'C', potType3: '속구대처', pot3: 'C' }, '1B');
  eq('낮은 잠재력은 올린다', pw.pot1 === 'SR+' && pw.pot2 === 'A' && pw.pot3 === 'A' && pw.potType3 === '속구대처' ? 1 : 0, 1);

  const lu = (p) => ({ enhance: p.enhance, trainP: p.trainP || 0, trainA: p.trainA || 0, trainE: p.trainE || 0, trainN: p.trainN || 0, trainC: p.trainC || 0, trainS: p.trainS || 0,
    skill1: p.skill1 || '', s1Lv: p.s1Lv || 0, skill2: p.skill2 || '', s2Lv: p.s2Lv || 0, skill3: p.skill3 || '', s3Lv: p.s3Lv || 0 });
  let down = 0;
  for (const p of [bat, imp, impM, strong, { ...bat, hand: '좌', trainP: 25, trainA: 25 }, { ...bat, hand: '양', pot2: 'SR+' }]) {
    const q = peakPl(p, '1B');
    if (calcBat(q, lu(q)).total < calcBat(p, lu(p)).total) down++;
  }
  for (const p of [pit, { ...pit, position: '중계' }, { ...pit, position: '마무리', trainC: 30, trainS: 30 }, { ...pit, cardType: '임팩트', hand: '우' }]) {
    const q = peakPl(p, 'SP1');
    if (calcPit(q, lu(q)).total < calcPit(p, lu(p)).total) down++;
  }
  eq('고점을 켜서 점수가 떨어지는 선수 없음', down, 0);

  /* peakBuffState — 고점 계산용 팀 버프. 내 덱 값(여러 화면이 같이 쓰는 객체)은 안 바뀐다 */
  const realSd = { bpcIdx: 3, catchLead: '', _autoCatch: '없음', _autoNatBat: '6렙', _autoNatPit: '없음' };
  const realCopy = JSON.stringify(realSd);
  const pbs = peakBuffState(realSd, { ...realSd, _autoCatch: '6렙', _autoNatBat: '5렙', _autoNatPit: '5렙' });
  eq('팀 버프 — 고점 포수의 포수리드를 쓴다', pbs._autoCatch === '6렙' ? 1 : 0, 1);
  eq('팀 버프 — 고점 투수의 국대에이스를 쓴다', pbs._autoNatPit === '5렙' ? 1 : 0, 1);
  eq('팀 버프 — 내 덱이 더 높으면 내 값 (국대에이스 6렙 유지)', pbs._autoNatBat === '6렙' ? 1 : 0, 1);
  eq('팀 버프 — 나머지 설정은 그대로', pbs.bpcIdx === 3 && pbs.catchLead === '' ? 1 : 0, 1);
  eq('팀 버프 — 내 덱 객체는 그대로 두고 새 객체', JSON.stringify(realSd) === realCopy && pbs !== realSd ? 1 : 0, 1);
  eq('팀 버프 — 값이 비어 있어도 된다', peakBuffState({}, { _autoCatch: '7렙' })._autoCatch === '7렙' && peakBuffState({ _autoCatch: '8렙' }, {})._autoCatch === '8렙' ? 1 : 0, 1);
  const pitSD = (sd) => calcPit(pit, lu(pit), calcSDBonus(pit, 'SP1', sd, 0)).total;
  eq('고점 포수의 포수리드 6렙이 투수 점수에 들어간다 (변화 1.05 + 구위 1.35)',
    pitSD(peakBuffState({ _autoCatch: '없음' }, { _autoCatch: '6렙' })) - pitSD({ _autoCatch: '없음' }), 2.4, 0.011);
}

console.log('\n[덱 저장기] 선수·라인업·세트덱을 늘 최신 한 덩어리로, 부른 순서대로 저장한다');
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /* 가짜 DB 한 줄 — 요청마다 걸리는 시간이 다르고, 끝난 순서대로 줄을 통째로 덮어쓴다 */
  const mkDb = () => {
    const db = { row: null, log: [], active: 0, maxActive: 0 };
    db.send = (deck, ms) => async () => {
      db.active++; db.maxActive = Math.max(db.maxActive, db.active);
      await sleep(ms);
      db.row = deck; db.log.push(deck); db.active--;
    };
    return db;
  };
  const P0 = [{ id: 'a', position: '중계', subPosition: 'RP1' }], LM0 = { RP1: 'a' }, SD0 = { bpcIdx: 4 };
  const P1 = [{ id: 'a', position: '선발', subPosition: 'SP1' }], LM1 = { SP1: 'a' }, SD1 = { bpcIdx: 2, batOrder: ['C'] };
  /* 대문자 = 새 값: P 선수, L 라인업, S 세트덱 */
  const tag = (d) => (d.players === P1 ? 'P' : 'p') + (d.lineupMap === LM1 ? 'L' : 'l') + (d.sdConfig === SD1 ? 'S' : 's');

  /* 옛 방식 재현 — 저장마다 나머지 절반을 옛 state 로 채워 동시에 보냈다 */
  let db = mkDb();
  await Promise.all([db.send({ players: P0, lineupMap: LM1, sdConfig: SD0 }, 5)(), db.send({ players: P1, lineupMap: LM0, sdConfig: SD0 }, 20)()]);
  eq('옛 방식 — 순서대로 도착해도 옛 라인업이 남았다', tag(db.row) === 'Pls' ? 1 : 0, 1);
  db = mkDb();
  await Promise.all([db.send({ players: P0, lineupMap: LM1, sdConfig: SD0 }, 20)(), db.send({ players: P1, lineupMap: LM0, sdConfig: SD0 }, 5)()]);
  eq('옛 방식 — 늦게 도착하면 옛 선수가 남았다', tag(db.row) === 'pLs' ? 1 : 0, 1);

  /* 투수 자리 옮기기: 라인업 저장 → 선수 저장. 첫 요청이 더 느려도 */
  let w = makeDeckWriter(1000);
  w.sync({ players: P0, lineupMap: LM0, sdConfig: SD0 });
  db = mkDb();
  await Promise.all([w.queue(db.send(w.take({ lineupMap: LM1 }), 20)), w.queue(db.send(w.take({ players: P1 }), 5))]);
  eq('투수 자리 — 요청은 한 번에 하나씩', db.maxActive, 1);
  eq('투수 자리 — 저장 순서와 내용 (pL → PL)', db.log.map(tag).join(' ') === 'pLs PLs' ? 1 : 0, 1);
  eq('투수 자리 — 마지막 줄에 새 라인업과 새 선수', tag(db.row) === 'PLs' ? 1 : 0, 1);

  /* 다시 그리기 전의 옛 state 가 들어와도 최신 값은 그대로, 새로 불러온 state 는 반영 */
  w.sync({ players: P0, lineupMap: LM0, sdConfig: SD0 });
  eq('옛 state 로 다시 그려도 최신 값 유지', tag(w.take({})) === 'PLs' ? 1 : 0, 1);
  const P2 = [{ id: 'b' }], LM2 = {};
  w.sync({ players: P2, lineupMap: LM2, sdConfig: SD0 });
  const t2 = w.take({});
  eq('새로 불러온 state 는 반영', t2.players === P2 && t2.lineupMap === LM2 ? 1 : 0, 1);

  /* 시트 가져오기·되돌리기: 선수 → 라인업 → 세트덱 */
  w = makeDeckWriter(1000);
  w.sync({ players: P0, lineupMap: LM0, sdConfig: SD0 });
  db = mkDb();
  await Promise.all([
    w.queue(db.send(w.take({ players: P1 }), 15)),
    w.queue(db.send(w.take({ lineupMap: LM1 }), 10)),
    w.queue(db.send(w.take({ sdConfig: SD1 }), 1)),
  ]);
  eq('시트 가져오기 — 요청은 한 번에 하나씩', db.maxActive, 1);
  eq('시트 가져오기 — 저장 순서와 내용 (Pl → PL → PLS)', db.log.map(tag).join(' ') === 'Pls PLs PLS' ? 1 : 0, 1);

  /* 세트덱을 먼저 저장하고 선수를 저장해도 세트덱이 옛 값으로 돌아가지 않는다 */
  w = makeDeckWriter(1000);
  w.sync({ players: P0, lineupMap: LM0, sdConfig: SD0 });
  db = mkDb();
  await Promise.all([w.queue(db.send(w.take({ sdConfig: SD1 }), 10)), w.queue(db.send(w.take({ players: P1 }), 1))]);
  eq('세트덱 → 선수 순서여도 세트덱 유지', tag(db.row) === 'PlS' ? 1 : 0, 1);

  /* 읽기도 같은 줄에 선다 — 가는 중인 저장이 끝난 뒤에 읽는다 */
  w = makeDeckWriter(1000);
  w.sync({ players: P0, lineupMap: LM0, sdConfig: SD0 });
  db = mkDb();
  const saving = w.queue(db.send(w.take({ players: P1 }), 15));
  const read = await w.queue(async () => db.row);
  await saving;
  eq('덱 불러오기는 가는 중인 저장 뒤에', read && read.players === P1 ? 1 : 0, 1);

  /* 실패한 저장이 있어도 다음 저장은 나가고, 실패는 부른 쪽에 그대로 전해진다 */
  w = makeDeckWriter(1000);
  let ran = 0, rejected = 0;
  await Promise.all([
    w.queue(async () => { await sleep(5); throw new Error('network'); }).catch(() => { rejected++; }),
    w.queue(async () => { ran++; }),
  ]);
  eq('실패 뒤에도 다음 저장은 나간다 (실패 1 · 실행 1)', rejected * 10 + ran, 11);

  /* 앞 요청이 멈추면 waitMs 만 기다리고 다음 요청을 보낸다 */
  w = makeDeckWriter(30);
  w.queue(() => new Promise(() => {}));
  const t0 = Date.now();
  await w.queue(async () => {});
  const waited = Date.now() - t0;
  eq('멈춘 요청은 30ms 만 기다린다', waited >= 25 && waited < 1000 ? 1 : 0, 1);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
