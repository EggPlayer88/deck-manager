/* 덱 보정 시트(260814) 대조 회귀 테스트
   실행:  node test/calc.test.mjs
   calc-extract.mjs 는 src/deck-manager.jsx 에서 순수 계산 함수만 뽑아낸 것이다.
   (재생성이 필요하면 시트 분석 스크립트의 mkharness 를 다시 돌린다) */
import {
  pctFromDist, histFromDist, skillDistKey, slotGroupOf, isWinGroupSlot, rpGroupOf, batMult, BAT_MULT, strMult, strRanks, STR_MULT, getRPWeight, rpTactic, spMult, rpBudget, SP_MULT, skillSlotHint, skillRoleOf, variantAllowed, pickPaegi, isNatOnlySkill, natSkillMismatch, buffName, skillPickable, canonSkillName, canonPlayerName, playerNameGroup, PLAYER_RENAME, PLAYER_RENAME_BY_TEAM, PLAYER_NAME_GROUPS, choseong, isChoQuery, dexHay, dexScore, buildDexIndex, dexFitsSlot, dexRank, dexSearch, skillAllowedAt, DEFAULT_MAJOR, calcSDBonus, sdPick, buildDist, TRAIN_POINTS, TRAIN_MY_STATS, hasTrainInput, getPercentile, PEAK_SKILLS, PEAK_TRAIN, PEAK_SPEC, PEAK_POT, PEAK_AWK, peakPl, peakSkillSum, peakBuffState,
  __setLiveWeights, __setGlobalPotm, resolveSkills, DEFAULT_SKILLS, getEnhVal, calcBat, calcPit, getSkillScore,
  getPotScoreByType, awkTypesFor, POT_GRADES_AWK, POT_TYPES_AWK_BAT, POT_TYPES_AWK_PIT,
  potmKey, isPotmFor, getPotmBonus, potmEffect, applyPotmPot, deckPl, getPotmInfo, potmSummary, awakenScore, maxSkillLv, autoSkillLv, effSkillLv, isLvManual, parseHotColdZone, zonesFromRow,
  launchAngleReq, launchAngleBonus, launchAngleGain, zonePenalty, getW, makeDeckWriter, cardSetScore, computeLineupSetDeck, detectTeamBuffs, normPlayerSkills,
  ptSkillCount, PT_GROUP_SIZE, PT_GROUPS, PT_MAX_SAME,
  dexAll, setCustomPlayers, isCustomCard, CUSTOM_MAX, mergePl, normPlayerList, hasPtSkill, optimizeSetDeck, SD_TIE_SIDE, SD_YEAR_ROWS,
  isSelTeam, sdLeagueOf, matchOne, buildIndex, SD_RULES, SD_ROWS, SD_BAT_ALL, SD_PIT_ALL, suggestDeckTeam, sdSideOf, toDeckFormat,
  isOtherTeam, applyTeamFlags, teamFlagStatAdj, specTrialsOf, specDistKey, cardSetPenalty, parseCardCode,
  LAB_TIERS, distValueAt, labCat, labScale, labPl, PREBUILT_DIST, PREBUILT_SKILL_DIST,
  LAB_GG_BASE, LAB_GG_OWN_BONUS, LAB_FA_MAX, LAB_BPC_IDX, LAB_SLOTS,
  labCard, labSdState, labSeatOrder, labBestOrder, labLimits, labYears, labRun,
  lineupLu, lineupOpts, lineupBat, lineupPit, calcLineupTotal, BAT_SLOTS, SP_SLOTS, RP_SLOTS, CP_MULT,
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
/* 2026-09-23 사용자 확인 — 보너스는 3개 묶음 둘이라 같은 스킬이 최대 두 번 들어가고,
   들어간 수만큼 레벨이 오른다 (예전에는 몇 개를 골라도 +1 이었다) */
eq('두 묶음에 같은 스킬 → +2', autoSkillLv('정밀타격', '시즌', 1, '타자', ['정밀타격', '대도', '', '정밀타격', '', '']), 8);
eq('한 묶음에만 → +1', autoSkillLv('정밀타격', '시즌', 1, '타자', ['정밀타격', '대도', '', '호타준족', '', '']), 7);
eq('띄어쓰기가 달라도 같은 스킬로 센다', autoSkillLv('정밀타격', '시즌', 1, '타자', ['정밀 타격', '정밀타격']), 8);
eq('셋 이상 들어 있어도 최대 +2', autoSkillLv('정밀타격', '시즌', 1, '타자', ['정밀타격', '정밀타격', '정밀타격']), 8);
eq('개수 세기 — 0/1/2', [ptSkillCount([], '정밀타격'), ptSkillCount(['정밀타격'], '정밀타격'),
  ptSkillCount(['정밀타격', '정밀타격'], '정밀타격')].join() === '0,1,2' ? 1 : 0, 1);
eq('hasPtSkill 은 그대로 동작', hasPtSkill(['정밀타격'], '정밀타격') && !hasPtSkill(['대도'], '정밀타격') ? 1 : 0, 1);
eq('묶음 3칸 · 묶음 2개 · 같은 스킬 최대 2', [PT_GROUP_SIZE, PT_GROUPS, PT_MAX_SAME].join() === '3,2,2' ? 1 : 0, 1);
/* 적용 레벨(effSkillLv)도 같은 규칙 */
eq('적용 레벨도 +2', effSkillLv('정밀타격', 0, false, '시즌', 1, '타자', ['정밀타격', '', '', '정밀타격', '', '']), 8);
/* 스킬 최고 레벨을 넘지 않는다 — 황금세대는 Lv6 까지만 값이 있다 */
eq('황금세대 최고 레벨', maxSkillLv('황금세대', '타자'), 6);
eq('정밀타격 최고 레벨', maxSkillLv('정밀타격', '타자'), 10);
eq('올스타 황금세대는 6에서 멈춤', autoSkillLv('황금세대', '올스타', 1, '타자', []), 6);
eq('보너스 있어도 6 초과 안 함', autoSkillLv('황금세대', '올스타', 1, '타자', ['황금세대']), 6);
eq('두 번 걸려도 최고 레벨은 못 넘는다', autoSkillLv('황금세대', '올스타', 1, '타자', ['황금세대', '', '', '황금세대', '', '']), 6);
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
/* 30·90·150·170·200 은 선택 팀(덱 구단 선수) 효과라 덱 구단과 선수 구단을 맞춰 둔다 */
var sdBat = function(sp, side, extra){
  var st = { teamName: "키움" }; if (side) st["s" + sp] = side;
  if (extra) for (var k in extra) st[k] = extra[k];
  return calcSDBonus({ role:"타자", cardType:"시즌", stars:5, year:"2020", team:"키움" }, "DH", st, sp, 8);
};
var sdPit = function(sp, side){
  var st = {}; if (side) st["s" + sp] = side;
  return calcSDBonus({ role:"투수", cardType:"시즌", stars:5, position:"선발" }, "SP1", st, sp);
};
/* 포지션 특훈·유니폼 등이 같이 들어오므로 "고른 것과 안 고른 것의 차이"로 본다 */
eq('40 좌 - 인내도 +1', sdBat(40, "L").n - sdBat(40, "").n, 1);
eq('40 좌 - 파워도 +1', sdBat(40, "L").p - sdBat(40, "").p, 1);
eq('200 좌 - 인내 +2', sdBat(200, "L").n - sdBat(200, "").n, 2);
var atSP = function(sp){ return calcSDBonus({ role:"타자", cardType:"시즌", stars:5, team:"키움" }, "DH", { teamName:"키움" }, sp, 8); };
eq('30 자동 - 인내 +1', atSP(30).n - atSP(29).n, 1);
eq('90 자동 - 인내 +2', atSP(90).n - atSP(89).n, 2);
/* 110 은 2026-09 부터 드림/나눔 선택 — 아래 [세트덱 인게임 대조] 에서 본다 */
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
eq('라이브 5성 보너스 +8 (2026-09-18)', getPotmBonus(potmPl, { teamName: '키움' }), 8);
eq('구단 다르면 0', getPotmBonus(potmPl, { teamName: '삼성' }), 0);
/* 유저가 끄면 이 덱에서는 POTM 이 아니다 */
eq('사용자 해제', getPotmBonus(potmPl, { teamName: '키움', potmOff: ['홍길동|키움'] }), 0);
/* 전역에 없어도 유저가 켜면 POTM */
__setGlobalPotm([]);
eq('전역에 없으면 0', getPotmBonus(potmPl, { teamName: '키움' }), 0);
eq('사용자 지정', getPotmBonus(potmPl, { teamName: '키움', potmOn: ['홍길동|키움'] }), 8);
eq('사용자 지정도 구단 일치 필요', getPotmBonus(potmPl, { teamName: '삼성', potmOn: ['홍길동|키움'] }), 0);
/* 끄기가 켜기보다 우선 */
eq('해제가 우선', getPotmBonus(potmPl, { teamName: '키움', potmOn: ['홍길동|키움'], potmOff: ['홍길동|키움'] }), 0);
/* 카드 종류별 보너스 */
eq('임팩트', getPotmBonus({ name: 'A', team: '키움', cardType: '임팩트' }, { teamName: '키움', potmOn: ['A|키움'] }), 2);
eq('골든글러브', getPotmBonus({ name: 'A', team: '키움', cardType: '골든글러브' }, { teamName: '키움', potmOn: ['A|키움'] }), 1);
eq('라이브 4성 +14', getPotmBonus({ name: 'A', team: '키움', cardType: '라이브', stars: 4 }, { teamName: '키움', potmOn: ['A|키움'] }), 14);
__setGlobalPotm([]);

console.log('\n[POTM 규칙] 2026-09-18 — (구단, 선수) 한 쌍 · 라이브 / 올스타(2026) / 스페셜');
{
  const K = '키움';
  const on = (pl, extra) => Object.assign({ teamName: K, potmOn: [potmKey(pl)] }, extra || {});
  const live = (o) => Object.assign({ name: '라', team: K, cardType: '라이브', role: '타자', stars: 5, setScore: 4, year: '2026' }, o);
  const ol = (o) => Object.assign({ name: '올', team: K, cardType: '올스타', role: '타자', stars: 5, year: '2026' }, o);
  const sp = (o) => Object.assign({ name: '스', team: K, cardType: '임팩트', role: '타자', stars: 4 }, o);

  /* 명단 매칭 — 이름과 원래 구단이 둘 다 맞아야 */
  __setGlobalPotm([{ name: '라', team: K }]);
  eq('명단 — 이름·구단 일치', isPotmFor(live(), {}) ? 1 : 0, 1);
  eq('명단 — 같은 이름 다른 구단은 아님', isPotmFor(live({ team: '두산' }), {}) ? 1 : 0, 0);
  __setGlobalPotm([{ name: '라', team: 'KIA' }]);
  eq('명단 — KIA 는 기아로', isPotmFor(live({ team: '기아' }), {}) ? 1 : 0, 1);
  eq('키 — KIA 는 기아로', potmKey({ name: '라', team: 'KIA' }) === '라|기아' ? 1 : 0, 1);
  __setGlobalPotm([]);

  /* 라이브 — 자팀만 */
  eq('라이브 5성 능력치 +8', potmEffect(live(), on(live())).stat, 8);
  eq('라이브 4성 능력치 +14', potmEffect(live({ stars: 4 }), on(live())).stat, 14);
  eq('라이브 3성 능력치 +18', potmEffect(live({ stars: 3 }), on(live())).stat, 18);
  eq('라이브 1성 능력치 +18', potmEffect(live({ stars: 1 }), on(live())).stat, 18);
  eq('라이브 셋포 4 → 10', potmEffect(live(), on(live())).setScore, 10);
  eq('라이브 셋포 차이 +6', potmEffect(live(), on(live())).setDelta, 6);
  eq('라이브 셋포 10 → 11', potmEffect(live({ setScore: 10 }), on(live())).setScore, 11);
  eq('라이브 타팀은 효과 없음', potmEffect(live({ team: '두산' }), { teamName: K, potmOn: ['라|두산'] }).on ? 1 : 0, 0);
  const lp = applyPotmPot(live({ pot1: 'SR+', pot2: 'C', pot3: 'S', potType3: '뜬공형' }), on(live()));
  eq('라이브 잠재력 모두 A · 각성 없음', lp.pot1 === 'A' && lp.pot2 === 'A' && lp.pot3 === '' && lp.potmPot === 'live' ? 1 : 0, 1);
  eq('POTM 아니면 잠재력 그대로 (같은 객체)', applyPotmPot(live({ pot1: 'SR+' }), { teamName: K }).pot1 === 'SR+' ? 1 : 0, 1);

  /* 라이브 POTM 은 50·130 우(임국시골)를 골라도 받는다 */
  const sd50 = (pl, v, st) => calcSDBonus(pl, 'DH', Object.assign({ s95: '', s125: '', s110: '', s50: v }, st), 50, 8).p;
  eq('50 우 — POTM 라이브 +1', sd50(live(), 'R', on(live())) - sd50(live(), '', on(live())), 1);
  eq('50 우 — POTM 아닌 라이브 0', sd50(live(), 'R', { teamName: K }) - sd50(live(), '', { teamName: K }), 0);
  eq('50 좌 — POTM 라이브도 라이브로 +1', sd50(live(), 'L', on(live())) - sd50(live(), '', on(live())), 1);
  eq('130 우 — POTM 라이브 +1', calcSDBonus(live(), 'DH', Object.assign({ s95: '', s125: '', s110: '', s130: 'R' }, on(live())), 130, 8).a
     - calcSDBonus(live(), 'DH', Object.assign({ s95: '', s125: '', s110: '', s130: '' }, on(live())), 130, 8).a, 1);
  /* 2026-09-20 사용자 확인 — POTM 으로 뽑힌 선수는 카드 종류와 무관하게 우쪽 "모두 적용" 구간을 받는다 */
  eq('50 우 — 올스타 POTM 도 받는다', sd50(ol(), 'R', on(ol())) - sd50(ol(), '', on(ol())), 1);
  eq('50 우 — POTM 아닌 올스타는 못 받는다', sd50(ol(), 'R', { teamName: K }) - sd50(ol(), '', { teamName: K }), 0);
  /* "라이브/스페셜 세트덱 효과 모두 적용" 은 30·50·90·130·150·170 의 우에만 있다 (2026-09-18 사용자 확인) */
  const sdAt = (sp, v, st) => calcSDBonus(live(), 'DH', Object.assign({ s95: '', s125: '', s110: '', s30: '', s90: '', s150: '', s170: '', ['s' + sp]: v }, st), sp, 8).p;
  eq('30·90·150·170 우 — POTM 라이브도 받는다',
    [30, 90, 150, 170].every((sp) => sdAt(sp, 'R', on(live())) - sdAt(sp, '', on(live())) > 0) ? 1 : 0, 1);
  /* 올스타 POTM 도 같은 여섯 구간을 받는다 (올러 사례 — 50·130 우에서 각 +1) */
  const sdOl = (sp, v, st) => calcSDBonus(ol(), 'DH', Object.assign({ s95: '', s125: '', s110: '', s30: '', s50: '', s90: '', s130: '', s150: '', s170: '', ['s' + sp]: v }, st), sp, 8).p;
  eq('여섯 구간 우 — POTM 올스타도 받는다',
    [30, 50, 90, 130, 150, 170].every((sp) => sdOl(sp, 'R', on(ol())) - sdOl(sp, '', on(ol())) > 0) ? 1 : 0, 1);
  eq('여섯 구간 우 — POTM 아닌 올스타는 0',
    [30, 50, 90, 130, 150, 170].every((sp) => sdOl(sp, 'R', { teamName: K }) - sdOl(sp, '', { teamName: K }) === 0) ? 1 : 0, 1);
  eq('그 구간 우 — POTM 아닌 라이브는 0',
    [30, 90, 150, 170].every((sp) => sdAt(sp, 'R', { teamName: K }) - sdAt(sp, '', { teamName: K }) === 0) ? 1 : 0, 1);
  eq('모두 적용 표시는 우에만 · 여섯 구간뿐',
    SD_RULES.filter((r) => r.who && r.who.potm).map((r) => r.sp + r.side).join() === '30R,50R,90R,130R,150R,170R' ? 1 : 0, 1);

  /* 능력치 +N 은 모든 능력치 (인내·주루·수비 포함) */
  const b0 = calcSDBonus(live(), 'DH', { teamName: K, s95: '', s125: '', s110: '' }, 0, 8);
  const b1 = calcSDBonus(live(), 'DH', Object.assign({ s95: '', s125: '', s110: '' }, on(live())), 0, 8);
  eq('POTM 타자 인내도 +8', b1.n - b0.n, 8);
  eq('POTM 타자 주루 +8 (기록)', b1.run - b0.run, 8);
  eq('POTM 타자 수비 +8 (기록)', b1.def - b0.def, 8);
  const pitL = live({ role: '투수', position: '선발' });
  const p0 = calcSDBonus(pitL, 'SP1', { teamName: K, s95: '', s125: '', s110: '' }, 0);
  const p1 = calcSDBonus(pitL, 'SP1', Object.assign({ s95: '', s125: '', s110: '' }, on(pitL)), 0);
  eq('POTM 투수 변화 +8', p1.c - p0.c, 8);
  eq('POTM 투수 제구 +8 (기록)', p1.ctl - p0.ctl, 8);

  /* 올스타 — 2026 카드만, 자팀 / 같은 군 / 다른 군 */
  const eOwn = potmEffect(ol(), on(ol()));
  eq('올스타 자팀 +6 · 셋포 12 (평소 8 에서 +4)', eOwn.stat === 6 && eOwn.setScore === 12 && eOwn.setDelta === 4 && eOwn.rel === 'own' ? 1 : 0, 1);
  const lg = ol({ team: 'LG' });   /* 키움·LG 모두 나눔 */
  const eLg = potmEffect(lg, on(lg));
  eq('올스타 같은 군 +3 · 셋포 8', eLg.stat === 3 && eLg.setScore === 8 && eLg.setDelta === 4 && eLg.rel === 'league' ? 1 : 0, 1);
  const ds = ol({ team: '두산' }); /* 두산은 드림 */
  const eDs = potmEffect(ds, on(ds));
  eq('올스타 다른 군 +3 · 셋포 4 (평소 2 에서 +2)', eDs.stat === 3 && eDs.setScore === 4 && eDs.setDelta === 2 && eDs.rel === 'other' ? 1 : 0, 1);
  eq('올스타 2025 카드는 효과 없음', potmEffect(ol({ year: '2025' }), on(ol())).on ? 1 : 0, 0);
  eq('올스타 연도 숫자도 인식', potmEffect(ol({ year: 2026 }), on(ol())).on ? 1 : 0, 1);
  const op = applyPotmPot(ol({ pot1: 'C', pot2: 'B', potType2: '풀스윙', pot3: '', potType3: '' }), on(ol()));
  eq('올스타 타자 잠재력 A · 클러치 SR+ · 각성 없음', op.pot1 === 'A' && op.pot2 === 'SR+' && op.potType2 === '클러치' && op.pot3 === '' && op.potmPot === 'olstar' ? 1 : 0, 1);
  const olP = ol({ role: '투수', position: '선발' });
  const opp = applyPotmPot(olP, on(olP));
  eq('올스타 투수 침착 SR+', opp.pot2 === 'SR+' && opp.potType2 === '침착' ? 1 : 0, 1);

  /* 스페셜 — 자팀만, FA·와일드카드는 자팀 */
  eq('스페셜 임팩트 자팀 +2 · 셋포 +1', potmEffect(sp(), on(sp())).stat === 2 && potmEffect(sp(), on(sp())).setDelta === 1 ? 1 : 0, 1);
  eq('스페셜 골글 +1', potmEffect(sp({ cardType: '골든글러브' }), on(sp())).stat, 1);
  eq('스페셜 시그 +2', potmEffect(sp({ cardType: '시그니처' }), on(sp())).stat, 2);
  eq('스페셜 국대 +2', potmEffect(sp({ cardType: '국가대표' }), on(sp())).stat, 2);
  eq('스페셜 셋포 — 임팩트 8', potmEffect(sp(), on(sp())).setScore, 8);
  eq('스페셜 셋포 — 골글 7', potmEffect(sp({ cardType: '골든글러브' }), on(sp())).setScore, 7);
  const spO = sp({ team: '두산' });
  eq('스페셜 타팀은 효과 없음', potmEffect(spO, on(spO)).on ? 1 : 0, 0);
  const spFa = sp({ team: '두산', isFa: true });
  const eFa = potmEffect(spFa, on(spFa));
  eq('스페셜 타팀 FA 는 자팀 — +2 · 셋포 +1 (FA 감점 뒤)', eFa.on && eFa.stat === 2 && eFa.setScore === 6 && eFa.rel === 'flag' ? 1 : 0, 1);
  const natWc = sp({ team: '두산', cardType: '국가대표', isWildcard: true });
  eq('스페셜 타팀 와일드카드 국대 +2 · 셋포 8', potmEffect(natWc, on(natWc)).stat === 2 && potmEffect(natWc, on(natWc)).setScore === 8 ? 1 : 0, 1);
  const selfFa = sp({ isFa: true });
  eq('자팀 선수의 FA 표시는 무시 — 셋포 7 + 1 = 8', potmEffect(selfFa, on(selfFa)).setScore, 8);
  eq('시즌 카드는 스페셜 POTM 아님', potmEffect(sp({ cardType: '시즌' }), on(sp())).on ? 1 : 0, 0);
  eq('스페셜은 잠재력 고정 없음', applyPotmPot(sp({ pot1: 'SR+' }), on(sp())).pot1 === 'SR+' ? 1 : 0, 1);

  /* 총 셋포 — 덱별 설정(끄기·가정)도 따른다 */
  const total = (d, sd) => computeLineupSetDeck((s) => d[s] || null, Object.assign({ liveSetPo: 0 }, sd));
  const deck = { C: live(), SP1: ol({ role: '투수', position: '선발' }) };
  eq('총 셋포 — POTM 없음 라이브 4 + 자팀 올스타 8', total(deck, { teamName: K }), 12);
  eq('총 셋포 — 둘 다 가정하면 10 + 12', total(deck, { teamName: K, potmOn: ['라|키움', '올|키움'] }), 22);
  __setGlobalPotm([{ name: '라', team: K }, { name: '올', team: K }]);
  eq('총 셋포 — 명단 적용', total(deck, { teamName: K }), 22);
  eq('총 셋포 — 덱에서 끈 선수는 평소 셋포 (10 + 8)', total(deck, { teamName: K, potmOff: ['올|키움'] }), 18);
  __setGlobalPotm([]);

  /* 올스타 평소 셋포 — 자팀 8, 같은 군 4, 다른 군 2 (2026-09-19) */
  eq('올스타 평소 셋포 — 자팀 8', cardSetScore(ol(), K), 8);
  eq('올스타 평소 셋포 — 같은 군 타팀 4', cardSetScore(ol({ team: 'LG' }), K), 4);
  eq('올스타 평소 셋포 — 다른 군 타팀 2', cardSetScore(ol({ team: '두산' }), K), 2);
  eq('올스타 평소 셋포 — 덱 구단 모르면 2 (다른 군과 같게)', cardSetScore(ol(), ''), 2);
  eq('올스타 평소 셋포 — KIA 는 기아로 (자팀 8)', cardSetScore(ol({ team: 'KIA' }), '기아'), 8);
  eq('올스타 평소 셋포 — 2025 자팀도 8', cardSetScore(ol({ year: '2025' }), K), 8);
  eq('총 셋포 — 다른 군 올스타 2', total({ C: ol({ team: '두산' }) }, { teamName: K }), 2);
  eq('총 셋포 — 같은 군 올스타 4', total({ C: ol({ team: 'LG' }) }, { teamName: K }), 4);
  eq('올스타 다른 군 POTM — 셋포 2 → 4', potmEffect(ol({ team: '두산' }), on(ol({ team: '두산' }))).setDelta, 2);

  /* 라이브·올스타는 각성 잠재력이 없다 — 입력값이 있어도 점수에 넣지 않는다 */
  const lu0 = { enhance: '' };
  const withAwk = (o) => Object.assign({ pot3: 'S', potType3: '뜬공형', power: 80, accuracy: 80, eye: 80 }, o);
  eq('각성 무시 — 라이브', calcBat(withAwk(live()), lu0, { p: 0, a: 0, e: 0, n: 0 }).total - calcBat(Object.assign(withAwk(live()), { pot3: '' }), lu0, { p: 0, a: 0, e: 0, n: 0 }).total, 0);
  eq('각성 무시 — 올스타', calcBat(withAwk(ol()), lu0, { p: 0, a: 0, e: 0, n: 0 }).total - calcBat(Object.assign(withAwk(ol()), { pot3: '' }), lu0, { p: 0, a: 0, e: 0, n: 0 }).total, 0);
  eq('각성 반영 — 임팩트는 그대로', calcBat(withAwk(sp()), lu0, { p: 0, a: 0, e: 0, n: 0 }).total - calcBat(Object.assign(withAwk(sp()), { pot3: '' }), lu0, { p: 0, a: 0, e: 0, n: 0 }).total > 0 ? 1 : 0, 1);
  eq('각성 점수 함수 — 라이브·올스타 0', awakenScore(withAwk(live())) === 0 && awakenScore(withAwk(ol())) === 0 ? 1 : 0, 1);
  const pkOl = peakPl(ol({ potType3: '', pot3: '' }), 'DH');
  eq('고점판독 — 올스타에 각성을 채우지 않음', pkOl.pot3 === '' && !pkOl.potType3 ? 1 : 0, 1);
  const pkImp = peakPl(sp({ potType3: '', pot3: '' }), 'DH');
  eq('고점판독 — 임팩트는 각성 S 로 채움', pkImp.pot3 === 'S' && !!pkImp.potType3 ? 1 : 0, 1);
  __setGlobalPotm([]);

  /* 덱 기준 선수 — FA 정리 + 잠재력 고정, 고점판독기는 고정 잠재력을 건드리지 않는다 */
  const dp = deckPl(live({ pot1: 'C' }), on(live()));
  eq('deckPl — POTM 잠재력 고정', dp.pot1 === 'A' && dp.potmPot === 'live' ? 1 : 0, 1);
  const pk = peakPl(Object.assign({}, dp, { potType1: '풀스윙' }), 'DH');
  eq('고점판독 — POTM 고정 잠재력은 그대로', pk.pot1 === 'A' && pk.pot3 === '' ? 1 : 0, 1);

  /* 요약 문구 */
  eq('요약 — 라이브', potmSummary(potmEffect(live(), on(live()))).startsWith('라이브 POTM — 능력치 +8 · 셋포 10') ? 1 : 0, 1);
  eq('요약 — 올스타 같은 군', potmSummary(eLg).startsWith('올스타 POTM (같은 군) — 능력치 +3 · 셋포 8') ? 1 : 0, 1);
  eq('요약 — 효과 없으면 빈 문자열', potmSummary(potmEffect(spO, on(spO))), '');
  eq('요약 — 올스타 타자는 클러치 SR+ 만', potmSummary(eLg, '타자').includes('잠재력 A (클러치 SR+)') ? 1 : 0, 1);
  eq('요약 — 올스타 투수는 침착 SR+ 만', potmSummary(eLg, '투수').includes('잠재력 A (침착 SR+)') ? 1 : 0, 1);
  const info = getPotmInfo(ds, on(ds));
  eq('표시 정보 — 올스타 다른 군도 POTM', info.isPotm && info.isOlstar && info.rel === 'other' && info.bonus === 3 ? 1 : 0, 1);
}


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
  eq('분포 키 26개 (훈련 12 + 특훈 14 — 와일드카드 2 포함)', Object.keys(D).length, 26);
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
  /* 특훈 기본값 = 특훈 횟수 (국가대표 +4, 와일드카드 +6) — 어떤 표본도 기본값 × 가중치 아래로 내려가지 않는다 */
  const low = (k) => D[k][0];
  const atLeast = (k, v) => low(k) >= v - 0.001 ? 1 : 0;
  eq('국대 타자 특훈 ≥ 파워 4', atLeast('spec_bat_국가대표', 4), 1);
  eq('국대 투수 특훈 ≥ 구위 4 × 1.35', atLeast('spec_pit_국가대표', 5.4), 1);
  eq('와일드카드 타자 특훈 ≥ 파워 6', atLeast('spec_bat_wc_국가대표', 6), 1);
  eq('와일드카드 투수 특훈 ≥ 구위 6 × 1.35', atLeast('spec_pit_wc_국가대표', 8.1), 1);
  eq('FA 시그 타자 특훈 ≥ 파워 5', atLeast('spec_bat_fa_시그니처', 5), 1);
  eq('골글 타자 특훈 ≥ 파워 3', atLeast('spec_bat_골든글러브', 3), 1);
  eq('와일드카드는 국가대표에만', D['spec_bat_wc_시그니처'] === undefined && D['spec_bat_fa_국가대표'] === undefined ? 1 : 0, 1);
  eq('와일드카드 특훈 중앙값 > 국대', med('spec_bat_wc_국가대표') > med('spec_bat_국가대표') ? 1 : 0, 1);
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
    const parts = key.split('_'), role = parts[0], ct = parts[parts.length - 1];
    /* 특훈 횟수 = 기본 보너스 (골글·시그·임팩트 3, 국대 4, FA·와일드카드 +2) */
    const trials = specTrialsOf({ cardType: ct, isFa: parts[1] === 'fa', isWildcard: parts[1] === 'wc' });
    const b0 = trials;
    const perTrial = ct === '임팩트' ? 2 : 3;
    if (v.some(x => x > 15)) bad.push(key + ' 15 초과');
    if (v[role === 'bat' ? 0 : 1] < b0) bad.push(key + ' 기본값 미만');
    if (v.reduce((a, b) => a + b, 0) - b0 > trials * perTrial) bad.push(key + ' 시행 초과');
    const sc = role === 'bat' ? v[0] * 1 + v[1] * 0.85 + v[2] * 0.4 + v[3] * 0.15 : v[0] * 1.05 + v[1] * 1.35;
    const pct = getPercentile(TRD['spec_' + key], Math.round(sc * 100) / 100);
    if (!(pct >= 0.1 && pct <= 0.5)) bad.push(key + ' 백분위 ' + pct);
  }
  eq('특훈 14가지(와일드카드 2 포함) — 15 이하·기본값 포함·상위 0.1~0.5% (' + (bad.join(' / ') || '문제 없음') + ')', bad.length + (Object.keys(PEAK_SPEC).length === 14 ? 0 : 100), 0);
  /* 앱 분포에도 와일드카드 특훈 키가 있다 */
  eq('앱 분포 — 와일드카드 특훈 타자·투수', Array.isArray(TRD['spec_bat_wc_국가대표']) && Array.isArray(TRD['spec_pit_wc_국가대표']) ? 1 : 0, 1);
  eq('앱 분포 — 국대 특훈 최솟값은 기본 +4 (파워 4)', TRD['spec_bat_국가대표'][0], 4);
  eq('앱 분포 — 와일드카드 특훈 최솟값은 기본 +6 (구위 6 × 1.35)', TRD['spec_pit_wc_국가대표'][0], 8.1);

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

