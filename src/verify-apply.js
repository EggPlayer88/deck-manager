/* 게임 계정 인증 — '도착한 덱'(운영자가 게임에서 읽어 사이트 덱 형식으로 보낸 것)을 지금 덱 · 새 덱에 얹는 계산.
   화면 · 서버와 떨어진 순수 함수다 — test/verify-apply.test.mjs 가 시험한다.

   도착한 덱(payload) = { v, team, players: [사이트 선수 …], lineupMap: {자리: 선수 id}, sdConfig: {…}, missing: [자리 …] }
     players 의 id 는 'gv_SP1' 처럼 자리 이름을 단 임시 번호다. 얹을 때 새 번호로 바꾼다.
     missing = 게임에는 카드가 있지만 도감에 없어(시즌 카드 등) 옮기지 못한 자리 — 덮어쓸 때 그 자리의 지금 선수를 그대로 둔다.
   canon(도감 번호) = 옛 도감 번호를 지금 번호로 (사이트 CARD_ID_ALIAS — 같은 카드인데 번호만 바뀐 것). 같은 카드 찾기 · 비교에만 쓴다

   원칙 (2026-11 사용자 컨셉 · 기획 2판)
   - 게임 화면에서 읽은 것은 도착한 덱대로: 카드 · 훈련 · 특훈 · 강화 · 스킬 · 잠재 · FA/와일드카드 ·
     셋포 구간 좌/우 · 라커룸(유니폼 · 주장 · 조장) · 포지션 특훈 레벨 · 불펜 편성 · 라이브 셋포 · 시너지
   - 게임 화면에 없는 것은 지금 덱 설정을 지킨다: 전술(적극 · 분업) · 같은 타순 묶음(1~2 · 3~5 · 6~9번) 안 순서 ·
     같은 조 안 등판 순서 · 포특 스킬 · POTM 켜고 끄기 · 국대에이스/포수리드 직접 고른 값 · 연도덱 설정
   - '내 선수' 가운데 라인업 · 후보 밖 선수는 그대로 둔다. 같은 카드(도감 번호)가 이미 있으면 그 선수를 고쳐 쓴다
     (선수 번호 · 흰존 · 콜존 · 사진 · 내 선수 순서 유지) */

export var BAT_SLOTS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
/* 새 선수를 만들 때 도착한 덱에서 가져오는 카드 정보 (도감과 같아도 그대로 둔다 — 시트 가져오기와 같은 모양) */
export var CARD_FIELDS = ["dbId", "name", "cardType", "role", "year", "team", "liveType", "stars", "impactType", "hand"];
/* 게임에서 읽어 덮어쓰는 선수 칸 — 구속(trainVel · specVel)은 구속 반영판 사이트(11-21)와 같이 나간다 */
export var GAME_FIELDS = ["trainP", "trainA", "trainE", "trainN", "trainC", "trainS", "trainCtl", "trainVel",
  "specPower", "specAccuracy", "specEye", "specPatience", "specChange", "specStuff", "specControl", "specVel",
  "enhance", "skill1", "skill2", "skill3", "s1Lv", "s2Lv", "s3Lv", "sLvManual",
  "pot1", "pot2", "pot3", "potType1", "potType2", "potType3", "isFa", "isWildcard", "position", "subPosition"];
/* 게임에서 읽어 덮어쓰는 덱 설정 — 도착한 덱에 없으면 지운다(자동값으로) */
export var SD_GAME_KEYS = ["bpcIdx", "liveSetPo", "synLive", "synImpact", "synSig",
  "uniP", "uniA", "uniE", "uniN", "uniC", "uniS", "uniCtl", "uniVel",
  "capBatId", "capBatP", "capBatA", "capBatE", "capBatN", "capBatC", "capBatS", "capBatCtl", "capBatVel",
  "capPitId", "capPitC", "capPitS", "capPitCtl", "capPitVel",
  /* 리더 레벨 (라커룸 리더 영향력 반영판 — 게임 화면의 '주장 레벨' · '투수 조장 레벨'. 지금 덱에 넣어 둔 레벨이 남으면 영향력이 게임과 어긋난다) */
  "capLv", "capPitLv"];
