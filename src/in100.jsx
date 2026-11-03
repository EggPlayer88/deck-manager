/* in100 덱 정보 — 인게임 랭킹 챌린지 지난 시즌 1~100위(동률 포함) 덱을 모아 보여 준다.
   판(v2): { season, period, at, count, decks: [{ pos(목록 번째), rank(화면 순위), team, sp, ovr, bat, pit, bp:[승,추,롱], lk(라커룸), pt(특훈 총LV),
     slots: { C … DH, SP1~5, RP1~8, CP: 도감 id }, bench: { BN1…: id }, det: { 칸: { t 훈련, k [[스킬, Lv]…], p [잠재 6등급], g 불펜 묶음 W/C/L, la 발사각 } } }] }
   카드 표기 · 사진 · 내 덱 · 연구소 열기는 deck-manager.jsx 가 tools 로 넘긴다. */
import React, { useState, useMemo } from "react";

var BAT = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
var GROUPS = [{ id: "SP", label: "선발" }, { id: "RP", label: "불펜" }, { id: "CP", label: "마무리" }];
var XY = { C: { x: 50, y: 87 }, "1B": { x: 80, y: 58 }, "2B": { x: 64, y: 38 }, "3B": { x: 20, y: 58 }, SS: { x: 36, y: 38 },
  LF: { x: 15, y: 15 }, CF: { x: 50, y: 7 }, RF: { x: 85, y: 15 }, DH: { x: 88, y: 87 } };
var CT_SHORT = { "골든글러브": "골글", "시그니처": "시그", "임팩트": "임팩", "국가대표": "국대", "라이브": "라이브", "올스타": "올스타" };
var CT_ORDER = ["골든글러브", "시그니처", "임팩트", "국가대표", "라이브", "올스타"];

var XY_MOB = Object.assign({}, XY, { "1B": { x: 79, y: 55 }, "3B": { x: 21, y: 55 }, C: { x: 50, y: 84 }, DH: { x: 89, y: 96 } });
function groupOf(sl) { return /^SP/.test(sl) ? "SP" : /^RP/.test(sl) ? "RP" : sl; }
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function yy(c) { return c && c.year ? String(c.year).slice(-2) : ""; }
/* 카드 이름표 — 골글 18 · 빅게임헌터 · 라이브 V1 · 올스타 26 */
function tagOf(c) {
  if (!c) return "";
  if (c.cardType === "임팩트") return c.impactType || "임팩트";
  if (c.cardType === "라이브") return "라이브" + (c.liveType ? " " + c.liveType : yy(c) ? " " + yy(c) : "");
  return (CT_SHORT[c.cardType] || c.cardType || "") + (yy(c) ? " " + yy(c) : "");
}
/* FA · 와일드카드 — 덱 구단과 다른 시그 · 임팩은 FA, 다른 국대는 WC (골글 · 올스타는 따로 센다) */
function flagOf(c, team) {
  if (!c || !team || c.team === team) return "";
  if (c.cardType === "시그니처" || c.cardType === "임팩트") return "FA";
  if (c.cardType === "국가대표") return "WC";
  return "";
}

/* 자리(C~DH) 또는 묶음(SP · RP · CP)마다 덱 몇 개가 그 카드를 썼나 */
function usageOf(decks, key) {
  var m = {}, n = 0;
  decks.forEach(function (d) {
    var seen = {}, any = false;
    Object.keys(d.slots || {}).forEach(function (sl) {
      if (groupOf(sl) !== key) return;
      var id = d.slots[sl]; if (!id) return; any = true;
      if (seen[id]) return; seen[id] = 1; m[id] = (m[id] || 0) + 1;
    });
    if (any) n++;
  });
  var list = Object.keys(m).map(function (id) { return { id: id, c: m[id] }; });
  list.sort(function (a, b) { return b.c - a.c; });
  return { n: n, list: list };
}
/* 덱 한 벌의 카드 구성 — 종류별 장수 · FA · WC */
function mixOf(d, card) {
  var r = { FA: 0, WC: 0 };
  CT_ORDER.forEach(function (k) { r[k] = 0; });
  Object.keys(d.slots || {}).forEach(function (sl) {
    var c = card(d.slots[sl]); if (!c) return;
    r[c.cardType] = (r[c.cardType] || 0) + 1;
    var f = flagOf(c, d.team); if (f) r[f]++;
  });
  return r;
}

var GLABEL = { W: "승리조", C: "추격조", L: "롱릴" };
var POT1 = { "타자": "풀스윙", "투수": "장타억제력" };
var SLOT_LABEL = { SP: "선발", RP: "불펜", CP: "마무리", BN: "후보" };
function benchOf(d) { var b = d.bench || {}; if (Array.isArray(b)) { var o = {}; b.forEach(function (id, i) { o["BN" + (i + 1)] = id; }); return o; } return b; }
function skillBase(n) { return String(n || "").replace(/\(.*?\)/g, "").trim(); }
/* 한 카드의 in100 쓰임 — 쓴 덱 · 자리 · 스킬 조합 · 스킬별 쓰임(+평균 Lv) · 훈련 · 1옵 등급 */
function cardStats(decks, id) {
  var uses = [];
  decks.forEach(function (d) {
    var det = d.det || {};
    Object.keys(d.slots || {}).forEach(function (sl) { if (d.slots[sl] === id) uses.push({ d: d, sl: sl, e: det[sl] || {}, bench: false }); });
    var bn = benchOf(d); Object.keys(bn).forEach(function (sl) { if (bn[sl] === id) uses.push({ d: d, sl: sl, e: det[sl] || {}, bench: true }); });
  });
  var combo = {}, sk = {}, tr = {}, p1 = {}, where = {}, ssL = [], psL = [], tsL = [], xsL = [], pat = {}, capN = 0, tSum = [0, 0, 0, 0, 0, 0], tN = 0;
  uses.forEach(function (u) {
    var names = (u.e.k || []).map(function (x) { return x[0]; }).filter(Boolean);
    if (names.length) { var key = names.slice().sort().join(" · "); combo[key] = (combo[key] || 0) + 1; }
    (u.e.k || []).forEach(function (x) { if (!x[0]) return; var o = sk[x[0]] || (sk[x[0]] = { c: 0, lv: 0, n: 0 }); o.c++; if (x[1] != null) { o.lv += x[1]; o.n++; } });
    if (u.e.t != null) tr[u.e.t] = (tr[u.e.t] || 0) + 1;
    if (!u.bench && u.e.ss != null) ssL.push(u.e.ss);
    if (!u.bench && u.e.ps != null) psL.push(u.e.ps);
    if (!u.bench && u.e.ts && u.e.ts[0] != null) tsL.push(u.e.ts);
    if (!u.bench && u.e.xs && u.e.xs[0] != null) xsL.push(u.e.xs);
    if (!u.bench && u.e.t6 && u.e.t6.some(function (v) { return v; })) { tN++; u.e.t6.forEach(function (v, k) { tSum[k] += v || 0; }); }
    if (u.e.t6 && u.e.t6.some(function (v) { return v; })) { var pk = u.e.t6.join("·"); var po = pat[pk] || (pat[pk] = { t6: u.e.t6, c: 0, ts: u.e.ts }); po.c++; }
    if (u.e.cap) capN++;
    if (u.e.p && u.e.p[0]) p1[u.e.p[0]] = (p1[u.e.p[0]] || 0) + 1;
    var w = u.bench ? "BN" : /^RP/.test(u.sl) ? "RP" : /^SP/.test(u.sl) ? "SP" : u.sl;
    where[w] = (where[w] || 0) + 1;
  });
  var top = function (o) { return Object.keys(o).map(function (k) { return { k: k, c: o[k] }; }).sort(function (a, b) { return b.c - a.c; }); };
  return { n: uses.length, uses: uses, combos: top(combo), skills: Object.keys(sk).map(function (k) { return { k: k, c: sk[k].c, lv: sk[k].n ? sk[k].lv / sk[k].n : null }; }).sort(function (a, b) { return b.c - a.c; }),
    train: top(tr), pot1: top(p1), where: top(where), lineup: uses.filter(function (u) { return !u.bench; }).length,
    ss: spread(ssL), ps: spread(psL), ts: spreadP(tsL), xs: spreadP(xsL), cap: capN,
    tAvg: tN ? tSum.map(function (v) { return v / tN; }) : null, tN: tN,
    pats: Object.keys(pat).map(function (k) { return pat[k]; }).sort(function (a, b) { return ((b.ts || [0])[0] - (a.ts || [0])[0]) || b.c - a.c; }) };
}
function nk(n) { return String(n || "").replace(/\s+/g, ""); }      /* 스킬 이름 견주기 — 띄어쓰기 무시 */
function posBadge(c, pos) {
  if (pos) return String(pos).replace(/\d+$/, "");
  if (c && c.role === "투수") return c.position === "마무리" ? "CP" : c.position === "중계" ? "RP" : "SP";
  return (c && c.subPosition) || "";
}
/* 점수 묶음 — 최고 · 중앙 · 최저 · 정렬된 값 */
function spread(a) {
  var v = a.slice().sort(function (x, y) { return y - x; });
  return { n: v.length, max: v[0], min: v[v.length - 1], med: v.length ? v[Math.floor((v.length - 1) / 2)] : null, all: v };
}
/* [점수, 상위%] 묶음 — 점수로 줄 세우고 최고 · 중앙 · 최저의 상위 % 도 같이 */
function spreadP(a) {
  var v = a.slice().sort(function (x, y) { return y[0] - x[0]; }), m = v.length ? v[Math.floor((v.length - 1) / 2)] : null;
  return { n: v.length, max: v.length ? v[0][0] : null, med: m ? m[0] : null, min: v.length ? v[v.length - 1][0] : null,
    pmax: v.length ? v[0][1] : null, pmed: m ? m[1] : null, pmin: v.length ? v[v.length - 1][1] : null, all: v.map(function (x) { return x[0]; }) };
}
function topPct(x) { return x == null ? "" : "상위 " + (x < 1 ? x.toFixed(1) : Math.round(x)) + "%"; }
var TCOLS = { "타자": ["파워", "정확", "선구", "인내", "주루", "수비"], "투수": ["구속", "변화", "구위", "제구", "지구력", "수비"] };
var TUSE = { "타자": [1, 1, 1, 1, 0, 0], "투수": [0, 1, 1, 1, 0, 0] };     /* 훈재분에 들어가는 칸 */
var TSHORT = { "타자": ["파", "정", "선", "인", "주", "수"], "투수": ["속", "변", "구", "제", "지", "수"] };   /* 사이트 줄임말 (구속 = 속) */
/* 색 단계 — in100 라인업 카드끼리 견준 자리(자료의 qt = [스킬, 훈재분, 특훈]): 0 상위 10% · 1 25% · 2 50% · 3 75% · 4 그 아래.
   스킬 점수는 타자 · 선발 · 불펜끼리 점수로, 훈재분 · 특훈은 사이트 분포의 상위 %로 견줬다 (in100 은 대부분 상위 5% 안이라 라인업과 다른 잣대) */