console.log('\n[특수 스킬 자동 감지] 2026-09-18 — 점수 계산과 같은 실제 적용 레벨(effSkillLv)로 본다');
{
  const S27 = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'SP1', 'SP2', 'SP3', 'SP4', 'SP5',
    'RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6', 'CP', 'BN1', 'BN2', 'BN3', 'BN4', 'BN5', 'BN6'];
  const find = (d, sd) => detectTeamBuffs(S27, (s) => d[s] || null, sd || {});
  /* 레벨을 "자동"으로 둔 선수 (신규 선수 기본값) */
  const auto = (o) => ({ sLvManual: false, ...o });
  const natB = (o) => auto({ role: '타자', cardType: '국가대표', ...o });
  const natP = (o) => auto({ role: '투수', position: '선발', cardType: '국가대표', ...o });
  const catcher = (ct, o) => auto({ role: '타자', cardType: ct, skill1: '포수리드', ...o });

  eq('국대에이스 1옵 · 자동 레벨 국가대표 → 6렙', find({ DH: natB({ skill1: '국대에이스' }) }).natBat === '6렙' ? 1 : 0, 1);
  eq('국대에이스 2옵 · 자동 레벨 → 5렙', find({ DH: natB({ skill2: '국대에이스' }) }).natBat === '5렙' ? 1 : 0, 1);
  eq('새 이름(국대에이스(버프X))도 같다', find({ DH: natB({ skill1: '국대에이스(버프X)' }) }).natBat === '6렙' ? 1 : 0, 1);
  eq('투수 카드면 투수용으로 잡는다', (() => { const r = find({ SP1: natP({ skill1: '국대에이스' }) }); return r.natPit === '6렙' && r.natBat === '없음'; })() ? 1 : 0, 1);
  eq('레벨을 직접 넣은 선수는 그 레벨 (5렙)', find({ DH: { role: '타자', cardType: '국가대표', sLvManual: true, skill1: '국대에이스', s1Lv: 5 } }).natBat === '5렙' ? 1 : 0, 1);
  eq('직접 넣었는데 레벨이 0이면 없음', find({ DH: { role: '타자', cardType: '국가대표', sLvManual: true, skill1: '국대에이스', s1Lv: 0 } }).natBat === '없음' ? 1 : 0, 1);
  eq('국대에이스는 6렙 상한 — 옛 저장값 10렙도 6렙',
    find({ DH: { role: '타자', cardType: '국가대표', sLvManual: true, skill1: '국대에이스', s1Lv: 10 } }).natBat === '6렙' ? 1 : 0, 1);
  eq('버프 스킬이 아니면 안 잡는다', find({ DH: auto({ role: '타자', cardType: '라이브', skill1: '정밀타격' }) }).natBat === '없음' ? 1 : 0, 1);

  eq('포수리드 · 자동 레벨 골든글러브 1옵 → 6렙', find({ C: catcher('골든글러브') }).catchLead === '6렙' ? 1 : 0, 1);
  eq('포수리드 · 자동 레벨 라이브 1옵 → 7렙', find({ C: catcher('라이브') }).catchLead === '7렙' ? 1 : 0, 1);
  eq('포수리드 · 자동 레벨 올스타 1옵 → 8렙', find({ C: catcher('올스타') }).catchLead === '8렙' ? 1 : 0, 1);
  eq('포수리드 · 포지션 특훈 스킬 보너스 +1 (라이브 7 → 8)',
    find({ C: catcher('라이브') }, { pts_C: ['포수리드', ''] }).catchLead === '8렙' ? 1 : 0, 1);
  eq('포수리드 · 10렙 상한 (수동 10 + 특훈 보너스)',
    find({ C: { role: '타자', cardType: '라이브', sLvManual: true, skill1: '포수리드', s1Lv: 10 } }, { pts_C: ['포수리드'] }).catchLead === '10렙' ? 1 : 0, 1);
  eq('포수리드 · 옛 이름 "포수 리드" 도 잡는다', find({ C: catcher('라이브', { skill1: '포수 리드' }) }).catchLead === '7렙' ? 1 : 0, 1);
  eq('국대에이스는 후보 칸도 본다', find({ BN3: natB({ skill1: '국대에이스' }) }).natBat === '6렙' ? 1 : 0, 1);
  eq('국대에이스 여럿이면 가장 높은 레벨',
    find({ DH: natB({ skill2: '국대에이스' }), BN1: natB({ skill1: '국대에이스' }) }).natBat === '6렙' ? 1 : 0, 1);
  /* 포수리드는 포수로 나가야 걸린다 (2026-09-18 사용자 확인) */
  eq('포수리드 · 다른 자리 선수 것은 안 본다', find({ DH: catcher('올스타') }).catchLead === '없음' ? 1 : 0, 1);
  eq('포수리드 · 후보 포수 것도 안 본다', find({ BN1: catcher('올스타') }).catchLead === '없음' ? 1 : 0, 1);
  eq('포수리드 · 포수 자리 값만 쓴다 (후보에 더 높은 포수가 있어도)',
    find({ C: catcher('골든글러브'), BN1: catcher('올스타') }).catchLead === '6렙' ? 1 : 0, 1);
  eq('빈 라인업은 모두 없음', (() => { const r = find({}); return r.natBat === '없음' && r.natPit === '없음' && r.catchLead === '없음'; })() ? 1 : 0, 1);

  /* computeLineupSetDeck 이 sdState 에 채우고, 그 값이 점수에 들어간다 */
  const sd = { liveSetPo: 0 };
  computeLineupSetDeck((s) => ({ C: catcher('라이브'), DH: natB({ skill1: '국대에이스' }), SP1: natP({ skill2: '국대에이스' }) })[s] || null, sd);
  eq('sdState 에 채운다', sd._autoCatch === '7렙' && sd._autoNatBat === '6렙' && sd._autoNatPit === '5렙' ? 1 : 0, 1);
  const pitOnly = { role: '투수', position: '선발', cardType: '골든글러브', change: 100, stuff: 100 };
  const luP = (p) => ({ enhance: p.enhance, trainC: 0, trainS: 0, skill1: '', s1Lv: 0, skill2: '', s2Lv: 0, skill3: '', s3Lv: 0 });
  const pitWith = (s) => calcPit(pitOnly, luP(pitOnly), calcSDBonus(pitOnly, 'SP1', s, 0)).total;
  eq('자동 레벨 포수의 포수리드 7렙이 투수 점수에 들어간다 (변화 1.05 + 구위 1.35)',
    pitWith(sd) - pitWith({ liveSetPo: 0, _autoCatch: '없음', _autoNatPit: '없음' }),
    1.05 + 1.35 + (1.05 + 1.35), 0.011);   /* 포수리드 7렙 + 국대에이스(투수) 5렙 */
  eq('패널에서 직접 고른 값이 자동 감지보다 우선',
    pitWith({ ...sd, catchLead: '없음', natPit: '없음' }) - pitWith({ liveSetPo: 0 }), 0, 0.011);
}