/* 셋포 구간 좌/우(s30 … s200) · 포지션 특훈 레벨(pt_자리) */
var SD_GAME_RE = /^(s\d+|pt_[A-Z0-9]+)$/;
var GROUPS = [[0, 1], [2, 3, 4], [5, 6, 7, 8]];

/* 다음 덱 최신화를 할 수 있는 때 — 한 달(한국 시각 달력)에 한 번, 요청한 달로 센다 (서버 dr_next_at 과 같은 식).
   이번 달에 요청해서 덱이 도착한(counted) 줄이 있으면 다음 달 1일 0시(한국 시각), 아니면 null(지금 가능) */
export function nextRefreshAt(list, now) {
  var t = now || Date.now();
  var ym = function (ms) { var d = new Date(ms + 9 * 3600e3); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
  var cur = ym(t);
  var used = (list || []).some(function (r) { return r && r.counted && r.requested_at && ym(new Date(r.requested_at).getTime()) === cur; });
  if (!used) return null;
  var k = new Date(t + 9 * 3600e3);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth() + 1, 1) - 9 * 3600e3);
}
function clone(o) { return JSON.parse(JSON.stringify(o == null ? null : o)); }
function isObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
function slotOfId(lm, id) { for (var k in lm) if (lm[k] === id) return k; return null; }
/* 칸 이름 순서 — 화면에서 늘 같은 순서로 보이게 */
export function slotOrder(s) {
  var i = BAT_SLOTS.indexOf(s); if (i >= 0) return i;
  var m = /^(SP|RP|BN)(\d+)$/.exec(s);
  if (m) return ({ SP: 20, RP: 40, BN: 70 })[m[1]] + Number(m[2]);
  return s === "CP" ? 60 : 99;
}

/* 도착한 덱이 쓸 만한 모양인지 — 아니면 까닭을 돌려준다 (반영 단추를 막는다) */
export function checkPayload(pl) {
  if (!isObj(pl)) return "덱 내용이 없어요";
  if (!Array.isArray(pl.players) || !pl.players.length) return "선수가 없어요";
  if (!isObj(pl.lineupMap) || !isObj(pl.sdConfig)) return "라인업 · 덱 설정이 없어요";
  var ids = {};
  for (var i = 0; i < pl.players.length; i++) {
    var p = pl.players[i];
    if (!isObj(p) || !p.id || typeof p.id !== "string" || ids[p.id]) return "선수 번호가 이상해요";
    ids[p.id] = 1;
  }
  var seen = {};
  for (var s in pl.lineupMap) {
    var v = pl.lineupMap[s];
    if (v == null || v === "") continue;   /* 빈 칸은 없는 칸으로 본다 */
    if (!ids[v]) return "라인업이 없는 선수를 가리켜요 (" + s + ")";
    if (seen[v]) return "한 선수가 두 칸에 들어가 있어요 (" + seen[v] + " · " + s + ")";
    seen[v] = s;
  }
  /* 도감 밖 카드(시즌 카드 등)라 못 옮긴 자리(missing)도 찬 칸으로 본다 — 덮어쓸 때는 그 자리의 지금 선수를 두고, 새 덱은 비워 둔다 (2026-11-25) */
  var miss = Array.isArray(pl.missing) ? pl.missing : [];
  var bat = BAT_SLOTS.filter(function (s) { return pl.lineupMap[s] || miss.indexOf(s) >= 0; }).length;
  if (bat < 9) return "타자 9칸이 다 차지 않았어요";
  var bo = pl.sdConfig.batOrder;
  if (bo != null && !(Array.isArray(bo) && bo.length === 9 && BAT_SLOTS.every(function (s) { return bo.indexOf(s) >= 0; }))) return "타순이 9칸 순서가 아니에요";
  return "";
}