var TIER_COL = ["#FF4081", "#E040FB", "#FFD54F", "#4FC3F7"];
var TIER_TXT = ["in100 상위 10%", "in100 상위 25%", "in100 상위 50%", "in100 상위 75%", "in100 아래쪽 25%"];
function tierSt(t) {
  if (t == null || t < 0) return {};
  var c = TIER_COL[t];
  return c ? { color: c, fontWeight: 800, textShadow: t === 0 ? "0 0 7px " + c + "77" : "none" } : { color: "var(--t2)", fontWeight: 500, opacity: 0.8 };
}
function qtOf(e, k) { return e && e.qt ? e.qt[k] : -1; }
function TierLegend(p) {
  return (<div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 10, color: "var(--td)" }}>
    <span>{p.label || "색 = in100 라인업 카드끼리 견준 자리"}</span>
    {TIER_COL.map(function (c, i) { return (<span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: c, display: "inline-block" }} />{["상위 10%", "25%", "50%", "75%"][i]}</span>); })}
    <span style={{ opacity: 0.8 }}>{"· 회색 = 아래쪽 25%"}</span>
  </div>);
}
/* 잠재 등급 색 — 라인업 화면과 같은 표 (SR+ 분홍 · SR 보라 · SS 연보라 · S 금색 · A+ 파랑 · A 초록) */
var POT_COL = { "SR+": "#FF4081", "SR": "#E040FB", "SS+": "#B388FF", "SS": "#9575CD", "S+": "#FFD54F", "S": "#FFC107", "A+": "#4FC3F7", "A": "#81C784" };
function PotG(p) {
  var g = p.g || "", c = POT_COL[g];
  return (<span style={{ whiteSpace: "nowrap", marginRight: p.mr || 0 }}>{p.l && <span style={{ fontSize: 10, color: "var(--td)", marginRight: 1 }}>{p.l}</span>}
    <b style={{ fontFamily: "var(--m)", color: c || "var(--t2)", fontWeight: c ? 800 : 500, textShadow: c && (g === "SR+" || g === "SR") ? "0 0 6px " + c + "55" : "none" }}>{g || "-"}</b></span>);
}
/* 잠재 셋 — 1칸 풀스윙(투수 장타억제) · 2칸 클러치(침착) · 6칸 각성(라이브 없음) — 라인업 점수에 들어가는 셋, 인게임 잠재 화면 순서 */
function potTrio(e, c) {
  var q = (e && e.p) || [], pit = c && c.role === "투수";
  var out = [{ l: pit ? "장" : "풀", g: q[0] }, { l: pit ? "침" : "클", g: q[1] }];
  if (q[5] && !(c && c.cardType === "라이브")) out.push({ l: "각", g: q[5] });
  return out;
}
var PS_TIP = "라인업 점수 — 라인업 화면과 같은 식: 인게임 최종 능력치(셋포 · 라커룸 · 포특 · 강화 · 훈련 · 특훈 · 시너지 · POTM 모두 들어간 값) × 가중치 + 스킬 + 잠재(풀스윙 · 클러치 / 장타억제 · 침착 · 각성) + 발사각 · 팀 버프(국대에이스 · 포수리드). 중계 전술 보너스는 덱 자료에 없어 뺐어요";
function rankIn(sp, x) { if (!sp || !sp.n || x == null) return null; var k = 0; while (k < sp.n && sp.all[k] > x + 0.05) k++; return k + 1; }
function f1(x) { return x == null ? "—" : (Math.round(x * 10) / 10).toFixed(1); }
function fmtBp(bp) { return bp && bp[0] != null ? "승" + bp[0] + " · 추" + bp[1] + " · 롱" + bp[2] : "—"; }

/* ── 작은 부품 ── */
function Chip(p) {
  var a = p.on;
  return (<button type="button" onClick={p.onClick} title={p.title}
    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: p.small ? "4px 9px" : "6px 11px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
      fontSize: p.small ? 11 : 12, fontWeight: a ? 800 : 600, background: a ? "var(--ta)" : "var(--inner)", color: a ? "var(--acc)" : "var(--t2)",
      border: "1px solid " + (a ? "var(--acc)" : "var(--bd)") }}>{p.children}</button>);
}
function Logo(p) {
  var u = p.tools.logo(p.team);
  if (!u) return null;
  return (<img src={u} alt="" style={{ width: p.size || 16, height: p.size || 16, objectFit: "contain", flexShrink: 0 }} onError={function (e) { e.target.style.display = "none"; }} />);
}
function TypeDot(p) {
  return (<span style={{ width: 8, height: 8, borderRadius: 2, background: p.tools.ctColor[p.ct] || "#666", display: "inline-block", flexShrink: 0 }} />);
}
function Bar(p) {
  return (<div style={{ flex: 1, minWidth: 40, height: 7, borderRadius: 4, background: "var(--bar)", overflow: "hidden" }}>
    <div style={{ width: Math.max(2, p.v) + "%", height: "100%", borderRadius: 4, background: p.color || "var(--acc)", opacity: 0.85 }} /></div>);
}
function Mark(p) {
  var col = p.kind === "mine" ? "#4FC3F7" : p.kind === "own" ? "#81C784" : "#FF9800";
  return (<span style={{ fontSize: 9, fontWeight: 800, color: col, border: "1px solid " + col, borderRadius: 3, padding: "0 4px", lineHeight: "14px", whiteSpace: "nowrap", opacity: 0.9 }}>{p.children}</span>);
}
function Card(p) {
  return (<div style={Object.assign({ background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 12, padding: p.mob ? 12 : 14 }, p.style || {})}>{p.children}</div>);
}
function Head(p) {
  return (<div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "0 0 10px", flexWrap: "wrap" }}>
    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>{p.title}</span>
    {p.sub && <span style={{ fontSize: 11, color: "var(--td)" }}>{p.sub}</span>}
    {p.right && <span style={{ marginLeft: "auto" }}>{p.right}</span>}
  </div>);
}
/* 카드 한 장 (사진) + 아래 사용률 */
function UseCard(p) {
  var t = p.tools, c = t.card(p.id);
  if (!c) return null;
  return (<div onClick={p.onClick} title={c.name + " · " + tagOf(c)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: p.onClick ? "pointer" : "default" }}>
    <div style={{ borderRadius: 8, outline: p.sel ? "2px solid var(--acc)" : "none", outlineOffset: 2 }}>
      <t.PlayerCard player={Object.assign({}, c, { photoUrl: t.photo(c.name, c.team), subPosition: posBadge(c, p.pos) })} size={p.size || "sm"} showPhoto={true} />
    </div>
    <div style={{ fontSize: 9, color: p.note ? "var(--acc)" : "var(--t2)", fontWeight: p.note ? 800 : 400, whiteSpace: "nowrap", maxWidth: 74, overflow: "hidden", textOverflow: "ellipsis" }}>{p.note || tagOf(c)}</div>
    {p.v != null && <div style={{ fontSize: 11, fontWeight: 900, fontFamily: "var(--m)", color: p.v >= 50 ? "var(--acc)" : "var(--t1)", lineHeight: 1 }}>{p.v + "%"}</div>}
  </div>);
}

