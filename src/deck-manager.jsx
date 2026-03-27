import React, { useState, useEffect, useCallback } from "react";
import { supabase, signInWithGoogle, signOut, getSession, getProfile, loadUserData, saveUserData, loadGlobalSkills, saveGlobalSkills } from "./supabase.js";

/* ================================================================
   SEED DATA - 48 players from Excel + random fills
   ================================================================ */
var SEED_PLAYERS = [
  // 타자 (9명)
  {id:"b1",team:"삼성",cardType:"골든글러브",name:"구자욱24",year:"2024",hand:"좌",stars:5,subPosition:"LF",role:"타자",power:79,accuracy:80,eye:74,specPower:4,specAccuracy:1,specEye:2,trainP:16,trainA:18,trainE:11,enhance:"4각성",skill1:"베스트포지션",s1Lv:6,skill2:"정밀타격",s2Lv:7,skill3:"수비안정성(타순O)",s3Lv:6,pot1:"",pot2:""},
  {id:"b2",team:"삼성",cardType:"골든글러브",name:"김도영24",year:"2024",hand:"우",stars:5,subPosition:"3B",role:"타자",power:81,accuracy:82,eye:70,specPower:5,specAccuracy:2,specEye:1,trainP:17,trainA:21,trainE:11,enhance:"3각성",skill1:"저니맨",s1Lv:7,skill2:"빅게임헌터",s2Lv:6,skill3:"컨택트히터(타순O)",s3Lv:6,pot1:"",pot2:""},
  {id:"b3",team:"삼성",cardType:"골든글러브",name:"이승엽99",year:"1999",hand:"좌",stars:5,subPosition:"1B",role:"타자",power:90,accuracy:76,eye:68,specPower:3,specAccuracy:0,specEye:3,trainP:20,trainA:18,trainE:9,enhance:"6각성",skill1:"정밀타격",s1Lv:6,skill2:"빅게임헌터",s2Lv:6,skill3:"직구킬러",s3Lv:7,pot1:"",pot2:""},
  {id:"b4",team:"키움",cardType:"골든글러브",name:"로하스20",year:"2020",hand:"양",stars:5,subPosition:"RF",role:"타자",power:86,accuracy:82,eye:68,specPower:4,specAccuracy:1,specEye:2,trainP:22,trainA:11,trainE:9,enhance:"7각성",skill1:"저니맨",s1Lv:6,skill2:"좌완킬러",s2Lv:7,skill3:"정밀타격",s3Lv:6,pot1:"",pot2:""},
  {id:"b5",team:"키움",cardType:"시그니처",name:"송성문24",year:"2024",hand:"좌",stars:5,subPosition:"DH",role:"타자",power:70,accuracy:80,eye:74,specPower:5,specAccuracy:6,specEye:4,trainP:20,trainA:14,trainE:12,enhance:"9각성",skill1:"정밀타격",s1Lv:7,skill2:"역전의명수",s2Lv:6,skill3:"오버페이스",s3Lv:5,pot1:"",pot2:""},
  {id:"b6",team:"키움",cardType:"국가대표",name:"강정호14",year:"2014",hand:"우",stars:5,subPosition:"SS",role:"타자",power:84,accuracy:79,eye:65,specPower:8,specAccuracy:1,specEye:2,trainP:17,trainA:17,trainE:7,enhance:"9각성",skill1:"홈어드밴티지",s1Lv:6,skill2:"황금세대",s2Lv:5,skill3:"배팅머신",s3Lv:6,pot1:"",pot2:""},
  {id:"b7",team:"키움",cardType:"시그니처",name:"이정후22",year:"2022",hand:"좌",stars:5,subPosition:"CF",role:"타자",power:73,accuracy:82,eye:90,specPower:5,specAccuracy:1,specEye:1,trainP:15,trainA:20,trainE:13,enhance:"9각성",skill1:"홈어드밴티지",s1Lv:6,skill2:"오버페이스",s2Lv:5,skill3:"공포의하위타선(타순O)",s3Lv:5,pot1:"",pot2:""},
  {id:"b8",team:"키움",cardType:"시그니처",name:"김혜성24",year:"2024",hand:"좌",stars:5,subPosition:"2B",role:"타자",power:64,accuracy:77,eye:76,specPower:2,specAccuracy:2,specEye:0,trainP:18,trainA:18,trainE:11,enhance:"9각성",skill1:"공포의하위타선(타순O)",s1Lv:6,skill2:"역전의명수",s2Lv:5,skill3:"정밀타격",s3Lv:5,pot1:"",pot2:""},
  {id:"b9",team:"키움",cardType:"임팩트",name:"박경완",year:"",impactType:"안방마님",hand:"우",stars:4,subPosition:"C",role:"타자",power:85,accuracy:78,eye:62,specPower:5,specAccuracy:0,specEye:2,trainP:11,trainA:16,trainE:6,enhance:"9각성",skill1:"저니맨",s1Lv:7,skill2:"결정적한방",s2Lv:5,skill3:"포수리드",s3Lv:5,pot1:"",pot2:""},
  // 선발 (5명)
  {id:"sp1",team:"키움",cardType:"시그니처",name:"요키시22",year:"2022",hand:"좌",stars:5,subPosition:"SP1",role:"투수",position:"선발",change:68,stuff:74,specChange:2,specStuff:6,trainC:16,trainS:19,enhance:"9각성",skill1:"좌승사자",s1Lv:6,skill2:"평정심",s2Lv:7,skill3:"긴급투입",s3Lv:5,pot1:"",pot2:""},
  {id:"sp2",team:"키움",cardType:"골든글러브",name:"안우진22",year:"2022",hand:"우",stars:5,subPosition:"SP2",role:"투수",position:"선발",change:84,stuff:77,specChange:2,specStuff:5,trainC:17,trainS:20,enhance:"7각성",skill1:"저니맨",s1Lv:6,skill2:"원투펀치(1,2선발)",s2Lv:7,skill3:"긴급투입",s3Lv:6,pot1:"",pot2:""},
  {id:"sp3",team:"키움",cardType:"시그니처",name:"김수경98",year:"1998",hand:"우",stars:5,subPosition:"SP3",role:"투수",position:"선발",change:77,stuff:72,specChange:1,specStuff:7,trainC:12,trainS:24,enhance:"9각성",skill1:"도전정신(5성)",s1Lv:7,skill2:"저니맨",s2Lv:5,skill3:"빅게임헌터",s3Lv:6,pot1:"",pot2:""},
  {id:"sp4",team:"키움",cardType:"임팩트",name:"최창호",year:"",impactType:"좌완에이스",hand:"좌",stars:4,subPosition:"SP4",role:"투수",position:"선발",change:82,stuff:83,specChange:4,specStuff:6,trainC:14,trainS:13,enhance:"9각성",skill1:"좌승사자",s1Lv:6,skill2:"리그탑플레이어",s2Lv:7,skill3:"평정심",s3Lv:7,pot1:"",pot2:""},
  {id:"sp5",team:"키움",cardType:"골든글러브",name:"페디23",year:"2023",hand:"우",stars:5,subPosition:"SP5",role:"투수",position:"선발",change:80,stuff:77,specChange:1,specStuff:5,trainC:15,trainS:21,enhance:"3각성",skill1:"파이어볼",s1Lv:6,skill2:"빅게임헌터",s2Lv:6,skill3:"필승카드",s3Lv:6,pot1:"",pot2:""},
  // 중계 (6명)
  {id:"rp1",team:"키움",cardType:"임팩트",name:"조웅천",year:"",impactType:"키플레이어",hand:"우",stars:4,subPosition:"RP1",role:"투수",position:"중계",change:73,stuff:75,specChange:3,specStuff:4,trainC:11,trainS:13,enhance:"9각성",weight:0.8,skill1:"마당쇠",s1Lv:6,skill2:"워크에식",s2Lv:5,skill3:"필승카드(필승조,셋업맨)",s3Lv:6,pot1:"",pot2:""},
  {id:"rp2",team:"키움",cardType:"시그니처",name:"신철인06",year:"2016",hand:"우",stars:5,subPosition:"RP2",role:"투수",position:"중계",change:69,stuff:69,specChange:2,specStuff:3,trainC:19,trainS:16,enhance:"9각성",weight:0.8,skill1:"전천후",s1Lv:6,skill2:"패기(시그)",s2Lv:5,skill3:"긴급투입",s3Lv:5,pot1:"",pot2:""},
  {id:"rp3",team:"키움",cardType:"임팩트",name:"신완근",year:"",impactType:"키플레이어",hand:"우",stars:4,subPosition:"RP3",role:"투수",position:"중계",change:70,stuff:74,specChange:2,specStuff:4,trainC:9,trainS:14,enhance:"9각성",weight:0.7,skill1:"마당쇠",s1Lv:6,skill2:"저니맨",s2Lv:5,skill3:"평정심",s3Lv:7,pot1:"",pot2:""},
  {id:"rp4",team:"키움",cardType:"시그니처",name:"한현희14",year:"2014",hand:"우",stars:5,subPosition:"RP4",role:"투수",position:"중계",change:66,stuff:65,specChange:2,specStuff:6,trainC:21,trainS:15,enhance:"9각성",weight:0.5,skill1:"마당쇠",s1Lv:6,skill2:"위기관리",s2Lv:5,skill3:"전천후",s3Lv:5,pot1:"",pot2:""},
  {id:"rp5",team:"키움",cardType:"임팩트",name:"이강철",year:"",impactType:"키플레이어",hand:"우",stars:4,subPosition:"RP5",role:"투수",position:"중계",change:68,stuff:72,specChange:1,specStuff:4,trainC:9,trainS:14,enhance:"9각성",weight:0.1,skill1:"마당쇠",s1Lv:6,skill2:"라이징스타(셋업맨/3,4,5중계)",s2Lv:5,skill3:"저니맨",s3Lv:5,pot1:"",pot2:""},
  {id:"rp6",team:"키움",cardType:"국가대표",name:"최지민23",year:"2023",hand:"좌",stars:5,subPosition:"RP6",role:"투수",position:"중계",change:60,stuff:66,specChange:0,specStuff:4,trainC:15,trainS:12,enhance:"10강",weight:0.1,skill1:"국대에이스",s1Lv:6,skill2:"위기관리",s2Lv:6,skill3:"투쟁심",s3Lv:5,pot1:"",pot2:""},
  // 마무리 (1명)
  {id:"cp1",team:"키움",cardType:"임팩트",name:"위재영",year:"",impactType:"키플레이어",hand:"우",stars:4,subPosition:"CP",role:"투수",position:"마무리",change:75,stuff:79,specChange:1,specStuff:4,trainC:10,trainS:14,enhance:"9각성",skill1:"마당쇠",s1Lv:6,skill2:"평정심",s2Lv:6,skill3:"저니맨",s3Lv:5,pot1:"",pot2:""},
  // 추가 도감 선수 (다양한 카드타입)
  {id:"ex1",team:"두산",cardType:"골든글러브",name:"양의지18",year:"2018",hand:"우",stars:5,subPosition:"C",role:"타자",power:73,accuracy:81,eye:80},
  {id:"ex2",team:"두산",cardType:"골든글러브",name:"김재환18",year:"2018",hand:"우",stars:5,subPosition:"RF",role:"타자",power:84,accuracy:79,eye:66},
  {id:"ex3",team:"KIA",cardType:"골든글러브",name:"최형우16",year:"2016",hand:"좌",stars:5,subPosition:"LF",role:"타자",power:79,accuracy:87,eye:76},
  {id:"ex4",team:"LG",cardType:"시그니처",name:"서건창16",year:"2016",hand:"좌",stars:5,subPosition:"2B",role:"타자",power:60,accuracy:76,eye:78},
  {id:"ex5",team:"한화",cardType:"국가대표",name:"김재환18",year:"2018",hand:"우",stars:5,subPosition:"DH",role:"타자",power:82,accuracy:77,eye:64},
  {id:"ex6",team:"삼성",cardType:"라이브",name:"이병헌25",year:"2025",hand:"우",stars:3,subPosition:"RP1",role:"투수",position:"중계",change:56,stuff:58,setScore:2},
  {id:"ex7",team:"KIA",cardType:"골든글러브",name:"린드블럼19",year:"2019",hand:"좌",stars:5,subPosition:"SP1",role:"투수",position:"선발",change:74,stuff:75},
  {id:"ex8",team:"두산",cardType:"임팩트",name:"선동열",year:"",impactType:"좌완에이스",hand:"좌",stars:4,subPosition:"SP2",role:"투수",position:"선발",change:82,stuff:80},
  {id:"ex9",team:"NC",cardType:"시그니처",name:"김민성16",year:"2016",hand:"우",stars:5,subPosition:"3B",role:"타자",power:68,accuracy:73,eye:70},
  {id:"ex10",team:"SSG",cardType:"국가대표",name:"박병호15",year:"2015",hand:"우",stars:5,subPosition:"1B",role:"타자",power:87,accuracy:79,eye:62},
  {id:"ex11",team:"키움",cardType:"시즌",name:"김동현25",year:"2025",hand:"우",stars:4,subPosition:"RP2",role:"투수",position:"중계",change:55,stuff:56},
  {id:"ex12",team:"롯데",cardType:"올스타",name:"전준우18",year:"2018",hand:"우",stars:5,subPosition:"RF",role:"타자",power:77,accuracy:81,eye:75},
  {id:"ex13",team:"KIA",cardType:"골든글러브",name:"폰세25",year:"2025",hand:"우",stars:5,subPosition:"SP3",role:"투수",position:"선발",change:89,stuff:78},
  {id:"ex14",team:"삼성",cardType:"임팩트",name:"김상진",year:"",impactType:"키플레이어",hand:"우",stars:4,subPosition:"SP4",role:"투수",position:"선발",change:76,stuff:77},
  {id:"ex15",team:"두산",cardType:"국가대표",name:"오승환06",year:"2006",hand:"우",stars:5,subPosition:"CP",role:"투수",position:"마무리",change:76,stuff:73},
];

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

var SEED_LINEUP = {"C":"b9","1B":"b3","2B":"b8","3B":"b2","SS":"b6","LF":"b1","CF":"b7","RF":"b4","DH":"b5","SP1":"sp1","SP2":"sp2","SP3":"sp3","SP4":"sp4","SP5":"sp5","RP1":"rp1","RP2":"rp2","RP3":"rp3","RP4":"rp4","RP5":"rp5","RP6":"rp6","CP":"cp1"};

