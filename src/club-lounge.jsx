/* 클럽 라운지 화면 — 클럽장 인증 · 가입 승인 · 덱 현황 · 라운지(글·댓글·투표·일정).
   서버 일은 club-api.js, 덱 계산(카드 표기·점수)은 deck-manager.jsx 가 tools 로 넘겨 준다.
   시안: data/mockups/club/club_v2_*.png (2026-10-15 사용자 확인) */
import React, { useState, useEffect, useCallback, useRef } from "react";
import * as realApi from "./club-api.js";
import { checkShot } from "./shot-check.js";

/* ── 바탕 장치 (2026-10-18 점검 보강) ─────────────────────── */

/* 테마별 색 — 라이트 모드에서 입력칸이 회색으로 꺼져 보이고 노란 버튼 글씨가 어둡던 것 */
var THEME_CSS = ".club-root{--cinp:rgba(0,0,0,.18);--conacc:#1a1300;--cscheme:dark}"
  + ".light .club-root{--cinp:var(--card);--conacc:#fff;--cscheme:light}"
  + ".club-chips{scrollbar-width:none}.club-chips::-webkit-scrollbar{display:none}";

/* 화면 한 부분이 깨져도 그 부분만 막는다 — 예전에는 이상한 글 하나로 사이트 전체가 하얗게 됐다 */
class Safe extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e || new Error("화면 오류") }; }
  componentDidCatch(e) { try { console.warn("[club] 화면 일부를 그리지 못했어요:", e && e.message); } catch (x) { /* 무시 */ } }
  render() {
    if (!this.state.err) return this.props.children;
    var self = this;
    var retry = function () { self.setState({ err: null }); };
    return this.props.fallback ? this.props.fallback(retry) : null;
  }
}
function SafeBox(p) {
  return (<Safe fallback={function (retry) {
    return (<Card style={{ textAlign: "center", padding: "24px 18px" }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{(p.what || "이 화면") + "을 표시하지 못했어요"}</div>
      <div style={{ fontSize: 12.5, color: "var(--td)", marginBottom: 12 }}>{"다른 탭은 그대로 쓸 수 있어요. 계속되면 관리자에게 알려 주세요."}</div>
      <Btn sm icon="refresh" onClick={retry}>{"다시 시도"}</Btn>
    </Card>);
  }}>{p.children}</Safe>);
}

/* 휴대폰 뒤로가기 — 글 보기 · 창이 열려 있으면 그것만 닫는다 (예전에는 사이트를 나가 버렸다).
   창을 열 때마다 방문 기록을 하나 쌓고 그 기록에 '몇 겹째인지(club)'를 적어 둔다.
   뒤로가기로 기록이 바뀌면, 바뀐 기록의 겹 수보다 위에 열려 있는 창을 모두 닫는다 —
   한 칸씩 돌아가든, 길게 눌러 여러 칸을 한 번에 돌아가든 같다.
   화면에서 닫을 때는 쌓아 둔 기록을 되돌리는데, 그때 오는 popstate 는 이미 겹 수가 맞아 아무것도 닫지 않는다 */
var backStack = [], popBound = false;
function bindPop() {
  if (popBound || typeof window === "undefined") return;
  popBound = true;
  /* 기록을 되돌릴 때 브라우저가 스크롤을 맨 위로 되돌려 놓던 것 — 스크롤은 화면이 직접 맞춘다 */
  try { if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual"; } catch (e) { /* 무시 */ }
  window.addEventListener("popstate", function (e) {
    var depth = e.state && typeof e.state.club === "number" ? e.state.club : 0;
    var guard = 0;
    while (backStack.length > depth && guard++ < 50) {
      var top = backStack.pop();
      try { top(); } catch (x) { /* 닫기 실패는 무시 */ }
    }
  });
}
function useBackClose(open, close) {
  var ref = useRef(close); ref.current = close;
  useEffect(function () {
    if (!open) return;
    bindPop();
    var fn = function () { ref.current(); };
    /* 기록을 쌓지 못한 환경(막힘 · 횟수 제한)에서는 아예 맡지 않는다 — 닫을 때 진짜 이전 페이지로 가 버리지 않게 */
    try { window.history.pushState({ club: backStack.length + 1 }, ""); } catch (e) { return; }
    backStack.push(fn);
    return function () {
      var i = backStack.indexOf(fn);
      if (i < 0) return;
      backStack.splice(i, 1);
      try { window.history.back(); } catch (e) { /* 무시 */ }
    };
  }, [open]);
}

/* ── 작은 부품 ──────────────────────────────────────────── */

var IC = {
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
  pin: '<path d="M12 17v5"/><path d="M5 17h14l-2-4V5H7v8z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  deck: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  poll: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  swap: '<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  crown: '<path d="m2 7 5 5 5-8 5 8 5-5-2 12H4z"/>',
  flag: '<path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'
};
function Icon(p) {
  var s = p.size || 15;
  return (<svg viewBox="0 0 24 24" width={s} height={s} style={Object.assign({ flexShrink: 0, verticalAlign: -3 }, p.style)}
    fill={p.fill || "none"} stroke="currentColor" strokeWidth={p.w || 1.8} strokeLinecap="round" strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: IC[p.n] || "" }} />);
}
var BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 12px", fontSize: 12.5, fontWeight: 600,
  borderRadius: 9, borderWidth: 1, borderStyle: "solid", borderColor: "var(--bd)", background: "transparent", color: "var(--t2)", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", minHeight: 32 };
function Btn(p) {
  var st = Object.assign({}, BTN,
    p.pri ? { background: "var(--acc)", color: "var(--conacc)", borderColor: "var(--acc)", fontWeight: 800 } : null,
    p.ok ? { color: "#4CAF50", borderColor: "rgba(76,175,80,.4)" } : null,
    p.no ? { color: "#FF6B6B", borderColor: "rgba(255,107,107,.35)" } : null,
    p.ghost ? { borderColor: "transparent" } : null,
    p.purple ? { color: "var(--acp)" } : null,
    p.sm ? { padding: "5px 10px", fontSize: 12, minHeight: 30 } : null,
    p.disabled ? { opacity: .45, cursor: "default" } : null, p.style);
  return (<button type="button" title={p.title} disabled={p.disabled} onClick={p.disabled ? undefined : p.onClick} style={st}>
    {p.icon && <Icon n={p.icon} />}{p.children}</button>);
}
var TAGC = { acc: ["rgba(255,213,79,.12)", "var(--acc)"], blue: ["rgba(108,184,255,.12)", "#5AA9F0"], green: ["rgba(76,175,80,.12)", "#4CAF50"],
  purple: ["rgba(206,147,216,.14)", "var(--acp)"], gray: ["var(--inner)", "var(--t2)"], red: ["rgba(255,107,107,.12)", "#FF6B6B"], orange: ["rgba(255,167,38,.14)", "#FFA726"] };
function Tag(p) {
  var c = TAGC[p.c || "gray"];
  return (<span title={p.title} style={Object.assign({ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, fontWeight: 700, borderRadius: 5,
    padding: "2px 6px", lineHeight: 1.3, background: c[0], color: c[1], whiteSpace: "nowrap" }, p.style)}>{p.children}</span>);
}
var TEAM_COL = { "롯데": "#D00F31", "두산": "#3A3F8F", "기아": "#EA0029", "LG": "#C30452", "삼성": "#074CA1", "한화": "#FF6600", "SSG": "#CE0E2D", "NC": "#315288", "KT": "#444", "키움": "#820024" };
function Avatar(p) {
  var s = p.size || 32;
  var h = 0; String(p.name || "?").split("").forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; });
  var bg = TEAM_COL[p.team] || ("hsl(" + h + ",45%,42%)");
  return (<span style={{ width: s, height: s, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontWeight: 800, fontSize: Math.round(s * .42), color: "#fff", background: bg, flexShrink: 0 }}>{String(p.name || "?").charAt(0)}</span>);
}
var CARD = { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14 };
function Card(p) { return (<div style={Object.assign({}, CARD, { padding: p.pad === 0 ? 0 : (p.pad || "16px 18px") }, p.style)}>{p.children}</div>); }
var KICK = { fontSize: 11, fontWeight: 700, color: "var(--td)", letterSpacing: .3 };
var INP = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--bd)", background: "var(--cinp)", color: "var(--t1)",
  fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
function Field(p) {
  return (<label style={{ display: "block", marginBottom: p.mb === undefined ? 12 : p.mb }}>
    {p.label && <div style={Object.assign({}, KICK, { marginBottom: 6 })}>{p.label}</div>}
    {p.area
      ? <textarea value={p.value} maxLength={p.max} placeholder={p.ph} onChange={function (e) { p.onChange(e.target.value); }} rows={p.rows || 4} style={Object.assign({}, INP, { resize: "vertical", lineHeight: 1.6 })} />
      : <input value={p.value} maxLength={p.max} placeholder={p.ph} type={p.type || "text"} onChange={function (e) { p.onChange(e.target.value); }} style={Object.assign({}, INP, p.mono ? { fontFamily: "var(--m)", letterSpacing: 1 } : null)} />}
  </label>);
}
function Msg(p) {
  if (!p.text) return null;
  var bad = p.bad !== false;
  return (<div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, fontSize: 12.5, lineHeight: 1.6, margin: "10px 0",
    background: bad ? "rgba(255,107,107,.08)" : "rgba(76,175,80,.08)", color: bad ? "#FF8A80" : "#66BB6A", border: "1px solid " + (bad ? "rgba(255,107,107,.25)" : "rgba(76,175,80,.25)") }}>
    <Icon n={bad ? "info" : "check"} style={{ marginTop: 2 }} /><span style={{ flex: 1 }}>{p.text}</span></div>);
}
function Modal(p) {
  useBackClose(true, p.onClose);
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,12,.7)", display: "flex", alignItems: p.mobile ? "flex-end" : "center", justifyContent: "center" }}>
    <div onClick={function (e) { e.stopPropagation(); }} style={Object.assign({}, CARD, { background: "var(--bg)", width: p.mobile ? "100%" : (p.width || 560), maxHeight: p.mobile ? "92vh" : "88vh",
      overflowY: "auto", borderRadius: p.mobile ? "16px 16px 0 0" : 14, boxShadow: "0 20px 60px rgba(0,0,0,.45)" })}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--bd)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
        <b style={{ fontSize: 15 }}>{p.title}</b>{p.sub && <span style={{ marginLeft: 8, fontSize: 12, color: "var(--td)" }}>{p.sub}</span>}
        <button type="button" onClick={p.onClose} title="닫기" aria-label="닫기" style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", padding: 8, margin: "-6px -6px -6px auto" }}><Icon n="x" size={17} /></button>
      </div>
      <div style={{ padding: "16px 18px" }}>{p.children}</div>
      {p.foot && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--bd)", position: "sticky", bottom: 0, background: "var(--bg)" }}>{p.foot}</div>}
    </div></div>);
}
/* 사진 크게 보기 — 새 창으로 나가지 않고 이 화면 위에서 (뒤로가기 · 바깥 누르기로 닫힘) */
function Viewer(p) {
  useBackClose(true, p.onClose);
  var btn = { display: "inline-flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 9, background: "rgba(0,0,0,.6)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", fontSize: 12.5, cursor: "pointer", textDecoration: "none", fontFamily: "inherit" };
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 10px 10px", cursor: "zoom-out" }}>
    <img src={p.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
    <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
      <a href={p.url} target="_blank" rel="noopener" onClick={function (e) { e.stopPropagation(); }} style={btn}>{"새 창으로"}</a>
      <button type="button" onClick={p.onClose} style={btn}><Icon n="x" size={14} />{"닫기"}</button>
    </div>
  </div>);
}
function ago(ts) {
  if (!ts) return "";
  var s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "방금";
  if (s < 3600) return Math.floor(s / 60) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  if (s < 86400 * 2) return "어제";
  if (s < 86400 * 30) return Math.floor(s / 86400) + "일 전";
  var d = new Date(ts); return (d.getMonth() + 1) + "/" + d.getDate();
}
function daysSince(ts) { return ts ? (Date.now() - new Date(ts).getTime()) / 864e5 : 999; }
function fmtWhen(ts) {
  var d = new Date(ts); var W = ["일", "월", "화", "수", "목", "금", "토"];
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + W[d.getDay()] + ") " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function num(v, d) { var n = Number(v); return isFinite(n) ? n.toFixed(d === undefined ? 1 : d) : "—"; }
/* 서버에서 온 값을 글자로 — 글자 · 숫자가 아니면 빈칸 (객체를 그리려다 화면이 깨지지 않게) */
function txt(v) { return typeof v === "string" ? v : (typeof v === "number" && isFinite(v)) ? String(v) : ""; }
function copyText(t) {
  try { navigator.clipboard.writeText(t); return true; } catch (e) { return false; }
}
function useBusy() {
  var _b = useState(false); var _m = useState(""); var _ok = useState("");
  var run = async function (fn, okText) {
    if (_b[0]) return;
    _b[1](true); _m[1](""); _ok[1]("");
    try { var r = await fn(); if (okText) _ok[1](okText); return r; }
    catch (e) { _m[1](e && e.message || String(e)); }
    finally { _b[1](false); }
  };
  return { busy: _b[0], err: _m[0], ok: _ok[0], run: run, setErr: _m[1], setOk: _ok[1] };
}

/* ── 덱 표시 ────────────────────────────────────────────── */

var CT_COL = { "골든글러브": "#D9A514", "시그니처": "#E5484D", "임팩트": "#2EAD5B", "국가대표": "#3B82F6", "올스타": "#A855F7", "라이브": "#F97316", "시즌": "#4CAF50" };
var BATS = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"];
var SPS = ["SP1", "SP2", "SP3", "SP4", "SP5"];
var RPS = ["RP1", "RP2", "RP3", "RP4", "RP5", "RP6"];
var ALL_SLOTS = BATS.concat(SPS).concat(["CP"]).concat(RPS);
function SlotLine(p) {
  var e = p.e && typeof p.e === "object" ? p.e : null;
  return (<div style={{ fontSize: 12, padding: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: p.dim ? .45 : 1 }}>
    <span style={{ fontFamily: "var(--h)", fontSize: 11, color: "var(--td)", width: 30, display: "inline-block" }}>{p.slot}</span>
    {e ? (<span style={{ color: CT_COL[txt(e.ct)] || "var(--t1)", textDecoration: p.strike ? "line-through" : "none" }}>{(txt(e.l) ? txt(e.l) + " " : "") + txt(e.n)}</span>)
      : (<span style={{ color: "var(--td)" }}>{"—"}</span>)}
  </div>);
}
function deckView(deck) { return deck && deck.view && typeof deck.view === "object" ? deck.view : {}; }
function deckCounts(deck) {
  var c = {}; var v = deckView(deck);
  ALL_SLOTS.forEach(function (s) { var e = v[s]; if (e && typeof e === "object" && txt(e.ct)) c[txt(e.ct)] = (c[txt(e.ct)] || 0) + 1; });
  return c;
}
var CT_SHORT = { "골든글러브": "골글", "시그니처": "시그", "임팩트": "임팩", "국가대표": "국대", "올스타": "올스타", "라이브": "라이브", "시즌": "시즌" };
function deckScoreText(deck) {
  if (!deck) return "";
  if (Array.isArray(deck.scores) && deck.scores.length) return { main: num(deck.scores[0]), sub: "0.1% 가정 · 5% " + num(deck.scores[1]) + " · 20% " + num(deck.scores[2]) };
  if (deck.total) return { main: num(deck.total), sub: "TOTAL SCORE" + (deck.setPoint ? " · 세트덱 " + num(deck.setPoint, 0) : "") };
  return { main: "", sub: "" };
}
/* 붙인 덱 한 장 — 글·덱 현황·작성 창에서 같이 쓴다 */
function DeckBox(p) {
  var d = p.deck; if (!d || typeof d !== "object") return null;
  var mob = p.mobile;
  var _rp = useState(false); var showRp = _rp[0]; var setShowRp = _rp[1];
  var sc = deckScoreText(d);
  var cnt = deckCounts(d);
  var view = deckView(d);
  var col = function (slots) { return slots.map(function (s) { return <SlotLine key={s} slot={s} e={view[s]} />; }); };
  return (<div style={{ border: "1px solid var(--bd)", borderRadius: 12, background: "var(--inner)", overflow: "hidden", marginTop: p.mt === undefined ? 10 : p.mt }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>
      <Icon n={d.src === "lab" ? "flask" : "deck"} style={{ color: d.src === "lab" ? "var(--acp)" : "var(--t2)" }} />
      <span style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{txt(d.team) + (txt(d.name) ? " · " + txt(d.name) : "")}</span>
      {d.src === "lab" ? <Tag c="purple" title="덱 연구소에서 도감 카드로 짜 본 덱이에요">{mob ? "실험본" : "연구소 실험본"}</Tag>
        : <Tag title="클럽원이 실제로 쓰는 라인업이에요">{"실전 덱"}</Tag>}
      <span style={{ marginLeft: "auto", textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--m)", color: "var(--acc)", fontWeight: 800 }}>{sc.main}</span>
        {!mob && <span style={{ fontSize: 11, color: "var(--td)", marginLeft: 6 }}>{sc.sub}</span>}
      </span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "1fr 1fr 1fr", gap: "0 14px", padding: "10px 14px" }}>
      <div>{col(BATS.slice(0, mob ? 9 : 5))}</div>
      {!mob && <div>{col(BATS.slice(5))}</div>}
      <div>{col(SPS.concat(["CP"]))}
        <button type="button" onClick={function () { setShowRp(!showRp); }} style={{ background: "none", border: "none", padding: "6px 8px 6px 0", color: "var(--td)", fontSize: 11.5, cursor: "pointer" }}>{"중계 6명 " + (showRp ? "▴" : "▾")}</button>
        {showRp && col(RPS)}
      </div>
    </div>
    {(p.actions || !mob) && (<div style={{ display: "flex", gap: 4, padding: "6px 10px", borderTop: "1px solid var(--bd)", alignItems: "center", flexWrap: "wrap" }}>
      {p.actions}
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--td)" }}>
        {Object.keys(cnt).map(function (k) { return (CT_SHORT[k] || k) + " " + cnt[k]; }).join(" · ")}
      </span>
    </div>)}
  </div>);
}
/* 두 덱을 자리별로 맞대 본다 */
function DeckCompare(p) {
  var a = p.a, b = p.b;
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8, fontSize: 12, fontWeight: 800 }}>
      <div>{p.aName}</div><div>{p.bName}</div>
    </div>
    {ALL_SLOTS.map(function (s) {
      var x = deckView(a)[s], y = deckView(b)[s];
      var same = x && y && typeof x === "object" && typeof y === "object" && txt(x.n) === txt(y.n) && txt(x.ct) === txt(y.ct) && txt(x.l) === txt(y.l);
      return (<div key={s} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "1px 6px", borderRadius: 6, background: same ? "transparent" : "rgba(255,213,79,.06)" }}>
        <SlotLine slot={s} e={x} dim={same} /><SlotLine slot={s} e={y} dim={same} />
      </div>);
    })}
    <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 8 }}>{"다른 자리만 밝게 보여요"}</div>
  </div>);
}