/* 한 자리(또는 묶음)에서 쓰인 카드 목록 — 사용률 막대 + 내 덱 · 보유 표시 */
function UseList(p) {
  var t = p.tools, u = p.use, my = p.my || {}, own = p.own || {};
  var rows = u.list.slice(0, p.max || 12);
  return (<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {rows.map(function (r, i) {
      var c = t.card(r.id); if (!c) return null;
      var v = pct(r.c, u.n), f = flagOf(c, p.team);
      return (<div key={r.id} onClick={p.onCard ? function () { p.onCard(r.id); } : undefined} title="누르면 이 카드의 in100 스킬 · 훈련" style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", borderRadius: 8, background: i === 0 ? "var(--ta)" : "transparent", cursor: p.onCard ? "pointer" : "default" }}>
        <span style={{ width: 16, textAlign: "right", fontSize: 11, fontWeight: 800, color: "var(--td)", fontFamily: "var(--m)" }}>{i + 1}</span>
        <TypeDot tools={t} ct={c.cardType} />
        <div style={{ width: p.mob ? 112 : 150, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}
            {p.showTeam && <span style={{ fontSize: 10, color: "var(--td)", fontWeight: 500 }}>{" " + c.team}</span>}</div>
          <div style={{ fontSize: 10, color: "var(--t2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tagOf(c)}</div>
        </div>
        <Bar v={v} color={t.ctColor[c.cardType]} />
        <span style={{ width: 66, textAlign: "right", fontSize: 11, fontFamily: "var(--m)", color: "var(--t1)", whiteSpace: "nowrap" }}>
          <b style={{ fontSize: 12 }}>{v + "%"}</b><span style={{ color: "var(--td)" }}>{" " + r.c + "/" + u.n}</span></span>
        <span style={{ width: p.mob ? 58 : 82, display: "flex", gap: 3, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {f && <Mark kind="fa">{f}</Mark>}
          {my[r.id] && <Mark kind="mine">{"내 덱"}</Mark>}
          {!my[r.id] && own[r.id] && <Mark kind="own">{"보유"}</Mark>}
        </span>
      </div>);
    })}
    {u.list.length > rows.length && <div style={{ fontSize: 11, color: "var(--td)", paddingLeft: 30 }}>{"그 밖에 " + (u.list.length - rows.length) + "장"}</div>}
  </div>);
}

/* ── 카드 정보 창 — in100 이 이 카드를 어떻게 썼나 ── */
function CardSheet(p) {
  var t = p.tools, mob = p.mob, c = t.card(p.id);
  var st = useMemo(function () { return cardStats(p.decks, p.id); }, [p.id, p.decks]);
  var _sb = useState("ss"); var sortBy = _sb[0]; var setSortBy = _sb[1];
  React.useEffect(function () {
    var f = function (e) { if (e.key === "Escape") p.onClose(); };
    window.addEventListener("keydown", f); return function () { window.removeEventListener("keydown", f); };
  }, []);
  if (!c) return null;
  var mine = p.mine;            /* 내 라인업에 같은 카드가 있으면 { sk: [이름], lv: [Lv] } */
  var skUse = {}; st.skills.forEach(function (x) { skUse[nk(x.k)] = x; });
  var sec = function (title, sub, body) {
    return (<div style={{ padding: "12px 0", borderTop: "1px solid var(--bd)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}><b style={{ fontSize: 13, color: "var(--t1)" }}>{title}</b>{sub && <span style={{ fontSize: 11, color: "var(--td)" }}>{sub}</span>}</div>
      {body}</div>);
  };
  var whereTxt = st.where.map(function (x) { return (SLOT_LABEL[x.k] || x.k) + " " + x.c; }).join(" · ");
  var box = (<div role="dialog" aria-label="카드 정보" onClick={function (e) { e.stopPropagation(); }}
    style={{ width: mob ? "100%" : 560, maxHeight: mob ? "86vh" : "86vh", overflowY: "auto", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: mob ? "16px 16px 0 0" : 14, padding: mob ? "14px 14px 22px" : "18px 20px 20px", boxShadow: "0 12px 40px rgba(0,0,0,0.45)" }}>
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <t.PlayerCard player={Object.assign({}, c, { photoUrl: t.photo(c.name, c.team), subPosition: posBadge(c, st.where[0] && st.where[0].k !== "BN" ? st.where[0].k : null) })} size="md" showPhoto={true} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: "var(--t1)" }}>{c.name}</div>
        <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 2 }}><TypeDot tools={t} ct={c.cardType} />{" " + c.cardType + " · " + tagOf(c) + " · " + c.team}</div>
        <div style={{ fontSize: 13, color: "var(--t1)", marginTop: 8 }}><b style={{ fontSize: 20, fontFamily: "var(--h)", color: "var(--acc)" }}>{st.n}</b>{" / " + p.decks.length + "덱이 씀"}</div>
        <div style={{ fontSize: 11, color: "var(--td)" }}>{whereTxt}{st.cap ? " · 주장 · 조장 " + st.cap + "덱" : ""}</div>
      </div>
      <button type="button" onClick={p.onClose} aria-label="닫기" style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--t2)", fontSize: 20, cursor: "pointer" }}>{"✕"}</button>
    </div>
    {sec("점수 — in100 에서 이 카드", "라인업에 넣은 " + st.ss.n + "장 기준 · 사이트 계산식 · 상위 % 는 훈재분 계산기 분포", (<div style={{ display: "grid", gridTemplateColumns: "92px repeat(3, minmax(0,1fr))" + (mine ? " minmax(0,1.2fr)" : ""), gap: 6, alignItems: "center", fontSize: 12 }}>
      <span />{["최고", "중앙", "최저"].map(function (h) { return (<span key={h} style={{ fontSize: 10, color: "var(--td)", textAlign: "center" }}>{h}</span>); })}
      {mine && <span style={{ fontSize: 10, color: "#4FC3F7", textAlign: "center", fontWeight: 800 }}>{"내 카드"}</span>}
      {[["스킬 점수", st.ss, mine && mine.ss], ["훈재분", st.ts, mine && mine.tr, mine && mine.trp], ["특훈", st.xs, mine && mine.xs, mine && mine.xsp], ["라인업 점수", st.ps, null]].filter(function (r) { return r[1].n; }).map(function (r) {
        var rk = rankIn(r[1], r[2]), pc = r[1].pmax !== undefined ? [r[1].pmax, r[1].pmed, r[1].pmin] : null;
        return (<React.Fragment key={r[0]}>
          <b title={r[0] === "라인업 점수" ? PS_TIP : undefined} style={{ color: "var(--t2)", fontSize: 12, cursor: r[0] === "라인업 점수" ? "help" : "default" }}>{r[0]}</b>
          {[r[1].max, r[1].med, r[1].min].map(function (v, i) { return (<span key={i} style={{ textAlign: "center", lineHeight: 1.15 }}><b style={{ fontFamily: "var(--m)", fontSize: 15, color: i === 0 ? "var(--acc)" : "var(--t1)" }}>{f1(v)}</b>{pc && pc[i] != null && <span style={{ display: "block", fontSize: 9, color: "var(--td)" }}>{topPct(pc[i])}</span>}</span>); })}
          {mine && <span style={{ textAlign: "center", fontFamily: "var(--m)", lineHeight: 1.15 }}>{r[2] != null ? (<React.Fragment><b style={{ fontSize: 15, color: "#4FC3F7" }}>{f1(r[2])}</b><span style={{ fontSize: 10, color: "var(--td)" }}>{rk ? (rk > r[1].n ? " 최저 아래" : " " + rk + "등") : ""}</span>{r[3] != null && <span style={{ display: "block", fontSize: 9, color: "var(--td)" }}>{topPct(r[3])}</span>}</React.Fragment>) : <span style={{ fontSize: 10, color: "var(--td)" }}>{"—"}</span>}</span>}
        </React.Fragment>);
      })}
    </div>))}
    {st.pats.length > 0 && sec("훈련 분배 — in100 훈재분 높은 순", "능력치 상세 창의 훈련 줄 · 굵은 칸이 훈재분에 들어감", (<div style={{ display: "flex", flexDirection: "column" }}>
      {st.tAvg && <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px 8px", fontSize: 12, flexWrap: mob ? "wrap" : "nowrap" }}>
        <b style={{ color: "var(--t2)", fontSize: 11, whiteSpace: "nowrap" }}>{"in100 평균"}</b>
        <span style={{ display: "flex", gap: mob ? 6 : 9 }}>{st.tAvg.map(function (v, k) { var use = (TUSE[c.role] || TUSE["타자"])[k];
          return (<span key={k} style={{ whiteSpace: "nowrap", color: use ? "var(--t1)" : "var(--td)" }}>{(TSHORT[c.role] || TSHORT["타자"])[k] + " "}<b style={{ fontFamily: "var(--m)", fontWeight: use ? 900 : 500 }}>{(Math.round(v * 10) / 10).toFixed(1)}</b></span>); })}</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--td)", whiteSpace: "nowrap" }}>{"라인업 " + st.tN + "장"}</span>
      </div>}
      {st.pats.slice(0, mob ? 3 : 5).map(function (x, i) {
        var cols = TSHORT[c.role] || TSHORT["타자"], use = TUSE[c.role] || TUSE["타자"];
        return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px", borderTop: "1px solid var(--bd)", flexWrap: mob ? "wrap" : "nowrap" }}>
          <span style={{ display: "flex", gap: mob ? 6 : 9, fontSize: 12 }}>{x.t6.map(function (v, k) {
            return (<span key={k} style={{ whiteSpace: "nowrap", color: use[k] ? "var(--t1)" : "var(--td)" }}>{cols[k] + " "}<b style={{ fontFamily: "var(--m)", fontWeight: use[k] ? 900 : 500 }}>{v}</b></span>); })}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--t2)", whiteSpace: "nowrap" }}>{x.ts ? "훈재분 " + f1(x.ts[0]) + " · " + topPct(x.ts[1]) : ""}</span>
          <b style={{ width: 34, textAlign: "right", fontFamily: "var(--m)", color: i === 0 ? "var(--acc)" : "var(--t1)" }}>{x.c > 1 ? x.c + "덱" : ""}</b>
        </div>);
      })}
      {mine && mine.t6 && <div style={{ fontSize: 11, color: "#4FC3F7", marginTop: 6 }}>{"내 분배 — " + (TSHORT[c.role] || TSHORT["타자"]).map(function (n, k) { return mine.t6[k] != null ? n + " " + mine.t6[k] : null; }).filter(Boolean).join(" · ") + (mine.tr != null ? " · 훈재분 " + f1(mine.tr) + (mine.trp != null ? " · " + topPct(mine.trp) : "") : "")}</div>}
    </div>))}
    {sec("훈련 · 잠재(" + (POT1[c.role] || "풀스윙") + ") 등급", null, (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {st.train.map(function (x) { return (<span key={"t" + x.k} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8, background: "var(--inner)", border: "1px solid var(--bd)", color: "var(--t1)" }}>{"훈련 " + x.k}<b style={{ marginLeft: 4, fontFamily: "var(--m)" }}>{x.c}</b></span>); })}
      <span style={{ width: 8 }} />
      {st.pot1.map(function (x) { return (<span key={"p" + x.k} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8, background: "rgba(255,213,79,0.08)", border: "1px solid rgba(255,213,79,0.3)", color: "var(--t1)" }}><PotG g={x.k} /><b style={{ marginLeft: 4, fontFamily: "var(--m)" }}>{x.c}</b></span>); })}
    </div>))}
    {sec("덱별 점수", "줄을 누르면 그 덱", (<div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        {[["ss", "스킬 점수 순"], ["ts", "훈재분 순"], ["ps", "라인업 점수 순"]].map(function (o) { return (<Chip key={o[0]} small on={sortBy === o[0]} onClick={function () { setSortBy(o[0]); }}>{o[1]}</Chip>); })}
      </div>
      {st.uses.filter(function (u) { return !u.bench; }).sort(function (a, b) { var f = function (e) { return sortBy === "ts" ? (e.ts ? e.ts[0] : -1) : sortBy === "ps" ? (e.ps || 0) : (e.ss || 0); }; return f(b.e) - f(a.e); }).concat(st.uses.filter(function (u) { return u.bench; })).map(function (u, i) {
        var e = u.e || {};
        return (<div key={i} onClick={function () { p.onOpenDeck(u.d); }} style={{ display: "grid", gridTemplateColumns: mob ? "40px 42px minmax(0,1fr) 40px 30px" : "54px 54px minmax(0,1fr) 64px 54px 40px", gap: 6, alignItems: "center", padding: "6px 2px", borderTop: "1px solid var(--bd)", cursor: "pointer", fontSize: 12, opacity: u.bench ? 0.6 : 1 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Logo tools={t} team={u.d.team} size={13} /><b style={{ fontFamily: "var(--m)", color: "var(--t1)" }}>{u.d.rank + "위"}</b></span>
          <b title={TIER_TXT[qtOf(e, 0)] || ""} style={Object.assign({ textAlign: "right", fontFamily: "var(--m)", fontSize: 14, color: "var(--t1)" }, u.bench ? { color: "var(--td)" } : tierSt(qtOf(e, 0)))}>{u.bench ? "후보" : f1(e.ss)}</b>
          <span style={{ color: "var(--t2)", fontSize: 11, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: mob ? "normal" : "nowrap" }}>{(e.k || []).map(function (x) { return x[0] + " " + x[1]; }).join(" · ")}</span>
          <span title={TIER_TXT[qtOf(e, 1)] || ""} style={{ textAlign: "right", fontFamily: "var(--m)", lineHeight: 1.1 }}><span style={Object.assign({ color: "var(--t1)" }, tierSt(qtOf(e, 1)))}>{e.ts ? f1(e.ts[0]) : "—"}</span>{!mob && e.ts && <span style={{ display: "block", fontSize: 9, color: "var(--td)" }}>{topPct(e.ts[1])}</span>}</span>
          {!mob && <span title={PS_TIP} style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--t1)" }}>{f1(e.ps)}</span>}
          <span style={{ textAlign: "right" }}><PotG g={e.p && e.p[0]} /></span>
        </div>);
      })}
      <div style={{ fontSize: 10, color: "var(--td)", marginTop: 6 }}>{mob ? "순위 · 스킬 점수 · 스킬 3개(Lv) · 훈재분 · 잠재(" + (POT1[c.role] || "풀스윙") + ")" : "순위 · 스킬 점수 · 스킬 3개(Lv) · 훈재분(상위 %) · 라인업 점수 · 잠재(" + (POT1[c.role] || "풀스윙") + ")"}</div>
      <div style={{ marginTop: 4 }}><TierLegend /></div>
    </div>))}
  </div>);
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center" }}>{box}</div>);
}

