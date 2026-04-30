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
var loadGlobalPotmList = _SB.loadGlobalPotmList || function(){ return Promise.resolve([]); };
var saveGlobalPotmList = _SB.saveGlobalPotmList || function(){ return Promise.resolve(false); };

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
  var _pt=useState([]);var potmList=_pt[0];var setPotmListState=_pt[1];
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
          /* POTM 전역 명단 로드 - 모든 유저에게 동일 적용 */
          var gpotm=await loadGlobalPotmList();
          GLOBAL_POTM_LIST = Array.isArray(gpotm) ? gpotm : [];
          setPotmListState(GLOBAL_POTM_LIST);
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
          /* POTM: 로컬 모드에서는 localStorage에 저장 */
          var lpotm=await sGet("global-potm-list");
          GLOBAL_POTM_LIST = Array.isArray(lpotm) ? lpotm : [];
          setPotmListState(GLOBAL_POTM_LIST);
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

  var savePotmList=useCallback(async function(arr){
    var list = Array.isArray(arr) ? arr : [];
    GLOBAL_POTM_LIST = list;
    setPotmListState(list);
    if(supabase){ await saveGlobalPotmList(list); }
    else { await sSet("global-potm-list", list); }
  },[]);

  return{players:players,lineupMap:lineupMap,skills:skills,potmList:potmList,loading:loading,savePlayers:saveP,saveLineupMap:saveLM,saveSkills:saveSK,saveSdState:saveSdState,savePotmList:savePotmList,allDataRef:allDataRef};
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
function Badge(p){var c={"골든글러브":"#D4AF37","시그니처":"#C0392B","국가대표":"#2E86C1","임팩트":"#7D3C98","라이브":"#E67E22"}[p.type]||"#555";return(<span style={{display:"inline-block",padding:"2px 7px",borderRadius:4,fontSize:12,fontWeight:700,background:c,color:p.type==="골든글러브"?"#1a1100":"#fff",whiteSpace:"nowrap"}}>{p.type}</span>);}
function GS(p){return(<div style={{fontSize:p.size||16,fontWeight:900,fontFamily:"var(--h)",background:p.grad||"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:"transparent"}}>{p.val}</div>);}
function SH(p){return(<div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"linear-gradient(90deg,"+p.color+"15,transparent)",borderLeft:"3px solid "+p.color,borderBottom:"1px solid var(--bd)"}}><span style={{fontSize:16}}>{p.icon}</span><span style={{fontSize:15,fontWeight:800,color:"var(--t1)",fontFamily:"var(--h)",letterSpacing:1}}>{p.title}</span><span style={{fontSize:12,color:"var(--td)",fontFamily:"var(--m)"}}>{"("+p.count+")"}</span></div>);}

function Bar(p){return(<div style={{width:"100%",height:6,background:"var(--bar)",borderRadius:3,overflow:"hidden"}}><div style={{width:Math.min((p.value/200)*100,100)+"%",height:"100%",borderRadius:3,background:"linear-gradient(90deg,"+p.color+"77,"+p.color+")",transition:"width 0.5s ease"}}/></div>);}

function SkBadge(p){var c={10:"#FF4081",9:"#E040FB",8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[p.lv]||"#aaa";return(
  <div style={{display:"inline-flex",alignItems:"center",gap:3,background:"var(--inner)",borderRadius:3,padding:"2px 5px",border:"1px solid "+c+"33",fontSize:12,lineHeight:1.3}}>
    <span style={{background:c,color:"#000",borderRadius:2,padding:"0 3px",fontWeight:800,fontSize:11,fontFamily:"var(--m)",flexShrink:0}}>{"Lv."+p.lv}</span>
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
    return { padding: "4px 8px", fontSize: 12, fontWeight: active ? 700 : 400, background: active ? "var(--ta)" : "transparent", border: active ? "1px solid var(--acc)" : "1px solid var(--bd)", borderRadius: 4, color: active ? "var(--acc)" : "var(--td)", cursor: "pointer" };
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--bd)", maxWidth: 440, width: "100%", maxHeight: "85vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ padding: "14px 18px 10px", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{slot + " 선수 선택"}</div>
              <div style={{ fontSize: 12, color: "var(--td)", marginTop: 2 }}>{isBatSlot ? (slot === "DH" ? "모든 타자" : slot + " 포지션") : (isBench ? "후보 (타자)" : pitRole + " 투수")}{" · " + total + "명"}</div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
          </div>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, padding: "6px 10px", marginBottom: 8 }}>
            <span style={{ fontSize: 16, opacity: 0.4 }}>{"🔍"}</span>
            <input type="text" value={query} onChange={function(e) { setQuery(e.target.value); setShowLimit(30); }} placeholder="이름, 카드, 팀 검색..." style={{ flex: 1, background: "transparent", border: "none", color: "var(--t1)", fontSize: 14, outline: "none" }} />
            {query && (<button onClick={function() { setQuery(""); }} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 14 }}>{"✕"}</button>)}
          </div>
          {/* Team filter */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
            <button onClick={function(){setTeamF("");setShowLimit(30);}} style={filterBtnStyle(!teamF)}>{"전체"}</button>
            {teams.map(function(t) { return (<button key={t} onClick={function(){setTeamF(teamF===t?"":t);setShowLimit(30);}} style={filterBtnStyle(teamF===t)}>{t}</button>); })}
          </div>
          {/* Sort */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{"정렬"}</span>
            {sortOpts.map(function(s) { return (<button key={s} onClick={function(){setSortBy(s);}} style={filterBtnStyle(sortBy===s)}>{s + "순"}</button>); })}
            {teamF && (<span style={{ marginLeft: "auto", fontSize: 11, color: "var(--acc)" }}>{"골든글러브는 항상 표시"}</span>)}
          </div>
        </div>
        <div style={{ overflowY: "auto", maxHeight: "55vh" }}>
          {/* 비우기 */}
          <div onClick={function() { onSelect(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
            <div style={{ width: 36, height: 48, borderRadius: 4, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, opacity: 0.3 }}>{"✕"}</span>
            </div>
            <span style={{ fontSize: 14, color: "var(--td)" }}>{"비우기"}</span>
          </div>
          {visible.length === 0 ? (
            <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--td)", fontSize: 14 }}>{"해당 조건의 선수가 없습니다."}</div>
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
                <div style={{ fontSize: 12, color: "var(--td)", fontFamily: "var(--m)", width: 18, textAlign: "center", flexShrink: 0 }}>{idx + 1}</div>
                <PlayerCard player={pl} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Badge type={pl.cardType} />
                    <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span>
                    {pl.year && (<span style={{ fontSize: 11, color: "var(--td)" }}>{pl.year}</span>)}
                    {pl.cardType === "임팩트" && pl.impactType && (<span style={{ fontSize: 11, color: "#a78bfa", marginLeft: 2 }}>{'(' + pl.impactType + ')'}</span>)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--td)", marginTop: 2 }}>{statLine}</div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div onClick={function(){setShowLimit(showLimit+30);}} style={{ padding: "12px 18px", textAlign: "center", cursor: "pointer", borderBottom: "1px solid var(--bd)" }}>
              <span style={{ fontSize: 14, color: "var(--acc)", fontWeight: 700 }}>{"▼ 더보기 (" + (total - showLimit) + "명 남음)"}</span>
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
      <label style={{display:"block",fontSize:12,color:"var(--td)",marginBottom:3,fontWeight:600}}>{p.label}</label>
      {p.type==="select"?(
        <select value={p.value} onChange={function(e){p.onChange(e.target.value);}} style={{width:"100%",padding:"8px 10px",fontSize:15,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",outline:"none",boxSizing:"border-box"}}>
          {p.options.map(function(o){return(<option key={o} value={o}>{o}</option>);})}
        </select>
      ):(
        <input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.ph||""}
          style={{width:"100%",padding:"8px 10px",fontSize:15,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",outline:"none",boxSizing:"border-box"}} />
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

  /* 이미지 압축: Canvas로 리사이즈 + JPEG 변환 */
  var compressImage=function(file, maxW, maxH, quality){
    return new Promise(function(resolve, rej){
      var reader=new FileReader();
      reader.onload=function(e){
        var img=new Image();
        img.onload=function(){
          var w=img.width; var h=img.height;
          /* 비율 유지하며 축소 (이미 작으면 그대로) */
          if(w>maxW||h>maxH){
            var ratio=Math.min(maxW/w, maxH/h);
            w=Math.round(w*ratio); h=Math.round(h*ratio);
          }
          var canvas=document.createElement("canvas");
          canvas.width=w; canvas.height=h;
          var ctx=canvas.getContext("2d");
          ctx.drawImage(img,0,0,w,h);
          canvas.toBlob(function(blob){
            if(blob){resolve(blob);}else{rej(new Error('압축 실패'));}
          },"image/jpeg",quality);
        };
        img.onerror=function(){ rej(new Error('이미지 로드 실패')); };
        img.src=e.target.result;
      };
      reader.onerror=function(){ rej(new Error('파일 읽기 실패')); };
      reader.readAsDataURL(file);
    });
  };

  /* 사진 업로드 핸들러 */
  var handlePhotoUpload=async function(files){
    if(!files||!files.length)return;
    setUploading(true);
    var ok=0;var fail=0;
    for(var i=0;i<files.length;i++){
      var file=files[i];
      var baseName=file.name.replace(/\.[^.]+$/,"");
      /* 최대 600×900px, JPEG 80% 품질로 압축 후 업로드 */
      var compressed=await compressImage(file,600,900,0.80);
      var fileName=baseName+".jpg";
      var url=await uploadPlayerPhoto(compressed,fileName);
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
      <p style={{fontSize:12,color:"var(--td)",margin:"0 0 12px"}}>{"관리자 전용 - 선수 기본 데이터를 등록/수정합니다"}</p>

      {/* 탭 선택 */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {["선수","사진 관리"].map(function(t){var a=t===dbTab;return(
          <button key={t} onClick={function(){setDbTab(t);}} style={{padding:"8px 20px",borderRadius:8,fontSize:15,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",color:a?"var(--acc)":"var(--t2)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{t}</button>
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
            <div style={{fontSize:15,fontWeight:700,color:"var(--t1)",marginBottom:4}}>{"사진 파일을 드래그하거나 클릭해서 업로드"}</div>
            <div style={{fontSize:13,color:"var(--td)",marginBottom:12}}>{"파일명: 이승엽1.jpg, 이승엽2.jpg 형식 | 200×280px 권장 | JPG/PNG/WebP"}</div>
            <label style={{display:"inline-block",padding:"8px 20px",background:"var(--ta)",border:"1px solid var(--acc)",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:700,color:"var(--acc)"}}>
              {"파일 선택 (여러 장 가능)"}
              <input type="file" multiple accept="image/*" style={{display:"none"}} onChange={function(e){handlePhotoUpload(e.target.files);e.target.value="";}} />
            </label>
            {uploading && <div style={{marginTop:10,fontSize:13,color:"var(--acc)"}}>{"업로드 중..."}</div>}
            {uploadMsg && <div style={{marginTop:10,fontSize:13,color:"#66BB6A",fontWeight:700}}>{uploadMsg}</div>}
          </div>

          {/* 등록된 사진 목록 */}
          <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <span style={{fontSize:15,fontWeight:800,color:"var(--t1)"}}>{"등록된 사진 ("+allPhotos.length+"장)"}</span>
              <button onClick={loadPhotos} style={{padding:"4px 10px",fontSize:13,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t2)",cursor:"pointer"}}>{"새로고침"}</button>
            </div>
            {photoLoading && <div style={{fontSize:13,color:"var(--td)",padding:20,textAlign:"center"}}>{"로딩 중..."}</div>}
            {!photoLoading && Object.keys(photoGroups).length===0 && (
              <div style={{fontSize:13,color:"var(--td)",padding:20,textAlign:"center"}}>{"등록된 사진이 없습니다"}</div>
            )}
            {!photoLoading && Object.keys(photoGroups).sort().map(function(name){
              var photos=photoGroups[name];
              var curPos = posMap[name]!==undefined ? posMap[name] : 20;
              return(
                <div key={name} style={{marginBottom:16}}>
                  <div style={{fontSize:14,fontWeight:800,color:"var(--t1)",marginBottom:8,paddingBottom:4,borderBottom:"1px solid var(--bd)"}}>{name+" ("+photos.length+"장)"}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:8}}>
                    {photos.map(function(ph){return(
                      <div key={ph.name} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{position:"relative"}}>
                          <img src={ph.url} alt={ph.name} style={{width:60,height:84,objectFit:"cover",objectPosition:"center "+curPos+"%",borderRadius:6,border:"1px solid var(--bd)"}} />
                          <button onClick={function(){handlePhotoDelete(ph);}}
                            style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#EF5350",border:"none",cursor:"pointer",fontSize:12,color:"#fff",fontWeight:900,lineHeight:"18px",textAlign:"center",padding:0}}>{"×"}</button>
                        </div>
                        <span style={{fontSize:11,color:"var(--td)",maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ph.name}</span>
                      </div>
                    );})}
                  </div>
                  {/* 위치 슬라이더 */}
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:12,color:"var(--td)",flexShrink:0,width:28}}>{"위치"}</span>
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
                    <span style={{fontSize:12,color:"var(--acc)",fontFamily:"var(--m)",width:32,flexShrink:0,textAlign:"right"}}>{curPos+"%"}</span>
                    {posSaving&&<span style={{fontSize:11,color:"var(--td)"}}>{"저장중"}</span>}
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
          <button key={ct} onClick={function(){setAt(ct);setEditing(null);setForm(null);}} style={{padding:"7px 14px",borderRadius:6,fontSize:14,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",color:a?"var(--acc)":"var(--t2)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{ct}</button>
        );})}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={function(){newP("타자");}} style={{padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:700,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",color:"#1a1100",border:"none",cursor:"pointer"}}>{"+ 타자"}</button>
        <button onClick={function(){newP("투수");}} style={{padding:"8px 16px",borderRadius:6,fontSize:14,fontWeight:700,background:"linear-gradient(135deg,#CE93D8,#7B1FA2)",color:"#fff",border:"none",cursor:"pointer"}}>{"+ 투수"}</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:editing?(mob?"1fr":"1fr 340px"):"1fr",gap:14}}>
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden"}}>
          <SH title={at+" ("+filtered.length+"명)"} icon="📋" count={filtered.length} color="#FFD54F" />
          {filtered.length===0?(<div style={{padding:24,textAlign:"center",color:"var(--td)",fontSize:14}}>{"등록된 선수가 없습니다"}</div>):
          filtered.map(function(pl){var isBat=pl.role==="타자";var isA=editing===pl.id;return(
            <div key={pl.id} onClick={function(){editP(pl);}} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",background:isA?"var(--ta)":"transparent",borderBottom:"1px solid var(--bd)",cursor:"pointer",borderLeft:isA?"3px solid var(--acc)":"3px solid transparent"}}>
              <div style={{width:36,height:48,borderRadius:4,background:"var(--inner)",border:"1px solid var(--bd)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:16,opacity:0.4}}>{"⚾"}</span><span style={{fontSize:7,color:"var(--td)",fontWeight:700}}>{pl.subPosition}</span></div>
              <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4}}><Badge type={pl.cardType}/><span style={{fontWeight:700,color:"var(--t1)",fontSize:15}}>{pl.name}</span></div><div style={{fontSize:11,color:"var(--td)",marginTop:2}}>{isBat?(pl.hand+"타 · 파"+pl.power+" 정"+pl.accuracy+" 선"+pl.eye):(pl.hand+"투 · 변"+pl.change+" 구"+pl.stuff)}</div></div>
              <div style={{fontSize:12,color:"var(--td)"}}>{pl.year}</div>
            </div>
          );})}
        </div>

        {editing&&form&&(
          <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:16,alignSelf:"flex-start"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <span style={{fontSize:16,fontWeight:800,color:"var(--t1)",fontFamily:"var(--h)"}}>{editing==="new"?"새 선수":"수정"}</span>
              <button onClick={function(){setEditing(null);setForm(null);}} style={{background:"none",border:"none",color:"var(--td)",cursor:"pointer",fontSize:16}}>{"✕"}</button>
            </div>
            <Inp label="이름" value={form.name} onChange={function(v){uf("name",v);}} ph="구자욱24" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <Inp label="연도" value={form.year} onChange={function(v){uf("year",v);}} ph="2024" />
              <Inp label="팀" type="select" value={form.team||""} onChange={function(v){uf("team",v);}} options={["","기아","키움","삼성","LG","KT","한화","SSG","롯데","NC","두산"]} />
              <Inp label="손잡이" type="select" value={form.hand} onChange={function(v){uf("hand",v);}} options={form.role==="투수"?["우","좌"]:["우","좌","양"]} />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {CARD_STARS_SELECTABLE[form.cardType]?(<Inp label={form.cardType==="골든글러브"?"별(4~5)":"별(1~5)"} type="select" value={String(form.stars||(CARD_STARS[form.cardType]||5))} onChange={function(v){uf("stars",parseInt(v));}} options={form.cardType==="골든글러브"?["4","5"]:["1","2","3","4","5"]} />):(<div><div style={{fontSize:12,color:"var(--td)",marginBottom:4}}>{"별"}</div><span style={{fontSize:16,color:"var(--acc)"}}>{"★"+(CARD_STARS[form.cardType]||5)}</span></div>)}
              {form.role==="타자"?(<Inp label="포지션" type="select" value={form.subPosition} onChange={function(v){uf("subPosition",v);}} options={BAT_POS} />):(<Inp label="역할" type="select" value={form.position||"선발"} onChange={function(v){uf("position",v);uf("subPosition",(PIT_POS_MAP[v]||["SP1"])[0]);}} options={["선발","중계","마무리"]} />)}
            </div>
            {form.role==="타자"&&null}
            {form.cardType==="임팩트"&&(<Inp label="종류" value={form.impactType||""} onChange={function(v){uf("impactType",v);}} ph="좌완에이스,안방마님..." />)}
            {form.cardType==="라이브"&&(<Inp label="세트덱스코어" type="number" value={form.setScore||0} onChange={function(v){uf("setScore",parseInt(v)||0);}} />)}
            {form.cardType==="라이브"&&(<Inp label="라이브종류" type="select" value={form.liveType||""} onChange={function(v){uf("liveType",v);}} options={["","V1","V2","V3"]} />)}
            <div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <Inp label="사진" value={form.photoUrl||""} onChange={function(v){uf("photoUrl",v);}} ph="URL 또는 파일 선택" />
                  <label style={{cursor:"pointer",padding:"4px 8px",background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,fontSize:12,color:"var(--t2)",marginTop:14,whiteSpace:"nowrap"}}>
                    {"📁 파일"}
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){uf("photoUrl",r.result);};r.readAsDataURL(f);}} />
                  </label>
                </div>
                {form.photoUrl&&(<img src={form.photoUrl} alt="" style={{width:60,height:80,objectFit:"cover",borderRadius:4,marginTop:4,border:"1px solid var(--bd)"}} />)}
              </div>
            <div style={{fontSize:13,fontWeight:700,color:"var(--t2)",marginTop:8,marginBottom:6}}>{"기본 능력치"}</div>
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
              <button onClick={saveF} style={{flex:1,padding:"10px 0",borderRadius:6,fontSize:15,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",color:"#1a1100",border:"none",cursor:"pointer"}}>{"저장"}</button>
              {editing!=="new"&&(<button onClick={function(){delP(form.id);}} style={{padding:"10px 16px",borderRadius:6,fontSize:14,background:"rgba(239,83,80,0.1)",color:"#EF5350",border:"1px solid rgba(239,83,80,0.3)",cursor:"pointer"}}>{"삭제"}</button>)}
            </div>
          </div>
        )}
      </div>

      {/* 도감 엑셀 관리 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>{"📊"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--acc)", fontFamily: "var(--h)" }}>{"도감 엑셀 관리"}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 140, padding: "12px", background: "linear-gradient(135deg,rgba(255,213,79,0.08),rgba(255,213,79,0.02))", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left", display: "block" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--acc)" }}>{"📊 엑셀 가져오기"}</div>
            <div style={{ fontSize: 11, color: "var(--td)", marginTop: 4 }}>{"양식 업로드 → 도감 반영"}</div>
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={function(e) {
              var f2 = e.target.files[0]; if (!f2) return;
              var rd = new FileReader(); rd.onload = function() {
                try {
                  var XL = window.XLSX; if (!XL) { alert("잠시 후 다시 시도하세요."); return; }
                  var wb2 = XL.read(rd.result, { type: "array" });
                  var added2 = 0; var updated2 = 0; var np = SEED_PLAYERS.slice();
                  var cm = {"골든글러브(타자)":"골든글러브","골든글러브(투수)":"골든글러브","시그니처(타자)":"시그니처","시그니처(투수)":"시그니처","국가대표(타자)":"국가대표","국가대표(투수)":"국가대표","임팩트(타자)":"임팩트","임팩트(투수)":"임팩트","라이브(타자)":"라이브","라이브(투수)":"라이브","시즌(타자)":"시즌","시즌(투수)":"시즌","올스타(타자)":"올스타","올스타(투수)":"올스타"};
                  var sm = {"골든글러브":5,"시그니처":5,"국가대표":5,"임팩트":4};

                  /* 라이브 동기화: 엑셀에 라이브(타자) 또는 라이브(투수) 시트가 있을 때만 활성화
                     없으면 부분 업로드(다른 카드만 갱신)로 간주하여 삭제 로직 건너뜀 */
                  var hasLiveBat = wb2.SheetNames.indexOf("라이브(타자)") >= 0;
                  var hasLivePit = wb2.SheetNames.indexOf("라이브(투수)") >= 0;
                  /* A3 키: 이름 + 팀 + 라이브종류 (역할별로 분리해서 양 시트 한쪽만 있어도 안전) */
                  var liveKeyOf = function(p) {
                    return (p.role||"") + "|" + (p.name||"") + "|" + (p.team||"") + "|" + (p.liveType||"");
                  };
                  /* 엑셀의 라이브 시트에 등장한 카드 키 모음 */
                  var excelLiveKeys = {};
                  if (hasLiveBat) {
                    XL.utils.sheet_to_json(wb2.Sheets["라이브(타자)"],{defval:""}).forEach(function(r){
                      var nm=String(r["이름"]||"").trim(); if(!nm)return;
                      excelLiveKeys["타자|"+nm+"|"+(r["팀"]||"")+"|"+(r["라이브종류"]||"")] = true;
                    });
                  }
                  if (hasLivePit) {
                    XL.utils.sheet_to_json(wb2.Sheets["라이브(투수)"],{defval:""}).forEach(function(r){
                      var nm=String(r["이름"]||"").trim(); if(!nm)return;
                      excelLiveKeys["투수|"+nm+"|"+(r["팀"]||"")+"|"+(r["라이브종류"]||"")] = true;
                    });
                  }

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

                  /* 라이브 동기화 - 엑셀에 없는 라이브 카드 식별 (해당 역할 시트가 있을 때만) */
                  var liveToDelete = [];
                  if (hasLiveBat || hasLivePit) {
                    for (var iL = np.length - 1; iL >= 0; iL--) {
                      var spL = np[iL];
                      if (spL.cardType !== "라이브") continue;
                      /* 해당 역할의 시트가 엑셀에 없으면 그 역할은 건드리지 않음 (부분 업로드 안전) */
                      if (spL.role === "타자" && !hasLiveBat) continue;
                      if (spL.role === "투수" && !hasLivePit) continue;
                      var keyL = liveKeyOf(spL);
                      if (!excelLiveKeys[keyL]) {
                        liveToDelete.push(spL);
                        np.splice(iL, 1);
                      }
                    }
                  }

                  /* 삭제 대상이 있으면 confirm 후에만 진행 */
                  var proceed = function() {
                    SEED_PLAYERS.length=0;np.forEach(function(pp){SEED_PLAYERS.push(pp);});
                    /* 배치 저장 + 삭제 처리 */
                    (async function() {
                      var batchSize = 100;
                      for (var i = 0; i < np.length; i += batchSize) {
                        var batch = np.slice(i, i + batchSize);
                        await saveGlobalPlayers(batch);
                      }
                      /* 삭제는 한 건씩 (deleteGlobalPlayer는 단건 호출 함수) */
                      for (var j = 0; j < liveToDelete.length; j++) {
                        await deleteGlobalPlayer(liveToDelete[j].id);
                      }
                      var msg = "완료! 추가:"+added2+"명 업데이트:"+updated2+"명";
                      if (liveToDelete.length > 0) msg += " 라이브삭제:"+liveToDelete.length+"명";
                      alert(msg);
                    })();
                  };

                  if (liveToDelete.length > 0) {
                    var preview = liveToDelete.slice(0, 10).map(function(p){
                      return "  • "+(p.name||"?")+" ("+(p.team||"?")+", "+(p.liveType||"?")+", "+(p.role||"?")+")";
                    }).join("\n");
                    var more = liveToDelete.length > 10 ? "\n  ... 외 "+(liveToDelete.length-10)+"명" : "";
                    var confirmMsg = "⚠️ 라이브 카드 동기화\n\n엑셀에 없는 라이브 카드 "+liveToDelete.length+"명이 도감에서 삭제됩니다.\n해당 카드를 보유한 유저의 라인업/내선수에서 빈 슬롯으로 표시될 수 있습니다.\n\n삭제 대상:\n"+preview+more+"\n\n계속 진행하시겠습니까?";
                    if (confirm(confirmMsg)) {
                      proceed();
                    } else {
                      /* 취소 시 - 삭제했던 항목을 np에 복구하지 않고 그냥 종료
                         (이미 splice 했으므로 SEED_PLAYERS는 갱신하지 않고 함수 종료) */
                      alert("업로드가 취소되었습니다.");
                    }
                  } else {
                    proceed();
                  }
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--acp)" }}>{"📋 엑셀 내보내기"}</div>
            <div style={{ fontSize: 11, color: "var(--td)", marginTop: 4 }}>{"현재 도감 → 엑셀 다운로드"}</div>
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

/* 전역 POTM 명단 — Supabase의 관리자 계정에 저장되어 모든 유저에게 동일 적용
   런타임에 loadGlobalPotmList()로 로드되어 이 변수에 채워진다.
   sdState.potmList(레거시, 덱별 저장)가 아닌 이 전역값을 단일 진실원천으로 사용. */
var GLOBAL_POTM_LIST = [];

/* POTM 능력치 보너스
   - 라이브: 팀 무관 능력치 보너스 (팀 불일치 시 절반)
   - 올스타 별5: 팀 일치 6 / 불일치 3 (기존 룰 유지)
   - 그 외 (스페셜 POTM): 내 덱 팀 == 선수 원소속팀일 때만 능력치 보너스, 불일치 시 0 */
function getPotmBonus(pl, sdState) {
  var potmList = GLOBAL_POTM_LIST;
  if (!potmList.length || !pl) return 0;
  var isPotm = false;
  for (var i = 0; i < potmList.length; i++) {
    if (potmList[i].name === (pl.name||"") && potmList[i].team === (pl.team||"")) { isPotm = true; break; }
  }
  if (!isPotm) return 0;
  var ct = pl.cardType;
  var stars = pl.stars || 5;
  var teamName = sdState.teamName || "";
  var teamMatch = !teamName || !pl.team || pl.team === teamName;
  var isLive = ct === "라이브";
  var isOlstar = ct === "올스타";

  /* 라이브: 팀 무관 능력치 보너스, 팀 불일치 시 절반 */
  if (isLive) {
    var b = stars >= 5 ? 6 : stars === 4 ? 12 : 16;
    return teamMatch ? b : Math.round(b * 0.5);
  }

  /* 올스타 별5: 기존 룰 유지 */
  if (isOlstar && stars === 5) { return teamMatch ? 6 : 3; }

  /* 그 외(스페셜 POTM): 팀 일치할 때만 능력치 보너스 */
  if (!teamMatch) return 0;
  return {"임팩트":2,"시그니처":2,"국가대표":2,"골든글러브":1}[ct] || 0;
}

var BPC = [{label:"1/1/4",w:1,l:1,r:4},{label:"1/2/3",w:1,l:2,r:3},{label:"1/3/2",w:1,l:3,r:2},{label:"2/1/3",w:2,l:1,r:3},{label:"2/2/2",w:2,l:2,r:2},{label:"2/3/1",w:2,l:3,r:1},{label:"3/1/2",w:3,l:1,r:2},{label:"3/2/1",w:3,l:2,r:1},{label:"3/3/0",w:3,l:3,r:0},{label:"2/4/0",w:2,l:4,r:0},{label:"1/4/1",w:1,l:4,r:1}];
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
  {w:[1.20],          l:[0.80,0.50,0.08,0.02],   r:[0.40]},
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
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t2)", letterSpacing: 0.5 }}>{"불펜 편성"}</span>
        <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <button onClick={function() { setIdx(idx <= 0 ? BPC.length - 1 : idx - 1); }} style={{ width: 28, height: 28, borderRadius: "6px 0 0 6px", background: "var(--inner)", border: "1px solid var(--bd)", borderRight: "none", color: "var(--t2)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{"◀"}</button>
          <button onClick={function() { setOpen(!open); }} style={{ width: 80, height: 28, background: "var(--inner)", border: "1px solid var(--bd)", borderLeft: "none", borderRight: "none", color: "var(--acc)", cursor: "pointer", fontSize: 15, fontWeight: 800, fontFamily: "var(--m)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{cfg.label}<span style={{ fontSize: 7, color: "var(--td)" }}>{open ? "▲" : "▼"}</span></button>
          <button onClick={function() { setIdx(idx >= BPC.length - 1 ? 0 : idx + 1); }} style={{ width: 28, height: 28, borderRadius: "0 6px 6px 0", background: "var(--inner)", border: "1px solid var(--bd)", borderLeft: "none", color: "var(--t2)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{"▶"}</button>
          {open && (
            <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 50, marginTop: 4, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 8, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.6)", width: 170 }}>
              {BPC.map(function(c, i) {
                var act = i === idx;
                return (<button key={c.label} onClick={function() { setIdx(i); setOpen(false); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "10px 14px", background: act ? "var(--ta)" : "transparent", border: "none", borderBottom: "1px solid var(--bd)", color: act ? "var(--acc)" : "var(--t2)", cursor: "pointer", fontSize: 14, fontFamily: "var(--m)", fontWeight: act ? 800 : 500, textAlign: "left" }}><span>{c.label}</span><span style={{ fontSize: 11, color: "var(--td)" }}>{"승" + c.w + " 패" + c.l + " 롱" + c.r}</span></button>);
              })}
            </div>
          )}
        </div>
        {cfg.w === 3 && (
          <button onClick={function() { setIsWinSplit(!isWinSplit); }} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700, background: isWinSplit ? "#1565C0" : "var(--inner)", color: isWinSplit ? "#fff" : "var(--t2)", border: "1px solid " + (isWinSplit ? "#1565C0" : "var(--bd)"), cursor: "pointer" }}>{"분업" + (isWinSplit ? " ON" : "")}</button>
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
              <div style={{ fontSize: 11, fontWeight: 700, color: col.color, letterSpacing: 1, marginBottom: 4, textAlign: "center" }}>{col.label + " (" + col.count + ")"}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                {col.slots.map(function(s) {
                  if (s.pl) {
                    return (<div key={s.slot} onClick={onSlotClick ? function() { onSlotClick(s.slot); } : undefined} style={{ cursor: onSlotClick ? "pointer" : "default" }}><PCard p={s.pl} /></div>);
                  }
                  return (<div key={s.slot} onClick={onSlotClick ? function() { onSlotClick(s.slot); } : undefined} style={{ width: 52, height: 72, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--re)" }}><span style={{ fontSize: 11, color: "var(--td)" }}>{s.slot}</span></div>);
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
   SKILL PICKER - 검색 가능한 스킬 선택 드롭다운
   라인업/내선수 페이지에서 200+ 스킬 중 검색하여 고르기 위함
   props: value, onChange, options(스킬명 배열), width, fontSize
   ================================================================ */
function SkillPicker(p) {
  var _o = useState(false); var open = _o[0]; var setOpen = _o[1];
  var _q = useState(""); var q = _q[0]; var setQ = _q[1];
  var width = p.width || 90;
  var fontSize = p.fontSize || 11;
  var label = p.value || "없음";
  /* 드롭다운 팝업 너비: 숫자면 max(width,220), 문자열(예 "100%")이면 220px 고정 */
  var popupWidth = (typeof width === "number") ? Math.max(width, 220) : 220;

  /* majorOptions가 주어지면 메이저/일반 그룹으로 나뉜 모드, 없으면 단일 리스트 모드 */
  var hasGroups = Array.isArray(p.majorOptions) && p.majorOptions.length > 0;
  var allOpts = p.options || [];
  var majorSet = hasGroups ? p.majorOptions.reduce(function(m,n){m[n]=1;return m;}, {}) : {};
  var minorOpts = hasGroups ? allOpts.filter(function(s){ return !majorSet[s]; }) : allOpts;
  var majorOpts = hasGroups ? p.majorOptions.filter(function(s){ return allOpts.indexOf(s) >= 0; }) : [];

  var matchQ = function(s) { return !q || s.toLowerCase().indexOf(q.toLowerCase()) >= 0; };
  var filteredMajor = majorOpts.filter(matchQ);
  var filteredMinor = minorOpts.filter(matchQ);
  var totalShown = filteredMajor.length + filteredMinor.length;

  var pick = function(name) { p.onChange(name); setOpen(false); setQ(""); };
  var openIt = function(e) { e.stopPropagation(); setOpen(!open); if (!open) setQ(""); };

  var renderRow = function(s, isMajor) {
    var isSel = s === p.value;
    return (
      <div key={(isMajor?"M:":"m:")+s} onClick={function(){ pick(s); }}
        onMouseEnter={function(e){ e.currentTarget.style.background = "rgba(255,213,79,0.08)"; }}
        onMouseLeave={function(e){ e.currentTarget.style.background = isSel ? "rgba(255,213,79,0.12)" : "transparent"; }}
        style={{ padding: "5px 10px", fontSize: 12, color: isSel ? "#FFD54F" : (isMajor ? "#CE93D8" : "#e2e8f0"), background: isSel ? "rgba(255,213,79,0.12)" : "transparent", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: isSel ? 700 : (isMajor ? 600 : 400) }}>
        {isMajor ? ("⭐ "+s) : s}
      </div>
    );
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button onClick={openIt}
        style={{ width: width, padding: "3px 6px", fontSize: fontSize, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: p.value ? "#e2e8f0" : "#94a3b8", textAlign: "left", cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", outline: "none", height: 22, boxSizing: "border-box" }}
        title={label}>
        {label}
      </button>
      {open && (
        <React.Fragment>
          <div onClick={function(){ setOpen(false); }}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, background: "transparent" }} />
          <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 100, marginTop: 2, background: "#0f172a", border: "1px solid #475569", borderRadius: 6, width: popupWidth, maxHeight: 320, display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
            <input autoFocus type="text" value={q}
              onChange={function(e){ setQ(e.target.value); }}
              onClick={function(e){ e.stopPropagation(); }}
              placeholder="스킬 검색..."
              style={{ padding: "7px 10px", fontSize: 12, background: "#1e293b", border: "none", borderBottom: "1px solid #334155", color: "#e2e8f0", outline: "none", borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
            <div style={{ overflowY: "auto", flex: 1 }}>
              <div onClick={function(){ pick(""); }}
                style={{ padding: "6px 10px", fontSize: 12, color: "#94a3b8", cursor: "pointer", borderBottom: "1px solid #1e293b", fontStyle: "italic" }}>
                없음
              </div>
              {totalShown === 0 ? (
                <div style={{ padding: "12px", fontSize: 11, color: "#64748b", textAlign: "center" }}>{"검색 결과 없음"}</div>
              ) : hasGroups ? (
                <React.Fragment>
                  {filteredMajor.length > 0 && (
                    <React.Fragment>
                      <div style={{ padding: "4px 10px", fontSize: 10, color: "#CE93D8", background: "#1a1430", fontWeight: 700, letterSpacing: 0.5 }}>{"메이저 스킬"}</div>
                      {filteredMajor.map(function(s){ return renderRow(s, true); })}
                    </React.Fragment>
                  )}
                  {filteredMinor.length > 0 && (
                    <React.Fragment>
                      <div style={{ padding: "4px 10px", fontSize: 10, color: "#94a3b8", background: "#1a2030", fontWeight: 700, letterSpacing: 0.5 }}>{"일반 스킬"}</div>
                      {filteredMinor.map(function(s){ return renderRow(s, false); })}
                    </React.Fragment>
                  )}
                </React.Fragment>
              ) : (
                filteredMinor.map(function(s){ return renderRow(s, false); })
              )}
            </div>
          </div>
        </React.Fragment>
      )}
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
      flex: 1, padding: "6px 4px", fontSize: 12, fontWeight: selected ? 700 : 400,
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
          <span style={{ fontSize: 13, color: active ? "#4CAF50" : "var(--td)", fontWeight: 700, fontFamily: "var(--m)" }}>{r.sp}</span>
          <span style={{ fontSize: 12, color: active ? "var(--t1)" : "var(--td)" }}>{r.desc}</span>
          {active && (<span style={{ marginLeft: "auto", fontSize: 8, color: "#4CAF50", fontFamily: "var(--m)", background: "rgba(76,175,80,0.1)", padding: "2px 6px", borderRadius: 3 }}>{"AUTO"}</span>)}
        </div>
      );
    }

    if (r.type === "lOnly") {
      var on = val === "L";
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
          </div>
          <button onClick={active ? function() { upd(k, on ? "" : "L"); } : undefined}
            style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: on ? "rgba(255,213,79,0.12)" : "var(--inner)", border: on ? "1px solid rgba(255,213,79,0.4)" : "1px solid var(--bd)", borderRadius: 6, color: on ? "var(--acc)" : "var(--t2)", cursor: active ? "pointer" : "default", fontWeight: on ? 700 : 400 }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acp)" }}>{r.sp}</span>
          </div>
          <button onClick={active ? function() { upd(k, on2 ? "" : "R"); } : undefined}
            style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: on2 ? "rgba(206,147,216,0.12)" : "var(--inner)", border: on2 ? "1px solid rgba(206,147,216,0.4)" : "1px solid var(--bd)", borderRadius: 6, color: on2 ? "var(--acp)" : "var(--t2)", cursor: active ? "pointer" : "default", fontWeight: on2 ? 700 : 400 }}>
            {r.rDesc}
          </button>
        </div>
      );
    }

    if (r.type === "yearR") {
      return (
        <div key={k} style={{ padding: "5px 14px", opacity: active ? 1 : 0.35 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acp)" }}>{r.sp}</span>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{"연도 선택"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--t2)", flex: 1 }}>{r.rDesc}</span>
            <select value={val} onChange={active ? function(e) { upd(k, e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: val ? "var(--acp)" : "var(--t1)", outline: "none" }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{"연도 선택 좌/우"}</span>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: 4 }}>
            <button onClick={active ? function() { upd(k, side === "L" ? "" : "L:"); } : undefined} style={radioStyle(active, side === "L", "L")}>
              <span>{"◀ " + r.lDesc}</span>
            </button>
            <button onClick={active ? function() { upd(k, side === "R" ? "" : "R:"); } : undefined} style={radioStyle(active, side === "R", "R")}>
              <span>{r.rDesc + " ▶"}</span>
            </button>
          </div>
          {side && (<select value={yearV} onChange={active ? function(e) { upd(k, side + ":" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>
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
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
          </div>
          <div style={{ display: "flex", gap: 0, marginBottom: isR ? 4 : 0 }}>
            <button onClick={active ? function() { upd(k, isL ? "" : "L"); } : undefined} style={radioStyle(active, isL, "L")}>
              <span>{"◀ " + r.lDesc}</span>
            </button>
            <button onClick={active ? function() { upd(k, isR ? "" : "R:"); } : undefined} style={radioStyle(active, isR, "R")}>
              <span>{r.rDesc + " ▶"}</span>
            </button>
          </div>
          {isR && (<select value={yrVal} onChange={active ? function(e) { upd(k, "R:" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#FFD54F", outline: "none" }}>
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
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "var(--m)", color: "var(--acc)" }}>{r.sp}</span>
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
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"좌/우 선택 · 활성 " + activeCount + "개"}</div>
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
          }} style={{ marginTop: 8, width: "100%", padding: "8px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,rgba(255,213,79,0.15),rgba(255,143,0,0.08))", border: "1px solid rgba(255,213,79,0.3)", borderRadius: 6, color: "var(--acc)", cursor: "pointer" }}>{"⚡ 자동 최적화"}</button>
        </div>

        {/* Scrollable toggle list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
          {SD_ROWS.map(renderRow)}

          {/* Synergy */}
          <div style={{ padding: "10px 14px 4px", fontSize: 13, fontWeight: 800, color: "var(--acp)", fontFamily: "var(--h)", borderTop: "1px solid var(--bd)", marginTop: 6 }}>{"시너지"}</div>
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
                  <div style={{ fontSize: 12, color: on ? "var(--t1)" : "var(--td)", fontWeight: on ? 700 : 400 }}>{syn.label + " 시너지"}</div>
                  <div style={{ fontSize: 8, color: "var(--td)" }}>{syn.desc + " → " + syn.effect}</div>
                </div>
                {syn.auto && manual === undefined && (<span style={{ fontSize: 7, color: "#4CAF50", background: "rgba(76,175,80,0.1)", padding: "1px 4px", borderRadius: 3 }}>{"AUTO"}</span>)}
              </div>);
            });
          })()}

          {/* Special skills (auto-detect + manual) */}
          <div style={{ padding: "10px 14px 4px", fontSize: 13, fontWeight: 800, color: "#2E86C1", fontFamily: "var(--h)", borderTop: "1px solid var(--bd)", marginTop: 6 }}>{"특수 스킬"}</div>
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
                  <span style={{ fontSize: 12, color: "var(--t2)", flex: 1 }}>{sp.label}</span>
                  <select value={cur} onChange={function(e) { upd(sp.key, e.target.value); }} style={{ width: 65, padding: "3px", fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: cur!=="없음"?"#2E86C1":"var(--t1)", fontWeight: cur!=="없음"?700:400, outline: "none" }}>
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
    var potmList = GLOBAL_POTM_LIST;
    var teamName = sdState.teamName || "";
    /* POTM 세트덱 보너스
       - 라이브: 능력치 보너스 받는 카드는 세트덱 점수도 10까지 끌어올림 (원래 10 이상이면 +1)
                팀 일치/불일치 모두 적용 (라이브는 팀 무관)
       - 올스타: 기존 룰 유지 - 10 미만이면 (10-baseScore), 10 이상이면 +1
       - 그 외 (스페셜 POTM): 팀 일치할 때만 +1, 불일치 시 0 */
    var getPotmSetDelta = function(pl) {
      if (!potmList.length || !pl) return 0;
      var isPotm = potmList.some(function(p) { return p.name === (pl.name||"") && p.team === (pl.team||""); });
      if (!isPotm) return 0;
      var ct = pl.cardType;
      var teamMatch = !teamName || !pl.team || pl.team === teamName;
      var isLive = ct === "라이브";
      var isOlstar = ct === "올스타";
      var baseScore = isLive ? (pl.setScore || 0) : (SET_POINTS[ct] || 0);
      if (pl.isFa && ct==="시그니처") baseScore = Math.max(0, baseScore - 1);
      if (pl.isFa && ct==="임팩트") baseScore = Math.max(0, baseScore - 2);
      if (isLive) {
        /* 라이브 POTM: 10까지 올리거나, 이미 10 이상이면 +1 */
        return baseScore >= 10 ? 1 : (10 - baseScore);
      }
      if (isOlstar) {
        return baseScore >= 10 ? 1 : (10 - baseScore);
      }
      /* 스페셜 POTM (그 외 카드): 팀 일치 시 +1 */
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
    return (<input type="number" value={val || 0} onChange={function(e) { var v = parseInt(e.target.value) || 0; if (max) v = Math.min(max, Math.max(0, v)); updatePl(id, field, v); }} style={{ width: 34, padding: "2px 1px", textAlign: "center", background: "var(--inner)", border: "1px solid " + (color || "var(--bd)") + "44", borderRadius: 3, color: color || "var(--t1)", fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />);
  };
  var skillInput = function(pl, num) {
    var opts = getSkillOpts(pl);
    var nameField = "skill" + num; var lvField = "s" + num + "Lv";
    var c = {8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[pl[lvField]]||"var(--t2)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <SkillPicker
          value={pl[nameField] || ""}
          options={opts}
          width={90}
          fontSize={11}
          onChange={function(v) { updatePl(pl.id, nameField, v); }}
        />
        <select value={pl[lvField] || 0} onChange={function(e) { updatePl(pl.id, lvField, parseInt(e.target.value)); }}
          style={{ width: 38, padding: "3px 1px", fontSize: 12, background: "#1e293b", border: "1px solid " + c + "88", borderRadius: 3, color: c, fontFamily: "var(--m)", fontWeight: 700, outline: "none", textAlign: "center" }}>
          {[0,5,6,7,8,9,10].map(function(v) { return (<option key={v} value={v} style={{background:"#1e293b",color:v===0?"#94a3b8":c}}>{v === 0 ? "-" : "Lv" + v}</option>); })}
        </select>
      </div>
    );
  };

  /* Batter row */
  var batRow = function(slot, pl, idx) {
    if (!pl) return (
      <div key={slot} onClick={function() { setPickerSlot(slot); }} style={{ display: "grid", gridTemplateColumns: "32px 68px 1fr", alignItems: "center", gap: 6, padding: "8px 10px", background: idx % 2 === 0 ? "var(--re)" : "transparent", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--td)", fontFamily: "var(--m)" }}>{slot}</div>
        <div style={{ width: 64, height: 88, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--inner)" }}><span style={{ fontSize: 20, opacity: 0.2 }}>{"+"}</span></div>
        <div style={{ fontSize: 12, color: "var(--td)" }}>{"클릭하여 선수 등록"}</div>
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
            {idx > 0 && (<span onClick={function(e) { e.stopPropagation(); swapOrder(idx, idx-1); }} style={{ fontSize: 12, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▲"}</span>)}
            <span>{idx + 1}</span>
            {idx < 8 && (<span onClick={function(e) { e.stopPropagation(); swapOrder(idx, idx+1); }} style={{ fontSize: 12, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▼"}</span>)}
          </div>
          <PlayerCard player={(function(){ var ph=getPhotos(pl.name); var url=pl.photoUrl||(ph&&ph.length>0?ph[0]:''); return url!==pl.photoUrl?Object.assign({},pl,{photoUrl:url}):pl; })()} size={mob?"sm":"md"} showPhoto={true} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pl.cardType} /><span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span></div>
            <div style={{ fontSize: 14, color: "var(--td)", marginTop: 2 }}>{pl.hand + "타·" + (pl.enhance || "") + (pl.cardType==="임팩트" && pl.impactType ? " · "+pl.impactType : pl.year ? " · "+pl.year : "")}</div>
          </div>
          {mob ? (<div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={20} /></div>) : null}
          {!mob && (<React.Fragment>
            <div style={{ textAlign: "left" }}><GS val={calc.total.toFixed(1)} size={28} /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginLeft: 40 }}>
              {[["파", calc.power, "#EF5350"], ["정", calc.accuracy, "#42A5F5"], ["선", calc.eye, "#66BB6A"]].map(function(it) {
                return (<div key={it[0]} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 14, fontSize: 15, color: it[2], fontWeight: 700 }}>{it[0]}</span><Bar value={it[1]} color={it[2]} /><span style={{ width: 26, fontSize: 15, color: "var(--t2)", fontFamily: "var(--m)", textAlign: "right" }}>{it[1]}</span></div>);
              })}
            </div>
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 13, color: pctColor((pl.trainP||0)*getW().p+(pl.trainA||0)*getW().a+(pl.trainE||0)*getW().e, allBatTrainScores, "gold") }}>{"훈련"}</div>
              <span style={{ fontSize: 15, fontFamily: "var(--m)" }}><span style={{ color: "#EF5350" }}>{"+" + (pl.trainP || 0)}</span>{" "}<span style={{ color: "#42A5F5" }}>{"+" + (pl.trainA || 0)}</span>{" "}<span style={{ color: "#66BB6A" }}>{"+" + (pl.trainE || 0)}</span></span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--td)" }}>{"특훈"}</div>
              <span style={{ fontSize: 15, color: "var(--t2)", fontFamily: "var(--m)" }}>{(pl.specPower || 0) + "/" + (pl.specAccuracy || 0) + "/" + (pl.specEye || 0)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {pl.skill1 && (<SkBadge name={pl.skill1} lv={pl.s1Lv} />)}
              {pl.skill2 && (<SkBadge name={pl.skill2} lv={pl.s2Lv} />)}
              {pl.skill3 && (<SkBadge name={pl.skill3} lv={pl.s3Lv} />)}
            </div>
            {(function(){
              var skSc=Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,"타자")+getSkillScore(pl.skill2,pl.s2Lv||0,"타자")+getSkillScore(pl.skill3,pl.s3Lv||0,"타자"))*100)/100;
              return (<div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color: pctColor(skSc, allBatSkillScores, "gold"), fontFamily: "var(--m)" }}>{skSc||""}</div>);
            })()}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 15, color: "var(--t2)" }}>{(<span><span style={{fontSize:11,color:"var(--td)"}}>풀</span>{pl.pot1||"-"} <span style={{fontSize:11,color:"var(--td)"}}>클</span>{pl.pot2||"-"}</span>)}</div>
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
                <span style={{fontSize:13,color:"var(--td)",flexShrink:0}}>{"선수사진:"}</span>
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
                {pl.photoUrl && (<button onClick={function(){updatePl(pl.id,"photoUrl","");}} style={{padding:"3px 8px",fontSize:12,background:"rgba(239,83,80,0.08)",border:"1px solid rgba(239,83,80,0.2)",borderRadius:4,color:"#EF5350",cursor:"pointer",flexShrink:0}}>{"사진 제거"}</button>)}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e} style={{background:"#1e293b",color:"#e2e8f0"}}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 15, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 13, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "trainP", pl.trainP, "#EF5350")}<span style={{ fontSize: 13, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "trainA", pl.trainA, "#42A5F5")}<span style={{ fontSize: 13, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "trainE", pl.trainE, "#66BB6A")}</div></div>
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 13, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "specPower", pl.specPower, "#EF5350", 15)}<span style={{ fontSize: 13, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "specAccuracy", pl.specAccuracy, "#42A5F5", 15)}<span style={{ fontSize: 13, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "specEye", pl.specEye, "#66BB6A", 15)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3, alignItems: "center" }}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType1||"풀스윙"} onChange={function(e){updatePl(pl.id,"potType1",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_BAT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot1||""} onChange={function(e){updatePl(pl.id,"pot1",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:12,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType2||"클러치"} onChange={function(e){updatePl(pl.id,"potType2",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_BAT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot2||""} onChange={function(e){updatePl(pl.id,"pot2",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:12,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div></div></div>
            <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 3 }}>{"스킬 ("+getSkillCat(pl)+")"}</div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{skillInput(pl,1)}{skillInput(pl,2)}{skillInput(pl,3)}</div></div>
          </div>
        </div>)}
      </React.Fragment>
    );
  };

  /* Pitcher row */
  var pitRow = function(slot, pl, idx, showWt) {
    if (!pl) return (
      <div key={slot} onClick={function() { setPickerSlot(slot); }} style={{ display: "grid", gridTemplateColumns: "32px 68px 1fr", alignItems: "center", gap: 6, padding: "8px 10px", background: idx % 2 === 0 ? "var(--re)" : "transparent", borderBottom: "1px solid var(--bd)", cursor: "pointer" }}>
        <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: "var(--td)", fontFamily: "var(--m)" }}>{slot}</div>
        <div style={{ width: 64, height: 88, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--inner)" }}><span style={{ fontSize: 20, opacity: 0.2 }}>{"+"}</span></div>
        <div style={{ fontSize: 12, color: "var(--td)" }}>{"클릭하여 선수 등록"}</div>
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
            <div style={{ fontSize: 14, color: "var(--td)", marginTop: 2 }}>{pl.hand + "투·" + (pl.enhance || "") + (pl.cardType==="임팩트" && pl.impactType ? " · "+pl.impactType : pl.year ? " · "+pl.year : "")}</div>
          </div>
          {mob ? (<div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={20} grad="linear-gradient(135deg,#CE93D8,#7B1FA2)" /></div>) : null}
          {!mob && (<React.Fragment>
            <div style={{ textAlign: "left" }}><GS val={calc.total.toFixed(1)} size={28} grad="linear-gradient(135deg,#CE93D8,#7B1FA2)" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3, marginLeft: 40 }}>
              {[["변", calc.change, "#AB47BC"], ["구", calc.stuff, "#FF7043"]].map(function(it) {
                return (<div key={it[0]} style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ width: 14, fontSize: 15, color: it[2], fontWeight: 700 }}>{it[0]}</span><Bar value={it[1]} color={it[2]} /><span style={{ width: 26, fontSize: 15, color: "var(--t2)", fontFamily: "var(--m)", textAlign: "right" }}>{it[1]}</span></div>);
              })}
            </div>
            <div style={{ textAlign: "center", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 13, color: pctColor((pl.trainC||0)*getW().c+(pl.trainS||0)*getW().s, allPitTrainScores, "gold") }}>{"훈련"}</div>
              <span style={{ fontSize: 15, fontFamily: "var(--m)" }}><span style={{ color: "#AB47BC" }}>{"+" + (pl.trainC || 0)}</span>{" "}<span style={{ color: "#FF7043" }}>{"+" + (pl.trainS || 0)}</span></span>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--td)" }}>{"특훈"}</div>
              <span style={{ fontSize: 15, color: "var(--t2)", fontFamily: "var(--m)" }}>{(pl.specChange || 0) + "/" + (pl.specStuff || 0)}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {pl.skill1 && (<SkBadge name={pl.skill1} lv={pl.s1Lv} />)}
              {pl.skill2 && (<SkBadge name={pl.skill2} lv={pl.s2Lv} />)}
              {pl.skill3 && (<SkBadge name={pl.skill3} lv={pl.s3Lv} />)}
            </div>
            {(function(){
              var pt2=pl.position==="선발"?"선발":pl.position==="마무리"?"마무리":"중계";
              var skSc=Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,pt2)+getSkillScore(pl.skill2,pl.s2Lv||0,pt2)+getSkillScore(pl.skill3,pl.s3Lv||0,pt2))*100)/100;
              return (<div style={{ textAlign: "center", fontSize: 15, fontWeight: 800, color: pctColor(skSc, allPitSkillScores, "blue"), fontFamily: "var(--m)" }}>{skSc||""}</div>);
            })()}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 15, color: "var(--t2)" }}>{(<span><span style={{fontSize:11,color:"var(--td)"}}>장</span>{pl.pot1||"-"} <span style={{fontSize:11,color:"var(--td)"}}>침</span>{pl.pot2||"-"}</span>)}</div>
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
                <span style={{fontSize:13,color:"var(--td)",flexShrink:0}}>{"선수사진:"}</span>
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
                {pl.photoUrl && (<button onClick={function(){updatePl(pl.id,"photoUrl","");}} style={{padding:"3px 8px",fontSize:12,background:"rgba(239,83,80,0.08)",border:"1px solid rgba(239,83,80,0.2)",borderRadius:4,color:"#EF5350",cursor:"pointer",flexShrink:0}}>{"사진 제거"}</button>)}
              </div>
            );
          })()}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e} style={{background:"#1e293b",color:"#e2e8f0"}}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 15, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 13, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "trainC", pl.trainC, "#AB47BC")}<span style={{ fontSize: 13, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "trainS", pl.trainS, "#FF7043")}</div></div>
            <div><div style={{ fontSize: 14, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 13, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "specChange", pl.specChange, "#AB47BC", 15)}<span style={{ fontSize: 13, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "specStuff", pl.specStuff, "#FF7043", 15)}</div></div>
            
            <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3 }}><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType1||"장타억제"} onChange={function(e){updatePl(pl.id,"potType1",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_PIT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot1||""} onChange={function(e){updatePl(pl.id,"pot1",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:12,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}><select value={pl.potType2||"침착"} onChange={function(e){updatePl(pl.id,"potType2",e.target.value);}} style={{padding:"1px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#FFD54F",fontSize:8,outline:"none",width:52,marginBottom:1}}>{POT_TYPES_PIT.map(function(t){return(<option key={t} value={t}>{t}</option>);})}</select><select value={pl.pot2||""} onChange={function(e){updatePl(pl.id,"pot2",e.target.value);}} style={{padding:"2px 2px",background:"#1e293b",border:"1px solid #334155",borderRadius:3,color:"#e2e8f0",fontSize:12,outline:"none",width:52}}><option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}</select></div></div></div>
            <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 3 }}>{"스킬 ("+getSkillCat(pl)+")"}</div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{skillInput(pl,1)}{skillInput(pl,2)}{skillInput(pl,3)}</div></div>
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
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--td)" }}>{"가중치: 파워 " + LIVE_WEIGHTS.p + " / 정확 " + LIVE_WEIGHTS.a + " / 선구 " + LIVE_WEIGHTS.e + " / 변화 " + LIVE_WEIGHTS.c + " / 구위 " + LIVE_WEIGHTS.s}</p>
        </div>
        <div style={{ textAlign: mob ? "left" : "right" }}>
          <div style={{ fontSize: 11, color: "var(--td)", letterSpacing: 1 }}>{"TOTAL SCORE"}</div>
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t2)", letterSpacing: 1, marginBottom: 8 }}>{"STARTING ROTATION"}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {SP_SLOTS.map(function(pos) { var pl = pick(pos); return pl ? (<div key={pl.id} onClick={function() { setPickerSlot(pos); }} style={{ cursor: "pointer" }}><PCard p={pl} /></div>) : (<div key={pos} onClick={function() { setPickerSlot(pos); }} style={{ width: 52, height: 72, borderRadius: 6, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "var(--re)" }}><span style={{ fontSize: 11, color: "var(--td)" }}>{pos}</span></div>); })}
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{bnPl.name.replace(/\d+$/, "")}</span>
                    <Badge type={bnPl.cardType} />
                  </div>
                );
              }
              return (
                <div key={n} onClick={function() { setPickerSlot(bnSlot); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 10, borderRadius: 8, border: "1px dashed var(--bd)", background: "var(--inner)", cursor: "pointer" }}>
                  <div style={{ width: 42, height: 56, borderRadius: 5, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 16, opacity: 0.15 }}>{"+"}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--td)" }}>{"후보 " + n}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--td)", marginTop: 8, textAlign: "center" }}>{"후보선수는 세트덱 포인트에 기여합니다"}</p>
        </div>
      </div>

      {/* Set Deck Toggle Arrow */}
      <button onClick={function() { setSdOpen(!sdOpen); }} style={{
        position: "fixed", right: sdOpen ? (mob ? 260 : 300) : 0, top: "50%", transform: "translateY(-50%)",
        width: 28, height: 56, borderRadius: "8px 0 0 8px", zIndex: 191,
        background: "linear-gradient(180deg,rgba(255,213,79,0.15),rgba(255,143,0,0.1))",
        border: "1px solid rgba(255,213,79,0.2)", borderRight: "none",
        color: "var(--acc)", cursor: "pointer", fontSize: 16, fontWeight: 700,
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
      <div style={{ fontWeight: 700, color: "var(--t1)", fontSize: 13 }}>{pos}</div>
      <div style={{ textAlign: "center" }}>
        <select value={String(lv)} onChange={function(e) { upd(pos, "level", parseInt(e.target.value)); }} style={{ width: 50, padding: "4px 2px", textAlign: "center", background: "#1e293b", border: "1px solid #334155", borderRadius: 4, color: "#e2e8f0", fontSize: 14, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
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
            <span style={{ fontSize: 12, color: colors[i], fontFamily: "var(--m)", fontWeight: 800 }}>{base}</span>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{"+"}</span>
            <select value={String(reset)} onChange={function(e) { upd(pos, "r" + i, parseInt(e.target.value)); }} style={{ width: 34, padding: "4px 1px", textAlign: "center", background: "#1e293b", border: "1px solid " + colors[i] + "88", borderRadius: 4, color: colors[i], fontSize: 13, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
              {RS_OPTS.map(function(v) { return (<option key={v} value={v}>{v}</option>); })}
            </select>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{"="}</span>
            <span style={{ fontSize: 13, color: colors[i], fontFamily: "var(--m)", fontWeight: 800 }}>{base + reset}</span>
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
      <p style={{ fontSize: 12, color: "var(--td)", margin: "0 0 12px" }}>{"계정 귀속 - 포지션별 레벨과 재설정 효과를 입력하세요"}</p>
      {groups.map(function(grp) {
        return (
          <div key={grp.label} style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--bd)", background: "rgba(255,213,79,0.02)" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", letterSpacing: 1 }}>{grp.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "70px 56px " + grp.stats.map(function() { return "1fr"; }).join(" "), gap: 6, padding: "6px 14px", borderBottom: "1px solid var(--bd)", fontSize: 11, fontWeight: 700, color: "var(--td)" }}>
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

/* ================================================================
   LEGAL / POLICY MODAL CONTENT (AdSense 승인을 위한 필수 페이지)
   ================================================================ */
var CONTACT_EMAIL = "lyj198823@gmail.com";

function PolicyModal(p) {
  /* p: type("privacy"|"terms"|"guide"|"faq"|"about"), onClose */
  var mob = useMedia("(max-width:600px)");
  if (!p.type) return null;

  var titleMap = {
    privacy: "개인정보처리방침",
    terms: "서비스 이용약관",
    guide: "사용 가이드",
    faq: "자주 묻는 질문 (FAQ)",
    about: "사이트 소개",
    glossary: "컴투스 프로야구 v26 용어 사전"
  };

  var content = null;

  if (p.type === "privacy") {
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        <p style={{ color: "#8b949e", fontSize: 12 }}>{"최종 업데이트: 2026년 4월 21일"}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"1. 개요"}</h3>
        <p>{"'덱 매니저' (이하 '본 서비스')는 컴투스 프로야구 v26 게임 이용자들이 자신의 선수 라인업을 구성하고 전력을 계산할 수 있도록 돕는 개인 운영 서비스입니다. 본 방침은 이용자의 개인정보가 어떻게 수집되고 활용되는지를 투명하게 공개하기 위해 마련되었습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"2. 수집하는 정보"}</h3>
        <p>{"본 서비스는 최소한의 정보만을 수집합니다."}</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"Google 계정 로그인 시: 이메일 주소, 프로필 이름, 프로필 이미지 URL (Google OAuth를 통해 제공)"}</li>
          <li>{"게스트 로그인 시: 이용자가 직접 입력한 닉네임"}</li>
          <li>{"서비스 이용 데이터: 구성한 덱 정보, 선수 카드 정보, 강화 수치, 스킬 설정 등 게임과 관련된 데이터"}</li>
          <li>{"자동 수집: 브라우저 종류, 접속 시간, 쿠키 식별자 (일반적인 웹 로그)"}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"3. 이용 목적"}</h3>
        <p>{"수집한 정보는 다음의 목적으로만 사용됩니다."}</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"이용자 계정 식별 및 덱 데이터 저장/복원"}</li>
          <li>{"여러 기기 간 데이터 동기화"}</li>
          <li>{"서비스 품질 개선을 위한 통계적 분석"}</li>
          <li>{"부정 이용 방지 및 보안 관리"}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"4. 제3자 서비스 사용"}</h3>
        <p>{"본 서비스는 원활한 운영을 위해 다음의 제3자 서비스를 이용합니다."}</p>
        <ul style={{ paddingLeft: 20 }}>
          <li><strong>{"Google OAuth"}</strong>{" - 로그인 인증 용도"}</li>
          <li><strong>{"Supabase"}</strong>{" - 이용자 데이터 저장 용도 (데이터베이스 및 파일 스토리지)"}</li>
          <li><strong>{"Vercel"}</strong>{" - 웹사이트 호스팅"}</li>
          <li><strong>{"Google AdSense"}</strong>{" - 광고 게재를 위한 쿠키 사용 (하단 별도 안내)"}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"5. 쿠키 및 광고 관련 안내"}</h3>
        <p>{"본 사이트는 수익 창출을 위해 Google AdSense 광고를 게재할 수 있습니다. 다음 사항을 알려드립니다."}</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"Google을 비롯한 제3자 공급업체는 쿠키를 이용하여 이용자가 본 사이트 및 다른 사이트를 방문한 기록을 바탕으로 광고를 게재합니다."}</li>
          <li>{"이용자는 광고 설정(adssettings.google.com)에서 맞춤 광고를 비활성화할 수 있습니다."}</li>
          <li>{"맞춤 광고를 비활성화해도 광고가 완전히 사라지는 것은 아니며, 맞춤화만 중단됩니다."}</li>
          <li>{"유럽 경제 지역(EEA) 및 영국 이용자에 대해서는 GDPR 동의 메시지가 표시되어 쿠키 사용 동의 여부를 선택할 수 있습니다."}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"6. 데이터 보관 및 삭제"}</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"이용자가 로그아웃하거나 계정을 삭제할 때까지 서버에 데이터가 보관됩니다."}</li>
          <li>{"게스트 모드의 데이터는 이용자의 브라우저 저장소(localStorage)에만 저장되며, 운영자는 접근할 수 없습니다."}</li>
          <li>{"이용자는 언제든 자신의 데이터 삭제를 요청할 수 있으며, 요청 후 7일 이내에 모든 개인 데이터가 영구 삭제됩니다."}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"7. 이용자 권리"}</h3>
        <p>{"이용자는 언제든지 다음의 권리를 행사할 수 있습니다: 개인정보 열람 요청, 정정 요청, 삭제 요청, 처리 정지 요청, 데이터 이동 요청."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"8. 아동 정보 보호"}</h3>
        <p>{"본 서비스는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다. 만 14세 미만임을 인지한 경우 즉시 해당 데이터를 삭제합니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"9. 보안 조치"}</h3>
        <p>{"이용자 데이터는 HTTPS 암호화 통신으로 전송되며, Supabase의 Row Level Security를 통해 타인의 접근이 차단됩니다. 비밀번호는 저장되지 않으며, 인증은 Google OAuth를 통해서만 이루어집니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"10. 방침 변경"}</h3>
        <p>{"본 방침이 변경될 경우 본 페이지 상단의 '최종 업데이트' 날짜가 수정되며, 중대한 변경 사항은 서비스 내 공지를 통해 안내합니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"11. 문의처"}</h3>
        <p>{"개인정보 관련 문의나 권리 행사는 아래 이메일로 연락해 주시기 바랍니다."}</p>
        <p style={{ background: "rgba(255,213,79,0.08)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,213,79,0.2)", marginTop: 8 }}>
          {"📧 이메일: "}<strong style={{ color: "#FFD54F" }}>{CONTACT_EMAIL}</strong>
        </p>

        <p style={{ color: "#6e7681", fontSize: 12, marginTop: 28, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {"본 서비스는 컴투스(Com2uS)의 공식 서비스가 아니며, 해당 게임사와는 독립적으로 운영되는 팬 제작 도구입니다. '컴투스 프로야구 v26'은 해당 권리자의 상표이며, 본 방침은 팬 제작 환경에서의 개인정보 처리 방침을 설명하기 위한 것입니다."}
        </p>
      </div>
    );
  } else if (p.type === "terms") {
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        <p style={{ color: "#8b949e", fontSize: 12 }}>{"최종 업데이트: 2026년 4월 21일"}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제1조 (목적)"}</h3>
        <p>{"본 약관은 '덱 매니저' (이하 '서비스')의 이용 조건과 절차, 이용자와 운영자의 권리·의무 및 책임 사항을 규정함을 목적으로 합니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제2조 (서비스의 정의)"}</h3>
        <p>{"본 서비스는 컴투스 프로야구 v26 게임 이용자가 자신의 보유 선수를 관리하고, 라인업을 구성하며, 강화 수치를 계산할 수 있는 보조 도구입니다. 게임 내 데이터를 자동으로 가져오거나 조작하지 않으며, 이용자가 직접 입력한 정보만을 관리합니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제3조 (이용료)"}</h3>
        <p>{"본 서비스는 전액 무료로 제공됩니다. 다만 서비스 운영 비용 충당을 위해 Google AdSense 광고가 일부 페이지에 게재될 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제4조 (회원가입 및 계정)"}</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"이용자는 Google 계정을 통해 로그인하거나, 닉네임만 입력하여 게스트로 이용할 수 있습니다."}</li>
          <li>{"Google 계정 이용자는 최대 5개 팀의 덱을 저장할 수 있으며, 게스트는 1개 팀의 덱만 저장할 수 있습니다."}</li>
          <li>{"이용자는 자신의 계정 정보를 제3자에게 양도하거나 공유할 수 없습니다."}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제5조 (금지 행위)"}</h3>
        <p>{"이용자는 다음 행위를 하여서는 안 됩니다."}</p>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"서비스의 정상적인 운영을 방해하는 행위"}</li>
          <li>{"자동화된 수단(봇, 스크래퍼 등)을 사용하여 서비스에 무단 접근하는 행위"}</li>
          <li>{"타인의 개인정보를 무단으로 수집, 저장, 공개하는 행위"}</li>
          <li>{"저작권, 상표권 등 타인의 지적재산권을 침해하는 행위"}</li>
          <li>{"음란물, 폭력물, 기타 공공질서에 반하는 내용을 게시하는 행위"}</li>
          <li>{"서비스를 상업적으로 무단 복제, 재배포하는 행위"}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제6조 (지적재산권)"}</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"'컴투스 프로야구 v26' 및 등장하는 모든 구단, 선수, 로고 등의 지적재산권은 해당 권리자에게 있습니다."}</li>
          <li>{"본 서비스는 팬 커뮤니티를 위한 비영리 보조 도구로 제작되었으며, 해당 게임사와 공식적 제휴 관계가 없습니다."}</li>
          <li>{"이용자가 서비스 내에서 입력한 데이터(덱 구성, 닉네임 등)의 저작권은 이용자 본인에게 있습니다."}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제7조 (서비스의 변경 및 중단)"}</h3>
        <p>{"운영자는 기술적 필요 또는 운영상의 사유로 서비스의 전부 또는 일부를 변경, 중단할 수 있으며, 이에 따른 이용자의 손해에 대해 고의 또는 중과실이 없는 한 책임을 지지 않습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제8조 (면책 조항)"}</h3>
        <ul style={{ paddingLeft: 20 }}>
          <li>{"본 서비스는 '있는 그대로(as-is)' 제공되며, 계산 결과의 정확성을 절대적으로 보장하지 않습니다."}</li>
          <li>{"서비스 이용으로 인해 발생한 게임 내 결과, 경제적 손실 등에 대해 운영자는 책임을 지지 않습니다."}</li>
          <li>{"천재지변, 통신 장애, 제3자 서비스(Google, Supabase 등)의 장애로 인한 서비스 중단에 대해 책임을 지지 않습니다."}</li>
        </ul>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제9조 (분쟁 해결)"}</h3>
        <p>{"본 약관과 관련하여 분쟁이 발생할 경우, 운영자와 이용자는 상호 협의를 통해 해결하도록 노력하며, 해결되지 않을 경우 대한민국 법률에 따릅니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"제10조 (약관의 변경)"}</h3>
        <p>{"운영자는 필요시 본 약관을 개정할 수 있으며, 개정 시 본 페이지에 공지합니다. 이용자가 개정 약관에 동의하지 않는 경우 서비스 이용을 중단할 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"문의"}</h3>
        <p style={{ background: "rgba(255,213,79,0.08)", padding: "10px 14px", borderRadius: 8, border: "1px solid rgba(255,213,79,0.2)" }}>
          {"📧 이메일: "}<strong style={{ color: "#FFD54F" }}>{CONTACT_EMAIL}</strong>
        </p>
      </div>
    );
  } else if (p.type === "guide") {
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        <p style={{ color: "#8b949e" }}>{"덱 매니저를 처음 이용하시는 분을 위한 단계별 안내입니다. 아래 순서대로 진행하면 자신의 덱을 완성하고 전력을 분석할 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"1단계. 로그인 방법 선택"}</h3>
        <p>{"상단의 'Google 계정으로 시작하기' 버튼을 눌러 로그인하면 최대 5개 팀을 클라우드에 저장할 수 있고, 휴대폰과 PC에서 동일한 데이터를 확인할 수 있습니다. 간단히 체험해 보고 싶다면 '게스트로 시작하기'를 선택해 닉네임만 입력하고 바로 사용할 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"2단계. 팀 선택"}</h3>
        <p>{"로그인 직후 나타나는 팀 선택 창에서 원하는 KBO 구단(키움, 삼성, LG, 두산, KT, SSG, 롯데, 한화, NC, KIA)을 선택합니다. 여기서 고르는 팀은 '덱 이름'으로만 사용되며, 실제 선수 소속팀과는 관계가 없습니다. 예를 들어 LG 덱 안에 키움 선수를 편성해도 전혀 문제가 없습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"3단계. 선수 추가"}</h3>
        <p>{"'내 선수' 탭으로 이동하여 보유하고 있는 선수를 추가합니다. 선수 이름을 검색하면 DB에 등록된 기본 정보(포지션, 연도, 카드 종류 등)가 자동으로 불러와집니다. 이어서 강화 수치, 특능 수치, 훈련 수치, 스킬 레벨, 잠재력 등급 등 세부 정보를 입력하면 전력 계산에 반영됩니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"4단계. 라인업 구성"}</h3>
        <p>{"'라인업' 탭에서는 추가한 선수들을 1번 타자부터 9번 타자까지 순서대로 배치하고, 선발/중계/마무리 투수 로테이션을 지정할 수 있습니다. 각 슬롯을 탭하여 선수를 지정하면 해당 선수의 공격력, 수비력, 투수력이 자동으로 계산되어 표시됩니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"5단계. 세트덱 보너스 확인"}</h3>
        <p>{"라인업 화면 하단에는 선수 구성에 따라 활성화되는 세트덱 효과가 자동으로 표시됩니다. 예를 들어 특정 시즌 카드를 다수 포함하면 'OO년도 시즌' 세트 보너스가, 골든글러브 카드를 다수 포함하면 '골든글러브' 세트 보너스가 적용됩니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"6단계. 전력 분석"}</h3>
        <p>{"'데이터 센터' 탭에서는 완성된 덱의 총 전력, 타순별 기여도, 스킬 분포, 포지션 균형 등을 종합적으로 분석할 수 있습니다. 또한 다른 이용자들의 평균 전력과 비교한 백분위 순위도 확인할 수 있어, 자신의 덱이 어느 수준인지 객관적으로 파악할 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"7단계. 여러 덱 관리 (Google 로그인)"}</h3>
        <p>{"상단의 팀 이름을 누르면 덱 목록이 나타나며, '+' 버튼으로 새 덱을 추가할 수 있습니다. 예를 들어 시즌 카드 위주의 덱과 임팩트 카드 위주의 덱을 각각 만들어 비교하거나, 타이틀 매치용 덱과 일반 리그용 덱을 구분해 관리할 수 있습니다."}</p>
      </div>
    );
  } else if (p.type === "faq") {
    var faqs = [
      { q: "덱 매니저는 무료로 이용할 수 있나요?",
        a: "네, 모든 기능을 전액 무료로 이용할 수 있습니다. 서비스 운영 비용 충당을 위해 일부 페이지에 광고가 게재될 수 있으나, 광고 제거를 위한 유료 결제는 없습니다." },
      { q: "컴투스(게임사)와 공식 제휴 관계인가요?",
        a: "아닙니다. 본 서비스는 개인이 운영하는 팬 제작 도구이며, 컴투스와 어떤 공식 제휴 관계도 없습니다. 게임 내 데이터를 직접 가져오거나 자동 연동되지 않으며, 이용자가 직접 입력한 정보만을 관리합니다." },
      { q: "게스트 모드와 Google 로그인의 차이가 무엇인가요?",
        a: "게스트 모드는 닉네임만으로 바로 시작할 수 있지만 1개 팀만 관리할 수 있고, 데이터가 현재 사용 중인 브라우저에만 저장됩니다. 브라우저 데이터를 삭제하면 덱이 사라질 수 있습니다. 반면 Google 로그인은 최대 5개 팀을 클라우드에 저장하며, 여러 기기에서 동일한 데이터를 확인할 수 있습니다." },
      { q: "내 선수 데이터는 다른 사람에게 공개되나요?",
        a: "공개되지 않습니다. 로그인한 이용자의 개인 덱 데이터는 본인만 조회할 수 있으며, Supabase의 Row Level Security를 통해 타인의 접근이 원천적으로 차단됩니다. 데이터 센터에 표시되는 평균 비교 데이터는 모두 통계적으로 집계된 익명 수치이며, 개별 이용자를 식별할 수 없습니다." },
      { q: "선수 사진은 어디서 가져오는 건가요?",
        a: "관리자가 사전에 업로드한 선수 사진이 전역으로 공유되어 표시됩니다. 이용자가 직접 사진을 업로드할 수는 있지만, 이는 본인 덱에만 표시되며 DB의 기본 사진은 관리자 권한이 있는 계정만 수정할 수 있습니다." },
      { q: "잠재력 점수는 어떤 기준으로 계산되나요?",
        a: "잠재력은 C부터 SR+까지 12개 등급으로 나뉘며, 각 등급마다 기본 점수가 설정되어 있습니다. 풀스윙, 클러치, 장타억제, 침착 등 잠재력 종류에 따라 점수표가 다를 수 있으며, '스킬 관리' 페이지에서 관리자가 수치를 조정할 수 있습니다." },
      { q: "강화 수치는 어디까지 입력할 수 있나요?",
        a: "카드 종류에 따라 다릅니다. 시즌/라이브 카드는 최대 +10까지, 임팩트/시그니처/골든글러브 카드는 최대 +18까지 입력할 수 있습니다. 각 강화 단계별 스탯 증가량은 사이트에 내장된 ENHANCE 테이블에 따라 자동 계산됩니다." },
      { q: "데이터를 실수로 삭제했는데 복구할 수 있나요?",
        a: "죄송하지만 즉시 복구 기능은 제공하지 않습니다. Google 로그인 계정의 경우 Supabase 백업 정책에 따라 일부 복구가 가능할 수 있으니, 중요한 데이터를 삭제하신 경우 가급적 빨리 문의 이메일로 연락 주시기 바랍니다." },
      { q: "PC와 스마트폰에서 모두 사용할 수 있나요?",
        a: "네, 모든 화면이 반응형으로 제작되어 PC, 태블릿, 스마트폰 어느 환경에서도 원활하게 이용할 수 있습니다. Google 로그인을 하면 기기 간 데이터가 자동으로 동기화됩니다." },
      { q: "광고가 너무 많이 나오거나 불편한 경우 어떻게 하나요?",
        a: "Google 광고 설정 페이지(adssettings.google.com)에서 개인 맞춤 광고를 비활성화할 수 있습니다. 특정 광고가 부적절하다고 판단되면 광고 우측 상단의 정보 아이콘을 통해 Google에 직접 신고할 수 있습니다." },
      { q: "버그를 발견했거나 기능을 건의하고 싶습니다.",
        a: "페이지 하단에 명시된 운영자 이메일(" + CONTACT_EMAIL + ")로 연락해 주시면 확인 후 반영 여부를 검토하겠습니다. 스크린샷과 함께 어떤 환경(브라우저/OS)에서 발생했는지 알려주시면 빠른 해결에 도움이 됩니다." },
      { q: "내 데이터를 완전히 삭제하고 싶습니다.",
        a: "운영자 이메일로 탈퇴를 요청하시면 7일 이내에 해당 계정과 관련된 모든 데이터(덱, 선수 정보, 프로필 정보)가 영구 삭제됩니다. 삭제 후에는 복구가 불가능하니 신중히 결정해 주시기 바랍니다." }
    ];
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        {faqs.map(function(f, i) {
          return (
            <div key={i} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: i < faqs.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
              <p style={{ color: "#FFD54F", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{"Q" + (i + 1) + ". " + f.q}</p>
              <p style={{ margin: 0, color: "#c9d1d9" }}>{"A. " + f.a}</p>
            </div>
          );
        })}
      </div>
    );
  } else if (p.type === "about") {
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 0, marginBottom: 10 }}>{"덱 매니저는 어떤 사이트인가요?"}</h3>
        <p>{"덱 매니저는 모바일 야구 게임 '컴투스 프로야구 v26'을 플레이하는 이용자들을 위한 라인업 구성 및 전력 분석 도구입니다. 게임 내에서 수십 장에서 수백 장의 선수 카드를 보유하게 되면, 어떤 카드를 1군에 편성해야 가장 높은 전력이 나오는지 판단하기가 쉽지 않습니다. 덱 매니저는 이 고민을 해결하기 위해 제작되었습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"어떤 기능을 제공하나요?"}</h3>
        <p>{"이용자가 자신의 보유 선수를 입력하면, 각 선수의 강화 수치, 특수능력 수치, 훈련 수치, 스킬 레벨, 잠재력 등급을 종합하여 공격력·수비력·투수력을 자동 계산합니다. 타순 배치에 따른 타격 기여도 가중치도 반영되므로, 단순히 스탯 합계만 보는 것보다 훨씬 정확한 전력 평가가 가능합니다. 또한 완성된 덱을 여러 벌 저장해 두고 상황에 맞게 교체해 가며 사용할 수 있습니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"왜 이 사이트를 만들었나요?"}</h3>
        <p>{"컴투스 프로야구 v26은 선수 카드의 종류(시즌, 라이브, 임팩트, 시그니처, 골든글러브, 국가대표 등)와 강화 수치, 스킬 조합이 매우 복잡합니다. 각 카드 종류마다 강화 상승폭이 다르고, 스킬에 따른 능력치 보정도 천차만별이라 게임 내 화면만으로는 덱 최적화가 어렵습니다. 이 사이트는 해당 게임을 오래 플레이해 온 팬이 팬 커뮤니티를 위해 직접 만든 비공식 보조 도구입니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"게임사와 관련이 있나요?"}</h3>
        <p>{"아닙니다. 본 사이트는 개인이 운영하는 팬 제작 프로젝트이며, 컴투스 또는 KBO와 어떠한 공식 제휴 관계도 없습니다. 게임 내 데이터를 자동으로 연동하거나 가져오지 않으며, 이용자가 직접 입력한 정보만을 처리합니다. 사이트에 표시되는 선수 이름, 구단명 등은 모두 해당 권리자의 상표이며, 본 사이트는 비영리 팬 사용 목적으로만 이를 참조합니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"어떤 기술로 만들어졌나요?"}</h3>
        <p>{"프론트엔드는 React와 Vite로 제작되었으며, Vercel을 통해 호스팅됩니다. 이용자 데이터는 Supabase의 PostgreSQL 데이터베이스에 저장되며, 로그인 인증은 Google OAuth를 통해 처리됩니다. 모든 통신은 HTTPS로 암호화되어 안전하게 전송됩니다."}</p>

        <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 24, marginBottom: 10 }}>{"앞으로의 계획은?"}</h3>
        <p>{"현재는 라인업 구성, 전력 계산, 데이터 비교 등 핵심 기능에 집중하고 있습니다. 이용자 피드백을 바탕으로 스킬 조합 시뮬레이터, 덱 공유 기능, 포지션별 추천 선수 제안 등을 점진적으로 추가할 계획입니다. 기능 건의나 버그 제보는 언제든지 운영자 이메일로 보내주시기 바랍니다."}</p>
      </div>
    );
  } else if (p.type === "glossary") {
    var glossary = [
      { t: "덱 (Deck)", d: "게임에 실제 출전하는 선발 9명(타자)과 투수진으로 구성된 1군 엔트리입니다. 본 사이트에서는 여러 벌의 덱을 저장해 두고 필요에 따라 전환해 사용할 수 있습니다." },
      { t: "카드 종류", d: "시즌, 라이브, 임팩트, 시그니처, 골든글러브, 국가대표 등으로 구분됩니다. 상위 카드일수록 최대 강화 단계가 높고 능력치 상승폭도 큽니다. 각 카드는 시즌 연도와 선수명을 조합하여 식별됩니다." },
      { t: "시즌 카드", d: "특정 연도의 실제 성적을 기반으로 한 기본 카드입니다. 최대 +10 강화가 가능하며, 능력치 상승폭이 가장 완만합니다." },
      { t: "라이브 카드", d: "현재 시즌의 실시간 성적이 반영되는 카드로, 매주 혹은 매월 수치가 갱신됩니다. 시즌 카드보다 능력치 상승폭이 크지만, 성적 부진 시 수치가 하락할 수도 있습니다." },
      { t: "임팩트 카드", d: "특별 이벤트나 명경기 장면을 모티브로 한 한정 카드입니다. 최대 +18까지 강화할 수 있으며, 고유한 스킬 조합을 갖추고 있습니다." },
      { t: "시그니처 카드", d: "전설적인 선수나 특정 시즌의 명장면을 기념하여 발매되는 최상급 카드입니다. 능력치 상승폭이 임팩트 카드보다 큽니다." },
      { t: "골든글러브 카드", d: "각 포지션별 최고의 수비수에게 부여되는 최상위 등급 카드입니다. 게임 내 최강급 카드로 분류됩니다." },
      { t: "강화 (Enhancement)", d: "카드의 능력치를 상승시키는 시스템입니다. +0부터 시작하여 강화 재료와 비용을 투입해 단계별로 수치를 올릴 수 있습니다. 각 단계별 상승폭은 카드 종류에 따라 다릅니다." },
      { t: "특수능력 (특능)", d: "카드마다 고유하게 부여되는 파워, 정확, 선구(타자)·변화, 구위(투수) 등의 세부 능력치입니다. 강화와는 별개로 개별적으로 투자할 수 있습니다." },
      { t: "훈련 (Training)", d: "선수의 기본 능력치를 항구적으로 상승시키는 시스템입니다. 파워/정확/선구/체력/주루 등 타자 훈련과 변화/구위 등 투수 훈련으로 나뉩니다." },
      { t: "스킬 (Skill)", d: "선수 카드에 탑재된 특수 능력입니다. 예를 들어 '홈런 타자', '선풍기', '피칭 머신' 등의 스킬이 있으며, 스킬 레벨을 올리면 효과가 강화됩니다. 각 카드에는 최대 3개의 스킬이 탑재됩니다." },
      { t: "잠재력 (Potential)", d: "선수 카드의 숨겨진 능력치로, C부터 SR+까지 12개 등급으로 나뉩니다. 풀스윙/클러치(타자), 장타억제/침착(투수) 등 종류에 따라 효과가 다릅니다." },
      { t: "세트덱", d: "특정 조건(같은 시즌 연도, 같은 카드 종류, 같은 구단 등)을 만족하는 선수를 일정 수 이상 편성하면 발동되는 보너스입니다. 팀 전체의 능력치가 상승하며, 여러 세트덱을 동시에 활성화할 수도 있습니다." },
      { t: "포지션 훈련", d: "주 포지션 외의 다른 포지션에도 출전할 수 있도록 선수를 훈련시키는 시스템입니다. 라인업 구성의 유연성이 크게 증가합니다." },
      { t: "FA (Free Agent)", d: "자유 계약 선수를 의미하며, 본 사이트에서는 특정 구단에 소속되지 않은 상태로 표시되는 카드를 지칭합니다." },
      { t: "SP / RP / CP", d: "투수의 역할을 나타냅니다. SP(Starting Pitcher)는 선발, RP(Relief Pitcher)는 중계, CP(Closing Pitcher)는 마무리 투수를 의미합니다." }
    ];
    content = (
      <div style={{ color: "#c9d1d9", lineHeight: 1.8, fontSize: 14 }}>
        <p style={{ color: "#8b949e" }}>{"컴투스 프로야구 v26을 처음 접하거나 오랜만에 다시 시작하는 이용자를 위해, 본 사이트와 게임에서 자주 등장하는 용어를 정리했습니다."}</p>
        {glossary.map(function(g, i) {
          return (
            <div key={i} style={{ marginTop: 16, padding: "12px 14px", background: "rgba(255,255,255,0.02)", borderLeft: "3px solid #FFD54F", borderRadius: 6 }}>
              <p style={{ color: "#FFD54F", fontWeight: 700, margin: "0 0 4px", fontSize: 14 }}>{g.t}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#c9d1d9" }}>{g.d}</p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div onClick={p.onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: mob ? 8 : 20 }}>
      <div onClick={function(e) { e.stopPropagation(); }} style={{ width: "100%", maxWidth: 720, maxHeight: "90vh", background: "#0d1117", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "14px 18px" : "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(135deg, rgba(255,213,79,0.05), transparent)" }}>
          <h2 style={{ margin: 0, fontSize: mob ? 16 : 18, fontWeight: 900, color: "#FFD54F", fontFamily: "var(--h)", letterSpacing: 1 }}>{titleMap[p.type]}</h2>
          <button onClick={p.onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#c9d1d9", width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{"✕"}</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: mob ? "18px 20px" : "24px 32px" }}>
          {content}
        </div>
      </div>
    </div>
  );
}

function LoginPage(p) {
  var mob = useMedia("(max-width:600px)");
  var _ld = useState(false); var ld = _ld[0]; var setLd = _ld[1];
  var _guestOpen = useState(false); var guestOpen = _guestOpen[0]; var setGuestOpen = _guestOpen[1];
  var _nick = useState(""); var nick = _nick[0]; var setNick = _nick[1];
  var _modal = useState(null); var modal = _modal[0]; var setModal = _modal[1];

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

  /* ── 기능 카드 데이터 ── */
  var features = [
    { icon: "⚾", title: "라인업 구성", desc: "보유한 선수 카드를 1번 타자부터 9번 타자까지 드래그 앤 드롭으로 배치하고, 선발·중계·마무리 투수 로테이션을 자유롭게 편성할 수 있습니다. 포지션별 적합도와 타순별 기여도가 실시간으로 계산됩니다." },
    { icon: "👥", title: "선수 관리", desc: "보유 중인 모든 선수 카드를 한 곳에서 관리합니다. 이름으로 검색하면 기본 정보가 자동으로 채워지고, 강화 수치·특능·스킬 레벨·잠재력 등급을 세부적으로 입력할 수 있습니다." },
    { icon: "💪", title: "강화 계산", desc: "카드 종류(시즌·라이브·임팩트·시그니처·골든글러브)와 강화 단계에 따라 자동으로 능력치 상승분이 계산됩니다. +0부터 최대 +18까지 모든 단계의 수치가 내장되어 있어 정확한 전력 측정이 가능합니다." },
    { icon: "⭐", title: "잠재력 점수", desc: "C부터 SR+까지 12개 등급의 잠재력을 풀스윙·클러치·장타억제·침착 등 종류별로 구분하여 점수화합니다. 잠재력만으로도 카드 간 우열을 판단할 수 있습니다." },
    { icon: "📊", title: "데이터 센터", desc: "완성된 덱의 총 전력, 타순별 기여도, 스킬 분포, 포지션 균형을 종합적으로 분석합니다. 다른 이용자 평균과의 비교 백분위도 확인할 수 있어 객관적인 수준 파악이 가능합니다." },
    { icon: "🏟️", title: "세트덱 보너스", desc: "같은 시즌, 같은 카드 종류, 같은 구단 선수를 일정 수 이상 편성하면 자동으로 발동되는 세트덱 효과를 실시간으로 알려줍니다. 어떤 조합이 시너지를 내는지 한눈에 확인할 수 있습니다." },
    { icon: "🔄", title: "다중 덱 관리", desc: "Google 로그인 시 최대 5개 팀의 덱을 클라우드에 저장할 수 있습니다. 시즌 카드 덱, 임팩트 덱, 타이틀 매치용 덱 등 상황별로 구분해 관리할 수 있습니다." },
    { icon: "📱", title: "기기 간 동기화", desc: "반응형 디자인으로 PC·태블릿·스마트폰에서 모두 원활하게 작동하며, Google 로그인을 이용하면 모든 기기에서 동일한 데이터를 실시간으로 확인할 수 있습니다." }
  ];

  /* ── 팀 목록 ── */
  var teams = ["키움 히어로즈", "삼성 라이온즈", "LG 트윈스", "두산 베어스", "KT 위즈", "SSG 랜더스", "롯데 자이언츠", "한화 이글스", "NC 다이노스", "KIA 타이거즈"];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#0a0e17 0%,#1a1028 50%,#0d1117 100%)", color: "#c9d1d9" }}>

      {/* =================== HERO / LOGIN SECTION =================== */}
      <section style={{ minHeight: mob ? "auto" : "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: mob ? "40px 16px" : "60px 20px" }}>
        <div style={{ width: "100%", maxWidth: 1100, display: "grid", gridTemplateColumns: mob ? "1fr" : "1.2fr 1fr", gap: mob ? 32 : 48, alignItems: "center" }}>

          {/* Left: Hero text */}
          <div>
            <div style={{ display: "inline-block", padding: "6px 14px", background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 20, fontSize: 12, color: "#FFD54F", fontWeight: 700, letterSpacing: 2, marginBottom: 20 }}>
              {"⚾ 컴투스 프로야구 v26 전용"}
            </div>
            <h1 style={{ fontSize: mob ? 34 : 52, fontWeight: 900, margin: 0, fontFamily: "var(--h)", letterSpacing: mob ? 2 : 4, lineHeight: 1.1, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent" }}>
              {"DECK MANAGER"}
            </h1>
            <p style={{ fontSize: mob ? 15 : 18, color: "#8b949e", lineHeight: 1.6, marginTop: 16, marginBottom: 24 }}>
              {"컴투스 프로야구 v26 팬이 직접 만든 라인업 구성 및 전력 분석 도구입니다. 수많은 선수 카드 중 최적의 조합을 찾고, 강화·스킬·잠재력을 통합적으로 계산해 가장 강력한 덱을 완성하세요."}
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {["무료 이용", "Google 동기화", "최대 5개 덱 저장", "모바일 대응", "실시간 전력 계산"].map(function(t) {
                return (<span key={t} style={{ fontSize: 12, color: "#c9d1d9", background: "rgba(255,255,255,0.04)", padding: "6px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>{"✓ " + t}</span>);
              })}
            </div>
          </div>

          {/* Right: Login card (기존 UI 유지) */}
          <div style={{ width: "100%", maxWidth: 460, padding: mob ? "32px 24px" : "40px 32px", background: "rgba(15,20,30,0.92)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.6)", margin: mob ? "0 auto" : 0 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 44, marginBottom: 8 }}>{"⚾"}</div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, fontFamily: "var(--h)", letterSpacing: 3, color: "#FFD54F" }}>{"시작하기"}</h2>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6, fontFamily: "var(--m)", letterSpacing: 1 }}>{"무료 · 가입 즉시 이용 가능"}</p>
            </div>

            <button onClick={googleLogin} disabled={ld} style={{
              width: "100%", padding: "16px 24px", fontSize: 15, fontWeight: 700,
              background: "#fff", color: "#3c4043", border: "none", borderRadius: 12,
              cursor: ld ? "wait" : "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 12, minHeight: 54, marginBottom: 10,
              boxShadow: "0 2px 12px rgba(0,0,0,0.25)"
            }}>
              <svg width="22" height="22" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              {ld ? "로그인 중..." : "Google 계정으로 시작하기"}
            </button>

            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
              {["여러 팀 관리", "클라우드 저장", "기기 간 동기화"].map(function(t) {
                return (<span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.03)", padding: "3px 8px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>{t}</span>);
              })}
            </div>

            {!guestOpen ? (
              <div style={{ textAlign: "center" }}>
                <button onClick={function() { setGuestOpen(true); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 14, padding: "8px 0", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  {"게스트로 시작하기"}
                </button>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.15)", marginTop: 4 }}>{"1개 팀만 관리 가능 · 브라우저에 데이터 저장"}</p>
              </div>
            ) : (
              <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 10, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 600, marginBottom: 8 }}>{"게스트 모드"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="text" value={nick} onChange={function(e) { setNick(e.target.value); }} placeholder="닉네임 입력" onKeyDown={function(e) { if (e.key === "Enter") guestLogin(); }}
                    style={{ flex: 1, padding: "10px 14px", fontSize: 15, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", outline: "none", boxSizing: "border-box" }} />
                  <button onClick={guestLogin} disabled={ld} style={{ padding: "10px 20px", fontSize: 15, fontWeight: 800, background: ld ? "rgba(255,213,79,0.2)" : "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 8, cursor: ld ? "wait" : "pointer", color: "#1a1100", fontFamily: "var(--h)", whiteSpace: "nowrap" }}>
                    {ld ? "..." : "시작"}
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 10, padding: "8px 10px", background: "rgba(255,152,0,0.05)", borderRadius: 6, border: "1px solid rgba(255,152,0,0.1)" }}>
                  <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{"!"}</span>
                  <p style={{ fontSize: 11, color: "rgba(255,152,0,0.5)", margin: 0, lineHeight: 1.5 }}>{"게스트 데이터는 이 브라우저에만 저장됩니다. 브라우저 데이터 삭제 시 초기화될 수 있으며, 1개 팀만 관리 가능합니다. Google 계정 연동 시 여러 팀을 영구 저장할 수 있습니다."}</p>
                </div>
              </div>
            )}

            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.12)", textAlign: "center", marginTop: 24, lineHeight: 1.5 }}>
              {"로그인 시 "}
              <a onClick={function(e) { e.preventDefault(); setModal("terms"); }} href="#terms" style={{ color: "rgba(255,213,79,0.5)", textDecoration: "underline", cursor: "pointer" }}>{"서비스 이용약관"}</a>
              {" 및 "}
              <a onClick={function(e) { e.preventDefault(); setModal("privacy"); }} href="#privacy" style={{ color: "rgba(255,213,79,0.5)", textDecoration: "underline", cursor: "pointer" }}>{"개인정보처리방침"}</a>
              {"에 동의합니다"}
            </p>
          </div>
        </div>
      </section>

      {/* =================== ABOUT SECTION =================== */}
      <section style={{ padding: mob ? "48px 20px" : "80px 24px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 13, color: "#FFD54F", fontWeight: 700, letterSpacing: 3, margin: 0, fontFamily: "var(--h)" }}>{"ABOUT"}</p>
            <h2 style={{ fontSize: mob ? 26 : 34, fontWeight: 900, margin: "8px 0 0", color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2 }}>{"덱 매니저가 필요한 이유"}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 24 }}>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 0, marginBottom: 10, fontFamily: "var(--h)", letterSpacing: 1 }}>{"복잡한 카드 시스템, 한눈에"}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#c9d1d9", margin: 0 }}>{"컴투스 프로야구 v26은 시즌·라이브·임팩트·시그니처·골든글러브 등 다양한 카드 종류가 존재하며, 각 카드마다 강화 상승폭과 스킬 조합이 다릅니다. 게임 내 화면만으로 수십~수백 장의 카드를 비교하기는 사실상 불가능하죠. 덱 매니저는 이 모든 변수를 일관된 기준으로 계산하여, 어떤 선수가 실제로 가장 강한지 객관적으로 판단할 수 있게 해줍니다."}</p>
            </div>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 0, marginBottom: 10, fontFamily: "var(--h)", letterSpacing: 1 }}>{"타순 배치까지 고려한 전력 계산"}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#c9d1d9", margin: 0 }}>{"단순 스탯 합계가 아니라, 각 타순의 타격 기여도 가중치까지 반영해 실제 경기에 가까운 전력 점수를 산출합니다. 3번과 4번에 어떤 타자를 배치할지, 마무리 투수로 누구를 쓸지에 따라 총 전력이 어떻게 달라지는지 실시간으로 확인할 수 있습니다."}</p>
            </div>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 0, marginBottom: 10, fontFamily: "var(--h)", letterSpacing: 1 }}>{"세트덱 시너지를 놓치지 마세요"}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#c9d1d9", margin: 0 }}>{"같은 시즌·같은 카드 종류·같은 구단 선수를 일정 수 이상 편성하면 활성화되는 세트덱 보너스. 덱 매니저는 라인업 변경 즉시 어떤 세트덱이 켜지고 꺼지는지 알려주어, 시너지를 극대화하는 조합을 찾을 수 있도록 돕습니다."}</p>
            </div>
            <div style={{ padding: 24, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 style={{ color: "#FFD54F", fontSize: 17, marginTop: 0, marginBottom: 10, fontFamily: "var(--h)", letterSpacing: 1 }}>{"내 덱은 전체에서 어느 수준?"}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#c9d1d9", margin: 0 }}>{"데이터 센터에서는 다른 이용자들이 구성한 덱들과 익명으로 통계 비교가 가능합니다. 내 덱의 전력이 상위 몇 %에 해당하는지, 어떤 포지션이 부족한지를 백분위로 확인하며 구체적인 보강 방향을 잡을 수 있습니다."}</p>
            </div>
          </div>
        </div>
      </section>

      {/* =================== FEATURES SECTION =================== */}
      <section style={{ padding: mob ? "48px 20px" : "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 13, color: "#FFD54F", fontWeight: 700, letterSpacing: 3, margin: 0, fontFamily: "var(--h)" }}>{"FEATURES"}</p>
            <h2 style={{ fontSize: mob ? 26 : 34, fontWeight: 900, margin: "8px 0 0", color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2 }}>{"주요 기능"}</h2>
            <p style={{ fontSize: 14, color: "#8b949e", marginTop: 12 }}>{"덱 매니저가 제공하는 핵심 기능들을 소개합니다"}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {features.map(function(f, i) {
              return (
                <div key={i} style={{ padding: 22, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{f.icon}</div>
                  <h3 style={{ color: "#FFD54F", fontSize: 16, margin: "0 0 8px", fontFamily: "var(--h)", letterSpacing: 1 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: "#c9d1d9", margin: 0 }}>{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =================== HOW TO USE SECTION =================== */}
      <section style={{ padding: mob ? "48px 20px" : "80px 24px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 13, color: "#FFD54F", fontWeight: 700, letterSpacing: 3, margin: 0, fontFamily: "var(--h)" }}>{"HOW IT WORKS"}</p>
            <h2 style={{ fontSize: mob ? 26 : 34, fontWeight: 900, margin: "8px 0 0", color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2 }}>{"이용 방법"}</h2>
            <p style={{ fontSize: 14, color: "#8b949e", marginTop: 12 }}>{"3단계로 첫 덱을 완성할 수 있습니다"}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { n: "01", t: "로그인 및 팀 선택", d: "상단 로그인 카드에서 Google 계정으로 로그인하거나 게스트 모드를 이용합니다. 로그인 후 나타나는 10개의 KBO 구단 중 하나를 선택해 첫 덱을 만듭니다. 이때 고르는 팀은 단순히 덱 이름으로 사용되므로, 내가 응원하는 구단이나 기억하기 쉬운 이름을 고르시면 됩니다." },
              { n: "02", t: "선수 입력 및 강화 수치 기록", d: "'내 선수' 탭에서 보유한 선수를 하나씩 추가합니다. 선수명을 검색하면 해당 카드의 기본 정보가 자동으로 불러와지며, 이어서 강화 단계(+0~+18), 특수능력 수치, 훈련 수치, 스킬과 스킬 레벨, 잠재력 등급을 입력하면 됩니다. 모든 데이터는 입력 즉시 자동 저장됩니다." },
              { n: "03", t: "라인업 배치 및 전력 확인", d: "'라인업' 탭에서 추가한 선수들을 타순대로 배치하고 투수 로테이션을 지정합니다. 배치가 완료되면 총 전력 점수, 공격·수비·투수 세부 점수, 활성화된 세트덱 보너스가 화면에 표시됩니다. '데이터 센터'에서는 더 자세한 분석과 전체 이용자 대비 백분위를 확인할 수 있습니다." }
            ].map(function(s, i) {
              return (
                <div key={i} style={{ display: "flex", gap: mob ? 14 : 20, padding: mob ? 18 : 24, background: "rgba(255,255,255,0.02)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: mob ? 28 : 40, fontWeight: 900, fontFamily: "var(--h)", color: "#FFD54F", lineHeight: 1, flexShrink: 0, minWidth: mob ? 40 : 60 }}>{s.n}</div>
                  <div>
                    <h3 style={{ color: "#e6edf3", fontSize: mob ? 15 : 17, margin: "0 0 6px", fontFamily: "var(--h)", letterSpacing: 1 }}>{s.t}</h3>
                    <p style={{ fontSize: 13, lineHeight: 1.7, color: "#c9d1d9", margin: 0 }}>{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 28 }}>
            <button onClick={function() { setModal("guide"); }} style={{ padding: "12px 24px", fontSize: 14, background: "rgba(255,213,79,0.1)", border: "1px solid rgba(255,213,79,0.3)", borderRadius: 10, color: "#FFD54F", cursor: "pointer", fontWeight: 700, fontFamily: "var(--h)", letterSpacing: 1 }}>
              {"📖 자세한 가이드 보기"}
            </button>
          </div>
        </div>
      </section>

      {/* =================== KBO TEAMS SECTION =================== */}
      <section style={{ padding: mob ? "48px 20px" : "80px 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ fontSize: 13, color: "#FFD54F", fontWeight: 700, letterSpacing: 3, margin: 0, fontFamily: "var(--h)" }}>{"TEAMS"}</p>
            <h2 style={{ fontSize: mob ? 26 : 34, fontWeight: 900, margin: "8px 0 0", color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2 }}>{"지원 구단"}</h2>
            <p style={{ fontSize: 14, color: "#8b949e", marginTop: 12 }}>{"10개 KBO 구단을 기반으로 덱을 만들 수 있습니다"}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2,1fr)" : "repeat(5,1fr)", gap: 10 }}>
            {teams.map(function(t, i) {
              return (
                <div key={i} style={{ padding: "18px 10px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", textAlign: "center", fontSize: 13, fontWeight: 700, color: "#c9d1d9", fontFamily: "var(--h)", letterSpacing: 1 }}>
                  {t}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: "center", fontSize: 12, color: "#6e7681", marginTop: 18 }}>
            {"※ 구단 이름과 로고는 각 권리자의 상표이며, 본 서비스는 비공식 팬 제작 도구입니다."}
          </p>
        </div>
      </section>

      {/* =================== FAQ SHORT SECTION =================== */}
      <section style={{ padding: mob ? "48px 20px" : "80px 24px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 13, color: "#FFD54F", fontWeight: 700, letterSpacing: 3, margin: 0, fontFamily: "var(--h)" }}>{"FAQ"}</p>
            <h2 style={{ fontSize: mob ? 26 : 34, fontWeight: 900, margin: "8px 0 0", color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2 }}>{"자주 묻는 질문"}</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { q: "덱 매니저는 정말 무료인가요?", a: "네, 모든 핵심 기능을 영구적으로 무료로 이용할 수 있습니다. 운영 비용 충당을 위해 일부 광고가 게재되지만, 유료 플랜이나 결제는 없습니다." },
              { q: "게임 계정과 자동 연동되나요?", a: "아닙니다. 본 서비스는 컴투스의 공식 서비스가 아니므로, 게임 내 선수 정보를 자동으로 가져올 수 없습니다. 이용자가 직접 선수를 입력해야 하며, 그만큼 개인정보도 안전하게 보호됩니다." },
              { q: "내가 구성한 덱을 다른 사람이 볼 수 있나요?", a: "아닙니다. 본인이 공개하지 않는 한 타인은 내 덱을 조회할 수 없습니다. 데이터 센터의 통계 비교 기능은 모든 이용자 데이터를 익명으로 집계한 것이며, 개별 이용자를 식별할 수 없도록 처리됩니다." },
              { q: "모바일에서도 편하게 쓸 수 있나요?", a: "네, 본 사이트는 스마트폰·태블릿에 최적화된 반응형 디자인으로 제작되었습니다. 브라우저 주소창에 주소를 입력하는 것만으로 바로 이용할 수 있으며, 별도 앱 설치가 필요 없습니다." }
            ].map(function(f, i) {
              return (
                <div key={i} style={{ padding: mob ? 16 : 20, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p style={{ color: "#FFD54F", fontWeight: 700, fontSize: 14, margin: "0 0 6px" }}>{"Q. " + f.q}</p>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "#c9d1d9" }}>{"A. " + f.a}</p>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 24 }}>
            <button onClick={function() { setModal("faq"); }} style={{ padding: "12px 24px", fontSize: 14, background: "rgba(255,213,79,0.1)", border: "1px solid rgba(255,213,79,0.3)", borderRadius: 10, color: "#FFD54F", cursor: "pointer", fontWeight: 700, fontFamily: "var(--h)", letterSpacing: 1 }}>
              {"💬 더 많은 FAQ 보기"}
            </button>
          </div>
        </div>
      </section>

      {/* =================== GLOSSARY TEASER =================== */}
      <section style={{ padding: mob ? "40px 20px" : "56px 24px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: mob ? 20 : 24, fontWeight: 900, color: "#e6edf3", fontFamily: "var(--h)", letterSpacing: 2, marginTop: 0 }}>{"게임 용어가 낯설다면?"}</h2>
          <p style={{ fontSize: 14, color: "#8b949e", lineHeight: 1.7 }}>{"카드 종류, 강화 단계, 잠재력 등급 등 컴투스 프로야구 v26에서 자주 쓰는 용어를 정리해 두었습니다. 처음 접하시는 분은 용어 사전을 참고한 후 사이트를 이용하시면 훨씬 쉽습니다."}</p>
          <button onClick={function() { setModal("glossary"); }} style={{ marginTop: 16, padding: "12px 24px", fontSize: 14, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 10, color: "#1a1100", cursor: "pointer", fontWeight: 800, fontFamily: "var(--h)", letterSpacing: 1 }}>
            {"📚 용어 사전 열기"}
          </button>
        </div>
      </section>

      {/* =================== FOOTER =================== */}
      <footer style={{ padding: mob ? "32px 20px" : "48px 24px", background: "#050810", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr 1fr", gap: 28 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 22 }}>{"⚾"}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#FFD54F", fontFamily: "var(--h)", letterSpacing: 3 }}>{"DECK MANAGER"}</span>
              </div>
              <p style={{ fontSize: 12, color: "#6e7681", lineHeight: 1.7, margin: 0 }}>
                {"컴투스 프로야구 v26 이용자를 위한 라인업 구성 및 전력 분석 도구입니다. 팬이 직접 만든 비공식 프로젝트이며, 해당 게임사와 공식 제휴 관계가 없습니다."}
              </p>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#FFD54F", fontWeight: 700, margin: "0 0 10px", fontFamily: "var(--h)", letterSpacing: 2 }}>{"INFO"}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("about"); }} href="#about" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"사이트 소개"}</a></li>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("guide"); }} href="#guide" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"사용 가이드"}</a></li>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("faq"); }} href="#faq" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"자주 묻는 질문"}</a></li>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("glossary"); }} href="#glossary" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"용어 사전"}</a></li>
              </ul>
            </div>
            <div>
              <p style={{ fontSize: 12, color: "#FFD54F", fontWeight: 700, margin: "0 0 10px", fontFamily: "var(--h)", letterSpacing: 2 }}>{"LEGAL"}</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13 }}>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("privacy"); }} href="#privacy" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"개인정보처리방침"}</a></li>
                <li style={{ marginBottom: 6 }}><a onClick={function(e) { e.preventDefault(); setModal("terms"); }} href="#terms" style={{ color: "#c9d1d9", textDecoration: "none", cursor: "pointer" }}>{"이용약관"}</a></li>
                <li style={{ marginBottom: 6, color: "#6e7681", fontSize: 12, marginTop: 10 }}>{"문의:"}</li>
                <li style={{ fontSize: 12 }}><a href={"mailto:" + CONTACT_EMAIL} style={{ color: "#FFD54F", textDecoration: "none" }}>{CONTACT_EMAIL}</a></li>
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
            <p style={{ fontSize: 11, color: "#484f58", margin: 0, lineHeight: 1.6 }}>
              {"© 2026 Deck Manager. All rights reserved."}<br/>
              {"'컴투스 프로야구 v26', 'KBO', 구단명 및 선수명 등의 상표는 각 권리자에게 귀속됩니다."}<br/>
              {"본 사이트는 비영리 팬 제작 프로젝트로, 해당 권리자와 공식 제휴 관계가 없습니다."}
            </p>
          </div>
        </div>
      </footer>

      {/* =================== POLICY MODAL =================== */}
      <PolicyModal type={modal} onClose={function() { setModal(null); }} />
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
        style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--acc)",cursor:"pointer",fontSize:14,fontWeight:800,fontFamily:"var(--h)",letterSpacing:1,maxWidth:160}}>
        <span style={{fontSize:16}}>⚾</span>
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
                    style={{flex:1,display:"flex",alignItems:"center",gap:6,padding:"10px 14px",background:"transparent",border:"none",color:isCur?"var(--acc)":"var(--t1)",fontSize:14,fontWeight:isCur?800:500,cursor:"pointer",textAlign:"left"}}>
                    {isCur&&<span style={{fontSize:8}}>▶</span>}
                    <span>{d.teamName}</span>
                  </button>
                  {isDel?(
                    <div style={{display:"flex",gap:4,padding:"0 8px"}}>
                      <button onClick={function(e){e.stopPropagation();p.onDelete(d.deckId);setConfirmDel(null);setOpen(false);}}
                        style={{padding:"3px 8px",fontSize:12,background:"#c62828",border:"none",borderRadius:4,color:"#fff",cursor:"pointer",fontWeight:700}}>{"삭제"}</button>
                      <button onClick={function(e){e.stopPropagation();setConfirmDel(null);}}
                        style={{padding:"3px 8px",fontSize:12,background:"rgba(255,255,255,0.08)",border:"none",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"취소"}</button>
                    </div>
                  ):(
                    <button onClick={function(e){e.stopPropagation();setConfirmDel(d.deckId);}}
                      title="덱 삭제"
                      style={{padding:"0 10px",height:"100%",background:"transparent",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:16,lineHeight:1}}
                      onMouseEnter={function(e){e.currentTarget.style.color="#ef5350";}}
                      onMouseLeave={function(e){e.currentTarget.style.color="rgba(255,255,255,0.2)";}}
                    >{"✕"}</button>
                  )}
                </div>
              );
            })}
            {canAdd&&(
              <button onClick={function(){p.onAdd();setOpen(false);}}
                style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"10px 14px",background:"transparent",border:"none",color:"#81C784",fontSize:14,fontWeight:700,cursor:"pointer",textAlign:"left"}}>
                <span>{"＋ 덱 추가"}</span>
                <span style={{fontSize:11,color:"var(--td)"}}>{(p.decks||[]).length+"/5"}</span>
              </button>
            )}
            {!canAdd&&(
              <div style={{padding:"8px 14px",fontSize:12,color:"var(--td)",textAlign:"center"}}>{"최대 5개 · ✕ 버튼으로 삭제 가능"}</div>
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
        <span style={{fontSize:12,fontWeight:900,fontFamily:"var(--h)",background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",whiteSpace:"nowrap"}}>{"DECK"}</span>
        <DeckDropdown {...deckProps}/>
        <button onClick={p.toggleTheme} title={p.theme==="light"?"다크 모드":"라이트 모드"} style={{marginLeft:"auto",padding:"4px 8px",fontSize:13,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:5,color:"var(--t2)",cursor:"pointer",flexShrink:0,lineHeight:1}}>{p.theme==="light"?"🌙":"☀️"}</button>
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"var(--side)",borderTop:"1px solid var(--bd)",display:"flex",padding:"6px 0 8px"}}>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 0",background:"none",border:"none",color:p.tab===t.id?"var(--acc)":"var(--td)",cursor:"pointer",minHeight:44}}><span style={{fontSize:18}}>{t.icon}</span><span style={{fontSize:11,fontWeight:p.tab===t.id?700:500}}>{t.label}</span></button>);})}
      </div>
    </React.Fragment>
  );}

  if(p.tablet){return(
    <React.Fragment>
      <button onClick={function(){setOpen(!open);}} style={{position:"fixed",top:10,left:10,zIndex:200,width:40,height:40,borderRadius:8,background:"var(--card)",border:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"var(--t1)"}}>{open?"✕":"☰"}</button>
      {open&&(<div onClick={function(){setOpen(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:150}}/>)}
      <div style={{position:"fixed",left:open?0:-260,top:0,bottom:0,width:240,background:"var(--side)",borderRight:"1px solid var(--bd)",zIndex:160,transition:"left 0.25s ease",display:"flex",flexDirection:"column",padding:"14px 0 16px"}}>
        <div style={{padding:"0 14px 12px"}}><DeckDropdown {...deckProps}/></div>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"12px 16px",background:p.tab===t.id?"var(--ta)":"transparent",border:"none",borderLeft:p.tab===t.id?"3px solid var(--acc)":"3px solid transparent",color:p.tab===t.id?"var(--t1)":"var(--t2)",fontSize:14,fontWeight:p.tab===t.id?700:500,cursor:"pointer",textAlign:"left",minHeight:44}}><span style={{fontSize:16}}>{t.icon}</span>{t.label}</button>);})}
        <div style={{marginTop:"auto",padding:"12px 16px",borderTop:"1px solid var(--bd)"}}>
          {p.isAdmin&&(<div style={{fontSize:11,color:"var(--acc)",marginBottom:8,padding:"4px 0"}}>{"👑 관리자"}</div>)}
          <button onClick={p.toggleTheme} style={{width:"100%",padding:7,fontSize:12,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t2)",cursor:"pointer",marginBottom:6}}>{p.theme==="light"?"🌙 다크 모드":"☀️ 라이트 모드"}</button>
          <button onClick={p.logout} style={{width:"100%",padding:7,fontSize:12,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"로그아웃"}</button>
        </div>
      </div>
    </React.Fragment>
  );}

  return(
    <div style={{width:200,minHeight:"100vh",background:"var(--side)",borderRight:"1px solid var(--bd)",display:"flex",flexDirection:"column",padding:"14px 0",flexShrink:0}}>
      <div style={{padding:"0 14px",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><span style={{fontSize:18}}>{"⚾"}</span><div><div style={{fontSize:13,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:"transparent"}}>{"DECK MANAGER"}</div><div style={{fontSize:7,color:"var(--td)",letterSpacing:1}}>{"COM2US PRO BASEBALL v26"}</div></div></div>
        <DeckDropdown {...deckProps}/>
      </div>
      <div style={{flex:1}}>
        {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);}} style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"10px 14px",background:p.tab===t.id?"var(--ta)":"transparent",border:"none",borderLeft:p.tab===t.id?"3px solid var(--acc)":"3px solid transparent",color:p.tab===t.id?"var(--t1)":"var(--t2)",fontSize:13,fontWeight:p.tab===t.id?700:500,cursor:"pointer",textAlign:"left",minHeight:40}}><span style={{fontSize:15}}>{t.icon}</span>{t.label}</button>);})}
      </div>
      <div style={{padding:"10px 14px",borderTop:"1px solid var(--bd)"}}>
        {p.isAdmin&&(<div style={{fontSize:11,color:"var(--acc)",marginBottom:8,padding:"4px 0"}}>{"👑 관리자"}</div>)}
        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
          {p.authType==="google"?(
            <div style={{width:26,height:26,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <svg width="14" height="14" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            </div>
          ):(
            <div style={{width:26,height:26,borderRadius:"50%",background:"linear-gradient(135deg,#FFD54F,#FF8F00)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#1a1100"}}>{p.user[0]}</div>
          )}
          <div><div style={{fontSize:12,fontWeight:700,color:"var(--t1)"}}>{p.user}</div><div style={{fontSize:9,color:"var(--td)"}}>{p.authType==="google"?"Google 계정":"게스트"}</div></div>
        </div>
        <button onClick={p.toggleTheme} style={{width:"100%",padding:5,fontSize:11,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--t2)",cursor:"pointer",marginBottom:4}}>{p.theme==="light"?"🌙 다크 모드":"☀️ 라이트 모드"}</button>
        <button onClick={p.logout} style={{width:"100%",padding:5,fontSize:11,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:4,color:"var(--td)",cursor:"pointer"}}>{"로그아웃"}</button>
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
        {Object.keys(ENHANCE).map(function(ct){return(<button key={ct} onClick={function(){setVt(ct);}} style={{padding:"6px 12px",borderRadius:5,fontSize:13,fontWeight:ct===vt?800:500,background:ct===vt?"var(--ta)":"var(--inner)",color:ct===vt?"var(--acc)":"var(--t2)",border:ct===vt?"1px solid var(--acc)":"1px solid var(--bd)",cursor:"pointer"}}>{ct}</button>);})}
      </div>
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>
              <th style={{padding:"8px 10px",textAlign:"left",color:"var(--td)",borderBottom:"1px solid var(--bd)",fontWeight:600}}>{"능력치"}</th>
              {hdrs.map(function(h){return(<th key={h} style={{padding:"8px 6px",textAlign:"center",color:"var(--td)",borderBottom:"1px solid var(--bd)",fontWeight:600,fontFamily:"var(--m)",fontSize:12,whiteSpace:"nowrap"}}>{h}</th>);})}
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
        <span style={{ fontSize: 11, color: color, fontWeight: 700 }}>{label}</span>
        <input type="number" value={val || 0} onChange={function(e) { upd(key, parseInt(e.target.value) || 0); }}
          style={{ width: 30, padding: "3px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid " + color + "44", borderRadius: 3, color: color, fontSize: 13, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />
      </div>
    );
  };

  /* POTM roster - 전역(GLOBAL_POTM_LIST)에서 읽고 관리자만 쓸 수 있음
     props.potmList / props.setPotmList 로 받아 React state와 동기화 */
  var potmList = p.potmList || [];
  var _potmSearch = useState(""); var potmSearch = _potmSearch[0]; var setPotmSearch = _potmSearch[1];
  var _potmSearchOpen = useState(false); var potmSearchOpen = _potmSearchOpen[0]; var setPotmSearchOpen = _potmSearchOpen[1];

  var addPotmPlayer = function(sp) {
    if (!isAdmin) return;
    var already = potmList.some(function(x) { return x.name === sp.name && x.team === (sp.team||""); });
    if (already) return;
    /* 이름+팀 저장 - 동일 이름·동일 팀 선수에게만 POTM 적용 */
    var next = potmList.concat([{name: sp.name, team: sp.team || ""}]);
    if (p.setPotmList) p.setPotmList(next);
    setPotmSearch(""); setPotmSearchOpen(false);
  };
  var rmPotm = function(idx) {
    if (!isAdmin) return;
    var next = potmList.filter(function(_, i) { return i !== idx; });
    if (p.setPotmList) p.setPotmList(next);
  };
  var clearPotm = function() {
    if (!isAdmin) return;
    if (p.setPotmList) p.setPotmList([]);
  };

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
            <span style={{ fontSize: 16 }}>{"👑"}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--acc)", fontFamily: "var(--h)" }}>{"타자 주장"}</span>
          </div>
          <select value={batCapId} onChange={function(e) { upd("capBatId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupBats.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + (pl.subPosition ? " (" + pl.subPosition + ")" : "")}</option>); })}
          </select>
          {batCap && (<div style={{ padding: "6px 8px", background: "var(--ta)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={batCap.cardType} /><span style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{batCap.name}</span><span style={{ fontSize: 16, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (주장 본인에게만 적용)"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {miniStat("파", "#EF5350", "capBatP", sdState.capBatP)}
            {miniStat("정", "#42A5F5", "capBatA", sdState.capBatA)}
            {miniStat("선", "#66BB6A", "capBatE", sdState.capBatE)}
          </div>
        </div>

        {/* 투수 주장 */}
        <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 16 }}>{"👑"}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--acp)", fontFamily: "var(--h)" }}>{"투수 주장"}</span>
          </div>
          <select value={pitCapId} onChange={function(e) { upd("capPitId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupPits.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + (pl.subPosition ? " (" + pl.subPosition + ")" : "")}</option>); })}
          </select>
          {pitCap && (<div style={{ padding: "6px 8px", background: "rgba(206,147,216,0.06)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pitCap.cardType} /><span style={{ fontWeight: 700, fontSize: 14, color: "var(--t1)" }}>{pitCap.name}</span><span style={{ fontSize: 16, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (주장 본인에게만 적용)"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {miniStat("변", "#AB47BC", "capPitC", sdState.capPitC)}
            {miniStat("구", "#FF7043", "capPitS", sdState.capPitS)}
          </div>
        </div>
      </div>

      {/* 유니폼 효과 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 16 }}>{"👕"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"유니폼 효과"}</span>
          <span style={{ fontSize: 11, color: "var(--td)", marginLeft: 4 }}>{"(모든 선수 적용)"}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{k:"uniP",l:"파워",c:"#EF5350"},{k:"uniA",l:"정확",c:"#42A5F5"},{k:"uniE",l:"선구",c:"#66BB6A"},{k:"uniC",l:"변화",c:"#AB47BC"},{k:"uniS",l:"구위",c:"#FF7043"}].map(function(s) {
            return (
              <div key={s.k} style={{ background: "var(--inner)", borderRadius: 6, padding: "8px 10px", border: "1px solid " + s.c + "22", textAlign: "center" }}>
                <div style={{ fontSize: 11, color: s.c, fontWeight: 700, marginBottom: 4 }}>{s.l}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                  <span style={{ fontSize: 14, color: s.c }}>{"+"}</span>
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
            <span style={{ fontSize: 16 }}>{"🌟"}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#FFD54F", fontFamily: "var(--h)" }}>{"POTM (이달의 선수)"}</span>
          </div>
          <button onClick={clearPotm} disabled={!isAdmin} style={{ padding: "3px 8px", fontSize: 8, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 3, color: "#EF5350", cursor: isAdmin ? "pointer" : "not-allowed", opacity: isAdmin ? 1 : 0.4, display: isAdmin ? "block" : "none" }}>{"명단 초기화"}</button>
        </div>

        {/* Admin: manage POTM roster - 선수도감 검색 */}
        {isAdmin && (
          <div style={{ padding: 10, background: "var(--inner)", borderRadius: 8, border: "1px solid var(--bd)", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>{"관리자: POTM 선수 지정 (선수도감 검색)"}</div>
            <div style={{ position: "relative", marginBottom: 8 }} onBlur={function(e) { if (!e.currentTarget.contains(e.relatedTarget)) setPotmSearchOpen(false); }}>
              <input type="text" value={potmSearch} onChange={function(e) { setPotmSearch(e.target.value); setPotmSearchOpen(true); }}
                onFocus={function() { setPotmSearchOpen(true); }}
                placeholder="선수 이름 또는 팀 검색..."
                style={{ width: "100%", padding: "7px 10px", fontSize: 14, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none", boxSizing: "border-box" }} />
              {potmSearchOpen && potmSearchResults.length > 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 8, marginTop: 4, maxHeight: 200, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
                  {potmSearchResults.map(function(sp) {
                    var already = potmList.some(function(x) { return x.name === sp.name && x.team === (sp.team||""); });
                    return (
                      <div key={sp.name} onMouseDown={function(e) { e.preventDefault(); if (!already) addPotmPlayer(sp); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--bd)", cursor: already ? "not-allowed" : "pointer", opacity: already ? 0.4 : 1 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>{sp.name}</span>
                        {already && <span style={{ fontSize: 11, color: "var(--acc)", marginLeft: "auto" }}>{"등록됨"}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              {potmSearchOpen && potmSearch.trim().length >= 1 && potmSearchResults.length === 0 && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 8, marginTop: 4, padding: "10px 12px", fontSize: 13, color: "var(--td)" }}>{"검색 결과 없음"}</div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {potmList.map(function(pl, i) {
                return (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 4, fontSize: 12, color: "var(--acc)" }}>
                  {pl.name}{pl.team && <span style={{fontSize:11,color:"var(--td)",marginLeft:3}}>{"("+pl.team+")"}</span>}
                  <button onClick={function() { rmPotm(i); }} style={{ background: "none", border: "none", color: "rgba(239,83,80,0.6)", cursor: "pointer", fontSize: 12, padding: 0, marginLeft: 2 }}>{"×"}</button>
                </span>);
              })}
              {potmList.length === 0 && (<span style={{ fontSize: 12, color: "var(--td)" }}>{"등록된 POTM 선수가 없습니다"}</span>)}
            </div>
          </div>
        )}

        {/* 일반 유저용 POTM 명단 표시 (읽기 전용) */}
        {!isAdmin && potmList.length > 0 && (
          <div style={{ padding: 10, background: "var(--inner)", borderRadius: 8, border: "1px solid var(--bd)", marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>{"이번 달 POTM 선수 명단"}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {potmList.map(function(pl, i) {
                return (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 4, fontSize: 12, color: "var(--acc)" }}>
                  {pl.name}{pl.team && <span style={{fontSize:11,color:"var(--td)",marginLeft:3}}>{"("+pl.team+")"}</span>}
                </span>);
              })}
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
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{"🌟"}</span>
                  <Badge type={pl.cardType} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{pl.name}</div>
                    <div style={{ fontSize: 11, color: "var(--td)" }}>{ct + (stars ? " " + stars + "성" : "") + (pl.team ? " · " + pl.team : "")}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    {isSpecial ? (
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: "rgba(171,71,188,0.12)", color: "#CE93D8", fontWeight: 700 }}>{"스페셜 POTM"}</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: "1px 6px", borderRadius: 3, background: "rgba(255,213,79,0.12)", color: "#FFD54F", fontWeight: 700 }}>{"POTM"}</span>
                    )}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {statBonus > 0 && (
                        <span style={{ fontSize: 12, color: "#66BB6A", fontFamily: "var(--m)", fontWeight: 700 }}>
                          {"능력치 +" + statBonus + (isSpecial ? " (팀일치)" : teamMatch ? "" : " (50%)")}
                        </span>
                      )}
                      {statBonus === 0 && isSpecial && !teamMatch && (
                        <span style={{ fontSize: 12, color: "var(--td)" }}>{"팀 불일치 — 효과 없음"}</span>
                      )}
                      {setDelta > 0 && (
                        <span style={{ fontSize: 12, color: "#FF9800", fontFamily: "var(--m)", fontWeight: 700 }}>{"세트덱 +" + setDelta}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: "center", color: "var(--td)", fontSize: 13 }}>
            {potmList.length > 0 ? "내 선수 중 매칭되는 POTM 선수가 없습니다" : "관리자가 POTM 명단을 등록하면 자동으로 매칭됩니다"}
          </div>
        )}
      </div>

      {/* 데이터 관리 */}
      <div style={{ background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>{"💾"}</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"데이터 관리"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10 }}>
          {/* JSON 백업 */}
          <button onClick={function() {
            var data = { players: players, lineupMap: lm, sdState: sdState, skills: p.skills, version: 10, exportDate: new Date().toISOString() };
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a"); a.href = url; a.download = "deck-backup-" + new Date().toISOString().slice(0,10) + ".json"; a.click(); URL.revokeObjectURL(url);
          }} style={{ padding: "12px", background: "linear-gradient(135deg,rgba(76,175,80,0.08),rgba(76,175,80,0.02))", border: "1px solid rgba(76,175,80,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#4CAF50" }}>{"📥 JSON 백업 내보내기"}</div>
            <div style={{ fontSize: 11, color: "var(--td)", marginTop: 4 }}>{"선수, 라인업, 세트덱, 스킬 전체 데이터"}</div>
          </button>

          {/* JSON 복원 */}
          <label style={{ padding: "12px", background: "linear-gradient(135deg,rgba(66,165,245,0.08),rgba(66,165,245,0.02))", border: "1px solid rgba(66,165,245,0.2)", borderRadius: 8, cursor: "pointer", textAlign: "left", display: "block" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#42A5F5" }}>{"📤 JSON 백업 복원"}</div>
            <div style={{ fontSize: 11, color: "var(--td)", marginTop: 4 }}>{"이전에 내보낸 JSON 파일로 복원"}</div>
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
    /* 연도가 없으면 → 임팩트 (인식실패 포함).
       단, 라이브/올스타가 연도 없이 오면 인식실패. */
    if (!year) {
      if (ct === '라이브' || ct === '올스타') {
        return Object.assign({}, p, { cardType: '인식실패' });
      }
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
    isBat ? '주전 타자 **9명 전원**을 빠짐없이 분석하세요. 9개 포지션(C, 1B, 2B, 3B, SS, LF, CF, RF, DH) 모두 필수. 특히 화면 외곽/아래쪽에 위치한 외야수(CF/RF)와 지명타자(DH)는 놓치기 쉬우니 반드시 확인. 하단 후보 선수(밴치)만 무시하세요.' : '화면에 보이는 투수 카드를 모두 분석하세요.',
    '',
    '【선수 카드의 표준 구조 — 각 영역에 정해진 요소가 있다】',
    '모든 선수 카드는 동일한 레이아웃을 갖는다. 각 영역의 색상/요소만 보면 카드 타입이 결정된다.',
    '※ 중요 전제: 카드 상단의 별(★) 자체는 모든 카드 타입에서 공통으로 분홍색이다. 별 색상은 판정 기준이 아니다. 판정에 쓰는 색은 **영역의 배경/여백 색**이다.',
    '',
    '  ┌─────────────────┐',
    '  │[A]  ★★★★★  [팀로고]│ ← A영역: 좌측 상단 모서리 배경 (별 자체 X, 별 주변 여백 O)',
    '  │            (우측상단)│ ← B영역(상단-오른쪽): 팀 로고 주변',
    '  │                   │',
    '  │    [선수 사진]     │',
    '  │                   │',
    '  │  [LIVE Vx] (있으면) │ ← C영역(중단): LIVE 배지 위치',
    '  │  ─────────────── │',
    '  │    ⚾              │ ← 이름 첫글자 위 황금 야구공(있으면 골든글러브)',
    '  │ [▓] 선수이름\'연도 [▓]│ ← D영역(카드 하단부 전체): 이름+연도 주변',
    '  │ [▓▓▓▓▓▓▓▓▓▓▓▓▓] │     골든글러브면 이 하단부가 노랑/황금/겨자색',
    '  └─────────────────┘',
    '',
    '【카드 타입별 위치-기반 판정 규칙】',
    '각 카드를 볼 때 아래 순서대로 체크하라. 하나라도 해당하면 확정.',
    '',
    '[1] 임팩트 판정 (가장 먼저 확인)',
    '   체크: D영역에 연도 숫자(\u201824, \u201818 등)가 **없음** → [임팩트] 확정.',
    '   → 연도가 있으면 [2]로.',
    '',
    '[2] 라이브 판정',
    '   체크: C영역(이름 바로 위)에 "LIVE V1" / "LIVE V2" / "LIVE V3" 텍스트가 들어간 사각 배지가 있음 → [라이브] 확정.',
    '   - 배지 색상: V1=초록, V2=파랑, V3=붉은색 (색상 무관, 텍스트가 판정 기준).',
    '   - 검출한 버전(V1/V2/V3)은 반드시 그대로 기록.',
    '   → 해당 안 되면 [3]으로.',
    '',
    '[3] 골든글러브 판정 ★ 시그니처보다 먼저 확인 ★',
    '   아래 **두 조건 중 하나라도** 해당하면 → [골든글러브] 확정.',
    '',
    '   ◆ 조건 A: 이름 주변 색감',
    '   - **카드 하단부 — 선수 이름 주변(이름 좌우 빈 공간 + 이름 아래 여백)** 이 **노랑/황금/겨자색 계통**으로 채워져 있음.',
    '   - 해당 색감: 밝은 노랑, 황금빛, 겨자색(노랑+검정 섞인 탁한 노랑), 황토색, 진노랑 모두 포함.',
    '',
    '   ◆ 조건 B: 황금 야구공 아이콘',
    '   - **선수 이름의 첫 글자 바로 위쪽에 작은 황금색 야구공(또는 글러브+공) 아이콘**이 있음.',
    '   - 이 황금 야구공 아이콘은 골든글러브 카드에만 존재하는 고유 장식이다.',
    '',
    '   → 조건 A 또는 B 중 하나라도 해당하면 [골든글러브] 확정.',
    '   ※ A영역(좌측 상단)의 별은 모든 카드에서 공통 분홍색이니 무시. 조건 A(하단부 색)와 조건 B(황금 야구공) 두 가지만 본다.',
    '   → 둘 다 해당 안 되면 [4]로.',
    '',
    '[4] 시그니처 판정 (A영역 기반)',
    '   체크: **A영역 = 카드의 좌측 상단 모서리 "배경"**. 별 자체가 아니라 **별 주변의 배경색**이 **핑크/분홍/마젠타/로즈 계열**임 → [시그니처] 확정.',
    '   ※ 매우 중요: 모든 카드 타입의 별(★)은 공통적으로 분홍색이다. 별 색상은 판정 기준이 아니다. 판정 기준은 **별 뒤 배경/별 옆 여백 공간의 색상**이다.',
    '   - 좌측 상단 모서리 배경이 핑크/분홍/로즈 톤으로 물들어 있으면 시그니처.',
    '   - 좌측 상단 모서리 배경이 흰색/하양이면 국가대표.',
    '   - 보조 단서: 카드에 핑크/빨강 필기체 "Sig" 또는 "Signature" 텍스트가 보이면 시그니처 확정.',
    '   ※ 재확인: (a) 카드 하단부 이름 주변이 노랑/황금/겨자색이거나, (b) 이름 첫 글자 위에 황금 야구공 아이콘이 있으면 그건 시그니처가 아니라 골든글러브다([3]에서 이미 확정됐어야 함). 혹시 [3]을 놓쳤다면 이 단계에서 골든글러브로 정정.',
    '   → 해당 안 되면 [5]로.',
    '',
    '[5] 국가대표 판정 (B영역 기반)',
    '   체크: B영역(우측 상단 팀 로고 주변 - 위/왼쪽/아래 방향, 오른쪽 제외)이 **하얀색/흰빛** 영역으로 둘러싸여 있음 → [국가대표] 확정.',
    '   - 팀 로고가 하얀색 배경 위에 올라가 있거나, 팀 로고 주변이 하얗게 처리되어 있으면 국가대표.',
    '   - 태극 문양이나 "KOREA"/"대한민국" 텍스트가 보이면 추가 확증.',
    '   → 해당 안 되면 [6]으로.',
    '',
    '[6] 올스타 판정',
    '   [1]~[5] 어느 것에도 해당 안 되는 경우, **D영역의 연도가 반드시 "25"여야** [올스타] 확정.',
    '   - 올스타는 현재 25연도 선수만 도감에 존재함 (예: 김도영\u201825, 박병호\u201825).',
    '   - 연도가 25가 아닌데 [1]~[5] 어느 것에도 해당 안 되는 경우 → [인식실패].',
    '   - 즉, 올스타는 "D영역 연도 = 25" + "[1]~[5] 모두 해당 안 됨" 두 조건을 동시에 만족해야 함.',
    '',
    '[7] 인식실패',
    '   위 [1]~[6] 어느 것에도 해당 안 되면 → [인식실패].',
    '',
    '【핵심 요약 — 판정 순서대로】',
    '- D영역 연도 없음 → 임팩트',
    '- C영역 LIVE Vx 배지 → 라이브',
    '- **(a) 카드 하단부 이름 주변이 노랑/황금/겨자색** OR **(b) 이름 첫글자 위에 황금 야구공 아이콘** → 골든글러브 ★ 시그니처보다 먼저 체크',
    '- A영역(좌측 상단 모서리 "배경") 핑크 → 시그니처 (별 자체의 핑크 색은 무시! 배경만 본다)',
    '- B영역(팀 로고 주변 - 오른쪽 제외) 하양 → 국가대표',
    '- 위 모두 아님 + **D영역 연도가 "25"** → 올스타',
    '- 위 모두 아님 + D영역 연도가 25 아님 → 인식실패',
    '',
    '【판정 시 주의사항】',
    '- 선수 얼굴/몸/유니폼 색상은 판정에 사용하지 말 것. 오직 카드 프레임·배경·위 지정된 영역의 색상만 본다.',
    '- 이름 위 LIVE Vx 배지는 매우 명확하므로 반드시 정확히 판독. 버전(V1/V2/V3) 정확 기록 필수.',
    '- 라이브 배지의 V2(파랑) 색상을 "파란 카드 = 올스타"로 착각하지 말 것. 배지 텍스트 "LIVE V2"가 있으면 라이브.',
    '- 올스타는 반드시 연도가 "25"인 경우에만 가능. 25가 아닌데 [1]~[5]에도 안 걸리면 주저 없이 [인식실패]로 판정.',
    isBat
      ? '- 타자 카드에서 [1]~[5] 판정이 애매하면 [골든글러브]로 판정 (가장 흔함). 올스타는 연도 25 확인 필수.'
      : '- 투수 카드에서 [1]~[5] 판정이 애매하면 [시그니처]로 판정 (가장 흔함). 올스타는 연도 25 확인 필수.',
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
  var isBat = (scanned.role||'') === '타자';
  /* 자동교정용 fallback 우선순위 - 포지션별 빈도 반영.
     - 타자: 골든글러브 > 시그니처 > 국가대표 > 라이브 순으로 많이 사용됨.
     - 투수: 시그니처 > 골든글러브 > 국가대표 > 라이브 순으로 많이 사용됨. (임팩트는 이미 분리됨)
     따라서 도감 매칭 실패 시 이 순서대로 재탐색. */
  var FALLBACK_ORDER = isBat
    ? ['골든글러브', '시그니처', '국가대표', '라이브']
    : ['시그니처', '골든글러브', '국가대표', '라이브'];
  /* 인식실패 카드:
     - 연도 없음 → correctCardType에서 이미 임팩트로 변환됨 (여기 안 옴)
     - 연도 있음 → 포지션별 FALLBACK_ORDER 순서로 이름+연도 매칭 시도 */
  if (!ct || ct === '인식실패') {
    if (nm && yr) {
      for (var fui = 0; fui < FALLBACK_ORDER.length; fui++) {
        var tryTypeUnk = FALLBACK_ORDER[fui];
        var match = SEED_PLAYERS.find(function(sp) {
          if ((sp.cardType||'') !== tryTypeUnk) return false;
          if (!nameSimilar(sp.name||'', nm)) return false;
          return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
        });
        if (match) return { seed: match, candidates: [], fallback: tryTypeUnk };
      }
    }
    return { seed: null, candidates: [], failed: true };
  }
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
  /* 3차: 카드종류 오인식 보정 - 상단 FALLBACK_ORDER(포지션별 빈도)대로 이름+연도 탐색.
     이 fallback으로 매칭된 경우 "확인 필요" 표시를 위해 fallback 플래그 세팅. */
  for (var fi = 0; fi < FALLBACK_ORDER.length; fi++) {
    var tryCt = FALLBACK_ORDER[fi];
    if (tryCt === ct) continue; /* 이미 1,2차에서 시도한 종류는 건너뜀 */
    var fbMatch = SEED_PLAYERS.find(function(sp) {
      if ((sp.cardType||'') !== tryCt) return false;
      if (!nameSimilar(sp.name||'', nm)) return false;
      return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
    });
    if (fbMatch) return { seed: fbMatch, candidates: [], fallback: tryCt };
  }
  /* 4차: 위 4개 타입 외의 다른 카드종류에서 이름+연도 탐색 (올스타 등) */
  var otherCt = SEED_PLAYERS.find(function(sp) {
    if (!nameSimilar(sp.name||'', nm)) return false;
    return (sp.year||'') === yr || (sp.year||'').replace(/'\d+/,'') === yr;
  });
  if (otherCt) return { seed: otherCt, candidates: [], fallback: otherCt.cardType };
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
      r.onload = function(e) {
        /* 가로 1500px 내외로 리사이징 (인식률 우선, 토큰 다소 증가 허용) */
        var originalSrc = e.target.result;
        var img = new Image();
        img.onload = function() {
          var maxW = 1500;
          var w = img.width; var h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          var resized = canvas.toDataURL('image/jpeg', 0.95);
          res({ src: resized, base64: resized.split(',')[1], mediaType: 'image/jpeg', name: file.name });
        };
        img.onerror = function() { rej(new Error('이미지 로드 실패')); };
        img.src = originalSrc;
      };
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
  var BOX = { background:'var(--card)', border:'1px solid var(--bd)', borderRadius:16, width:'100%', maxWidth:540, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.7)' };
  var HDR = { padding:'18px 24px 14px', borderBottom:'1px solid var(--bd)', display:'flex', justifyContent:'space-between', alignItems:'flex-start' };
  var BODY = { padding:'18px 24px 24px', display:'flex', flexDirection:'column', gap:14 };
  var BTN_P = { background:'linear-gradient(135deg,#4ade80,#22c55e)', color:'#000', fontWeight:900, fontSize:15, padding:'10px 20px', borderRadius:8, border:'none', cursor:'pointer' };
  var BTN_G = { background:'transparent', border:'1px solid var(--bd)', color:'var(--t2)', fontSize:14, padding:'9px 16px', borderRadius:8, cursor:'pointer' };

  return (
    React.createElement('div', {style:OVERLAY, onClick:onClose},
      React.createElement('div', {style:BOX, onClick:function(e){e.stopPropagation();}},
        // Header
        React.createElement('div', {style:HDR},
          React.createElement('div', null,
            React.createElement('div', {style:{fontSize:13,fontWeight:900,background:'linear-gradient(135deg,#00d4ff,#0080ff)',color:'#000',display:'inline-block',padding:'1px 7px',borderRadius:3,letterSpacing:1,marginBottom:6}}, 'AI SCANNER'),
            React.createElement('div', {style:{fontSize:17,fontWeight:900,color:'#e2e8f0'}}, '선수 일괄 업데이트'),
            React.createElement('div', {style:{fontSize:13,color:'#64748b',marginTop:2}}, '라인업 캡처 → 선수도감 매칭 → 내 선수 자동 등록')
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
                    React.createElement('span', {style:{fontSize:12,fontWeight:900,padding:'1px 6px',borderRadius:3,background:lbl.color+'22',color:lbl.color,border:'1px solid '+lbl.color+'44'}}, '화면'+(i+1)),
                    React.createElement('span', {style:{fontSize:13,fontWeight:700,color:'#e2e8f0'}}, lbl.title),

                  ),
                  React.createElement('div', {
                    style:{border:'2px dashed '+(img?lbl.color+'88':'var(--bd)'),borderRadius:9,background:'var(--bg)',minHeight:110,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:8,transition:'all 0.2s'},
                    onClick:function(idx){return function(){fileRefs[idx].current&&fileRefs[idx].current.click();};}(i),
                    onDragOver:function(e){e.preventDefault();},
                    onDrop:function(idx){return function(e){e.preventDefault();var f=e.dataTransfer.files[0];if(f)handleFile(idx,f);};}(i)
                  },
                    React.createElement('input', {ref:fileRefs[i],type:'file',accept:'image/*',style:{display:'none'},onChange:function(idx){return function(e){if(e.target.files[0])handleFile(idx,e.target.files[0]);};}(i)}),
                    img
                      ? React.createElement('img', {src:img.src,alt:'',style:{maxWidth:'100%',maxHeight:120,objectFit:'contain',borderRadius:5}})
                      : React.createElement('div', {style:{display:'flex',flexDirection:'column',alignItems:'center',gap:4}},
                          React.createElement('div', {style:{position:'relative'}},
                            React.createElement('img', {src:SCAN_THUMBS[i],alt:'예시',style:{height:90,objectFit:'contain',borderRadius:4,opacity:0.5,border:'1px solid var(--bd)'}}),
                            React.createElement('div', {style:{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.3)',borderRadius:4}},
                              React.createElement('span', {style:{fontSize:11,color:'#e2e8f0',fontWeight:700,textAlign:'center',padding:'2px 4px',background:'rgba(0,0,0,0.5)',borderRadius:3}}, '예시')
                            )
                          ),
                          React.createElement('div', {style:{fontSize:11,color:'#64748b'}}, '클릭 또는 드래그')
                        )
                  ),
                  img&&React.createElement('div', {style:{fontSize:12,color:'#22c55e'}}, '✓ '+img.name)
                );
              })
            ),
            err&&React.createElement('div', {style:{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:14,color:'#fca5a5'}}, '⚠️ '+err),
            React.createElement('div', {style:{display:'flex',gap:10}},
              React.createElement('button', {style:{...BTN_P,opacity:imgs[0]?1:0.35,cursor:imgs[0]?'pointer':'not-allowed'},disabled:!imgs[0],onClick:runScan},
                '🔍 분석 시작' + (imgs[0]&&imgs[2]?' (타자+투수)':imgs[0]?' (타자만)':'')
              ),
              (imgs[0]||imgs[1]||imgs[2]||imgs[3])&&React.createElement('button', {style:BTN_G,onClick:function(){setImgs([null,null,null,null]);setErr('');}}, '초기화')
            )
          ),

          // Scanning
          step === 'scanning' && React.createElement('div', {style:{display:'flex',alignItems:'center',gap:14,padding:'24px 0',justifyContent:'center'}},
            React.createElement('div', {style:{width:24,height:24,border:'3px solid var(--bd)',borderTopColor:'#00d4ff',borderRadius:'50%',animation:'spin 0.8s linear infinite',flexShrink:0}}),
            React.createElement('div', null,
              React.createElement('div', {style:{color:'#e2e8f0',fontWeight:600,fontSize:15}}, msg),
              React.createElement('div', {style:{color:'#64748b',fontSize:13,marginTop:3}}, '잠시만 기다려주세요…')
            )
          ),

          // Review
          step === 'review' && React.createElement(React.Fragment, null,
            React.createElement('div', {style:{fontSize:16,fontWeight:700,color:'#22c55e'}},
              '✅ ' + extracted.length + '명 추출 완료'
            ),
            React.createElement('div', {style:{display:'flex',flexDirection:'column',gap:6,maxHeight:340,overflowY:'auto'}},
              extracted.map(function(item, i) {
                var sc = item.scanned; var matched = item.matched;
                var isDH = sc.slot==='DH' && item.seed && item.seed.subPosition && item.seed.subPosition!=='DH';
                var CARD_CLR = {골든글러브:{bg:'#78350f',brd:'#fbbf24',txt:'#fde68a'},시그니처:{bg:'#701a75',brd:'#e879f9',txt:'#f5d0fe'},임팩트:{bg:'#14532d',brd:'#4ade80',txt:'#bbf7d0'},국가대표:{bg:'#1e3a8a',brd:'#60a5fa',txt:'#bfdbfe'},라이브:{bg:'#7c2d12',brd:'#fb923c',txt:'#fed7aa'},시즌:{bg:'#1e293b',brd:'#64748b',txt:'#cbd5e1'},올스타:{bg:'#4a1d96',brd:'#a78bfa',txt:'#ede9fe'}};
                /* 폴백 매칭된 경우 카드종류를 seed 기준으로 표시 */
                var displayCt = (item.fallback && item.seed) ? item.seed.cardType : sc.cardType;
                var cs = CARD_CLR[displayCt]||CARD_CLR['시즌'];
                var borderColor = item.fallback ? 'rgba(251,191,36,0.5)' : matched ? 'var(--bd)' : item.needSelect ? 'rgba(251,191,36,0.4)' : item.failed ? 'rgba(156,163,175,0.4)' : 'rgba(239,68,68,0.3)';
                return React.createElement('div', {key:i, style:{background:'var(--card)',borderRadius:8,padding:'8px 12px',border:'1px solid '+borderColor,opacity:(matched||item.needSelect||item.fallback)?1:0.65}},
                  React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}},
                    React.createElement('span', {style:{fontSize:11,fontWeight:700,padding:'1px 5px',borderRadius:3,background:cs.bg,color:cs.txt,border:'1px solid '+cs.brd,whiteSpace:'nowrap'}}, displayCt||'?'),
                    React.createElement('span', {style:{fontWeight:900,fontSize:15,color:'#e2e8f0'}}, sc.name),
                    sc.year&&React.createElement('span', {style:{fontSize:12,color:'#64748b'}}, "'"+sc.year),
                    sc.slot&&React.createElement('span', {style:{fontSize:13,fontWeight:700,color:'#00d4ff',background:'rgba(0,212,255,0.1)',padding:'1px 6px',borderRadius:4}}, sc.slot),
                    item.fallback
                      ? React.createElement('span', {style:{fontSize:12,color:'#fbbf24',fontWeight:700}}, '⚠ 확인필요')
                      : matched
                        ? React.createElement('span', {style:{fontSize:12,color:'#22c55e'}}, '✓ 매칭됨')
                        : item.failed
                          ? React.createElement('span', {style:{fontSize:12,color:'#9ca3af'}}, '? 카드 종류 인식 실패')
                          : item.needSelect
                            ? React.createElement('span', {style:{fontSize:12,color:'#fbbf24'}}, '⚠️ 임팩트 종류 선택 필요')
                            : React.createElement('span', {style:{fontSize:12,color:'#ef4444'}}, '✗ 도감 미등록'),
                    isDH&&React.createElement('span', {style:{fontSize:11,color:'#fbbf24'}}, '⚠️ DH(포지션 상이)')
                  ),
                  item.needSelect && React.createElement('div', {style:{marginTop:6}},
                    React.createElement('select', {
                      style:{width:'100%',padding:'4px 8px',background:'#1e293b',border:'1px solid #fbbf24',borderRadius:4,color:'#e2e8f0',fontSize:13,outline:'none'},
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
                            React.createElement('span', {style:{fontSize:11,color:'#a78bfa',width:16,flexShrink:0}}, 'S'+(sk.idx+1)),
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
                                  style:{flex:1,padding:'2px 4px',fontSize:12,background:'#1e293b',border:'1px solid #FBBF24',borderRadius:4,color:'#e2e8f0'}
                                },
                                cands.map(function(c){ return React.createElement('option',{key:c,value:c},c); })
                              )
                              : React.createElement('span', {style:{fontSize:12,color:(res&&res.missing)?'#EF4444':'#c4b5fd'}}, (res&&res.name)||('❌ '+sk.raw)),
                            React.createElement('span', {style:{fontSize:11,color:'#64748b',flexShrink:0}}, 'Lv'+sk.lv)
                          );
                        });
                      } catch(e) {
                        return React.createElement('div', {style:{fontSize:12,color:'var(--t2)'}},
                          [sc.skill1&&('S1:'+sc.skill1), sc.skill2&&('S2:'+sc.skill2), sc.skill3&&('S3:'+sc.skill3)].filter(Boolean).join(' · ')
                        );
                      }
                    })()
                  )
                );
              })
            ),
            err&&React.createElement('div', {style:{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:8,padding:'10px 14px',fontSize:14,color:'#fca5a5'}}, '⚠️ '+err),
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
            result.ok.length>0&&React.createElement('div', {style:{background:'var(--inner)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:13,color:'var(--t2)'}},
              result.ok.map(function(n,i){return React.createElement('div',{key:i},'✓ '+n);})
            ),
            result.warn.length>0&&React.createElement('div', {style:{background:'rgba(251,191,36,0.08)',border:'1px solid rgba(251,191,36,0.25)',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:13,color:'#fbbf24'}},
              result.warn.map(function(n,i){return React.createElement('div',{key:i},'⚠️ '+n);})
            ),
            result.skip.length>0&&React.createElement('div', {style:{background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'10px 14px',width:'100%',fontSize:13,color:'#fca5a5'}},
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
          React.createElement('div', {style:{background:'var(--card)',border:'1px solid var(--bd)',borderRadius:14,padding:'24px 22px',maxWidth:400,width:'100%',display:'flex',flexDirection:'column',alignItems:'center',gap:10}},
            React.createElement('div', {style:{fontSize:28}}, '⚠️'),
            React.createElement('div', {style:{fontSize:15,fontWeight:900,color:'#e2e8f0'}}, '라인업 저장 확인'),
            React.createElement('div', {style:{fontSize:14,color:'var(--t2)',textAlign:'center'}},
              '매칭된 ' + extracted.filter(function(x){return x.matched;}).length + '명을 내 선수에 추가하고 라인업 슬롯에 배치합니다.'
            ),
            React.createElement('div', {style:{background:'var(--inner)',border:'1px solid var(--bd)',borderRadius:8,padding:'10px 14px',width:'100%',maxHeight:180,overflowY:'auto'}},
              extracted.filter(function(x){return x.matched;}).map(function(item,i){
                return React.createElement('div', {key:i, style:{display:'flex',justifyContent:'space-between',fontSize:13,padding:'3px 0',borderBottom:'1px solid var(--bd)',color:'var(--t1)'}},
                  React.createElement('span', null, item.scanned.name),
                  React.createElement('span', {style:{color:'#00d4ff'}}, item.scanned.slot||'-')
                );
              })
            ),
            React.createElement('div', {style:{fontSize:12,color:'#ef4444'}}, '기존 해당 슬롯 선수는 교체됩니다.'),
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
    return (<input type="number" value={val || 0} onChange={function(e) { var v = parseInt(e.target.value) || 0; if (max) v = Math.min(max, Math.max(0, v)); upd(id, field, v); }} style={{ width: 32, padding: "2px 1px", textAlign: "center", background: "var(--inner)", border: "1px solid " + (color || "var(--bd)") + "44", borderRadius: 3, color: color || "var(--t1)", fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />);
  };

  var skillSel = function(pl, num) {
    var opts = getSkillOpts(pl);
    var nf = "skill" + num; var lf = "s" + num + "Lv";
    var c = {8:"#FFD700",7:"#FF6B6B",6:"#4FC3F7",5:"#81C784"}[pl[lf]] || "var(--t2)";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <SkillPicker
          value={pl[nf] || ""}
          options={opts}
          width={88}
          fontSize={11}
          onChange={function(v) { upd(pl.id, nf, v); }}
        />
        <select value={pl[lf] || 0} onChange={function(e) { upd(pl.id, lf, parseInt(e.target.value)); }}
          style={{ width: 36, padding: "2px", fontSize: 11, background: "var(--inner)", border: "1px solid " + c + "44", borderRadius: 3, color: c, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }}>
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
                <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</span>
                {pl.isFa && (<span style={{ fontSize: 8, color: "#FF9800", fontFamily: "var(--m)", fontWeight: 800, background: "rgba(255,152,0,0.1)", padding: "1px 4px", borderRadius: 3, border: "1px solid rgba(255,152,0,0.2)" }}>{"FA"}</span>)}
                {slot && (<span style={{ fontSize: 11, color: accentC, fontFamily: "var(--m)", fontWeight: 700, background: "rgba(255,213,79,0.08)", padding: "1px 5px", borderRadius: 3 }}>{slot}</span>)}
              </div>
              <div style={{ fontSize: 13, color: "var(--td)" }}>{(pl.team ? pl.team+" " : "") + (pl.subPosition || "") + " · " + (pl.hand || "") + (isBat ? "타" : "투") + " · " + (pl.enhance || "") + (pl.cardType==="임팩트"&&pl.impactType?" · "+pl.impactType:pl.year?" · "+pl.year:"") + " · ★" + (pl.stars || 5)}</div>
            </div>
          </div>
          {/* Score */}
          <div style={{ textAlign: "center" }}><GS val={calc.total.toFixed(1)} size={18} grad={isBat ? undefined : "linear-gradient(135deg,#CE93D8,#7B1FA2)"} /></div>
          {!mob && (<React.Fragment>
            {/* Training */}
            <div style={{ fontSize: 14, fontFamily: "var(--m)" }}>
              {isBat ? (
                <React.Fragment><span style={{ color: "#EF5350" }}>{"+" + (pl.trainP||0)}</span>{" "}<span style={{ color: "#42A5F5" }}>{"+" + (pl.trainA||0)}</span>{" "}<span style={{ color: "#66BB6A" }}>{"+" + (pl.trainE||0)}</span></React.Fragment>
              ) : (
                <React.Fragment><span style={{ color: "#AB47BC" }}>{"+" + (pl.trainC||0)}</span>{" "}<span style={{ color: "#FF7043" }}>{"+" + (pl.trainS||0)}</span></React.Fragment>
              )}
            </div>
            {/* Spec */}
            <div style={{ fontSize: 14, fontFamily: "var(--m)", color: "var(--t2)" }}>
              {isBat ? ((pl.specPower||0) + "/" + (pl.specAccuracy||0) + "/" + (pl.specEye||0)) : ((pl.specChange||0) + "/" + (pl.specStuff||0))}
            </div>
            {/* Skills - all 3 visible */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {pl.skill1 ? (<SkBadge name={pl.skill1} lv={pl.s1Lv} />) : (<span style={{ fontSize: 11, color: "var(--td)" }}>{"-"}</span>)}
              {pl.skill2 ? (<SkBadge name={pl.skill2} lv={pl.s2Lv} />) : null}
              {pl.skill3 ? (<SkBadge name={pl.skill3} lv={pl.s3Lv} />) : null}
            </div>
            {/* Potential */}
            <div style={{ fontSize: 14, color: "var(--td)", textAlign: "center" }}>{(pl.pot1 || "-") + "/" + (pl.pot2 || "-")}</div>
          </React.Fragment>)}
        </div>

        {/* Inline edit panel */}
        {isSel && (
          <div style={{ padding: "10px 14px", background: "rgba(255,213,79,0.02)", borderBottom: "1px solid var(--bd)" }}>
            {/* Basic info */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"이름"}</div><span style={{ fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{pl.name}</span></div>
              <div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"카드"}</div><Badge type={pl.cardType} /></div>
              {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"종류"}</div><span style={{ fontSize: 14, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
              {pl.cardType==="라이브"&&(<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"세트덱"}</div><input type="number" value={pl.setScore||0} onChange={function(e){upd(pl.id,"setScore",parseInt(e.target.value)||0);}} style={{ width: 36, padding: "3px 4px", background: "var(--inner)", border: "1px solid var(--acc)", borderRadius: 3, color: "var(--acc)", fontSize: 14, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} /></div>)}
              {pl.cardType==="라이브"&&(<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"종류"}</div><select value={pl.liveType||""} onChange={function(e){upd(pl.id,"liveType",e.target.value);}} style={{ width: 44, padding: "3px 2px", fontSize: 13, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}><option value="">-</option><option value="V1">V1</option><option value="V2">V2</option><option value="V3">V3</option></select></div>)}
              {CARD_STARS_SELECTABLE[pl.cardType]&&(<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><select value={pl.stars||(CARD_STARS[pl.cardType]||5)} onChange={function(e){upd(pl.id,"stars",parseInt(e.target.value));}} style={{ width: 38, padding: "3px 2px", fontSize: 13, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>{(pl.cardType==="골든글러브"?[4,5]:[1,2,3,4,5]).map(function(s){return(<option key={s} value={s}>{s}</option>);})}</select></div>)}
              <div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"강화"}</div><select value={pl.enhance || ""} onChange={function(e) { upd(pl.id, "enhance", e.target.value); }} style={{ width: 64, padding: "3px 2px", fontSize: 13, background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", outline: "none" }}>
                {["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e) { return (<option key={e} value={e}>{e}</option>); })}
              </select></div>
              {!CARD_STARS_SELECTABLE[pl.cardType]&&(<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><span style={{ fontSize: 15, color: "var(--acc)" }}>{"★" + (pl.stars || CARD_STARS[pl.cardType] || 5)}</span></div>)}
              {!isBat && (<div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"세부포지션"}</div><select value={pl.subPosition||""} onChange={function(e){
                var sp = e.target.value;
                var newPos = sp.startsWith("SP") ? "선발" : sp === "CP" ? "마무리" : "중계";
                upd(pl.id, "subPosition", sp, "position", newPos);
              }} style={{ width: 56, padding: "3px 2px", fontSize: 13, background: "var(--inner)", border: "1px solid var(--acp)", borderRadius: 3, color: "var(--acp)", fontWeight: 700, outline: "none" }}>
                {["SP1","SP2","SP3","SP4","SP5","RP1","RP2","RP3","RP4","RP5","RP6","CP"].map(function(s){return(<option key={s} value={s}>{s}</option>);})}
              </select></div>)}
              {/* FA toggle - 임팩트/시그니처만 */}
              {(pl.cardType==="임팩트"||pl.cardType==="시그니처") && (
              <div><div style={{ fontSize: 13, color: "var(--td)", marginBottom: 2 }}>{"FA"}</div>
                <div onClick={function(){upd(pl.id,"isFa",!pl.isFa);}} style={{ width: 36, height: 20, borderRadius: 10, background: pl.isFa ? "#FF9800" : "var(--inner)", border: "1px solid " + (pl.isFa ? "#FF9800" : "var(--bd)"), position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: pl.isFa ? "#fff" : "var(--td)", position: "absolute", top: 1, left: pl.isFa ? 18 : 1, transition: "left 0.2s" }} />
                </div>
              </div>
              )}
              <button onClick={function() { if (confirm("'" + pl.name + "' 삭제?")) { save(players.filter(function(x) { return x.id !== pl.id; })); setSelId(null); } }} style={{ padding: "3px 8px", fontSize: 11, background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", borderRadius: 3, color: "#EF5350", cursor: "pointer", marginLeft: "auto" }}>{"삭제"}</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, padding: "4px 8px", background: "var(--inner)", borderRadius: 4, fontSize: 13 }}>
              <span style={{ color: "var(--td)" }}>{"세트덱 스코어:"}</span>
              <span style={{ color: "var(--acc)", fontWeight: 800, fontFamily: "var(--m)" }}>{(function(){var sc=pl.cardType==="라이브"?(pl.setScore||0):(SET_POINTS[pl.cardType]||0);if(pl.isFa)sc=Math.max(0,sc-1);return sc;})()}</span>
              {pl.isFa && pl.cardType==="시그니처" && (<span style={{ color: "#FF9800", fontSize: 11 }}>{"(FA -1)"}</span>)}{pl.isFa && pl.cardType==="임팩트" && (<span style={{ color: "#FF9800", fontSize: 11 }}>{"(FA -2)"}</span>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
              {/* Training */}
              <div>
                <div style={{ fontSize: 13, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"훈련"}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  {isBat ? (
                    <React.Fragment>
                      <span style={{ fontSize: 13, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "trainP", pl.trainP, "#EF5350")}
                      <span style={{ fontSize: 13, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "trainA", pl.trainA, "#42A5F5")}
                      <span style={{ fontSize: 13, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "trainE", pl.trainE, "#66BB6A")}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span style={{ fontSize: 13, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "trainC", pl.trainC, "#AB47BC")}
                      <span style={{ fontSize: 13, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "trainS", pl.trainS, "#FF7043")}
                    </React.Fragment>
                  )}
                </div>
              </div>
              {/* Spec training */}
              <div>
                <div style={{ fontSize: 13, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"특훈 (0~15)"}</div>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" }}>
                  {isBat ? (
                    <React.Fragment>
                      <span style={{ fontSize: 13, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "specPower", pl.specPower, "#EF5350", 15)}
                      <span style={{ fontSize: 13, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "specAccuracy", pl.specAccuracy, "#42A5F5", 15)}
                      <span style={{ fontSize: 13, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "specEye", pl.specEye, "#66BB6A", 15)}
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <span style={{ fontSize: 13, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "specChange", pl.specChange, "#AB47BC", 15)}
                      <span style={{ fontSize: 13, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "specStuff", pl.specStuff, "#FF7043", 15)}
                    </React.Fragment>
                  )}
                </div>
              </div>
              {/* Potential */}
              <div>
                <div style={{ fontSize: 13, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{pl.role === "타자" ? "잠재력 (풀스윙/클러치)" : "잠재력 (장타억제/침착)"}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--td)" }}>{pl.role === "타자" ? "풀스윙" : "장타억제"}</span>
                    <select value={pl.pot1||""} onChange={function(e){upd(pl.id,"pot1",e.target.value);}} style={{ padding: "3px 4px", background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", fontSize: 14, outline: "none", width: 52 }}>
                      <option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 11, color: "var(--td)" }}>{pl.role === "타자" ? "클러치" : "침착"}</span>
                    <select value={pl.pot2||""} onChange={function(e){upd(pl.id,"pot2",e.target.value);}} style={{ padding: "3px 4px", background: "#1e293b", border: "1px solid #334155", borderRadius: 3, color: "#e2e8f0", fontSize: 14, outline: "none", width: 52 }}>
                      <option value="">-</option>{POT_GRADES.map(function(g){return (<option key={g} value={g}>{g}</option>);})}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {/* Skills */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"스킬 (" + getSkillCat(pl) + ")"}</div>
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
            return (<button key={f.k} onClick={function(){setFilter(f.k);}} style={{ padding: "5px 10px", fontSize: 12, fontWeight: a?700:400, background: a?"var(--ta)":"var(--inner)", color: a?"var(--acc)":"var(--t2)", border: a?"1px solid var(--acc)":"1px solid var(--bd)", borderRadius: 5, cursor: "pointer" }}>{f.l}</button>);
          })}
          <button onClick={function() { setAddOpen(true); setAddQuery(""); }} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 5, color: "#1a1100", cursor: "pointer", marginLeft: 4 }}>{"+ 추가"}</button>
          <button onClick={function() { setScanOpen(true); }} style={{ padding: "5px 12px", fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: 5, color: "#0a0a0a", cursor: "pointer", marginLeft: 4 }}>{"📸 일괄 업데이트"}</button>
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
            <div onClick={function(e){e.stopPropagation();}} style={{ background: "var(--card)", borderRadius: 14, border: "1px solid var(--bd)", maxWidth: 440, width: "100%", maxHeight: "80vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)" }}>{"도감에서 선수 추가"}</div>
                  <div style={{ fontSize: 12, color: "var(--td)", marginTop: 2 }}>{filter + " · " + dbPlayers.length + "명"}</div>
                </div>
                <button onClick={function(){setAddOpen(false);}} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 18 }}>{"✕"}</button>
              </div>
              <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, padding: "6px 10px" }}>
                  <span style={{ fontSize: 16, opacity: 0.4 }}>{"🔍"}</span>
                  <input type="text" value={addQuery} onChange={function(e){setAddQuery(e.target.value);}} placeholder="이름, 카드종류, 팀 검색..." style={{ flex: 1, background: "transparent", border: "none", color: "var(--t1)", fontSize: 14, outline: "none" }} />
                </div>
              </div>
              <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
                {dbPlayers.length === 0 ? (
                  <div style={{ padding: "24px 18px", textAlign: "center", color: "var(--td)", fontSize: 14 }}>{"도감에 등록된 선수가 없습니다."}</div>
                ) : dbPlayers.map(function(sp) {
                  var already = players.some(function(x){ return x.name===sp.name && x.cardType===sp.cardType && (x.year||"")===(sp.year||"") && (x.impactType||"")===(sp.impactType||"") && (sp.cardType!=="라이브" || (x.liveType||"")===(sp.liveType||"")); });
                  return (
                    <div key={sp.id} onClick={function(){if(!already)addPl(sp);}} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", borderBottom: "1px solid var(--bd)", cursor: already?"not-allowed":"pointer", opacity: already?0.4:1 }}>
                      <PlayerCard player={sp} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Badge type={sp.cardType} />
                          <span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 15 }}>{sp.name}</span>
                          {sp.year && (<span style={{ fontSize: 11, color: "var(--td)" }}>{sp.year}</span>)}
                          {sp.cardType === "임팩트" && sp.impactType && (<span style={{ fontSize: 11, color: "#a78bfa", marginLeft: 2 }}>{'(' + sp.impactType + ')'}</span>)}
                          {sp.cardType === "라이브" && sp.liveType && (<span style={{ fontSize: 11, color: "#34d399", marginLeft: 2 }}>{'(' + sp.liveType + ')'}</span>)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--td)", marginTop: 2 }}>
                          {isBat ? (sp.team + " · " + sp.hand + "타 · 파" + (sp.power||0) + " 정" + (sp.accuracy||0) + " 선" + (sp.eye||0)) : (sp.team + " · " + sp.hand + "투 · 변" + (sp.change||0) + " 구" + (sp.stuff||0))}
                        </div>
                      </div>
                      {already && (<span style={{ fontSize: 11, color: "var(--acc)" }}>{"등록됨"}</span>)}
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
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 50px" : "minmax(110px,1fr) 70px 90px 70px 130px 50px", gap: 5, padding: "6px 12px", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--td)" }}>
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
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead><tr><th style={{ textAlign: "left", padding: "4px", color: "var(--td)" }}>{"능력치"}</th><th style={{ textAlign: "center", padding: "4px", color: "var(--td)", fontSize: 11 }}>{"항목"}</th>
            {[5,6,7,8,9,10].map(function(lv) { return (<th key={lv} style={{ textAlign: "center", padding: "4px", color: {"10":"#FF4081","9":"#E040FB","8":"#FFD700","7":"#FF6B6B","6":"#4FC3F7","5":"#81C784"}[lv]||"#aaa" }}>{"Lv"+lv}</th>); })}
          </tr></thead>
          <tbody>{statKeys.map(function(sk, si) {
            var vk = statVKeys[si]; var fk = statFKeys[si];
            return (<React.Fragment key={sk}>
              <tr><td rowSpan={2} style={{ padding: "4px", color: statColors[si], fontWeight: 700, verticalAlign: "middle" }}>{statLabels[si]}</td>
                <td style={{ fontSize: 11, color: "var(--td)", padding: "2px 4px" }}>{"수치"}</td>
                {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var val = (typeof entry === "number") ? 0 : (entry[vk] || 0); var c = ["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][li];
                  return (<td key={li} style={{ textAlign: "center", padding: "1px" }}><input type="number" step="1" value={val} onChange={function(e){updComp(name,li,vk,e.target.value);}} style={{ width: 38, padding: "2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+c+"33", borderRadius: 3, color: c, fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} /></td>);
                })}</tr>
              <tr><td style={{ fontSize: 11, color: "var(--td)", padding: "2px 4px" }}>{"빈도"}</td>
                {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var val = (typeof entry === "number") ? 0 : (entry[fk] || 0); var c = ["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][li];
                  return (<td key={li} style={{ textAlign: "center", padding: "1px" }}><input type="number" step="0.01" value={val} onChange={function(e){updComp(name,li,fk,e.target.value);}} style={{ width: 38, padding: "2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+c+"22", borderRadius: 3, color: c, fontSize: 11, fontFamily: "var(--m)", opacity: 0.7, outline: "none" }} /></td>);
                })}</tr>
            </React.Fragment>); })}
            <tr><td colSpan={2} style={{ padding: "4px", fontWeight: 700, color: "var(--t1)" }}>{"합계"}</td>
              {[0,1,2,3,4,5].map(function(li) { var entry = arr[li]; if(!entry)return null; var sc = 0;
                if (typeof entry === "number") { sc = entry; } else { sc = (entry.pV||0)*(entry.pF||0)*w.p + (entry.aV||0)*(entry.aF||0)*w.a + (entry.eV||0)*(entry.eF||0)*w.e + (entry.cV||0)*(entry.cF||0)*w.c + (entry.sV||0)*(entry.sF||0)*w.s; }
                return (<td key={li} style={{ textAlign: "center", fontWeight: 800, fontFamily: "var(--m)", color: "var(--acc)", fontSize: 14 }}>{Math.round(sc*100)/100}</td>);
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
          <button onClick={doExport} style={{ padding: "5px 10px", fontSize: 12, background: "rgba(66,165,245,0.08)", border: "1px solid rgba(66,165,245,0.2)", borderRadius: 4, color: "#42A5F5", cursor: "pointer" }}>{"CSV 내보내기"}</button>
          <button onClick={function(){setImpMode(!impMode);}} style={{ padding: "5px 10px", fontSize: 12, background: "rgba(102,187,106,0.08)", border: "1px solid rgba(102,187,106,0.2)", borderRadius: 4, color: "#66BB6A", cursor: "pointer" }}>{impMode?"닫기":"CSV 가져오기"}</button>
          <button onClick={resetAll} style={{ padding: "5px 10px", fontSize: 12, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 4, color: "#EF5350", cursor: "pointer" }}>{"기본값 복원"}</button>
        </div>
      </div>
      {showCSV && (<div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "var(--td)" }}>{"CSV (복사→엑셀)"}</span><button onClick={function(){setShowCSV(false);}} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer" }}>{"✕"}</button></div>
        <textarea value={csvText} readOnly rows={8} onClick={function(e){e.target.select();}} style={{ width: "100%", padding: 8, fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
      </div>)}
      {impMode && (<div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "var(--td)", marginBottom: 6 }}>{"CSV 붙여넣기 (카테고리,스킬명,레벨,능력치...)"}</div>
        <textarea value={impText} onChange={function(e){setImpText(e.target.value);}} rows={6} style={{ width: "100%", padding: 8, fontSize: 12, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
        <button onClick={doImport} style={{ marginTop: 6, padding: "6px 16px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#66BB6A,#43A047)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer" }}>{"적용"}</button>
      </div>)}
      {/* Weights */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", marginBottom: 6 }}>{"능력치 가중치 (사이트 전체 적용)"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {[{k:"p",l:"파워",cl:"#EF5350"},{k:"a",l:"정확",cl:"#42A5F5"},{k:"e",l:"선구",cl:"#66BB6A"},{k:"c",l:"변화",cl:"#AB47BC"},{k:"s",l:"구위",cl:"#FF7043"}].map(function(it){
            return (<div key={it.k} style={{ textAlign: "center" }}><div style={{ fontSize: 12, color: it.cl, fontWeight: 700, marginBottom: 2 }}>{it.l}</div>
              <input type="number" step="0.001" value={w[it.k]} onChange={function(e){updWeight(it.k,e.target.value);}} style={{ width: 56, padding: "4px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+it.cl+"44", borderRadius: 4, color: it.cl, fontSize: 16, fontFamily: "var(--m)", fontWeight: 800, outline: "none" }} /></div>);
          })}
        </div>
      </div>
      {/* Potential Scores - 종류별 */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)", fontFamily: "var(--h)", marginBottom: 8 }}>{"잠재력 등급별 점수 (종류별)"}</div>
        {["풀스윙","클러치","장타억제","침착"].map(function(potType) {
          var byType = skills.potScoresByType || DEFAULT_POT_SCORES_BY_TYPE;
          var typeScores = byType[potType] || DEFAULT_POT_SCORES_BY_TYPE[potType] || DEFAULT_POT_SCORES;
          var typeColor = potType==="풀스윙"?"#EF5350":potType==="클러치"?"#42A5F5":potType==="장타억제"?"#AB47BC":"#66BB6A";
          return (<div key={potType} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: typeColor, marginBottom: 4 }}>{potType + (potType==="풀스윙"||potType==="클러치" ? " (타자)" : " (투수)")}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {POT_GRADES.map(function(g) {
                var ps = typeScores[g] !== undefined ? typeScores[g] : (DEFAULT_POT_SCORES[g] || 0);
                return (<div key={g} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--td)", marginBottom: 2 }}>{g}</div>
                  <input type="number" step="1" value={ps} onChange={function(e) {
                    var copy = JSON.parse(JSON.stringify(skills));
                    if (!copy.potScoresByType) copy.potScoresByType = JSON.parse(JSON.stringify(DEFAULT_POT_SCORES_BY_TYPE));
                    if (!copy.potScoresByType[potType]) copy.potScoresByType[potType] = Object.assign({}, DEFAULT_POT_SCORES);
                    copy.potScoresByType[potType][g] = parseFloat(e.target.value) || 0;
                    saveSK(copy);
                  }} style={{ width: 36, padding: "3px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid "+typeColor+"44", borderRadius: 4, color: typeColor, fontSize: 14, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} />
                </div>);
              })}
            </div>
          </div>);
        })}
      </div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {cats.map(function(c){ var a=c===cat; return (<button key={c} onClick={function(){setCat(c);setExpName("");}} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 13, fontWeight: a?800:500, background: a?"var(--ta)":"var(--inner)", color: a?"var(--acc)":"var(--t2)", border: a?"1px solid var(--acc)":"1px solid var(--bd)", cursor: "pointer" }}>{c+" ("+Object.keys(skills[c]||{}).length+")"}</button>); })}
      </div>
      {/* Add */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input type="text" value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="새 스킬 이름" onKeyDown={function(e){if(e.key==="Enter")addSkill();}} style={{ flex: 1, padding: "7px 10px", fontSize: 13, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0", outline: "none" }} />
        <button onClick={addSkill} style={{ padding: "7px 14px", fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 6, color: "#1a1100", cursor: "pointer" }}>{"+ 추가"}</button>
      </div>
      {/* List */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontSize: 12, fontWeight: 700, color: "var(--td)" }}>
          <div style={{textAlign:"center",fontSize:11}}>{"★"}</div><div>{"스킬명 (Lv6순) ▼클릭편집"}</div><div style={{ textAlign: "center", color: "#81C784" }}>{"Lv5"}</div><div style={{ textAlign: "center", color: "#4FC3F7" }}>{"Lv6"}</div><div style={{ textAlign: "center", color: "#FF6B6B" }}>{"Lv7"}</div><div style={{ textAlign: "center", color: "#FFD700" }}>{"Lv8"}</div><div style={{ textAlign: "center", color: "#E040FB" }}>{"Lv9"}</div><div style={{ textAlign: "center", color: "#FF4081" }}>{"Lv10"}</div><div />
        </div>
        {names.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: "var(--td)", fontSize: 13 }}>{"없음"}</div>) :
        names.map(function(name, idx) { var vals = table[name]; var scores = calcSkillDisp(vals, cat); var isExp = (expName === name);
          return (<React.Fragment key={name}>
            <div onClick={function(){setExpName(isExp?"":name);}} style={{ display: "grid", gridTemplateColumns: "24px minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "5px 10px", alignItems: "center", borderBottom: "1px solid var(--bd)", background: isExp?"var(--ta)":(idx%2===0?"var(--re)":"transparent"), cursor: "pointer" }}>
              <button onClick={function(e){e.stopPropagation();var copy=JSON.parse(JSON.stringify(skills));if(!copy[cat][name])return;if(!copy._major)copy._major={};if(!copy._major[cat])copy._major[cat]={};copy._major[cat][name]=!((copy._major[cat]||{})[name]);saveSK(copy);}} style={{width:20,height:20,borderRadius:3,background:(((skills._major||{})[cat]||{})[name])?"rgba(171,71,188,0.2)":"transparent",border:"1px solid "+(((skills._major||{})[cat]||{})[name])?"#AB47BC":"var(--bd)",color:(((skills._major||{})[cat]||{})[name])?"#CE93D8":"var(--td)",cursor:"pointer",fontSize:11,padding:0,flexShrink:0}}>{"★"}</button>
              <div style={{ fontSize: 13, fontWeight: 700, color: isExp?"var(--acc)":"var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(isExp?"▼ ":"▶ ")+name+(((skills._major||{})[cat]||{})[name]?" ⭐":"")}</div>
              {scores.map(function(sc,i){ var c=["#81C784","#4FC3F7","#FF6B6B","#FFD700","#E040FB","#FF4081"][i]; return (<div key={i} style={{ textAlign: "center", fontSize: 13, fontFamily: "var(--m)", fontWeight: 700, color: c }}>{Math.round(sc*100)/100}</div>); })}
              <button onClick={function(e){e.stopPropagation();delSkill(name);}} style={{ width: 22, height: 22, borderRadius: 3, background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", color: "#EF5350", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{"×"}</button>
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
        <p style={{fontSize:14,color:"var(--td)",margin:0}}>{"커뮤니티 기능이 준비되면 이 페이지에서 만나보실 수 있습니다."}</p>
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
          return (<button key={t.id} onClick={function(){setDcTab(t.id);}} style={{padding:"8px 16px",fontSize:13,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{t.label}</button>);
        })}
      </div>
      {dcTab==="analysis" && <LineupAnalysis mobile={mob} players={players} lineupMap={lineupMap} skills={skills} isAdmin={p.isAdmin} />}
      {dcTab==="skill" && <SkillCalculator mobile={mob} skills={skills} />}
      {dcTab==="train" && <TrainSimulator mobile={mob} skills={skills} />}
      {dcTab==="top" && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:10}}>{"👑"}</div>
          <h3 style={{fontSize:15,fontWeight:700,color:"var(--t1)",margin:"0 0 6px"}}>{"업데이트 예정"}</h3>
          <p style={{fontSize:14,color:"var(--td)",margin:0}}>{"고점덱 정보가 준비되면 안내드리겠습니다."}</p>
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

var DIST_CACHE = null;

/* ────────────────────────────────────────────────────────────────
   하드코딩된 분포 (관리자가 "분포 내보내기" 버튼으로 생성한 JSON을 붙여넣기)
   각 배열은 5만회 시뮬레이션을 1000포인트 분위수(0.1% 단위)로 압축한 값
   예: PREBUILT_DIST["skill_타자_골든글러브"][500] = 50% 분위점
   비어있으면 런타임에 buildDist 실행 (최초 개발 상태)
   ──────────────────────────────────────────────────────────────── */
var PREBUILT_DIST = {"skill_타자_골든글러브":[0,0.66,2.43,2.76,2.8,3.24,3.24,3.3,3.42,3.46,3.96,3.96,4.08,4.32,4.36,4.36,4.62,4.86,4.98,5.09,5.28,5.28,5.28,5.4,5.52,5.67,5.73,5.76,5.93,5.94,6.06,6.06,6.13,6.22,6.36,6.39,6.46,6.59,6.66,6.72,6.74,6.76,6.8,6.92,6.99,7.05,7.12,7.26,7.29,7.38,7.42,7.46,7.53,7.6,7.62,7.66,7.68,7.74,7.82,7.84,7.86,7.92,8.04,8.08,8.1,8.14,8.2,8.28,8.32,8.44,8.5,8.52,8.52,8.58,8.58,8.61,8.64,8.68,8.7,8.73,8.78,8.79,8.82,8.85,8.93,8.98,9,9.06,9.12,9.16,9.22,9.24,9.35,9.39,9.43,9.48,9.48,9.54,9.6,9.6,9.6,9.64,9.66,9.66,9.72,9.72,9.78,9.88,9.9,10.02,10.04,10.06,10.13,10.18,10.26,10.26,10.32,10.35,10.38,10.42,10.5,10.59,10.66,10.68,10.68,10.72,10.78,10.83,10.9,10.92,10.95,10.98,11.01,11.07,11.1,11.15,11.16,11.22,11.24,11.28,11.31,11.34,11.36,11.38,11.4,11.43,11.46,11.52,11.58,11.58,11.6,11.64,11.7,11.76,11.78,11.8,11.83,11.85,11.88,11.94,11.94,12,12.02,12.03,12.06,12.06,12.09,12.12,12.15,12.18,12.2,12.24,12.24,12.28,12.3,12.32,12.34,12.35,12.39,12.42,12.43,12.46,12.48,12.49,12.52,12.6,12.66,12.7,12.73,12.76,12.81,12.82,12.84,12.88,12.9,12.93,12.96,12.98,13,13.02,13.05,13.06,13.08,13.11,13.12,13.15,13.2,13.21,13.26,13.29,13.3,13.35,13.36,13.38,13.39,13.41,13.43,13.46,13.5,13.53,13.56,13.62,13.65,13.68,13.72,13.76,13.78,13.8,13.82,13.83,13.86,13.9,13.92,13.92,13.96,13.98,14.01,14.02,14.04,14.07,14.08,14.11,14.2,14.21,14.22,14.25,14.28,14.3,14.32,14.33,14.34,14.38,14.4,14.43,14.46,14.49,14.52,14.56,14.59,14.62,14.64,14.65,14.68,14.7,14.72,14.73,14.74,14.77,14.8,14.82,14.83,14.86,14.88,14.88,14.9,14.91,14.94,14.97,14.98,15,15.04,15.06,15.08,15.12,15.13,15.15,15.18,15.21,15.25,15.27,15.3,15.31,15.34,15.36,15.37,15.4,15.42,15.45,15.48,15.5,15.53,15.54,15.56,15.59,15.6,15.62,15.63,15.64,15.65,15.67,15.7,15.72,15.72,15.72,15.73,15.76,15.78,15.78,15.8,15.83,15.84,15.9,15.94,15.96,15.96,16,16.02,16.02,16.05,16.06,16.08,16.1,16.12,16.15,16.18,16.2,16.22,16.24,16.26,16.28,16.3,16.32,16.36,16.38,16.38,16.4,16.44,16.44,16.46,16.5,16.5,16.52,16.54,16.56,16.59,16.6,16.62,16.62,16.63,16.65,16.66,16.68,16.68,16.68,16.7,16.71,16.72,16.75,16.76,16.78,16.8,16.85,16.86,16.89,16.92,16.93,16.95,16.96,17.01,17.03,17.04,17.07,17.08,17.1,17.13,17.16,17.16,17.18,17.21,17.22,17.24,17.26,17.28,17.3,17.32,17.32,17.34,17.38,17.4,17.44,17.48,17.5,17.52,17.52,17.55,17.56,17.58,17.58,17.6,17.61,17.62,17.62,17.64,17.66,17.68,17.68,17.7,17.74,17.74,17.76,17.76,17.8,17.82,17.83,17.83,17.85,17.87,17.91,17.92,17.94,17.98,18,18.02,18.04,18.06,18.1,18.12,18.13,18.15,18.16,18.18,18.19,18.2,18.21,18.24,18.25,18.26,18.28,18.3,18.33,18.36,18.38,18.42,18.44,18.45,18.48,18.48,18.48,18.51,18.53,18.54,18.57,18.58,18.6,18.6,18.64,18.64,18.66,18.66,18.68,18.7,18.7,18.73,18.74,18.76,18.79,18.81,18.82,18.82,18.84,18.86,18.87,18.88,18.9,18.93,18.96,18.98,19.02,19.03,19.05,19.06,19.08,19.11,19.12,19.14,19.14,19.17,19.19,19.21,19.24,19.26,19.3,19.32,19.33,19.35,19.36,19.36,19.39,19.42,19.44,19.47,19.48,19.5,19.52,19.54,19.58,19.6,19.62,19.68,19.7,19.72,19.72,19.74,19.76,19.76,19.78,19.8,19.82,19.84,19.88,19.92,19.93,19.95,19.96,19.98,19.99,20.01,20.02,20.02,20.03,20.04,20.06,20.08,20.09,20.1,20.14,20.17,20.22,20.22,20.25,20.26,20.32,20.34,20.35,20.38,20.4,20.4,20.42,20.44,20.46,20.48,20.51,20.56,20.58,20.6,20.62,20.64,20.67,20.68,20.68,20.68,20.72,20.74,20.76,20.8,20.82,20.84,20.86,20.88,20.9,20.9,20.91,20.92,20.93,20.95,20.97,20.98,21,21.01,21.02,21.04,21.06,21.06,21.08,21.1,21.13,21.13,21.16,21.18,21.22,21.24,21.24,21.25,21.27,21.28,21.3,21.32,21.34,21.34,21.37,21.39,21.44,21.46,21.48,21.5,21.53,21.54,21.56,21.56,21.58,21.6,21.62,21.63,21.66,21.7,21.72,21.76,21.78,21.78,21.8,21.81,21.86,21.88,21.9,21.91,21.92,21.94,21.95,21.96,21.96,21.97,22,22,22.02,22.03,22.05,22.07,22.1,22.12,22.13,22.14,22.15,22.17,22.19,22.21,22.22,22.22,22.24,22.26,22.3,22.32,22.35,22.38,22.43,22.44,22.46,22.49,22.52,22.56,22.58,22.6,22.62,22.64,22.66,22.69,22.72,22.76,22.78,22.8,22.82,22.84,22.85,22.88,22.88,22.88,22.9,22.92,22.94,22.96,23,23.02,23.02,23.05,23.06,23.08,23.1,23.11,23.12,23.14,23.17,23.2,23.22,23.24,23.26,23.28,23.3,23.32,23.35,23.36,23.39,23.42,23.43,23.45,23.48,23.48,23.5,23.54,23.58,23.62,23.67,23.68,23.72,23.73,23.74,23.76,23.82,23.85,23.88,23.92,23.92,23.98,23.98,23.98,24,24.02,24.04,24.08,24.09,24.1,24.12,24.14,24.18,24.22,24.25,24.28,24.32,24.35,24.37,24.39,24.4,24.42,24.43,24.46,24.53,24.56,24.62,24.64,24.65,24.69,24.72,24.76,24.78,24.8,24.84,24.86,24.88,24.9,24.92,24.95,25,25.02,25.02,25.04,25.06,25.09,25.12,25.18,25.2,25.24,25.26,25.28,25.3,25.3,25.31,25.33,25.34,25.37,25.41,25.42,25.45,25.46,25.52,25.54,25.56,25.58,25.62,25.66,25.68,25.71,25.74,25.77,25.83,25.86,25.9,25.92,25.93,25.96,25.96,26.01,26.06,26.08,26.12,26.14,26.18,26.19,26.21,26.22,26.24,26.26,26.3,26.3,26.32,26.35,26.38,26.41,26.46,26.5,26.54,26.58,26.58,26.61,26.62,26.65,26.68,26.72,26.74,26.78,26.83,26.84,26.85,26.88,26.9,26.98,27,27.04,27.1,27.14,27.2,27.22,27.24,27.24,27.28,27.28,27.33,27.38,27.41,27.46,27.5,27.52,27.57,27.64,27.66,27.7,27.73,27.75,27.8,27.86,27.9,27.94,28.03,28.08,28.13,28.17,28.22,28.28,28.32,28.36,28.4,28.46,28.56,28.6,28.63,28.69,28.72,28.76,28.8,28.88,28.96,29.01,29.05,29.14,29.2,29.24,29.28,29.32,29.38,29.42,29.51,29.58,29.64,29.68,29.71,29.77,29.83,29.9,29.94,30.02,30.08,30.13,30.18,30.24,30.3,30.36,30.46,30.52,30.57,30.6,30.68,30.76,30.84,30.92,30.99,31.05,31.14,31.2,31.24,31.35,31.44,31.5,31.6,31.68,31.82,31.9,32,32.08,32.12,32.2,32.32,32.42,32.5,32.6,32.72,32.92,33,33.06,33.16,33.24,33.38,33.47,33.6,33.69,33.88,33.98,34.1,34.23,34.32,34.44,34.56,34.76,34.9,35.12,35.23,35.38,35.46,35.62,35.75,35.85,36.02,36.14,36.3,36.42,36.5,36.7,36.8,37,37.2,37.38,37.54,37.72,38.02,38.28,38.5,38.8,39.05,39.34,39.52,39.76,40.08,40.3,40.7,41.07,41.43,41.93,42.6,43.3,43.82,44.42,45.3,46.9,49.72],"skill_타자_라이브":[0,0.77,2.84,3.15,3.47,3.78,3.8,3.85,3.99,4.55,4.62,4.73,4.97,5.04,5.08,5.29,5.39,5.54,5.76,5.85,5.99,6.16,6.16,6.16,6.25,6.44,6.5,6.64,6.75,6.93,6.93,7.02,7.07,7.14,7.35,7.46,7.53,7.63,7.74,7.77,7.84,7.92,7.98,8.05,8.12,8.19,8.22,8.36,8.43,8.54,8.61,8.69,8.75,8.82,8.85,8.88,8.89,9,9,9.07,9.14,9.19,9.28,9.31,9.33,9.38,9.45,9.5,9.52,9.62,9.66,9.7,9.84,9.94,9.96,9.96,10.01,10.03,10.08,10.1,10.12,10.15,10.19,10.24,10.29,10.29,10.35,10.38,10.46,10.49,10.61,10.74,10.78,10.8,10.87,10.92,10.93,11,11.06,11.09,11.13,11.17,11.2,11.24,11.24,11.31,11.34,11.38,11.51,11.55,11.59,11.68,11.7,11.77,11.83,11.86,11.89,11.97,11.99,12.08,12.14,12.15,12.28,12.32,12.39,12.41,12.46,12.46,12.46,12.5,12.57,12.62,12.65,12.67,12.74,12.77,12.81,12.85,12.92,12.99,13.02,13.09,13.11,13.13,13.16,13.2,13.23,13.23,13.3,13.3,13.32,13.35,13.37,13.44,13.48,13.51,13.51,13.54,13.58,13.62,13.65,13.69,13.76,13.83,13.88,13.9,13.93,13.95,14,14.07,14.07,14.09,14.1,14.14,14.15,14.18,14.21,14.25,14.28,14.31,14.35,14.39,14.39,14.46,14.52,14.54,14.59,14.61,14.67,14.7,14.72,14.77,14.8,14.84,14.87,14.91,14.92,14.97,14.99,15.02,15.05,15.09,15.12,15.16,15.16,15.19,15.23,15.25,15.31,15.36,15.4,15.43,15.47,15.48,15.49,15.5,15.54,15.6,15.63,15.66,15.68,15.68,15.71,15.77,15.8,15.85,15.86,15.93,15.96,15.97,16,16.02,16.1,16.14,16.15,16.17,16.17,16.23,16.24,16.26,16.31,16.32,16.33,16.35,16.42,16.45,16.45,16.46,16.48,16.52,16.56,16.62,16.65,16.67,16.7,16.74,16.77,16.79,16.84,16.9,16.94,16.96,17.01,17.08,17.08,17.09,17.1,17.1,17.14,17.15,17.17,17.21,17.24,17.28,17.29,17.3,17.31,17.33,17.35,17.36,17.43,17.47,17.5,17.52,17.54,17.56,17.6,17.62,17.65,17.69,17.71,17.73,17.76,17.8,17.85,17.85,17.86,17.87,17.92,17.92,17.94,17.99,18.03,18.04,18.06,18.08,18.1,18.13,18.16,18.17,18.2,18.24,18.24,18.29,18.31,18.34,18.35,18.36,18.37,18.38,18.4,18.41,18.45,18.48,18.52,18.54,18.55,18.57,18.59,18.62,18.63,18.64,18.69,18.7,18.71,18.75,18.79,18.83,18.84,18.88,18.9,18.92,18.94,18.98,19,19.01,19.03,19.05,19.08,19.12,19.15,19.17,19.18,19.2,19.23,19.25,19.25,19.27,19.29,19.32,19.34,19.35,19.39,19.39,19.43,19.46,19.46,19.46,19.48,19.48,19.5,19.54,19.56,19.6,19.64,19.66,19.67,19.69,19.71,19.77,19.78,19.8,19.8,19.82,19.85,19.85,19.89,19.93,19.95,19.98,20.01,20.02,20.02,20.07,20.1,20.11,20.14,20.17,20.19,20.23,20.24,20.25,20.28,20.3,20.31,20.35,20.4,20.43,20.43,20.44,20.46,20.47,20.48,20.5,20.51,20.53,20.55,20.56,20.57,20.59,20.62,20.64,20.69,20.71,20.74,20.75,20.76,20.78,20.79,20.79,20.84,20.86,20.88,20.9,20.93,20.95,20.95,21,21.03,21.07,21.07,21.09,21.13,21.17,21.19,21.21,21.23,21.25,21.27,21.32,21.36,21.36,21.38,21.39,21.4,21.41,21.43,21.45,21.47,21.51,21.53,21.55,21.56,21.56,21.59,21.6,21.63,21.65,21.69,21.71,21.73,21.77,21.78,21.82,21.84,21.89,21.91,21.94,21.97,22.01,22.02,22.04,22.09,22.1,22.13,22.14,22.15,22.17,22.18,22.19,22.22,22.22,22.23,22.26,22.3,22.32,22.33,22.33,22.35,22.36,22.39,22.4,22.47,22.49,22.51,22.54,22.56,22.61,22.64,22.64,22.66,22.68,22.69,22.72,22.75,22.79,22.83,22.85,22.86,22.87,22.9,22.94,22.95,22.98,22.99,22.99,23.02,23.03,23.05,23.1,23.12,23.14,23.17,23.17,23.2,23.24,23.24,23.26,23.28,23.31,23.31,23.33,23.34,23.4,23.41,23.43,23.45,23.46,23.47,23.52,23.56,23.58,23.59,23.6,23.62,23.63,23.65,23.65,23.67,23.71,23.73,23.75,23.76,23.76,23.77,23.79,23.8,23.82,23.87,23.89,23.93,23.96,24,24.01,24.03,24.06,24.08,24.1,24.15,24.2,24.22,24.24,24.24,24.26,24.28,24.29,24.29,24.32,24.35,24.37,24.4,24.42,24.42,24.42,24.44,24.45,24.47,24.5,24.51,24.53,24.53,24.54,24.56,24.57,24.59,24.62,24.64,24.66,24.7,24.71,24.72,24.75,24.78,24.84,24.85,24.86,24.88,24.89,24.93,24.97,25,25.05,25.06,25.09,25.1,25.14,25.17,25.19,25.19,25.21,25.23,25.25,25.27,25.33,25.34,25.36,25.37,25.39,25.41,25.41,25.44,25.47,25.48,25.52,25.54,25.55,25.58,25.62,25.64,25.65,25.68,25.72,25.77,25.79,25.8,25.83,25.84,25.87,25.9,25.94,25.95,25.96,25.96,25.98,26,26.02,26.03,26.08,26.1,26.14,26.15,26.18,26.21,26.25,26.29,26.34,26.4,26.42,26.44,26.46,26.48,26.49,26.53,26.6,26.6,26.62,26.64,26.64,26.67,26.69,26.72,26.73,26.75,26.75,26.77,26.79,26.8,26.84,26.87,26.89,26.91,26.92,26.94,26.95,26.98,27.02,27.04,27.09,27.12,27.16,27.21,27.26,27.29,27.34,27.36,27.38,27.43,27.44,27.47,27.5,27.52,27.54,27.55,27.56,27.57,27.61,27.61,27.64,27.68,27.69,27.72,27.73,27.75,27.81,27.86,27.9,27.94,27.97,28,28.03,28.04,28.07,28.13,28.16,28.19,28.22,28.25,28.26,28.28,28.34,28.37,28.38,28.41,28.46,28.48,28.51,28.56,28.62,28.64,28.66,28.69,28.7,28.73,28.74,28.78,28.79,28.8,28.8,28.82,28.84,28.87,28.93,28.97,28.99,29,29.04,29.05,29.09,29.11,29.14,29.16,29.19,29.24,29.26,29.3,29.35,29.42,29.44,29.47,29.49,29.52,29.57,29.59,29.62,29.68,29.73,29.75,29.76,29.79,29.81,29.82,29.87,29.89,29.92,29.93,29.95,30.01,30.05,30.08,30.11,30.17,30.21,30.25,30.28,30.3,30.34,30.36,30.39,30.47,30.53,30.55,30.58,30.6,30.62,30.66,30.71,30.74,30.8,30.82,30.86,30.89,30.91,30.96,30.99,31.01,31.04,31.08,31.13,31.15,31.17,31.21,31.27,31.3,31.33,31.35,31.41,31.42,31.49,31.55,31.61,31.64,31.68,31.73,31.8,31.84,31.88,31.93,31.97,32.01,32.06,32.1,32.12,32.14,32.2,32.25,32.27,32.34,32.4,32.45,32.47,32.5,32.55,32.6,32.65,32.69,32.74,32.78,32.82,32.88,32.92,32.98,33.05,33.09,33.12,33.2,33.26,33.31,33.35,33.41,33.47,33.51,33.58,33.61,33.66,33.74,33.8,33.85,33.89,33.94,34,34.08,34.14,34.17,34.21,34.31,34.35,34.42,34.5,34.58,34.65,34.7,34.75,34.85,34.9,34.98,35.03,35.14,35.2,35.34,35.42,35.46,35.6,35.71,35.78,35.89,35.97,36.04,36.15,36.24,36.33,36.46,36.58,36.66,36.79,36.88,36.98,37.08,37.25,37.38,37.48,37.62,37.73,37.89,38.04,38.14,38.27,38.37,38.53,38.69,38.85,38.99,39.08,39.19,39.3,39.45,39.6,39.79,39.93,40.07,40.24,40.37,40.48,40.66,40.93,41.14,41.25,41.36,41.52,41.69,41.94,42.14,42.31,42.45,42.63,42.84,43.08,43.31,43.5,43.68,43.95,44.19,44.4,44.65,44.99,45.21,45.59,45.79,46.09,46.54,46.88,47.31,47.85,48.26,48.76,49.37,50.04,51.08,52.02,53.46,56.06],"skill_타자_올스타":[0,0.77,2.8,2.84,3.15,3.57,3.78,3.8,3.85,3.99,3.99,4.57,4.62,4.76,5.04,5.08,5.39,5.64,5.84,5.99,6.16,6.16,6.16,6.58,6.62,6.69,6.79,6.83,6.93,6.96,7.1,7.35,7.46,7.58,7.63,7.77,7.79,7.88,7.92,8,8.19,8.22,8.36,8.4,8.43,8.54,8.65,8.75,8.82,8.84,8.89,8.93,8.96,9,9.07,9.17,9.2,9.31,9.38,9.43,9.46,9.52,9.65,9.73,9.9,9.94,9.96,9.98,10.01,10.08,10.15,10.15,10.23,10.35,10.43,10.45,10.52,10.59,10.65,10.68,10.77,10.81,10.94,11,11.06,11.12,11.19,11.2,11.22,11.24,11.29,11.4,11.42,11.53,11.55,11.59,11.64,11.73,11.76,11.8,11.83,11.88,11.95,12,12.11,12.17,12.2,12.24,12.28,12.32,12.35,12.41,12.5,12.55,12.6,12.67,12.72,12.76,12.81,12.94,12.98,13.01,13.09,13.16,13.22,13.3,13.36,13.37,13.43,13.47,13.49,13.53,13.67,13.71,13.76,13.78,13.82,13.89,13.97,14.02,14.09,14.14,14.21,14.24,14.26,14.34,14.37,14.4,14.44,14.47,14.5,14.53,14.55,14.56,14.6,14.66,14.71,14.77,14.79,14.84,14.9,14.94,14.99,15.04,15.06,15.12,15.17,15.21,15.26,15.29,15.33,15.36,15.39,15.42,15.44,15.49,15.54,15.55,15.6,15.61,15.66,15.68,15.7,15.74,15.75,15.79,15.84,15.9,15.95,15.98,16.03,16.06,16.07,16.11,16.14,16.19,16.21,16.28,16.32,16.37,16.42,16.45,16.49,16.52,16.54,16.59,16.61,16.66,16.68,16.72,16.77,16.8,16.8,16.83,16.84,16.9,16.94,16.95,16.98,17.01,17.04,17.1,17.14,17.15,17.19,17.24,17.28,17.29,17.35,17.4,17.45,17.48,17.55,17.57,17.6,17.61,17.64,17.7,17.72,17.75,17.78,17.8,17.82,17.87,17.91,17.92,17.99,18.04,18.06,18.06,18.1,18.15,18.2,18.25,18.28,18.32,18.35,18.37,18.38,18.4,18.41,18.44,18.49,18.52,18.56,18.58,18.62,18.68,18.71,18.74,18.76,18.79,18.81,18.83,18.87,18.9,18.94,18.99,19.01,19.04,19.05,19.06,19.09,19.14,19.18,19.19,19.25,19.33,19.35,19.36,19.39,19.41,19.45,19.48,19.51,19.52,19.55,19.58,19.62,19.64,19.67,19.68,19.7,19.75,19.77,19.8,19.8,19.82,19.82,19.84,19.87,19.91,19.95,19.96,19.98,20.02,20.04,20.05,20.09,20.13,20.15,20.16,20.19,20.24,20.28,20.3,20.36,20.39,20.42,20.45,20.46,20.48,20.52,20.56,20.57,20.57,20.59,20.59,20.63,20.64,20.65,20.68,20.71,20.74,20.75,20.77,20.79,20.82,20.85,20.88,20.9,20.92,20.94,20.95,20.97,20.99,21.02,21.06,21.09,21.1,21.14,21.16,21.21,21.23,21.29,21.3,21.36,21.36,21.4,21.42,21.45,21.52,21.56,21.57,21.59,21.6,21.63,21.65,21.68,21.71,21.72,21.75,21.76,21.79,21.82,21.84,21.87,21.89,21.91,21.95,22,22.02,22.04,22.05,22.06,22.09,22.13,22.15,22.17,22.19,22.2,22.22,22.24,22.33,22.34,22.36,22.38,22.44,22.49,22.51,22.56,22.63,22.64,22.64,22.66,22.68,22.7,22.75,22.77,22.78,22.8,22.83,22.84,22.85,22.88,22.9,22.92,22.95,22.95,22.97,22.99,23,23.04,23.09,23.1,23.12,23.14,23.16,23.19,23.21,23.24,23.26,23.3,23.34,23.36,23.41,23.42,23.45,23.47,23.52,23.55,23.58,23.58,23.6,23.6,23.61,23.65,23.65,23.66,23.68,23.72,23.72,23.76,23.76,23.79,23.79,23.82,23.87,23.89,23.94,23.95,23.98,23.98,24,24.01,24.03,24.05,24.07,24.09,24.12,24.15,24.18,24.21,24.24,24.26,24.29,24.31,24.35,24.37,24.37,24.39,24.4,24.42,24.42,24.42,24.44,24.46,24.51,24.53,24.56,24.57,24.6,24.66,24.7,24.71,24.73,24.75,24.76,24.78,24.82,24.84,24.84,24.86,24.88,24.88,24.9,24.94,24.96,25.01,25.02,25.06,25.06,25.08,25.12,25.14,25.16,25.17,25.19,25.19,25.19,25.2,25.21,25.23,25.27,25.32,25.35,25.37,25.41,25.44,25.48,25.5,25.52,25.52,25.55,25.57,25.6,25.61,25.64,25.67,25.72,25.77,25.78,25.79,25.8,25.83,25.84,25.85,25.87,25.9,25.92,25.94,25.96,25.96,25.96,25.96,25.96,25.98,25.99,26.02,26.05,26.1,26.13,26.16,26.19,26.2,26.24,26.25,26.29,26.3,26.33,26.35,26.38,26.4,26.42,26.44,26.44,26.48,26.49,26.49,26.53,26.55,26.57,26.6,26.62,26.63,26.67,26.68,26.71,26.73,26.73,26.75,26.75,26.77,26.8,26.8,26.84,26.88,26.91,26.94,26.97,26.98,27.02,27.02,27.05,27.07,27.09,27.11,27.11,27.14,27.17,27.22,27.25,27.26,27.3,27.33,27.38,27.39,27.4,27.43,27.45,27.45,27.47,27.52,27.54,27.57,27.57,27.59,27.61,27.64,27.68,27.72,27.72,27.73,27.75,27.78,27.8,27.85,27.88,27.9,27.93,27.99,28,28.03,28.04,28.08,28.14,28.16,28.18,28.2,28.2,28.22,28.23,28.26,28.28,28.3,28.34,28.35,28.38,28.41,28.43,28.49,28.52,28.56,28.6,28.62,28.63,28.64,28.65,28.66,28.68,28.69,28.7,28.73,28.8,28.8,28.8,28.83,28.84,28.86,28.87,28.9,28.93,28.95,28.98,28.99,29.01,29.04,29.05,29.08,29.11,29.11,29.16,29.18,29.22,29.26,29.29,29.32,29.35,29.37,29.42,29.46,29.48,29.5,29.54,29.58,29.59,29.62,29.66,29.7,29.73,29.74,29.74,29.76,29.76,29.78,29.8,29.81,29.81,29.85,29.9,29.92,29.95,29.95,29.98,30.01,30.05,30.1,30.1,30.14,30.16,30.19,30.23,30.23,30.25,30.27,30.29,30.35,30.37,30.41,30.44,30.48,30.53,30.55,30.58,30.58,30.6,30.66,30.73,30.75,30.8,30.82,30.84,30.87,30.9,30.94,30.98,31,31,31.02,31.04,31.04,31.09,31.13,31.18,31.22,31.24,31.28,31.32,31.35,31.35,31.39,31.44,31.48,31.52,31.57,31.59,31.64,31.66,31.69,31.73,31.82,31.89,31.91,31.96,32,32.01,32.05,32.1,32.12,32.15,32.19,32.25,32.3,32.34,32.36,32.39,32.42,32.45,32.5,32.56,32.59,32.62,32.67,32.75,32.79,32.84,32.9,32.96,33.02,33.04,33.1,33.12,33.16,33.2,33.25,33.3,33.33,33.36,33.42,33.44,33.48,33.54,33.55,33.58,33.62,33.66,33.75,33.79,33.85,33.88,33.93,33.97,34.03,34.07,34.12,34.17,34.2,34.25,34.3,34.36,34.39,34.43,34.52,34.56,34.59,34.62,34.65,34.68,34.74,34.77,34.81,34.84,34.88,34.95,35,35.03,35.06,35.12,35.16,35.2,35.23,35.28,35.33,35.37,35.4,35.44,35.48,35.54,35.59,35.66,35.71,35.76,35.81,35.86,35.9,35.95,35.99,36.06,36.14,36.17,36.21,36.26,36.32,36.35,36.4,36.45,36.52,36.58,36.62,36.66,36.78,36.83,36.9,36.95,36.98,37.08,37.18,37.25,37.29,37.38,37.4,37.44,37.51,37.6,37.68,37.73,37.8,37.9,38,38.08,38.15,38.24,38.34,38.38,38.48,38.52,38.6,38.72,38.82,38.9,39,39.1,39.19,39.28,39.42,39.56,39.6,39.7,39.82,39.94,40.02,40.13,40.26,40.37,40.49,40.59,40.72,40.9,41.05,41.18,41.29,41.41,41.6,41.76,41.9,42.05,42.19,42.38,42.52,42.69,42.87,43.01,43.23,43.41,43.56,43.75,43.92,44.17,44.32,44.48,44.66,44.85,45.05,45.24,45.44,45.61,45.79,46.03,46.29,46.54,46.75,46.97,47.19,47.46,47.79,48.04,48.34,48.66,48.93,49.39,49.81,50.35,50.9,51.53,52.36,53.1,53.99,55.4,57.05,60.59],"skill_타자_기본":[0,0.55,2.03,2.1,2.45,2.7,2.75,2.85,2.85,3,3.3,3.3,3.4,3.6,3.63,3.85,4.13,4.18,4.4,4.4,4.46,4.55,4.72,4.78,4.88,4.95,4.95,5.15,5.2,5.3,5.35,5.4,5.5,5.55,5.6,5.64,5.7,5.7,5.75,5.95,5.95,6.05,6.08,6.15,6.23,6.25,6.3,6.3,6.35,6.38,6.45,6.48,6.5,6.55,6.65,6.7,6.77,6.82,6.85,6.9,6.9,6.98,7.05,7.1,7.13,7.15,7.15,7.25,7.25,7.3,7.36,7.43,7.45,7.5,7.6,7.68,7.7,7.73,7.8,7.85,7.9,7.95,7.99,8,8.03,8.09,8.14,8.18,8.25,8.25,8.33,8.4,8.43,8.45,8.52,8.55,8.58,8.65,8.7,8.7,8.75,8.8,8.85,8.93,8.95,9,9,9.03,9.05,9.09,9.13,9.15,9.2,9.25,9.3,9.33,9.35,9.45,9.5,9.52,9.55,9.57,9.59,9.6,9.65,9.74,9.8,9.8,9.82,9.87,9.9,9.93,9.95,10,10.08,10.1,10.13,10.15,10.22,10.34,10.35,10.4,10.43,10.5,10.55,10.58,10.62,10.65,10.68,10.7,10.7,10.73,10.75,10.8,10.83,10.85,10.9,10.95,10.97,11,11.02,11.05,11.08,11.1,11.17,11.2,11.25,11.27,11.3,11.35,11.37,11.38,11.4,11.44,11.45,11.5,11.5,11.53,11.55,11.58,11.6,11.63,11.65,11.68,11.7,11.73,11.75,11.78,11.79,11.82,11.85,11.85,11.85,11.89,11.92,11.95,11.95,12,12.04,12.1,12.13,12.15,12.18,12.19,12.23,12.25,12.25,12.3,12.3,12.33,12.34,12.35,12.38,12.4,12.44,12.45,12.5,12.5,12.55,12.56,12.6,12.63,12.65,12.65,12.7,12.73,12.78,12.8,12.85,12.85,12.88,12.9,12.92,12.95,12.95,13,13.03,13.08,13.12,13.15,13.19,13.2,13.22,13.25,13.25,13.3,13.33,13.35,13.4,13.4,13.4,13.43,13.44,13.45,13.45,13.5,13.53,13.55,13.57,13.6,13.65,13.67,13.7,13.73,13.75,13.75,13.78,13.8,13.8,13.82,13.85,13.85,13.85,13.88,13.92,13.95,13.96,13.99,14,14.06,14.09,14.1,14.13,14.15,14.17,14.19,14.22,14.25,14.25,14.27,14.3,14.31,14.33,14.35,14.35,14.39,14.4,14.4,14.43,14.45,14.48,14.49,14.52,14.55,14.55,14.58,14.6,14.6,14.64,14.65,14.68,14.7,14.7,14.74,14.77,14.8,14.81,14.85,14.85,14.9,14.9,14.94,14.95,14.95,14.98,15,15,15.02,15.03,15.05,15.07,15.07,15.08,15.1,15.13,15.15,15.17,15.18,15.2,15.23,15.23,15.24,15.25,15.25,15.27,15.28,15.31,15.33,15.35,15.36,15.38,15.4,15.4,15.41,15.43,15.45,15.47,15.49,15.5,15.52,15.55,15.58,15.6,15.63,15.65,15.67,15.7,15.7,15.73,15.75,15.77,15.79,15.8,15.8,15.83,15.85,15.88,15.89,15.9,15.92,15.95,15.95,15.95,15.98,16,16,16.03,16.04,16.05,16.05,16.05,16.08,16.1,16.12,16.14,16.15,16.15,16.18,16.18,16.2,16.23,16.25,16.25,16.28,16.29,16.3,16.35,16.38,16.42,16.45,16.48,16.5,16.5,16.52,16.53,16.55,16.55,16.58,16.6,16.6,16.63,16.65,16.7,16.7,16.7,16.72,16.75,16.78,16.8,16.8,16.82,16.83,16.85,16.88,16.9,16.92,16.93,16.95,16.96,16.98,17,17.03,17.04,17.05,17.06,17.1,17.1,17.15,17.15,17.18,17.2,17.22,17.24,17.25,17.27,17.28,17.3,17.33,17.35,17.35,17.37,17.4,17.4,17.43,17.43,17.45,17.47,17.48,17.5,17.53,17.55,17.6,17.6,17.6,17.63,17.65,17.66,17.7,17.7,17.7,17.73,17.75,17.77,17.79,17.8,17.82,17.84,17.85,17.85,17.88,17.92,17.94,17.95,17.98,18,18.01,18.03,18.05,18.08,18.09,18.1,18.1,18.11,18.13,18.15,18.15,18.15,18.18,18.2,18.2,18.24,18.25,18.25,18.25,18.25,18.3,18.33,18.35,18.35,18.38,18.4,18.43,18.45,18.49,18.5,18.5,18.53,18.55,18.55,18.6,18.61,18.63,18.65,18.65,18.67,18.7,18.7,18.7,18.74,18.75,18.77,18.79,18.8,18.8,18.83,18.85,18.87,18.88,18.9,18.9,18.92,18.93,18.95,18.99,19,19.02,19.03,19.05,19.09,19.1,19.15,19.18,19.2,19.22,19.25,19.25,19.25,19.26,19.3,19.33,19.35,19.35,19.38,19.4,19.43,19.45,19.47,19.5,19.5,19.53,19.55,19.57,19.58,19.6,19.62,19.63,19.65,19.65,19.65,19.67,19.68,19.7,19.75,19.76,19.8,19.8,19.8,19.8,19.85,19.88,19.9,19.91,19.95,20,20.02,20.05,20.05,20.07,20.1,20.1,20.13,20.15,20.17,20.18,20.2,20.22,20.25,20.28,20.3,20.32,20.34,20.35,20.35,20.35,20.39,20.4,20.41,20.43,20.45,20.45,20.45,20.45,20.49,20.51,20.55,20.55,20.55,20.58,20.6,20.65,20.65,20.68,20.7,20.73,20.75,20.78,20.82,20.83,20.85,20.85,20.87,20.89,20.9,20.9,20.94,20.95,20.95,20.97,21,21,21,21,21.03,21.05,21.09,21.1,21.13,21.15,21.2,21.2,21.21,21.23,21.23,21.25,21.27,21.28,21.3,21.33,21.35,21.4,21.4,21.42,21.45,21.45,21.45,21.45,21.49,21.5,21.55,21.55,21.55,21.58,21.6,21.63,21.65,21.67,21.7,21.71,21.73,21.75,21.75,21.77,21.78,21.8,21.83,21.85,21.87,21.88,21.9,21.95,21.97,22,22,22,22,22.03,22.04,22.05,22.07,22.1,22.1,22.15,22.2,22.2,22.25,22.25,22.3,22.33,22.35,22.4,22.4,22.43,22.47,22.5,22.5,22.52,22.55,22.55,22.55,22.55,22.59,22.62,22.65,22.65,22.65,22.7,22.75,22.77,22.8,22.81,22.85,22.88,22.9,22.92,22.94,22.98,23.03,23.05,23.1,23.1,23.13,23.15,23.19,23.2,23.22,23.25,23.28,23.3,23.33,23.36,23.4,23.43,23.45,23.49,23.53,23.58,23.6,23.63,23.65,23.65,23.68,23.7,23.72,23.75,23.76,23.8,23.85,23.89,23.9,23.93,23.95,23.99,24,24.02,24.03,24.05,24.08,24.09,24.12,24.15,24.2,24.2,24.25,24.26,24.3,24.3,24.35,24.35,24.4,24.42,24.45,24.45,24.45,24.48,24.5,24.53,24.57,24.58,24.6,24.65,24.7,24.7,24.74,24.75,24.75,24.79,24.8,24.85,24.85,24.85,24.85,24.88,24.9,24.91,24.99,25,25.05,25.08,25.1,25.12,25.15,25.16,25.2,25.23,25.25,25.25,25.3,25.3,25.3,25.35,25.4,25.4,25.45,25.45,25.5,25.55,25.57,25.6,25.6,25.63,25.65,25.7,25.73,25.8,25.84,25.85,25.85,25.9,25.95,25.95,26,26.01,26.05,26.08,26.15,26.18,26.22,26.25,26.3,26.38,26.4,26.4,26.44,26.5,26.55,26.6,26.69,26.73,26.78,26.82,26.88,26.9,26.95,27,27.05,27.1,27.15,27.2,27.26,27.3,27.34,27.4,27.48,27.55,27.6,27.65,27.68,27.74,27.8,27.89,27.95,28,28.05,28.06,28.1,28.15,28.2,28.3,28.35,28.42,28.45,28.48,28.53,28.62,28.7,28.75,28.81,28.85,28.9,29,29.08,29.14,29.17,29.24,29.25,29.3,29.41,29.51,29.58,29.63,29.7,29.8,29.85,30,30.03,30.12,30.25,30.31,30.4,30.49,30.62,30.7,30.8,30.88,31.03,31.18,31.28,31.35,31.45,31.6,31.74,31.9,32.01,32.1,32.24,32.42,32.55,32.7,32.87,33,33.15,33.35,33.5,33.55,33.69,33.82,34.01,34.22,34.4,34.6,34.82,35.09,35.3,35.55,35.73,35.95,36.2,36.45,36.75,37.01,37.4,37.8,38.28,38.6,39.16,39.6,40.14,40.85,42.35,44.44],"skill_선발_골든글러브":[0,0.77,1.43,1.54,2.11,2.22,2.62,2.87,2.99,3.42,3.57,3.76,3.96,4.19,4.41,4.59,4.73,4.85,5.08,5.39,5.5,5.57,5.73,5.96,6.18,6.23,6.52,6.66,6.9,7.07,7.24,7.36,7.45,7.54,7.61,7.74,7.76,7.91,8.06,8.13,8.17,8.24,8.26,8.33,8.38,8.5,8.6,8.74,8.81,8.89,8.92,8.99,9.01,9.12,9.19,9.21,9.26,9.31,9.34,9.4,9.45,9.49,9.55,9.62,9.65,9.71,9.78,9.85,9.86,9.9,9.95,9.97,10,10.03,10.05,10.07,10.11,10.12,10.25,10.27,10.34,10.35,10.45,10.52,10.56,10.62,10.66,10.68,10.71,10.74,10.79,10.81,10.86,10.89,10.91,10.92,10.94,10.99,11,11.01,11.05,11.1,11.19,11.24,11.28,11.31,11.33,11.36,11.39,11.4,11.42,11.45,11.49,11.5,11.54,11.55,11.58,11.6,11.65,11.66,11.7,11.72,11.79,11.8,11.82,11.9,11.95,11.99,12.01,12.03,12.06,12.1,12.12,12.15,12.2,12.22,12.25,12.29,12.35,12.38,12.42,12.44,12.45,12.46,12.47,12.49,12.51,12.54,12.54,12.56,12.62,12.64,12.66,12.68,12.73,12.76,12.78,12.84,12.85,12.87,12.89,12.91,12.94,12.98,12.99,13.04,13.05,13.09,13.1,13.1,13.14,13.16,13.2,13.21,13.24,13.27,13.3,13.31,13.34,13.37,13.4,13.41,13.43,13.46,13.5,13.51,13.54,13.55,13.57,13.6,13.6,13.64,13.68,13.71,13.74,13.76,13.77,13.79,13.82,13.86,13.86,13.86,13.91,13.93,13.96,13.98,13.99,14.01,14.04,14.08,14.1,14.11,14.12,14.15,14.19,14.19,14.2,14.21,14.23,14.26,14.3,14.32,14.34,14.36,14.39,14.42,14.42,14.46,14.51,14.52,14.55,14.57,14.59,14.63,14.64,14.65,14.65,14.66,14.67,14.69,14.71,14.74,14.75,14.75,14.78,14.82,14.85,14.86,14.88,14.91,14.93,14.96,14.96,14.97,15,15.01,15.05,15.07,15.07,15.08,15.1,15.14,15.15,15.19,15.23,15.25,15.29,15.3,15.3,15.31,15.31,15.33,15.34,15.36,15.4,15.4,15.41,15.42,15.44,15.47,15.48,15.51,15.52,15.55,15.57,15.62,15.64,15.66,15.67,15.7,15.7,15.73,15.74,15.75,15.77,15.8,15.8,15.82,15.84,15.84,15.87,15.89,15.91,15.95,15.96,15.97,15.98,16.05,16.06,16.06,16.06,16.09,16.1,16.13,16.14,16.16,16.18,16.19,16.19,16.21,16.21,16.23,16.24,16.28,16.29,16.3,16.35,16.37,16.39,16.4,16.41,16.43,16.45,16.46,16.47,16.5,16.52,16.54,16.57,16.62,16.62,16.63,16.68,16.7,16.71,16.74,16.75,16.76,16.77,16.79,16.81,16.84,16.84,16.85,16.85,16.85,16.85,16.87,16.87,16.87,16.89,16.92,16.94,16.94,16.94,16.95,16.96,16.99,17.01,17.02,17.04,17.05,17.06,17.08,17.12,17.12,17.16,17.16,17.2,17.24,17.24,17.25,17.27,17.28,17.29,17.31,17.34,17.36,17.38,17.39,17.41,17.42,17.47,17.5,17.5,17.51,17.51,17.51,17.53,17.54,17.56,17.57,17.59,17.6,17.61,17.62,17.65,17.69,17.72,17.75,17.77,17.78,17.8,17.82,17.83,17.84,17.84,17.85,17.86,17.89,17.9,17.9,17.93,17.94,17.95,17.99,18.03,18.07,18.08,18.1,18.13,18.15,18.16,18.16,18.17,18.19,18.21,18.24,18.26,18.28,18.3,18.31,18.32,18.32,18.35,18.38,18.39,18.39,18.4,18.41,18.44,18.49,18.5,18.56,18.57,18.59,18.59,18.6,18.61,18.63,18.66,18.66,18.7,18.71,18.72,18.76,18.8,18.82,18.82,18.84,18.86,18.89,18.9,18.92,18.94,18.95,18.95,18.96,18.97,18.99,19,19.02,19.04,19.05,19.05,19.07,19.12,19.14,19.17,19.2,19.22,19.22,19.24,19.25,19.26,19.29,19.31,19.34,19.35,19.36,19.36,19.38,19.4,19.42,19.44,19.44,19.45,19.46,19.48,19.48,19.49,19.5,19.54,19.56,19.59,19.62,19.66,19.7,19.71,19.71,19.74,19.76,19.77,19.8,19.81,19.83,19.87,19.89,19.93,19.94,19.97,20,20.01,20.02,20.04,20.04,20.05,20.06,20.08,20.1,20.1,20.12,20.13,20.14,20.18,20.2,20.25,20.27,20.27,20.29,20.3,20.32,20.33,20.35,20.36,20.36,20.37,20.39,20.41,20.44,20.44,20.46,20.48,20.5,20.5,20.52,20.54,20.57,20.58,20.59,20.6,20.62,20.66,20.68,20.69,20.7,20.72,20.76,20.77,20.8,20.81,20.83,20.84,20.88,20.9,20.91,20.92,20.96,20.98,21.01,21.03,21.05,21.09,21.1,21.12,21.15,21.15,21.2,21.21,21.24,21.25,21.26,21.27,21.32,21.34,21.36,21.4,21.44,21.46,21.47,21.49,21.51,21.53,21.55,21.55,21.57,21.58,21.6,21.64,21.65,21.67,21.7,21.74,21.77,21.79,21.81,21.84,21.86,21.87,21.9,21.91,21.91,21.96,21.99,22.01,22.01,22.04,22.07,22.09,22.13,22.14,22.17,22.2,22.22,22.24,22.24,22.25,22.3,22.3,22.3,22.32,22.34,22.37,22.4,22.43,22.45,22.47,22.49,22.54,22.55,22.55,22.57,22.61,22.64,22.64,22.66,22.67,22.7,22.7,22.72,22.75,22.78,22.78,22.79,22.81,22.86,22.87,22.9,22.91,22.95,22.96,22.99,23.01,23.02,23.07,23.09,23.12,23.15,23.19,23.22,23.23,23.26,23.29,23.31,23.32,23.33,23.35,23.39,23.44,23.45,23.46,23.48,23.52,23.54,23.56,23.57,23.61,23.63,23.64,23.67,23.69,23.7,23.72,23.75,23.75,23.77,23.77,23.78,23.78,23.81,23.84,23.85,23.87,23.9,23.95,23.98,24,24.01,24.02,24.08,24.1,24.13,24.19,24.2,24.22,24.28,24.31,24.33,24.34,24.38,24.4,24.42,24.44,24.46,24.5,24.54,24.56,24.6,24.64,24.67,24.71,24.74,24.76,24.79,24.8,24.85,24.86,24.9,24.94,24.99,25.03,25.08,25.1,25.13,25.16,25.19,25.21,25.24,25.28,25.31,25.33,25.38,25.42,25.43,25.46,25.49,25.5,25.52,25.56,25.63,25.65,25.66,25.7,25.72,25.73,25.74,25.8,25.85,25.89,25.91,25.95,25.96,26,26.05,26.08,26.12,26.18,26.2,26.21,26.26,26.28,26.3,26.34,26.38,26.4,26.45,26.51,26.55,26.62,26.64,26.67,26.72,26.75,26.77,26.8,26.84,26.87,26.9,26.94,26.95,26.98,27.04,27.06,27.1,27.17,27.2,27.23,27.28,27.3,27.35,27.4,27.42,27.48,27.52,27.58,27.62,27.68,27.75,27.84,27.86,27.9,27.93,27.95,28,28.04,28.09,28.12,28.15,28.17,28.24,28.28,28.37,28.42,28.49,28.5,28.57,28.6,28.64,28.7,28.74,28.8,28.84,28.9,28.94,28.97,29.02,29.05,29.14,29.15,29.21,29.25,29.26,29.34,29.39,29.48,29.55,29.59,29.64,29.7,29.76,29.82,29.85,29.9,29.95,30.04,30.06,30.1,30.14,30.16,30.24,30.31,30.36,30.37,30.45,30.48,30.57,30.62,30.7,30.71,30.8,30.84,30.91,30.96,31.02,31.1,31.2,31.24,31.32,31.4,31.46,31.53,31.62,31.69,31.77,31.89,31.99,32.05,32.1,32.19,32.25,32.27,32.32,32.42,32.52,32.56,32.64,32.76,32.84,32.89,32.99,33.07,33.18,33.25,33.31,33.4,33.47,33.55,33.64,33.7,33.83,33.96,34.02,34.19,34.27,34.32,34.41,34.5,34.56,34.69,34.76,34.83,34.96,35.1,35.24,35.33,35.42,35.5,35.6,35.74,35.81,35.95,36.09,36.21,36.42,36.52,36.65,36.73,36.85,37.02,37.2,37.32,37.5,37.7,37.8,38,38.26,38.49,38.71,38.87,39.02,39.16,39.5,39.77,40.04,40.26,40.76,41.03,41.23,41.72,42,42.2,42.66,43.16,43.68,44.32,45.06,45.9,47.15,48.64,51],"skill_선발_라이브":[0,0.88,1.68,1.93,2.4,2.64,3.02,3.33,3.65,3.99,4.26,4.49,4.62,4.96,5.14,5.33,5.55,5.75,6.02,6.3,6.54,6.71,6.93,7.07,7.26,7.43,7.7,7.91,8.16,8.43,8.61,8.69,8.79,8.86,8.93,8.99,9.13,9.2,9.33,9.4,9.46,9.59,9.7,9.76,9.86,9.94,10.08,10.17,10.33,10.4,10.43,10.5,10.58,10.62,10.68,10.7,10.74,10.77,10.81,10.86,10.92,10.96,11.01,11.09,11.17,11.2,11.26,11.27,11.33,11.4,11.44,11.52,11.55,11.62,11.62,11.66,11.7,11.73,11.83,11.87,11.96,12,12.08,12.14,12.18,12.26,12.27,12.31,12.34,12.36,12.39,12.43,12.47,12.51,12.56,12.61,12.64,12.68,12.72,12.75,12.77,12.82,12.85,12.9,12.94,12.99,13.03,13.09,13.12,13.16,13.2,13.21,13.24,13.29,13.31,13.38,13.39,13.43,13.47,13.54,13.58,13.59,13.62,13.66,13.66,13.72,13.76,13.89,13.93,13.94,13.96,13.98,14.03,14.07,14.1,14.15,14.18,14.2,14.24,14.32,14.36,14.4,14.42,14.46,14.5,14.53,14.56,14.59,14.63,14.66,14.69,14.72,14.76,14.8,14.84,14.88,14.88,14.92,14.95,14.97,14.98,15.02,15.03,15.05,15.12,15.13,15.16,15.18,15.23,15.27,15.29,15.33,15.36,15.39,15.4,15.43,15.49,15.52,15.53,15.57,15.59,15.6,15.62,15.65,15.68,15.73,15.76,15.79,15.82,15.85,15.86,15.86,15.88,15.91,15.95,15.99,16.02,16.06,16.09,16.13,16.17,16.17,16.17,16.2,16.24,16.26,16.28,16.31,16.35,16.41,16.45,16.48,16.52,16.53,16.57,16.61,16.63,16.66,16.68,16.72,16.75,16.8,16.81,16.85,16.88,16.91,16.92,16.94,16.98,17.01,17.05,17.08,17.08,17.09,17.15,17.16,17.16,17.19,17.22,17.26,17.3,17.32,17.33,17.33,17.38,17.39,17.44,17.46,17.47,17.51,17.53,17.54,17.55,17.58,17.6,17.62,17.64,17.69,17.73,17.79,17.79,17.8,17.8,17.82,17.85,17.85,17.88,17.89,17.92,17.93,17.94,17.96,17.97,18.01,18.06,18.06,18.09,18.1,18.13,18.14,18.17,18.19,18.22,18.24,18.26,18.28,18.31,18.37,18.37,18.39,18.41,18.48,18.48,18.5,18.53,18.55,18.56,18.57,18.59,18.61,18.63,18.66,18.69,18.7,18.74,18.76,18.78,18.8,18.82,18.83,18.84,18.87,18.91,18.94,18.95,18.97,19.01,19.02,19.05,19.05,19.05,19.09,19.11,19.14,19.15,19.19,19.24,19.25,19.28,19.28,19.3,19.36,19.36,19.36,19.38,19.39,19.39,19.41,19.45,19.47,19.48,19.49,19.51,19.52,19.53,19.53,19.56,19.58,19.59,19.6,19.63,19.66,19.66,19.66,19.68,19.73,19.73,19.74,19.76,19.8,19.82,19.82,19.83,19.85,19.85,19.87,19.9,19.92,19.94,19.97,19.99,20,20,20.02,20.02,20.05,20.05,20.11,20.13,20.13,20.16,20.16,20.16,20.19,20.2,20.24,20.24,20.26,20.29,20.31,20.33,20.37,20.38,20.41,20.43,20.43,20.46,20.46,20.47,20.48,20.51,20.54,20.57,20.62,20.63,20.68,20.73,20.73,20.75,20.79,20.79,20.81,20.83,20.88,20.9,20.93,20.97,20.98,21.03,21.04,21.07,21.09,21.1,21.12,21.15,21.17,21.18,21.21,21.23,21.25,21.25,21.25,21.27,21.29,21.31,21.32,21.34,21.38,21.41,21.42,21.44,21.45,21.46,21.48,21.51,21.56,21.58,21.59,21.59,21.6,21.64,21.65,21.68,21.7,21.71,21.72,21.73,21.76,21.77,21.78,21.79,21.81,21.84,21.86,21.86,21.88,21.91,21.91,21.93,21.95,21.95,21.98,22.01,22.02,22.02,22.05,22.06,22.06,22.11,22.13,22.13,22.16,22.2,22.21,22.22,22.22,22.25,22.26,22.3,22.33,22.33,22.36,22.38,22.4,22.42,22.42,22.47,22.49,22.5,22.52,22.54,22.57,22.6,22.63,22.66,22.68,22.73,22.76,22.78,22.8,22.83,22.86,22.89,22.93,22.93,22.96,22.97,22.99,23.01,23.01,23.04,23.04,23.09,23.11,23.13,23.16,23.18,23.18,23.23,23.25,23.27,23.31,23.32,23.35,23.38,23.38,23.38,23.4,23.44,23.45,23.45,23.47,23.49,23.52,23.54,23.56,23.59,23.62,23.62,23.65,23.65,23.65,23.67,23.69,23.73,23.76,23.77,23.78,23.8,23.81,23.84,23.84,23.88,23.9,23.91,23.95,23.98,23.98,23.99,24.01,24.05,24.08,24.1,24.11,24.14,24.15,24.17,24.2,24.22,24.22,24.25,24.26,24.28,24.28,24.31,24.34,24.39,24.43,24.46,24.48,24.53,24.55,24.59,24.62,24.63,24.66,24.68,24.72,24.73,24.76,24.82,24.83,24.86,24.9,24.9,24.94,24.97,24.99,25.03,25.06,25.09,25.11,25.13,25.14,25.16,25.19,25.21,25.22,25.24,25.25,25.28,25.3,25.32,25.35,25.37,25.38,25.4,25.43,25.44,25.48,25.51,25.51,25.55,25.57,25.58,25.59,25.65,25.65,25.65,25.7,25.71,25.73,25.76,25.78,25.8,25.83,25.85,25.85,25.87,25.87,25.88,25.91,25.96,25.97,26,26.04,26.04,26.09,26.11,26.12,26.14,26.17,26.19,26.21,26.23,26.29,26.32,26.34,26.35,26.38,26.4,26.42,26.44,26.47,26.48,26.53,26.55,26.59,26.6,26.64,26.65,26.67,26.7,26.75,26.78,26.82,26.86,26.91,26.95,26.98,27,27.03,27.03,27.06,27.1,27.12,27.16,27.21,27.25,27.26,27.3,27.33,27.34,27.34,27.37,27.4,27.41,27.44,27.44,27.46,27.51,27.52,27.55,27.58,27.58,27.62,27.64,27.64,27.67,27.71,27.71,27.74,27.78,27.81,27.83,27.85,27.87,27.92,27.98,28,28.03,28.05,28.07,28.1,28.14,28.18,28.19,28.24,28.27,28.31,28.33,28.37,28.4,28.43,28.46,28.51,28.53,28.56,28.59,28.62,28.62,28.66,28.68,28.74,28.81,28.82,28.86,28.89,28.96,28.99,29.02,29.08,29.14,29.16,29.2,29.23,29.23,29.26,29.3,29.3,29.33,29.37,29.43,29.47,29.5,29.53,29.55,29.57,29.61,29.64,29.68,29.73,29.77,29.78,29.84,29.86,29.91,29.92,29.96,30.02,30.05,30.12,30.14,30.18,30.2,30.25,30.27,30.28,30.33,30.37,30.4,30.45,30.5,30.55,30.59,30.67,30.73,30.77,30.8,30.86,30.91,30.98,31,31.05,31.06,31.16,31.2,31.23,31.27,31.33,31.4,31.43,31.43,31.5,31.54,31.6,31.63,31.68,31.74,31.79,31.84,31.88,31.96,32.03,32.09,32.14,32.18,32.25,32.26,32.34,32.41,32.45,32.48,32.56,32.59,32.66,32.71,32.73,32.77,32.81,32.88,32.94,32.96,33,33.04,33.13,33.2,33.24,33.29,33.37,33.42,33.46,33.52,33.59,33.63,33.71,33.77,33.84,33.88,33.92,33.94,34.01,34.08,34.15,34.21,34.32,34.44,34.52,34.58,34.65,34.68,34.71,34.76,34.79,34.87,34.93,34.96,35.04,35.1,35.19,35.22,35.32,35.39,35.4,35.47,35.55,35.62,35.71,35.78,35.83,35.9,35.97,36.06,36.17,36.24,36.31,36.44,36.5,36.58,36.65,36.69,36.81,36.87,36.96,37.08,37.13,37.26,37.31,37.4,37.46,37.6,37.62,37.75,37.83,37.93,38.06,38.14,38.24,38.35,38.43,38.58,38.71,38.78,38.85,38.95,39.04,39.09,39.18,39.28,39.38,39.46,39.6,39.73,39.87,39.95,40.06,40.17,40.31,40.48,40.61,40.73,40.83,40.95,41.05,41.14,41.27,41.38,41.51,41.66,41.8,41.88,42.05,42.18,42.32,42.47,42.68,42.84,43.11,43.25,43.45,43.56,43.73,43.93,44.09,44.28,44.5,44.67,44.94,45.22,45.45,45.67,45.94,46.22,46.46,46.85,47.17,47.53,47.9,48.4,48.73,49.39,49.9,50.43,51.06,52.02,52.86,53.84,55.22,57.6,60.85],"skill_선발_올스타":[0,1.23,1.76,2.22,2.45,2.75,3.13,3.44,3.69,4.16,4.42,4.62,4.98,5.15,5.39,5.61,5.75,5.94,6.23,6.39,6.66,6.93,7.16,7.38,7.62,7.86,7.98,8.05,8.39,8.61,8.84,8.92,9.07,9.15,9.43,9.54,9.61,9.69,9.74,9.87,9.93,10.08,10.22,10.4,10.5,10.65,10.73,10.81,10.86,10.97,11.13,11.17,11.28,11.39,11.44,11.55,11.61,11.69,11.77,11.84,11.89,11.95,12.01,12.05,12.11,12.15,12.19,12.26,12.32,12.33,12.45,12.54,12.6,12.64,12.68,12.76,12.79,12.91,12.97,13.04,13.09,13.12,13.18,13.23,13.29,13.31,13.34,13.42,13.48,13.51,13.56,13.63,13.68,13.71,13.76,13.79,13.82,13.87,13.93,13.95,13.97,14.04,14.08,14.11,14.14,14.2,14.26,14.31,14.38,14.41,14.47,14.53,14.56,14.6,14.66,14.72,14.8,14.85,14.9,14.97,14.99,15.02,15.06,15.12,15.18,15.2,15.24,15.29,15.35,15.39,15.41,15.43,15.47,15.52,15.54,15.6,15.62,15.64,15.67,15.72,15.75,15.78,15.81,15.82,15.84,15.86,15.89,15.91,15.97,15.98,16,16.03,16.06,16.09,16.14,16.17,16.17,16.2,16.25,16.28,16.3,16.31,16.36,16.44,16.45,16.48,16.52,16.55,16.61,16.63,16.65,16.69,16.75,16.78,16.81,16.86,16.91,16.94,16.95,16.97,17.05,17.08,17.11,17.16,17.2,17.23,17.28,17.31,17.33,17.38,17.41,17.47,17.49,17.52,17.57,17.6,17.6,17.62,17.66,17.7,17.73,17.75,17.77,17.79,17.81,17.85,17.91,17.93,17.96,18,18.06,18.06,18.06,18.1,18.13,18.14,18.19,18.21,18.24,18.26,18.29,18.36,18.37,18.37,18.41,18.43,18.45,18.52,18.57,18.59,18.65,18.68,18.7,18.75,18.78,18.83,18.83,18.86,18.91,18.99,19.03,19.05,19.09,19.14,19.16,19.19,19.21,19.25,19.28,19.28,19.3,19.34,19.36,19.36,19.38,19.39,19.41,19.45,19.47,19.48,19.51,19.53,19.53,19.55,19.6,19.61,19.63,19.66,19.7,19.72,19.75,19.8,19.8,19.82,19.82,19.83,19.86,19.88,19.92,19.97,19.99,19.99,20,20,20.02,20.05,20.06,20.1,20.11,20.13,20.13,20.16,20.17,20.19,20.22,20.26,20.26,20.27,20.3,20.3,20.35,20.38,20.4,20.43,20.46,20.46,20.47,20.49,20.54,20.57,20.57,20.57,20.6,20.64,20.67,20.7,20.74,20.77,20.81,20.84,20.9,20.93,20.98,21.02,21.03,21.04,21.07,21.09,21.11,21.14,21.15,21.18,21.21,21.21,21.25,21.25,21.27,21.29,21.31,21.36,21.36,21.39,21.45,21.47,21.48,21.48,21.53,21.56,21.56,21.57,21.59,21.59,21.63,21.66,21.67,21.68,21.71,21.72,21.73,21.73,21.76,21.76,21.78,21.81,21.86,21.86,21.88,21.92,21.93,21.93,21.94,21.96,22.01,22.02,22.02,22.05,22.06,22.11,22.13,22.14,22.19,22.19,22.2,22.2,22.22,22.22,22.23,22.25,22.28,22.33,22.33,22.35,22.36,22.38,22.4,22.4,22.43,22.49,22.5,22.52,22.57,22.58,22.63,22.66,22.66,22.68,22.7,22.71,22.76,22.8,22.83,22.86,22.88,22.92,22.93,22.97,22.97,22.99,23.01,23.01,23.04,23.06,23.12,23.16,23.17,23.18,23.24,23.25,23.27,23.3,23.32,23.34,23.35,23.37,23.38,23.41,23.41,23.44,23.45,23.45,23.45,23.48,23.49,23.52,23.52,23.54,23.59,23.6,23.62,23.65,23.65,23.65,23.71,23.76,23.79,23.79,23.8,23.81,23.83,23.87,23.88,23.89,23.9,23.91,23.96,23.96,23.98,23.99,24.01,24.06,24.06,24.06,24.08,24.1,24.12,24.13,24.15,24.16,24.18,24.22,24.22,24.24,24.25,24.26,24.32,24.33,24.36,24.42,24.42,24.44,24.48,24.52,24.53,24.55,24.56,24.56,24.6,24.62,24.64,24.66,24.69,24.76,24.8,24.82,24.84,24.88,24.89,24.92,24.97,24.98,25.01,25.05,25.08,25.1,25.13,25.14,25.19,25.21,25.21,25.24,25.26,25.29,25.32,25.34,25.38,25.39,25.43,25.47,25.49,25.51,25.55,25.56,25.58,25.58,25.62,25.65,25.65,25.68,25.72,25.73,25.74,25.77,25.8,25.82,25.85,25.85,25.86,25.87,25.9,25.93,25.96,25.98,26,26.02,26.04,26.05,26.1,26.11,26.13,26.18,26.19,26.19,26.21,26.23,26.29,26.32,26.34,26.35,26.35,26.38,26.4,26.42,26.42,26.46,26.48,26.49,26.53,26.57,26.6,26.6,26.65,26.66,26.69,26.72,26.74,26.76,26.8,26.82,26.82,26.85,26.87,26.92,26.96,27,27.03,27.06,27.1,27.15,27.19,27.22,27.26,27.29,27.32,27.33,27.34,27.37,27.38,27.41,27.43,27.44,27.47,27.5,27.51,27.55,27.57,27.58,27.6,27.63,27.64,27.68,27.71,27.74,27.78,27.78,27.79,27.81,27.85,27.85,27.85,27.86,27.89,27.93,27.98,27.99,28.02,28.05,28.05,28.07,28.1,28.16,28.19,28.24,28.27,28.31,28.31,28.32,28.34,28.37,28.41,28.42,28.45,28.46,28.47,28.51,28.54,28.55,28.57,28.62,28.62,28.64,28.66,28.68,28.69,28.74,28.78,28.8,28.82,28.84,28.88,28.9,28.93,28.96,29.01,29.05,29.08,29.13,29.16,29.2,29.23,29.25,29.28,29.3,29.34,29.37,29.42,29.46,29.48,29.51,29.53,29.53,29.54,29.57,29.58,29.61,29.61,29.64,29.66,29.7,29.72,29.75,29.78,29.78,29.83,29.84,29.89,29.91,29.92,29.95,30,30.04,30.08,30.12,30.17,30.18,30.2,30.25,30.25,30.26,30.28,30.31,30.36,30.38,30.4,30.45,30.5,30.53,30.54,30.57,30.59,30.64,30.66,30.69,30.72,30.75,30.79,30.81,30.84,30.86,30.89,30.93,30.98,31,31.02,31.06,31.09,31.15,31.19,31.22,31.26,31.3,31.34,31.36,31.39,31.43,31.43,31.46,31.5,31.5,31.54,31.57,31.63,31.7,31.73,31.77,31.8,31.84,31.84,31.88,31.97,32.01,32.04,32.06,32.11,32.11,32.14,32.18,32.22,32.25,32.28,32.32,32.36,32.4,32.45,32.47,32.47,32.53,32.58,32.6,32.64,32.68,32.71,32.76,32.79,32.82,32.86,32.92,32.95,33,33.02,33.06,33.08,33.15,33.2,33.22,33.29,33.33,33.39,33.46,33.5,33.57,33.63,33.63,33.69,33.77,33.8,33.88,33.93,33.94,33.97,34.01,34.04,34.1,34.13,34.18,34.24,34.32,34.38,34.45,34.52,34.58,34.62,34.65,34.68,34.74,34.77,34.81,34.88,34.92,34.98,35.01,35.07,35.12,35.15,35.2,35.26,35.33,35.4,35.47,35.55,35.6,35.64,35.71,35.76,35.83,35.83,35.87,35.94,35.98,36.06,36.11,36.17,36.24,36.3,36.35,36.43,36.49,36.55,36.65,36.72,36.78,36.84,36.87,36.9,36.96,36.99,37.05,37.11,37.19,37.26,37.36,37.42,37.46,37.53,37.6,37.68,37.77,37.86,37.95,38,38.09,38.16,38.23,38.27,38.33,38.41,38.47,38.58,38.7,38.75,38.83,38.89,38.98,39.07,39.12,39.19,39.28,39.34,39.41,39.49,39.6,39.66,39.75,39.82,39.98,40.04,40.1,40.23,40.29,40.37,40.47,40.57,40.65,40.8,40.91,40.98,41.05,41.18,41.25,41.3,41.39,41.52,41.66,41.79,41.86,42,42.08,42.15,42.22,42.32,42.46,42.57,42.71,42.85,43.04,43.18,43.25,43.36,43.47,43.56,43.62,43.73,43.88,44,44.13,44.25,44.35,44.46,44.63,44.73,44.93,45.09,45.27,45.39,45.53,45.65,45.79,45.93,46.12,46.29,46.48,46.62,46.8,47.09,47.3,47.56,47.76,47.99,48.26,48.48,48.7,48.95,49.34,49.58,49.92,50.2,50.64,50.95,51.43,51.88,52.05,52.68,53.18,53.79,55,55.66,57.06,58.31,59.72,61.8,65.18],"skill_선발_기본":[0,1.1,1.32,1.65,1.87,2.09,2.36,2.57,2.74,3.05,3.25,3.38,3.6,3.83,4.02,4.11,4.3,4.43,4.56,4.75,4.96,5.14,5.39,5.54,5.7,5.87,5.97,6.15,6.35,6.47,6.55,6.81,6.92,7.01,7.07,7.16,7.26,7.38,7.5,7.63,7.78,7.85,7.95,8.02,8.15,8.21,8.28,8.4,8.41,8.5,8.57,8.61,8.71,8.75,8.81,8.85,8.94,9.03,9.06,9.12,9.14,9.16,9.21,9.27,9.3,9.32,9.38,9.44,9.47,9.51,9.57,9.64,9.67,9.73,9.76,9.78,9.82,9.85,9.88,9.9,9.93,9.99,10,10.05,10.08,10.12,10.17,10.2,10.23,10.27,10.31,10.35,10.38,10.4,10.43,10.47,10.54,10.57,10.6,10.61,10.65,10.69,10.71,10.75,10.77,10.81,10.88,10.9,10.91,10.93,10.99,11,11.04,11.07,11.11,11.12,11.15,11.16,11.18,11.21,11.24,11.25,11.26,11.29,11.32,11.33,11.34,11.35,11.44,11.45,11.48,11.53,11.55,11.58,11.63,11.65,11.67,11.7,11.73,11.77,11.8,11.82,11.85,11.88,11.88,11.9,11.95,11.98,12.01,12.03,12.05,12.08,12.11,12.15,12.19,12.19,12.21,12.22,12.26,12.26,12.3,12.32,12.34,12.38,12.4,12.42,12.43,12.45,12.45,12.47,12.5,12.51,12.53,12.57,12.59,12.59,12.62,12.64,12.65,12.69,12.7,12.71,12.75,12.77,12.78,12.8,12.82,12.85,12.87,12.9,12.92,12.95,12.97,13,13.04,13.05,13.09,13.12,13.14,13.15,13.2,13.2,13.2,13.25,13.3,13.33,13.35,13.41,13.43,13.45,13.5,13.52,13.53,13.55,13.56,13.58,13.6,13.62,13.64,13.64,13.66,13.68,13.7,13.71,13.74,13.75,13.75,13.75,13.77,13.79,13.85,13.85,13.86,13.88,13.9,13.92,13.94,13.97,13.99,14.01,14.03,14.05,14.07,14.08,14.1,14.1,14.12,14.16,14.17,14.18,14.19,14.22,14.24,14.26,14.3,14.3,14.3,14.33,14.36,14.38,14.41,14.45,14.46,14.46,14.5,14.52,14.52,14.55,14.58,14.6,14.62,14.63,14.65,14.65,14.67,14.7,14.73,14.75,14.79,14.8,14.84,14.85,14.86,14.88,14.9,14.92,14.93,14.95,14.96,14.98,15,15,15.01,15.02,15.04,15.05,15.06,15.09,15.1,15.12,15.15,15.15,15.17,15.19,15.2,15.22,15.23,15.26,15.29,15.31,15.33,15.35,15.36,15.37,15.39,15.4,15.41,15.44,15.48,15.49,15.5,15.5,15.53,15.55,15.55,15.56,15.57,15.6,15.61,15.62,15.62,15.65,15.67,15.7,15.7,15.72,15.73,15.73,15.75,15.75,15.78,15.8,15.8,15.84,15.89,15.91,15.93,15.94,15.94,15.95,15.95,15.97,15.99,16.02,16.05,16.05,16.08,16.1,16.12,16.15,16.16,16.2,16.21,16.24,16.25,16.26,16.27,16.28,16.28,16.3,16.31,16.32,16.35,16.37,16.38,16.4,16.41,16.43,16.45,16.45,16.47,16.49,16.5,16.5,16.51,16.52,16.55,16.58,16.59,16.6,16.61,16.63,16.65,16.66,16.66,16.68,16.7,16.72,16.72,16.72,16.73,16.75,16.75,16.77,16.79,16.81,16.83,16.85,16.85,16.85,16.86,16.88,16.9,16.92,16.95,16.95,16.99,17,17,17.02,17.04,17.05,17.05,17.06,17.07,17.09,17.13,17.15,17.18,17.19,17.2,17.2,17.2,17.21,17.21,17.25,17.26,17.27,17.27,17.3,17.31,17.35,17.35,17.37,17.38,17.4,17.4,17.42,17.45,17.47,17.5,17.51,17.52,17.53,17.56,17.57,17.59,17.6,17.63,17.64,17.65,17.69,17.7,17.73,17.74,17.75,17.76,17.77,17.8,17.82,17.84,17.85,17.89,17.9,17.92,17.94,17.95,17.97,17.98,17.99,18.01,18.02,18.03,18.04,18.05,18.07,18.08,18.11,18.13,18.14,18.14,18.15,18.17,18.18,18.2,18.2,18.23,18.25,18.25,18.25,18.27,18.3,18.32,18.35,18.37,18.4,18.45,18.45,18.45,18.46,18.46,18.47,18.49,18.5,18.52,18.52,18.53,18.55,18.57,18.58,18.6,18.65,18.65,18.67,18.69,18.7,18.7,18.72,18.77,18.78,18.8,18.8,18.84,18.86,18.89,18.9,18.9,18.91,18.95,18.95,18.95,18.98,19,19.02,19.03,19.05,19.08,19.1,19.11,19.16,19.17,19.21,19.23,19.24,19.25,19.25,19.28,19.3,19.32,19.35,19.35,19.39,19.4,19.4,19.44,19.45,19.45,19.46,19.47,19.49,19.5,19.51,19.54,19.55,19.57,19.58,19.59,19.6,19.62,19.66,19.7,19.7,19.71,19.73,19.75,19.77,19.77,19.79,19.8,19.83,19.85,19.89,19.9,19.93,19.94,19.96,19.97,20,20.02,20.02,20.05,20.05,20.05,20.09,20.12,20.13,20.15,20.16,20.16,20.21,20.22,20.22,20.24,20.25,20.27,20.29,20.32,20.34,20.35,20.35,20.38,20.4,20.44,20.47,20.48,20.5,20.53,20.55,20.6,20.61,20.65,20.66,20.68,20.7,20.7,20.72,20.75,20.75,20.78,20.83,20.86,20.89,20.9,20.92,20.95,20.98,20.99,21.01,21.03,21.06,21.09,21.1,21.1,21.12,21.14,21.15,21.15,21.18,21.18,21.2,21.22,21.25,21.25,21.26,21.3,21.3,21.32,21.33,21.36,21.37,21.41,21.43,21.44,21.45,21.47,21.48,21.5,21.53,21.55,21.55,21.58,21.6,21.61,21.64,21.65,21.66,21.67,21.69,21.7,21.73,21.75,21.75,21.77,21.8,21.8,21.83,21.87,21.9,21.93,21.95,21.96,21.98,22,22.01,22.07,22.09,22.12,22.15,22.19,22.2,22.21,22.25,22.26,22.3,22.33,22.36,22.37,22.4,22.41,22.42,22.43,22.45,22.47,22.47,22.49,22.51,22.52,22.54,22.55,22.55,22.59,22.6,22.63,22.65,22.66,22.71,22.74,22.75,22.78,22.8,22.85,22.86,22.88,22.9,22.92,22.94,22.95,22.97,22.99,23.02,23.05,23.07,23.1,23.1,23.15,23.2,23.21,23.25,23.27,23.3,23.32,23.35,23.39,23.42,23.44,23.46,23.52,23.55,23.6,23.64,23.65,23.67,23.72,23.74,23.77,23.8,23.8,23.84,23.86,23.88,23.89,23.91,23.95,23.95,23.97,23.98,24,24,24.05,24.09,24.13,24.15,24.17,24.2,24.2,24.23,24.26,24.29,24.34,24.36,24.4,24.41,24.42,24.45,24.47,24.51,24.53,24.56,24.6,24.63,24.65,24.66,24.71,24.75,24.77,24.83,24.86,24.9,24.92,24.95,24.99,25.05,25.06,25.1,25.15,25.18,25.21,25.26,25.3,25.32,25.37,25.4,25.42,25.45,25.47,25.5,25.52,25.55,25.59,25.63,25.65,25.7,25.73,25.78,25.83,25.85,25.88,25.92,25.95,25.99,26.03,26.06,26.1,26.13,26.17,26.2,26.3,26.36,26.4,26.4,26.45,26.5,26.56,26.62,26.65,26.68,26.73,26.75,26.8,26.82,26.85,26.87,26.9,26.95,26.95,27.01,27.06,27.1,27.17,27.23,27.28,27.32,27.38,27.45,27.5,27.5,27.58,27.65,27.68,27.71,27.73,27.76,27.83,27.85,27.9,27.95,28.02,28.05,28.1,28.15,28.19,28.21,28.25,28.29,28.35,28.4,28.44,28.5,28.57,28.6,28.6,28.71,28.76,28.81,28.87,28.96,29.01,29.06,29.14,29.15,29.2,29.25,29.35,29.44,29.47,29.55,29.64,29.7,29.78,29.86,29.92,29.95,30.03,30.13,30.24,30.3,30.35,30.4,30.47,30.53,30.58,30.67,30.77,30.8,30.87,31,31.05,31.11,31.2,31.28,31.35,31.48,31.56,31.68,31.85,31.94,32.04,32.1,32.15,32.19,32.3,32.43,32.55,32.62,32.74,32.87,33,33.13,33.25,33.36,33.45,33.55,33.65,33.86,34.1,34.3,34.35,34.52,34.7,34.91,35.2,35.33,35.54,35.75,36.05,36.32,36.52,36.77,37.17,37.58,37.81,38.25,38.7,39.1,39.67,40.25,41.2,42.22,43.48,46.16],"skill_중계_골든글러브":[0,1.47,2.1,2.64,3.3,3.55,3.96,4.1,4.62,4.88,5.4,5.57,6.06,6.34,6.82,6.9,7.36,7.45,7.52,7.62,7.98,8.1,8.17,8.31,8.35,8.37,8.5,8.8,8.83,8.99,9.03,9.19,9.26,9.32,9.45,9.48,9.57,9.65,9.81,9.86,9.95,9.98,10.05,10.09,10.11,10.12,10.26,10.32,10.4,10.49,10.53,10.62,10.66,10.7,10.76,10.79,10.81,10.89,10.9,10.92,10.99,11,11.05,11.15,11.24,11.27,11.3,11.32,11.35,11.41,11.44,11.46,11.52,11.55,11.56,11.58,11.63,11.66,11.77,11.8,11.83,11.88,11.94,11.96,11.99,12.02,12.05,12.09,12.15,12.2,12.23,12.25,12.29,12.33,12.39,12.45,12.45,12.47,12.51,12.56,12.61,12.63,12.65,12.68,12.71,12.76,12.8,12.85,12.87,12.9,12.94,12.98,13,13.02,13.05,13.1,13.1,13.13,13.16,13.2,13.22,13.27,13.29,13.3,13.32,13.37,13.4,13.42,13.45,13.49,13.51,13.53,13.55,13.56,13.6,13.62,13.65,13.7,13.74,13.76,13.77,13.79,13.82,13.86,13.86,13.89,13.92,13.95,13.97,14,14.05,14.07,14.09,14.14,14.17,14.19,14.2,14.23,14.26,14.3,14.32,14.35,14.36,14.41,14.42,14.43,14.45,14.47,14.52,14.54,14.57,14.6,14.61,14.64,14.65,14.65,14.65,14.66,14.67,14.68,14.74,14.75,14.77,14.82,14.86,14.87,14.88,14.92,14.96,14.97,14.99,15.01,15.02,15.07,15.08,15.1,15.13,15.16,15.18,15.19,15.21,15.24,15.26,15.29,15.3,15.3,15.31,15.33,15.34,15.39,15.4,15.4,15.41,15.44,15.47,15.51,15.52,15.59,15.62,15.65,15.67,15.7,15.74,15.77,15.8,15.82,15.84,15.84,15.88,15.9,15.93,15.96,15.98,16.03,16.05,16.06,16.06,16.06,16.1,16.1,16.12,16.12,16.14,16.17,16.19,16.22,16.27,16.29,16.3,16.32,16.34,16.35,16.38,16.39,16.4,16.41,16.43,16.46,16.49,16.5,16.53,16.57,16.6,16.62,16.62,16.63,16.64,16.66,16.7,16.73,16.75,16.75,16.76,16.77,16.79,16.83,16.85,16.85,16.85,16.85,16.85,16.87,16.87,16.89,16.92,16.94,16.96,16.97,16.99,17.02,17.05,17.06,17.08,17.13,17.16,17.16,17.19,17.2,17.22,17.26,17.28,17.28,17.29,17.3,17.3,17.31,17.35,17.37,17.38,17.39,17.42,17.44,17.47,17.5,17.5,17.5,17.51,17.51,17.53,17.54,17.56,17.57,17.61,17.62,17.66,17.7,17.74,17.76,17.77,17.8,17.81,17.82,17.84,17.84,17.84,17.86,17.88,17.9,17.92,17.94,17.95,17.97,18.02,18.04,18.06,18.07,18.07,18.08,18.1,18.14,18.16,18.17,18.19,18.2,18.25,18.28,18.3,18.3,18.32,18.32,18.32,18.35,18.37,18.39,18.43,18.45,18.46,18.49,18.5,18.53,18.56,18.59,18.59,18.59,18.6,18.61,18.61,18.63,18.63,18.69,18.7,18.72,18.74,18.75,18.76,18.78,18.82,18.82,18.82,18.83,18.83,18.85,18.88,18.93,18.95,18.95,18.97,18.98,19.01,19.05,19.05,19.05,19.06,19.07,19.1,19.14,19.16,19.2,19.22,19.25,19.26,19.26,19.27,19.29,19.34,19.36,19.36,19.36,19.37,19.4,19.4,19.44,19.47,19.48,19.48,19.49,19.49,19.49,19.49,19.51,19.52,19.54,19.56,19.6,19.64,19.67,19.7,19.71,19.73,19.75,19.77,19.8,19.81,19.82,19.86,19.89,19.9,19.93,19.94,19.95,20,20.02,20.02,20.04,20.04,20.04,20.05,20.06,20.07,20.1,20.1,20.11,20.14,20.15,20.17,20.19,20.22,20.26,20.27,20.27,20.29,20.29,20.32,20.35,20.35,20.38,20.41,20.44,20.46,20.47,20.49,20.5,20.5,20.52,20.54,20.55,20.57,20.58,20.6,20.65,20.68,20.69,20.7,20.71,20.72,20.76,20.79,20.81,20.81,20.81,20.83,20.83,20.87,20.92,20.92,20.94,20.95,20.96,20.99,21.01,21.03,21.05,21.09,21.1,21.14,21.15,21.15,21.2,21.23,21.25,21.25,21.26,21.26,21.27,21.3,21.32,21.34,21.35,21.38,21.42,21.45,21.46,21.46,21.48,21.49,21.49,21.51,21.54,21.55,21.55,21.57,21.59,21.6,21.64,21.67,21.69,21.71,21.76,21.77,21.78,21.8,21.84,21.86,21.9,21.91,21.92,21.94,21.99,22,22.01,22.01,22.03,22.07,22.09,22.1,22.14,22.14,22.17,22.2,22.21,22.24,22.24,22.25,22.25,22.29,22.3,22.3,22.31,22.35,22.4,22.42,22.44,22.46,22.47,22.49,22.54,22.55,22.55,22.58,22.6,22.64,22.66,22.68,22.69,22.7,22.72,22.74,22.78,22.78,22.84,22.86,22.9,22.9,22.92,22.96,22.96,22.99,22.99,23,23.01,23.02,23.06,23.1,23.12,23.15,23.16,23.19,23.22,23.22,23.23,23.24,23.26,23.29,23.31,23.33,23.35,23.37,23.45,23.45,23.46,23.46,23.46,23.49,23.52,23.52,23.54,23.59,23.63,23.65,23.66,23.69,23.69,23.71,23.72,23.75,23.75,23.75,23.76,23.76,23.77,23.79,23.83,23.87,23.89,23.89,23.91,23.98,24,24.02,24.06,24.06,24.1,24.11,24.13,24.14,24.19,24.2,24.2,24.21,24.22,24.28,24.31,24.33,24.34,24.4,24.41,24.44,24.44,24.46,24.5,24.52,24.55,24.57,24.62,24.66,24.68,24.72,24.75,24.76,24.8,24.84,24.86,24.89,24.91,24.92,24.96,24.97,25,25.05,25.08,25.1,25.16,25.19,25.2,25.21,25.23,25.28,25.3,25.32,25.35,25.37,25.42,25.43,25.45,25.46,25.49,25.5,25.52,25.55,25.61,25.65,25.66,25.66,25.72,25.73,25.74,25.8,25.85,25.86,25.89,25.89,25.9,25.95,25.95,25.96,26,26.05,26.08,26.1,26.14,26.19,26.2,26.22,26.26,26.27,26.3,26.33,26.34,26.39,26.4,26.4,26.42,26.48,26.51,26.54,26.57,26.62,26.64,26.64,26.67,26.7,26.7,26.74,26.79,26.84,26.87,26.89,26.94,26.94,26.96,27,27.06,27.09,27.14,27.18,27.21,27.24,27.27,27.3,27.33,27.36,27.4,27.42,27.44,27.49,27.52,27.55,27.63,27.65,27.72,27.76,27.84,27.85,27.87,27.92,27.95,27.99,28.04,28.06,28.09,28.11,28.15,28.17,28.22,28.28,28.35,28.38,28.4,28.46,28.5,28.52,28.55,28.6,28.6,28.64,28.68,28.72,28.76,28.81,28.84,28.89,28.9,28.95,29,29.04,29.09,29.14,29.14,29.17,29.23,29.26,29.31,29.36,29.44,29.49,29.53,29.56,29.6,29.65,29.7,29.76,29.81,29.83,29.85,29.89,29.95,29.99,30.05,30.05,30.06,30.11,30.15,30.22,30.29,30.32,30.36,30.37,30.45,30.49,30.53,30.58,30.6,30.66,30.7,30.74,30.8,30.8,30.89,30.94,31.02,31.06,31.13,31.2,31.25,31.29,31.35,31.44,31.47,31.52,31.62,31.68,31.74,31.79,31.83,31.94,32,32.04,32.12,32.2,32.25,32.27,32.35,32.46,32.54,32.56,32.64,32.7,32.76,32.8,32.86,32.9,32.96,33,33.02,33.14,33.22,33.25,33.3,33.33,33.42,33.5,33.55,33.63,33.69,33.8,33.9,33.96,34.01,34.14,34.2,34.26,34.38,34.45,34.47,34.59,34.69,34.75,34.8,34.9,35.05,35.1,35.2,35.25,35.35,35.44,35.52,35.62,35.74,35.85,35.92,36.05,36.19,36.3,36.42,36.51,36.65,36.67,36.76,36.92,36.96,37.11,37.21,37.3,37.4,37.51,37.66,37.73,37.91,38,38.19,38.36,38.49,38.62,38.82,38.88,39.03,39.16,39.34,39.54,39.7,39.9,40.1,40.22,40.43,40.76,40.99,41.08,41.36,41.65,41.91,42.04,42.22,42.46,42.79,43.12,43.27,43.6,43.94,44.3,44.62,45.22,45.67,46.2,46.8,47.54,48.27,48.8,49.85,51.2,53.3],"skill_중계_라이브":[0,1.68,2.4,3.08,3.65,4.26,4.62,4.78,5.33,5.66,6.19,6.46,6.8,7.04,7.64,7.77,8.05,8.4,8.68,8.82,8.86,8.99,9.28,9.4,9.49,9.66,9.75,9.91,10.01,10.12,10.36,10.45,10.5,10.61,10.71,10.8,10.93,11.01,11.13,11.2,11.26,11.3,11.35,11.44,11.54,11.62,11.64,11.7,11.76,11.87,11.97,12.04,12.08,12.17,12.24,12.31,12.32,12.38,12.41,12.45,12.55,12.64,12.66,12.73,12.81,12.85,12.9,12.93,12.99,13.05,13.09,13.16,13.2,13.23,13.26,13.38,13.43,13.47,13.53,13.58,13.59,13.63,13.67,13.73,13.77,13.85,13.93,13.94,13.97,14,14.06,14.11,14.15,14.2,14.25,14.32,14.35,14.41,14.47,14.49,14.56,14.58,14.63,14.67,14.71,14.72,14.76,14.79,14.85,14.91,14.92,14.97,14.98,15.03,15.07,15.12,15.13,15.16,15.19,15.23,15.28,15.29,15.39,15.4,15.4,15.45,15.49,15.51,15.53,15.54,15.58,15.61,15.68,15.7,15.76,15.79,15.82,15.86,15.88,15.92,15.97,15.98,16.03,16.05,16.09,16.12,16.16,16.17,16.17,16.17,16.21,16.25,16.28,16.29,16.31,16.33,16.4,16.44,16.45,16.49,16.55,16.57,16.64,16.66,16.7,16.75,16.8,16.82,16.85,16.89,16.91,16.93,16.94,16.97,16.98,17.04,17.05,17.08,17.08,17.08,17.1,17.16,17.19,17.22,17.25,17.29,17.33,17.33,17.33,17.38,17.43,17.46,17.48,17.51,17.56,17.59,17.6,17.64,17.68,17.71,17.71,17.76,17.8,17.8,17.8,17.84,17.85,17.85,17.88,17.92,17.95,17.98,17.99,18.01,18.05,18.08,18.1,18.13,18.16,18.2,18.23,18.24,18.28,18.36,18.37,18.37,18.41,18.48,18.48,18.48,18.5,18.53,18.55,18.57,18.59,18.62,18.63,18.65,18.69,18.71,18.75,18.77,18.78,18.84,18.87,18.9,18.93,18.96,19,19.01,19.05,19.05,19.05,19.11,19.14,19.18,19.22,19.25,19.25,19.28,19.28,19.29,19.32,19.35,19.38,19.39,19.39,19.39,19.4,19.45,19.48,19.48,19.52,19.53,19.53,19.54,19.59,19.6,19.64,19.66,19.66,19.66,19.7,19.73,19.75,19.79,19.8,19.82,19.85,19.87,19.91,19.91,19.93,19.96,20,20,20.02,20.02,20.05,20.05,20.08,20.11,20.13,20.16,20.16,20.18,20.18,20.18,20.2,20.23,20.25,20.29,20.3,20.32,20.35,20.38,20.41,20.41,20.43,20.45,20.48,20.51,20.54,20.57,20.58,20.61,20.64,20.68,20.69,20.73,20.73,20.77,20.79,20.79,20.81,20.84,20.88,20.88,20.93,20.94,20.95,20.97,20.98,20.98,21.03,21.06,21.07,21.11,21.16,21.18,21.21,21.21,21.23,21.25,21.25,21.25,21.29,21.32,21.32,21.34,21.35,21.38,21.45,21.45,21.47,21.48,21.52,21.56,21.59,21.59,21.59,21.59,21.6,21.64,21.68,21.7,21.7,21.73,21.73,21.76,21.79,21.81,21.84,21.86,21.86,21.86,21.88,21.91,21.93,21.94,21.95,21.97,21.99,22.02,22.02,22.06,22.06,22.1,22.11,22.12,22.13,22.16,22.2,22.2,22.22,22.22,22.24,22.25,22.3,22.33,22.36,22.36,22.38,22.38,22.4,22.42,22.44,22.47,22.49,22.5,22.53,22.55,22.58,22.6,22.61,22.63,22.63,22.68,22.74,22.74,22.76,22.79,22.83,22.87,22.89,22.92,22.93,22.95,22.97,22.99,23.03,23.04,23.1,23.1,23.14,23.15,23.17,23.18,23.18,23.21,23.26,23.26,23.27,23.31,23.31,23.35,23.38,23.38,23.4,23.45,23.45,23.45,23.45,23.49,23.52,23.54,23.54,23.56,23.58,23.62,23.65,23.65,23.65,23.67,23.68,23.73,23.76,23.78,23.79,23.8,23.83,23.83,23.86,23.88,23.9,23.9,23.95,23.99,24,24.01,24.04,24.06,24.06,24.08,24.12,24.14,24.15,24.15,24.17,24.17,24.2,24.22,24.22,24.25,24.26,24.26,24.28,24.29,24.31,24.33,24.36,24.4,24.42,24.43,24.44,24.46,24.5,24.53,24.53,24.58,24.58,24.6,24.62,24.63,24.67,24.69,24.73,24.78,24.8,24.8,24.82,24.84,24.88,24.9,24.93,24.95,24.97,24.98,25.02,25.06,25.06,25.1,25.13,25.13,25.17,25.19,25.23,25.24,25.24,25.28,25.31,25.31,25.33,25.36,25.38,25.39,25.43,25.46,25.48,25.51,25.53,25.58,25.58,25.58,25.65,25.65,25.65,25.69,25.72,25.74,25.78,25.78,25.82,25.85,25.85,25.85,25.87,25.87,25.9,25.95,25.97,26.01,26.02,26.03,26.04,26.09,26.11,26.13,26.17,26.19,26.21,26.26,26.28,26.34,26.35,26.37,26.39,26.42,26.44,26.46,26.46,26.48,26.51,26.53,26.53,26.58,26.6,26.6,26.64,26.64,26.65,26.67,26.73,26.78,26.8,26.82,26.86,26.88,26.9,26.94,26.98,27,27,27.03,27.04,27.1,27.1,27.16,27.18,27.21,27.26,27.27,27.28,27.33,27.35,27.37,27.39,27.42,27.44,27.44,27.5,27.51,27.54,27.57,27.58,27.6,27.64,27.64,27.71,27.71,27.72,27.76,27.78,27.8,27.83,27.85,27.85,27.89,27.96,27.98,28,28,28.05,28.05,28.07,28.07,28.1,28.16,28.16,28.18,28.19,28.23,28.23,28.26,28.29,28.33,28.37,28.41,28.44,28.46,28.48,28.52,28.55,28.57,28.59,28.62,28.63,28.66,28.7,28.73,28.79,28.82,28.84,28.86,28.9,28.95,28.97,28.99,29.02,29.08,29.11,29.15,29.19,29.21,29.23,29.23,29.25,29.3,29.3,29.34,29.38,29.45,29.48,29.52,29.53,29.57,29.57,29.6,29.64,29.68,29.72,29.75,29.78,29.81,29.84,29.86,29.88,29.91,29.92,29.97,30.02,30.05,30.07,30.11,30.13,30.16,30.18,30.2,30.23,30.25,30.27,30.31,30.36,30.4,30.43,30.44,30.49,30.51,30.57,30.63,30.66,30.69,30.75,30.77,30.8,30.84,30.86,30.91,30.93,30.98,31.01,31.05,31.08,31.16,31.19,31.22,31.27,31.33,31.38,31.42,31.43,31.43,31.5,31.54,31.57,31.6,31.63,31.68,31.71,31.75,31.79,31.84,31.86,31.9,31.98,32.04,32.08,32.11,32.12,32.18,32.19,32.25,32.31,32.34,32.38,32.43,32.45,32.47,32.48,32.53,32.58,32.63,32.66,32.72,32.73,32.81,32.88,32.93,32.97,33,33,33.08,33.11,33.15,33.2,33.23,33.25,33.32,33.38,33.44,33.5,33.57,33.63,33.63,33.72,33.77,33.81,33.87,33.88,33.92,33.95,33.99,34.05,34.11,34.15,34.22,34.3,34.38,34.44,34.45,34.49,34.56,34.61,34.65,34.68,34.72,34.78,34.79,34.86,34.93,34.97,35.04,35.08,35.13,35.2,35.24,35.31,35.34,35.4,35.43,35.48,35.56,35.59,35.62,35.75,35.81,35.83,35.9,36.01,36.1,36.17,36.22,36.28,36.38,36.47,36.51,36.62,36.65,36.73,36.78,36.85,36.88,36.96,36.99,37.03,37.1,37.15,37.26,37.28,37.37,37.45,37.5,37.6,37.62,37.73,37.78,37.84,37.97,38.06,38.16,38.21,38.3,38.4,38.44,38.56,38.66,38.76,38.78,38.85,38.89,39.02,39.08,39.18,39.23,39.33,39.41,39.48,39.6,39.64,39.76,39.82,39.93,40,40.12,40.23,40.34,40.39,40.53,40.61,40.75,40.88,40.98,41.05,41.14,41.25,41.3,41.43,41.54,41.68,41.84,41.93,42.05,42.18,42.28,42.39,42.5,42.58,42.72,42.81,42.98,43.11,43.19,43.27,43.45,43.51,43.63,43.76,44,44.14,44.25,44.38,44.57,44.73,44.97,45.18,45.38,45.54,45.75,45.92,46.09,46.24,46.45,46.72,46.9,47.08,47.47,47.65,47.83,48.1,48.4,48.6,48.79,49.13,49.59,49.9,50.19,50.6,50.98,51.37,51.98,52.64,53.14,54.12,54.55,55.22,55.99,57.2,58.23,60.1,63.96],"skill_중계_올스타":[0,1.76,2.45,3.17,3.85,4.33,4.76,5.03,5.58,5.96,6.46,6.91,7.18,7.91,8,8.27,8.77,8.84,9.17,9.47,9.68,9.9,9.97,10.24,10.36,10.45,10.77,10.88,11.1,11.17,11.38,11.49,11.58,11.63,11.76,11.85,11.94,12.04,12.08,12.24,12.31,12.32,12.46,12.55,12.62,12.71,12.76,12.83,12.96,13.03,13.1,13.21,13.23,13.3,13.43,13.46,13.48,13.56,13.62,13.68,13.75,13.8,13.86,13.88,13.94,13.96,13.97,14,14.14,14.21,14.25,14.34,14.39,14.44,14.52,14.57,14.63,14.66,14.73,14.8,14.88,14.91,14.93,15.07,15.13,15.14,15.18,15.2,15.27,15.35,15.4,15.47,15.5,15.54,15.54,15.6,15.63,15.69,15.75,15.79,15.81,15.84,15.88,15.91,15.97,15.98,16.04,16.05,16.09,16.17,16.17,16.2,16.25,16.26,16.28,16.31,16.34,16.43,16.5,16.56,16.6,16.64,16.72,16.76,16.82,16.84,16.86,16.88,16.94,16.95,16.97,17.04,17.1,17.14,17.19,17.22,17.24,17.28,17.32,17.41,17.45,17.47,17.49,17.51,17.53,17.6,17.6,17.62,17.65,17.67,17.71,17.75,17.79,17.81,17.85,17.88,17.91,17.94,17.95,17.98,18.01,18.06,18.1,18.13,18.18,18.21,18.24,18.28,18.29,18.36,18.37,18.37,18.41,18.44,18.48,18.5,18.56,18.58,18.62,18.64,18.68,18.73,18.76,18.8,18.86,18.87,18.9,18.91,18.97,19.05,19.11,19.14,19.19,19.2,19.25,19.27,19.28,19.28,19.31,19.34,19.36,19.41,19.46,19.48,19.52,19.53,19.53,19.53,19.54,19.59,19.6,19.63,19.66,19.7,19.73,19.78,19.8,19.81,19.83,19.86,19.91,19.91,19.97,19.99,20,20,20.02,20.05,20.06,20.1,20.12,20.14,20.18,20.22,20.24,20.27,20.3,20.3,20.33,20.37,20.39,20.43,20.46,20.51,20.55,20.57,20.57,20.58,20.59,20.6,20.63,20.67,20.68,20.68,20.73,20.76,20.77,20.81,20.84,20.88,20.93,20.95,20.98,21.02,21.06,21.11,21.15,21.18,21.2,21.21,21.23,21.25,21.25,21.25,21.28,21.3,21.36,21.41,21.45,21.45,21.48,21.48,21.48,21.52,21.56,21.59,21.59,21.59,21.63,21.67,21.69,21.72,21.73,21.73,21.73,21.74,21.77,21.79,21.83,21.84,21.86,21.86,21.86,21.9,21.92,21.93,21.95,21.98,22,22.02,22.06,22.11,22.11,22.14,22.2,22.2,22.22,22.22,22.22,22.25,22.28,22.31,22.34,22.36,22.36,22.38,22.38,22.39,22.4,22.44,22.49,22.5,22.52,22.55,22.58,22.61,22.61,22.63,22.66,22.7,22.74,22.78,22.84,22.87,22.88,22.88,22.9,22.93,22.93,22.97,22.97,22.99,23.01,23.03,23.08,23.11,23.15,23.17,23.18,23.18,23.23,23.26,23.27,23.32,23.33,23.37,23.4,23.42,23.45,23.45,23.46,23.49,23.52,23.52,23.53,23.54,23.58,23.6,23.65,23.65,23.66,23.7,23.76,23.79,23.79,23.79,23.79,23.82,23.87,23.88,23.9,23.9,23.93,23.96,23.99,24.01,24.04,24.05,24.06,24.06,24.07,24.1,24.12,24.14,24.15,24.17,24.2,24.22,24.24,24.26,24.28,24.31,24.31,24.33,24.33,24.38,24.42,24.42,24.42,24.45,24.51,24.54,24.56,24.58,24.58,24.58,24.61,24.62,24.66,24.67,24.7,24.73,24.78,24.8,24.81,24.83,24.85,24.88,24.92,24.94,24.95,24.97,25.01,25.05,25.1,25.13,25.14,25.19,25.21,25.23,25.24,25.26,25.28,25.3,25.35,25.38,25.38,25.41,25.44,25.47,25.47,25.49,25.51,25.55,25.58,25.58,25.58,25.63,25.65,25.65,25.65,25.7,25.72,25.73,25.74,25.76,25.78,25.82,25.84,25.85,25.85,25.87,25.88,25.91,25.96,25.99,26,26.03,26.05,26.1,26.1,26.13,26.16,26.19,26.21,26.23,26.26,26.26,26.32,26.34,26.35,26.35,26.37,26.38,26.39,26.42,26.42,26.46,26.46,26.48,26.51,26.52,26.55,26.59,26.6,26.62,26.64,26.66,26.69,26.7,26.73,26.76,26.8,26.82,26.87,26.89,26.92,26.95,26.98,27,27,27.02,27.04,27.09,27.14,27.16,27.18,27.26,27.27,27.32,27.33,27.34,27.37,27.42,27.44,27.47,27.5,27.51,27.54,27.57,27.58,27.6,27.65,27.68,27.71,27.73,27.78,27.78,27.8,27.85,27.85,27.85,27.85,27.87,27.89,27.93,27.96,27.98,28.03,28.05,28.05,28.07,28.07,28.1,28.15,28.19,28.23,28.23,28.27,28.3,28.34,28.38,28.41,28.44,28.46,28.48,28.52,28.55,28.57,28.57,28.59,28.61,28.62,28.63,28.64,28.66,28.68,28.7,28.73,28.78,28.8,28.84,28.85,28.9,28.93,28.96,28.98,29.01,29.04,29.09,29.11,29.17,29.2,29.2,29.23,29.23,29.27,29.3,29.34,29.38,29.42,29.46,29.46,29.5,29.53,29.54,29.57,29.57,29.59,29.64,29.64,29.7,29.71,29.73,29.77,29.78,29.78,29.84,29.84,29.87,29.91,29.91,29.93,29.99,30.03,30.05,30.09,30.14,30.16,30.18,30.18,30.21,30.25,30.25,30.27,30.27,30.3,30.34,30.36,30.39,30.4,30.43,30.45,30.5,30.54,30.6,30.66,30.68,30.69,30.75,30.76,30.8,30.83,30.86,30.88,30.91,30.93,30.95,31,31.02,31.06,31.09,31.13,31.17,31.19,31.22,31.27,31.3,31.34,31.36,31.38,31.4,31.43,31.43,31.46,31.5,31.5,31.55,31.58,31.66,31.68,31.73,31.77,31.77,31.82,31.84,31.85,31.88,31.93,31.98,32.03,32.04,32.09,32.11,32.12,32.15,32.18,32.25,32.26,32.31,32.34,32.37,32.4,32.41,32.45,32.47,32.47,32.5,32.56,32.57,32.6,32.62,32.63,32.63,32.69,32.72,32.77,32.8,32.85,32.87,32.93,32.95,32.99,33.02,33.04,33.07,33.11,33.15,33.22,33.24,33.3,33.36,33.39,33.41,33.46,33.51,33.56,33.6,33.63,33.64,33.68,33.72,33.77,33.83,33.89,33.93,33.97,34.01,34.04,34.11,34.14,34.18,34.22,34.28,34.31,34.36,34.38,34.45,34.51,34.54,34.57,34.6,34.64,34.67,34.68,34.71,34.74,34.78,34.81,34.85,34.92,34.96,35,35.05,35.08,35.15,35.17,35.2,35.23,35.3,35.33,35.37,35.41,35.48,35.56,35.59,35.66,35.71,35.78,35.83,35.83,35.85,35.9,35.97,35.97,36.01,36.06,36.13,36.17,36.24,36.27,36.3,36.35,36.44,36.5,36.52,36.58,36.65,36.68,36.75,36.78,36.85,36.87,36.88,36.95,36.98,37.03,37.08,37.13,37.14,37.21,37.26,37.31,37.39,37.4,37.46,37.51,37.58,37.6,37.64,37.72,37.78,37.88,37.93,38,38.04,38.14,38.17,38.26,38.28,38.36,38.42,38.49,38.54,38.59,38.69,38.75,38.83,38.85,38.96,39.05,39.07,39.12,39.19,39.19,39.29,39.33,39.39,39.46,39.5,39.6,39.65,39.71,39.8,39.82,39.86,39.96,39.98,40,40.04,40.17,40.23,40.3,40.37,40.41,40.53,40.6,40.67,40.76,40.84,40.91,40.98,41.05,41.07,41.15,41.25,41.3,41.39,41.46,41.53,41.64,41.71,41.79,41.86,41.94,42.02,42.1,42.18,42.24,42.32,42.43,42.58,42.66,42.82,42.91,43.08,43.18,43.19,43.25,43.33,43.44,43.5,43.61,43.73,43.86,43.95,44,44.06,44.18,44.26,44.38,44.52,44.63,44.73,44.82,44.93,45.11,45.22,45.38,45.45,45.6,45.68,45.79,45.93,46.11,46.26,46.42,46.58,46.73,46.9,47.02,47.17,47.38,47.56,47.65,47.83,47.99,48.1,48.32,48.59,48.78,49,49.17,49.55,49.8,50.07,50.28,50.57,50.7,51.08,51.39,51.66,52,52.29,52.68,53.02,53.5,53.87,54.25,54.75,55.11,55.77,56.45,57.28,57.99,58.8,60.28,61.82,63.8,66.22],"skill_중계_기본":[0,1.26,1.8,2.22,2.75,3.06,3.3,3.65,4.07,4.39,4.67,4.95,5.27,5.7,5.9,6.15,6.35,6.55,6.9,7.2,7.26,7.45,7.65,7.81,8,8.16,8.33,8.4,8.5,8.6,8.7,8.74,8.85,8.91,9.05,9.1,9.15,9.2,9.26,9.3,9.4,9.44,9.5,9.56,9.62,9.65,9.74,9.76,9.86,9.95,9.99,10,10.05,10.07,10.11,10.19,10.27,10.31,10.4,10.41,10.46,10.54,10.58,10.62,10.66,10.7,10.75,10.8,10.84,10.88,10.9,10.95,11,11.01,11.06,11.1,11.13,11.15,11.2,11.25,11.26,11.29,11.31,11.35,11.4,11.45,11.46,11.52,11.55,11.59,11.65,11.66,11.7,11.75,11.77,11.8,11.84,11.88,11.9,11.94,12,12.01,12.04,12.06,12.1,12.15,12.19,12.2,12.21,12.25,12.26,12.3,12.3,12.34,12.37,12.4,12.45,12.45,12.48,12.5,12.5,12.54,12.56,12.58,12.6,12.61,12.65,12.67,12.7,12.71,12.75,12.78,12.8,12.81,12.85,12.86,12.87,12.9,12.94,12.96,13,13.03,13.05,13.09,13.12,13.15,13.16,13.2,13.2,13.22,13.25,13.28,13.31,13.35,13.36,13.41,13.43,13.45,13.49,13.51,13.55,13.56,13.6,13.62,13.64,13.67,13.7,13.74,13.75,13.75,13.75,13.8,13.82,13.85,13.85,13.88,13.9,13.94,13.96,13.99,14,14.03,14.05,14.06,14.08,14.1,14.12,14.15,14.18,14.2,14.21,14.25,14.26,14.29,14.3,14.3,14.32,14.35,14.38,14.4,14.41,14.44,14.46,14.46,14.47,14.51,14.52,14.55,14.6,14.62,14.65,14.65,14.65,14.68,14.7,14.75,14.79,14.81,14.85,14.85,14.89,14.9,14.91,14.95,14.96,14.99,15,15,15,15.01,15.04,15.06,15.07,15.1,15.11,15.15,15.15,15.18,15.2,15.2,15.22,15.24,15.27,15.3,15.32,15.35,15.35,15.38,15.4,15.4,15.4,15.43,15.45,15.46,15.5,15.51,15.54,15.55,15.56,15.6,15.61,15.61,15.64,15.67,15.7,15.71,15.73,15.75,15.76,15.79,15.8,15.84,15.86,15.9,15.91,15.91,15.94,15.94,15.95,15.95,15.95,15.99,16.01,16.05,16.05,16.08,16.1,16.12,16.15,16.16,16.2,16.21,16.24,16.24,16.26,16.28,16.3,16.32,16.35,16.39,16.41,16.44,16.45,16.45,16.46,16.49,16.5,16.5,16.5,16.53,16.55,16.57,16.6,16.61,16.61,16.62,16.65,16.65,16.66,16.66,16.66,16.7,16.7,16.72,16.75,16.76,16.79,16.8,16.82,16.85,16.85,16.85,16.85,16.87,16.9,16.95,16.96,16.99,17,17.01,17.04,17.05,17.05,17.06,17.09,17.1,17.15,17.16,17.18,17.2,17.2,17.2,17.2,17.21,17.25,17.26,17.29,17.3,17.31,17.35,17.37,17.38,17.4,17.4,17.41,17.46,17.5,17.5,17.51,17.55,17.59,17.6,17.6,17.64,17.65,17.68,17.69,17.7,17.71,17.74,17.75,17.75,17.75,17.76,17.79,17.81,17.85,17.87,17.89,17.9,17.9,17.93,17.94,17.95,17.96,17.99,18,18.02,18.05,18.05,18.06,18.08,18.1,18.11,18.14,18.14,18.14,18.15,18.15,18.2,18.2,18.25,18.25,18.25,18.25,18.26,18.29,18.3,18.31,18.33,18.35,18.37,18.41,18.42,18.45,18.45,18.45,18.45,18.46,18.46,18.48,18.5,18.52,18.55,18.57,18.58,18.61,18.64,18.65,18.65,18.69,18.7,18.7,18.7,18.72,18.75,18.78,18.8,18.8,18.81,18.81,18.81,18.85,18.86,18.9,18.9,18.91,18.92,18.95,18.95,18.97,18.99,19,19.01,19.03,19.05,19.1,19.1,19.14,19.16,19.19,19.22,19.25,19.25,19.25,19.29,19.3,19.35,19.35,19.35,19.36,19.38,19.4,19.4,19.41,19.45,19.45,19.46,19.48,19.5,19.5,19.51,19.54,19.55,19.58,19.59,19.6,19.65,19.66,19.7,19.7,19.7,19.71,19.74,19.77,19.8,19.8,19.84,19.88,19.89,19.9,19.91,19.94,19.94,19.96,19.96,20,20.05,20.05,20.05,20.07,20.09,20.1,20.11,20.15,20.15,20.16,20.16,20.21,20.22,20.24,20.25,20.26,20.27,20.33,20.34,20.35,20.35,20.35,20.37,20.4,20.4,20.44,20.45,20.46,20.5,20.5,20.55,20.56,20.6,20.61,20.61,20.64,20.65,20.66,20.7,20.7,20.71,20.75,20.75,20.8,20.81,20.85,20.89,20.9,20.9,20.93,20.95,20.98,20.99,21,21.01,21.05,21.06,21.08,21.1,21.1,21.1,21.11,21.15,21.15,21.15,21.16,21.18,21.2,21.21,21.25,21.28,21.3,21.31,21.32,21.36,21.39,21.43,21.44,21.45,21.49,21.55,21.55,21.55,21.55,21.59,21.6,21.61,21.63,21.65,21.65,21.66,21.69,21.7,21.7,21.72,21.74,21.75,21.75,21.8,21.8,21.85,21.86,21.86,21.9,21.91,21.94,21.95,21.99,22,22,22.03,22.09,22.11,22.12,22.15,22.16,22.2,22.2,22.23,22.25,22.25,22.29,22.3,22.31,22.35,22.36,22.36,22.39,22.41,22.41,22.45,22.46,22.51,22.54,22.54,22.55,22.55,22.57,22.6,22.61,22.65,22.67,22.71,22.73,22.75,22.76,22.79,22.81,22.85,22.85,22.86,22.89,22.9,22.9,22.95,22.95,22.96,22.99,23.02,23.05,23.07,23.09,23.1,23.12,23.15,23.2,23.2,23.21,23.25,23.26,23.29,23.3,23.32,23.35,23.38,23.4,23.43,23.45,23.46,23.5,23.54,23.57,23.6,23.65,23.65,23.66,23.7,23.75,23.76,23.77,23.8,23.8,23.84,23.84,23.86,23.89,23.9,23.91,23.95,23.95,23.96,23.99,24,24,24.06,24.1,24.11,24.14,24.15,24.17,24.2,24.2,24.2,24.25,24.29,24.32,24.35,24.36,24.4,24.4,24.44,24.45,24.46,24.49,24.51,24.53,24.55,24.56,24.59,24.61,24.63,24.65,24.65,24.66,24.71,24.74,24.75,24.77,24.81,24.85,24.86,24.9,24.91,24.97,25.01,25.05,25.05,25.08,25.11,25.15,25.17,25.22,25.25,25.29,25.3,25.35,25.36,25.39,25.41,25.42,25.45,25.46,25.5,25.52,25.55,25.58,25.61,25.65,25.7,25.74,25.79,25.82,25.85,25.86,25.91,25.95,25.95,25.98,26,26.05,26.06,26.1,26.11,26.15,26.18,26.2,26.26,26.3,26.35,26.39,26.4,26.4,26.44,26.5,26.51,26.55,26.62,26.65,26.67,26.7,26.75,26.78,26.81,26.85,26.85,26.86,26.9,26.95,26.95,27,27.05,27.08,27.13,27.17,27.21,27.24,27.3,27.35,27.38,27.45,27.5,27.53,27.59,27.64,27.66,27.7,27.7,27.75,27.78,27.85,27.85,27.9,27.95,28.01,28.05,28.09,28.13,28.15,28.2,28.2,28.24,28.26,28.3,28.35,28.37,28.4,28.41,28.47,28.55,28.6,28.6,28.6,28.67,28.73,28.78,28.82,28.85,28.91,28.96,29,29.05,29.11,29.14,29.15,29.2,29.25,29.3,29.35,29.44,29.45,29.5,29.55,29.64,29.7,29.7,29.75,29.81,29.85,29.9,29.95,30.02,30.05,30.13,30.25,30.3,30.36,30.4,30.4,30.47,30.52,30.58,30.62,30.74,30.8,30.8,30.89,30.96,31.05,31.1,31.15,31.24,31.26,31.34,31.35,31.45,31.5,31.62,31.66,31.79,31.9,31.96,32.04,32.1,32.1,32.15,32.2,32.3,32.37,32.45,32.55,32.6,32.66,32.74,32.86,32.93,33,33.09,33.22,33.32,33.4,33.47,33.55,33.6,33.65,33.76,33.85,33.95,34.1,34.23,34.3,34.35,34.45,34.6,34.68,34.81,34.94,35.04,35.2,35.3,35.45,35.55,35.66,35.75,35.91,36.15,36.35,36.48,36.55,36.72,36.92,37.15,37.4,37.64,37.8,37.92,38.15,38.5,38.7,38.85,39.22,39.6,40,40.25,40.81,41.05,41.63,42.09,42.65,43.25,44,45.1,46.58,48.4],"skill_마무리_골든글러브":[0,1.45,2.1,2.76,3.42,3.65,3.96,4.11,4.62,4.76,5.12,5.29,5.54,5.9,6.06,6.2,6.6,6.7,6.84,6.9,7.07,7.29,7.37,7.45,7.52,7.64,7.75,7.85,8.01,8.1,8.13,8.18,8.31,8.37,8.5,8.6,8.69,8.8,8.82,8.92,9,9.09,9.2,9.26,9.32,9.39,9.45,9.5,9.55,9.65,9.85,9.86,9.93,9.96,10,10.07,10.09,10.11,10.12,10.25,10.31,10.35,10.41,10.49,10.54,10.56,10.65,10.65,10.67,10.7,10.74,10.78,10.81,10.87,10.9,10.92,10.95,11,11.01,11.04,11.18,11.22,11.25,11.3,11.31,11.33,11.36,11.42,11.44,11.5,11.54,11.56,11.58,11.6,11.66,11.75,11.8,11.83,11.93,11.96,11.99,12.01,12.02,12.05,12.09,12.12,12.17,12.22,12.23,12.25,12.26,12.33,12.39,12.45,12.45,12.47,12.5,12.6,12.64,12.64,12.68,12.7,12.74,12.75,12.76,12.78,12.85,12.87,12.88,12.91,12.97,13,13.04,13.05,13.07,13.1,13.1,13.15,13.19,13.2,13.22,13.26,13.28,13.3,13.34,13.38,13.41,13.42,13.49,13.51,13.54,13.54,13.56,13.6,13.64,13.68,13.7,13.72,13.75,13.76,13.77,13.77,13.82,13.85,13.86,13.88,13.92,13.95,13.97,14,14.06,14.08,14.09,14.12,14.14,14.19,14.19,14.21,14.23,14.25,14.3,14.32,14.34,14.35,14.36,14.41,14.42,14.43,14.45,14.49,14.52,14.55,14.57,14.6,14.63,14.65,14.65,14.65,14.66,14.67,14.67,14.71,14.74,14.75,14.78,14.85,14.86,14.88,14.9,14.94,14.96,14.96,14.98,15.01,15.02,15.08,15.15,15.17,15.2,15.21,15.23,15.25,15.27,15.3,15.3,15.31,15.33,15.35,15.4,15.4,15.41,15.44,15.46,15.5,15.51,15.52,15.55,15.61,15.64,15.67,15.69,15.7,15.74,15.75,15.8,15.82,15.84,15.84,15.87,15.9,15.92,15.96,15.98,16.03,16.04,16.05,16.06,16.06,16.06,16.08,16.1,16.12,16.15,16.18,16.19,16.21,16.24,16.28,16.29,16.3,16.34,16.35,16.35,16.39,16.39,16.4,16.41,16.44,16.46,16.48,16.5,16.52,16.57,16.62,16.62,16.62,16.63,16.69,16.7,16.72,16.75,16.76,16.77,16.79,16.83,16.84,16.85,16.85,16.85,16.85,16.85,16.87,16.87,16.87,16.89,16.91,16.95,16.96,16.98,17,17.01,17.03,17.06,17.06,17.16,17.16,17.17,17.19,17.22,17.25,17.27,17.28,17.29,17.31,17.36,17.38,17.4,17.42,17.44,17.46,17.49,17.5,17.5,17.5,17.5,17.51,17.51,17.51,17.53,17.54,17.56,17.6,17.61,17.62,17.65,17.66,17.68,17.72,17.73,17.75,17.77,17.79,17.82,17.84,17.84,17.85,17.86,17.89,17.9,17.93,17.94,17.95,18,18.04,18.04,18.04,18.04,18.07,18.07,18.09,18.12,18.14,18.15,18.16,18.16,18.17,18.21,18.23,18.26,18.3,18.31,18.32,18.32,18.34,18.38,18.39,18.41,18.44,18.45,18.47,18.49,18.5,18.56,18.59,18.59,18.59,18.59,18.61,18.63,18.65,18.67,18.69,18.7,18.72,18.74,18.76,18.82,18.82,18.82,18.82,18.86,18.9,18.92,18.93,18.94,18.95,18.95,18.95,18.97,18.97,19,19.03,19.05,19.05,19.05,19.05,19.07,19.09,19.13,19.16,19.18,19.2,19.22,19.22,19.25,19.25,19.26,19.29,19.32,19.35,19.36,19.36,19.37,19.39,19.45,19.47,19.48,19.48,19.49,19.49,19.5,19.51,19.51,19.54,19.56,19.6,19.68,19.7,19.71,19.71,19.72,19.76,19.78,19.8,19.81,19.82,19.88,19.91,19.94,19.99,20,20.01,20.02,20.04,20.04,20.04,20.04,20.05,20.06,20.06,20.06,20.1,20.1,20.11,20.14,20.14,20.17,20.23,20.25,20.27,20.27,20.27,20.29,20.31,20.33,20.35,20.36,20.38,20.41,20.46,20.46,20.5,20.5,20.52,20.52,20.54,20.58,20.59,20.61,20.64,20.64,20.66,20.67,20.69,20.69,20.7,20.76,20.79,20.81,20.81,20.81,20.83,20.83,20.88,20.9,20.92,20.92,20.92,20.98,21,21.02,21.04,21.07,21.1,21.14,21.15,21.15,21.15,21.19,21.2,21.23,21.23,21.25,21.25,21.25,21.26,21.27,21.3,21.32,21.37,21.42,21.43,21.45,21.46,21.46,21.46,21.47,21.49,21.5,21.51,21.55,21.55,21.57,21.58,21.64,21.68,21.69,21.69,21.71,21.75,21.8,21.8,21.86,21.86,21.9,21.91,21.92,21.96,21.99,22,22.01,22.01,22.01,22.08,22.1,22.14,22.18,22.2,22.22,22.24,22.24,22.24,22.25,22.25,22.3,22.3,22.3,22.31,22.34,22.36,22.4,22.44,22.44,22.45,22.47,22.47,22.52,22.55,22.55,22.56,22.59,22.64,22.65,22.67,22.69,22.72,22.72,22.74,22.76,22.78,22.8,22.86,22.87,22.9,22.9,22.94,22.96,22.96,22.99,22.99,23.01,23.01,23.02,23.09,23.1,23.12,23.18,23.19,23.22,23.22,23.24,23.25,23.29,23.32,23.33,23.35,23.39,23.45,23.45,23.46,23.47,23.52,23.52,23.56,23.59,23.63,23.65,23.66,23.69,23.69,23.69,23.71,23.73,23.75,23.75,23.75,23.76,23.77,23.77,23.78,23.82,23.86,23.89,23.89,23.91,23.96,24,24,24.03,24.06,24.1,24.11,24.14,24.19,24.2,24.26,24.32,24.34,24.34,24.35,24.39,24.4,24.41,24.42,24.44,24.45,24.46,24.5,24.52,24.54,24.56,24.6,24.63,24.66,24.67,24.69,24.74,24.75,24.77,24.8,24.84,24.85,24.88,24.88,24.9,24.92,24.94,24.94,24.96,25.01,25.08,25.1,25.15,25.19,25.21,25.21,25.23,25.26,25.32,25.35,25.39,25.43,25.43,25.45,25.49,25.49,25.51,25.52,25.57,25.63,25.66,25.66,25.7,25.72,25.73,25.75,25.82,25.86,25.89,25.89,25.91,25.95,25.95,25.96,25.97,26.04,26.07,26.09,26.1,26.18,26.2,26.2,26.25,26.26,26.27,26.3,26.33,26.4,26.4,26.41,26.46,26.51,26.54,26.6,26.64,26.64,26.65,26.7,26.7,26.74,26.82,26.87,26.89,26.92,26.95,26.95,27,27.05,27.06,27.11,27.15,27.18,27.21,27.25,27.28,27.32,27.36,27.41,27.41,27.44,27.48,27.54,27.62,27.65,27.72,27.78,27.84,27.86,27.87,27.92,27.96,28,28.04,28.06,28.09,28.11,28.15,28.16,28.18,28.27,28.3,28.37,28.4,28.45,28.47,28.5,28.6,28.6,28.62,28.68,28.74,28.8,28.83,28.9,28.94,29,29.04,29.11,29.14,29.14,29.16,29.21,29.25,29.28,29.34,29.38,29.45,29.52,29.56,29.59,29.64,29.7,29.74,29.76,29.82,29.83,29.89,29.92,29.98,30.05,30.05,30.07,30.12,30.15,30.2,30.29,30.31,30.35,30.36,30.41,30.47,30.51,30.58,30.6,30.66,30.7,30.74,30.8,30.91,30.96,31.04,31.1,31.17,31.24,31.27,31.35,31.46,31.5,31.58,31.65,31.69,31.77,31.81,31.85,31.97,32.03,32.1,32.18,32.25,32.27,32.31,32.36,32.42,32.49,32.56,32.62,32.68,32.77,32.87,32.9,33,33.01,33.12,33.21,33.25,33.3,33.35,33.44,33.47,33.54,33.57,33.66,33.78,33.9,33.96,34.01,34.15,34.22,34.3,34.45,34.46,34.55,34.68,34.76,34.77,34.96,35.1,35.2,35.2,35.34,35.44,35.5,35.62,35.74,35.85,35.94,36.08,36.19,36.36,36.43,36.52,36.62,36.65,36.72,36.88,36.95,37.07,37.22,37.3,37.4,37.5,37.64,37.72,37.84,38.03,38.26,38.4,38.62,38.85,38.94,39.16,39.32,39.5,39.73,39.9,40.04,40.17,40.34,40.66,40.94,41.14,41.42,41.8,42.04,42.2,42.6,43.02,43.36,43.86,44.24,44.47,44.99,45.54,46.07,46.75,47.65,48.65,49.62,51,53.1],"skill_마무리_라이브":[0,1.93,2.45,3.61,3.99,4.42,4.78,5.33,5.55,6.04,6.29,6.66,6.76,7.02,7.23,7.53,7.77,7.95,8.01,8.21,8.35,8.44,8.62,8.75,8.82,8.86,8.93,9.04,9.17,9.37,9.4,9.66,9.73,9.79,9.94,10.01,10.08,10.17,10.36,10.45,10.5,10.58,10.68,10.75,10.83,10.93,10.99,11.08,11.13,11.19,11.27,11.33,11.35,11.42,11.48,11.55,11.62,11.69,11.7,11.87,11.96,12.04,12.06,12.13,12.18,12.26,12.31,12.32,12.34,12.39,12.41,12.43,12.48,12.51,12.61,12.64,12.67,12.76,12.83,12.9,12.94,12.97,13.01,13.03,13.08,13.09,13.16,13.2,13.23,13.24,13.33,13.41,13.43,13.53,13.58,13.6,13.64,13.67,13.73,13.86,13.93,13.95,14,14.01,14.02,14.1,14.14,14.17,14.21,14.25,14.27,14.35,14.39,14.45,14.49,14.55,14.58,14.62,14.64,14.7,14.71,14.74,14.76,14.79,14.84,14.91,14.92,14.92,14.97,14.98,15.05,15.11,15.13,15.16,15.18,15.2,15.26,15.29,15.35,15.4,15.4,15.42,15.49,15.51,15.53,15.54,15.57,15.61,15.66,15.72,15.76,15.8,15.83,15.88,15.91,15.94,15.97,15.98,16.03,16.06,16.1,16.12,16.16,16.17,16.17,16.17,16.24,16.27,16.31,16.31,16.33,16.4,16.41,16.44,16.45,16.49,16.55,16.58,16.6,16.65,16.67,16.7,16.74,16.8,16.82,16.86,16.89,16.89,16.93,16.94,16.98,16.98,17.02,17.04,17.05,17.08,17.08,17.08,17.09,17.16,17.22,17.23,17.28,17.32,17.33,17.33,17.33,17.38,17.43,17.46,17.5,17.52,17.57,17.58,17.6,17.64,17.71,17.73,17.8,17.8,17.8,17.81,17.85,17.85,17.86,17.89,17.92,17.94,17.96,17.99,18.04,18.06,18.1,18.13,18.14,18.2,18.21,18.23,18.26,18.31,18.37,18.37,18.37,18.41,18.48,18.48,18.48,18.48,18.5,18.52,18.55,18.56,18.57,18.6,18.61,18.63,18.67,18.71,18.75,18.77,18.82,18.87,18.9,18.96,18.98,19.01,19.05,19.05,19.05,19.06,19.11,19.17,19.2,19.25,19.25,19.25,19.28,19.28,19.29,19.32,19.35,19.38,19.39,19.39,19.39,19.44,19.46,19.48,19.48,19.53,19.53,19.53,19.54,19.59,19.63,19.66,19.66,19.67,19.73,19.73,19.75,19.79,19.8,19.82,19.85,19.9,19.96,20,20,20,20.02,20.02,20.02,20.05,20.09,20.12,20.16,20.16,20.16,20.2,20.23,20.25,20.27,20.29,20.3,20.3,20.31,20.36,20.37,20.38,20.41,20.41,20.43,20.44,20.47,20.51,20.54,20.54,20.57,20.57,20.59,20.62,20.64,20.68,20.68,20.68,20.71,20.73,20.74,20.77,20.79,20.81,20.88,20.88,20.9,20.93,20.94,20.97,20.98,21.01,21.07,21.07,21.07,21.14,21.17,21.2,21.21,21.22,21.24,21.25,21.25,21.27,21.29,21.31,21.32,21.34,21.34,21.42,21.45,21.45,21.45,21.48,21.48,21.51,21.56,21.58,21.59,21.59,21.59,21.6,21.64,21.68,21.68,21.7,21.73,21.73,21.77,21.79,21.84,21.86,21.86,21.86,21.88,21.92,21.93,21.95,21.95,21.98,22.02,22.02,22.05,22.06,22.06,22.12,22.13,22.14,22.19,22.2,22.2,22.22,22.22,22.23,22.25,22.3,22.34,22.36,22.36,22.4,22.42,22.47,22.47,22.5,22.53,22.55,22.6,22.61,22.61,22.63,22.63,22.69,22.73,22.74,22.74,22.78,22.8,22.84,22.87,22.88,22.9,22.93,22.94,22.96,22.97,22.99,23,23.04,23.06,23.08,23.1,23.1,23.15,23.17,23.18,23.18,23.22,23.26,23.27,23.31,23.32,23.38,23.38,23.38,23.41,23.45,23.45,23.45,23.45,23.46,23.52,23.52,23.54,23.57,23.59,23.65,23.65,23.65,23.65,23.67,23.7,23.73,23.77,23.79,23.79,23.8,23.8,23.84,23.86,23.89,23.9,23.93,23.95,23.99,24.01,24.01,24.03,24.06,24.06,24.11,24.13,24.15,24.15,24.16,24.19,24.2,24.22,24.22,24.22,24.26,24.26,24.28,24.28,24.3,24.33,24.33,24.37,24.39,24.42,24.43,24.47,24.52,24.53,24.56,24.58,24.6,24.62,24.63,24.65,24.67,24.7,24.72,24.77,24.81,24.82,24.86,24.89,24.92,24.93,24.94,24.97,24.99,25.03,25.06,25.06,25.1,25.13,25.13,25.15,25.19,25.21,25.24,25.24,25.28,25.28,25.3,25.31,25.31,25.36,25.38,25.38,25.41,25.45,25.48,25.49,25.51,25.54,25.56,25.58,25.58,25.65,25.65,25.67,25.7,25.72,25.77,25.78,25.82,25.85,25.85,25.85,25.85,25.87,25.87,25.88,25.94,25.97,26,26.01,26.04,26.1,26.1,26.13,26.17,26.19,26.21,26.21,26.26,26.28,26.33,26.35,26.35,26.4,26.42,26.44,26.46,26.46,26.48,26.48,26.53,26.53,26.54,26.59,26.6,26.64,26.65,26.66,26.68,26.73,26.78,26.8,26.83,26.87,26.9,26.94,26.98,27.03,27.03,27.06,27.1,27.12,27.14,27.19,27.26,27.26,27.28,27.3,27.33,27.33,27.37,27.37,27.41,27.44,27.44,27.47,27.5,27.51,27.53,27.55,27.58,27.58,27.62,27.64,27.66,27.71,27.71,27.71,27.74,27.78,27.78,27.8,27.82,27.85,27.85,27.85,27.9,27.94,27.98,28,28,28.05,28.05,28.05,28.07,28.07,28.1,28.16,28.18,28.19,28.22,28.27,28.28,28.32,28.35,28.37,28.41,28.42,28.46,28.48,28.51,28.53,28.55,28.59,28.62,28.63,28.66,28.67,28.68,28.73,28.74,28.8,28.82,28.87,28.89,28.94,28.96,28.98,29.04,29.08,29.14,29.18,29.21,29.23,29.23,29.23,29.27,29.3,29.3,29.3,29.36,29.46,29.5,29.53,29.55,29.57,29.61,29.64,29.66,29.69,29.72,29.78,29.78,29.82,29.84,29.87,29.89,29.91,29.93,30,30.02,30.07,30.09,30.12,30.14,30.18,30.2,30.22,30.24,30.25,30.27,30.28,30.31,30.38,30.43,30.48,30.5,30.59,30.65,30.7,30.77,30.8,30.83,30.86,30.86,30.91,30.93,30.94,30.98,31.05,31.06,31.16,31.22,31.24,31.27,31.35,31.42,31.43,31.43,31.5,31.54,31.57,31.61,31.67,31.71,31.75,31.77,31.82,31.84,31.86,31.91,31.98,32.04,32.09,32.11,32.12,32.17,32.18,32.25,32.31,32.36,32.4,32.45,32.47,32.48,32.56,32.63,32.68,32.73,32.75,32.78,32.85,32.94,32.98,33,33.02,33.08,33.15,33.2,33.24,33.27,33.37,33.44,33.52,33.61,33.63,33.68,33.73,33.8,33.86,33.88,33.88,33.92,33.95,34.01,34.1,34.13,34.18,34.27,34.33,34.42,34.45,34.5,34.58,34.63,34.65,34.69,34.73,34.79,34.83,34.88,34.93,35,35.06,35.11,35.2,35.2,35.25,35.31,35.39,35.42,35.46,35.56,35.66,35.74,35.81,35.83,35.83,35.91,35.97,36.08,36.12,36.17,36.21,36.25,36.3,36.42,36.47,36.52,36.64,36.67,36.74,36.84,36.87,36.93,37,37.13,37.19,37.26,37.31,37.4,37.46,37.58,37.62,37.73,37.84,37.94,38.06,38.14,38.19,38.28,38.3,38.35,38.44,38.5,38.69,38.76,38.82,38.85,38.92,39.07,39.14,39.24,39.35,39.46,39.55,39.61,39.68,39.78,39.82,39.93,40.05,40.23,40.32,40.43,40.53,40.6,40.71,40.78,40.98,41.05,41.13,41.25,41.3,41.41,41.55,41.69,41.8,41.86,42.02,42.08,42.19,42.32,42.48,42.57,42.72,42.8,42.86,43.06,43.18,43.25,43.4,43.5,43.66,43.77,43.96,44.06,44.23,44.44,44.63,44.81,45.04,45.38,45.47,45.68,45.88,46.09,46.28,46.55,46.79,46.9,47.12,47.39,47.65,47.85,48.26,48.6,48.88,49.28,49.68,49.9,50.38,50.82,51.37,52.05,52.64,53.19,54.18,54.97,55.99,57.29,58.65,61.85],"skill_마무리_올스타":[0,1.93,2.7,3.61,3.99,4.42,4.92,5.39,5.69,6.23,6.6,6.85,7.16,7.39,7.86,7.98,8.05,8.53,8.57,8.77,8.88,9.09,9.18,9.45,9.54,9.66,9.68,9.86,9.93,10.08,10.22,10.31,10.4,10.5,10.81,10.88,10.97,11.08,11.13,11.15,11.24,11.4,11.49,11.58,11.63,11.65,11.78,11.85,11.92,11.99,12.08,12.17,12.26,12.31,12.32,12.48,12.55,12.6,12.62,12.76,12.83,12.9,12.97,13.05,13.09,13.1,13.19,13.21,13.23,13.33,13.44,13.48,13.48,13.55,13.67,13.71,13.74,13.8,13.82,13.92,13.95,13.97,14,14.07,14.18,14.21,14.25,14.3,14.39,14.44,14.48,14.57,14.63,14.65,14.72,14.77,14.84,14.88,14.91,15.02,15.11,15.13,15.14,15.19,15.21,15.27,15.36,15.4,15.4,15.47,15.49,15.54,15.54,15.59,15.61,15.65,15.7,15.75,15.81,15.84,15.9,15.91,15.97,15.98,16.02,16.05,16.09,16.17,16.18,16.22,16.27,16.28,16.28,16.31,16.34,16.42,16.52,16.56,16.58,16.61,16.7,16.75,16.81,16.82,16.87,16.88,16.94,16.94,16.99,17.04,17.08,17.13,17.16,17.19,17.22,17.28,17.31,17.35,17.42,17.43,17.47,17.49,17.5,17.52,17.58,17.6,17.62,17.66,17.71,17.75,17.79,17.82,17.85,17.88,17.94,17.95,17.96,17.99,18,18.06,18.08,18.12,18.13,18.2,18.21,18.23,18.28,18.29,18.35,18.37,18.37,18.38,18.42,18.48,18.53,18.57,18.62,18.62,18.67,18.68,18.72,18.76,18.83,18.87,18.87,18.91,18.97,18.99,19.07,19.12,19.14,19.19,19.2,19.25,19.28,19.28,19.28,19.33,19.34,19.38,19.4,19.44,19.48,19.5,19.52,19.53,19.53,19.53,19.54,19.6,19.63,19.66,19.71,19.75,19.8,19.8,19.81,19.83,19.88,19.91,19.92,19.97,20,20,20.02,20.04,20.05,20.1,20.16,20.18,20.23,20.27,20.29,20.3,20.31,20.35,20.37,20.41,20.43,20.46,20.53,20.54,20.57,20.57,20.57,20.59,20.6,20.67,20.68,20.68,20.68,20.74,20.77,20.8,20.87,20.9,20.93,20.94,21.01,21.07,21.09,21.14,21.15,21.18,21.2,21.21,21.24,21.25,21.25,21.28,21.3,21.37,21.42,21.45,21.45,21.47,21.48,21.48,21.49,21.53,21.56,21.59,21.59,21.6,21.65,21.67,21.69,21.71,21.73,21.73,21.73,21.77,21.79,21.83,21.84,21.86,21.86,21.87,21.91,21.93,21.95,21.97,22,22.02,22.05,22.11,22.14,22.2,22.2,22.2,22.22,22.22,22.25,22.25,22.3,22.33,22.36,22.36,22.36,22.39,22.4,22.42,22.47,22.5,22.52,22.58,22.6,22.61,22.61,22.63,22.67,22.7,22.74,22.75,22.77,22.81,22.83,22.86,22.88,22.88,22.88,22.93,22.94,22.97,22.97,22.99,23.01,23.08,23.08,23.13,23.17,23.18,23.18,23.25,23.27,23.3,23.33,23.37,23.4,23.41,23.45,23.45,23.45,23.47,23.51,23.52,23.53,23.54,23.59,23.62,23.65,23.65,23.65,23.68,23.71,23.76,23.78,23.79,23.79,23.79,23.8,23.86,23.88,23.88,23.9,23.93,23.95,23.98,24.01,24.04,24.06,24.06,24.06,24.08,24.13,24.14,24.15,24.18,24.21,24.22,24.23,24.26,24.26,24.28,24.32,24.33,24.33,24.36,24.4,24.42,24.42,24.42,24.45,24.53,24.54,24.56,24.56,24.56,24.61,24.63,24.65,24.67,24.69,24.73,24.79,24.8,24.81,24.83,24.83,24.86,24.9,24.92,24.94,24.95,24.97,24.99,25.03,25.08,25.1,25.13,25.14,25.17,25.19,25.2,25.24,25.26,25.28,25.28,25.3,25.32,25.38,25.38,25.41,25.44,25.47,25.47,25.48,25.51,25.51,25.55,25.58,25.58,25.58,25.64,25.65,25.65,25.66,25.71,25.72,25.74,25.76,25.8,25.82,25.85,25.85,25.85,25.87,25.88,25.91,25.94,25.99,25.99,26,26.04,26.05,26.09,26.1,26.11,26.13,26.18,26.19,26.21,26.25,26.26,26.29,26.33,26.35,26.35,26.38,26.39,26.42,26.42,26.46,26.46,26.48,26.48,26.53,26.53,26.58,26.6,26.62,26.65,26.66,26.69,26.71,26.73,26.76,26.77,26.8,26.82,26.82,26.87,26.87,26.92,26.95,27,27.02,27.03,27.06,27.1,27.14,27.16,27.19,27.26,27.28,27.29,27.32,27.33,27.34,27.37,27.4,27.44,27.44,27.48,27.5,27.5,27.53,27.57,27.58,27.58,27.61,27.66,27.71,27.71,27.73,27.78,27.78,27.78,27.81,27.85,27.85,27.85,27.85,27.87,27.92,27.94,27.98,28,28.05,28.05,28.05,28.07,28.07,28.1,28.19,28.24,28.28,28.3,28.32,28.35,28.41,28.41,28.44,28.46,28.48,28.52,28.54,28.55,28.57,28.6,28.62,28.62,28.63,28.66,28.66,28.68,28.68,28.73,28.73,28.73,28.79,28.82,28.85,28.88,28.91,28.96,28.97,29,29.03,29.07,29.1,29.13,29.17,29.2,29.23,29.23,29.26,29.3,29.34,29.4,29.46,29.46,29.49,29.53,29.53,29.55,29.57,29.59,29.64,29.64,29.65,29.68,29.71,29.71,29.74,29.78,29.78,29.8,29.83,29.84,29.88,29.91,29.91,29.92,29.98,30.01,30.05,30.05,30.12,30.15,30.18,30.18,30.2,30.25,30.25,30.25,30.27,30.27,30.3,30.36,30.38,30.4,30.45,30.5,30.53,30.56,30.59,30.62,30.67,30.69,30.72,30.75,30.79,30.81,30.82,30.86,30.86,30.88,30.93,30.93,30.94,30.99,31.01,31.04,31.06,31.09,31.16,31.2,31.24,31.28,31.3,31.35,31.36,31.4,31.43,31.43,31.46,31.5,31.52,31.57,31.63,31.67,31.71,31.73,31.77,31.77,31.81,31.84,31.84,31.86,31.9,31.95,31.98,32.03,32.04,32.07,32.11,32.11,32.12,32.17,32.18,32.23,32.25,32.28,32.32,32.34,32.38,32.4,32.42,32.45,32.47,32.47,32.49,32.56,32.6,32.62,32.68,32.7,32.78,32.81,32.86,32.89,32.92,32.95,32.99,33.02,33.04,33.06,33.13,33.15,33.22,33.25,33.33,33.39,33.42,33.47,33.52,33.57,33.61,33.63,33.65,33.7,33.76,33.83,33.86,33.9,33.93,33.97,34.01,34.04,34.1,34.11,34.15,34.18,34.24,34.28,34.31,34.37,34.41,34.45,34.53,34.58,34.64,34.65,34.67,34.72,34.76,34.8,34.86,34.92,34.99,35.02,35.08,35.15,35.15,35.2,35.2,35.26,35.33,35.35,35.42,35.56,35.62,35.7,35.77,35.83,35.83,35.85,35.9,35.94,35.97,36,36.08,36.14,36.21,36.25,36.3,36.34,36.38,36.46,36.51,36.58,36.65,36.66,36.74,36.8,36.85,36.88,36.88,36.95,37.01,37.08,37.13,37.15,37.24,37.3,37.4,37.4,37.48,37.54,37.6,37.62,37.76,37.87,37.92,37.99,38.03,38.12,38.17,38.23,38.27,38.28,38.37,38.41,38.5,38.53,38.6,38.71,38.77,38.81,38.85,38.95,39.05,39.08,39.16,39.19,39.29,39.34,39.41,39.46,39.51,39.6,39.63,39.73,39.8,39.82,39.95,40,40.1,40.21,40.24,40.34,40.43,40.48,40.56,40.64,40.7,40.83,40.9,40.97,41.05,41.12,41.25,41.34,41.43,41.53,41.63,41.68,41.79,41.86,41.95,42,42.05,42.18,42.26,42.4,42.54,42.6,42.75,42.9,43.07,43.13,43.18,43.25,43.25,43.45,43.48,43.59,43.73,43.86,44,44.06,44.18,44.24,44.36,44.5,44.63,44.77,44.88,44.99,45.18,45.36,45.45,45.5,45.65,45.74,45.92,46.06,46.2,46.33,46.47,46.6,46.83,46.94,47.08,47.24,47.47,47.58,47.66,47.83,48.01,48.26,48.52,48.75,48.99,49.28,49.57,49.8,50.05,50.33,50.6,50.93,51.37,51.75,52.05,52.48,52.74,53.02,53.57,54.11,54.67,55.22,56.13,56.68,57.42,58.58,59.4,60.85,62.62,64.8],"skill_마무리_기본":[0,1.45,1.81,2.71,2.85,3.25,3.4,3.85,4.3,4.54,4.75,5.06,5.25,5.54,5.7,5.78,5.9,6.09,6.25,6.45,6.55,6.71,6.86,6.96,7.1,7.16,7.26,7.38,7.45,7.5,7.69,7.8,7.91,7.99,8.11,8.2,8.29,8.4,8.45,8.55,8.6,8.66,8.71,8.75,8.8,8.85,8.94,9.05,9.1,9.15,9.16,9.29,9.3,9.39,9.44,9.46,9.55,9.59,9.64,9.66,9.74,9.75,9.84,9.86,9.95,9.99,10,10.05,10.09,10.11,10.16,10.2,10.3,10.36,10.4,10.44,10.54,10.56,10.6,10.65,10.67,10.7,10.71,10.78,10.81,10.89,10.9,10.94,11,11,11.05,11.1,11.12,11.15,11.21,11.25,11.26,11.3,11.31,11.34,11.35,11.4,11.45,11.45,11.54,11.55,11.59,11.65,11.65,11.66,11.7,11.75,11.8,11.84,11.85,11.89,11.91,11.94,12,12.01,12.03,12.05,12.09,12.14,12.15,12.19,12.2,12.23,12.25,12.29,12.3,12.32,12.36,12.38,12.4,12.45,12.45,12.49,12.5,12.51,12.56,12.58,12.6,12.6,12.65,12.7,12.71,12.75,12.77,12.79,12.8,12.84,12.85,12.86,12.9,12.91,12.93,12.95,13,13.05,13.05,13.09,13.1,13.14,13.15,13.17,13.2,13.2,13.25,13.3,13.31,13.35,13.39,13.41,13.43,13.45,13.45,13.5,13.52,13.55,13.56,13.58,13.6,13.63,13.64,13.66,13.7,13.72,13.74,13.75,13.75,13.76,13.77,13.82,13.85,13.86,13.88,13.91,13.95,13.97,13.99,14.03,14.05,14.08,14.1,14.12,14.15,14.17,14.2,14.22,14.25,14.3,14.3,14.31,14.35,14.36,14.39,14.42,14.44,14.45,14.46,14.49,14.51,14.55,14.57,14.6,14.63,14.65,14.65,14.66,14.7,14.75,14.79,14.8,14.85,14.86,14.89,14.9,14.91,14.95,14.96,15,15,15,15.01,15.04,15.05,15.07,15.1,15.12,15.14,15.15,15.19,15.2,15.21,15.23,15.25,15.3,15.32,15.34,15.35,15.38,15.4,15.4,15.4,15.4,15.44,15.49,15.5,15.5,15.52,15.55,15.56,15.56,15.6,15.61,15.62,15.65,15.68,15.7,15.75,15.75,15.78,15.8,15.8,15.83,15.86,15.88,15.89,15.9,15.91,15.94,15.94,15.95,15.95,15.95,15.95,15.97,16.03,16.05,16.05,16.07,16.1,16.11,16.15,16.16,16.16,16.24,16.24,16.25,16.26,16.27,16.31,16.33,16.35,16.37,16.4,16.41,16.43,16.45,16.46,16.48,16.49,16.5,16.5,16.51,16.55,16.56,16.59,16.6,16.65,16.66,16.66,16.66,16.66,16.67,16.7,16.75,16.75,16.78,16.8,16.81,16.85,16.85,16.85,16.85,16.85,16.86,16.9,16.93,16.95,17,17.01,17.04,17.05,17.06,17.09,17.1,17.13,17.15,17.19,17.2,17.2,17.2,17.2,17.2,17.21,17.21,17.27,17.3,17.31,17.32,17.35,17.35,17.36,17.38,17.38,17.4,17.4,17.41,17.44,17.5,17.51,17.52,17.55,17.59,17.6,17.6,17.6,17.6,17.62,17.64,17.65,17.69,17.7,17.71,17.74,17.75,17.75,17.76,17.76,17.8,17.82,17.85,17.88,17.89,17.9,17.95,17.95,17.99,18,18.02,18.04,18.05,18.07,18.1,18.11,18.11,18.14,18.14,18.14,18.14,18.15,18.15,18.15,18.18,18.2,18.23,18.25,18.25,18.25,18.25,18.25,18.28,18.3,18.34,18.35,18.41,18.44,18.45,18.45,18.45,18.45,18.46,18.46,18.49,18.52,18.55,18.58,18.61,18.62,18.65,18.65,18.67,18.69,18.69,18.7,18.7,18.7,18.7,18.72,18.74,18.79,18.8,18.8,18.8,18.84,18.86,18.86,18.86,18.89,18.9,18.9,18.91,18.95,18.95,18.95,18.98,18.99,19,19.04,19.05,19.05,19.07,19.1,19.13,19.16,19.17,19.2,19.23,19.24,19.25,19.27,19.3,19.33,19.35,19.35,19.4,19.4,19.4,19.4,19.4,19.41,19.45,19.45,19.47,19.5,19.51,19.51,19.54,19.55,19.57,19.58,19.59,19.6,19.63,19.67,19.7,19.7,19.7,19.71,19.74,19.77,19.8,19.8,19.83,19.85,19.89,19.89,19.92,19.94,19.95,19.96,19.96,20,20.04,20.05,20.05,20.05,20.08,20.1,20.11,20.15,20.15,20.15,20.16,20.2,20.21,20.23,20.24,20.25,20.3,20.33,20.34,20.34,20.35,20.35,20.35,20.35,20.39,20.4,20.45,20.45,20.45,20.48,20.5,20.52,20.6,20.61,20.64,20.65,20.65,20.65,20.7,20.7,20.73,20.75,20.76,20.84,20.87,20.9,20.9,20.9,20.92,20.95,20.99,20.99,21,21.04,21.06,21.07,21.1,21.1,21.1,21.1,21.12,21.15,21.15,21.15,21.15,21.15,21.18,21.18,21.2,21.25,21.25,21.25,21.3,21.3,21.31,21.36,21.41,21.44,21.45,21.47,21.5,21.55,21.55,21.58,21.6,21.6,21.61,21.64,21.64,21.65,21.65,21.69,21.7,21.7,21.71,21.74,21.75,21.75,21.78,21.8,21.8,21.85,21.89,21.9,21.94,21.95,21.99,22,22,22.02,22.08,22.1,22.14,22.15,22.19,22.2,22.2,22.23,22.25,22.25,22.3,22.34,22.36,22.36,22.39,22.41,22.41,22.45,22.47,22.5,22.51,22.54,22.54,22.54,22.55,22.55,22.55,22.6,22.6,22.63,22.65,22.65,22.68,22.71,22.74,22.75,22.8,22.84,22.85,22.85,22.86,22.9,22.9,22.9,22.95,22.95,22.95,23.01,23.05,23.05,23.07,23.09,23.1,23.1,23.13,23.15,23.19,23.2,23.24,23.26,23.29,23.3,23.3,23.32,23.35,23.35,23.36,23.39,23.4,23.42,23.45,23.48,23.5,23.56,23.61,23.64,23.65,23.68,23.75,23.78,23.8,23.8,23.82,23.84,23.85,23.87,23.89,23.9,23.91,23.95,23.95,23.97,23.99,24,24,24.08,24.1,24.12,24.14,24.15,24.2,24.2,24.2,24.23,24.28,24.31,24.34,24.35,24.36,24.4,24.42,24.45,24.45,24.45,24.51,24.55,24.58,24.6,24.64,24.65,24.65,24.7,24.74,24.74,24.75,24.8,24.84,24.85,24.86,24.9,24.95,25.02,25.05,25.08,25.1,25.15,25.18,25.24,25.26,25.3,25.35,25.37,25.4,25.42,25.45,25.5,25.5,25.52,25.55,25.55,25.58,25.6,25.65,25.7,25.75,25.8,25.84,25.85,25.9,25.92,25.96,26,26.03,26.05,26.06,26.1,26.1,26.15,26.17,26.2,26.3,26.32,26.37,26.4,26.4,26.45,26.49,26.52,26.58,26.63,26.65,26.73,26.76,26.8,26.81,26.84,26.85,26.85,26.87,26.94,26.95,26.95,27,27.06,27.14,27.22,27.26,27.3,27.35,27.39,27.45,27.5,27.53,27.58,27.65,27.66,27.7,27.7,27.75,27.77,27.83,27.85,27.9,27.95,28.04,28.1,28.14,28.18,28.2,28.24,28.26,28.29,28.33,28.35,28.4,28.4,28.46,28.54,28.55,28.6,28.6,28.6,28.67,28.72,28.76,28.8,28.85,28.95,29.01,29.05,29.11,29.14,29.15,29.2,29.25,29.28,29.35,29.45,29.48,29.54,29.61,29.7,29.7,29.79,29.86,29.9,29.95,30,30.05,30.13,30.24,30.3,30.35,30.4,30.4,30.49,30.55,30.6,30.7,30.75,30.8,30.8,30.86,30.94,31.02,31.06,31.15,31.24,31.25,31.34,31.35,31.45,31.5,31.64,31.65,31.78,31.9,31.93,32,32.1,32.1,32.15,32.18,32.25,32.34,32.48,32.55,32.6,32.65,32.74,32.87,32.99,33,33.05,33.25,33.36,33.41,33.5,33.55,33.65,33.82,33.9,34.06,34.14,34.3,34.32,34.35,34.45,34.65,34.8,34.89,35.01,35.17,35.2,35.3,35.45,35.64,35.74,35.91,36.15,36.34,36.5,36.55,36.8,37.1,37.4,37.64,37.85,37.95,38.25,38.54,38.72,39,39.4,39.72,40.2,40.75,41.05,41.75,42.11,42.9,43.6,44.54,46,47.8],"train_bat_골든글러브":[14.5,18.4,19.3,19.7,20,20.3,20.6,20.8,20.9,21.1,21.2,21.3,21.4,21.5,21.6,21.7,21.8,21.9,22,22.1,22.1,22.2,22.3,22.3,22.4,22.5,22.5,22.6,22.6,22.7,22.8,22.8,22.9,22.9,23,23,23.1,23.1,23.1,23.2,23.2,23.3,23.3,23.3,23.4,23.4,23.4,23.5,23.5,23.5,23.6,23.6,23.6,23.7,23.7,23.7,23.8,23.8,23.8,23.8,23.9,23.9,23.9,24,24,24,24,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.6,24.7,24.7,24.7,24.7,24.8,24.8,24.8,24.8,24.8,24.9,24.9,24.9,24.9,24.9,25,25,25,25,25,25.1,25.1,25.1,25.1,25.1,25.1,25.2,25.2,25.2,25.2,25.2,25.3,25.3,25.3,25.3,25.3,25.3,25.4,25.4,25.4,25.4,25.4,25.4,25.4,25.5,25.5,25.5,25.5,25.5,25.5,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.7,25.7,25.7,25.7,25.7,25.7,25.8,25.8,25.8,25.8,25.8,25.8,25.9,25.9,25.9,25.9,25.9,25.9,25.9,26,26,26,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.9,26.9,26.9,26.9,26.9,26.9,26.9,26.9,27,27,27,27,27,27,27,27,27,27,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,28,28,28,28,28,28,28,28,28,28,28,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29,29,29,29,29,29,29,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,30,30,30,30,30,30,30,30,30,30,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,32,32,32,32,32,32,32,32,32,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.4,33.4,33.4,33.4,33.4,33.4,33.5,33.5,33.5,33.5,33.5,33.5,33.6,33.6,33.6,33.6,33.6,33.6,33.7,33.7,33.7,33.7,33.7,33.8,33.8,33.8,33.8,33.8,33.8,33.9,33.9,33.9,33.9,33.9,34,34,34,34,34,34.1,34.1,34.1,34.1,34.2,34.2,34.2,34.2,34.2,34.3,34.3,34.3,34.3,34.4,34.4,34.4,34.4,34.5,34.5,34.5,34.5,34.6,34.6,34.6,34.6,34.7,34.7,34.7,34.7,34.8,34.8,34.8,34.9,34.9,34.9,34.9,35,35,35,35.1,35.1,35.1,35.2,35.2,35.3,35.3,35.3,35.4,35.4,35.4,35.5,35.5,35.5,35.6,35.6,35.7,35.7,35.8,35.8,35.8,35.9,35.9,36,36,36.1,36.1,36.2,36.2,36.3,36.4,36.4,36.5,36.5,36.6,36.7,36.8,36.8,36.9,36.9,37,37.1,37.2,37.3,37.4,37.5,37.6,37.8,37.9,38,38.2,38.4,38.6,38.8,39.1,39.5,40,40.8],"train_bat_시그니처":[17.7,21.1,21.8,22.1,22.4,22.7,22.8,23,23.2,23.3,23.4,23.6,23.7,23.8,23.9,24,24.1,24.2,24.2,24.3,24.4,24.4,24.5,24.5,24.6,24.6,24.7,24.7,24.8,24.8,24.9,24.9,25,25,25.1,25.1,25.1,25.2,25.2,25.3,25.3,25.3,25.4,25.4,25.4,25.5,25.5,25.5,25.6,25.6,25.6,25.7,25.7,25.7,25.8,25.8,25.8,25.9,25.9,25.9,25.9,26,26,26,26,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.8,26.9,26.9,26.9,26.9,26.9,27,27,27,27,27,27,27.1,27.1,27.1,27.1,27.1,27.1,27.2,27.2,27.2,27.2,27.2,27.2,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.4,27.4,27.4,27.4,27.4,27.4,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,28,28,28,28,28,28,28,28,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29,29,29,29,29,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,30,30,30,30,30,30,30,30,30,30,30,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,32,32,32,32,32,32,32,32,32,32,32,32,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.3,33.3,33.3,33.4,33.4,33.4,33.4,33.4,33.4,33.4,33.4,33.4,33.4,33.5,33.5,33.5,33.5,33.5,33.5,33.5,33.5,33.5,33.6,33.6,33.6,33.6,33.6,33.6,33.6,33.6,33.6,33.6,33.7,33.7,33.7,33.7,33.7,33.7,33.7,33.7,33.8,33.8,33.8,33.8,33.8,33.8,33.8,33.8,33.9,33.9,33.9,33.9,33.9,33.9,33.9,33.9,33.9,34,34,34,34,34,34,34,34,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.1,34.2,34.2,34.2,34.2,34.2,34.2,34.2,34.2,34.3,34.3,34.3,34.3,34.3,34.3,34.3,34.3,34.4,34.4,34.4,34.4,34.4,34.4,34.4,34.5,34.5,34.5,34.5,34.5,34.5,34.6,34.6,34.6,34.6,34.6,34.6,34.6,34.7,34.7,34.7,34.7,34.7,34.7,34.7,34.8,34.8,34.8,34.8,34.8,34.8,34.8,34.9,34.9,34.9,34.9,34.9,34.9,35,35,35,35,35,35,35.1,35.1,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.2,35.2,35.2,35.3,35.3,35.3,35.3,35.3,35.3,35.4,35.4,35.4,35.4,35.4,35.5,35.5,35.5,35.5,35.5,35.6,35.6,35.6,35.6,35.6,35.7,35.7,35.7,35.7,35.8,35.8,35.8,35.8,35.9,35.9,35.9,35.9,35.9,36,36,36,36,36.1,36.1,36.1,36.1,36.2,36.2,36.2,36.2,36.3,36.3,36.3,36.4,36.4,36.4,36.4,36.5,36.5,36.5,36.5,36.6,36.6,36.6,36.7,36.7,36.7,36.8,36.8,36.9,36.9,36.9,37,37,37,37.1,37.1,37.1,37.2,37.2,37.3,37.3,37.4,37.4,37.5,37.5,37.6,37.6,37.7,37.7,37.8,37.8,37.9,38,38,38.1,38.2,38.3,38.3,38.4,38.5,38.6,38.7,38.8,39,39.1,39.3,39.5,39.6,39.9,40.1,40.4,40.8,41.5],"train_bat_라이브":[14.1,18.7,19.3,19.7,20,20.3,20.5,20.7,20.9,21,21.1,21.2,21.3,21.4,21.5,21.6,21.7,21.8,21.9,22,22,22.1,22.2,22.2,22.3,22.3,22.4,22.5,22.5,22.6,22.6,22.7,22.8,22.8,22.9,22.9,23,23,23,23.1,23.1,23.2,23.2,23.2,23.3,23.3,23.4,23.4,23.4,23.5,23.5,23.5,23.6,23.6,23.6,23.7,23.7,23.7,23.8,23.8,23.8,23.9,23.9,23.9,24,24,24,24,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.6,24.7,24.7,24.7,24.7,24.7,24.8,24.8,24.8,24.8,24.8,24.9,24.9,24.9,24.9,24.9,25,25,25,25,25,25.1,25.1,25.1,25.1,25.1,25.2,25.2,25.2,25.2,25.2,25.2,25.3,25.3,25.3,25.3,25.3,25.3,25.4,25.4,25.4,25.4,25.4,25.4,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.7,25.7,25.7,25.7,25.7,25.7,25.7,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.9,25.9,25.9,25.9,25.9,25.9,25.9,26,26,26,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.9,26.9,26.9,26.9,26.9,26.9,26.9,26.9,26.9,27,27,27,27,27,27,27,27,27,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,28,28,28,28,28,28,28,28,28,28,28,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29,29,29,29,29,29,29,29,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,30,30,30,30,30,30,30,30,30,30,30,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,32,32,32,32,32,32,32,32,32,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.4,33.4,33.4,33.4,33.4,33.4,33.4,33.5,33.5,33.5,33.5,33.5,33.6,33.6,33.6,33.6,33.6,33.7,33.7,33.7,33.7,33.7,33.8,33.8,33.8,33.8,33.8,33.9,33.9,33.9,33.9,33.9,34,34,34,34,34,34.1,34.1,34.1,34.1,34.1,34.2,34.2,34.2,34.2,34.2,34.3,34.3,34.3,34.3,34.4,34.4,34.4,34.4,34.5,34.5,34.5,34.5,34.6,34.6,34.6,34.6,34.7,34.7,34.7,34.7,34.8,34.8,34.8,34.9,34.9,34.9,34.9,35,35,35,35.1,35.1,35.1,35.2,35.2,35.2,35.3,35.3,35.3,35.4,35.4,35.4,35.5,35.5,35.5,35.6,35.6,35.7,35.7,35.7,35.8,35.8,35.9,35.9,36,36,36.1,36.1,36.2,36.2,36.3,36.4,36.4,36.5,36.5,36.6,36.7,36.8,36.8,36.9,37,37.1,37.2,37.2,37.3,37.4,37.5,37.6,37.8,37.9,38,38.2,38.4,38.7,39,39.4,39.9,40.8],"train_bat_올스타":[15.2,18.6,19.4,19.8,20.1,20.3,20.5,20.6,20.8,21,21.1,21.2,21.4,21.5,21.6,21.7,21.8,21.9,22,22,22.1,22.2,22.2,22.3,22.4,22.4,22.5,22.5,22.6,22.7,22.7,22.8,22.8,22.9,22.9,23,23,23,23.1,23.1,23.2,23.2,23.2,23.3,23.3,23.4,23.4,23.4,23.5,23.5,23.5,23.6,23.6,23.6,23.6,23.7,23.7,23.7,23.8,23.8,23.8,23.8,23.9,23.9,23.9,24,24,24,24,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.7,24.7,24.7,24.7,24.7,24.8,24.8,24.8,24.8,24.8,24.9,24.9,24.9,24.9,24.9,25,25,25,25,25,25.1,25.1,25.1,25.1,25.1,25.1,25.2,25.2,25.2,25.2,25.2,25.3,25.3,25.3,25.3,25.3,25.3,25.4,25.4,25.4,25.4,25.4,25.4,25.5,25.5,25.5,25.5,25.5,25.5,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.7,25.7,25.7,25.7,25.7,25.7,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.9,25.9,25.9,25.9,25.9,25.9,25.9,26,26,26,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.9,26.9,26.9,26.9,26.9,26.9,26.9,26.9,27,27,27,27,27,27,27,27,27,27,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.3,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.5,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.6,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.7,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.8,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,27.9,28,28,28,28,28,28,28,28,28,28,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29,29,29,29,29,29,29,29,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.1,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.2,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.3,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.4,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.5,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.6,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.7,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.8,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,29.9,30,30,30,30,30,30,30,30,30,30,30,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.1,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.2,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.3,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.2,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.3,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.4,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.5,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.6,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.7,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.8,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,31.9,32,32,32,32,32,32,32,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.1,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.2,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.3,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.4,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.5,32.6,32.6,32.6,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.4,33.4,33.4,33.4,33.4,33.4,33.5,33.5,33.5,33.5,33.5,33.5,33.6,33.6,33.6,33.6,33.6,33.6,33.7,33.7,33.7,33.7,33.7,33.8,33.8,33.8,33.8,33.8,33.9,33.9,33.9,33.9,33.9,33.9,34,34,34,34,34.1,34.1,34.1,34.1,34.2,34.2,34.2,34.2,34.3,34.3,34.3,34.3,34.3,34.4,34.4,34.4,34.4,34.5,34.5,34.5,34.5,34.6,34.6,34.6,34.6,34.7,34.7,34.7,34.7,34.8,34.8,34.8,34.9,34.9,34.9,35,35,35,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.3,35.3,35.4,35.4,35.4,35.5,35.5,35.5,35.6,35.6,35.7,35.7,35.7,35.8,35.8,35.9,35.9,36,36,36.1,36.1,36.2,36.2,36.3,36.3,36.4,36.4,36.5,36.6,36.6,36.7,36.8,36.9,36.9,37,37.1,37.2,37.3,37.4,37.5,37.6,37.7,37.8,38,38.2,38.3,38.5,38.7,38.9,39.4,39.7,40.6],"train_bat_국가대표":[10,14.1,14.6,15,15.3,15.5,15.7,15.9,16,16.1,16.2,16.4,16.5,16.6,16.6,16.7,16.8,16.9,17,17,17.1,17.2,17.3,17.3,17.4,17.4,17.5,17.5,17.6,17.6,17.7,17.7,17.8,17.8,17.9,17.9,17.9,18,18,18,18.1,18.1,18.2,18.2,18.2,18.2,18.3,18.3,18.3,18.4,18.4,18.4,18.5,18.5,18.5,18.6,18.6,18.6,18.6,18.6,18.7,18.7,18.7,18.7,18.8,18.8,18.8,18.9,18.9,18.9,18.9,19,19,19,19,19,19.1,19.1,19.1,19.1,19.1,19.2,19.2,19.2,19.2,19.2,19.3,19.3,19.3,19.3,19.3,19.4,19.4,19.4,19.4,19.4,19.5,19.5,19.5,19.5,19.5,19.6,19.6,19.6,19.6,19.6,19.6,19.7,19.7,19.7,19.7,19.7,19.7,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.9,19.9,19.9,19.9,19.9,19.9,20,20,20,20,20,20,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.2,20.2,20.2,20.2,20.2,20.2,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,21,21,21,21,21,21,21,21,21,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,22,22,22,22,22,22,22,22,22,22,22,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,23,23,23,23,23,23,23,23,23,23,23,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.9,24.9,24.9,24.9,24.9,24.9,24.9,24.9,24.9,24.9,24.9,25,25,25,25,25,25,25,25,25,25,25,25,25.1,25.1,25.1,25.1,25.1,25.1,25.1,25.1,25.1,25.1,25.1,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.2,25.3,25.3,25.3,25.3,25.3,25.3,25.3,25.3,25.3,25.3,25.3,25.4,25.4,25.4,25.4,25.4,25.4,25.4,25.4,25.4,25.4,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.5,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.6,25.7,25.7,25.7,25.7,25.7,25.7,25.7,25.7,25.7,25.7,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.8,25.9,25.9,25.9,25.9,25.9,25.9,25.9,25.9,25.9,26,26,26,26,26,26,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.8,26.9,26.9,26.9,26.9,26.9,26.9,27,27,27,27,27,27,27,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.1,27.2,27.2,27.2,27.2,27.2,27.2,27.2,27.3,27.3,27.3,27.3,27.3,27.3,27.4,27.4,27.4,27.4,27.4,27.4,27.4,27.5,27.5,27.5,27.5,27.5,27.5,27.6,27.6,27.6,27.6,27.6,27.6,27.7,27.7,27.7,27.7,27.7,27.7,27.8,27.8,27.8,27.8,27.8,27.9,27.9,27.9,27.9,27.9,27.9,27.9,28,28,28,28,28,28.1,28.1,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.9,28.9,28.9,28.9,29,29,29,29.1,29.1,29.1,29.2,29.2,29.2,29.3,29.3,29.3,29.4,29.4,29.4,29.5,29.5,29.6,29.6,29.6,29.7,29.7,29.8,29.8,29.9,29.9,30,30,30.1,30.2,30.2,30.3,30.3,30.4,30.5,30.5,30.6,30.7,30.8,30.9,31,31.1,31.3,31.4,31.5,31.7,31.8,32,32.2,32.5,33,33.7],"train_bat_임팩트":[9.7,12.3,13,13.4,13.7,13.8,14,14.1,14.2,14.4,14.5,14.6,14.6,14.7,14.8,14.9,14.9,15,15.1,15.1,15.2,15.2,15.3,15.3,15.4,15.4,15.5,15.5,15.6,15.6,15.6,15.7,15.7,15.8,15.8,15.8,15.9,15.9,16,16,16,16.1,16.1,16.1,16.2,16.2,16.2,16.3,16.3,16.3,16.3,16.4,16.4,16.4,16.5,16.5,16.5,16.5,16.6,16.6,16.6,16.6,16.7,16.7,16.7,16.7,16.8,16.8,16.8,16.8,16.8,16.9,16.9,16.9,16.9,17,17,17,17,17,17.1,17.1,17.1,17.1,17.1,17.2,17.2,17.2,17.2,17.3,17.3,17.3,17.3,17.3,17.4,17.4,17.4,17.4,17.4,17.4,17.5,17.5,17.5,17.5,17.5,17.5,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.7,17.7,17.7,17.7,17.7,17.7,17.8,17.8,17.8,17.8,17.8,17.8,17.9,17.9,17.9,17.9,17.9,17.9,17.9,18,18,18,18,18,18,18,18.1,18.1,18.1,18.1,18.1,18.1,18.1,18.1,18.2,18.2,18.2,18.2,18.2,18.2,18.2,18.2,18.3,18.3,18.3,18.3,18.3,18.3,18.3,18.4,18.4,18.4,18.4,18.4,18.4,18.4,18.4,18.5,18.5,18.5,18.5,18.5,18.5,18.5,18.5,18.5,18.6,18.6,18.6,18.6,18.6,18.6,18.6,18.6,18.6,18.7,18.7,18.7,18.7,18.7,18.7,18.7,18.7,18.7,18.8,18.8,18.8,18.8,18.8,18.8,18.8,18.8,18.8,18.8,18.9,18.9,18.9,18.9,18.9,18.9,18.9,18.9,18.9,18.9,19,19,19,19,19,19,19,19,19,19.1,19.1,19.1,19.1,19.1,19.1,19.1,19.1,19.1,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.2,19.3,19.3,19.3,19.3,19.3,19.3,19.3,19.3,19.3,19.3,19.3,19.4,19.4,19.4,19.4,19.4,19.4,19.4,19.4,19.4,19.4,19.4,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,20,20,20,20,20,20,20,20,20,20,20,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.2,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.3,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.4,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.5,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.6,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.7,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.8,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,20.9,21,21,21,21,21,21,21,21,21,21,21,21,21,21,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.1,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.2,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.3,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.4,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.5,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.6,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,22,22,22,22,22,22,22,22,22,22,22,22,22,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.4,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.5,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.6,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.7,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.8,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,22.9,23,23,23,23,23,23,23,23,23,23,23,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.1,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.2,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.3,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.4,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.5,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.6,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.7,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.8,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.6,24.6,24.6,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.7,24.8,24.8,24.8,24.8,24.8,24.8,24.8,24.9,24.9,24.9,24.9,24.9,24.9,25,25,25,25,25,25,25.1,25.1,25.1,25.1,25.1,25.1,25.2,25.2,25.2,25.2,25.2,25.3,25.3,25.3,25.3,25.3,25.3,25.4,25.4,25.4,25.4,25.4,25.4,25.5,25.5,25.5,25.5,25.5,25.6,25.6,25.6,25.6,25.6,25.7,25.7,25.7,25.7,25.7,25.8,25.8,25.8,25.8,25.9,25.9,25.9,25.9,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.4,26.4,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.7,26.7,26.7,26.8,26.8,26.9,26.9,26.9,27,27,27,27.1,27.1,27.2,27.2,27.2,27.3,27.3,27.4,27.4,27.5,27.5,27.6,27.7,27.7,27.8,27.8,27.9,28,28.1,28.1,28.2,28.3,28.4,28.5,28.6,28.8,28.9,29,29.2,29.4,29.6,29.9,30.3,31],"train_pit_골든글러브":[13.3,16.35,17.3,17.6,17.7,18.35,18.55,18.65,18.75,18.85,19.05,19.5,19.7,19.7,19.8,19.8,19.9,20,20,20.45,20.55,20.65,20.75,20.75,20.85,20.85,20.85,20.95,20.95,20.95,21.05,21.05,21.05,21.15,21.25,21.5,21.6,21.7,21.8,21.8,21.8,21.9,21.9,21.9,21.9,21.9,22,22,22,22,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.3,22.3,22.4,22.55,22.65,22.75,22.75,22.85,22.85,22.85,22.85,22.95,22.95,22.95,22.95,22.95,23.05,23.05,23.05,23.05,23.05,23.05,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.25,23.25,23.25,23.25,23.25,23.35,23.35,23.35,23.45,23.45,23.55,23.65,23.7,23.8,23.8,23.9,23.9,23.9,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.6,24.6,24.65,24.7,24.8,24.85,24.9,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.55,25.55,25.55,25.65,25.65,25.65,25.65,25.75,25.75,25.85,25.9,25.9,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.85,26.9,26.95,27,27.05,27.05,27.05,27.15,27.15,27.15,27.15,27.15,27.15,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.85,27.85,27.85,27.85,27.85,27.95,27.95,27.95,28,28.05,28.1,28.1,28.1,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.85,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.95,29,29,29,29,29.05,29.1,29.1,29.15,29.15,29.2,29.25,29.25,29.25,29.35,29.35,29.35,29.35,29.35,29.35,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,30.05,30.05,30.05,30.05,30.05,30.05,30.15,30.15,30.15,30.15,30.2,30.25,30.3,30.3,30.3,30.35,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.25,31.3,31.3,31.35,31.4,31.4,31.45,31.45,31.45,31.55,31.55,31.55,31.55,31.55,31.55,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.25,32.25,32.25,32.25,32.25,32.25,32.35,32.35,32.35,32.4,32.4,32.45,32.5,32.5,32.55,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.35,33.4,33.4,33.4,33.5,33.5,33.55,33.6,33.65,33.65,33.7,33.75,33.75,33.75,33.8,33.85,33.85,33.85,33.85,33.85,33.95,33.95,33.95,33.95,33.95,33.95,33.95,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.35,34.35,34.35,34.35,34.35,34.45,34.45,34.45,34.55,34.55,34.55,34.65,34.7,34.7,34.8,34.8,34.8,34.9,34.9,34.9,34.9,35,35,35,35,35,35.1,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.2,35.2,35.2,35.3,35.3,35.3,35.3,35.3,35.3,35.4,35.4,35.4,35.4,35.45,35.5,35.5,35.55,35.6,35.6,35.7,35.7,35.8,35.85,35.95,35.95,36.05,36.05,36.05,36.15,36.15,36.15,36.25,36.25,36.25,36.25,36.25,36.35,36.35,36.35,36.35,36.45,36.45,36.45,36.55,36.55,36.55,36.65,36.7,36.75,36.85,36.9,37,37.1,37.1,37.2,37.2,37.3,37.3,37.4,37.4,37.4,37.5,37.5,37.5,37.6,37.6,37.7,37.7,37.8,37.9,38.05,38.15,38.25,38.35,38.45,38.45,38.55,38.55,38.65,38.75,38.85,38.95,39.1,39.3,39.4,39.5,39.6,39.7,39.8,40,40.35,40.55,40.75,40.95,41.5,41.9,42.45,43.35],"train_pit_시그니처":[14.35,17.8,18.75,19.6,19.8,20,20.65,20.75,20.85,20.95,21.05,21.35,21.7,21.8,21.9,21.9,22,22,22.1,22.1,22.2,22.3,22.65,22.75,22.85,22.95,22.95,22.95,23.05,23.05,23.05,23.15,23.15,23.15,23.25,23.25,23.25,23.35,23.45,23.55,23.7,23.8,23.9,23.9,24,24,24,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.5,24.5,24.6,24.6,24.75,24.85,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.65,25.65,25.7,25.75,25.85,25.9,26,26,26,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.9,26.9,26.95,27.05,27.05,27.05,27.15,27.15,27.15,27.15,27.25,27.25,27.25,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.85,27.85,27.85,27.85,27.85,27.95,27.95,28,28.05,28.1,28.1,28.2,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29.05,29.1,29.1,29.15,29.2,29.25,29.25,29.25,29.25,29.35,29.35,29.35,29.35,29.35,29.35,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,30.05,30.05,30.05,30.05,30.05,30.05,30.15,30.15,30.15,30.2,30.25,30.25,30.3,30.3,30.3,30.4,30.4,30.4,30.4,30.4,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.15,31.2,31.2,31.2,31.2,31.25,31.3,31.3,31.3,31.35,31.4,31.45,31.45,31.45,31.45,31.5,31.55,31.55,31.55,31.55,31.55,31.55,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,32,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.2,32.25,32.25,32.25,32.25,32.25,32.25,32.35,32.35,32.35,32.35,32.4,32.45,32.45,32.5,32.5,32.55,32.55,32.6,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.3,33.35,33.4,33.4,33.4,33.4,33.45,33.5,33.5,33.5,33.55,33.55,33.6,33.65,33.65,33.65,33.7,33.75,33.75,33.75,33.75,33.85,33.85,33.85,33.85,33.85,33.85,33.85,33.85,33.95,33.95,33.95,33.95,33.95,33.95,33.95,33.95,33.95,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.35,34.35,34.35,34.35,34.35,34.35,34.35,34.35,34.45,34.45,34.45,34.45,34.45,34.5,34.55,34.55,34.55,34.65,34.65,34.7,34.7,34.8,34.8,34.8,34.8,34.9,34.9,34.9,34.9,34.9,35,35,35,35,35,35,35,35.1,35.1,35.1,35.1,35.1,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.2,35.2,35.2,35.2,35.2,35.3,35.3,35.3,35.3,35.3,35.3,35.3,35.3,35.4,35.4,35.4,35.4,35.4,35.4,35.4,35.5,35.5,35.5,35.5,35.5,35.6,35.6,35.6,35.6,35.65,35.7,35.7,35.75,35.8,35.85,35.85,35.95,35.95,35.95,36.05,36.05,36.05,36.05,36.05,36.15,36.15,36.15,36.15,36.15,36.15,36.25,36.25,36.25,36.25,36.25,36.25,36.35,36.35,36.35,36.35,36.35,36.35,36.45,36.45,36.45,36.45,36.45,36.45,36.45,36.55,36.55,36.55,36.55,36.55,36.65,36.65,36.65,36.75,36.75,36.8,36.85,36.9,36.95,37,37,37.1,37.1,37.1,37.2,37.2,37.2,37.2,37.3,37.3,37.3,37.3,37.3,37.4,37.4,37.4,37.4,37.5,37.5,37.5,37.5,37.5,37.6,37.6,37.6,37.7,37.7,37.7,37.7,37.8,37.8,37.9,37.95,38.05,38.15,38.15,38.25,38.25,38.25,38.35,38.35,38.35,38.45,38.45,38.45,38.55,38.55,38.55,38.65,38.65,38.75,38.75,38.85,38.85,38.95,39.05,39.15,39.3,39.3,39.4,39.5,39.5,39.6,39.6,39.7,39.7,39.8,39.8,39.9,40,40.1,40.25,40.45,40.55,40.65,40.65,40.75,40.85,40.95,41.15,41.35,41.6,41.8,41.9,42.1,42.5,42.95,43.7,44.85],"train_pit_라이브":[12.05,16.15,16.75,17.5,17.8,18.45,18.55,18.65,18.75,18.95,19.4,19.6,19.7,19.7,19.8,19.9,19.9,20,20.1,20.3,20.55,20.65,20.65,20.75,20.75,20.85,20.85,20.85,20.95,20.95,20.95,21.05,21.05,21.15,21.15,21.25,21.5,21.7,21.7,21.8,21.8,21.8,21.8,21.9,21.9,21.9,21.9,22,22,22,22,22.1,22.1,22.1,22.1,22.2,22.2,22.3,22.3,22.4,22.55,22.65,22.75,22.75,22.85,22.85,22.85,22.85,22.95,22.95,22.95,22.95,22.95,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.15,23.15,23.15,23.15,23.15,23.15,23.25,23.25,23.25,23.25,23.25,23.35,23.35,23.35,23.35,23.45,23.45,23.5,23.55,23.7,23.8,23.8,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.6,24.6,24.7,24.75,24.8,24.85,24.85,24.95,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.55,25.55,25.55,25.65,25.65,25.65,25.65,25.75,25.75,25.8,25.85,25.9,25.9,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.85,26.9,26.95,26.95,27.05,27.05,27.05,27.1,27.15,27.15,27.15,27.15,27.15,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.85,27.85,27.85,27.85,27.85,27.85,27.95,27.95,27.95,28,28.05,28.1,28.1,28.15,28.2,28.2,28.2,28.2,28.25,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29.05,29.1,29.1,29.15,29.15,29.2,29.25,29.25,29.25,29.3,29.35,29.35,29.35,29.35,29.35,29.35,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,30.05,30.05,30.05,30.05,30.05,30.05,30.1,30.15,30.15,30.15,30.15,30.2,30.25,30.25,30.3,30.3,30.35,30.4,30.4,30.4,30.4,30.45,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.25,31.3,31.3,31.35,31.4,31.45,31.45,31.5,31.55,31.55,31.55,31.55,31.55,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.25,32.25,32.25,32.25,32.25,32.25,32.35,32.35,32.35,32.4,32.45,32.5,32.5,32.55,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.3,33.4,33.4,33.4,33.5,33.5,33.55,33.55,33.65,33.65,33.7,33.75,33.75,33.75,33.75,33.85,33.85,33.85,33.85,33.85,33.95,33.95,33.95,33.95,33.95,33.95,33.95,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.35,34.35,34.35,34.35,34.35,34.45,34.45,34.45,34.5,34.55,34.55,34.6,34.65,34.7,34.75,34.8,34.8,34.9,34.9,34.9,34.9,35,35,35,35,35,35.1,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.2,35.2,35.2,35.3,35.3,35.3,35.3,35.3,35.4,35.4,35.4,35.4,35.4,35.5,35.5,35.5,35.6,35.6,35.65,35.7,35.8,35.85,35.9,35.95,35.95,36.05,36.05,36.05,36.15,36.15,36.15,36.15,36.25,36.25,36.25,36.25,36.35,36.35,36.35,36.35,36.45,36.45,36.45,36.45,36.55,36.55,36.55,36.65,36.65,36.75,36.85,36.95,37,37.1,37.2,37.2,37.3,37.3,37.3,37.4,37.4,37.5,37.5,37.5,37.6,37.6,37.7,37.7,37.8,37.9,38.05,38.15,38.25,38.35,38.45,38.45,38.55,38.65,38.65,38.75,38.85,39.05,39.2,39.4,39.5,39.6,39.7,39.8,39.9,40.15,40.45,40.65,40.75,40.95,41.4,41.7,42.45,43.45],"train_pit_올스타":[11.2,16.25,16.85,17.5,17.7,18.35,18.55,18.65,18.75,18.85,19.2,19.5,19.6,19.7,19.8,19.8,19.9,19.9,20,20.1,20.45,20.55,20.65,20.75,20.75,20.75,20.85,20.85,20.85,20.95,20.95,20.95,21.05,21.05,21.15,21.25,21.45,21.6,21.7,21.7,21.8,21.8,21.8,21.9,21.9,21.9,21.9,22,22,22,22,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.3,22.3,22.4,22.55,22.65,22.75,22.75,22.85,22.85,22.85,22.85,22.95,22.95,22.95,22.95,22.95,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.15,23.15,23.15,23.15,23.15,23.15,23.25,23.25,23.25,23.25,23.25,23.35,23.35,23.35,23.35,23.35,23.45,23.45,23.55,23.65,23.7,23.8,23.8,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.6,24.6,24.7,24.75,24.85,24.85,24.95,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.55,25.55,25.55,25.65,25.65,25.65,25.65,25.75,25.75,25.8,25.9,25.9,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.85,26.9,26.95,26.95,27,27.05,27.05,27.15,27.15,27.15,27.15,27.15,27.15,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.85,27.85,27.85,27.85,27.85,27.85,27.9,27.95,27.95,27.95,28,28.05,28.1,28.1,28.15,28.2,28.2,28.2,28.2,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,28.9,28.9,28.9,28.9,29,29,29,29,29.05,29.1,29.1,29.1,29.15,29.2,29.25,29.25,29.25,29.35,29.35,29.35,29.35,29.35,29.35,29.35,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.45,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.55,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.65,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.75,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.85,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,29.95,30.05,30.05,30.05,30.05,30.05,30.05,30.05,30.15,30.15,30.15,30.2,30.25,30.25,30.3,30.3,30.4,30.4,30.4,30.4,30.45,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.5,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.6,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.7,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.8,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,30.9,31,31,31,31,31,31,31,31,31,31,31.1,31.1,31.1,31.1,31.1,31.1,31.1,31.2,31.2,31.2,31.2,31.2,31.3,31.3,31.3,31.35,31.4,31.45,31.45,31.45,31.5,31.55,31.55,31.55,31.55,31.55,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.65,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.75,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.85,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,31.95,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.05,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.15,32.25,32.25,32.25,32.25,32.25,32.3,32.35,32.35,32.35,32.4,32.45,32.5,32.5,32.55,32.6,32.6,32.6,32.7,32.7,32.7,32.7,32.7,32.7,32.75,32.8,32.8,32.8,32.8,32.8,32.8,32.8,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,32.9,33,33,33,33,33,33,33,33,33,33,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.1,33.2,33.2,33.2,33.2,33.2,33.2,33.2,33.3,33.3,33.3,33.3,33.3,33.35,33.4,33.4,33.4,33.45,33.5,33.5,33.55,33.6,33.65,33.65,33.65,33.75,33.75,33.75,33.8,33.85,33.85,33.85,33.85,33.85,33.95,33.95,33.95,33.95,33.95,33.95,33.95,34.05,34.05,34.05,34.05,34.05,34.05,34.05,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.15,34.25,34.25,34.25,34.25,34.25,34.25,34.25,34.35,34.35,34.35,34.35,34.35,34.45,34.45,34.45,34.45,34.55,34.55,34.6,34.65,34.7,34.8,34.8,34.85,34.9,34.9,34.9,35,35,35,35,35,35.1,35.1,35.1,35.1,35.1,35.2,35.2,35.2,35.2,35.2,35.3,35.3,35.3,35.3,35.3,35.3,35.4,35.4,35.4,35.4,35.4,35.5,35.5,35.5,35.6,35.6,35.65,35.7,35.75,35.85,35.85,35.95,35.95,36.05,36.05,36.05,36.15,36.15,36.15,36.15,36.25,36.25,36.25,36.25,36.35,36.35,36.35,36.35,36.45,36.45,36.45,36.55,36.55,36.55,36.65,36.65,36.75,36.75,36.9,36.95,37,37.1,37.2,37.2,37.25,37.3,37.3,37.4,37.4,37.4,37.5,37.5,37.6,37.6,37.7,37.7,37.8,37.9,38,38.15,38.2,38.25,38.35,38.45,38.45,38.55,38.55,38.65,38.75,38.85,38.95,39.15,39.4,39.5,39.6,39.7,39.8,39.9,40.1,40.35,40.65,40.75,41.05,41.4,41.8,42.3,43.25],"train_pit_국가대표":[7.75,12.05,13,13.2,13.3,13.95,14.15,14.25,14.35,14.35,14.45,14.55,15.1,15.2,15.2,15.3,15.3,15.4,15.4,15.4,15.5,15.5,15.6,15.6,15.8,16.15,16.25,16.25,16.35,16.35,16.35,16.45,16.45,16.45,16.45,16.45,16.55,16.55,16.55,16.55,16.55,16.65,16.65,16.65,16.65,16.75,16.75,16.95,17.2,17.3,17.3,17.3,17.4,17.4,17.4,17.4,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.7,17.7,17.7,17.7,17.7,17.7,17.8,17.8,17.8,17.8,17.9,17.9,17.9,18,18.15,18.3,18.35,18.35,18.45,18.45,18.45,18.45,18.45,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.95,18.95,18.95,18.95,18.95,18.95,19.05,19.05,19.15,19.2,19.3,19.4,19.4,19.5,19.5,19.5,19.5,19.5,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,20,20,20,20,20,20,20,20,20,20.1,20.1,20.1,20.1,20.2,20.2,20.2,20.3,20.35,20.45,20.45,20.55,20.55,20.55,20.55,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.25,21.25,21.25,21.25,21.35,21.35,21.4,21.5,21.5,21.6,21.6,21.6,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.4,22.4,22.4,22.4,22.45,22.5,22.55,22.65,22.65,22.65,22.75,22.75,22.75,22.75,22.75,22.75,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.45,23.45,23.45,23.45,23.45,23.45,23.55,23.55,23.55,23.65,23.7,23.7,23.75,23.8,23.8,23.8,23.8,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.6,24.6,24.7,24.7,24.75,24.8,24.85,24.85,24.85,24.95,24.95,24.95,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.55,25.55,25.55,25.55,25.55,25.55,25.65,25.65,25.65,25.65,25.65,25.7,25.75,25.75,25.8,25.85,25.9,25.9,26,26,26,26,26.1,26.1,26.1,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.7,26.7,26.7,26.7,26.8,26.8,26.8,26.8,26.9,26.9,27,27.05,27.05,27.05,27.15,27.15,27.15,27.15,27.25,27.25,27.25,27.25,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.75,27.75,27.75,27.75,27.85,27.85,27.85,27.85,27.95,27.95,28,28.05,28.1,28.2,28.2,28.3,28.3,28.3,28.3,28.4,28.4,28.4,28.4,28.4,28.4,28.5,28.5,28.5,28.5,28.5,28.5,28.5,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.6,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.7,28.8,28.8,28.8,28.8,28.8,28.8,28.9,28.9,28.9,28.9,29,29,29.1,29.1,29.2,29.25,29.35,29.35,29.45,29.45,29.45,29.55,29.55,29.55,29.55,29.55,29.65,29.65,29.65,29.65,29.65,29.75,29.75,29.75,29.75,29.75,29.85,29.85,29.85,29.85,29.85,29.95,29.95,29.95,30.05,30.05,30.15,30.15,30.25,30.35,30.4,30.5,30.5,30.6,30.6,30.7,30.7,30.7,30.8,30.8,30.8,30.9,30.9,30.9,31,31,31,31.1,31.2,31.25,31.45,31.55,31.65,31.75,31.75,31.85,31.85,31.95,31.95,32.05,32.05,32.15,32.25,32.45,32.65,32.8,32.9,33,33.1,33.2,33.3,33.75,33.95,34.15,34.35,35,35.4,36.35],"train_pit_임팩트":[6.5,10.05,10.9,11.1,11.85,12.05,12.15,12.25,12.55,13,13.1,13.1,13.2,13.2,13.2,13.3,13.3,13.4,13.5,13.95,14.05,14.05,14.15,14.15,14.15,14.25,14.25,14.25,14.25,14.35,14.35,14.35,14.35,14.35,14.45,14.45,14.45,14.55,14.55,14.65,15,15.1,15.1,15.2,15.2,15.2,15.2,15.3,15.3,15.3,15.3,15.3,15.3,15.4,15.4,15.4,15.4,15.4,15.4,15.4,15.4,15.5,15.5,15.5,15.5,15.5,15.5,15.6,15.6,15.6,15.7,15.7,15.7,15.9,16.05,16.15,16.15,16.25,16.25,16.25,16.25,16.35,16.35,16.35,16.35,16.35,16.35,16.35,16.35,16.35,16.45,16.45,16.45,16.45,16.45,16.45,16.45,16.45,16.45,16.45,16.55,16.55,16.55,16.55,16.55,16.55,16.55,16.55,16.55,16.55,16.65,16.65,16.65,16.65,16.65,16.65,16.65,16.65,16.75,16.75,16.75,16.75,16.75,16.85,16.85,16.95,17.1,17.2,17.2,17.3,17.3,17.3,17.3,17.4,17.4,17.4,17.4,17.4,17.4,17.4,17.4,17.4,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.5,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.6,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.7,17.8,17.8,17.8,17.8,17.8,17.8,17.8,17.8,17.9,17.9,17.9,17.9,17.9,18,18,18.1,18.15,18.25,18.35,18.35,18.35,18.35,18.45,18.45,18.45,18.45,18.45,18.45,18.45,18.45,18.45,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.55,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.65,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.75,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.85,18.95,18.95,18.95,18.95,18.95,18.95,18.95,18.95,19.05,19.05,19.05,19.05,19.05,19.15,19.15,19.3,19.3,19.4,19.4,19.4,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.5,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.6,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.7,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.8,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,19.9,20,20,20,20,20,20,20,20,20,20,20,20,20,20,20.1,20.1,20.1,20.1,20.1,20.1,20.1,20.2,20.2,20.2,20.2,20.3,20.35,20.45,20.45,20.45,20.55,20.55,20.55,20.55,20.55,20.55,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.65,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.75,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.85,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,20.95,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.05,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.15,21.25,21.25,21.25,21.25,21.25,21.25,21.35,21.35,21.35,21.45,21.5,21.5,21.6,21.6,21.6,21.6,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.7,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.8,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,21.9,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.1,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.2,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.3,22.4,22.4,22.4,22.4,22.45,22.5,22.55,22.65,22.65,22.65,22.75,22.75,22.75,22.75,22.75,22.75,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.85,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,22.95,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.05,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.15,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.25,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.35,23.45,23.45,23.45,23.45,23.45,23.5,23.55,23.55,23.6,23.65,23.7,23.8,23.8,23.8,23.8,23.9,23.9,23.9,23.9,23.9,23.9,23.9,23.9,24,24,24,24,24,24,24,24,24,24,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.1,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.2,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.3,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.4,24.5,24.5,24.5,24.5,24.5,24.5,24.6,24.6,24.6,24.7,24.7,24.75,24.85,24.85,24.9,24.95,24.95,24.95,24.95,25.05,25.05,25.05,25.05,25.05,25.05,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.15,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.25,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.35,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.45,25.55,25.55,25.55,25.55,25.55,25.55,25.55,25.65,25.65,25.65,25.65,25.75,25.8,25.9,25.95,26,26,26.1,26.1,26.1,26.2,26.2,26.2,26.2,26.2,26.2,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.3,26.4,26.4,26.4,26.4,26.4,26.4,26.4,26.5,26.5,26.5,26.5,26.5,26.5,26.5,26.6,26.6,26.6,26.6,26.6,26.6,26.7,26.7,26.7,26.75,26.8,26.8,26.9,27,27.05,27.15,27.15,27.25,27.25,27.25,27.35,27.35,27.35,27.35,27.45,27.45,27.45,27.45,27.45,27.55,27.55,27.55,27.55,27.55,27.65,27.65,27.65,27.65,27.75,27.75,27.75,27.85,27.85,27.95,28.05,28.2,28.3,28.3,28.4,28.4,28.5,28.5,28.5,28.6,28.6,28.6,28.7,28.7,28.7,28.8,28.8,28.9,28.9,29,29.15,29.35,29.45,29.55,29.65,29.65,29.75,29.75,29.85,29.95,30.05,30.25,30.6,30.7,30.8,31,31.1,31.45,31.75,31.95,32.6,33.2],"spec_bat_골든글러브":[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7,7,7,7,7,7,7,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.3,7.3,7.3,7.3,7.3,7.4,7.4,7.4,7.4,7.5,7.5,7.5,7.6,7.6,7.6,7.6,7.7,7.7,7.7,7.7,7.7,7.8,7.8,7.8,7.8,7.8,7.9,7.9,7.9,7.9,8,8,8,8.1,8.1,8.1,8.2,8.2,8.3,8.4,8.6,8.6,8.7,8.8,9,9.1],"spec_pit_골든글러브":[3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.65,7.65,7.65,7.65,7.65,7.65,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.05,8.05,8.05,8.05,8.8,8.8,8.8,8.8,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.2,9.85,9.95,10.05,10.05,10.15,10.25],"spec_bat_시그니처":[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7,7,7,7,7,7,7,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.3,7.3,7.3,7.3,7.4,7.4,7.4,7.4,7.4,7.5,7.5,7.5,7.6,7.6,7.6,7.7,7.7,7.7,7.7,7.7,7.8,7.8,7.8,7.8,7.8,7.9,7.9,7.9,7.9,8,8,8,8.1,8.1,8.1,8.2,8.2,8.3,8.4,8.6,8.6,8.7,8.8,9,9.2],"spec_pit_시그니처":[3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.65,7.65,7.65,7.65,7.65,7.65,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.05,8.05,8.05,8.7,8.8,8.8,8.8,8.8,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.2,9.95,9.95,10.05,10.15,10.9],"spec_bat_fa_시그니처":[5,5,5,5.3,5.3,5.3,5.3,5.3,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7,7,7,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,9.9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.2,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.3,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.4,10.5,10.5,10.5,10.5,10.5,10.5,10.5,10.5,10.5,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.6,10.7,10.7,10.7,10.7,10.7,10.7,10.7,10.7,10.7,10.7,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.8,10.9,10.9,10.9,10.9,10.9,10.9,10.9,10.9,11,11,11,11,11,11,11,11,11,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.3,11.3,11.3,11.3,11.3,11.3,11.4,11.4,11.4,11.4,11.4,11.5,11.5,11.5,11.5,11.6,11.6,11.6,11.6,11.7,11.7,11.7,11.7,11.8,11.8,11.8,11.8,11.9,11.9,11.9,12,12,12,12.1,12.1,12.1,12.2,12.2,12.3,12.4,12.4,12.5,12.5,12.6,12.7,12.8,12.9,13.1,13.2,13.5,13.8],"spec_pit_fa_시그니처":[5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,11,11,11,11,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.5,11.5,11.5,11.5,12.05,12.15,12.15,12.15,12.15,12.15,12.15,12.15,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.25,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.35,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.45,12.55,12.55,12.55,12.55,12.55,12.55,12.55,12.65,13.2,13.3,13.3,13.3,13.3,13.4,13.4,13.4,13.4,13.4,13.4,13.4,13.5,13.5,13.5,13.5,13.5,13.5,13.6,13.6,13.6,13.6,13.7,14.35,14.45,14.55,14.55,14.65,14.65,15.3,15.7],"spec_bat_임팩트":[3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.4,6.4,6.4,6.5,6.5,6.5,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7.1,7.1,7.1,7.2,7.2,7.3,7.6,7.7,7.9],"spec_pit_임팩트":[3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.65,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.9,8.9,9],"spec_bat_fa_임팩트":[5,5,5,5,5,5,5,5,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.2,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.3,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.4,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.5,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.6,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.7,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.3,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.4,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.5,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.6,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.7,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.8,9.9,9.9,9.9,9.9,9.9,9.9,9.9,10,10,10,10,10,10,10,10,10,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.1,10.2,10.2,10.2,10.2,10.2,10.3,10.3,10.3,10.4,10.4,10.4,10.5,10.5,10.6,10.6,10.6,10.7,10.7,10.7,10.8,10.8,10.9,10.9,10.9,11,11.1,11.1,11.2,11.4,11.6,11.8],"spec_pit_fa_임팩트":[5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.2,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,9.95,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.15,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.25,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,10.35,11,11,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.1,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.2,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.3,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.4,11.5,11.5,12.15,12.25,12.25,12.25,12.35,12.35,12.35,12.35,12.35,12.45,12.45,12.45,12.55,12.55,13.4,13.5],"spec_bat_국가대표":[3,3,3,3,3,3,3,3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.3,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.6,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,3.9,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.2,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.3,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.8,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,4.9,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.1,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.2,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.3,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.4,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.5,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.6,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.8,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,5.9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.1,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.2,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.3,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.4,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.5,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.1,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.2,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.3,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.4,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.5,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.6,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.7,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.8,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,7.9,8,8,8,8,8,8,8,8,8,8,8,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.1,8.2,8.2,8.2,8.2,8.2,8.2,8.3,8.3,8.3,8.3,8.3,8.3,8.4,8.4,8.4,8.4,8.4,8.5,8.5,8.5,8.5,8.6,8.6,8.6,8.6,8.7,8.7,8.7,8.7,8.7,8.8,8.8,8.8,8.8,8.9,8.9,8.9,9,9,9,9.1,9.1,9.1,9.2,9.2,9.2,9.3,9.4,9.5,9.6,9.7,9.8,9.9,10,10.2,10.6],"spec_pit_국가대표":[3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,3.45,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.5,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,4.6,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.55,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.65,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,5.75,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.6,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.7,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.8,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,6.9,7.65,7.65,7.65,7.65,7.65,7.65,7.65,7.65,7.65,7.65,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.75,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.85,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,7.95,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.05,8.7,8.7,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.8,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,8.9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.1,9.2,9.2,9.75,9.85,9.85,9.95,9.95,9.95,9.95,9.95,9.95,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.05,10.15,10.15,10.15,10.15,10.15,10.25,10.25,10.25,11,11,11.1,11.2,11.2,11.3,12.15]};

/* 시뮬레이션 결과(오름차순 정렬된 대용량 배열)를 N개 분위수 포인트로 압축
   입력: 길이 5만 배열, 출력: 길이 1000 배열 (0.1% 단위) */
function compressDist(d, N) {
  N = N || 1000;
  var out = {};
  Object.keys(d).forEach(function(key){
    var arr = d[key];
    if (!Array.isArray(arr) || arr.length === 0) { out[key] = arr; return; }
    if (arr.length <= N) { out[key] = arr.slice(); return; } /* 이미 작으면 그대로 */
    var compressed = new Array(N);
    for (var i = 0; i < N; i++) {
      var idx = Math.floor(i * arr.length / N);
      compressed[i] = Math.round(arr[idx] * 100) / 100;
    }
    out[key] = compressed;
  });
  return out;
}

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

  /* 분포 로드/빌드
     forceBuild=true: 런타임에서 5만회 시뮬레이션 새로 실행 (관리자 "분포 빌드" 용)
     기본값: PREBUILT_DIST(하드코딩)를 사용. 비어있으면 런타임 빌드로 fallback */
  var buildAndSet = React.useCallback(async function(forceBuild) {
    setBuilding(true);
    await new Promise(function(r){ setTimeout(r, 50); });
    var d;
    if (!forceBuild && PREBUILT_DIST && Object.keys(PREBUILT_DIST).length > 0) {
      d = PREBUILT_DIST;                                /* 하드코딩 분포 사용 */
    } else {
      var raw = buildDist(skills, 50000);
      d = compressDist(raw, 1000);                      /* 5만 → 1000 포인트 압축 */
    }
    DIST_CACHE = d;
    setDist(d);
    setBuilding(false);
  }, [skills]);

  /* 분포 내보내기: 현재 skills로 5만회 시뮬레이션 → 1000 포인트 압축 → JSON 다운로드
     이 파일 내용을 PREBUILT_DIST에 하드코딩하면 모든 사용자가 즉시 사용 */
  var exportDist = React.useCallback(async function() {
    setBuilding(true);
    await new Promise(function(r){ setTimeout(r, 50); });
    var raw = buildDist(skills, 50000);
    var d = compressDist(raw, 1000);
    var json = JSON.stringify(d);
    try {
      var blob = new Blob([json], {type:"application/json"});
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "prebuilt_dist_" + new Date().toISOString().slice(0,10) + ".json";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch(e) {
      /* 다운로드 실패 시 콘솔 출력 (수동 복사용) */
      try { console.log("PREBUILT_DIST JSON:", json); } catch(_) {}
      try { window.prompt("분포 JSON (복사해서 PREBUILT_DIST에 붙여넣기):", json); } catch(_) {}
    }
    setBuilding(false);
  }, [skills]);

  React.useEffect(function(){
    /* 1순위: 캐시 재사용 (탭 이동 후 재진입) */
    if (DIST_CACHE) { setDist(DIST_CACHE); return; }
    /* 2순위: 하드코딩된 PREBUILT_DIST 즉시 사용 (일반 사용자 기본 경로) */
    if (PREBUILT_DIST && Object.keys(PREBUILT_DIST).length > 0) {
      DIST_CACHE = PREBUILT_DIST;
      setDist(PREBUILT_DIST);
      return;
    }
    /* 3순위: PREBUILT_DIST 비어있음 → skills 로드 대기 후 런타임 빌드 (최초 개발 상태) */
    var hasSkills = skills && (
      (skills["타자"] && Object.keys(skills["타자"]).length > 0) ||
      (skills["선발"] && Object.keys(skills["선발"]).length > 0) ||
      (skills["중계"] && Object.keys(skills["중계"]).length > 0) ||
      (skills["마무리"] && Object.keys(skills["마무리"]).length > 0)
    );
    if (!hasSkills) return;
    buildAndSet();
  }, [skills]);

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
        <span style={{fontSize:13,fontWeight:800,color:barColor,minWidth:50,flexShrink:0,textAlign:"right"}}>
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
            <span style={{fontSize:14,fontWeight:800,color:"var(--t1)"}}>{pl.name}</span>
            <span style={{fontSize:11,color:"var(--td)",marginLeft:4}}>{slot}</span>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:4,width:"100%",minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:12,color:"var(--td)",width:36,flexShrink:0}}>스킬</span>
            <span style={{fontSize:12,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{skSc}</span>
            {pctBar(skPct, "#CE93D8")}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:12,color:"var(--td)",width:36,flexShrink:0}}>훈련</span>
            <span style={{fontSize:12,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{trSc.toFixed(1)}</span>
            {pctBar(trPct, "#42A5F5")}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8,width:"100%"}}>
            <span style={{fontSize:12,color:"var(--td)",width:36,flexShrink:0}}>특훈</span>
            <span style={{fontSize:12,color:"var(--t2)",fontFamily:"var(--m)",width:36,flexShrink:0}}>{spSc.toFixed(1)}</span>
            {spPct !== null ? pctBar(spPct) : <span style={{fontSize:12,color:"var(--td)"}}>{"해당없음"}</span>}
          </div>
        </div>
      </div>
    );
  };

  if (building) return (
    <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:40,textAlign:"center"}}>
      <div style={{fontSize:15,color:"var(--td)",marginBottom:8}}>{"분포 계산 중..."}</div>
      <div style={{fontSize:13,color:"var(--td)"}}>{"분포 데이터 로딩 중..."}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center",flexWrap:"wrap"}}>
        {["타자","투수"].map(function(r){ var a=r===role; return (
          <button key={r} onClick={function(){setRole(r);}} style={{padding:"6px 16px",fontSize:13,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{r}</button>
        );})}
        {p.isAdmin && (<React.Fragment>
          <button onClick={function(){buildAndSet(true);}} style={{marginLeft:"auto",padding:"5px 10px",fontSize:12,background:"var(--inner)",border:"1px solid var(--acc)",borderRadius:6,color:"var(--acc)",cursor:"pointer"}} title="5만회 시뮬레이션 실행 후 현재 세션에만 적용 (하드코딩은 아래 내보내기)">{"🔄 분포 재빌드"}</button>
          <button onClick={function(){exportDist();}} style={{padding:"5px 10px",fontSize:12,background:"var(--inner)",border:"1px solid var(--acc)",borderRadius:6,color:"var(--acc)",cursor:"pointer"}} title="5만회 시뮬레이션 → 1000포인트 압축 → JSON 다운로드 (PREBUILT_DIST에 붙여넣기)">{"📤 분포 내보내기"}</button>
        </React.Fragment>)}
      </div>
      {p.isAdmin && (
        <div style={{padding:"6px 10px",background:"var(--inner)",borderRadius:6,fontSize:11,color:"var(--td)",marginBottom:10,lineHeight:1.5}}>
          {"👑 관리자 도구 — "}
          {PREBUILT_DIST && Object.keys(PREBUILT_DIST).length > 0
            ? <span style={{color:"#66BB6A"}}>{"✓ 하드코딩 분포 사용 중 ("+Object.keys(PREBUILT_DIST).length+"개 키)"}</span>
            : <span style={{color:"#FF9800"}}>{"⚠ PREBUILT_DIST 비어있음 → 런타임 빌드 중. 내보내기 후 소스에 하드코딩하세요"}</span>}
        </div>
      )}

      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",overflow:"hidden",marginBottom:6}}>
        <div style={{padding:"8px 12px",background:"var(--inner)",borderBottom:"1px solid var(--bd)",display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:14,fontWeight:800,color:"var(--t1)"}}>{role==="타자"?"⚾ 타자 라인업":"⚾ 투수 라인업"}</span>
          <span style={{fontSize:12,color:"var(--td)"}}>{"("+( role==="타자"?batPlayers.length:pitPlayers.length)+"명)"}</span>
        </div>
        {(role==="타자"?batPlayers:pitPlayers).length === 0 ? (
          <div style={{padding:24,textAlign:"center",fontSize:13,color:"var(--td)"}}>{"라인업에 등록된 선수가 없습니다"}</div>
        ) : (role==="타자"?batPlayers:pitPlayers).map(function(x){ return renderRow(x.slot, x.pl, role==="타자"); })}
      </div>

      <div style={{padding:"8px 12px",background:"var(--inner)",borderRadius:8,fontSize:12,color:"var(--td)"}}>
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
      var originalSrc = ev.target.result;
      /* Canvas로 리사이즈 + JPEG 압축 (최대 1280px, 품질 0.92) */
      var img = new Image();
      img.onload = function() {
        var maxW = 1280;
        var w = img.width; var h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var compressed = canvas.toDataURL('image/jpeg', 0.92);
        setImg({ base64: compressed.split(",")[1], mediaType: 'image/jpeg', preview: compressed });
        setScanResult(null); setSlots([]); setSlotsB([]); setMode(null); setErr("");
      };
      img.onerror = function() {
        setErr('이미지 로드 실패');
      };
      img.src = originalSrc;
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
      React.createElement("div", {style:{fontSize:13,fontWeight:700,color:color,marginBottom:8,textAlign:"center"}}, label),
      slotList.map(function(s, i) {
        var score = Math.round(skillScore(s.selected, s.lv) * 100) / 100;
        var hasMulti = s.candidates.length > 1;
        return React.createElement("div", {key:i, style:{background:"var(--inner)",borderRadius:8,padding:"8px 10px",marginBottom:6,border:"1px solid "+(hasMulti?"rgba(251,191,36,0.4)":"var(--bd)")}},
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
            React.createElement("span", {style:{fontSize:12,fontWeight:800,color:"#FFD54F",width:16,textAlign:"center"}}, i+1),
            React.createElement("span", {style:{fontSize:13,color:"var(--td)"}}, s.rawName),
            hasMulti && React.createElement("span", {style:{fontSize:11,color:"#FBBF24",marginLeft:"auto"}}, "⚠️ 선택 필요")
          ),
          s.candidates.length > 1
            ? React.createElement("select", {
                value: s.selected,
                onChange: function(e){ updateSlot(slotList, setSlotList, i, "selected", e.target.value); },
                style:{width:"100%",padding:"4px 6px",fontSize:13,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#e2e8f0",marginBottom:4}
              },
              s.candidates.map(function(c){ return React.createElement("option",{key:c,value:c},c); })
            )
            : s.selected
              ? React.createElement("div", {style:{fontSize:14,fontWeight:700,color:"var(--t1)",padding:"2px 0"}}, s.selected)
              : React.createElement("div", {style:{fontSize:13,color:"#EF4444"}}, "❌ 스킬 미매칭: " + s.rawName),
          React.createElement("div", {style:{display:"flex",alignItems:"center",gap:6,marginTop:4}},
            React.createElement("select", {
              value: s.lv,
              onChange: function(e){ updateSlot(slotList, setSlotList, i, "lv", parseInt(e.target.value)); },
              style:{width:60,padding:"3px 4px",fontSize:13,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#4FC3F7",fontWeight:700}
            },
              [5,6,7,8,9,10].map(function(v){ return React.createElement("option",{key:v,value:v},"Lv"+v); })
            ),
            React.createElement("span", {style:{fontSize:14,fontWeight:800,color:"#FFD54F",marginLeft:"auto",fontFamily:"var(--m)"}}, score)
          )
        );
      }),
      slotList.length > 0 && React.createElement("div", {
        style:{textAlign:"center",fontSize:15,fontWeight:900,color:color,fontFamily:"var(--m)",padding:"8px 0",borderTop:"1px solid var(--bd)",marginTop:4}
      }, "합계 " + Math.round(totalScore(slotList)*100)/100)
    );
  };

  return React.createElement("div", {style:{display:"flex",flexDirection:"column",gap:10}},
    /* 포지션 선택 */
    React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}, "포지션 선택"),
      React.createElement("div", {style:{display:"flex",gap:6,flexWrap:"wrap"}},
        POS_TYPES_PS.map(function(pt) {
          var a = localPos === pt;
          return React.createElement("button", {
            key: pt,
            onClick: function() {
              setLocalPos(pt);
              setSlots([]); setSlotsB([]); setScanResult(null); setMode(null); setErr("");
            },
            style: {padding:"7px 18px",fontSize:14,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}
          }, pt);
        })
      )
    ),
    /* 이미지 업로드 */
    React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}, "📸 스킬 화면 사진 업로드"),
      React.createElement("div", {style:{fontSize:12,color:"var(--td)",marginBottom:10,lineHeight:1.5}},
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
                React.createElement("div", {style:{fontSize:14,color:"var(--td)"}}, "사진을 클릭하여 업로드")
              )
        ),
        React.createElement("input", {type:"file",accept:"image/*",onChange:onImgChange,style:{display:"none"}})
      ),
      img && React.createElement("div", {style:{display:"flex",gap:8,marginTop:10}},
        React.createElement("button", {
          onClick: runScan,
          disabled: scanning,
          style:{flex:1,padding:"10px",fontSize:14,fontWeight:800,background:scanning?"var(--inner)":"linear-gradient(135deg,#667eea,#764ba2)",border:"none",borderRadius:8,color:scanning?"var(--td)":"#fff",cursor:scanning?"not-allowed":"pointer"}
        }, scanning ? "🔍 판독 중..." : "🔍 스킬 판독"),
        React.createElement("button", {
          onClick:function(){setImg(null);setScanResult(null);setSlots([]);setSlotsB([]);setMode(null);setErr("");},
          style:{padding:"10px 14px",fontSize:14,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t2)",cursor:"pointer"}
        }, "✕")
      )
    ),

    /* 에러 */
    err && React.createElement("div", {style:{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"10px 14px",fontSize:14,color:"#fca5a5"}}, "⚠️ " + err),

    /* 결과 - single 모드 */
    mode === "single" && slots.length > 0 && React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:14,fontWeight:800,color:"var(--t1)",marginBottom:10}}, "📊 스킬 분석 결과"),
      renderSlots(slots, setSlots, "스킬 조합", "#FFD54F"),
      React.createElement("button", {
        onClick: function(){
          if (onApply) onApply(slots.map(function(s){return {name:s.selected,lv:s.lv};}));
        },
        disabled: slots.some(function(s){return !s.selected;}),
        style:{width:"100%",marginTop:10,padding:"10px",fontSize:14,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",border:"none",borderRadius:8,color:"#1a1100",cursor:"pointer",opacity:slots.some(function(s){return !s.selected;})? 0.5:1}
      }, "✅ 스킬계산기에 적용")
    ),

    /* 결과 - compare 모드 */
    mode === "compare" && slots.length > 0 && React.createElement("div", {style:{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}},
      React.createElement("div", {style:{fontSize:14,fontWeight:800,color:"var(--t1)",marginBottom:12}}, "⚖️ 스킬 비교 결과"),
      /* 승패 배너 */
      React.createElement("div", {style:{
        textAlign:"center",padding:"10px",borderRadius:8,marginBottom:12,
        background: scoreA > scoreB ? "rgba(74,222,128,0.1)" : scoreB > scoreA ? "rgba(251,191,36,0.1)" : "rgba(148,163,184,0.1)",
        border: "1px solid " + (scoreA > scoreB ? "#4ade80" : scoreB > scoreA ? "#FBBF24" : "#94a3b8")
      }},
        React.createElement("div", {style:{fontSize:16,fontWeight:900,color: scoreA > scoreB ? "#4ade80" : scoreB > scoreA ? "#FBBF24" : "var(--td)"}},
          scoreA > scoreB ? "✅ 기존 스킬 유지 추천" : scoreB > scoreA ? "🔄 스킬 변경 추천" : "🤝 동점"
        ),
        React.createElement("div", {style:{fontSize:13,color:"var(--td)",marginTop:2}},
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
          return (<button key={t.id} onClick={function(){setScTab(t.id);}} style={{flex:1,padding:"9px",fontSize:14,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:8,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{t.label}</button>);
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
        <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"카드 종류"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {CARD_TYPES_SC.map(function(ct){
            var a=cardType===ct;
            return (<button key={ct} onClick={function(){onCardChange(ct);}} style={{padding:"5px 10px",fontSize:12,fontWeight:a?800:500,background:a?"rgba("+([212,175,55].join(","))+",0.15)":"var(--inner)",border:"1px solid "+(a?cardColor[ct]:"var(--bd)"),borderRadius:6,color:a?cardColor[ct]:"var(--t2)",cursor:"pointer"}}>{ct}</button>);
          })}
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"포지션"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {POS_TYPES.map(function(pt){
            var a=pos===pt;
            return (<button key={pt} onClick={function(){setPos(pt);setSks(function(prev){return prev.map(function(s){return Object.assign({},s,{name:""});});});setResult(null);}} style={{padding:"5px 14px",fontSize:13,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{pt}</button>);
          })}
        </div>
      </div>

      {/* 스킬 입력 */}
      <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
        <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:10}}>{"스킬 입력"+(majorSkills.length===0?" (⚠️ 스킬관리에서 ★메이저 스킬을 설정해주세요)":"")}</div>
        {sks.map(function(sk,i){
          var lvs = DEFAULT_LV[cardType]||[6,5,5];
          var isLocked = cardType==="임팩트"&&i===0;
          return (
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{width:20,height:20,borderRadius:"50%",background:"rgba(255,213,79,0.15)",border:"1px solid rgba(255,213,79,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#FFD54F",flexShrink:0}}>{i+1}</div>
              {isLocked && <span style={{fontSize:11,color:"#66BB6A",flexShrink:0}}>{"🔒고정"}</span>}
              <div style={{flex:1,minWidth:0}}>
                <SkillPicker
                  value={sk.name}
                  options={allSkillNames}
                  majorOptions={majorSkills}
                  width="100%"
                  fontSize={13}
                  onChange={function(v){setSks(function(prev){var n=prev.slice();n[i]=Object.assign({},n[i],{name:v});return n;});setResult(null);}}
                />
              </div>
              <select value={sk.lv} onChange={function(e){setSks(function(prev){var n=prev.slice();n[i]=Object.assign({},n[i],{lv:parseInt(e.target.value)});return n;});setResult(null);}}
                style={{width:52,padding:"5px 4px",fontSize:13,background:"#1e293b",border:"1px solid #334155",borderRadius:6,color:"#4FC3F7",fontWeight:700,outline:"none",textAlign:"center"}}>
                {[5,6,7,8,9,10].map(function(v){return(<option key={v} value={v}>{"Lv"+v}</option>);})}
              </select>
              <span style={{fontSize:13,fontFamily:"var(--m)",fontWeight:700,color:"#FFD54F",minWidth:36,textAlign:"right"}}>{Math.round(skillScore(sk.name,sk.lv)*100)/100}</span>
            </div>
          );
        })}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,paddingTop:10,borderTop:"1px solid var(--bd)"}}>
          <span style={{fontSize:15,fontWeight:800,color:"var(--t1)"}}>{"합계 점수: "}<span style={{color:"var(--acc)",fontFamily:"var(--m)"}}>{Math.round(myScore*100)/100}</span></span>
          <button onClick={runSim} disabled={running||allSkillNames.length<3} style={{padding:"8px 20px",fontSize:14,fontWeight:800,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",border:"none",borderRadius:8,color:"#1a1100",cursor:"pointer",opacity:running?0.6:1}}>
            {running?"시뮬레이션 중...":"🎯 확률 계산"}
          </button>
        </div>
      </div>

      {/* 결과 */}
      {result && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:15,color:"var(--td)",marginBottom:4}}>{"내 스킬 점수: "}<span style={{fontWeight:800,color:"var(--t1)",fontFamily:"var(--m)"}}>{result.myScore}</span>{" / 중간값: "}<span style={{fontWeight:700,color:"var(--td)",fontFamily:"var(--m)"}}>{result.avg}</span></div>
            <div style={{fontSize:28,fontWeight:900,color:result.pct<=10?"#4ade80":result.pct<=30?"#FFD54F":"var(--t1)",fontFamily:"var(--h)"}}>{"상위 "+result.pct+"%"}</div>
            <div style={{fontSize:13,color:"var(--td)"}}>{"(10만회 시뮬레이션 기준)"}</div>
          </div>
          {/* 히스토그램 */}
          <div style={{display:"flex",alignItems:"flex-end",gap:2,height:80,marginTop:8}}>
            {result.hist.map(function(bin,i){
              var isMe = result.myScore>=bin.lo&&result.myScore<bin.hi;
              var maxPct = Math.max.apply(null,result.hist.map(function(b){return b.pct;}));
              var h = maxPct>0?(bin.pct/maxPct*100):0;
              return (<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <div style={{width:"100%",height:h+"%",background:isMe?"var(--acc)":"var(--bar)",borderRadius:"2px 2px 0 0",minHeight:isMe?4:1,transition:"height 0.3s"}}/>
              </div>);
            })}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--td)",marginTop:2}}>
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
        <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"카드 종류"}</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {CARD_TYPES_TR.map(function(ct){
            var a=cardType===ct;
            return (<button key={ct} onClick={function(){setCardType(ct);setResult(null);}} style={{padding:"5px 10px",fontSize:12,fontWeight:a?800:500,background:"var(--inner)",border:"1px solid "+(a?cardColor[ct]:"var(--bd)"),borderRadius:6,color:a?cardColor[ct]:"var(--t2)",cursor:"pointer"}}>{ct+(ct==="국가대표"?" (60pt)":ct==="임팩트"?" (54pt)":" (75pt)")}</button>);
          })}
        </div>
        <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:8}}>{"포지션"}</div>
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["타자","투수"].map(function(pt){
            var a=pos===pt;
            return (<button key={pt} onClick={function(){setPos(pt);setResult(null);}} style={{padding:"5px 14px",fontSize:13,fontWeight:a?800:500,background:a?"var(--ta)":"var(--inner)",border:a?"1px solid var(--acc)":"1px solid var(--bd)",borderRadius:6,color:a?"var(--acc)":"var(--t2)",cursor:"pointer"}}>{pt}</button>);
          })}
        </div>
        <div style={{padding:"10px 12px",background:"var(--inner)",borderRadius:8,marginBottom:12,fontSize:13,color:"var(--td)"}}>
          <div style={{fontWeight:700,color:"var(--t1)",marginBottom:4}}>{"📋 시뮬레이션 조건"}</div>
          <div>{"• 훈련 포인트: "}<span style={{color:"var(--acc)",fontWeight:700}}>{totalPts}{"pt"}</span></div>
          <div>{"• 고정 능력치: "}<span style={{color:"#EF5350",fontWeight:700}}>{fixStats.join(", ")}</span>{" (최저값 배치)"}</div>
          <div>{"• 재배치 능력치: "}<span style={{color:"#66BB6A",fontWeight:700}}>{freeStats.join(", ")}</span></div>
          <div>{"• 점수 계산: "+(isBat?"파워×"+w.p+" + 정확×"+w.a+" + 선구×"+w.e:"변화×"+w.c+" + 구위×"+w.s)}</div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:13,fontWeight:700,color:"var(--td)",marginBottom:4}}>{"내 훈재분 수치 입력 (선택사항)"}</div>
          <div style={{fontSize:11,color:"var(--td)",marginBottom:8}}>{isBat?"파워/정확/선구만 입력하면 됩니다":"변화/구위만 입력하면 됩니다"}</div>
          <div style={{display:"flex",gap:10}}>
            {(isBat?["파워","정확","선구"]:["변화","구위"]).map(function(s){
              var clr = isBat?(s==="파워"?"#EF5350":s==="정확"?"#42A5F5":"#66BB6A"):(s==="변화"?"#AB47BC":"#FF7043");
              return (<div key={s} style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:12,fontWeight:700,color:clr,marginBottom:4}}>{s}</div>
                <input type="number" min="0" max="75" value={myDist[s]||""} placeholder="0"
                  onChange={function(e){var v=parseInt(e.target.value)||0;setMyDist(function(prev){var n=Object.assign({},prev);n[s]=v;return n;});setResult(null);}}
                  style={{width:"100%",padding:"6px 4px",textAlign:"center",background:"#1e293b",border:"1px solid "+clr+"55",borderRadius:6,color:clr,fontSize:16,fontFamily:"var(--m)",fontWeight:800,outline:"none",boxSizing:"border-box"}} />
              </div>);
            })}
          </div>
        </div>
        <button onClick={runSim} disabled={running} style={{width:"100%",padding:"10px",fontSize:15,fontWeight:800,background:"linear-gradient(135deg,#66BB6A,#43A047)",border:"none",borderRadius:8,color:"#fff",cursor:"pointer",opacity:running?0.6:1}}>
          {running?"시뮬레이션 중... (10만회)":"🏋️ 훈재분 계산"}
        </button>
      </div>

      {result && (
        <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:14}}>
          <div style={{fontSize:15,fontWeight:800,color:"var(--t1)",marginBottom:12}}>{"📈 시뮬레이션 결과 (10만회)"}</div>
          {result.myPct !== null && (
            <div style={{background:"rgba(255,213,79,0.08)",border:"1px solid rgba(255,213,79,0.3)",borderRadius:10,padding:"12px 16px",marginBottom:12,textAlign:"center"}}>
              <div style={{fontSize:13,color:"var(--td)",marginBottom:4}}>{"내 훈재분 점수: "}<span style={{fontWeight:800,color:"var(--t1)",fontFamily:"var(--m)"}}>{result.mySc}</span></div>
              <div style={{fontSize:26,fontWeight:900,color:result.myPct<=1?"#4ade80":result.myPct<=10?"#FFD54F":"var(--t1)",fontFamily:"var(--h)"}}>{"상위 "+result.myPct+"%"}</div>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[{label:"중간값 (50%)",val:result.med,color:"var(--td)"},{label:"상위 10%",val:result.top10,color:"#FFD54F"},{label:"상위 1%",val:result.top1,color:"#4ade80"}].map(function(item){
              return (<div key={item.label} style={{background:"var(--inner)",borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:11,color:"var(--td)",marginBottom:4}}>{item.label}</div>
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
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--td)",marginTop:4}}>
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
    <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>{"📢"}</div><h3 style={{fontSize:15,fontWeight:700,color:"var(--t1)",margin:"0 0 6px"}}>{"추후 업데이트 예정"}</h3><p style={{fontSize:14,color:"var(--td)",margin:0}}>{"새로운 기능이 준비되면 이 페이지에서 안내드리겠습니다."}</p></div>
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

  /* ── 테마 (다크/라이트) ── */
  var _th=useState(function(){ try{return localStorage.getItem("deck-theme")||"dark";}catch(e){return"dark";} });
  var theme=_th[0];var setTheme=_th[1];
  var toggleTheme=function(){
    var next=theme==="dark"?"light":"dark";
    setTheme(next);
    try{localStorage.setItem("deck-theme",next);}catch(e){}
  };

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
    .light{--bg:#f8fafc;--side:#eef2f7;--card:rgba(255,255,255,0.98);--inner:rgba(0,0,0,0.025);--bd:rgba(0,0,0,0.10);--re:rgba(0,0,0,0.02);--bar:rgba(0,0,0,0.07);--ta:rgba(180,83,9,0.08);--t1:#1e293b;--t2:#475569;--td:rgba(0,0,0,0.45);--acc:#b45309;--acp:#7c3aed;}\
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}html{-webkit-text-size-adjust:100%;}body{margin:0;font-family:'Noto Sans KR',sans-serif;background:var(--bg);overflow-x:hidden;-webkit-font-smoothing:antialiased;}\
    ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}\
    .light ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.15);}\
    .light body{background:#f8fafc;}\
    .light select{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 8L1 3h10z'/%3E%3C/svg%3E\");}\
    .light input,.light select,.light textarea{color:var(--t1);background:var(--card);border-color:var(--bd);}\
    .light input::placeholder{color:var(--td);}\
    select{-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b949e' d='M6 8L1 3h10z'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 8px center;padding-right:24px;}\
    input[type=number]{-moz-appearance:textfield;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}\
  "}</style>);

  if(!authChecked)return(<div className={theme==="light"?"light":""} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)"}}><div>{"⚾ 인증 확인중..."}</div>{CSS}</div>);
  if(!li)return(<div className={theme==="light"?"light":""}><LoginPage onLogin={function(u,type,adm){setUser(u);setAuthType(type||"dev");setAdmin(adm||false);if(!userId)setUserId("guest_"+Date.now());setLi(true);}}/>{CSS}</div>);

  /* ── 팀 선택 화면 ── */
  if(showTeamSelect){
    var isFirst=showTeamSelect==="first";
    return(
      <div className={theme==="light"?"light":""} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)",padding:20}}>
        <div style={{background:"var(--card)",borderRadius:16,border:"1px solid var(--bd)",padding:mob?24:40,maxWidth:420,width:"100%",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:12}}>{"⚾"}</div>
          <h2 style={{margin:"0 0 6px",fontSize:22,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--acc)"}}>{isFirst?"팀 선택":"덱 추가"}</h2>
          <p style={{margin:"0 0 6px",fontSize:14,color:"var(--td)"}}>{isFirst?"덱 매니저에서 사용할 팀을 선택하세요":"추가할 팀을 선택하세요"}</p>
          <p style={{margin:"0 0 18px",fontSize:12,color:"var(--td)"}}>{isFirst?"팀 선택은 덱 저장 이름입니다. 선수 팀 정보와는 무관합니다":decks.length+"/5 덱 사용 중"}</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {KBO_TEAMS.map(function(t){return(
              <button key={t} onClick={function(){handleSelectTeam(t);}}
                style={{padding:"14px 0",fontSize:16,fontWeight:800,fontFamily:"var(--h)",letterSpacing:2,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:8,color:"var(--t1)",cursor:"pointer"}}
                onMouseEnter={function(e){e.currentTarget.style.background="var(--ta)";e.currentTarget.style.borderColor="var(--acc)";e.currentTarget.style.color="var(--acc)";}}
                onMouseLeave={function(e){e.currentTarget.style.background="var(--inner)";e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.color="var(--t1)";}}>
                {t}
              </button>
            );})}
          </div>
          {!isFirst&&(<button onClick={function(){setShowTeamSelect(false);}} style={{marginTop:14,padding:"8px 20px",fontSize:13,background:"transparent",border:"1px solid var(--bd)",borderRadius:8,color:"var(--td)",cursor:"pointer"}}>{"취소"}</button>)}
        </div>
        {CSS}
      </div>
    );
  }

  if(store.loading||!curDeckId)return(<div className={theme==="light"?"light":""} style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)"}}><div>{"⚾ 로딩중..."}</div>{CSS}</div>);

  var pg=null;
  if(tab==="lineup")pg=(<LineupPage mobile={mob} tablet={tbl} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} skills={store.skills} decks={decks} curDeckId={curDeckId} onSwitchDeck={handleSwitchDeck} onAddDeck={function(){setShowTeamSelect("add");}} onDeleteDeck={handleDeleteDeck} userId={userId}/>);
  else if(tab==="myplayers")pg=(<MyPlayersPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} skills={store.skills} userId={userId}/>);
  else if(tab==="postrain")pg=(<PosTrainPage mobile={mob} sdState={sdState} setSdState={setSdState}/>);
  else if(tab==="locker")pg=(<LockerRoomPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} saveSdState={store.saveSdState} skills={store.skills} saveSkills={store.saveSkills} potmList={store.potmList} setPotmList={store.savePotmList} isAdmin={isAdmin}/>);
  else if(tab==="db"&&isAdmin)pg=(<PlayerDBPage mobile={mob} players={store.players} savePlayers={store.savePlayers}/>);
  else if(tab==="skills"&&isAdmin)pg=(<SkillManagePage mobile={mob} skills={store.skills} saveSkills={store.saveSkills}/>);
  else if(tab==="enhance"&&isAdmin)pg=(<EnhancePage mobile={mob}/>);
  else if(tab==="datacenter")pg=(<DataCenterPage mobile={mob} skills={store.skills} players={store.players} lineupMap={store.lineupMap} isAdmin={isAdmin}/>);
  else if(tab==="clublounge")pg=(<ClubLoungePage mobile={mob}/>);
  else pg=(<DataCenterPage mobile={mob} skills={store.skills} players={store.players} lineupMap={store.lineupMap} isAdmin={isAdmin}/>);

  return(
    <div className={theme==="light"?"light":""} style={{display:"flex",minHeight:"100vh",background:"var(--bg)",color:"var(--t1)"}}>
      <Nav tab={tab} setTab={setTab} user={user} authType={authType} logout={lo} mobile={mob} tablet={tbl} isAdmin={isAdmin}
        decks={decks} curDeckId={curDeckId}
        onSwitchDeck={handleSwitchDeck}
        onAddDeck={function(){setShowTeamSelect("add");}}
        onDeleteDeck={handleDeleteDeck}
        theme={theme} toggleTheme={toggleTheme}/>
      <div style={{flex:1,overflowY:"auto",minHeight:"100vh",paddingTop:mob?44:(tbl?50:0)}}>{pg}</div>
      {CSS}
    </div>
  );
}