console.log('\n[스킬 레벨 저장] 2026-09-18 사용자 확인 — 자동이면 계산된 레벨을 저장한다');
{
  const nat = (o) => ({ role: '타자', cardType: '국가대표', sLvManual: false, ...o });
  eq('자동 1옵 — 저장 레벨이 6', normPlayerSkills(nat({ skill1: '국대에이스' })).s1Lv, 6);
  eq('자동 2옵 — 저장 레벨이 5', normPlayerSkills(nat({ skill2: '국대에이스' })).s2Lv, 5);
  eq('자동 라이브 1옵 — 저장 레벨이 7',
    normPlayerSkills({ role: '타자', cardType: '라이브', sLvManual: false, skill1: '포수리드' }).s1Lv, 7);
  eq('자동이라도 포지션 특훈 보너스는 저장하지 않는다 (자리마다 다르므로)',
    normPlayerSkills({ role: '타자', cardType: '라이브', sLvManual: false, skill1: '포수리드' }).s1Lv, 7);
  eq('직접 넣은 레벨은 그대로',
    normPlayerSkills({ role: '타자', cardType: '라이브', sLvManual: true, skill1: '포수리드', s1Lv: 9 }).s1Lv, 9);
  eq('국가대표 전용 스킬은 직접 넣어도 6 상한',
    normPlayerSkills({ role: '타자', cardType: '국가대표', sLvManual: true, skill1: '국대에이스', s1Lv: 10 }).s1Lv, 6);
  eq('띄어쓰기만 다른 옛 이름은 표 이름으로 정리',
    normPlayerSkills(nat({ skill1: '포수 리드' })).skill1 === '포수리드' ? 1 : 0, 1);
  eq('스킬이 없으면 그대로 둔다', normPlayerSkills({ role: '타자', cardType: '라이브', sLvManual: false }).s1Lv === undefined ? 1 : 0, 1);
  eq('고칠 게 없으면 같은 객체', (() => { const p = nat({ skill1: '국대에이스', s1Lv: 6 }); return normPlayerSkills(p) === p; })() ? 1 : 0, 1);
  eq('목록도 같은 규칙', normPlayerList([nat({ skill1: '국대에이스' })])[0].s1Lv, 6);

  /* 포지션 특훈 스킬 보너스는 띄어쓰기가 달라도 붙는다 */
  eq('특훈 보너스 — 띄어쓰기 무시', hasPtSkill(['포수 리드'], '포수리드') ? 1 : 0, 1);
  eq('특훈 보너스 — 다른 스킬은 아님', hasPtSkill(['정밀타격'], '포수리드') ? 1 : 0, 0);
  eq('효과 레벨에도 반영 (라이브 7 + 보너스 = 8)',
    effSkillLv('포수리드', 0, false, '라이브', 1, '타자', ['포수 리드']), 8);
}