/* ── ① 인기 카드 ── */
function PopularView(p) {
  var t = p.tools, mob = p.mob, decks = p.decks, team = p.team;
  var _s = useState("C"); var sel = _s[0]; var setSel = _s[1];
  var uses = useMemo(function () {
    var o = {}; BAT.concat(["SP", "RP", "CP"]).forEach(function (k) { o[k] = usageOf(decks, k); }); return o;
  }, [decks]);
  var mixAvg = useMemo(function () {
    var s = { FA: 0, WC: 0 }; CT_ORDER.forEach(function (k) { s[k] = 0; });
    decks.forEach(function (d) { var m = mixOf(d, t.card); Object.keys(s).forEach(function (k) { s[k] += m[k] || 0; }); });
    Object.keys(s).forEach(function (k) { s[k] = decks.length ? s[k] / decks.length : 0; });
    var sp = 0; decks.forEach(function (d) { sp += d.sp || 0; });
    s.sp = decks.length ? sp / decks.length : 0; return s;
  }, [decks]);
  var bpTop = useMemo(function () {
    var m = {}; decks.forEach(function (d) { if (d.bp && d.bp[0] != null) { var k = d.bp.join("/"); m[k] = (m[k] || 0) + 1; } });
    return Object.keys(m).map(function (k) { return { k: k, c: m[k] }; }).sort(function (a, b) { return b.c - a.c; }).slice(0, 4);
  }, [decks]);
  var label = team || "전체";
  var selName = GROUPS.filter(function (g) { return g.id === sel; })[0];
  var cardSize = mob ? "sm" : "md";

  var field = (<div style={{ position: "relative", width: "100%", maxWidth: mob ? 360 : 520, aspectRatio: mob ? "1 / 1.02" : "1.12", margin: mob ? "0 auto 64px" : "0 auto 44px" }}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <path d="M50 96 L6 52 Q50 -14 94 52 Z" fill="rgba(76,175,80,0.07)" stroke="rgba(76,175,80,0.25)" strokeWidth="0.4" />
      <polygon points="50,86 70,62 50,40 30,62" fill="rgba(141,110,99,0.10)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.35" />
    </svg>
    {BAT.map(function (pos) {
      var u = uses[pos], top = u.list[0], co = (mob ? XY_MOB : XY)[pos];
      return (<div key={pos} style={{ position: "absolute", left: co.x + "%", top: co.y + "%", transform: "translate(-50%,-30%)", textAlign: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: sel === pos ? "var(--acc)" : "var(--td)", marginBottom: 2 }}>{pos}</div>
        {top ? <UseCard tools={t} id={top.id} pos={pos} v={pct(top.c, u.n)} sel={sel === pos} size={cardSize} onClick={function () { setSel(pos); }} />
          : <div style={{ fontSize: 10, color: "var(--td)" }}>{"—"}</div>}
      </div>);
    })}
  </div>);

  var pitch = (<div style={{ display: "flex", flexDirection: mob ? "column" : "row", flexWrap: "wrap", gap: mob ? 12 : 28 }}>
    {GROUPS.map(function (g) {
      var u = uses[g.id], n = g.id === "SP" ? 5 : g.id === "RP" ? 6 : 2;
      return (<div key={g.id} style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <button type="button" onClick={function () { setSel(g.id); }} style={{ fontSize: 12, fontWeight: 800, color: sel === g.id ? "var(--acc)" : "var(--t1)", background: "none", border: "none", padding: 0, cursor: "pointer" }}>{g.label}</button>
          <span style={{ fontSize: 10, color: "var(--td)" }}>{"덱 " + u.n + "개 · 많이 쓴 " + Math.min(n, u.list.length) + "장"}</span>
        </div>
        <div style={{ display: "flex", gap: mob ? 6 : 10, overflowX: "auto", paddingBottom: 2 }}>
          {u.list.slice(0, n).map(function (r) { return (<UseCard key={r.id} tools={t} id={r.id} pos={g.id} v={pct(r.c, u.n)} size="sm" onClick={function () { setSel(g.id); }} />); })}
        </div>
      </div>);
    })}
  </div>);

  var mix = (<div style={{ display: "flex", flexWrap: "wrap", gap: mob ? 6 : 8 }}>
    {CT_ORDER.map(function (k) {
      return (<div key={k} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, background: "var(--inner)", border: "1px solid var(--bd)" }}>
        <TypeDot tools={t} ct={k} /><span style={{ fontSize: 11, color: "var(--t2)" }}>{CT_SHORT[k]}</span>
        <b style={{ fontSize: 13, fontFamily: "var(--m)", color: "var(--t1)" }}>{mixAvg[k].toFixed(1)}</b></div>);
    })}
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, background: "rgba(255,152,0,0.08)", border: "1px solid rgba(255,152,0,0.25)" }}>
      <span style={{ fontSize: 11, color: "#FF9800", fontWeight: 700 }}>{"FA · WC"}</span><b style={{ fontSize: 13, fontFamily: "var(--m)", color: "var(--t1)" }}>{(mixAvg.FA + mixAvg.WC).toFixed(1)}</b></div>
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 8, background: "var(--inner)", border: "1px solid var(--bd)" }}>
      <span style={{ fontSize: 11, color: "var(--t2)" }}>{"셋포"}</span><b style={{ fontSize: 13, fontFamily: "var(--m)", color: "var(--t1)" }}>{mixAvg.sp.toFixed(1)}</b></div>
    <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 2 }}>
      <span style={{ fontSize: 11, color: "var(--t2)", fontWeight: 700 }}>{"불펜 편성"}</span>
      {bpTop.map(function (x) { return (<span key={x.k} title={"승리조/추격조/롱릴 " + x.k + " — " + x.c + "덱"} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "var(--inner)", border: "1px solid var(--bd)", color: "var(--t1)" }}><b style={{ fontFamily: "var(--m)" }}>{x.k}</b><span style={{ color: "var(--td)" }}>{" " + pct(x.c, decks.length) + "%"}</span></span>); })}
    </div>
  </div>);

  var panelUse = uses[sel] || uses.C;
  var panel = (<Card mob={mob}>
    <Head title={(selName ? selName.label : sel) + " — 많이 쓴 카드"} sub={label + " " + panelUse.n + "덱 중 몇 덱이 썼나"} />
    <UseList tools={t} use={panelUse} team={team} my={p.mySet} own={p.ownSet} mob={mob} showTeam={!team} max={mob ? 8 : 12} onCard={p.onCard} />
    <div style={{ fontSize: 10, color: "var(--td)", marginTop: 8 }}>{"카드 줄을 누르면 in100 이 붙인 스킬 조합 · 훈련 · 잠재 등급"}</div>
  </Card>);

  var mixCard = (<Card mob={mob}>
    <Head title={"덱 한 벌 평균 구성"} sub={label + " " + decks.length + "덱"} />
    {mix}
  </Card>);
  return (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {mob ? (<React.Fragment>
      {mixCard}
      <Card mob={mob} style={{ padding: "10px 6px" }}><Head title={"타선 — 자리마다 1순위"} sub={"카드를 누르면 아래에 순위"} />{field}</Card>
      {panel}
      <Card mob={mob}><Head title={"마운드"} sub={"투수는 자리를 돌려 써서 묶음으로 셈"} />{pitch}</Card>
    </React.Fragment>) : (
      <React.Fragment>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(0,1fr)", gap: 12, alignItems: "start" }}>
          <Card mob={mob}><Head title={"타선 — 자리마다 1순위"} sub={"카드를 누르면 오른쪽에 그 자리 순위"} />{field}</Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{panel}{mixCard}</div>
        </div>
        <Card mob={mob}><Head title={"마운드"} sub={"투수는 자리를 돌려 써서 선발 · 불펜 묶음으로 셈 · 묶음 이름을 누르면 위 오른쪽에 순위"} />{pitch}</Card>
      </React.Fragment>)}
  </div>);
}