/* ── 맨 위: 페이지 ─────────────────────────────────────── */

/* 페이지 전체를 감싼다 — 테마 색을 깔고, 어디서 깨져도 사이트 전체가 하얗게 되지 않게 */
export default function ClubLoungePage(p) {
  return (<div className="club-root"><style>{THEME_CSS}</style>
    <Safe fallback={function (retry) {
      return (<div style={{ padding: p.mobile ? "12px 12px 100px" : "22px 26px", maxWidth: 1080 }}>
        <Card style={{ textAlign: "center", padding: "30px 18px" }}>
          <div style={{ fontSize: 34 }}>{"🧯"}</div>
          <div style={{ fontSize: 16, fontWeight: 900, margin: "6px 0" }}>{"클럽 라운지를 그리다 문제가 생겼어요"}</div>
          <div style={{ fontSize: 13, color: "var(--td)", lineHeight: 1.7, marginBottom: 14 }}>{"다른 메뉴는 그대로 쓸 수 있어요. 계속되면 관리자에게 알려 주세요."}</div>
          <Btn icon="refresh" onClick={retry}>{"다시 시도"}</Btn>
        </Card></div>);
    }}><ClubLoungeInner {...p} /></Safe></div>);
}

function ClubLoungeInner(p) {
  var api = p.api || realApi;
  var mob = p.mobile;
  var _me = useState(null); var me = _me[0]; var setMe = _me[1];
  var _err = useState(""); var err = _err[0]; var setErr = _err[1];
  var _view = useState("club"); var view = _view[0]; var setView = _view[1];
  var _appForm = useState(false); var appForm = _appForm[0]; var setAppForm = _appForm[1];
  var _acnt = useState(0); var adminCnt = _acnt[0]; var setAdminCnt = _acnt[1];
  var reload = useCallback(async function () {
    setErr("");
    try { setMe(await api.loadMe()); }
    catch (e) { setErr(e && e.message || String(e)); setMe(null); }
  }, [api]);
  useEffect(function () { if (p.authType === "google" || p.api) reload(); }, [p.userId]);
  /* 관리자 — 심사할 것(대기 · 분쟁 · 신고)이 몇 건인지 버튼에 띄운다 */
  useEffect(function () {
    if (!p.isAdmin) return;
    Promise.all([api.adminApplications("pending"), api.adminDisputes(), api.adminReports()])
      .then(function (r) { setAdminCnt(r[0].length + r[1].length + r[2].length); }).catch(function () {});
  }, [p.isAdmin, view]);
  useBackClose(appForm, function () { setAppForm(false); });
  /* 신청서를 낸 뒤(작성 · 심사 중)에는 신청 화면이 따로 뜨므로 빈 양식 상태를 닫는다 — 뒤로가기를 한 번 헛누르지 않게 */
  useEffect(function () {
    var a = me && me.app;
    if (appForm && a && a.kind !== "reverify" && (a.status === "draft" || a.status === "pending")) setAppForm(false);
  }, [me]);
  useBackClose(p.isAdmin && view === "review", function () { setView("club"); reload(); });

  var wrap = function (inner) {
    return (<div style={{ padding: mob ? "12px 12px 100px" : "22px 26px", maxWidth: 1080 }}>{inner}</div>);
  };
  var title = (<div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 16px" }}>
    <h2 style={{ fontSize: 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 2, color: "var(--t1)", margin: 0 }}>{"🎙️ 클럽 라운지"}</h2>
    {p.isAdmin && (<div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
      <Btn sm style={view === "club" ? { color: "var(--acc)", borderColor: "var(--acc)" } : null} onClick={function () { setView("club"); reload(); }}>{"내 클럽"}</Btn>
      <Btn sm icon="shield" style={view === "review" ? { color: "var(--acc)", borderColor: "var(--acc)" } : null} onClick={function () { setView("review"); }}>{"인증 심사"}
        {adminCnt > 0 && <span style={{ minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9, background: "#FF5A5A", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{adminCnt}</span>}</Btn>
    </div>)}
  </div>);

  if (p.authType !== "google" && !p.api) return wrap(<React.Fragment>{title}
    <Card style={{ textAlign: "center", padding: "36px 20px" }}>
      <div style={{ fontSize: 38 }}>{"🔒"}</div>
      <div style={{ fontSize: 16, fontWeight: 900, margin: "8px 0 6px" }}>{"구글 계정으로 로그인해 주세요"}</div>
      <div style={{ fontSize: 13, color: "var(--td)", lineHeight: 1.7 }}>{"클럽 라운지는 클럽원끼리 덱과 글을 주고받는 곳이라"}<br />{"게스트로는 들어갈 수 없어요."}</div>
    </Card></React.Fragment>);

  if (p.isAdmin && view === "review") return wrap(<React.Fragment>{title}<SafeBox what="심사 화면"><AdminReview api={api} mobile={mob} onAlerts={p.onAlerts} /></SafeBox></React.Fragment>);
  if (err) return wrap(<React.Fragment>{title}<Msg text={"클럽 정보를 불러오지 못했어요: " + err} /><Btn icon="refresh" onClick={reload}>{"다시 시도"}</Btn></React.Fragment>);
  if (!me) return wrap(<React.Fragment>{title}<div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div></React.Fragment>);

  var mem = me.member;
  /* 재인증은 클럽장 화면 안에서만 다룬다 — 클럽이 없는데 남아 있는 재인증 신청은 없는 셈 친다 */
  var app = me.app && me.app.kind === "reverify" ? null : me.app;
  if (mem && mem.status === "active" && me.club) {
    return (<ClubHome {...p} api={api} me={me} reload={reload} title={title} />);
  }
  if (mem && mem.status === "pending") return wrap(<React.Fragment>{title}<JoinWait api={api} me={me} reload={reload} /></React.Fragment>);
  if (app && app.status === "pending") return wrap(<React.Fragment>{title}<AppPending api={api} app={app} reload={reload} /></React.Fragment>);
  if (app && app.status === "draft") return wrap(<React.Fragment>{title}<ApplyFlow api={api} app={app} reload={reload} mobile={mob} /></React.Fragment>);
  if (appForm) return wrap(<React.Fragment>{title}<ApplyFlow api={api} app={null} last={app} reload={reload} mobile={mob} onBack={function () { setAppForm(false); }} /></React.Fragment>);
  return wrap(<React.Fragment>{title}<StartView api={api} me={me} reload={reload} mobile={mob} onApply={function () { setAppForm(true); }} draft={p.draft} /></React.Fragment>);
}

/* ── 클럽이 없을 때 ────────────────────────────────────── */

function StartView(p) {
  var mob = p.mobile, api = p.api;
  var _code = useState(""); var code = _code[0]; var setCode = _code[1];
  var _found = useState(null); var found = _found[0]; var setFound = _found[1];
  var _nick = useState(""); var nick = _nick[0]; var setNick = _nick[1];
  var b = useBusy();
  var app = p.me.app;
  var find = function () {
    b.run(async function () {
      if (!code.trim()) throw new Error("초대 코드를 넣어 주세요");
      var c = await api.lookupClub(code);
      if (!c) throw new Error("그 코드의 클럽을 찾지 못했어요. 클럽장에게 코드를 다시 확인해 주세요");
      setFound(c);
    });
  };
  var join = function () {
    b.run(async function () {
      if (!nick.trim()) throw new Error("인게임 닉네임을 넣어 주세요");
      await api.requestJoin(code, nick.trim());
      await p.reload();
    });
  };
  return (<div>
    {p.draft && <Msg bad={false} text="덱 연구소에서 가져온 실험본이 있어요. 클럽에 들어가면 라운지에 올릴 수 있어요." />}
    {app && app.status === "rejected" && (<Msg text={"클럽장 인증이 반려됐어요" + (app.reason ? " — " + app.reason : "") + ". 다시 신청할 수 있어요."} />)}
    <Card style={{ textAlign: "center", padding: mob ? "24px 16px" : "30px", marginBottom: 12 }}>
      <div style={{ fontSize: 40 }}>{"🎙️"}</div>
      <div style={{ fontSize: 16, fontWeight: 900, margin: "6px 0 4px" }}>{"아직 소속 클럽이 없어요"}</div>
      <div style={{ fontSize: 13, color: "var(--td)" }}>{"클럽장은 인증 후 클럽을 열고, 클럽원은 초대 코드로 가입해요"}</div>
    </Card>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
      {/* 들어오는 사람 대부분은 가입하려는 클럽원이라 가입을 먼저 */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon n="link" size={18} style={{ color: "#5AA9F0" }} /><b style={{ fontSize: 15 }}>{"클럽 가입"}</b></div>
        <div style={{ fontSize: 12.5, color: "var(--td)", lineHeight: 1.7, margin: "8px 0 10px" }}>{"클럽장에게 받은 초대 코드를 넣어 주세요."}</div>
        {!found ? (<div style={{ display: "flex", gap: 6 }}>
          <input value={code} onChange={function (e) { setCode(e.target.value.toUpperCase()); if (b.err) b.setErr(""); }} placeholder="예: GULL-7K2Q" maxLength={12}
            onKeyDown={function (e) { if (e.key === "Enter") find(); }}
            style={Object.assign({}, INP, { width: 0, flex: 1, fontFamily: "var(--m)", letterSpacing: 1 })} />
          <Btn pri onClick={find} disabled={b.busy}>{"찾기"}</Btn>
        </div>) : (<div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "var(--inner)", marginBottom: 10 }}>
            <Emblem name={found.name} size={36} />
            <div style={{ flex: 1, minWidth: 0 }}><b>{found.name}</b><div style={{ fontSize: 11.5, color: "var(--td)" }}>{"클럽원 " + found.members + " / " + found.capacity}</div></div>
            <Btn sm ghost onClick={function () { setFound(null); b.setErr(""); }}>{"다른 코드"}</Btn>
          </div>
          {found.intro && <div style={{ fontSize: 12.5, color: "var(--t2)", margin: "0 0 10px", lineHeight: 1.6 }}>{found.intro}</div>}
          {found.members >= found.capacity ? (<Msg text={"이 클럽은 정원(" + found.capacity + "명)이 다 찼어요. 자리가 나면 다시 신청해 주세요."} />)
            : (<React.Fragment>
              <Field label="인게임 닉네임" value={nick} onChange={function (v) { setNick(v); if (b.err) b.setErr(""); }} max={20} ph="클럽장이 알아볼 수 있게" />
              <Btn pri style={{ width: "100%" }} onClick={join} disabled={b.busy}>{b.busy ? "보내는 중…" : "가입 신청"}</Btn>
            </React.Fragment>)}
        </div>)}
        <Msg text={b.err} />
      </Card>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon n="crown" size={18} style={{ color: "var(--acc)" }} /><b style={{ fontSize: 15 }}>{"클럽장 등록"}</b></div>
        <div style={{ fontSize: 12.5, color: "var(--td)", lineHeight: 1.7, margin: "8px 0 14px" }}>{"인게임 클럽장이라면 — 클럽장임이 보이는 캡처 1장으로 인증해요."}<br />{"관리자가 확인하면 클럽이 열려요."}</div>
        <Btn pri style={{ width: "100%" }} onClick={p.onApply}>{"인증 신청"}</Btn>
      </Card>
    </div>
  </div>);
}

function Emblem(p) {
  var s = p.size || 52;
  var t = String(p.name || "").replace(/\s/g, "").slice(0, 2);
  var h = 0; String(p.name || "").split("").forEach(function (c) { h = (h * 37 + c.charCodeAt(0)) % 360; });
  return (<div style={{ width: s, height: s, borderRadius: s * .27, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(140deg,hsl(" + h + ",70%,42%) 0%,hsl(" + ((h + 60) % 360) + ",55%,22%) 100%)", color: "#fff", fontWeight: 900, fontSize: s * .36, letterSpacing: -.5 }}>{t}</div>);
}

/* 클럽장 인증 — ① 정보 → ② 코드와 캡처 → ③ 관리자 확인 */
function ApplyFlow(p) {
  var api = p.api, app = p.app, mob = p.mobile;
  var last = p.last || app;
  var _name = useState(last ? last.club_name : ""); var name = _name[0]; var setName = _name[1];
  var _nick = useState(last ? last.nickname : ""); var nick = _nick[0]; var setNick = _nick[1];
  var _edit = useState(!app); var edit = _edit[0]; var setEdit = _edit[1];
  var b = useBusy();
  /* 코드를 받은 직후에는 서버의 새 신청(app)이 아직 안 왔을 수 있다 — 그동안은 정보 단계를 그대로 보여 준다 */
  var showForm = edit || !app;
  var step = showForm ? 0 : 1;
  var Steps = (<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
    {["클럽 정보", "인증 캡처", "관리자 확인"].map(function (x, i) {
      var done = i < step, on = i === step;
      return (<React.Fragment key={x}>
        {i > 0 && <div style={{ flex: 1, height: 1, background: "var(--bd)" }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 22, height: 22, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800,
            background: done ? "#4CAF50" : on ? "var(--acc)" : "transparent", color: done || on ? "#111" : "var(--td)", border: done || on ? "none" : "1px solid var(--bd)" }}>{done ? "✓" : i + 1}</span>
          {(!mob || on) && <span style={{ fontWeight: on ? 800 : 500, color: on ? "var(--t1)" : "var(--td)", fontSize: 13 }}>{x}</span>}
        </div></React.Fragment>);
    })}</div>);
  var start = function () {
    b.run(async function () {
      if (!name.trim() || !nick.trim()) throw new Error("클럽 이름과 닉네임을 넣어 주세요");
      await api.startApplication(name.trim(), nick.trim());
      await p.reload();
      setEdit(false);
    });
  };
  return (<div style={{ maxWidth: 640 }}>
    <button type="button" onClick={edit && !app ? p.onBack : function () { b.run(async function () { await api.cancelApplication(app.id); await p.reload(); }); }}
      style={{ background: "none", border: "none", color: "var(--td)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
      <Icon n="back" size={13} />{edit && !app ? "클럽 라운지" : "신청 그만두기"}</button>
    <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -.5, marginBottom: 4 }}>{"클럽장 등록"}</div>
    <div style={{ color: "var(--t2)", marginBottom: 20, fontSize: 13 }}>{"인게임 클럽장만 클럽을 열 수 있어요. 클럽장 화면 캡처 1장이면 돼요."}</div>
    <Card pad={mob ? "18px 16px" : 22}>
      {Steps}
      {showForm ? (<div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: "0 12px" }}>
          <Field label="클럽 이름 (인게임과 같게)" value={name} onChange={setName} max={20} />
          <Field label="인게임 닉네임" value={nick} onChange={setNick} max={20} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          {app && <Btn onClick={function () { setEdit(false); }}>{"취소"}</Btn>}
          <Btn pri onClick={start} disabled={b.busy}>{"다음"}</Btn>
        </div>
      </div>) : (<div>
        {app.kind === "claim" && (<div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 10, background: "rgba(255,167,38,.08)", border: "1px solid rgba(255,167,38,.3)", marginBottom: 14 }}>
          <Icon n="alert" style={{ color: "#FFA726", marginTop: 2 }} />
          <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>{"‘" + app.club_name + "’ 은 이미 등록된 클럽이에요. 진짜 클럽장이면 아래처럼 캡처를 올려 주세요. 관리자가 확인해 기존 등록이 잘못됐으면 그 클럽을 정리하고 새로 열어 드려요."}</div>
        </div>)}
        <ShotSubmit api={api} app={app} onDone={p.reload} left={<Btn onClick={function () { setEdit(true); }}>{"정보 고치기"}</Btn>} />
      </div>)}
      <Msg text={b.err} /><Msg bad={false} text={b.ok} />
    </Card>
  </div>);
}

/* 캡처 올리기 + 제출. 처음 인증·되찾기(ApplyFlow)는 캡처 1장만, 재인증(ReverifyBanner)은 코드를 소개글에 적은 캡처.
   올리기 전에 원본으로 간단 점검(shot-check.js)을 돌려 결과를 같이 낸다 — 관리자 심사 카드에만 보인다 */
