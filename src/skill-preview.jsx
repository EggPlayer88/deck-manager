/* 비공개 스킬점수표 미리보기 — 데이터센터 '🔒 스킬점수표(비공개)' 탭 (2026-11-26 사용자 요청)
   "우리가 연구한 새로운 가중치와 새로운 산정근거를 바탕으로 세팅된 스킬점수표를 열어서 극소수의 인증된 유저만 볼 수 있게"

   - 표 내용은 이 파일에 없다. 탭을 열 때 서버(skp_get)에서 받는다 — 권한(게임 계정 인증 + 관리자가 허용)이 없으면 서버가 막는다
   - 이 파일은 데이터센터가 권한이 있을 때만 불러온다(React.lazy) — 권한 없는 사람은 이 화면 코드도 받지 않는다
   - 화면 전체에 내 게임 닉네임을 옅게 깔아 둔다(캡처 유출 억제). 관리자는 같은 화면 위에서 '열람 권한'을 주고 거둔다
   - 공개 수준: 지금 · 새 점수(Lv5 ~ 10) · 분류 · 달라진 까닭(갈래) · 비고 · 산정 기준(원칙 글)만.
     스킬 분해 · 계산식 · 능력치 가중치 숫자는 서버 자료에도 넣지 않았다(협업자용 자료와 같은 공개 수준)
   - 그림판 스킬 아이콘(사용자가 만든 135개, 11-27)은 이 표에만 — 그림 public/skill-icons(s 80px · l 240px), 이름 → 그림 표 skill-icons.js
   - 산정 기준에 능력치 가중치 숫자(표 자료 wt)를 보여 주고, 바꿔서 '확인'을 누르면 서버(skp_custom)가 그 가중치로 다시 매긴 점수만 돌려준다(11-27).
     스킬별 능력치 몫은 서버에만 있다. '비공개 가중치로' 한 번이면 원래 표로. 결과는 이 탭을 오가도 남고, 새로 고치면 사라진다 */
import React from "react";
import { skpGet, skpCustom, skpList, skpGrant, skpRevoke } from "./skill-preview-api.js";
import { GRADES } from "./skill-icons.js";
import { ns, fx, iconOf, SkIcon, Pill, Seg } from "./skill-ui.jsx";