/* 반영이 서버에 정말 들어갔는지 — 라인업 칸만 보면 안 된다(같은 카드는 선수 번호가 그대로라 옛 훈련 · 강화가 남아도 칸은 같다).
   얹은 덱(applied: players · lineupMap · sdConfig)의 라인업 칸마다 선수의 게임 칸(GAME_FIELDS) · 덱 설정의 게임 칸(SD_GAME_KEYS · 셋포 구간 · 포특 레벨)이
   서버 덱(srv)과 같아야 true (2026-11-25) */
export function deckApplied(applied, srv) {
  if (!isObj(applied) || !isObj(srv) || !isObj(srv.lineupMap) || !Array.isArray(srv.players)) return false;
  /* 빈 값(없음 · 빈 글자 · false · 0)은 같은 것으로 — 저장하며 빠지거나 0 으로 채워져도 같은 덱이다 */
  var nz = function (x) { return (x === undefined || x === null || x === "" || x === false || x === 0) ? null : x; };
  var same = function (a, b) { return JSON.stringify(nz(a)) === JSON.stringify(nz(b)); };
  var byA = {}, byS = {};
  (applied.players || []).forEach(function (p) { if (p && p.id) byA[p.id] = p; });
  srv.players.forEach(function (p) { if (p && p.id) byS[p.id] = p; });
  var want = applied.lineupMap || {};
  for (var s in want) {
    var id = want[s]; if (!id) continue;
    if (srv.lineupMap[s] !== id) return false;
    var a = byA[id], b = byS[id]; if (!a || !b) return false;
    for (var i = 0; i < GAME_FIELDS.length; i++) if (!same(a[GAME_FIELDS[i]], b[GAME_FIELDS[i]])) return false;
  }
  var sa = applied.sdConfig || applied.sdState || {}, sb = srv.sdConfig || srv.sdState || {};
  var keys = SD_GAME_KEYS.slice(); Object.keys(sa).concat(Object.keys(sb)).forEach(function (k) { if (SD_GAME_RE.test(k) && keys.indexOf(k) < 0) keys.push(k); });
  for (var j = 0; j < keys.length; j++) if (!same(sa[keys[j]], sb[keys[j]])) return false;
  return true;
}

/* 새 덱으로 — 도착한 덱 그대로, 선수 번호만 새로 */
export function asNewDeck(payload, stamp) {
  var pl = clone(payload), map = {}, players = [], taken = {};
  pl.players.forEach(function (p) {
    var slot = slotOfId(pl.lineupMap, p.id) || p.id;
    var np = {}; Object.keys(p).forEach(function (k) { if (k.charAt(0) !== "_") np[k] = p[k]; });
    np.id = "gv" + stamp + "_" + slot;
    while (taken[np.id]) np.id += "x";
    taken[np.id] = 1; map[p.id] = np.id; players.push(np);
  });
  var lm = {}; Object.keys(pl.lineupMap).forEach(function (s) { if (pl.lineupMap[s] != null && map[pl.lineupMap[s]]) lm[s] = map[pl.lineupMap[s]]; });
  var sd = Object.assign({}, pl.sdConfig);
  ["capBatId", "capPitId"].forEach(function (k) { if (sd[k]) sd[k] = map[sd[k]] || null; });
  delete sd.teamName;
  /* 라인업 순서대로(타자 → 선발 → 중계 → 마무리 → 후보) — 내 선수 목록이 보기 좋게 */
  players.sort(function (a, b) { return slotOrder(slotOfId(lm, a.id)) - slotOrder(slotOfId(lm, b.id)); });
  return { players: players, lineupMap: lm, sdConfig: sd };
}