function ShotSubmit(p) {
  var api = p.api, app = p.app;
  var _files = useState([]); var files = _files[0]; var setFiles = _files[1];
  var b = useBusy();
  var addFiles = function (list) {
    if (!list || !list[0]) return;
    setFiles([{ file: list[0], url: URL.createObjectURL(list[0]) }]);
    b.setErr("");
  };
  var submit = function () {
    b.run(async function () {
      if (!files.length) throw new Error("캡처를 한 장 올려 주세요");
      var paths = [], checks = [];
      for (var i = 0; i < files.length; i++) {
        try { checks.push(await checkShot(files[i].file)); } catch (e) { checks.push({ flags: [{ lv: "info", t: "점검하지 못함" }] }); }
        paths.push(await api.uploadVerifyShot(app.id, files[i].file, i + 1));
      }
      await api.submitApplication(app.id, paths, checks);
      await p.onDone();
    });
  };
  return (<div>
    {p.reverify ? (<React.Fragment>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "16px 18px", borderRadius: 12, background: "rgba(255,213,79,.08)", border: "1px solid rgba(255,213,79,.22)" }}>
        <div style={{ flex: 1 }}><div style={Object.assign({}, KICK, { color: "var(--acc)" })}>{"재인증 코드"}</div>
          <div style={{ fontFamily: "var(--m)", fontSize: 28, fontWeight: 800, letterSpacing: 4, color: "var(--acc)", marginTop: 4 }}>{app.code}</div></div>
        <Btn sm icon="copy" onClick={function () { copyText(app.code); b.setOk("코드를 복사했어요"); }}>{"복사"}</Btn>
      </div>
      <ol style={{ margin: "16px 0 0", paddingLeft: 18, lineHeight: 1.9, fontSize: 13, color: "var(--t2)" }}>
        <li>{"인게임 "}<b style={{ color: "var(--t1)" }}>{"클럽 소개글"}</b>{" 끝에 코드를 잠깐 붙여 넣어요"}</li>
        <li>{"클럽장 표시와 소개글이 한 화면에 보이게 캡처해요"}</li>
        <li>{"확인이 끝나면 코드는 지워도 돼요"}</li>
      </ol>
    </React.Fragment>) : (<div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--inner)" }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>{"클럽장임이 보이는 인게임 화면을 캡처해 주세요"}</div>
      <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.8 }}>
        {"예: 클럽 정보 화면에서 "}<b style={{ color: "var(--t1)" }}>{"클럽 이름 · 클럽장 표시 · 내 닉네임"}</b>{"이 함께 보이게"}<br />
        {"휴대폰 캡처 원본 그대로 올려 주세요. 자르거나 편집하면 확인이 늦어질 수 있어요."}</div>
    </div>)}
    <div style={Object.assign({}, KICK, { margin: "20px 0 8px" })}>{"캡처 1장"}</div>
    <div style={{ display: "flex", gap: 10 }}>
      {files.map(function (f, i) {
        return (<div key={i} style={{ width: 96, height: 132, borderRadius: 10, border: "1px solid var(--bd)", position: "relative", overflow: "hidden", background: "#111" }}>
          <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button type="button" onClick={function () { setFiles([]); }} title="빼기" aria-label="캡처 빼기"
            style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.6)", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", padding: 6 }}><Icon n="x" size={13} /></button>
        </div>);
      })}
      {!files.length && (<label style={{ width: 96, height: 132, borderRadius: 10, border: "1px dashed var(--bd)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "var(--td)", cursor: "pointer" }}>
        <Icon n="img" /><span style={{ fontSize: 11 }}>{"올리기"}</span>
        <input type="file" accept="image/*" style={{ display: "none" }} onChange={function (e) { addFiles(e.target.files); e.target.value = ""; }} />
      </label>)}
    </div>
    <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 8 }}>{"캡처는 관리자만 보고, 심사가 끝나면 30일 안에 지워져요"}</div>
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22 }}>
      {p.left || <span />}
      <Btn pri onClick={submit} disabled={b.busy}>{b.busy ? "올리는 중…" : (p.reverify ? "재인증 제출" : "신청하기")}</Btn>
    </div>
    <Msg text={b.err} /><Msg bad={false} text={b.ok} />
  </div>);
}

/* 관리자 — 캡처 자동 점검 결과. 경고(편집·AI 흔적)는 주황, 참고(비율·카메라)는 회색 */
function ShotChecks(p) {
  /* 점검 결과는 신청자 화면이 만들어 보낸 값이라 모양을 믿지 않는다 */
  var list = Array.isArray(p.checks) ? p.checks.filter(function (c) { return c && typeof c === "object"; }) : [];
  if (!list.length) return (<div style={{ fontSize: 12, color: "var(--td)", marginTop: 6 }}>{"자동 점검: 기록 없음"}</div>);
  var flags = []; list.forEach(function (c) { (Array.isArray(c.flags) ? c.flags : []).forEach(function (f) { if (f && typeof f === "object" && txt(f.t)) flags.push(f); }); });
  var c0 = list[0];
  var meta = [txt(c0.w) && txt(c0.h) ? txt(c0.w) + "×" + txt(c0.h) : "", txt(c0.type) ? txt(c0.type).toUpperCase() : "", Number(c0.size) > 0 ? Math.round(Number(c0.size) / 1024) + "KB" : "",
    txt(c0.modified) && !isNaN(new Date(txt(c0.modified)).getTime()) ? "파일 날짜 " + fmtWhen(txt(c0.modified)).split(" ")[0] : ""].filter(Boolean).join(" · ");
  return (<div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: flags.some(function (f) { return f.lv === "warn"; }) ? "rgba(255,167,38,.08)" : "var(--inner)", fontSize: 12, lineHeight: 1.7 }}>
    <div style={{ fontWeight: 700, color: "var(--t2)" }}>{"자동 점검"}{meta && <span style={{ fontWeight: 400, color: "var(--td)" }}>{"  " + meta}</span>}</div>
    {!flags.length ? <div style={{ color: "#4CAF50" }}>{"✓ 편집·AI 흔적 없음"}</div>
      : flags.map(function (f, i) { return <div key={i} style={{ color: f.lv === "warn" ? "#FFA726" : "var(--td)" }}>{(f.lv === "warn" ? "⚠ " : "· ") + txt(f.t)}</div>; })}
    <div style={{ fontSize: 11, color: "var(--td)" }}>{"파일 정보만 본 참고용이에요. 정보를 지운 위조는 못 잡아요."}</div>
  </div>);
}

function AppPending(p) {
  var b = useBusy(), app = p.app;
  return (<Card style={{ textAlign: "center", padding: "30px 18px" }}>
    <div style={{ fontSize: 36 }}>{"⏳"}</div>
    <div style={{ fontSize: 16, fontWeight: 900, margin: "6px 0" }}>{app.kind === "claim" ? "클럽 되찾기 확인 중" : "클럽장 인증 확인 중"}</div>
    {app.kind === "claim" && <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.7, marginBottom: 6 }}>{"이미 등록된 클럽이라 관리자가 기존 클럽장과 함께 확인해요. 기존 등록이 잘못됐으면 그 클럽을 정리하고 같은 이름으로 새로 열어 드려요."}</div>}
    <div style={{ fontSize: 13, color: "var(--td)", lineHeight: 1.7 }}>{app.club_name + " · " + app.nickname + " · " + ago(app.submitted_at) + " 신청"}<br />{"승인되면 이 화면이 클럽 화면으로 바뀌어요."}</div>
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
      <Btn sm icon="refresh" onClick={p.reload}>{"새로 보기"}</Btn>
      <Btn sm no onClick={function () { if (window.confirm("신청을 취소할까요?")) b.run(async function () { await p.api.cancelApplication(app.id); await p.reload(); }); }}>{"신청 취소"}</Btn>
    </div><Msg text={b.err} />
  </Card>);
}

function JoinWait(p) {
  var b = useBusy();
  return (<Card style={{ textAlign: "center", padding: "30px 18px" }}>
    <div style={{ fontSize: 36 }}>{"📨"}</div>
    <div style={{ fontSize: 16, fontWeight: 900, margin: "6px 0" }}>{(p.me.club ? p.me.club.name : "클럽") + "에 가입 신청했어요"}</div>
    <div style={{ fontSize: 13, color: "var(--td)", lineHeight: 1.7 }}>{"클럽장이 승인하면 들어갈 수 있어요."}<br />{"신청한 닉네임: "}<b style={{ color: "var(--t2)" }}>{p.me.member.nickname}</b></div>
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
      <Btn sm icon="refresh" onClick={p.reload}>{"새로 보기"}</Btn>
      <Btn sm no onClick={function () { if (window.confirm("가입 신청을 취소할까요?")) b.run(async function () { await p.api.cancelJoin(); await p.reload(); }); }}>{"신청 취소"}</Btn>
    </div><Msg text={b.err} />
  </Card>);
}

/* ── 관리자: 클럽장 인증 심사 ─────────────────────────── */

function AdminReview(p) {
  var api = p.api, mob = p.mobile;
  var _st = useState("pending"); var st = _st[0]; var setSt = _st[1];
  /* 목록은 어느 탭의 것인지와 함께 둔다 — 탭을 바꾼 직후 옛 탭의 목록으로 새 탭을 그리면 깨진다 */
  var _list = useState(null); var listBox = _list[0]; var setListBox = _list[1];
  var list = listBox && listBox.st === st ? listBox.items : null;
  var _urls = useState({}); var urls = _urls[0]; var setUrls = _urls[1];
  var _names = useState([]); var names = _names[0]; var setNames = _names[1];
  var _cnt = useState({}); var cnt = _cnt[0]; var setCnt = _cnt[1];
  var b = useBusy();
  /* 캡처 주소는 한 번에 받아 둔다 (비공개 저장소라 서명된 주소가 있어야 보인다) */
  var signAll = async function (paths) {
    paths = paths.filter(Boolean);
    if (!paths.length) return;
    var u = await api.verifyShotUrls(paths); var m = {}; paths.forEach(function (s, i) { m[s] = u[i]; });
    setUrls(function (old) { return Object.assign({}, old, m); });
  };
  var counts = async function () {
    try {
      var r = await Promise.all([api.adminApplications("pending"), api.adminDisputes(), api.adminReports()]);
      setCnt({ pending: r[0].length, dispute: r[1].length, report: r[2].length });
    } catch (e) {}
  };
  var _zoom = useState(null); var zoom = _zoom[0]; var setZoom = _zoom[1];
  /* 탭을 빨리 바꾸면 늦게 온 옛 탭의 목록이 새 탭을 덮어 '불러오는 중…' 에 멈추던 것 — 지금 탭의 것만 받는다 */
  var stRef = useRef(st); stRef.current = st;
  var load = async function () {
    var mySt = st;
    b.setErr("");
    try {
      var l;
      if (st === "dispute") {
        l = await api.adminDisputes();
        var ps = []; l.forEach(function (d) {
          ((d.original && d.original.shots) || []).forEach(function (s) { ps.push(s); });
          ((d.reverify && d.reverify.shots) || []).forEach(function (s) { ps.push(s); });
          d.claims.forEach(function (a) { (a.shots || []).forEach(function (s) { ps.push(s); }); });
        });
        await signAll(ps);
      } else if (st === "report") l = await api.adminReports();
      else if (st === "ban") l = await api.adminBans();
      else {
        l = await api.adminApplications(st);
        setNames((await api.adminClubNames()).map(function (c) { return c.name; }));
        var all = []; l.forEach(function (a) { (a.shots || []).forEach(function (s) { all.push(s); }); });
        await signAll(all);
      }
      if (stRef.current !== mySt) return;
      setListBox({ st: mySt, items: l });
    } catch (e) { if (stRef.current !== mySt) return; b.setErr(e.message); setListBox({ st: mySt, items: [] }); }
  };
  useEffect(function () { load(); }, [st]);
  useEffect(function () { counts(); api.purgeOldShots().catch(function () {}); }, []);
  /* 처리한 뒤 목록 · 숫자 · 메뉴의 빨간 점을 함께 고친다 */
  var after = async function () { await load(); await counts(); if (p.onAlerts) p.onAlerts(); };
  var similar = function (n) {
    var k = String(n || "").replace(/\s/g, "").toLowerCase();
    return names.filter(function (x) { var y = x.replace(/\s/g, "").toLowerCase(); return x !== n && (y.indexOf(k) >= 0 || k.indexOf(y) >= 0); });
  };
  var decide = function (a, ok) {
    var reason = "";
    if (!ok) { reason = window.prompt("반려 사유 (신청자에게 보여요)", "캡처로 클럽장임을 확인하지 못했어요. 클럽 이름·클럽장 표시·닉네임이 함께 보이는 화면으로 다시 올려 주세요."); if (reason === null) return; }
    else if (!window.confirm(a.club_name + " 클럽을 열고 " + a.nickname + " 님을 클럽장으로 정할까요?")) return;
    b.run(async function () { await api.reviewApplication(a.id, ok, reason); await after(); }, ok ? "승인했어요" : "반려했어요");
  };
  var TABS = [["pending", "대기", cnt.pending], ["dispute", "분쟁", cnt.dispute], ["report", "신고", cnt.report], ["ban", "제한"], ["approved", "승인됨"], ["rejected", "반려"]];
  /* 캡처는 위쪽(클럽 이름 · 클럽장 표시)이 보이게 크게, 누르면 이 화면 위에서 원본 크기로 */
  var shots = function (arr, purged) {
    var w = mob ? 112 : 136, h = mob ? 200 : 242;
    return (<div style={{ display: "flex", gap: 8 }}>
      {(arr || []).length ? arr.map(function (s) {
        return (<button key={s} type="button" title="크게 보기" onClick={function () { if (urls[s]) setZoom(urls[s]); }} style={{ width: w, height: h, padding: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--bd)", background: "#111", display: "block", flexShrink: 0, cursor: "zoom-in", position: "relative" }}>
          {urls[s] && <img src={urls[s]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />}
          <span style={{ position: "absolute", left: 6, bottom: 6, fontSize: 10.5, padding: "2px 6px", borderRadius: 6, background: "rgba(0,0,0,.6)", color: "#fff" }}>{"크게 보기"}</span></button>);
      }) : <div style={{ width: w, fontSize: 11.5, color: "var(--td)", padding: "6px 0" }}>{purged ? "캡처 삭제됨 (30일)" : "캡처 없음"}</div>}
    </div>);
  };
  var KIND_TAG = { claim: <Tag c="orange">{"되찾기"}</Tag>, reverify: <Tag c="purple">{"재인증"}</Tag> };
  var body;
  if (list === null) body = <div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div>;
  else if (!list.length) body = <div style={{ color: "var(--td)", fontSize: 13, padding: 20, textAlign: "center" }}>{"없어요"}</div>;
  else if (st === "dispute") body = list.map(function (d) { return <DisputeCard key={d.clubId} d={d} api={api} b={b} shots={shots} after={after} mobile={mob} />; });
  else if (st === "report") body = list.map(function (r) { return <ReportCard key={r.id} r={r} api={api} b={b} after={after} goDispute={function () { setSt("dispute"); }} />; });
  else if (st === "ban") body = list.map(function (x) {
    return (<Card key={x.user_id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }} pad="12px 16px">
      <div style={{ flex: 1, minWidth: 0 }}><b>{x.nickname || "(닉네임 모름)"}</b>{x.clubName && <span style={{ color: "var(--td)", fontSize: 12 }}>{" · " + x.clubName}</span>}
        <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 2 }}>{fmtWhen(x.created_at) + " · " + (x.reason || "사유 없음")}</div></div>
      <Btn sm onClick={function () { if (window.confirm((x.nickname || "이 계정") + " 의 클럽장 신청 제한을 풀까요?")) b.run(async function () { await api.unban(x.user_id); await after(); }, "제한을 풀었어요"); }}>{"제한 풀기"}</Btn>
    </Card>);
  });
  else body = list.map(function (a) {
    var sim = similar(a.club_name);
    return (<Card key={a.id} style={{ display: "flex", gap: 14, marginBottom: 10, flexWrap: "wrap" }}>
      {shots(a.shots, a.shots_purged)}
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 15, fontWeight: 900 }}>{a.club_name}</span>{KIND_TAG[a.kind]}</div>
        <div style={{ fontSize: 12, color: "var(--td)", margin: "3px 0 10px" }}>{"신청 " + a.nickname + " · " + fmtWhen(a.submitted_at || a.created_at) + (a.reviewed_at ? " · 심사 " + fmtWhen(a.reviewed_at) : "")}</div>
        {st === "pending" && (<div style={{ fontSize: 12.5, lineHeight: 1.9, color: "var(--t2)" }}>
          <div style={Object.assign({}, KICK, { marginBottom: 2 })}>{"캡처에서 확인할 것"}</div>
          <div>{"· 인게임 화면에 클럽장 표시가 보이는지"}</div>
          <div>{"· 닉네임이 "}<b style={{ color: "var(--t1)" }}>{a.nickname}</b>{" 와 같은지"}</div>
          <div>{"· 클럽 이름이 "}<b style={{ color: "var(--t1)" }}>{a.club_name}</b>{" 와 같은지 (대소문자까지)"}{sim.length > 0 && <span style={{ color: "#FFA726" }}>{"  ⚠ 비슷한 이름: " + sim.join(", ")}</span>}</div>
        </div>)}
        {st === "pending" && <ShotChecks checks={a.checks} />}
        {a.reason && <div style={{ fontSize: 12, color: "var(--td)", marginTop: 6 }}>{"메모: " + a.reason}</div>}
        {st === "pending" && (<div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Btn sm no onClick={function () { decide(a, false); }} disabled={b.busy}>{"반려"}</Btn>
          <Btn sm ok icon="check" onClick={function () { decide(a, true); }} disabled={b.busy}>{"승인"}</Btn>
        </div>)}
      </div>
    </Card>);
  });
  return (<div>
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--bd)", marginBottom: 16, overflowX: "auto" }}>
      {TABS.map(function (t) {
        var on = t[0] === st;
        return (<button key={t[0]} type="button" onClick={function () { setSt(t[0]); }} style={{ padding: mob ? "10px 9px" : "10px 14px", fontSize: 13.5, fontWeight: 600, background: "none", border: "none", whiteSpace: "nowrap",
          borderBottom: "2px solid " + (on ? "var(--acc)" : "transparent"), color: on ? "var(--t1)" : "var(--td)", cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", gap: 5 }}>
          {t[1]}{t[2] ? <span style={{ minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9, background: t[0] === "pending" ? "#FF5A5A" : "#FFA726", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t[2]}</span> : null}
        </button>);
      })}
    </div>
    {st === "dispute" && <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.6, marginBottom: 12 }}>{"같은 이름으로 다시 신청(되찾기)이 들어왔거나 재인증을 걸어 둔 클럽이에요. 위조범은 진짜 소개글에 새 코드를 적을 수 없으니, 애매하면 기존 클럽장에게 재인증을 요청하세요."}</div>}
    <Msg text={b.err} /><Msg bad={false} text={b.ok} />
    {body}
    {zoom && <Viewer url={zoom} onClose={function () { setZoom(null); }} />}
  </div>);
}