var CATS = ["타자", "선발", "중계", "마무리"];
var LVS = [5, 6, 7, 8, 9, 10];
var SORTS = [["new", "새 점수"], ["up", "오른 순"], ["down", "내린 순"], ["name", "이름"]];
/* 서버 표를 만들 때와 같은 잣대 — 같음 = 3% 이하 또는 0.2점 미만 · 대폭 = 15% 넘고 1점 이상 */
function klass(o, n) {
  var d = n - o, rel = o ? Math.abs(d) / o : (d ? 1 : 0);
  if (rel <= 0.03 || Math.abs(d) < 0.2) return "같음";
  return rel > 0.15 && Math.abs(d) >= 1 ? "대폭" : "소폭";
}
var dirOf = function (d) { return d > 0.004 ? "up" : d < -0.004 ? "down" : "same"; };
var DCOL = { up: "var(--vf-ok)", down: "var(--vf-err)", same: "var(--td)" };
var DARR = { up: "▲", down: "▼", same: "" };
/* 능력치 가중치 칸 — 표 자료 wt.cols 와 같은 이름. 화면에는 타자 · 투수 두 줄 + 상대 깎기 배율 */
var WCOL = { "파": "파워", "정": "정확", "선": "선구", "인": "인내", "주": "주루", "수": "수비", "속": "구속", "변": "변화", "구": "구위", "제": "제구", "지": "지구력", "투": "수비" };
var WCOL2 = { "수": "수비(타자)", "투": "수비(투수)" };
var WROWS = [["타자", ["파", "정", "선", "인", "주", "수"]], ["투수", ["변", "구", "제", "속", "지", "투"]]];
var WMAX = 5, OMAX = 3;
var CUSTOM_KEEP = null;   /* 내 가중치 결과 — 다른 메뉴에 갔다 와도 그대로, 새로 고치면 비공개 가중치로 */
function wNum(s) { var t = String(s == null ? "" : s).trim(); return /^(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN; }
function pctTxt(d, o) {
  if (!o) return d ? "새로" : "";
  var p = d / o * 100;
  return (p > 0.05 ? "+" : p < -0.05 ? "−" : "") + Math.abs(p).toFixed(1) + "%";
}
function md(s, withTime) {
  var d = s ? new Date(s) : null; if (!d || isNaN(d)) return "";
  var t = (d.getMonth() + 1) + "." + String(d.getDate()).padStart(2, "0");
  return withTime ? t + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : t;
}
function noteTags(m) {
  var t = [];
  if (/잠정/.test(m)) t.push(["잠정", "var(--vf-warn)", "가정값이 들어간 조건이 있어요 — 더 정확한 자료가 생기면 비율만 고쳐요"]);
  if (/참고 행/.test(m)) t.push(["참고", "var(--vf-info)", "팀 버프까지 넣은 참고 값이에요(팀 버프는 덱 전체에 따로 더해요)"]);
  if (/그대로/.test(m)) t.push(["그대로", "var(--td)", m]);
  return t;
}
function parsePayload(P) {
  return {
    v: P.v || "", t: P.t || "",
    rows: (P.rows || []).map(function (a, i) {
      var o = a[2] || [], s = a[3] || [], m = a[6] || "";
      /* ref = 팀 버프까지 넣은 참고 행(줄 세우기에서 맨 뒤로) · zero = 점수에 드는 효과가 없는 스킬(모든 레벨 0점) */
      return { i: i, c: a[0], n: a[1], k: ns(a[1]), ic: iconOf(a[0], a[1]), o: o, s: s, g: a[4] || "", w: a[5] || "", m: m,
        ref: /참고 행/.test(m), zero: !o.some(Boolean) && !s.some(Boolean) };
    }),
    extra: (P.extra || []).map(function (a, j) { return { j: j, c: a[0], n: a[1], ic: iconOf(a[0], a[1]), s: a[2] || [], m: a[3] || "" }; }),
    basis: P.basis || [],
    wt: P.wt && Array.isArray(P.wt.cols) && Array.isArray(P.wt.def) && P.wt.cols.length === P.wt.def.length ? P.wt : null
  };
}

/* 닉네임 워터마크 — 화면 전체에 옅게 반복(클릭 · 선택은 그대로 아래로 간다) */
function Watermark(p) {
  var esc = String(p.text).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + p.w + '" height="' + p.h + '"><text x="50%" y="55%" text-anchor="middle" '
    + 'transform="rotate(-22 ' + (p.w / 2) + ' ' + (p.h / 2) + ')" font-family="Pretendard,Noto Sans KR,sans-serif" font-size="13" font-weight="700" fill="#8a8f98">' + esc + '</text></svg>';
  return (<div aria-hidden="true" className="skp-wm" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 3,
    backgroundImage: 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")', backgroundRepeat: "repeat" }} />);
}

/* 레벨 여섯 개를 한 번에 — 펼친 줄 */
function LvTable(p) {
  var r = p.r, mob = p.mobile, cs = p.cs, S = cs || r.s;
  var cells = LVS.map(function (lv, i) { var on = !!(r.o[i] || S[i]); return { lv: lv, on: on, o: r.o[i] || 0, b: r.s[i] || 0, s: S[i] || 0, d: (S[i] || 0) - (r.o[i] || 0) }; });
  var head = { fontSize: 10.5, color: "var(--td)", fontWeight: 700, textAlign: "right" };
  var num = { fontFamily: "var(--m)", fontSize: mob ? 11.5 : 12.5, textAlign: "right", whiteSpace: "nowrap" };
  return (<div style={{ display: "grid", gridTemplateColumns: (mob ? "34px" : "44px") + " repeat(6, minmax(0, 1fr))", columnGap: mob ? 4 : 10, rowGap: 5, alignItems: "baseline" }}>
    <span />
    {cells.map(function (c) { return <span key={"h" + c.lv} style={Object.assign({}, head, p.hi === c.lv - 5 ? { color: "var(--acc)" } : {})}>{"Lv" + c.lv}</span>; })}
    <span style={{ fontSize: 11, color: "var(--td)" }}>{"지금"}</span>
    {cells.map(function (c) { return <span key={"o" + c.lv} style={Object.assign({}, num, { color: "var(--t2)" })}>{c.on ? fx(c.o) : "—"}</span>; })}
    {cs && <span style={{ fontSize: 11, color: "var(--acp)", fontWeight: 800 }} title="비공개 판 새 점수">{"새"}</span>}
    {cs && cells.map(function (c) { return <span key={"b" + c.lv} style={Object.assign({}, num, { color: "var(--t2)" })}>{c.on ? fx(c.b) : "—"}</span>; })}
    <span style={{ fontSize: 11, color: cs ? "var(--acc)" : "var(--acp)", fontWeight: 800 }} title={cs ? "내 가중치로 다시 매긴 점수" : "새 점수"}>{cs ? "내" : "새"}</span>
    {cells.map(function (c) { return <span key={"s" + c.lv} style={Object.assign({}, num, { color: "var(--t1)", fontWeight: 700 })}>{c.on ? fx(c.s) : "—"}</span>; })}
    <span style={{ fontSize: 11, color: "var(--td)" }}>{"차이"}</span>
    {cells.map(function (c) { var dr = dirOf(c.d); return <span key={"d" + c.lv} style={Object.assign({}, num, { color: DCOL[dr], fontSize: mob ? 10.5 : 11.5 })}>{c.on ? (dr === "same" ? "±0" : (c.d > 0 ? "+" : "−") + Math.abs(c.d).toFixed(2)) : ""}</span>; })}
  </div>);
}

function Detail(p) {
  var x = p.x, r = x.r, mob = p.mobile, gr = r.ic ? GRADES[r.ic.g] : null;
  /* 큰 아이콘 + 등급(점 색 = 아이콘 테두리 색) */
  var badge = r.ic ? (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flexShrink: 0 }}>
    <SkIcon ic={r.ic} size={mob ? 84 : 116} big />
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--t2)", whiteSpace: "nowrap" }}>
      <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: gr[1] }} />{gr[0] + " · " + (r.c === "타자" ? "타자" : "투수")}</span>
  </div>) : null;
  var info = (<div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "auto 1fr", columnGap: 12, rowGap: 4, fontSize: 12, lineHeight: 1.55 }}>
      <span style={{ color: "var(--td)", fontWeight: 700 }}>{x.cs ? "비공개 판 까닭" : "달라진 까닭"}</span>
      <span style={{ color: "var(--t2)" }}>{r.w || (r.g === "같음" ? "Lv6 기준 거의 같아요" : "—")}</span>
      {x.fixed ? (<React.Fragment><span style={{ color: "var(--td)", fontWeight: 700 }}>{"내 가중치"}</span><span style={{ color: "var(--t2)" }}>{"가중치와 상관없이 정해 둔 줄이라 그대로예요"}</span></React.Fragment>) : null}
      {r.m ? (<React.Fragment><span style={{ color: "var(--td)", fontWeight: 700 }}>{"비고"}</span><span style={{ color: "var(--t2)" }}>{r.m}</span></React.Fragment>) : null}
      {x.my ? (<React.Fragment><span style={{ color: "var(--td)", fontWeight: 700 }}>{"내 라인업"}</span>
        <span style={{ color: "var(--acc)" }}>{x.my.map(function (q) { return q.slot + " " + (q.nm || "") + " Lv" + q.lv; }).join(" · ")}</span></React.Fragment>) : null}
    </div>);
  if (mob) return (<div className="skp-detail" style={{ padding: "12px 10px", background: "var(--inner)", borderBottom: "1px solid var(--bd)" }}>
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>{badge}<div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>{info}</div></div>
    <LvTable r={r} mobile hi={x.li} cs={x.cs} />
  </div>);
  return (<div className="skp-detail" style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "14px 16px 16px", background: "var(--inner)", borderBottom: "1px solid var(--bd)" }}>
    {badge}
    <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}><LvTable r={r} hi={x.li} cs={x.cs} /><div style={{ marginTop: 12 }}>{info}</div></div>
  </div>);
}