/* 지금 덱에 얹기. cur = { players, lineupMap, sdState } — 돌려주는 것 = { players, lineupMap, sdConfig, report } */
export function mergeIntoDeck(cur, payload, stamp, canon) {
  var cid = typeof canon === "function" ? function (x) { return x ? canon(x) : x; } : function (x) { return x; };
  var pl = clone(payload);
  var oldPlayers = (cur && cur.players) || [], oldLm = (cur && cur.lineupMap) || {}, oldSd = (cur && cur.sdState) || {};
  var players = oldPlayers.map(function (x) { return Object.assign({}, x); });
  var used = {}, map = {}, report = { kept: 0, added: 0, removedFromLineup: 0, keptOrder: [], newOrder: [], keptRp: false, tacticReset: false };
  /* 같은 카드 찾기 — 그 자리에 있던 선수 → 라인업 · 후보에 있던 선수 → 아무 곳 */
  var inLm = {}; Object.keys(oldLm).forEach(function (s) { inLm[oldLm[s]] = s; });
  var slots = Object.keys(pl.lineupMap).filter(function (s) { return pl.lineupMap[s] != null; }).sort(function (a, b) { return slotOrder(a) - slotOrder(b); });
  var byId = {}; pl.players.forEach(function (p) { byId[p.id] = p; });
  var fresh = [];
  slots.forEach(function (s) {
    var P = byId[pl.lineupMap[s]]; if (!P || map[P.id]) return;
    var cand = players.filter(function (x) { return !used[x.id] && x.dbId && P.dbId && cid(x.dbId) === cid(P.dbId); });
    var hit = cand.filter(function (x) { return oldLm[s] === x.id; })[0] || cand.filter(function (x) { return inLm[x.id]; })[0] || cand[0];
    if (hit) {
      /* 게임에 없는 값(잠재 각성 없음 등)은 지운다 — 단 타자의 수비 자리(position · subPosition)는 게임에서 읽지 않으니 그대로 */
      GAME_FIELDS.forEach(function (k) { if (P[k] !== undefined) hit[k] = P[k]; else if (k !== "position" && k !== "subPosition") delete hit[k]; });
      used[hit.id] = 1; map[P.id] = hit.id; report.kept++;
    } else {
      var np = {}; Object.keys(P).forEach(function (k) { if (k.charAt(0) !== "_") np[k] = P[k]; });
      np.id = "gv" + stamp + "_" + s;
      while (players.some(function (x) { return x.id === np.id; })) np.id += "x";
      fresh.push(np); map[P.id] = np.id; report.added++;
    }
  });
  /* 새 선수는 맨 위에 라인업 순서대로 (내 선수 화면 '새로 넣은 선수는 맨 위' 규칙) */
  players = fresh.concat(players);
  var lm = {}; slots.forEach(function (s) { if (map[pl.lineupMap[s]]) lm[s] = map[pl.lineupMap[s]]; });
  /* 게임에서 못 옮긴 자리(도감 밖 시즌 카드 등) — 지금 그 자리에 선수가 있고 다른 칸에 안 쓰였으면 그대로 둔다 */
  report.keptMissing = [];
  (Array.isArray(pl.missing) ? pl.missing : []).forEach(function (s) {
    var id = oldLm[s];
    if (lm[s] || !id || !players.some(function (x) { return x.id === id; })) return;
    if (Object.keys(lm).some(function (k) { return lm[k] === id; })) return;
    lm[s] = id; report.keptMissing.push(s);
  });
  Object.keys(oldLm).forEach(function (s) { if (oldLm[s] && Object.keys(lm).map(function (k) { return lm[k]; }).indexOf(oldLm[s]) < 0) report.removedFromLineup++; });

  /* 덱 설정 — 게임 칸은 도착한 덱대로(없으면 지움), 나머지는 지금 설정 */
  var sd = Object.assign({}, oldSd), nsd = pl.sdConfig || {};
  Object.keys(sd).forEach(function (k) { if (SD_GAME_RE.test(k)) delete sd[k]; });
  SD_GAME_KEYS.forEach(function (k) { delete sd[k]; });
  Object.keys(nsd).forEach(function (k) { if (SD_GAME_RE.test(k) || SD_GAME_KEYS.indexOf(k) >= 0) sd[k] = nsd[k]; });
  ["capBatId", "capPitId"].forEach(function (k) { if (sd[k]) sd[k] = map[sd[k]] || null; });
  /* 못 옮긴 자리에 지금 선수를 그대로 둔 경우 — 그 선수가 지금 주장 · 투수 주장이고 도착한 덱에 주장이 없으면 그대로,
     그 자리 포지션 특훈 레벨도 도착한 덱에 없으면 지금 값 그대로 (2026-11-25) */
  report.keptMissing.forEach(function (s) {
    var id = lm[s];
    if (oldSd.capBatId === id && !sd.capBatId) sd.capBatId = id;
    if (oldSd.capPitId === id && !sd.capPitId) sd.capPitId = id;
    if (oldSd["pt_" + s] !== undefined && nsd["pt_" + s] === undefined) sd["pt_" + s] = oldSd["pt_" + s];
  });

  /* 타순 — 묶음마다, 같은 칸에 같은 카드가 들어 있으면 지금 순서를 지킨다. 아니면 도착한 덱의 순서(묶음 안 최고 점수 순서) */
  var nbo = Array.isArray(nsd.batOrder) && nsd.batOrder.length === 9 ? nsd.batOrder.slice() : BAT_SLOTS.slice();
  var obo = Array.isArray(oldSd.batOrder) && oldSd.batOrder.length === 9 ? oldSd.batOrder : null;
  var dbOf = function (lmap, plist, s) { var id = lmap[s]; var x = plist.filter(function (q) { return q.id === id; })[0]; return x ? cid(x.dbId) || x.id : null; };
  var bo = nbo.slice();
  GROUPS.forEach(function (g, gi) {
    var ns = g.map(function (i) { return nbo[i]; }).slice().sort();
    var os = obo ? g.map(function (i) { return obo[i]; }).slice().sort() : null;
    var same = !!os && ns.join() === os.join() && ns.every(function (s) { return dbOf(oldLm, oldPlayers, s) === dbOf(lm, players, s); });
    if (same) { g.forEach(function (i) { bo[i] = obo[i]; }); report.keptOrder.push(gi); } else report.newOrder.push(gi);
  });
  sd.batOrder = bo;

  /* 중계 등판 순서 — 같은 편성 · 같은 중계 칸이면 지금 순서를 지킨다 */
  var newRp = Object.keys(lm).filter(function (s) { return /^RP\d+$/.test(s); }).sort();
  var oldRp = Array.isArray(oldSd.rpOrder) ? oldSd.rpOrder.slice().sort() : null;
  if (oldRp && oldSd.bpcIdx === sd.bpcIdx && oldRp.join() === newRp.join()) { sd.rpOrder = oldSd.rpOrder.slice(); report.keptRp = true; }
  else if (Array.isArray(nsd.rpOrder)) { sd.rpOrder = nsd.rpOrder.slice(); delete sd.rpOrderBpc; }
  delete sd.teamName;
  return { players: players, lineupMap: lm, sdConfig: sd, report: report };
}