/* ── ② 덱 목록 ── */
/* 덱 목록 줄 — 투수로 바꾸면 선발 5 | 불펜(등판 순서) | 마무리 */
var PIT_LINE = ["SP1", "SP2", "SP3", "SP4", "SP5", "|", "RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8", "|", "CP"];
function DeckLine(p) {
  var t = p.tools, d = p.deck, mob = p.mob, q = p.q;
  var m = mixOf(d, t.card);
  return (<div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 12, padding: mob ? "9px 8px" : "9px 12px", cursor: "pointer", background: p.open ? "var(--ta)" : "transparent" }} onClick={p.onToggle}>
    <span style={{ width: mob ? 30 : 36, textAlign: "right", fontSize: mob ? 15 : 17, fontWeight: 900, fontFamily: "var(--h)", color: d.rank <= 10 ? "var(--acc)" : "var(--t1)" }}>{d.rank}</span>
    <span style={{ display: "flex", alignItems: "center", gap: 5, width: mob ? 58 : 70 }}><Logo tools={t} team={d.team} size={mob ? 18 : 20} /><span style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{d.team}</span></span>
    {!mob && <span style={{ width: 112, fontSize: 11, fontFamily: "var(--m)", color: "var(--t2)", whiteSpace: "nowrap", lineHeight: 1.35 }}>{"OVR " + (d.ovr != null ? d.ovr.toFixed(1) : "—")}<br />{"셋포 " + (d.sp || "—") + " · " + (d.bp && d.bp[0] != null ? d.bp.join("/") : "")}</span>}
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: mob || p.side === "pit" ? "wrap" : "nowrap", gap: 4, overflow: "hidden" }}>
      {(p.side === "pit" ? PIT_LINE : BAT).map(function (sl, ix) {
        if (sl === "|") return (<span key={"bar" + ix} style={{ color: "var(--td)", opacity: 0.5, fontSize: 11, alignSelf: "center" }}>{"|"}</span>);
        var c = t.card(d.slots[sl]); if (!c) return null;
        var hit = q && c.name.indexOf(q) >= 0;
        return (<span key={sl} title={sl + " " + c.name + " · " + tagOf(c)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: mob ? 10 : 11, padding: mob ? "1px 4px" : "2px 6px", borderRadius: 5, whiteSpace: "nowrap",
          background: hit ? "rgba(255,213,79,0.25)" : "var(--inner)", border: "1px solid " + (hit ? "var(--acc)" : "var(--bd)"), color: "var(--t1)" }}>
          <TypeDot tools={t} ct={c.cardType} />{mob ? c.name.replace(/[A-Z]$/, "") : c.name}</span>);
      })}
    </div>
    {!mob && <span style={{ display: "flex", gap: 3, width: 150, justifyContent: "flex-end", flexWrap: "wrap" }}>
      {CT_ORDER.filter(function (k) { return m[k]; }).map(function (k) {
        return (<span key={k} title={k + " " + m[k] + "장"} style={{ fontSize: 10, fontWeight: 800, color: t.ctColor[k], fontFamily: "var(--m)" }}>{CT_SHORT[k].slice(0, 1) + m[k]}</span>);
      })}
      {m.FA + m.WC > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: "#FF9800", fontFamily: "var(--m)" }}>{"FA" + (m.FA + m.WC)}</span>}
    </span>}
    <span style={{ fontSize: 12, color: "var(--td)" }}>{p.open ? "▾" : "▸"}</span>
  </div>);
}
function DeckDetail(p) {
  var t = p.tools, d = p.deck, mob = p.mob, my = p.mySlots || {}, det = d.det || {};
  var _tb = useState(!!p.initTable); var table = _tb[0]; var setTable = _tb[1];
  var size = mob ? "sm" : "md";
  var open = function (id) { if (p.onCard && id) p.onCard(id); };
  var bat = (<div style={{ position: "relative", width: "100%", maxWidth: mob ? 340 : 460, aspectRatio: "1.1", margin: mob ? "0 auto 60px" : "0 auto 30px" }}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <path d="M50 96 L6 52 Q50 -14 94 52 Z" fill="rgba(76,175,80,0.06)" stroke="rgba(76,175,80,0.22)" strokeWidth="0.4" /></svg>
    {BAT.map(function (pos) {
      var id = d.slots[pos], co = (mob ? XY_MOB : XY)[pos], same = my[pos] && my[pos] === id;
      return (<div key={pos} style={{ position: "absolute", left: co.x + "%", top: co.y + "%", transform: "translate(-50%,-30%)", textAlign: "center" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--td)", marginBottom: 2 }}>{pos}{same && <span style={{ color: "#4FC3F7" }}>{" ✓"}</span>}</div>
        {id ? <UseCard tools={t} id={id} pos={pos} size={size} onClick={function () { open(id); }} /> : <span style={{ fontSize: 10, color: "var(--td)" }}>{"—"}</span>}
      </div>);
    })}
  </div>);
  var row = function (title, sls, map) {
    map = map || d.slots;
    var ids = sls.filter(function (s) { return map[s]; });
    return (<div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--t2)", margin: "0 0 6px" }}>{title}</div>
      {ids.length ? (<div style={{ display: "flex", gap: mob ? 6 : 8, flexWrap: "wrap" }}>{ids.map(function (s) {
        var g = (det[s] || {}).g; return (<UseCard key={s} tools={t} id={map[s]} pos={/^BN/.test(s) ? null : s} size="sm" note={g ? GLABEL[g] : null} onClick={function () { open(map[s]); }} />); })}</div>)
        : <div style={{ fontSize: 11, color: "var(--td)" }}>{"없음"}</div>}
    </div>);
  };
  var bn = benchOf(d), bnKeys = Object.keys(bn).sort();
  var chip = function (k, v) { return (<span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "var(--inner)", border: "1px solid var(--bd)", color: "var(--t2)", whiteSpace: "nowrap" }}>{k + " "}<b style={{ color: "var(--t1)", fontFamily: "var(--m)" }}>{v}</b></span>); };
  var ALL = BAT.concat(["SP1", "SP2", "SP3", "SP4", "SP5", "RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8", "CP"]).filter(function (s) { return d.slots[s]; }).concat(bnKeys);
  var capNames = ALL.filter(function (sl) { return (det[sl] || {}).cap; }).map(function (sl) { var c = t.card(d.slots[sl] || bn[sl]); return c ? c.name : sl; });
  var sdRows = (t.sdRows || []).filter(function (r) { return d.sp == null || r.sp <= d.sp; });
  var sdEl = d.sdi ? (<div style={{ marginTop: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 800, color: "var(--t2)", margin: "0 0 6px" }}>{"셋포 설정 "}<span style={{ fontWeight: 500, color: "var(--td)" }}>{"— 카드마다 세트덱 수치로 찾은 값 · 흐린 칸은 이 덱 구성으론 어느 쪽이든 같아 못 정함"}</span></div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(4, minmax(0,1fr))" : "repeat(auto-fill, minmax(92px, 1fr))", gap: 4 }}>
      {sdRows.map(function (r) {
        var v = d.sdi[r.sp]; if (v == null) return null;
        var sd = String(v).split(":"), L = sd[0] === "L", q = (d.sdq || []).indexOf(r.sp) >= 0;
        return (<span key={r.sp} title={r.sp + " " + (L ? r.lDesc : r.rDesc) + (sd[1] ? " (" + sd[1] + ")" : "")} style={{ fontSize: 10, padding: "3px 5px", borderRadius: 5, background: "var(--inner)", border: "1px solid var(--bd)", opacity: q ? 0.45 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <b style={{ fontFamily: "var(--m)", color: "var(--td)" }}>{r.sp + " "}</b><b style={{ color: L ? "#4FC3F7" : "#FFB74D" }}>{L ? "좌" : "우"}</b>{" " + (L ? r.l : r.r) + (sd[1] ? " " + sd[1].slice(-2) : "")}</span>);
      })}
    </div>
    {d.ord && <div style={{ fontSize: 11, color: "var(--t2)", marginTop: 6 }}>{"타순 묶음 — " + ["1~2", "3~5", "6~9"].filter(function (g) { return BAT.some(function (sl) { return d.ord[sl] === g; }); }).map(function (g) {
      return g + "번: " + BAT.filter(function (sl) { return d.ord[sl] === g; }).map(function (sl) { var c = t.card(d.slots[sl]); return c ? c.name : sl; }).join(" · ");
    }).join("  /  ")}</div>}
  </div>) : null;
  var tableEl = (<div style={{ marginTop: 12, overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead><tr style={{ color: "var(--td)", fontSize: 10, textAlign: "left" }}>
        <th style={{ padding: "4px 6px" }}>{"자리"}</th><th style={{ padding: "4px 6px" }}>{"카드"}</th><th style={{ padding: "4px 6px", textAlign: "right" }}>{"훈재분"}</th><th style={{ padding: "4px 6px", textAlign: "right" }}>{"특훈"}</th>
        <th style={{ padding: "4px 6px", textAlign: "right" }}>{"스킬 점수"}</th><th style={{ padding: "4px 6px" }}>{"스킬 (Lv · 점수)"}</th>
        <th title={PS_TIP} style={{ padding: "4px 6px", textAlign: "right", cursor: "help" }}>{"라인업 점수"}</th><th style={{ padding: "4px 6px" }}>{"잠재"}</th></tr></thead>
      <tbody>{ALL.map(function (sl) {
        var id = d.slots[sl] || bn[sl], c = t.card(id), e = det[sl] || {};
        if (!c) return null;
        return (<tr key={sl} onClick={function () { open(id); }} style={{ borderTop: "1px solid var(--bd)", cursor: "pointer" }}>
          <td style={{ padding: "5px 6px", color: "var(--td)", fontWeight: 800, whiteSpace: "nowrap" }}>{/^BN/.test(sl) ? "후보" : /^RP/.test(sl) && e.g ? GLABEL[e.g] : sl}</td>
          <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}><TypeDot tools={t} ct={c.cardType} />{" "}<b style={{ color: "var(--t1)" }}>{c.name}</b><span style={{ color: "var(--t2)", fontSize: 10 }}>{" " + tagOf(c)}</span>{e.cap && <span style={{ marginLeft: 5 }}><Mark kind="own">{"주장"}</Mark></span>}</td>
          <td title={TIER_TXT[qtOf(e, 1)] || ""} style={Object.assign({ padding: "5px 6px", textAlign: "right", fontFamily: "var(--m)", color: "var(--t1)", whiteSpace: "nowrap" }, tierSt(qtOf(e, 1)))}>{e.ts ? f1(e.ts[0]) : "—"}<span style={{ fontSize: 9, color: "var(--td)" }}>{e.ts && e.ts[1] != null ? " " + (e.ts[1] < 1 ? e.ts[1].toFixed(1) : Math.round(e.ts[1])) + "%" : ""}</span></td>
          <td title={TIER_TXT[qtOf(e, 2)] || ""} style={Object.assign({ padding: "5px 6px", textAlign: "right", fontFamily: "var(--m)", color: "var(--t2)", whiteSpace: "nowrap" }, tierSt(qtOf(e, 2)))}>{e.xs ? f1(e.xs[0]) : ""}<span style={{ fontSize: 9, color: "var(--td)" }}>{e.xs && e.xs[1] != null ? " " + (e.xs[1] < 1 ? e.xs[1].toFixed(1) : Math.round(e.xs[1])) + "%" : ""}</span></td>
          <td title={TIER_TXT[qtOf(e, 0)] || ""} style={Object.assign({ padding: "5px 6px", textAlign: "right", fontFamily: "var(--m)", fontWeight: 800, color: "var(--t1)", fontSize: 13 }, tierSt(qtOf(e, 0)))}>{f1(e.ss)}</td>
          <td style={{ padding: "5px 6px", color: "var(--t1)" }}>{(e.k || []).map(function (x, i) { return (<span key={i} style={{ whiteSpace: "nowrap", marginRight: 8 }}>{x[0]}<span style={{ color: "var(--td)" }}>{" " + (x[1] != null ? x[1] : "?") + (e.sp3 && e.sp3[i] != null ? " · " + e.sp3[i] : "")}</span></span>); })}</td>
          <td style={{ padding: "5px 6px", textAlign: "right", fontFamily: "var(--m)", color: "var(--t1)", fontWeight: 700 }}>{f1(e.ps)}</td>
          <td style={{ padding: "5px 6px", whiteSpace: "nowrap" }}>{potTrio(e, c).map(function (x, k) { return (<PotG key={k} l={x.l} g={x.g} mr={6} />); })}</td></tr>);
      })}</tbody></table>
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
      <TierLegend label="스킬 점수 · 훈재분 · 특훈 색 = in100 라인업 카드끼리 견준 자리 (스킬은 타자 · 선발 · 불펜끼리)" />
      <div style={{ fontSize: 10, color: "var(--td)" }}>{"라인업 점수 = 라인업 화면과 같은 식(인게임 최종 능력치 — 셋포 · 라커룸 등 모두 반영 — + 스킬 + 잠재 + 발사각 · 팀 버프, 중계 전술은 뺌) · 잠재 = 풀스윙 · 클러치(투수 장타억제 · 침착) · 각성"}</div>
    </div></div>);
  return (<div style={{ padding: mob ? "10px 8px 14px" : "12px 16px 16px", borderTop: "1px dashed var(--bd)", background: "var(--re)" }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      {chip("OVR", d.ovr != null ? d.ovr.toFixed(1) : "—")}{chip("타자 · 투수", (d.bat != null ? d.bat.toFixed(1) : "—") + " · " + (d.pit != null ? d.pit.toFixed(1) : "—"))}
      {chip("셋포", d.sp || "—")}{chip("불펜", fmtBp(d.bp))}{chip("스킬 합 타 · 투", f1(d.ssBat) + " · " + f1(d.ssPit))}{chip("라커룸", d.lk != null ? "LV" + d.lk : "—")}{chip("특훈 총", d.pt != null ? "LV" + d.pt : "—")}{capNames.length > 0 && chip("주장 · 조장", capNames.join(" · "))}
    </div>
    {sdEl}
    <div style={{ display: mob ? "block" : "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 16, alignItems: "start" }}>
      {bat}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: mob ? 10 : 0 }}>
        {row("선발", ["SP1", "SP2", "SP3", "SP4", "SP5"])}
        {row("불펜 (등판 순서)", ["RP1", "RP2", "RP3", "RP4", "RP5", "RP6", "RP7", "RP8"])}
        {row("마무리", ["CP"])}
        {row("후보", bnKeys, bn)}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
          <button type="button" onClick={function () { setTable(!table); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", background: table ? "var(--ta)" : "var(--inner)", color: table ? "var(--acc)" : "var(--t1)", border: "1px solid " + (table ? "var(--acc)" : "var(--bd)") }}>{table ? "▾ 점수 · 훈련 · 잠재 접기" : "▸ 점수 · 훈련 · 잠재 보기"}</button>
          <button type="button" onClick={function () { if (p.onLab) p.onLab(d); }} style={{ padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", background: "var(--acc)", color: "#1a1300", border: "none" }}>{"🔬 연구소에서 열기"}</button>
        </div>
      </div>
    </div>
    {table && tableEl}
  </div>);
}
function DeckListView(p) {
  var t = p.tools, mob = p.mob;
  var _q = useState(""); var q = _q[0]; var setQ = _q[1];
  var _o = useState(p.openRank || null); var open = _o[0]; var setOpen = _o[1];
  var _m = useState(20); var more = _m[0]; var setMore = _m[1];
  var _sd = useState("bat"); var side = _sd[0]; var setSide = _sd[1];
  var list = p.decks.filter(function (d) {
    if (!q) return true;
    return Object.keys(d.slots).some(function (sl) { var c = t.card(d.slots[sl]); return c && c.name.indexOf(q) >= 0; });
  });
  var shown = list.slice(0, more);
  return (<Card mob={mob} style={{ padding: 0, overflow: "hidden" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: mob ? "10px 10px" : "12px 14px", borderBottom: "1px solid var(--bd)", flexWrap: "wrap" }}>
      <span style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>{"덱 " + list.length + "개"}</span>
      <span style={{ fontSize: 11, color: "var(--td)" }}>{q ? "'" + q + "' 를 쓰는 덱" : "순위순 · 누르면 덱 전체"}</span>
      <span role="group" aria-label="줄에 보일 선수" style={{ display: "inline-flex", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 8, padding: 2 }}>
        {[["bat", "⚾ 타자"], ["pit", "🥎 투수"]].map(function (o) { var a = side === o[0]; return (<button key={o[0]} type="button" aria-pressed={a} onClick={function () { setSide(o[0]); }}
          style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: a ? 800 : 600, background: a ? "var(--card)" : "transparent", color: a ? "var(--acc)" : "var(--t2)", boxShadow: a ? "0 1px 3px rgba(0,0,0,0.25)" : "none" }}>{o[1]}</button>); })}
      </span>
      <input value={q} onChange={function (e) { setQ(e.target.value.trim()); }} placeholder="선수 이름" aria-label="선수 이름으로 찾기"
        style={{ marginLeft: "auto", width: mob ? 120 : 170, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--bd)", background: "var(--inner)", color: "var(--t1)", fontSize: 12 }} />
    </div>
    <div>
      {shown.map(function (d) {
        var id = d.pos || d.rank, on = open === id;
        return (<div key={id} style={{ borderBottom: "1px solid var(--bd)" }}>
          <DeckLine tools={t} deck={d} mob={mob} q={q} side={side} open={on} onToggle={function () { setOpen(on ? null : id); }} />
          {on && <DeckDetail tools={t} deck={d} mob={mob} mySlots={p.mySlots} onLab={p.onLab} onCard={p.onCard} initTable={p.openTable} />}
        </div>);
      })}
    </div>
    {list.length > shown.length && <button type="button" onClick={function () { setMore(more + 30); }}
      style={{ display: "block", width: "100%", padding: "11px 0", background: "transparent", border: "none", color: "var(--acc)", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{"더 보기 (" + (list.length - shown.length) + "개 더)"}</button>}
  </Card>);
}

/* ── ③ 내 덱 비교 ── */
function MineView(p) {
  var t = p.tools, mob = p.mob, my = p.mySlots || {}, own = p.ownSet || {};
  var team = p.myTeam;
  var pool = p.allDecks.filter(function (d) { return d.team === team; });
  var useTeam = pool.length >= 3;
  var decks = useTeam ? pool : p.allDecks;
  var uses = useMemo(function () { var o = {}; BAT.concat(["SP", "RP", "CP"]).forEach(function (k) { o[k] = usageOf(decks, k); }); return o; }, [decks]);
  var myIds = Object.keys(my).map(function (k) { return my[k]; });
  if (!myIds.length) return (<Card mob={mob}><div style={{ fontSize: 13, color: "var(--td)", textAlign: "center", padding: 20 }}>{"라인업에 선수를 넣으면 in100 덱과 견줄 수 있어요."}</div></Card>);
  /* 가장 닮은 덱 — 타자는 같은 자리 같은 카드, 투수는 같은 묶음에 있으면 같음 */
  var sim = decks.map(function (d) {
    var same = 0;
    BAT.forEach(function (sl) { if (my[sl] && d.slots[sl] === my[sl]) same++; });
    ["SP", "RP", "CP"].forEach(function (g) {
      var a = {}; Object.keys(d.slots).forEach(function (sl) { if (groupOf(sl) === g) a[d.slots[sl]] = 1; });
      Object.keys(my).forEach(function (sl) { if (groupOf(sl) === g && a[my[sl]]) same++; });
    });
    return { d: d, same: same };
  }).sort(function (a, b) { return b.same - a.same || (a.d.pos || a.d.rank) - (b.d.pos || b.d.rank); });
  var best = sim[0];
  var total = myIds.length;
  /* 자리마다 */
  var rows = BAT.map(function (sl) {
    var u = uses[sl], mine = my[sl], top = u.list[0];
    var mu = 0; u.list.forEach(function (r) { if (r.id === mine) mu = r.c; });
    return { sl: sl, mine: mine, mineV: pct(mu, u.n), top: top, topV: top ? pct(top.c, u.n) : 0, same: top && top.id === mine };
  });
  /* 가지고 있는데 라인업에 없는 인기 카드 / 없는 인기 카드 */
  var inLineup = {}; myIds.forEach(function (id) { inLineup[id] = 1; });
  var idle = [], want = [];
  BAT.concat(["SP", "RP", "CP"]).forEach(function (k) {
    var u = uses[k];
    u.list.forEach(function (r) {
      var v = pct(r.c, u.n); if (v < 25) return;
      if (inLineup[r.id]) return;
      var item = { id: r.id, k: k, v: v };
      if (own[r.id]) idle.push(item); else want.push(item);
    });
  });
  idle.sort(function (a, b) { return b.v - a.v; }); want.sort(function (a, b) { return b.v - a.v; });
  var kLabel = function (k) { var g = GROUPS.filter(function (x) { return x.id === k; })[0]; return g ? g.label : k; };
  /* 스킬 비교 — 내 라인업 카드마다 in100(전체)의 같은 카드 스킬 쓰임 */
  var myCards = p.myCards || {};
  var skillRows = Object.keys(myCards).map(function (sl) {
    var m = myCards[sl]; if (!m || !m.id) return null;
    var st = cardStats(p.allDecks, m.id); if (st.n < 2) return null;
    if (!st.ss.n) return null;
    return { sl: sl, id: m.id, n: st.ss.n, my: m.ss, sp: st.ss, rk: rankIn(st.ss, m.ss), tn: st.ts.n, tmy: m.tr, tmyp: m.trp, tsp: st.ts, trk: rankIn(st.ts, m.tr) };
  }).filter(Boolean).sort(function (a, b) { var o = { C: 1, "1B": 2, "2B": 3, "3B": 4, SS: 5, LF: 6, CF: 7, RF: 8, DH: 9 }; return (o[a.sl] || 10 + a.sl.charCodeAt(0)) - (o[b.sl] || 10 + b.sl.charCodeAt(0)) || a.sl.localeCompare(b.sl); });
  var cardLine = function (id, extra) {
    var c = t.card(id); if (!c) return (<span style={{ color: "var(--td)" }}>{"—"}</span>);
    return (<span style={{ display: "inline-flex", alignItems: "center", gap: 5, minWidth: 0 }}><TypeDot tools={t} ct={c.cardType} />
      <span style={{ fontWeight: 700, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
      <span style={{ fontSize: 10, color: "var(--t2)", whiteSpace: "nowrap" }}>{tagOf(c)}</span>{extra}</span>);
  };
  return (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <Card mob={mob}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Logo tools={t} team={team} size={28} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--t1)" }}>{"내 덱(" + (team || "구단 없음") + ") ↔ in100 " + (useTeam ? team + " " + pool.length + "덱" : "전체 " + decks.length + "덱")}</div>
          <div style={{ fontSize: 11, color: "var(--td)" }}>{useTeam ? "같은 구단 상위 덱과 견줘요" : "in100 에 같은 구단 덱이 " + pool.length + "개뿐이라 전체와 견줘요"}</div>
        </div>
        {best && <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "var(--td)" }}>{"가장 닮은 덱"}</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "var(--acc)", fontFamily: "var(--h)" }}>{best.d.rank + "위 " + best.d.team}<span style={{ fontSize: 12, color: "var(--t1)", fontWeight: 700, fontFamily: "inherit" }}>{" · " + total + "장 중 " + best.same + "장 같음"}</span>
            {p.onOpenDeck && <button type="button" onClick={function () { p.onOpenDeck(best.d); }} style={{ marginLeft: 8, padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--inner)", color: "var(--t1)", border: "1px solid var(--bd)", fontFamily: "inherit" }}>{"보기 ▸"}</button>}</div>
        </div>}
      </div>
    </Card>
    <Card mob={mob}>
      <Head title={"타선 — 자리마다"} sub={"내 카드를 상위 덱 몇 %가 쓰나 · 1순위와 다르면 표시"} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        {!mob && <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1.3fr) 64px minmax(0,1.3fr) 64px", gap: 8, fontSize: 10, color: "var(--td)", padding: "0 6px 6px" }}>
          <span>{"자리"}</span><span>{"내 카드"}</span><span style={{ textAlign: "right" }}>{"사용률"}</span><span>{"in100 1순위"}</span><span style={{ textAlign: "right" }}>{"사용률"}</span></div>}
        {rows.map(function (r) {
          var warn = !r.same && r.top && r.topV >= 40;
          if (mob) return (<div key={r.sl} style={{ padding: "8px 4px", borderTop: "1px solid var(--bd)", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><b style={{ width: 28, color: "var(--td)", fontSize: 11 }}>{r.sl}</b>{cardLine(r.mine)}<span style={{ marginLeft: "auto", fontFamily: "var(--m)", fontWeight: 800, color: r.same ? "#4FC3F7" : "var(--t1)" }}>{r.mineV + "%"}</span></div>
            {!r.same && r.top && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, paddingLeft: 34, color: warn ? "#FF9800" : "var(--t2)" }}>{"1순위 "}{cardLine(r.top.id)}<span style={{ marginLeft: "auto", fontFamily: "var(--m)" }}>{r.topV + "%"}</span></div>}
          </div>);
          return (<div key={r.sl} style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1.3fr) 64px minmax(0,1.3fr) 64px", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 6px", borderTop: "1px solid var(--bd)", background: warn ? "rgba(255,152,0,0.05)" : "transparent" }}>
            <b style={{ color: "var(--td)", fontSize: 11 }}>{r.sl}</b>
            {cardLine(r.mine)}
            <span style={{ textAlign: "right", fontFamily: "var(--m)", fontWeight: 800, color: r.same ? "#4FC3F7" : "var(--t1)" }}>{r.mineV + "%"}</span>
            {r.same ? <span style={{ fontSize: 11, color: "#4FC3F7", fontWeight: 700 }}>{"✓ 1순위와 같음"}</span> : cardLine(r.top && r.top.id)}
            <span style={{ textAlign: "right", fontFamily: "var(--m)", color: warn ? "#FF9800" : "var(--t2)", fontWeight: warn ? 800 : 500 }}>{r.same ? "" : r.topV + "%"}</span>
          </div>);
        })}
      </div>
    </Card>
    <Card mob={mob}>
      <Head title={"마운드 — 묶음마다"} sub={"내 투수를 상위 덱 몇 %가 쓰나 · 많이 쓰는데 내 덱에 없는 투수"} />
      {["SP", "RP", "CP"].map(function (g) {
        var u = uses[g], vOf = {}; u.list.forEach(function (r) { vOf[r.id] = pct(r.c, u.n); });
        var mine = Object.keys(my).filter(function (sl) { return groupOf(sl) === g; }).sort().map(function (sl) { return my[sl]; });
        var has = {}; mine.forEach(function (id) { has[id] = 1; });
        var miss = u.list.filter(function (r) { return !has[r.id] && pct(r.c, u.n) >= 30; }).slice(0, 3);
        return (<div key={g} style={{ display: "flex", gap: 10, padding: "8px 2px", borderTop: "1px solid var(--bd)", alignItems: "flex-start", flexDirection: mob ? "column" : "row" }}>
          <b style={{ width: 44, fontSize: 11, color: "var(--td)", paddingTop: 4 }}>{kLabel(g)}</b>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mine.map(function (id) {
                var c = t.card(id); if (!c) return null; var v = vOf[id] || 0;
                return (<span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, padding: "3px 8px", borderRadius: 6, background: "var(--inner)", border: "1px solid var(--bd)" }}>
                  <TypeDot tools={t} ct={c.cardType} /><b style={{ color: "var(--t1)" }}>{c.name}</b><span style={{ fontSize: 10, color: "var(--t2)" }}>{tagOf(c)}</span>
                  <b style={{ fontFamily: "var(--m)", color: v >= 50 ? "#4FC3F7" : v ? "var(--t1)" : "var(--td)" }}>{v + "%"}</b></span>);
              })}
            </div>
            {miss.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 11, color: "#FF9800" }}>
              <span>{"많이 쓰는데 없음"}</span>
              {miss.map(function (r) { var c = t.card(r.id); if (!c) return null;
                return (<span key={r.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 6, border: "1px dashed rgba(255,152,0,0.5)", color: "var(--t1)" }}>
                  <TypeDot tools={t} ct={c.cardType} />{c.name}<span style={{ fontSize: 10, color: "var(--t2)" }}>{tagOf(c)}</span><b style={{ fontFamily: "var(--m)", color: "#FF9800" }}>{pct(r.c, u.n) + "%"}</b>{own[r.id] && <Mark kind="own">{"보유"}</Mark>}</span>); })}
            </div>}
          </div>
        </div>);
      })}
    </Card>
    {skillRows.some(function (r) { return r.tn; }) && <Card mob={mob}>
      <Head title={"🏋️ 내 카드 훈재분 ↔ in100"} sub={"같은 카드를 쓴 in100 덱의 훈재분(능력치 상세 창 훈련 줄 · 사이트 계산식)과 견줌"} />
      {!mob && <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1.6fr) 84px 84px 84px 84px minmax(0,1.2fr)", gap: 8, fontSize: 10, color: "var(--td)", padding: "0 2px 6px" }}>
        <span>{"자리"}</span><span>{"카드"}</span><span style={{ textAlign: "right", color: "#4FC3F7" }}>{"내 훈재분"}</span><span style={{ textAlign: "right" }}>{"in100 최고"}</span><span style={{ textAlign: "right" }}>{"중앙"}</span><span style={{ textAlign: "right" }}>{"최저"}</span><span>{"내 자리"}</span></div>}
      {skillRows.filter(function (r) { return r.tn; }).slice(0, mob ? 10 : 21).map(function (r) {
        var pos = r.trk ? r.trk / (r.tn + 1) : 1, col = r.tmy == null ? "var(--td)" : pos <= 0.34 ? "#4FC3F7" : pos <= 0.67 ? "var(--t1)" : "#FF9800";
        var where = r.tmy == null ? "훈련 미입력" : r.trk > r.tn ? "in100 최저보다 낮음" : r.tmy >= r.tsp.max - 0.05 ? "in100 최고 이상 👑" : "in100 " + r.tn + "장 중 " + r.trk + "등";
        var v2 = function (v, pc, c2) { return (<span style={{ textAlign: "right", fontFamily: "var(--m)", color: c2, lineHeight: 1.1 }}>{f1(v)}{pc != null && <span style={{ display: "block", fontSize: 9, color: "var(--td)" }}>{topPct(pc)}</span>}</span>); };
        if (mob) return (<div key={r.sl} onClick={function () { if (p.onCard) p.onCard(r.id); }} style={{ padding: "8px 2px", borderTop: "1px solid var(--bd)", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><b style={{ width: 28, fontSize: 11, color: "var(--td)" }}>{r.sl}</b>{cardLine(r.id)}<b style={{ marginLeft: "auto", fontFamily: "var(--m)", fontSize: 14, color: col }}>{f1(r.tmy)}</b></div>
          <div style={{ fontSize: 11, color: "var(--t2)", paddingLeft: 34, marginTop: 2 }}>{"in100 최고 " + f1(r.tsp.max) + " · 중앙 " + f1(r.tsp.med) + " · " + where}</div>
        </div>);
        return (<div key={r.sl} onClick={function () { if (p.onCard) p.onCard(r.id); }} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1.6fr) 84px 84px 84px 84px minmax(0,1.2fr)", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 2px", borderTop: "1px solid var(--bd)", cursor: "pointer" }}>
          <b style={{ fontSize: 11, color: "var(--td)" }}>{r.sl}</b>{cardLine(r.id)}
          {v2(r.tmy, r.tmyp, col)}{v2(r.tsp.max, r.tsp.pmax, "var(--acc)")}{v2(r.tsp.med, r.tsp.pmed, "var(--t1)")}{v2(r.tsp.min, r.tsp.pmin, "var(--t2)")}
          <span style={{ fontSize: 11, color: col }}>{where}</span>
        </div>);
      })}
      <div style={{ fontSize: 10, color: "var(--td)", marginTop: 6 }}>{"상위 % = 사이트 훈재분 계산기 분포(카드 종류별) · 파랑 = in100 위쪽 1/3 · 주황 = 아래쪽 1/3 · 줄을 누르면 in100 훈련 분배"}</div>
    </Card>}
    {skillRows.length > 0 && <Card mob={mob}>
      <Head title={"🎯 내 카드 스킬 점수 ↔ in100"} sub={"같은 카드를 쓴 in100 덱의 스킬 점수와 견줌 (사이트 계산식 · 신버전)"} />
      {!mob && <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1.6fr) 70px 70px 70px 70px minmax(0,1.4fr)", gap: 8, fontSize: 10, color: "var(--td)", padding: "0 2px 6px" }}>
        <span>{"자리"}</span><span>{"카드"}</span><span style={{ textAlign: "right", color: "#4FC3F7" }}>{"내 점수"}</span><span style={{ textAlign: "right" }}>{"in100 최고"}</span><span style={{ textAlign: "right" }}>{"중앙"}</span><span style={{ textAlign: "right" }}>{"최저"}</span><span>{"내 자리"}</span></div>}
      {skillRows.slice(0, mob ? 10 : 21).map(function (r) {
        var pos = r.rk ? r.rk / (r.n + 1) : 1, col = r.my == null ? "var(--td)" : pos <= 0.34 ? "#4FC3F7" : pos <= 0.67 ? "var(--t1)" : "#FF9800";
        var where = r.my == null ? "스킬 미입력" : r.rk > r.n ? "in100 최저보다 낮음" : r.my >= r.sp.max - 0.05 ? "in100 최고 이상 👑" : "in100 " + r.n + "장 중 " + r.rk + "등";
        if (mob) return (<div key={r.sl} onClick={function () { if (p.onCard) p.onCard(r.id); }} style={{ padding: "8px 2px", borderTop: "1px solid var(--bd)", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><b style={{ width: 28, fontSize: 11, color: "var(--td)" }}>{r.sl}</b>{cardLine(r.id)}<b style={{ marginLeft: "auto", fontFamily: "var(--m)", fontSize: 14, color: col }}>{f1(r.my)}</b></div>
          <div style={{ fontSize: 11, color: "var(--t2)", paddingLeft: 34, marginTop: 2 }}>{"in100 최고 " + f1(r.sp.max) + " · 중앙 " + f1(r.sp.med) + " · " + where}</div>
        </div>);
        return (<div key={r.sl} onClick={function () { if (p.onCard) p.onCard(r.id); }} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1.6fr) 70px 70px 70px 70px minmax(0,1.4fr)", gap: 8, alignItems: "center", fontSize: 12, padding: "7px 2px", borderTop: "1px solid var(--bd)", cursor: "pointer" }}>
          <b style={{ fontSize: 11, color: "var(--td)" }}>{r.sl}</b>{cardLine(r.id)}
          <b style={{ textAlign: "right", fontFamily: "var(--m)", fontSize: 14, color: col }}>{f1(r.my)}</b>
          <span style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--acc)", fontWeight: 800 }}>{f1(r.sp.max)}</span>
          <span style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--t1)" }}>{f1(r.sp.med)}</span>
          <span style={{ textAlign: "right", fontFamily: "var(--m)", color: "var(--t2)" }}>{f1(r.sp.min)}</span>
          <span style={{ fontSize: 11, color: col }}>{where}</span>
        </div>);
      })}
      <div style={{ fontSize: 10, color: "var(--td)", marginTop: 6 }}>{"같은 카드를 라인업에 넣은 in100 덱끼리 견줌 · 파랑 = 위쪽 1/3 · 주황 = 아래쪽 1/3 · 줄을 누르면 그 카드의 점수 · 스킬 · 훈련 전체"}</div>
    </Card>}
    <div style={{ display: mob ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <Card mob={mob}>
        <Head title={"💡 가지고 있는데 안 쓰는 인기 카드"} sub={"내 선수에 있고 상위 덱 25%+ 가 씀"} />
        {idle.length ? idle.slice(0, 8).map(function (x) {
          return (<div key={x.k + x.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 2px", borderTop: "1px solid var(--bd)" }}>
            <span style={{ width: 40, fontSize: 10, color: "var(--td)", fontWeight: 800 }}>{kLabel(x.k)}</span>{cardLine(x.id)}
            <span style={{ marginLeft: "auto", fontFamily: "var(--m)", fontWeight: 800, color: "#81C784" }}>{x.v + "%"}</span></div>);
        }) : <div style={{ fontSize: 12, color: "var(--td)" }}>{"없어요 — 가진 인기 카드는 이미 다 쓰고 있어요"}</div>}
      </Card>
      <Card mob={mob}>
        <Head title={"🎯 상위권이 많이 쓰는데 없는 카드"} sub={"내 선수에 없음 · 상위 덱 25%+"} />
        {want.slice(0, 8).map(function (x) {
          return (<div key={x.k + x.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 2px", borderTop: "1px solid var(--bd)" }}>
            <span style={{ width: 40, fontSize: 10, color: "var(--td)", fontWeight: 800 }}>{kLabel(x.k)}</span>{cardLine(x.id)}
            <span style={{ marginLeft: "auto", fontFamily: "var(--m)", fontWeight: 800, color: "var(--acc)" }}>{x.v + "%"}</span></div>);
        })}
      </Card>
    </div>
  </div>);
}

/* ── ④ 셋포 설정 — 구간마다 in100 좌 / 우 ── */
function SdView(p) {
  var t = p.tools, mob = p.mob, decks = p.decks.filter(function (d) { return d.sdi; });
  var rows = (t.sdRows || []).map(function (r) {
    var L = 0, R = 0, yr = {};
    decks.forEach(function (d) {
      if (d.sp != null && r.sp > d.sp) return;
      if ((d.sdq || []).indexOf(r.sp) >= 0) return;
      var v = d.sdi[r.sp]; if (v == null) return;
      var sd = String(v).split(":"); if (sd[0] === "L") L++; else R++;
      if (sd[1]) yr[sd[1]] = (yr[sd[1]] || 0) + 1;
    });
    var my = p.mySd && t.sdPick ? String(t.sdPick(p.mySd, r.sp) || "").charAt(0) : "";
    var yTop = Object.keys(yr).sort(function (a, b) { return yr[b] - yr[a]; }).slice(0, 2).map(function (y) { return y.slice(-2) + "년 " + yr[y]; }).join(" · ");
    return { r: r, L: L, R: R, n: L + R, my: my, yTop: yTop };
  });
  return (<Card mob={mob}>
    <Head title={"🎛️ 셋포 설정 — 구간마다 in100 이 고른 쪽"} sub={decks.length + "덱 · 카드마다 세트덱 수치를 모두 맞추는 설정을 찾음 · 그 덱 구성으론 어느 쪽이든 같은 구간은 뺌"} />
    {!mob && <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) 150px minmax(0,1fr) 56px", gap: 8, fontSize: 10, color: "var(--td)", padding: "0 4px 6px" }}>
      <span>{"구간"}</span><span>{"좌"}</span><span style={{ textAlign: "center" }}>{"좌 : 우"}</span><span style={{ textAlign: "right" }}>{"우"}</span><span style={{ textAlign: "center", color: "#4FC3F7" }}>{"내 설정"}</span></div>}
    {rows.map(function (x) {
      var lp = x.n ? Math.round(x.L / x.n * 100) : 0, rp = x.n ? 100 - lp : 0, maj = lp >= rp ? "L" : "R", off = x.my && x.n >= 5 && x.my !== maj && Math.max(lp, rp) >= 70;
      return (<div key={x.r.sp} style={{ display: "grid", gridTemplateColumns: mob ? "34px minmax(0,1fr) 44px" : "40px minmax(0,1fr) 150px minmax(0,1fr) 56px", gap: 8, alignItems: "center", fontSize: 12, padding: "6px 4px", borderTop: "1px solid var(--bd)", background: off ? "rgba(255,152,0,0.06)" : "transparent" }}>
        <b style={{ fontFamily: "var(--m)", color: "var(--td)" }}>{x.r.sp}</b>
        {mob ? (<div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 11 }}><span title={x.r.lDesc} style={{ color: lp >= rp ? "var(--t1)" : "var(--td)", fontWeight: lp >= rp ? 800 : 500 }}>{x.r.l}</span><span title={x.r.rDesc} style={{ color: rp > lp ? "var(--t1)" : "var(--td)", fontWeight: rp > lp ? 800 : 500, textAlign: "right" }}>{x.r.r}</span></div>
          <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", background: "var(--bar)", marginTop: 3 }}><div style={{ width: lp + "%", background: "#4FC3F7" }} /><div style={{ width: rp + "%", background: "#FFB74D" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--td)", fontFamily: "var(--m)", marginTop: 2 }}><span>{lp + "%"}</span><span>{x.yTop}</span><span>{rp + "% · " + x.n + "덱"}</span></div>
        </div>) : (<React.Fragment>
          <span title={x.r.lDesc} style={{ color: lp >= rp ? "var(--t1)" : "var(--td)", fontWeight: lp >= rp ? 800 : 500 }}>{x.r.l}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "var(--bar)" }}><span style={{ width: lp + "%", background: "#4FC3F7" }} /><span style={{ width: rp + "%", background: "#FFB74D" }} /></span>
            <span style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "var(--m)", color: "var(--t2)" }}><span>{lp + "%"}</span><span style={{ color: "var(--td)" }}>{x.n + "덱"}</span><span>{rp + "%"}</span></span></span>
          <span title={x.r.rDesc} style={{ textAlign: "right", color: rp > lp ? "var(--t1)" : "var(--td)", fontWeight: rp > lp ? 800 : 500 }}>{x.r.r}{x.yTop && <span style={{ display: "block", fontSize: 10, color: "var(--td)", fontWeight: 500 }}>{x.yTop}</span>}</span>
        </React.Fragment>)}
        <span style={{ textAlign: "center", fontWeight: 800, color: off ? "#FF9800" : "#4FC3F7" }}>{x.my === "L" ? "좌" : x.my === "R" ? "우" : "—"}</span>
      </div>);
    })}
    <div style={{ fontSize: 10, color: "var(--td)", marginTop: 6 }}>{"주황 줄 = in100 70%+ 가 고른 쪽과 내 설정이 다름 · 이름에 마우스를 올리면 인게임 원문 · 연도 구간은 많이 고른 연도"}</div>
  </Card>);
}

