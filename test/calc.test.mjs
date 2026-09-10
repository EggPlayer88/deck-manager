/* 덱 보정 시트(260814) 대조 회귀 테스트
   실행:  node test/calc.test.mjs
   calc-extract.mjs 는 src/deck-manager.jsx 에서 순수 계산 함수만 뽑아낸 것이다.
   (재생성이 필요하면 시트 분석 스크립트의 mkharness 를 다시 돌린다) */
import {
  skillRoleOf, variantAllowed, pickPaegi, isNatOnlySkill, skillAllowedAt, DEFAULT_MAJOR, calcSDBonus, sdPick,
  __setLiveWeights, __setGlobalPotm, resolveSkills, DEFAULT_SKILLS, getEnhVal, calcBat, calcPit, getSkillScore,
  getPotScoreByType, awkTypesFor, POT_GRADES_AWK, POT_TYPES_AWK_BAT, POT_TYPES_AWK_PIT,
  potmKey, isPotmFor, getPotmBonus, maxSkillLv, autoSkillLv, effSkillLv, isLvManual, parseHotColdZone, zonesFromRow,
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
/* 포수리드 버프 */
eq('버프 포함', variantAllowed('포수리드(버프포함)', cB('우', true)) ? 1 : 0, 1);
eq('버프 없으면 기본', variantAllowed('포수리드', cB('우', false)) ? 1 : 0, 1);
eq('조건 없는 스킬은 통과', variantAllowed('정밀타격', cB('우')) ? 1 : 0, 1);

console.log('%s[역할별 변형] 포지션을 고르면 그 역할 변형만 남는다');
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
eq('타자 메이저 76개', Object.keys(DEFAULT_MAJOR['타자']).length, 76);
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

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