console.log('\n[자동 최적화] 2026-09-18 — 구간마다 총점을 견주고, 연도 구간은 연도덱 설정을 따른다');
{
  /* 가짜 총점: 켠 쪽마다 미리 정한 점수를 더한다. 연도가 붙으면 그 연도 점수를 쓴다 */
  const mk = (table) => (sd) => {
    let t = 0;
    for (const k of Object.keys(sd)) {
      if (!/^s\d+$/.test(k) || !sd[k]) continue;
      const side = String(sd[k]).charAt(0), yr = String(sd[k]).split(':')[1] || '';
      t += (table[k.slice(1) + side + (yr ? ':' + yr : '')] || 0);
    }
    return t;
  };
  const base = { s95: '', s125: '', s110: '', teamName: '키움' };

  /* 높은 쪽을 고른다 */
  let r = optimizeSetDeck(base, 200, mk({ '40L': 5, '40R': 9, '60L': 3, '60R': 1 }), {});
  eq('총점이 높은 쪽을 고른다 (40 우, 60 좌)', r.next.s40 === 'R' && r.next.s60 === 'L' ? 1 : 0, 1);
  eq('110 은 건드리지 않는다 (덱 구단이 정함)', r.next.s110 === '' ? 1 : 0, 1);
  eq('연도덱을 안 고르면 다섯 구간을 비운다',
    r.blanks.join('·') === '55·75·180·185·190' && [55, 75, 180, 185, 190].every((sp) => r.next['s' + sp] === '') ? 1 : 0, 1);

  /* 좌·우가 같으면 굳어 있는 쪽 (전원 자팀 스페셜 덱의 30·90·150·170 처럼) */
  r = optimizeSetDeck(base, 200, mk({}), {});
  eq('같으면 30·90·150·170 은 좌', [30, 90, 150, 170].every((sp) => r.next['s' + sp] === 'L') ? 1 : 0, 1);
  eq('같으면 50·130·105·165·195·115·95 는 우',
    [50, 130, 105, 165, 195, 115, 95].every((sp) => r.next['s' + sp] === 'R') ? 1 : 0, 1);
  eq('같으면 125·175 는 좌', [125, 175].every((sp) => r.next['s' + sp] === 'L') ? 1 : 0, 1);
  eq('70·135 는 굳어 있지 않다 (덱에 따라 갈림)', SD_TIE_SIDE[70] === undefined && SD_TIE_SIDE[135] === undefined ? 1 : 0, 1);

  /* 열리지 않은 구간은 그대로 둔다 */
  r = optimizeSetDeck(base, 100, mk({ '40L': 5 }), {});
  eq('셋포가 모자란 구간은 손대지 않는다', r.next.s120 === undefined && r.next.s40 === 'L' ? 1 : 0, 1);

  /* 연도덱 — 체크한 쪽만 채운다 */
  r = optimizeSetDeck(base, 200, mk({}), { pitOn: true, pitYears: ['2024'] });
  eq('투수 연도덱 — 55·190 우에 그 연도', r.next.s55 === 'R:2024' && r.next.s190 === 'R:2024' ? 1 : 0, 1);
  eq('투수만 체크하면 75 는 우', r.next.s75 === 'R:2024' ? 1 : 0, 1);
  eq('투수만 체크하면 타자 구간은 비운다', r.blanks.join('·') === '180·185' ? 1 : 0, 1);
  r = optimizeSetDeck(base, 200, mk({}), { batOn: true, batYears: ['2026'] });
  eq('타자 연도덱 — 180·185 우에 그 연도', r.next.s180 === 'R:2026' && r.next.s185 === 'R:2026' ? 1 : 0, 1);
  eq('타자만 체크하면 75 는 좌', r.next.s75 === 'L:2026' ? 1 : 0, 1);
  eq('타자만 체크하면 투수 구간은 비운다', r.blanks.join('·') === '55·190' ? 1 : 0, 1);

  /* 둘 다 체크하면 75 는 좌·우를 견준다 */
  r = optimizeSetDeck(base, 200, mk({ '75L:2026': 10, '75R:2024': 4 }), { batOn: true, batYears: ['2026'], pitOn: true, pitYears: ['2024'] });
  eq('둘 다 체크 — 75 는 총점이 높은 쪽 (타자)', r.next.s75 === 'L:2026' ? 1 : 0, 1);
  r = optimizeSetDeck(base, 200, mk({ '75L:2026': 3, '75R:2024': 12 }), { batOn: true, batYears: ['2026'], pitOn: true, pitYears: ['2024'] });
  eq('둘 다 체크 — 75 는 총점이 높은 쪽 (투수)', r.next.s75 === 'R:2024' ? 1 : 0, 1);
  eq('둘 다 체크하면 비우는 구간이 없다', r.blanks.length, 0);

  /* 연도 후보가 여럿이면 총점이 가장 높은 연도 */
  r = optimizeSetDeck(base, 200, mk({ '185R:2020': 4, '185R:2026': 11, '180R:2020': 9, '180R:2026': 2 }),
    { batOn: true, batYears: ['2020', '2026'] });
  eq('연도 자동 — 구간마다 가장 높은 연도', r.next.s185 === 'R:2026' && r.next.s180 === 'R:2020' ? 1 : 0, 1);

  /* 원본 sdState 는 그대로 */
  const keep = JSON.stringify(base);
  optimizeSetDeck(base, 200, mk({ '40R': 9 }), {});
  eq('sdState 는 건드리지 않고 새 객체', JSON.stringify(base) === keep ? 1 : 0, 1);

  /* 구간끼리 영향을 주는 덱(발사각 문턱·강함 순위처럼) — 한 번 눌러도 제자리에 와야 한다.
     여기서는 200 을 우로 둘 때만 40 의 우가 커지도록 얽어 둔다. 한 바퀴만 훑으면 40 을 먼저 보고
     좌로 굳은 뒤 200 이 우가 되어, 다시 누르면 40 이 우로 바뀐다 */
  const linked = (sd) => {
    let t = 0;
    if (sd.s200 === 'R') t += 20;
    t += sd.s40 === 'R' ? (sd.s200 === 'R' ? 12 : 1) : 5;
    return t;
  };
  const one = optimizeSetDeck(base, 200, linked, {});
  eq('얽힌 구간도 한 번에 제자리 (40 우 · 200 우)', one.next.s40 === 'R' && one.next.s200 === 'R' ? 1 : 0, 1);
  const twice = optimizeSetDeck(one.next, 200, linked, {});
  eq('다시 눌러도 그대로', JSON.stringify(twice.next) === JSON.stringify(one.next) ? 1 : 0, 1);
  eq('점수도 그대로', linked(twice.next) - linked(one.next), 0);
  /* 번갈아 나오는 경우에도 가장 높은 판을 남긴다 */
  const flip = (sd) => (sd.s40 === 'R' ? 10 : 0) + (sd.s60 === (sd.s40 === 'R' ? 'L' : 'R') ? 3 : 0);
  const fr = optimizeSetDeck(base, 200, flip, {});
  eq('오락가락해도 점수가 가장 높은 판', flip(fr.next) >= 10 ? 1 : 0, 1);
}