/* 분쟁 한 건 — 왼쪽 기존 클럽장, 오른쪽 되찾기 신청자(들) */
function DisputeCard(p) {
  var d = p.d, api = p.api, b = p.b, shots = p.shots;
  var _ban = useState(true); var ban = _ban[0]; var setBan = _ban[1];
  var rv = d.reverify;
  var due = rv && rv.due_at ? new Date(rv.due_at).getTime() : null;
  var rvTxt = !rv ? "재인증 요청 안 함"
    : rv.status === "pending" ? "재인증 제출됨 · " + ago(rv.submitted_at) + " · 코드 " + rv.code
    : "재인증 요청 중 · 코드 " + rv.code + " · " + (due ? (due < Date.now() ? "기한 지남 (" + fmtWhen(rv.due_at) + ")" : fmtWhen(rv.due_at) + " 까지") : "");
  var winClaimant = function (a) {
    var r = window.prompt("‘" + d.name + "’ 기존 클럽을 클럽원·글까지 모두 없애고, " + a.nickname + " 님 이름으로 새로 엽니다.\n되돌릴 수 없어요. 사유를 적으면 진행합니다 (기존 클럽장 기록에 남아요)", "클럽장 인증 위조");
    if (r === null) return;
    b.run(async function () { await api.resolveDispute(a.id, "claimant", ban, r, d.club ? d.clubId : null); await p.after(); }, "기존 클럽을 정리하고 " + a.nickname + " 님 클럽으로 새로 열었어요");
  };
  var winLeader = function (a) {
    var r = window.prompt("기존 클럽장이 진짜예요. " + a.nickname + " 님의 되찾기 신청을 반려합니다. 반려 사유 (신청자에게 보여요)", "기존 클럽장의 인증이 확인됐어요");
    if (r === null) return;
    b.run(async function () { await api.resolveDispute(a.id, "leader", ban, r); await p.after(); }, "되찾기 신청을 반려했어요");
  };
  var settle = function (okay) {
    var r = okay ? "" : window.prompt("‘" + d.name + "’ 클럽을 클럽원·글까지 모두 없앱니다. 되돌릴 수 없어요. 사유", "재인증 실패");
    if (!okay && r === null) return;
    if (okay && !window.confirm("재인증을 통과로 처리할까요?")) return;
    b.run(async function () { await api.settleReverify(d.clubId, okay, ban, r || ""); await p.after(); }, okay ? "재인증을 통과시켰어요" : "클럽을 닫았어요");
  };
  return (<Card style={{ marginBottom: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <Emblem name={d.name} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 15 }}>{d.name}</b>
        <div style={{ fontSize: 12, color: "var(--td)" }}>{d.club ? "클럽장 " + d.leaderNick + " · 클럽원 " + d.members + "명 · " + fmtWhen(d.club.created_at).split(" ")[0] + " 개설" : "이미 닫힌 클럽"}</div></div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--t2)", cursor: "pointer" }}>
        <input type="checkbox" checked={ban} onChange={function (e) { setBan(e.target.checked); }} />{"진 쪽은 클럽장 신청 제한"}</label>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: p.mobile ? "1fr" : "1fr 1fr", gap: 14 }}>
      <div style={{ padding: 12, borderRadius: 10, background: "var(--inner)" }}>
        <div style={Object.assign({}, KICK, { marginBottom: 8 })}>{"기존 클럽장 · 처음 인증"}</div>
        {d.club ? (<React.Fragment>
          {shots(d.original && d.original.shots, d.original && d.original.shots_purged)}
          <div style={{ fontSize: 11.5, color: "var(--td)", margin: "6px 0 10px" }}>{d.original ? fmtWhen(d.original.reviewed_at || d.original.created_at) + " 승인" : "처음 인증 기록 없음"}</div>
          <div style={Object.assign({}, KICK, { marginBottom: 6 })}>{"재인증"}</div>
          <div style={{ fontSize: 12.5, color: rv && due && due < Date.now() && rv.status === "draft" ? "#FFA726" : "var(--t2)", marginBottom: 8 }}>{rvTxt}</div>
          {rv && rv.status === "pending" && shots(rv.shots)}
          {rv && rv.status === "pending" && <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 6 }}>{"캡처 소개글에 코드 "}<b style={{ fontFamily: "var(--m)", color: "var(--acc)" }}>{rv.code}</b>{" 가 보이는지 확인"}</div>}
          {rv && rv.status === "pending" && <ShotChecks checks={rv.checks} />}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <Btn sm icon="refresh" onClick={function () { var h = window.prompt("재인증 기한 (시간)", "48"); if (h === null) return; b.run(async function () { await api.requestReverify(d.clubId, parseInt(h, 10) || 48); await p.after(); }, "기존 클럽장에게 재인증을 요청했어요 — 클럽 화면 맨 위에 안내가 떠요"); }}>{rv ? "새 코드로 다시 요청" : "재인증 요청"}</Btn>
            {!d.claims.length && rv && <Btn sm ok onClick={function () { settle(true); }}>{"진짜 맞음"}</Btn>}
            {!d.claims.length && rv && <Btn sm no onClick={function () { settle(false); }}>{"가짜 · 클럽 닫기"}</Btn>}
          </div>
        </React.Fragment>) : <div style={{ fontSize: 12.5, color: "var(--td)" }}>{"클럽이 이미 닫혀 있어요. 오른쪽 신청자가 진짜면 새로 열어 주세요."}</div>}
      </div>
      <div>
        <div style={Object.assign({}, KICK, { marginBottom: 8 })}>{"되찾기 신청"}</div>
        {!d.claims.length && <div style={{ fontSize: 12.5, color: "var(--td)" }}>{"없음 — 신고로 재인증만 걸어 둔 클럽이에요"}</div>}
        {d.claims.map(function (a) {
          return (<div key={a.id} style={{ padding: 12, borderRadius: 10, border: "1px solid var(--bd)", marginBottom: 8 }}>
            <div style={{ marginBottom: 8 }}><b>{a.nickname}</b><span style={{ fontSize: 11.5, color: "var(--td)" }}>{" · " + ago(a.submitted_at)}</span></div>
            {shots(a.shots)}
            <ShotChecks checks={a.checks} />
            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              <Btn sm ok onClick={function () { winClaimant(a); }} disabled={b.busy}>{d.club ? "이 사람이 진짜 → 클럽 다시 열기" : "이 사람으로 새로 열기"}</Btn>
              {d.club && <Btn sm no onClick={function () { winLeader(a); }} disabled={b.busy}>{"기존 클럽장이 진짜"}</Btn>}
            </div>
          </div>);
        })}
      </div>
    </div>
  </Card>);
}

/* 신고 한 건 */
function ReportCard(p) {
  var r = p.r, api = p.api, b = p.b;
  var KIND = { fake_leader: ["가짜 클럽장 의심", "orange"], post: ["글", "blue"], other: ["기타", "gray"] };
  var k = KIND[r.kind] || KIND.other;
  var close = function () { var n = window.prompt("처리 메모 (관리자만 봐요)", "확인함"); if (n === null) return; b.run(async function () { await api.closeReport(r.id, n); await p.after(); }, "처리했어요"); };
  return (<Card style={{ marginBottom: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Tag c={k[1]}>{k[0]}</Tag><b>{r.club ? r.club.name : "(닫힌 클럽)"}</b>
      <span style={{ fontSize: 12, color: "var(--td)" }}>{"클럽장 " + (r.leaderNick || "-") + " · 신고 " + r.reporterNick + " · " + ago(r.created_at)}</span>
    </div>
    {r.reason && <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 8, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{r.reason}</div>}
    {r.kind === "post" && (r.post ? (<div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "var(--inner)", fontSize: 12.5, color: "var(--t2)", lineHeight: 1.6 }}>
      <b style={{ color: "var(--t1)" }}>{r.post.author_name}</b>{" · " + (r.post.title ? r.post.title + " — " : "") + (r.post.body || "").slice(0, 200)}</div>)
      : <div style={{ fontSize: 12, color: "var(--td)", marginTop: 6 }}>{"글은 이미 지워졌어요"}</div>)}
    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
      {r.kind === "fake_leader" && r.club && <Btn sm icon="refresh" onClick={function () { var h = window.prompt("클럽장에게 재인증을 요청합니다. 기한 (시간)", "48"); if (h === null) return; b.run(async function () { await api.requestReverify(r.club_id, parseInt(h, 10) || 48); await api.closeReport(r.id, "재인증 요청"); await p.after(); p.goDispute(); }, "재인증을 요청했어요 — 분쟁 탭에서 이어서 봐요"); }}>{"클럽장 재인증 요청"}</Btn>}
      {r.kind === "post" && r.post && <Btn sm no icon="trash" onClick={function () { if (window.confirm("이 글을 지울까요?")) b.run(async function () { await api.deletePost(r.post); await api.closeReport(r.id, "글 삭제"); await p.after(); }, "글을 지웠어요"); }}>{"글 지우기"}</Btn>}
      {r.club && <Btn sm no onClick={function () { var t = window.prompt("‘" + r.club.name + "’ 클럽을 클럽원·글까지 모두 없애고 클럽장을 신청 제한합니다. 되돌릴 수 없어요. 사유", "신고 확인"); if (t === null) return; b.run(async function () { await api.adminCloseClub(r.club_id, true, t); await p.after(); }, "클럽을 닫았어요"); }}>{"클럽 닫기 + 제한"}</Btn>}
      <Btn sm ok icon="check" onClick={close}>{"처리 끝"}</Btn>
    </div>
  </Card>);
}

/* ── 클럽 화면 ─────────────────────────────────────────── */

/* 클럽장에게 — 관리자가 재인증을 요청했을 때 클럽 화면 맨 위에 뜬다 */
function ReverifyBanner(p) {
  var app = p.app;
  var _open = useState(false); var open = _open[0]; var setOpen = _open[1];
  var left = app.due_at ? (new Date(app.due_at).getTime() - Date.now()) / 3600e3 : null;
  var dueTxt = app.due_at ? fmtWhen(app.due_at) + " 까지" + (left !== null && left < 0 ? " (지났어요)" : left !== null ? " · " + Math.max(1, Math.round(left)) + "시간 남음" : "") : "";
  return (<div style={{ border: "1px solid rgba(255,167,38,.4)", background: "rgba(255,167,38,.07)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Icon n="alert" style={{ color: "#FFA726" }} />
      <b style={{ flex: 1 }}>{app.status === "pending" ? "재인증을 제출했어요 — 관리자가 확인 중이에요" : "관리자가 클럽장 재인증을 요청했어요"}</b>
      {app.status === "draft" && <Btn sm onClick={function () { setOpen(!open); }}>{open ? "접기" : "인증하기"}</Btn>}
    </div>
    <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.7, marginTop: 6 }}>
      {app.status === "pending" ? "확인이 끝나면 이 안내가 사라져요."
        : "같은 이름으로 다른 사람이 클럽장이라고 신청했거나 신고가 들어왔어요. 새 코드로 다시 인증해 주세요. 기한 안에 인증하지 않으면 클럽이 정리될 수 있어요. " + dueTxt}
    </div>
    {open && app.status === "draft" && <div style={{ marginTop: 14 }}><ShotSubmit api={p.api} app={app} onDone={p.reload} reverify /></div>}
  </div>);
}