var DEFAULT_SKILLS = {"타자": {"정밀타격": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "황금세대": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}], "좌타해결사(좌타)": [{"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "좌타해결사(양타)": [{"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 3, "cF": 0.7, "sV": 3, "sF": 0.7}, {"pV": 5, "pF": 1.28, "aV": 5, "aF": 1.28, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 4, "sF": 0.7}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 4, "sF": 0.7}, {"pV": 6, "pF": 1.23, "aV": 6, "aF": 1.23, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 5, "sF": 0.7}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 5, "sF": 0.7}, {"pV": 7, "pF": 1.2, "aV": 7, "aF": 1.2, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}], "전승우승": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 4, "cF": 0.67, "sV": 4, "sF": 0.67}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 6, "cF": 0.67, "sV": 6, "sF": 0.67}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 8, "cF": 0.67, "sV": 8, "sF": 0.67}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 10, "cF": 0.67, "sV": 10, "sF": 0.67}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 12, "cF": 0.67, "sV": 12, "sF": 0.67}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 14, "cF": 0.67, "sV": 14, "sF": 0.67}], "워크에식": [{"pV": 5, "pF": 1.7, "aV": 5, "aF": 1.7, "eV": 5, "eF": 1.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.7, "aV": 5, "aF": 1.7, "eV": 5, "eF": 1.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.58, "aV": 6, "aF": 1.58, "eV": 6, "eF": 1.58, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.58, "aV": 6, "aF": 1.58, "eV": 6, "eF": 1.58, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.5, "aV": 7, "aF": 1.5, "eV": 7, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.5, "aV": 7, "aF": 1.5, "eV": 7, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "해결사": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 5, "cF": 0.75, "sV": 5, "sF": 0.75}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 0.75, "sV": 7, "sF": 0.75}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 9, "cF": 0.75, "sV": 9, "sF": 0.75}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 11, "cF": 0.75, "sV": 11, "sF": 0.75}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 13, "cF": 0.75, "sV": 13, "sF": 0.75}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 15, "cF": 0.75, "sV": 15, "sF": 0.75}], "빅게임헌터": [{"pV": 10, "pF": 1, "aV": 5, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 5, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 6, "aF": 1, "eV": 13, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 1, "aV": 6, "aF": 1, "eV": 14, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 1, "aV": 7, "aF": 1, "eV": 16, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 17, "pF": 1, "aV": 7, "aF": 1, "eV": 17, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "저니맨": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "대표타자": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "오버페이스": [{"pV": 5, "pF": 1.6, "aV": 5, "aF": 1.6, "eV": 5, "eF": 1.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.6, "aV": 5, "aF": 1.6, "eV": 5, "eF": 1.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1.5, "eV": 6, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1.5, "eV": 6, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.428571, "aV": 7, "aF": 1.428571, "eV": 7, "eF": 1.428571, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.428571, "aV": 7, "aF": 1.428571, "eV": 7, "eF": 1.428571, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "컨택트히터(타순O)": [{"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "리그탑플레이어": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "배팅머신": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수280-299)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 1, "aV": 14, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(275-279)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수267-274)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "도전정신(4성)": [{"pV": 5, "pF": 1.14, "aV": 5, "aF": 1.14, "eV": 5, "eF": 1.14, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.12, "aV": 6, "aF": 1.12, "eV": 6, "eF": 1.12, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.09, "aV": 7, "aF": 1.09, "eV": 7, "eF": 1.09, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.075, "aV": 8, "aF": 1.075, "eV": 8, "eF": 1.075, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.07, "aV": 9, "aF": 1.07, "eV": 9, "eF": 1.07, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.06, "aV": 10, "aF": 1.06, "eV": 10, "eF": 1.06, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "투쟁심": [{"pV": 5, "pF": 1.3, "aV": 5, "aF": 1.3, "eV": 5, "eF": 1.5, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.333333, "aV": 6, "aF": 1.333333, "eV": 6, "eF": 1.333333, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.285714, "aV": 7, "aF": 1.285714, "eV": 7, "eF": 1.285714, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.25, "aV": 8, "aF": 1.25, "eV": 8, "eF": 1.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.222222, "aV": 9, "aF": 1.222222, "eV": 9, "eF": 1.222222, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.2, "aV": 10, "aF": 1.2, "eV": 10, "eF": 1.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "선봉장(타순O)": [{"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.9, "sV": 3, "sF": 0.9}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.9, "sV": 4, "sF": 0.9}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.9, "sV": 6, "sF": 0.9}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "비FA계약": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "공포의하위타선(타순O)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 5, "pF": 1.1, "aV": 5, "aF": 1.1, "eV": 5, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.1, "aV": 6, "aF": 1.1, "eV": 6, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.1, "aV": 7, "aF": 1.1, "eV": 7, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.1, "aV": 8, "aF": 1.1, "eV": 8, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.1, "aV": 9, "aF": 1.1, "eV": 9, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.1, "aV": 10, "aF": 1.1, "eV": 10, "eF": 1.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수260-266)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수250-259)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 1, "aV": 12, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수240-249)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12.322844, "pF": 1, "aV": 12.322844, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수234-239)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "도전정신(5성)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "대도": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 2, "cF": 0.5, "sV": 2, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 3, "cF": 0.5, "sV": 3, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 3, "cF": 0.5, "sV": 3, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 4, "cF": 0.5, "sV": 4, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 4, "cF": 0.5, "sV": 4, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 5, "cF": 0.5, "sV": 5, "sF": 0.5}], "가을사나이": [{"pV": 6, "pF": 1, "aV": 5, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 6, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 7, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 8, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 9, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 10, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "난세의영웅": [{"pV": 6, "pF": 0.7, "aV": 6, "aF": 0.7, "eV": 6, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 8, "aF": 0.7, "eV": 8, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 9, "aF": 0.7, "eV": 9, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.7, "aV": 11, "aF": 0.7, "eV": 11, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.7, "aV": 12, "aF": 0.7, "eV": 12, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0.7, "aV": 14, "aF": 0.7, "eV": 14, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "순위경쟁": [{"pV": 6, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "좌타해결사(우타)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "홈어드밴티지": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "얼리스타트": [{"pV": 5, "pF": 1.2, "aV": 2, "aF": 0.5, "eV": 5, "eF": 1.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.25, "aV": 3, "aF": 0.5, "eV": 6, "eF": 1.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1.285714, "aV": 4, "aF": 0.5, "eV": 7, "eF": 1.285714, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1.3125, "aV": 5, "aF": 0.5, "eV": 8, "eF": 1.3125, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1.333333, "aV": 6, "aF": 0.5, "eV": 9, "eF": 1.333333, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1.35, "aV": 7, "aF": 0.5, "eV": 10, "eF": 1.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수225-233)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수220-224)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "5툴플레이어(주수200-219)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "핵타선(타순O)": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "베스트포지션": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 1, "aV": 13, "aF": 1, "eV": 13, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "백전노장": [{"pV": 6, "pF": 0.6, "aV": 5, "aF": 1, "eV": 6, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 6, "aF": 1, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 7, "aF": 1, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 8, "aF": 1, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.6, "aV": 9, "aF": 1, "eV": 11, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 10, "aF": 1, "eV": 12, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(임팩)": [{"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.6, "aV": 11, "aF": 0.6, "eV": 11, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "컨택트히터(타순X)": [{"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 4, "eF": 0, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 5, "eF": 0, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 5, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "짜릿한손맛": [{"pV": 3, "pF": 1.5, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1.45, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1.525, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.48, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1.54, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1.5, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "수비안정성(타순O)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 1, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 14, "aF": 1, "eV": 14, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 16, "aF": 1, "eV": 16, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "집중력": [{"pV": 2, "pF": 0.4, "aV": 6, "aF": 1.13, "eV": 2, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 0.4, "aV": 7, "aF": 1.17, "eV": 3, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 0.4, "aV": 8, "aF": 1.15, "eV": 3, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 0.4, "aV": 9, "aF": 1.18, "eV": 4, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 0.4, "aV": 10, "aF": 1.16, "eV": 4, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 0.4, "aV": 11, "aF": 1.181818, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "승리의함성": [{"pV": 7, "pF": 0.35, "aV": 5, "aF": 1, "eV": 7, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 6, "aF": 1, "eV": 8, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 7, "aF": 1, "eV": 9, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 8, "aF": 1, "eV": 10, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.35, "aV": 9, "aF": 1, "eV": 11, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.35, "aV": 10, "aF": 1, "eV": 12, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "선봉장(타순배치X)": [{"pV": 3, "pF": 0, "aV": 3, "aF": 0, "eV": 0, "eF": 1, "cV": 3, "cF": 0.9, "sV": 3, "sF": 0.9}, {"pV": 3, "pF": 0, "aV": 3, "aF": 0, "eV": 0, "eF": 1, "cV": 4, "cF": 0.9, "sV": 4, "sF": 0.9}, {"pV": 4, "pF": 0, "aV": 4, "aF": 0, "eV": 0, "eF": 1, "cV": 6, "cF": 0.9, "sV": 6, "sF": 0.9}, {"pV": 4, "pF": 0, "aV": 4, "aF": 0, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "승부사": [{"pV": 5, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 3, "aF": 0.7, "eV": 3, "eF": 0.7, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "결정적한방": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.15, "sV": 9, "sF": 0.15}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.15, "sV": 10, "sF": 0.15}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.15, "sV": 11, "sF": 0.15}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.15, "sV": 12, "sF": 0.15}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 0.15, "sV": 13, "sF": 0.15}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.15, "sV": 14, "sF": 0.15}], "노림수": [{"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 13, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "우완킬러": [{"pV": 5, "pF": 0.7, "aV": 5, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 6, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 7, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 8, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 9, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 10, "aF": 0.7, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "대타스페셜": [{"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 5, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0, "aV": 12, "aF": 0, "eV": 12, "eF": 0, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 0, "aV": 13, "aF": 0, "eV": 13, "eF": 0, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0, "aV": 14, "aF": 0, "eV": 14, "eF": 0, "cV": 10, "cF": 1, "sV": 0, "sF": 1}], "공포의하위타선(타순X)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 0}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 0}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 0}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 0}, {"pV": 0, "pF": 1, "aV": 11, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 0}], "히든카드": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리드오프(타순O)": [{"pV": 0, "pF": 1, "aV": 3, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 3, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선연결": [{"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.35, "aV": 6, "aF": 0.35, "eV": 6, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.35, "aV": 7, "aF": 0.35, "eV": 7, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 8, "aF": 0.35, "eV": 8, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 9, "aF": 0.35, "eV": 9, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 10, "aF": 0.35, "eV": 10, "eF": 0.35, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "역전의명수": [{"pV": 5, "pF": 0.33, "aV": 5, "aF": 0.33, "eV": 5, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.33, "aV": 6, "aF": 0.33, "eV": 6, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.33, "aV": 7, "aF": 0.33, "eV": 7, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.33, "aV": 8, "aF": 0.33, "eV": 8, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.33, "aV": 9, "aF": 0.33, "eV": 9, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.33, "aV": 10, "aF": 0.33, "eV": 10, "eF": 0.33, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "승부근성": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 5, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 6, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 7, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 8, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 9, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 10, "eF": 0.3, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "클러치히터": [{"pV": 5, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "테이블세터": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 5, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(국대)": [{"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.2, "aV": 11, "aF": 0.2, "eV": 11, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.2, "aV": 12, "aF": 0.2, "eV": 12, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "하이볼히터": [{"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 18, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "좌완킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "초구공략": [{"pV": 5, "pF": 0.25, "aV": 5, "aF": 0.25, "eV": 5, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.25, "aV": 6, "aF": 0.25, "eV": 6, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.25, "aV": 7, "aF": 0.25, "eV": 7, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.25, "aV": 8, "aF": 0.25, "eV": 8, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.25, "aV": 9, "aF": 0.25, "eV": 9, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.25, "aV": 10, "aF": 0.25, "eV": 10, "eF": 0.25, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타점기계": [{"pV": 6, "pF": 0.25, "aV": 6, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.25, "aV": 7, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.25, "aV": 8, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.25, "aV": 9, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.25, "aV": 10, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.25, "aV": 11, "aF": 0.25, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구킬러": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "스윗스팟": [{"pV": 7, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 13, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 15, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(시그/올스타/라이브)": [{"pV": 7, "pF": 0.15, "aV": 7, "aF": 0.15, "eV": 7, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.15, "aV": 8, "aF": 0.15, "eV": 8, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.15, "aV": 9, "aF": 0.15, "eV": 9, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.15, "aV": 10, "aF": 0.15, "eV": 10, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.15, "aV": 11, "aF": 0.15, "eV": 11, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.15, "aV": 12, "aF": 0.15, "eV": 12, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리드오프(타순X)": [{"pV": 0, "pF": 1, "aV": 3, "aF": 0, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 3, "aF": 0, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 4, "aF": 0, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 11, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 12, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "당겨치기": [{"pV": 5, "pF": 0.4, "aV": 5, "aF": 0.4, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.4, "aV": 6, "aF": 0.4, "eV": 6, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.4, "aV": 7, "aF": 0.4, "eV": 7, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.4, "aV": 8, "aF": 0.4, "eV": 8, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.4, "aV": 9, "aF": 0.4, "eV": 9, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.4, "aV": 10, "aF": 0.4, "eV": 10, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "밀어치기": [{"pV": 5, "pF": 0.4, "aV": 5, "aF": 0.4, "eV": 5, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.4, "aV": 6, "aF": 0.4, "eV": 6, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.4, "aV": 7, "aF": 0.4, "eV": 7, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.4, "aV": 8, "aF": 0.4, "eV": 8, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.4, "aV": 9, "aF": 0.4, "eV": 9, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.4, "aV": 10, "aF": 0.4, "eV": 10, "eF": 0.4, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "직구킬러": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.45, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "어퍼스윙": [{"pV": 5, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.35, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "패기(골글)": [{"pV": 7, "pF": 0.1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.1, "aV": 11, "aF": 0.1, "eV": 11, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0.1, "aV": 12, "aF": 0.1, "eV": 12, "eF": 0.1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "진검승부": [{"pV": 5, "pF": 0.05, "aV": 5, "aF": 0.05, "eV": 5, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.05, "aV": 6, "aF": 0.05, "eV": 6, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.05, "aV": 7, "aF": 0.05, "eV": 7, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.05, "aV": 8, "aF": 0.05, "eV": 8, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.05, "aV": 9, "aF": 0.05, "eV": 9, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.05, "aV": 10, "aF": 0.05, "eV": 10, "eF": 0.05, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "매의눈": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "수비안정성(타순X)": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 12, "aF": 0, "eV": 12, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 14, "aF": 0, "eV": 14, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 16, "aF": 0, "eV": 16, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리그의강자": [{"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 12, "pF": 0, "aV": 0, "aF": 1, "eV": 12, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 14, "pF": 0, "aV": 0, "aF": 1, "eV": 14, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 16, "pF": 0, "aV": 0, "aF": 1, "eV": 16, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 18, "pF": 0, "aV": 0, "aF": 1, "eV": 18, "eF": 0, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "빠른발": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "핵타선(타순X)": [{"pV": 5, "pF": 0, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 6, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 7, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 8, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "번트전문": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "국대에이스": [{"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "포수리드": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "선발": {"좌승사자(좌투)": [{"pV": 9, "pF": 0.733333, "aV": 9, "aF": 0.733333, "eV": 9, "eF": 0.733333, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 11, "pF": 0.727273, "aV": 11, "aF": 0.727273, "eV": 11, "eF": 0.727273, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.769231, "aV": 13, "aF": 0.769231, "eV": 13, "eF": 0.769231, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.8, "aV": 15, "aF": 0.8, "eV": 15, "eF": 0.8, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 17, "pF": 0.8, "aV": 17, "aF": 0.8, "eV": 17, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 19, "pF": 0.8, "aV": 19, "aF": 0.8, "eV": 19, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력140-149)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.4, "sV": 6, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.34, "sV": 7, "sF": 1.34}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.3, "sV": 8, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.27, "sV": 9, "sF": 1.27}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.24, "sV": 10, "sF": 1.24}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "패기(임팩)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.95, "sV": 7, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.95, "sV": 8, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.95, "sV": 9, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.95, "sV": 10, "sF": 0.95}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "필승카드": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "전승우승": [{"pV": 4, "pF": 0.6, "aV": 4, "aF": 0.6, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.6, "aV": 14, "aF": 0.6, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "해결사": [{"pV": 5, "pF": 0.5, "aV": 5, "aF": 0.5, "eV": 5, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 0.5, "aV": 7, "aF": 0.5, "eV": 7, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 0.5, "aV": 9, "aF": 0.5, "eV": 9, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 11, "pF": 0.5, "aV": 11, "aF": 0.5, "eV": 11, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.5, "aV": 13, "aF": 0.5, "eV": 13, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.5, "aV": 15, "aF": 0.5, "eV": 15, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}], "긴급투입": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.33, "eV": 5, "eF": 0.33, "cV": 6, "cF": 0.85, "sV": 6, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.33, "eV": 6, "eF": 0.33, "cV": 7, "cF": 0.85, "sV": 7, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.33, "eV": 7, "eF": 0.33, "cV": 8, "cF": 0.85, "sV": 8, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.33, "eV": 8, "eF": 0.33, "cV": 9, "cF": 0.85, "sV": 9, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.33, "eV": 9, "eF": 0.33, "cV": 10, "cF": 0.85, "sV": 10, "sF": 0.85}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.33, "eV": 10, "eF": 0.33, "cV": 11, "cF": 0.85, "sV": 11, "sF": 0.85}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그톱플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력 100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "원투펀치(1,2선발)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "홈어드밴티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.02, "sV": 5, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.02, "sV": 6, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.02, "sV": 7, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.02, "sV": 8, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.02, "sV": 9, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.02, "sV": 10, "sF": 1.02}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "패기(시그/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}], "좌승사자(우투)": [{"pV": 4, "pF": 0.35, "aV": 4, "aF": 0.35, "eV": 4, "eF": 0.35, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 0.35, "aV": 5, "aF": 0.35, "eV": 5, "eF": 0.35, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.8, "sV": 3, "sF": 1.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.8, "sV": 3, "sF": 1.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.6, "sV": 4, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.6, "sV": 4, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.6, "sV": 5, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.6, "sV": 5, "sF": 1.6}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "마당쇠": [{"pV": 6, "pF": 0, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 0, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 0, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 0, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 0, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 0, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "집념": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.2, "sV": 3, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.2, "sV": 4, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.2, "sV": 5, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.2, "sV": 6, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 7, "sF": 1.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.2, "sV": 8, "sF": 1.2}], "패기(골글)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 7, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 8, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 9, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.5, "sV": 10, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "언터쳐블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "승리의함성": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.33}], "원투펀치(3,4,5선발)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0.2, "eV": 11, "eF": 0.2, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "얼리스타트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 10, "sF": 1}], "라이징스타(3,4,5선발)": [{"pV": 5, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "라이징스타(1,2선발)": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "원포인트릴리프": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.03, "sV": 9, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.03, "sV": 10, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.03, "sV": 11, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.03, "sV": 12, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.03, "sV": 13, "sF": 0.03}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.03, "sV": 14, "sF": 0.03}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "흐름끊기": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.1, "sV": 6, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.1, "sV": 7, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.1, "sV": 8, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.1, "sV": 9, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.1, "sV": 10, "sF": 0.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.1, "sV": 11, "sF": 0.1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "수호신": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.05, "sV": 11, "sF": 0.05}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "기선제압": [{"pV": 5, "pF": 0.03, "aV": 5, "aF": 0.03, "eV": 5, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.03, "aV": 6, "aF": 0.03, "eV": 6, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.03, "aV": 7, "aF": 0.03, "eV": 7, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.03, "aV": 8, "aF": 0.03, "eV": 8, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.03, "aV": 9, "aF": 0.03, "eV": 9, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.03, "aV": 10, "aF": 0.03, "eV": 10, "eF": 0.03, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "사고방지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "중계": {"마당쇠": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "긴급투입(추격조)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 7, "cF": 1.05, "sV": 7, "sF": 1.05}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 8, "cF": 1.04, "sV": 8, "sF": 1.04}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 9, "cF": 1.03, "sV": 9, "sF": 1.03}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 10, "cF": 1.02, "sV": 10, "sF": 1.02}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 11, "cF": 1.02, "sV": 11, "sF": 1.02}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전승우승(추격조)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 1, "aV": 12, "aF": 1, "eV": 12, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 1, "aV": 14, "aF": 1, "eV": 14, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.44, "sV": 7, "sF": 1.44}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.4, "sV": 8, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.37, "sV": 9, "sF": 1.37}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.34, "sV": 10, "sF": 1.34}], "약속의8회(셋업맨2)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.43, "sV": 7, "sF": 1.43}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.375, "sV": 8, "sF": 1.375}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.33, "sV": 9, "sF": 1.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.3, "sV": 10, "sF": 1.3}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "패기(임팩/국대/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "필승카드(승리조,셋업맨)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "필승카드(롱릴리프)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "필승카드(추격조)": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "긴급투입(롱릴리프)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.6, "eV": 5, "eF": 0.6, "cV": 6, "cF": 0.8, "sV": 6, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 7, "cF": 0.8, "sV": 7, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.6, "eV": 7, "eF": 0.6, "cV": 8, "cF": 0.8, "sV": 8, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 9, "cF": 0.8, "sV": 9, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.6, "eV": 9, "eF": 0.6, "cV": 10, "cF": 0.8, "sV": 10, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 11, "cF": 0.8, "sV": 11, "sF": 0.8}], "전승우승(롱릴리프)": [{"pV": 4, "pF": 0.8, "aV": 4, "aF": 0.8, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.8, "aV": 6, "aF": 0.8, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.8, "aV": 8, "aF": 0.8, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.8, "aV": 10, "aF": 0.8, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.8, "aV": 12, "aF": 0.8, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.8, "aV": 14, "aF": 0.8, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "패기(시그)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.9, "sV": 7, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.9, "sV": 8, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.9, "sV": 9, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.9, "sV": 10, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.9, "sV": 11, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.9, "sV": 12, "sF": 0.9}], "약속의8회(추격조,롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.1, "sV": 5, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 6, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.1, "sV": 7, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.1, "sV": 8, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.1, "sV": 9, "sF": 1.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.1, "sV": 10, "sF": 1.1}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.85}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.85}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.7}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그탑플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "국민계투(셋업맨)": [{"pV": 8, "pF": 0.5, "aV": 8, "aF": 0.5, "eV": 8, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.5, "aV": 10, "aF": 0.5, "eV": 10, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.5, "aV": 12, "aF": 0.5, "eV": 12, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.5, "aV": 14, "aF": 0.5, "eV": 14, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.5, "aV": 16, "aF": 0.5, "eV": 16, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.5, "aV": 18, "aF": 0.5, "eV": 18, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "수호신(셋업맨2)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "약속의8회(셋업맨1)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "홈어드밴티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "승리의함성(승리조,셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.8}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.8}], "국민계투(셋업맨X)": [{"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 8, "eF": 0.3, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 10, "eF": 0.3, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.3, "aV": 12, "aF": 0.3, "eV": 12, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.3, "aV": 14, "aF": 0.3, "eV": 14, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.3, "aV": 16, "aF": 0.3, "eV": 16, "eF": 0.3, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.3, "aV": 18, "aF": 0.3, "eV": 18, "eF": 0.3, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "전승우승(승리조,셋업맨)": [{"pV": 4, "pF": 0.6, "aV": 4, "aF": 0.6, "eV": 4, "eF": 0.6, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 6, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 8, "eF": 0.6, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 10, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.6, "aV": 12, "aF": 0.6, "eV": 12, "eF": 0.6, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.6, "aV": 14, "aF": 0.6, "eV": 14, "eF": 0.6, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "라이징스타(셋업맨/3,4,5중계)": [{"pV": 5, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.8, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "수호신(승리조)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "원포인트릴리프(셋업맨)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.2, "sV": 12, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.2, "sV": 13, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.2, "sV": 14, "sF": 0.2}], "라이징스타(셋업맨X/3,4,5중계)": [{"pV": 5, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.7, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "흐름끊기(셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "원포인트릴리프(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.15, "sV": 9, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.15, "sV": 10, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.15, "sV": 11, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.15, "sV": 12, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.15, "sV": 13, "sF": 0.15}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.15, "sV": 14, "sF": 0.15}], "얼리스타트(셋업맨)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 10, "sF": 1}], "얼리스타트(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.5, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.5, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.5, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 10, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "언터처블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "원투펀치": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승리의함성(롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.33}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.7, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.7, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.5, "sV": 4, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.5, "sV": 4, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}], "흐름끊기(셋업맨X)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.5, "sV": 6, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.5, "sV": 7, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.5, "sV": 8, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.5, "sV": 9, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.5, "sV": 10, "sF": 0.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.5, "sV": 11, "sF": 0.5}], "긴급투입(승리조,셋업맨)": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.1, "eV": 5, "eF": 0.1, "cV": 6, "cF": 0.4, "sV": 6, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 7, "cF": 0.4, "sV": 7, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 8, "cF": 0.4, "sV": 8, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 9, "cF": 0.4, "sV": 9, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 10, "cF": 0.4, "sV": 10, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 11, "cF": 0.4, "sV": 11, "sF": 0.4}], "라이징스타(1,2,6중계)": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "수호신(추격조,롱릴리프)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.4, "sV": 6, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.4, "sV": 7, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.4, "sV": 8, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.4, "sV": 9, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.4, "sV": 10, "sF": 0.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.4, "sV": 11, "sF": 0.4}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "승리의함성(추격조)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압(셋업맨)": [{"pV": 5, "pF": 0.2, "aV": 5, "aF": 0.2, "eV": 5, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.2, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압(셋업맨X)": [{"pV": 5, "pF": 0.15, "aV": 5, "aF": 0.15, "eV": 5, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.15, "aV": 6, "aF": 0.15, "eV": 6, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.15, "aV": 7, "aF": 0.15, "eV": 7, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.15, "aV": 8, "aF": 0.15, "eV": 8, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.15, "aV": 9, "aF": 0.15, "eV": 9, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.15, "aV": 10, "aF": 0.15, "eV": 10, "eF": 0.15, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "수호신(셋업맨1)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.05, "sV": 11, "sF": 0.05}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "사고방지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "마무리": {"마당쇠": [{"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 10, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 11, "pF": 1, "aV": 11, "aF": 1, "eV": 11, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "황금세대": [{"pV": 1, "pF": 1, "aV": 1, "aF": 1, "eV": 1, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 3, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력134-139)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}], "투쟁심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.44, "sV": 7, "sF": 1.44}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.4, "sV": 8, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.37, "sV": 9, "sF": 1.37}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.34, "sV": 10, "sF": 1.34}], "파이어볼": [{"pV": 6, "pF": 0.42, "aV": 6, "aF": 0.42, "eV": 6, "eF": 0.42, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 0.42, "aV": 7, "aF": 0.42, "eV": 7, "eF": 0.42, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 0.42, "aV": 8, "aF": 0.42, "eV": 8, "eF": 0.42, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 0.42, "aV": 9, "aF": 0.42, "eV": 9, "eF": 0.42, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 10, "pF": 0.42, "aV": 10, "aF": 0.42, "eV": 10, "eF": 0.42, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 11, "pF": 0.42, "aV": 11, "aF": 0.42, "eV": 11, "eF": 0.42, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "철완(지구력120-133)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "철완(지구력117-119)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "저니맨": [{"pV": 2, "pF": 1, "aV": 2, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 3, "pF": 1, "aV": 3, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "패기(일팩)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "비FA계약": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "빅게임헌터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 16, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 17, "sF": 1}], "패기(국대)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "필승카드": [{"pV": 4, "pF": 1, "aV": 4, "aF": 1, "eV": 4, "eF": 1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 5, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 6, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 7, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 8, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 9, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}], "해결사": [{"pV": 5, "pF": 0.5, "aV": 5, "aF": 0.5, "eV": 5, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 7, "pF": 0.5, "aV": 7, "aF": 0.5, "eV": 7, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 9, "pF": 0.5, "aV": 9, "aF": 0.5, "eV": 9, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 11, "pF": 0.5, "aV": 11, "aF": 0.5, "eV": 11, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 13, "pF": 0.5, "aV": 13, "aF": 0.5, "eV": 13, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 15, "pF": 0.5, "aV": 15, "aF": 0.5, "eV": 15, "eF": 0.5, "cV": 5, "cF": 1, "sV": 5, "sF": 1}], "패기(시그/올스타/라이브)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 12, "sF": 1}], "구속제어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 15, "cF": 1, "sV": 15, "sF": 1}], "리그톱플레이어": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "전천후": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "수호신": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "철완(지구력100-116)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}], "국민계투": [{"pV": 8, "pF": 0.5, "aV": 8, "aF": 0.5, "eV": 8, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 10, "pF": 0.5, "aV": 10, "aF": 0.5, "eV": 10, "eF": 0.5, "cV": 2, "cF": 1, "sV": 2, "sF": 1}, {"pV": 12, "pF": 0.5, "aV": 12, "aF": 0.5, "eV": 12, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 14, "pF": 0.5, "aV": 14, "aF": 0.5, "eV": 14, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 16, "pF": 0.5, "aV": 16, "aF": 0.5, "eV": 16, "eF": 0.5, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 18, "pF": 0.5, "aV": 18, "aF": 0.5, "eV": 18, "eF": 0.5, "cV": 4, "cF": 1, "sV": 4, "sF": 1}], "순위경쟁": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}], "도전정신(4성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "워크에식": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 1.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1, "sV": 5, "sF": 1.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.75}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 6, "sF": 1.75}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 1.6}], "승리의함성": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 7, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.9}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.9}], "홈어드벤티지": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "국대에이스(중복)": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "도전정신(5성)": [{"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 1, "pF": 0, "aV": 1, "aF": 0, "eV": 1, "eF": 0, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "에이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 10, "sF": 1}], "약속의8회": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.4, "sV": 5, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.5, "sV": 6, "sF": 1.5}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.43, "sV": 7, "sF": 1.43}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.375, "sV": 8, "sF": 1.375}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.33, "sV": 9, "sF": 1.33}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.3, "sV": 10, "sF": 1.3}], "가을사나이": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 11, "sF": 1}], "부동심": [{"pV": 7, "pF": 0.28, "aV": 7, "aF": 0.28, "eV": 7, "eF": 0.28, "cV": 6, "cF": 1.1, "sV": 5, "sF": 0.1}, {"pV": 8, "pF": 0.28, "aV": 8, "aF": 0.28, "eV": 8, "eF": 0.28, "cV": 7, "cF": 1.1, "sV": 6, "sF": 0.1}, {"pV": 10, "pF": 0.28, "aV": 10, "aF": 0.28, "eV": 10, "eF": 0.28, "cV": 8, "cF": 1.1, "sV": 7, "sF": 0.1}, {"pV": 12, "pF": 0.28, "aV": 12, "aF": 0.28, "eV": 12, "eF": 0.28, "cV": 9, "cF": 1.1, "sV": 8, "sF": 0.1}, {"pV": 14, "pF": 0.28, "aV": 14, "aF": 0.28, "eV": 14, "eF": 0.28, "cV": 10, "cF": 1.1, "sV": 9, "sF": 0.1}, {"pV": 16, "pF": 0.28, "aV": 16, "aF": 0.28, "eV": 16, "eF": 0.28, "cV": 11, "cF": 1.1, "sV": 10, "sF": 0.1}], "난세의영웅": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0.7, "sV": 12, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0.7, "sV": 14, "sF": 0.7}], "원포인트릴리프": [{"pV": 0, "pF": 1, "aV": 5, "aF": 1, "eV": 5, "eF": 1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 1, "eV": 6, "eF": 1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 1, "eV": 7, "eF": 1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 1, "eV": 8, "eF": 1, "cV": 12, "cF": 0.2, "sV": 12, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 1, "eV": 9, "eF": 1, "cV": 13, "cF": 0.2, "sV": 13, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 1, "eV": 10, "eF": 1, "cV": 14, "cF": 0.2, "sV": 14, "sF": 0.2}], "베스트포지션": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 11, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 13, "sF": 1}], "흐름끊기": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 6, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 7, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 8, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 9, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.7, "sV": 10, "sF": 0.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.7, "sV": 11, "sF": 0.7}], "집중력": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1.1, "sV": 2, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1.2, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1.25, "sV": 3, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1.3, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1.35, "sV": 4, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1.4, "sV": 5, "sF": 0.3}], "얼리스타트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 0.7, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.7, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.7, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.7, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.7, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.7, "sV": 10, "sF": 1}], "전승우승": [{"pV": 4, "pF": 0.1, "aV": 4, "aF": 0.1, "eV": 4, "eF": 0.1, "cV": 3, "cF": 1, "sV": 3, "sF": 1}, {"pV": 6, "pF": 0.1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 8, "pF": 0.1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 4, "cF": 1, "sV": 4, "sF": 1}, {"pV": 10, "pF": 0.1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 12, "pF": 0.1, "aV": 12, "aF": 0.1, "eV": 12, "eF": 0.1, "cV": 5, "cF": 1, "sV": 5, "sF": 1}, {"pV": 14, "pF": 0.1, "aV": 14, "aF": 0.1, "eV": 14, "eF": 0.1, "cV": 6, "cF": 1, "sV": 6, "sF": 1}], "백전노장": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1, "sV": 6, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 8, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 9, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 10, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 11, "sF": 0.25}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 12, "sF": 0.25}], "아티스트": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "인터처블": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 13, "cF": 1, "sV": 0, "sF": 1}], "원투펀치": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 12, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 14, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 16, "sF": 1}], "승부사": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 0.3, "sV": 10, "sF": 1}], "오버페이스": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.6, "sV": 3, "sF": 1.7}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 3, "cF": 1.6, "sV": 3, "sF": 1.6}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.4, "sV": 4, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 4, "cF": 1.4, "sV": 4, "sF": 1.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 1.3, "sV": 5, "sF": 1.3}], "라이징스타": [{"pV": 5, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 1, "sV": 0, "sF": 1}], "평정심": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "첫단추": [{"pV": 0, "pF": 1, "aV": 6, "aF": 0, "eV": 6, "eF": 0, "cV": 0, "cF": 1, "sV": 5, "sF": 1}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0, "eV": 7, "eF": 0, "cV": 0, "cF": 1, "sV": 6, "sF": 1}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0, "eV": 8, "eF": 0, "cV": 0, "cF": 1, "sV": 7, "sF": 1}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0, "eV": 9, "eF": 0, "cV": 0, "cF": 1, "sV": 8, "sF": 1}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0, "eV": 10, "eF": 0, "cV": 0, "cF": 1, "sV": 9, "sF": 1}, {"pV": 0, "pF": 1, "aV": 11, "aF": 0, "eV": 11, "eF": 0, "cV": 0, "cF": 1, "sV": 10, "sF": 1}], "위닝샷": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 1, "cF": 1, "sV": 1, "sF": 2.4}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.2}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 2, "cF": 1, "sV": 2, "sF": 2.4}], "우타킬러": [{"pV": 5, "pF": 0.6, "aV": 5, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.6, "aV": 6, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.6, "aV": 7, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.6, "aV": 8, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.6, "aV": 9, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.6, "aV": 10, "aF": 0.6, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "완급조절": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.3, "sV": 5, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.3, "sV": 6, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.3, "sV": 7, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.3, "sV": 8, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.3, "sV": 9, "sF": 0.3}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.3, "sV": 10, "sF": 0.3}], "긴급투입": [{"pV": 0, "pF": 1, "aV": 5, "aF": 0.1, "eV": 5, "eF": 0.1, "cV": 6, "cF": 0.2, "sV": 6, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 6, "aF": 0.1, "eV": 6, "eF": 0.1, "cV": 7, "cF": 0.2, "sV": 7, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 7, "aF": 0.1, "eV": 7, "eF": 0.1, "cV": 8, "cF": 0.2, "sV": 8, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 8, "aF": 0.1, "eV": 8, "eF": 0.1, "cV": 9, "cF": 0.2, "sV": 9, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 9, "aF": 0.1, "eV": 9, "eF": 0.1, "cV": 10, "cF": 0.2, "sV": 10, "sF": 0.2}, {"pV": 0, "pF": 1, "aV": 10, "aF": 0.1, "eV": 10, "eF": 0.1, "cV": 11, "cF": 0.2, "sV": 11, "sF": 0.2}], "클러치피처": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.65, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.65, "sV": 0, "sF": 1}], "좌타킬러": [{"pV": 5, "pF": 0.3, "aV": 5, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.3, "aV": 6, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 7, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 8, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 9, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 10, "aF": 0.3, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "변화구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.58, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.58, "sV": 0, "sF": 1}], "위기관리": [{"pV": 6, "pF": 0.24, "aV": 6, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.24, "aV": 7, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.24, "aV": 8, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.24, "aV": 9, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.24, "aV": 10, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.24, "aV": 11, "aF": 0.24, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "기선제압": [{"pV": 5, "pF": 0.2, "aV": 5, "aF": 0.2, "eV": 5, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 0.2, "aV": 6, "aF": 0.2, "eV": 6, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.2, "aV": 7, "aF": 0.2, "eV": 7, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.2, "aV": 8, "aF": 0.2, "eV": 8, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.2, "aV": 9, "aF": 0.2, "eV": 9, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.2, "aV": 10, "aF": 0.2, "eV": 10, "eF": 0.2, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "더러운볼끝": [{"pV": 6, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 11, "pF": 0.3, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "자신감": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.2, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 11, "cF": 0.2, "sV": 0, "sF": 1}], "속구선호": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 3, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 4, "sF": 0.42}], "진검승부": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 5, "cF": 0.05, "sV": 5, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 6, "cF": 0.05, "sV": 6, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 7, "cF": 0.05, "sV": 7, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0.05, "sV": 8, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 9, "cF": 0.05, "sV": 9, "sF": 0.05}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0.05, "sV": 10, "sF": 0.05}], "리그의강자": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 8, "cF": 0, "sV": 8, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 10, "cF": 0, "sV": 10, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 12, "cF": 0, "sV": 12, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 14, "cF": 0, "sV": 14, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 16, "cF": 0, "sV": 16, "sF": 0}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 18, "cF": 0, "sV": 18, "sF": 0}], "타선지원": [{"pV": 5, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 6, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 7, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 8, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 9, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 10, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "사교왕": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}], "이닝이터": [{"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}, {"pV": 0, "pF": 1, "aV": 0, "aF": 1, "eV": 0, "eF": 1, "cV": 0, "cF": 1, "sV": 0, "sF": 1}]}, "weights": {"p": 1.0, "a": 0.9, "e": 0.3, "c": 1.175, "s": 1.275}};
async function sGet(k){try{var r=await window.storage.get(k);return r?JSON.parse(r.value):null;}catch(e){return null;}}
async function sSet(k,d){try{await window.storage.set(k,JSON.stringify(d));return true;}catch(e){return false;}}

/* ================================================================
   CALCULATION
   ================================================================ */
function calcBat(pl,lu,sdB){
  if(!pl||!lu)return{power:0,accuracy:0,eye:0,total:0,skillScore:0};
  var w=getW();var sb=sdB||{p:0,a:0,e:0};
  var fP=(pl.power||0)+getEnhVal(pl.cardType,"파워",lu.enhance||"")+(lu.trainP||0)+(pl.specPower||0)+sb.p+(pl.potmP||0);
  var fA=(pl.accuracy||0)+getEnhVal(pl.cardType,"정확",lu.enhance||"")+(lu.trainA||0)+(pl.specAccuracy||0)+sb.a+(pl.potmA||0);
  var fE=(pl.eye||0)+getEnhVal(pl.cardType,"선구",lu.enhance||"")+(lu.trainE||0)+(pl.specEye||0)+sb.e+(pl.potmE||0);
  var ss=getSkillScore(lu.skill1,lu.s1Lv||0,"타자")+getSkillScore(lu.skill2,lu.s2Lv||0,"타자")+getSkillScore(lu.skill3,lu.s3Lv||0,"타자");
  var t=fP*w.p+fA*w.a+fE*w.e+ss;
  /* 국대에이스(타자): 종합점수에만 반영 */
  if(sdB&&sdB._sdState){var nb2=sdB._sdState.natBat||sdB._sdState._autoNatBat||"없음";if(nb2==="5렙"){t+=1*w.p+1*w.a;}if(nb2==="6렙"){t+=2*w.p+2*w.a;}}
  return{power:fP,accuracy:fA,eye:fE,total:Math.round(t*100)/100,skillScore:Math.round(ss*100)/100};
}

function calcPit(pl,lu,sdB){
  if(!pl||!lu)return{change:0,stuff:0,total:0,skillScore:0};
  var w=getW();var sb=sdB||{c:0,s:0};
  var fC=(pl.change||0)+getEnhVal(pl.cardType,"변화",lu.enhance||"")+(lu.trainC||0)+(pl.specChange||0)+sb.c+(pl.potmC||0);
  var fS=(pl.stuff||0)+getEnhVal(pl.cardType,"구위",lu.enhance||"")+(lu.trainS||0)+(pl.specStuff||0)+sb.s+(pl.potmS||0);
  var pt=pl.position==="선발"?"선발":pl.position==="마무리"?"마무리":"중계";
  var ss=getSkillScore(lu.skill1,lu.s1Lv||0,pt)+getSkillScore(lu.skill2,lu.s2Lv||0,pt)+getSkillScore(lu.skill3,lu.s3Lv||0,pt);
  var t=fC*w.c+fS*w.s+ss;
  /* 국대에이스(투수)+포수리드: 종합점수에만 반영 */
  if(sdB&&sdB._sdState){
    var np2=sdB._sdState.natPit||sdB._sdState._autoNatPit||"없음";if(np2==="5렙"){t+=1*w.c+1*w.s;}if(np2==="6렙"){t+=2*w.c+2*w.s;}
    var cl2=sdB._sdState.catchLead||sdB._sdState._autoCatch||"없음";
    if(cl2==="5렙"){t+=1*w.c;}if(cl2==="6렙"){t+=1*w.c+1*w.s;}if(cl2==="7렙"){t+=1*w.c+1*w.s;}if(cl2==="8렙"){t+=2*w.c+1*w.s;}if(cl2==="9렙"){t+=2*w.c+1*w.s;}if(cl2==="10렙"){t+=2*w.c+2*w.s;}
  }
  return{change:fC,stuff:fS,total:Math.round(t*100)/100,skillScore:Math.round(ss*100)/100};
}

/* Set deck bonus calculator for a single player */
function calcSDBonus(pl, slot, sdState, totalSP) {
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
  var batIdx = batSlots.indexOf(slot); /* 0-8 = 1~9번타자 */
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
  if (act(70)) { if (v(70)==="L" && !isBat) { pc++; ps++; } if (v(70)==="R" && isRP) { pc+=2; ps+=2; } }
  if (act(75)) {
    var v75=v(75); var side75=v75&&v75[0]; var yr75=v75&&v75.indexOf(":")>0?v75.split(":")[1]:"";
    if (side75==="L" && isBat) { var m75=(ct==="임팩트"||String(yr)===yr75); if(m75){bp+=3;ba+=3;} }
    if (side75==="R" && !isBat) { var m75b=(ct==="임팩트"||String(yr)===yr75); if(m75b) ps+=3; }
  }
  if (act(80)) { if (v(80)==="L" && isBat) { bp++; ba++; be++; } if (v(80)==="R" && !isBat) { pc++; ps++; } }
  if (act(85)) { if (v(85)==="L" && stars===4) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; } if (v(85)==="R" && stars===5) { ba++; ps++; } }
  if (act(95)) { if (isBat && isOF) be+=2; }
  if (act(100)) { if (v(100)==="L" && isBat) { bp++; ba++; be++; } if (v(100)==="R" && !isBat) { pc++; ps++; } }
  if (act(105)) { if (v(105)==="L" && stars===3) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; } if (v(105)==="R" && stars===4) { if(isBat){bp+=2;be+=2;} if(!isBat){pc+=2;ps+=2;} } }
  if (act(115)) { if (v(115)==="L" && isBat && is69) ba+=2; if (v(115)==="R" && isRP) ps+=2; }
  if (act(120)) { if (v(120)==="L" && isBat && is35) { bp+=2; ba+=2; be+=2; } if (v(120)==="R" && !isBat) { pc++; ps++; } }
  if (act(125)) { if (stars===4) { if(isBat){ba++;be++;} pc+=2; } }
  if (act(130)) { if (v(130)==="L" && isLive) { bp++; ba++; be++; pc++; ps++; } if (v(130)==="R" && isGold) { bp++; ba++; be++; pc++; ps++; } }
  if (act(135)) { if (v(135)==="L" && isBat && is35) ba+=2; if (v(135)==="R" && isSP) ps++; }
  if (act(140)) { if (v(140)==="L" && isBat && is69) { bp++; ba++; be++; } if (v(140)==="R" && isRP) { pc++; ps++; } }
  if (act(145)) { if (v(145)==="L" && isBat && is12) { ba+=2; be+=2; } if (v(145)==="R" && isSP) ps++; }
  if (act(150)) { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; }
  if (act(155)) { if (v(155)==="L" && isBat && is12) { bp+=2; be+=2; } if (v(155)==="R" && !isBat) pc++; }
  if (act(160)) { if (v(160)==="L" && isBat) { bp++; ba++; be++; } if (v(160)==="R" && !isBat) { pc++; ps++; } }
  if (act(165)) { if (v(165)==="L" && isBat) ba++; if (v(165)==="R" && !isBat) pc++; }
  if (act(170)) { bp++; ba++; be++; pc++; ps++; }
  if (act(175)) { if (v(175)==="L" && isBat) { bp++; be++; } if (v(175)==="R" && !isBat) ps++; }
  if (act(180)) {
    var v180=v(180);
    if (v180==="L" && ct==="라이브") { bp+=2; ba+=2; be+=2; pc+=2; ps+=2; }
    if (typeof v180==="string"&&v180.startsWith("R:")) { var yr180=v180.split(":")[1]; if(!isBat){if(ct==="임팩트"){pc++;ps++;}else if(String(yr)===yr180){pc++;ps++;}} }
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
  bp += (sdState.uniP !== undefined ? sdState.uniP : 1);
  ba += (sdState.uniA !== undefined ? sdState.uniA : 1);
  be += (sdState.uniE !== undefined ? sdState.uniE : 1);
  pc += (sdState.uniC !== undefined ? sdState.uniC : 1);
  ps += (sdState.uniS !== undefined ? sdState.uniS : 1);

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
  if (isBat && sdState.capBatId) { bp += sdState.capBatP || 0; ba += sdState.capBatA || 0; be += sdState.capBatE || 0; }
  if (!isBat && sdState.capPitId) { pc += sdState.capPitC || 0; ps += sdState.capPitS || 0; }

  return isBat ? {p:bp,a:ba,e:be,_sdState:sdState} : {c:pc,s:ps,_sdState:sdState};
}

/* ================================================================
   HOOKS
   ================================================================ */
function useMedia(q){var _s=useState(false);var m=_s[0];var setM=_s[1];useEffect(function(){var mq=window.matchMedia(q);var fn=function(e){setM(e.matches);};setM(mq.matches);if(mq.addEventListener){mq.addEventListener("change",fn);}else{mq.addListener(fn);}return function(){if(mq.removeEventListener){mq.removeEventListener("change",fn);}else{mq.removeListener(fn);}};}, [q]);return m;}

function useData(userId, sdState, setSdState){
  var _p=useState([]);var players=_p[0];var setPlayers=_p[1];
  var _lm=useState({});var lineupMap=_lm[0];var setLineupMap=_lm[1];
  var _sk=useState(DEFAULT_SKILLS);var skills=_sk[0];var setSkills=_sk[1];
  var _lo=useState(true);var loading=_lo[0];var setLoading=_lo[1];
  var uidRef=React.useRef(userId);uidRef.current=userId;

  useEffect(function(){
    if(!userId)return;
    (async function(){
      if(supabase){
        /* Load user data from Supabase */
        var ud=await loadUserData(userId);
        if(ud && ud.players && ud.players.length>0){
          setPlayers(ud.players);
          if(ud.lineupMap)setLineupMap(ud.lineupMap);
          if(ud.sdConfig)setSdState(ud.sdConfig);
        }else{
          setPlayers(SEED_PLAYERS);setLineupMap(SEED_LINEUP);
          await saveUserData(userId,{players:SEED_PLAYERS,lineupMap:SEED_LINEUP,sdConfig:{liveSetPo:0}});
        }
        /* Load global skills from Supabase */
        var gsk=await loadGlobalSkills();
        if(gsk && gsk["타자"]){setSkills(gsk);SKILL_DATA=gsk;if(gsk.weights)LIVE_WEIGHTS=gsk.weights;}
        else{setSkills(DEFAULT_SKILLS);SKILL_DATA=DEFAULT_SKILLS;}
      }else{
        /* Fallback: localStorage */
        var ver=await sGet(SK.version);var needReset=(!ver||ver<DATA_VERSION);
        if(needReset){await sSet(SK.version,DATA_VERSION);}
        var p2=await sGet(SK.players);
        if(!needReset&&p2&&p2.length>=SEED_PLAYERS.length){setPlayers(p2);}else{setPlayers(SEED_PLAYERS);await sSet(SK.players,SEED_PLAYERS);}
        var lm2=await sGet(SK.lineupMap);
        if(!needReset&&lm2&&Object.keys(lm2).length>0){setLineupMap(lm2);}else{setLineupMap(SEED_LINEUP);await sSet(SK.lineupMap,SEED_LINEUP);}
        var sk2=await sGet(SK.skills);
        if(!needReset&&sk2&&sk2["타자"]){setSkills(sk2);SKILL_DATA=sk2;if(sk2.weights)LIVE_WEIGHTS=sk2.weights;}else{setSkills(DEFAULT_SKILLS);SKILL_DATA=DEFAULT_SKILLS;await sSet(SK.skills,DEFAULT_SKILLS);}
      }
      setLoading(false);
    })();
  },[userId]);

  SKILL_DATA=skills;if(skills.weights)LIVE_WEIGHTS=skills.weights;

  var dbSave=useCallback(async function(np,nlm,nsd){
    if(supabase&&uidRef.current){await saveUserData(uidRef.current,{players:np,lineupMap:nlm,sdConfig:nsd});}
  },[]);

  var saveP=useCallback(async function(d){
    setPlayers(d);
    if(supabase&&uidRef.current){await saveUserData(uidRef.current,{players:d,lineupMap:lineupMap,sdConfig:sdState});}
    else{await sSet(SK.players,d);}
  },[lineupMap,sdState]);

  var saveLM=useCallback(async function(d){
    setLineupMap(d);
    if(supabase&&uidRef.current){await saveUserData(uidRef.current,{players:players,lineupMap:d,sdConfig:sdState});}
    else{await sSet(SK.lineupMap,d);}
  },[players,sdState]);

  var saveSK=useCallback(async function(d){
    setSkills(d);SKILL_DATA=d;
    if(supabase){await saveGlobalSkills(d);}
    else{await sSet(SK.skills,d);}
  },[]);

  var saveSdState=useCallback(async function(nsd){
    if(supabase&&uidRef.current){await saveUserData(uidRef.current,{players:players,lineupMap:lineupMap,sdConfig:nsd});}
  },[players,lineupMap]);

  return{players:players,lineupMap:lineupMap,skills:skills,loading:loading,savePlayers:saveP,saveLineupMap:saveLM,saveSkills:saveSK,saveSdState:saveSdState};
}

/* ================================================================
   UI COMPONENTS
   ================================================================ */

/* ================================================================
   PLAYER CARD COMPONENT - 카드 스타일 선수 표시
   ================================================================ */
var CARD_COLORS = {"골든글러브":"#D4AF37","시그니처":"#E91E63","국가대표":"#2196F3","임팩트":"#9C27B0","라이브":"#FF9800","시즌":"#4CAF50","올스타":"#00BCD4"};
var CARD_BG = {"골든글러브":"linear-gradient(135deg,#D4AF37,#F5E6A3,#D4AF37)","시그니처":"linear-gradient(135deg,#E91E63,#F48FB1,#E91E63)","국가대표":"linear-gradient(135deg,#2196F3,#90CAF9,#2196F3)","임팩트":"linear-gradient(135deg,#9C27B0,#CE93D8,#9C27B0)","라이브":"linear-gradient(135deg,#FF9800,#FFE0B2,#FF9800)","시즌":"linear-gradient(135deg,#4CAF50,#A5D6A7,#4CAF50)","올스타":"linear-gradient(135deg,#00BCD4,#80DEEA,#00BCD4)"};
function PlayerCard(p) {
  var pl = p.player; var size = p.size || "md"; var score = p.score;
  if (!pl) return null;
  var ct = pl.cardType || "시즌";
  var bg = CARD_BG[ct] || CARD_BG["시즌"];
  var borderC = CARD_COLORS[ct] || "#555";
  var isDark = ct === "골든글러브";
  var txtC = isDark ? "#1a1100" : "#fff";
  var w = size === "sm" ? 52 : size === "lg" ? 80 : 64;
  var h = size === "sm" ? 72 : size === "lg" ? 110 : 88;
  var fs = size === "sm" ? 7 : size === "lg" ? 10 : 8;
  var starSize = size === "sm" ? 5 : size === "lg" ? 8 : 6;
  var stars = pl.stars || CARD_STARS[ct] || 5;
  var starStr = "";
  for (var si = 0; si < stars; si++) starStr += "★";
  var photoUrl = pl.photoUrl;

  return (
    <div style={{ width: w, height: h, borderRadius: 6, background: bg, border: "2px solid " + borderC, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0, position: "relative" }}>
      {/* Score badge */}
      {score !== undefined && (
        <div style={{ position: "absolute", top: 2, left: 2, background: "rgba(0,0,0,0.65)", borderRadius: 4, padding: "1px 4px", zIndex: 2 }}>
          <span style={{ fontSize: size === "lg" ? 14 : 11, fontWeight: 900, color: "#FFD700", fontFamily: "var(--m)" }}>{score}</span>
        </div>
      )}
      {/* Position badge */}
      <div style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,0.5)", borderRadius: 3, padding: "1px 3px", zIndex: 2 }}>
        <span style={{ fontSize: fs, fontWeight: 700, color: "#fff" }}>{pl.subPosition || ""}</span>
      </div>
      {/* Team badge */}
      {pl.team && (<div style={{ position: "absolute", top: size==="lg"?16:12, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}>
        <span style={{ fontSize: size==="sm"?5:6, fontWeight: 700, color: "rgba(255,255,255,0.7)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>{pl.team}</span>
      </div>)}
      {/* Photo area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: photoUrl ? "none" : "rgba(255,255,255,0.15)" }}>
        {photoUrl ? (
          <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: size === "lg" ? 28 : 20, opacity: 0.4 }}>{"⚾"}</span>
        )}
      </div>
      {/* Enhance badge */}
      {pl.enhance && (
        <div style={{ position: "absolute", bottom: size === "lg" ? 28 : 22, left: 2, zIndex: 2 }}>
          <span style={{ fontSize: fs, fontWeight: 800, color: "#fff", background: "#E53935", borderRadius: 3, padding: "1px 3px" }}>{"+" + (pl.enhance || "").replace(/[^0-9]/g, "")}</span>
        </div>
      )}
      {/* Bottom info */}
      <div style={{ background: "rgba(0,0,0,0.55)", padding: "2px 3px 3px", textAlign: "center" }}>
        <div style={{ fontSize: starSize, color: "#FFD700", lineHeight: 1 }}>{starStr}</div>
        <div style={{ fontSize: fs, fontWeight: 700, color: txtC === "#1a1100" ? "#fff" : "#fff", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.name}</div>
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

  var candidates = players.filter(function(pl) {
    if (isBench) return pl.role === "타자";
    if (isBatSlot) {
      if (pl.role !== "타자") return false;
      if (slot === "DH") return true;
      return pl.subPosition === slot;
    } else {
      if (pl.role !== "투수") return false;
      return pl.subPosition === slot;
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
              <div style={{ fontSize: 10, color: "var(--td)", marginTop: 2 }}>{isBatSlot ? (slot === "DH" ? "모든 타자" : slot + " 포지션") : (isBench ? "후보 (타자)" : slot + " 투수")}{" · " + total + "명"}</div>
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
        <select value={p.value} onChange={function(e){p.onChange(e.target.value);}} style={{width:"100%",padding:"8px 10px",fontSize:13,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t1)",outline:"none",boxSizing:"border-box"}}>
          {p.options.map(function(o){return(<option key={o} value={o}>{o}</option>);})}
        </select>
      ):(
        <input type={p.type||"text"} value={p.value} onChange={function(e){p.onChange(e.target.value);}} placeholder={p.ph||""}
          style={{width:"100%",padding:"8px 10px",fontSize:13,background:"var(--inner)",border:"1px solid var(--bd)",borderRadius:6,color:"var(--t1)",outline:"none",boxSizing:"border-box"}} />
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
  var players=p.players;var save=p.savePlayers;var mob=p.mobile;
  var _t=useState("골든글러브");var at=_t[0];var setAt=_t[1];
  var _e=useState(null);var editing=_e[0];var setEditing=_e[1];
  var _f=useState(null);var form=_f[0];var setForm=_f[1];

  var filtered=players.filter(function(x){return x.cardType===at;});

  var newP=function(role){
    var base={id:"p_"+Date.now(),cardType:at,role:role,name:"",year:"",hand:"우",stars:CARD_STARS[at]||5,subPosition:role==="타자"?"RF":"SP1"};
    if(role==="타자"){Object.assign(base,{power:0,accuracy:0,eye:0,patience:0,running:0,defense:0,launchAngle:0,hotColdZone:0,subPosition:""});}
    else{Object.assign(base,{position:"선발",change:0,stuff:0,speed:0,control:0,stamina:0,defense:0});}
    setForm(base);setEditing("new");
  };

  var editP=function(pl){setForm(Object.assign({},pl));setEditing(pl.id);};
  var uf=function(k,v){setForm(function(prev){var c=Object.assign({},prev);c[k]=v;return c;});};

  var saveF=function(){
    if(!form||!form.name)return;
    var upd=editing==="new"?players.concat([form]):players.map(function(x){return x.id===form.id?form:x;});
    save(upd);setEditing(null);setForm(null);
  };
  var delP=function(id){save(players.filter(function(x){return x.id!==id;}));setEditing(null);setForm(null);};

  return(
    <div style={{padding:mob?12:18,maxWidth:1000,paddingBottom:mob?80:18}}>
      <h2 style={{fontSize:mob?16:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 4px"}}>{"선수 도감"}</h2>
      <p style={{fontSize:10,color:"var(--td)",margin:"0 0 12px"}}>{"관리자 전용 - 선수 기본 데이터를 등록/수정합니다"}</p>

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
              {form.cardType==="라이브"?(<Inp label="별(1~5)" type="select" value={String(form.stars||3)} onChange={function(v){uf("stars",parseInt(v));}} options={["1","2","3","4","5"]} />):(<div><div style={{fontSize:10,color:"var(--td)",marginBottom:4}}>{"별"}</div><span style={{fontSize:14,color:"var(--acc)"}}>{"★"+(CARD_STARS[form.cardType]||5)}</span></div>)}
              {form.role==="타자"?(<Inp label="포지션" type="select" value={form.subPosition} onChange={function(v){uf("subPosition",v);}} options={BAT_POS} />):(<Inp label="역할" type="select" value={form.position||"선발"} onChange={function(v){uf("position",v);uf("subPosition",(PIT_POS_MAP[v]||["SP1"])[0]);}} options={["선발","중계","마무리"]} />)}
            </div>
            {form.role==="타자"&&null}
            {form.cardType==="임팩트"&&(<Inp label="종류" value={form.impactType||""} onChange={function(v){uf("impactType",v);}} ph="좌완에이스,안방마님..." />)}
            {form.cardType==="라이브"&&(<Inp label="세트덱스코어" type="number" value={form.setScore||0} onChange={function(v){uf("setScore",parseInt(v)||0);}} />)}
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
                  var added2 = 0; var updated2 = 0; var np = players.slice();
                  var cm = {"골든글러브(타자)":"골든글러브","골든글러브(투수)":"골든글러브","시그니처(타자)":"시그니처","시그니처(투수)":"시그니처","국가대표(타자)":"국가대표","국가대표(투수)":"국가대표","임팩트(타자)":"임팩트","임팩트(투수)":"임팩트","라이브(타자)":"라이브","라이브(투수)":"라이브","시즌(타자)":"시즌","시즌(투수)":"시즌","올스타(타자)":"올스타","올스타(투수)":"올스타"};
                  var sm = {"골든글러브":5,"시그니처":5,"국가대표":5,"임팩트":4};
                  wb2.SheetNames.forEach(function(sn2) { if (sn2==="안내"||sn2==="임팩트종류") return; var ct2=cm[sn2]; if(!ct2)return; var iB=sn2.indexOf("타자")>=0;
                    XL.utils.sheet_to_json(wb2.Sheets[sn2],{defval:""}).forEach(function(row) {
                      var nm=String(row["이름"]||"").replace(/[0-9]/g,"").trim(); if(!nm)return;
                      var yr=String(row["연도"]||""); var ex=null;
                      for(var i=0;i<np.length;i++){if((np[i].name||"").replace(/[0-9]/g,"").trim()===nm&&np[i].cardType===ct2&&String(np[i].year||"")===yr){ex=i;break;}}
                      var pl2=ex!==null?Object.assign({},np[ex]):{id:"db"+Date.now()+"_"+Math.random().toString(36).slice(2,6)};
                      pl2.cardType=ct2;pl2.name=nm;pl2.year=yr;pl2.team=row["팀"]||"";pl2.hand=row["손잡이"]||"우";pl2.role=iB?"타자":"투수";pl2.stars=row["별"]?parseInt(row["별"]):(sm[ct2]||5);
                      if(iB){pl2.subPosition=row["세부포지션"]||"DH";pl2.power=parseInt(row["파워"])||0;pl2.accuracy=parseInt(row["정확"])||0;pl2.eye=parseInt(row["선구"])||0;}
                      else{pl2.position=row["역할"]||"선발";pl2.subPosition=pl2.subPosition||"SP1";pl2.speed=parseInt(row["구속"])||0;pl2.change=parseInt(row["변화"])||0;pl2.stuff=parseInt(row["구위"])||0;}
                      if(ct2==="임팩트")pl2.impactType=row["임팩트종류"]||"";
                      if(ct2==="라이브"){pl2.setScore=parseInt(row["세트덱스코어"])||0;pl2.liveType=row["라이브종류"]||"";}
                      if(ex!==null){np[ex]=pl2;updated2++;}else{np.push(pl2);added2++;}
                    });
                  });
                  save(np); alert("완료! 추가:"+added2+"명 업데이트:"+updated2+"명");
                } catch(err) { alert("오류: "+err.message); }
              }; rd.readAsArrayBuffer(f2); e.target.value="";
            }} />
          </label>
          <button onClick={function() {
            var XL=window.XLSX; if(!XL){alert("잠시 후 다시 시도하세요.");return;}
            var wb3=XL.utils.book_new(); var cts=["골든글러브","시그니처","국가대표","임팩트","라이브","시즌","올스타"]; var sm2={"골든글러브":5,"시그니처":5,"국가대표":5,"임팩트":4};
            cts.forEach(function(ct3){["타자","투수"].forEach(function(role2){
              var pls2=players.filter(function(x){return x.cardType===ct3&&x.role===role2;});
              var rows2=pls2.map(function(pl3){
                var rw={"팀":pl3.team||"","이름":(pl3.name||"").replace(/[0-9]/g,""),"연도":pl3.year||"","손잡이":pl3.hand||""};
                if(role2==="타자"){rw["세부포지션"]=pl3.subPosition||"";rw["파워"]=pl3.power||0;rw["정확"]=pl3.accuracy||0;rw["선구"]=pl3.eye||0;}
                else{rw["역할"]=pl3.position||"선발";rw["구속"]=pl3.speed||0;rw["변화"]=pl3.change||0;rw["구위"]=pl3.stuff||0;}
                if(ct3==="임팩트")rw["임팩트종류"]=pl3.impactType||"";
                if(!sm2[ct3])rw["별"]=pl3.stars||5;
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
            {b ? (<PlayerCard player={b} size={mob?"sm":"sm"} />) : (
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
      <PlayerCard player={d} size="md" />
    </div>
  );
}

/* ================================================================
   BULLPEN DROPDOWN + LAYOUT
   ================================================================ */
var BPC = [{label:"1/1/4",w:1,l:1,r:4},{label:"1/2/3",w:1,l:2,r:3},{label:"1/3/2",w:1,l:3,r:2},{label:"2/1/3",w:2,l:1,r:3},{label:"2/2/2",w:2,l:2,r:2},{label:"2/3/1",w:2,l:3,r:1},{label:"3/1/2",w:3,l:1,r:2},{label:"3/2/1",w:3,l:2,r:1}];

function BullpenLayout(p) {
  var mob = p.mobile;
  var rps = p.relievers;
  var cps = p.closers;
  var rpSlots = p.rpSlots || [];
  var onSlotClick = p.onSlotClick;
  var _i = useState(4); var idx = _i[0]; var setIdx = _i[1];
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
var SET_POINTS = {"골든글러브":6,"시그니처":8,"임팩트":7,"국가대표":8,"시즌":0,"라이브":0,"올스타":0};
var CARD_STARS = {"골든글러브":5,"시그니처":5,"임팩트":4,"국가대표":5};

/* Complete set deck rules: L/R radio selection */
var SD_ROWS = [
  {sp:30,type:"auto",desc:"모두 +1"},
  {sp:40,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:50,type:"lr",lDesc:"시즌/라이브 +1",rDesc:"골든/시그/임팩/국대 +1"},
  {sp:55,type:"yearR",rDesc:"투수 변화: 임팩트+2, 연도매치+2"},
  {sp:60,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:65,type:"lr",lDesc:"3성 +2",rDesc:"4성 타자 정확 +2"},
  {sp:70,type:"lr",lDesc:"투수 +1",rDesc:"불펜 +2"},
  {sp:75,type:"yearLR",lDesc:"타자 파정 +3 (연도선택)",rDesc:"투수 구위 +3 (연도선택)"},
  {sp:80,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:85,type:"lr",lDesc:"4성 +2",rDesc:"5성 정구 +1"},
  {sp:90,type:"auto",desc:"모두 +2"},
  {sp:95,type:"auto",desc:"RF/CF/LF/DH 선구 +2"},
  {sp:100,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:105,type:"lr",lDesc:"3성 +2",rDesc:"4성 타자 파선 +2 & 투수 변구 +2"},
  {sp:110,type:"auto",desc:"모두 +1"},
  {sp:115,type:"lr",lDesc:"6~9번 정확 +2",rDesc:"불펜 구위 +2"},
  {sp:120,type:"lr",lDesc:"3~5번 +2",rDesc:"투수 +1"},
  {sp:125,type:"auto",desc:"4성 정선 +1 & 변화 +2"},
  {sp:130,type:"lr",lDesc:"시즌/라이브 +1",rDesc:"골든/시그/임팩/국대 +1"},
  {sp:135,type:"lr",lDesc:"3~5번 정확 +2",rDesc:"선발 구위 +1"},
  {sp:140,type:"lr",lDesc:"6~9번 +1",rDesc:"불펜 +1"},
  {sp:145,type:"lr",lDesc:"1~2번 정선 +2",rDesc:"선발 구위 +1"},
  {sp:150,type:"auto",desc:"모두 +2"},
  {sp:155,type:"lr",lDesc:"1~2번 파선 +2",rDesc:"투수 변화 +1"},
  {sp:160,type:"lr",lDesc:"타자 +1",rDesc:"투수 +1"},
  {sp:165,type:"lr",lDesc:"타자 정확 +1",rDesc:"투수 변화 +1"},
  {sp:170,type:"auto",desc:"모두 +1"},
  {sp:175,type:"lr",lDesc:"타자 파선 +1",rDesc:"구위 +1"},
  {sp:180,type:"lrYear",lDesc:"라이브 +2",rDesc:"투수 연도 +1"},
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
            <select value={val} onChange={active ? function(e) { upd(k, e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: val ? "var(--acp)" : "var(--t1)", outline: "none" }}>
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
          {side && (<select value={yearV} onChange={active ? function(e) { upd(k, side + ":" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: "var(--t1)", outline: "none" }}>
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
          {isR && (<select value={yrVal} onChange={active ? function(e) { upd(k, "R:" + e.target.value); } : undefined} disabled={!active} style={{ width: 65, padding: "4px", fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: "var(--acp)", outline: "none" }}>
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
                  <select value={cur} onChange={function(e) { upd(sp.key, e.target.value); }} style={{ width: 65, padding: "3px", fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: cur!=="없음"?"#2E86C1":"var(--t1)", fontWeight: cur!=="없음"?700:400, outline: "none" }}>
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
  var _dragOver = useState(null); var dragOverSlot = _dragOver[0]; var setDragOverSlot = _dragOver[1];
  var _sdOpen = useState(false); var sdOpen = _sdOpen[0]; var setSdOpen = _sdOpen[1];
  var sdState = p.sdState; var setSdState = p.setSdState;
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
  var pick = function(slot) { return byId(lm[slot]); };

  /* Assign player to slot */
  var assignSlot = function(slot, playerId) {
    var next = Object.assign({}, lm);
    next[slot] = playerId;
    saveLM(next);
    /* Auto-set subPosition for pitchers */
    var pl = byId(playerId);
    if (pl && pl.role === "투수" && pl.subPosition !== slot) {
      save(players.map(function(x) { if (x.id !== playerId) return x; var c = Object.assign({}, x); c.subPosition = slot; return c; }));
    }
    setPickerSlot(null);
  };
  var swapSlots = function(fromSlot, toSlot) {
    if (fromSlot === toSlot) return;
    var next = Object.assign({}, lm);
    var tmp = next[fromSlot];
    next[fromSlot] = next[toSlot];
    next[toSlot] = tmp;
    saveLM(next);
    setDragSlot(null);
    setDragOverSlot(null);
  };
  var BAT_SLOTS = ["C","1B","2B","3B","SS","LF","CF","RF","DH"];
  var SP_SLOTS = ["SP1","SP2","SP3","SP4","SP5"];
  var RP_SLOTS = ["RP1","RP2","RP3","RP4","RP5","RP6"];

  var lBats = BAT_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lSP = SP_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lRP = RP_SLOTS.map(function(s) { return { slot: s, pl: pick(s) }; });
  var lCP = { slot: "CP", pl: pick("CP") };

  /* Build slot -> player map for diamond */
  var batSlotMap = {};
  BAT_SLOTS.forEach(function(s) { var pl = pick(s); if (pl) batSlotMap[s] = pl; });

  /* Auto-calculate set points from lineup card types */
  var calcSetPoint = function() {
    var total = 0;
    var allSlots = BAT_SLOTS.concat(SP_SLOTS).concat(RP_SLOTS).concat(["CP"]);
    allSlots.forEach(function(slot) {
      var pl = pick(slot);
      if (!pl) return;
      var sc = pl.cardType === "라이브" ? (pl.setScore || 0) : (SET_POINTS[pl.cardType] || 0);
      if (pl.isFa) sc = Math.max(0, sc - 1);
      total += sc;
    });
    for (var bn = 1; bn <= 6; bn++) {
      var bnPl = pick("BN" + bn);
      if (!bnPl) continue;
      var bnSc = bnPl.cardType === "라이브" ? (bnPl.setScore || 0) : (SET_POINTS[bnPl.cardType] || 0);
      if (bnPl.isFa) bnSc = Math.max(0, bnSc - 1);
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
  var calcBatSD = function(pl, slot) { return calcBat(pl, mkLuB(pl), calcSDBonus(pl, slot, sdState, totalSP)); };
  var calcPitSD = function(pl, slot) { return calcPit(pl, mkLuB(pl), calcSDBonus(pl, slot, sdState, totalSP)); };

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
    lRP.forEach(function(x) { if (!x.pl) return; t += calcPitSD(x.pl, x.slot).total * (x.pl.weight || 0); });
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
          style={{ width: 90, padding: "3px 2px", fontSize: 9, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", outline: "none" }}>
          <option value="">{"없음"}</option>
          {opts.map(function(s) { return (<option key={s} value={s}>{s}</option>); })}
        </select>
        <select value={pl[lvField] || 0} onChange={function(e) { updatePl(pl.id, lvField, parseInt(e.target.value)); }}
          style={{ width: 38, padding: "3px 1px", fontSize: 10, background: "var(--inner)", border: "1px solid " + c + "44", borderRadius: 3, color: c, fontFamily: "var(--m)", fontWeight: 700, outline: "none", textAlign: "center" }}>
          {[0,5,6,7,8,9,10].map(function(v) { return (<option key={v} value={v}>{v === 0 ? "-" : "Lv" + v}</option>); })}
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
          onDragStart={function(e) { setDragSlot(slot); e.dataTransfer.effectAllowed = "move"; }}
          onDragOver={function(e) { e.preventDefault(); setDragOverSlot(slot); }}
          onDragLeave={function() { if (dragOverSlot === slot) setDragOverSlot(null); }}
          onDrop={function(e) { e.preventDefault(); if (dragSlot && dragSlot !== slot) swapSlots(dragSlot, slot); }}
          onDragEnd={function() { setDragSlot(null); setDragOverSlot(null); }}
          onClick={function() { setSelId(isSel ? null : pl.id); }}
          style={{ display: "grid", gridTemplateColumns: mob ? "28px 56px 1fr 46px" : "32px 68px minmax(100px,1fr) 80px 120px 75px 46px 110px 40px 46px", alignItems: "center", gap: 28, padding: "8px 10px", background: dragOverSlot === slot ? "rgba(255,213,79,0.12)" : isSel ? "var(--ta)" : (idx % 2 === 0 ? "var(--re)" : "transparent"), borderBottom: "1px solid var(--bd)", cursor: "grab", borderLeft: dragOverSlot === slot ? "3px solid var(--acc)" : isSel ? "3px solid var(--acc)" : "3px solid transparent", transition: "background 0.15s" }}>
          <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, color: "var(--acc)", fontFamily: "var(--h)", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
            {idx > 0 && (<span onClick={function(e) { e.stopPropagation(); swapSlots(BAT_SLOTS[idx], BAT_SLOTS[idx-1]); }} style={{ fontSize: 10, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▲"}</span>)}
            <span>{idx + 1}</span>
            {idx < 8 && (<span onClick={function(e) { e.stopPropagation(); swapSlots(BAT_SLOTS[idx], BAT_SLOTS[idx+1]); }} style={{ fontSize: 10, cursor: "pointer", color: "var(--td)", lineHeight: 1 }}>{"▼"}</span>)}
          </div>
          <PlayerCard player={pl} size={mob?"sm":"md"} score={Math.round(calc.total)} />
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
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"훈련"}</div>
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
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "var(--acc)", fontFamily: "var(--m)" }}>{Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,"타자")+getSkillScore(pl.skill2,pl.s2Lv||0,"타자")+getSkillScore(pl.skill3,pl.s3Lv||0,"타자"))*100)/100 || ""}</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{(pl.pot1 || "-") + "/" + (pl.pot2 || "-")}</div>
            </div>
          </React.Fragment>)}
        </div>
        {isSel && (<div style={{ padding: "8px 14px", background: "rgba(255,213,79,0.02)", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 12, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: "var(--t1)", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 13, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "trainP", pl.trainP, "#EF5350")}<span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "trainA", pl.trainA, "#42A5F5")}<span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "trainE", pl.trainE, "#66BB6A")}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#EF5350" }}>{"파"}</span>{miniIn(pl.id, "specPower", pl.specPower, "#EF5350", 15)}<span style={{ fontSize: 11, color: "#42A5F5" }}>{"정"}</span>{miniIn(pl.id, "specAccuracy", pl.specAccuracy, "#42A5F5", 15)}<span style={{ fontSize: 11, color: "#66BB6A" }}>{"선"}</span>{miniIn(pl.id, "specEye", pl.specEye, "#66BB6A", 15)}</div></div>
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3, alignItems: "center" }}><input value={pl.pot1 || ""} onChange={function(e) { updatePl(pl.id, "pot1", e.target.value); }} placeholder="풀" style={{ width: 40, padding: "2px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 10, outline: "none" }} /><input value={pl.pot2 || ""} onChange={function(e) { updatePl(pl.id, "pot2", e.target.value); }} placeholder="클" style={{ width: 40, padding: "2px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 10, outline: "none" }} /></div></div>
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
          <PlayerCard player={pl} size={mob?"sm":"md"} score={Math.round(calc.total)} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pl.cardType} /><span style={{ fontWeight: 700, color: "var(--t1)", fontSize: 16 }}>{pl.name}</span>{showWt && pl.weight !== undefined && (<span style={{ fontSize: 9, color: "#FF9800", fontFamily: "var(--m)", fontWeight: 700, background: "rgba(255,152,0,0.08)", borderRadius: 3, padding: "1px 4px" }}>{"×" + pl.weight}</span>)}</div>
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
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"훈련"}</div>
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
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: "var(--acp)", fontFamily: "var(--m)" }}>{(function(){var pt2=pl.position==="선발"?"선발":pl.position==="마무리"?"마무리":"중계";return Math.round((getSkillScore(pl.skill1,pl.s1Lv||0,pt2)+getSkillScore(pl.skill2,pl.s2Lv||0,pt2)+getSkillScore(pl.skill3,pl.s3Lv||0,pt2))*100)/100||"";})()}</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--td)" }}>{"잠재"}</div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>{(pl.pot1 || "-") + "/" + (pl.pot2 || "-")}</div>
            </div>
          </React.Fragment>)}
        </div>
        {isSel && (<div style={{ padding: "8px 14px", background: "rgba(206,147,216,0.03)", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"강화"}</div><select value={pl.enhance||""} onChange={function(e){updatePl(pl.id,"enhance",e.target.value);}} style={{ padding: "3px 4px", fontSize: 12, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: "var(--t1)", outline: "none" }}>{["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e){return(<option key={e} value={e}>{e}</option>);})}</select></div>
            {pl.cardType==="임팩트"&&pl.impactType&&(<div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"종류"}</div><span style={{ fontSize: 13, color: "#7D3C98", fontWeight: 700 }}>{pl.impactType}</span></div>)}
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"훈련"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "trainC", pl.trainC, "#AB47BC")}<span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "trainS", pl.trainS, "#FF7043")}</div></div>
            <div><div style={{ fontSize: 12, color: "var(--td)", marginBottom: 4 }}>{"특훈(0~15)"}</div><div style={{ display: "flex", gap: 4, alignItems: "center" }}><span style={{ fontSize: 11, color: "#AB47BC" }}>{"변"}</span>{miniIn(pl.id, "specChange", pl.specChange, "#AB47BC", 15)}<span style={{ fontSize: 11, color: "#FF7043" }}>{"구"}</span>{miniIn(pl.id, "specStuff", pl.specStuff, "#FF7043", 15)}</div></div>
            {showWt && (<div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"가중치"}</div><input type="number" step="0.1" min="0" max="1" value={pl.weight || 0} onChange={function(e) { updatePl(pl.id, "weight", parseFloat(e.target.value) || 0); }} style={{ width: 50, padding: "2px 4px", background: "var(--inner)", border: "1px solid rgba(255,152,0,0.3)", borderRadius: 3, color: "#FF9800", fontSize: 11, fontFamily: "var(--m)", fontWeight: 700, outline: "none" }} /></div>)}
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"잠재력"}</div><div style={{ display: "flex", gap: 3 }}><input value={pl.pot1 || ""} onChange={function(e) { updatePl(pl.id, "pot1", e.target.value); }} placeholder="-" style={{ width: 40, padding: "2px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 10, outline: "none" }} /><input value={pl.pot2 || ""} onChange={function(e) { updatePl(pl.id, "pot2", e.target.value); }} placeholder="-" style={{ width: 40, padding: "2px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 10, outline: "none" }} /></div></div>
            <div><div style={{ fontSize: 9, color: "var(--td)", marginBottom: 3 }}>{"스킬 ("+getSkillCat(pl)+")"}</div><div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{skillInput(pl,1)}{skillInput(pl,2)}{skillInput(pl,3)}</div></div>
          </div>
        </div>)}
      </React.Fragment>
    );
  };

  return (
    <div style={{ padding: mob ? 12 : 18, maxWidth: 1200, paddingBottom: mob ? 80 : 18 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: mob ? "flex-start" : "center", justifyContent: "space-between", flexDirection: mob ? "column" : "row", gap: 8, marginBottom: 14, padding: mob ? 14 : "18px 20px", background: "var(--card)", borderRadius: 12, border: "1px solid var(--bd)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: mob ? 18 : 22, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)" }}>{"MY LINEUP"}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--td)" }}>{"키움 히어로즈 · 타자 " + diamondPl + " · 선발 " + spPl.length + " · 중계 " + rpPl.length + " · 마무리 " + cpPl.length + ""}</p>
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
          <BullpenLayout mobile={mob} relievers={rpPl} closers={cpPl} rpSlots={rpSlotData} onSlotClick={function(slot) { setPickerSlot(slot); }} />
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
        <PlayerSelector slot={pickerSlot} players={players} onSelect={function(pid) { assignSlot(pickerSlot, pid); }} onClose={function() { setPickerSlot(null); }} />
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
        <select value={String(lv)} onChange={function(e) { upd(pos, "level", parseInt(e.target.value)); }} style={{ width: 50, padding: "4px 2px", textAlign: "center", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 4, color: "var(--t1)", fontSize: 12, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
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
            <select value={String(reset)} onChange={function(e) { upd(pos, "r" + i, parseInt(e.target.value)); }} style={{ width: 34, padding: "4px 1px", textAlign: "center", background: "var(--inner)", border: "1px solid " + colors[i] + "33", borderRadius: 4, color: colors[i], fontSize: 11, fontFamily: "var(--m)", fontWeight: 700, outline: "none", cursor: "pointer" }}>
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
function Nav(p){
  var _o=useState(false);var open=_o[0];var setOpen=_o[1];
  var tabs=[{id:"lineup",label:"라인업",icon:"📋"},{id:"myplayers",label:"내 선수",icon:"👥"},{id:"postrain",label:"포지션 특훈",icon:"🏋️"},{id:"locker",label:"라커룸",icon:"🏠"},{id:"community",label:"커뮤니티",icon:"💬"}];
  if(p.isAdmin){tabs.splice(4,0,{id:"db",label:"선수 도감",icon:"📖"},{id:"skills",label:"스킬 관리",icon:"⚡"},{id:"enhance",label:"강화 테이블",icon:"📊"});}


  if(p.mobile){return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"var(--side)",borderTop:"1px solid var(--bd)",display:"flex",padding:"6px 0 8px"}}>
      {tabs.map(function(t){return(<button key={t.id} onClick={function(){p.setTab(t.id);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 0",background:"none",border:"none",color:p.tab===t.id?"var(--acc)":"var(--td)",cursor:"pointer",minHeight:44}}><span style={{fontSize:18}}>{t.icon}</span><span style={{fontSize:9,fontWeight:p.tab===t.id?700:500}}>{t.label}</span></button>);})}
    </div>
  );}

  if(p.tablet){return(
    <React.Fragment>
      <button onClick={function(){setOpen(!open);}} style={{position:"fixed",top:10,left:10,zIndex:200,width:40,height:40,borderRadius:8,background:"var(--card)",border:"1px solid var(--bd)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,color:"var(--t1)"}}>{open?"✕":"☰"}</button>
      {open&&(<div onClick={function(){setOpen(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:150}}/>)}
      <div style={{position:"fixed",left:open?0:-260,top:0,bottom:0,width:240,background:"var(--side)",borderRight:"1px solid var(--bd)",zIndex:160,transition:"left 0.25s ease",display:"flex",flexDirection:"column",padding:"60px 0 16px"}}>
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
      <div style={{padding:"0 14px",marginBottom:24}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>{"⚾"}</span><div><div style={{fontSize:12,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,background:"linear-gradient(135deg,#FFD54F,#FF8F00)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",color:"transparent"}}>{"DECK MANAGER"}</div><div style={{fontSize:7,color:"var(--td)",letterSpacing:1}}>{"COM2US PRO BASEBALL v26"}</div></div></div></div>
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
          <div><div style={{fontSize:10,fontWeight:700,color:"var(--t1)"}}>{p.user}</div><div style={{fontSize:7,color:"var(--td)"}}>{p.authType==="google"?"Google 계정":"게스트 (1팀)"}</div></div>
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
  var upd = function(key, val) { setSdState(function(prev) { var c = Object.assign({}, prev); c[key] = val; return c; }); };
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

  /* POTM roster (admin-managed names) */
  var potmNames = sdState.potmNames || [];
  var addPotm = function() {
    if (!newPotm.trim()) return;
    upd("potmNames", potmNames.concat([newPotm.trim()]));
    setNewPotm("");
  };
  var rmPotm = function(idx) { upd("potmNames", potmNames.filter(function(_, i) { return i !== idx; })); };

  /* Match POTM names to lineup */
  var potmMatched = [];
  var allLineup = lineupBats.concat(lineupPits);
  potmNames.forEach(function(pname) {
    allLineup.forEach(function(pl) {
      if (pl.name.indexOf(pname) >= 0 || pname.indexOf(pl.name) >= 0) {
        if (potmMatched.indexOf(pl) < 0) potmMatched.push(pl);
      }
    });
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
          <select value={batCapId} onChange={function(e) { upd("capBatId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 12, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupBats.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + " (" + pl.subPosition + ")"}</option>); })}
          </select>
          {batCap && (<div style={{ padding: "6px 8px", background: "var(--ta)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={batCap.cardType} /><span style={{ fontWeight: 700, fontSize: 12, color: "var(--t1)" }}>{batCap.name}</span><span style={{ fontSize: 14, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (전체 타자 적용)"}</div>
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
          <select value={pitCapId} onChange={function(e) { upd("capPitId", e.target.value); }} style={{ width: "100%", padding: "8px 10px", fontSize: 12, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none", marginBottom: 8, boxSizing: "border-box" }}>
            <option value="">{"선택 안 함"}</option>
            {lineupPits.map(function(pl) { return (<option key={pl.id} value={pl.id}>{pl.name + " (" + pl.subPosition + ")"}</option>); })}
          </select>
          {pitCap && (<div style={{ padding: "6px 8px", background: "rgba(206,147,216,0.06)", borderRadius: 6, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Badge type={pitCap.cardType} /><span style={{ fontWeight: 700, fontSize: 12, color: "var(--t1)" }}>{pitCap.name}</span><span style={{ fontSize: 14, marginLeft: "auto" }}>{"👑"}</span></div>
          </div>)}
          <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 4 }}>{"주장 능력치 보너스 (전체 투수 적용)"}</div>
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
                  <input type="number" value={sdState[s.k] || 1} onChange={function(e) { upd(s.k, parseInt(e.target.value) || 0); }}
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
          <button onClick={function() {
            save(players.map(function(x) { var c = Object.assign({}, x); c.potmP = 0; c.potmA = 0; c.potmE = 0; c.potmC = 0; c.potmS = 0; return c; }));
          }} style={{ padding: "3px 8px", fontSize: 8, background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.2)", borderRadius: 3, color: "#EF5350", cursor: "pointer" }}>{"보너스 초기화"}</button>
        </div>

        {/* Admin: manage POTM roster */}
        {isAdmin && (
          <div style={{ padding: 10, background: "var(--inner)", borderRadius: 8, border: "1px solid var(--bd)", marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 6 }}>{"관리자: POTM 선수 명단 (이름으로 라인업 자동 매칭)"}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input type="text" value={newPotm} onChange={function(e) { setNewPotm(e.target.value); }} placeholder="선수 이름 입력" onKeyDown={function(e) { if (e.key === "Enter") addPotm(); }}
                style={{ flex: 1, padding: "6px 10px", fontSize: 12, background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none" }} />
              <button onClick={addPotm} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 6, color: "#1a1100", cursor: "pointer" }}>{"추가"}</button>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {potmNames.map(function(n, i) {
                return (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.2)", borderRadius: 4, fontSize: 10, color: "var(--acc)" }}>
                  {n}
                  <button onClick={function() { rmPotm(i); }} style={{ background: "none", border: "none", color: "rgba(239,83,80,0.6)", cursor: "pointer", fontSize: 10, padding: 0, marginLeft: 2 }}>{"×"}</button>
                </span>);
              })}
              {potmNames.length === 0 && (<span style={{ fontSize: 10, color: "var(--td)" }}>{"등록된 POTM 선수가 없습니다"}</span>)}
            </div>
          </div>
        )}

        {/* Matched POTM players with manual stat inputs */}
        {potmMatched.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {potmMatched.map(function(pl) {
              var isBat = pl.role === "타자";
              var hasPotm = (pl.potmP || 0) + (pl.potmA || 0) + (pl.potmE || 0) + (pl.potmC || 0) + (pl.potmS || 0) > 0;
              return (
                <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 6, background: hasPotm ? "rgba(255,213,79,0.06)" : "var(--inner)", border: hasPotm ? "1px solid rgba(255,213,79,0.2)" : "1px solid var(--bd)" }}>
                  {hasPotm && (<span style={{ fontSize: 10, flexShrink: 0 }}>{"🌟"}</span>)}
                  <Badge type={pl.cardType} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--t1)", minWidth: 50 }}>{pl.name}</span>
                  <span style={{ fontSize: 8, color: "var(--td)" }}>{pl.subPosition}</span>
                  <div style={{ display: "flex", gap: 3, alignItems: "center", marginLeft: "auto" }}>
                    {isBat ? (
                      <React.Fragment>
                        <span style={{ fontSize: 8, color: "#EF5350" }}>{"파"}</span>
                        <input type="number" value={pl.potmP || 0} onChange={function(e) { updPotm(pl.id, "potmP", e.target.value); }} style={{ width: 26, padding: "2px", textAlign: "center", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 3, color: "#EF5350", fontSize: 10, fontFamily: "var(--m)", outline: "none" }} />
                        <span style={{ fontSize: 8, color: "#42A5F5" }}>{"정"}</span>
                        <input type="number" value={pl.potmA || 0} onChange={function(e) { updPotm(pl.id, "potmA", e.target.value); }} style={{ width: 26, padding: "2px", textAlign: "center", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 3, color: "#42A5F5", fontSize: 10, fontFamily: "var(--m)", outline: "none" }} />
                        <span style={{ fontSize: 8, color: "#66BB6A" }}>{"선"}</span>
                        <input type="number" value={pl.potmE || 0} onChange={function(e) { updPotm(pl.id, "potmE", e.target.value); }} style={{ width: 26, padding: "2px", textAlign: "center", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 3, color: "#66BB6A", fontSize: 10, fontFamily: "var(--m)", outline: "none" }} />
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <span style={{ fontSize: 8, color: "#AB47BC" }}>{"변"}</span>
                        <input type="number" value={pl.potmC || 0} onChange={function(e) { updPotm(pl.id, "potmC", e.target.value); }} style={{ width: 26, padding: "2px", textAlign: "center", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 3, color: "#AB47BC", fontSize: 10, fontFamily: "var(--m)", outline: "none" }} />
                        <span style={{ fontSize: 8, color: "#FF7043" }}>{"구"}</span>
                        <input type="number" value={pl.potmS || 0} onChange={function(e) { updPotm(pl.id, "potmS", e.target.value); }} style={{ width: 26, padding: "2px", textAlign: "center", background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 3, color: "#FF7043", fontSize: 10, fontFamily: "var(--m)", outline: "none" }} />
                      </React.Fragment>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: "center", color: "var(--td)", fontSize: 11 }}>
            {potmNames.length > 0 ? "라인업에 매칭되는 POTM 선수가 없습니다" : "관리자가 POTM 명단을 등록하면 자동으로 매칭됩니다"}
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
function MyPlayersPage(p) {
  var mob = p.mobile;
  var players = p.players;
  var save = p.savePlayers;
  var lm = p.lineupMap || {};
  var skillsDB = p.skills || {};
  var _sel = useState(null); var selId = _sel[0]; var setSelId = _sel[1];
  var _filter = useState("타자"); var filter = _filter[0]; var setFilter = _filter[1];
  

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

  var upd = function(id, key, val) {
    save(players.map(function(x) { if (x.id !== id) return x; var c = Object.assign({}, x); c[key] = val; return c; }));
  };

  var bats = players.filter(function(x) { return x.role === "타자"; });
  var sps = players.filter(function(x) { return x.position === "선발"; });
  var rps = players.filter(function(x) { return x.position === "중계"; });
  var cps = players.filter(function(x) { return x.position === "마무리"; });
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
          style={{ width: 88, padding: "2px", fontSize: 9, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", outline: "none" }}>
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
              <div style={{ fontSize: 11, color: "var(--td)" }}>{(pl.team ? pl.team+" " : "") + pl.subPosition + " · " + (pl.hand || "") + (isBat ? "타" : "투") + " · " + (pl.enhance || "") + (pl.cardType==="임팩트"&&pl.impactType?" · "+pl.impactType:pl.year?" · "+pl.year:"") + " · ★" + (pl.stars || 5)}</div>
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
              {pl.cardType==="라이브"&&(<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><select value={pl.stars||3} onChange={function(e){upd(pl.id,"stars",parseInt(e.target.value));}} style={{ width: 38, padding: "3px 2px", fontSize: 11, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", outline: "none" }}>{[1,2,3,4,5].map(function(s){return(<option key={s} value={s}>{s}</option>);})}</select></div>)}
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"강화"}</div><select value={pl.enhance || ""} onChange={function(e) { upd(pl.id, "enhance", e.target.value); }} style={{ width: 64, padding: "3px 2px", fontSize: 11, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", outline: "none" }}>
                {["5강","6강","7강","8강","9강","10강","1각성","2각성","3각성","4각성","5각성","6각성","7각성","8각성","9각성"].map(function(e) { return (<option key={e} value={e}>{e}</option>); })}
              </select></div>
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"별"}</div><span style={{ fontSize: 13, color: "var(--acc)" }}>{"★" + (pl.stars || 5)}</span></div>
              {!isBat && (<div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"세부포지션"}</div><select value={pl.subPosition||""} onChange={function(e){upd(pl.id,"subPosition",e.target.value);}} style={{ width: 56, padding: "3px 2px", fontSize: 11, background: "var(--inner)", border: "1px solid var(--acp)", borderRadius: 3, color: "var(--acp)", fontWeight: 700, outline: "none" }}>
                {(pl.position==="선발"?["SP1","SP2","SP3","SP4","SP5"]:pl.position==="마무리"?["CP"]:["RP1","RP2","RP3","RP4","RP5","RP6"]).map(function(s){return(<option key={s} value={s}>{s}</option>);})}
              </select></div>)}
              {/* FA toggle */}
              <div><div style={{ fontSize: 11, color: "var(--td)", marginBottom: 2 }}>{"FA"}</div>
                <div onClick={function(){upd(pl.id,"isFa",!pl.isFa);}} style={{ width: 36, height: 20, borderRadius: 10, background: pl.isFa ? "#FF9800" : "var(--inner)", border: "1px solid " + (pl.isFa ? "#FF9800" : "var(--bd)"), position: "relative", cursor: "pointer" }}>
                  <div style={{ width: 16, height: 16, borderRadius: "50%", background: pl.isFa ? "#fff" : "var(--td)", position: "absolute", top: 1, left: pl.isFa ? 18 : 1, transition: "left 0.2s" }} />
                </div>
              </div>
              <button onClick={function() { if (confirm("'" + pl.name + "' 삭제?")) { save(players.filter(function(x) { return x.id !== pl.id; })); setSelId(null); } }} style={{ padding: "3px 8px", fontSize: 9, background: "rgba(239,83,80,0.06)", border: "1px solid rgba(239,83,80,0.15)", borderRadius: 3, color: "#EF5350", cursor: "pointer", marginLeft: "auto" }}>{"삭제"}</button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, padding: "4px 8px", background: "var(--inner)", borderRadius: 4, fontSize: 11 }}>
              <span style={{ color: "var(--td)" }}>{"세트덱 스코어:"}</span>
              <span style={{ color: "var(--acc)", fontWeight: 800, fontFamily: "var(--m)" }}>{(function(){var sc=pl.cardType==="라이브"?(pl.setScore||0):(SET_POINTS[pl.cardType]||0);if(pl.isFa)sc=Math.max(0,sc-1);return sc;})()}</span>
              {pl.isFa && (<span style={{ color: "#FF9800", fontSize: 9 }}>{"(FA -1)"}</span>)}
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
                <div style={{ fontSize: 11, color: "var(--td)", fontWeight: 700, marginBottom: 4 }}>{"잠재력"}</div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input value={pl.pot1 || ""} onChange={function(e) { upd(pl.id, "pot1", e.target.value); }} placeholder="풀" style={{ width: 40, padding: "3px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 12, outline: "none" }} />
                  <input value={pl.pot2 || ""} onChange={function(e) { upd(pl.id, "pot2", e.target.value); }} placeholder="클" style={{ width: 40, padding: "3px 4px", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 3, color: "var(--t1)", fontSize: 12, outline: "none" }} />
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
          <button onClick={function() {
            var id = "p" + Date.now();
            var isBat = filter === "타자";
            var pos = filter === "타자" ? undefined : filter;
            var newPl = { id: id, cardType: "시즌", name: "새 선수", year: "2025", hand: "우", stars: CARD_STARS["시즌"]||5, subPosition: isBat ? "DH" : (filter === "선발" ? "SP1" : filter === "중계" ? "RP1" : "CP"), role: isBat ? "타자" : "투수" };
            if (isBat) { Object.assign(newPl, { power: 60, accuracy: 60, eye: 60 }); }
            else { Object.assign(newPl, { position: pos, change: 60, stuff: 60 }); }
            save(players.concat([newPl]));
          }} style={{ padding: "5px 12px", fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 5, color: "#1a1100", cursor: "pointer", marginLeft: 4 }}>{"+ 추가"}</button>
        </div>
      </div>

      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 50px" : "minmax(120px,1fr) 50px 100px 80px 44px", gap: 6, padding: "6px 12px", borderBottom: "1px solid var(--bd)", fontSize: 9, fontWeight: 700, color: "var(--td)" }}>
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
        <textarea value={csvText} readOnly rows={8} onClick={function(e){e.target.select();}} style={{ width: "100%", padding: 8, fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
      </div>)}
      {impMode && (<div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--td)", marginBottom: 6 }}>{"CSV 붙여넣기 (카테고리,스킬명,레벨,능력치...)"}</div>
        <textarea value={impText} onChange={function(e){setImpText(e.target.value);}} rows={6} style={{ width: "100%", padding: 8, fontSize: 10, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", fontFamily: "var(--m)", resize: "vertical", boxSizing: "border-box" }} />
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
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {cats.map(function(c){ var a=c===cat; return (<button key={c} onClick={function(){setCat(c);setExpName("");}} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 11, fontWeight: a?800:500, background: a?"var(--ta)":"var(--inner)", color: a?"var(--acc)":"var(--t2)", border: a?"1px solid var(--acc)":"1px solid var(--bd)", cursor: "pointer" }}>{c+" ("+Object.keys(skills[c]||{}).length+")"}</button>); })}
      </div>
      {/* Add */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input type="text" value={newName} onChange={function(e){setNewName(e.target.value);}} placeholder="새 스킬 이름" onKeyDown={function(e){if(e.key==="Enter")addSkill();}} style={{ flex: 1, padding: "7px 10px", fontSize: 11, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 6, color: "var(--t1)", outline: "none" }} />
        <button onClick={addSkill} style={{ padding: "7px 14px", fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#FFD54F,#FF8F00)", border: "none", borderRadius: 6, color: "#1a1100", cursor: "pointer" }}>{"+ 추가"}</button>
      </div>
      {/* List */}
      <div style={{ background: "var(--card)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "6px 10px", borderBottom: "1px solid var(--bd)", fontSize: 10, fontWeight: 700, color: "var(--td)" }}>
          <div>{"스킬명 (Lv6순) ▼클릭편집"}</div><div style={{ textAlign: "center", color: "#81C784" }}>{"Lv5"}</div><div style={{ textAlign: "center", color: "#4FC3F7" }}>{"Lv6"}</div><div style={{ textAlign: "center", color: "#FF6B6B" }}>{"Lv7"}</div><div style={{ textAlign: "center", color: "#FFD700" }}>{"Lv8"}</div><div style={{ textAlign: "center", color: "#E040FB" }}>{"Lv9"}</div><div style={{ textAlign: "center", color: "#FF4081" }}>{"Lv10"}</div><div />
        </div>
        {names.length === 0 ? (<div style={{ padding: 20, textAlign: "center", color: "var(--td)", fontSize: 11 }}>{"없음"}</div>) :
        names.map(function(name, idx) { var vals = table[name]; var scores = calcSkillDisp(vals, cat); var isExp = (expName === name);
          return (<React.Fragment key={name}>
            <div onClick={function(){setExpName(isExp?"":name);}} style={{ display: "grid", gridTemplateColumns: "minmax(100px,1fr) 48px 48px 48px 48px 48px 48px 28px", gap: 2, padding: "5px 10px", alignItems: "center", borderBottom: "1px solid var(--bd)", background: isExp?"var(--ta)":(idx%2===0?"var(--re)":"transparent"), cursor: "pointer" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isExp?"var(--acc)":"var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(isExp?"▼ ":"▶ ")+name}</div>
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

function CommunityPage(p){return(
  <div style={{padding:p.mobile?12:18,maxWidth:760,paddingBottom:p.mobile?80:18}}>
    <h2 style={{fontSize:18,fontWeight:900,fontFamily:"var(--h)",letterSpacing:2,color:"var(--t1)",margin:"0 0 14px"}}>{"커뮤니티"}</h2>
    <div style={{background:"var(--card)",borderRadius:12,border:"1px solid var(--bd)",padding:"44px 28px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:10}}>{"🚧"}</div><h3 style={{fontSize:15,fontWeight:700,color:"var(--t1)",margin:"0 0 6px"}}>{"커뮤니티 기능 준비중"}</h3></div>
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
  var store=useData(userId,sdState,setSdState);

  /* Save sdState to Supabase when it changes */
  var sdTimerRef=React.useRef(null);
  useEffect(function(){
    if(!userId||store.loading)return;
    if(sdTimerRef.current)clearTimeout(sdTimerRef.current);
    sdTimerRef.current=setTimeout(function(){store.saveSdState(sdState);},800);
    return function(){if(sdTimerRef.current)clearTimeout(sdTimerRef.current);};
  },[sdState,userId,store.loading]);

  /* Supabase auth state listener */
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

  if(!authChecked)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)"}}><div>{"⚾ 인증 확인중..."}</div></div>);
  if(!li)return(<LoginPage onLogin={function(u,type,adm){setUser(u);setAuthType(type||"dev");setAdmin(adm||false);setLi(true);}}/>);
  if(store.loading)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)",color:"var(--t1)"}}><div>{"⚾ 데이터 로딩중..."}</div></div>);

  var lo=function(){if(supabase){signOut();}setLi(false);setUser("");setAuthType("");setTab("lineup");setAdmin(false);setUserId(null);};
  var pg=null;
  if(tab==="lineup")pg=(<LineupPage mobile={mob} tablet={tbl} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} skills={store.skills}/>);
  else if(tab==="myplayers")pg=(<MyPlayersPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} skills={store.skills}/>);
  else if(tab==="postrain")pg=(<PosTrainPage mobile={mob} sdState={sdState} setSdState={setSdState}/>);
  else if(tab==="locker")pg=(<LockerRoomPage mobile={mob} players={store.players} savePlayers={store.savePlayers} lineupMap={store.lineupMap} saveLineupMap={store.saveLineupMap} sdState={sdState} setSdState={setSdState} skills={store.skills} saveSkills={store.saveSkills} isAdmin={isAdmin}/>);
  else if(tab==="db"&&isAdmin)pg=(<PlayerDBPage mobile={mob} players={store.players} savePlayers={store.savePlayers}/>);
  else if(tab==="skills"&&isAdmin)pg=(<SkillManagePage mobile={mob} skills={store.skills} saveSkills={store.saveSkills}/>);
  else if(tab==="enhance"&&isAdmin)pg=(<EnhancePage mobile={mob}/>);
  else pg=(<CommunityPage mobile={mob}/>);

  return(
    <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)",color:"var(--t1)"}}>
      <Nav tab={tab} setTab={setTab} user={user} authType={authType} logout={lo} mobile={mob} tablet={tbl} isAdmin={isAdmin}/>
      <div style={{flex:1,overflowY:"auto",minHeight:"100vh",paddingTop:tbl?50:0}}>{pg}</div>
      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');\
        :root{--bg:#0d1117;--side:#0a0e14;--card:rgba(22,27,38,0.8);--inner:rgba(255,255,255,0.03);--bd:rgba(255,255,255,0.06);--re:rgba(255,255,255,0.015);--bar:rgba(255,255,255,0.06);--ta:rgba(255,213,79,0.06);--t1:#e6edf3;--t2:#8b949e;--td:rgba(255,255,255,0.35);--acc:#FFD54F;--acp:#CE93D8;--h:'Oswald',sans-serif;--m:'JetBrains Mono',monospace;}\
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}html{-webkit-text-size-adjust:100%;}body{margin:0;font-family:'Noto Sans KR',sans-serif;background:var(--bg);overflow-x:hidden;-webkit-font-smoothing:antialiased;}\
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px;}\
        select{-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b949e' d='M6 8L1 3h10z'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 8px center;padding-right:24px;}\
        input[type=number]{-moz-appearance:textfield;}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}\
      "}</style>
    </div>
  );
}