/* ── 구단 분포 (전체일 때) ── */
function TeamSpread(p) {
  var t = p.tools, mob = p.mob;
  var cnt = {}; p.decks.forEach(function (d) { cnt[d.team] = (cnt[d.team] || 0) + 1; });
  var teams = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; });
  var max = teams.length ? cnt[teams[0]] : 1;
  var top10 = {}; p.decks.forEach(function (d) { if (d.rank <= 10) top10[d.team] = (top10[d.team] || 0) + 1; });
  return (<Card mob={mob}>
    <Head title={"구단 분포"} sub={"in100 에 든 덱 수 · 괄호는 10위 안"} />
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", columnGap: 18, rowGap: 6 }}>
      {teams.map(function (tm) {
        return (<div key={tm} onClick={function () { p.onPick(tm); }} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <Logo tools={t} team={tm} size={18} />
          <span style={{ width: 34, fontSize: 12, fontWeight: 700, color: "var(--t1)" }}>{tm}</span>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--bar)", overflow: "hidden" }}><div style={{ width: (cnt[tm] / max * 100) + "%", height: "100%", background: "linear-gradient(90deg,#FFD54F,#FF8F00)", borderRadius: 5 }} /></div>
          <span style={{ width: 54, textAlign: "right", fontSize: 12, fontFamily: "var(--m)", color: "var(--t1)" }}><b>{cnt[tm]}</b>{top10[tm] ? <span style={{ color: "var(--td)" }}>{" (" + top10[tm] + ")"}</span> : null}</span>
        </div>);
      })}
    </div>
  </Card>);
}