/* 신고 창 — 클럽(가짜 클럽장 의심·기타)이나 글 */
function ReportModal(p) {
  var ctx = p.ctx;
  /* 클럽 신고는 이유를 직접 고르게 한다 — 예전에는 가장 무거운 '가짜 클럽장'이 미리 골라져 있었다 */
  var _k = useState(p.kind === "post" ? "post" : ""); var kind = _k[0]; var setKind = _k[1];
  var _t = useState(""); var note = _t[0]; var setNote = _t[1];
  var _done = useState(false); var done = _done[0]; var setDone = _done[1];
  var b = useBusy();
  var send = function () {
    b.run(async function () {
      if (!kind) throw new Error("신고 이유를 골라 주세요");
      if (kind !== "fake_leader" && !note.trim()) throw new Error("무엇이 문제인지 한 줄만 적어 주세요");
      await ctx.api.reportClub(ctx.club.id, kind, note.trim(), p.post ? p.post.id : null);
      setDone(true);
    });
  };
  return (<Modal title="신고" sub={p.post ? "글" : ctx.club.name} mobile={ctx.mob} onClose={p.onClose} width={460}
    foot={done ? <Btn pri onClick={p.onClose}>{"닫기"}</Btn> : <React.Fragment><Btn onClick={p.onClose}>{"취소"}</Btn><Btn pri icon="flag" onClick={send} disabled={b.busy}>{"신고하기"}</Btn></React.Fragment>}>
    {done ? (<div style={{ textAlign: "center", padding: "10px 0", lineHeight: 1.7 }}><div style={{ fontSize: 30 }}>{"✅"}</div>
      <b>{"관리자에게 전달했어요"}</b><div style={{ fontSize: 12.5, color: "var(--td)" }}>{"신고한 사람은 클럽장에게 알려지지 않아요."}</div></div>)
    : (<div>
      {p.post ? (<div style={{ fontSize: 12.5, color: "var(--t2)", padding: "10px 12px", borderRadius: 10, background: "var(--inner)", marginBottom: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {(p.post.author_name || "") + " · " + (p.post.title || p.post.body || "")}</div>)
      : (<div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {[["fake_leader", "클럽장이 진짜 인게임 클럽장이 아닌 것 같아요"], ["other", "기타 (광고·욕설·사칭 등)"]].map(function (x) {
          var on = kind === x[0];
          return (<button key={x[0]} type="button" onClick={function () { setKind(x[0]); if (b.err) b.setErr(""); }} style={Object.assign({}, BTN, { justifyContent: "flex-start", padding: "10px 12px", whiteSpace: "normal", textAlign: "left" },
            on ? { borderColor: "var(--acc)", color: "var(--t1)", background: "rgba(255,213,79,.06)" } : null)}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid " + (on ? "var(--acc)" : "var(--bd)"), background: on ? "var(--acc)" : "transparent", flexShrink: 0 }} />{x[1]}</button>);
        })}</div>)}
      <Field label={kind === "fake_leader" ? "덧붙일 말 (선택)" : "무엇이 문제인가요"} area value={note} onChange={function (v) { setNote(v); if (b.err) b.setErr(""); }} max={500} rows={3}
        ph={kind === "fake_leader" ? "예: 인게임 클럽장 닉네임이 달라요" : ""} />
      <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.6 }}>{"신고는 관리자만 봐요. 가짜 클럽장으로 확인되면 클럽이 정리되고, 진짜 클럽장이 다시 열 수 있어요."}</div>
      <Msg text={b.err} />
    </div>)}
  </Modal>);
}

function ClubHome(p) {
  var api = p.api, mob = p.mobile, me = p.me, club = me.club;
  var leader = me.member.role === "leader";
  var _tab = useState("feed"); var tab = _tab[0]; var setTab = _tab[1];
  var _mem = useState([]); var members = _mem[0]; var setMembers = _mem[1];
  var loadMembers = useCallback(async function () { try { setMembers(await api.loadMembers(club.id)); } catch (e) {} }, [club.id]);
  useEffect(function () { loadMembers(); }, [club.id]);
  /* 연구소에서 넘어온 공유·제안은 라운지 탭에서 연다 */
  useEffect(function () { if (p.draft || p.focusPostId) setTab("feed"); }, [p.draft, p.focusPostId]);
  /* 클럽장을 넘기면 클럽장 전용 탭(덱 현황 · 관리)에 머물러 있지 않게 */
  useEffect(function () { if (!leader && (tab === "status" || tab === "manage")) setTab("feed"); }, [leader]);
  var _toast = useState(""); var toast = _toast[0]; var setToast = _toast[1];
  useEffect(function () { if (!toast) return; var t = setTimeout(function () { setToast(""); }, 3500); return function () { clearTimeout(t); }; }, [toast]);
  var active = members.filter(function (m) { return m.status === "active"; });
  var pending = members.filter(function (m) { return m.status === "pending"; });
  /* 가입 신청 수가 바뀌면(읽어 오거나 승인 · 거절하면) 메뉴의 빨간 점도 다시 센다 */
  useEffect(function () { if (p.onAlerts) p.onAlerts(); }, [pending.length]);
  var tabs = [["feed", "라운지"]];
  if (leader) tabs.push(["status", "덱 현황"]);
  tabs.push(["members", "클럽원"]);
  if (leader) tabs.push(["manage", "관리", pending.length]);
  var _rep = useState(null); var report = _rep[0]; var setReport = _rep[1];
  /* 내 정보가 바뀌는 일(클럽장 넘기기 · 닉네임 · 덱 공개)은 클럽원 명단도 같이 새로 읽는다 —
     예전에는 클럽장을 넘긴 뒤에도 '클럽장 ○○ · 나' 가 그대로 남았다 */
  var reloadAll = async function () { await p.reload(); await loadMembers(); };
  var ctx = { api: api, mob: mob, me: me, club: club, leader: leader, members: members, active: active, reloadMembers: loadMembers, reload: reloadAll,
    goTab: setTab, report: function (kind, post) { setReport({ kind: kind, post: post || null }); } };
  var rv = me.app && me.app.kind === "reverify" && (me.app.status === "draft" || me.app.status === "pending") && me.app.target_club_id === club.id ? me.app : null;
  var invite = function () {
    var msg = "[덱 매니저 클럽 라운지] " + club.name + " 초대 코드: " + club.invite_code + "\ndeck-manager.vercel.app → 클럽라운지 → 클럽 가입에 넣어 주세요";
    copyText(msg);
    setToast("초대 안내문을 복사했어요 — 인게임 클럽 채팅에 붙여 넣으세요 (코드 " + club.invite_code + ")");
  };
  return (<div style={{ padding: mob ? "12px 12px 100px" : "22px 26px", maxWidth: 1080 }}>
    {p.title}
    <div style={{ display: "flex", alignItems: "center", gap: mob ? 10 : 14, marginBottom: 14 }}>
      <Emblem name={club.name} size={mob ? 44 : 52} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}><span style={{ fontSize: mob ? 17 : 20, fontWeight: 900, letterSpacing: -.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{club.name}</span><Tag c="acc"><Icon n="shield" size={11} />{"인증"}</Tag></div>
        <div style={{ fontSize: 12, color: "var(--td)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {"클럽원 " + active.length + " / " + club.capacity + " · 클럽장 " + ((active.find(function (m) { return m.role === "leader"; }) || {}).nickname || "")}</div>
      </div>
      {leader && <Btn icon="link" title={"초대 안내문 복사 (코드 " + club.invite_code + ")"} onClick={invite}>{"초대"}</Btn>}
      {!leader && <Btn ghost icon="flag" title="이 클럽이나 클럽장을 관리자에게 신고해요" onClick={function () { ctx.report(""); }}>{"신고"}</Btn>}
    </div>
    {toast && <Msg bad={false} text={toast} />}
    {rv && <ReverifyBanner api={api} app={rv} reload={reloadAll} mobile={mob} />}
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--bd)", marginBottom: 18 }}>
      {tabs.map(function (t) {
        var on = t[0] === tab;
        return (<button key={t[0]} type="button" onClick={function () { setTab(t[0]); }} style={{ padding: mob ? "10px 10px" : "10px 14px", fontSize: 13.5, fontWeight: 600, background: "none", border: "none",
          borderBottom: "2px solid " + (on ? "var(--acc)" : "transparent"), color: on ? "var(--t1)" : "var(--td)", cursor: "pointer", marginBottom: -1, display: "flex", alignItems: "center", gap: 6 }}>
          {t[1]}{t[2] ? <span style={{ minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9, background: "#FF5A5A", color: "#fff", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{t[2]}</span> : null}
        </button>);
      })}
    </div>
    {tab === "feed" && <SafeBox what="라운지"><Feed ctx={ctx} {...p} /></SafeBox>}
    {tab === "status" && leader && <SafeBox what="덱 현황"><DeckStatus ctx={ctx} onOpenLab={p.onOpenLab} /></SafeBox>}
    {tab === "members" && <SafeBox what="클럽원 명단"><Members ctx={ctx} decks={p.decks} curDeckId={p.curDeckId} tools={p.tools} /></SafeBox>}
    {tab === "manage" && leader && <SafeBox what="관리 화면"><Manage ctx={ctx} pending={pending} /></SafeBox>}
    {report && <ReportModal ctx={ctx} kind={report.kind} post={report.post} onClose={function () { setReport(null); }} />}
  </div>);
}

/* ── 라운지 (글) ───────────────────────────────────────── */

var KINDS = { talk: ["자유", "gray"], deck: ["덱 공유", "purple"], question: ["질문", "blue"], poll: ["투표", "blue"], brag: ["자랑", "green"], notice: ["공지", "acc"] };
var EMOJI = [["heart", "❤️"], ["fire", "🔥"], ["eyes", "👀"], ["party", "🎉"], ["clap", "👏"]];

function Feed(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob;
  var _f = useState(null); var feed = _f[0]; var setFeed = _f[1];
  var _flt = useState(""); var flt = _flt[0]; var setFlt = _flt[1];
  var _open = useState(null); var openId = _open[0]; var setOpenId = _open[1];
  var _comp = useState(null); var comp = _comp[0]; var setComp = _comp[1];
  var _ev = useState(null); var ev = _ev[0]; var setEv = _ev[1];
  var _pinAll = useState(false); var pinAll = _pinAll[0]; var setPinAll = _pinAll[1];
  var b = useBusy(), nb = useBusy();
  var feedRef = useRef(null); feedRef.current = feed;
  var fltRef = useRef(flt); fltRef.current = flt;
  var scrollRef = useRef(null);
  var EMPTY = { pinned: [], posts: [], extra: { comments: {}, reactions: {}, votes: {} } };
  /* 말머리는 서버에서 거른다 — 예전에는 불러온 20개 안에서만 찾아 '이 말머리의 글이 아직 없어요'가 잘못 떴다.
     말머리를 빨리 바꾸면 늦게 온 옛 말머리 결과가 새 화면을 덮지 않게, 지금 말머리의 결과만 받는다 */
  var load = useCallback(async function () {
    var my = flt;
    try { b.setErr(""); var r = await api.loadFeed(ctx.club.id, null, my || null); if (fltRef.current !== my) return; setFeed(r); }
    catch (e) { if (fltRef.current !== my) return; b.setErr(e.message); setFeed(EMPTY); }
  }, [ctx.club.id, flt]);
  var loadEv = useCallback(async function () { try { setEv(await api.loadEvents(ctx.club.id)); } catch (e) { setEv({ events: [], rsvps: [] }); } }, [ctx.club.id]);
  useEffect(function () { load(); }, [ctx.club.id, flt]);
  useEffect(function () { loadEv(); }, [ctx.club.id]);
  useEffect(function () {
    if (p.draft) { setComp({ kind: "deck", deck: p.draft.deck }); if (p.onDraftUsed) p.onDraftUsed(); }
  }, [p.draft]);
  useEffect(function () { if (p.focusPostId) { setOpenId(p.focusPostId); if (p.onFocusUsed) p.onFocusUsed(); } }, [p.focusPostId]);
  /* 글 하나만 다시 읽어 그 자리에 넣는다 — 반응 · 투표 · 댓글 뒤에 '더 보기'로 불러온 글이 사라지고 맨 위로 가던 것 */
  var refreshPost = async function (id) {
    if (!id) return;
    try {
      var r = await api.loadPost(id);
      var cur = feedRef.current;
      var has = function (arr) { return arr.some(function (x) { return x.id === id; }); };
      /* 고정이 바뀐 글은 자리가 바뀌므로 통째로 */
      if (r && cur && !flt && ((has(cur.pinned) && !r.post.pinned) || (has(cur.posts) && r.post.pinned))) { load(); return; }
      setFeed(function (f) {
        if (!f) return f;
        var put = function (arr) { return r ? arr.map(function (x) { return x.id === id ? r.post : x; }) : arr.filter(function (x) { return x.id !== id; }); };
        var ex = { comments: Object.assign({}, f.extra.comments), reactions: Object.assign({}, f.extra.reactions), votes: Object.assign({}, f.extra.votes) };
        delete ex.comments[id]; delete ex.reactions[id]; delete ex.votes[id];
        if (r) ["comments", "reactions", "votes"].forEach(function (k) { if (r.extra[k] && r.extra[k][id] !== undefined) ex[k][id] = r.extra[k][id]; });
        return Object.assign({}, f, { pinned: put(f.pinned), posts: put(f.posts), extra: ex });
      });
    } catch (e) { load(); }
  };
  var more = function () {
    var last = feed && feed.posts[feed.posts.length - 1];
    if (!last) return;
    var my = flt;
    b.run(async function () {
      var r = await api.loadFeed(ctx.club.id, last.created_at, my || null);
      if (fltRef.current !== my) return;
      setFeed(function (f) {
        if (!f) return f;
        return { pinned: f.pinned, posts: f.posts.concat(r.posts), more: r.more,
          extra: { comments: Object.assign({}, f.extra.comments, r.extra.comments), reactions: Object.assign({}, f.extra.reactions, r.extra.reactions), votes: Object.assign({}, f.extra.votes, r.extra.votes) } };
      });
    });
  };
  /* 글을 열 때 목록 위치를 기억했다가, 돌아오면 그 자리로 (휴대폰 뒤로가기로도 닫힌다) */
  var openPost = function (id) { scrollRef.current = window.scrollY || 0; setOpenId(id); try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ } };
  var closePost = function () { var id = openId; setOpenId(null); refreshPost(id); };
  useBackClose(!!openId, closePost);
  useEffect(function () {
    if (openId || scrollRef.current === null) return;
    var y = scrollRef.current; scrollRef.current = null;
    requestAnimationFrame(function () { try { window.scrollTo(0, y); } catch (e) { /* 무시 */ } });
  }, [openId]);
  /* 덱을 아직 공개하지 않은 사람에게 — 클럽장의 '덱 현황'은 공개해야 보인다. 닫으면 2주 동안 안 띄운다 */
  var nudgeKey = "club-share-nudge-" + ctx.club.id + "-" + ctx.me.uid;
  var _nudge = useState(function () { try { return Date.now() - Number(localStorage.getItem(nudgeKey) || 0) > 14 * 864e5; } catch (e) { return true; } });
  var curDeck = (p.decks || []).find(function (d) { return d.deckId === p.curDeckId; });
  var showNudge = _nudge[0] && !ctx.me.member.share_deck_id && !!p.curDeckId && !!(p.tools && p.tools.publishNow);
  var hideNudge = function () { try { localStorage.setItem(nudgeKey, String(Date.now())); } catch (e) { /* 무시 */ } _nudge[1](false); };
  var shareNow = function () {
    nb.run(async function () {
      await api.setShare(p.curDeckId);
      await p.tools.publishNow();
      await ctx.reload();
    }, "공개했어요. 덱을 바꿀 때마다 요약본이 새로 올라가요 (공개 설정은 클럽원 탭에서 바꿀 수 있어요)");
  };
  var composer = comp && (<Composer ctx={ctx} init={comp} tools={p.tools} labSaves={p.labSaves} onClose={function () { setComp(null); }}
    onDone={function () { setComp(null); if (flt) { setFeed(null); setFlt(""); } else load(); }} />);
  var postProps = { ctx: ctx, onOpen: openPost, onChanged: load, onPostChanged: refreshPost, onOpenLab: p.onOpenLab, tools: p.tools };
  var list = feed ? feed.posts : [];
  var notices = feed ? feed.pinned : [];
  var shown = pinAll ? notices : notices.slice(0, 3);
  var Week = (<SafeBox what="일정"><EventsBox ctx={ctx} ev={ev} reload={loadEv} /></SafeBox>);
  var main = (<div style={{ minWidth: 0 }}>
    <Safe fallback={function () { return null; }}>
      {shown.map(function (n) {
        return (<div key={n.id} onClick={function () { openPost(n.id); }} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 16px", borderRadius: 14, cursor: "pointer",
          background: "linear-gradient(90deg,rgba(255,213,79,.10),rgba(255,213,79,.02))", border: "1px solid rgba(255,213,79,.2)", marginBottom: 10 }}>
          <Icon n="pin" style={{ color: "var(--acc)", marginTop: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800 }}>{txt(n.title) || txt(n.body).slice(0, 40)}</div>
            {txt(n.title) && txt(n.body) && <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txt(n.body)}</div>}</div>
          <span style={{ fontSize: 11, color: "var(--td)", whiteSpace: "nowrap" }}>{(KINDS[n.kind] || KINDS.talk)[0] + " · " + txt(n.author_name)}</span>
        </div>);
      })}
      {notices.length > 3 && (<button type="button" onClick={function () { setPinAll(!pinAll); }} style={{ display: "block", width: "100%", padding: "8px 0", marginBottom: 10, background: "none", border: "1px dashed rgba(255,213,79,.3)", borderRadius: 10, color: "var(--acc)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        {pinAll ? "고정 글 접기 ▴" : "고정 글 " + (notices.length - 3) + "개 더 보기 ▾"}</button>)}
    </Safe>
    {showNudge && (<div style={{ display: "flex", alignItems: mob ? "stretch" : "center", flexDirection: mob ? "column" : "row", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid rgba(108,184,255,.28)", background: "rgba(108,184,255,.06)", marginBottom: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 13.5 }}>{"내 덱이 아직 클럽에 공개되지 않았어요"}</div>
        <div style={{ fontSize: 12, color: "var(--td)", marginTop: 3, lineHeight: 1.6 }}>{ctx.leader
          ? "공개하면 '덱 현황'에 내 덱도 함께 보여요. 선수 능력치 · 훈련 값은 올라가지 않아요."
          : "공개하면 클럽장이 '덱 현황'에서 내 라인업 요약(TOTAL · 세트덱)을 봐요. 선수 능력치 · 훈련 값은 올라가지 않아요."}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0, justifyContent: mob ? "flex-end" : "flex-start" }}>
        <Btn sm ghost onClick={hideNudge} title="2주 동안 안 띄워요">{"나중에"}</Btn>
        <Btn sm pri onClick={shareNow} disabled={nb.busy}>{nb.busy ? "공개하는 중…" : (curDeck && curDeck.teamName ? "지금 덱(" + curDeck.teamName + ") 공개" : "지금 덱 공개")}</Btn>
      </div>
    </div>)}
    <Msg text={nb.err} /><Msg bad={false} text={nb.ok} />
    {mob && Week}
    <Card style={{ marginBottom: 12 }}>
      <div onClick={function () { setComp({ kind: "talk" }); }} style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
        <Avatar name={ctx.me.member.nickname} />
        <div style={Object.assign({}, INP, { color: "var(--td)", borderRadius: 20 })}>{"클럽원에게 한마디 남기기…"}</div>
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 8, paddingLeft: mob ? 0 : 42, flexWrap: "wrap" }}>
        <Btn ghost icon="deck" onClick={function () { setComp({ kind: "deck" }); }}>{"덱 붙이기"}</Btn>
        <Btn ghost icon="img" onClick={function () { setComp({ kind: "talk", pickImage: true }); }}>{"사진"}</Btn>
        <Btn ghost icon="poll" onClick={function () { setComp({ kind: "poll" }); }}>{"투표"}</Btn>
        {ctx.leader && <Btn ghost icon="pin" onClick={function () { setComp({ kind: "notice" }); }}>{"공지"}</Btn>}
      </div>
    </Card>
    {/* 말머리는 한 줄 — 휴대폰에서 넘치면 옆으로 밀어 본다 (새로 보기 버튼이 혼자 다음 줄로 떨어지지 않게) */}
    <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
      <div className="club-chips" style={{ display: "flex", gap: 6, flex: 1, minWidth: 0, overflowX: "auto" }}>
        {[["", "전체"], ["deck", "덱 공유"], ["question", "질문"], ["poll", "투표"], ["brag", "자랑"], ["talk", "자유"]].map(function (x) {
          var on = flt === x[0];
          return (<button key={x[0]} type="button" onClick={function () { if (x[0] !== flt) { setFeed(null); setFlt(x[0]); } }} style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
            background: on ? "rgba(255,213,79,.14)" : "var(--inner)", color: on ? "var(--acc)" : "var(--t2)" }}>{x[1]}</button>);
        })}
      </div>
      <Btn sm ghost icon="refresh" style={{ flexShrink: 0 }} onClick={function () { load(); loadEv(); }} title="새로 보기" />
    </div>
    <Msg text={b.err} />
    {!feed ? <div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div>
      : !list.length ? (flt ? <Card style={{ textAlign: "center", color: "var(--td)", fontSize: 13, padding: 30 }}>{"이 말머리의 글이 아직 없어요"}</Card>
        : notices.length ? <div style={{ textAlign: "center", color: "var(--td)", fontSize: 12.5, padding: "16px 0" }}>{"고정 글 말고는 아직 글이 없어요"}</div>
        : <Card style={{ textAlign: "center", color: "var(--td)", fontSize: 13, padding: 30 }}>{"첫 글을 남겨 보세요 👋"}</Card>)
      : list.map(function (x) {
        return (<Safe key={x.id} fallback={function () { return <BadPost ctx={ctx} post={x} onDelete={async function () { await api.deletePost(x); load(); }} />; }}>
          <PostCard post={x} extra={feed.extra} {...postProps} /></Safe>);
      })}
    {feed && feed.more && <div style={{ textAlign: "center", margin: "8px 0" }}><Btn onClick={more} disabled={b.busy}>{b.busy ? "불러오는 중…" : "더 보기"}</Btn></div>}
  </div>);
  /* 글을 보는 동안에도 목록은 숨겨 둔 채 남겨 둔다 — 다시 그리면 사진이 늦게 들어와 높이가 바뀌어
     돌아왔을 때 보던 자리가 어긋났다. 펼쳐 둔 덱 · 불러온 사진도 그대로 남는다 */
  return (<React.Fragment>
    {openId && <PostDetail ctx={ctx} postId={openId} onBack={closePost} onOpenLab={p.onOpenLab} tools={p.tools} />}
    <div style={{ display: openId ? "none" : "block" }}>
      {mob ? main : (<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 290px", gap: 18, alignItems: "start" }}>{main}<div style={{ position: "sticky", top: 16 }}>{Week}</div></div>)}
    </div>
    {composer}
  </React.Fragment>);
}

/* 그리다 깨진 글 · 댓글 — 내용 대신 짧은 안내만. 쓴 사람이나 클럽장은 여기서 지울 수 있다 */
function BadPost(p) {
  var ctx = p.ctx, x = p.post || {};
  var b = useBusy();
  var what = p.what || "글";
  var can = x.author_id === ctx.me.uid || ctx.leader;
  return (<Card style={{ marginBottom: 12 }} pad="12px 16px">
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon n="alert" style={{ color: "#FFA726" }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: "var(--t2)" }}>{"이 " + what + "은 표시할 수 없어요" + (txt(x.author_name) ? " · " + txt(x.author_name) : "")}</div>
      {can && p.onDelete && <Btn sm no icon="trash" disabled={b.busy} onClick={function () { if (window.confirm("이 " + what + "을 지울까요?")) b.run(p.onDelete); }}>{"지우기"}</Btn>}
    </div>
    <Msg text={b.err} />
  </Card>);
}

function EventsBox(p) {
  var ctx = p.ctx, ev = p.ev;
  var b = useBusy();
  var _who = useState(null); var who = _who[0]; var setWho = _who[1];
  if (!ev) return null;
  if (!ev.events.length && !ctx.leader) return null;
  /* 지금 클럽원의 참여만 센다 — 내보낸 사람 것까지 세어 '23/22 참여' 가 되던 것. 누르면 누가 참여하는지 보인다.
     내 참여 표시는 명단과 상관없이 본다 (명단이 늦게 오거나 못 읽어도 '참여'가 그대로 보이고 취소할 수 있게).
     명단을 아직 못 읽었으면 예전처럼 전부 센다 */
  var act = {}; ctx.active.forEach(function (m) { act[m.user_id] = m; });
  var known = ctx.active.length > 0;
  var mine = {}; var names = {};
  ev.rsvps.forEach(function (r) {
    if (r.user_id === ctx.me.uid) mine[r.event_id] = 1;
    if (known && !act[r.user_id]) return;
    (names[r.event_id] = names[r.event_id] || []).push(act[r.user_id] ? act[r.user_id].nickname : "클럽원");
  });
  var W = ["일", "월", "화", "수", "목", "금", "토"];
  return (<Card style={{ marginBottom: 12 }} pad="14px 16px">
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><Icon n="cal" style={{ color: "var(--t2)" }} /><b>{"일정"}</b></div>
    {!ev.events.length && <div style={{ fontSize: 12, color: "var(--td)", padding: "6px 0" }}>{"관리 탭에서 클럽전 같은 일정을 만들 수 있어요"}</div>}
    {ev.events.map(function (e) {
      var d = new Date(e.starts_at); var on = !!mine[e.id];
      var list = names[e.id] || [];
      return (<div key={e.id} style={{ padding: "8px 0", borderTop: "1px solid var(--bd)" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 38, textAlign: "center" }}><div style={{ fontSize: 10.5, color: "var(--td)" }}>{(d.getMonth() + 1) + "/" + d.getDate()}</div><div style={{ fontWeight: 800 }}>{W[d.getDay()]}</div></div>
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txt(e.title)}</div>
            <button type="button" onClick={function () { setWho(who === e.id ? null : e.id); }} title="누가 참여하는지 보기"
              style={{ background: "none", border: "none", padding: "7px 0", margin: "-3px 0", color: "var(--td)", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
              {String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + " · " + list.length + (known ? "/" + ctx.active.length : "") + "명 참여 " + (who === e.id ? "▴" : "▾")}</button></div>
          <Btn sm ok={on} icon={on ? "check" : null} onClick={function () { b.run(async function () { await ctx.api.setRsvp(e, !on); await p.reload(); }); }}>{on ? "참여" : "참여하기"}</Btn>
        </div>
        {who === e.id && <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.7, margin: "4px 0 0 48px" }}>{list.length ? list.join(" · ") : "아직 참여한 사람이 없어요"}</div>}
      </div>);
    })}
    <Msg text={b.err} />
  </Card>);
}

function PostHead(p) {
  var x = p.post, k = KINDS[x.kind] || KINDS.talk;
  var ctx = p.ctx;
  var mine = x.author_id === ctx.me.uid;
  var isLeaderAuthor = ctx.active.some(function (m) { return m.user_id === x.author_id && m.role === "leader"; });
  return (<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <Avatar name={txt(x.author_name)} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><b>{txt(x.author_name) || "떠난 클럽원"}</b>{isLeaderAuthor && <Tag c="acc">{"클럽장"}</Tag>}<Tag c={k[1]}>{k[0]}</Tag>{x.pinned && <Tag c="acc"><Icon n="pin" size={10} />{"고정"}</Tag>}</div>
      <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 1 }}>{ago(x.created_at) + (x.deck && x.deck.src === "lab" ? " · 덱 연구소에서" : "")}</div>
    </div>
    {p.onMenu && <PostMenu {...p} mine={mine} />}
  </div>);
}
function PostMenu(p) {
  var _o = useState(false); var o = _o[0]; var setO = _o[1];
  var ctx = p.ctx, x = p.post;
  var b = useBusy();
  var act = function (fn) { setO(false); b.run(fn); };
  return (<div style={{ position: "relative" }}>
    {/* 손가락으로 누르기 쉽게 누르는 자리를 넓힌다 (예전 22×24) */}
    <button type="button" aria-label="글 메뉴" title="글 메뉴" onClick={function (e) { e.stopPropagation(); setO(!o); }} style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", padding: "9px 11px", margin: "-9px -9px -9px 0", fontSize: 18, lineHeight: 1, minWidth: 40, minHeight: 40 }}>{"⋯"}</button>
    {o && (<React.Fragment><div onClick={function (e) { e.stopPropagation(); setO(false); }} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div onClick={function (e) { e.stopPropagation(); }} style={Object.assign({}, CARD, { position: "absolute", right: 0, top: 34, zIndex: 51, background: "var(--bg)", padding: 4, minWidth: 140, boxShadow: "0 8px 30px rgba(0,0,0,.4)" })}>
        {ctx.leader && <MenuItem onClick={function () { act(async function () { await ctx.api.pinPost(x.id, !x.pinned); p.onMenu(); }); }}>{x.pinned ? "고정 풀기" : "맨 위에 고정"}</MenuItem>}
        {(p.mine || ctx.leader) && <MenuItem red onClick={function () { if (window.confirm("이 글을 지울까요?" + (p.mine ? "" : " (클럽장 권한)"))) act(async function () { await ctx.api.deletePost(x); p.onMenu(true); }); }}>{"지우기"}</MenuItem>}
        {!p.mine && <MenuItem onClick={function () { setO(false); ctx.report("post", x); }}>{"신고"}</MenuItem>}
      </div></React.Fragment>)}
    {b.err && <div style={{ position: "absolute", right: 0, top: 34, width: 200, zIndex: 52 }}><Msg text={b.err} /></div>}
  </div>);
}
function MenuItem(p) {
  return (<button type="button" onClick={p.onClick} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13.5, color: p.red ? "#FF6B6B" : "var(--t1)", fontFamily: "inherit" }}>{p.children}</button>);
}