/* ── 능력치 가중치 — 산정 기준 안. 숫자를 바꾸고 '확인' → 서버가 그 가중치로 다시 매긴 점수만 돌려준다 ── */
function WeightPanel(p) {
  var wt = p.wt, mob = p.mobile, cust = p.cust;
  var KEYS = wt.cols.concat(["opp"]);
  var defOf = function (k) { return k === "opp" ? wt.opp : wt.def[wt.cols.indexOf(k)]; };
  var curOf = function (k) { return cust ? Number(k === "opp" ? cust.opp : cust.w[k]) : defOf(k); };
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };      /* 소수 셋째 자리까지 */
  var fmt = function (v) { return Number(v).toFixed(3).replace(/0$/, ""); };
  var fill = function (f) { var o = {}; KEYS.forEach(function (k) { o[k] = fmt(f(k)); }); return o; };
  var _v = React.useState(function () { return fill(curOf); }); var vals = _v[0]; var setVals = _v[1];
  var _b = React.useState(false); var busy = _b[0]; var setBusy = _b[1];
  var _m = React.useState(""); var msg = _m[0]; var setMsg = _m[1];
  React.useEffect(function () { setVals(fill(curOf)); setMsg(""); }, [cust]);
  var num = {}, badK = {};
  KEYS.forEach(function (k) { var v = wNum(vals[k]); num[k] = v; if (isNaN(v) || v < 0 || v > (k === "opp" ? OMAX : WMAX)) badK[k] = true; });
  var anyBad = Object.keys(badK).length > 0;
  var sameAs = function (f) { return !anyBad && KEYS.every(function (k) { return Math.abs(r3(num[k]) - f(k)) < 1e-9; }); };
  var isDef = sameAs(defOf), isCur = sameAs(curOf);
  /* 타자 · 투수 가중치 합 — 각각 비공개 판의 합(2.40)과 같아야 확인(서버도 같은 규칙) */
  var GSUM = WROWS.map(function (g) {
    var ks = g[1].filter(function (k) { return wt.cols.indexOf(k) >= 0; });
    var tgt = ks.reduce(function (t, k) { return t + defOf(k); }, 0);
    var cur = ks.reduce(function (t, k) { return t + (isNaN(num[k]) ? 0 : r3(num[k])); }, 0);
    var bad = ks.some(function (k) { return badK[k]; });
    var ok = !bad && Math.round(cur * 1000) === Math.round(tgt * 1000);
    return { nm: g[0], tgt: tgt, cur: cur, ok: ok, bad: bad, d: cur - tgt, ch: ks.some(function (k) { return !badK[k] && Math.abs(r3(num[k]) - defOf(k)) > 1e-9; }) };
  });
  var sumBad = GSUM.some(function (s) { return !s.ok; });
  var sumEl = function (gi) {
    var s = GSUM[gi];
    var txt = s.bad ? "합 —" : s.ok ? "합 " + s.tgt.toFixed(2) + (s.ch ? " ✓" : "") : "합 " + s.cur.toFixed(2) + " · " + Math.abs(s.d).toFixed(2) + (s.d > 0 ? " 넘음" : " 모자람");
    return (<span key={"sum" + gi} title={s.nm + " 가중치 합은 " + s.tgt.toFixed(2) + " 이어야 해요"} style={{ fontSize: 11.5, fontWeight: 800, fontFamily: "var(--m)", whiteSpace: "nowrap",
      marginLeft: mob ? 0 : "auto", color: s.ok ? (s.ch ? "var(--vf-ok)" : "var(--td)") : "var(--vf-err)" }}>{txt}</span>);
  };
  var apply = function () {
    if (anyBad || sumBad || busy || isCur) return;
    if (isDef) { p.onReset(); return; }
    var w = {}; wt.cols.forEach(function (k) { w[k] = r3(num[k]); }); w.opp = r3(num.opp);
    setBusy(true); setMsg("");
    p.onApply(w).catch(function (e) { setMsg(e.message || String(e)); }).then(function () { setBusy(false); });
  };
  var reset = function () { setVals(fill(defOf)); setMsg(""); p.onReset(); };
  var lab = function (k) { return k === "opp" ? "상대 깎기 배율" : WCOL[k]; };
  var cell = function (k) {
    var changed = !badK[k] && Math.abs(r3(num[k]) - defOf(k)) > 1e-9, dim = defOf(k) === 0 && !changed && !badK[k];
    return (<label key={k} title={"비공개 값 " + Number(defOf(k)).toFixed(2)} style={{ display: "inline-flex", flexDirection: mob ? "column" : "row", alignItems: mob ? "stretch" : "center", gap: mob ? 3 : 6, minWidth: 0 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: dim ? "var(--td)" : "var(--t2)", whiteSpace: "nowrap" }}>{lab(k)}</span>
      <input value={vals[k]} inputMode="decimal" aria-label={lab(k) + (k === "opp" ? "" : " 가중치")} aria-invalid={!!badK[k]}
        onChange={function (e) { var o = Object.assign({}, vals); o[k] = e.target.value; setVals(o); }}
        onKeyDown={function (e) { if (e.key === "Enter") apply(); }}
        style={{ width: mob ? "100%" : 56, boxSizing: "border-box", padding: "5px 7px", fontSize: 12.5, fontFamily: "var(--m)", textAlign: "right", borderRadius: 7,
          color: dim ? "var(--td)" : "var(--t1)", background: "var(--bg)", border: "1px solid " + (badK[k] ? "var(--vf-err)" : changed ? "var(--acc)" : "var(--bd)") }} />
    </label>);
  };
  var btn = function (primary, dis) { return { padding: "7px 14px", fontSize: 12.5, fontWeight: 800, borderRadius: 8, cursor: dis ? "default" : "pointer", opacity: dis ? 0.45 : 1, whiteSpace: "nowrap",
    border: "1px solid " + (primary ? "var(--acc)" : "var(--bd)"), background: primary ? "var(--ta)" : "var(--inner)", color: primary ? "var(--acc)" : "var(--t2)" }; };
  var grid = mob ? { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 } : { display: "flex", flexWrap: "wrap", gap: "8px 18px", alignItems: "center" };
  var rowLab = { fontSize: 12, fontWeight: 800, color: "var(--t1)", marginTop: mob ? 4 : 0 };
  return (<div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bd)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
      <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--t1)" }}>{"⚖️ 능력치 가중치"}</span>
      <Pill color={cust ? "var(--acc)" : "var(--acp)"}>{cust ? "내 가중치로 보는 중" : "이 표에 쓴 값(비공개 판)"}</Pill>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "44px 1fr", columnGap: 12, rowGap: mob ? 6 : 10, alignItems: "center" }}>
      {WROWS.map(function (g, gi) {
        return (<React.Fragment key={g[0]}>
          <span style={mob ? Object.assign({}, rowLab, { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }) : rowLab}>{g[0]}{mob && sumEl(gi)}</span>
          <div style={grid}>{g[1].filter(function (k) { return wt.cols.indexOf(k) >= 0; }).map(cell)}{!mob && sumEl(gi)}</div></React.Fragment>);
      })}
      <span style={rowLab}>{"배율"}</span>
      <div style={grid}>{cell("opp")}{!mob && <span style={{ fontSize: 11.5, color: "var(--td)" }}>{"상대 능력치를 깎는 몫에 곱하는 값"}</span>}</div>
    </div>
    <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.6, marginTop: 10 }}>
      {"타자 스킬이 상대 투수를 깎는 몫엔 투수 가중치를, 투수 스킬이 상대 타자를 깎는 몫엔 타자 가중치를 써요(동료에게 거는 버프도 같은 가중치). 0 = 점수에 넣지 않는 칸 · 타자 · 투수 가중치 합은 각각 " + GSUM.map(function (s) { return s.tgt.toFixed(2); }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" · ") + " 으로 맞춰요(비중만 바꿔 보기 — 배율은 합에 안 들어가요) · 배율 0 ~ " + OMAX + "."}
      <br />{"숫자를 바꾸고 「확인」을 누르면 그 가중치로 다시 매긴 점수를 보여 드려요. 나에게만 보이고, 새로 고치면 비공개 가중치로 돌아가요."}
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
      <button type="button" disabled={anyBad || sumBad || busy || isCur} onClick={apply} style={btn(true, anyBad || sumBad || busy || isCur)}>{busy ? "계산 중…" : "확인"}</button>
      <button type="button" disabled={busy || (!cust && isDef)} onClick={reset} style={btn(false, busy || (!cust && isDef))}>{"↺ 비공개 가중치로"}</button>
      {anyBad && <span style={{ fontSize: 11.5, color: "var(--vf-err)" }}>{"빨간 칸을 0 ~ " + WMAX + " 사이 숫자로 고쳐 주세요(배율은 0 ~ " + OMAX + ")"}</span>}
      {!anyBad && sumBad && <span style={{ fontSize: 11.5, color: "var(--vf-err)" }}>{"가중치 합을 " + GSUM.map(function (s) { return s.nm + " " + s.tgt.toFixed(2); }).join(" · ") + " 으로 맞춰야 확인할 수 있어요"}</span>}
      {msg && <span style={{ fontSize: 11.5, color: "var(--vf-err)" }}>{msg}</span>}
    </div>
  </div>);
}