/* ── 페이지 ── */
export default function In100Page(p) {
  var t = p.tools, mob = p.mobile, snap = p.snap;
  var myTeam = p.myTeam || "";
  var decksAll = (snap && snap.decks) || [];
  var counts = {}; decksAll.forEach(function (d) { counts[d.team] = (counts[d.team] || 0) + 1; });
  var teams = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
  var _tm = useState(counts[myTeam] ? myTeam : ""); var team = _tm[0]; var setTeam = _tm[1];
  var _v = useState(p.view || "pop"); var view = _v[0]; var setView = _v[1];
  var _or = useState(p.openRank || null); var openRank = _or[0]; var setOpenRank = _or[1];
  var _sh = useState(p.sheet || null); var sheet = _sh[0]; var setSheet = _sh[1];
  var decks = team ? decksAll.filter(function (d) { return d.team === team; }) : decksAll;
  var mySlots = p.mySlots || {};
  var mySet = {}; Object.keys(mySlots).forEach(function (k) { mySet[mySlots[k]] = 1; });
  var ownSet = p.ownSet || {};
  if (!decksAll.length) return (<Card mob={mob}><div style={{ textAlign: "center", padding: 30, color: "var(--td)" }}>{"아직 모은 판이 없어요."}</div></Card>);
  var mineCard = sheet ? (function () { var mc = p.myCards || {}; for (var k in mc) if (mc[k] && mc[k].id === sheet) return mc[k]; return null; })() : null;
  var openDeck = function (d) { setSheet(null); if (team && team !== d.team) setTeam(d.team); setOpenRank(d.pos || d.rank); setView("list"); };
  return (<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 800 }}>{"랭킹 챌린지 시즌 " + snap.season + " (" + snap.period + ") 1~100위"}</div>
        <div style={{ fontSize: 11, color: "var(--td)", marginTop: 2 }}>{snap.at.slice(5).replace("-", "/") + " 기준 덱 · " + decksAll.length + "덱(같은 점수는 같은 순위라 100위가 둘)"}</div>
      </div>
      <select aria-label="판 고르기" defaultValue={snap.id} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--bd)", background: "var(--inner)", color: "var(--t1)", fontSize: 12 }}>
        <option value={snap.id}>{"시즌 " + snap.season + " (최신)"}</option>
      </select>
    </div>
    <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
      <Chip on={!team} onClick={function () { setTeam(""); }}>{"전체 " + decksAll.length}</Chip>
      {teams.map(function (tm) { return (<Chip key={tm} on={team === tm} onClick={function () { setTeam(tm); }}><Logo tools={t} team={tm} size={14} />{tm + " " + counts[tm]}{tm === myTeam && <span style={{ fontSize: 9, color: "#4FC3F7" }}>{"내 구단"}</span>}</Chip>); })}
    </div>
    <div role="tablist" style={{ display: "flex", gap: 0, background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 10, padding: 3, alignSelf: mob ? "stretch" : "flex-start" }}>
      {[["pop", "인기 카드"], ["list", "덱 목록"], ["sd", mob ? "셋포" : "셋포 설정"], ["mine", "내 덱 비교"]].map(function (x) {
        var a = view === x[0];
        return (<button key={x[0]} role="tab" aria-selected={a} type="button" onClick={function () { setView(x[0]); }}
          style={{ flex: mob ? 1 : "none", padding: mob ? "7px 4px" : "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: a ? 800 : 600,
            background: a ? "var(--card)" : "transparent", color: a ? "var(--acc)" : "var(--t2)", boxShadow: a ? "0 1px 3px rgba(0,0,0,0.25)" : "none" }}>{x[1]}</button>);
      })}
    </div>
    {view === "pop" && !team && <TeamSpread tools={t} mob={mob} decks={decksAll} onPick={setTeam} />}
    {view === "pop" && <PopularView tools={t} mob={mob} decks={decks} team={team} mySet={mySet} ownSet={ownSet} onCard={setSheet} />}
    {view === "list" && <DeckListView key={"l" + openRank} tools={t} mob={mob} decks={decks} mySlots={mySlots} openRank={openRank} openTable={p.openTable} onLab={p.onLab} onCard={setSheet} />}
    {view === "sd" && <SdView tools={t} mob={mob} decks={decks} mySd={p.mySd} />}
    {view === "mine" && <MineView tools={t} mob={mob} allDecks={decksAll} myTeam={myTeam} mySlots={mySlots} ownSet={ownSet} myCards={p.myCards} onCard={setSheet} onOpenDeck={openDeck} />}
    <div style={{ fontSize: 10, color: "var(--td)", lineHeight: 1.6 }}>{"· 인게임 랭킹 챌린지 지난 시즌 순위 화면에서 모은 덱이에요(모은 날 기준이라 시즌 중 덱과 조금 다를 수 있어요). 닉네임은 싣지 않아요. · 사용률 = 그 칸에 그 카드를 넣은 덱 수 ÷ 덱 수 · 도감에 없는 카드(시즌 카드 등)는 빈칸"}</div>
    {sheet && <CardSheet tools={t} mob={mob} decks={decksAll} id={sheet} mine={mineCard} onClose={function () { setSheet(null); }} onOpenDeck={openDeck} />}
  </div>);
}