/* 글 사진 — 누르면 새 창 대신 이 화면 위에서 크게 */
function MediaGrid(p) {
  var paths = Array.isArray(p.paths) ? p.paths.filter(function (s) { return typeof s === "string" && s; }) : [];
  var _u = useState({}); var u = _u[0]; var setU = _u[1];
  var _z = useState(null); var zoom = _z[0]; var setZoom = _z[1];
  useEffect(function () { var live = true; if (paths.length) p.api.mediaUrls(paths).then(function (m) { if (live) setU(m || {}); }).catch(function () {}); return function () { live = false; }; }, [paths.join("|")]);
  if (!paths.length) return null;
  var n = paths.length;
  return (<div style={{ display: "grid", gridTemplateColumns: n === 1 ? "1fr" : "1fr 1fr", gap: 6, marginTop: 10 }}>
    {paths.map(function (s) {
      return (<button key={s} type="button" title="크게 보기" onClick={function (e) { e.stopPropagation(); if (u[s]) setZoom(u[s]); }} style={{ display: "block", width: "100%", padding: 0, border: "none", cursor: "zoom-in", borderRadius: 10, overflow: "hidden", background: "var(--inner)", aspectRatio: n === 1 ? "auto" : "1", maxHeight: n === 1 ? 420 : "none" }}>
        {u[s] && <img src={u[s]} alt="" style={{ width: "100%", height: "100%", objectFit: n === 1 ? "contain" : "cover", display: "block", maxHeight: n === 1 ? 420 : "none" }} />}</button>);
    })}
    {zoom && <Viewer url={zoom} onClose={function () { setZoom(null); }} />}</div>);
}

function Poll(p) {
  var x = p.post, ctx = p.ctx, votes = Array.isArray(p.votes) ? p.votes : [];
  var opts = x.poll && Array.isArray(x.poll.options) ? x.poll.options : [];
  var closeAt = x.poll ? new Date(txt(x.poll.closes_at)).getTime() : NaN;
  var hasClose = isFinite(closeAt);
  var closed = hasClose && closeAt < Date.now();
  var mine = votes.find(function (v) { return v.user_id === ctx.me.uid; });
  var b = useBusy();
  var total = votes.length;
  var pick = function (i, e) {
    e.stopPropagation();
    /* 화면을 켜 둔 사이 마감됐을 수 있어 누르는 순간 다시 본다 */
    if (closed || (hasClose && closeAt < Date.now())) { b.setErr("마감된 투표예요"); return; }
    b.run(async function () { await ctx.api.vote(x, mine && mine.choice === i ? null : i); p.onChanged(); });
  };
  return (<div style={{ marginTop: 10 }}>
    {opts.map(function (o, i) {
      var n = votes.filter(function (v) { return v.choice === i; }).length;
      var pct = total ? Math.round(n / total * 100) : 0;
      var me = mine && mine.choice === i;
      return (<div key={i} onClick={function (e) { pick(i, e); }} style={{ position: "relative", border: "1px solid " + (me ? "rgba(255,213,79,.45)" : "var(--bd)"), borderRadius: 10, padding: "11px 12px", marginBottom: 6, overflow: "hidden", cursor: closed ? "default" : "pointer" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pct + "%", background: me ? "rgba(255,213,79,.12)" : "var(--inner)" }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontWeight: me ? 800 : 500, minWidth: 0, wordBreak: "break-word" }}>{me && <Icon n="check" style={{ color: "var(--acc)", marginRight: 4 }} />}{txt(o) || "(표시할 수 없는 선택지)"}</span>
          <span style={{ fontFamily: "var(--m)", color: "var(--td)", fontSize: 12, whiteSpace: "nowrap" }}>{n + "명 · " + pct + "%"}</span>
        </div></div>);
    })}
    <div style={{ fontSize: 11.5, color: "var(--td)" }}>{total + "명 참여" + (hasClose ? (closed ? " · 마감됨" : " · " + fmtWhen(closeAt) + " 마감") : "") + (mine && !closed ? " · 다시 누르면 취소" : "")}</div>
    <Msg text={b.err} />
  </div>);
}

function Reactions(p) {
  var x = p.post, ctx = p.ctx, list = Array.isArray(p.list) ? p.list : [];
  var _pick = useState(false); var pick = _pick[0]; var setPick = _pick[1];
  var b = useBusy();
  var cnt = {}, mine = {};
  list.forEach(function (r) { cnt[r.emoji] = (cnt[r.emoji] || 0) + 1; if (r.user_id === ctx.me.uid) mine[r.emoji] = 1; });
  var toggle = function (k, e) { e.stopPropagation(); setPick(false); b.run(async function () { await ctx.api.setReaction(x, k, !mine[k]); p.onChanged(); }); };
  /* 휴대폰에서 누르기 쉽게 버튼 높이를 30px 안팎으로 */
  var chip = { padding: "5px 10px", borderRadius: 14, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", minHeight: 30 };
  return (<div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
    <button type="button" onClick={function (e) { toggle("heart", e); }} style={{ display: "flex", gap: 5, alignItems: "center", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, padding: "6px 6px", minHeight: 32, color: mine.heart ? "#FF6B6B" : "var(--td)", fontFamily: "inherit" }}>
      <Icon n="heart" fill={mine.heart ? "#FF6B6B" : "none"} />{cnt.heart || 0}</button>
    <button type="button" onClick={function (e) { e.stopPropagation(); p.onOpen && p.onOpen(); }} style={{ display: "flex", gap: 5, alignItems: "center", background: "none", border: "none", cursor: "pointer", fontSize: 12.5, padding: "6px 6px", minHeight: 32, color: "var(--td)", fontFamily: "inherit" }}>
      <Icon n="chat" />{"댓글 " + (p.comments || 0)}</button>
    {EMOJI.slice(1).filter(function (e) { return cnt[e[0]]; }).map(function (e) {
      return (<button key={e[0]} type="button" onClick={function (ev) { toggle(e[0], ev); }} style={Object.assign({}, chip, {
        border: "1px solid " + (mine[e[0]] ? "rgba(255,213,79,.45)" : "var(--bd)"), background: mine[e[0]] ? "rgba(255,213,79,.1)" : "transparent", color: "var(--t2)" })}>{e[1] + " " + cnt[e[0]]}</button>);
    })}
    <button type="button" title="반응 남기기" onClick={function (e) { e.stopPropagation(); setPick(!pick); }} style={Object.assign({}, chip, { border: "1px dashed var(--bd)", background: "transparent", color: "var(--td)" })}>{"+ 😊"}</button>
    {pick && (<div onClick={function (e) { e.stopPropagation(); }} style={Object.assign({}, CARD, { position: "absolute", left: 0, top: 38, zIndex: 20, background: "var(--bg)", padding: 4, display: "flex", gap: 2, boxShadow: "0 8px 30px rgba(0,0,0,.35)" })}>
      {EMOJI.slice(1).map(function (e) { return (<button key={e[0]} type="button" onClick={function (ev) { toggle(e[0], ev); }} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer", padding: "6px 8px" }}>{e[1]}</button>); })}
    </div>)}
    {b.err && <span style={{ fontSize: 11.5, color: "#FF6B6B" }}>{b.err}</span>}
  </div>);
}

function DeckActions(p) {
  var x = p.post, ctx = p.ctx, mob = ctx.mob;
  var _cmp = useState(false); var cmp = _cmp[0]; var setCmp = _cmp[1];
  var mine = x.author_id === ctx.me.uid;
  var canCopy = x.allow_copy || mine;
  var my = cmp && p.tools && p.tools.summaryNow ? p.tools.summaryNow() : null;
  return (<React.Fragment>
    {canCopy && <Btn ghost purple icon="flask" onClick={function (e) { p.onOpenLab(x.deck, { mode: "open" }); }}>{mob ? "연구소로" : "연구소에서 열기"}</Btn>}
    {p.tools && p.tools.summaryNow && <Btn ghost icon="swap" onClick={function () { setCmp(true); }}>{mob ? "비교" : "내 덱과 비교"}</Btn>}
    {p.suggest && canCopy && !mine && <Btn ghost icon="swap" purple onClick={function () { p.onOpenLab(x.deck, { mode: "suggest", post: x }); }}>{"수정 제안"}</Btn>}
    {cmp && (<Modal title="내 덱과 비교" mobile={mob} onClose={function () { setCmp(false); }} width={620}>
      {my && my.deck ? <DeckCompare a={x.deck} b={my.deck} aName={txt(x.author_name) + " · " + txt(x.deck.team)} bName={"내 덱 · " + txt(my.deck.team)} />
        : <div style={{ color: "var(--td)", fontSize: 13 }}>{"지금 열린 덱이 비어 있어요"}</div>}
    </Modal>)}
  </React.Fragment>);
}

function PostCard(p) {
  var x = p.post, ctx = p.ctx, ex = p.extra || {};
  var body = txt(x.body), title = txt(x.title);
  var long = body.length > 280;
  /* 반응 · 투표는 이 글만 다시 읽는다 (목록이 처음으로 돌아가지 않게) */
  var changed = function () { if (p.onPostChanged) p.onPostChanged(x.id); else p.onChanged(); };
  return (<Card style={{ marginBottom: 12, cursor: "pointer" }}>
    <div onClick={function () { p.onOpen(x.id); }}>
      <PostHead post={x} ctx={ctx} onMenu={function () { p.onChanged(); }} />
      {title && <div style={{ fontSize: 15, fontWeight: 800, marginTop: 12, letterSpacing: -.3, wordBreak: "break-word" }}>{title}</div>}
      {body && <div style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 6, color: "var(--t2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{long ? body.slice(0, 280) + "… 더 보기" : body}</div>}
    </div>
    {x.kind === "poll" && <Poll post={x} ctx={ctx} votes={(ex.votes || {})[x.id]} onChanged={changed} />}
    <MediaGrid api={ctx.api} paths={x.images} />
    {x.deck && <DeckBox deck={x.deck} mobile={ctx.mob} actions={<DeckActions post={x} ctx={ctx} onOpenLab={p.onOpenLab} tools={p.tools} />} />}
    <Reactions post={x} ctx={ctx} list={(ex.reactions || {})[x.id]} comments={(ex.comments || {})[x.id]} onChanged={changed} onOpen={function () { p.onOpen(x.id); }} />
  </Card>);
}

/* 수정 제안 한 건. 점수는 덱 연구소 기준이라 글의 TOTAL SCORE 와 다르다 — 바뀐 폭을 크게, 기준을 글로 밝힌다 */
function Suggestion(p) {
  var s = p.s && typeof p.s === "object" ? p.s : {};
  var ch = Array.isArray(s.changes) ? s.changes.filter(function (c) { return c && typeof c === "object"; }) : [];
  var card = function (e) { return e && typeof e === "object" ? e : null; };
  var bf = Array.isArray(s.before) ? Number(s.before[0]) : NaN, af = Array.isArray(s.after) ? Number(s.after[0]) : NaN;
  var hasScore = isFinite(bf) && isFinite(af);
  var dlt = hasScore ? af - bf : 0;
  return (<div style={{ marginTop: 8, border: "1px solid rgba(206,147,216,.3)", background: "rgba(206,147,216,.05)", borderRadius: 10, padding: "10px 12px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "var(--acp)", fontSize: 12 }}><Icon n="swap" />{"수정 제안 · " + ch.length + "자리"}</div>
    <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.9 }}>
      {ch.map(function (c, i) {
        var f = card(c.from), t = card(c.to);
        return (<div key={txt(c.slot) || i} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ fontFamily: "var(--h)", fontSize: 11, color: "var(--td)", width: 30, display: "inline-block" }}>{txt(c.slot)}</span>
          {f ? <span style={{ color: CT_COL[txt(f.ct)], textDecoration: "line-through", opacity: .6 }}>{(txt(f.l) ? txt(f.l) + " " : "") + txt(f.n)}</span> : <span style={{ color: "var(--td)" }}>{"빈 자리"}</span>}
          {" → "}
          {t ? <span style={{ color: CT_COL[txt(t.ct)] }}>{(txt(t.l) ? txt(t.l) + " " : "") + txt(t.n)}</span> : <span style={{ color: "var(--td)" }}>{"비움"}</span>}
        </div>);
      })}
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 12, flexWrap: "wrap" }}>
      {hasScore && (<span title="덱 연구소(상위 0.1% 훈련 가정)로 센 점수예요. 글에 보이는 TOTAL SCORE 와는 계산 기준이 달라요" style={{ display: "inline-flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--m)", fontWeight: 800, fontSize: 13.5, color: dlt >= 0 ? "#4CAF50" : "#FF6B6B" }}>{(dlt >= 0 ? "▲ " : "▼ ") + num(Math.abs(dlt))}</span>
        <span style={{ color: "var(--td)", fontSize: 11.5 }}>{"연구소 기준 점수 " + num(bf) + " → " + num(af)}</span></span>)}
      {s.deck && typeof s.deck === "object" && <Btn sm ghost purple icon="flask" style={{ marginLeft: "auto" }} onClick={function () { p.onOpenLab(s.deck, { mode: "open" }); }}>{"적용해서 열기"}</Btn>}
    </div>
  </div>);
}

function PostDetail(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob;
  var _d = useState(null); var d = _d[0]; var setD = _d[1];
  var _cm = useState([]); var cms = _cm[0]; var setCms = _cm[1];
  var _msg = useState(""); var msg = _msg[0]; var setMsg = _msg[1];
  var b = useBusy();
  var load = async function () {
    try {
      var r = await api.loadPost(p.postId);
      if (!r) { b.setErr("지워졌거나 볼 수 없는 글이에요"); setD(false); return; }
      setD(r); setCms(await api.loadComments(p.postId));
    } catch (e) { b.setErr(e.message); setD(false); }
  };
  useEffect(function () { load(); }, [p.postId]);
  var send = function () {
    if (!msg.trim()) return;
    b.run(async function () { await api.addComment(d.post, msg.trim()); setMsg(""); await load(); });
  };
  var back = (<button type="button" onClick={p.onBack} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "8px 10px 8px 0", marginBottom: 4, minHeight: 36, display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit" }}><Icon n="back" size={15} />{"라운지로"}</button>);
  if (!d) return (<div>{back}{d === false ? <Msg text={b.err} /> : <div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div>}</div>);
  var x = d.post;
  var ex = d.extra || {};
  return (<div style={{ maxWidth: 760 }}>
    {back}
    <Safe fallback={function () { return <BadPost ctx={ctx} post={x} onDelete={async function () { await api.deletePost(x); p.onBack(); }} />; }}>
    <Card style={{ borderRadius: "14px 14px 0 0" }}>
      <PostHead post={x} ctx={ctx} onMenu={function (gone) { if (gone) p.onBack(); else load(); }} />
      {txt(x.title) && <div style={{ fontSize: 16, fontWeight: 800, marginTop: 12, letterSpacing: -.3, wordBreak: "break-word" }}>{txt(x.title)}</div>}
      {txt(x.body) && <div style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 6, color: "var(--t2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{txt(x.body)}</div>}
      {x.kind === "poll" && <Poll post={x} ctx={ctx} votes={(ex.votes || {})[x.id]} onChanged={load} />}
      <MediaGrid api={api} paths={x.images} />
      {x.deck && <DeckBox deck={x.deck} mobile={mob} actions={<DeckActions post={x} ctx={ctx} onOpenLab={p.onOpenLab} tools={p.tools} suggest />} />}
      <Reactions post={x} ctx={ctx} list={(ex.reactions || {})[x.id]} comments={cms.length} onChanged={load} />
    </Card>
    </Safe>
    <Card style={{ borderTop: "none", borderRadius: "0 0 14px 14px", paddingTop: 4 }}>
      {cms.map(function (c) {
        var mine = c.author_id === ctx.me.uid;
        return (<Safe key={c.id} fallback={function () { return <BadPost ctx={ctx} post={c} what="댓글" onDelete={async function () { await api.deleteComment(c.id); await load(); }} />; }}>
          <div style={{ display: "flex", gap: 10, padding: "12px 0", borderTop: "1px solid var(--bd)" }}>
          <Avatar name={txt(c.author_name)} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}><b>{txt(c.author_name) || "떠난 클럽원"}</b><span style={{ fontSize: 11.5, color: "var(--td)" }}>{ago(c.created_at)}</span>
              {(mine || ctx.leader) && <button type="button" onClick={function () { if (window.confirm("댓글을 지울까요?" + (mine ? "" : " (클럽장 권한)"))) b.run(async function () { await api.deleteComment(c.id); await load(); }); }}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 12, padding: "6px 8px", margin: "-6px -8px -6px auto", fontFamily: "inherit" }}>{"지우기"}</button>}</div>
            {txt(c.body) && <div style={{ color: "var(--t2)", marginTop: 3, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{txt(c.body)}</div>}
            {c.suggestion && <Suggestion s={c.suggestion} ctx={ctx} onOpenLab={p.onOpenLab} />}
          </div>
        </div></Safe>);
      })}
      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 12, borderTop: cms.length ? "1px solid var(--bd)" : "none" }}>
        <Avatar name={ctx.me.member.nickname} size={28} />
        <input value={msg} onChange={function (e) { setMsg(e.target.value); if (b.err) b.setErr(""); }} maxLength={1000} placeholder="댓글 달기…" onKeyDown={function (e) { if (e.key === "Enter" && !e.nativeEvent.isComposing) send(); }}
          style={Object.assign({}, INP, { borderRadius: 18, flex: 1, width: 0 })} />
        <Btn pri icon="send" onClick={send} disabled={b.busy || !msg.trim()} style={{ borderRadius: "50%", padding: 9, minWidth: 38, minHeight: 38 }} title="보내기" />
      </div>
      {x.deck && x.author_id !== ctx.me.uid && (x.allow_copy) && <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 8 }}>{"덱을 고쳐 제안하려면 위의 ‘수정 제안’ — 덱 연구소에서 바꾼 뒤 보내면 댓글로 붙어요"}</div>}
      <Msg text={b.err} />
    </Card>
  </div>);
}