console.log('\n[세트덱 인게임 대조] 2026-09-17 사용자 확인 — 선택 팀 · 드림/나눔 · 올스타 · 연도');
{
  const K = '키움';
  const on = (sp, v, team) => Object.assign({ s95: '', s125: '', s110: '', teamName: team === undefined ? K : team },
    v === undefined ? {} : { ['s' + sp]: v });
  /* 그 구간을 켰을 때 오르는 값. v 가 없으면 좌 고정 구간 — 셋포 sp 와 sp-1 을 비교한다 */
  const gain = (pl, slot, sp, v, key, ord) => {
    const forced = v === undefined;
    const a = calcSDBonus(pl, slot, on(sp, v), sp, ord);
    const b = calcSDBonus(pl, slot, on(sp, forced ? undefined : ''), forced ? sp - 1 : sp, ord);
    return (a[key] || 0) - (b[key] || 0);
  };
  const bat = (o) => Object.assign({ role: '타자', cardType: '시즌', stars: 5, team: K, year: '2010' }, o);
  const pit = (o) => Object.assign({ role: '투수', cardType: '시즌', stars: 5, team: K, year: '2010', position: '선발' }, o);

  eq('선택 팀 — 덱 구단 선수', isSelTeam(bat(), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — 타팀 선수는 아님', isSelTeam(bat({ team: '두산' }), { teamName: K }) ? 1 : 0, 0);
  eq('선택 팀 — 타팀 골든글러브는 선택 팀', isSelTeam(bat({ team: '두산', cardType: '골든글러브' }), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — FA 로 쓴 타팀 선수', isSelTeam(bat({ team: '두산', cardType: '임팩트', isFa: true }), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — 와일드카드 국가대표', isSelTeam(bat({ team: '두산', cardType: '국가대표', isWildcard: true }), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — 와일드카드 표시가 있어도 국가대표가 아니면 아님', isSelTeam(bat({ team: '두산', cardType: '라이브', isWildcard: true }), { teamName: K }) ? 1 : 0, 0);
  /* 덱 구단은 반드시 고르게 했으므로(구단 선택 창) 구단 없는 덱의 예외는 없다 */
  eq('선택 팀 — 덱 구단이 없으면 선수 구단으로는 안 됨', isSelTeam(bat({ team: '두산' }), { teamName: '내 덱' }) ? 1 : 0, 0);
  eq('선택 팀 — 덱 구단이 없어도 골든글러브는 선택 팀', isSelTeam(bat({ team: '두산', cardType: '골든글러브' }), { teamName: '내 덱' }) ? 1 : 0, 1);
  eq('선택 팀 — 빈 덱 구단과 구단 없는 선수는 같은 팀이 아님', isSelTeam(bat({ team: '' }), { teamName: '' }) ? 1 : 0, 0);
  eq('선택 팀 — sdState 가 없어도 오류 없이 아님', isSelTeam(bat({ team: '두산' }), undefined) ? 1 : 0, 0);

  /* 2026-09-19 사용자 확인 — 올스타는 드림·나눔 군 단위 카드다.
     같은 군이면 선택 팀 효과를 받고 다른 군이면 못 받는다 (키움·LG·기아 나눔 / 두산 드림) */
  eq('선택 팀 — 자팀 올스타', isSelTeam(bat({ cardType: '올스타' }), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — 같은 군 올스타', isSelTeam(bat({ team: 'LG', cardType: '올스타' }), { teamName: K }) ? 1 : 0, 1);
  eq('선택 팀 — 다른 군 올스타는 아님', isSelTeam(bat({ team: '두산', cardType: '올스타' }), { teamName: K }) ? 1 : 0, 0);
  eq('선택 팀 — 덱 구단이 없으면 올스타도 아님', isSelTeam(bat({ team: 'LG', cardType: '올스타' }), { teamName: '내 덱' }) ? 1 : 0, 0);
  eq('선택 팀 — 같은 군이어도 올스타가 아니면 아님', isSelTeam(bat({ team: 'LG' }), { teamName: K }) ? 1 : 0, 0);

  /* 110 구간에서 볼 군 — 골든글러브는 어느 군도 되고(깍두기), FA·와일드카드는 덱 구단 선수로 본다 */
  eq('군 — 그냥 타팀 선수는 원 소속팀의 군', sdLeagueOf(bat({ team: '두산' }), { teamName: K }) === '드림' ? 1 : 0, 1);
  eq('군 — 골든글러브는 어느 군도 된다', sdLeagueOf(bat({ team: '두산', cardType: '골든글러브' }), { teamName: K }) === '*' ? 1 : 0, 1);
  eq('군 — FA 로 쓴 타팀 선수는 덱 구단의 군', sdLeagueOf(bat({ team: '두산', cardType: '임팩트', isFa: true }), { teamName: K }) === '나눔' ? 1 : 0, 1);
  eq('군 — 와일드카드 국가대표도 덱 구단의 군', sdLeagueOf(bat({ team: '두산', cardType: '국가대표', isWildcard: true }), { teamName: K }) === '나눔' ? 1 : 0, 1);
  eq('군 — 자팀 선수에게 켜 둔 FA 표시는 무시된다', sdLeagueOf(bat({ cardType: '임팩트', isFa: true }), { teamName: K }) === '나눔' ? 1 : 0, 1);
  eq('군 — 올스타는 원 소속팀의 군 그대로', sdLeagueOf(bat({ team: '두산', cardType: '올스타' }), { teamName: K }) === '드림' ? 1 : 0, 1);

  /* 110 — 좌 드림 / 우 나눔. 골든글러브는 어느 쪽을 골라도 받는다 */
  const g110 = (pl, side) => calcSDBonus(pl, 'DH', on(110, side), 110, 8).p - calcSDBonus(pl, 'DH', on(110, side), 109, 8).p;
  eq('110 — 나눔 선수는 우에서 받는다', g110(bat({ team: 'LG' }), 'R'), 1);
  eq('110 — 드림 선수는 우에서 못 받는다', g110(bat({ team: '두산' }), 'R'), 0);
  eq('110 — 골든글러브는 좌에서도 받는다', g110(bat({ team: '기아', cardType: '골든글러브' }), 'L'), 1);
  eq('110 — 골든글러브는 우에서도 받는다', g110(bat({ team: '두산', cardType: '골든글러브' }), 'R'), 1);
  eq('110 — FA 로 쓴 드림 선수는 우(덱 구단 군)에서 받는다', g110(bat({ team: '두산', cardType: '임팩트', isFa: true }), 'R'), 1);
  eq('110 — FA 로 쓴 드림 선수는 좌에서는 못 받는다', g110(bat({ team: '두산', cardType: '임팩트', isFa: true }), 'L'), 0);

  /* 선택 팀 구간 — 같은 군 올스타가 실제로 받는지 (30 좌 "모두 +1") */
  const g30 = (pl) => calcSDBonus(pl, 'DH', on(30, 'L'), 30, 8).p - calcSDBonus(pl, 'DH', on(30, 'L'), 29, 8).p;
  eq('30 좌 — 같은 군 올스타는 받는다', g30(bat({ team: 'LG', cardType: '올스타' })), 1);
  eq('30 좌 — 다른 군 올스타는 못 받는다', g30(bat({ team: '두산', cardType: '올스타' })), 0);
  const at30 = (team, sp) => calcSDBonus(bat(), 'DH', on(30, undefined, team), sp, 8).p;
  eq('30 — 키움 덱의 키움 선수는 +1', at30(K, 30) - at30(K, 29), 1);
  eq('30 — 구단 없는 덱의 선수는 안 받음', at30('내 덱', 30) - at30('내 덱', 29), 0);

  /* 30·90·150·170 은 예전에 좌 고정이었다. 이제 좌/우를 고르고, 저장값이 없으면 예전처럼 좌다 (SD_LEGACY_AUTO) */
  eq('30 기본값 좌 — 선택 팀 타자 파워 +1', gain(bat(), 'DH', 30, undefined, 'p', 8), 1);
  eq('30 기본값 좌 — 선택 팀 타자 주루 +1 (기록만)', gain(bat(), 'DH', 30, undefined, 'run', 8), 1);
  eq('30 기본값 좌 — 타팀 타자는 0', gain(bat({ team: '두산' }), 'DH', 30, undefined, 'p', 8), 0);
  eq('90 기본값 좌 — 타팀 골든글러브 투수 구위 +2', gain(pit({ team: '두산', cardType: '골든글러브' }), 'SP1', 90, undefined, 's'), 2);
  eq('150 기본값 좌 — 선택 팀 투수 지구력 +2 (기록만)', gain(pit(), 'SP1', 150, undefined, 'sta'), 2);
  eq('170 기본값 좌 — 타팀 투수 변화 0', gain(pit({ team: 'LG' }), 'SP1', 170, undefined, 'c'), 0);
  eq('30·90·150·170 저장값이 없으면 좌',
    [30, 90, 150, 170].every((sp) => sdPick({ teamName: K }, sp) === 'L') ? 1 : 0, 1);
  eq('30 좌를 끄면(빈 값) 아무 효과 없음', gain(bat(), 'DH', 30, '', 'p', 8), 0);

  /* 30·90·150·170 우 — 인게임처럼 고를 수 있다 (2026-09-18 사용자 확인) */
  eq('30 우 — 타팀 임팩트 타자 +1', gain(bat({ team: '두산', cardType: '임팩트' }), 'DH', 30, 'R', 'p', 8), 1);
  eq('30 우 — 자팀이어도 라이브는 안 받음', gain(bat({ cardType: '라이브' }), 'DH', 30, 'R', 'p', 8), 0);
  eq('90 우 — 국가대표 투수 구위 +2', gain(pit({ cardType: '국가대표' }), 'SP1', 90, 'R', 's'), 2);
  eq('150 우 — 시그니처 타자 인내 +2', gain(bat({ cardType: '시그니처' }), 'DH', 150, 'R', 'n', 8), 2);
  eq('170 우 — 골든글러브 투수 변화 +1', gain(pit({ cardType: '골든글러브' }), 'SP1', 170, 'R', 'c'), 1);
  eq('170 우 — 시즌 카드는 안 받음', gain(pit({ cardType: '시즌' }), 'SP1', 170, 'R', 'c'), 0);
  eq('좌에는 카드 종류 조건이 없다 (선택 팀 전원)',
    [30, 90, 150, 170].every((sp) => gain(bat({ cardType: '라이브' }), 'DH', sp, 'L', 'p', 8) > 0) ? 1 : 0, 1);

  eq('110 좌(드림) — 두산 타자 +1', gain(bat({ team: '두산' }), 'DH', 110, 'L', 'p', 8), 1);
  eq('110 좌(드림) — 키움 타자 0', gain(bat(), 'DH', 110, 'L', 'p', 8), 0);
  eq('110 우(나눔) — 키움 투수 +1', gain(pit(), 'SP1', 110, 'R', 'c'), 1);
  eq('110 기본 — 키움 덱은 나눔(우)', sdPick({ teamName: '키움' }, 110) === 'R' ? 1 : 0, 1);
  eq('110 기본 — 두산 덱은 드림(좌)', sdPick({ teamName: '두산' }, 110) === 'L' ? 1 : 0, 1);
  eq('110 기본 — 덱 구단이 없으면 선택 없음', sdPick({ teamName: '내 덱' }, 110) === '' ? 1 : 0, 1);
  eq('110 기본 — teamName 이 없어도 선택 없음', sdPick({}, 110) === '' ? 1 : 0, 1);
  eq('양쪽("B") 저장값은 더 이상 쪽으로 보지 않음', sdSideOf('B').side === '' ? 1 : 0, 1);
  const byDefault = (pl, key) => {
    const st = { s95: '', s125: '', teamName: K };
    return (calcSDBonus(pl, 'DH', st, 110, 8)[key] || 0) - (calcSDBonus(pl, 'DH', st, 109, 8)[key] || 0);
  };
  eq('110 기본 적용 — 키움 덱의 키움 타자 +1', byDefault(bat(), 'p'), 1);
  eq('110 기본 적용 — 키움 덱의 두산 타자 0', byDefault(bat({ team: '두산' }), 'p'), 0);

  eq('50 좌 — 올스타 +1', gain(bat({ cardType: '올스타' }), 'DH', 50, 'L', 'a', 8), 1);
  eq('130 좌 — 올스타 투수 +1', gain(pit({ cardType: '올스타' }), 'SP1', 130, 'L', 's'), 1);
  eq('180 좌 — 올스타 +2', gain(bat({ cardType: '올스타' }), 'DH', 180, 'L', 'p', 8), 2);
  eq('180 좌 — 시즌은 0', gain(bat(), 'DH', 180, 'L', 'p', 8), 0);
  eq('195 좌 — 선택 팀 올스타 +1', gain(bat({ cardType: '올스타' }), 'DH', 195, 'L', 'p', 8), 1);
  eq('195 좌 — 타팀 라이브 0', gain(bat({ cardType: '라이브', team: 'LG' }), 'DH', 195, 'L', 'p', 8), 0);
  eq('195 우 — 타팀 시그니처 0', gain(pit({ cardType: '시그니처', team: 'LG' }), 'SP1', 195, 'R', 'c'), 0);
  eq('195 우 — FA 로 쓴 타팀 시그니처 +1', gain(pit({ cardType: '시그니처', team: 'LG', isFa: true }), 'SP1', 195, 'R', 'c'), 1);
  eq('200 좌 — 타팀 타자 0', gain(bat({ team: 'LG' }), 'DH', 200, 'L', 'p', 8), 0);
  eq('200 우 — 선택 팀 투수 +2', gain(pit(), 'SP1', 200, 'R', 's'), 2);

  eq('85 좌 — 4성 타자 선구 +2', gain(bat({ stars: 4 }), 'DH', 85, 'L', 'e', 8), 2);
  eq('85 좌 — 4성 타자 인내는 0', gain(bat({ stars: 4 }), 'DH', 85, 'L', 'n', 8), 0);
  eq('85 좌 — 4성 투수 제구 +2 (기록만)', gain(pit({ stars: 4 }), 'SP1', 85, 'L', 'ctl'), 2);
  eq('120 우 — 선발 변화 +1', gain(pit(), 'SP1', 120, 'R', 'c'), 1);
  eq('120 우 — 중계 0', gain(pit({ position: '중계' }), 'RP1', 120, 'R', 'c'), 0);
  eq('120 우 — 마무리 0', gain(pit({ position: '마무리' }), 'CP', 120, 'R', 's'), 0);

  eq('55 좌 — 고른 연도 타자 주루 +1', gain(bat(), 'DH', 55, 'L:2010', 'run', 8), 1);
  eq('55 좌 — 파워는 그대로', gain(bat(), 'DH', 55, 'L:2010', 'p', 8), 0);
  eq('55 좌 — 연도가 다르면 0', gain(bat({ year: '2015' }), 'DH', 55, 'L:2010', 'def', 8), 0);
  eq('55 우 — 고른 연도 투수 변화 +2', gain(pit(), 'SP1', 55, 'R:2010', 'c'), 2);
  eq('55 우 — 지구력 +2 (기록만)', gain(pit(), 'SP1', 55, 'R:2010', 'sta'), 2);
  eq('55 예전 저장값(연도만) — 우로 읽는다', gain(pit(), 'SP1', 55, '2010', 'c'), 2);
  eq('55 예전 저장값 — sdPick 은 R:연도', sdPick({ s55: '2010' }, 55) === 'R:2010' ? 1 : 0, 1);

  eq('75 좌 — 임팩트는 연도와 상관없이 파워 +3', gain(bat({ cardType: '임팩트', year: '' }), 'DH', 75, 'L:2010', 'p', 8), 3);
  eq('185 우 — 임팩트 타자 정확 +1', gain(bat({ cardType: '임팩트', year: '' }), 'DH', 185, 'R:2010', 'a', 8), 1);
  eq('190 우 — 연도를 안 고르면 임팩트만 (일반 0 · 임팩트 1)',
    gain(pit({ year: '' }), 'SP1', 190, 'R:', 'c') * 10 + gain(pit({ cardType: '임팩트', year: '' }), 'SP1', 190, 'R:', 'c'), 1);

  eq('95 좌 — 내야 수비 +2 (기록만)', gain(bat(), 'SS', 95, 'L', 'def', 0), 2);
  const lu0 = { enhance: '9각성' };
  const bp0 = bat({ power: 80, accuracy: 80, eye: 70, patience: 60 }), pp0 = pit({ change: 80, stuff: 80 });
  eq('기록만 하는 능력치는 타자 점수에 안 들어감',
    calcBat(bp0, lu0, { p: 0, a: 0, e: 0, n: 0, run: 9, def: 9 }).total - calcBat(bp0, lu0, { p: 0, a: 0, e: 0, n: 0 }).total, 0);
  eq('기록만 하는 능력치는 투수 점수에 안 들어감',
    calcPit(pp0, lu0, { c: 0, s: 0, vel: 9, ctl: 9, sta: 9, def: 9 }).total - calcPit(pp0, lu0, { c: 0, s: 0 }).total, 0);

  /* 패널 문구(SD_ROWS)와 효과 표(SD_RULES)가 같은 모양인지 */
  const sameShape = SD_ROWS.every((r) => {
    const rs = SD_RULES.filter((x) => x.sp === r.sp);
    const L = rs.find((x) => x.side === 'L'), R = rs.find((x) => x.side === 'R');
    if (rs.length !== 2 || !L || !R) return false;
    if (r.type === 'yearLR') return !!L.year && !!R.year;
    if (r.type === 'lrYear') return !L.year && !!R.year;
    return !L.year && !R.year;
  });
  eq('패널 33구간과 효과 표가 같은 모양', sameShape && SD_ROWS.length === 33 ? 1 : 0, 1);
  eq('33구간 모두 좌/우 택1 (고정 구간 없음)',
    SD_ROWS.every((r) => r.type !== 'auto') && SD_RULES.every((r) => r.side === 'L' || r.side === 'R') ? 1 : 0, 1);
  const keysOk = SD_RULES.every((r) => ['bat', 'pit'].every((role) =>
    !r[role] || r[role][0] === '*' || r[role][0].every((k) => (role === 'bat' ? SD_BAT_ALL : SD_PIT_ALL).includes(k))));
  eq('효과 표의 능력치 키가 모두 그 역할의 것', keysOk ? 1 : 0, 1);

  /* 패널 버튼은 줄임말, 원문은 마우스를 올리면 */
  const shortOk = SD_ROWS.every((r) => r.l && r.r && r.l.length <= 14 && r.r.length <= 14 && r.lDesc && r.rDesc);
  eq('패널 버튼 글씨는 14자 이내, 원문 설명은 따로', shortOk ? 1 : 0, 1);
  eq('버튼 글씨에 "선택 팀" 이 없다', SD_ROWS.every((r) => ![r.s, r.l, r.r].some((t) => t && t.includes('선택 팀'))) ? 1 : 0, 1);

  /* 시너지 — 임팩트 = 타자 +1, 시그니처 = 투수 +1 (능력치 전부) */
  const syn = (pl, slot, key, imp, sig) => (calcSDBonus(pl, slot,
    { s95: '', s125: '', s110: '', teamName: K, synImpact: imp, synSig: sig, synLive: false }, 0, 8)[key] || 0);
  eq('임팩트 시너지 — 타자 인내 +1', syn(bat(), 'DH', 'n', true, false) - syn(bat(), 'DH', 'n', false, false), 1);
  eq('임팩트 시너지 — 타자 주루 +1 (기록만)', syn(bat(), 'DH', 'run', true, false) - syn(bat(), 'DH', 'run', false, false), 1);
  eq('임팩트 시너지 — 투수는 0', syn(pit(), 'SP1', 'c', true, false) - syn(pit(), 'SP1', 'c', false, false), 0);
  eq('시그니처 시너지 — 투수 구위 +1', syn(pit(), 'SP1', 's', false, true) - syn(pit(), 'SP1', 's', false, false), 1);
  eq('시그니처 시너지 — 투수 제구 +1 (기록만)', syn(pit(), 'SP1', 'ctl', false, true) - syn(pit(), 'SP1', 'ctl', false, false), 1);
  eq('시그니처 시너지 — 타자는 0', syn(bat(), 'DH', 'p', false, true) - syn(bat(), 'DH', 'p', false, false), 0);

  /* 예전 "KIA" 는 기아로 */
  eq('KIA 덱의 기아 선수는 선택 팀', isSelTeam(bat({ team: '기아' }), { teamName: 'KIA' }) ? 1 : 0, 1);
  eq('기아 덱의 KIA 선수는 선택 팀', isSelTeam(bat({ team: 'KIA' }), { teamName: '기아' }) ? 1 : 0, 1);
  eq('KIA 덱의 110 기본은 나눔(우)', sdPick({ teamName: 'KIA' }, 110) === 'R' ? 1 : 0, 1);
  eq('KIA 선수는 110 나눔을 받는다', gain(bat({ team: 'KIA' }), 'DH', 110, 'R', 'p', 8), 1);
}

console.log('\n[덱 구단 추천] 구단 선택 창 — 라인업 선수가 가장 많은 구단');
{
  const pls = [{ id: 1, team: '두산' }, { id: 2, team: '두산' }, { id: 3, team: 'LG' }, { id: 4, team: 'LG' }, { id: 5, team: 'LG' }];
  eq('라인업 기준 — 라인업에 두산 2, LG 1 이면 두산', suggestDeckTeam(pls, { C: 1, '1B': 2, '2B': 3 }) === '두산' ? 1 : 0, 1);
  eq('라인업이 비면 보유 선수 기준 — LG', suggestDeckTeam(pls, {}) === 'LG' ? 1 : 0, 1);
  eq('빈 칸 값은 라인업으로 치지 않음', suggestDeckTeam(pls, { C: '', '1B': null }) === 'LG' ? 1 : 0, 1);
  eq('수가 같으면 구단 목록 순서가 앞선 쪽 (키움)', suggestDeckTeam([{ id: 1, team: '기아' }, { id: 2, team: '키움' }], {}) === '키움' ? 1 : 0, 1);
  eq('KIA 는 기아로 센다', suggestDeckTeam([{ id: 1, team: 'KIA' }, { id: 2, team: 'KIA' }, { id: 3, team: 'LG' }], {}) === '기아' ? 1 : 0, 1);
  eq('KBO 구단이 아닌 값은 세지 않음', suggestDeckTeam([{ id: 1, team: '내 덱' }, { id: 2, team: '' }, { id: 3 }], {}) === '' ? 1 : 0, 1);
  eq('선수·라인업이 없어도 오류 없이 빈 값', suggestDeckTeam(null, null) === '' ? 1 : 0, 1);
}

console.log('\n[옛 형식 줄 → 덱별 형식] 덱 목록을 쓸 때 맨 위 데이터를 주인 덱으로 옮긴다');
{
  const data = { players: [{ id: 'p1' }], lineupMap: { C: 'p1' }, sdConfig: { liveSetPo: 3 } };
  const newRow = { decks: { dk_1: data }, deckList: [{ deckId: 'dk_1', teamName: '키움' }], deckCurrent: 'dk_1' };
  eq('이미 덱별 형식이면 그대로 (같은 객체)', toDeckFormat(newRow, [], 'dk_9') === newRow ? 1 : 0, 1);

  const legacyList = [{ deckId: 'dk_legacy_abcd1234', teamName: 'LG' }];
  const oldRow = Object.assign({ deckList: [{ deckId: 'dk_legacy_abcd1234', teamName: '내 덱' }], deckCurrent: 'dk_legacy_abcd1234', extra: 7 }, data);
  const a = toDeckFormat(oldRow, legacyList, 'dk_new');
  eq('옛 형식 — 맨 위 데이터는 내 덱(dk_legacy_)으로', JSON.stringify(a.decks.dk_legacy_abcd1234) === JSON.stringify(data) ? 1 : 0, 1);
  eq('옛 형식 — 새 덱(fallback)에는 옮기지 않음', a.decks.dk_new === undefined ? 1 : 0, 1);
  eq('옛 형식 — 맨 위 선수·라인업·설정은 남기지 않음', a.players === undefined && a.lineupMap === undefined && a.sdConfig === undefined ? 1 : 0, 1);
  eq('옛 형식 — 다른 키는 그대로', a.extra === 7 && a.deckCurrent === 'dk_legacy_abcd1234' ? 1 : 0, 1);
  eq('옛 형식 — 원래 객체는 건드리지 않음', oldRow.players && !oldRow.decks ? 1 : 0, 1);

  const b = toDeckFormat(Object.assign({ deckCurrent: 'dk_5' }, data), [{ deckId: 'dk_5', teamName: '두산' }, { deckId: 'dk_6', teamName: 'NC' }], 'dk_6');
  eq('내 덱이 없으면 줄에 저장된 지금 덱으로', b.decks.dk_5 && !b.decks.dk_6 ? 1 : 0, 1);
  const c = toDeckFormat(Object.assign({}, data), [{ deckId: 'dk_7', teamName: 'KT' }], 'dk_7');
  eq('지금 덱도 없으면 fallbackId 로', c.decks.dk_7 && c.deckCurrent === '' ? 1 : 0, 1);
  const d = toDeckFormat({}, [{ deckId: 'dk_8', teamName: 'KT' }], 'dk_8');
  eq('데이터 없는 줄은 빈 decks', JSON.stringify(d) === JSON.stringify({ decks: {}, deckList: [], deckCurrent: '' }) ? 1 : 0, 1);
  const e = toDeckFormat(null, null, null);
  eq('줄이 없어도 오류 없이 빈 형식', e.decks && e.deckList.length === 0 ? 1 : 0, 1);
  const f = toDeckFormat(Object.assign({ deckList: [{ deckId: 'dk_legacy_zz', teamName: '내 덱' }] }, data), null, 'dk_x');
  eq('목록을 안 주면 줄의 목록에서 내 덱을 찾음', f.decks.dk_legacy_zz && !f.decks.dk_x ? 1 : 0, 1);
}

console.log('\n[세트덱 점수] FA 는 시그니처 -1, 임팩트 -2 — 총 셋포와 화면 표시가 같은 값을 쓴다');
{
  eq('골든글러브 6', cardSetScore({ cardType: '골든글러브' }), 6);
  eq('시그니처 8', cardSetScore({ cardType: '시그니처' }), 8);
  eq('시그니처 FA 7 (-1)', cardSetScore({ cardType: '시그니처', isFa: true }), 7);
  eq('임팩트 7', cardSetScore({ cardType: '임팩트' }), 7);
  eq('임팩트 FA 5 (-2)', cardSetScore({ cardType: '임팩트', isFa: true }), 5);
  eq('국가대표 8', cardSetScore({ cardType: '국가대표' }), 8);
  eq('올스타 — 덱 구단 없으면 2', cardSetScore({ cardType: '올스타' }), 2);
  eq('라이브는 카드에 적힌 점수', cardSetScore({ cardType: '라이브', setScore: 9 }), 9);
  eq('FA 가 없는 카드는 FA 표시가 있어도 그대로 (골글 6)', cardSetScore({ cardType: '골든글러브', isFa: true }), 6);
  eq('빈 칸 0', cardSetScore(null), 0);
  eq('감점이 없는 카드는 적힌 점수 그대로 (라이브 -1 에 FA 표시)', cardSetScore({ cardType: '라이브', setScore: -1, isFa: true }), -1);

  /* 총 셋포 — 라인업 칸과 후보 칸 모두 같은 규칙 */
  __setGlobalPotm([]);
  const deck = (x) => ({ C: { cardType: '골든글러브' }, SP1: { cardType: '시그니처', ...(x.sig || {}) },
    CP: { cardType: '임팩트', ...(x.cp || {}) }, BN1: { cardType: '임팩트', ...(x.bn || {}) } });
  const total = (d, sd) => computeLineupSetDeck((s) => d[s] || null, sd || { liveSetPo: 0 });
  const base = total(deck({}));
  eq('기준 총 셋포 (골글 6 + 시그 8 + 임팩트 7 + 후보 임팩트 7)', base, 28);
  eq('라인업 임팩트 FA — 총 셋포 -2', base - total(deck({ cp: { isFa: true } })), 2);
  eq('후보 임팩트 FA — 총 셋포 -2', base - total(deck({ bn: { isFa: true } })), 2);
  eq('시그니처 FA — 총 셋포 -1', base - total(deck({ sig: { isFa: true } })), 1);
  eq('라이브 추가 셋포는 더한다', total(deck({}), { liveSetPo: 5 }) - base, 5);

  /* FA 는 타팀 선수에게만 걸린다 (2026-09-18) — 자팀 선수에게 남은 FA 표시는 감점하지 않는다.
     스페셜 POTM 은 FA·와일드카드 선수를 자팀으로 본다 (2026-09-18 사용자 확인) */
  __setGlobalPotm([{ name: '가', team: '키움' }, { name: '나', team: '두산' }, { name: '다', team: '두산' }]);
  eq('자팀 임팩트의 FA 표시는 무시 — 7 + POTM 1 = 8', total({ CP: { cardType: '임팩트', name: '가', team: '키움', isFa: true } }, { teamName: '키움' }), 8);
  eq('타팀 임팩트 FA — 7 - 2 + POTM 1 = 6', total({ CP: { cardType: '임팩트', name: '나', team: '두산', isFa: true } }, { teamName: '키움' }), 6);
  eq('타팀 임팩트(FA 아님) — POTM 효과 없이 7', total({ CP: { cardType: '임팩트', name: '다', team: '두산' } }, { teamName: '키움' }), 7);
  __setGlobalPotm([]);

  /* 와일드카드 — 국가대표 8 → 7 */
  eq('국가대표 와일드카드 7 (-1)', cardSetScore({ cardType: '국가대표', isWildcard: true }), 7);
  eq('와일드카드 표시가 있어도 국가대표가 아니면 그대로 (시그 8)', cardSetScore({ cardType: '시그니처', isWildcard: true }), 8);
  eq('감점 크기 — 와일드카드 1', cardSetPenalty({ cardType: '국가대표', isWildcard: true }), 1);
  eq('타팀 국대 와일드카드 — 총 셋포 8 → 7', total({ SP1: { cardType: '국가대표', team: '두산', isWildcard: true } }, { teamName: '키움' }), 7);
  eq('자팀 국대의 와일드카드 표시는 무시 — 8', total({ SP1: { cardType: '국가대표', team: '키움', isWildcard: true } }, { teamName: '키움' }), 8);
  eq('KIA 로 적힌 자팀 국대도 자팀 — 8', total({ SP1: { cardType: '국가대표', team: 'KIA', isWildcard: true } }, { teamName: '기아' }), 8);
}

console.log('\n[FA·와일드카드] 타팀 선수만 — 선택 팀 취급 · 능력치 -3 · 특훈 2회 추가');
{
  const K = '키움';
  const nat = (o) => Object.assign({ role: '타자', cardType: '국가대표', stars: 5, team: '두산', year: '2010', power: 100, accuracy: 100, eye: 100, patience: 100 }, o);
  const natP = (o) => Object.assign({ role: '투수', cardType: '국가대표', stars: 5, team: '두산', position: '선발', change: 100, stuff: 100 }, o);
  eq('타팀 판정 — 두산 선수, 키움 덱', isOtherTeam({ team: '두산' }, K) ? 1 : 0, 1);
  eq('타팀 판정 — 키움 선수, 키움 덱', isOtherTeam({ team: '키움' }, K) ? 1 : 0, 0);
  eq('타팀 판정 — KIA 선수, 기아 덱은 자팀', isOtherTeam({ team: 'KIA' }, '기아') ? 1 : 0, 0);
  eq('타팀 판정 — 덱 구단을 모르면 저장값을 따른다(타팀으로 봄)', isOtherTeam({ team: '키움' }, '') ? 1 : 0, 1);

  const a = applyTeamFlags(nat({ isWildcard: true }), K);
  eq('타팀 국대 와일드카드는 켜진 채', a.isWildcard ? 1 : 0, 1);
  const b = applyTeamFlags(nat({ team: K, isWildcard: true }), K);
  eq('자팀 국대 와일드카드는 끈 것으로', b.isWildcard ? 1 : 0, 0);
  const c = applyTeamFlags(nat({ isFa: true }), K);
  eq('국대에 FA 표시는 끈 것으로', c.isFa ? 1 : 0, 0);
  const d = applyTeamFlags({ cardType: '임팩트', team: '두산', isWildcard: true }, K);
  eq('임팩트에 와일드카드 표시는 끈 것으로', d.isWildcard ? 1 : 0, 0);
  const plain = nat({});
  eq('바꿀 게 없으면 같은 객체', applyTeamFlags(plain, K) === plain ? 1 : 0, 1);
  const orig = nat({ team: K, isWildcard: true });
  applyTeamFlags(orig, K);
  eq('원본은 건드리지 않음', orig.isWildcard ? 1 : 0, 1);

  /* 선택 팀 */
  eq('타팀 국대 와일드카드 = 선택 팀', isSelTeam(nat({ isWildcard: true }), { teamName: K }) ? 1 : 0, 1);
  eq('타팀 국대(와일드카드 끔) = 선택 팀 아님', isSelTeam(nat({}), { teamName: K }) ? 1 : 0, 0);
  eq('라이브에 FA 표시는 선택 팀 아님', isSelTeam({ cardType: '라이브', team: '두산', isFa: true }, { teamName: K }) ? 1 : 0, 0);
  const sd30 = (pl) => calcSDBonus(pl, 'DH', { s95: '', s125: '', s110: '', teamName: K }, 30, 8).p - calcSDBonus(pl, 'DH', { s95: '', s125: '', s110: '', teamName: K }, 29, 8).p;
  eq('30 — 타팀 국대 와일드카드는 +1', sd30(nat({ isWildcard: true })), 1);
  eq('30 — 타팀 국대(와일드카드 끔)는 0', sd30(nat({})), 0);

  /* 능력치 -3 */
  const lu = { enhance: '' };
  const bat0 = calcBat(nat({}), lu, { p: 0, a: 0, e: 0, n: 0 });
  const batW = calcBat(nat({ isWildcard: true }), lu, { p: 0, a: 0, e: 0, n: 0 });
  eq('와일드카드 타자 파워 -3', batW.power - bat0.power, -3);
  eq('와일드카드 타자 정확 -3', batW.accuracy - bat0.accuracy, -3);
  eq('와일드카드 타자 선구 -3', batW.eye - bat0.eye, -3);
  eq('와일드카드 타자 인내 -3', batW.patience - bat0.patience, -3);
  const pit0 = calcPit(natP({}), lu, { c: 0, s: 0 });
  const pitW = calcPit(natP({ isWildcard: true }), lu, { c: 0, s: 0 });
  eq('와일드카드 투수 변화 -3', pitW.change - pit0.change, -3);
  eq('와일드카드 투수 구위 -3', pitW.stuff - pit0.stuff, -3);
  eq('능력치 보정 — 와일드카드 -3 / FA -3 / 없음 0',
    teamFlagStatAdj({ cardType: '국가대표', isWildcard: true }) === -3 && teamFlagStatAdj({ cardType: '시그니처', isFa: true }) === -3
      && teamFlagStatAdj({ cardType: '국가대표' }) === 0 && teamFlagStatAdj({ cardType: '골든글러브', isFa: true }) === 0 ? 1 : 0, 1);

  /* 특훈 횟수 = 기본 보너스 */
  eq('특훈 — 골글 3', specTrialsOf({ cardType: '골든글러브' }), 3);
  eq('특훈 — 시그 FA 5', specTrialsOf({ cardType: '시그니처', isFa: true }), 5);
  eq('특훈 — 국대 4', specTrialsOf({ cardType: '국가대표' }), 4);
  eq('특훈 — 국대 와일드카드 6', specTrialsOf({ cardType: '국가대표', isWildcard: true }), 6);
  eq('특훈 — 라이브 없음 0', specTrialsOf({ cardType: '라이브', isFa: true }), 0);
  eq('특훈 분포 키 — 와일드카드', specDistKey({ cardType: '국가대표', isWildcard: true }, true) === 'spec_bat_wc_국가대표' ? 1 : 0, 1);
  eq('특훈 분포 키 — FA', specDistKey({ cardType: '임팩트', isFa: true }, false) === 'spec_pit_fa_임팩트' ? 1 : 0, 1);
  eq('특훈 분포 키 — 일반 국대', specDistKey({ cardType: '국가대표' }, true) === 'spec_bat_국가대표' ? 1 : 0, 1);

  /* 고점판독기 특훈 표 — 와일드카드 키가 있어야 한다 */
  eq('고점 특훈 표 — 와일드카드 타자·투수', Array.isArray(PEAK_SPEC['bat_wc_국가대표']) && Array.isArray(PEAK_SPEC['pit_wc_국가대표']) ? 1 : 0, 1);
  eq('고점 특훈 — 와일드카드 타자 파워는 기본 6 이상', PEAK_SPEC['bat_wc_국가대표'][0] >= 6 ? 1 : 0, 1);
  eq('고점 특훈 — 국대 타자 파워는 기본 4 이상', PEAK_SPEC['bat_국가대표'][0] >= 4 ? 1 : 0, 1);
  const pk = peakPl(nat({ isWildcard: true, specPower: 0, specAccuracy: 0, specEye: 0, specPatience: 0 }), 'DH');
  eq('고점판독 — 와일드카드 선수는 와일드카드 특훈 표', pk.specPower === PEAK_SPEC['bat_wc_국가대표'][0] ? 1 : 0, 1);

  /* 시트 가져오기 — 국대(F)·국대(W) 는 와일드카드 */
  const pc = parseCardCode('국대(W)');
  eq('시트 국대(W) 인식', pc && pc.types[0] === '국가대표' && pc.isFa ? 1 : 0, 1);
  const pf = parseCardCode('시그(F)');
  eq('시트 시그(F) 는 그대로', pf && pf.types[0] === '시그니처' && pf.isFa ? 1 : 0, 1);
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

console.log('');
console.log('[시트 가져오기 — 라이브 V1/V2 구분] 2026-09-21');
{
  /* 라이브는 같은 선수·팀·연도에 V1 과 V2 두 장이 있다. 관리기 시트에는 V1/V2 칸이 없어서
     적어 온 기본 능력치로 갈라야 한다. 이 갈래가 없던 동안 라이브 카드가 전부 "직접 선택" 으로 떨어졌다 */
  const v1 = { id: 'v1', cardType: '라이브', role: '타자', name: '나성범', team: '기아', year: '2026',
    liveType: 'V1', power: 80, accuracy: 70, eye: 60, patience: 50 };
  const v2 = { id: 'v2', cardType: '라이브', role: '타자', name: '나성범', team: '기아', year: '2026',
    liveType: 'V2', power: 85, accuracy: 75, eye: 65, patience: 55 };
  const ix = buildIndex([v1, v2]);
  const ent = (b) => ({ name: '나성범', role: '타자', year: '2026', types: ['올스타', '라이브'], base: b });
  const mV1 = matchOne(ent({ 파워: 80, 정확: 70, 선구: 60, 인내: 50 }), ix);
  const mV2 = matchOne(ent({ 파워: 85, 정확: 75, 선구: 65, 인내: 55 }), ix);
  eq('V1 능력치를 적으면 V1 이 붙는다', mV1.rec && mV1.rec.id === 'v1' ? 1 : 0, 1);
  eq('V2 능력치를 적으면 V2 가 붙는다', mV2.rec && mV2.rec.id === 'v2' ? 1 : 0, 1);
  eq('자동으로 붙는다 (직접 선택 아님)', (mV1.needsPick || mV2.needsPick) ? 1 : 0, 0);
  /* 올스타가 없으면 라이브로 넘어간다 */
  eq('올스타가 없으면 라이브를 본다', mV2.rec && mV2.rec.cardType === '라이브' ? 1 : 0, 1);
  /* 어느 쪽과도 안 맞으면 예전처럼 직접 고르게 둔다 */
  const mX = matchOne(ent({ 파워: 1, 정확: 2, 선구: 3, 인내: 4 }), ix);
  eq('둘 다 안 맞으면 직접 선택', mX.needsPick && !mX.rec ? 1 : 0, 1);
  eq('직접 선택일 때 후보 둘을 돌려준다', (mX.candidates || []).length, 2);
  /* 한 장뿐이면 예전 그대로 */
  const ix1 = buildIndex([v1]);
  const m1 = matchOne(ent({ 파워: 80, 정확: 70, 선구: 60, 인내: 50 }), ix1);
  eq('카드가 하나뿐이면 이름+연도로 붙는다', m1.rec && m1.rec.id === 'v1' ? 1 : 0, 1);
}

console.log('');
console.log('[도감 오타 이름] 2026-09-23 사용자 확인');
{
  /* 도감의 틀린 이름을 바로잡았다. 옛 이름이 적힌 엑셀 시트도 계속 읽혀야 한다 */
  const pairs = [['홍성훈', '홍성흔'], ['벤헤켄', '밴헤켄'], ['조용천', '조웅천'],
    ['김웅국', '김응국'], ['파손스', '파슨스']];
  pairs.forEach(([bad, good]) => {
    eq('시트에 ' + bad + ' 이라 적어도 ' + good + ' 으로 읽는다', canonPlayerName(bad, '') === good ? 1 : 0, 1);
  });
  eq('바른 이름은 그대로 둔다', ['홍성흔', '밴헤켄', '조웅천', '김응국', '파슨스']
    .every((n) => canonPlayerName(n, '') === n) ? 1 : 0, 1);
  /* 홍성흔은 두산 포수와 롯데 지명타자 둘 다 있다 — 팀이 달라도 같은 이름으로 모인다 */
  eq('팀이 달라도 같은 이름', canonPlayerName('홍성훈', '두산') === canonPlayerName('홍성훈', '롯데') ? 1 : 0, 1);
}

console.log('');
console.log('[직접 등록 카드] 2026-09-23 사용자 확인 — 계정에만 있고 계산은 도감 카드와 같다');
{
  const mine = { id: 'c1', custom: true, cardType: '임팩트', role: '타자', name: '홍길동', team: '키움',
    subPosition: 'DH', power: 90, accuracy: 85, eye: 80, patience: 70, stars: 4 };
  setCustomPlayers([mine]);
  eq('도감 조회에 같이 들어간다', dexAll().some((p) => p.id === 'c1') ? 1 : 0, 1);
  eq('직접 등록 카드로 알아본다', isCustomCard({ dbId: 'c1' }) && isCustomCard(mine) ? 1 : 0, 1);
  eq('도감 카드는 아니라고 본다', isCustomCard({ dbId: '없는id' }) ? 1 : 0, 0);
  /* 내 선수 줄이 dbId 로 가리키면 mergePl 이 능력치를 붙여 준다 — 이게 되면 아래 계산은 저절로 같다 */
  const row = { id: 'p1', dbId: 'c1', name: '홍길동', cardType: '임팩트', role: '타자', subPosition: 'DH' };
  const m = mergePl(row);
  eq('mergePl 이 능력치를 붙인다', [m.power, m.accuracy, m.eye, m.patience].join() === '90,85,80,70' ? 1 : 0, 1);
  eq('내 선수 줄의 id 는 지킨다', m.id === 'p1' && m.dbId === 'c1' ? 1 : 0, 1);
  /* 상한 */
  setCustomPlayers([1,2,3,4,5,6,7].map((n) => ({ id: 'x' + n, name: 'n' + n })));
  eq('최대 ' + CUSTOM_MAX + '장까지만', dexAll().filter((p) => String(p.id).startsWith('x')).length, CUSTOM_MAX);
  setCustomPlayers([]);
  eq('비우면 도감만 남는다', dexAll().some((p) => p.id === 'c1') ? 1 : 0, 0);
}


console.log('\n[라인업 총점] 최상위로 뺀 계산이 예전 라인업 화면과 같아야 한다');
{
  const mk = (n, o) => Object.assign({ name: n, role: '타자', cardType: '골든글러브', team: '기아', year: '2024',
    hand: '우', stars: 5, power: 150, accuracy: 140, eye: 130, patience: 120, enhance: '9각성' }, o || {});
  const mkP = (n, o) => Object.assign({ name: n, role: '투수', position: '선발', cardType: '골든글러브', team: '기아',
    year: '2024', hand: '우', stars: 5, change: 150, stuff: 145, enhance: '9각성' }, o || {});
  const sd = { teamName: '기아', bpcIdx: 4 };
  const o = lineupOpts(sd, 0);
  eq('기본 타순은 도감 자리 순서', o.batOrder.join() === BAT_SLOTS.join() ? 1 : 0, 1);
  eq('기본 불펜 편성은 4번', o.bpcIdx, 4);
  eq('전술은 sdState 에서', o.tactic === rpTactic(sd) ? 1 : 0, 1);
  /* 타자 한 명 · 1번타자 — 타순 x 강함 배율이 걸린다 */
  const one = { C: mk('가') };
  const t1 = calcLineupTotal((sl) => one[sl] || null, sd, o);
  const solo = lineupBat(one.C, 'C', sd, o).total;
  eq('한 명이면 타순1 x 강함1위', t1, Math.round(solo * batMult(0) * strMult(0) * 100) / 100, 0.011);
  /* 선발 하나 — 기본 전술 7.00 예산의 1선발 배율 */
  const sp = { SP1: mkP('나') };
  const t2 = calcLineupTotal((sl) => sp[sl] || null, sd, o);
  eq('SP1 은 선발 배율', t2, Math.round(lineupPit(sp.SP1, 'SP1', sd, o).total * spMult(o.tactic, 0) * 100) / 100, 0.011);
  /* 마무리는 늘 0.8 */
  const cp = { CP: mkP('다', { position: '마무리' }) };
  eq('마무리는 0.8', calcLineupTotal((sl) => cp[sl] || null, sd, o),
    Math.round(lineupPit(cp.CP, 'CP', sd, o).total * CP_MULT * 100) / 100, 0.011);
  eq('빈 라인업은 0', calcLineupTotal(() => null, sd, o), 0);
  /* 타순을 바꾸면 점수가 달라진다 — 자리의 값이 곧 배율이다 */
  const two = { C: mk('가'), '1B': mk('나', { power: 100, accuracy: 100, eye: 100, patience: 100 }) };
  /* 3번(1.15) 과 5번(1.00) — 센 타자를 앞 배율 자리에 두면 점수가 오른다 */
  const oA = lineupOpts({ teamName: '기아', batOrder: ['2B', '3B', 'C', 'SS', '1B', 'LF', 'CF', 'RF', 'DH'] }, 0);
  const oB = lineupOpts({ teamName: '기아', batOrder: ['2B', '3B', '1B', 'SS', 'C', 'LF', 'CF', 'RF', 'DH'] }, 0);
  const pk2 = (sl) => two[sl] || null;
  eq('센 타자를 3번에 두면 5번보다 점수가 높다',
    calcLineupTotal(pk2, sd, oA) > calcLineupTotal(pk2, sd, oB) ? 1 : 0, 1);
  eq('1번과 2번은 배율이 같다', batMult(0), batMult(1));
  eq('3번·4번이 가장 높다', batMult(2) > batMult(0) && batMult(3) > batMult(0) ? 1 : 0, 1);
}

console.log('\n[덱 연구소] 능력치 가정 티어 — 2026-09-23 사용자 확정 기획');
{
  eq('티어는 0.1 · 5 · 20 세 가지', LAB_TIERS.join() === '0.1,5,20' ? 1 : 0, 1);
  /* 분위수 배열에서 상위 % 뽑기 */
  const arr = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  eq('상위 0% 는 맨 위', distValueAt(arr, 0), 100);
  eq('상위 100% 는 맨 아래', distValueAt(arr, 100), 0);
  eq('상위 50% 는 한가운데', distValueAt(arr, 50), 50);
  eq('상위 20% 지점', distValueAt(arr, 20), 80);
  eq('빈 배열은 null', distValueAt([], 5) === null ? 1 : 0, 1);
  /* 목표 점수에 맞춰 벡터 줄이기 — 줄인 뒤 점수가 목표와 같아야 한다 */
  const v = labScale([20, 18, 12, 10], [1.0, 0.85, 0.4, 0.15], 20.8);
  const got = v[0] * 1.0 + v[1] * 0.85 + v[2] * 0.4 + v[3] * 0.15;
  eq('벡터를 목표 점수에 맞춘다', Math.round(got * 10) / 10, 20.8, 0.05);
  eq('비율이 같게 줄어든다', Math.round(v[0] / 20 * 100) / 100, Math.round(v[1] / 18 * 100) / 100, 0.02);
  eq('0 벡터는 손대지 않는다', labScale([0, 0], [1, 1], 5) === null ? 1 : 0, 1);
  /* 분포가 PEAK 표와 맞물린다 — 훈련 0.1% 지점이 고점 배분의 점수와 같다 */
  const w2 = getW();
  const pkT = PEAK_TRAIN['bat_골든글러브'];
  const pkScore = pkT[0] * w2.p + pkT[1] * w2.a + pkT[2] * w2.e + pkT[3] * w2.n;
  eq('훈련 고점표가 분포의 0.1% 지점', Math.round(distValueAt(PREBUILT_DIST['train_bat_골든글러브'], 0.1) * 100) / 100,
    Math.round(pkScore * 100) / 100, 0.02);
  /* 카드 하나를 세 티어로 — 위 티어가 늘 더 높아야 한다 */
  const card = { name: '실험', role: '타자', cardType: '골든글러브', team: '기아', year: '2024', hand: '우',
    stars: 5, power: 150, accuracy: 140, eye: 130, patience: 120, launchAngle: 0 };
  const tot = LAB_TIERS.map((t) => { const p = labPl(card, '3B', t); return calcBat(p, lineupLu(p), null).total; });
  eq('0.1% 가 5% 보다 높다', tot[0] > tot[1] ? 1 : 0, 1);
  eq('5% 가 20% 보다 높다', tot[1] > tot[2] ? 1 : 0, 1);
  eq('0.1% 는 고점판독기 그대로', tot[0], (function () { const p = peakPl(card, '-'); return calcBat(p, lineupLu(p), null).total; })());
  /* 5%·20% 는 스킬 점수를 직접 받는다 */
  const p5 = labPl(card, '3B', 5);
  eq('5% 스킬 점수는 분포의 5% 지점', p5.labSkillScore,
    Math.round(distValueAt(PREBUILT_SKILL_DIST[skillDistKey('타자', '골든글러브', '우', false)], 5) * 100) / 100, 0.011);
  eq('lineupLu 가 그 점수를 넘긴다', lineupLu(p5).ssOverride, p5.labSkillScore);
  eq('calcBat 이 그 점수를 그대로 쓴다', calcBat(p5, lineupLu(p5), null).skillScore, p5.labSkillScore, 0.011);
  /* 포수도 다른 타자와 같은 표로 본다 — 포수리드 6렙은 어차피 늘 받는다 */
  const cat = Object.assign({}, card, { subPosition: 'C' });
  eq('포수 0.1% 도 포수 아닌 표', calcBat(labPl(cat, 'C', 0.1), lineupLu(labPl(cat, 'C', 0.1)), null).total,
    calcBat(labPl(cat, 'DH', 0.1), lineupLu(labPl(cat, 'DH', 0.1)), null).total);
  eq('포수 5% 도 역전되지 않는다',
    calcBat(labPl(cat, 'C', 0.1), lineupLu(labPl(cat, 'C', 0.1)), null).total
      > calcBat(labPl(cat, 'C', 5), lineupLu(labPl(cat, 'C', 5)), null).total ? 1 : 0, 1);
  /* 평소 카드에는 아무 영향이 없어야 한다 */
  eq('티어를 안 쓰면 ssOverride 없음', lineupLu(card).ssOverride === undefined ? 1 : 0, 1);
  /* 투수도 같은 모양 */
  const pit = { name: '실험투', role: '투수', position: '선발', cardType: '시그니처', team: '삼성', year: '2024',
    hand: '우', stars: 5, change: 150, stuff: 145 };
  const pt = LAB_TIERS.map((t) => { const p = labPl(pit, 'SP1', t); return calcPit(p, lineupLu(p), null).total; });
  eq('투수도 티어가 뒤집히지 않는다', pt[0] > pt[1] && pt[1] > pt[2] ? 1 : 0, 1);
  eq('선발 분류', labCat(pit) === '선발' ? 1 : 0, 1);
  eq('타자 분류', labCat({ role: '타자' }) === '타자' ? 1 : 0, 1);
  eq('중계 분류', labCat({ role: '투수', position: '중계' }) === '중계' ? 1 : 0, 1);
  eq('마무리 분류', labCat({ role: '투수', position: '마무리' }) === '마무리' ? 1 : 0, 1);
}


console.log('\n[덱 연구소] 라인업 규칙 — 2026-09-18 사용자 확정 기획');
{
  var mkB = function (n, o) { return Object.assign({ id: 'd_' + n, name: n, role: '타자', cardType: '임팩트',
    team: '기아', year: '2024', hand: '우', stars: 5, subPosition: 'DH',
    power: 150, accuracy: 140, eye: 130, patience: 120 }, o || {}); };
  /* 도감 줄 -> 연구소 카드 */
  var c1 = labCard(mkB('가'), '기아');
  eq('강화는 최대로 둔다', c1.enhance === '9각성' ? 1 : 0, 1);
  eq('스킬·훈련·특훈은 비워 둔다 (티어가 채운다)',
    (c1.skill1 === '' && c1.trainP === 0 && c1.specPower === 0) ? 1 : 0, 1);
  eq('자팀 카드는 FA 가 아니다', (!c1.isFa && !c1.isWildcard) ? 1 : 0, 1);
  eq('타팀 임팩트는 FA 로 붙는다', labCard(mkB('나', { team: 'LG' }), '기아').isFa ? 1 : 0, 1);
  eq('타팀 국대는 와일드카드로 붙는다',
    labCard(mkB('다', { team: 'LG', cardType: '국가대표' }), '기아').isWildcard ? 1 : 0, 1);
  eq('타팀 골글은 그냥 쓴다',
    (function () { var c = labCard(mkB('라', { team: 'LG', cardType: '골든글러브' }), '기아'); return (!c.isFa && !c.isWildcard) ? 1 : 0; })(), 1);
  /* 골든글러브 장수 — 자팀 골글을 쓰면 한 장 더 */
  var mkPk = function (list) { var m = {}; list.forEach(function (c, i2) { m[LAB_SLOTS[i2]] = c; }); return function (sl) { return m[sl] || null; }; };
  var gg = function (team) { return labCard(mkB('골' + Math.random(), { team: team, cardType: '골든글러브' }), '기아'); };
  eq('타팀 골글만이면 5장까지', labLimits(mkPk([gg('LG'), gg('LG')]), '기아').ggMax, LAB_GG_BASE);
  eq('자팀 골글을 쓰면 6장까지', labLimits(mkPk([gg('기아'), gg('LG')]), '기아').ggMax, LAB_GG_BASE + LAB_GG_OWN_BONUS);
  eq('자팀1 + 타팀5 는 된다', labLimits(mkPk([gg('기아'), gg('LG'), gg('LG'), gg('LG'), gg('LG'), gg('LG')]), '기아').ok ? 1 : 0, 1);
  eq('자팀1 + 타팀6 은 넘친다', labLimits(mkPk([gg('기아'), gg('LG'), gg('LG'), gg('LG'), gg('LG'), gg('LG'), gg('LG')]), '기아').ok ? 1 : 0, 0);
  eq('자팀2 + 타팀4 는 된다', labLimits(mkPk([gg('기아'), gg('기아'), gg('LG'), gg('LG'), gg('LG'), gg('LG')]), '기아').ok ? 1 : 0, 1);
  eq('자팀2 + 타팀5 는 넘친다', labLimits(mkPk([gg('기아'), gg('기아'), gg('LG'), gg('LG'), gg('LG'), gg('LG'), gg('LG')]), '기아').ok ? 1 : 0, 0);
  /* FA·와일드카드는 합쳐 2장 */
  var fa = function () { return labCard(mkB('f' + Math.random(), { team: 'LG' }), '기아'); };
  var wc = function () { return labCard(mkB('w' + Math.random(), { team: 'LG', cardType: '국가대표' }), '기아'); };
  eq('FA 2장은 된다', labLimits(mkPk([fa(), fa()]), '기아').ok ? 1 : 0, 1);
  eq('FA 3장은 넘친다', labLimits(mkPk([fa(), fa(), fa()]), '기아').ok ? 1 : 0, 0);
  eq('FA 1 + 와일드카드 1 은 된다', labLimits(mkPk([fa(), wc()]), '기아').fa, 2);
  eq('FA 1 + 와일드카드 2 는 넘친다', labLimits(mkPk([fa(), wc(), wc()]), '기아').ok ? 1 : 0, 0);
  /* 자팀도 골글도 아니고 FA·와일드카드도 못 되는 카드 */
  var live = labCard(mkB('라이브', { team: 'LG', cardType: '라이브' }), '기아');
  eq('타팀 라이브는 쓸 수 없다고 짚는다', labLimits(mkPk([live]), '기아').bad.length, 1);
  eq('자팀 라이브는 괜찮다', labLimits(mkPk([labCard(mkB('라이브2', { cardType: '라이브' }), '기아')]), '기아').bad.length, 0);
  /* 세트덱 상태 — 불펜 3/3/0 분업, 버프·시너지 최대 */
  var sd = labSdState('기아');
  eq('불펜은 3/3/0', sd.bpcIdx, LAB_BPC_IDX);
  eq('3/3/0 은 분업이 켜진다', rpTactic(sd) === '분업' ? 1 : 0, 1);
  eq('포수리드 6렙', sd.catchLead === '6렙' ? 1 : 0, 1);
  eq('국대에이스 6렙', (sd.natBat === '6렙' && sd.natPit === '6렙') ? 1 : 0, 1);
  eq('시너지는 모두 받는다', (sd.synLive && sd.synImpact && sd.synSig) ? 1 : 0, 1);
  eq('연도덱을 켜 둔다', (sd.yearBat && sd.yearPit) ? 1 : 0, 1);
  /* 자리 순서 — 1위를 3번, 2위를 4번, 3위를 1번, 4위를 2번 */
  var seats = labSeatOrder();
  eq('1위는 3번 자리', seats[0], 2);
  eq('2위는 4번 자리', seats[1], 3);
  eq('3위·4위는 1번·2번 자리', (seats[2] < 2 && seats[3] < 2) ? 1 : 0, 1);
  eq('5위부터는 순서대로', seats.slice(4).join() === '4,5,6,7,8' ? 1 : 0, 1);
  eq('자리는 아홉 개', seats.length, 9);
  /* 자동 타순 — 센 타자가 배율 높은 자리로 간다 */
  var strong = labCard(mkB('센', { subPosition: 'C', power: 200, accuracy: 190, eye: 180, patience: 170 }), '기아');
  var weak = labCard(mkB('약', { subPosition: '1B', power: 80, accuracy: 70, eye: 60, patience: 50 }), '기아');
  var pk3 = function (sl) { return sl === 'C' ? labPl(strong, sl, 0.1) : sl === '1B' ? labPl(weak, sl, 0.1) : null; };
  var od = labBestOrder(pk3, sd, 0);
  eq('센 타자가 3번', od[2] === 'C' ? 1 : 0, 1);
  eq('약한 타자가 4번', od[3] === '1B' ? 1 : 0, 1);
  /* 연도 모으기 */
  var yk = function (sl) { return sl === 'C' ? mkB('가', { year: '2024' }) : sl === '1B' ? mkB('나', { year: '2019' }) : sl === 'SP1' ? mkB('투', { role: '투수', position: '선발', year: '2011' }) : null; };
  eq('타자 연도만 모은다', labYears(yk, true).sort().join() === '2019,2024' ? 1 : 0, 1);
  eq('투수 연도만 모은다', labYears(yk, false).join(), '2011');
  eq('없으면 빈 연도 하나', labYears(function () { return null; }, true).join(), '');
  /* 한 판 돌려 보기 */
  var cards = {};
  ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'].forEach(function (sl, i2) {
    cards[sl] = labCard(mkB('타' + i2, { subPosition: sl, power: 150 + i2 * 3 }), '기아');
  });
  ['SP1', 'SP2', 'SP3', 'SP4', 'SP5'].forEach(function (sl, i2) {
    cards[sl] = labCard({ id: 'p' + sl, name: '선' + i2, role: '투수', position: '선발', cardType: '임팩트',
      team: '기아', year: '2024', hand: '우', stars: 5, change: 150, stuff: 145 }, '기아');
  });
  cards.CP = labCard({ id: 'pCP', name: '마', role: '투수', position: '마무리', cardType: '임팩트',
    team: '기아', year: '2024', hand: '우', stars: 5, change: 150, stuff: 145 }, '기아');
  var r = labRun(cards, '기아');
  eq('세 티어가 나온다', r.tiers.length, 3);
  eq('티어 순서는 0.1 · 5 · 20', r.tiers.map(function (x) { return x.tier; }).join() === '0.1,5,20' ? 1 : 0, 1);
  eq('0.1% 가 5% 보다 높다', r.tiers[0].total > r.tiers[1].total ? 1 : 0, 1);
  eq('5% 가 20% 보다 높다', r.tiers[1].total > r.tiers[2].total ? 1 : 0, 1);
  eq('세트덱 점수는 티어와 무관하다', r.sp > 0 ? 1 : 0, 1);
  eq('타순은 아홉 자리 전부', r.tiers[0].order.slice().sort().join() === BAT_SLOTS.slice().sort().join() ? 1 : 0, 1);
  eq('빈 라인업도 터지지 않는다', labRun({}, '기아').tiers[0].total, 0);
}

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);