/* ── 관리자: 열람 권한 ─────────────────────────────────── */
function SkpAdmin(p) {
  var mob = p.mobile;
  var _o = React.useState(!!p.startOpen); var open = _o[0]; var setOpen = _o[1];
  var _L = React.useState(null); var list = _L[0]; var setList = _L[1];
  var _e = React.useState(""); var err = _e[0]; var setErr = _e[1];
  var _b = React.useState(""); var busy = _b[0]; var setBusy = _b[1];
  var _q = React.useState(""); var q = _q[0]; var setQ = _q[1];
  var _f = React.useState(null); var form = _f[0]; var setForm = _f[1];
  var load = function () { setErr(""); skpList().then(function (L) { setList(L || []); }).catch(function (e) { setErr(e.message); }); };
  React.useEffect(function () { if (open && !list) load(); }, [open]);
  var granted = (list || []).filter(function (x) { return x.granted; });
  var verified = (list || []);      /* 고를 수 있는 계정 전부(게임 계정 인증 · 클럽 가입 회원) — 11-27 부터 인증은 열람 조건이 아님 */
  var qq = ns(q).toLowerCase();
  var pool = verified.filter(function (x) { return !x.granted && (!qq || ns(x.nickname + x.team).toLowerCase().indexOf(qq) >= 0); });
  var act = function (id, fn) { setBusy(id); setErr(""); fn().then(function () { setForm(null); return skpList(); }).then(function (L) { setList(L || []); })
    .catch(function (e) { setErr(e.message); }).then(function () { setBusy(""); }); };
  var grant = function () { var f = form; act(f.id, function () { return skpGrant(f.id, f.note, f.days ? Number(f.days) : null); }); };
  var revoke = function (x) { if (!window.confirm((x.nickname || "이 계정") + " 의 열람 권한을 거둘까요?")) return; act(x.user_id, function () { return skpRevoke(x.user_id); }); };
  var cell = { fontSize: 12, color: "var(--t2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
  var btn = function (on) { return { padding: "4px 10px", fontSize: 11.5, fontWeight: 700, borderRadius: 7, cursor: "pointer", border: "1px solid " + (on ? "var(--acp)" : "var(--bd)"), background: on ? "rgba(124,58,237,0.12)" : "var(--inner)", color: on ? "var(--acp)" : "var(--t2)", whiteSpace: "nowrap" }; };
  /* 허용 · 고치기 칸 — 컴포넌트가 아니라 함수로 그린다(그려질 때마다 새 컴포넌트가 되면 글자를 칠 때마다 입력 칸이 다시 만들어져 커서가 빠진다) */
  var DAYS = [["", "기한 없음"], ["7", "7일"], ["30", "30일"], ["90", "90일"]];
  var formEl = function () {
    var opts = form.keep && !DAYS.some(function (d) { return d[0] === form.keep; }) ? DAYS.concat([[form.keep, "그대로(" + form.keep + "일 남음)"]]) : DAYS;
    return (<div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "8px 0 2px" }}>
      <input value={form.note} maxLength={60} placeholder="메모 (예: 분석 도와주신 분)" onChange={function (e) { setForm(Object.assign({}, form, { note: e.target.value })); }}
        style={{ flex: "1 1 180px", minWidth: 0, padding: "6px 9px", fontSize: 12, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 7, color: "var(--t1)" }} />
      <select value={form.days} onChange={function (e) { setForm(Object.assign({}, form, { days: e.target.value })); }}
        style={{ padding: "6px 8px", fontSize: 12, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 7, color: "var(--t1)" }}>
        {opts.map(function (d) { return <option key={d[0] || "none"} value={d[0]}>{d[1]}</option>; })}
      </select>
      <button type="button" disabled={!!busy} onClick={grant} style={btn(true)}>{busy ? "…" : "허용"}</button>
      <button type="button" onClick={function () { setForm(null); }} style={btn(false)}>{"취소"}</button>
    </div>);
  };
  return (<div style={{ background: "var(--card)", border: "1px solid var(--bd)", borderLeft: "3px solid var(--acp)", borderRadius: 12, marginBottom: 12, position: "relative", zIndex: 4 }}>
    <button type="button" onClick={function () { setOpen(!open); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: mob ? "10px 12px" : "11px 14px", background: "transparent", border: "none", cursor: "pointer", color: "var(--t1)", textAlign: "left" }}>
      <span style={{ fontSize: 14 }}>{"👥"}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800 }}>{"열람 권한 관리"}</span>
      <span style={{ fontSize: 11, color: "var(--acp)", fontWeight: 700 }}>{"관리자"}</span>
      <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--t2)", fontFamily: "var(--m)" }}>{list ? ("허용 " + granted.length + " / 계정 " + verified.length) : ""}</span>
      <span style={{ fontSize: 11, color: "var(--td)" }}>{open ? "▲" : "▼"}</span>
    </button>
    {open && (<div style={{ padding: mob ? "0 12px 12px" : "0 14px 14px" }}>
      <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.5, marginBottom: 8 }}>{"게임 계정 인증을 했거나 클럽에 가입한 계정에서 골라요(인증은 열람 조건이 아니에요). 거두면 바로 못 봐요 — 열람 기록은 남아요."}</div>
      {err && <div style={{ fontSize: 12, color: "var(--vf-err)", marginBottom: 8 }}>{err}</div>}
      {!list && !err && <div style={{ fontSize: 12, color: "var(--td)", padding: "6px 0" }}>{"불러오는 중…"}</div>}
      {list && (<React.Fragment>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)", margin: "4px 0 6px" }}>{"허용한 사람 " + granted.length}</div>
        {granted.length === 0 && <div style={{ fontSize: 12, color: "var(--td)", padding: "4px 0 8px" }}>{"아직 없어요 — 아래 인증된 사람에서 골라 주세요."}</div>}
        {granted.map(function (x) {
          return (<div key={x.user_id} style={{ borderTop: "1px solid var(--bd)", padding: "7px 0" }}>
            <div style={{ display: "grid", gridTemplateColumns: mob ? "minmax(0,1fr) auto" : "minmax(0,1.1fr) 56px minmax(0,1.4fr) 92px minmax(0,1.2fr) auto", columnGap: 10, rowGap: 3, alignItems: "center" }}>
              <span style={Object.assign({}, cell, { color: x.nickname ? "var(--t1)" : "var(--td)", fontWeight: 700 })}>{x.nickname || ("계정 " + String(x.user_id).slice(0, 8))}</span>
              {!mob && <span style={cell} title={x.club ? "클럽 " + x.club : ""}>{x.team || "—"}</span>}
              {!mob && <span style={cell} title={x.note}>{x.note || "메모 없음"}</span>}
              {!mob && <span style={cell}>{x.expires_at ? "~" + md(x.expires_at) : "기한 없음"}</span>}
              {!mob && <span style={cell} title={x.customs ? "내 가중치 계산 " + x.customs + "회" : ""}>{(x.views ? ("열람 " + x.views + "회 · " + md(x.last_view, true)) : "아직 안 봄") + (x.customs ? " · 맞춤 " + x.customs : "")}</span>}
              <span style={{ display: "inline-flex", gap: 5, justifyContent: "flex-end" }}>
                <button type="button" style={btn(false)} onClick={function () {
                  /* 기한이 있으면 남은 날수를 그대로 골라 둔다 — 메모만 고쳐도 기한이 풀리지 않게 */
                  var left = x.expires_at ? String(Math.max(1, Math.ceil((new Date(x.expires_at) - Date.now()) / 864e5))) : "";
                  setForm({ id: x.user_id, note: x.note || "", days: left, keep: left }); }}>{"고치기"}</button>
                <button type="button" disabled={busy === x.user_id} style={Object.assign(btn(false), { color: "var(--vf-err)" })} onClick={function () { revoke(x); }}>{busy === x.user_id ? "…" : "거두기"}</button>
              </span>
              {mob && <span style={Object.assign({}, cell, { gridColumn: "1 / -1", fontSize: 11 })}>{[x.team, x.note || "메모 없음", x.expires_at ? "~" + md(x.expires_at) : "기한 없음", x.views ? "열람 " + x.views + "회" : "아직 안 봄", x.customs ? "맞춤 " + x.customs + "회" : ""].filter(Boolean).join(" · ")}</span>}
            </div>
            {form && form.id === x.user_id && formEl()}
          </div>);
        })}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 6px" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)" }}>{"계정 고르기"}</span>
          <input value={q} onChange={function (e) { setQ(e.target.value); }} placeholder="닉네임 · 구단 · 클럽" style={{ marginLeft: "auto", width: mob ? 130 : 180, padding: "5px 9px", fontSize: 12, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 7, color: "var(--t1)" }} />
        </div>
        <div style={{ maxHeight: 260, overflowY: "auto", borderTop: "1px solid var(--bd)" }}>
          {pool.length === 0 && <div style={{ fontSize: 12, color: "var(--td)", padding: "8px 0" }}>{qq ? "찾는 사람이 없어요" : "고를 사람이 없어요"}</div>}
          {pool.map(function (x) {
            return (<div key={x.user_id} style={{ borderBottom: "1px solid var(--bd)", padding: "6px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={Object.assign({}, cell, { color: "var(--t1)", fontWeight: 600, flex: "1 1 auto", minWidth: 0 })}>{x.nickname}</span>
                <span style={Object.assign({}, cell, { width: 44 })}>{x.team}</span>
                {!mob && <span style={Object.assign({}, cell, { width: 90 })}>{x.verified ? "인증 " + md(x.linked_at) : (x.club ? "클럽 회원" : "")}</span>}
                <button type="button" style={btn(true)} onClick={function () { setForm({ id: x.user_id, note: "", days: "" }); }}>{"허용"}</button>
              </div>
              {form && form.id === x.user_id && formEl()}
            </div>);
          })}
        </div>
      </React.Fragment>)}
    </div>)}
  </div>);
}