/* 글쓰기 창 */
function Composer(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob, tools = p.tools || {};
  var init = p.init || {};
  var _k = useState(init.kind || "talk"); var kind = _k[0]; var setKind = _k[1];
  var _t = useState(""); var title = _t[0]; var setTitle = _t[1];
  var _b = useState(""); var body = _b[0]; var setBody = _b[1];
  var _d = useState(init.deck || null); var deck = _d[0]; var setDeck = _d[1];
  var _o = useState(["", ""]); var opts = _o[0]; var setOpts = _o[1];
  var _cl = useState(3); var closeDays = _cl[0]; var setCloseDays = _cl[1];
  var _f = useState([]); var files = _f[0]; var setFiles = _f[1];
  var _cp = useState(true); var allowCopy = _cp[0]; var setAllowCopy = _cp[1];
  var b = useBusy();
  /* 고치는 대로 앞의 오류 문구는 지운다 (고친 뒤에도 '내용을 넣어 주세요'가 남아 있던 것) */
  useEffect(function () { if (b.err) b.setErr(""); }, [kind, title, body, deck, files.length, opts.join("\u0001")]);
  var fileRef = React.useRef(null);
  useEffect(function () { if (init.pickImage && fileRef.current) fileRef.current.click(); }, []);
  var kinds = ["talk", "deck", "question", "poll", "brag"].concat(ctx.leader ? ["notice"] : []);
  var saves = (p.labSaves || []).map(function (s, i) { return s ? { i: i, s: s } : null; }).filter(Boolean);
  var attachNow = function () {
    var s = tools.summaryNow && tools.summaryNow();
    if (!s || !s.filled) { b.setErr("지금 열린 덱에 선수가 없어요"); return; }
    setDeck(s.deck); b.setErr("");
  };
  var attachLab = function (x) {
    b.run(async function () {
      if (!tools.labDeck) throw new Error("연구소 덱을 붙일 수 없어요");
      setDeck(await tools.labDeck(x.s.team, x.s.slots, x.s.name || ("실험 " + (x.i + 1))));
    });
  };
  var addFiles = function (list) {
    var arr = files.slice();
    for (var i = 0; i < list.length && arr.length < 4; i++) arr.push({ file: list[i], url: URL.createObjectURL(list[i]) });
    setFiles(arr);
  };
  var post = function () {
    b.run(async function () {
      var o = opts.map(function (x) { return x.trim(); }).filter(Boolean);
      if (kind === "poll" && o.length < 2) throw new Error("선택지를 두 개 이상 넣어 주세요");
      if (kind === "deck" && !deck) throw new Error("덱을 붙여 주세요");
      if (!title.trim() && !body.trim() && !deck && !files.length && kind !== "poll") throw new Error("내용을 넣어 주세요");
      if ((kind === "poll" || kind === "notice") && !title.trim()) throw new Error("제목을 넣어 주세요");
      var poll = kind === "poll" ? { options: o, closes_at: closeDays ? new Date(Date.now() + closeDays * 864e5).toISOString() : null } : null;
      await api.createPost(ctx.club.id, { kind: kind, title: title.trim(), body: body.trim(), deck: deck, poll: poll, allowCopy: allowCopy, pinned: kind === "notice" },
        files.map(function (f) { return f.file; }));
      p.onDone();
    });
  };
  return (<Modal title={init.deck ? "클럽에 덱 공유" : "글쓰기"} sub={ctx.club.name} mobile={mob} onClose={p.onClose} width={600}
    foot={<React.Fragment><Btn onClick={p.onClose}>{"취소"}</Btn><Btn pri icon="send" onClick={post} disabled={b.busy}>{b.busy ? "올리는 중…" : "올리기"}</Btn></React.Fragment>}>
    <div style={Object.assign({}, KICK, { marginBottom: 8 })}>{"말머리"}</div>
    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
      {kinds.map(function (k) {
        var on = k === kind;
        return (<button key={k} type="button" onClick={function () { setKind(k); }} style={Object.assign({}, BTN, { minHeight: 30, padding: "5px 11px" },
          on ? { borderColor: "var(--acc)", color: "var(--acc)", background: "rgba(255,213,79,.08)" } : null)}>{KINDS[k][0]}</button>);
      })}
    </div>
    {kind === "notice" && <div style={{ fontSize: 12, color: "var(--td)", margin: "-6px 0 12px", lineHeight: 1.6 }}>{"공지는 라운지 맨 위에 고정돼요. 고정은 글 오른쪽 위 … 메뉴에서 풀 수 있어요."}</div>}
    <Field label={kind === "poll" || kind === "notice" ? "제목" : "제목 (선택)"} value={title} onChange={setTitle} max={60} ph={kind === "poll" ? "예: 이번 주 다 같이 특훈 뭐 할까요" : kind === "notice" ? "예: 이번 주 클럽전은 토요일 밤 9시" : ""} />
    <Field label="내용" area value={body} onChange={setBody} max={2000} rows={mob ? 3 : 4} ph={kind === "question" ? "궁금한 걸 적어 주세요. 덱을 붙이면 더 정확한 답을 받을 수 있어요" : ""} />
    {kind === "poll" && (<div style={{ marginBottom: 12 }}>
      <div style={Object.assign({}, KICK, { marginBottom: 6 })}>{"선택지"}</div>
      {opts.map(function (o, i) {
        return (<div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={o} maxLength={40} onChange={function (e) { var n = opts.slice(); n[i] = e.target.value; setOpts(n); }} placeholder={"선택지 " + (i + 1)} style={Object.assign({}, INP, { width: 0, flex: 1 })} />
          {opts.length > 2 && <Btn ghost icon="x" onClick={function () { setOpts(opts.filter(function (_, j) { return j !== i; })); }} />}
        </div>);
      })}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        {opts.length < 6 && <Btn sm onClick={function () { setOpts(opts.concat([""])); }}>{"+ 선택지"}</Btn>}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--td)" }}>{"마감"}</span>
        {[[1, "1일"], [3, "3일"], [7, "7일"], [0, "없음"]].map(function (x) {
          return <Btn key={x[0]} sm style={closeDays === x[0] ? { color: "var(--acc)", borderColor: "var(--acc)" } : null} onClick={function () { setCloseDays(x[0]); }}>{x[1]}</Btn>;
        })}
      </div>
    </div>)}
    <div style={Object.assign({}, KICK, { marginBottom: 6 })}>{"덱 붙이기"}</div>
    {deck ? (<div>
      <DeckBox deck={deck} mobile={mob} mt={0} actions={<Btn sm ghost no icon="x" onClick={function () { setDeck(null); }}>{"떼기"}</Btn>} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, color: "var(--t2)", cursor: "pointer" }}>
        <input type="checkbox" checked={allowCopy} onChange={function (e) { setAllowCopy(e.target.checked); }} />{"클럽원이 이 덱을 자기 연구소로 가져갈 수 있게 허용"}</label>
    </div>) : (<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
      <Btn sm icon="deck" onClick={attachNow}>{"지금 내 덱"}</Btn>
      {saves.map(function (x) { return <Btn sm key={x.i} purple icon="flask" onClick={function () { attachLab(x); }}>{(x.s.name || ("실험 " + (x.i + 1))) + " · " + (x.s.team || "")}</Btn>; })}
      {!saves.length && <span style={{ fontSize: 11.5, color: "var(--td)", alignSelf: "center" }}>{"덱 연구소에 저장한 실험이 있으면 여기 떠요"}</span>}
    </div>)}
    <div style={Object.assign({}, KICK, { margin: "14px 0 6px" })}>{"사진 (최대 4장)"}</div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {files.map(function (f, i) {
        return (<div key={i} style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", position: "relative", border: "1px solid var(--bd)" }}>
          <img src={f.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <button type="button" onClick={function () { setFiles(files.filter(function (_, j) { return j !== i; })); }} style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", border: "none", borderRadius: 6, color: "#fff", cursor: "pointer", padding: 1 }}><Icon n="x" size={12} /></button>
        </div>);
      })}
      {files.length < 4 && (<label style={{ width: 72, height: 72, borderRadius: 10, border: "1px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--td)", cursor: "pointer" }}>
        <Icon n="img" /><input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={function (e) { addFiles(e.target.files || []); e.target.value = ""; }} /></label>)}
    </div>
    <Msg text={b.err} />
  </Modal>);
}

/* ── 덱 현황 (클럽장) ──────────────────────────────────── */

