import React, { useState, useEffect, useCallback } from "react";

/* Supabase: injected via window._SUPABASE from main.jsx (Vercel deployment).
   In artifact preview / standalone, these remain as stubs → localStorage-only mode. */
var _SB = (typeof window !== "undefined" && window._SUPABASE) || {};
var supabase = _SB.supabase || null;
var signInWithGoogle = _SB.signInWithGoogle || function(){ return Promise.resolve(); };
var signOut = _SB.signOut || function(){ return Promise.resolve(); };
var getSession = _SB.getSession || function(){ return Promise.resolve(null); };
var getProfile = _SB.getProfile || function(){ return Promise.resolve(null); };
var loadUserData = _SB.loadUserData || function(){ return Promise.resolve(null); };
var saveUserData = _SB.saveUserData || function(){ return Promise.resolve(); };
var loadGlobalSkills = _SB.loadGlobalSkills || function(){ return Promise.resolve(null); };
var saveGlobalSkills = _SB.saveGlobalSkills || function(){ return Promise.resolve(); };
var loadGlobalPlayers = _SB.loadGlobalPlayers || function(){ return Promise.resolve([]); };
var saveGlobalPlayer = _SB.saveGlobalPlayer || function(){ return Promise.resolve(false); };
var saveGlobalPlayers = _SB.saveGlobalPlayers || function(){ return Promise.resolve(false); };
var deleteGlobalPlayer = _SB.deleteGlobalPlayer || function(){ return Promise.resolve(false); };
var uploadPlayerPhoto = _SB.uploadPlayerPhoto || function(){ return Promise.resolve(null); };
var listPlayerPhotos = _SB.listPlayerPhotos || function(){ return Promise.resolve([]); };
var deletePlayerPhoto = _SB.deletePlayerPhoto || function(){ return Promise.resolve(false); };
var listAllPhotos = _SB.listAllPhotos || function(){ return Promise.resolve([]); };
var getTeamLogoUrl = _SB.getTeamLogoUrl || function(){ return ""; };
var uploadTeamLogo = _SB.uploadTeamLogo || function(){ return Promise.resolve(null); };
var loadPhotoPosMap = _SB.loadPhotoPosMap || function(){ return Promise.resolve({}); };
var savePhotoPosMap = _SB.savePhotoPosMap || function(){ return Promise.resolve(false); };

/* ================================================================
   SEED DATA - 48 players from Excel + random fills
   ================================================================ */
var KBO_TEAMS = ["키움","삼성","LG","두산","KT","SSG","롯데","한화","NC","KIA"];
var SEED_PLAYERS = [];
var PHOTO_CACHE = {};
var PHOTO_POS_MAP = {}; /* {선수이름: 위치(0~100)} - 관리자 설정, 전역 적용 */

/* ── 팀 로고 결정 함수 ──
   나중에 연도별 조건을 여기에 추가:
   예) if (team==="SSG" && year <= "03") return getTeamLogoUrl(team, 2);
   지금은 기본값(1) 사용 */
function getLogoForCard(team, year) {
  if (!team) return "";
  /* TODO: 연도별 조건 추가 예정 */
  return getTeamLogoUrl(team, 1);
}
 /* 전역 사진 캐시: {선수이름: [url, ...]} */
function getPhotoUrl(name) {
  /* 해당 이름의 첫 번째 사진 URL 반환 (없으면 "") */
  var urls = PHOTO_CACHE[name];
  return (urls && urls.length > 0) ? urls[0] : "";
}
function getPhotoUrls(name) { return PHOTO_CACHE[name] || null; }
var POT_GRADES = ["C","C+","B","B+","A","A+","S","S+","SS","SS+","SR","SR+"];
var DEFAULT_POT_SCORES = {"C":0,"C+":1,"B":2,"B+":3,"A":4,"A+":5,"S":6,"S+":7,"SS":8,"SS+":9,"SR":10,"SR+":12};
/* 잠재력 종류별 기본 점수 */
var DEFAULT_POT_SCORES_BY_TYPE = {
  "풀스윙": {"C":0,"C+":1,"B":2,"B+":3,"A":4,"A+":5,"S":6,"S+":7,"SS":8,"SS+":9,"SR":10,"SR+":12},
  "클러치": {"C":0,"C+":1,"B":2,"B+":3,"A":4,"A+":5,"S":6,"S+":7,"SS":8,"SS+":9,"SR":10,"SR+":12},
  "장타억제": {"C":0,"C+":1,"B":2,"B+":3,"A":4,"A+":5,"S":6,"S+":7,"SS":8,"SS+":9,"SR":10,"SR+":12},
  "침착": {"C":0,"C+":1,"B":2,"B+":3,"A":4,"A+":5,"S":6,"S+":7,"SS":8,"SS+":9,"SR":10,"SR+":12},
};
var POT_TYPES_BAT = ["풀스윙","클러치"];
var POT_TYPES_PIT = ["장타억제","침착"];
function getPotScoreByType(grade, type, skills) {
  if (!grade || !type) return 0;
  var byType = (skills && skills.potScoresByType) ? skills.potScoresByType : DEFAULT_POT_SCORES_BY_TYPE;
  var sc = byType[type] || DEFAULT_POT_SCORES;
  return sc[grade] !== undefined ? sc[grade] : (DEFAULT_POT_SCORES[grade] || 0);
}
/* 하위 호환: pot1/pot2 + potType1/potType2 */
function getPotScore(grade, skills) {
  if (!grade) return 0;
  var sc = (skills && skills.potScores) ? skills.potScores : DEFAULT_POT_SCORES;
  return sc[grade] || 0;
}
function mergePl(userPl) {
  if (!userPl) return null;
  if (!userPl.dbId) return userPl;
  var seed = null;
  for (var i = 0; i < SEED_PLAYERS.length; i++) { if (SEED_PLAYERS[i].id === userPl.dbId) { seed = SEED_PLAYERS[i]; break; } }
  /* seed 못 찾으면 userPl 자체 반환 (name/cardType 등이 직접 저장돼 있으면 그대로 표시) */
  if (!seed) return userPl;
  return Object.assign({}, seed, {
    id: userPl.id, dbId: userPl.dbId,
    trainP: userPl.trainP||0, trainA: userPl.trainA||0, trainE: userPl.trainE||0,
    trainC: userPl.trainC||0, trainS: userPl.trainS||0,
    specPower: userPl.specPower||0, specAccuracy: userPl.specAccuracy||0, specEye: userPl.specEye||0,
    specChange: userPl.specChange||0, specStuff: userPl.specStuff||0,
    skill1: userPl.skill1||"", s1Lv: userPl.s1Lv||0,
    skill2: userPl.skill2||"", s2Lv: userPl.s2Lv||0,
    skill3: userPl.skill3||"", s3Lv: userPl.s3Lv||0,
    enhance: userPl.enhance||"",
    pot1: userPl.pot1||"", pot2: userPl.pot2||"",
    potType1: userPl.potType1||"", potType2: userPl.potType2||"",
    isFa: userPl.isFa||false,
    liveType: userPl.liveType||seed.liveType||"",
    photoUrl: userPl.photoUrl||seed.photoUrl||"",
    /* subPosition/position: 투수만 처리, 타자는 seed 값 그대로 */
    subPosition: seed.role === "투수"
      ? (userPl.subPosition || (seed.position === "마무리" ? "CP" : seed.position === "중계" ? "RP1" : "SP1"))
      : (userPl.subPosition || seed.subPosition || ""),
    position: seed.role === "투수"
      ? (userPl.position || seed.position || "선발")
      : (seed.position || ""),
  });
}

/* ================================================================
   REFERENCE DATA (same as before, abbreviated for space)
   ================================================================ */
var ENHANCE = {
  "시즌":{"파워":[0,0,0,0,7,9,11,13,15,18],"정확":[0,0,0,0,7,9,11,13,16,18],"선구":[0,0,0,0,7,9,11,14,16,18],"변화":[0,0,0,0,7,9,11,13,15,17],"구위":[0,0,0,0,7,9,11,14,16,18]},
  "라이브":{"파워":[0,0,0,0,10,14,16,18,20,24],"정확":[0,0,0,0,10,12,16,18,22,24],"선구":[0,0,0,0,10,12,14,18,20,22],"변화":[0,0,0,0,10,12,14,16,18,20],"구위":[0,0,0,0,10,12,14,18,20,22]},
  "임팩트":{"파워":[0,0,0,0,5,8,9,10,11,14,14,14,15,15,15,16,16,16,17],"정확":[0,0,0,0,5,6,9,10,13,14,15,15,15,16,16,16,17,17,17],"선구":[0,0,0,0,5,6,7,10,11,12,12,13,13,13,14,14,14,15,15],"변화":[0,0,0,0,5,6,7,8,9,10,11,11,11,12,12,12,13,13,13],"구위":[0,0,0,0,5,6,7,10,11,12,12,12,13,13,13,14,14,14,15]},
  "시그니처":{"파워":[0,0,0,0,10,14,16,18,20,24,24,24,25,25,25,27,27,27,29],"정확":[0,0,0,0,10,12,16,18,22,24,25,25,25,27,27,27,29,29,29],"선구":[0,0,0,0,10,12,14,18,20,22,22,23,23,23,25,25,25,27,27],"변화":[0,0,0,0,10,12,14,16,18,20,21,21,21,23,23,23,25,25,25],"구위":[0,0,0,0,10,12,14,18,20,22,22,22,23,23,23,25,25,25,27]},
  "골든글러브":{"파워":[0,0,0,0,10,14,16,18,20,25,25,25,27,27,27,29,29,29,31],"정확":[0,0,0,0,10,12,16,18,22,25,27,27,27,29,29,29,31,31,31],"선구":[0,0,0,0,10,12,14,18,20,23,23,25,25,25,27,27,27,29,29],"변화":[0,0,0,0,10,12,14,16,18,21,23,23,23,25,25,25,27,27,27],"구위":[0,0,0,0,10,12,14,18,20,23,23,23,25,25,25,27,27,27,29]},
  "국가대표":{"파워":[0,0,0,0,10,14,16,18,20,24,24,24,25,25,25,26,26,26,28],"정확":[0,0,0,0,10,12,16,18,22,24,25,25,25,26,26,26,28,28,28],"선구":[0,0,0,0,10,12,14,18,20,22,22,23,23,23,24,24,24,26,26],"변화":[0,0,0,0,10,12,14,16,18,20,21,21,21,22,22,22,24,24,24],"구위":[0,0,0,0,10,12,14,18,20,22,22,22,23,23,23,24,24,24,26]},
  "올스타":{"파워":[0,0,0,0,10,14,16,18,20,24],"정확":[0,0,0,0,10,12,16,18,22,24],"선구":[0,0,0,0,10,12,14,18,20,22],"변화":[0,0,0,0,10,12,14,16,18,20],"구위":[0,0,0,0,10,12,14,18,20,22]},
};
var ENHANCE_LEVELS = ["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"];
function getEnhVal(ct, stat, enh) { var t = ENHANCE[ct]; if (!t||!t[stat]) return 0; var i = ENHANCE_LEVELS.indexOf(enh); if (i<0) return 0; var ai=i+4; var a=t[stat]; return ai>=a.length?(a[a.length-1]||0):(a[ai]||0); }

/* Skill system: supports old [num,...] and new [{p,a,e},...] format */
var SKILL_DATA = null;
function getSkillScore(name,lv,pt){
  if(!name||lv<5||!SKILL_DATA)return 0;
  var t=SKILL_DATA[pt];if(!t)return 0;
  var s=t[name];
  if(!s){for(var k in SKILL_DATA){if(k!=="weights"&&SKILL_DATA[k]&&SKILL_DATA[k][name]){s=SKILL_DATA[k][name];break;}}}
  if(!s)return 0;var i=lv-5;if(i<0||i>=s.length)return 0;
  var entry=s[i];
  if(typeof entry==="number")return entry;
  var w=getW();
  return(entry.pV||0)*(entry.pF||0)*w.p+(entry.aV||0)*(entry.aF||0)*w.a+(entry.eV||0)*(entry.eF||0)*w.e+(entry.cV||0)*(entry.cF||0)*w.c+(entry.sV||0)*(entry.sF||0)*w.s;
}
function calcSkillDisp(vals,cat){
  var w=getW();
  return vals.slice(0,6).map(function(e){
    if(typeof e==="number")return e;
    return Math.round(((e.pV||0)*(e.pF||0)*w.p+(e.aV||0)*(e.aF||0)*w.a+(e.eV||0)*(e.eF||0)*w.e+(e.cV||0)*(e.cF||0)*w.c+(e.sV||0)*(e.sF||0)*w.s)*100)/100;
  });
}

var DEFAULT_WEIGHTS={p:1.0,a:0.9,e:0.3,c:1.175,s:1.275};
var LIVE_WEIGHTS=null; /* set by useData */
function getW(){return LIVE_WEIGHTS||DEFAULT_WEIGHTS;}

/* ================================================================
   STORAGE
   ================================================================ */
var SK = { players:"deck-players", lineupMap:"deck-lineup-map", skills:"deck-skills", version:"deck-version" };
var DATA_VERSION = 10; /* bump this to force storage reload */

var SEED_LINEUP = {};

var DEFAULT_SKILLS = {"타자": {"정밀타격": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "황금세대": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}], "좌타해결사(좌타)": [{"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "좌타해결사(양타)": [{"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 3, "cF": 0.7, "sV": 3, "sF": 0.7}, {"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 4, "sF": 0.7}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 4, "sF": 0.7}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 5, "sF": 0.7}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 5, "sF": 0.7}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}], "전승우승": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 4, "cF": 0.67, "sV": 4, "sF": 0.67}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 6, "cF": 0.67, "sV": 6, "sF": 0.67}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 8, "cF": 0.67, "sV": 8, "sF": 0.67}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 10, "cF": 0.67, "sV": 10, "sF": 0.67}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 12, "cF": 0.67, "sV": 12, "sF": 0.67}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 14, "cF": 0.67, "sV": 14, "sF": 0.67}], "워크에식": [{"pV": 5, "pF": 1.7, "aV": 5, "aF": 1.7, "eV": 5, "eF": 1.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.7, "aV": 5, "aF": 1.7, "eV": 5, "eF": 1.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.58, "aV": 6, "aF": 1.58, "eV": 6, "eF": 1.58, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.58, "aV": 6, "aF": 1.58, "eV": 6, "eF": 1.58, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.5, "aV": 7, "aF": 1.5, "eV": 7, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.5, "aV": 7, "aF": 1.5, "eV": 7, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "해결사": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 5, "cF": 0.75, "sV": 5, "sF": 0.75}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 0.75, "sV": 7, "sF": 0.75}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 9, "cF": 0.75, "sV": 9, "sF": 0.75}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 11, "cF": 0.75, "sV": 11, "sF": 0.75}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 13, "cF": 0.75, "sV": 13, "sF": 0.75}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 15, "cF": 0.75, "sV": 15, "sF": 0.75}], "빅게임헌터": [{"pV": 10, "pF": 1, "aV": 5, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 5, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 6, "aF": 1, "eV": 13, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 1, "aV": 6, "aF": 1, "eV": 14, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 1, "aV": 7, "aF": 1, "eV": 16, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 17, "pF": 1, "aV": 7, "aF": 1, "eV": 17, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "저니맨": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "대표타자": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "오버페이스": [{"pV": 5, "pF": 1.6, "aV": 5, "aF": 1.6, "eV": 5, "eF": 1.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.6, "aV": 5, "aF": 1.6, "eV": 5, "eF": 1.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1.5, "eV": 6, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1.5, "eV": 6, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.428571, "aV": 7, "aF": 1.428571, "eV": 7, "eF": 1.428571, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.428571, "aV": 7, "aF": 1.428571, "eV": 7, "eF": 1.428571, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "컨택트히터(타순O)": [{"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "리그탑플레이어": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "배팅머신": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수280-299)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 1, "aV": 14, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(275-279)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수267-274)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "도전정신(4성)": [{"pV": 5, "pF": 1.14, "aV": 5, "aF": 1.14, "eV": 5, "eF": 1.14, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.12, "aV": 6, "aF": 1.12, "eV": 6, "eF": 1.12, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.09, "aV": 7, "aF": 1.09, "eV": 7, "eF": 1.09, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.075, "aV": 8, "aF": 1.075, "eV": 8, "eF": 1.075, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.07, "aV": 9, "aF": 1.07, "eV": 9, "eF": 1.07, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.06, "aV": 10, "aF": 1.06, "eV": 10, "eF": 1.06, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "투쟁심": [{"pV": 5, "pF": 1.3, "aV": 5, "aF": 1.3, "eV": 5, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.333333, "aV": 6, "aF": 1.333333, "eV": 6, "eF": 1.333333, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.285714, "aV": 7, "aF": 1.285714, "eV": 7, "eF": 1.285714, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.25, "aV": 8, "aF": 1.25, "eV": 8, "eF": 1.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.222222, "aV": 9, "aF": 1.222222, "eV": 9, "eF": 1.222222, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.2, "aV": 10, "aF": 1.2, "eV": 10, "eF": 1.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "선봉장(타순O)": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.9, "sV": 3, "sF": 0.9}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.9, "sV": 4, "sF": 0.9}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.9, "sV": 6, "sF": 0.9}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "비FA계약": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "공포의하위타선(타순O)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 5, "pF": 1.1, "aV": 5, "aF": 1.1, "eV": 5, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.1, "aV": 6, "aF": 1.1, "eV": 6, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.1, "aV": 7, "aF": 1.1, "eV": 7, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.1, "aV": 8, "aF": 1.1, "eV": 8, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.1, "aV": 9, "aF": 1.1, "eV": 9, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.1, "aV": 10, "aF": 1.1, "eV": 10, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수260-266)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수250-259)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 1, "aV": 12, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수240-249)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12.322844, "pF": 1, "aV": 12.322844, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수234-239)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "도전정신(5성)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "대도": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 2, "cF": 0.5, "sV": 2, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 3, "cF": 0.5, "sV": 3, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 3, "cF": 0.5, "sV": 3, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 4, "cF": 0.5, "sV": 4, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 4, "cF": 0.5, "sV": 4, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 5, "cF": 0.5, "sV": 5, "sF": 0.5}], "가을사나이": [{"pV": 6, "pF": 1, "aV": 5, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 6, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 7, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 8, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 9, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 10, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "난세의영웅": [{"pV": 6, "pF": 0.7, "aV": 6, "aF": 0.7, "eV": 6, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 8, "aF": 0.7, "eV": 8, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 9, "aF": 0.7, "eV": 9, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.7, "aV": 11, "aF": 0.7, "eV": 11, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.7, "aV": 12, "aF": 0.7, "eV": 12, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0.7, "aV": 14, "aF": 0.7, "eV": 14, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "순위경쟁": [{"pV": 6, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "좌타해결사(우타)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "홈어드밴티지": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "얼리스타트": [{"pV": 5, "pF": 1.2, "aV": 2, "aF": 0.5, "eV": 5, "eF": 1.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.25, "aV": 3, "aF": 0.5, "eV": 6, "eF": 1.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.285714, "aV": 4, "aF": 0.5, "eV": 7, "eF": 1.285714, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.3125, "aV": 5, "aF": 0.5, "eV": 8, "eF": 1.3125, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.333333, "aV": 6, "aF": 0.5, "eV": 9, "eF": 1.333333, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.35, "aV": 7, "aF": 0.5, "eV": 10, "eF": 1.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수225-233)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수220-224)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수200-219)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "핵타선(타순O)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "베스트포지션": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 13, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "백전노장": [{"pV": 6, "pF": 0.6, "aV": 5, "aF": 1, "eV": 6, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 6, "aF": 1, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 7, "aF": 1, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 8, "aF": 1, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.6, "aV": 9, "aF": 1, "eV": 11, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 10, "aF": 1, "eV": 12, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(임팩)": [{"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.6, "aV": 11, "aF": 0.6, "eV": 11, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "컨택트히터(타순X)": [{"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 4, "eF": 0, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 5, "eF": 0, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 5, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "짜릿한손맛": [{"pV": 3, "pF": 1.5, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1.45, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1.525, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.48, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.54, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "수비안정성(타순O)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 1, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 14, "aF": 1, "eV": 14, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 16, "aF": 1, "eV": 16, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "집중력": [{"pV": 2, "pF": 0.4, "aV": 6, "aF": 1.13, "eV": 2, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 0.4, "aV": 7, "aF": 1.17, "eV": 3, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 0.4, "aV": 8, "aF": 1.15, "eV": 3, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 0.4, "aV": 9, "aF": 1.18, "eV": 4, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 0.4, "aV": 10, "aF": 1.16, "eV": 4, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 0.4, "aV": 11, "aF": 1.181818, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "승리의함성": [{"pV": 7, "pF": 0.35, "aV": 5, "aF": 1, "eV": 7, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 6, "aF": 1, "eV": 8, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 7, "aF": 1, "eV": 9, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 8, "aF": 1, "eV": 10, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.35, "aV": 9, "aF": 1, "eV": 11, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.35, "aV": 10, "aF": 1, "eV": 12, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "선봉장(타순배치X)": [{"pV": 3, "pF": 0, "aV": 3, "aF": 0, "eV": 0, "eF": 1, "cV": 3, "cF": 0.9, "sV": 3, "sF": 0.9}, {"pV": 3, "pF": 0, "aV": 3, "aF": 0, "eV": 0, "eF": 1, "cV": 4, "cF": 0.9, "sV": 4, "sF": 0.9}, {"pV": 4, "pF": 0, "aV": 4, "aF": 0, "eV": 0, "eF": 1, "cV": 6, "cF": 0.9, "sV": 6, "sF": 0.9}, {"pV": 4, "pF": 0, "aV": 4, "aF": 0, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "승부사": [{"pV": 5, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "결정적한방": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.15, "sV": 9, "sF": 0.15}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.15, "sV": 10, "sF": 0.15}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.15, "sV": 11, "sF": 0.15}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.15, "sV": 12, "sF": 0.15}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 0.15, "sV": 13, "sF": 0.15}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.15, "sV": 14, "sF": 0.15}], "노림수": [{"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "우완킬러": [{"pV": 5, "pF": 0.7, "aV": 5, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 6, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 7, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 8, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 9, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 10, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "대타스페셜": [{"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 5, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0, "aV": 12, "aF": 0, "eV": 12, "eF": 0, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 0, "aV": 13, "aF": 0, "eV": 13, "eF": 0, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0, "aV": 14, "aF": 0, "eV": 14, "eF": 0, "cV": 10, "cF": 1, "sV": 0, "sF": 1}], "공포의하위타선(타순X)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 0}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 0}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 0}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 0}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 0}], "히든카드": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리드오프(타순O)": [{"pV": 0, "pF": 1, "aV": 3, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 3, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선연결": [{"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.35, "aV": 6, "aF": 0.35, "eV": 6, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.35, "aV": 7, "aF": 0.35, "eV": 7, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 8, "aF": 0.35, "eV": 8, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 9, "aF": 0.35, "eV": 9, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 10, "aF": 0.35, "eV": 10, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "역전의명수": [{"pV": 5, "pF": 0.33, "aV": 5, "aF": 0.33, "eV": 5, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.33, "aV": 6, "aF": 0.33, "eV": 6, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.33, "aV": 7, "aF": 0.33, "eV": 7, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.33, "aV": 8, "aF": 0.33, "eV": 8, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.33, "aV": 9, "aF": 0.33, "eV": 9, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.33, "aV": 10, "aF": 0.33, "eV": 10, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "승부근성": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 5, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 6, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 7, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 8, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 9, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 10, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "클러치히터": [{"pV": 5, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "테이블세터": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 5, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(국대)": [{"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.2, "aV": 11, "aF": 0.2, "eV": 11, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.2, "aV": 12, "aF": 0.2, "eV": 12, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "하이볼히터": [{"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 18, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "좌완킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "초구공략": [{"pV": 5, "pF": 0.25, "aV": 5, "aF": 0.25, "eV": 5, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.25, "aV": 6, "aF": 0.25, "eV": 6, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.25, "aV": 7, "aF": 0.25, "eV": 7, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.25, "aV": 8, "aF": 0.25, "eV": 8, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.25, "aV": 9, "aF": 0.25, "eV": 9, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.25, "aV": 10, "aF": 0.25, "eV": 10, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타점기계": [{"pV": 6, "pF": 0.25, "aV": 6, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.25, "aV": 7, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.25, "aV": 8, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.25, "aV": 9, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.25, "aV": 10, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.25, "aV": 11, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구킬러": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "스윗스팟": [{"pV": 7, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 15, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(시그/올스타/라이브)": [{"pV": 7, "pF": 0.15, "aV": 7, "aF": 0.15, "eV": 7, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.15, "aV": 8, "aF": 0.15, "eV": 8, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.15, "aV": 9, "aF": 0.15, "eV": 9, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.15, "aV": 10, "aF": 0.15, "eV": 10, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.15, "aV": 11, "aF": 0.15, "eV": 11, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.15, "aV": 12, "aF": 0.15, "eV": 12, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리드오프(타순X)": [{"pV": 0, "pF": 1, "aV": 3, "aF": 0, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 3, "aF": 0, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "당겨치기": [{"pV": 5, "pF": 0.4, "aV": 5, "aF": 0.4, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.4, "aV": 6, "aF": 0.4, "eV": 6, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.4, "aV": 7, "aF": 0.4, "eV": 7, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.4, "aV": 8, "aF": 0.4, "eV": 8, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.4, "aV": 9, "aF": 0.4, "eV": 9, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.4, "aV": 10, "aF": 0.4, "eV": 10, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "밀어치기": [{"pV": 5, "pF": 0.4, "aV": 5, "aF": 0.4, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.4, "aV": 6, "aF": 0.4, "eV": 6, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.4, "aV": 7, "aF": 0.4, "eV": 7, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.4, "aV": 8, "aF": 0.4, "eV": 8, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.4, "aV": 9, "aF": 0.4, "eV": 9, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.4, "aV": 10, "aF": 0.4, "eV": 10, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "직구킬러": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "어퍼스윙": [{"pV": 5, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(골글)": [{"pV": 7, "pF": 0.1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.1, "aV": 11, "aF": 0.1, "eV": 11, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.1, "aV": 12, "aF": 0.1, "eV": 12, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "진검승부": [{"pV": 5, "pF": 0.05, "aV": 5, "aF": 0.05, "eV": 5, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.05, "aV": 6, "aF": 0.05, "eV": 6, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.05, "aV": 7, "aF": 0.05, "eV": 7, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.05, "aV": 8, "aF": 0.05, "eV": 8, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.05, "aV": 9, "aF": 0.05, "eV": 9, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.05, "aV": 10, "aF": 0.05, "eV": 10, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "매의눈": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "수비안정성(타순X)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 0, "eV": 12, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 14, "aF": 0, "eV": 14, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 16, "aF": 0, "eV": 16, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리그의강자": [{"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0, "aV": 0, "aF": 1, "eV": 12, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0, "aV": 0, "aF": 1, "eV": 14, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 0, "aV": 0, "aF": 1, "eV": 16, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 18, "pF": 0, "aV": 0, "aF": 1, "eV": 18, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "빠른발": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "핵타선(타순X)": [{"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 6, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 7, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 8, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "번트전문": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "국대에이스": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "포수리드": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "선발": {"좌승사자(좌투)": [{"pV": 9, "pF": 0.733333, "aV": 9, "aF": 0.733333, "eV": 9, "eF": 0.733333, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 11, "pF": 0.727273, "aV": 11, "aF": 0.727273, "eV": 11, "eF": 0.727273, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.769231, "aV": 13, "aF": 0.769231, "eV": 13, "eF": 0.769231, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.8, "aV": 15, "aF": 0.8, "eV": 15, "eF": 0.8, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 17, "pF": 0.8, "aV": 17, "aF": 0.8, "eV": 17, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 19, "pF": 0.8, "aV": 19, "aF": 0.8, "eV": 19, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력140-149)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.4, "sV": 6, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.34, "sV": 7, "sF": 1.34}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.3, "sV": 8, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.27, "sV": 9, "sF": 1.27}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.24, "sV": 10, "sF": 1.24}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "패기(임팩)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.95, "sV": 7, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.95, "sV": 8, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.95, "sV": 9, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.95, "sV": 10, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "필승카드": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "전승우승": [{"pV": 4, "pF": 0.6, "aV": 4, "aF": 0.6, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.6, "aV": 14, "aF": 0.6, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "해결사": [{"pV": 5, "pF": 0.5, "aV": 5, "aF": 0.5, "eV": 5, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 0.5, "aV": 7, "aF": 0.5, "eV": 7, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 0.5, "aV": 9, "aF": 0.5, "eV": 9, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 11, "pF": 0.5, "aV": 11, "aF": 0.5, "eV": 11, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.5, "aV": 13, "aF": 0.5, "eV": 13, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.5, "aV": 15, "aF": 0.5, "eV": 15, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}], "긴급투입": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.33, "eV": 5, "eF": 0.33, "cV": 6, "cF": 0.85, "sV": 6, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.33, "eV": 6, "eF": 0.33, "cV": 7, "cF": 0.85, "sV": 7, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.33, "eV": 7, "eF": 0.33, "cV": 8, "cF": 0.85, "sV": 8, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.33, "eV": 8, "eF": 0.33, "cV": 9, "cF": 0.85, "sV": 9, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.33, "eV": 9, "eF": 0.33, "cV": 10, "cF": 0.85, "sV": 10, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.33, "eV": 10, "eF": 0.33, "cV": 11, "cF": 0.85, "sV": 11, "sF": 0.85}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그톱플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력 100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "원투펀치(1,2선발)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "홈어드밴티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.02, "sV": 5, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.02, "sV": 6, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.02, "sV": 7, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.02, "sV": 8, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.02, "sV": 9, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.02, "sV": 10, "sF": 1.02}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "패기(시그/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}], "좌승사자(우투)": [{"pV": 4, "pF": 0.35, "aV": 4, "aF": 0.35, "eV": 4, "eF": 0.35, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.8, "sV": 3, "sF": 1.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.8, "sV": 3, "sF": 1.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.6, "sV": 4, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.6, "sV": 4, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.6, "sV": 5, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.6, "sV": 5, "sF": 1.6}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "마당쇠": [{"pV": 6, "pF": 0, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 0, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 0, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 0, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "집념": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.2, "sV": 3, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.2, "sV": 4, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.2, "sV": 5, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.2, "sV": 6, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 7, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.2, "sV": 8, "sF": 1.2}], "패기(골글)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 7, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 8, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 9, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.5, "sV": 10, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "언터쳐블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "승리의함성": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.33}], "원투펀치(3,4,5선발)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0.2, "eV": 11, "eF": 0.2, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "얼리스타트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 10, "sF": 1}], "라이징스타(3,4,5선발)": [{"pV": 5, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "라이징스타(1,2선발)": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "원포인트릴리프": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.03, "sV": 9, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.03, "sV": 10, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.03, "sV": 11, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.03, "sV": 12, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.03, "sV": 13, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.03, "sV": 14, "sF": 0.03}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "흐름끊기": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.1, "sV": 6, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.1, "sV": 7, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.1, "sV": 8, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.1, "sV": 9, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.1, "sV": 10, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.1, "sV": 11, "sF": 0.1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "수호신": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.05, "sV": 11, "sF": 0.05}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "기선제압": [{"pV": 5, "pF": 0.03, "aV": 5, "aF": 0.03, "eV": 5, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.03, "aV": 6, "aF": 0.03, "eV": 6, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.03, "aV": 7, "aF": 0.03, "eV": 7, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.03, "aV": 8, "aF": 0.03, "eV": 8, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.03, "aV": 9, "aF": 0.03, "eV": 9, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.03, "aV": 10, "aF": 0.03, "eV": 10, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "사고방지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "중계": {"마당쇠": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "긴급투입(추격조)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 7, "cF": 1.05, "sV": 7, "sF": 1.05}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 8, "cF": 1.04, "sV": 8, "sF": 1.04}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 9, "cF": 1.03, "sV": 9, "sF": 1.03}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 10, "cF": 1.02, "sV": 10, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 11, "cF": 1.02, "sV": 11, "sF": 1.02}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전승우승(추격조)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 1, "aV": 12, "aF": 1, "eV": 12, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 1, "aV": 14, "aF": 1, "eV": 14, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.44, "sV": 7, "sF": 1.44}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.4, "sV": 8, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.37, "sV": 9, "sF": 1.37}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.34, "sV": 10, "sF": 1.34}], "약속의8회(셋업맨2)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.43, "sV": 7, "sF": 1.43}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.375, "sV": 8, "sF": 1.375}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.33, "sV": 9, "sF": 1.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.3, "sV": 10, "sF": 1.3}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "패기(임팩/국대/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "필승카드(승리조,셋업맨)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "필승카드(롱릴리프)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "필승카드(추격조)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "긴급투입(롱릴리프)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 5, "eF": 0.6, "cV": 6, "cF": 0.8, "sV": 6, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 7, "cF": 0.8, "sV": 7, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 8, "cF": 0.8, "sV": 8, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 9, "cF": 0.8, "sV": 9, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 10, "cF": 0.8, "sV": 10, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 11, "cF": 0.8, "sV": 11, "sF": 0.8}], "전승우승(롱릴리프)": [{"pV": 4, "pF": 0.8, "aV": 4, "aF": 0.8, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.8, "aV": 6, "aF": 0.8, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.8, "aV": 8, "aF": 0.8, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.8, "aV": 10, "aF": 0.8, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.8, "aV": 12, "aF": 0.8, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.8, "aV": 14, "aF": 0.8, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "패기(시그)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.9, "sV": 7, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.9, "sV": 9, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.9, "sV": 11, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "약속의8회(추격조,롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.1, "sV": 8, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.1, "sV": 9, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.1, "sV": 10, "sF": 1.1}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.85}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.85}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.7}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그탑플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "국민계투(셋업맨)": [{"pV": 8, "pF": 0.5, "aV": 8, "aF": 0.5, "eV": 8, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.5, "aV": 10, "aF": 0.5, "eV": 10, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.5, "aV": 12, "aF": 0.5, "eV": 12, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.5, "aV": 14, "aF": 0.5, "eV": 14, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.5, "aV": 16, "aF": 0.5, "eV": 16, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.5, "aV": 18, "aF": 0.5, "eV": 18, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "수호신(셋업맨2)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "약속의8회(셋업맨1)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "홈어드밴티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "승리의함성(승리조,셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.8}], "국민계투(셋업맨X)": [{"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 8, "eF": 0.3, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 10, "eF": 0.3, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.3, "aV": 12, "aF": 0.3, "eV": 12, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.3, "aV": 14, "aF": 0.3, "eV": 14, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.3, "aV": 16, "aF": 0.3, "eV": 16, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.3, "aV": 18, "aF": 0.3, "eV": 18, "eF": 0.3, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "전승우승(승리조,셋업맨)": [{"pV": 4, "pF": 0.6, "aV": 4, "aF": 0.6, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.6, "aV": 14, "aF": 0.6, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "라이징스타(셋업맨/3,4,5중계)": [{"pV": 5, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "수호신(승리조)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "원포인트릴리프(셋업맨)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.2, "sV": 12, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.2, "sV": 13, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.2, "sV": 14, "sF": 0.2}], "라이징스타(셋업맨X/3,4,5중계)": [{"pV": 5, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "흐름끊기(셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "원포인트릴리프(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.15, "sV": 9, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.15, "sV": 10, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.15, "sV": 11, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.15, "sV": 12, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.15, "sV": 13, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.15, "sV": 14, "sF": 0.15}], "얼리스타트(셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 10, "sF": 1}], "얼리스타트(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.5, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.5, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.5, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 10, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "언터처블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "원투펀치": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승리의함성(롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.33}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.7, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.7, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.5, "sV": 4, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.5, "sV": 4, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}], "흐름끊기(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.5, "sV": 6, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 7, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 8, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 9, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.5, "sV": 10, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.5, "sV": 11, "sF": 0.5}], "긴급투입(승리조,셋업맨)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.1, "eV": 5, "eF": 0.1, "cV": 6, "cF": 0.4, "sV": 6, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 7, "cF": 0.4, "sV": 7, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 8, "cF": 0.4, "sV": 8, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 9, "cF": 0.4, "sV": 9, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 10, "cF": 0.4, "sV": 10, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 11, "cF": 0.4, "sV": 11, "sF": 0.4}], "라이징스타(1,2,6중계)": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "수호신(추격조,롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.4, "sV": 6, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.4, "sV": 7, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.4, "sV": 8, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.4, "sV": 9, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.4, "sV": 10, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.4, "sV": 11, "sF": 0.4}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "승리의함성(추격조)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압(셋업맨)": [{"pV": 5, "pF": 0.2, "aV": 5, "aF": 0.2, "eV": 5, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.2, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압(셋업맨X)": [{"pV": 5, "pF": 0.15, "aV": 5, "aF": 0.15, "eV": 5, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.15, "aV": 6, "aF": 0.15, "eV": 6, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.15, "aV": 7, "aF": 0.15, "eV": 7, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.15, "aV": 8, "aF": 0.15, "eV": 8, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.15, "aV": 9, "aF": 0.15, "eV": 9, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.15, "aV": 10, "aF": 0.15, "eV": 10, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "수호신(셋업맨1)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.05, "sV": 11, "sF": 0.05}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "사고방지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "마무리": {"마당쇠": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.44, "sV": 7, "sF": 1.44}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.4, "sV": 8, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.37, "sV": 9, "sF": 1.37}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.34, "sV": 10, "sF": 1.34}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "패기(일팩)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "패기(국대)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "필승카드": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "해결사": [{"pV": 5, "pF": 0.5, "aV": 5, "aF": 0.5, "eV": 5, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 0.5, "aV": 7, "aF": 0.5, "eV": 7, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 0.5, "aV": 9, "aF": 0.5, "eV": 9, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 11, "pF": 0.5, "aV": 11, "aF": 0.5, "eV": 11, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.5, "aV": 13, "aF": 0.5, "eV": 13, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.5, "aV": 15, "aF": 0.5, "eV": 15, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}], "패기(시그/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그톱플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "수호신": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "국민계투": [{"pV": 8, "pF": 0.5, "aV": 8, "aF": 0.5, "eV": 8, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.5, "aV": 10, "aF": 0.5, "eV": 10, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.5, "aV": 12, "aF": 0.5, "eV": 12, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.5, "aV": 14, "aF": 0.5, "eV": 14, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.5, "aV": 16, "aF": 0.5, "eV": 16, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.5, "aV": 18, "aF": 0.5, "eV": 18, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 1.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 1.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.75}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.75}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.6}], "승리의함성": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.9}], "홈어드벤티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.43, "sV": 7, "sF": 1.43}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.375, "sV": 8, "sF": 1.375}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.33, "sV": 9, "sF": 1.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.3, "sV": 10, "sF": 1.3}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "원포인트릴리프": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.2, "sV": 12, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.2, "sV": 13, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.2, "sV": 14, "sF": 0.2}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "흐름끊기": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "얼리스타트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 10, "sF": 1}], "전승우승": [{"pV": 4, "pF": 0.1, "aV": 4, "aF": 0.1, "eV": 4, "eF": 0.1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.1, "aV": 12, "aF": 0.1, "eV": 12, "eF": 0.1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.1, "aV": 14, "aF": 0.1, "eV": 14, "eF": 0.1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "인터처블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "원투펀치": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.6, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.6, "sV": 3, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.4, "sV": 4, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.4, "sV": 4, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}], "라이징스타": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "긴급투입": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.1, "eV": 5, "eF": 0.1, "cV": 6, "cF": 0.2, "sV": 6, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 7, "cF": 0.2, "sV": 7, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 8, "cF": 0.2, "sV": 8, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압": [{"pV": 5, "pF": 0.2, "aV": 5, "aF": 0.2, "eV": 5, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.2, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "사교왕": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "weights": {"p": 1.0, "a": 0.9, "e": 0.3, "c": 1.175, "s": 1.275}};
async function sGet(k){try{var r=await window.storage.get(k);return r?JSON.parse(r.value):null;}catch(e){return null;}}
async function sSet(k,d){try{await window.storage.set(k,JSON.stringify(d));return true;}catch(e){return false;}}

/* ================================================================
   CALCULATION
   ================================================================ */
function calcBat(pl,lu,sdB){
  if(!pl||!lu)return{power:0,accuracy:0,eye:0,total:0,skillScore:0};
  var w=getW();var sb=sdB||{p:0,a:0,e:0};
  var faAdj=(pl.isFa&&(pl.cardType==="임팩트"||pl.cardType==="시그니처"))?-3:0;
  var fP=(pl.power||0)+getEnhVal(pl.cardType,"파워",lu.enhance||"")+(lu.trainP||0)+(pl.specPower||0)+sb.p+faAdj;
  var fA=(pl.accuracy||0)+getEnhVal(pl.cardType,"정확",lu.enhance||"")+(lu.trainA||0)+(pl.specAccuracy||0)+sb.a+faAdj;
  var fE=(pl.eye||0)+getEnhVal(pl.cardType,"선구",lu.enhance||"")+(lu.trainE||0)+(pl.specEye||0)+sb.e+faAdj;
  var ss=getSkillScore(lu.skill1,lu.s1Lv||0,"타자")+getSkillScore(lu.skill2,lu.s2Lv||0,"타자")+getSkillScore(lu.skill3,lu.s3Lv||0,"타자");
  var t=fP*w.p+fA*w.a+fE*w.e+ss;
  /* 국대에이스(타자): 종합점수에만 반영 */
  if(sdB&&sdB._sdState){var nb2=sdB._sdState.natBat||sdB._sdState._autoNatBat||"없음";if(nb2==="5렙"){t+=1*w.p+1*w.a;}if(nb2==="6렙"){t+=2*w.p+2*w.a;}}
  /* 잠재력 점수 */
  t += getPotScoreByType(pl.pot1, pl.potType1 || (pl.role === "타자" ? "풀스윙" : "장타억제"), SKILL_DATA) + getPotScoreByType(pl.pot2, pl.potType2 || (pl.role === "타자" ? "클러치" : "침착"), SKILL_DATA);
  return{power:fP,accuracy:fA,eye:fE,total:Math.round(t*100)/100,skillScore:Math.round(ss*100)/100};
}

function calcPit(pl,lu,sdB){
  if(!pl||!lu)return{change:0,stuff:0,total:0,skillScore:0};
  var w=getW();var sb=sdB||{c:0,s:0};
  var faAdjP=(pl.isFa&&(pl.cardType==="임팩트"||pl.cardType==="시그니처"))?-3:0;
  var fC=(pl.change||0)+getEnhVal(pl.cardType,"변화",lu.enhance||"")+(lu.trainC||0)+(pl.specChange||0)+sb.c+faAdjP;
  var fS=(pl.stuff||0)+getEnhVal(pl.cardType,"구위",lu.enhance||"")+(lu.trainS||0)+(pl.specStuff||0)+sb.s+faAdjP;
  var pt=pl.position==="선발"?"선발":pl.position==="마무리"?"마무리":"중계";
  var ss=getSkillScore(lu.skill1,lu.s1Lv||0,pt)+getSkillScore(lu.skill2,lu.s2Lv||0,pt)+getSkillScore(lu.skill3,lu.s3Lv||0,pt);
  var t=fC*w.c+fS*w.s+ss;
  /* 국대에이스(투수)+포수리드: 종합점수에만 반영 */
  if(sdB&&sdB._sdState){
    var np2=sdB._sdState.natPit||sdB._sdState._autoNatPit||"없음";if(np2==="5렙"){t+=1*w.c+1*w.s;}if(np2==="6렙"){t+=2*w.c+2*w.s;}
    var cl2=sdB._sdState.catchLead||sdB._sdState._autoCatch||"없음";
    if(cl2==="5렙"){t+=1*w.c;}if(cl2==="6렙"){t+=1*w.c+1*w.s;}if(cl2==="7렙"){t+=1*w.c+1*w.s;}if(cl2==="8렙"){t+=2*w.c+1*w.s;}if(cl2==="9렙"){t+=2*w.c+1*w.s;}if(cl2==="10렙"){t+=2*w.c+2*w.s;}
  }
  /* 잠재력 점수 */
  t += getPotScoreByType(pl.pot1, pl.potType1 || (pl.role === "타자" ? "풀스윙" : "장타억제"), SKILL_DATA) + getPotScoreByType(pl.pot2, pl.potType2 || (pl.role === "타자" ? "클러치" : "침착"), SKILL_DATA);
  return{change:fC,stuff:fS,total:Math.round(t*100)/100,skillScore:Math.round(ss*100)/100};
}

/* Set deck bonus calculator for a single player */
function calcSDBonus(pl, slot, sdState, totalSP, batOrderIdx) {
  if (!pl) return pl.role === "투수" ? {c:0,s:0} : {p:0,a:0,e:0};
  var isBat = pl.role === "타자";
  var ct = pl.cardType;
  var stars = pl.stars || 5;
  var isGold = ct === "골든글러브" || ct === "시그니처" || ct === "임팩트" || ct === "국가대표";
  var isLive = ct === "시즌" || ct === "라이브";
  var isSP = (pl.position === "선발");
  var isRP = (pl.position === "중계");
  var isCP = (pl.position === "마무리");
  var batSlots = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  /* 타순 인덱스: batOrderIdx가 있으면 사용, 없으면 포지션 기준 (하위 호환) */
  var batIdx = (batOrderIdx !== undefined) ? batOrderIdx : batSlots.indexOf(slot);
  var is12 = (batIdx === 0 || batIdx === 1);
  var is35 = (batIdx >= 2 && batIdx <= 4);
  var is69 = (batIdx >= 5 && batIdx <= 8);
  var isOF = (slot === "RF" || slot === "CF" || slot === "LF" || slot === "DH");
  var bp = 0, ba = 0, be = 0, pc = 0, ps = 0;
  var v = function(k) { return sdState["s" + k] || ""; };
  var act = function(sp) { return totalSP >= sp; };
  var yr = pl.year;

  /* AUTO bonuses */
  if (act(30)) { bp++; ba++; be++; pc++; ps++; }
  if (act(90)) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; }
  if (act(110)) { bp++; ba++; be++; pc++; ps++; }

  /* L/R selection bonuses */
  if (act(40)) { if (v(40)==="L" && isBat) { bp++; ba++; be++; } if (v(40)==="R" && !isBat) { pc++; ps++; } }
  if (act(50)) { if (v(50)==="L" && isLive) { bp++; ba++; be++; pc++; ps++; } if (v(50)==="R" && isGold) { bp++; ba++; be++; pc++; ps++; } }
  if (act(55)) { var y55=v(55); if (y55 && !isBat) { if (ct==="임팩트") pc+=2; else if (String(yr)===y55) pc+=2; } }
  if (act(60)) { if (v(60)==="L" && isBat) { bp++; ba++; be++; } if (v(60)==="R" && !isBat) { pc++; ps++; } }
  if (act(65)) { if (v(65)==="L" && stars===3) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; } if (v(65)==="R" && stars===4 && isBat) ba+=2; }
  if (act(70)) { if (v(70)==="L" && !isBat && !isRP && !isCP) { pc++; ps++; } if (v(70)==="R" && (isRP||isCP)) { pc+=2; ps+=2; } }
  if (act(75)) {
    var v75=v(75); var side75=v75&&v75[0]; var yr75=v75&&v75.indexOf(":")>0?v75.split(":")[1]:"";
    if (side75==="L" && isBat) { var m75=(ct==="임팩트"||String(yr)===yr75); if(m75){bp+=3;ba+=3;} }
    if (side75==="R" && !isBat) { var m75b=(ct==="임팩트"||String(yr)===yr75); if(m75b) ps+=3; }
  }
  if (act(80)) { if (v(80)==="L" && isBat) { bp++; ba++; be++; } if (v(80)==="R" && !isBat) { pc++; ps++; } }
  if (act(85)) { if (v(85)==="L" && stars===4) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; } if (v(85)==="R" && stars===5) { bp++; ps++; } }
  if (act(95)) { if (isBat && isOF) be+=2; }
  if (act(100)) { if (v(100)==="L" && isBat) { bp++; ba++; be++; } if (v(100)==="R" && !isBat) { pc++; ps++; } }
  if (act(105)) { if (v(105)==="L" && stars===3) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; } if (v(105)==="R" && stars===4) { if(isBat){bp+=2;be+=2;} if(!isBat){pc+=2;ps+=2;} } }
  if (act(115)) { if (v(115)==="L" && isBat && is69) ba+=2; if (v(115)==="R" && (isRP||isCP)) ps+=2; }
  if (act(120)) { if (v(120)==="L" && isBat && is35) { bp+=2; ba+=2; be+=2; } if (v(120)==="R" && !isBat) { pc++; ps++; } }
  if (act(125)) { if (stars===4) { if(isBat){ba+=2;be+=2;} else{pc+=2;} } }
  if (act(130)) { if (v(130)==="L" && isLive) { bp++; ba++; be++; pc++; ps++; } if (v(130)==="R" && isGold) { bp++; ba++; be++; pc++; ps++; } }
  if (act(135)) { if (v(135)==="L" && isBat && is35) ba+=2; if (v(135)==="R" && isSP) ps++; }
  if (act(140)) { if (v(140)==="L" && isBat && is69) { bp++; ba++; be++; } if (v(140)==="R" && (isRP||isCP)) { pc++; ps++; } }
  if (act(145)) { if (v(145)==="L" && isBat && is12) { ba+=2; be+=2; } if (v(145)==="R" && isSP) ps++; }
  if (act(150)) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; }
  if (act(155)) { if (v(155)==="L" && isBat && is12) { bp+=2; be+=2; } if (v(155)==="R" && isSP) pc++; }
  if (act(160)) { if (v(160)==="L" && isBat) { bp++; ba++; be++; } if (v(160)==="R" && !isBat) { pc++; ps++; } }
  if (act(165)) { if (v(165)==="L" && isBat) ba++; if (v(165)==="R" && !isBat) pc++; }
  if (act(170)) { bp++; ba++; be++; pc++; ps++; }
  if (act(175)) { if (v(175)==="L" && isBat) { bp++; be++; } if (v(175)==="R" && !isBat) ps++; }
  if (act(180)) {
    var v180=v(180);
    if (v180==="L" && ct==="라이브") { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; }
    if (typeof v180==="string"&&v180.startsWith("R:")) { var yr180=v180.split(":")[1]; if(isBat){if(ct==="임팩트"){bp++;ba++;be++;}else if(String(yr)===yr180){bp++;ba++;be++;}} else{if(ct==="임팩트"){pc++;ps++;}else if(String(yr)===yr180){pc++;ps++;}} }
  }
  if (act(185)) {
    var v185=v(185);
    if (v185==="L" && isBat && is12) bp+=2;
    if (typeof v185==="string"&&v185.startsWith("R:")) { var yr185=v185.split(":")[1]; if(isBat){if(ct==="임팩트"){bp++;ba++;be++;}else if(String(yr)===yr185){bp++;ba++;be++;}} }
  }
  if (act(190)) {
    var v190=v(190);
    if (v190==="L" && isSP) ps++;
    if (typeof v190==="string"&&v190.startsWith("R:")) { var yr190=v190.split(":")[1]; if(!isBat){if(ct==="임팩트"){pc++;ps++;}else if(String(yr)===yr190){pc++;ps++;}} }
  }
  if (act(195)) { if (v(195)==="L" && (ct==="라이브"||ct==="국가대표")) { bp++; ba++; be++; pc++; ps++; } if (v(195)==="R" && ct==="시그니처") { bp++; ba++; be++; pc++; ps++; } }
  if (act(200)) { if (v(200)==="L" && isBat) { bp+=2; ba+=2; be+=2; } if (v(200)==="R" && !isBat) { pc+=2; ps+=2; } }

  /* Synergy */
  var synCounts = sdState._synCounts || {};
  var autoLive = (synCounts["라이브"]||0) + (synCounts["국가대표"]||0) >= 7;
  var autoImp = (synCounts["임팩트"]||0) >= 5;
  var autoSig = (synCounts["시그니처"]||0) >= 5;
  var synLive = sdState.synLive !== undefined ? sdState.synLive : autoLive;
  var synImp = sdState.synImpact !== undefined ? sdState.synImpact : autoImp;
  var synSig = sdState.synSig !== undefined ? sdState.synSig : autoSig;
  if (synLive) { bp++; ba++; be++; pc++; ps++; }
  if (synImp && isBat) { bp++; ba++; be++; }
  if (synSig && !isBat) { pc++; ps++; }

  /* 국대에이스/포수리드: 종합점수에만 반영 (calcBat/calcPit에서 처리) */

  /* 유니폼 효과 (기본 +1) */
  bp += (sdState.uniP || 0);
  ba += (sdState.uniA || 0);
  be += (sdState.uniE || 0);
  pc += (sdState.uniC || 0);
  ps += (sdState.uniS || 0);

  /* 포지션 특훈 (POS_TRAIN 테이블 참조) */
  var ptData = sdState["pt_" + slot];
  var ptEntry = POS_TRAIN[slot];
  if (ptEntry) {
    var ptLv = ptData ? Math.min(ptData.level || ptEntry.mx, ptEntry.mx) : ptEntry.mx;
    if (isBat) {
      var ptP = ptEntry["파워"]; bp += (ptP && ptLv < ptP.length ? ptP[ptLv] : 0) + (ptData ? ptData.r0 || 0 : 0);
      var ptA = ptEntry["정확"]; ba += (ptA && ptLv < ptA.length ? ptA[ptLv] : 0) + (ptData ? ptData.r1 || 0 : 0);
      var ptE = ptEntry["선구"]; be += (ptE && ptLv < ptE.length ? ptE[ptLv] : 0) + (ptData ? ptData.r2 || 0 : 0);
    } else {
      var ptC = ptEntry["변화"]; pc += (ptC && ptLv < ptC.length ? ptC[ptLv] : 0) + (ptData ? ptData.r0 || 0 : 0);
      var ptS = ptEntry["구위"]; ps += (ptS && ptLv < ptS.length ? ptS[ptLv] : 0) + (ptData ? ptData.r1 || 0 : 0);
    }
  }

  /* 주장 보너스 (라커룸에서 설정) */
  if (isBat && pl.id === sdState.capBatId) { bp += sdState.capBatP || 0; ba += sdState.capBatA || 0; be += sdState.capBatE || 0; }
  if (!isBat && pl.id === sdState.capPitId) { pc += sdState.capPitC || 0; ps += sdState.capPitS || 0; }

  /* POTM 자동 보너스 */
  var potmB = getPotmBonus(pl, sdState);
  if (isBat) { bp += potmB; ba += potmB; be += potmB; }
  else { pc += potmB; ps += potmB; }

  return isBat ? {p:bp,a:ba,e:be,_sdState:sdState} : {c:pc,s:ps,_sdState:sdState};
}

/* ================================================================
   HOOKS
   ================================================================ */
function useMedia(q){var _s=useState(false);var m=_s[0];var setM=_s[1];useEffect(function(){var mq=window.matchMedia(q);var fn=function(e){setM(e.matches);};setM(mq.matches);if(mq.addEventListener){mq.addEventListener("change",fn);}else{mq.addListener(fn);}return function(){if(mq.removeEventListener){mq.removeEventListener("change",fn);}else{mq.removeListener(fn);}};}, [q]);return m;}

function useData(userId, sdState, setSdState, curDeckId){
  var _p=useState([]);var players=_p[0];var setPlayers=_p[1];
  var _lm=useState({});var lineupMap=_lm[0];var setLineupMap=_lm[1];
  var _sk=useState(DEFAULT_SKILLS);var skills=_sk[0];var setSkills=_sk[1];
  var _lo=useState(true);var loading=_lo[0];var setLoading=_lo[1];
  var uidRef=React.useRef(userId);uidRef.current=userId;
  var deckIdRef=React.useRef(curDeckId);deckIdRef.current=curDeckId;

  /* ── 전체 sd_state 메모리 캐시 (읽기 중복 제거) ── */
  var allDataRef=React.useRef(null);
  var globalLoadedRef=React.useRef(false); /* 선수도감/스킬 1회만 로드 */

  var loadDeckData = async function(uid, deckId) {
    var all = await loadUserData(uid);
    if (!all) return null;
    allDataRef.current = all;
    if (!all.decks) {
      return { players: all.players||[], lineupMap: all.lineupMap||{}, sdConfig: all.sdConfig||{liveSetPo:0} };
    }
    return all.decks[deckId] || null;
  };

  /* 저장: 캐시 사용 → 쓰기 1번만 */
  var saveAllData = async function(uid, deckId, deckData) {
    if (!supabase || !uid || !deckId) return;
    var all = allDataRef.current;
    if (!all) {
      all = await loadUserData(uid) || {};
      allDataRef.current = all;
    }
    if (!all.decks) {
      var migrated = { players: all.players||[], lineupMap: all.lineupMap||{}, sdConfig: all.sdConfig||{liveSetPo:0} };
      all = { decks: {}, deckList: all.deckList||[], deckCurrent: all.deckCurrent||'' };
      all.decks[deckId] = migrated;
      allDataRef.current = all;
    }
    /* deckList/deckCurrent는 localStorage(saveDecks가 항상 최신으로 유지)에서 읽어 보존
       이렇게 해야 saveDecks와의 race condition 방지 */
    var latestList = await sGet("deck-list");
    var latestCur  = await sGet("deck-current");
    if (latestList && latestList.length > 0) all.deckList = latestList;
    if (latestCur) all.deckCurrent = latestCur;
    all.decks[deckId] = deckData;
    allDataRef.current = all;
    await saveUserData(uid, all);
  };

  useEffect(function(){
    if(!userId || !curDeckId) return;
    setLoading(true);
    (async function(){
      if(supabase){
        var dd = await loadDeckData(userId, curDeckId);
        if(dd && dd.players && dd.players.length > 0){
          setPlayers(dd.players); setLineupMap(dd.lineupMap||{}); setSdState(dd.sdConfig||{liveSetPo:0});
        } else {
          setPlayers([]); setLineupMap({}); setSdState({liveSetPo:0});
        }
        /* 선수도감/스킬: 로그인 후 딱 1번만 로드 */
        if(!globalLoadedRef.current){
          globalLoadedRef.current = true;
          var gsk=await loadGlobalSkills();
          if(gsk&&gsk["타자"]){setSkills(gsk);SKILL_DATA=gsk;if(gsk.weights)LIVE_WEIGHTS=gsk.weights;}
          else{setSkills(DEFAULT_SKILLS);SKILL_DATA=DEFAULT_SKILLS;}
          var gpl=await loadGlobalPlayers();
          if(gpl&&gpl.length>0){SEED_PLAYERS.length=0;gpl.forEach(function(p){SEED_PLAYERS.push(p);});}
        }
      } else {
        var ver=await sGet(SK.version);var needReset=(!ver||ver<DATA_VERSION);
        if(needReset){await sSet(SK.version,DATA_VERSION);}
        var p2=await sGet("deck-players-"+curDeckId);
        if(!needReset&&p2&&p2.length>0){setPlayers(p2);}else{setPlayers([]);await sSet("deck-players-"+curDeckId,[]);}
        var lm2=await sGet("deck-lineup-"+curDeckId);
        if(!needReset&&lm2&&Object.keys(lm2).length>0){setLineupMap(lm2);}else{setLineupMap({});await sSet("deck-lineup-"+curDeckId,{});}
        if(!globalLoadedRef.current){
          globalLoadedRef.current = true;
          var sk2=await sGet(SK.skills);
          if(!needReset&&sk2&&sk2["타자"]){setSkills(sk2);SKILL_DATA=sk2;if(sk2.weights)LIVE_WEIGHTS=sk2.weights;}
          else{setSkills(DEFAULT_SKILLS);SKILL_DATA=DEFAULT_SKILLS;await sSet(SK.skills,DEFAULT_SKILLS);}
        }
        var sdc=await sGet("deck-sdconfig-"+curDeckId);
        if(!needReset&&sdc){setSdState(sdc);}else{setSdState({liveSetPo:0});}
      }
      setLoading(false);
    })();
  },[userId, curDeckId]);

  SKILL_DATA=skills;if(skills.weights)LIVE_WEIGHTS=skills.weights;

  var saveP=useCallback(async function(d){
    setPlayers(d);
    var did=deckIdRef.current; var uid=uidRef.current;
    if(supabase&&uid&&did){await saveAllData(uid,did,{players:d,lineupMap:lineupMap,sdConfig:sdState});}
    else if(did){await sSet("deck-players-"+did,d);}
  },[lineupMap,sdState]);

  var saveLM=useCallback(async function(d){
    setLineupMap(d);
    var did=deckIdRef.current; var uid=uidRef.current;
    if(supabase&&uid&&did){await saveAllData(uid,did,{players:players,lineupMap:d,sdConfig:sdState});}
    else if(did){await sSet("deck-lineup-"+did,d);}
  },[players,sdState]);

  var saveSK=useCallback(async function(d){
    setSkills(d);SKILL_DATA=d;
    if(supabase){await saveGlobalSkills(d);}
    else{await sSet(SK.skills,d);}
  },[]);

  var saveSdState=useCallback(async function(nsd){
    var did=deckIdRef.current; var uid=uidRef.current;
    if(supabase&&uid&&did){await saveAllData(uid,did,{players:players,lineupMap:lineupMap,sdConfig:nsd});}
    else if(did){await sSet("deck-sdconfig-"+did,nsd);}
  },[players,lineupMap]);

  return{players:players,lineupMap:lineupMap,skills:skills,loading:loading,savePlayers:saveP,saveLineupMap:saveLM,saveSkills:saveSK,saveSdState:saveSdState,allDataRef:allDataRef};
}

/* ================================================================
   UI COMPONENTS
   ================================================================ */

/* ================================================================
   PLAYER CARD COMPONENT - 카드 스타일 선수 표시
   ================================================================ */
var CARD_COLORS = {"골든글러브":"#FFD700","시그니처":"#FF2D6B","국가대표":"#1E90FF","임팩트":"#22C55E","라이브":"#FF7700","시즌":"#4CAF50","올스타":"#AA44FF"};
var CARD_BG = {
  "골든글러브":"linear-gradient(160deg,#7a5c00 0%,#D4AF37 30%,#FFF1A8 50%,#D4AF37 70%,#7a5c00 100%)",
  "시그니처":"linear-gradient(160deg,#6b0022 0%,#C2003A 35%,#FF6B9D 55%,#C2003A 75%,#6b0022 100%)",
  "국가대표":"linear-gradient(160deg,#003580 0%,#1565C0 35%,#64B5F6 55%,#1565C0 75%,#003580 100%)",
  "임팩트":"linear-gradient(160deg,#052e16 0%,#16a34a 35%,#86efac 55%,#16a34a 75%,#052e16 100%)",
  "라이브":"linear-gradient(160deg,#7a2e00 0%,#E65100 35%,#FFB74D 55%,#E65100 75%,#7a2e00 100%)",
  "시즌":"linear-gradient(160deg,#1b3a1b 0%,#2E7D32 35%,#81C784 55%,#2E7D32 75%,#1b3a1b 100%)",
  "올스타":"linear-gradient(160deg,#2d0060 0%,#7B1FA2 35%,#CE93D8 55%,#7B1FA2 75%,#2d0060 100%)",
};
var CARD_GLOW = {
  "골든글러브":"0 0 10px #FFD70088, 0 0 20px #FFD70044",
  "시그니처":"0 0 10px #FF2D6B88, 0 0 20px #FF2D6B44",
  "국가대표":"0 0 10px #1E90FF88, 0 0 20px #1E90FF44",
  "임팩트":"0 0 10px #22C55E88, 0 0 20px #22C55E44",
  "라이브":"0 0 10px #FF770088, 0 0 20px #FF770044",
  "시즌":"0 0 8px #4CAF5066",
  "올스타":"0 0 10px #AA44FF88, 0 0 20px #AA44FF44",
};
var CARD_CORNER = {
  "골든글러브":"◈","시그니처":"✦","국가대표":"★",
  "임팩트":"⬟","라이브":"▶","시즌":"●","올스타":"✧",
};
function PlayerCard(p) {
  var pl = p.player; var size = p.size || "md"; var score = p.score;
  if (!pl) return null;
  var ct = pl.cardType || "시즌";
  var bg = CARD_BG[ct] || CARD_BG["시즌"];
  var borderC = CARD_COLORS[ct] || "#555";
  var glow = CARD_GLOW[ct] || "";
  var corner = CARD_CORNER[ct] || "";
  var isDark = ct === "골든글러브";
  var w = size === "sm" ? 52 : size === "lg" ? 80 : 64;
  var h = size === "sm" ? 72 : size === "lg" ? 110 : 88;
  var fs = size === "sm" ? 7 : size === "lg" ? 10 : 8;
  var starSize = size === "sm" ? 5 : size === "lg" ? 8 : 6;
  var stars = pl.stars || CARD_STARS[ct] || 5;
  var starStr = "";
  for (var si = 0; si < stars; si++) starStr += "★";
  var photoUrl = p.showPhoto ? (pl.photoUrl || "") : "";

  /* 카드종류별 테두리 두께 */
  var borderW = ct === "골든글러브" || ct === "시그니처" ? "2px" : "1.5px";
  /* 이너 하이라이트 라인 색 */
  var innerLine = {
    "골든글러브":"rgba(255,241,168,0.5)",
    "시그니처":"rgba(255,150,180,0.4)",
    "국가대표":"rgba(100,181,246,0.4)",
    "임팩트":"rgba(134,239,172,0.4)",
    "라이브":"rgba(255,183,77,0.4)",
    "올스타":"rgba(206,147,216,0.4)",
  }[ct] || "rgba(255,255,255,0.15)";

  return (
    <div style={{ width: w, height: h, borderRadius: 7, background: bg,
      border: borderW + " solid " + borderC,
      boxShadow: glow,
      display: "flex", flexDirection: "column", overflow: "hidden",
      flexShrink: 0, position: "relative" }}>

      {/* 이너 하이라이트 테두리 */}
      <div style={{ position:"absolute", inset:2, borderRadius:5,
        border:"1px solid "+innerLine, pointerEvents:"none", zIndex:3 }} />

      {/* 코너 장식 */}
      {size !== "sm" && corner && (<>
        <span style={{ position:"absolute", top:3, left:3, fontSize:fs-1,
          color:borderC, opacity:0.8, lineHeight:1, zIndex:4 }}>{corner}</span>
        <span style={{ position:"absolute", top:3, right:size==="lg"?18:14, fontSize:fs-1,
          color:borderC, opacity:0.8, lineHeight:1, zIndex:4 }}>{corner}</span>
      </>)}

      {/* Score badge */}
      {score !== undefined && (
        <div style={{ position:"absolute", top:2, left:2,
          background:"rgba(0,0,0,0.7)", borderRadius:3, padding:"1px 4px", zIndex:5 }}>
          <span style={{ fontSize:size==="lg"?14:11, fontWeight:900,
            color:"#FFD700", fontFamily:"var(--m)" }}>{score}</span>
        </div>
      )}

      {/* Position badge */}
      <div style={{ position:"absolute", top:0, right:2,
        background:"rgba(0,0,0,0.6)", borderRadius:3, padding:"0px 3px", zIndex:5 }}>
        <span style={{ fontSize:fs, fontWeight:700, color:"#fff", lineHeight:1, display:"block" }}>{pl.subPosition||""}</span>
      </div>

      {/* Team logo - 좌상단 */}
      {pl.team && (function(){
        var logoUrl = getLogoForCard(pl.team, pl.year||"");
        if (!logoUrl) return null;
        var logoSize = size==="lg" ? 28 : size==="sm" ? 18 : 22;
        return (
          <div style={{ position:"absolute", top:1, left:1, zIndex:5,
            width:logoSize, height:logoSize }}>
            <img src={logoUrl} alt={pl.team}
              style={{ width:"100%", height:"100%", objectFit:"contain",
                mixBlendMode:"screen",
                filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }}
              onError={function(e){ e.target.style.display="none"; }} />
          </div>
        );
      })()}

      {/* Photo area */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        overflow:"hidden",
        background: photoUrl ? "none" : "rgba(0,0,0,0.25)" }}>
        {photoUrl ? (
          <img src={photoUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"center "+(PHOTO_POS_MAP[pl.name]!==undefined?PHOTO_POS_MAP[pl.name]:20)+"%" }} />
        ) : (
          <span style={{ fontSize:size==="lg"?28:20, opacity:0.35 }}>{"⚾"}</span>
        )}
      </div>

      {/* Enhance badge */}
      {pl.enhance && (function(){
        var isGak = (pl.enhance||"").indexOf("각성") >= 0;
        var num = (pl.enhance||"").replace(/[^0-9]/g,"");
        return (
          <div style={{ position:"absolute", bottom:size==="lg"?28:22, left:2, zIndex:5 }}>
            {isGak ? (
              <span style={{ fontSize:fs, fontWeight:800, color:"#fff",
                background:"linear-gradient(135deg,#7B1FA2,#AB47BC)",
                borderRadius:3, padding:"1px 3px", letterSpacing:0.5 }}>
                {"◆"+num}
              </span>
            ) : (
              <span style={{ fontSize:fs, fontWeight:800, color:"#fff",
                background:"#E53935", borderRadius:3, padding:"1px 3px" }}>
                {"+"+num}
              </span>
            )}
          </div>
        );
      })()}

      {/* Bottom info */}
      <div style={{ background:"rgba(0,0,0,0.65)", padding:"2px 3px 3px", textAlign:"center",
        borderTop:"1px solid "+innerLine }}>
        <div style={{ fontSize:starSize, color:"#FFD700", lineHeight:1,
          textShadow:"0 0 4px #FFD70099" }}>{starStr}</div>
        <div style={{ fontSize:fs, fontWeight:700, color:"#fff", lineHeight:1.2,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          textShadow:"0 1px 2px rgba(0,0,0,0.8)" }}>{pl.name}</div>
      </div>
    </div>
  );
}

/* Photo sharing: find photoUrl by player name */
function findPhotoByName(players, name) {
  if (!name || !players) return "";
  var baseName = name.replace(/[0-9]/g, "").trim();
  for (var i = 0; i < players.length; i++) {
    var pn = (players[i].name || "").replace(/[0-9]/g, "").trim();
    if (pn === baseName && players[i].photoUrl) return players[i].photoUrl;
  }
  return "";
}
function Badge(p){var c={"골든글러브":"#D4AF37","시그니처":"#C0392B","국가대표":"#2E86C1","임팩트":"#7D3C98","라이브":"#E67E22"}[p.type]||"#555";return(<span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,fontSize:10,fontWeight:700,background:c,color:p.type==="골든글러브"?"#1a1100":"#fff",whiteSpace:"nowrap"}}>{p.type}</span>);}
function GS(p){return(<div style={{fontSize:p.size||16,fontWeight:900,fontFamily:"var(--h)",background:p.grad||"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:"transparent"}}>{p.val}</div>);}
function SH(p){return(<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"linear-gradient(90deg,"+p.color+"15,transparent)",borderLeft:"3px solid "+p.color,borderBottom:"1px solid var(--bd)"}}><span style={{fontSize:14}}>{p.icon}</span><span style={{fontSize:13,fontWeight:800,color:"var(--t1)",fontFamily:"var(--h)",letterSpacing:1}}>{p.title}</span><span style={{fontSize:10,color:"var(--td)",fontFamily:"var(--m)"}}>{"("+p.count+")"}</span></div>);}

function Bar(p){return(<div style={{width:"100%",height:6,background:"var(--bar)",borderRadius:3,overflow:"hidden"}}><div style={{width:Math.min((p.value/200)*100,100)+"%",height:"100%",borderRadius:3,background:"linear-gradient(90deg,"+p.color+"77,"+p.color+")",transition:"width 0.5s ease"}}/></div>);}

function SkBadge(p){var c={10:"#FF4081",9:"#E040FB",8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[p.lv]||"#aaa";return(
  <div style={{display:"inline-flex",alignItems:"center",gap:3,background:"var(--inner)",borderRadius:3,padding:"2px 5px",border:"1px solid "+c+"33",fontSize:10,lineHeight:1.3}}>
    <span style={{background:c,color:"#000",borderRadius:2,padding:"0 3px",fontWeight:800,fontSize:9,fontFamily:"var(--m)",flexShrink:0}}>{"Lv."+p.lv}</span>
    <span style={{color:"var(--t2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{p.name}</span>
  </div>
);}

/* Player Selector Popup */
function PlayerSelector(p) {
  var slot = p.slot;
  var players = p.players;
  var onSelect = p.onSelect;
  var onClose = p.onClose;
  var _q = useState(""); var query = _q[0]; var setQuery = _q[1];
  var _team = useState(""); var teamF = _team[0]; var setTeamF = _team[1];
  var _sort = useState("종합"); var sortBy = _sort[0]; var setSortBy = _sort[1];
  var _limit = useState(30); var showLimit = _limit[0]; var setShowLimit = _limit[1];
  var isBatSlot = ["C","1B","2B","3B","SS","LF","CF","RF","DH"].indexOf(slot) >= 0;
  var isBench = slot.indexOf("BN") === 0;
  var w = getW();

  var isPitSlot = !isBatSlot && !isBench;
  var pitRole = slot === "CP" ? "마무리" : slot.indexOf("SP") === 0 ? "선발" : slot.indexOf("RP") === 0 ? "중계" : "";
  var candidates = players.filter(function(pl) {
    if (isBench) return pl.role === "타자";
    if (isBatSlot) {
      if (pl.role !== "타자") return false;
      if (slot === "DH") return true;
      return pl.subPosition === slot;
    } else {
      if (pl.role !== "투수") return false;
      return pl.position === pitRole;
    }
  });

  /* Team filter (골든글러브는 필터 무시) */
  if (teamF) {
    candidates = candidates.filter(function(pl) {
      return pl.cardType === "골든글러브" || pl.team === teamF;
    });
  }

  /* Text search */
  if (query.trim()) {
    var q = query.trim().toLowerCase();
    candidates = candidates.filter(function(pl) {
      return pl.name.toLowerCase().indexOf(q) >= 0 || (pl.cardType || "").indexOf(q) >= 0 || (pl.year || "").toString().indexOf(q) >= 0 || (pl.team || "").indexOf(q) >= 0;
    });
  }

  /* Sort */
  candidates.sort(function(a, b) {
    var sa, sb;
    if (isBatSlot || isBench) {
      if (sortBy === "파워") { sa = a.power || 0; sb = b.power || 0; }
      else if (sortBy === "정확") { sa = a.accuracy || 0; sb = b.accuracy || 0; }
      else { sa = (a.power||0)*w.p + (a.accuracy||0)*w.a + (a.eye||0)*w.e; sb = (b.power||0)*w.p + (b.accuracy||0)*w.a + (b.eye||0)*w.e; }
    } else {
      if (sortBy === "변화") { sa = a.change || 0; sb = b.change || 0; }
      else if (sortBy === "구위") { sa = a.stuff || 0; sb = b.stuff || 0; }
      else { sa = (a.change||0)*w.c + (a.stuff||0)*w.s; sb = (b.change||0)*w.c + (b.stuff||0)*w.s; }
    }
    return sb - sa;
  });

  var total = candidates.length;
  var visible = candidates.slice(0, showLimit);
  var hasMore = total > showLimit;

  var teams = ["기아","키움","삼성","LG","KT","한화","SSG","롯데","NC","두산"];
  var sortOpts = (isBatSlot || isBench) ? ["종합","파워","정확"] : ["종합","변화","구위"];
  var filterBtnStyle = function(active) {
    return { padding: "4px 8px", fontSize: 10, fontWeight: active ? 700 : 400, background: active ? "var(--ta)" : "transparent", border: active ? "1px solid var(--acc)" : "1px solid var(--bd)", borderRadius: 4, color: active ? "var(--acc)" : "var(--td)", cursor: "pointer" };
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "#141a24", borderRadius: 14, border: "1px solid var(--bd)", maxWidth: 440, width: "100%", maxHeight: "85vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{slot + " 선수 선택"}</div>
              <div style={{ fontSize: 10, color: "var(--td)", marginTop: 2 }}>{isBatSlot ? (slot === "DH" ? "모든 타자" : slot + " 포지션") : (isBench ? "후보 (타자)" : pitRole + " 투수")}{" · " + total + "명"}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
          </div>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
            <span style={{ fontSize: 14, opacity: 0.4 }}>{"🔍"}</span>
            <input type="text" value={query} onChange={function(e) { setQuery(e.target.value); setShowLimit(30); }} placeholder="이름, 카드, 팀 검색..." style={{ flex: 1, background: "transparent", border: "none", color: "var(--t1)", fontSize: 12, outline: "none" }} />
            {query && (<button onClick={function() { setQuery(""); }} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 12 }}>{"✕"}</button>)}
          </div>
          {/* Team filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <button onClick={function(){setTeamF("");setShowLimit(30);}} style={filterBtnStyle(!teamF)}>{"전체"}</button>
            {teams.map(function(t) { return (<button key={t} onClick={function(){setTeamF(teamF===t?"":t);setShowLimit(30);}} style={filterBtnStyle(teamF===t)}>{t}</button>); })}
          </div>
          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: "var(--td)" }}>{"정렬"}</span>
            {sortOpts.map(function(s) { return (<button key={s} onClick={function(){setSortBy(s);}} style={filterBtnStyle(sortBy===s)}>{s + "순"}</button>); })}
            {teamF && (<span style={{ marginLeft: "auto", fontSize: 9, color: "var(--acc)" }}>{"골든글러브는 항상 표시"}</span>)}
          </div>
        </div>
        <div style={{ overflowY: "auto", maxHeight: "55vh" }}>
          {/* 비우기 */}
          <div onClick={function() { onSelect(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
            <div style={{ width: 36, height: 48, borderRadius: 4, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 14, opacity: 0.3 }}>{"✕"}</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--td)" }}>{"비우기"}</span>
          </div>
          {visible.length === 0 ? (
            <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--td)", fontSize: 12 }}>{"해당 조건의 선수가 없습니다."}</div>
          ) : visible.map(function(pl, idx) {
            var statLine;
            if (isBatSlot || isBench) {
              var ts = Math.round((pl.power||0)*w.p + (pl.accuracy||0)*w.a + (pl.eye||0)*w.e);
              statLine = (pl.team ? pl.team+" · " : "") + pl.hand + "타 · 파" + (pl.power||0) + " 정" + (pl.accuracy||0) + " 선" + (pl.eye||0) + " → " + ts;
            } else {
              var ts2 = Math.round((pl.change||0)*w.c + (pl.stuff||0)*w.s);
              statLine = (pl.team ? pl.team+" · " : "") + pl.hand + "투 · 변" + (pl.change||0) + " 구" + (pl.stuff||0) + " → " + ts2;
            }
            return (
              <div key={pl.id} onClick={function() { onSelect(pl.id); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--bd)", cursor: "pointer", background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                <div style={{ fontSize: 10, color: "var(--td)", fontFamily: "var(--m)", width: 18, textAlign: "center", flexShrink: 0 }}>{idx + 1}</div>
                <PlayerCard player={pl} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Badge type={pl.cardType} />
                    <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span>
                    {pl.year && (<span style={{ fontSize: 9, color: "var(--td)" }}>{pl.year}</span>)}
                    {pl.cardType === "임팩트" && pl.impactType && (<span style={{ fontSize: 9, color: "#a78bfa", marginLeft: 2 }}>{'(' + pl.impactType + ')'}</span>)}
                  </div>
                  <div style={{ fontSize: 9, color: "var(--td)", marginTop: 2 }}>{statLine}</div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div onClick={function(){setShowLimit(showLimit+30);}} style={{ padding: "12px 18px", textAlign: "center", cursor: "pointer", borderBottom: "1px solid var(--bd)" }}>
              <span style={{ fontSize: 12, color: "var(--acc)", fontWeight: 700 }}>{"▼ 더보기 (" + (total - showLimit) + "명 남음)"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Inp(p){
  return(
    <div style={{marginBottom:p.mb||10}}>
      <label style={{display:"block",fontSize:10,color:"var(--td)",marginBottom:3,fontWeight:600}}>{p.label}</label>
      {p.type==="select"?(
        <select value={p.value} onChange={function(e){p.onChange(e.target.value);}} style={{width:"100%",padding:"8px 10px",fontSize:13,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",outline:"none",boxSizing:"border-box"}}>
          {p.options.map(function(o){return(<option key={o} value={o}>{o}</option>);})}
        </select>
      ):(
        <input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.ph||""}
          style={{width:"100%",padding:"8px 10px",fontSize:13,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",outline:"none",boxSizing:"border-box"}} />
      )}
    </div>
  );
}

/* ================================================================
   PLAYER DB (Admin only)
   ================================================================ */
var CARD_TYPES=["골든글러브","시그니처","임팩트","국가대표","라이브","시즌","올스타"];
var BAT_POS=["C","1B","2B","3B","SS","LF","CF","RF","DH"];
var PIT_POS_MAP={"선발":["SP1","SP2","SP3","SP4","SP5"],"중계":["RP1","RP2","RP3","RP4","RP5","RP6"],"마무리":["CP"]};

function PlayerDBPage(p){
  var mob=p.mobile;
  var _dbTab=useState("선수");var dbTab=_dbTab[0];var setDbTab=_dbTab[1];
  var _t=useState("골든글러브");var at=_t[0];var setAt=_t[1];
  var _e=useState(null);var editing=_e[0];var setEditing=_e[1];
  var _f=useState(null);var form=_f[0];var setForm=_f[1];
  var _sv=useState(false);var saving=_sv[0];var setSaving=_sv[1];
  var _reload=useState(0);var reload=_reload[0];var setReload=_reload[1];
  /* 사진 관리 */
  var _photos=useState([]);var allPhotos=_photos[0];var setAllPhotos=_photos[1];
  var _photoLoading=useState(false);var photoLoading=_photoLoading[0];var setPhotoLoading=_photoLoading[1];
  var _uploading=useState(false);var uploading=_uploading[0];var setUploading=_uploading[1];
  var _uploadMsg=useState("");var uploadMsg=_uploadMsg[0];var setUploadMsg=_uploadMsg[1];
  /* 사진 위치 맵 */
  var _posMap=useState({});var posMap=_posMap[0];var setPosMap=_posMap[1];
  var _posSaving=useState(false);var posSaving=_posSaving[0];var setPosSaving=_posSaving[1];

  /* posMap 로드 + 전역 반영 */
  useEffect(function(){
    loadPhotoPosMap().then(function(m){
      setPosMap(m||{});
      Object.assign(PHOTO_POS_MAP, m||{});
    });
  },[]);

  var savePosMap = async function(newMap) {
    setPosSaving(true);
    Object.assign(PHOTO_POS_MAP, newMap);
    await savePhotoPosMap(newMap);
    setPosSaving(false);
  };

  /* 사진 목록 로드 */
  var loadPhotos=async function(){
    setPhotoLoading(true);
    var list=await listAllPhotos();
    setAllPhotos(list);
    setPhotoLoading(false);
  };
  useEffect(function(){ if(dbTab==="사진 관리") loadPhotos(); },[dbTab]);

  /* 사진 업로드 핸들러 */
  var handlePhotoUpload=async function(files){
    if(!files||!files.length)return;
    setUploading(true);
    var ok=0;var fail=0;
    for(var i=0;i<files.length;i++){
      var file=files[i];
      var ext=file.name.split(".").pop().toLowerCase();
      var baseName=file.name.replace(/\.[^.]+$/,"");
      var fileName=baseName+"."+ext;
      var url=await uploadPlayerPhoto(file,fileName);
      if(url){ok++;}else{fail++;}
    }
    setUploadMsg("완료: "+ok+"장 업로드"+( fail>0?" (실패 "+fail+"장)":""));
    /* 업로드된 선수 이름들 전역 캐시 초기화 (새 사진 즉시 반영) */
    for(var j=0;j<files.length;j++){
      var uploadedBase=files[j].name.replace(/\.[^.]+$/,"").replace(/\d+$/,"");
      if(uploadedBase){ delete PHOTO_CACHE[uploadedBase]; }
    }
    /* Supabase 인덱싱 대기 후 목록 갱신 */
    await new Promise(function(r){ setTimeout(r, 1500); });
    await loadPhotos();
    setUploading(false);
  };

  /* 사진 삭제 */
  var handlePhotoDelete=async function(ph){
    if(!confirm("\""+ph.name+"\" 삭제?"))return;
    /* storageName(인코딩된 실제 파일명)으로 삭제 */
    await deletePlayerPhoto(ph.storageName||ph.name);
    /* 해당 선수 전역 캐시 초기화 */
    if(ph.baseName) { delete PHOTO_CACHE[ph.baseName]; }
    await loadPhotos();
  };

  /* 사진을 이름 기준으로 그룹화 */
  var photoGroups=allPhotos.reduce(function(acc,ph){
    if(!acc[ph.baseName])acc[ph.baseName]=[];
    acc[ph.baseName].push(ph);
    return acc;
  },{});
  var players=SEED_PLAYERS;
  var filtered=players.filter(function(x){return x.cardType===at;});

  var genUUID=function(){return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);});};

  var newP=function(role){
    var base={id:genUUID(),cardType:at,role:role,name:"",year:"",hand:"우",stars:CARD_STARS[at]||5,subPosition:role==="타자"?"RF":"SP1"};
    if(role==="타자"){Object.assign(base,{power:0,accuracy:0,eye:0,patience:0,running:0,defense:0,launchAngle:0,hotColdZone:0,subPosition:""});}
    else{Object.assign(base,{position:"선발",change:0,stuff:0,speed:0,control:0,stamina:0,defense:0});}
    setForm(base);setEditing("new");
  };

  var editP=function(pl){setForm(Object.assign({},pl));setEditing(pl.id);};
  var uf=function(k,v){setForm(function(prev){var c=Object.assign({},prev);c[k]=v;return c;});};

  var saveF=async function(){
    if(!form||!form.name)return;
    setSaving(true);
    var ok=await saveGlobalPlayer(form);
    if(ok){
      var idx=SEED_PLAYERS.findIndex(function(x){return x.id===form.id;});
      if(idx>=0){SEED_PLAYERS[idx]=form;}else{SEED_PLAYERS.push(form);}
      setReload(function(r){return r+1;});
    }
    setSaving(false);setEditing(null);setForm(null);
  };
  var delP=async function(id){
    var ok=await deleteGlobalPlayer(id);
    if(ok){var idx=SEED_PLAYERS.findIndex(function(x){return x.id===id;});if(idx>=0)SEED_PLAYERS.splice(idx,1);}
    setReload(function(r){return r+1;});setEditing(null);setForm(null);
  };

  return(
    <div style={{padding:mob?12:18,maxWidth:1000,paddingBottom:mob?80:18}}>
      <h2 style={{fontSize:mob?16:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 4px"}}>{"선수 도감"}</h2>
      <p style={{fontSize:10,color:"var(--td)",margin:"0 0 12px"}}>{"관리자 전용 - 선수 기본 데이터를 등록/수정합니다"}</p>

      {/* 탭 선택 */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {["선수","사진 관리"].map(function(t){var a=t===dbTab;return(
          <button key={t} onClick={function(){setDbTab(t);}} style={{padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",color:a?"var(--acc)":"var(--t2)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{t}</button>
        );})}
      </div>

      {/* ── 사진 관리 탭 ── */}
      {dbTab==="사진 관리" && (
        <div>
          {/* 업로드 영역 */}
          <div style={{background:"var(--card)",borderRadius:12,border:"2px dashed var(--bd)",padding:24,textAlign:"center",marginBottom:16,cursor:"pointer"}}
            onDragOver={function(e){e.preventDefault();}}
            onDrop={function(e){e.preventDefault();handlePhotoUpload(e.dataTransfer.files);}}>
            <div style={{fontSize:28,marginBottom:8}}>{"📸"}</div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{"사진 파일을 드래그하거나 클릭해서 업로드"}</div>
            <div style={{fontSize:11,color:"var(--td)",marginBottom:12}}>{"파일명: 이승엽1.jpg, 이승엽2.jpg 형식 | 200×280px 권장 | JPG/PNG/WebP"}</div>
            <label style={{display:"inline-block",padding:"8px 20px",background:"var(--ta)",border:"1px solid var(--acc)",borderRadius:8,cursor:"pointer",fontSize:12,fontWeight:700,color:"var(--acc)"}}>
              {"파일 선택 (여러 장 가능)"}
              <input type="file" multiple accept="image/*" style={{display:"none"}} onChange={function(e){handlePhotoUpload(e.target.files);e.target.value="";}} />
            </label>
            {uploading && <div style={{marginTop:10,fontSize:11,color:"var(--acc)"}}>{"업로드 중..."}</div>}
            {uploadMsg && <div style={{marginTop:10,fontSize:11,color:"#66BB6A",fontWeight:700}}>{uploadMsg}</div>}
          </div>

          {/* 등록된 사진 목록 */}
          <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:800,color:"var(--t1)"}}>{"등록된 사진 ("+allPhotos.length+"장)"}</span>
              <button onClick={loadPhotos} style={{padding:"4px 10px",fontSize:11,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",cursor:"pointer"}}>{"새로고침"}</button>
            </div>
            {photoLoading && <div style={{fontSize:11,color:"var(--td)",padding:20,textAlign:"center"}}>{"로딩 중..."}</div>}
            {!photoLoading && Object.keys(photoGroups).length===0 && (
              <div style={{fontSize:11,color:"var(--td)",padding:20,textAlign:"center"}}>{"등록된 사진이 없습니다"}</div>
            )}
            {!photoLoading && Object.keys(photoGroups).sort().map(function(name){
              var photos=photoGroups[name];
              var curPos = posMap[name]!==undefined ? posMap[name] : 20;
              return(
                <div key={name} style={{marginBottom:16}}>
                  <div style={{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:8,paddingBottom:4,borderBottom:"1px solid var(--bd)"}}>{name+" ("+photos.length+"장)"}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
                    {photos.map(function(ph){return(
                      <div key={ph.name} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{position:"relative"}}>
                          <img src={ph.url} alt={ph.name} style={{width:60,height:84,objectFit:"cover",objectPosition:"center "+curPos+"%",borderRadius:6,border:"1px solid var(--bd)"}} />
                          <button onClick={function(){handlePhotoDelete(ph);}}
                            style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#EF5350",border:"none",cursor:"pointer",fontSize:10,color:"#fff",fontWeight:900,lineHeight:"18px",textAlign:"center",padding:0}}>{"×"}</button>
                        </div>
                        <span style={{fontSize:9,color:"var(--td)",maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ph.name}</span>
                      </div>
                    );})}
                  </div>
                  {/* 위치 슬라이더 */}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,color:"var(--td)",flexShrink:0,width:28}}>{"위치"}</span>
                    <input type="range" min={0} max={100} value={curPos}
                      onChange={function(e){
                        var v=parseInt(e.target.value);
                        var nm=Object.assign({},posMap); nm[name]=v; setPosMap(nm);
                      }}
                      onMouseUp={function(e){
                        var v=parseInt(e.target.value);
                        var nm=Object.assign({},posMap); nm[name]=v; savePosMap(nm);
                      }}
                      onTouchEnd={function(e){
                        var v=parseInt(e.target.value);
                        var nm=Object.assign({},posMap); nm[name]=v; savePosMap(nm);
                      }}
                      style={{flex:1,accentColor:"var(--acc)",cursor:"pointer"}} />
                    <span style={{fontSize:10,color:"var(--acc)",fontFamily:"var(--m)",width:32,flexShrink:0,textAlign:"right"}}>{curPos+"%"}</span>
                    {posSaving&&<span style={{fontSize:9,color:"var(--td)"}}>{"저장중"}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 선수 탭 ── */}
      {dbTab==="선수" && (<React.Fragment>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>
        {CARD_TYPES.map(function(ct){var a=ct===at;return(
          <button key={ct} onClick={function(){setAt(ct);setEditing(null);setForm(null);}} style={{padding:"7px 14px",borderRadius:6,fontSize:12,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",color:a?"var(--acc)":"var(--t2)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{ct}</button>
        );})}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={function(){newP("타자");}} style={{padding:"8px 16px",borderRadius:6,fontSize:12,fontWeight:700,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",color:"#1a1100",border:"none",cursor:"pointer"}}>{"+ 타자"}</button>
        <button onClick={function(){newP("투수");}} style={{padding:"8px 16px",borderRadius:6,fontSize:12,fontWeight:700,background:"linear-gradient(135deg,#CE93D8,#7B1FA2)",color:"#fff",border:"none",cursor:"pointer"}}>{"+ 투수"}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:editing?(mob?"1fr":"1fr 340px"):"1fr",gap:14}}>
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden"}}>
          <SH title={at+" ("+filtered.length+"명)"} icon="📋" count={filtered.length} color="#FFD54F" />
          {filtered.length===0?(<div style={{padding:24,textAlign:"center",color:"var(--td)",fontSize:12}}>{"등록된 선수가 없습니다"}</div>):
          filtered.map(function(pl){var isBat=pl.role==="타자";var isA=editing===pl.id;return(
            <div key={pl.id} onClick={function(){editP(pl);}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:isA?"var(--ta)":"transparent",borderBottom:"1px solid var(--bd)",cursor:"pointer",borderLeft:isA?"3px solid var(--acc)":"3px solid transparent"}}>
              <div style={{width:36,height:48,borderRadius:4,background:"var(--inner)",border:"1px solid var(--bd)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:14,opacity:0.4}}>{"⚾"}</span><span style={{fontSize:7,color:"var(--td)",fontWeight:700}}>{pl.subPosition}</span></div>
              <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4}}><Badge type={pl.cardType}/><span style={{fontWeight:700,color:"var(--t1)",fontSize:13}}>{pl.name}</span></div><div style={{fontSize:9,color:"var(--td)",marginTop:2}}>{isBat?(pl.hand+"타 · 파"+pl.power+" 정"+pl.accuracy+" 선"+pl.eye):(pl.hand+"투 · 변"+pl.change+" 구"+pl.stuff)}</div></div>
              <div style={{fontSize:10,color:"var(--td)"}}>{pl.year}</div>
            </div>
          );})}
        </div>

        {editing&&form&&(
          <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:16,alignSelf:"flex-start"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:14,fontWeight:800,color:"var(--t1)",fontFamily:"var(--h)"}}>{editing==="new"?"새 선수":"수정"}</span>
              <button onClick={function(){setEditing(null);setForm(null);}} style={{background:"none",border:"none",color:"var(--td)",cursor:"pointer",fontSize:16}}>{"✕"}</button>
            </div>
            <Inp label="이름" value={form.name} onChange={function(v){uf("name",v);}} ph="구자욱24" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="연도" value={form.year} onChange={function(v){uf("year",v);}} ph="2024" />
              <Inp label="팀" type="select" value={form.team||""} onChange={function(v){uf("team",v);}} options={["","기아","키움","삼성","LG","KT","한화","SSG","롯데","NC","두산"]} />
              <Inp label="손잡이" type="select" value={form.hand} onChange={function(v){uf("hand",v);}} options={form.role==="투수"?["우","좌"]:["우","좌","양"]} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {CARD_STARS_SELECTABLE[form.cardType]?(<Inp label={form.cardType==="골든글러브"?"별(4~5)":"별(1~5)"} type="select" value={String(form.stars||(CARD_STARS[form.cardType]||5))} onChange={function(v){uf("stars",parseInt(v));}} options={form.cardType==="골든글러브"?["4","5"]:["1","2","3","4","5"]} />):(<div><div style={{fontSize:10,color:"var(--td)",marginBottom:4}}>{"별"}</div><span style={{fontSize:14,color:"var(--acc)"}}>{"★"+(CARD_STARS[form.cardType]||5)}</span></div>)}
              {form.role==="타자"?(<Inp label="포지션" type="select" value={form.subPosition} onChange={function(v){uf("subPosition",v);}} options={BAT_POS} />):(<Inp label="역할" type="select" value={form.position||"선발"} onChange={function(v){uf("position",v);uf("subPosition",(PIT_POS_MAP[v]||["SP1"])[0]);}} options={["선발","중계","마무리"]} />)}
            </div>
            {form.role==="타자"&&null}
            {form.cardType==="임팩트"&&(<Inp label="종류" value={form.impactType||""} onChange={function(v){uf("impactType",v);}} ph="좌완에이스,안방마님..." />)}
            {form.cardType==="라이브"&&(<Inp label="세트덱스코어" type="number" value={form.setScore||0} onChange={function(v){uf("setScore",parseInt(v)||0);}} />)}
            {form.cardType==="라이브"&&(<Inp label="라이브종류" type="select" value={form.liveType||""} onChange={function(v){uf("liveType",v);}} options={["","V1","V2","V3"]} />)}
            <div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <Inp label="사진" value={form.photoUrl||""} onChange={function(v){uf("photoUrl",v);}} ph="URL 또는 파일 선택" />
                  <label style={{cursor:"pointer",padding:"4px 8px",background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,fontSize:10,color:"var(--t2)",marginTop:14,whiteSpace:"nowrap"}}>
                    {"📁 파일"}
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){uf("photoUrl",r.result);};r.readAsDataURL(f);}} />
                  </label>
                </div>
                {form.photoUrl&&(<img src={form.photoUrl} alt="" style={{width:60,height:80,objectFit:"cover",borderRadius:4,marginTop:4,border:"1px solid var(--bd)"}} />)}
              </div>
            <div style={{fontSize:11,fontWeight:700,color:"var(--t2)",marginTop:8,marginBottom:6}}>{"기본 능력치"}</div>
            {form.role==="타자"?(
              <React.Fragment>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <Inp label="파워" type="number" value={form.power} onChange={function(v){uf("power",parseInt(v)||0);}} mb={6} />
                  <Inp label="정확" type="number" value={form.accuracy} onChange={function(v){uf("accuracy",parseInt(v)||0);}} mb={6} />
                  <Inp label="선구" type="number" value={form.eye} onChange={function(v){uf("eye",parseInt(v)||0);}} mb={6} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <Inp label="인내" type="number" value={form.patience||0} onChange={function(v){uf("patience",parseInt(v)||0);}} mb={6} />
                  <Inp label="주루" type="number" value={form.running||0} onChange={function(v){uf("running",parseInt(v)||0);}} mb={6} />
                  <Inp label="수비" type="number" value={form.defense||0} onChange={function(v){uf("defense",parseInt(v)||0);}} mb={6} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <Inp label="발사각" type="number" value={form.launchAngle||0} onChange={function(v){uf("launchAngle",parseInt(v)||0);}} mb={6} />
                  <Inp label="핫콜존" type="number" value={form.hotColdZone||0} onChange={function(v){uf("hotColdZone",parseInt(v)||0);}} mb={6} />
                </div>
              </React.Fragment>
            ):(
              <React.Fragment>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <Inp label="변화" type="number" value={form.change} onChange={function(v){uf("change",parseInt(v)||0);}} mb={6} />
                  <Inp label="구위" type="number" value={form.stuff} onChange={function(v){uf("stuff",parseInt(v)||0);}} mb={6} />
                  <Inp label="구속" type="number" value={form.speed||0} onChange={function(v){uf("speed",parseInt(v)||0);}} mb={6} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  <Inp label="제구" type="number" value={form.control||0} onChange={function(v){uf("control",parseInt(v)||0);}} mb={6} />
                  <Inp label="지구력" type="number" value={form.stamina||0} onChange={function(v){uf("stamina",parseInt(v)||0);}} mb={6} />
                  <Inp label="수비" type="number" value={form.defense||0} onChange={function(v){uf("defense",parseInt(v)||0);}} mb={6} />
                </div>
              </React.Fragment>
            )}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button onClick={saveF} style={{flex:1,padding:"10px 0",borderRadius:6,fontSize:13,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",color:"#1a1100",border:"none",cursor:"pointer"}}>{"저장"}</button>
              {editing!=="new"&&(<button onClick={function(){delP(form.id);}} style={{padding:"10px 16px",borderRadius:6,fontSize:12,background:"rgba(239,83,80,0.1)",color:"#EF5350",border:"1px solid rgba(239,83,80,0.3)",cursor:"pointer"}}>{"삭제"}</button>)}
            </div>
          </div>
        )}
      </div>

      {/* 도감 엑셀 관리 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>{"📊"}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--acc)", fontFamily: "var(--h)" }}>{"도감 엑셀 관리"}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 140, padding: "12px", background: "linear-gradient(135deg,rgba(255,213,79,0.08),rgba(255,213,79,0.02))", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left", display: "block" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--acc)" }}>{"📊 엑셀 가져오기"}</div>
            <div style={{ fontSize: 9, color: "var(--td)", marginTop: 4 }}>{"양식 업로드 → 도감 반영"}</div>
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={function(e) {
              var f2 = e.target.files[0]; if (!f2) return;
              var rd = new FileReader(); rd.onload = function() {
                try {
                  var XL = window.XLSX; if (!XL) { alert("잠시 후 다시 시도하세요."); return; }
                  var wb2 = XL.read(rd.result, { type: "array" });
                  var added2 = 0; var updated2 = 0; var np = SEED_PLAYERS.slice();
                  var cm = {"골든글러브(타자)":"골든글러브","골든글러브(투수)":"골든글러브","시그니처(타자)":"시그니처","시그니처(투수)":"시그니처","국가대표(타자)":"국가대표","국가대표(투수)":"국가대표","임팩트(타자)":"임팩트","임팩트(투수)":"임팩트","라이브(타자)":"라이브","라이브(투수)":"라이브","시즌(타자)":"시즌","시즌(투수)":"시즌","올스타(타자)":"올스타","올스타(투수)":"올스타"};
                  var sm = {"골든글러브":5,"시그니처":5,"국가대표":5,"임팩트":4};
                  wb2.SheetNames.forEach(function(sn2) { if (sn2==="안내"||sn2==="임팩트종류") return; var ct2=cm[sn2]; if(!ct2)return; var iB=sn2.indexOf("타자")>=0;
                    XL.utils.sheet_to_json(wb2.Sheets[sn2],{defval:""}).forEach(function(row) {
                      var nm=String(row["이름"]||"").trim(); if(!nm)return;
                      var yr=String(row["연도"]||""); var it=String(row["임팩트종류"]||""); var tm=String(row["팀"]||""); var ex=null;
                      for(var i=0;i<np.length;i++){
                        var sp=np[i];
                        if((sp.name||"")!==nm||sp.cardType!==ct2)continue;
                        if(ct2==="임팩트"){if((sp.impactType||"")===it&&(sp.team||"")===tm){ex=i;break;}}
                        else if(ct2==="라이브"){var lt2=String(row["라이브종류"]||"");if(String(sp.year||"")===yr&&(sp.liveType||"")===lt2&&(sp.team||"")===tm){ex=i;break;}}
                        else{if(String(sp.year||"")===yr&&(sp.team||"")===tm){ex=i;break;}}
                      }
                      var pl2=ex!==null?Object.assign({},np[ex]):{id:"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&0x3|0x8)).toString(16);})};
                      pl2.cardType=ct2;pl2.name=nm;pl2.year=yr;pl2.team=row["팀"]||"";pl2.hand=row["손잡이"]||"우";pl2.role=iB?"타자":"투수";pl2.stars=row["별"]?parseInt(row["별"]):(sm[ct2]||5);
                      if(iB){pl2.subPosition=row["세부포지션"]||"DH";pl2.power=parseInt(row["파워"])||0;pl2.accuracy=parseInt(row["정확"])||0;pl2.eye=parseInt(row["선구"])||0;}
                      else{var pos=row["역할"]||"선발";if(pos==="중간계투")pos="중계";pl2.position=pos;pl2.subPosition=pl2.subPosition||"SP1";pl2.speed=parseInt(row["구속"])||0;pl2.change=parseInt(row["변화"])||0;pl2.stuff=parseInt(row["구위"])||0;}
                      if(ct2==="임팩트")pl2.impactType=row["임팩트종류"]||"";
                      if(ct2==="라이브"){pl2.setScore=parseInt(row["세트덱스코어"])||0;pl2.liveType=row["라이브종류"]||"";}
                      if(ex!==null){np[ex]=pl2;updated2++;}else{np.push(pl2);added2++;}
                    });
                  });
                  SEED_PLAYERS.length=0;np.forEach(function(pp){SEED_PLAYERS.push(pp);});
                  /* 배치 저장: 100명씩 묶어서 순차 저장 */
                  (async function() {
                    var batchSize = 100;
                    for (var i = 0; i < np.length; i += batchSize) {
                      var batch = np.slice(i, i + batchSize);
                      await saveGlobalPlayers(batch);
                    }
                    alert("완료! 추가:"+added2+"명 업데이트:"+updated2+"명");
                  })();
                } catch(err) { alert("오류: "+err.message); }
              }; rd.readAsArrayBuffer(f2); e.target.value="";
            }} />
          </label>
          <button onClick={function() {
            var XL=window.XLSX; if(!XL){alert("잠시 후 다시 시도하세요.");return;}
            var wb3=XL.utils.book_new(); var cts=["골든글러브","시그니처","국가대표","임팩트","라이브","시즌","올스타"]; var sm2={"골든글러브":5,"시그니처":5,"국가대표":5,"임팩트":4};
            cts.forEach(function(ct3){["타자","투수"].forEach(function(role2){
              var pls2=SEED_PLAYERS.filter(function(x){return x.cardType===ct3&&x.role===role2;});
              var rows2=pls2.map(function(pl3){
                var rw={"팀":pl3.team||"","이름":(pl3.name||"").replace(/[0-9]/g,""),"연도":pl3.year||"","손잡이":pl3.hand||""};
                if(role2==="타자"){rw["세부포지션"]=pl3.subPosition||"";rw["파워"]=pl3.power||0;rw["정확"]=pl3.accuracy||0;rw["선구"]=pl3.eye||0;}
                else{rw["역할"]=pl3.position||"선발";rw["구속"]=pl3.speed||0;rw["변화"]=pl3.change||0;rw["구위"]=pl3.stuff||0;}
                if(ct3==="임팩트")rw["임팩트종류"]=pl3.impactType||"";
                if(!sm2[ct3]||ct3==="골든글러브")rw["별"]=pl3.stars||(CARD_STARS[ct3]||5);
                if(ct3==="라이브"){rw["세트덱스코어"]=pl3.setScore||0;rw["라이브종류"]=pl3.liveType||"";}
                return rw;
              });
              XL.utils.book_append_sheet(wb3,XL.utils.json_to_sheet(rows2.length>0?rows2:[{}]),ct3+"("+role2+")");
            });});
            XL.writeFile(wb3,"선수도감_"+new Date().toISOString().slice(0,10)+".xlsx");
          }} style={{ flex: 1, minWidth: 140, padding: "12px", background: "linear-gradient(135deg,rgba(206,147,216,0.08),rgba(206,147,216,0.02))", border: "1px solid rgba(206,147,216,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--acp)" }}>{"📋 엑셀 내보내기"}</div>
            <div style={{ fontSize: 9, color: "var(--td)", marginTop: 4 }}>{"현재 도감 → 엑셀 다운로드"}</div>
          </button>
        </div>
      </div>
      </React.Fragment>)}{/* 선수 탭 끝 */}
    </div>
  );
}

/* ================================================================
   LINEUP PAGE
   ================================================================ */
/* ================================================================
   DIAMOND VIEW
   ================================================================ */
function DiamondView(p) {
  var mob = p.mobile;
  var slotMap = p.slotMap || {};
  var onClick = p.onSlotClick;
  var pc = {"C":{x:50,y:90},"1B":{x:82,y:62},"2B":{x:63,y:44},"3B":{x:18,y:62},"SS":{x:37,y:44},"LF":{x:14,y:20},"CF":{x:50,y:8},"RF":{x:86,y:20},"DH":{x:93,y:90}};
  var ALL_POS = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: mob ? 340 : 440, aspectRatio: "1.05", margin: "0 auto" }}>
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.1 }}>
        <polygon points="50,18 82,50 50,82 18,50" fill="none" stroke="#4CAF50" strokeWidth="0.4" />
        <circle cx="50" cy="82" r="2" fill="#4CAF50" opacity="0.5" />
        <circle cx="82" cy="50" r="1.5" fill="#4CAF50" opacity="0.5" />
        <circle cx="50" cy="18" r="1.5" fill="#4CAF50" opacity="0.5" />
        <circle cx="18" cy="50" r="1.5" fill="#4CAF50" opacity="0.5" />
      </svg>
      {ALL_POS.map(function(pos) {
        var co = pc[pos];
        var b = slotMap[pos] || null;
        return (
          <div key={pos} onClick={onClick ? function() { onClick(pos); } : undefined} style={{ position: "absolute", left: co.x + "%", top: co.y + "%", transform: "translate(-50%,-50%)", textAlign: "center", cursor: onClick ? "pointer" : "default" }}>
            {b ? (<PlayerCard player={Object.assign({},b,{photoUrl:b.photoUrl||getPhotoUrl(b.name)})} size={mob?"sm":"sm"} showPhoto={true} />) : (
              <div style={{ width: mob?46:52, height: mob?64:72, borderRadius: 5, background: "var(--inner)", border: "1px dashed var(--bd)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: mob?12:14, opacity: 0.2 }}>{"+"}</span>
                <span style={{ fontSize: mob?7:8, color: "var(--td)", fontWeight: 700 }}>{pos}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   PITCHER CARD (for roster panel)
   ================================================================ */
function PCard(p) {
  var d = p.p;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <PlayerCard player={Object.assign({},d,{photoUrl:d.photoUrl||getPhotoUrl(d.name)})} size="md" showPhoto={true} />
    </div>
  );
}

/* ================================================================
   BULLPEN DROPDOWN + LAYOUT
   ================================================================ */
function getPotmBonus(pl, sdState) {
  var potmList = sdState.potmList || [];
  if (!potmList.length || !pl) return 0;
  var dbId = pl.dbId || pl.id;
  var isPotm = false;
  for (var i = 0; i < potmList.length; i++) {
    if (potmList[i].name === (pl.name||"") && potmList[i].team === (pl.team||"")) { isPotm = true; break; }
  }
  if (!isPotm) return 0;
  var ct = pl.cardType;
  var stars = pl.stars || 5;
  var teamName = sdState.teamName || "";
  /* 내 덱 팀명과 POTM 팀명이 다르면 적용 안 함 */
  var potmEntry = potmList.find(function(p){ return p.name===(pl.name||"") && p.team===(pl.team||""); });
  if (teamName && potmEntry && potmEntry.team && potmEntry.team !== teamName) return 0;
  var teamMatch = !teamName || !pl.team || pl.team === teamName;
  var isLive = ct === "라이브";
  var isOlstar = ct === "올스타";
  if (isLive) {
    var b = stars >= 5 ? 6 : stars === 4 ? 12 : 16;
    return teamMatch ? b : Math.round(b * 0.5);
  }
  if (isOlstar && stars === 5) { return teamMatch ? 6 : 3; }
  if (!teamMatch) return 0;
  return {"임팩트":2,"시그니처":2,"국가대표":2,"골든글러브":1}[ct] || 0;
}

var BPC = [{label:"1/1/4",w:1,l:1,r:4},{label:"1/2/3",w:1,l:2,r:3},{label:"1/3/2",w:1,l:3,r:2},{label:"2/1/3",w:2,l:1,r:3},{label:"2/2/2",w:2,l:2,r:2},{label:"2/3/1",w:2,l:3,r:1},{label:"3/1/2",w:3,l:1,r:2},{label:"3/2/1",w:3,l:2,r:1},{label:"3/3/0",w:3,l:3,r:0},{label:"2/4/0",w:2,l:4,r:0}];
var RP_WEIGHTS = [
  {w:[1.30],          l:[1.10],                   r:[0.40,0.10,0.08,0.02]},
  {w:[1.20],          l:[0.80,0.60],              r:[0.20,0.12,0.08]},
  {w:[1.20],          l:[0.80,0.50,0.10],         r:[0.30,0.10]},
  {w:[0.90,0.60],     l:[1.00],                   r:[0.30,0.12,0.08]},
  {w:[0.90,0.60],     l:[0.70,0.40],              r:[0.30,0.10]},
  {w:[0.90,0.60],     l:[0.70,0.30,0.10],         r:[0.40]},
  {w:[0.80,0.60,0.20],wSplit:[0.20,0.50,0.90],l:[1.00],          r:[0.30,0.10]},
  {w:[0.80,0.60,0.20],wSplit:[0.20,0.50,0.90],l:[0.60,0.40],     r:[0.40]},
  {w:[0.80,0.60,0.20],wSplit:[0.20,0.50,0.90],l:[0.70,0.50,0.20],r:[]},
  {w:[0.90,0.60],     l:[0.80,0.50,0.15,0.05],   r:[]},
];
function getRPWeight(bpcIdx, slot, isWinSplit) {
  var cfg = BPC[bpcIdx]; var wts = RP_WEIGHTS[bpcIdx];
  if (!cfg || !wts) return 0;
  var rpSlots = ["RP1","RP2","RP3","RP4","RP5","RP6"];
  var si = rpSlots.indexOf(slot); if (si < 0) return 0;
  if (si < cfg.w) { var wArr = (isWinSplit && wts.wSplit) ? wts.wSplit : wts.w; return wArr[si] || 0; }
  if (si < cfg.w + cfg.l) return wts.l[si - cfg.w] || 0;
  return (wts.r[si - cfg.w - cfg.l] || 0);
}

function BullpenLayout(p) {
  var mob = p.mobile;
  var rps = p.relievers;
  var cps = p.closers;
  var rpSlots = p.rpSlots || [];
  var onSlotClick = p.onSlotClick;
  var idx = p.bpcIdx !== undefined ? p.bpcIdx : 4;
  var setIdx = p.setBpcIdx || function(){};
  var isWinSplit = p.isWinSplit || false;
  var setIsWinSplit = p.setIsWinSplit || function(){};
  var _o = useState(false); var open = _o[0]; var setOpen = _o[1];
  var cfg = BPC[idx];
  var cs = { flex: 1, minWidth: 0, background: "var(--inner)", borderRadius: 6, padding: "6px 2px", border: "1px solid var(--bd)" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", letterSpacing: 0.5 }}>{"불펜 편성"}</span>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <button onClick={function() { setIdx(idx <= 0 ? BPC.length - 1 : idx - 1); }} style={{ width: 28, height: 28, borderRadius: "6px 0 0 6px", background: "var(--inner)", border: "1px solid var(--bd)", borderRight: "none", color: "var(--t2)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{"◀"}</button>
          <button onClick={function() { setOpen(!open); }} style={{ width: 80, height: 28, background: "var(--inner)", border: "1px solid var(--bd)", borderLeft: "none", borderRight: "none", color: "var(--acc)", cursor: "pointer", fontSize: 13, fontWeight: 800, fontFamily: "var(--m)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{cfg.label}<span style={{ fontSize: 7, color: "var(--td)" }}>{open ? "▲" : "▼"}</span></button>
          <button onClick={function() { setIdx(idx >= BPC.length - 1 ? 0 : idx + 1); }} style={{ width: 28, height: 28, borderRadius: "0 6px 6px 0", background: "var(--inner)", border: "1px solid var(--bd)", borderLeft: "none", color: "var(--t2)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{"▶"}</button>
          {open && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 4, background: "#141a24", border: "1px solid var(--bd)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.6)", width: 170 }}>
              {BPC.map(function(c, i) {
                var act = i === idx;
                return (<button key={c.label} onClick={function() { setIdx(i); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 14px", background: act ? "var(--ta)" : "transparent", border: "none", borderBottom: "1px solid var(--bd)", color: act ? "var(--acc)" : "var(--t2)", cursor: "pointer", fontSize: 12, fontFamily: "var(--m)", fontWeight: act ? 800 : 500, textAlign: "left" }}><span>{c.label}</span><span style={{ fontSize: 9, color: "var(--td)" }}>{"승" + c.w + " 패" + c.l + " 롱" + c.r}</span></button>);
              })}
            </div>
          )}
        </div>
        {cfg.w === 3 && (
          <button onClick={function() { setIsWinSplit(!isWinSplit); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: isWinSplit ? "#1565C0" : "var(--inner)", color: isWinSplit ? "#fff" : "var(--t2)", border: "1px solid " + (isWinSplit ? "#1565C0" : "var(--bd)"), cursor: "pointer" }}>{"분업" + (isWinSplit ? " ON" : "")}</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
        {[
          { label: "승리조", count: cfg.w, color: "#4CAF50", slots: rpSlots.slice(0, cfg.w) },
          { label: "패전조", count: cfg.l, color: "#FF7043", slots: rpSlots.slice(cfg.w, cfg.w + cfg.l) },
          { label: "롱릴리프", count: cfg.r, color: "#42A5F5", slots: rpSlots.slice(cfg.w + cfg.l) },
          { label: "마무리", count: cps.length, color: "#EF5350", slots: [{ slot: "CP", pl: cps[0] || null }] },
        ].map(function(col) {
          return (
            <div key={col.label} style={cs}>
              <div style={{ fontSize: 9, fontWeight: 700, color: col.color, letterSpacing: 1, marginBottom: 4, textAlign: "center" }}>{col.label + " (" + col.count + ")"}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {col.slots.map(function(s) {
                  if (s.pl) {
                    return (<div key={s.slot} onClick={onSlotClick ? function() { onSlotClick(s.slot); } : undefined} style={{ cursor: onSlotClick ? "pointer" : "default" }}><PCard p={s.pl} /></div>);
                  }
                  return (<div key={s.slot} onClick={onSlotClick ? function() { onSlotClick(s.slot); } : undefined} style={{ width: 52, height: 72, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--re)" }}><span style={{ fontSize: 9, color: "var(--td)" }}>{s.slot}</span></div>);
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   SET DECK SYSTEM
   ================================================================ */
var SET_POINTS = {"골든글러브":6,"시그니처":8,"임팩트":7,"국가대표":8,"시즌":0,"라이브":0,"올스타":4};
var CARD_STARS = {"골든글러브":5,"시그니처":5,"임팩트":4,"국가대표":5};
var CARD_STARS_SELECTABLE = {"골든글러브":true,"라이브":true};

/* Complete set deck rules: L/R radio selection */
var SD_ROWS = [
  {sp:30,type:"auto",desc:"모두 +1"},
  {sp:40,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:50,type:"lr",lDesc:"시즌/라이브 +1",rDesc:"골든/시그/임팩/국대 +1"},
  {sp:55,type:"yearR",rDesc:"투수 변화: 임팩트+2, 연도매치+2"},
  {sp:60,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:65,type:"lr",lDesc:"3성 +2",rDesc:"4성 타자 정확 +2"},
  {sp:70,type:"lr",lDesc:"선발 +1",rDesc:"불펜+마무리 +2"},
  {sp:75,type:"yearLR",lDesc:"타자 파정 +3 (연도선택)",rDesc:"투수 구위 +3 (연도선택)"},
  {sp:80,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:85,type:"lr",lDesc:"4성 +2",rDesc:"5성 파구 +1"},
  {sp:90,type:"auto",desc:"모두 +2"},
  {sp:95,type:"auto",desc:"RF/CF/LF/DH 선구 +2"},
  {sp:100,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:105,type:"lr",lDesc:"3성 +2",rDesc:"4성 타자 파선 +2 & 투수 변구 +2"},
  {sp:110,type:"auto",desc:"모두 +1"},
  {sp:115,type:"lr",lDesc:"6~9번 정확 +2",rDesc:"불펜+마무리 구위 +2"},
  {sp:120,type:"lr",lDesc:"3~5번 +2",rDesc:"투수 +1"},
  {sp:125,type:"auto",desc:"4성 정선 +2 & 변화 +2"},
  {sp:130,type:"lr",lDesc:"시즌/라이브 +1",rDesc:"골든/시그/임팩/국대 +1"},
  {sp:135,type:"lr",lDesc:"3~5번 정확 +2",rDesc:"선발 구위 +1"},
  {sp:140,type:"lr",lDesc:"6~9번 +1",rDesc:"불펜+마무리 +1"},
  {sp:145,type:"lr",lDesc:"1~2번 정선 +2",rDesc:"선발 구위 +1"},
  {sp:150,type:"auto",desc:"모두 +2"},
  {sp:155,type:"lr",lDesc:"1~2번 파선 +2",rDesc:"선발 변화 +1"},
  {sp:160,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:165,type:"lr",lDesc:"타자 정확 +1",rDesc:"투수 변화 +1"},
  {sp:170,type:"auto",desc:"모두 +1"},
  {sp:175,type:"lr",lDesc:"타자 파선 +1",rDesc:"구위 +1"},
  {sp:180,type:"lrYear",lDesc:"라이브 +2",rDesc:"전체 연도 +1"},
  {sp:185,type:"lrYear",lDesc:"1~2번 파워 +2",rDesc:"타자 연도 +1"},
  {sp:190,type:"lrYear",lDesc:"선발 구위 +1",rDesc:"투수 연도 +1"},
  {sp:195,type:"lr",lDesc:"라이브/국대 +1",rDesc:"시그니처 +1"},
  {sp:200,type:"lr",lDesc:"타자 +2",rDesc:"투수 +2"},
];

function SetDeckPanel(p) {
  var open = p.open;
  var onClose = p.onClose;
  var mob = p.mobile;
  var setPoint = p.setPoint || 0;
  var sdState = p.sdState;
  var setSdState = p.setSdState;

  var upd = function(key, val) {
    setSdState(function(prev) { var c = Object.assign({}, prev); c[key] = val; return c; });
  };

  var totalSP = setPoint + (sdState.liveSetPo || 0);

  /* Count active bonuses */
  var activeCount = 0;
  SD_ROWS.forEach(function(r) {
    if (totalSP < r.sp) return;
    if (r.type === "auto") { activeCount++; return; }
    var k = "s" + r.sp;
    var v = sdState[k];
    if (v === "L" || v === "R" || (typeof v === "string" && v.length === 4)) activeCount++;
  });

  var radioStyle = function(active, selected, side) {
    var baseC = side === "L" ? "#FFD54F" : "#CE93D8";
    return {
      flex: 1, padding: "6px 4px", fontSize: 10, fontWeight: selected ? 700 : 400,
      background: selected ? baseC + "18" : "transparent",
      border: selected ? "1px solid " + baseC + "55" : "1px solid var(--bd)",
      borderRadius: side === "L" ? "6px 0 0 6px" : "0 6px 6px 0",
      color: !active ? "var(--td)" : (selected ? baseC : "var(--t2)"),
      cursor: active ? "pointer" : "default", textAlign: "center",
      opacity: active ? 1 : 0.35, lineHeight: 1.3, minHeight: 32,
      display: "flex", alignItems: "center", justifyContent: "center"
    };
  };

  var renderRow = function(r) {
    var active = totalSP >= r.sp;
    var k = "s" + r.sp;
    var val = sdState[k] || "";

    if (r.type === "auto") {
      return (
        <div key={k} style={{ padding: "5px 14px", display: "flex", alignItems: "center", gap: 8, opacity: active ? 1 : 0.35 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? "#4CAF50" : "var(--bd)", flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: active ? "#4CAF50" : "var(--td)", fontWeight: 700, fontFamily: "var(--m)" }}>{r.sp}</span>
          <span style={{ fontSize: 10, color: active ? "var(--t1)" : "var(--td)" }}>{r.desc}</span>
          {active && (<span style={{ marginLeft: "auto", fontSize: 8, color: "#4CAF50", fontFamily: "var(--m)", background: "rgba(76,175,80,0.1)", padding: "2px 6px", borderRadius: 3 }}>{"AUTO"}</span>)}
        </div>
      );
    }

    if (r.type === "lOnly") {
      var on = val === "L";
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
          </div>
          <button onClick={active ? function() { upd(k, on ? "" : "L"); } : undefined}
            style={{ width: "100%", padding: "6px 8px", fontSize: 10, background: on ? "rgba(255,213,79,0.12)" : "var(--inner)", border: on ? "1px solid rgba(255,213,79,0.4)" : "1px solid var(--bd)", borderRadius: 6, color: on ? "var(--acc)" : "var(--t2)", cursor: active ? "pointer" : "default", fontWeight: on ? 700 : 400 }}>
            {r.lDesc}
          </button>
        </div>
      );
    }

    if (r.type === "rOnly") {
      var on2 = val === "R";
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acp)" }}>{r.sp}</span>
          </div>
          <button onClick={active ? function() { upd(k, on2 ? "" : "R"); } : undefined}
            style={{ width: "100%", padding: "6px 8px", fontSize: 10, background: on2 ? "rgba(206,147,216,0.12)" : "var(--inner)", border: on2 ? "1px solid rgba(206,147,216,0.4)" : "1px solid var(--bd)", borderRadius: 6, color: on2 ? "var(--acp)" : "var(--t2)", cursor: active ? "pointer" : "default", fontWeight: on2 ? 700 : 400 }}>
            {r.rDesc}
          </button>
        </div>
      );
    }

    if (r.type === "yearR") {
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acp)" }}>{r.sp}</span>
            <span style={{ fontSize: 9, color: "var(--td)" }}>{"연도 선택"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--t2)", flex: 1 }}>{r.rDesc}</span>
            <select value={val} onChange={active ? function(e) { upd(k, e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: val ? "var(--acp)" : "var(--t1)", outline: "none" }}>
              <option value="">{"X"}</option>
              {[1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(function(y) { return (<option key={y} value={String(y)}>{y}</option>); })}
            </select>
          </div>
        </div>
      );
    }

    if (r.type === "yearLR") {
      var side = (val === "L" || (val && val.startsWith && val.startsWith("L:"))) ? "L" : (val === "R" || (val && val.startsWith && val.startsWith("R:"))) ? "R" : "";
      var yearV = "";
      if (side && val.indexOf(":") > 0) yearV = val.split(":")[1];
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
            <span style={{ fontSize: 9, color: "var(--td)" }}>{"연도 선택 좌/우"}</span>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: 4 }}>
            <button onClick={active ? function() { upd(k, side === "L" ? "" : "L:"); } : undefined} style={radioStyle(active, side === "L", "L")}>
              <span>{"◀ " + r.lDesc}</span>
            </button>
            <button onClick={active ? function() { upd(k, side === "R" ? "" : "R:"); } : undefined} style={radioStyle(active, side === "R", "R")}>
              <span>{r.rDesc + " ▶"}</span>
            </button>
          </div>
          {side && (<select value={yearV} onChange={active ? function(e) { upd(k, side + ":" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>
            <option value="">{"X"}</option>
            {[1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(function(y) { return (<option key={y} value={String(y)}>{y}</option>); })}
          </select>)}
        </div>
      );
    }

    if (r.type === "lrYear") {
      var isL = val === "L";
      var isR = typeof val === "string" && val.startsWith && val.startsWith("R:");
      var yrVal = isR ? val.split(":")[1] : "";
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: isR ? 4 : 0 }}>
            <button onClick={active ? function() { upd(k, isL ? "" : "L"); } : undefined} style={radioStyle(active, isL, "L")}>
              <span>{"◀ " + r.lDesc}</span>
            </button>
            <button onClick={active ? function() { upd(k, isR ? "" : "R:"); } : undefined} style={radioStyle(active, isR, "R")}>
              <span>{r.rDesc + " ▶"}</span>
            </button>
          </div>
          {isR && (<select value={yrVal} onChange={active ? function(e) { upd(k, "R:" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#FFD54F", outline: "none" }}>
            <option value="">{"X"}</option>
            {[1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993, 1994, 1995, 1996, 1997, 1998, 1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(function(y) { return (<option key={y} value={String(y)}>{y}</option>); })}
          </select>)}
        </div>
      );
    }

    /* Default: lr radio */
    return (
      <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          <button onClick={active ? function() { upd(k, val === "L" ? "" : "L"); } : undefined} style={radioStyle(active, val === "L", "L")}>
            <span>{"◀ " + r.lDesc}</span>
          </button>
          <button onClick={active ? function() { upd(k, val === "R" ? "" : "R"); } : undefined} style={radioStyle(active, val === "R", "R")}>
            <span>{r.rDesc + " ▶"}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <React.Fragment>
      {open && (<div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 180 }} />)}
      <div style={{ position: "fixed", top: 0, right: open ? 0 : (mob ? -262 : -302), width: mob ? 260 : 300, height: "100vh", background: "#0c1018", borderLeft: "1px solid var(--bd)", zIndex: 190, transition: "right 0.3s ease", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--bd)", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)" }}>{"SET DECK"}</div>
              <div style={{ fontSize: 9, color: "var(--td)" }}>{"좌/우 선택 · 활성 " + activeCount + "개"}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, background: "var(--inner)", borderRadius: 6, padding: "6px 8px", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: 7, color: "var(--td)" }}>{"카드"}</div>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--h)", color: "var(--acc)" }}>{setPoint}</div>
            </div>
            <div style={{ flex: 1, background: "var(--inner)", borderRadius: 6, padding: "6px 8px", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: 7, color: "var(--td)" }}>{"라이브"}</div>
              <input type="number" value={sdState.liveSetPo || 0} onChange={function(e) { upd("liveSetPo", parseInt(e.target.value) || 0); }} style={{ width: "100%", fontSize: 18, fontWeight: 900, fontFamily: "var(--h)", color: "#E67E22", background: "transparent", border: "none", outline: "none", padding: 0 }} />
            </div>
            <div style={{ flex: 1, background: "linear-gradient(135deg,rgba(255,213,79,0.08),rgba(255,143,0,0.08))", borderRadius: 6, padding: "6px 8px", border: "1px solid rgba(255,213,79,0.15)" }}>
              <div style={{ fontSize: 7, color: "var(--acc)" }}>{"총 셋포"}</div>
              <div style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--h)", color: "var(--acc)" }}>{totalSP}</div>
            </div>
          </div>
          <button onClick={function(){
            /* Auto-optimize: try each LR row both ways, pick highest total */
            var best = Object.assign({}, sdState);
            var lrRows = SD_ROWS.filter(function(r){return r.type==="lr"||r.type==="lOnly"||r.type==="rOnly";});
            lrRows.forEach(function(r){
              if(totalSP < r.sp) return;
              var k="s"+r.sp;
              var scores=[];
              ["","L","R"].forEach(function(v){
                var test=Object.assign({},best);test[k]=v;
                var ts=0;
                if(p.players&&p.lineupMap){
                  var bSlots=["C","1B","2B","3B","SS","LF","CF","RF","DH"];
                  var pSlots=["SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP"];
                  var findPl=function(id){if(!id)return null;for(var i=0;i<p.players.length;i++){if(p.players[i].id===id)return p.players[i];}return null;};
                  test._synCounts=sdState._synCounts||{};
                  test._autoNatBat=sdState._autoNatBat||"없음";test._autoNatPit=sdState._autoNatPit||"없음";test._autoCatch=sdState._autoCatch||"없음";
                  bSlots.forEach(function(sl){var pl2=findPl(p.lineupMap[sl]);if(pl2){var sd2=calcSDBonus(pl2,sl,test,totalSP);var lu2={trainP:pl2.trainP||0,trainA:pl2.trainA||0,trainE:pl2.trainE||0,specPower:pl2.specPower||0,specAccuracy:pl2.specAccuracy||0,specEye:pl2.specEye||0};var c2=calcBat(pl2,lu2,sd2);ts+=c2.total;}});
                  pSlots.forEach(function(sl){var pl2=findPl(p.lineupMap[sl]);if(pl2){var sd2=calcSDBonus(pl2,sl,test,totalSP);var lu2={trainC:pl2.trainC||0,trainS:pl2.trainS||0,specChange:pl2.specChange||0,specStuff:pl2.specStuff||0};var c2=calcPit(pl2,lu2,sd2);ts+=c2.total;}});
                }
                scores.push({v:v,ts:ts});
              });
              scores.sort(function(a,b){return b.ts-a.ts;});
              best[k]=scores[0].v;
            });
            setSdState(function(prev){return Object.assign({},prev,best);});
          }} style={{ marginTop: 8, width: "100%", padding: "8px", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,rgba(255,213,79,0.15),rgba(255,143,0,0.08))", border: "1px solid rgba(255,213,79,0.3)", borderRadius: 6, color: "var(--acc)", cursor: "pointer" }}>{"⚡ 자동 최적화"}</button>
        </div>

        {/* Scrollable toggle list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {SD_ROWS.map(renderRow)}

          {/* Synergy */}
          <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 800, color: "var(--acp)", fontFamily: "var(--h)", borderTop: "1px solid var(--bd)", marginTop: 6 }}>{"시너지"}</div>
          {(function() {
            var counts = {};
            var allSlots2 = ["C","1B","2B","3B","SS","LF","CF","RF","DH","SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP","BN1","BN2","BN3","BN4","BN5","BN6"];
            allSlots2.forEach(function(sl) { var pid = p.lineupMap && p.lineupMap[sl]; if (!pid) return; var pl2 = null; if(p.players){for(var i=0;i<p.players.length;i++){if(p.players[i].id===pid){pl2=p.players[i];break;}}} if(!pl2)return; var ct=pl2.cardType; counts[ct]=(counts[ct]||0)+1; });
            var liveNat = (counts["라이브"]||0) + (counts["국가대표"]||0);
            var impCnt = counts["임팩트"]||0;
            var sigCnt = counts["시그니처"]||0;
            var syns = [
              {key:"synLive",label:"라이브",auto:liveNat>=7,desc:"라이브+국대 "+liveNat+"/7",effect:"전체 +1"},
              {key:"synImpact",label:"임팩트",auto:impCnt>=5,desc:"임팩트 "+impCnt+"/5",effect:"타자 파정선 +1"},
              {key:"synSig",label:"시그니처",auto:sigCnt>=5,desc:"시그 "+sigCnt+"/5",effect:"투수 변구 +1"}
            ];
            return syns.map(function(syn) {
              var manual = sdState[syn.key];
              var on = manual !== undefined ? manual : syn.auto;
              return (<div key={syn.key} style={{ padding: "5px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <div onClick={function(){upd(syn.key, on ? false : true);}} style={{ width: 28, height: 16, borderRadius: 8, background: on ? "#4CAF50" : "var(--inner)", border: "1px solid " + (on ? "#4CAF50" : "var(--bd)"), position: "relative", flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: on ? "#fff" : "var(--td)", position: "absolute", top: 1, left: on ? 14 : 1, transition: "left 0.2s" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: on ? "var(--t1)" : "var(--td)", fontWeight: on ? 700 : 400 }}>{syn.label + " 시너지"}</div>
                  <div style={{ fontSize: 8, color: "var(--td)" }}>{syn.desc + " → " + syn.effect}</div>
                </div>
                {syn.auto && manual === undefined && (<span style={{ fontSize: 7, color: "#4CAF50", background: "rgba(76,175,80,0.1)", padding: "1px 4px", borderRadius: 3 }}>{"AUTO"}</span>)}
              </div>);
            });
          })()}

          {/* Special skills (auto-detect + manual) */}
          <div style={{ padding: "10px 14px 4px", fontSize: 11, fontWeight: 800, color: "#2E86C1", fontFamily: "var(--h)", borderTop: "1px solid var(--bd)", marginTop: 6 }}>{"특수 스킬"}</div>
          {(function() {
            /* Auto-detect from lineup */
            var autoNatBat = "없음"; var autoNatPit = "없음"; var autoCatch = "없음";
            var allSlots3 = ["C","1B","2B","3B","SS","LF","CF","RF","DH","SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP","BN1","BN2","BN3","BN4","BN5","BN6"];
            allSlots3.forEach(function(sl) {
              var pid = p.lineupMap && p.lineupMap[sl]; if (!pid) return;
              var pl3 = null; if(p.players){for(var i=0;i<p.players.length;i++){if(p.players[i].id===pid){pl3=p.players[i];break;}}} if(!pl3)return;
              var skills3 = [pl3.skill1,pl3.skill2,pl3.skill3];
              var lvs3 = [pl3.s1Lv||0,pl3.s2Lv||0,pl3.s3Lv||0];
              for(var si=0;si<3;si++){
                if(!skills3[si])continue; var sn=skills3[si]; var slv=lvs3[si];
                if(sn.indexOf("국대에이스")>=0 && slv>=5){
                  var lvStr=slv+"렙";
                  if(pl3.role==="타자"){ if(slv>parseInt(autoNatBat)||autoNatBat==="없음") autoNatBat=lvStr; }
                  else{ if(slv>parseInt(autoNatPit)||autoNatPit==="없음") autoNatPit=lvStr; }
                }
                if(sn.indexOf("포수리드")>=0 && slv>=5){ var lvStr2=slv+"렙"; if(slv>parseInt(autoCatch)||autoCatch==="없음") autoCatch=lvStr2; }
              }
            });
            var specials = [
              {key:"natBat",label:"국대에이스(타자)",opts:["없음","5렙","6렙"],auto:autoNatBat},
              {key:"natPit",label:"국대에이스(투수)",opts:["없음","5렙","6렙"],auto:autoNatPit},
              {key:"catchLead",label:"포수리드",opts:["없음","5렙","6렙","7렙","8렙","9렙","10렙"],auto:autoCatch}
            ];
            return specials.map(function(sp) {
              var cur = sdState[sp.key] || sp.auto;
              return (
                <div key={sp.key} style={{ padding: "4px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, color: "var(--t2)", flex: 1 }}>{sp.label}</span>
                  <select value={cur} onChange={function(e) { upd(sp.key, e.target.value); }} style={{ width: 65, padding: "3px", fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: cur!=="없음"?"#2E86C1":"var(--t1)", fontWeight: cur!=="없음"?700:400, outline: "none" }}>
                    {sp.opts.map(function(o) { return (<option key={o} value={o}>{o}</option>); })}
                  </select>
                  {sp.auto!=="없음" && !sdState[sp.key] && (<span style={{ fontSize: 7, color: "#4CAF50", background: "rgba(76,175,80,0.1)", padding: "1px 4px", borderRadius: 3 }}>{"AUTO"}</span>)}
                </div>
              );
            });
          })()}
          <div style={{ height: 20 }} />
        </div>
      </div>
    </React.Fragment>
  );
}

function LineupPage(p) {
  var mob = p.mobile;
  var players = p.players;
  var save = p.savePlayers;
  var lm = p.lineupMap || {};
  var saveLM = p.saveLineupMap;
  var _sel = useState(null); var selId = _sel[0]; var setSelId = _sel[1];
  var _picker = useState(null); var pickerSlot = _picker[0]; var setPickerSlot = _picker[1];
  var _dragSlot = useState(null); var dragSlot = _dragSlot[0]; var setDragSlot = _dragSlot[1];
  /* 사진 캐시: {선수이름: [url, ...]} - useState로 re-render 보장 */
  var _photoCache = useState({});var photoCache=_photoCache[0];var setPhotoCache=_photoCache[1];
  var photoCacheRef = React.useRef({});
  var loadPhotosForPlayer = React.useCallback(async function(name) {
    if (!name || photoCacheRef.current[name] !== undefined) return;
    photoCacheRef.current[name] = null;
    var urls = await listPlayerPhotos(name);
    photoCacheRef.current[name] = urls || [];
    PHOTO_CACHE[name] = urls || []; /* 전역 캐시 업데이트 */
    setPhotoCache(function(prev){
      var next = Object.assign({}, prev); next[name] = urls || []; return next;
    });
  }, []);
  var getPhotos = function(name) { return photoCache[name]; };

  /* 라인업 내 모든 선수 사진 자동 로드 */
  var lm = p.lineupMap || {};
  useEffect(function(){
    var names = [];
    Object.values(lm).forEach(function(pid){
      var raw = (p.players||[]).find(function(x){ return x.id===pid; });
      var pl = raw ? (mergePl(raw)||raw) : null;
      if(pl && pl.name && names.indexOf(pl.name)<0) names.push(pl.name);
    });
    names.forEach(function(name){ loadPhotosForPlayer(name); });
  },[JSON.stringify(Object.keys(lm).sort())]);

  /* selId 변경 시 해당 선수 사진도 로드 */
  useEffect(function(){
    if(!selId) return;
    var raw = (p.players||[]).find(function(x){ return x.id===selId; });
    var pl = raw ? (mergePl(raw)||raw) : null;
    if(pl && pl.name) loadPhotosForPlayer(pl.name);
  },[selId]);
  var _dragOver = useState(null); var dragOverSlot = _dragOver[0]; var setDragOverSlot = _dragOver[1];
  var _sdOpen = useState(false); var sdOpen = _sdOpen[0]; var setSdOpen = _sdOpen[1];
  var sdState = p.sdState; var setSdState = p.setSdState;
  /* bpcIdx/isWinSplit는 sdState에서 읽고, 변경 시 sdState에 저장 */
  var bpcIdx = sdState.bpcIdx !== undefined ? sdState.bpcIdx : 4;
  var isWinSplit = sdState.isWinSplit || false;
  var setBpcIdx = function(v) { setSdState(function(prev) { return Object.assign({}, prev, { bpcIdx: typeof v === "function" ? v(prev.bpcIdx !== undefined ? prev.bpcIdx : 4) : v }); }); };
  var setIsWinSplit = function(v) { setSdState(function(prev) { return Object.assign({}, prev, { isWinSplit: typeof v === "function" ? v(!!prev.isWinSplit) : v }); }); };
  var skillsDB = p.skills || {};

  /* Skill category for position */
  var getSkillCat = function(pl) {
    if (!pl) return "타자";
    if (pl.role === "타자") return "타자";
    if (pl.position === "선발") return "선발";
    if (pl.position === "마무리") return "마무리";
    return "중계";
  };
  var getSkillOpts = function(pl) {
    var cat = getSkillCat(pl);
    var t = skillsDB[cat] || {};
    return Object.keys(t);
  };

  /* Lookup player by id */
  var byId = function(id) {
    if (!id) return null;
    for (var i = 0; i < players.length; i++) { if (players[i].id === id) return players[i]; }
    return null;
  };
  var pick = function(slot) { var pl = byId(lm[slot]); return pl ? mergePl(pl) : null; };

  /* Assign player to slot */
  var assignSlot = function(slot, playerId) {
    var next = Object.assign({}, lm);
    next[slot] = playerId;
    saveLM(next);
    /* Auto-set subPosition for pitchers */
    var pl = byId(playerId);
    if (pl && pl.role === "투수" && pl.subPosition !== slot) {
      var newPos = slot.startsWith("SP") ? "선발" : slot === "CP" ? "마무리" : "중계";
      save(players.map(function(x) { if (x.id !== playerId) return x; var c = Object.assign({}, x); c.subPosition = slot; c.position = newPos; return c; }));
    }
    setPickerSlot(null);
  };
  var BAT_SLOTS = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  var SP_SLOTS = ["SP1","SP2","SP3","SP4","SP5"];
  var RP_SLOTS = ["RP1","RP2","RP3","RP4","RP5","RP6"];

  /* batOrder: 타순 배열 (포지션 슬롯 순서). 기본값은 BAT_SLOTS 순서 */
  var batOrder = (sdState.batOrder && sdState.batOrder.length === 9) ? sdState.batOrder : BAT_SLOTS.slice();
  var saveBatOrder = function(newOrder) {
    setSdState(function(prev) { return Object.assign({}, prev, { batOrder: newOrder }); });
  };

  /* 타순 드래그: batOrder만 변경 (lineupMap/다이아몬드 위치는 불변) */
  var swapOrder = function(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    var next = batOrder.slice();
    var tmp = next[fromIdx];
    next[fromIdx] = next[toIdx];
    next[toIdx] = tmp;
    saveBatOrder(next);
    setDragSlot(null);
    setDragOverSlot(null);
  };

  /* lBats: 타순 기준으로 정렬 (다이아몬드는 lineupMap 기준 그대로) */
  var lBats = batOrder.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lSP = SP_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lRP = RP_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lCP = { slot: "CP", pl: pick("CP") };


  /* Build slot -> player map for diamond */
  var batSlotMap = {};
  BAT_SLOTS.forEach(function(s) { var pl = pick(s); if (pl) batSlotMap[s] = pl; });

  /* Auto-calculate set points from lineup card types */
  var calcSetPoint = function() {
    var total = 0;
    var potmList = sdState.potmList || [];
    var teamName = sdState.teamName || "";
    var getPotmSetDelta = function(pl) {
      if (!potmList.length || !pl) return 0;
      var dbId = pl.dbId || pl.id;
      var isPotm = potmList.some(function(p) { return p.name === (pl.name||"") && p.team === (pl.team||""); });
      if (!isPotm) return 0;
      var ct = pl.cardType;
      /* 내 덱 팀명과 POTM 팀명이 다르면 적용 안 함 */
      var potmEntry = potmList.find(function(p){ return p.name===(pl.name||"") && p.team===(pl.team||""); });
      if (teamName && potmEntry && potmEntry.team && potmEntry.team !== teamName) return 0;
      var teamMatch = !teamName || !pl.team || pl.team === teamName;
      var isLive = ct === "라이브";
      var isOlstar = ct === "올스타";
      var baseScore = isLive ? (pl.setScore || 0) : (SET_POINTS[ct] || 0);
      if (pl.isFa && ct==="시그니처") baseScore = Math.max(0, baseScore - 1);
      if (pl.isFa && ct==="임팩트") baseScore = Math.max(0, baseScore - 2);
      if (isLive || isOlstar) {
        return baseScore >= 10 ? 1 : (10 - baseScore);
      }
      return teamMatch ? 1 : 0;
    };
    var allSlots = BAT_SLOTS.concat(SP_SLOTS).concat(RP_SLOTS).concat(["CP"]);
    allSlots.forEach(function(slot) {
      var pl = pick(slot);
      if (!pl) return;
      var sc = pl.cardType === "라이브" ? (pl.setScore || 0) : (SET_POINTS[pl.cardType] || 0);
      if (pl.isFa && pl.cardType==="시그니처") sc = Math.max(0, sc - 1);
      if (pl.isFa && pl.cardType==="임팩트") sc = Math.max(0, sc - 2);
      sc += getPotmSetDelta(pl);
      total += sc;
    });
    for (var bn = 1; bn <= 6; bn++) {
      var bnPl = pick("BN" + bn);
      if (!bnPl) continue;
      var bnSc = bnPl.cardType === "라이브" ? (bnPl.setScore || 0) : (SET_POINTS[bnPl.cardType] || 0);
      if (bnPl.isFa && bnPl.cardType==="시그니처") bnSc = Math.max(0, bnSc - 1);
      if (bnPl.isFa && bnPl.cardType==="임팩트") bnSc = Math.max(0, bnSc - 2);
      bnSc += getPotmSetDelta(bnPl);
      total += bnSc;
    }
    return total;
  };
  /* Compute card type counts for synergy */
  var synCounts = {};
  var allSlotsForSyn = BAT_SLOTS.concat(SP_SLOTS).concat(RP_SLOTS).concat(["CP","BN1","BN2","BN3","BN4","BN5","BN6"]);
  allSlotsForSyn.forEach(function(sl) { var pl2 = pick(sl); if (pl2) { synCounts[pl2.cardType] = (synCounts[pl2.cardType]||0) + 1; } });
  sdState._synCounts = synCounts;
  /* Auto-detect special skills */
  var autoNB="없음",autoNP="없음",autoCC="없음";
  allSlotsForSyn.forEach(function(sl){var pl4=pick(sl);if(!pl4)return;var sks=[pl4.skill1,pl4.skill2,pl4.skill3],lvs=[pl4.s1Lv||0,pl4.s2Lv||0,pl4.s3Lv||0];for(var i=0;i<3;i++){if(!sks[i])continue;if(sks[i].indexOf("국대에이스")>=0&&lvs[i]>=5){var lv=lvs[i]+"렙";if(pl4.role==="타자"){if(lvs[i]>parseInt(autoNB)||autoNB==="없음")autoNB=lv;}else{if(lvs[i]>parseInt(autoNP)||autoNP==="없음")autoNP=lv;}}if(sks[i].indexOf("포수리드")>=0&&lvs[i]>=5){var lv2=lvs[i]+"렙";if(lvs[i]>parseInt(autoCC)||autoCC==="없음")autoCC=lv2;}}});
  sdState._autoNatBat=autoNB;sdState._autoNatPit=autoNP;sdState._autoCatch=autoCC;
  var setPoint = calcSetPoint();
  var totalSP = setPoint + (sdState.liveSetPo || 0);

  /* Helper: build lu + calc with SD bonus */
  var mkLuB = function(pl) { return { enhance: pl.enhance || "9각성", trainP: pl.trainP || 0, trainA: pl.trainA || 0, trainE: pl.trainE || 0, trainC: pl.trainC || 0, trainS: pl.trainS || 0, skill1: pl.skill1 || "", s1Lv: pl.s1Lv || 0, skill2: pl.skill2 || "", s2Lv: pl.s2Lv || 0, skill3: pl.skill3 || "", s3Lv: pl.s3Lv || 0 }; };
  var calcBatSD = function(pl, slot) { var orderIdx = batOrder.indexOf(slot); return calcBat(pl, mkLuB(pl), calcSDBonus(pl, slot, sdState, totalSP, orderIdx >= 0 ? orderIdx : undefined)); };
  var calcPitSD = function(pl, slot) { return calcPit(pl, mkLuB(pl), calcSDBonus(pl, slot, sdState, totalSP)); };

  /* ── 그라데이션 색상 헬퍼 ── */
  var pctColor = function(val, allVals, baseColor) {
    if (!allVals || allVals.length === 0) return "var(--td)";
    var sorted = allVals.slice().sort(function(a,b){return a-b;});
    var rank = sorted.filter(function(v){return v<=val;}).length;
    var pct = rank / sorted.length; /* 0~1, 높을수록 좋음 */
    /* pct에 따라 투명도/밝기 조절: 0.2~1.0 */
    var alpha = 0.2 + pct * 0.8;
    if (baseColor === "gold") return "rgba(255,"+(Math.round(180+75*pct))+",0,"+alpha+")";
    if (baseColor === "blue") return "rgba(100,180,255,"+alpha+")";
    return "rgba(255,213,79,"+alpha+")";
  };

  /* 전체 타자 스킬/훈련 점수 배열 계산 */
  var allBatSkillScores = lBats.map(function(x){
    if(!x.pl) return null;
    return getSkillScore(x.pl.skill1,x.pl.s1Lv||0,"타자")+getSkillScore(x.pl.skill2,x.pl.s2Lv||0,"타자")+getSkillScore(x.pl.skill3,x.pl.s3Lv||0,"타자");
  }).filter(function(v){return v!==null;});
  var allBatTrainScores = lBats.map(function(x){
    if(!x.pl) return null;
    var w2=getW(); return (x.pl.trainP||0)*w2.p+(x.pl.trainA||0)*w2.a+(x.pl.trainE||0)*w2.e;
  }).filter(function(v){return v!==null;});

  /* 전체 투수 스킬/훈련 점수 배열 계산 */
  var allPitSlots = lSP.concat(lRP).concat([lCP]);
  var allPitSkillScores = allPitSlots.map(function(x){
    if(!x.pl) return null;
    var pt=x.pl.position==="선발"?"선발":x.pl.position==="마무리"?"마무리":"중계";
    return getSkillScore(x.pl.skill1,x.pl.s1Lv||0,pt)+getSkillScore(x.pl.skill2,x.pl.s2Lv||0,pt)+getSkillScore(x.pl.skill3,x.pl.s3Lv||0,pt);
  }).filter(function(v){return v!==null;});
  var allPitTrainScores = allPitSlots.map(function(x){
    if(!x.pl) return null;
    var w2=getW(); return (x.pl.trainC||0)*w2.c+(x.pl.trainS||0)*w2.s;
  }).filter(function(v){return v!==null;});

  /* Calculate total score */
  var calcTotal = function() {
    var t = 0;
    lBats.forEach(function(x, i) {
      if (!x.pl) return;
      var calc = calcBatSD(x.pl, x.slot);
      var mult = i <= 4 ? 1.0 : i <= 6 ? 0.9 : 0.8;
      t += calc.total * mult;
    });
    lSP.forEach(function(x) { if (!x.pl) return; t += calcPitSD(x.pl, x.slot).total * 1.1; });
    lRP.forEach(function(x) { if (!x.pl) return; t += calcPitSD(x.pl, x.slot).total * getRPWeight(bpcIdx, x.slot, isWinSplit); });
    if (lCP.pl) t += calcPitSD(lCP.pl, "CP").total;
    return Math.round(t * 100) / 100;
  };
  var totalScore = calcTotal();
  var rpSlotData = RP_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });

  var diamondPl = Object.keys(batSlotMap).length;
  var spPl = lSP.filter(function(x) { return x.pl; });
  var rpPl = lRP.filter(function(x) { return x.pl; }).map(function(x) { return x.pl; });
  var cpPl = lCP.pl ? [lCP.pl] : [];

  var updatePl = function(id, key, val) {
    save(players.map(function(x) { if (x.id !== id) return x; var c = Object.assign({}, x); c[key] = val; return c; }));
  };
  var miniIn = function(id, field, val, color, max) {
    return (<input type="number" value={val || 0} onChange={function(e) { var v = parseInt(e.target.value) || 0; if (max) v = Math.min(max, Math.max(0, v)); updatePl(id, field, v); }} style={{ width: 34, padding: "2px 1px", textAlign: "center", background: "var(--inner)", border: "1px solid " + (color || "var(--bd)") + "44", borderRadius: 3, color: color || "var(--t1)", fontSize: 10, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />);
  };
  var skillInput = function(pl, num) {
    var opts = getSkillOpts(pl);
    var nameField = "skill" + num; var lvField = "s" + num + "Lv";
    var c = {8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[pl[lvField]]||"var(--t2)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <select value={pl[nameField] || ""} onChange={function(e) { updatePl(pl.id, nameField, e.target.value); }}
          style={{ width: 90, padding: "3px 2px", fontSize: 9, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>
          <option value="">{"없음"}</option>
          {opts.map(function(s) { return (<option key={s} value={s} style={{background:"#1e293b",color:"#e2e8f0"}}>{s}</option>); })}
        </select>
        <select value={pl[lvField] || 0} onChange={function(e) { updatePl(pl.id, lvField, parseInt(e.target.value)); }}
          style={{ width: 38, padding: "3px 1px", fontSize: 10, background: "#1e293b", border: "1px solid " + c + "88", borderRadius: 3, color: c, fontFamily: "var(--m)", fontWeight: 700, outline: "none", textAlign: "center" }}>
          {[0,5,6,7,8,9,10].map(function(v) { return (<option key={v} value={v} style={{background:"#1e293b",color:v===0?"#94a3b8":c}}>{v === 0 ? "-" : "Lv" + v}</option>); })}
        </select>
      </div>
    );
  };

  /* Batter row */
  var batRow = function(slot, pl, idx) {
    if (!pl) return (
      <div key={slot} onClick={function() { setPickerSlot(slot); }} style={{ display: "grid", gridTemplateColumns: "32px 68px 1fr", alignItems: "center", gap: 6, padding: "8px 10px", background: idx % 2 === 0 ? "var(--re)" : "transparent", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--td)", fontFamily: "var(--m)" }}>{slot}</div>
        <div style={{ width: 64, height: 88, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--inner)" }}><span style={{ fontSize: 20, opacity: 0.2 }}>{"+"}</span></div>
        <div style={{ fontSize: 10, color: "var(--td)" }}>{"클릭하여 선수 등록"}</div>
      </div>
    );
    var calc = calcBatSD(pl, slot);
    var isSel = selId === pl.id;
    return (
      <React.Fragment key={pl.id}>
        <div draggable={true}
          onDragStart={function(e) { setDragSlot(idx); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={function(e) { e.preventDefault(); setDragOverSlot(idx); }}
          onDragLeave={function() { if (dragOverSlot === idx) setDragOverSlot(null); }}
          onDrop={function(e) { e.preventDefault(); if (dragSlot !== null && dragSlot !== idx) swapOrder(dragSlot, idx); }}
          onDragEnd={function() { setDragSlot(null); setDragOverSlot(null); }}
          onClick={function() { setSelId(isSel ? null : pl.id); }}
          style={{ display: "grid", gridTemplateColumns: mob ? "28px 56px 1fr 46px" : "32px 68px minmax(100px,1fr) 80px 120px 75px 46px 110px 40px 46px", alignItems: "center", gap: 28, padding: "8px 10px", background: dragOverSlot === idx ? "rgba(255,213,79,0.12)" : isSel ? "var(--ta)" : (idx % 2 === 0 ? "var(--re)" : "transparent"), borderBottom: "1px solid var(--bd)", cursor: "grab", borderLeft: dragOverSlot === idx ? "3px solid var(--acc)" : isSel ? "3px solid var(--acc)" : "3px solid transparent", transition: "background 0.15s" }}>
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, color: "var(--acc)", fontFamily: "var(--h)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {idx > 0 && (<span onClick={function(e) { e.stopPropagation(); swapOrder(idx, idx-1); }} style={{ fontSize: 10, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▲"}</span>)}
            <span>{idx + 1}</span>
            {idx < 8 && (<span onClick={function(e) { e.stopPropagation(); swapOrder(idx, idx+1); }} style={{ fontSize: 10, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▼"}</span>)}
          </div>
          <PlayerCard player={(function(){ var ph=getPhotos(pl.name); var url=pl.photoUrl||(ph&&ph.length>0?ph[0]:''); return url!==pl.photoUrl?Object.assign({},pl,{photoUrl:url}):pl; })()} size={mob?"sm":"md"} showPhoto={true} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pl.cardType} /><span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span></div>
            <div style={{ fontSize: 12, color: "var(--td)", marginTop: 2 }}>{pl.hand + "타·" + (pl.enhance || "") + (pl.cardType==="임팩트" && pl.impactType ? " · "+pl.impactType : pl.year ? " · "+pl.year : "")}</div>
          </div>
          {mob ? (<div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={20} /></div>) : null}
          {!mob && (<React.Fragment>
            <div style={{ textAlign: "left" }}><GS val={calc.total.toFixed(1)} size={28} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 40 }}>
              {[["파", calc.power, "#EF5350"], ["정", calc.accuracy, "#42A5F5"], ["선", calc.eye, "#66BB6A"]].map(function(it) {
                return (<div key={it[0]} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 14, fontSize: 13, color: it[2], fontWeight: 700 }}>{it[0]}</span><Bar value={it[1]} color={it[2]} /><span style={{ width: 26, fontSize: 13, color: "var(--t2)", fontFamily: "var(--m)", textAlign: "right" }}>{it[1]}</span></div>);
              })}
            </div>
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 11, color: pctColor((pl.trainP||0)*getW().p+(pl.trainA||0)*getW().a+(pl.trainE||0)*getW().e, allBatTrainScores, "gold") }}>{"훈련"}</div>
              <span style={{ fontSize: 13, fontFamily: "var(--m)" }}><span style={{ color: "#EF5350" }}>{"+" + (pl.trainP || 0)}</span>{" "}<span style={{ color: "#42A5F5" }}>{"+" + (pl.trainA || 0)}</span>{" "}<span style={{ color: "#66BB6A" }}>{"+" + (pl.trainE || 0)}</span></span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"특훈"}</div>
              <span style={{ fontSize: 13, color: "var(--t2)", fontFamily: "var(--m)" }}>{(pl.specPower || 0) + "/" + (pl.specAccuracy || 0) + "/" + (pl.specEye || 0)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {pl.skill1 && (<SkBadge name={pl.skill1} lv={pl.s1Lv} />)}
              {pl.skill2 && (<SkBadge name={pl.skill2} lv={pl.s2Lv} />)}
              {pl.skill3 && (<SkBadge name={pl.skill3} lv={pl.s3Lv} />)}
            </div>
            {(function(){
              var skSc=Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,"타자")+getSkillScore(pl.skill2,pl.s2Lv||0,"타자")+getSkillScore(pl.skill3,pl.s3Lv||0,"타자"))*100)/100;
              return (<div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: pctColor(skSc, allBatSkillScores, "gold"), fontFamily: "var(--m)" }}>{skSc||""}</div>);
            })()}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{(<span><span style={{fontSize:9,color:"var(--td)"}}>풀</span>{pl.pot1||"-"} <span style={{fontSize:9,color:"var(--td)"}}>클</span>{pl.pot2||"-"}</span>)}</div>
            </div>
          </React.Fragment>)}
        </div>
        {isSel && (<div style={{ padding: "8px 14px", background: "rgba(255,213,79,0.02)", borderBottom: "1px solid var(--bd)" }}>
          {/* 사진 선택 UI */}
          {(function(){
            var photos = getPhotos(pl.name);
            if (photos === undefined) { loadPhotosForPlayer(pl.name); return null; }
            if (!photos || photos.length === 0) return null;
            return (
              <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"var(--td)",flexShrink:0}}>{"선수사진:"}</span>
                {photos.map(function(url, i){
                  var isCur = pl.photoUrl === url;
                  var pos = (PHOTO_POS_MAP[pl.name]!==undefined?PHOTO_POS_MAP[pl.name]:20)+"%";
                  return (
                    <div key={i} onClick={function(){updatePl(pl.id,"photoUrl",isCur?"":url);}}
                      style={{cursor:"pointer",borderRadius:5,border:"2px solid "+(isCur?"var(--acc)":"transparent"),overflow:"hidden",opacity:isCur?1:0.6,transition:"all 0.15s"}}>
                      <img src={url} alt="" style={{width:40,height:56,objectFit:"cover",objectPosition:"center "+pos,display:"block"}} />
                    </div>
                  );
                })}
                {pl.photoUrl && (<button onClick={function(){updatePl(pl.id,"photoUrl","");}} style={{padding:"3px 8px",fontSize:10,background:"rgba(239,83,80,0.08)",border:"1px solid rgba(239,83,80,0.2)",borderRadius:4,color:"#EF5350",cursor:"pointer",flexShrink:0}}>{"사진 제거"}</button>)}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e} style={{background:"#1e293b",color:"#e2e8f0"}}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 13, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "trainP", pl.trainP, "#EF5350")}<span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "trainA", pl.trainA, "#42A5F5")}<span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "trainE", pl.trainE, "#66BB6A")}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "specPower", pl.specPower, "#EF5350", 15)}<span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "specAccuracy", pl.specAccuracy, "#42A5F5", 15)}<span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "specEye", pl.specEye, "#66BB6A", 15)}</div></div>
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3, alignItems: "center" }}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType1||"풀스윙"} onChange={function(e){updatePl(pl.id,"potType1",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_BAT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot1||""} onChange={function(e){updatePl(pl.id,"pot1",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:10,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType2||"클러치"} onChange={function(e){updatePl(pl.id,"potType2",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_BAT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot2||""} onChange={function(e){updatePl(pl.id,"pot2",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:10,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div></div></div>
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"스킬 ("+getSkillCat(pl)+")"}</div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{skillInput(pl,1)}{skillInput(pl,2)}{skillInput(pl,3)}</div></div>
          </div>
        </div>)}
      </React.Fragment>
    );
  };

  /* Pitcher row */
  var pitRow = function(slot, pl, idx, showWt) {
    if (!pl) return (
      <div key={slot} onClick={function() { setPickerSlot(slot); }} style={{ display: "grid", gridTemplateColumns: "32px 68px 1fr", alignItems: "center", gap: 6, padding: "8px 10px", background: idx % 2 === 0 ? "var(--re)" : "transparent", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
        <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--td)", fontFamily: "var(--m)" }}>{slot}</div>
        <div style={{ width: 64, height: 88, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--inner)" }}><span style={{ fontSize: 20, opacity: 0.2 }}>{"+"}</span></div>
        <div style={{ fontSize: 10, color: "var(--td)" }}>{"클릭하여 선수 등록"}</div>
      </div>
    );
    var calc = calcPitSD(pl, slot);
    var isSel = selId === pl.id;
    return (
      <React.Fragment key={pl.id}>
        <div onClick={function() { setSelId(isSel ? null : pl.id); }} style={{ display: "grid", gridTemplateColumns: mob ? "28px 56px 1fr 46px" : "32px 68px minmax(100px,1fr) 80px 96px 68px 46px 110px 40px 46px", alignItems: "center", gap: 28, padding: "8px 10px", background: isSel ? "var(--ta)" : (idx % 2 === 0 ? "var(--re)" : "transparent"), borderBottom: "1px solid var(--bd)", cursor: "pointer", borderLeft: isSel ? "3px solid var(--acp)" : "3px solid transparent" }}>
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, color: "var(--acp)", fontFamily: "var(--h)" }}>{idx + 1}</div>
          <PlayerCard player={(function(){ var ph=getPhotos(pl.name); var url=pl.photoUrl||(ph&&ph.length>0?ph[0]:''); return url!==pl.photoUrl?Object.assign({},pl,{photoUrl:url}):pl; })()} size={mob?"sm":"md"} showPhoto={true} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pl.cardType} /><span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 16 }}>{pl.name}</span></div>
            <div style={{ fontSize: 12, color: "var(--td)", marginTop: 2 }}>{pl.hand + "투·" + (pl.enhance || "") + (pl.cardType==="임팩트" && pl.impactType ? " · "+pl.impactType : pl.year ? " · "+pl.year : "")}</div>
          </div>
          {mob ? (<div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={20} grad="linear-gradient(135deg,#CE93D8,#7B1FA2)" /></div>) : null}
          {!mob && (<React.Fragment>
            <div style={{ textAlign: "left" }}><GS val={calc.total.toFixed(1)} size={28} grad="linear-gradient(135deg,#CE93D8,#7B1FA2)" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginLeft: 40 }}>
              {[["변", calc.change, "#AB47BC"], ["구", calc.stuff, "#FF7043"]].map(function(it) {
                return (<div key={it[0]} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 14, fontSize: 13, color: it[2], fontWeight: 700 }}>{it[0]}</span><Bar value={it[1]} color={it[2]} /><span style={{ width: 26, fontSize: 13, color: "var(--t2)", fontFamily: "var(--m)", textAlign: "right" }}>{it[1]}</span></div>);
              })}
            </div>
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 11, color: pctColor((pl.trainC||0)*getW().c+(pl.trainS||0)*getW().s, allPitTrainScores, "gold") }}>{"훈련"}</div>
              <span style={{ fontSize: 13, fontFamily: "var(--m)" }}><span style={{ color: "#AB47BC" }}>{"+" + (pl.trainC || 0)}</span>{" "}<span style={{ color: "#FF7043" }}>{"+" + (pl.trainS || 0)}</span></span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"특훈"}</div>
              <span style={{ fontSize: 13, color: "var(--t2)", fontFamily: "var(--m)" }}>{(pl.specChange || 0) + "/" + (pl.specStuff || 0)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {pl.skill1 && (<SkBadge name={pl.skill1} lv={pl.s1Lv} />)}
              {pl.skill2 && (<SkBadge name={pl.skill2} lv={pl.s2Lv} />)}
              {pl.skill3 && (<SkBadge name={pl.skill3} lv={pl.s3Lv} />)}
            </div>
            {(function(){
              var pt2=pl.position==="선발"?"선발":pl.position==="마무리"?"마무리":"중계";
              var skSc=Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,pt2)+getSkillScore(pl.skill2,pl.s2Lv||0,pt2)+getSkillScore(pl.skill3,pl.s3Lv||0,pt2))*100)/100;
              return (<div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: pctColor(skSc, allPitSkillScores, "blue"), fontFamily: "var(--m)" }}>{skSc||""}</div>);
            })()}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{(<span><span style={{fontSize:9,color:"var(--td)"}}>장</span>{pl.pot1||"-"} <span style={{fontSize:9,color:"var(--td)"}}>침</span>{pl.pot2||"-"}</span>)}</div>
            </div>
          </React.Fragment>)}
        </div>
        {isSel && (<div style={{ padding: "8px 14px", background: "rgba(206,147,216,0.03)", borderBottom: "1px solid var(--bd)" }}>
          {/* 사진 선택 UI */}
          {(function(){
            var photos = getPhotos(pl.name);
            if (photos === undefined) { loadPhotosForPlayer(pl.name); return null; }
            if (!photos || photos.length === 0) return null;
            return (
              <div style={{marginBottom:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:11,color:"var(--td)",flexShrink:0}}>{"선수사진:"}</span>
                {photos.map(function(url, i){
                  var isCur = pl.photoUrl === url;
                  var pos = (PHOTO_POS_MAP[pl.name]!==undefined?PHOTO_POS_MAP[pl.name]:20)+"%";
                  return (
                    <div key={i} onClick={function(){updatePl(pl.id,"photoUrl",isCur?"":url);}}
                      style={{cursor:"pointer",borderRadius:5,border:"2px solid "+(isCur?"var(--acc)":"transparent"),overflow:"hidden",opacity:isCur?1:0.6,transition:"all 0.15s"}}>
                      <img src={url} alt="" style={{width:40,height:56,objectFit:"cover",objectPosition:"center "+pos,display:"block"}} />
                    </div>
                  );
                })}
                {pl.photoUrl && (<button onClick={function(){updatePl(pl.id,"photoUrl","");}} style={{padding:"3px 8px",fontSize:10,background:"rgba(239,83,80,0.08)",border:"1px solid rgba(239,83,80,0.2)",borderRadius:4,color:"#EF5350",cursor:"pointer",flexShrink:0}}>{"사진 제거"}</button>)}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e} style={{background:"#1e293b",color:"#e2e8f0"}}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 13, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "trainC", pl.trainC, "#AB47BC")}<span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "trainS", pl.trainS, "#FF7043")}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "specChange", pl.specChange, "#AB47BC", 15)}<span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "specStuff", pl.specStuff, "#FF7043", 15)}</div></div>
            
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3 }}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType1||"장타억제"} onChange={function(e){updatePl(pl.id,"potType1",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_PIT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot1||""} onChange={function(e){updatePl(pl.id,"pot1",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:10,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType2||"침착"} onChange={function(e){updatePl(pl.id,"potType2",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_PIT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot2||""} onChange={function(e){updatePl(pl.id,"pot2",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:10,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div></div></div>
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"스킬 ("+getSkillCat(pl)+")"}</div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{skillInput(pl,1)}{skillInput(pl,2)}{skillInput(pl,3)}</div></div>
          </div>
        </div>)}
      </React.Fragment>
    );
  };

  var _teamDrop = useState(false); var teamDropOpen = _teamDrop[0]; var setTeamDrop = _teamDrop[1];
  var teamName = sdState.teamName || "";
  var selectTeam = function(t) { setSdState(function(prev) { return Object.assign({}, prev, {teamName: t}); }); setTeamDrop(false); };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 1200, paddingBottom: mob ? 80 : 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: mob ? "flex-start" : "center", justifyContent: "space-between", flexDirection: mob ? "column" : "row", gap: 8, marginBottom: 14, padding: mob ? 14 : "18px 20px", background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DeckDropdown decks={p.decks||[]} curDeckId={p.curDeckId} onSwitch={p.onSwitchDeck} onAdd={p.onAddDeck} onDelete={p.onDeleteDeck}/>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--td)" }}>{"가중치: 파워 " + LIVE_WEIGHTS.p + " / 정확 " + LIVE_WEIGHTS.a + " / 선구 " + LIVE_WEIGHTS.e + " / 변화 " + LIVE_WEIGHTS.c + " / 구위 " + LIVE_WEIGHTS.s}</p>
        </div>
        <div style={{ textAlign: mob ? "left" : "right" }}>
          <div style={{ fontSize: 9, color: "var(--td)", letterSpacing: 1 }}>{"TOTAL SCORE"}</div>
          <GS val={totalScore.toFixed(1)} size={mob ? 28 : 36} grad="linear-gradient(135deg,#FFD54F,#FF8F00,#F44336)" />
        </div>
      </div>

      {/* Diamond + Pitching */}
      <div style={{ display: "grid", gridTemplateColumns: (mob) ? "1fr" : "420px 1fr", gap: 14, marginBottom: 16 }}>
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14 }}>
          <DiamondView mobile={mob} slotMap={batSlotMap} onSlotClick={function(pos) { setPickerSlot(pos); }} />
        </div>
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", letterSpacing: 1, marginBottom: 8 }}>{"STARTING ROTATION"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SP_SLOTS.map(function(pos) { var pl = pick(pos); return pl ? (<div key={pl.id} onClick={function() { setPickerSlot(pos); }} style={{ cursor: "pointer" }}><PCard p={pl} /></div>) : (<div key={pos} onClick={function() { setPickerSlot(pos); }} style={{ width: 52, height: 72, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--re)" }}><span style={{ fontSize: 9, color: "var(--td)" }}>{pos}</span></div>); })}
            </div>
          </div>
          <BullpenLayout mobile={mob} relievers={rpPl} closers={cpPl} rpSlots={rpSlotData} onSlotClick={function(slot) { setPickerSlot(slot); }} bpcIdx={bpcIdx} setBpcIdx={setBpcIdx} isWinSplit={isWinSplit} setIsWinSplit={setIsWinSplit} />
        </div>
      </div>

      {/* Tables */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 12 }}>
        <SH title="타선" icon="⚔️" count={diamondPl + "/9"} color="#FFD54F" />
        <div style={{ overflowX: "auto" }}>{lBats.map(function(x, i) { return batRow(x.slot, x.pl, i); })}</div>
      </div>
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 12 }}>
        <SH title="선발 로테이션" icon="🔥" count={spPl.length + "/5"} color="#AB47BC" />
        <div style={{ overflowX: "auto" }}>{lSP.map(function(x, i) { return pitRow(x.slot, x.pl, i, false); })}</div>
      </div>
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 12 }}>
        <SH title="중계진" icon="💪" count={rpPl.length + "/6"} color="#42A5F5" />
        <div style={{ overflowX: "auto" }}>{lRP.map(function(x, i) { return pitRow(x.slot, x.pl, i, true); })}</div>
      </div>
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 12 }}>
        <SH title="마무리" icon="🔒" count={cpPl.length + "/1"} color="#EF5350" />
        <div style={{ overflowX: "auto" }}>{pitRow("CP", lCP.pl, 0, false)}</div>
      </div>

      {/* 후보선수 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 12 }}>
        <SH title="후보선수" icon="🪑" count={[1,2,3,4,5,6].filter(function(n) { return pick("BN" + n); }).length + "/6"} color="#78909C" />
        <div style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
            {[1,2,3,4,5,6].map(function(n) {
              var bnSlot = "BN" + n;
              var bnPl = pick(bnSlot);
              if (bnPl) {
                var colors = {"골든글러브":"#D4AF37","시그니처":"#C0392B","국가대표":"#2E86C1","임팩트":"#7D3C98","라이브":"#E67E22"};
                var bg = colors[bnPl.cardType] || "#555";
                return (
                  <div key={n} onClick={function() { setPickerSlot(bnSlot); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 6, borderRadius: 8, border: "1px solid " + bg + "44", background: bg + "10", cursor: "pointer" }}>
                    <div style={{ width: 42, height: 56, borderRadius: 5, background: "linear-gradient(180deg," + bg + "44," + bg + "22)", border: "1px solid " + bg + "66", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 16, opacity: 0.4 }}>{"⚾"}</span>
                      <span style={{ fontSize: 7, color: "#fff", fontWeight: 700 }}>{bnPl.subPosition}</span>
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{bnPl.name.replace(/\d+$/, "")}</span>
                    <Badge type={bnPl.cardType} />
                  </div>
                );
              }
              return (
                <div key={n} onClick={function() { setPickerSlot(bnSlot); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 10, borderRadius: 8, border: "1px dashed var(--bd)", background: "var(--inner)", cursor: "pointer" }}>
                  <div style={{ width: 42, height: 56, borderRadius: 5, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 16, opacity: 0.15 }}>{"+"}</span>
                  </div>
                  <span style={{ fontSize: 9, color: "var(--td)" }}>{"후보 " + n}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 9, color: "var(--td)", marginTop: 8, textAlign: "center" }}>{"후보선수는 세트덱 포인트에 기여합니다"}</p>
        </div>
      </div>

      {/* Set Deck Toggle Arrow */}
      <button onClick={function() { setSdOpen(!sdOpen); }} style={{
        position: "fixed", right: sdOpen ? (mob ? 260 : 300) : 0, top: "50%", transform: "translateY(-50%)",
        width: 28, height: 56, borderRadius: "8px 0 0 8px", zIndex: 191,
        background: "linear-gradient(180deg,rgba(255,213,79,0.15),rgba(255,143,0,0.1))",
        border: "1px solid rgba(255,213,79,0.2)", borderRight: "none",
        color: "var(--acc)", cursor: "pointer", fontSize: 14, fontWeight: 700,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "right 0.3s ease", boxShadow: "-2px 0 12px rgba(0,0,0,0.3)"
      }}>
        {sdOpen ? "▶" : "◀"}
      </button>

      {/* Set Deck Panel */}
      <SetDeckPanel open={sdOpen} onClose={function() { setSdOpen(false); }} mobile={mob}
        setPoint={setPoint} liveSetPo={sdState.liveSetPo || 0}
        sdState={sdState} setSdState={setSdState} players={players} lineupMap={lm} />

      {/* Player Selector Popup */}
      {pickerSlot && (
        <PlayerSelector slot={pickerSlot} players={players.map(function(pl){return mergePl(pl)||pl;})} onSelect={function(pid) { assignSlot(pickerSlot, pid); }} onClose={function() { setPickerSlot(null); }} />
      )}
    </div>
  );
}


/* Position training: cumulative stat gains per level (from Excel) */
var POS_TRAIN = {
  "C":  {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,3,3,3,3,4,4,4,5,5,7],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,2,2,3,4,4,5,6,6,6],"선구":[0,0,0,0,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,4]},
  "1B": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,3,3,4,4,4,4,5,6,6,8],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,5,6,6,7,7],"선구":[0,0,0,0,1,1,1,1,1,1,2,2,3,3,3,4,5,5,6,7,7]},
  "2B": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,2,2,2,2,3,3,3,4,4,5],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,4,5,5,5,6],"선구":[0,0,0,0,1,1,1,1,1,1,1,2,3,3,3,3,5,5,5,6,6]},
  "3B": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,3,3,4,4,4,4,5,6,6,8],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,5,6,6,7,7],"선구":[0,0,0,0,1,1,1,1,1,1,2,2,3,3,3,4,5,5,6,7,7]},
  "SS": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,2,2,2,2,3,3,3,4,4,5],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,4,5,5,5,6],"선구":[0,0,0,0,1,1,1,1,1,1,1,2,3,3,3,3,5,5,5,6,6]},
  "LF": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,3,3,3,3,3,3,4,4,5,5,7],"정확":[0,0,0,0,0,0,1,1,2,2,2,2,2,3,3,4,4,5,5,6,6],"선구":[0,0,0,0,1,1,1,1,1,1,1,1,3,3,3,3,4,5,5,6,6]},
  "CF": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,2,2,2,2,2,2,2,3,3,4],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,2,2,3,4,4,5,5,6,6],"선구":[0,0,0,0,1,1,1,1,1,1,1,1,3,3,3,3,5,5,5,6,6]},
  "RF": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,2,2,2,2,3,3,3,4,4,5],"정확":[0,1,1,1,1,1,1,1,2,2,2,2,3,3,3,4,4,5,6,6,6],"선구":[0,0,0,0,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,6,7]},
  "DH": {mx:20,"파워":[0,0,0,0,0,0,1,1,1,2,2,2,3,3,3,4,4,4,5,5,7],"정확":[0,1,1,1,1,1,1,1,2,2,3,3,3,3,4,5,5,6,7,7,7],"선구":[0,0,0,0,1,1,1,1,1,1,1,1,2,3,3,3,5,5,5,7,7]},
  "SP1":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,2,3,3,3,3,3,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,3,3,3,3,5,5,5,6,6,8,8]},
  "SP2":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,3,3,3,3,3,4,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,2,3,4,4,5,5,6,7]},
  "SP3":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,3,3,3,3,3,3,4,4,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,3,3,3,4,4,4,6,6,7,7]},
  "SP4":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,3,3,3,3,3,4,4,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,3,4,4,4,5,5,7,7]},
  "SP5":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,3,3,3,4,4,4,4,6,6,7],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,3,3,4,4,4,6,6,7,7]},
  "RP1":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,2,3,3,3,3,3,4,4,6],"구위":[0,0,1,1,1,1,1,2,2,2,3,3,3,3,5,5,5,6,7,8,8]},
  "RP2":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,3,3,3,3,4,4,4,5,6,7],"구위":[0,0,1,1,1,1,1,2,2,2,3,3,3,3,4,4,5,6,6,7,7]},
  "RP3":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,3,3,3,3,4,4,5,5,7],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,2,4,4,4,5,5,7,7]},
  "RP4":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,2,3,3,3,3,3,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,3,3,4,5,5,6,6,7,8]},
  "RP5":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,3,3,3,3,3,3,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,3,4,4,5,5,6,7,7]},
  "RP6":{mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,2,3,3,3,3,3,3,5,5,6],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,3,4,4,5,5,6,7,7]},
  "CP": {mx:20,"변화":[0,0,0,0,0,0,1,1,1,1,2,3,3,3,3,4,4,4,5,5,7],"구위":[0,0,1,1,1,1,1,2,2,2,2,2,2,3,4,4,4,6,7,8,8]},
};
var RS_OPTS = ["0","1","2","3","4","5","6"];

function PosTrainRow(rp) {
  var pos = rp.pos; var pt = POS_TRAIN[pos]; var d = rp.d; var upd = rp.upd; var colors = rp.colors; var stats = rp.stats; var idx = rp.idx;
  var mx = pt.mx;
  var lvOpts = []; for (var _i = 0; _i <= mx; _i++) lvOpts.push(String(_i));
  var lv = Math.min(d.level, mx);
  var colTpl = "70px 56px " + stats.map(function() { return "1fr"; }).join(" ");
  return (
    <div style={{ display: "grid", gridTemplateColumns: colTpl, gap: 6, padding: "6px 14px", alignItems: "center", background: idx % 2 === 0 ? "var(--re)" : "transparent", borderBottom: "1px solid var(--bd)" }}>
      <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: 11 }}>{pos}</div>
      <div style={{ textAlign: "center" }}>
        <select value={String(lv)} onChange={function(e) { upd(pos, "level", parseInt(e.target.value)); }} style={{ width: 50, padding: "4px 2px", textAlign: "center", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
          {lvOpts.map(function(v) { return (<option key={v} value={v}>{v}</option>); })}
        </select>
        <div style={{ fontSize: 7, color: "var(--td)", marginTop: 1 }}>{"/" + mx}</div>
      </div>
      {stats.map(function(stat, i) {
        var arr = pt[stat] || [];
        var base = lv < arr.length ? arr[lv] : (arr[arr.length - 1] || 0);
        var reset = d["r" + i] || 0;
        return (
          <div key={stat} style={{ display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}>
            <span style={{ fontSize: 10, color: colors[i], fontFamily: "var(--m)", fontWeight: 800 }}>{base}</span>
            <span style={{ fontSize: 9, color: "var(--td)" }}>{"+"}</span>
            <select value={String(reset)} onChange={function(e) { upd(pos, "r" + i, parseInt(e.target.value)); }} style={{ width: 34, padding: "4px 1px", textAlign: "center", background: "#1e293b", border: "1px solid " + colors[i] + "88", borderRadius: 4, color: colors[i], fontSize: 11, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
              {RS_OPTS.map(function(v) { return (<option key={v} value={v}>{v}</option>); })}
            </select>
            <span style={{ fontSize: 9, color: "var(--td)" }}>{"="}</span>
            <span style={{ fontSize: 11, color: colors[i], fontFamily: "var(--m)", fontWeight: 800 }}>{base + reset}</span>
          </div>
        );
      })}
    </div>
  );
}

function PosTrainPage(p) {
  var mob = p.mobile;
  var sdState = p.sdState || {};
  var setSdState = p.setSdState;
  var groups = [
    { label: "타자", poss: ["C","1B","2B","3B","SS","LF","CF","RF","DH"], stats: ["파워","정확","선구"], colors: ["#EF5350","#42A5F5","#66BB6A"] },
    { label: "선발", poss: ["SP1","SP2","SP3","SP4","SP5"], stats: ["변화","구위"], colors: ["#AB47BC","#FF7043"] },
    { label: "중계", poss: ["RP1","RP2","RP3","RP4","RP5","RP6"], stats: ["변화","구위"], colors: ["#AB47BC","#FF7043"] },
    { label: "마무리", poss: ["CP"], stats: ["변화","구위"], colors: ["#AB47BC","#FF7043"] },
  ];
  /* Init posTrain in sdState if missing */
  var ptKey = function(pos) { return "pt_" + pos; };
  var getPT = function(pos) {
    var d = sdState[ptKey(pos)];
    if (d) return d;
    return { level: POS_TRAIN[pos].mx, r0: 0, r1: 0, r2: 0 };
  };
  var upd = function(pos, field, val) {
    setSdState(function(prev) {
      var c = Object.assign({}, prev);
      var cur = Object.assign({}, getPT(pos));
      cur[field] = typeof val === "number" ? val : 0;
      c[ptKey(pos)] = cur;
      return c;
    });
  };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 900, paddingBottom: mob ? 80 : 18 }}>
      <h2 style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)", margin: "0 0 4px" }}>{"포지션 특훈"}</h2>
      <p style={{ fontSize: 10, color: "var(--td)", margin: "0 0 12px" }}>{"계정 귀속 - 포지션별 레벨과 재설정 효과를 입력하세요"}</p>
      {groups.map(function(grp) {
        return (
          <div key={grp.label} style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--bd)", background: "rgba(255,213,79,0.02)" }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", letterSpacing: 1 }}>{grp.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "70px 56px " + grp.stats.map(function() { return "1fr"; }).join(" "), gap: 6, padding: "6px 14px", borderBottom: "1px solid var(--bd)", fontSize: 9, fontWeight: 700, color: "var(--td)" }}>
              <div>{"포지션"}</div>
              <div style={{ textAlign: "center" }}>{"레벨"}</div>
              {grp.stats.map(function(s, i) { return (<div key={s} style={{ textAlign: "center", color: grp.colors[i] }}>{s + " (기본+재설정)"}</div>); })}
            </div>
            {grp.poss.map(function(pos, idx) {
              return (<PosTrainRow key={pos} pos={pos} d={getPT(pos)} upd={upd} colors={grp.colors} stats={grp.stats} idx={idx} />);
            })}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================
   LOGIN + ADMIN
   ================================================================ */
/* ================================================================
   AUTH - Google OAuth + Guest
   Google: 서버 DB 저장, 여러 팀 관리 가능
   Guest: localStorage 저장, 1팀만 관리
   ================================================================ */
/* Auth handled by Supabase */

function LoginPage(p) {
  var mob = useMedia("(max-width:600px)");
  var _ld = useState(false); var ld = _ld[0]; var setLd = _ld[1];
  var _guestOpen = useState(false); var guestOpen = _guestOpen[0]; var setGuestOpen = _guestOpen[1];
  var _nick = useState(""); var nick = _nick[0]; var setNick = _nick[1];

  var googleLogin = function() {
    if (supabase) {
      setLd(true);
      signInWithGoogle().then(function(res) {
        if (res.error) { alert("로그인 실패: " + res.error.message); setLd(false); }
      });
    } else {
      setLd(true);
      setTimeout(function() { p.onLogin("Google 사용자", "google", false); }, 800);
    }
  };

  var guestLogin = function() {
    if (!nick.trim()) return;
    setLd(true);
    setTimeout(function() { p.onLogin(nick, "guest", false); }, 500);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a0e17,#1a1028,#0d1117)", padding: mob ? 16 : 0 }}>
      <div style={{ width: mob ? "100%" : 420, maxWidth: 460, padding: mob ? "36px 24px" : "48px 40px", background: "rgba(15,20,30,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{"⚾"}</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, fontFamily: "var(--h)", letterSpacing: 4, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent" }}>{"DECK MANAGER"}</h1>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, fontFamily: "var(--m)", letterSpacing: 2 }}>{"컴투스 프로야구 v26"}</p>
        </div>

        {/* Google Login - Main CTA */}
        <button onClick={googleLogin} disabled={ld} style={{
          width: "100%", padding: "16px 24px", fontSize: 15, fontWeight: 700,
          background: "#fff", color: "#3c4043", border: "none", borderRadius: 12,
          cursor: ld ? "wait" : "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", gap: 12, minHeight: 54, marginBottom: 10,
          boxShadow: "0 2px 12px rgba(0,0,0,0.25)", transition: "transform 0.1s, box-shadow 0.2s"
        }}>
          <svg width="22" height="22" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {ld ? "로그인 중..." : "Google 계정으로 시작하기"}
        </button>

        {/* Google benefits */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          {["여러 팀 관리", "클라우드 저장", "기기 간 동기화"].map(function(t) {
            return (<span key={t} style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)", padding: "3px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>{t}</span>);
          })}
        </div>

        {/* Guest link */}
        {!guestOpen ? (
          <div style={{ textAlign: "center" }}>
            <button onClick={function() { setGuestOpen(true); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 12, padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}>
              {"게스트로 시작하기"}
            </button>
            <p style={{ fontSize: 9, color: "rgba(255,255,255,0.15)", marginTop: 4 }}>{"1개 팀만 관리 가능 · 브라우저에 데이터 저장"}</p>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 8 }}>{"게스트 모드"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" value={nick} onChange={function(e) { setNick(e.target.value); }} placeholder="닉네임 입력" onKeyDown={function(e) { if (e.key === "Enter") guestLogin(); }}
                style={{ flex: 1, padding: "10px 14px", fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box" }} />
              <button onClick={guestLogin} disabled={ld} style={{ padding: "10px 20px", fontSize: 13, fontWeight: 800, background: ld ? "rgba(255,213,79,0.2)" : "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 8, cursor: ld ? "wait" : "pointer", color: "#1a1100", fontFamily: "var(--h)", whiteSpace: "nowrap" }}>
                {ld ? "..." : "시작"}
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 10, padding: "8px 10px", background: "rgba(255,152,0,0.05)", borderRadius: 6, border: "1px solid rgba(255,152,0,0.1)" }}>
              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{"!"}</span>
              <p style={{ fontSize: 9, color: "rgba(255,152,0,0.5)", margin: 0, lineHeight: 1.5 }}>{"게스트 데이터는 이 브라우저에만 저장됩니다. 브라우저 데이터 삭제 시 초기화될 수 있으며, 1개 팀만 관리 가능합니다. Google 계정 연동 시 여러 팀을 영구 저장할 수 있습니다."}</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.12)", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
          {"로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다"}
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   NAV (with admin toggle for DB page)
   ================================================================ */
/* ── 덱 드롭다운: 팀 이름 클릭 → 내 덱 리스트 + 추가 버튼 ── */
function DeckDropdown(p){
  /* props: decks, curDeckId, onSwitch(deckId), onAdd(), onDelete(deckId) */
  var _open=useState(false);var open=_open[0];var setOpen=_open[1];
  var _confirmDel=useState(null);var confirmDel=_confirmDel[0];var setConfirmDel=_confirmDel[1];
  var cur=(p.decks||[]).find(function(d){return d.deckId===p.curDeckId;})||(p.decks&&p.decks[0])||null;
  var label=cur?cur.teamName:"팀 선택";
  var canAdd=(p.decks||[]).length<5;
  return(
    <div style={{position:"relative"}}>
      <button onClick={function(){setOpen(!open);setConfirmDel(null);}}
        style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--acc)",cursor:"pointer",fontSize:12,fontWeight:800,fontFamily:"var(--h)",letterSpacing:1,maxWidth:160}}>
        <span style={{fontSize:14}}>⚾</span>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
        <span style={{fontSize:8,color:"var(--td)",marginLeft:"auto"}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <React.Fragment>
          <div onClick={function(){setOpen(false);setConfirmDel(null);}} style={{position:"fixed",inset:0,zIndex:299}}/>
          <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,minWidth:200,zIndex:300,background:"var(--side)",border:"1px solid var(--bd)",borderRadius:8,overflow:"hidden",boxShadow:"0 8px 24px rgba(0,0,0,0.6)"}}>
            {(p.decks||[]).map(function(d){
              var isCur=d.deckId===p.curDeckId;
              var isDel=confirmDel===d.deckId;
              return(
                <div key={d.deckId} style={{display:"flex",alignItems:"center",borderBottom:"1px solid var(--bd)",background:isCur?"rgba(255,213,79,0.06)":"transparent"}}>
                  <button onClick={function(){p.onSwitch(d.deckId);setOpen(false);setConfirmDel(null);}}
                    style={{flex:1,display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"transparent",border:"none",color:isCur?"var(--acc)":"var(--t1)",fontSize:12,fontWeight:isCur?800:500,cursor:"pointer",textAlign:"left"}}>
                    {isCur&&<span style={{fontSize:8}}>▶</span>}
                    <span>{d.teamName}</span>
                  </button>
                  {isDel?(
                    <div style={{display:"flex",gap:4,padding:"0 8px"}}>
                      <button onClick={function(e){e.stopPropagation();p.onDelete(d.deckId);setConfirmDel(null);setOpen(false);}}
                        style={{padding:"3px 8px",fontSize:10,background:"#c62828",border:"none",borderRadius:4,color:"#fff",cursor:"pointer",fontWeight:700}}>{"삭제"}</button>
                      <button onClick={function(e){e.stopPropagation();setConfirmDel(null);}}
                        style={{padding:"3px 8px",fontSize:10,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"취소"}</button>
                    </div>
                  ):(
                    <button onClick={function(e){e.stopPropagation();setConfirmDel(d.deckId);}}
                      title="덱 삭제"
                      style={{padding:"0 10px",height:"100%",background:"transparent",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:14,lineHeight:1}}
                      onMouseEnter={function(e){e.currentTarget.style.color="#ef5350";}}
                      onMouseLeave={function(e){e.currentTarget.style.color="rgba(255,255,255,0.2)";}}
                    >{"✕"}</button>
                  )}
                </div>
              );
            })}
            {canAdd&&(
              <button onClick={function(){p.onAdd();setOpen(false);}}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",background:"transparent",border:"none",color:"#81C784",fontSize:12,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
                <span>{"＋ 덱 추가"}</span>
                <span style={{fontSize:9,color:"var(--td)"}}>{(p.decks||[]).length+"/5"}</span>
              </button>
            )}
            {!canAdd&&(
              <div style={{padding:"8px 14px",fontSize:10,color:"var(--td)",textAlign:"center"}}>{"최대 5개 · ✕ 버튼으로 삭제 가능"}</div>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
}

function Nav(p){
  var _o=useState(false);var open=_o[0];var setOpen=_o[1];
  var tabs=[{id:"lineup",label:"라인업",icon:"📋"},{id:"myplayers",label:"내 선수",icon:"👥"},{id:"postrain",label:"포지션 특훈",icon:"🏋️"},{id:"locker",label:"라커룸",icon:"🏠"},{id:"datacenter",label:"데이터센터",icon:"📊"},{id:"clublounge",label:"클럽라운지",icon:"🎙️"}];
  if(p.isAdmin){tabs.splice(4,0,{id:"db",label:"선수 도감",icon:"📖"},{id:"skills",label:"스킬 관리",icon:"⚡"},{id:"enhance",label:"강화 테이블",icon:"📊"});}
  var deckProps={decks:p.decks||[],curDeckId:p.curDeckId,onSwitch:p.onSwitchDeck,onAdd:p.onAddDeck,onDelete:p.onDeleteDeck};

  if(p.mobile){return(
    <React.Fragment>
      <div style={{position:"fixed",top:0,left:0,right:0,height:44,zIndex:110,background:"var(--side)",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",padding:"0 10px",gap:8}}>
        <span style={{fontSize:10,fontWeight:900,fontFamily:"var(--h)",background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",whiteSpace:"nowrap"}}>{"DECK"}</span>
        <DeckDropdown {...deckProps}/>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"var(--side)",borderTop:"1px solid var(--bd)",display:"flex",padding:"6px 0 8px"}}>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 0",background:"none",border:"none",color:p.tab===t.id?"var(--acc)":"var(--td)",cursor:"pointer",minHeight:44}}><span style={{fontSize:18}}>{t.icon}</span><span style={{fontSize:9,fontWeight:p.tab===t.id?700:500}}>{t.label}</span></button>);})}
      </div>
    </React.Fragment>
  );}

  if(p.tablet){return(
    <React.Fragment>
      <button onClick={function(){setOpen(!open);}} style={{position:"fixed",top:10,left:10,zIndex:200,width:40,height:40,borderRadius:8,background:"var(--card)",border:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"var(--t1)"}}>{open?"✕":"☰"}</button>
      {open&&(<div onClick={function(){setOpen(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:150}}/>)}
      <div style={{position:"fixed",left:open?0:-260,top:0,bottom:0,width:240,background:"var(--side)",borderRight:"1px solid var(--bd)",zIndex:160,transition:"left 0.25s ease",display:"flex",flexDirection:"column",padding:"14px 0 16px"}}>
        <div style={{padding:"0 14px 12px"}}><DeckDropdown {...deckProps}/></div>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"12px 16px",background:p.tab===t.id?"var(--ta)":"transparent",border:"none",borderLeft:p.tab===t.id?"3px solid #FFD54F":"3px solid transparent",color:p.tab===t.id?"var(--t1)":"var(--t2)",fontSize:12,fontWeight:p.tab===t.id?700:500,cursor:"pointer",textAlign:"left",minHeight:44}}><span style={{fontSize:16}}>{t.icon}</span>{t.label}</button>);})}
        <div style={{marginTop:"auto",padding:"12px 16px",borderTop:"1px solid var(--bd)"}}>
          {p.isAdmin&&(<div style={{fontSize:9,color:"var(--acc)",marginBottom:8,padding:"4px 0"}}>{"👑 관리자"}</div>)}
          <button onClick={p.logout} style={{width:"100%",padding:8,fontSize:10,background:"rgba(255,255,255,0.03)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"로그아웃"}</button>
        </div>
      </div>
    </React.Fragment>
  );}

  return(
    <div style={{width:200,minHeight:"100vh",background:"var(--side)",borderRight:"1px solid var(--bd)",display:"flex",flexDirection:"column",padding:"14px 0",flexShrink:0}}>
      <div style={{padding:"0 14px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:18}}>{"⚾"}</span><div><div style={{fontSize:11,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:"transparent"}}>{"DECK MANAGER"}</div><div style={{fontSize:7,color:"var(--td)",letterSpacing:1}}>{"COM2US PRO BASEBALL v26"}</div></div></div>
        <DeckDropdown {...deckProps}/>
      </div>
      <div style={{flex:1}}>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);}} style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"10px 14px",background:p.tab===t.id?"var(--ta)":"transparent",border:"none",borderLeft:p.tab===t.id?"3px solid #FFD54F":"3px solid transparent",color:p.tab===t.id?"var(--t1)":"var(--t2)",fontSize:11,fontWeight:p.tab===t.id?700:500,cursor:"pointer",textAlign:"left",minHeight:40}}><span style={{fontSize:13}}>{t.icon}</span>{t.label}</button>);})}
      </div>
      <div style={{padding:"10px 14px",borderTop:"1px solid var(--bd)"}}>
        {p.isAdmin&&(<div style={{fontSize:9,color:"var(--acc)",marginBottom:8,padding:"4px 0"}}>{"👑 관리자"}</div>)}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          {p.authType==="google"?(
            <div style={{width:26,height:26,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            </div>
          ):(
            <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#FFD54F,#FF8F00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#1a1100"}}>{p.user[0]}</div>
          )}
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--t1)"}}>{p.user}</div><div style={{fontSize:7,color:"var(--td)"}}>{p.authType==="google"?"Google 계정":"게스트"}</div></div>
        </div>
        <button onClick={p.logout} style={{width:"100%",padding:5,fontSize:9,background:"rgba(255,255,255,0.03)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"로그아웃"}</button>
      </div>
    </div>
  );
}

/* ================================================================
   ENHANCE TABLE PAGE
   ================================================================ */
function EnhancePage(p){
  var mob=p.mobile;var _t=useState("골든글러브");var vt=_t[0];var setVt=_t[1];
  var table=ENHANCE[vt];var stats=Object.keys(table||{});
  var hdrs=(vt==="시즌"||vt==="올스타")?ENHANCE_LEVELS.slice(0,6):ENHANCE_LEVELS;
  return(
    <div style={{padding:mob?12:18,maxWidth:900,paddingBottom:mob?80:18}}>
      <h2 style={{fontSize:mob?16:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 12px"}}>{"강화/각성 참조 테이블"}</h2>
      <div style={{display:"flex",gap:4,marginBottom:14,flexWrap:"wrap"}}>
        {Object.keys(ENHANCE).map(function(ct){return(<button key={ct} onClick={function(){setVt(ct);}} style={{padding:"6px 12px",borderRadius:5,fontSize:11,fontWeight:ct===vt?800:500,background:ct===vt?"var(--ta)":"var(--inner)",color:ct===vt?"var(--acc)":"var(--t2)",border:ct===vt?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{ct}</button>);})}
      </div>
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
            <thead><tr>
              <th style={{padding:"8px 10px",textAlign:"left",color:"var(--td)",borderBottom:"1px solid var(--bd)",fontWeight:600}}>{"능력치"}</th>
              {hdrs.map(function(h){return(<th key={h} style={{padding:"8px 6px",textAlign:"center",color:"var(--td)",borderBottom:"1px solid var(--bd)",fontWeight:600,fontFamily:"var(--m)",fontSize:10,whiteSpace:"nowrap"}}>{h}</th>);})}
            </tr></thead>
            <tbody>{stats.map(function(st,si){var arr=table[st];var sc={"파워":"#EF5350","정확":"#42A5F5","선구":"#66BB6A","변화":"#AB47BC","구위":"#FF7043"};return(
              <tr key={st}><td style={{padding:"6px 10px",color:sc[st]||"var(--t1)",fontWeight:700,borderBottom:"1px solid var(--bd)"}}>{st}</td>
              {hdrs.map(function(h,hi){return(<td key={h} style={{padding:"6px",textAlign:"center",fontFamily:"var(--m)",color:"var(--t1)",borderBottom:"1px solid var(--bd)",background:si%2===0?"var(--re)":"transparent"}}>{arr[hi+4]||0}</td>);})}</tr>
            );})}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   LOCKER ROOM - 주장, 유니폼, POTM
   ================================================================ */
function LockerRoomPage(p) {
  var mob = p.mobile;
  var players = p.players;
  var save = p.savePlayers;
  var lm = p.lineupMap || {};
  var sdState = p.sdState || {};
  var setSdState = p.setSdState;
  var isAdmin = p.isAdmin;

  var byId = function(id) { if (!id) return null; for (var i = 0; i < players.length; i++) { if (players[i].id === id) return players[i]; } return null; };
  var upd = function(key, val) {
    setSdState(function(prev) {
      var c = Object.assign({}, prev);
      c[key] = val;
      /* 즉시 Supabase 저장 */
      if (p.saveSdState) p.saveSdState(c);
      return c;
    });
  };
  var _newPotm = useState(""); var newPotm = _newPotm[0]; var setNewPotm = _newPotm[1];

  var BAT_SLOTS = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  var PIT_SLOTS = ["SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP"];
  var lineupBats = BAT_SLOTS.map(function(s) { return byId(lm[s]); }).filter(Boolean);
  var lineupPits = PIT_SLOTS.map(function(s) { return byId(lm[s]); }).filter(Boolean);

  var batCapId = sdState.capBatId || "";
  var pitCapId = sdState.capPitId || "";
  var batCap = byId(batCapId);
  var pitCap = byId(pitCapId);

  var miniStat = function(label, color, key, val) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 9, color: color, fontWeight: 700 }}>{label}</span>
        <input type="number" value={val || 0} onChange={function(e) { upd(key, parseInt(e.target.value) || 0); }}
          style={{ width: 30, padding: "3px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid " + color + "44", borderRadius: 3, color: color, fontSize: 11, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />
      </div>
    );
  };

  /* POTM roster - potmList: [{id, name, team, cardType, stars}] */
  var potmList = sdState.potmList || [];
  var _potmSearch = useState(""); var potmSearch = _potmSearch[0]; var setPotmSearch = _potmSearch[1];
  var _potmSearchOpen = useState(false); var potmSearchOpen = _potmSearchOpen[0]; var setPotmSearchOpen = _potmSearchOpen[1];

  var addPotmPlayer = function(sp) {
    var already = potmList.some(function(x) { return x.name === sp.name; });
    if (already) return;
    /* 이름+팀 저장 - 같은 팀의 같은 이름 선수에게만 POTM 적용 */
    upd("potmList", potmList.concat([{name: sp.name, team: sp.team || ""}]));
    setPotmSearch(""); setPotmSearchOpen(false);
  };
  var rmPotm = function(idx) { upd("potmList", potmList.filter(function(_, i) { return i !== idx; })); };

  /* 선수도감 검색 결과 - 라이브 카드 우선, 이름 기준 중복 제거 */
  var potmSearchResults = (function() {
    if (potmSearch.trim().length < 1) return [];
    var q = potmSearch.trim();
    /* 라이브 카드 먼저, 나머지 뒤 */
    var live = SEED_PLAYERS.filter(function(sp) { return sp.cardType === '라이브'; });
    var others = SEED_PLAYERS.filter(function(sp) { return sp.cardType !== '라이브'; });
    var ordered = live.concat(others);
    var seen = {};
    var results = [];
    ordered.forEach(function(sp) {
      if (!sp.name) return;
      if (seen[sp.name]) return;
      if (sp.name.indexOf(q) >= 0 || (sp.team && sp.team.indexOf(q) >= 0)) {
        seen[sp.name] = true;
        results.push(sp);
      }
    });
    return results.slice(0, 10);
  })();

  /* 유저 내 선수 중 POTM 매칭 (dbId 기준) */
  var potmMatched = [];
  players.forEach(function(pl) {
    var dbId = pl.dbId || pl.id;
    var found = potmList.some(function(p) { return p.name === (pl.name||"") && p.team === (pl.team||""); });
    if (found && potmMatched.indexOf(pl) < 0) potmMatched.push(mergePl(pl));
  });

  var updPotm = function(id, field, val) {
    save(players.map(function(x) { if (x.id !== id) return x; var c = Object.assign({}, x); c[field] = parseInt(val) || 0; return c; }));
  };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 800, paddingBottom: mob ? 80 : 18 }}>
      <h2 style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)", margin: "0 0 16px" }}>{"라커룸"}</h2>

      {/* Captain selection + bonus */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {/* 타자 주장 */}
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>{"👑"}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--acc)", fontFamily: "var(--h)" }}>{"타자 주장"}</span>
          </div>
          <select value={batCapId} onChange={function(e) { upd("capBatId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupBats.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + (pl.subPosition ? " (" + pl.subPosition + ")" : "")}</option>); })}
          </select>
          {batCap && (<div style={{ padding: "6px 8px", background: "var(--ta)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={batCap.cardType} /><span style={{ fontWeight: 700, fontSize: 12, color: "var(--t1)" }}>{batCap.name}</span><span style={{ fontSize: 14, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (주장 본인에게만 적용)"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {miniStat("파", "#EF5350", "capBatP", sdState.capBatP)}
            {miniStat("정", "#42A5F5", "capBatA", sdState.capBatA)}
            {miniStat("선", "#66BB6A", "capBatE", sdState.capBatE)}
          </div>
        </div>

        {/* 투수 주장 */}
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>{"👑"}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--acp)", fontFamily: "var(--h)" }}>{"투수 주장"}</span>
          </div>
          <select value={pitCapId} onChange={function(e) { upd("capPitId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupPits.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + (pl.subPosition ? " (" + pl.subPosition + ")" : "")}</option>); })}
          </select>
          {pitCap && (<div style={{ padding: "6px 8px", background: "rgba(206,147,216,0.06)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pitCap.cardType} /><span style={{ fontWeight: 700, fontSize: 12, color: "var(--t1)" }}>{pitCap.name}</span><span style={{ fontSize: 14, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (주장 본인에게만 적용)"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {miniStat("변", "#AB47BC", "capPitC", sdState.capPitC)}
            {miniStat("구", "#FF7043", "capPitS", sdState.capPitS)}
          </div>
        </div>
      </div>

      {/* 유니폼 효과 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 14 }}>{"👕"}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"유니폼 효과"}</span>
          <span style={{ fontSize: 9, color: "var(--td)", marginLeft: 4 }}>{"(모든 선수 적용)"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{k:"uniP",l:"파워",c:"#EF5350"},{k:"uniA",l:"정확",c:"#42A5F5"},{k:"uniE",l:"선구",c:"#66BB6A"},{k:"uniC",l:"변화",c:"#AB47BC"},{k:"uniS",l:"구위",c:"#FF7043"}].map(function(s) {
            return (
              <div key={s.k} style={{ background: "var(--inner)", borderRadius: 6, padding: "8px 10px", border: "1px solid " + s.c + "22", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: s.c, fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                  <span style={{ fontSize: 12, color: s.c }}>{"+"}</span>
                  <input type="number" value={sdState[s.k] || 0} onChange={function(e) { upd(s.k, parseInt(e.target.value) || 0); }}
                    style={{ width: 32, padding: "4px 2px", textAlign: "center", background: "rgba(0,0,0,0.2)", border: "1px solid " + s.c + "44", borderRadius: 4, color: s.c, fontSize: 16, fontFamily: "var(--m)", fontWeight: 800, outline: "none" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* POTM */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>{"🌟"}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#FFD54F", fontFamily: "var(--h)" }}>{"POTM (이달의 선수)"}</span>
          </div>
          <button onClick={function() { upd("potmList", []); }} style={{ padding: "3px 8px", fontSize: 8, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 3, color: "#EF5350", cursor: "pointer" }}>{"명단 초기화"}</button>
        </div>

        {/* Admin: manage POTM roster - 선수도감 검색 */}
        {isAdmin && (
          <div style={{ padding: 10, background: "var(--inner)", borderRadius: 8, border: "1px solid var(--bd)", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 6 }}>{"관리자: POTM 선수 지정 (선수도감 검색)"}</div>
            <div style={{ position: "relative", marginBottom: 8 }} onBlur={function(e) { if (!e.currentTarget.contains(e.relatedTarget)) setPotmSearchOpen(false); }}>
              <input type="text" value={potmSearch} onChange={function(e) { setPotmSearch(e.target.value); setPotmSearchOpen(true); }}
                onFocus={function() { setPotmSearchOpen(true); }}
                placeholder="선수 이름 또는 팀 검색..."
                style={{ width: "100%", padding: "7px 10px", fontSize: 12, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none", boxSizing: "border-box" }} />
              {potmSearchOpen && potmSearchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#141a24", border: "1px solid var(--bd)", borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
                  {potmSearchResults.map(function(sp) {
                    var already = potmList.some(function(x) { return x.name === sp.name && x.team === (sp.team||""); });
                    return (
                      <div key={sp.name} onMouseDown={function(e) { e.preventDefault(); if (!already) addPotmPlayer(sp); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--bd)", cursor: already ? "not-allowed" : "pointer", opacity: already ? 0.4 : 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{sp.name}</span>
                        {already && <span style={{ fontSize: 9, color: "var(--acc)", marginLeft: "auto" }}>{"등록됨"}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {potmSearchOpen && potmSearch.trim().length >= 1 && potmSearchResults.length === 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "#141a24", border: "1px solid var(--bd)", borderRadius: 8, marginTop: 4, padding: "10px 12px", fontSize: 11, color: "var(--td)" }}>{"검색 결과 없음"}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {potmList.map(function(pl, i) {
                return (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 4, fontSize: 10, color: "var(--acc)" }}>
                  {pl.name}{pl.team && <span style={{fontSize:9,color:"var(--td)",marginLeft:3}}>{"("+pl.team+")"}</span>}
                  <button onClick={function() { rmPotm(i); }} style={{ background: "none", border: "none", color: "rgba(239,83,80,0.6)", cursor: "pointer", fontSize: 10, padding: 0, marginLeft: 2 }}>{"×"}</button>
                </span>);
              })}
              {potmList.length === 0 && (<span style={{ fontSize: 10, color: "var(--td)" }}>{"등록된 POTM 선수가 없습니다"}</span>)}
            </div>
          </div>
        )}

        {/* Matched POTM players with auto-calculated bonuses */}
        {potmMatched.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {potmMatched.map(function(pl) {
              var isBat = pl.role === "타자";
              var ct = pl.cardType;
              var stars = pl.stars || 5;
              var teamName = sdState.teamName || "";
              var teamMatch = !teamName || !pl.team || pl.team === teamName;
              var isLive = ct === "라이브";
              var isOlstar = ct === "올스타";
              var isSpecial = !isLive && !isOlstar;
              var statBonus = getPotmBonus(pl, sdState);
              var baseScore = isLive ? (pl.setScore || 0) : (SET_POINTS[ct] || 0);
              if (pl.isFa) baseScore = Math.max(0, baseScore - 1);
              var setDelta = 0;
              if (isLive || isOlstar) setDelta = baseScore >= 10 ? 1 : (10 - baseScore);
              else if (teamMatch) setDelta = 1;
              return (
                <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 6, background: "rgba(255,213,79,0.06)", border: "1px solid rgba(255,213,79,0.2)" }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{"🌟"}</span>
                  <Badge type={pl.cardType} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)" }}>{pl.name}</div>
                    <div style={{ fontSize: 9, color: "var(--td)" }}>{ct + (stars ? " " + stars + "성" : "") + (pl.team ? " · " + pl.team : "")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    {isSpecial ? (
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "rgba(171,71,188,0.12)", color: "#CE93D8", fontWeight: 700 }}>{"스페셜 POTM"}</span>
                    ) : (
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: "rgba(255,213,79,0.12)", color: "#FFD54F", fontWeight: 700 }}>{"POTM"}</span>
                    )}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {statBonus > 0 && (
                        <span style={{ fontSize: 10, color: "#66BB6A", fontFamily: "var(--m)", fontWeight: 700 }}>
                          {"능력치 +" + statBonus + (isSpecial ? " (팀일치)" : teamMatch ? "" : " (50%)")}
                        </span>
                      )}
                      {statBonus === 0 && isSpecial && !teamMatch && (
                        <span style={{ fontSize: 10, color: "var(--td)" }}>{"팀 불일치 — 효과 없음"}</span>
                      )}
                      {setDelta > 0 && (
                        <span style={{ fontSize: 10, color: "#FF9800", fontFamily: "var(--m)", fontWeight: 700 }}>{"세트덱 +" + setDelta}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: "center", color: "var(--td)", fontSize: 11 }}>
            {potmList.length > 0 ? "내 선수 중 매칭되는 POTM 선수가 없습니다" : "관리자가 POTM 명단을 등록하면 자동으로 매칭됩니다"}
          </div>
        )}
      </div>

      {/* 데이터 관리 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 14 }}>{"💾"}</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"데이터 관리"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10 }}>
          {/* JSON 백업 */}
          <button onClick={function() {
            var data = { players: players, lineupMap: lm, sdState: sdState, skills: p.skills, version: 10, exportDate: new Date().toISOString() };
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a"); a.href = url; a.download = "deck-backup-" + new Date().toISOString().slice(0,10) + ".json"; a.click(); URL.revokeObjectURL(url);
          }} style={{ padding: "12px", background: "linear-gradient(135deg,rgba(76,175,80,0.08),rgba(76,175,80,0.02))", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#4CAF50" }}>{"📥 JSON 백업 내보내기"}</div>
            <div style={{ fontSize: 9, color: "var(--td)", marginTop: 4 }}>{"선수, 라인업, 세트덱, 스킬 전체 데이터"}</div>
          </button>

          {/* JSON 복원 */}
          <label style={{ padding: "12px", background: "linear-gradient(135deg,rgba(66,165,245,0.08),rgba(66,165,245,0.02))", border: "1px solid rgba(66,165,245,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left", display: "block" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#42A5F5" }}>{"📤 JSON 백업 복원"}</div>
            <div style={{ fontSize: 9, color: "var(--td)", marginTop: 4 }}>{"이전에 내보낸 JSON 파일로 복원"}</div>
            <input type="file" accept=".json" style={{ display: "none" }} onChange={function(e) {
              var f = e.target.files[0]; if (!f) return;
              var r = new FileReader(); r.onload = function() {
                try {
                  var d = JSON.parse(r.result);
                  if (d.players) save(d.players);
                  if (d.lineupMap) p.saveLineupMap(d.lineupMap);
                  if (d.sdState) { Object.keys(d.sdState).forEach(function(k) { upd(k, d.sdState[k]); }); }
                  if (d.skills) p.saveSkills(d.skills);
                  alert("복원 완료! " + (d.players ? d.players.length + "명 선수" : "") + " (" + (d.exportDate || "날짜불명") + ")");
                } catch(err) { alert("파일 형식 오류: " + err.message); }
              }; r.readAsText(f);
              e.target.value = "";
            }} />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   MY PLAYERS PAGE - 전체 선수 관리 (훈련/스킬/특훈 편집 가능)
   ================================================================ */

/* ================================================================
   BULK SCAN - AI 사진 인식으로 선수 일괄 등록
   ================================================================ */

// Gemini API 호출 — Vercel 서버리스 함수(/api/scan) 경유
// GEMINI_API_KEY는 Vercel 환경변수에만 저장, 클라이언트에 노출 안 됨
async function callClaudeVision(base64, mediaType, prompt, userId) {
  var res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: base64, mediaType: mediaType, prompt: prompt, userId: userId || '' }),
  });
  if (!res.ok) {
    var e = await res.json().catch(function(){return{};});
    var msg = typeof e.error === 'string' ? e.error : (e.error && e.error.message) ? e.error.message : 'API 오류 ' + res.status;
    throw new Error(msg);
  }
  var data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  return data.text;
}

// 라인업 화면 분석

/* AI 인식 결과 보정: 연도/카드종류 불일치 교정 */
function correctCardType(players) {
  var VALID_TYPES = ['임팩트','라이브','올스타','시그니처','국가대표','골든글러브','인식실패'];
  return players.map(function(p) {
    var year = (p.year || '').trim();
    var ct = p.cardType || '';
    /* 연도가 없으면 무조건 임팩트 */
    if (!year) {
      return Object.assign({}, p, { cardType: '임팩트' });
    }
    /* 연도가 있는데 임팩트로 왔으면 인식실패로 변환 */
    if (year && ct === '임팩트') {
      return Object.assign({}, p, { cardType: '인식실패' });
    }
    /* 유효하지 않은 카드종류(기타, OTHER 등) → 인식실패 */
    if (VALID_TYPES.indexOf(ct) === -1) {
      return Object.assign({}, p, { cardType: '인식실패' });
    }
    return p;
  });
}

async function scanLineupScreen(base64, mediaType, role, userId) {
  var isBat = role === '타자';
  var prompt = [
    '당신은 컴투스 프로야구 FOR 매니저 게임 화면 분석 전문가입니다.',
    '이미지는 ' + role + ' 라인업 화면입니다.',
    isBat ? '다이아몬드 배치의 주전 타자 9명만 분석하세요. 하단 후보 선수는 무시하세요.' : '화면에 보이는 투수 카드를 모두 분석하세요.',
    '',
    '너는 지금부터 색상보다 데이터 규칙을 우선하는 데이터 추출 엔진이다.',
    '배경이 금색이라고 무조건 골든글러브로 판단하는 것은 오답이다. 아래 순서를 절대 준수하라.',
    '',
    '[1단계: 임팩트 즉시 판정]',
    '- 선수 이름 옆에 연도 숫자(17, 24 등)가 있는가?',
    '- NO (숫자가 없다) → 배경이 아무리 금색이고 화려해도 무조건 임팩트 확정. 다른 단계로 넘어가지 마라.',
    '- YES (숫자가 있다) → 2단계로 이동.',
    '',
    '[2단계: 시그니처 판정 - 임팩트 다음 최우선. 골든글러브보다 반드시 먼저 확인]',
    '★★★ 이 단계는 골든글러브보다 절대적으로 우선한다. ★★★',
    '- 위치 고정: 선수 이름 텍스트의 왼쪽 위 모서리 바로 옆. 정확히 이 위치만 확인하라.',
    '- 찾을 것: 빨간색(적색) 필기체 S자 로고. 기울어진 서명 스타일.',
    '- 이 S 필기체 로고는 이 게임에서 오직 시그니처 카드에만 존재한다. 다른 카드 종류에는 절대 없다.',
    '- 판정 기준은 넉넉하게: 작아도, 흐려도, 일부만 보여도, 배경에 묻혀도 S처럼 보이면 시그니처.',
    '- 배경색(황금/분홍/어떤 색이든)은 판단 기준이 아니다. 오직 이름 왼쪽 위의 빨간 S 유무만 본다.',
    '- YES (이름 왼쪽 위에 빨간 S 확인) → 즉시 시그니처 확정. 3단계로 넘어가지 말 것.',
    '- NO (이름 왼쪽 위에 없음) → 3단계로 이동.',
    '',
    '[3단계: 골든글러브 판정]',
    '- 1단계(연도 있음), 2단계(S 로고 없음)를 모두 통과한 상태.',
    '- 선수 이름을 살짝 감싸고 있는 테두리/장식 영역의 색상을 확인하라.',
    '- 이름을 둘러싼 영역(이름표 테두리, 이름 아래 장식선, 이름 좌우 색상)이 노란색 또는 황금색 계열이면 → 골든글러브 확정.',
    '- YES → 골든글러브 확정.',
    '',
    '[4단계: 기타]',
    '- 이름 위에 V1/V2/V3 있으면 → 라이브 (연도 반드시 있음)',
    '- ALL STAR 영문 텍스트 있으면 → 올스타 (별점★★★★★과 혼동 금지)',
    '- 배경이 파란색/남색 계열 → 국가대표',
    '- 모두 해당 없음 → 인식실패',
    '',
    '[핵심 요약]',
    '- 연도 없음 → 100% 임팩트',
    '- 이름 주변 빨간 S 필기체 (조금이라도) → 100% 시그니처. 이 게임에서 S 필기체는 시그니처뿐.',
    '- 이름 주변 노란/황금색 → 골든글러브 (S 필기체 없을 때만)',
    '',
    '=== 임팩트 종류 (이름 왼쪽에 보이는 텍스트) ===',
    '2025TOP3,5툴선수,FA선수,WAR상위,가을사나이,거포,교타자,구조대,구종마스터,끝내기,난세의영웅,느림의미학,대체외인,대표타자,도루왕,돌격대장,라이징스타,마당쇠,마무리,마성의주자,백전노장,베스트포지션,베테랑,분위기메이커,비FA계약,빅게임헌터,신인왕,안경에이스,안방마님,얼리스타터,여름사나이,외국인,우완에이스,원클럽맨,원투펀치,이벤트,저니맨,전천후,좌완에이스,좌타해결사,주력선수,중간계투,철완,최강야구,추억의선수,캡틴,키플레이어,키스톤,파이어볼러,프랜차이즈,필승계투,해외파,호타준족,홈런타자',
    '',
    '=== 팀 로고 → 팀명 변환 ===',
    'T 또는 호랑이 로고=기아, H 또는 해태 로고=기아, E=한화, D=두산, LG=LG, S 또는 SL=삼성, NC=NC, SSG=SSG, R=SSG, G=롯데, KT=KT, K 또는 Nexen=키움',
    '',
    '=== 이름/연도 추출 규칙 ===',
    '- "김재환\u201818" → name:"김재환", year:"18"',
    '- "로하스B\u201820" → name:"로하스B", year:"20" (영문 접미사 B는 이름의 일부)',
    '- "윤석민S" → name:"윤석민S", year:"" (S는 이름 일부, 연도 없음)',
    '- "이승엽" → name:"이승엽", year:"" (연도 없으면 빈 문자열)',
    '- 임팩트 카드는 항상 year:""',
    '',
    isBat ? '슬롯: C/1B/2B/3B/SS/LF/CF/RF/DH 중 하나' : '투수 슬롯: 1선발→SP1, 2선발→SP2, 3선발→SP3, 4선발→SP4, 5선발→SP5, 승리조1→승리조1, 승리조2→승리조2, 추격조1→추격조1, 추격조2→추격조2, 추격조3→추격조3, 롱릴리프1→롱릴리프1, 롱릴리프2→롱릴리프2, 마무리→CP',
    '',
    '=== 출력 형식 ===',
    '반드시 아래 형식의 JSON 배열만 출력하세요. 설명 텍스트, 마크다운 없이 순수 JSON만.',
    'cardType 허용값: 임팩트, 라이브, 올스타, 시그니처, 국가대표, 골든글러브, 인식실패 (이 7가지 외 다른 값 절대 사용 금지)',
    '[{"name":"","year":"","team":"","slot":"","cardType":"","impactType":"","role":"' + role + '","hand":"우","stars":5,"ovr":0}]',
  ].join('\n');
  return await callClaudeVision(base64, mediaType, prompt, userId);
}

// 스킬 화면 분석
async function scanSkillScreen(base64, mediaType, nameList, userId) {
  var names = nameList.map(function(n,i){return (i+1)+'. '+n;}).join('\n');
  var prompt = [
    '컴투스 프로야구 FOR 매니저 "한 눈에 보기" 스킬 화면입니다.',
    '아래 선수들의 스킬 정보만 추출하세요. 후보 선수는 무시하세요.',
    '',
    '=== 선수 목록 ===',
    names,
    '',
    '=== 추출 규칙 ===',
    '- 각 선수 행의 오른쪽에 있는 스킬 아이콘 3개를 순서대로 추출',
    '- 스킬 이름과 레벨(숫자)을 정확히 읽기',
    '- "어드밴티지"는 "홈어드밴티지"로 변환',
    '- 스킬이 없으면 name:""와 level:0',
    '- 스킬 이름은 아이콘 아래 텍스트를 정확히 읽기 (오타 없이)',
    '',
    '=== 출력 형식 ===',
    '순수 JSON 배열만 출력. 마크다운 없이.',
    '[{"name":"","skill1":"","s1Lv":0,"skill2":"","s2Lv":0,"skill3":"","s3Lv":0}]',
  ].join('\n');
  return await callClaudeVision(base64, mediaType, prompt, userId);
}

// 스킬 매칭
function mergeSkillsInto(players, skillData) {
  return players.map(function(p) {
    var m = skillData.find(function(s){ return s.name === p.name; }) ||
            skillData.find(function(s){ return s.name && p.name && s.name.replace(/'\d+/,'') === p.name.replace(/'\d+/,''); }) ||
            skillData.find(function(s){ return s.name && p.name && (s.name.indexOf(p.name)>=0 || p.name.indexOf(s.name)>=0); });
    if (!m) return p;
    return Object.assign({}, p, { skill1:m.skill1||'', s1Lv:m.s1Lv||0, skill2:m.skill2||'', s2Lv:m.s2Lv||0, skill3:m.skill3||'', s3Lv:m.s3Lv||0 });
  });
}

// 연도 2자리 → 4자리
function expandYr(y) {
  if (!y || y === '') return '';
  var n = parseInt(y); if (isNaN(n)) return y;
  // 26 이상(26~99) → 1900년대, 25 이하(00~25) → 2000년대
  // 50 이상(50~99) → 1900년대, 50 미만(00~49) → 2000년대
  return n >= 50 ? '19' + String(n).padStart(2,'0') : '20' + String(n).padStart(2,'0');
}

// ─────────────────────────────────────────────────────────────────
// 스킬 이름 퍼지 매칭
// rawName  : AI가 읽은 스킬명 (예: "패기", "철완", "5툴플레이어")
// category : "타자"|"선발"|"중계"|"마무리"
// seedPlayer: 도감 선수 객체 (cardType, stars, stamina, running 등)
// skillsDB : DEFAULT_SKILLS
// slot     : lineupMap slot (예: "승리조1", "추격조2", "롱릴리프1", "CP" …)
// 반환: { name: string|null, missing: bool }
// ─────────────────────────────────────────────────────────────────
function resolveSkillName(rawName, category, seedPlayer, skillsDB, slot) {
  if (!rawName) return { name: '', missing: false, candidates: [] };
  var catSkills = (skillsDB && skillsDB[category]) || {};
  var allNames  = Object.keys(catSkills);

  // ── 헬퍼 ──────────────────────────────────────────────────────
  // 괄호 제거 기본명
  var base = function(n) { return n.replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim(); };
  // 슬롯 → 중계 역할 분류 (셋업맨1/2 구분)
  var slotRole = function(s) {
    if (!s) return '';
    if (s === '승리조1') return '셋업맨1';
    if (s === '승리조2') return '셋업맨2';
    if (s.indexOf('추격조') === 0) return '추격조';
    if (s.indexOf('롱릴리프') === 0) return '롱릴리프';
    return '';
  };
  /* 슬롯 역할이 셋업맨(승리조) 계열인지 확인 */
  var isSetupRole = function(r) { return r === '셋업맨1' || r === '셋업맨2'; };
  // DB 스킬 Lv10 점수 계산 (DEFAULT_SKILLS 직접 참조)
  var skillScore10 = function(skillName, cat) {
    var w = getW();
    var entry = (catSkills[skillName] || [])[5]; // index5 = Lv10
    if (!entry) return 0;
    if (typeof entry === 'number') return entry;
    return (entry.cV||0)*(entry.cF||0)*w.c +
           (entry.sV||0)*(entry.sF||0)*w.s +
           (entry.pV||0)*(entry.pF||0)*w.p +
           (entry.aV||0)*(entry.aF||0)*w.a +
           (entry.eV||0)*(entry.eF||0)*w.e;
  };

  // ── 1. 정확 일치 ───────────────────────────────────────────────
  /* 공백 제거 후 정확 일치 체크 */
  var rawNameNoSpace = rawName.replace(/\s+/g, '');
  if (catSkills[rawName]) return { name: rawName, missing: false, candidates: [] };
  /* 공백 제거 버전으로 DB에서 찾기 */
  var spaceMatch = Object.keys(catSkills).find(function(k) { return k.replace(/\s+/g,'') === rawNameNoSpace; });
  if (spaceMatch) return { name: spaceMatch, missing: false, candidates: [] };

  var baseName = base(rawName);

  // 후보 수집 (기본명 동일)
  var candidates = allNames.filter(function(n) { return base(n) === baseName; });
  if (candidates.length === 0) {
    // 부분 포함 허용
    candidates = allNames.filter(function(n) {
      var b = base(n);
      return b.indexOf(baseName) >= 0 || baseName.indexOf(b) >= 0;
    });
  }
  if (candidates.length === 0) {
    /* rawName을 포함하거나, rawName이 스킬명에 포함되는 후보 탐색 */
    var fuzzyMatches = allNames.filter(function(n) {
      var b = base(n);
      return b.indexOf(rawName) >= 0 || rawName.indexOf(b) >= 0 ||
             baseName.length >= 2 && (b.indexOf(baseName) >= 0 || baseName.indexOf(b) >= 0);
    });
    if (fuzzyMatches.length === 0) return { name: null, missing: true, candidates: [] };
    /* 여러 개면 점수 높은 것 선택 */
    var bestFuzzy = fuzzyMatches.reduce(function(acc, n) {
      return skillScore10(n) > skillScore10(acc) ? n : acc;
    }, fuzzyMatches[0]);
    return { name: bestFuzzy, missing: false, candidates: [] };
  }
  if (candidates.length === 1) return { name: candidates[0], missing: false, candidates: [] };

  // ── 2. 특수 규칙 (후보 자동 선택 또는 candidates 반환) ─────────

  // ── 2-A-0. 좌승사자: 투수 손 기반 ─────────────────────────────
  if (baseName === '좌승사자') {
    var hand = (seedPlayer && seedPlayer.hand) || '우';
    var handKey = hand === '좌' ? '좌투' : '우투';
    var hm = candidates.find(function(n) { return n.indexOf(handKey) >= 0; });
    return { name: hm || candidates[0], missing: false, candidates: candidates };
  }

  // ── 2-A. 패기: 카드 종류 기반 ──────────────────────────────────
  if (baseName === '패기') {
    var ct = (seedPlayer && seedPlayer.cardType) || '';
    var ctHit = {
      '골든글러브': '골글',
      '시그니처':   '시그',
      '임팩트':     '임팩',
      '국가대표':   '국대',
      '라이브':     '라이브',
      '올스타':     '올스타',
      '시즌':       '시즌',
    }[ct] || '';
    var m = candidates.find(function(n) { return ctHit && n.indexOf(ctHit) >= 0; });
    if (m) return { name: m, missing: false, candidates: [] };
    // 복합 괄호 (예: 패기(시그/올스타/라이브)) 재탐색
    m = candidates.find(function(n) { return ctHit && n.replace(/\s/g,'').indexOf(ctHit) >= 0; });
    if (m) return { name: m, missing: false, candidates: [] };
    // 카드종류 매칭 실패 → 후보 전체 반환 (유저 선택)
    return { name: candidates[0], missing: false, candidates: candidates };
  }

  // ── 2-B. 철완: 지구력 구간 → 중간값 선택 ─────────────────────
  if (baseName === '철완') {
    // 구간 정렬 (첫 번째 숫자 높은 순, 공백 포함 처리)
    var sorted = candidates.slice().sort(function(a, b) {
      var am = a.match(/(\d+)/); var bm = b.match(/(\d+)/);
      return (bm ? parseInt(bm[1]) : 0) - (am ? parseInt(am[1]) : 0);
    });
    var mid = Math.floor((sorted.length - 1) / 2);
    return { name: sorted[mid], missing: false, candidates: sorted };
  }

  // ── 2-C. 5툴플레이어: 주루 구간 → 중간값 선택 ───────────────
  if (baseName.indexOf('5툴') >= 0 || baseName.indexOf('5툴플레이어') >= 0) {
    var sorted2 = candidates.slice().sort(function(a, b) {
      var am = a.match(/(\d+)/); var bm = b.match(/(\d+)/);
      return (bm ? parseInt(bm[1]) : 0) - (am ? parseInt(am[1]) : 0);
    });
    var mid2 = Math.floor((sorted2.length - 1) / 2);
    return { name: sorted2[mid2], missing: false, candidates: candidates };
  }

  // ── 2-D. 도전정신: 별 수 기반 ────────────────────────────────
  if (baseName === '도전정신') {
    var stars = (seedPlayer && seedPlayer.stars) || 5;
    var m2 = candidates.find(function(n) { return n.indexOf(stars + '성') >= 0; });
    return { name: m2 || candidates[0], missing: false, candidates: candidates };
  }

  // ── 2-E. 중계 역할 기반 스킬 ────────────────────────────────────
  if (category === '중계') {
    var role = slotRole(slot);
    /* 셋업맨 계열(승리조1/2) vs 비셋업맨(추격조/롱릴리프) */
    var isSetup = isSetupRole(role);

    // 필승카드: (승리조,셋업맨) / (롱릴리프) / (추격조)
    if (baseName === '필승카드') {
      var fm = candidates.find(function(n) {
        if (role === '추격조') return n.indexOf('추격조') >= 0;
        if (role === '롱릴리프') return n.indexOf('롱릴리프') >= 0;
        if (isSetup) return n.indexOf('승리조') >= 0 || n.indexOf('셋업맨') >= 0;
        return false;
      });
      return { name: fm || candidates[0], missing: false, candidates: candidates };
    }

    // 약속의8회: (셋업맨1) / (셋업맨2) / (추격조,롱릴리프)
    if (baseName === '약속의8회') {
      var am = candidates.find(function(n) {
        if (role === '셋업맨1') return n.indexOf('셋업맨1') >= 0;
        if (role === '셋업맨2') return n.indexOf('셋업맨2') >= 0;
        if (role === '추격조' || role === '롱릴리프') return n.indexOf('추격조') >= 0 || n.indexOf('롱릴리프') >= 0;
        return false;
      });
      return { name: am || candidates[0], missing: false, candidates: candidates };
    }

    // 수호신: (셋업맨1) / (셋업맨2) / (승리조) / (추격조,롱릴리프)
    if (baseName === '수호신') {
      var sm = candidates.find(function(n) {
        if (role === '셋업맨1') return n.indexOf('셋업맨1') >= 0;
        if (role === '셋업맨2') return n.indexOf('셋업맨2') >= 0;
        if (isSetup) return n.indexOf('승리조') >= 0;
        if (role === '추격조' || role === '롱릴리프') return n.indexOf('추격조') >= 0 || n.indexOf('롱릴리프') >= 0;
        return false;
      });
      return { name: sm || candidates[0], missing: false, candidates: candidates };
    }

    // 원포인트릴리프: (셋업맨) / (셋업맨X)
    if (baseName === '원포인트릴리프') {
      var om = candidates.find(function(n) {
        if (isSetup) return n.indexOf('셋업맨X') < 0 && n.indexOf('셋업맨') >= 0;
        return n.indexOf('셋업맨X') >= 0;
      });
      return { name: om || candidates[0], missing: false, candidates: candidates };
    }

    // 흐름끊기 / 얼리스타트: (셋업맨) / (셋업맨X)
    if (baseName === '흐름끊기' || baseName === '얼리스타트') {
      var hm2 = candidates.find(function(n) {
        if (isSetup) return n.indexOf('셋업맨X') < 0 && n.indexOf('셋업맨') >= 0;
        return n.indexOf('셋업맨X') >= 0;
      });
      return { name: hm2 || candidates[0], missing: false, candidates: candidates };
    }

    // 라이징스타: (셋업맨/3,4,5중계) / (셋업맨X/3,4,5중계) / (1,2,6중계)
    if (baseName === '라이징스타') {
      var lm = candidates.find(function(n) {
        if (isSetup) return n.indexOf('셋업맨') >= 0 && n.indexOf('셋업맨X') < 0;
        if (role === '추격조' || role === '롱릴리프') return n.indexOf('셋업맨X') >= 0;
        return n.indexOf('1,2,6') >= 0;
      });
      return { name: lm || candidates[0], missing: false, candidates: candidates };
    }

    // 긴급투입·전승우승·승리의함성: (승리조,셋업맨) / (추격조) / (롱릴리프)
    var roleSkills = ['긴급투입', '전승우승', '승리의함성'];
    if (roleSkills.indexOf(baseName) >= 0) {
      var rm = candidates.find(function(n) {
        if (isSetup) return n.indexOf('승리조') >= 0 || n.indexOf('셋업맨') >= 0;
        if (role === '추격조') return n.indexOf('추격조') >= 0;
        if (role === '롱릴리프') return n.indexOf('롱릴리프') >= 0;
        return false;
      });
      if (rm) return { name: rm, missing: false, candidates: candidates };
    }

    // ── 2-F. 기타 중계 괄호 스킬 → Lv10 점수 높은 것 + 드롭다운 ─
    var best = candidates.reduce(function(acc, n) {
      return skillScore10(n) > skillScore10(acc) ? n : acc;
    }, candidates[0]);
    return { name: best, missing: false, candidates: candidates };
  }

  // ── 3. 그 외: 점수 높은 것 ────────────────────────────────────
  // 후보 여러 개 → 유저가 선택할 수 있도록 candidates 전체 반환
  return { name: candidates[0], missing: false, candidates: candidates };
}

/* 이름 유사도 체크 - 한 글자 차이 허용 */
function nameSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  var diff = 0;
  var longer = a.length >= b.length ? a : b;
  var shorter = a.length < b.length ? a : b;
  for (var i = 0, j = 0; i < longer.length; i++) {
    if (longer[i] !== shorter[j]) { diff++; j--; }
    j++;
    if (diff > 1) return false;
  }
  return true;
}

// SEED_PLAYERS에서 매칭
function matchSeedPlayer(scanned) {
  var ct = scanned.cardType; var nm = scanned.name; var yr = expandYr(scanned.year); var it = scanned.impactType||'';
  /* 인식실패 카드는 매칭 불가 */
  if (!ct || ct === '인식실패') return { seed: null, candidates: [], failed: true };
  if (ct === '임팩트') {
    /* 임팩트는 이름(퍼지)으로 후보 검색 */
    var candidates = SEED_PLAYERS.filter(function(sp) {
      return sp.cardType === '임팩트' && nameSimilar(sp.name||'', nm);
    });
    if (candidates.length === 0) return { seed: null, candidates: [] };
    /* impactType 매칭 시도: AI가 인식한 종류로 먼저 exact 매칭 */
    if (it) {
      var exact = candidates.find(function(sp) { return (sp.impactType||'') === it; });
      if (exact) return { seed: exact, candidates: [] };
    }
    /* impactType 없거나 exact 실패: 후보가 1개라도 impactType이 다르면 선택 요구 */
    if (candidates.length === 1) {
      /* 도감에 딱 1개 → impactType 불일치여도 자동 매칭 (유일한 선택지) */
      return { seed: candidates[0], candidates: [] };
    }
    /* 후보 여러 개: 내 팀 우선 정렬 후 선택 요구 */
    if (typeof sdState !== 'undefined' && sdState && sdState.teamName) {
      var myTeam = sdState.teamName;
      candidates = candidates.slice().sort(function(a, b) {
        var aM = (a.team||'') === myTeam ? 0 : 1;
        var bM = (b.team||'') === myTeam ? 0 : 1;
        return aM - bM;
      });
    }
    return { seed: null, candidates: candidates };
  }
  /* 1차: 정확한 이름+카드종류+연도 매칭 */
  var found = SEED_PLAYERS.find(function(sp) {
    if ((sp.cardType||'') !== ct) return false;
    if ((sp.name||'') !== nm) return false;
    return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
  });
  if (found) return { seed: found, candidates: [] };
  /* 2차: 이름 오독 보정 - 퍼지 이름으로 같은 카드종류+연도 재탐색 */
  var fuzzy = SEED_PLAYERS.find(function(sp) {
    if ((sp.cardType||'') !== ct) return false;
    if (!nameSimilar(sp.name||'', nm)) return false;
    return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
  });
  if (fuzzy) return { seed: fuzzy, candidates: [] };
  /* 3차: 카드종류 오인식 보정 - 이름+연도로 다른 카드종류 탐색 */
  var otherCt = SEED_PLAYERS.find(function(sp) {
    if (!nameSimilar(sp.name||'', nm)) return false;
    return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
  });
  if (otherCt) return { seed: otherCt, candidates: [] };
  return { seed: null, candidates: [] };
}


// 업로드 가이드 썸네일 (예시 사진)
var SCAN_THUMBS = [
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAB4ADMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDGVwsYBgRs5+Y5z/OlllSRFVbeOMgnLLnLfXJqil4zsqEIoJ6s3ApZLoxOVAjfH8SsSDXt2PJ5WWMc470Hg4PWux03wnbXNja3v26eOSWJZMKo+UkZwDU//CHW0rea2oXe/wBWQZrF4imnYv2FTscPipPIm3qnkybnGVXacsPUDvXaHwTZ4/4/5/8Av2tTDw4zyQudXvw8K4jYoMoOmAal4mHQpYefU4JlZWKsCrA4IPBFFdxJ4LtpZGkk1K4Z2OWYouSaKf1mAfV59iuh0kJEradlkA3n++e/finsNKLEppwUEcAjOP1piwgDnoOtS+V7V5/M+53cq7Edw8LKgto2iC5zgkD271JFNbLEqyROzgcnJOTnr1qrqErWkCyJEZWaRU2ggdfrTLO7juwhAC787fmBPHXjt0qXJLco0fPs/wDn3cfif/iqPPs9oH2d885OT/8AFVF5YGM9+lL5XtTAJJrYtlIZAMDjef8AGiozGc0UAT6ggjsXZjtAIyfTmsOxvI5tWiWKWWRGYAHsp5zuye9dHrQHkvZw3EMVz8rgyNgD5v8A6xrm4dEuobp76G4tTErM7lDuIbB749SDitIcnK+Zg3JbGh4jKR6Yr+esW2ZPn2bsdR0rB8PNF/b0QdpBIUYKspyQADnoMc5q+99OnlxyXkbruCOPKBOc9MZ7itDVZrS0AmtWWMqOXMQUDPHPt71kpR7FODulcl1aJXW2UOwJkONhb0PXHOKz9GS5Goul0soJjYjLErjcAMcn0q1pl5NfJIbedHeJl/erwM9wPUcYqaxECXr3st1AQ4bP7wDGTk9fpUfaHf3bIu+VRWolk7oHTBUjINFXcgw/E1j9u1yWN1ZIxarunC8ry2BkfN19B0zVPSWMWg3EIijHmSNG2AcH5QM/U11t9o8d5d/aDPLGxj8s7Mcj/JpbLSbfT7OS2jXzI5G3MHA9Mf0rOO+qLb0VjzyLSfLn81Ujj5GAoPTGMe9W9SSdmXyYQ42MCWAIX8K3dY05bSIyx7mhYhNoGWBP86zhFJbuqPbRqxjkkLIcYVemRk8kAmqS0syk9VLqM8MtcQzMk1tHGJCoAReD7jHesCfa0z+VCF8uMYjcAKdxOWPrgg10Fjp96LlLy1QvE8kRHzDMYydzYzkDjv61uf8ACHWBdnaWUs38RwTj0zRKV2mTtdG5bf8AHrD2/dr0+lFSxoI41QdFAA/CikSUL3V7fT4PPvJUii3BdzZ6n6VQ/wCEx0P/AJ/4vyb/AAqLVZoxpk7O4UKudzD7vI5rCSG6ttQtXuV/0aeRViPUk56kehBq7AvM0dZ8QaNqVkIIdWhgcSK+8oxHB6dKy/PsI7p2utcg3NC6bfKcY3LgHHSpZOfMnSGWWFSzM8Z4XHbGOucd6TUYL66vHGmQ+YV2AruVQMqPX9aaG00+XsRfbrJprZ38RW+2Bl+VY3G5QeldZZ+JtNvrgQWd1HLKQSFGc4HXtXJ+eF0aP7S/2ecSyI3mr8wYY+U4HODWh4ZuYpomO4tIirukxwTznBocXbyF0Uu51n2pvQUVn+av940VIjK1ENLp08cTLvKcb+n41gqLy91a0bzoxHDKGKZPyqCCccfSrB1UvbO4jiGONrScn8MVHxbOTb/IzyebKF+YOQOgz0zntVJj0sEgvTbNaKyAK5OUDc8nGfl96ddaTevem4imVX2IFcSbWDBQCentWq/h+WYRObx7acLlvLg3YyORknmpE0W4jnjeTVbmRCwUobfrx161cYR5b3X4/wCRcrPVMx5NL1CS3i/fRNOJJHd2OeWxg9MdqtaJp91YTTvdTK/mKAMHqcnJPA9q3ZNMSGNn8+R8dljyf51CbVFeRT9oIQ43LFnP05qfea8iL6WDeP71FSR6ekiBxLMoPZosEfrRUiPJVtYioJ1S2UkZwfMyP/Hav2p06Cwmhllspp3zsn3yhkyMDA29jzW4/wAPkjZFfVmy4yNtoSPx+apLPwLtYyw6uykKT89ken0Jqr+RlyS/mf4f5HKeQv8A0GoP++pf/iavWUtlBaTRT3FtcyyZ2SmWYFPlxwNvY803V/D5sNR+zJdrLuiWXc6iP73bBNU4YJbG6jljlj39R0Yc8c80XXYXs5/zP8P8hPIH/Qah/wC+pf8A4mr1jLZ20Ey3M9teO/3CZZgV4PA+X15/CqEunOoZ2li9flZT+maWzgkinWeCVA8ZyN+P5E80rrsP2c/5n+H+RSE82B++l/77NFTtBvYsXGWOeFopGtjqU1S72Nm7n3H7p84jFRW+rakl+X+0XEibcBWkJAPqAcjNFFepVinE82nJqRWuJWubuWW6Xcx4G47sD0BNLMtqXHlW6KuBkHB5ooqoQjyrQU5NyeoFLbyBiFA+euB0+lJHHbkHdFH0wOAOaKKrlj2J5pbXGbIs/cT/AL5FFFFL2cexftZ9z//Z",
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAB4ADMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDGVwsYBgRs5+Y5z/OlllSRFVbeOMgnLLnLfXJrMbUHAxsXA96P7Qcf8s1/M16nt6fc832E+xexzjvQeDg9agtri8m/fW0CkqwQFZMHJGf5VLI2pb/MktxuwPmMvqMjnPoKf1ml3D6vU7DsVJ5E29U8mTc4yq7Tlh6gd6y/7SfH+qTH1NW017U5ri3CSO0sfyQnecr2wDUvEw6Maw8+pMysrFWBVgcEHgiiqM2pTtPI0yBpCx3knJJ70U/rNPuH1efYgiSEhjMzg4+XYV6++TUBGCA344INSpZyyR+cMeUCA0nZeM80k0MscSeZGqLjIbAy2fWvOumd9n1IskfdYgZ9cUm49N360qNt3EKrfKRyuce9SJOVspIRCpDMMyEHIPb+VICfSU0+S+C6rNJFbbGy0fXdjgdDxn2rcS08G7x5mo3YXuV3E/8AoFcy9vMkCTvE4ic4VyvBqSS3nkvDD5GybH+rVcdBn+VGgF+8h0RblxaXM7w8bSRk9BnsO+e1FZIHFFMDXN3MfDZsDFGqiUSBhGQ0nU8t0OKrvFIqKyTK7bAdoiPA7c4psTh7OZsxRvGqbeWBOD27ZOf5011tTGAjYfbyxkJGfpipQ5JXViu4kDtv+RsZOeMioxnYeflyMjPX8KeyoCQX3DHBUd/xpgxtOSd2ePTFOwmy2+Bp8DeYrfOQ0ZH3R2785q1ImNWMK3UDDb/ryGx0z659qrSGJtOtlQsJwx35lypGeOM/LVlUtH1Q+VNMkBjzu8wbgcdM59aQzNYksScAk84ooP3j9aKoRoPaSxaUZZEQLKFKyA5yM9OP69xTZXkFsBJZukZQfN5Srn3zipDa30WjC6IL2rgquDkAZwcjtyfzqJ4pdgLS2xwgIByePyofLZWYO99SkxQE7UJBGMMc49+KjyMEYGfWpQzuWKAL8pyFwOO9Rjd5ZxnZkZ+vakLqW5mU6fbxmADBJWTy8F8nkZzzVu38+LVpStkyyCJsw+R0UjGdpPGAetU3DDTYX3p5ZkIKhySCO5Hbr2qzcLNHqrxtPFI4X5ZfPYKRjPDZyc9OaRZncdunailYkuxIwc80UyTqLexv73wc8serR/ZbdW/0ZxtAxyVBxyT1/SsNkg2DE8pbaOsi46dKv2yaO3hmZZbmcXhbdsH3d/O3jHTHv3rNkki8oK0ATKgbhFgn3yTSQPcrMgUkM68DIK8gn0puF8ssW+fOAu3qPXNOYxgnAZlI4zwQaYCuwgr8xIIOeg+lMRdYf6BbMBJv8w5BUAY4xg47+9SrGp1Bx50+3yyQQq7wewPbrVd9osYFMW0lyRIUPzevJ6gelTSy2suqtMbaJYurQhGC9McAcj1oKKLfeOTnnrRQcZOOmeKKALhgI0+SRQrRqVOQDkk/j0FE7TNCjS+U6hRtUy5I49M1rWOnXtz4amltZY2iVydrPt6DlSCME85HNZbpiIFLqUvtGAQAOnHOfrVScWtCL6lPcxLGNAuVIIA7d+tMDP5JUD5NwJ47/WpJA5dvNkAYLnJOc+3FRY+UnI4PTuagqyLsjynTraN8m3DEghwdpJ54I4/lVuGScazuVS8rRnnerDGM5z0wMfniqbRAWVu4l3szDMaw4I/4F/EalngRdRaOGdjEEJV2typIx024454z+NAyicliSCCT0NFLj3B9xRVWEIHcKUDsFPVQxx+VJRRSQBRRRTAKcM+tNHJp1CAOewopcUU7COgSG0KNm3i3H7p4GKZZhYNS85LaN1VflBUfKfUDBGaKK9KrCLjsefTk1IQxQ+fKWtYkBPCheB7CpZo7MuPKtY1XA4IB5ooqoRjyrQU5NyeohitPIGLeMPnrgdPpRHDbHO6GPpgcAc0UVXLHsTzS2uM8qH/nnH/3yKKKKXJHsV7WXc//2Q==",
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAB4ADMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlkYIg3QIwJPzHP+NOnmSVFVLaKIqTlkzk/XJruz4Bs9mP7RuCBzgRrSL4AsiAf7QuR7GNay5Jdj6D6/h73b/M8/AJOB1oIIOCOasXq/YNUuIIXb9xKyK+cE4OM0y5kdbjcZxK+P8AWI5Pt1rdYOs+hDzbC3+L8H/kRVL9muN6J5Mm9xlV2HLD1A711eg+EbXVdGgvpLyaNpN2UVAQMEj+lbQ8Ls8sDnWdQD267YmKDKDpgGsXSknZop5jResX+Z5s6MjFXUqwOCDwRRXoUvgS1mleWXU7l3clmYxqST60UuSXYpZjQ6sVbzTlSNHgcsgHmHzT8xxz/FxT2u9PJykLICOMyZ/9m5rmZbaUajcyqm5fMKttBBCgf+PU8WiTW8M1lEmyKNtozznPrnjPNb+0p83Ld/18z51Rk2bN2LGXa0MMaEE7ycc5/E0+H+zBEqvaxM4Xk4ByfXrXOPAJY5VjaJnkmQuNhYg4Y4PPXj8Kt2cNu9yi3Kh5WjYAkn7vOcc89/pTdaCtq9f67i9k30RvJc6coCpCFXsobp/49Si6sQeYzx1G7/7KsdNMgVVWcKkMboVDthSTnGOevWs0xrEZXuHjVJ5JMjBXPJ4xnnp1FU5U+7/r5jcJLTQ6dpYGOUR9p6YY/wCNFQWKK1lEbcbYtvygc4FFStVdCK32iewvtSENpOJXJ2TfNg5A6cY/+vVE2Umo6PAzW91BcMWxlSrJg5Gfqf6GtrWYbuz1NmOo3KRPysYOFXtgd/eqSQaheRzSxavfRhMHC4PPoPy/WpautC1dO5Ri0uW3sGE8Fw5Mi8xj5j97knHTn3pLKKdbhl8i4YGOTZujJx8p4zjv6VOZL0xCJdWvC/8AeB+Yn09P/wBVWHeawmWK41u5ld49wSQ84zjPFFrasfNKOnRjrq8naC2tbewKwqylj5RzkHI7diSazJLcxz3Uj2t2TC7skbKSJHycMMDpg8DOM1pLFf3UUk8WrXyBeiLjn2H+e9VvNvXijRNSvPMJAO0/N+PahSvsrlL3ru9rm5pEfmaVbOYzBlB+7YYK+2KK2NP0+ZLGFZWMzheZH6t7mincy20MfxnMFu1iMHmBo88vtA571Bod1LNa6jJKsahFBCoSc4B5OfpW1ruhx6reLLJcSR7FKbVAIPOc1Si0aPRtOvitxJIkkZzuAG0AHpUpdzd1IezSS17nNi+jD7oomWaTariQnCqvOeO9X9XtftGqpEpRG+yhldyFAO5uh9ayYYLScrJbzSSMy8Ed/wClbOv28cl5byyTyRlYdu0cqwyeT71MUmrXuxVJxc06asWbGF7WLUPMlimURrIhQk4GG4PuMVkPPsaJzAocFV35Y4Ut3A9K0tCtw9vqESzN+9CqRsA2ZBHFKvhWMMH+2S7h1JQc/rVRhGOi2FGSUWpLXodta/8AHrH/ALoootv+PaP/AHaKDMoyXB8w8CqWrTltKuxtPML9P900M6lj8xqC+dRYzlnIURsSQcYGDTEco9s8dl9phmjRztDRMDn9P89qu+KL+OK5gt2s2ufPg2hQ23uaxy1q1mhW9nK4BEhwWOexJHvXTalotvqciSTzsNqBNoAI4Oc896KcYJvzG5Nu5F4Yu2dbjMCRKqRhUUk468E9z9PWt3zz/dFZWmaXFpSSLFcPIHxwwA24z0x9asJdW7zGFbhGkHVAeRTdr6Cu+pvwXJECDA6UVQjkURqNx6UUgKe4Z61X1An+zrnaTu8l8fXaay11YmEyeXGADjaZfm/LFSXNw0kUkRUFWRgdrEHp0HHU54pgc/MZXe3XGFlPmOzg7w20ZUheMehPPbjFdqG+Uc9qpDwszWsURv7iJtg3r5IcDjpnjJ96sR6JPFNE76rcOm4KUNv1469auFOPJdy1+f8AkV8Su2SnDD71Y1tpU8N5GzvH5Ub7g4+83+c10U+mrBA8omkk2jO1E5P05qL7KoZ1b7T8ndYs5+nNSk2SCuAo+aipY9PSSMOJZlB7NFg/zopAeSraxFQTqlspIzg+Zkf+O1etv7OgsJoZZbKad87Jy8oZMjjA29jzW6/w+SNkV9WbLjI22hI/H5qlsvA21jNBq7KVXPz2Xb6E1V/Iy5JfzP8AD/I5PyF/6DUH/fUv/wATV6yksoLSaKe4trmWTOyUyzApxjgbfXmm6v4fNhqP2ZbxZS0ay7mURfezxgmqSW0tpOjpOofGQVII59cGlfyBU5fzv8P8hfIA/wCY1D/31L/8TV2xls7aCZLie2vHf7hMswK8HgfL68/hWfLpzqC7zRnucOCT+tLa20iSiWGZVZDnLED+Z5ouuwKnL+Z/h/kU/OnHWaXP++aKma33MWaUknkkiika2N+PWL0xPuvbjefuHzyAPXIpLLWtRW+Lm7nkTb91pCcH1AORn60UVyRbTPosTRh7N6FW9unub2WW4+ZicAElto9ATSXUlqZB9nhCLtGQTnmiilK9y6NGHItBC1v9lUiJfN3cnI6fSki8lg29E6YXkDB9aKKk19lDsRlkz91Pyooopj9lDsf/2Q==",
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAB4ADMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlkYIg3QIwJPzHP+NOnmSVFVLaKIqTlkzk/XJqq07bduBgdqb5xH8IrP2cj3/r+Gve/wCZMAScDrQQQcEc061F3J++tY+VbaCr4OSM/wAqmkh1IyebJGd+B8xkGeRxzn0FTySK/tGh3/Blepfs1xvRPJk3uMquw5YeoHeqf2g/3R+dXk1nU57i22TytNF8kB38rnjANPkZMsxo/Zf5/wCRC6MjFXUqwOCDwRRUU91M88jTjdKWO8scknvRRySKWY0Or/BkIK5O4n2xTolRnHmlvL5ztIz096UWsptHu9pESuE3EHBJ9P8APentaXJhXMACgbgwAyR7nNdFz5yzIXGxj5bNszxlhn9DTNx6bv1pY22ksqhsDoVyKl+1ZtZYvIjxI+4uFI2n0HYUgJtJTT5L4Lqs0kVtsbLR9d2OB0PGfatxLTwbvHmajdhe5XcT/wCgVzf2WcQwzGJhHMxWNj0Yip5bC8e/kt/s2J1Xc0aAYAA/KgC1eQ6Ity4tLmd4eNpIyegz2HfPaiskUUwNiTUro+Go9PMiRweZu2YILjP3s9Mbs/lVV4ZAgZZVdgoIURflzinu6TaPvnuN84cBAxJKgDGOuMYx+VQuLQxgJkOVHzGQkA/TFSiprVXIHEu5t52Nt5z8uRUXOw8jGemf6U9goyC+eOCo7035PLzlt+emOMUydtS1IB9htdskZyTlAW3Id3cdDnGePWrD27f2rLGL2D5VOJTuCsPbvVd2gNjahA3nq53hpPlPPGB/DU4a2fUnkZ5UgKZwJhnOMAFs8jNIZnc9zz3opfxzRVCNC2nVLCR2t1kCyDdlflORgA46d+hokMzwqv2KQJsHIhAJHc5xUlt9pfTJAhd12tiJE3ZAABJHpyeagnE0aRtvik3KAFQEkDHfiojfU2rNe6l27W/4f1KZZBu2pkFcfMc496ZkeWRtGcg7u49qlPmEthdp28gDbxUY3+ScH93uGRnviqMGW3ybC3VoiF3ny5WiOG9RnPOD/OrJm3avNOtorMsbExrB93jBO3jBA71X8xvsNt8y7Ek+6Zc7eRyRjgVakjuTrUyRzxiQRsS4lIDcZPzd+aRZkj2ooycnd1zz9aKZJ0kFpLD4WN7DqgiE7LiJE2ncpPy569RnPSsaZY/Lj8mdy5A3b3GBx2xUsBtDZvFIrBG581uofHYDt9aimeFo1XyPLGB8yx4JOOeSamPUua0iys68ne4JAyCPmz7U3C+Xu3fPnG3Hb1zTmMYzgFgRgZOMGmZG0jHzZ657UyNy1MgGnW7LK5mLH5GACqP4cf8A16liWJdRkE80wUISGQDdwOM54qJzELG3VYF37yWfB+f2P06cVYM0KalMxtI4lKY8vyyQvuARkUDM7uec89aKOMnHTPFFMDctJkPhq4ik0rzlVj/pCLgof72cdsgfSqF08/kwmfy3TGEXzd2OPTPFW4NVv4dEltFlKxbdgQxjBRsk89zVWRMRqVupS+0YBAA9hnNJIJO7RU3Md3loBlSGAHbv1poZ/JK/8s92Tx3x605wxLeZIAQueTnPtUePlJ3Dr070E2V9S7J9p/syz3HEHmNsO4cHPJ6ZHNX/AC7463cRXAU3DQkOC4HHBIzjms940WytWjeQy7iHRocBeeMH+KpEijOosj3DiMISriDJPplcfrQWUeSSSMHPIxRQBx1B9xRVWJDJyDk5AwOe3pRRRSAKKKKYBSr60g5NOoQBz2FFLiinYRrRrbGJ90Me8/cOQMeuRSWDJFqHmiCNwF4BUfKfUAgjNFFcUW0z6TE0Yezeg2byftMp8iJAW4RRwvsKfdGzMo8i3VF2jIODzRRSle5dGjDkWgEWv2UEQp5u7k8dPpSRLbsG3Rx9ML0GDRRSNfZQ7EZMYONif98iiiijXuP2MOyP/9k=",
];

// BulkScanModal 컴포넌트
function BulkScanModal(p) {
  var onClose = p.onClose;
  var players = p.players;
  var savePlayers = p.savePlayers;
  var lineupMap = p.lineupMap;
  var saveLineupMap = p.saveLineupMap;
  var userId = p.userId || '';

  // API 키는 서버(/api/scan)에서 관리 - 클라이언트 불필요

  var _imgs = useState([null,null,null,null]); var imgs = _imgs[0]; var setImgs = _imgs[1];
  var _step = useState('upload'); var step = _step[0]; var setStep = _step[1];
  var _msg = useState(''); var msg = _msg[0]; var setMsg = _msg[1];
  var _err = useState(''); var err = _err[0]; var setErr = _err[1];
  var _extracted = useState([]); var extracted = _extracted[0]; var setExtracted = _extracted[1];
  var _result = useState(null); var result = _result[0]; var setResult = _result[1];
  var _confirm = useState(false); var confirmOpen = _confirm[0]; var setConfirmOpen = _confirm[1];

  var fileRefs = [React.useRef(), React.useRef(), React.useRef(), React.useRef()];

  var imgLabels = [
    {title:'타자 라인업', hint:'화면 1 (필수)', color:'#00d4ff', icon:'⚾'},
    {title:'타자 스킬', hint:'한 눈에 보기 (선택)', color:'#a78bfa', icon:'⚡'},
    {title:'투수 라인업', hint:'화면 1 (선택)', color:'#fb923c', icon:'🎯'},
    {title:'투수 스킬', hint:'한 눈에 보기 (선택)', color:'#a78bfa', icon:'⚡'},
  ];

  var readImg = function(file) {
    return new Promise(function(res, rej) {
      if (!file||!file.type.startsWith('image/')) { rej(new Error('이미지 파일만 가능')); return; }
      var r = new FileReader();
      r.onload = function(e) { var src=e.target.result; res({src:src, base64:src.split(',')[1], mediaType:file.type, name:file.name}); };
      r.onerror = function(){ rej(new Error('읽기 실패')); };
      r.readAsDataURL(file);
    });
  };

  var handleFile = function(idx, file) {
    readImg(file).then(function(img) {
      var n = imgs.slice(); n[idx]=img; setImgs(n); setErr('');
    }).catch(function(e){ setErr(e.message); });
  };



  var parseLineupJSON = function(raw, label) {
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch(e) {
      var lastClose = raw.lastIndexOf('}');
      if (lastClose > 0) {
        try { return JSON.parse(raw.slice(0, lastClose + 1) + ']'); } catch(e2) {}
      }
      throw new Error(label + ' JSON 파싱 실패: ' + e.message);
    }
  };

  var runScan = async function() {
    if (!imgs[0]) { setErr('타자 라인업 화면(①)은 필수입니다.'); return; }
    setStep('scanning'); setErr('');
    try {
      var allPlayers = [];

      // ── 라인업 병렬 분석 (타자+투수 동시) ──────────────────────
      setMsg('⚾ 라인업 분석 중… (타자' + (imgs[2] ? '+투수 동시' : '') + ')');
      var lineupPromises = [
        scanLineupScreen(imgs[0].base64, imgs[0].mediaType, '타자', userId),
        imgs[2] ? scanLineupScreen(imgs[2].base64, imgs[2].mediaType, '투수', userId) : Promise.resolve(null),
      ];
      var lineupResults = await Promise.all(lineupPromises);
      var batRaw = lineupResults[0];
      var pitRaw = lineupResults[1];

      var batParsed = parseLineupJSON(batRaw, '타자');
      if (!Array.isArray(batParsed)) throw new Error('타자 분석 결과 형식 오류');
      var bats = correctCardType(batParsed).map(function(p){ return Object.assign({skill1:'',s1Lv:0,skill2:'',s2Lv:0,skill3:'',s3Lv:0}, p); });

      var pits = [];
      if (pitRaw) {
        var pitParsed = parseLineupJSON(pitRaw, '투수');
        if (!Array.isArray(pitParsed)) throw new Error('투수 분석 결과 형식 오류');
        pits = correctCardType(pitParsed).map(function(p){ return Object.assign({skill1:'',s1Lv:0,skill2:'',s2Lv:0,skill3:'',s3Lv:0}, p); });
      }

      // ── 스킬 병렬 분석 (타자+투수 동시) ──────────────────────
      var hasBS = !!(imgs[1]);
      var hasPS = !!(imgs[3] && pits.length > 0);
      if (hasBS || hasPS) {
        setMsg('⚡ 스킬 분석 중… (타자' + (hasPS ? '+투수 동시' : '') + ')');
        var skillPromises = [
          hasBS ? scanSkillScreen(imgs[1].base64, imgs[1].mediaType, bats.map(function(b){return b.name;}), userId) : Promise.resolve(null),
          hasPS ? scanSkillScreen(imgs[3].base64, imgs[3].mediaType, pits.map(function(b){return b.name;}), userId) : Promise.resolve(null),
        ];
        var skillResults = await Promise.all(skillPromises);
        if (skillResults[0]) {
          var bSkill = typeof skillResults[0] === 'string' ? JSON.parse(skillResults[0]) : skillResults[0];
          bats = mergeSkillsInto(bats, Array.isArray(bSkill) ? bSkill : []);
        }
        if (skillResults[1]) {
          var pSkill = typeof skillResults[1] === 'string' ? JSON.parse(skillResults[1]) : skillResults[1];
          pits = mergeSkillsInto(pits, Array.isArray(pSkill) ? pSkill : []);
        }
      }

      allPlayers = allPlayers.concat(bats).concat(pits);
      // 도감 매칭
      var withMatch = allPlayers.map(function(sc) {
        var res = matchSeedPlayer(sc);
        return { scanned: sc, seed: res.seed, candidates: res.candidates, matched: !!res.seed, needSelect: res.candidates.length > 0, failed: !!res.failed };
      });
      setExtracted(withMatch);
      setStep('review');
    } catch(e) {
      setErr('분석 실패: ' + e.message);
      setStep('upload');
    }
    setMsg('');
  };

  /* 컴포넌트 레벨 getSkillCat (리뷰 UI 렌더링에서도 사용) */
  var getSkillCat = function(seed) {
    if (!seed) return '타자';
    if (seed.role === '타자') return '타자';
    if (seed.position === '선발') return '선발';
    if (seed.position === '마무리') return '마무리';
    return '중계';
  };

  var runSave = function() {
    /* setExtracted 함수형 업데이트로 최신 상태 보장 */
    setExtracted(function(latestExtracted) {
    var extractedToSave = latestExtracted;
    var newPlayers = players.slice();
    var newLm = Object.assign({}, lineupMap);
    var ok = []; var warn = []; var skip = [];
    // 스킬 카테고리 결정 (컴포넌트 레벨 함수 재사용)
    // 스킬 이름 퍼지 매칭 + 저장값 결정
    var resolveSkills = function(sc, seed) {
      var cat = getSkillCat(seed);
      var sDB = p.skills || {};
      var missingNames = [];
      var resolve = function(raw, lv) {
        if (!raw) return { name: '', lv: 0, candidates: [] };
        var res = resolveSkillName(raw, cat, seed, sDB, sc.slot);
        if (res.missing) missingNames.push(raw);
        return { name: res.name || raw, lv: lv || 0, candidates: res.candidates || [] };
      };
      var s1 = resolve(sc.skill1, sc.s1Lv);
      var s2 = resolve(sc.skill2, sc.s2Lv);
      var s3 = resolve(sc.skill3, sc.s3Lv);
      /* 후보 선택이 필요한 스킬 목록 */
      var needSelect = [];
      if (s1.candidates.length > 1) needSelect.push({ slot: 1, raw: sc.skill1, candidates: s1.candidates, selected: s1.name });
      if (s2.candidates.length > 1) needSelect.push({ slot: 2, raw: sc.skill2, candidates: s2.candidates, selected: s2.name });
      if (s3.candidates.length > 1) needSelect.push({ slot: 3, raw: sc.skill3, candidates: s3.candidates, selected: s3.name });
      return { s1: s1, s2: s2, s3: s3, missing: missingNames, needSelect: needSelect };
    };
    extractedToSave.forEach(function(item) {
      if (item.failed) { skip.push(item.scanned.name + ': 카드 종류 인식 실패'); return; }
      if (item.needSelect) { skip.push(item.scanned.name + ': 임팩트 종류 선택 필요'); return; }
      if (!item.matched) { skip.push(item.scanned.name + ': 선수도감 미등록'); return; }
      var sc = item.scanned; var seed = item.seed;
      // 스킬 퍼지 매칭
      var skRes = resolveSkills(sc, seed);
      if (skRes.missing.length > 0) {
        warn.push(sc.name + ': 인식 불가 스킬 → ' + skRes.missing.join(', '));
      }
      /* 스킬 후보 선택 필요한 경우 → extracted 업데이트 후 리뷰에서 표시 */
      if (skRes.needSelect && skRes.needSelect.length > 0) {
        var updIdx = newPlayers.length; // placeholder
        setExtracted(function(prev) {
          return prev.map(function(it2) {
            if (it2 === item) return Object.assign({}, it2, { skRes: skRes, needSkillSelect: true });
            return it2;
          });
        });
      }
      // 중복 체크
      var already = newPlayers.some(function(x){ return x.name===seed.name && (x.cardType||'')===(seed.cardType||'') && (x.year||'')===(seed.year||'') && (x.impactType||'')===(seed.impactType||''); });
      var id2 = already
        ? newPlayers.find(function(x){ return x.name===seed.name && (x.cardType||'')===(seed.cardType||''); }).id
        : 'p'+Date.now()+'_'+Math.random().toString(36).slice(2,5);
      if (!already) {
        var np = {
          id: id2, dbId: seed.id,
          name: seed.name, cardType: seed.cardType,
          role: seed.role, position: seed.position || '',
          year: seed.year || '', team: seed.team || '',
          liveType: seed.liveType || "",
          trainP:0, trainA:0, trainE:0, trainC:0, trainS:0,
          specPower:0, specAccuracy:0, specEye:0, specChange:0, specStuff:0,
          skill1: skRes.s1.name, s1Lv: skRes.s1.lv,
          skill2: skRes.s2.name, s2Lv: skRes.s2.lv,
          skill3: skRes.s3.name, s3Lv: skRes.s3.lv,
          pot1:'', pot2:'', isFa:false, enhance:'9각성'
        };
        newPlayers.push(np);
        ok.push(sc.name);
      } else {
        // 스킬만 업데이트
        newPlayers = newPlayers.map(function(x){ if(x.id!==id2)return x; return Object.assign({},x,{skill1:skRes.s1.name||x.skill1,s1Lv:skRes.s1.lv||x.s1Lv,skill2:skRes.s2.name||x.skill2,s2Lv:skRes.s2.lv||x.s2Lv,skill3:skRes.s3.name||x.skill3,s3Lv:skRes.s3.lv||x.s3Lv}); });
        ok.push(sc.name + '(스킬갱신)');
      }
      // 라인업 슬롯 배치
      var slot = sc.slot;
      if (slot) {
        if (slot === 'DH' && seed.subPosition && seed.subPosition !== 'DH') {
          warn.push(sc.name + ' → DH 배치 (도감포지션:' + seed.subPosition + ')');
        }
        newLm[slot] = id2;
      }
    });
    savePlayers(newPlayers);
    saveLineupMap(newLm);
    setResult({ ok: ok, warn: warn, skip: skip });
    setStep('done');
    setConfirmOpen(false);
    return latestExtracted; /* 상태 변경 없이 최신값만 읽기 */
    }); /* setExtracted 함수형 끝 */
  };

  var OVERLAY = { position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 };
  var BOX = { background:'#111827', border:'1px solid #1e3a5f', borderRadius:16, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' };
  var HDR = { padding:'18px 24px 14px', borderBottom:'1px solid #1e3a5f', display:'flex', justifyContent:'space-between', alignItems:'flex-start' };
  var BODY = { padding:'18px 24px 24px', display:'flex', flexDirection:'column', gap:14 };
  var BTN_P = { background:'linear-gradient(135deg,#4ade80,#22c55e)', color:'#000', fontWeight:900, fontSize:13, padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer' };
  var BTN_G = { background:'transparent', border:'1px solid #1e3a5f', color:'#94a3b8', fontSize:12, padding:'9px 16px', borderRadius:8, cursor:'pointer' };

  return (
    React.createElement('div', {style:OVERLAY, onClick:onClose},
      React.createElement('div', {style:BOX, onClick:function(e){e.stopPropagation();}},
        // Header
        React.createElement('div', {style:HDR},
          React.createElement('div', null,
            React.createElement('div', {style:{fontSize:11,fontWeight:900,background:'linear-gradient(135deg,#00d4ff,#0080ff)',color:'#000',display:'inline-block',padding:'1px 7px',borderRadius:3,letterSpacing:1,marginBottom:6}}, 'AI SCANNER'),
            React.createElement('div', {style:{fontSize:17,fontWeight:900,color:'#e2e8f0'}}, '선수 일괄 업데이트'),
            React.createElement('div', {style:{fontSize:11,color:'#64748b',marginTop:2}}, '라인업 캡처 → 선수도감 매칭 → 내 선수 자동 등록')
          ),
          React.createElement('button', {onClick:onClose,style:{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer',padding:'0 4px'}}, '✕')
        ),

        React.createElement('div', {style:BODY},



          // Upload step
          step === 'upload' && React.createElement(React.Fragment, null,
            React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},
              imgLabels.map(function(lbl, i) {
                var img = imgs[i];
                return React.createElement('div', {key:i, style:{display:'flex',flexDirection:'column',gap:5}},
                  React.createElement('div', {style:{display:'flex',alignItems:'center',gap:5}},
                    React.createElement('span', {style:{fontSize:10,fontWeight:900,padding:'1px 6px',borderRadius:3,background:lbl.color+'22',color:lbl.color,border:'1px solid '+lbl.color+'44'}}, '화면'+(i+1)),
                    React.createElement('span', {style:{fontSize:11,fontWeight:700,color:'#e2e8f0'}}, lbl.title),

                  ),
                  React.createElement('div', {
                    style:{border:'2px dashed '+(img?lbl.color+'88':'#1e3a5f'),borderRadius:9,background:'#0d1117',minHeight:110,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:8,transition:'all 0.2s'},
                    onClick:function(idx){return function(){fileRefs[idx].current&&fileRefs[idx].current.click();};}(i),
                    onDragOver:function(e){e.preventDefault();},
                    onDrop:function(idx){return function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleFile(idx,f);};}(i)
                  },
                    React.createElement('input', {ref:fileRefs[i],type:'file',accept:'image/*',style:{display:'none'},onChange:function(idx){return function(e){if(e.target.files[0])handleFile(idx,e.target.files[0]);};}(i)}),
                    img
                      ? React.createElement('img', {src:img.src,alt:'',style:{maxWidth:'100%',maxHeight:120,objectFit:'contain',borderRadius:5}})
                      : React.createElement('div', {style:{display:'flex',flexDirection:'column',alignItems:'center',gap:4}},
                          React.createElement('div', {style:{position:'relative'}},
                            React.createElement('img', {src:SCAN_THUMBS[i],alt:'예시',style:{height:90,objectFit:'contain',borderRadius:4,opacity:0.5,border:'1px solid #1e3a5f'}}),
                            React.createElement('div', {style:{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.3)',borderRadius:4}},
                              React.createElement('span', {style:{fontSize:9,color:'#e2e8f0',fontWeight:700,textAlign:'center',padding:'2px 4px',background:'rgba(0,0,0,0.5)',borderRadius:3}}, '예시')
                            )
                          ),
                          React.createElement('div', {style:{fontSize:9,color:'#64748b'}}, '클릭 또는 드래그')
                        )
                  ),
                  img&&React.createElement('div', {style:{fontSize:10,color:'#22c55e'}}, '✓ '+img.name)
                );
              })
            ),
            err&&React.createElement('div', {style:{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#fca5a5'}}, '⚠️ '+err),
            React.createElement('div', {style:{display:'flex',gap:10}},
              React.createElement('button', {style:{...BTN_P,opacity:imgs[0]?1:0.35,cursor:imgs[0]?'pointer':'not-allowed'},disabled:!imgs[0],onClick:runScan},
                '🔍 분석 시작' + (imgs[0]&&imgs[2]?' (타자+투수)':imgs[0]?' (타자만)':'')
              ),
              (imgs[0]||imgs[1]||imgs[2]||imgs[3])&&React.createElement('button', {style:BTN_G,onClick:function(){setImgs([null,null,null,null]);setErr('');}}, '초기화')
            )
          ),

          // Scanning
          step === 'scanning' && React.createElement('div', {style:{display:'flex',alignItems:'center',gap:14,padding:'24px 0',justifyContent:'center'}},
            React.createElement('div', {style:{width:24,height:24,border:'3px solid #1e3a5f',borderTopColor:'#00d4ff',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}),
            React.createElement('div', null,
              React.createElement('div', {style:{color:'#e2e8f0',fontWeight:600,fontSize:13}}, msg),
              React.createElement('div', {style:{color:'#64748b',fontSize:11,marginTop:3}}, '잠시만 기다려주세요…')
            )
          ),

          // Review
          step === 'review' && React.createElement(React.Fragment, null,
            React.createElement('div', {style:{fontSize:14,fontWeight:700,color:'#22c55e'}},
              '✅ ' + extracted.length + '명 추출 완료'
            ),
            React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:6,maxHeight:340,overflowY:'auto'}},
              extracted.map(function(item, i) {
                var sc = item.scanned; var matched = item.matched;
                var isDH = sc.slot==='DH' && item.seed && item.seed.subPosition && item.seed.subPosition!=='DH';
                var CARD_CLR = {골든글러브:{bg:'#78350f',brd:'#fbbf24',txt:'#fde68a'},시그니처:{bg:'#701a75',brd:'#e879f9',txt:'#f5d0fe'},임팩트:{bg:'#14532d',brd:'#4ade80',txt:'#bbf7d0'},국가대표:{bg:'#1e3a8a',brd:'#60a5fa',txt:'#bfdbfe'},라이브:{bg:'#7c2d12',brd:'#fb923c',txt:'#fed7aa'},시즌:{bg:'#1e293b',brd:'#64748b',txt:'#cbd5e1'},올스타:{bg:'#4a1d96',brd:'#a78bfa',txt:'#ede9fe'}};
                var cs = CARD_CLR[sc.cardType]||CARD_CLR['시즌'];
                return React.createElement('div', {key:i, style:{background:'#0d1117',borderRadius:8,padding:'8px 12px',border:'1px solid '+(matched?'#1e3a5f':item.needSelect?'rgba(251,191,36,0.4)':item.failed?'rgba(156,163,175,0.4)':'rgba(239,68,68,0.3)'),opacity:(matched||item.needSelect)?1:0.65}},
                  React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}},
                    React.createElement('span', {style:{fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:3,background:cs.bg,color:cs.txt,border:'1px solid '+cs.brd,whiteSpace:'nowrap'}}, sc.cardType||'?'),
                    React.createElement('span', {style:{fontWeight:900,fontSize:13,color:'#e2e8f0'}}, sc.name),
                    sc.year&&React.createElement('span', {style:{fontSize:10,color:'#64748b'}}, "'"+sc.year),
                    sc.slot&&React.createElement('span', {style:{fontSize:11,fontWeight:700,color:'#00d4ff',background:'rgba(0,212,255,0.1)',padding:'1px 6px',borderRadius:4}}, sc.slot),
                    matched
                      ? React.createElement('span', {style:{fontSize:10,color:'#22c55e'}}, '✓ 매칭됨')
                      : item.failed
                        ? React.createElement('span', {style:{fontSize:10,color:'#9ca3af'}}, '? 카드 종류 인식 실패')
                        : item.needSelect
                          ? React.createElement('span', {style:{fontSize:10,color:'#fbbf24'}}, '⚠️ 임팩트 종류 선택 필요')
                          : React.createElement('span', {style:{fontSize:10,color:'#ef4444'}}, '✗ 도감 미등록'),
                    isDH&&React.createElement('span', {style:{fontSize:9,color:'#fbbf24'}}, '⚠️ DH(포지션 상이)')
                  ),
                  item.needSelect && React.createElement('div', {style:{marginTop:6}},
                    React.createElement('select', {
                      style:{width:'100%',padding:'4px 8px',background:'#1e293b',border:'1px solid #fbbf24',borderRadius:4,color:'#e2e8f0',fontSize:11,outline:'none'},
                      value: item.selectedImpactIdx !== undefined ? item.selectedImpactIdx : '',
                      onChange: function(e) {
                        var idx = parseInt(e.target.value);
                        var next = extracted.slice();
                        next[i] = Object.assign({}, next[i], {
                          selectedImpactIdx: idx,
                          seed: item.candidates[idx],
                          matched: true,
                          needSelect: false
                        });
                        setExtracted(next);
                      }
                    },
                      React.createElement('option', {value:''}, '-- 임팩트 종류 선택 --'),
                      item.candidates.map(function(c, ci) {
                        return React.createElement('option', {key:ci, value:ci}, c.impactType || ('종류 '+ci));
                      })
                    )
                  ),
                  (sc.skill1||sc.skill2||sc.skill3)&&React.createElement('div', {style:{marginTop:6}},
                    (function() {
                      try {
                        var skillsInfo = [
                          {raw:sc.skill1, lv:sc.s1Lv, idx:0},
                          {raw:sc.skill2, lv:sc.s2Lv, idx:1},
                          {raw:sc.skill3, lv:sc.s3Lv, idx:2},
                        ].filter(function(s){return s.raw;});
                        var cat = item.seed ? getSkillCat(item.seed) : '타자';
                        var sDB = p.skills || {};
                        var rowIdx = i; /* 클로저 캡처 */
                        return skillsInfo.map(function(sk) {
                          var res = resolveSkillName(sk.raw, cat, item.seed, sDB, sc.slot);
                          var cands = (res && res.candidates && res.candidates.length > 1) ? res.candidates : [];
                          var hasCandidates = cands.length > 0;
                          var skIdx = sk.idx; /* 클로저 캡처 */
                          return React.createElement('div', {key:sk.idx, style:{display:'flex',alignItems:'center',gap:4,marginBottom:3}},
                            React.createElement('span', {style:{fontSize:9,color:'#a78bfa',width:16,flexShrink:0}}, 'S'+(sk.idx+1)),
                            hasCandidates
                              ? React.createElement('select', {
                                  defaultValue: res.name,
                                  onChange: function(e) {
                                    var val = e.target.value;
                                    setExtracted(function(prev) {
                                      var next = prev.slice();
                                      var sc2 = Object.assign({}, next[rowIdx].scanned);
                                      if (skIdx===0) sc2.skill1 = val;
                                      if (skIdx===1) sc2.skill2 = val;
                                      if (skIdx===2) sc2.skill3 = val;
                                      next[rowIdx] = Object.assign({}, next[rowIdx], {scanned: sc2});
                                      return next;
                                    });
                                  },
                                  style:{flex:1,padding:'2px 4px',fontSize:10,background:'#1e293b',border:'1px solid #FBBF24',borderRadius:4,color:'#e2e8f0'}
                                },
                                cands.map(function(c){ return React.createElement('option',{key:c,value:c},c); })
                              )
                              : React.createElement('span', {style:{fontSize:10,color:(res&&res.missing)?'#EF4444':'#c4b5fd'}}, (res&&res.name)||('❌ '+sk.raw)),
                            React.createElement('span', {style:{fontSize:9,color:'#64748b',flexShrink:0}}, 'Lv'+sk.lv)
                          );
                        });
                      } catch(e) {
                        return React.createElement('div', {style:{fontSize:10,color:'#94a3b8'}},
                          [sc.skill1&&('S1:'+sc.skill1), sc.skill2&&('S2:'+sc.skill2), sc.skill3&&('S3:'+sc.skill3)].filter(Boolean).join(' · ')
                        );
                      }
                    })()
                  )
                );
              })
            ),
            err&&React.createElement('div', {style:{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#fca5a5'}}, '⚠️ '+err),
            React.createElement('div', {style:{display:'flex',gap:10,flexWrap:'wrap'}},
              React.createElement('button', {style:BTN_P,onClick:function(){setConfirmOpen(true);}},
                '💾 저장하기 ('+extracted.filter(function(x){return x.matched;}).length+'명 매칭 / 선택필요:'+extracted.filter(function(x){return x.needSelect;}).length+'명)'
              ),
              React.createElement('button', {style:BTN_G,onClick:function(){setStep('upload');setExtracted([]);}}, '처음부터')
            )
          ),

          // Done
          step === 'done' && result && React.createElement('div', {style:{display:'flex',flexDirection:'column',alignItems:'center',gap:10,padding:'16px 0'}},
            React.createElement('div', {style:{fontSize:40}}, '✅'),
            React.createElement('div', {style:{fontSize:18,fontWeight:900,color:'#22c55e'}}, result.ok.length+'명 처리 완료'),
            result.ok.length>0&&React.createElement('div', {style:{background:'#0d1117',border:'1px solid #1e3a5f',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:11,color:'#94a3b8'}},
              result.ok.map(function(n,i){return React.createElement('div',{key:i},'✓ '+n);})
            ),
            result.warn.length>0&&React.createElement('div', {style:{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:11,color:'#fbbf24'}},
              result.warn.map(function(n,i){return React.createElement('div',{key:i},'⚠️ '+n);})
            ),
            result.skip.length>0&&React.createElement('div', {style:{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:11,color:'#fca5a5'}},
              result.skip.map(function(n,i){return React.createElement('div',{key:i},'✗ '+n);})
            ),
            React.createElement('div', {style:{display:'flex',gap:10}},
              React.createElement('button', {style:BTN_P,onClick:function(){setStep('upload');setImgs([null,null,null,null]);setExtracted([]);setResult(null);}}, '계속 추가'),
              React.createElement('button', {style:BTN_G,onClick:onClose}, '닫기')
            )
          )
        ),

        // Confirm modal
        confirmOpen&&React.createElement('div', {style:{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',zIndex:4000,display:'flex',alignItems:'center',justifyContent:'center',padding:16}},
          React.createElement('div', {style:{background:'#111827',border:'1px solid #1e3a5f',borderRadius:14,padding:'24px 22px',maxWidth:400,width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:10}},
            React.createElement('div', {style:{fontSize:28}}, '⚠️'),
            React.createElement('div', {style:{fontSize:15,fontWeight:900,color:'#e2e8f0'}}, '라인업 저장 확인'),
            React.createElement('div', {style:{fontSize:12,color:'#94a3b8',textAlign:'center'}},
              '매칭된 ' + extracted.filter(function(x){return x.matched;}).length + '명을 내 선수에 추가하고 라인업 슬롯에 배치합니다.'
            ),
            React.createElement('div', {style:{background:'#0d1117',border:'1px solid #1e3a5f',borderRadius:8,padding:'10px 14px',width:'100%',maxHeight:180,overflowY:'auto'}},
              extracted.filter(function(x){return x.matched;}).map(function(item,i){
                return React.createElement('div', {key:i, style:{display:'flex',justifyContent:'space-between',fontSize:11,padding:'3px 0',borderBottom:'1px solid #1e3a5f',color:'#e2e8f0'}},
                  React.createElement('span', null, item.scanned.name),
                  React.createElement('span', {style:{color:'#00d4ff'}}, item.scanned.slot||'-')
                );
              })
            ),
            React.createElement('div', {style:{fontSize:10,color:'#ef4444'}}, '기존 해당 슬롯 선수는 교체됩니다.'),
            React.createElement('div', {style:{display:'flex',gap:10,marginTop:4}},
              React.createElement('button', {style:{...BTN_P,flex:1},onClick:runSave}, '✅ 확인, 저장'),
              React.createElement('button', {style:{...BTN_G,flex:1},onClick:function(){setConfirmOpen(false);}}, '취소')
            )
          )
        )
      )
    )
  );
}


function MyPlayersPage(p) {
  var mob = p.mobile;
  var players = p.players;
  var save = p.savePlayers;
  var lm = p.lineupMap || {};
  var saveLM = p.saveLineupMap || function(){};
  var skillsDB = p.skills || {};
  var _sel = useState(null); var selId = _sel[0]; var setSelId = _sel[1];
  var _filter = useState("타자"); var filter = _filter[0]; var setFilter = _filter[1];
  var _addOpen = useState(false); var addOpen = _addOpen[0]; var setAddOpen = _addOpen[1];
  var _addQuery = useState(""); var addQuery = _addQuery[0]; var setAddQuery = _addQuery[1];
  var _scanOpen = useState(false); var scanOpen = _scanOpen[0]; var setScanOpen = _scanOpen[1];
  

  var getSlot = function(plId) {
    for (var k in lm) { if (lm[k] === plId) return k; }
    return null;
  };

  var getSkillCat = function(pl) {
    if (pl.role === "타자") return "타자";
    if (pl.position === "선발") return "선발";
    if (pl.position === "마무리") return "마무리";
    return "중계";
  };
  var getSkillOpts = function(pl) {
    var t = skillsDB[getSkillCat(pl)] || {};
    return Object.keys(t);
  };

  var upd = function(id, key, val, key2, val2) {
    save(players.map(function(x) {
      if (x.id !== id) return x;
      var c = Object.assign({}, x);
      c[key] = val;
      if (key2 !== undefined) c[key2] = val2;
      return c;
    }));
  };

  var mergedPlayers = players.map(function(x) {
    var m = mergePl(x) || x;
    /* subPosition이 없거나 SP1인데 중계/마무리인 경우 보정 */
    if (m.role === "투수" && (!m.subPosition || m.subPosition === "SP1")) {
      var fixedSub = m.position === "마무리" ? "CP" : m.position === "중계" ? "RP1" : "SP1";
      if (m.subPosition !== fixedSub) m = Object.assign({}, m, { subPosition: fixedSub });
    }
    return m;
  });
  var bats = mergedPlayers.filter(function(x) { return x.role === "타자"; });
  var sps = mergedPlayers.filter(function(x) { return x.position === "선발"; });
  var rps = mergedPlayers.filter(function(x) { return x.position === "중계"; });
  var cps = mergedPlayers.filter(function(x) { return x.position === "마무리"; });
  var filtered = filter === "타자" ? bats : filter === "선발" ? sps : filter === "중계" ? rps : cps;

  var miniIn = function(id, field, val, color, max) {
    return (<input type="number" value={val || 0} onChange={function(e) { var v = parseInt(e.target.value) || 0; if (max) v = Math.min(max, Math.max(0, v)); upd(id, field, v); }} style={{ width: 32, padding: "2px 1px", textAlign: "center", background: "var(--inner)", border: "1px solid " + (color || "var(--bd)") + "44", borderRadius: 3, color: color || "var(--t1)", fontSize: 10, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />);
  };

  var skillSel = function(pl, num) {
    var opts = getSkillOpts(pl);
    var nf = "skill" + num; var lf = "s" + num + "Lv";
    var c = {8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[pl[lf]] || "var(--t2)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <select value={pl[nf] || ""} onChange={function(e) { upd(pl.id, nf, e.target.value); }}
          style={{ width: 88, padding: "2px", fontSize: 9, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>
          <option value="">{"없음"}</option>
          {opts.map(function(s) { return (<option key={s} value={s}>{s}</option>); })}
        </select>
        <select value={pl[lf] || 0} onChange={function(e) { upd(pl.id, lf, parseInt(e.target.value)); }}
          style={{ width: 36, padding: "2px", fontSize: 9, background: "var(--inner)", border: "1px solid " + c + "44", borderRadius: 3, color: c, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }}>
          {[0,5,6,7,8,9,10].map(function(v) { return (<option key={v} value={v}>{v === 0 ? "-" : "Lv" + v}</option>); })}
        </select>
      </div>
    );
  };

  var renderRow = function(pl, idx) {
    var isBat = pl.role === "타자";
    var slot = getSlot(pl.id);
    var isSel = selId === pl.id;
    var lu = { enhance: pl.enhance || "9각성", trainP: pl.trainP||0, trainA: pl.trainA||0, trainE: pl.trainE||0, trainC: pl.trainC||0, trainS: pl.trainS||0, skill1: pl.skill1||"", s1Lv: pl.s1Lv||0, skill2: pl.skill2||"", s2Lv: pl.s2Lv||0, skill3: pl.skill3||"", s3Lv: pl.s3Lv||0 };
    var calc = isBat ? calcBat(pl, lu) : calcPit(pl, lu);
    var accentC = isBat ? "var(--acc)" : "var(--acp)";

    return (
      <React.Fragment key={pl.id}>
        <div onClick={function() { setSelId(isSel ? null : pl.id); }} style={{ display: "grid", gridTemplateColumns: mob ? "1fr 50px" : "minmax(110px,1fr) 70px 90px 70px 130px 50px", alignItems: "center", gap: 5, padding: "8px 12px", background: isSel ? "var(--ta)" : (idx % 2 === 0 ? "var(--re)" : "transparent"), borderBottom: "1px solid var(--bd)", cursor: "pointer", borderLeft: slot ? ("3px solid " + accentC) : "3px solid transparent" }}>
          {/* Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Badge type={pl.cardType} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span>
                {pl.isFa && (<span style={{ fontSize: 8, color: "#FF9800", fontFamily: "var(--m)", fontWeight: 800, background: "rgba(255,152,0,0.1)", padding: "1px 4px", borderRadius: 3, border: "1px solid rgba(255,152,0,0.2)" }}>{"FA"}</span>)}
                {slot && (<span style={{ fontSize: 9, color: accentC, fontFamily: "var(--m)", fontWeight: 700, background: "rgba(255,213,79,0.08)", padding: "1px 5px", borderRadius: 3 }}>{slot}</span>)}
              </div>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{(pl.team ? pl.team+" " : "") + (pl.subPosition || "") + " · " + (pl.hand || "") + (isBat ? "타" : "투") + " · " + (pl.enhance || "") + (pl.cardType==="임팩트"&&pl.impactType?" · "+pl.impactType:pl.year?" · "+pl.year:"") + " · ★" + (pl.stars || 5)}</div>
            </div>
          </div>
          {/* Score */}
          <div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={18} grad={isBat ? undefined : "linear-gradient(135deg,#CE93D8,#7B1FA2)"} /></div>
          {!mob && (<React.Fragment>
            {/* Training */}
            <div style={{ fontSize: 12, fontFamily: "var(--m)" }}>
              {isBat ? (
                <React.Fragment><span style={{ color: "#EF5350" }}>{"+" + (pl.trainP||0)}</span>{" "}<span style={{ color: "#42A5F5" }}>{"+" + (pl.trainA||0)}</span>{" "}<span style={{ color: "#66BB6A" }}>{"+" + (pl.trainE||0)}</span></React.Fragment>
              ) : (
                <React.Fragment><span style={{ color: "#AB47BC" }}>{"+" + (pl.trainC||0)}</span>{" "}<span style={{ color: "#FF7043" }}>{"+" + (pl.trainS||0)}</span></React.Fragment>
              )}
            </div>
            {/* Spec */}
            <div style={{ fontSize: 12, fontFamily: "var(--m)", color: "var(--t2)" }}>
              {isBat ? ((pl.specPower||0) + "/" + (pl.specAccuracy||0) + "/" + (pl.specEye||0)) : ((pl.specChange||0) + "/" + (pl.specStuff||0))}
            </div>
            {/* Skills - all 3 visible */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {pl.skill1 ? (<SkBadge name={pl.skill1} lv={pl.s1Lv} />) : (<span style={{ fontSize: 9, color: "var(--td)" }}>{"-"}</span>)}
              {pl.skill2 ? (<SkBadge name={pl.skill2} lv={pl.s2Lv} />) : null}
              {pl.skill3 ? (<SkBadge name={pl.skill3} lv={pl.s3Lv} />) : null}
            </div>
            {/* Potential */}
            <div style={{ fontSize: 12, color: "var(--td)", textAlign: "center" }}>{(pl.pot1 || "-") + "/" + (pl.pot2 || "-")}</div>
          </React.Fragment>)}
        </div>

        {/* Inline edit panel */}
        {isSel && (
          <div style={{ padding: "10px 14px", background: "rgba(255,213,79,0.02)", borderBottom: "1px solid var(--bd)" }}>
            {/* Basic info */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"이름"}</div><span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{pl.name}</span></div>
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"카드"}</div><Badge type={pl.cardType} /></div>
              {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"종류"}</div><span style={{ fontSize: 12, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
              {pl.cardType==="라이브"&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"세트덱"}</div><input type="number" value={pl.setScore||0} onChange={function(e){upd(pl.id,"setScore",parseInt(e.target.value)||0);}} style={{ width: 36, padding: "3px 4px", background: "var(--inner)", border: "1px solid var(--acc)", borderRadius: 3, color: "var(--acc)", fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} /></div>)}
              {pl.cardType==="라이브"&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"종류"}</div><select value={pl.liveType||""} onChange={function(e){upd(pl.id,"liveType",e.target.value);}} style={{ width: 44, padding: "3px 2px", fontSize: 11, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}><option value="">-</option><option value="V1">V1</option><option value="V2">V2</option><option value="V3">V3</option></select></div>)}
              {CARD_STARS_SELECTABLE[pl.cardType]&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><select value={pl.stars||(CARD_STARS[pl.cardType]||5)} onChange={function(e){upd(pl.id,"stars",parseInt(e.target.value));}} style={{ width: 38, padding: "3px 2px", fontSize: 11, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>{(pl.cardType==="골든글러브"?[4,5]:[1,2,3,4,5]).map(function(s){return(<option key={s} value={s}>{s}</option>);})}</select></div>)}
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"강화"}</div><select value={pl.enhance || ""} onChange={function(e) { upd(pl.id, "enhance", e.target.value); }} style={{ width: 64, padding: "3px 2px", fontSize: 11, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>
                {["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e) { return (<option key={e} value={e}>{e}</option>); })}
              </select></div>
              {!CARD_STARS_SELECTABLE[pl.cardType]&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><span style={{ fontSize: 13, color: "var(--acc)" }}>{"★" + (pl.stars || CARD_STARS[pl.cardType] || 5)}</span></div>)}
              {!isBat && (<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"세부포지션"}</div><select value={pl.subPosition||""} onChange={function(e){
                var sp = e.target.value;
                var newPos = sp.startsWith("SP") ? "선발" : sp === "CP" ? "마무리" : "중계";
                upd(pl.id, "subPosition", sp, "position", newPos);
              }} style={{ width: 56, padding: "3px 2px", fontSize: 11, background: "var(--inner)", border: "1px solid var(--acp)", borderRadius: 3, color: "var(--acp)", fontWeight: 700, outline: "none" }}>
                {["SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP"].map(function(s){return(<option key={s} value={s}>{s}</option>);})}
              </select></div>)}
              {/* FA toggle - 임팩트/시그니처만 */}
              {(pl.cardType==="임팩트"||pl.cardType==="시그니처") && (
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"FA"}</div>
                <div onClick={function(){upd(pl.id,"isFa",!pl.isFa);}} style={{ width: 36, height: 20, borderRadius: 10, background: pl.isFa ? "#FF9800" : "var(--inner)", border: "1px solid " + (pl.isFa ? "#FF9800" : "var(--bd)"), position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: pl.isFa ? "#fff" : "var(--td)", position: "absolute", top: 1, left: pl.isFa ? 18 : 1, transition: "left 0.2s" }} />
                </div>
              </div>
              )}
              <button onClick={function() { if (confirm("'" + pl.name + "' 삭제?")) { save(players.filter(function(x) { return x.id !== pl.id; })); setSelId(null); } }} style={{ padding: "3px 8px", fontSize: 9, background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", borderRadius: 3, color: "#EF5350", cursor: "pointer", marginLeft: "auto" }}>{"삭제"}</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, padding: "4px 8px", background: "var(--inner)", borderRadius: 4, fontSize: 11 }}>
              <span style={{ color: "var(--td)" }}>{"세트덱 스코어:"}</span>
              <span style={{ color: "var(--acc)", fontWeight: 800, fontFamily: "var(--m)" }}>{(function(){var sc=pl.cardType==="라이브"?(pl.setScore||0):(SET_POINTS[pl.cardType]||0);if(pl.isFa)sc=Math.max(0,sc-1);return sc;})()}</span>
              {pl.isFa && pl.cardType==="시그니처" && (<span style={{ color: "#FF9800", fontSize: 9 }}>{"(FA -1)"}</span>)}{pl.isFa && pl.cardType==="임팩트" && (<span style={{ color: "#FF9800", fontSize: 9 }}>{"(FA -2)"}</span>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
              {/* Training */}
              <div>
                <div style={{ fontSize: 11, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"훈련"}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  {isBat ? (
                    <React.Fragment>
                      <span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "trainP", pl.trainP, "#EF5350")}
                      <span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "trainA", pl.trainA, "#42A5F5")}
                      <span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "trainE", pl.trainE, "#66BB6A")}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "trainC", pl.trainC, "#AB47BC")}
                      <span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "trainS", pl.trainS, "#FF7043")}
                    </React.Fragment>
                  )}
                </div>
              </div>
              {/* Spec training */}
              <div>
                <div style={{ fontSize: 11, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"특훈 (0~15)"}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  {isBat ? (
                    <React.Fragment>
                      <span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "specPower", pl.specPower, "#EF5350", 15)}
                      <span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "specAccuracy", pl.specAccuracy, "#42A5F5", 15)}
                      <span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "specEye", pl.specEye, "#66BB6A", 15)}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "specChange", pl.specChange, "#AB47BC", 15)}
                      <span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "specStuff", pl.specStuff, "#FF7043", 15)}
                    </React.Fragment>
                  )}
                </div>
              </div>
              {/* Potential */}
              <div>
                <div style={{ fontSize: 11, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{pl.role === "타자" ? "잠재력 (풀스윙/클러치)" : "잠재력 (장타억제/침착)"}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 9, color: "var(--td)" }}>{pl.role === "타자" ? "풀스윙" : "장타억제"}</span>
                    <select value={pl.pot1||""} onChange={function(e){upd(pl.id,"pot1",e.target.value);}} style={{ padding: "3px 4px", background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", fontSize: 12, outline: "none", width: 52 }}>
                      <option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 9, color: "var(--td)" }}>{pl.role === "타자" ? "클러치" : "침착"}</span>
                    <select value={pl.pot2||""} onChange={function(e){upd(pl.id,"pot2",e.target.value);}} style={{ padding: "3px 4px", background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", fontSize: 12, outline: "none", width: 52 }}>
                      <option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {/* Skills */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"스킬 (" + getSkillCat(pl) + ")"}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {skillSel(pl, 1)}{skillSel(pl, 2)}{skillSel(pl, 3)}
              </div>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 960, paddingBottom: mob ? 80 : 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)", margin: 0 }}>{"내 선수"}</h2>
        
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {[{k:"타자",l:"타자 "+bats.length},{k:"선발",l:"선발 "+sps.length},{k:"중계",l:"중계 "+rps.length},{k:"마무리",l:"마무리 "+cps.length}].map(function(f) {
            var a = f.k === filter;
            return (<button key={f.k} onClick={function(){setFilter(f.k);}} style={{ padding: "5px 10px", fontSize: 10, fontWeight: a?700:400, background: a?"var(--ta)":"var(--inner)", color: a?"var(--acc)":"var(--t2)", border: a?"1px solid var(--acc)":"1px solid var(--bd)", borderRadius: 5, cursor: "pointer" }}>{f.l}</button>);
          })}
          <button onClick={function() { setAddOpen(true); setAddQuery(""); }} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 5, color: "#1a1100", cursor: "pointer", marginLeft: 4 }}>{"+ 추가"}</button>
          <button onClick={function() { setScanOpen(true); }} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: 5, color: "#0a0a0a", cursor: "pointer", marginLeft: 4 }}>{"📸 일괄 업데이트"}</button>
        </div>
      </div>

      {/* Bulk Scan Modal */}
      {scanOpen && React.createElement(BulkScanModal, {
        onClose: function(){setScanOpen(false);},
        players: players,
        savePlayers: save,
        lineupMap: lm,
        saveLineupMap: saveLM,
        skills: skillsDB,
        userId: p.userId || ''
      })}

      {/* Add Player Popup */}
      {addOpen && (function() {
        var isBat = filter === "타자";
        var dbPlayers = SEED_PLAYERS.filter(function(sp) {
          if (isBat) return sp.role === "타자";
          return sp.role === "투수" && sp.position === filter;
        });
        if (addQuery.trim()) {
          var q2 = addQuery.trim().toLowerCase();
          dbPlayers = dbPlayers.filter(function(sp) { return sp.name.toLowerCase().indexOf(q2) >= 0 || (sp.cardType||"").indexOf(q2) >= 0 || (sp.team||"").indexOf(q2) >= 0; });
        }
        var addPl = function(src) {
          var id2 = "p" + Date.now() + "_" + Math.random().toString(36).slice(2,5);
          var defaultSubPos = src.role === "타자" ? (src.subPosition || "RF")
            : src.position === "선발" ? "SP1"
            : src.position === "마무리" ? "CP"
            : "RP1";
          var np = { id: id2, dbId: src.id,
            name: src.name, cardType: src.cardType,
            role: src.role || "", position: src.position || "",
            subPosition: src.subPosition || defaultSubPos,
            year: src.year || "", team: src.team || "",
            liveType: src.liveType || "",
            trainP: 0, trainA: 0, trainE: 0, trainC: 0, trainS: 0,
            specPower: 0, specAccuracy: 0, specEye: 0, specChange: 0, specStuff: 0,
            skill1: "", s1Lv: 0, skill2: "", s2Lv: 0, skill3: "", s3Lv: 0,
            enhance: "9각성", pot1: "", pot2: "", isFa: false };
          var newList = players.concat([np]);
          save(newList);
          setAddOpen(false);
          setSelId(id2);
        };
        return (
          <div onClick={function(){setAddOpen(false);}} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={function(e){e.stopPropagation();}} style={{ background: "#141a24", borderRadius: 14, border: "1px solid var(--bd)", maxWidth: 440, width: "100%", maxHeight: "80vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"도감에서 선수 추가"}</div>
                  <div style={{ fontSize: 10, color: "var(--td)", marginTop: 2 }}>{filter + " · " + dbPlayers.length + "명"}</div>
                </div>
                <button onClick={function(){setAddOpen(false);}} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
              </div>
              <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, padding: "6px 10px" }}>
                  <span style={{ fontSize: 14, opacity: 0.4 }}>{"🔍"}</span>
                  <input type="text" value={addQuery} onChange={function(e){setAddQuery(e.target.value);}} placeholder="이름, 카드종류, 팀 검색..." style={{ flex: 1, background: "transparent", border: "none", color: "var(--t1)", fontSize: 12, outline: "none" }} />
                </div>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
                {dbPlayers.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--td)", fontSize: 12 }}>{"도감에 등록된 선수가 없습니다."}</div>
                ) : dbPlayers.map(function(sp) {
                  var already = players.some(function(x){ return x.name===sp.name && x.cardType===sp.cardType && (x.year||"")===(sp.year||"") && (x.impactType||"")===(sp.impactType||"") && (sp.cardType!=="라이브" || (x.liveType||"")===(sp.liveType||"")); });
                  return (
                    <div key={sp.id} onClick={function(){if(!already)addPl(sp);}} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--bd)", cursor: already?"not-allowed":"pointer", opacity: already?0.4:1 }}>
                      <PlayerCard player={sp} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Badge type={sp.cardType} />
                          <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13 }}>{sp.name}</span>
                          {sp.year && (<span style={{ fontSize: 9, color: "var(--td)" }}>{sp.year}</span>)}
                          {sp.cardType === "임팩트" && sp.impactType && (<span style={{ fontSize: 9, color: "#a78bfa", marginLeft: 2 }}>{'(' + sp.impactType + ')'}</span>)}
                          {sp.cardType === "라이브" && sp.liveType && (<span style={{ fontSize: 9, color: "#34d399", marginLeft: 2 }}>{'(' + sp.liveType + ')'}</span>)}
                        </div>
                        <div style={{ fontSize: 9, color: "var(--td)", marginTop: 2 }}>
                          {isBat ? (sp.team + " · " + sp.hand + "타 · 파" + (sp.power||0) + " 정" + (sp.accuracy||0) + " 선" + (sp.eye||0)) : (sp.team + " · " + sp.hand + "투 · 변" + (sp.change||0) + " 구" + (sp.stuff||0))}
                        </div>
                      </div>
                      {already && (<span style={{ fontSize: 9, color: "var(--acc)" }}>{"등록됨"}</span>)}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 50px" : "minmax(110px,1fr) 70px 90px 70px 130px 50px", gap: 5, padding: "6px 12px", borderBottom: "1px solid var(--bd)", fontSize: 11, fontWeight: 700, color: "var(--td)" }}>
          <div>{"선수 (클릭→편집)"}</div>
          <div style={{ textAlign: "center" }}>{"점수"}</div>
          {!mob && (<React.Fragment>
            <div>{"훈련"}</div>
            <div>{"특훈"}</div>
            <div>{"스킬"}</div>
            <div style={{ textAlign: "center" }}>{"잠재"}</div>
          </React.Fragment>)}
        </div>
        {filtered.map(function(pl, idx) { return renderRow(pl, idx); })}
      </div>
    </div>
  );
}

/* ================================================================
   SKILL MANAGE PAGE - 컴포넌트 기반 (능력치×빈도×가중치)
   ================================================================ */
function SkillManagePage(p) {
  var mob = p.mobile; var skills = p.skills; var saveSK = p.saveSkills;
  var cats = ["타자","선발","중계","마무리"];
  var _cat = useState("타자"); var cat = _cat[0]; var setCat = _cat[1];
  var _newName = useState(""); var newName = _newName[0]; var setNewName = _newName[1];
  var _exp = useState(""); var expName = _exp[0]; var setExpName = _exp[1];
  var _showCSV = useState(false); var showCSV = _showCSV[0]; var setShowCSV = _showCSV[1];
  var _csvText = useState(""); var csvText = _csvText[0]; var setCsvText = _csvText[1];
  var _impMode = useState(false); var impMode = _impMode[0]; var setImpMode = _impMode[1];
  var _impText = useState(""); var impText = _impText[0]; var setImpText = _impText[1];

  var w = skills.weights || {p:1,a:0.9,e:0.3,c:1.175,s:1.275};
  var isBatCat = (cat === "타자");
  var statKeys = ["p","a","e","c","s"];
  var statVKeys = ["pV","aV","eV","cV","sV"];
  var statFKeys = ["pF","aF","eF","cF","sF"];
  var statLabels = ["파워","정확","선구","변화","구위"];
  var statColors = ["#EF5350","#42A5F5","#66BB6A","#AB47BC","#FF7043"];
  var table = skills[cat] || {};

  var getScore = function(vals) {
    var e = vals[1]; if (!e) return 0;
    if (typeof e === "number") return e;
    return (e.pV||0)*(e.pF||0)*w.p + (e.aV||0)*(e.aF||0)*w.a + (e.eV||0)*(e.eF||0)*w.e + (e.cV||0)*(e.cF||0)*w.c + (e.sV||0)*(e.sF||0)*w.s;
  };
  var names = Object.keys(table).sort(function(a,b) { return getScore(table[b]) - getScore(table[a]); });

  var updWeight = function(key, val) {
    var copy = JSON.parse(JSON.stringify(skills));
    if (!copy.weights) copy.weights = {};
    copy.weights[key] = parseFloat(val) || 0;
    saveSK(copy);
  };
  var updComp = function(name, lvIdx, fieldKey, val) {
    var copy = JSON.parse(JSON.stringify(skills));
    var arr = copy[cat][name]; if (!arr) return;
    var entry = arr[lvIdx];
    if (typeof entry === "number") { arr[lvIdx] = {pV:0,pF:1,aV:0,aF:1,eV:0,eF:1,cV:0,cF:1,sV:0,sF:1}; entry = arr[lvIdx]; }
    entry[fieldKey] = parseFloat(val) || 0;
    saveSK(copy);
  };
  var addSkill = function() {
    if (!newName.trim() || table[newName.trim()]) return;
    var copy = JSON.parse(JSON.stringify(skills));
    var empty = {pV:0,pF:1,aV:0,aF:1,eV:0,eF:1,cV:0,cF:1,sV:0,sF:1};
    copy[cat][newName.trim()] = [Object.assign({},empty),Object.assign({},empty),Object.assign({},empty),Object.assign({},empty),Object.assign({},empty),Object.assign({},empty)];
    saveSK(copy); setNewName("");
  };
  var delSkill = function(name) { var copy = JSON.parse(JSON.stringify(skills)); delete copy[cat][name]; saveSK(copy); };
  var resetAll = function() { saveSK(JSON.parse(JSON.stringify(DEFAULT_SKILLS))); };

  var doExport = function() {
    var rows = ["카테고리,스킬명,레벨,파워수치,파워빈도,정확수치,정확빈도,선구수치,선구빈도,변화수치,변화빈도,구위수치,구위빈도"];
    cats.forEach(function(c) { var t = skills[c] || {};
      Object.keys(t).forEach(function(name) { var arr = t[name];
        [5,6,7,8,9,10].forEach(function(lv,li) { var e = arr[li]; if(!e||typeof e==="number"){rows.push(c+","+name+","+lv+",0,0,0,0,0,0,0,0,0,0");return;} rows.push(c+","+name+","+lv+","+(e.pV||0)+","+(e.pF||0)+","+(e.aV||0)+","+(e.aF||0)+","+(e.eV||0)+","+(e.eF||0)+","+(e.cV||0)+","+(e.cF||0)+","+(e.sV||0)+","+(e.sF||0)); });
      });
    });
    rows.push(""); rows.push("가중치,파워,,,"+w.p); rows.push("가중치,정확,,,"+w.a); rows.push("가중치,선구,,,"+w.e); rows.push("가중치,변화,,,"+w.c); rows.push("가중치,구위,,,"+w.s);
    setCsvText(rows.join("\n")); setShowCSV(true);
  };
  var doImport = function() {
    if (!impText.trim()) return;
    var copy = JSON.parse(JSON.stringify(skills)); var ls = impText.trim().split("\n"); var curName = ""; var curCat = ""; var curArr = [];
    var flush = function() { if (curName && curCat && curArr.length === 6) { if (!copy[curCat]) copy[curCat] = {}; copy[curCat][curName] = curArr; } curArr = []; };
    ls.forEach(function(line) { var cols = line.split(","); if (cols.length < 3 || cols[0] === "카테고리") return;
      if (cols[0] === "가중치") { var wMap = {"파워":"p","정확":"a","선구":"e","변화":"c","구위":"s"}; if (wMap[cols[1]]) { if(!copy.weights) copy.weights={}; copy.weights[wMap[cols[1]]] = parseFloat(cols[4]) || 0; } return; }
      var c = cols[0]; var nm = cols[1]; if (curName !== nm || curCat !== c) { flush(); curName = nm; curCat = c; }
      var obj = {pV:parseFloat(cols[3])||0,pF:parseFloat(cols[4])||0,aV:parseFloat(cols[5])||0,aF:parseFloat(cols[6])||0,eV:parseFloat(cols[7])||0,eF:parseFloat(cols[8])||0,cV:parseFloat(cols[9])||0,cF:parseFloat(cols[10])||0,sV:parseFloat(cols[11])||0,sF:parseFloat(cols[12])||0};
      curArr.push(obj);
    }); flush(); saveSK(copy); setImpMode(false); setImpText("");
  };

  var renderDetail = function(name) {
    var arr = table[name]; if (!arr) return null;
    return (
      <div style={{ padding: "8px 12px", background: "rgba(255,213,79,0.02)", borderBottom: "1px solid var(--bd)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead><tr><th style={{ textAlign: "left", padding: "4px", color: "var(--td)" }}>{"능력치"}</th><th style={{ textAlign: "center", padding: "4px", color: "var(--td)", fontSize: 9 }}>{"항목"}</th>
            {[5,6,7,8,9,10].map(function(lv) { return (<th key={lv} style={{ textAlign: "center", padding: "4px", color: {"10":"#FF4081","9":"#E040FB","8":"#FFD700","7":"#FF6B6B","6":"#4FC3F7","5":"#81C784"}[lv]||"#aaa" }}>{"Lv"+lv}</th>); })}
          </tr></thead>
          <tbody>{statKeys.map(function(sk, si) {
            var vk = statVKeys[si]; var fk = statFKeys[si];
            return (<React.Fragment key={sk}>
              <tr><td rowSpan={2} style={{ padding: "4px", color: statColors[si], fontWeight: 700, verticalAlign: "middle" }}>{statLabels[si]}</td>
                <td style={{ fontSize: 9, color: "var(--td)", padding: "2px 4px" }}>{"수치"}</td>
                {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var val = (typeof entry === "number") ? 0 : (entry[vk] || 0); var c = ["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][li];
                  return (<td key={li} style={{ textAlign: "center", padding: "1px" }}><input type="number" step="1" value={val} onChange={function(e){updComp(name,li,vk,e.target.value);}} style={{ width: 38, padding: "2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+c+"33", borderRadius: 3, color: c, fontSize: 10, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} /></td>);
                })}</tr>
              <tr><td style={{ fontSize: 9, color: "var(--td)", padding: "2px 4px" }}>{"빈도"}</td>
                {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var val = (typeof entry === "number") ? 0 : (entry[fk] || 0); var c = ["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][li];
                  return (<td key={li} style={{ textAlign: "center", padding: "1px" }}><input type="number" step="0.01" value={val} onChange={function(e){updComp(name,li,fk,e.target.value);}} style={{ width: 38, padding: "2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+c+"22", borderRadius: 3, color: c, fontSize: 9, fontFamily: "var(--m)", opacity: 0.7, outline: "none" }} /></td>);
                })}</tr>
            </React.Fragment>); })}
            <tr><td colSpan={2} style={{ padding: "4px", fontWeight: 700, color: "var(--t1)" }}>{"합계"}</td>
              {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var sc = 0;
                if (typeof entry === "number") { sc = entry; } else { sc = (entry.pV||0)*(entry.pF||0)*w.p + (entry.aV||0)*(entry.aF||0)*w.a + (entry.eV||0)*(entry.eF||0)*w.e + (entry.cV||0)*(entry.cF||0)*w.c + (entry.sV||0)*(entry.sF||0)*w.s; }
                return (<td key={li} style={{ textAlign: "center", fontWeight: 800, fontFamily: "var(--m)", color: "var(--acc)", fontSize: 12 }}>{Math.round(sc*100)/100}</td>);
              })}</tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 960, paddingBottom: mob ? 80 : 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
        <h2 style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)", margin: 0 }}>{"스킬 관리"}</h2>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button onClick={doExport} style={{ padding: "5px 10px", fontSize: 10, background: "rgba(66,165,245,0.08)", border: "1px solid rgba(66,165,245,0.2)", borderRadius: 4, color: "#42A5F5", cursor: "pointer" }}>{"CSV 내보내기"}</button>
          <button onClick={function(){setImpMode(!impMode);}} style={{ padding: "5px 10px", fontSize: 10, background: "rgba(102,187,106,0.08)", border: "1px solid rgba(102,187,106,0.2)", borderRadius: 4, color: "#66BB6A", cursor: "pointer" }}>{impMode?"닫기":"CSV 가져오기"}</button>
          <button onClick={resetAll} style={{ padding: "5px 10px", fontSize: 10, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 4, color: "#EF5350", cursor: "pointer" }}>{"기본값 복원"}</button>
        </div>
      </div>
      {showCSV && (<div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 10, color: "var(--td)" }}>{"CSV (복사→엑셀)"}</span><button onClick={function(){setShowCSV(false);}} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer" }}>{"✕"}</button></div>
        <textarea value={csvText} readOnly rows={8} onClick={function(e){e.target.select();}} style={{ width: "100%", padding: 8, fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
      </div>)}
      {impMode && (<div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 6 }}>{"CSV 붙여넣기 (카테고리,스킬명,레벨,능력치...)"}</div>
        <textarea value={impText} onChange={function(e){setImpText(e.target.value);}} rows={6} style={{ width: "100%", padding: 8, fontSize: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
        <button onClick={doImport} style={{ marginTop: 6, padding: "6px 16px", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#66BB6A,#43A047)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}>{"적용"}</button>
      </div>)}
      {/* Weights */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", marginBottom: 6 }}>{"능력치 가중치 (사이트 전체 적용)"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[{k:"p",l:"파워",cl:"#EF5350"},{k:"a",l:"정확",cl:"#42A5F5"},{k:"e",l:"선구",cl:"#66BB6A"},{k:"c",l:"변화",cl:"#AB47BC"},{k:"s",l:"구위",cl:"#FF7043"}].map(function(it){
            return (<div key={it.k} style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: it.cl, fontWeight: 700, marginBottom: 2 }}>{it.l}</div>
              <input type="number" step="0.001" value={w[it.k]} onChange={function(e){updWeight(it.k,e.target.value);}} style={{ width: 56, padding: "4px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+it.cl+"44", borderRadius: 4, color: it.cl, fontSize: 14, fontFamily: "var(--m)", fontWeight: 800, outline: "none" }} /></div>);
          })}
        </div>
      </div>
      {/* Potential Scores - 종류별 */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", marginBottom: 8 }}>{"잠재력 등급별 점수 (종류별)"}</div>
        {["풀스윙","클러치","장타억제","침착"].map(function(potType) {
          var byType = skills.potScoresByType || DEFAULT_POT_SCORES_BY_TYPE;
          var typeScores = byType[potType] || DEFAULT_POT_SCORES_BY_TYPE[potType] || DEFAULT_POT_SCORES;
          var typeColor = potType==="풀스윙"?"#EF5350":potType==="클러치"?"#42A5F5":potType==="장타억제"?"#AB47BC":"#66BB6A";
          return (<div key={potType} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: typeColor, marginBottom: 4 }}>{potType + (potType==="풀스윙"||potType==="클러치" ? " (타자)" : " (투수)")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {POT_GRADES.map(function(g) {
                var ps = typeScores[g] !== undefined ? typeScores[g] : (DEFAULT_POT_SCORES[g] || 0);
                return (<div key={g} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--td)", marginBottom: 2 }}>{g}</div>
                  <input type="number" step="1" value={ps} onChange={function(e) {
                    var copy = JSON.parse(JSON.stringify(skills));
                    if (!copy.potScoresByType) copy.potScoresByType = JSON.parse(JSON.stringify(DEFAULT_POT_SCORES_BY_TYPE));
                    if (!copy.potScoresByType[potType]) copy.potScoresByType[potType] = Object.assign({}, DEFAULT_POT_SCORES);
                    copy.potScoresByType[potType][g] = parseFloat(e.target.value) || 0;
                    saveSK(copy);
                  }} style={{ width: 36, padding: "3px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+typeColor+"44", borderRadius: 4, color: typeColor, fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />
                </div>);
              })}
            </div>
          </div>);
        })}
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {cats.map(function(c){ var a=c===cat; return (<button key={c} onClick={function(){setCat(c);setExpName("");}} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: a?800:500, background: a?"var(--ta)":"var(--inner)", color: a?"var(--acc)":"var(--t2)", border: a?"1px solid var(--acc)":"1px solid var(--bd)", cursor: "pointer" }}>{c+" ("+Object.keys(skills[c]||{}).length+")"}</button>); })}
      </div>
      {/* Add */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input type="text" value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="새 스킬 이름" onKeyDown={function(e){if(e.key==="Enter")addSkill();}} style={{ flex: 1, padding: "7px 10px", fontSize: 11, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none" }} />
        <button onClick={addSkill} style={{ padding: "7px 14px", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 6, color: "#1a1100", cursor: "pointer" }}>{"+ 추가"}</button>
      </div>
      {/* List */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontSize: 10, fontWeight: 700, color: "var(--td)" }}>
          <div style={{textAlign:"center",fontSize:9}}>{"★"}</div><div>{"스킬명 (Lv6순) ▼클릭편집"}</div><div style={{ textAlign: "center", color: "#81C784" }}>{"Lv5"}</div><div style={{ textAlign: "center", color: "#4FC3F7" }}>{"Lv6"}</div><div style={{ textAlign: "center", color: "#FF6B6B" }}>{"Lv7"}</div><div style={{ textAlign: "center", color: "#FFD700" }}>{"Lv8"}</div><div style={{ textAlign: "center", color: "#E040FB" }}>{"Lv9"}</div><div style={{ textAlign: "center", color: "#FF4081" }}>{"Lv10"}</div><div />
        </div>
        {names.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: "var(--td)", fontSize: 11 }}>{"없음"}</div>) :
        names.map(function(name, idx) { var vals = table[name]; var scores = calcSkillDisp(vals, cat); var isExp = (expName === name);
          return (<React.Fragment key={name}>
            <div onClick={function(){setExpName(isExp?"":name);}} style={{ display: "grid", gridTemplateColumns: "24px minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "5px 10px", alignItems: "center", borderBottom: "1px solid var(--bd)", background: isExp?"var(--ta)":(idx%2===0?"var(--re)":"transparent"), cursor: "pointer" }}>
              <button onClick={function(e){e.stopPropagation();var copy=JSON.parse(JSON.stringify(skills));if(!copy[cat][name])return;if(!copy._major)copy._major={};if(!copy._major[cat])copy._major[cat]={};copy._major[cat][name]=!((copy._major[cat]||{})[name]);saveSK(copy);}} style={{width:20,height:20,borderRadius:3,background:(((skills._major||{})[cat]||{})[name])?"rgba(171,71,188,0.2)":"transparent",border:"1px solid "+(((skills._major||{})[cat]||{})[name])?"#AB47BC":"var(--bd)",color:(((skills._major||{})[cat]||{})[name])?"#CE93D8":"var(--td)",cursor:"pointer",fontSize:9,padding:0,flexShrink:0}}>{"★"}</button>
              <div style={{ fontSize: 11, fontWeight: 700, color: isExp?"var(--acc)":"var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(isExp?"▼ ":"▶ ")+name+(((skills._major||{})[cat]||{})[name]?" ⭐":"")}</div>
              {scores.map(function(sc,i){ var c=["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][i]; return (<div key={i} style={{ textAlign: "center", fontSize: 11, fontFamily: "var(--m)", fontWeight: 700, color: c }}>{Math.round(sc*100)/100}</div>); })}
              <button onClick={function(e){e.stopPropagation();delSkill(name);}} style={{ width: 22, height: 22, borderRadius: 3, background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", color: "#EF5350", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{"×"}</button>
            </div>
            {isExp && renderDetail(name)}
          </React.Fragment>);
        })}
      </div>
    </div>
  );
}


/* ================================================================
   CLUB LOUNGE PAGE
   ================================================================ */
function ClubLoungePage(p) {
  return (
    <div style={{padding:p.mobile?12:18,maxWidth:760,paddingBottom:p.mobile?80:18}}>
      <h2 style={{fontSize:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 14px"}}>{"🎙️ 클럽 라운지"}</h2>
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}>
        <div style={{fontSize:48,marginBottom:12}}>{"🎙️"}</div>
        <h3 style={{fontSize:16,fontWeight:800,color:"var(--t1)",margin:"0 0 8px",fontFamily:"var(--h)"}}>{"업데이트 예정"}</h3>
        <p style={{fontSize:12,color:"var(--td)",margin:0}}>{"커뮤니티 기능이 준비되면 이 페이지에서 만나보실 수 있습니다."}</p>
      </div>
    </div>
  );
}

/* ================================================================
   DATA CENTER PAGE
   ================================================================ */
function DataCenterPage(p) {
  var mob = p.mobile;
  var skills = p.skills || {};
  var players = p.players || [];
  var lineupMap = p.lineupMap || {};
  var _tab = React.useState("analysis"); var dcTab = _tab[0]; var setDcTab = _tab[1];

  return (
    <div style={{padding:mob?12:18,maxWidth:800,paddingBottom:mob?80:18}}>
      <h2 style={{fontSize:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 14px"}}>{"📊 데이터 센터"}</h2>
      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {[{id:"analysis",label:"📈 라인업 분석"},{id:"skill",label:"🎯 스킬 계산기"},{id:"train",label:"🏋️ 훈재분 계산기"},{id:"top",label:"👑 고점덱 정보"}].map(function(t){
          var a = dcTab===t.id;
          return (<button key={t.id} onClick={function(){setDcTab(t.id);}} style={{padding:"8px 16px",fontSize:11,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{t.label}</button>);
        })}
      </div>
      {dcTab==="analysis" && <LineupAnalysis mobile={mob} players={players} lineupMap={lineupMap} skills={skills} />}
      {dcTab==="skill" && <SkillCalculator mobile={mob} skills={skills} />}
      {dcTab==="train" && <TrainSimulator mobile={mob} skills={skills} />}
      {dcTab==="top" && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:10}}>{"👑"}</div>
          <h3 style={{fontSize:15,fontWeight:700,color:"var(--t1)",margin:"0 0 6px"}}>{"업데이트 예정"}</h3>
          <p style={{fontSize:12,color:"var(--td)",margin:0}}>{"고점덱 정보가 준비되면 안내드리겠습니다."}</p>
        </div>
      )}
    </div>
  );
}

/* ─── 라인업 분석 ─── */
/* 분포 테이블: 스킬변경 시 자동 갱신되는 캐시 방식 사용
   각 항목별 상위 퍼센타일 계산 (10만 시뮬레이션 결과 기반)
   - 스킬점수 분포 (타자/선발/중계/마무리)
   - 훈련 분포 (파+정+선, 변+구)
   - 특훈 분포 (파+정+선, 변+구) */

var DIST_CACHE = null; /* {batSkill:[],pitSkill:{SP:[],RP:[],CP:[]}, batTrain:[], pitTrain:[], batSpec:[], pitSpec:[]} */

function buildDist(skills, N) {
  N = N || 100000;
  var w = getW();
  var cats = ["타자","선발","중계","마무리"];
  var result = {};

  cats.forEach(function(cat) {
    var isBat = cat === "타자";
    var catSkills = skills[cat] || {};
    var allNames = Object.keys(catSkills);
    var majorMap = (skills._major && skills._major[cat]) || {};

    var baseName = function(n) { return n.replace(/\(.*?\)/g, '').trim(); };
    var groupByBase = function(arr) {
      var g = {};
      arr.forEach(function(n){ var b=baseName(n); if(!g[b])g[b]=[]; g[b].push(n); });
      return g;
    };
    var majorGroups = groupByBase(allNames.filter(function(n){return majorMap[n];}));
    var minorGroups = groupByBase(allNames.filter(function(n){return !majorMap[n];}));
    var majorBases = Object.keys(majorGroups);
    var minorBases = Object.keys(minorGroups);

    /* 카드 종류별 기본 스킬 레벨
       골든글러브: 6,6,6 / 라이브: 7,7,7 / 올스타: 8,7,7 / 나머지: 6,5,5 */
    var CARD_LVS = {
      "골든글러브": [6,6,6],
      "라이브":     [7,7,7],
      "올스타":     [8,7,7],
      "기본":       [6,5,5]
    };
    var SKILL_CARD_TYPES = ["골든글러브","라이브","올스타","기본"];

    SKILL_CARD_TYPES.forEach(function(ctKey) {
      var lvs = CARD_LVS[ctKey];
      var scores = [];
      for (var i = 0; i < N; i++) {
        var total = 0;
        var chosenBases = [];
        for (var slot = 0; slot < 3; slot++) {
          var isMajor = slot === 0 ? true : Math.random() < 0.14;
          var pool = (isMajor ? majorBases : minorBases).filter(function(b){ return chosenBases.indexOf(b)<0; });
          if (!pool.length) pool = (isMajor ? minorBases : majorBases).filter(function(b){ return chosenBases.indexOf(b)<0; });
          if (!pool.length) break;
          var pb = pool[Math.floor(Math.random()*pool.length)];
          chosenBases.push(pb);
          var variants = (majorGroups[pb]||minorGroups[pb]||[pb]);
          var pick = variants[Math.floor(Math.random()*variants.length)];
          total += getSkillScore(pick, lvs[slot], cat);
        }
        scores.push(Math.round(total * 100) / 100);
      }
      scores.sort(function(a,b){return a-b;});
      result["skill_"+cat+"_"+ctKey] = scores;
    });
  });

  /* 카드종류별 훈련 분포 추가 */
  var TRAIN_PTS = {"골든글러브":75,"시그니처":75,"라이브":75,"올스타":75,"국가대표":60,"임팩트":54};
  var BAT_STATS_TR = ["파워","정확","선구","인내","주루","수비"];
  var PIT_STATS_TR = ["구속","변화","구위","제구","지구력","수비"];
  var w2 = getW();
  ["bat","pit"].forEach(function(role) {
    var isBatR = role === "bat";
    var statList = isBatR ? BAT_STATS_TR : PIT_STATS_TR;
    Object.keys(TRAIN_PTS).forEach(function(ct) {
      var total = TRAIN_PTS[ct];
      var fixList = ct === "시그니처" ? (isBatR ? ["주루","수비"] : ["구속","수비"]) : ["수비"];
      var freeList = statList.filter(function(s){ return fixList.indexOf(s)<0; });
      var scores = [];
      for (var i = 0; i < N; i++) {
        var dist = {};
        statList.forEach(function(s){dist[s]=0;});
        for (var t2=0;t2<total;t2++) dist[statList[Math.floor(Math.random()*statList.length)]]++;
        var sortedS = statList.slice().sort(function(a,b){return dist[a]-dist[b];});
        var toFix = sortedS.slice(0,fixList.length);
        var fixedTot = toFix.reduce(function(a,s){return a+dist[s];},0);
        var rem = total - fixedTot;
        var newDist = {}; statList.forEach(function(s){newDist[s]=0;});
        /* 가장 낮은 값 → 수비/주루+수비로 이동 */
        fixList.forEach(function(dest,idx){ newDist[dest]=dist[toFix[idx]]||0; });
        /* 나머지 재분배 */
        for(var r2=0;r2<rem;r2++) newDist[freeList[Math.floor(Math.random()*freeList.length)]]++;
        var sc = isBatR
          ? (newDist["파워"]||0)*w2.p+(newDist["정확"]||0)*w2.a+(newDist["선구"]||0)*w2.e
          : (newDist["변화"]||0)*w2.c+(newDist["구위"]||0)*w2.s;
        scores.push(Math.round(sc*100)/100);
      }
      scores.sort(function(a,b){return a-b;});
      result["train_"+role+"_"+ct] = scores;
    });
  });

  /* 특훈 분포 추가
     가능 카드: 골든글러브/시그니처/임팩트/국가대표
     시행횟수: 골든글러브/시그니처/임팩트=3, 국가대표=4, FA(임팩트/시그니처)=5
     임팩트: perfect 없음 (good/great 각 1/2)
     others: good/great/perfect 각 1/3
     기본값: 타자 파워+3(FA:+5), 투수 구위+3(FA:+5)
     각 시행: good=1점, great=2점, perfect=3점 → 각 점수를 1씩 랜덤 스탯에 배정 */
  var SPEC_CARDS = ["골든글러브","시그니처","임팩트","국가대표"];
  var SPEC_TRIALS = {"골든글러브":3,"시그니처":3,"임팩트":3,"국가대표":4};
  var BAT_SPEC_STATS = ["파워","정확","선구","인내","주루","수비"];
  var PIT_SPEC_STATS = ["구속","변화","구위","제구","지구력","수비"];
  var w3 = getW();

  SPEC_CARDS.forEach(function(ct) {
    ["bat","pit","bat_fa","pit_fa"].forEach(function(roleKey) {
      var isFa = roleKey.indexOf("fa") >= 0;
      var isBatR = roleKey.indexOf("bat") >= 0;
      /* FA는 임팩트/시그니처만 */
      if (isFa && ct !== "임팩트" && ct !== "시그니처") return;
      var trials = isFa ? 5 : SPEC_TRIALS[ct];
      var hasPerfect = ct !== "임팩트";
      var statList = isBatR ? BAT_SPEC_STATS : PIT_SPEC_STATS;
      /* 기본값: 타자 파워, 투수 구위 */
      var baseStatIdx = isBatR ? 0 : 2; /* 파워=0, 구위=2 */
      var baseVal = isFa ? 5 : 3;

      var scores = [];
      for (var i = 0; i < N; i++) {
        var pts = {}; statList.forEach(function(s){pts[s]=0;});
        /* 기본값 고정 */
        pts[statList[baseStatIdx]] += baseVal;

        for (var t3 = 0; t3 < trials; t3++) {
          var roll = Math.random();
          var points;
          if (hasPerfect) {
            points = roll < 1/3 ? 1 : roll < 2/3 ? 2 : 3; /* good/great/perfect */
          } else {
            points = roll < 0.5 ? 1 : 2; /* good/great only (임팩트) */
          }
          /* 각 포인트를 개별적으로 랜덤 스탯에 배정 */
          for (var pp = 0; pp < points; pp++) {
            pts[statList[Math.floor(Math.random()*statList.length)]]++;
          }
        }
        var sc = isBatR
          ? (pts["파워"]||0)*w3.p+(pts["정확"]||0)*w3.a+(pts["선구"]||0)*w3.e
          : (pts["변화"]||0)*w3.c+(pts["구위"]||0)*w3.s;
        scores.push(Math.round(sc*100)/100);
      }
      scores.sort(function(a,b){return a-b;});
      result["spec_"+roleKey+"_"+ct] = scores;
    });
  });

  return result;
}

function getPercentile(dist, value) {
  if (!dist || !dist.length) return null;
  /* 상위 몇 % = 내 값보다 낮은 비율 */
  var lo = 0; var hi = dist.length - 1;
  while (lo < hi) { var mid = (lo+hi+1)>>1; if (dist[mid] <= value) lo=mid; else hi=mid-1; }
  var rank = lo / dist.length * 100;
  var top = 100 - rank;
  return Math.max(0.1, Math.round(top * 10) / 10);
}

function LineupAnalysis(p) {
  var mob = p.mobile;
  var players = p.players || [];
  var lineupMap = p.lineupMap || {};
  var skills = p.skills || {};
  var w = getW();

  var _dist = React.useState(null); var dist = _dist[0]; var setDist = _dist[1];
  var _building = React.useState(false); var building = _building[0]; var setBuilding = _building[1];
  var _role = React.useState("타자"); var role = _role[0]; var setRole = _role[1];

  /* 분포 빌드 (처음 열거나 스킬 변경 시) */
  var buildAndSet = React.useCallback(async function() {
    setBuilding(true);
    /* setTimeout으로 UI 블로킹 방지 */
    await new Promise(function(r){ setTimeout(r, 50); });
    var d = buildDist(skills, 50000);
    DIST_CACHE = d;
    setDist(d);
    setBuilding(false);
  }, [skills]);

  React.useEffect(function(){
    if (!DIST_CACHE) { buildAndSet(); }
    else { setDist(DIST_CACHE); }
  }, []);

  /* 라인업 선수 추출 */
  var allSlots = Object.keys(lineupMap);
  var batSlots = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  var pitSlots = ["SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP"];

  var getpl = function(slot) {
    var pid = lineupMap[slot]; if (!pid) return null;
    var raw = players.find(function(x){ return x.id===pid; });
    return raw ? (mergePl(raw)||raw) : null;
  };

  var batPlayers = batSlots.map(function(s){ return {slot:s, pl:getpl(s)}; }).filter(function(x){ return x.pl; });
  var pitPlayers = pitSlots.map(function(s){ return {slot:s, pl:getpl(s)}; }).filter(function(x){ return x.pl; });

  var getPitCat = function(pl) {
    var pos = pl.position || pl.subPosition || "";
    if (pos==="마무리"||pos==="CP") return "마무리";
    if (pos==="선발"||pos.indexOf("SP")>=0) return "선발";
    return "중계";
  };

  var skillSc = function(pl, cat) {
    return (getSkillScore(pl.skill1,pl.s1Lv||0,cat)+getSkillScore(pl.skill2,pl.s2Lv||0,cat)+getSkillScore(pl.skill3,pl.s3Lv||0,cat));
  };
  var trainBat = function(pl) { return (pl.trainP||0)*w.p+(pl.trainA||0)*w.a+(pl.trainE||0)*w.e; };
  var trainPit = function(pl) { return (pl.trainC||0)*w.c+(pl.trainS||0)*w.s; };
  var specBat = function(pl) { return (pl.specPower||0)*w.p+(pl.specAccuracy||0)*w.a+(pl.specEye||0)*w.e; };
  var specPit = function(pl) { return (pl.specChange||0)*w.c+(pl.specStuff||0)*w.s; };

  /* 훈련 포인트: 카드 종류별 상이 */
  var TRAIN_POINTS = {"골든글러브":75,"시그니처":75,"라이브":75,"올스타":75,"국가대표":60,"임팩트":54};
  /* 시그니처는 주루+수비 고정(유효 훈련 = 총점 - 주루 - 수비 기대값)
     나머지는 수비 고정 (유효 훈련 = 총점 - 수비 기대값)
     기대값: 시그니처 타자 - 2/6 * 총점이 비유효, 나머지 - 1/6 * 총점이 비유효 */
  var getExpTrain = function(pl, isBat) {
    var ct = pl.cardType || "";
    var total = TRAIN_POINTS[ct] || 75;
    var stats = 6; /* 6개 능력치 */
    var fixCount = ct === "시그니처" ? 2 : 1;
    /* 유효 능력치에 배분되는 기대값 */
    var usefulStats = stats - fixCount;
    var usefulPts = total * (usefulStats / stats);
    return isBat
      ? Math.round((usefulPts / usefulStats * 3) * 100) / 100  /* 파/정/선 3개 */
      : Math.round((usefulPts / usefulStats * 2) * 100) / 100; /* 변/구 2개 */
  };
  /* 실제 획득 가능한 최대 유효 훈련 (모두 유효 스탯에 몰빵 시) */
  var getMaxTrain = function(pl, isBat) {
    var ct = pl.cardType || "";
    var total = TRAIN_POINTS[ct] || 75;
    var fixCount = ct === "시그니처" ? 2 : 1;
    var fixPts = Math.floor(total / 6) * fixCount;
    return isBat
      ? Math.round((total - fixPts) * w.p) /* 최대 파워 집중 */
      : Math.round((total - fixPts) * w.c);
  };
  var MAX_SPEC_BAT = 15*w.p + 15*w.a + 15*w.e;
  var MAX_SPEC_PIT = 15*w.c + 15*w.s;

  var pctBar = function(top, color) {
    var w2 = Math.min(top, 100);
    var barColor = top <= 5 ? "#FFD700" : top <= 20 ? "#66BB6A" : top <= 50 ? "#42A5F5" : "var(--td)";
    return (
      <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0,width:"100%"}}>
        <div style={{flex:1,minWidth:40,height:5,background:"var(--inner)",borderRadius:3,overflow:"hidden"}}>
          <div style={{width:(100-w2)+"%",height:"100%",background:barColor,borderRadius:3,transition:"width 0.4s"}} />
        </div>
        <span style={{fontSize:11,fontWeight:800,color:barColor,minWidth:50,flexShrink:0,textAlign:"right"}}>
          {top===null?"계산중":("상위 "+top+"%")}
        </span>
      </div>
    );
  };

  var renderRow = function(slot, pl, isBat) {
    var cat = isBat ? "타자" : getPitCat(pl);
    var skSc = Math.round(skillSc(pl, cat)*100)/100;
    var trSc = isBat ? Math.round(trainBat(pl)*100)/100 : Math.round(trainPit(pl)*100)/100;
    var spSc = isBat ? Math.round(specBat(pl)*100)/100 : Math.round(specPit(pl)*100)/100;
    var skPct = (function(){
      if (!dist) return null;
      /* 카드종류에 맞는 분포 키 선택 */
      var ctKey = (pl.cardType==="골든글러브") ? "골든글러브"
                : (pl.cardType==="라이브")     ? "라이브"
                : (pl.cardType==="올스타")     ? "올스타"
                : "기본"; /* 임팩트/시그니처/국가대표/시즌 */
      var skDist = dist["skill_"+cat+"_"+ctKey];
      return skDist ? getPercentile(skDist, skSc) : null;
    })();
    /* 훈련: 훈재분 계산기와 동일한 분포 사용 (카드종류별 다름) */
    var trainDist = dist ? dist["train_"+(isBat?"bat":"pit")+"_"+(pl.cardType||"")] : null;
    var trPct = trainDist ? getPercentile(trainDist, trSc) : null;
    /* 특훈: 카드종류별 분포 기반 */
    var SPEC_CARDS_LIST = ["골든글러브","시그니처","임팩트","국가대표"];
    var spPct = null;
    if (dist && SPEC_CARDS_LIST.indexOf(pl.cardType) >= 0) {
      var isFaCard = pl.isFa && (pl.cardType==="임팩트"||pl.cardType==="시그니처");
      var specKey = "spec_"+(isBat?"bat":"pit")+(isFaCard?"_fa":"")+"_"+pl.cardType;
      var specDist = dist[specKey];
      if (specDist) {
        /* 기본값보다 낮으면 상위 100% */
        var baseVal = isFaCard ? 5 : 3;
        var baseStat = isBat ? "파워" : "구위";
        var baseScore = isBat ? baseVal*w.p : baseVal*w.s;
        if (spSc < baseScore - 0.01) {
          spPct = 100;
        } else {
          spPct = getPercentile(specDist, spSc);
        }
      }
    }

    return (
      <div key={pl.id} style={{padding:"10px 12px",borderBottom:"1px solid var(--bd)",display:"flex",flexDirection:mob?"column":"row",gap:mob?6:12,alignItems:mob?"flex-start":"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,minWidth:140}}>
          <Badge type={pl.cardType} />
          <div>
            <span style={{fontSize:12,fontWeight:800,color:"var(--t1)"}}>{pl.name}</span>
            <span style={{fontSize:9,color:"var(--td)",marginLeft:4}}>{slot}</span>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4,width:"100%",minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:10,color:"var(--td)",width:36,flexShrink:0}}>스킬</span>
            <span style={{fontSize:10,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{skSc}</span>
            {pctBar(skPct, "#CE93D8")}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:10,color:"var(--td)",width:36,flexShrink:0}}>훈련</span>
            <span style={{fontSize:10,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{trSc.toFixed(1)}</span>
            {pctBar(trPct, "#42A5F5")}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:10,color:"var(--td)",width:36,flexShrink:0}}>특훈</span>
            <span style={{fontSize:10,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{spSc.toFixed(1)}</span>
            {spPct !== null ? pctBar(spPct) : <span style={{fontSize:10,color:"var(--td)"}}>{"해당없음"}</span>}
          </div>
        </div>
      </div>
    );
  };

  if (building) return (
    <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:40,textAlign:"center"}}>
      <div style={{fontSize:13,color:"var(--td)",marginBottom:8}}>{"분포 계산 중..."}</div>
      <div style={{fontSize:11,color:"var(--td)"}}>{"5만 회 시뮬레이션 (최초 1회)"}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
        {["타자","투수"].map(function(r){ var a=r===role; return (
          <button key={r} onClick={function(){setRole(r);}} style={{padding:"6px 16px",fontSize:11,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{r}</button>
        );})}
        <button onClick={buildAndSet} style={{marginLeft:"auto",padding:"5px 10px",fontSize:10,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--td)",cursor:"pointer"}}>{"🔄 분포 갱신"}</button>
        <span style={{fontSize:9,color:"var(--td)"}}>{"(스킬 변경 시)"}</span>
      </div>

      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden",marginBottom:6}}>
        <div style={{padding:"8px 12px",background:"var(--inner)",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:12,fontWeight:800,color:"var(--t1)"}}>{role==="타자"?"⚾ 타자 라인업":"⚾ 투수 라인업"}</span>
          <span style={{fontSize:10,color:"var(--td)"}}>{"("+( role==="타자"?batPlayers.length:pitPlayers.length)+"명)"}</span>
        </div>
        {(role==="타자"?batPlayers:pitPlayers).length === 0 ? (
          <div style={{padding:24,textAlign:"center",fontSize:11,color:"var(--td)"}}>{"라인업에 등록된 선수가 없습니다"}</div>
        ) : (role==="타자"?batPlayers:pitPlayers).map(function(x){ return renderRow(x.slot, x.pl, role==="타자"); })}
      </div>

      <div style={{padding:"8px 12px",background:"var(--inner)",borderRadius:8,fontSize:10,color:"var(--td)"}}>
        {"💡 스킬 분포는 5만 회 시뮬레이션 기반. 훈련/특훈은 최대치 대비 비율. "}
        <span style={{color:"#FFD700"}}>{"금색: 상위 5%"}</span>{" "}
        <span style={{color:"#66BB6A"}}>{"초록: 상위 20%"}</span>{" "}
        <span style={{color:"#42A5F5"}}>{"파랑: 상위 50%"}</span>
      </div>
    </div>
  );
}

/* ─── 스킬 계산기 ─── */

/* ─── 스킬 사진판독 ─── */
function SkillPhotoScan(p) {
  var skills = p.skills || {};
  var onApply = p.onApply; /* 스킬 적용 콜백 */
  var mob = p.mobile;

  /* 포지션 자체 관리 */
  var POS_TYPES_PS = ["타자","선발","중계","마무리"];
  var _localPos = React.useState(p.pos || "타자"); var localPos = _localPos[0]; var setLocalPos = _localPos[1];

  var catMap = {"타자":"타자","선발":"선발","중계":"중계","마무리":"마무리"};
  var cat = catMap[localPos] || "타자";
  var catSkills = skills[cat] || {};
  var allSkillNames = Object.keys(catSkills);
  var baseName = function(n) { return n.replace(/\(.*?\)/g, "").replace(/\s+/g, "").trim(); };

  var _img = React.useState(null); var img = _img[0]; var setImg = _img[1];
  var _scanning = React.useState(false); var scanning = _scanning[0]; var setScanning = _scanning[1];
  var _scanResult = React.useState(null); var scanResult = _scanResult[0]; var setScanResult = _scanResult[1];
  var _err = React.useState(""); var err = _err[0]; var setErr = _err[1];
  /* 후보 선택 상태: [{rawName, lv, candidates:[fullName,...], selected:fullName}] */
  var _slots = React.useState([]); var slots = _slots[0]; var setSlots = _slots[1];
  /* 비교모드 우측 슬롯 */
  var _slotsB = React.useState([]); var slotsB = _slotsB[0]; var setSlotsB = _slotsB[1];
  var _mode = React.useState(null); var mode = _mode[0]; var setMode = _mode[1]; /* "single"|"compare" */

  var w = getW();
  var skillScore = function(name, lv) {
    if (!name || !catSkills[name]) return 0;
    var lvIdx = [5,6,7,8,9,10].indexOf(parseInt(lv));
    if (lvIdx < 0) lvIdx = 0;
    var entry = (catSkills[name] || [])[lvIdx];
    if (!entry) return 0;
    if (typeof entry === "number") return entry;
    return (entry.pV||0)*(entry.pF||0)*w.p+(entry.aV||0)*(entry.aF||0)*w.a+(entry.eV||0)*(entry.eF||0)*w.e+(entry.cV||0)*(entry.cF||0)*w.c+(entry.sV||0)*(entry.sF||0)*w.s;
  };
  var totalScore = function(slotList) {
    return slotList.reduce(function(acc,s){ return acc + skillScore(s.selected, s.lv); }, 0);
  };

  /* AI 인식 결과에서 스킬 매칭 - resolveSkillName 재사용 */
  var matchSkills = function(rawList) {
    return rawList.map(function(item) {
      var raw = (item.name||"").trim();
      var lv = parseInt(item.level||item.lv||5) || 5;
      /* resolveSkillName 사용: 띄어쓰기 정규화 + 괄호 조건부 + 특수규칙 모두 적용 */
      var res = resolveSkillName(raw, cat, null, skills, null);
      var candidates = (res.candidates && res.candidates.length > 1) ? res.candidates
                     : res.name ? [res.name] : [];
      var selected = res.name || "";
      return { rawName: raw, lv: lv, candidates: candidates, selected: selected, missing: res.missing };
    });
  };

  var onImgChange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
      setImg({ base64: ev.target.result.split(",")[1], mediaType: file.type, preview: ev.target.result });
      setScanResult(null); setSlots([]); setSlotsB([]); setMode(null); setErr("");
    };
    reader.readAsDataURL(file);
  };

  var runScan = async function() {
    if (!img) return;
    setScanning(true); setErr(""); setScanResult(null); setSlots([]); setSlotsB([]); setMode(null);
    var prompt = [
      "이 이미지는 컴투스 프로야구 게임의 스킬 변경 화면입니다.",
      "",
      "이미지 형태를 먼저 파악하세요:",
      "- 스킬 3개만 있는 단일 패널 → 모드: single",
      "- 왼쪽(기존스킬)과 오른쪽(스킬변경) 두 패널 비교 → 모드: compare",
      "",
      "single 모드: 스킬 3개의 이름과 레벨(아이콘 우하단 숫자)을 추출.",
      "compare 모드: 왼쪽 기존스킬 3개와 오른쪽 변경스킬 3개를 각각 추출.",
      "",
      "반드시 아래 JSON 형식으로만 응답하세요:",
      "single 모드:",
      '{"mode":"single","skills":[{"name":"스킬명","level":6},{"name":"스킬명","level":5},{"name":"스킬명","level":5}]}',
      "compare 모드:",
      '{"mode":"compare","current":[{"name":"스킬명","level":6},...],"next":[{"name":"스킬명","level":6},...]}',
    ].join("\n");

    try {
      var res = await fetch("/api/scan", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ base64: img.base64, mediaType: img.mediaType, prompt: prompt, userId: "", type: "skill" })
      });
      if (!res.ok) {
        var e = await res.json().catch(function(){return{};});
        var msg = typeof e.error === "string" ? e.error : "API 오류 " + res.status;
        throw new Error(msg);
      }
      var data = await res.json();
      var text = data.text || "";
      /* JSON 추출 */
      var arrStart = text.indexOf("{");
      var arrEnd = text.lastIndexOf("}");
      if (arrStart !== -1 && arrEnd !== -1) text = text.slice(arrStart, arrEnd + 1);
      var parsed = JSON.parse(text);
      setScanResult(parsed);
      if (parsed.mode === "single") {
        setMode("single");
        setSlots(matchSkills(parsed.skills || []));
      } else if (parsed.mode === "compare") {
        setMode("compare");
        setSlots(matchSkills(parsed.current || []));
        setSlotsB(matchSkills(parsed.next || []));
      }
    } catch(e) {
      setErr("판독 실패: " + e.message);
    }
    setScanning(false);
  };

  var updateSlot = function(slotList, setSlotList, idx, field, val) {
    setSlotList(function(prev) {
      var n = prev.slice();
      n[idx] = Object.assign({}, n[idx], {[field]: val});
      return n;
    });
  };

  var scoreA = totalScore(slots);
  var scoreB = totalScore(slotsB);

  /* 슬롯 렌더 */
  var renderSlots = function(slotList, setSlotList, label, color) {
    return React.createElement("div", {style:{flex:1,minWidth:0}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:color,marginBottom:8,textAlign:"center"}}, label),
      slotList.map(function(s, i) {
        var score = Math.round(skillScore(s.selected, s.lv) * 100) / 100;
        var hasMulti = s.candidates.length > 1;
        return React.createElement("div", {key:i, style:{background:"var(--inner)",borderRadius:8,padding:"8px 10px",marginBottom:6,border:"1px solid "+(hasMulti?"rgba(251,191,36,0.4)":"var(--bd)")}},
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
            React.createElement("span", {style:{fontSize:10,fontWeight:800,color:"#FFD54F",width:16,textAlign:"center"}}, i+1),
            React.createElement("span", {style:{fontSize:11,color:"var(--td)"}}, s.rawName),
            hasMulti && React.createElement("span", {style:{fontSize:9,color:"#FBBF24",marginLeft:"auto"}}, "⚠️ 선택 필요")
          ),
          s.candidates.length > 1
            ? React.createElement("select", {
                value: s.selected,
                onChange: function(e){ updateSlot(slotList, setSlotList, i, "selected", e.target.value); },
                style:{width:"100%",padding:"4px 6px",fontSize:11,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",marginBottom:4}
              },
              s.candidates.map(function(c){ return React.createElement("option",{key:c,value:c},c); })
            )
            : s.selected
              ? React.createElement("div", {style:{fontSize:12,fontWeight:700,color:"var(--t1)",padding:"2px 0"}}, s.selected)
              : React.createElement("div", {style:{fontSize:11,color:"#EF4444"}}, "❌ 스킬 미매칭: " + s.rawName),
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6,marginTop:4}},
            React.createElement("select", {
              value: s.lv,
              onChange: function(e){ updateSlot(slotList, setSlotList, i, "lv", parseInt(e.target.value)); },
              style:{width:60,padding:"3px 4px",fontSize:11,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#4FC3F7",fontWeight:700}
            },
              [5,6,7,8,9,10].map(function(v){ return React.createElement("option",{key:v,value:v},"Lv"+v); })
            ),
            React.createElement("span", {style:{fontSize:12,fontWeight:800,color:"#FFD54F",marginLeft:"auto",fontFamily:"var(--m)"}}, score)
          )
        );
      }),
      slotList.length > 0 && React.createElement("div", {
        style:{textAlign:"center",fontSize:13,fontWeight:900,color:color,fontFamily:"var(--m)",padding:"8px 0",borderTop:"1px solid var(--bd)",marginTop:4}
      }, "합계 " + Math.round(totalScore(slotList)*100)/100)
    );
  };

  return React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:10}},
    /* 포지션 선택 */
    React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}, "포지션 선택"),
      React.createElement("div", {style:{display:"flex",gap:6,flexWrap:"wrap"}},
        POS_TYPES_PS.map(function(pt) {
          var a = localPos === pt;
          return React.createElement("button", {
            key: pt,
            onClick: function() {
              setLocalPos(pt);
              setSlots([]); setSlotsB([]); setScanResult(null); setMode(null); setErr("");
            },
            style: {padding:"7px 18px",fontSize:12,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}
          }, pt);
        })
      )
    ),
    /* 이미지 업로드 */
    React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}, "📸 스킬 화면 사진 업로드"),
      React.createElement("div", {style:{fontSize:10,color:"var(--td)",marginBottom:10,lineHeight:1.5}},
        "스킬 변경 화면 스크린샷을 올려주세요.", React.createElement("br",null),
        "• 스킬 3개만 있는 화면 → 단일 분석", React.createElement("br",null),
        "• 기존스킬 vs 변경스킬 비교 화면 → 점수 비교"
      ),
      React.createElement("label", {style:{display:"block",cursor:"pointer"}},
        React.createElement("div", {style:{border:"2px dashed var(--bd)",borderRadius:8,padding:"16px",textAlign:"center",background:"var(--inner)",transition:"all 0.2s"}},
          img
            ? React.createElement("img", {src:img.preview, style:{maxWidth:"100%",maxHeight:200,borderRadius:6,objectFit:"contain"}})
            : React.createElement("div", null,
                React.createElement("div", {style:{fontSize:24,marginBottom:6}}, "📷"),
                React.createElement("div", {style:{fontSize:12,color:"var(--td)"}}, "사진을 클릭하여 업로드")
              )
        ),
        React.createElement("input", {type:"file",accept:"image/*",onChange:onImgChange,style:{display:"none"}})
      ),
      img && React.createElement("div", {style:{display:"flex",gap:8,marginTop:10}},
        React.createElement("button", {
          onClick: runScan,
          disabled: scanning,
          style:{flex:1,padding:"10px",fontSize:12,fontWeight:800,background:scanning?"var(--inner)":"linear-gradient(135deg,#667eea,#764ba2)",border:"none",borderRadius:8,color:scanning?"var(--td)":"#fff",cursor:scanning?"not-allowed":"pointer"}
        }, scanning ? "🔍 판독 중..." : "🔍 스킬 판독"),
        React.createElement("button", {
          onClick:function(){setImg(null);setScanResult(null);setSlots([]);setSlotsB([]);setMode(null);setErr("");},
          style:{padding:"10px 14px",fontSize:12,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t2)",cursor:"pointer"}
        }, "✕")
      )
    ),

    /* 에러 */
    err && React.createElement("div", {style:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#fca5a5"}}, "⚠️ " + err),

    /* 결과 - single 모드 */
    mode === "single" && slots.length > 0 && React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:10}}, "📊 스킬 분석 결과"),
      renderSlots(slots, setSlots, "스킬 조합", "#FFD54F"),
      React.createElement("button", {
        onClick: function(){
          if (onApply) onApply(slots.map(function(s){return {name:s.selected,lv:s.lv};}));
        },
        disabled: slots.some(function(s){return !s.selected;}),
        style:{width:"100%",marginTop:10,padding:"10px",fontSize:12,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",border:"none",borderRadius:8,color:"#1a1100",cursor:"pointer",opacity:slots.some(function(s){return !s.selected;})? 0.5:1}
      }, "✅ 스킬계산기에 적용")
    ),

    /* 결과 - compare 모드 */
    mode === "compare" && slots.length > 0 && React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:12}}, "⚖️ 스킬 비교 결과"),
      /* 승패 배너 */
      React.createElement("div", {style:{
        textAlign:"center",padding:"10px",borderRadius:8,marginBottom:12,
        background: scoreA > scoreB ? "rgba(74,222,128,0.1)" : scoreB > scoreA ? "rgba(251,191,36,0.1)" : "rgba(148,163,184,0.1)",
        border: "1px solid " + (scoreA > scoreB ? "#4ade80" : scoreB > scoreA ? "#FBBF24" : "#94a3b8")
      }},
        React.createElement("div", {style:{fontSize:14,fontWeight:900,color: scoreA > scoreB ? "#4ade80" : scoreB > scoreA ? "#FBBF24" : "var(--td)"}},
          scoreA > scoreB ? "✅ 기존 스킬 유지 추천" : scoreB > scoreA ? "🔄 스킬 변경 추천" : "🤝 동점"
        ),
        React.createElement("div", {style:{fontSize:11,color:"var(--td)",marginTop:2}},
          "기존 " + Math.round(scoreA*100)/100 + " vs 변경 " + Math.round(scoreB*100)/100 +
          " (차이: " + Math.round(Math.abs(scoreA-scoreB)*100)/100 + ")"
        )
      ),
      /* 좌우 비교 */
      React.createElement("div", {style:{display:"flex",gap:10,alignItems:"flex-start"}},
        renderSlots(slots, setSlots, "기존 스킬", scoreA >= scoreB ? "#4ade80" : "#94a3b8"),
        React.createElement("div", {style:{display:"flex",alignItems:"center",justifyContent:"center",paddingTop:40,flexShrink:0}},
          React.createElement("span", {style:{fontSize:18,fontWeight:900,color:"var(--td)"}}, "OR")
        ),
        renderSlots(slotsB, setSlotsB, "변경 스킬", scoreB > scoreA ? "#FBBF24" : "#94a3b8")
      )
    )
  );
}

function SkillCalculator(p) {
  var skills = p.skills || {};
  var mob = p.mobile;

  var CARD_TYPES_SC = ["골든글러브","시그니처","임팩트","국가대표","라이브","올스타"];
  var POS_TYPES = ["타자","선발","중계","마무리"];
  var DEFAULT_LV = {
    "라이브":[7,7,7],"올스타":[8,7,7],"골든글러브":[6,6,6],
    "시그니처":[6,5,5],"임팩트":[6,5,5],"국가대표":[6,5,5]
  };

  var _card = React.useState("골든글러브"); var cardType = _card[0]; var setCardType = _card[1];
  var _pos  = React.useState("타자");       var pos = _pos[0];      var setPos  = _pos[1];
  var _sk   = React.useState([{name:"",lv:6,locked:false},{name:"",lv:5,locked:false},{name:"",lv:5,locked:false}]);
  var sks = _sk[0]; var setSks = _sk[1];
  var _result = React.useState(null); var result = _result[0]; var setResult = _result[1];
  var _running = React.useState(false); var running = _running[0]; var setRunning = _running[1];
  var _needSelect = React.useState([null,null,null]); var needSelect = _needSelect[0]; var setNeedSelect = _needSelect[1];

  var catMap = {"타자":"타자","선발":"선발","중계":"중계","마무리":"마무리"};
  var cat = catMap[pos] || "타자";
  var catSkills = skills[cat] || {};
  var allSkillNames = Object.keys(catSkills);
  var majorMap = (skills._major && skills._major[cat]) || {};

  /* 괄호 제거 기본명 */
  var baseName = function(n) { return n.replace(/\(.*?\)/g, '').trim(); };

  /* 기본명 기준으로 그룹화 (예: "5툴플레이어" → ["5툴플레이어(주수235-242)", ...]) */
  var groupByBase = function(nameList) {
    var groups = {};
    nameList.forEach(function(n) {
      var b = baseName(n);
      if (!groups[b]) groups[b] = [];
      groups[b].push(n);
    });
    return groups;
  };

  /* 메이저/비메이저를 기본명 기준 그룹으로 변환 */
  var majorGroups = groupByBase(allSkillNames.filter(function(n){return majorMap[n];}));
  var minorGroups = groupByBase(allSkillNames.filter(function(n){return !majorMap[n];}));
  var majorBaseNames = Object.keys(majorGroups);
  var minorBaseNames = Object.keys(minorGroups);
  var majorSkills = allSkillNames.filter(function(n){return majorMap[n];});
  var minorSkills = allSkillNames.filter(function(n){return !majorMap[n];});

  var w = getW();

  /* 스킬 점수 계산 - 기존 calcSkill과 동일하게 전체 합산 */
  var skillScore = function(name, lv) {
    if (!name || !catSkills[name]) return 0;
    var lvIdx = [5,6,7,8,9,10].indexOf(lv);
    if (lvIdx < 0) lvIdx = 0;
    var entry = (catSkills[name] || [])[lvIdx];
    if (!entry) return 0;
    if (typeof entry === "number") return entry;
    return (entry.pV||0)*(entry.pF||0)*w.p+(entry.aV||0)*(entry.aF||0)*w.a+(entry.eV||0)*(entry.eF||0)*w.e+(entry.cV||0)*(entry.cF||0)*w.c+(entry.sV||0)*(entry.sF||0)*w.s;
  };

  var myScore = sks.reduce(function(acc,s){return acc+skillScore(s.name,s.lv);},0);

  /* 카드 변경 시 기본 레벨 세팅 */
  var onCardChange = function(ct) {
    setCardType(ct);
    var lvs = DEFAULT_LV[ct] || [6,5,5];
    setSks(function(prev){return prev.map(function(s,i){return Object.assign({},s,{lv:lvs[i]});});});
    setResult(null);
  };

  /* 몬테카를로 시뮬레이션 */
  var runSim = function() {
    if (allSkillNames.length < 3) { alert("스킬DB에 스킬이 3개 이상 필요합니다."); return; }
    setRunning(true); setResult(null);
    setTimeout(function() {
      var N = 100000;
      var isImpact = cardType === "임팩트";
      var lvs = DEFAULT_LV[cardType] || [6,5,5];
      var scores = [];

      for (var i = 0; i < N; i++) {
        var chosen = [];
        var totalScore = 0;

        /* 임팩트: 스킬1 고정 */
        var startIdx = 0;
        if (isImpact && sks[0].name) {
          chosen.push(sks[0].name);
          totalScore += skillScore(sks[0].name, lvs[0]);
          startIdx = 1;
        }

        /* 나머지 스킬 뽑기: 기본명 기준으로 중복 없이 선택 */
        for (var slot = startIdx; slot < 3; slot++) {
          /* 스킬1은 무조건 메이저, 스킬2/3는 14% 확률 */
          var isMajor = (slot === 0) ? true : Math.random() < 0.14;
          /* 이미 선택된 기본명 제외 */
          var chosenBases = chosen.map(function(n){return baseName(n);});
          var basePool = (isMajor ? majorBaseNames : minorBaseNames).filter(function(b){return chosenBases.indexOf(b)<0;});
          if (basePool.length === 0) {
            /* fallback: 반대 풀에서 선택 */
            basePool = (isMajor ? minorBaseNames : majorBaseNames).filter(function(b){return chosenBases.indexOf(b)<0;});
          }
          if (basePool.length === 0) break;
          /* 기본명 선택 후 해당 변형들 중 랜덤 선택 */
          var pickedBase = basePool[Math.floor(Math.random()*basePool.length)];
          var variants = (majorGroups[pickedBase] || minorGroups[pickedBase] || [pickedBase]);
          var pick = variants[Math.floor(Math.random()*variants.length)];
          chosen.push(pick);
          totalScore += skillScore(pick, lvs[slot]);
        }
        scores.push(totalScore);
      }

      scores.sort(function(a,b){return a-b;});

      /* 상위 % 계산 */
      var rank = scores.filter(function(s){return s<=myScore;}).length;
      var pct = Math.round((1 - rank/N)*1000)/10;

      /* 히스토그램 (20구간) */
      var min = scores[0]; var max = scores[scores.length-1];
      var bins = 20;
      var step = (max-min)/bins || 1;
      var hist = [];
      for (var b = 0; b < bins; b++) {
        var lo = min+b*step; var hi = lo+step;
        var cnt = scores.filter(function(s){return s>=lo&&s<hi;}).length;
        hist.push({lo:Math.round(lo*10)/10, hi:Math.round(hi*10)/10, cnt:cnt, pct:cnt/N*100});
      }

      setResult({pct:pct, myScore:Math.round(myScore*100)/100, hist:hist, avg:Math.round(scores[Math.floor(N/2)]*100)/100});
      setRunning(false);
    }, 50);
  };

  var cardColor = {"골든글러브":"#D4AF37","시그니처":"#E91E63","임팩트":"#4CAF50","국가대표":"#2196F3","라이브":"#FF9800","올스타":"#9C27B0"};

  var _scTab = React.useState("manual"); var scTab = _scTab[0]; var setScTab = _scTab[1];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* 탭 선택 */}
      <div style={{display:"flex",gap:6}}>
        {[{id:"manual",label:"✏️ 직접 입력"},{id:"photo",label:"📸 사진 판독"}].map(function(t){
          var a=scTab===t.id;
          return (<button key={t.id} onClick={function(){setScTab(t.id);}} style={{flex:1,padding:"9px",fontSize:12,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{t.label}</button>);
        })}
      </div>
      {/* 사진판독 탭 */}
      {scTab==="photo" && <SkillPhotoScan
        skills={skills}
        pos={pos}
        cardType={cardType}
        mobile={mob}
        onApply={function(applied, appliedPos){
          if (appliedPos) { setPos(appliedPos); }
          setSks(function(prev){return prev.map(function(s,i){return applied[i]?Object.assign({},s,{name:applied[i].name,lv:applied[i].lv}):s;});});
          setScTab("manual");
          setResult(null);
        }}
      />}
      {scTab==="manual" && (<>
      {/* 카드종류 + 포지션 선택 */}
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"카드 종류"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {CARD_TYPES_SC.map(function(ct){
            var a=cardType===ct;
            return (<button key={ct} onClick={function(){onCardChange(ct);}} style={{padding:"5px 10px",fontSize:10,fontWeight:a?800:500,background:a?"rgba("+([212,175,55].join(","))+",0.15)":"var(--inner)",border:"1px solid "+(a?cardColor[ct]:"var(--bd)"),borderRadius:6,color:a?cardColor[ct]:"var(--t2)",cursor:"pointer"}}>{ct}</button>);
          })}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"포지션"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {POS_TYPES.map(function(pt){
            var a=pos===pt;
            return (<button key={pt} onClick={function(){setPos(pt);setSks(function(prev){return prev.map(function(s){return Object.assign({},s,{name:""});});});setResult(null);}} style={{padding:"5px 14px",fontSize:11,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{pt}</button>);
          })}
        </div>
      </div>

      {/* 스킬 입력 */}
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:10}}>{"스킬 입력"+(majorSkills.length===0?" (⚠️ 스킬관리에서 ★메이저 스킬을 설정해주세요)":"")}</div>
        {sks.map(function(sk,i){
          var lvs = DEFAULT_LV[cardType]||[6,5,5];
          var isLocked = cardType==="임팩트"&&i===0;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(255,213,79,0.15)",border:"1px solid rgba(255,213,79,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#FFD54F",flexShrink:0}}>{i+1}</div>
              {isLocked && <span style={{fontSize:9,color:"#66BB6A",flexShrink:0}}>{"🔒고정"}</span>}
              <select value={sk.name} onChange={function(e){var v=e.target.value;setSks(function(prev){var n=prev.slice();n[i]=Object.assign({},n[i],{name:v});return n;});setResult(null);}}
                style={{flex:1,padding:"5px 8px",fontSize:11,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",outline:"none"}}>
                <option value="">{"-- 스킬 선택 --"}</option>
                {majorSkills.length>0&&(<optgroup label={"⭐ 메이저 스킬"} style={{color:"#CE93D8"}}>{majorSkills.map(function(n){return(<option key={n} value={n}>{n}</option>);})}</optgroup>)}
                {minorSkills.length>0&&(<optgroup label={"일반 스킬"} style={{color:"#94a3b8"}}>{minorSkills.map(function(n){return(<option key={n} value={n}>{n}</option>);})}</optgroup>)}
              </select>
              <select value={sk.lv} onChange={function(e){setSks(function(prev){var n=prev.slice();n[i]=Object.assign({},n[i],{lv:parseInt(e.target.value)});return n;});setResult(null);}}
                style={{width:52,padding:"5px 4px",fontSize:11,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#4FC3F7",fontWeight:700,outline:"none",textAlign:"center"}}>
                {[5,6,7,8,9,10].map(function(v){return(<option key={v} value={v}>{"Lv"+v}</option>);})}
              </select>
              <span style={{fontSize:11,fontFamily:"var(--m)",fontWeight:700,color:"#FFD54F",minWidth:36,textAlign:"right"}}>{Math.round(skillScore(sk.name,sk.lv)*100)/100}</span>
            </div>
          );
        })}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:"1px solid var(--bd)"}}>
          <span style={{fontSize:13,fontWeight:800,color:"var(--t1)"}}>{"합계 점수: "}<span style={{color:"var(--acc)",fontFamily:"var(--m)"}}>{Math.round(myScore*100)/100}</span></span>
          <button onClick={runSim} disabled={running||allSkillNames.length<3} style={{padding:"8px 20px",fontSize:12,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",border:"none",borderRadius:8,color:"#1a1100",cursor:"pointer",opacity:running?0.6:1}}>
            {running?"시뮬레이션 중...":"🎯 확률 계산"}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:13,color:"var(--td)",marginBottom:4}}>{"내 스킬 점수: "}<span style={{fontWeight:800,color:"var(--t1)",fontFamily:"var(--m)"}}>{result.myScore}</span>{" / 중간값: "}<span style={{fontWeight:700,color:"var(--td)",fontFamily:"var(--m)"}}>{result.avg}</span></div>
            <div style={{fontSize:28,fontWeight:900,color:result.pct<=10?"#4ade80":result.pct<=30?"#FFD54F":"var(--t1)",fontFamily:"var(--h)"}}>{"상위 "+result.pct+"%"}</div>
            <div style={{fontSize:11,color:"var(--td)"}}>{"(10만회 시뮬레이션 기준)"}</div>
          </div>
          {/* 히스토그램 */}
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80,marginTop:8}}>
            {result.hist.map(function(bin,i){
              var isMe = result.myScore>=bin.lo&&result.myScore<bin.hi;
              var maxPct = Math.max.apply(null,result.hist.map(function(b){return b.pct;}));
              var h = maxPct>0?(bin.pct/maxPct*100):0;
              return (<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <div style={{width:"100%",height:h+"%",background:isMe?"#FFD54F":"rgba(255,255,255,0.15)",borderRadius:"2px 2px 0 0",minHeight:isMe?4:1,transition:"height 0.3s"}}/>
              </div>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--td)",marginTop:2}}>
            <span>{result.hist[0]&&Math.round(result.hist[0].lo*10)/10}</span>
            <span style={{color:"#FFD54F"}}>{"▲ 내 점수"}</span>
            <span>{result.hist[result.hist.length-1]&&Math.round(result.hist[result.hist.length-1].hi*10)/10}</span>
          </div>
        </div>
      )}
      </> )}
    </div>
  );
}

/* ─── 훈재분 계산기 ─── */
function TrainSimulator(p) {
  var mob = p.mobile;
  var skills = p.skills || {};

  var CARD_TYPES_TR = ["골든글러브","시그니처","임팩트","국가대표","라이브","올스타"];
  var TRAIN_POINTS = {"골든글러브":75,"시그니처":75,"라이브":75,"올스타":75,"국가대표":60,"임팩트":54};
  var SIG_FIX_BAT = ["주루","수비"]; var SIG_FIX_PIT = ["구속","수비"];
  var BAT_STATS = ["파워","정확","선구","인내","주루","수비"];
  var PIT_STATS = ["구속","변화","구위","제구","지구력","수비"];

  var _card = React.useState("골든글러브"); var cardType = _card[0]; var setCardType = _card[1];
  var _pos  = React.useState("타자");       var pos = _pos[0];      var setPos  = _pos[1];
  var _result = React.useState(null); var result = _result[0]; var setResult = _result[1];
  var _running = React.useState(false); var running = _running[0]; var setRunning = _running[1];
  var _myDist = React.useState({}); var myDist = _myDist[0]; var setMyDist = _myDist[1];

  var w = getW();
  var isBat = pos === "타자";
  var stats = isBat ? BAT_STATS : PIT_STATS;
  var fixStats = cardType==="시그니처" ? (isBat?SIG_FIX_BAT:SIG_FIX_PIT) : (isBat?["수비"]:["수비"]);
  /* 재분배 풀: 고정 스탯(수비/주루+수비) 제외한 나머지 전체 */
  var freeStats = stats.filter(function(s){ return fixStats.indexOf(s)<0; });
  var totalPts = TRAIN_POINTS[cardType]||75;

  var statScore = function(dist) {
    if (isBat) return (dist["파워"]||0)*w.p+(dist["정확"]||0)*w.a+(dist["선구"]||0)*w.e;
    return (dist["변화"]||0)*w.c+(dist["구위"]||0)*w.s;
  };

  var runSim = function() {
    setRunning(true); setResult(null);
    setTimeout(function() {
      var N = 100000;
      var scores = [];

      for (var i = 0; i < N; i++) {
        /* 1단계: 전체 능력치에 1씩 랜덤 분배 */
        var dist = {};
        stats.forEach(function(s){dist[s]=0;});
        for (var t = 0; t < totalPts; t++) {
          dist[stats[Math.floor(Math.random()*stats.length)]]++;
        }

        /* 2단계: 가장 낮은 값 찾기 */
        var fixCount = fixStats.length;
        var sortedStats = stats.slice().sort(function(a,b){return dist[a]-dist[b];});
        var toFix = sortedStats.slice(0,fixCount);

        /* 3단계: 가장 낮은 값을 수비(시그니처는 주루+수비)로 이동, 나머지 재분배
           toFix[i] (가장 낮은 스탯)의 값이 fixStats[i] (수비/주루)로 이동 */
        var fixedTotal = toFix.reduce(function(acc,s){return acc+dist[s];},0);
        var remaining = totalPts - fixedTotal;
        var newDist = {};
        stats.forEach(function(s){newDist[s]=0;});
        /* 이동: 가장 낮은 스탯의 값 → 수비/주루+수비 */
        fixStats.forEach(function(dest,idx){ newDist[dest]=dist[toFix[idx]]||0; });
        /* 나머지 포인트를 freeStats에 랜덤 재분배 */
        for (var r = 0; r < remaining; r++) {
          newDist[freeStats[Math.floor(Math.random()*freeStats.length)]]++;
        }

        scores.push(statScore(newDist));
      }

      scores.sort(function(a,b){return a-b;});
      var med = scores[Math.floor(N/2)];
      var top10 = scores[Math.floor(N*0.9)];
      var top1  = scores[Math.floor(N*0.99)];

      /* 내 점수 백분위 */
      var myPct = null;
      var mySc = statScore(myDist);
      var hasMyDist = Object.keys(myDist).some(function(k){return (myDist[k]||0)>0;});
      if (hasMyDist) {
        var myRank = scores.filter(function(s){return s<=mySc;}).length;
        myPct = Math.round((1-myRank/N)*1000)/10;
      }

      /* 히스토그램 */
      var min=scores[0]; var max=scores[scores.length-1];
      var bins=20; var step=(max-min)/bins||1;
      var hist=[];
      for(var b=0;b<bins;b++){
        var lo=min+b*step; var hi=lo+step;
        var cnt=scores.filter(function(s){return s>=lo&&s<hi;}).length;
        hist.push({lo:Math.round(lo*10)/10,hi:Math.round(hi*10)/10,cnt:cnt,pct:cnt/N*100});
      }

      setResult({med:Math.round(med*100)/100, top10:Math.round(top10*100)/100, top1:Math.round(top1*100)/100, hist:hist, min:Math.round(min*100)/100, max:Math.round(max*100)/100, myPct:myPct, mySc:hasMyDist?Math.round(mySc*100)/100:null});
      setRunning(false);
    },50);
  };

  var cardColor = {"골든글러브":"#D4AF37","시그니처":"#E91E63","임팩트":"#4CAF50","국가대표":"#2196F3","라이브":"#FF9800","올스타":"#9C27B0"};

  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"카드 종류"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {CARD_TYPES_TR.map(function(ct){
            var a=cardType===ct;
            return (<button key={ct} onClick={function(){setCardType(ct);setResult(null);}} style={{padding:"5px 10px",fontSize:10,fontWeight:a?800:500,background:"var(--inner)",border:"1px solid "+(a?cardColor[ct]:"var(--bd)"),borderRadius:6,color:a?cardColor[ct]:"var(--t2)",cursor:"pointer"}}>{ct+(ct==="국가대표"?" (60pt)":ct==="임팩트"?" (54pt)":" (75pt)")}</button>);
          })}
        </div>
        <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"포지션"}</div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["타자","투수"].map(function(pt){
            var a=pos===pt;
            return (<button key={pt} onClick={function(){setPos(pt);setResult(null);}} style={{padding:"5px 14px",fontSize:11,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{pt}</button>);
          })}
        </div>
        <div style={{padding:"10px 12px",background:"var(--inner)",borderRadius:8,marginBottom:12,fontSize:11,color:"var(--td)"}}>
          <div style={{fontWeight:700,color:"var(--t1)",marginBottom:4}}>{"📋 시뮬레이션 조건"}</div>
          <div>{"• 훈련 포인트: "}<span style={{color:"var(--acc)",fontWeight:700}}>{totalPts}{"pt"}</span></div>
          <div>{"• 고정 능력치: "}<span style={{color:"#EF5350",fontWeight:700}}>{fixStats.join(", ")}</span>{" (최저값 배치)"}</div>
          <div>{"• 재배치 능력치: "}<span style={{color:"#66BB6A",fontWeight:700}}>{freeStats.join(", ")}</span></div>
          <div>{"• 점수 계산: "+(isBat?"파워×"+w.p+" + 정확×"+w.a+" + 선구×"+w.e:"변화×"+w.c+" + 구위×"+w.s)}</div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--td)",marginBottom:4}}>{"내 훈재분 수치 입력 (선택사항)"}</div>
          <div style={{fontSize:9,color:"var(--td)",marginBottom:8}}>{isBat?"파워/정확/선구만 입력하면 됩니다":"변화/구위만 입력하면 됩니다"}</div>
          <div style={{display:"flex",gap:10}}>
            {(isBat?["파워","정확","선구"]:["변화","구위"]).map(function(s){
              var clr = isBat?(s==="파워"?"#EF5350":s==="정확"?"#42A5F5":"#66BB6A"):(s==="변화"?"#AB47BC":"#FF7043");
              return (<div key={s} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:10,fontWeight:700,color:clr,marginBottom:4}}>{s}</div>
                <input type="number" min="0" max="75" value={myDist[s]||""} placeholder="0"
                  onChange={function(e){var v=parseInt(e.target.value)||0;setMyDist(function(prev){var n=Object.assign({},prev);n[s]=v;return n;});setResult(null);}}
                  style={{width:"100%",padding:"6px 4px",textAlign:"center",background:"#1e293b",border:"1px solid "+clr+"55",borderRadius:6,color:clr,fontSize:16,fontFamily:"var(--m)",fontWeight:800,outline:"none",boxSizing:"border-box"}} />
              </div>);
            })}
          </div>
        </div>
        <button onClick={runSim} disabled={running} style={{width:"100%",padding:"10px",fontSize:13,fontWeight:800,background:"linear-gradient(135deg,#66BB6A,#43A047)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",opacity:running?0.6:1}}>
          {running?"시뮬레이션 중... (10만회)":"🏋️ 훈재분 계산"}
        </button>
      </div>

      {result && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
          <div style={{fontSize:13,fontWeight:800,color:"var(--t1)",marginBottom:12}}>{"📈 시뮬레이션 결과 (10만회)"}</div>
          {result.myPct !== null && (
            <div style={{background:"rgba(255,213,79,0.08)",border:"1px solid rgba(255,213,79,0.3)",borderRadius:10,padding:"12px 16px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:11,color:"var(--td)",marginBottom:4}}>{"내 훈재분 점수: "}<span style={{fontWeight:800,color:"var(--t1)",fontFamily:"var(--m)"}}>{result.mySc}</span></div>
              <div style={{fontSize:26,fontWeight:900,color:result.myPct<=1?"#4ade80":result.myPct<=10?"#FFD54F":"var(--t1)",fontFamily:"var(--h)"}}>{"상위 "+result.myPct+"%"}</div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[{label:"중간값 (50%)",val:result.med,color:"var(--td)"},{label:"상위 10%",val:result.top10,color:"#FFD54F"},{label:"상위 1%",val:result.top1,color:"#4ade80"}].map(function(item){
              return (<div key={item.label} style={{background:"var(--inner)",borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"var(--td)",marginBottom:4}}>{item.label}</div>
                <div style={{fontSize:18,fontWeight:900,color:item.color,fontFamily:"var(--m)"}}>{item.val}</div>
              </div>);
            })}
          </div>
          {/* 히스토그램 */}
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80}}>
            {result.hist.map(function(bin,i){
              var maxPct=Math.max.apply(null,result.hist.map(function(b){return b.pct;}));
              var h=maxPct>0?(bin.pct/maxPct*100):0;
              var isMe = result.mySc!==null&&result.mySc>=bin.lo&&result.mySc<bin.hi;
              var isTop10 = bin.lo >= result.top10;
              var isTop1  = bin.lo >= result.top1;
              var bg = isMe?"#fff":isTop1?"#4ade80":isTop10?"#FFD54F":"rgba(255,255,255,0.12)";
              return (<div key={i} style={{flex:1,height:h+"%",background:bg,borderRadius:"2px 2px 0 0",minHeight:1,border:isMe?"1px solid #fff":"none"}}/>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--td)",marginTop:4}}>
            <span>{result.min}</span>
            <span style={{color:"#FFD54F"}}>{"황금 = 상위10%"}</span>
            <span style={{color:"#4ade80"}}>{"초록 = 상위1%"}</span>
            <span>{result.max}</span>
          </div>
        </div>
      )}
    </div>
  );
}


function CommunityPage(p){return(
  <div style={{padding:p.mobile?12:18,maxWidth:760,paddingBottom:p.mobile?80:18}}>
    <h2 style={{fontSize:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 14px"}}>{"정보"}</h2>
    <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>{"📢"}</div><h3 style={{fontSize:15,fontWeight:700,color:"var(--t1)",margin:"0 0 6px"}}>{"추후 업데이트 예정"}</h3><p style={{fontSize:12,color:"var(--td)",margin:0}}>{"새로운 기능이 준비되면 이 페이지에서 안내드리겠습니다."}</p></div>
  </div>
);}


/* ================================================================
   APP
   ================================================================ */
export default function App(){
  useEffect(function(){
    if(!window.XLSX){var s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";document.head.appendChild(s);}
  },[]);
  var _l=useState(false);var li=_l[0];var setLi=_l[1];
  var _u=useState("");var user=_u[0];var setUser=_u[1];
  var _t=useState("lineup");var tab=_t[0];var setTab=_t[1];
  var _a=useState(false);var isAdmin=_a[0];var setAdmin=_a[1];
  var _at=useState("");var authType=_at[0];var setAuthType=_at[1];
  var _sd=useState({liveSetPo:0});var sdState=_sd[0];var setSdState=_sd[1];
  var _uid=useState(null);var userId=_uid[0];var setUserId=_uid[1];
  var _authChecked=useState(false);var authChecked=_authChecked[0];var setAuthChecked=_authChecked[1];
  var mob=useMedia("(max-width:640px)");var tbl=useMedia("(min-width:641px) and (max-width:1024px)");

  /* ── 멀티덱 상태 ── */
  var _decks=useState([]);var decks=_decks[0];var setDecks=_decks[1];
  var _curId=useState(null);var curDeckId=_curId[0];var setCurDeckId=_curId[1];
  /* showTeamSelect: "first"(첫 덱 추가), "add"(추가 덱), false(숨김) */
  var _sts=useState(false);var showTeamSelect=_sts[0];var setShowTeamSelect=_sts[1];

  var store=useData(userId,sdState,setSdState,curDeckId);

  /* ── localStorage 덱 목록 로드/저장 헬퍼 ── */
  var loadDecks=React.useCallback(async function(uid){
    /* Supabase 우선, fallback localStorage */
    var targetUid = uid || userId;
    if(supabase && targetUid){
      var all=await loadUserData(targetUid);
      if(all&&all.deckList&&all.deckList.length>0)
        return{list:all.deckList, curId:all.deckCurrent||null, fromSupabase:true};
    }
    var list=await sGet("deck-list");var curId=await sGet("deck-current");
    return{list:list||[], curId:curId||null, fromSupabase:false};
  },[userId]);
  var saveDecks=React.useCallback(async function(list,curId){
    /* localStorage 항상 저장 */
    await sSet("deck-list",list);await sSet("deck-current",curId);
    /* Supabase: 전체 구조 유지하면서 deckList/deckCurrent만 업데이트 */
    if(supabase&&userId){
      try{
        var all=store.allDataRef ? store.allDataRef.current : null;
        if(!all) all=await loadUserData(userId)||{};
        if(!all.decks) all.decks={};
        all.deckList=list;
        all.deckCurrent=curId;
        /* allDataRef 캐시도 동기화 */
        if(store.allDataRef) store.allDataRef.current=all;
        await saveUserData(userId,all);
      }catch(e){console.warn('saveDecks 오류:',e);}
    }
  },[userId,store]);

  /* ── 로그인 성공 후 덱 목록 로드 ── */
  useEffect(function(){
    if(!userId)return;
    (async function(){
      var result=await loadDecks(userId);
      var list=result.list; var savedCurId=result.curId;
      var fromSupabase=result.fromSupabase;

      /* localStorage에서 가져왔으면 Supabase에 즉시 동기화 */
      if(!fromSupabase && list && list.length>0 && supabase){
        try{
          var all=await loadUserData(userId)||{};
          if(!all.decks)all.decks={};
          all.deckList=list;
          all.deckCurrent=savedCurId;
          await saveUserData(userId,all);
        }catch(e){console.warn('덱 목록 동기화 오류:',e);}
      }

      /* 기존 유저: deckList 없어도 Supabase에 players 데이터가 있으면 임시 덱 생성 */
      if((!list||list.length===0) && supabase){
        var ud=await loadUserData(userId);
        if(ud && ud.players && ud.players.length>0){
          /* 기존 데이터가 있는 유저 → 기본 덱 1개 자동 생성 */
          var fallbackId="dk_legacy_"+userId.slice(0,8);
          var fallbackDeck={deckId:fallbackId,teamName:"내 덱"};
          list=[fallbackDeck]; savedCurId=fallbackId;
          /* Supabase에 덱 목록 저장 */
          ud.deckList=list; ud.deckCurrent=fallbackId;
          await saveUserData(userId,ud);
          await sSet("deck-list",list); await sSet("deck-current",fallbackId);
        }
      }

      if(list&&list.length>0){
        setDecks(list);
        var found=list.find(function(d){return d.deckId===savedCurId;});
        setCurDeckId(found?savedCurId:list[0].deckId);
      }else{
        setShowTeamSelect("first");
      }
    })();
  },[userId]);

  /* ── sdState 자동 저장 ── */
  var sdTimerRef=React.useRef(null);
  useEffect(function(){
    if(!userId||store.loading)return;
    if(sdTimerRef.current)clearTimeout(sdTimerRef.current);
    sdTimerRef.current=setTimeout(function(){store.saveSdState(sdState);},800);
    return function(){if(sdTimerRef.current)clearTimeout(sdTimerRef.current);};
  },[sdState,userId,store.loading]);

  /* ── Supabase auth 리스너 ── */
  useEffect(function(){
    if(!supabase){setAuthChecked(true);return;}
    var handleAuth = async function(session) {
      if(session && session.user) {
        var profile = await getProfile(session.user.id);
        setUser(session.user.user_metadata.name || session.user.email || "User");
        setAuthType("google");
        setAdmin(profile ? profile.is_admin : false);
        setUserId(session.user.id);
        setLi(true);
      }
      setAuthChecked(true);
    };
    getSession().then(function(session){handleAuth(session);});
    var sub = supabase.auth.onAuthStateChange(function(event, session){
      if(event==="SIGNED_IN" && session){handleAuth(session);}
      if(event==="SIGNED_OUT"){setLi(false);setUser("");setAdmin(false);}
    });
    return function(){if(sub && sub.data && sub.data.subscription){sub.data.subscription.unsubscribe();}};
  },[]);

  /* ── 팀 선택 → 덱 생성 → 메인페이지 이동 ── */
  var handleSelectTeam=async function(teamName){
    var newId="dk_"+Date.now();
    var newDeck={deckId:newId,teamName:teamName};
    var newList=decks.concat([newDeck]);
    /* 먼저 화면 전환 (await 전에 처리해야 중간 재렌더 없이 즉시 이동) */
    setDecks(newList);
    setCurDeckId(newId);
    setTab("lineup");
    setShowTeamSelect(false);
    /* 이후 비동기 저장 */
    await saveDecks(newList,newId);
  };

  /* ── 덱 삭제 ── */
  var handleDeleteDeck=async function(deckId){
    var newList=decks.filter(function(d){return d.deckId!==deckId;});
    if(newList.length===0){
      /* 마지막 덱 삭제 → 팀 선택 화면으로 */
      setDecks([]);setCurDeckId(null);
      await sSet("deck-list",[]);await sSet("deck-current",null);
      setShowTeamSelect("first");
      return;
    }
    var nextId=(curDeckId===deckId)?newList[0].deckId:curDeckId;
    setDecks(newList);
    setCurDeckId(nextId);
    await saveDecks(newList,nextId);
  };
  var handleSwitchDeck=async function(deckId){
    if(deckId===curDeckId)return;
    setCurDeckId(deckId);
    await saveDecks(decks,deckId);
  };

  /* ── 로그아웃 ── */
  var lo=function(){
    if(supabase){signOut();}
    setLi(false);setUser("");setAuthType("");setTab("lineup");setAdmin(false);setUserId(null);
    setDecks([]);setCurDeckId(null);setShowTeamSelect(false);setSdState({liveSetPo:0});
  };

  var CSS=(<style>{"\
    @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');\
    :root{--bg:#0d1117;--side:#0a0e14;--card:rgba(22,27,38,0.8);--inner:rgba(255,255,255,0.03);--bd:rgba(255,255,255,0.06);--re:rgba(255,255,255,0.015);--bar:rgba(255,255,255,0.06);--ta:rgba(255,213,79,0.06);--t1:#e6edf3;--t2:#8b949e;--td:rgba(255,255,255,0.35);--acc:#FFD54F;--acp:#CE93D8;--h:'Oswald',sans-serif;--m:'JetBrains Mono',monospace;}\
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}html{-webkit-text-size-adjust:100%;}body{margin:0;font-family:'Noto Sans KR',sans-serif;background:var(--bg);overflow-x:hidden;-webkit-font-smoothing:antialiased;}\
    ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px;}\
    select{-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b949e' d='M6 8L1 3h10z'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 8px center;padding-right:24px;}\
    input[type=number]{-moz-appearance:textfield;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}\
  "}</style>);

  if(!authChecked)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1117",color:"#e6edf3"}}><div>{"⚾ 인증 확인중..."}</div>{CSS}</div>);
  if(!li)return(<React.Fragment><LoginPage onLogin={function(u,type,adm){setUser(u);setAuthType(type||"dev");setAdmin(adm||false);if(!userId)setUserId("guest_"+Date.now());setLi(true);}}/>{CSS}</React.Fragment>);

  /* ── 팀 선택 화면 ── */
  if(showTeamSelect){
    var isFirst=showTeamSelect==="first";
    return(
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)",padding:20}}>
        <div style={{background:"var(--card)",borderRadius:16,border:"1px solid var(--bd)",padding:mob?24:40,maxWidth:420,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>{"⚾"}</div>
          <h2 style={{margin:"0 0 6px",fontSize:22,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--acc)"}}>{isFirst?"팀 선택":"덱 추가"}</h2>
          <p style={{margin:"0 0 6px",fontSize:12,color:"var(--td)"}}>{isFirst?"덱 매니저에서 사용할 팀을 선택하세요":"추가할 팀을 선택하세요"}</p>
          <p style={{margin:"0 0 18px",fontSize:10,color:"var(--td)"}}>{isFirst?"팀 선택은 덱 저장 이름입니다. 선수 팀 정보와는 무관합니다":decks.length+"/5 덱 사용 중"}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {KBO_TEAMS.map(function(t){return(
              <button key={t} onClick={function(){handleSelectTeam(t);}}
                style={{padding:"14px 0",fontSize:16,fontWeight:800,fontFamily:"var(--h)",letterSpacing:2,background:"rgba(255,255,255,0.03)",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t1)",cursor:"pointer"}}
                onMouseEnter={function(e){e.currentTarget.style.background="rgba(255,213,79,0.12)";e.currentTarget.style.borderColor="rgba(255,213,79,0.3)";e.currentTarget.style.color="#FFD54F";}}
                onMouseLeave={function(e){e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.06)";e.currentTarget.style.color="var(--t1)";}}>
                {t}
              </button>
            );})}
          </div>
          {!isFirst&&(<button onClick={function(){setShowTeamSelect(false);}} style={{marginTop:14,padding:"8px 20px",fontSize:11,background:"transparent",border:"1px solid var(--bd)",borderRadius:8,color:"var(--td)",cursor:"pointer"}}>{"취소"}</button>)}
        </div>
        {CSS}
      </div>
    );
  }

  if(store.loading||!curDeckId)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d1117",color:"#e6edf3"}}><div>{"⚾ 로딩중..."}</div>{CSS}</div>);

  var pg=null;
  if(tab==="lineup")pg=(<LineupPage mobile={mob} tablet={tbl} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} skills={store.skills} decks={decks} curDeckId={curDeckId} onSwitchDeck={handleSwitchDeck} onAddDeck={function(){setShowTeamSelect("add");}} onDeleteDeck={handleDeleteDeck} userId={userId}/>);
  else if(tab==="myplayers")pg=(<MyPlayersPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} skills={store.skills} userId={userId}/>);
  else if(tab==="postrain")pg=(<PosTrainPage mobile={mob} sdState={sdState} setSdState={setSdState}/>);
  else if(tab==="locker")pg=(<LockerRoomPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} saveSdState={store.saveSdState} skills={store.skills} saveSkills={store.saveSkills} isAdmin={isAdmin}/>);
  else if(tab==="db"&&isAdmin)pg=(<PlayerDBPage mobile={mob} players={store.players} savePlayers={store.savePlayers}/>);
  else if(tab==="skills"&&isAdmin)pg=(<SkillManagePage mobile={mob} skills={store.skills} saveSkills={store.saveSkills}/>);
  else if(tab==="enhance"&&isAdmin)pg=(<EnhancePage mobile={mob}/>);
  else if(tab==="datacenter")pg=(<DataCenterPage mobile={mob} skills={store.skills} players={store.players} lineupMap={store.lineupMap}/>);
  else if(tab==="clublounge")pg=(<ClubLoungePage mobile={mob}/>);
  else pg=(<DataCenterPage mobile={mob} skills={store.skills} players={store.players} lineupMap={store.lineupMap}/>);

  return(
    <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)",color:"var(--t1)"}}>
      <Nav tab={tab} setTab={setTab} user={user} authType={authType} logout={lo} mobile={mob} tablet={tbl} isAdmin={isAdmin}
        decks={decks} curDeckId={curDeckId}
        onSwitchDeck={handleSwitchDeck}
        onAddDeck={function(){setShowTeamSelect("add");}}
        onDeleteDeck={handleDeleteDeck}/>
      <div style={{flex:1,overflowY:"auto",minHeight:"100vh",paddingTop:mob?44:(tbl?50:0)}}>{pg}</div>
      {CSS}
    </div>
  );
}
