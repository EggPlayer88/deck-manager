/* 덱 보정 시트(260814) 대조 회귀 테스트
   실행:  node test/calc.test.mjs
   calc-extract.mjs 는 src/deck-manager.jsx 에서 순수 계산 함수만 뽑아낸 것이다.
   (재생성이 필요하면 시트 분석 스크립트의 mkharness 를 다시 돌린다) */
import {
  __setLiveWeights, __setGlobalPotm, resolveSkills, DEFAULT_SKILLS, getEnhVal, calcBat, calcPit, getSkillScore,
  getPotScoreByType, gamTypesFor, POT_GRADES_GAM, POT_TYPES_GAM_BAT, POT_TYPES_GAM_PIT,
  potmKey, isPotmFor, getPotmBonus, skillScorePT,
  launchAngleReq, launchAngleBonus, launchAngleGain, zonePenalty, getW,
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
eq('타자 스킬 수', Object.keys(resolved['타자']).length, 88);
eq('가중치도 새 값으로', resolved.weights.a, 0.85);
eq('인내 가중치 포함', resolved.weights.n, 0.15);
eq('잠재력 커스터마이징 보존', resolved.potScoresByType['풀스윙']['SR+'], 99);
eq('주요스킬 표시 보존', resolved._major['타자']['정밀타격'] ? 1 : 0, 1);
/* 이미 최신이면 그대로 둔다 (관리자가 나중에 손댄 값을 덮지 않는다) */
const current = JSON.parse(JSON.stringify(DEFAULT_SKILLS));
current['타자']['정밀타격'] = [1, 2, 3, 4, 5, 6];
eq('최신본은 건드리지 않음', resolveSkills(current)['타자']['정밀타격'][0], 1);
/* 저장본이 없으면 기본값 */
eq('빈 저장본 → 기본값', resolveSkills(null)['타자']['정밀타격'][0], 20.7);

console.log('\n[감성 잠재력] 등급은 C~S 만, 타자/투수 종류가 다르다');
eq('등급 7개', POT_GRADES_GAM.length, 7);
eq('마지막 등급 S', POT_GRADES_GAM[6] === 'S' ? 1 : 0, 1);
eq('SS 없음', POT_GRADES_GAM.indexOf('SS') < 0 ? 1 : 0, 1);
eq('타자 종류 6개', POT_TYPES_GAM_BAT.length, 6);
eq('투수 종류 6개', POT_TYPES_GAM_PIT.length, 6);
eq('타자는 좌투선호', gamTypesFor('타자').indexOf('좌투선호') >= 0 ? 1 : 0, 1);
eq('투수는 좌타선호', gamTypesFor('투수').indexOf('좌타선호') >= 0 ? 1 : 0, 1);
eq('타자에 좌타선호 없음', gamTypesFor('타자').indexOf('좌타선호') < 0 ? 1 : 0, 1);
eq('땅볼형은 양쪽 공용', (POT_TYPES_GAM_BAT.indexOf('땅볼형') >= 0 && POT_TYPES_GAM_PIT.indexOf('땅볼형') >= 0) ? 1 : 0, 1);
/* 점수는 아직 산정 전이라 전 등급 0 — 값이 정해지면 이 기대값을 바꾼다 */
eq('S 점수(미산정)', getPotScoreByType('S', '좌투선호', null), 0);
eq('C 점수', getPotScoreByType('C', '속구대처', null), 0);
eq('점수 미산정이라 총점 영향 없음', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', pot3: 'S', potType3: '좌투선호' }, {}, null).total, 305);
/* 어드민이 점수를 채우면 곧바로 반영된다 */
eq('점수 지정 시 반영', getPotScoreByType('S', '좌투선호', { potScoresByType: { '좌투선호': { 'S': 4 } } }), 4);
eq('종류 없으면 0', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', pot3: 'S' }, {}, null).total, 305);
eq('등급 없으면 0', calcBat({ hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자', potType3: '좌투선호' }, {}, null).total, 305);

console.log('\n[포지션 특훈 스킬 보너스] 지정 스킬은 레벨 +1 로 계산');
eq('미지정이면 그대로', skillScorePT('정밀타격', 7, '타자', []), 28.48);
eq('지정하면 Lv8 값', skillScorePT('정밀타격', 7, '타자', ['정밀타격']), 32.37);
eq('Lv10 은 더 안 오름', skillScorePT('정밀타격', 10, '타자', ['정밀타격']), 40.15);
/* 황금세대는 Lv6 까지만 값이 있다 — 올려서 0이 되면 원래 값을 지킨다 */
eq('상위 레벨 데이터 없으면 유지', skillScorePT('황금세대', 6, '타자', ['황금세대']), 24.72);
eq('스킬 없으면 0', skillScorePT('', 0, '타자', ['정밀타격']), 0);
/* calcBat 경유: 305 + 정밀타격 Lv7(28.48) → 지정 시 Lv8(32.37) */
const luSk = { skill1: '정밀타격', s1Lv: 7 };
const plSk = { hand: '우', power: 200, accuracy: 100, eye: 50, cardType: '시즌', role: '타자' };
eq('보너스 없음', calcBat(plSk, luSk, { p: 0, a: 0, e: 0, n: 0, ptSkills: [] }).total, 333.48);
eq('보너스 적용', calcBat(plSk, luSk, { p: 0, a: 0, e: 0, n: 0, ptSkills: ['정밀타격'] }).total, 337.37);

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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