function DeckStatus(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob;
  var _d = useState(null); var decks = _d[0]; var setDecks = _d[1];
  var _sort = useState("total"); var sort = _sort[0]; var setSort = _sort[1];
  var _open = useState(null); var open = _open[0]; var setOpen = _open[1];
  var b = useBusy();
  var load = async function () { try { setDecks(await api.loadClubDecks(ctx.club.id)); } catch (e) { b.setErr(e.message); setDecks([]); } };
  useEffect(function () { load(); }, [ctx.club.id]);
  if (!decks) return <div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div>;
  /* 요약본은 클럽원 화면이 만들어 올린 것이라 모양을 믿지 않는다 */
  var byUser = {}; decks.forEach(function (d) { byUser[d.user_id] = Object.assign({}, d, { deck: d.deck && typeof d.deck === "object" ? d.deck : {} }); });
  var rows = ctx.active.map(function (m) { return { m: m, d: byUser[m.user_id] || null }; });
  var shared = rows.filter(function (r) { return r.d; });
  rows.sort(function (a, b2) {
    if (!a.d || !b2.d) return a.d ? -1 : b2.d ? 1 : 0;
    if (sort === "fresh") return new Date(b2.d.saved_at) - new Date(a.d.saved_at);
    return Number(b2.d.total) - Number(a.d.total);
  });
  var maxT = Math.max.apply(null, shared.map(function (r) { return Number(r.d.total); }).concat([1]));
  var avg = shared.length ? shared.reduce(function (s, r) { return s + Number(r.d.total); }, 0) / shared.length : 0;
  var wk = function (d) { return d.week_base === null || d.week_base === undefined ? null : Number(d.total) - Number(d.week_base); };
  var wkList = shared.map(function (r) { return wk(r.d); }).filter(function (v) { return v !== null; });
  var wkAvg = wkList.length ? wkList.reduce(function (s, v) { return s + v; }, 0) / wkList.length : 0;
  var stale = shared.filter(function (r) { return daysSince(r.d.saved_at) > 7; }).length;
  var kpis = [["평균 TOTAL", shared.length ? num(avg) : "—", "공개한 " + shared.length + "명 기준"],
    ["덱 공개", shared.length + " / " + ctx.active.length, (ctx.active.length - shared.length) + "명 비공개"],
    ["주간 변화", (wkAvg >= 0 ? "▲ " : "▼ ") + num(Math.abs(wkAvg)), "1인 평균", wkAvg >= 0 ? "#4CAF50" : "#FF6B6B"],
    ["갱신 없음", stale + "명", "7일 넘음", stale ? "#FFA726" : null]];
  var wkCell = function (d) {
    var v = wk(d);
    if (v === null || Math.abs(v) < 0.05) return <span style={{ color: "var(--td)" }}>{"—"}</span>;
    return <span style={{ color: v > 0 ? "#4CAF50" : "#FF6B6B", fontFamily: "var(--m)" }}>{(v > 0 ? "▲" : "▼") + num(Math.abs(v))}</span>;
  };
  var lab = function (d) { p.onOpenLab(d.deck, { mode: "open" }); };
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + (mob ? 2 : 4) + ",1fr)", gap: 10, marginBottom: 16 }}>
      {kpis.map(function (k) {
        return (<Card key={k[0]} pad="13px 15px"><div style={KICK}>{k[0]}</div>
          <div style={{ fontSize: 19, fontWeight: 900, margin: "5px 0 2px", letterSpacing: -.4, color: k[3] || "var(--t1)", fontFamily: /\d/.test(k[1]) ? "var(--m)" : "inherit" }}>{k[1]}</div>
          <div style={{ fontSize: 11.5, color: "var(--td)" }}>{k[2]}</div></Card>);
      })}
    </div>
    <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "var(--td)", flex: 1 }}>{"클럽원이 공개한 덱 요약본만 보여요 · 그 덱을 열 때마다 새로 올라와요"}</span>
      {[["total", "점수순"], ["fresh", "갱신순"]].map(function (s) { return <Btn key={s[0]} sm style={sort === s[0] ? { color: "var(--acc)", borderColor: "var(--acc)" } : null} onClick={function () { setSort(s[0]); }}>{s[1]}</Btn>; })}
      <Btn sm ghost icon="refresh" onClick={load} title="새로 보기" />
    </div>
    <Msg text={b.err} />
    {mob ? rows.map(function (r) {
      var m = r.m, d = r.d, on = open === m.user_id;
      if (!d) return (<Card key={m.user_id} pad="12px 14px" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 10, opacity: .55 }}><Avatar name={m.nickname} size={30} /><b style={{ flex: 1 }}>{m.nickname}</b><span style={{ fontSize: 12, color: "var(--td)" }}>{"비공개"}</span></Card>);
      return (<Card key={m.user_id} pad="12px 14px" style={Object.assign({ marginBottom: 8 }, on ? { borderColor: "rgba(255,213,79,.35)" } : null)}>
        <div onClick={function () { setOpen(on ? null : m.user_id); }} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <Avatar name={m.nickname} team={txt(d.deck.team)} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}><div><b>{m.nickname}</b>{m.role === "leader" && <Tag c="acc" style={{ marginLeft: 5 }}>{"클럽장"}</Tag>}</div>
            <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 2 }}>{txt(d.deck.team) + " · 세트덱 " + num(d.set_point, 0) + " · "}<span style={{ color: daysSince(d.saved_at) > 7 ? "#FFA726" : "inherit" }}>{ago(d.saved_at)}</span></div></div>
          <div style={{ textAlign: "right" }}><div style={{ fontFamily: "var(--m)", fontWeight: 800, color: "var(--acc)" }}>{num(d.total)}</div><div style={{ fontSize: 11 }}>{wkCell(d)}</div></div>
        </div>
        {on && <DeckBox deck={d.deck} mobile actions={<Btn sm ghost purple icon="flask" onClick={function () { lab(d); }}>{"연구소로"}</Btn>} />}
      </Card>);
    }) : (<Card pad={0} style={{ overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>{["클럽원", "팀", "TOTAL SCORE", "주간", "세트덱", "채움", "갱신", ""].map(function (h, i) {
          return <th key={i} style={{ fontSize: 11, color: "var(--td)", fontWeight: 600, textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{h}</th>;
        })}</tr></thead>
        <tbody>{rows.map(function (r) {
          var m = r.m, d = r.d, on = open === m.user_id;
          var td = { fontSize: 13, padding: "11px 12px", borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" };
          if (!d) return (<tr key={m.user_id} style={{ opacity: .5 }}><td style={td}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={m.nickname} size={26} /><b>{m.nickname}</b></div></td><td colSpan={7} style={Object.assign({}, td, { color: "var(--td)" })}>{"덱 비공개"}</td></tr>);
          var w = Math.max(4, Number(d.total) / maxT * 100);
          return (<React.Fragment key={m.user_id}>
            <tr onClick={function () { setOpen(on ? null : m.user_id); }} style={{ cursor: "pointer", background: on ? "rgba(255,213,79,.04)" : "transparent" }}>
              <td style={td}><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={m.nickname} team={txt(d.deck.team)} size={26} /><b>{m.nickname}</b>{m.role === "leader" && <Tag c="acc">{"클럽장"}</Tag>}</div></td>
              <td style={Object.assign({}, td, { color: "var(--t2)" })}>{txt(d.deck.team)}</td>
              <td style={Object.assign({}, td, { width: 220 })}><div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--inner)", overflow: "hidden" }}><div style={{ width: w + "%", height: "100%", background: "var(--acc)" }} /></div>
                <span style={{ fontFamily: "var(--m)", fontWeight: 800 }}>{num(d.total)}</span></div></td>
              <td style={td}>{wkCell(d)}</td>
              <td style={Object.assign({}, td, { fontFamily: "var(--m)", color: "var(--t2)" })}>{d.set_point}</td>
              <td style={Object.assign({}, td, { fontFamily: "var(--m)", color: d.filled < 21 ? "#FFA726" : "var(--t2)" })}>{d.filled + "/21"}</td>
              <td style={Object.assign({}, td, { color: daysSince(d.saved_at) > 7 ? "#FFA726" : "var(--td)" })}>{ago(d.saved_at)}</td>
              <td style={Object.assign({}, td, { textAlign: "right" })}><Btn sm ghost purple icon="flask" title="연구소로 복사해서 고쳐 보기" onClick={function (e) { lab(d); }} /></td>
            </tr>
            {on && (<tr><td colSpan={8} style={{ padding: "0 12px 14px", background: "rgba(255,213,79,.025)", borderBottom: "1px solid var(--bd)" }}>
              <DeckBox deck={d.deck} actions={<Btn sm ghost purple icon="flask" onClick={function () { lab(d); }}>{"연구소에서 열기"}</Btn>} />
            </td></tr>)}
          </React.Fragment>);
        })}</tbody>
      </table>
    </Card>)}
  </div>);
}

/* ── 클럽원 ────────────────────────────────────────────── */

function Members(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob;
  var me = ctx.me.member;
  var _share = useState(me.share_deck_id || ""); var share = _share[0]; var setShareSt = _share[1];
  var _snap = useState(null); var snap = _snap[0]; var setSnap = _snap[1];
  var _nick = useState(null); var nick = _nick[0]; var setNick = _nick[1];
  /* 알림은 누른 곳 가까이 — 내 설정(덱 공개 · 닉네임)과 명단(넘기기 · 내보내기)을 따로 */
  var bMe = useBusy(), bList = useBusy();
  var loadSnap = async function () { try { setSnap(await api.loadMyDeck()); } catch (e) {} };
  useEffect(function () { loadSnap(); }, []);
  var decks = p.decks || [];
  var deckName = function (id) {
    var i = decks.findIndex(function (d) { return d.deckId === id; });
    if (i < 0) return "";
    var d = decks[i]; var same = decks.filter(function (x) { return x.teamName === d.teamName; });
    return d.teamName + (same.length > 1 ? " " + (same.indexOf(d) + 1) : "");
  };
  var choose = function (id) {
    bMe.run(async function () {
      await api.setShare(id || null);
      setShareSt(id || "");
      if (id && id === p.curDeckId && p.tools && p.tools.publishNow) await p.tools.publishNow();
      await loadSnap();
      await ctx.reload();
    }, id ? (id === p.curDeckId ? "공개했어요. 덱을 바꿀 때마다 요약본이 새로 올라가요" : "공개할 덱을 정했어요. 그 덱을 열면 요약본이 올라가요") : "공개를 껐어요. 올라가 있던 요약본도 지웠어요");
  };
  var act = function (b, q, fn, okText) { if (window.confirm(q)) b.run(fn, okText); };
  var listCol = (<div style={{ minWidth: 0 }}>
    {mob && <div style={Object.assign({}, KICK, { margin: "6px 2px 8px" })}>{"클럽원 " + ctx.active.length + "명"}</div>}
    <Msg text={bList.err} /><Msg bad={false} text={bList.ok} />
    <Card pad={0}>
      {ctx.active.map(function (m, i) {
        var self = m.user_id === ctx.me.uid;
        return (<div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderTop: i ? "1px solid var(--bd)" : "none" }}>
          <Avatar name={m.nickname} />
          <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{m.nickname}</b>{m.role === "leader" && <Tag c="acc">{"클럽장"}</Tag>}{self && <Tag>{"나"}</Tag>}</div>
            <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 2 }}>{m.joined_at ? fmtWhen(m.joined_at).split(" ")[0] + " 가입" : ""}{m.share_deck_id ? " · 덱 공개" : " · 덱 비공개"}</div></div>
          {ctx.leader && !self && (<React.Fragment>
            <Btn sm ghost title="클럽장 넘기기" onClick={function () { act(bList, m.nickname + " 님에게 클럽장을 넘길까요? 넘기면 나는 일반 클럽원이 돼요.", async function () { await api.transferLeader(ctx.club.id, m.user_id); await ctx.reload(); }, m.nickname + " 님에게 클럽장을 넘겼어요"); }}>{mob ? "위임" : "클럽장 넘기기"}</Btn>
            <Btn sm ghost no onClick={function () { act(bList, m.nickname + " 님을 내보낼까요?", async function () { await api.kickMember(ctx.club.id, m.user_id); await ctx.reloadMembers(); }, m.nickname + " 님을 내보냈어요"); }}>{"내보내기"}</Btn>
          </React.Fragment>)}
        </div>);
      })}
    </Card>
  </div>);
  var meCards = (<div>
    <Card style={{ marginBottom: 12 }}>
      <b style={{ fontSize: 14 }}>{"클럽에 내 덱 공개"}</b>
      <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.6, margin: "6px 0 12px" }}>{ctx.leader
        ? "고른 덱의 요약본(라인업 · TOTAL · 세트덱)이 '덱 현황'에 같이 보여요. 원본 저장은 그대로이고, 선수 능력치 · 훈련 값은 올라가지 않아요."
        : "고른 덱의 요약본(라인업 · TOTAL · 세트덱)만 클럽장에게 보여요. 원본 저장은 그대로이고, 선수 능력치 · 훈련 값은 올라가지 않아요."}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Btn sm style={!share ? { color: "var(--acc)", borderColor: "var(--acc)" } : null} onClick={function () { if (share) choose(""); }} disabled={bMe.busy}>{"공개 안 함"}</Btn>
        {decks.map(function (d) {
          var on = share === d.deckId;
          return <Btn key={d.deckId} sm style={on ? { color: "var(--acc)", borderColor: "var(--acc)", background: "rgba(255,213,79,.08)" } : null} onClick={function () { if (!on) choose(d.deckId); }} disabled={bMe.busy}>{deckName(d.deckId) + (d.deckId === p.curDeckId ? " (열림)" : "")}</Btn>;
        })}
      </div>
      {share && (<div style={{ fontSize: 12, color: "var(--td)", marginTop: 10, lineHeight: 1.6 }}>
        {snap ? <span>{"올라간 요약본: " + fmtWhen(snap.saved_at) + " · TOTAL "}<b style={{ fontFamily: "var(--m)", color: "var(--acc)" }}>{num(snap.total)}</b></span> : "아직 올라간 요약본이 없어요"}
        {share !== p.curDeckId && <div style={{ color: "#FFA726" }}>{"지금 열린 덱이 아니에요 — " + deckName(share) + " 덱을 열면 올라가요"}</div>}
      </div>)}
    </Card>
    <Card style={{ marginBottom: 12 }}>
      <b style={{ fontSize: 14 }}>{"내 닉네임"}</b>
      {nick === null ? (<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.nickname}</span><Btn sm onClick={function () { setNick(me.nickname); }}>{"바꾸기"}</Btn></div>)
        : (<div style={{ display: "flex", gap: 6, marginTop: 8 }}><input value={nick} maxLength={20} onChange={function (e) { setNick(e.target.value); if (bMe.err) bMe.setErr(""); }} style={Object.assign({}, INP, { width: 0, flex: 1 })} />
          <Btn sm onClick={function () { setNick(null); }}>{"취소"}</Btn>
          <Btn sm pri onClick={function () { bMe.run(async function () { if (!nick.trim()) throw new Error("닉네임을 넣어 주세요"); await api.setNickname(nick.trim()); setNick(null); await ctx.reload(); }, "닉네임을 바꿨어요"); }}>{"저장"}</Btn></div>)}
      <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 6 }}>{"이미 쓴 글의 이름은 그대로예요"}</div>
    </Card>
    <Msg text={bMe.err} /><Msg bad={false} text={bMe.ok} />
  </div>);
  var leave = (!ctx.leader ? <Btn no style={{ width: "100%", marginTop: mob ? 16 : 0 }} onClick={function () { act(bMe, "클럽에서 나갈까요? 공개한 덱 요약본도 지워져요.", async function () { await api.leaveClub(); realApi.forgetShareCache(); await ctx.reload(); }); }}>{"클럽 탈퇴"}</Btn>
    : <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.6, marginTop: mob ? 14 : 0 }}>{"클럽장은 다른 클럽원에게 넘긴 뒤 탈퇴할 수 있어요. 클럽을 닫으려면 관리 탭에서."}</div>);
  /* 휴대폰은 한 줄이라 명단이 길면 내 설정이 맨 아래로 묻혔다 — 내 설정을 먼저, 탈퇴는 맨 끝에 */
  if (mob) return (<div>{meCards}{listCol}{leave}</div>);
  return (<div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 16, alignItems: "start" }}>
    {listCol}
    <div>{meCards}{leave}</div>
  </div>);
}

/* ── 관리 (클럽장) ─────────────────────────────────────── */

function Manage(p) {
  var ctx = p.ctx, api = ctx.api, mob = ctx.mob, club = ctx.club;
  var _intro = useState(club.intro || ""); var intro = _intro[0]; var setIntro = _intro[1];
  var _et = useState(""); var et = _et[0]; var setEt = _et[1];
  var _ed = useState(""); var ed = _ed[0]; var setEd = _ed[1];
  var _ev = useState(null); var ev = _ev[0]; var setEv = _ev[1];
  /* 알림은 누른 칸 바로 아래에 — 예전에는 관리 탭 맨 아래에 떠서, 휴대폰에서는 승인을 눌러도 반응이 없는 것처럼 보였다 */
  var bJoin = useBusy(), bCode = useBusy(), bIntro = useBusy(), bEv = useBusy(), bClose = useBusy();
  var loadEv = async function () { try { setEv(await api.loadEvents(club.id)); } catch (e) { setEv({ events: [], rsvps: [] }); } };
  useEffect(function () { loadEv(); }, []);
  var full = ctx.active.length >= club.capacity;
  var sec = function (t, children, sub) {
    return (<Card style={{ marginBottom: 12 }}><div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}><b style={{ fontSize: 14 }}>{t}</b>{sub && <span style={{ fontSize: 12, color: "var(--td)" }}>{sub}</span>}</div>{children}</Card>);
  };
  var decide = function (m, ok) {
    if (!ok && !window.confirm(m.nickname + " 님의 가입 신청을 거절할까요?")) return;
    bJoin.run(async function () { await api.decideMember(club.id, m.user_id, ok); await ctx.reloadMembers(); },
      ok ? m.nickname + " 님을 받았어요" : m.nickname + " 님의 신청을 거절했어요");
  };
  return (<div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: "0 16px", alignItems: "start" }}>
    <div>
      {sec("가입 신청", (<div>
        {full && p.pending.length > 0 && (<div style={{ fontSize: 12.5, color: "#FFA726", background: "rgba(255,167,38,.08)", border: "1px solid rgba(255,167,38,.3)", borderRadius: 10, padding: "9px 12px", marginBottom: 8, lineHeight: 1.6 }}>
          {"정원(" + club.capacity + "명)이 다 찼어요. 클럽원 탭에서 자리를 비워야 승인할 수 있어요."}</div>)}
        {p.pending.length ? p.pending.map(function (m) {
          return (<div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid var(--bd)" }}>
            <Avatar name={m.nickname} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nickname}</b><div style={{ fontSize: 11.5, color: "var(--td)" }}>{ago(m.created_at) + " 신청 · 인게임 닉네임"}</div></div>
            <Btn sm no onClick={function () { decide(m, false); }} disabled={bJoin.busy}>{"거절"}</Btn>
            <Btn sm ok onClick={function () { decide(m, true); }} disabled={bJoin.busy || full} title={full ? "정원이 다 찼어요" : ""}>{"승인"}</Btn>
          </div>);
        }) : <div style={{ fontSize: 12.5, color: "var(--td)" }}>{"대기 중인 신청이 없어요"}</div>}
        <Msg text={bJoin.err} /><Msg bad={false} text={bJoin.ok} />
      </div>), p.pending.length ? p.pending.length + "명" : "")}
      {sec("초대 코드", (<div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--m)", fontSize: 22, fontWeight: 800, letterSpacing: 2, color: "var(--acc)", flex: 1, minWidth: 0 }}>{club.invite_code}</span>
          <Btn sm icon="copy" onClick={function () { copyText(club.invite_code); bCode.setErr(""); bCode.setOk("코드를 복사했어요"); }}>{"복사"}</Btn>
          <Btn sm icon="refresh" onClick={function () { if (window.confirm("코드를 새로 만들까요? 예전 코드로는 더 신청할 수 없어요.")) bCode.run(async function () { await api.regenInvite(club.id); await ctx.reload(); }, "새 코드를 만들었어요"); }}>{"새로"}</Btn>
        </div>
        <div style={{ fontSize: 12, color: "var(--td)", marginTop: 6, lineHeight: 1.6 }}>{"인게임 클럽 채팅에 이 코드를 알려 주세요. 클럽 라운지 → 클럽 가입에 넣으면 신청이 여기로 와요."}</div>
        <Msg text={bCode.err} /><Msg bad={false} text={bCode.ok} />
      </div>), "정원 " + club.capacity + "명")}
      {sec("클럽 소개", (<div>
        <Field area value={intro} onChange={function (v) { setIntro(v); if (bIntro.err) bIntro.setErr(""); }} max={200} rows={3} ph="가입 신청할 때 보이는 한두 줄" mb={8} />
        <div style={{ textAlign: "right" }}><Btn sm pri onClick={function () { bIntro.run(async function () { await api.updateIntro(club.id, intro); await ctx.reload(); }, "소개를 저장했어요"); }} disabled={bIntro.busy}>{"저장"}</Btn></div>
        <Msg text={bIntro.err} /><Msg bad={false} text={bIntro.ok} />
      </div>))}
    </div>
    <div>
      {sec("일정", (<div>
        {ev && ev.events.map(function (e) {
          return (<div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid var(--bd)" }}>
            <span style={{ fontSize: 12, color: "var(--td)", fontFamily: "var(--m)", width: 104, flexShrink: 0 }}>{fmtWhen(e.starts_at)}</span><span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txt(e.title)}</span>
            <Btn sm ghost no icon="trash" title="일정 지우기" onClick={function () { if (window.confirm("‘" + txt(e.title) + "’ 일정을 지울까요? 참여 표시도 함께 지워져요.")) bEv.run(async function () { await api.deleteEvent(e.id); await loadEv(); }, "일정을 지웠어요"); }} />
          </div>);
        })}
        <div style={{ marginTop: 10 }}>
          <input value={et} onChange={function (e) { setEt(e.target.value); if (bEv.err) bEv.setErr(""); }} maxLength={40} placeholder="일정 이름 (예: 클럽전 3라운드)" style={Object.assign({}, INP, { marginBottom: 6 })} />
          <div style={{ display: "flex", gap: 6 }}>
            <input type="datetime-local" value={ed} onChange={function (e) { setEd(e.target.value); if (bEv.err) bEv.setErr(""); }} style={Object.assign({}, INP, { flex: 1, width: 0, colorScheme: "var(--cscheme)" })} />
            <Btn pri onClick={function () { bEv.run(async function () { if (!et.trim() || !ed) throw new Error("일정 이름과 날짜를 넣어 주세요"); await api.createEvent(club.id, et.trim(), new Date(ed).toISOString()); setEt(""); setEd(""); await loadEv(); }, "일정을 만들었어요"); }} disabled={bEv.busy}>{"추가"}</Btn>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--td)", marginTop: 6 }}>{"라운지 일정 칸에 뜨고, 클럽원이 참여를 누를 수 있어요"}</div>
        <Msg text={bEv.err} /><Msg bad={false} text={bEv.ok} />
      </div>))}
      {sec("클럽 닫기", (<div>
        <div style={{ fontSize: 12, color: "var(--td)", lineHeight: 1.6, marginBottom: 10 }}>{"글 · 댓글 · 덱 요약본이 모두 지워지고 되돌릴 수 없어요."}</div>
        <Btn sm no icon="trash" onClick={function () {
          var t = window.prompt("정말 닫으려면 클럽 이름 ‘" + club.name + "’ 을 그대로 적어 주세요");
          if (t === null) return;
          if (t.trim() !== club.name) { bClose.setErr("클럽 이름이 달라서 닫지 않았어요"); return; }
          bClose.run(async function () { await api.disbandClub(club.id); realApi.forgetShareCache(); await ctx.reload(); });
        }}>{"클럽 닫기"}</Btn>
        <Msg text={bClose.err} />
      </div>))}
    </div>
  </div>);
}