/* 칸마다 지금 ↔ 도착 비교 — label(선수) 는 화면이 넘겨 준다 (도감 이름 · 카드 줄임말).
   돌려주는 줄: { slot, before, after, kind: "same" | "card" | "stat" | "new" | "gone" } */
export function diffSlots(cur, next, label, canon) {
  var lab = label || function (p) { return p ? (p.name || p.dbId || p.id) : ""; };
  var cid = typeof canon === "function" ? function (x) { return x ? canon(x) : x; } : function (x) { return x; };
  var oldLm = (cur && cur.lineupMap) || {}, nlm = (next && next.lineupMap) || {};
  var find = function (list, id) { return (list || []).filter(function (x) { return x.id === id; })[0] || null; };
  var all = {}; Object.keys(oldLm).forEach(function (s) { if (oldLm[s]) all[s] = 1; }); Object.keys(nlm).forEach(function (s) { all[s] = 1; });
  return Object.keys(all).sort(function (a, b) { return slotOrder(a) - slotOrder(b); }).map(function (s) {
    var a = find(cur && cur.players, oldLm[s]), b = find(next && next.players, nlm[s]);
    var kind = !a ? "new" : !b ? "gone" : (cid(a.dbId) !== cid(b.dbId) ? "card"
      : GAME_FIELDS.some(function (k) { return k !== "sLvManual" && JSON.stringify(a[k] === undefined ? null : a[k]) !== JSON.stringify(b[k] === undefined ? null : b[k]); }) ? "stat" : "same");
    return { slot: s, before: a ? lab(a) : "", after: b ? lab(b) : "", kind: kind };
  });
}