/* ── 본 화면 ────────────────────────────────────────── */
export default function SkillPreviewPage(p) {
  var mob = p.mobile, acc = p.acc || {};
  var _d = React.useState(null); var data = _d[0]; var setData = _d[1];
  var _e = React.useState(""); var err = _e[0]; var setErr = _e[1];
  var _c = React.useState("타자"); var cat = _c[0]; var setCat = _c[1];
  var _lv = React.useState(6); var lv = _lv[0]; var setLv = _lv[1];
  var _s = React.useState("new"); var sort = _s[0]; var setSort = _s[1];
  var _f = React.useState("all"); var filt = _f[0]; var setFilt = _f[1];
  var _q = React.useState(""); var q = _q[0]; var setQ = _q[1];
  var _op = React.useState(""); var openKey = _op[0]; var setOpenKey = _op[1];
  var _bs = React.useState(false); var showBasis = _bs[0]; var setShowBasis = _bs[1];
  var _cu = React.useState(CUSTOM_KEEP); var cust = _cu[0]; var setCust0 = _cu[1];
  var setCust = function (c) { CUSTOM_KEEP = c; setCust0(c); };
  var load = function () {
    setErr(""); setData(null);
    skpGet().then(function (g) {
      setData(g && g.payload ? { at: g.updated_at, version: g.version, viewer: g.viewer || "", T: parsePayload(g.payload) } : { empty: true });
    }).catch(function (e) { setErr(e.message || String(e)); });
  };
  React.useEffect(load, []);
  var T = data && data.T;
  /* 표가 바뀌었거나(새 판) 가중치 칸이 없는 표면 내 가중치는 버린다 */
  React.useEffect(function () { if (T && cust && (cust.version !== data.version || !T.wt || cust.rows.length !== T.rows.length)) setCust(null); }, [data]);
  var applyW = function (w) {
    return skpCustom(w).then(function (c) {
      if (!c || !Array.isArray(c.rows) || !T || c.rows.length !== T.rows.length) throw new Error("표가 바뀌었어요 — 새로 고친 뒤 다시 해 주세요.");
      setCust({ version: c.version, w: c.w || {}, opp: c.opp, rows: c.rows, extra: c.extra || [] });
    });
  };
  var resetW = function () { setCust(null); };
  var mine = p.mine || {};
  var myN = (mine[cat] && Object.keys(mine[cat]).length) || 0;
  React.useEffect(function () { if (lv === "my" && !myN) setLv(6); }, [cat, myN]);

  var V = React.useMemo(function () {
    if (!T) return null;
    var mineC = mine[cat] || {}, qq = ns(q).toLowerCase();
    var all = T.rows.filter(function (r) { return r.c === cat; }).map(function (r) {
      var my = mineC[r.k] || null;
      var li = lv === "my" ? (my ? Math.min(5, Math.max(0, my[0].lv - 5)) : -1) : lv - 5;
      var cr = cust ? cust.rows[r.i] : null, S = cr || r.s;          /* 내 가중치 — null 줄 = 가중치와 상관없는 줄(표 값 그대로) */
      var on = li >= 0 && !!(r.o[li] || S[li]);
      var o = on ? r.o[li] : 0, s = on ? S[li] : 0;
      return { r: r, my: my, li: li, on: on, o: o, s: s, d: s - o, cls: on ? klass(o, s) : "", cs: cr || null, fixed: !!cust && !cr, b: on ? (r.s[li] || 0) : 0 };
    });
    var mx = 1, cnt = { up: 0, down: 0, same: 0 }, so = 0, ss = 0, n = 0;
    all.forEach(function (x) {
      if (lv === "my" && !x.my) return;
      if (!x.on) return;
      mx = Math.max(mx, x.s, x.o); n++; so += x.o; ss += x.s;
      cnt[x.cls === "같음" ? "same" : dirOf(x.d)]++;
    });
    var L = all.filter(function (x) {
      if (lv === "my" && !x.my) return false;
      if (filt === "chg" && !(x.on && x.cls !== "같음")) return false;
      if (qq && x.r.k.toLowerCase().indexOf(qq) < 0) return false;
      return true;
    });
    var nm = function (a, b) { return a.r.n.localeCompare(b.r.n, "ko"); };
    var by = {
      "new": function (a, b) { return (a.r.ref - b.r.ref) || (b.on - a.on) || (b.s - a.s) || nm(a, b); },
      up: function (a, b) { return (a.r.ref - b.r.ref) || (b.on - a.on) || (b.d - a.d) || nm(a, b); },
      down: function (a, b) { return (a.r.ref - b.r.ref) || (b.on - a.on) || (a.d - b.d) || nm(a, b); },
      name: nm
    };
    L.sort(by[sort]);
    return { L: L, mx: mx * 1.04, cnt: cnt, n: n, ao: n ? so / n : 0, as: n ? ss / n : 0 };
  }, [T, cat, lv, sort, filt, q, mine, cust]);

  var lvTxt = lv === "my" ? "내 레벨" : "Lv" + lv;
  var catCount = function (c) { return T ? T.rows.filter(function (r) { return r.c === c; }).length : 0; };
  var wmText = (data && data.viewer ? data.viewer + " · " : "") + "비공개 미리보기 · " + md(new Date().toISOString());
  var extra = T ? T.extra.filter(function (e) { return e.c === cat; }) : [];

  var card = { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 12 };
  var CSS = (<style>{
    ".skp-row{cursor:pointer;transition:background .15s}.skp-row:hover{background:var(--inner)}.skp-row:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}" +
    ".skp-wm{opacity:.085}.light .skp-wm{opacity:.11}" +
    ".skp-tbl{container-type:inline-size;container-name:skp}" +
    ".skp-g{display:grid;grid-template-columns:30px minmax(196px,1.45fr) 66px 150px 118px minmax(0,1.5fr);align-items:center;column-gap:12px}" +
    "@container skp (max-width:800px){.skp-g{grid-template-columns:26px minmax(164px,1fr) 60px 128px 112px}.skp-why{display:none}}" +
    ".skp-ic{transition:transform .18s ease}@media (hover:hover){.skp-row:hover .skp-ic{transform:scale(1.14) rotate(-6deg)}}" +
    ".skp-bar{transition:width .45s cubic-bezier(.2,.8,.2,1)}" +
    "@media (prefers-reduced-motion:reduce){.skp-bar,.skp-ic{transition:none}.skp-row:hover .skp-ic{transform:none}}"
  }</style>);

  /* ── 머리 ── */
  var head = (<div style={Object.assign({}, card, { position: "relative", overflow: "hidden", padding: mob ? "13px 13px 12px" : "16px 18px 14px", marginBottom: 12,
    background: "linear-gradient(135deg, rgba(124,58,237,0.13), rgba(124,58,237,0.02) 55%, transparent), var(--card)", borderLeft: "3px solid var(--acp)" })}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: mob ? 16 : 18 }}>{"🔒"}</span>
      <span style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 1, color: "var(--t1)" }}>{"새 스킬점수표"}</span>
      <Pill color="var(--acp)">{"비공개 β"}</Pill>
      {!mob && <button type="button" onClick={function () { setShowBasis(!showBasis); }} style={{ marginLeft: "auto", padding: "5px 11px", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid var(--bd)", background: showBasis ? "var(--ta)" : "var(--inner)", color: showBasis ? "var(--acc)" : "var(--t2)" }}>{"📐 산정 기준 · 가중치 " + (showBasis ? "▲" : "▼")}</button>}
    </div>
    <div style={{ fontSize: mob ? 12.5 : 13, color: "var(--t2)", lineHeight: 1.6, marginTop: 7 }}>
      {(T && T.t ? T.t + " — " : "") + "새 능력치 가중치와 새 산정 근거로 다시 매긴 스킬 점수예요. 사이트 점수(TOTAL)에는 아직 반영 전이라, 지금 점수와 나란히 보여 드려요."}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
      {data && data.version && <Pill color="var(--t2)" style={{ fontWeight: 600 }}>{"판 " + data.version}</Pill>}
      {T && <Pill color="var(--t2)" style={{ fontWeight: 600 }}>{"스킬 " + T.rows.length + "개 · Lv5 ~ 10"}</Pill>}
      <Pill color="var(--acp)" style={{ fontWeight: 600 }}>{acc.admin ? "관리자 보기" : "초대된 유저 전용"}</Pill>
      {acc.until && <Pill color="var(--vf-warn)" style={{ fontWeight: 600 }}>{"열람 기한 ~" + md(acc.until)}</Pill>}
    </div>
    <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.55, marginTop: 9 }}>{"🔏 이 화면에는 내 닉네임이 옅게 깔려 있어요. 캡처해 올리거나 다른 곳에 옮기지 말아 주세요."}</div>
    {mob && <button type="button" onClick={function () { setShowBasis(!showBasis); }} style={{ marginTop: 10, width: "100%", padding: "7px 0", fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: "pointer", border: "1px solid var(--bd)", background: showBasis ? "var(--ta)" : "var(--inner)", color: showBasis ? "var(--acc)" : "var(--t2)" }}>{"📐 산정 기준 · 가중치 " + (showBasis ? "접기 ▲" : "보기 ▼")}</button>}
    {showBasis && T && T.wt && <WeightPanel wt={T.wt} cust={cust} mobile={mob} onApply={applyW} onReset={resetW} />}
    {showBasis && T && (<div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--bd)", display: "grid", gridTemplateColumns: mob ? "1fr" : "128px 1fr", columnGap: 14, rowGap: mob ? 2 : 8 }}>
      {T.basis.map(function (b, i) {
        return (<React.Fragment key={i}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--t1)", marginTop: mob && i ? 8 : 0 }}>{b[0]}</span>
          <span style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{b[1]}</span>
        </React.Fragment>);
      })}
    </div>)}
  </div>);

  /* ── 내 가중치로 보는 중 — 바꾼 칸 · 되돌리기 ── */
  var changedTxt = cust && T && T.wt ? T.wt.cols.map(function (k, i) { var a = T.wt.def[i], b = Number(cust.w[k]);
    return Math.abs(a - b) > 1e-9 ? (WCOL2[k] || WCOL[k]) + " " + a.toFixed(2) + " → " + b.toFixed(2) : null; }).filter(Boolean)
    .concat(Math.abs(T.wt.opp - Number(cust.opp)) > 1e-9 ? ["상대 깎기 " + T.wt.opp.toFixed(2) + " → " + Number(cust.opp).toFixed(2)] : []).join(" · ") : "";
  var custBar = cust && T && (<div role="status" style={Object.assign({}, card, { position: "relative", zIndex: 4, marginBottom: 10, padding: mob ? "9px 11px" : "10px 14px",
    borderLeft: "3px solid var(--acc)", display: "flex", alignItems: "center", gap: mob ? 8 : 12, flexWrap: "wrap" })}>
    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--acc)", whiteSpace: "nowrap" }}>{"⚖️ 내 가중치로 보는 중"}</span>
    <span style={{ fontSize: 12, color: "var(--t2)", flex: "1 1 220px", minWidth: 0, lineHeight: 1.5 }}>{changedTxt || "비공개 가중치와 같아요"}</span>
    <button type="button" onClick={resetW} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 800, borderRadius: 8, cursor: "pointer", border: "1px solid var(--acc)", background: "var(--ta)", color: "var(--acc)", whiteSpace: "nowrap", marginLeft: "auto" }}>{"↺ 비공개 가중치로"}</button>
  </div>);

  /* ── 고르기 ── */
  var lvItems = LVS.map(function (l) { return [l, mob ? String(l) : "Lv" + l]; });
  if (myN) lvItems.push(["my", mob ? "내 덱" : "내 덱 레벨", "내 라인업 선수가 가진 스킬만 — 각자 레벨로"]);
  var controls = (<div style={Object.assign({}, card, { padding: mob ? 10 : 12, marginBottom: 10, position: "relative", zIndex: 4 })}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Seg label="보직" grow={mob} style={mob ? { width: "100%" } : null} value={cat} onChange={function (c) { setCat(c); setOpenKey(""); }}
        items={CATS.map(function (c) { return [c, c + (mob ? "" : " " + catCount(c))]; })} />
      <Seg label="레벨" small={mob} style={mob ? { width: "100%", overflowX: "auto" } : { marginLeft: "auto" }} grow={mob} value={lv} onChange={function (l) { setLv(l); }} items={lvItems} />
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      <div style={{ position: "relative", flex: mob ? "1 1 100%" : "0 1 230px" }}>
        <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.6 }}>{"🔍"}</span>
        <input value={q} onChange={function (e) { setQ(e.target.value); }} placeholder="스킬 이름" aria-label="스킬 이름 찾기"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", fontSize: 12.5, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 8, color: "var(--t1)" }} />
      </div>
      <Seg label="정렬" small value={sort} onChange={setSort} items={SORTS} />
      <Seg label="보기" small value={filt} onChange={setFilt} items={[["all", "전체"], ["chg", "달라진 것"]]} style={mob ? null : { marginLeft: "auto" }} />
    </div>
  </div>);

  /* ── 요약 줄 ── */
  var summary = V && (<div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 12, flexWrap: "wrap", padding: mob ? "2px 2px 8px" : "2px 4px 10px", fontSize: 12, color: "var(--t2)" }}>
    <b style={{ color: "var(--t1)" }}>{cat + " · " + lvTxt}</b>
    {cust && <span style={{ fontSize: 11, fontWeight: 800, color: "var(--acc)" }}>{"내 가중치"}</span>}
    <span style={{ color: DCOL.up }}>{"▲ 오름 " + V.cnt.up}</span>
    <span style={{ color: DCOL.down }}>{"▼ 내림 " + V.cnt.down}</span>
    <span style={{ color: "var(--td)" }}>{"같음 " + V.cnt.same}</span>
    {V.n > 0 && (<span style={{ display: "inline-flex", width: mob ? 90 : 130, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--bar)" }} aria-hidden="true">
      <span style={{ width: (V.cnt.up / V.n * 100) + "%", background: DCOL.up, opacity: 0.85 }} /><span style={{ width: (V.cnt.down / V.n * 100) + "%", background: DCOL.down, opacity: 0.85 }} />
    </span>)}
    {V.n > 0 && <span style={{ marginLeft: mob ? 0 : "auto", fontFamily: "var(--m)", fontSize: 11.5 }}>{"평균 " + fx(V.ao) + " → "}<b style={{ color: "var(--t1)" }}>{fx(V.as)}</b></span>}
    {mob && <span style={{ flexBasis: "100%", fontSize: 11, color: "var(--td)" }}>{"오른쪽 큰 숫자 = " + (cust ? "내 가중치 점수" : "새 점수") + " · 막대 위 세로 금 = 지금 점수 · 누르면 Lv5 ~ 10"}</span>}
  </div>);

  /* ── 한 줄 ── */
  var rowOf = function (x, i) {
    var r = x.r, key = r.c + "|" + r.n, op = openKey === key, dr = dirOf(x.d);
    var tags = noteTags(r.m);
    if (x.fixed) tags.push(["고정", "var(--td)", "가중치와 상관없이 정해 둔 값이에요(지금 사이트 값 그대로)"]);
    var myTag = x.my ? (<Pill color="var(--acc)" title={x.my.map(function (q) { return q.slot + " Lv" + q.lv; }).join(" · ")}>{"내 선수" + (x.my.length > 1 ? " " + x.my.length : "")}</Pill>) : null;
    var tagEls = tags.map(function (t) { return <Pill key={t[0]} color={t[1]} title={t[2]}>{t[0]}</Pill>; });
    var bar = (<div style={{ position: "relative", height: 4, borderRadius: 2, background: "var(--bar)", marginTop: 4 }}>
      <div className="skp-bar" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (x.on ? x.s / V.mx * 100 : 0) + "%", borderRadius: 2, background: cust ? "linear-gradient(90deg, rgba(255,213,79,0.4), var(--acc))" : "linear-gradient(90deg, rgba(124,58,237,0.45), var(--acp))" }} />
      {x.on && x.o > 0 && <div title={"지금 " + fx(x.o)} style={{ position: "absolute", top: -2, bottom: -2, width: 2, borderRadius: 1, left: "calc(" + (x.o / V.mx * 100) + "% - 1px)", background: "var(--t2)", opacity: 0.85 }} />}
    </div>);
    var delta = x.on ? (<span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, color: DCOL[x.cls === "같음" ? "same" : dr], whiteSpace: "nowrap" }}>
      <span style={{ fontFamily: "var(--m)", fontSize: mob ? 12 : 13, fontWeight: 700 }}>{x.cls === "같음" ? "≈" + (dr === "same" ? "" : " " + (x.d > 0 ? "+" : "−") + Math.abs(x.d).toFixed(2)) : DARR[dr] + " " + Math.abs(x.d).toFixed(2)}</span>
      <span style={{ fontSize: 10.5, opacity: 0.9 }}>{x.cls === "같음" ? "" : pctTxt(x.d, x.o)}</span>
      {x.cls === "대폭" && <span style={{ fontSize: 9.5, fontWeight: 800, padding: "0 5px", borderRadius: 4, lineHeight: "15px", color: "var(--bg)", background: DCOL[dr] }}>{"대폭"}</span>}
    </span>) : <span style={{ fontSize: 11, color: "var(--td)" }}>{r.zero ? "0점 · 점수에 드는 효과 없음" : (lv === "my" ? "" : lvTxt + " ") + "없음"}</span>;
    var toggle = function () { setOpenKey(op ? "" : key); };
    var kd = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
    if (mob) {
      return (<div key={key}>
        <div className="skp-row" role="button" tabIndex={0} aria-expanded={op} onClick={toggle} onKeyDown={kd}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px 8px 8px", borderBottom: op ? "none" : "1px solid var(--bd)", background: x.my ? "rgba(255,213,79,0.035)" : undefined, opacity: x.on ? 1 : 0.55 }}>
          <SkIcon ic={r.ic} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--m)", fontSize: 10.5, color: "var(--td)", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
              {myTag}
              <span style={{ marginLeft: "auto", fontFamily: "var(--m)", fontSize: 15.5, fontWeight: 800, color: "var(--t1)", flexShrink: 0 }}>{x.on ? fx(x.s) : "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              {tagEls}
              {lv === "my" && x.my && <span style={{ fontSize: 10.5, color: "var(--acc)" }}>{"Lv" + x.my[0].lv}</span>}
              <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "baseline", gap: 8, flexShrink: 0 }}>
                {x.on && <span style={{ fontFamily: "var(--m)", fontSize: 11.5, color: "var(--td)" }}>{"지금 " + fx(x.o)}</span>}
                {delta}
              </span>
            </div>
            {bar}
          </div>
        </div>
        {op && <Detail x={x} mobile />}
      </div>);
    }
    return (<div key={key}>
      <div className="skp-row skp-g" role="button" tabIndex={0} aria-expanded={op} onClick={toggle} onKeyDown={kd}
        style={{ padding: "5px 14px", minHeight: 48, borderBottom: op ? "none" : "1px solid var(--bd)", background: op ? "var(--inner)" : (x.my ? "rgba(255,213,79,0.035)" : undefined), opacity: x.on ? 1 : 0.55 }}>
        <span style={{ fontFamily: "var(--m)", fontSize: 11, color: "var(--td)" }}>{i + 1}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <SkIcon ic={r.ic} size={38} />
          <span style={{ marginLeft: 3, fontSize: 13.5, fontWeight: 700, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
          {myTag}{tagEls}
          {lv === "my" && x.my && <span style={{ fontSize: 10.5, color: "var(--acc)", flexShrink: 0 }}>{"Lv" + x.my[0].lv}</span>}
        </span>
        <span style={{ fontFamily: "var(--m)", fontSize: 13, color: "var(--t2)", textAlign: "right" }}>{x.on ? fx(x.o) : "—"}</span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontFamily: "var(--m)", fontSize: 14.5, fontWeight: 800, color: "var(--t1)", textAlign: "right" }}>{x.on ? fx(x.s) : "—"}</span>
          {bar}
        </span>
        <span>{delta}</span>
        {cust ? (<span className="skp-why" style={{ fontFamily: "var(--m)", fontSize: 12, color: "var(--td)", whiteSpace: "nowrap", overflow: "hidden" }}>
          {x.on ? (<React.Fragment>{"새 " + fx(x.b)}<span style={{ marginLeft: 8, color: DCOL[dirOf(x.s - x.b)] }}>{Math.abs(x.s - x.b) < 0.005 ? "같음" : "내 " + (x.s > x.b ? "+" : "−") + Math.abs(x.s - x.b).toFixed(2)}</span></React.Fragment>) : ""}</span>)
          : (<span className="skp-why" title={r.w} style={{ fontSize: 11.5, color: "var(--td)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.on && x.cls !== "같음" ? (r.w || "") : ""}</span>)}
      </div>
      {op && <Detail x={x} />}
    </div>);
  };

  /* ── 그리기 ── */
  return (<div style={{ position: "relative" }}>
    {CSS}
    {data && !data.empty && <Watermark text={wmText} w={mob ? 230 : 300} h={mob ? 150 : 170} />}
    {head}
    {acc.admin && <SkpAdmin mobile={mob} startOpen={p.adminOpen} />}
    {err && (<div style={Object.assign({}, card, { padding: 22, textAlign: "center", color: "var(--t2)", fontSize: 13 })}>
      <div style={{ marginBottom: 10 }}>{err}</div>
      <button type="button" onClick={load} style={{ padding: "6px 14px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: "1px solid var(--bd)", background: "var(--inner)", color: "var(--t2)" }}>{"다시 불러오기"}</button>
    </div>)}
    {!err && !data && <div style={Object.assign({}, card, { padding: 30, textAlign: "center", color: "var(--td)", fontSize: 13 })}>{"새 스킬표를 받는 중…"}</div>}
    {data && data.empty && <div style={Object.assign({}, card, { padding: 30, textAlign: "center", color: "var(--td)", fontSize: 13 })}>{acc.admin ? "아직 올린 표가 없어요 — 운영자 도구로 올려 주세요." : "아직 공개된 표가 없어요. 조금 뒤에 다시 와 주세요."}</div>}
    {custBar}
    {T && controls}
    {T && summary}
    {T && V && (<div className="skp-tbl" style={Object.assign({}, card, { overflow: "hidden" })}>
      {!mob && (<div className="skp-g" style={{ padding: "8px 14px", borderBottom: "1px solid var(--bd)", fontSize: 11, fontWeight: 700, color: "var(--td)", background: "var(--inner)" }}>
        <span>{"#"}</span><span>{"스킬"}</span><span style={{ textAlign: "right" }}>{"지금"}</span>
        <span style={{ textAlign: "right", color: cust ? "var(--acc)" : "var(--acp)" }}>{cust ? "내 가중치" : "새 점수"}</span><span>{"변화"}</span><span className="skp-why">{cust ? "비공개 판 새 점수와 견줌" : "달라진 까닭"}</span>
      </div>)}
      {V.L.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--td)" }}>{q ? "찾는 스킬이 없어요" : "보일 스킬이 없어요"}</div>}
      {V.L.map(rowOf)}
    </div>)}
    {T && extra.length > 0 && (<div style={Object.assign({}, card, { marginTop: 12, padding: mob ? "10px 12px" : "12px 14px" })}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--t1)", marginBottom: 4 }}>{"참고 — 새 기준에서 따로 갈라 본 스킬 " + extra.length + (cust ? " · 내 가중치" : "")}</div>
      <div style={{ fontSize: 11.5, color: "var(--td)", marginBottom: 8 }}>{"사이트 스킬표에는 아직 없는 행이에요. 반영할 때 함께 들어가요."}</div>
      {extra.map(function (e) {
        var es = cust && cust.extra && cust.extra[e.j] ? cust.extra[e.j] : e.s;
        return (<div key={e.n} style={{ borderTop: "1px solid var(--bd)", padding: "7px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <SkIcon ic={e.ic} size={26} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)" }}>{e.n}</span>
            <span style={{ fontSize: 11, color: "var(--td)" }}>{e.m}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 4, marginTop: 4, fontFamily: "var(--m)", fontSize: mob ? 11 : 12 }}>
            {LVS.map(function (l, i) { return <span key={l} style={{ color: "var(--t2)", whiteSpace: "nowrap" }}><span style={{ color: "var(--td)", fontSize: 10 }}>{"Lv" + l + " "}</span>{fx(es[i] || 0)}</span>; })}
          </div>
        </div>);
      })}
    </div>)}
    {T && (<div style={{ fontSize: 11, color: "var(--td)", lineHeight: 1.6, padding: "12px 4px 4px" }}>
      {"표는 권한을 확인한 뒤에만 서버에서 받아요(사이트 코드에는 없어요) · 열람 기록이 남아요 · 판 " + (data.version || "") + (data.at ? " · 올린 때 " + md(data.at) : "")}
    </div>)}
  </div>);
}
