/* 고객센터 — 홈 · 공지사항 · 업데이트 내역 · 사용설명서 · 건의사항 · 오류 제보 (2026-10-19 사용자 요청).
   공지 · 업데이트 내역은 운영자만 쓰고, 건의 · 오류 제보는 누구나 쓴다. 운영자는 상태 · 답변을 단다.
   글쓴이는 내 글의 제목 · 내용을, 운영자는 공지 · 업데이트 내역을 고칠 수 있다 (feedback_edit_post).
   서버 일은 feedback-api.js, 표 · 정책은 supabase/feedback_board.sql, 사용설명서 내용은 help-guide.jsx.
   공개 글은 누구나 읽고, 쓰기 · 공감은 구글 로그인한 사람만. 비밀글은 쓴 사람과 운영자만 본다 */
import React, { useState, useEffect, useRef } from "react";
import * as realApi from "./feedback-api.js";
import { useBackClose } from "./back-close.js";
import HelpGuide from "./help-guide.jsx";

/* 테마별 색 — 라이트 모드에서 입력칸이 회색으로 꺼지지 않게 (클럽 라운지와 같은 방식) */
var THEME_CSS = ".fb-root{--finp:rgba(0,0,0,.18);--fonacc:#1a1300;--fscheme:dark}"
  + ".light .fb-root{--finp:var(--card);--fonacc:#fff;--fscheme:light}"
  + ".fb-chips{scrollbar-width:none}.fb-chips::-webkit-scrollbar{display:none}";

/* 화면 한 부분이 깨져도 사이트 전체가 하얗게 되지 않게 */
class Safe extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e || new Error("화면 오류") }; }
  componentDidCatch(e) { try { console.warn("[board] 화면 일부를 그리지 못했어요:", e && e.message); } catch (x) { /* 무시 */ } }
  render() { return this.state.err ? (this.props.fallback ? this.props.fallback() : null) : this.props.children; }
}

/* ── 작은 부품 ─────────────────────────────────────────── */

var KIND = { bug: ["🐞", "오류 제보", "오류"], idea: ["💡", "건의사항", "건의"], notice: ["📢", "공지사항", "공지"], update: ["🆕", "업데이트 내역", "업데이트"] };
/* 운영자만 쓰는 글 — 처리 상태 · 공감 · 답변이 없다 */
var OFFICIAL = { notice: 1, update: 1 };
var SECTIONS = [["home", "🏠 홈"], ["notice", "📢 공지사항"], ["update", "🆕 업데이트 내역"], ["guide", "📖 사용설명서"], ["idea", "💡 건의사항"], ["bug", "🐞 오류 제보"]];
var STATUS = { open: ["접수", "gray"], progress: ["확인 중", "blue"], done: ["완료", "green"], hold: ["보류", "orange"] };
var TONE = { gray: ["var(--inner)", "var(--t2)"], blue: ["rgba(108,184,255,.14)", "#5AA9F0"], green: ["rgba(76,175,80,.14)", "#4CAF50"],
  orange: ["rgba(255,167,38,.15)", "#FFA726"], red: ["rgba(255,107,107,.13)", "#FF6B6B"], purple: ["rgba(206,147,216,.15)", "#BA68C8"], acc: ["rgba(255,213,79,.14)", "var(--acc)"] };
var KIND_TONE = { bug: "red", idea: "purple", notice: "acc", update: "blue" };
function Tag(p) {
  var c = TONE[p.c || "gray"];
  return (<span title={p.title} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 7px",
    lineHeight: 1.4, background: c[0], color: c[1], whiteSpace: "nowrap" }}>{p.children}</span>);
}
var BTN = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, borderRadius: 9,
  border: "1px solid var(--bd)", background: "transparent", color: "var(--t2)", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "inherit", minHeight: 36 };
function Btn(p) {
  var st = Object.assign({}, BTN,
    p.pri ? { background: "var(--acc)", color: "var(--fonacc)", borderColor: "var(--acc)", fontWeight: 800 } : null,
    p.no ? { color: "#FF6B6B", borderColor: "rgba(255,107,107,.35)" } : null,
    p.on ? { color: "var(--acc)", borderColor: "var(--acc)", background: "rgba(255,213,79,.08)" } : null,
    p.sm ? { padding: "6px 11px", fontSize: 12.5, minHeight: 32 } : null,
    p.disabled ? { opacity: .45, cursor: "default" } : null, p.style);
  return (<button type="button" title={p.title} disabled={p.disabled} onClick={p.disabled ? undefined : p.onClick} style={st}>{p.children}</button>);
}
var CARD = { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 14 };
var INP = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--bd)", background: "var(--finp)", color: "var(--t1)",
  fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" };
var KICK = { fontSize: 11.5, fontWeight: 700, color: "var(--td)", letterSpacing: .3 };
var LINK = { background: "none", border: "none", color: "var(--td)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: "6px 0", minHeight: 32 };
/* 두 줄까지만 보이는 글 (목록의 내용 미리보기) */
var CLAMP2 = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };
function Msg(p) {
  if (!p.text) return null;
  var bad = p.bad !== false;
  return (<div style={{ padding: "10px 12px", borderRadius: 10, fontSize: 13, lineHeight: 1.6, margin: "10px 0",
    background: bad ? "rgba(255,107,107,.08)" : "rgba(76,175,80,.08)", color: bad ? "#FF8A80" : "#66BB6A",
    border: "1px solid " + (bad ? "rgba(255,107,107,.25)" : "rgba(76,175,80,.25)") }}>{p.text}</div>);
}
function txt(v) { return typeof v === "string" ? v : (typeof v === "number" && isFinite(v)) ? String(v) : ""; }
function ms(ts) { var t = ts ? new Date(ts).getTime() : 0; return isFinite(t) ? t : 0; }
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
function fmtWhen(ts) {
  var d = new Date(ts); var W = ["일", "월", "화", "수", "목", "금", "토"];
  return (d.getMonth() + 1) + "/" + d.getDate() + "(" + W[d.getDay()] + ") " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function useBusy() {
  var _b = useState(false); var _m = useState("");
  var run = async function (fn) {
    if (_b[0]) return;
    _b[1](true); _m[1]("");
    try { return await fn(); } catch (e) { _m[1](e && e.message || String(e)); } finally { _b[1](false); }
  };
  return { busy: _b[0], err: _m[0], run: run, setErr: _m[1] };
}
function Modal(p) {
  useBackClose(true, p.onClose);
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,12,.7)", display: "flex", alignItems: p.mobile ? "flex-end" : "center", justifyContent: "center" }}>
    <div onClick={function (e) { e.stopPropagation(); }} style={Object.assign({}, CARD, { background: "var(--bg)", width: p.mobile ? "100%" : 600, maxHeight: p.mobile ? "94vh" : "90vh",
      overflowY: "auto", borderRadius: p.mobile ? "16px 16px 0 0" : 14, boxShadow: "0 20px 60px rgba(0,0,0,.45)" })}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--bd)", position: "sticky", top: 0, background: "var(--bg)", zIndex: 1 }}>
        <b style={{ fontSize: 16 }}>{p.title}</b>
        <button type="button" onClick={p.onClose} aria-label="닫기" title="닫기" style={{ background: "none", border: "none", color: "var(--td)", cursor: "pointer", padding: 8, margin: "-6px -6px -6px auto", fontSize: 18, lineHeight: 1 }}>{"✕"}</button>
      </div>
      <div style={{ padding: "16px 18px" }}>{p.children}</div>
      {p.foot && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--bd)", position: "sticky", bottom: 0, background: "var(--bg)" }}>{p.foot}</div>}
    </div></div>);
}
function Viewer(p) {
  useBackClose(true, p.onClose);
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: "56px 10px 10px", cursor: "zoom-out" }}>
    <img src={p.url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 6 }} />
    <button type="button" onClick={p.onClose} style={{ position: "absolute", top: 10, right: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(0,0,0,.6)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{"닫기"}</button>
  </div>);
}

/* 글 내용 — '· ' · '- ' 로 시작하는 줄은 점 목록으로, 빈 줄은 간격으로. 운영자 글의 인터넷 주소는 누를 수 있게 */
var URL_RE = /https?:\/\/[^\s<>"']+/g;
function linkify(t, on) {
  if (!on) return t;
  var out = [], last = 0, m;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(t))) {
    var url = m[0].replace(/[)\].,!?」』]+$/, "");
    if (m.index > last) out.push(t.slice(last, m.index));
    out.push(<a key={m.index} href={url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--acc)", wordBreak: "break-all" }}>{url}</a>);
    last = m.index + url.length; URL_RE.lastIndex = last;
  }
  if (last < t.length) out.push(t.slice(last));
  return out;
}
function PostBody(p) {
  var lines = String(p.text || "").split("\n");
  return (<div style={{ fontSize: p.size || 14.5, lineHeight: 1.75, color: "var(--t1)", wordBreak: "break-word" }}>
    {lines.map(function (ln, i) {
      var m = /^\s*[·•-]\s+(.*)$/.exec(ln);
      if (m) return (<div key={i} style={{ display: "flex", gap: 7, margin: "3px 0" }}><span style={{ color: "var(--acc)", flexShrink: 0 }}>{"•"}</span><span style={{ minWidth: 0 }}>{linkify(m[1], p.links)}</span></div>);
      if (!ln.trim()) return <div key={i} style={{ height: 10 }} />;
      return <div key={i} style={{ margin: "2px 0" }}>{linkify(ln, p.links)}</div>;
    })}
  </div>);
}

/* 오류 제보에 붙이는 기기 정보 — 개인 정보는 없다 (브라우저 · 운영체제 · 화면 크기 · 테마 · 사이트 버전) */
export function envInfo() {
  try {
    var ua = navigator.userAgent || "";
    var br = /SamsungBrowser\//.test(ua) ? "삼성 인터넷" : /Edg\//.test(ua) ? "Edge" : /Whale\//.test(ua) ? "웨일" : /CriOS|Chrome\//.test(ua) ? "Chrome"
      : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "기타";
    var ver = (ua.match(/(?:SamsungBrowser|Edg|Whale|CriOS|Chrome|FxiOS|Firefox|Version)\/(\d+)/) || [])[1] || "";
    var os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "기타";
    var inApp = /KAKAOTALK/.test(ua) ? "카카오톡 안" : /NAVER\(/.test(ua) ? "네이버 앱 안" : /Instagram|FBAN|FBAV/.test(ua) ? "SNS 앱 안" : "";
    var s = document.querySelector('script[src*="/assets/index-"]');
    var build = s ? String(s.getAttribute("src")).replace(/^.*\/assets\/index-/, "").replace(/\.js.*$/, "") : "";
    return { browser: br + (ver ? " " + ver : ""), os: os, inApp: inApp, screen: window.innerWidth + "×" + window.innerHeight,
      dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100, theme: document.querySelector(".light") ? "라이트" : "다크", build: build };
  } catch (e) { return null; }
}
function envText(env) {
  if (!env || typeof env !== "object") return "";
  return [txt(env.browser), txt(env.os) + (txt(env.inApp) ? " · " + txt(env.inApp) : ""), txt(env.screen) + (env.dpr ? " @" + txt(env.dpr) + "x" : ""),
    txt(env.theme) ? txt(env.theme) + " 모드" : "", txt(env.build) ? "버전 " + txt(env.build) : ""].filter(Boolean).join(" · ");
}
/* 고객센터를 마지막으로 본 시각 — App 이 메뉴의 빨간 점에 쓰는 값과 같은 칸. 들어올 때의 값으로 '새 답변'을 가린다 */
function readSeen(uid) { try { return Number(localStorage.getItem("fb-seen-" + (uid || "")) || 0) || 0; } catch (e) { return 0; } }
function isFresh(x, me, seen) { return !!(seen && me && x.author_id === me && txt(x.answer) && ms(x.answered_at) > seen); }

/* ── 페이지 ─────────────────────────────────────────────── */

export default function FeedbackPage(p) {
  return (<div className="fb-root"><style>{THEME_CSS}</style>
    <Safe fallback={function () {
      return (<div style={{ padding: p.mobile ? "16px 12px 100px" : "22px 26px", maxWidth: 900 }}>
        <div style={Object.assign({}, CARD, { padding: "28px 18px", textAlign: "center" })}>
          <div style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>{"고객센터를 그리다 문제가 생겼어요"}</div>
          <div style={{ fontSize: 13, color: "var(--td)" }}>{"다른 메뉴는 그대로 쓸 수 있어요. 새로고침 뒤에도 계속되면 알려 주세요."}</div>
        </div></div>);
    }}><Board {...p} /></Safe></div>);
}

function Board(p) {
  var api = p.api || realApi, mob = p.mobile;
  var canWrite = p.authType === "google";
  var _sec = useState(p.section || "home"); var sec = _sec[0]; var setSecRaw = _sec[1];
  var _s = useState(""); var status = _s[0]; var setStatus = _s[1];
  var _m = useState(false); var mine = _m[0]; var setMine = _m[1];
  var _o = useState("new"); var sort = _o[0]; var setSort = _o[1];
  var _qi = useState(""); var qIn = _qi[0]; var setQIn = _qi[1];
  var _q = useState(""); var q = _q[0]; var setQ = _q[1];
  var _d = useState(null); var data = _d[0]; var setData = _d[1];
  var _h = useState(null); var home = _h[0]; var setHome = _h[1];
  var _open = useState(null); var openId = _open[0]; var setOpenId = _open[1];
  var _w = useState(null); var writing = _w[0]; var setWriting = _w[1];
  var _t = useState(""); var toast = _t[0]; var setToast = _t[1];
  /* 들어올 때 본 시각 — 이번에 머무는 동안은 '새 답변' 표시를 그대로 둔다 (App 은 들어오자마자 지금으로 바꾼다) */
  var seen = useRef(readSeen(p.userId)).current;
  var b = useBusy();
  var keyRef = useRef("");
  var scrollRef = useRef(null);
  var chipsRef = useRef(null);
  var listSec = sec === "notice" || sec === "update" || sec === "idea" || sec === "bug";
  var userSec = sec === "idea" || sec === "bug";
  var key = [sec, status, mine ? 1 : 0, sort, q].join("|");
  keyRef.current = key;
  /* init — 홈의 바로가기가 '내 글' · '접수' 를 켠 채로 들어가게 */
  var setSec = function (x, init) {
    if (x === sec && !init) return;
    setSecRaw(x); setStatus((init && init.status) || ""); setMine(!!(init && init.mine)); setSort("new"); setQIn(""); setQ(""); setData(null); b.setErr("");
    try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ }
  };
  var load = async function (more) {
    var my = key;
    b.setErr("");
    try {
      if (sec === "home") {
        var jobs = [api.loadPosts({ kind: "notice", limit: 3 }), api.loadPosts({ kind: "update", limit: 3 })];
        /* 운영자는 아직 '접수'인 건의 · 오류, 로그인한 사람은 내가 쓴 글 */
        if (p.isAdmin && canWrite) jobs.push(api.loadPosts({ kinds: ["bug", "idea"], status: "open", limit: 5 }));
        else if (canWrite) jobs.push(api.loadPosts({ mine: true, limit: 5 }));
        var hr = await Promise.all(jobs);
        if (keyRef.current !== my) return;
        setHome({ notice: hr[0].posts, update: hr[1].posts, mine: hr[2] ? hr[2].posts : null, me: hr[0].me });
        return;
      }
      if (!listSec) return;
      var off = more && data ? data.posts.length : 0;
      var r = await api.loadPosts({ kind: sec, status: userSec ? status : "", mine: userSec && mine, sort: userSec ? sort : "new", q: q, offset: off });
      if (keyRef.current !== my) return;
      setData(function (old) {
        if (!more || !old) return r;
        return { pinned: old.pinned, posts: old.posts.concat(r.posts), more: r.more, voted: Object.assign({}, old.voted, r.voted), me: r.me };
      });
    } catch (e) {
      if (keyRef.current !== my) return;
      b.setErr(e.message);
      if (sec === "home") setHome({ notice: [], update: [], mine: null, me: null });
      else if (!more) setData({ pinned: [], posts: [], more: false, voted: {}, me: null });
    }
  };
  useEffect(function () { load(false); }, [key]);
  useEffect(function () { if (p.onSeen) p.onSeen(); }, []);
  useEffect(function () { if (!toast) return; var t = setTimeout(function () { setToast(""); }, 4000); return function () { clearTimeout(t); }; }, [toast]);
  /* 찾기 — 치는 동안은 기다렸다가 0.35초 멈추면 찾는다 */
  useEffect(function () {
    if (qIn.trim() === q) return;
    var t = setTimeout(function () { setQ(qIn.trim()); }, 350);
    return function () { clearTimeout(t); };
  }, [qIn]);
  /* 고른 칸이 가로로 밀려 안 보이면 보이게 (폰에서 홈의 바로가기로 '오류 제보'에 들어간 경우) */
  useEffect(function () {
    var box = chipsRef.current; if (!box) return;
    var on = box.querySelector('[data-on="1"]'); if (!on) return;
    var l = on.offsetLeft - box.offsetLeft, r = l + on.offsetWidth;
    if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollLeft = Math.max(0, l - 12);
  }, [sec]);
  var openPost = function (id) { scrollRef.current = window.scrollY || 0; setOpenId(id); try { window.scrollTo(0, 0); } catch (e) { /* 무시 */ } };
  var closePost = function () { setOpenId(null); load(false); };
  useBackClose(!!openId, closePost);
  useEffect(function () {
    if (openId || scrollRef.current === null) return;
    var y = scrollRef.current; scrollRef.current = null;
    requestAnimationFrame(function () { try { window.scrollTo(0, y); } catch (e) { /* 무시 */ } });
  }, [openId]);
  var write = function (kind) {
    if (!canWrite) { setToast("구글 계정으로 로그인하면 글을 쓸 수 있어요 (게스트는 읽기만 돼요)"); return; }
    if (OFFICIAL[kind] && !p.isAdmin) return;
    setWriting(kind);
  };
  /* 칸마다 쓰기 단추 — 공지 · 업데이트 내역은 운영자에게만 */
  var wb = sec === "idea" ? ["💡 건의하기", "idea"] : sec === "bug" ? ["🐞 오류 제보하기", "bug"] : sec === "home" ? ["✏️ 건의 · 제보", "bug"]
    : (sec === "notice" || sec === "update") && p.isAdmin ? ["✏️ " + (sec === "notice" ? "공지 쓰기" : "업데이트 쓰기"), sec] : null;
  var chip = function (on) {
    return { padding: "7px 13px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
      background: on ? "rgba(255,213,79,.14)" : "var(--inner)", color: on ? "var(--acc)" : "var(--t2)", minHeight: 34 };
  };
  var head = (<div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <h2 style={{ fontSize: mob ? 17 : 19, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 1.5, color: "var(--t1)", margin: 0 }}>{"🎧 고객센터"}</h2>
      <div style={{ fontSize: 13, color: "var(--td)", marginTop: 6, lineHeight: 1.6 }}>{"공지 · 업데이트 소식을 보고, 사용법을 찾고, 오류 · 건의를 남기는 곳이에요."}</div>
    </div>
    {wb && <Btn pri onClick={function () { write(wb[1]); }}>{wb[0]}</Btn>}
  </div>);
  var tabs = (<div ref={chipsRef} className="fb-chips" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
    {SECTIONS.map(function (x) { return (<button key={x[0]} type="button" data-on={sec === x[0] ? "1" : "0"} onClick={function () { setSec(x[0]); }} style={chip(sec === x[0])}>{x[1]}</button>); })}
  </div>);
  var search = listSec && (<div style={{ position: "relative", marginBottom: 10 }}>
    <input value={qIn} onChange={function (e) { setQIn(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") setQ(qIn.trim()); }}
      placeholder={sec === "update" ? "업데이트 내역에서 찾기 (예: 발사각)" : sec === "notice" ? "공지에서 찾기" : mob ? "제목 · 내용에서 찾기" : "제목 · 내용에서 찾기 — 같은 글이 있으면 👍 공감을 눌러 주세요"}
      maxLength={40} style={Object.assign({}, INP, { padding: "9px 36px 9px 12px", fontSize: 13.5 })} />
    {qIn && <button type="button" aria-label="찾기 지우기" title="지우기" onClick={function () { setQIn(""); setQ(""); }}
      style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--td)", cursor: "pointer", padding: 8, fontSize: 14, lineHeight: 1 }}>{"✕"}</button>}
  </div>);
  var filters = userSec && (<div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
    <select value={status} onChange={function (e) { setStatus(e.target.value); }} title="처리 상태" style={Object.assign({}, INP, { width: "auto", padding: "7px 10px", fontSize: 13, colorScheme: "var(--fscheme)" })}>
      <option value="">{"모든 상태"}</option>
      {Object.keys(STATUS).map(function (k) { return <option key={k} value={k}>{STATUS[k][0]}</option>; })}
    </select>
    {canWrite && <button type="button" onClick={function () { setMine(!mine); }} style={chip(mine)}>{"내 글"}</button>}
    <div style={{ display: "flex", gap: 0, marginLeft: "auto", border: "1px solid var(--bd)", borderRadius: 8, overflow: "hidden" }}>
      {[["new", "최신순"], ["votes", "공감순"]].map(function (x) {
        return (<button key={x[0]} type="button" onClick={function () { setSort(x[0]); }} style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "inherit",
          background: sort === x[0] ? "rgba(255,213,79,.14)" : "transparent", color: sort === x[0] ? "var(--acc)" : "var(--td)", minHeight: 34 }}>{x[1]}</button>);
      })}
    </div>
  </div>);
  var EMPTY = { notice: "아직 공지가 없어요", update: "아직 업데이트 내역이 없어요", idea: "아직 건의가 없어요. 바라는 기능을 남겨 주세요 🙏", bug: "아직 제보가 없어요. 이상한 점을 발견하면 알려 주세요 🙏" };
  var body;
  if (sec === "home") body = <Home home={home} mob={mob} isAdmin={p.isAdmin} canWrite={canWrite} seen={seen} onGo={setSec} onOpen={openPost} />;
  else if (sec === "guide") body = <HelpGuide mobile={mob} onGo={setSec} />;
  else if (!data) body = <div style={{ color: "var(--td)", fontSize: 13, padding: "8px 0" }}>{"불러오는 중…"}</div>;
  else if (!data.posts.length && !data.pinned.length) body = (<div style={Object.assign({}, CARD, { padding: "34px 18px", textAlign: "center", color: "var(--td)", fontSize: 13.5, lineHeight: 1.7 })}>
    {b.err ? "글을 불러오지 못했어요" : q ? "'" + q + "' 이(가) 들어간 글이 없어요" : mine ? "아직 쓴 글이 없어요" : status ? "조건에 맞는 글이 없어요" : EMPTY[sec]}</div>);
  else body = (<div>
    {data.pinned.map(function (x) { return <Row key={x.id} x={x} voted={data.voted[x.id]} me={data.me} seen={seen} mob={mob} onOpen={openPost} />; })}
    {data.posts.map(function (x) { return <Row key={x.id} x={x} voted={data.voted[x.id]} me={data.me} seen={seen} mob={mob} onOpen={openPost} />; })}
    {data.more && <div style={{ textAlign: "center", margin: "10px 0" }}><Btn onClick={function () { b.run(function () { return load(true); }); }} disabled={b.busy}>{b.busy ? "불러오는 중…" : "더 보기"}</Btn></div>}
  </div>);
  return (<div style={{ padding: mob ? "14px 12px 100px" : "22px 26px", maxWidth: 900 }}>
    {openId && <Detail api={api} id={openId} mob={mob} isAdmin={p.isAdmin} canWrite={canWrite} seen={seen} onBack={closePost}
      onDeleted={function () { setToast("글을 지웠어요"); closePost(); }} onAlerts={p.onAlerts} />}
    <div style={{ display: openId ? "none" : "block" }}>
      {head}
      {tabs}
      <Msg bad={false} text={toast} />
      {search}
      {filters}
      <Msg text={b.err} />
      {body}
    </div>
    {writing && <Composer api={api} mob={mob} isAdmin={p.isAdmin} uid={p.userId} preset={writing} onClose={function () { setWriting(null); }}
      onDone={function (post) {
        setWriting(null);
        var k = (post && post.kind) || "bug";
        setToast(k === "notice" ? "공지를 올렸어요" : k === "update" ? "업데이트 내역을 올렸어요" : "올렸어요. 운영자가 확인하면 답을 달아요");
        if (k !== sec) setSec(k); else load(false);
      }} />}
  </div>);
}

/* 홈 — 바로가기 네 칸 · (로그인) 내 글 또는 (운영자) 확인할 글 · 소식(공지 · 업데이트를 한 칸에) */
function Home(p) {
  var mob = p.mob, h = p.home;
  var cards = [
    ["guide", "📖", "처음이라면", "사용설명서", "메뉴마다 무엇을 하는지 · 점수는 어떻게 계산되는지"],
    ["idea", "💡", "바라는 기능이 있다면", "건의사항", "다른 사람 건의에 👍 공감도 눌러 주세요"],
    ["bug", "🐞", "이상한 점을 발견했다면", "오류 제보", "화면 캡처를 붙이면 훨씬 빨리 찾아요"],
    ["update", "🆕", "무엇이 바뀌었나", "업데이트 내역", "날짜별로 바뀐 점을 모아 둬요"]
  ];
  var row = function (x, opts) {
    var k = KIND[x.kind] || KIND.idea, st = STATUS[x.status] || STATUS.open;
    var fresh = isFresh(x, h && h.me, p.seen);
    return (<div key={x.id} role="button" tabIndex={0} onClick={function () { p.onOpen(x.id); }} onKeyDown={function (e) { if (e.key === "Enter") p.onOpen(x.id); }}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", borderTop: "1px solid var(--bd)", cursor: "pointer", minHeight: 40 }}>
      {x.pinned ? <span title="고정" style={{ fontSize: 12 }}>{"📌"}</span> : opts && opts.kind ? <span title={k[1]} style={{ fontSize: 13 }}>{k[0]}</span> : null}
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{txt(x.title)}</span>
      {fresh && <Tag c="green" title="운영자 답변이 새로 달렸어요">{"💬 새 답변"}</Tag>}
      {opts && opts.status && !fresh && <Tag c={st[1]}>{st[0]}</Tag>}
      <span style={{ fontSize: 12, color: "var(--td)", whiteSpace: "nowrap" }}>{ago(x.created_at)}</span>
    </div>);
  };
  var box = function (title, list, foot, opts) {
    return (<div style={Object.assign({}, CARD, { padding: mob ? "14px 14px 8px" : "16px 18px 10px", minWidth: 0 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <b style={{ fontSize: 14.5 }}>{title}</b>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>{foot}</div>
      </div>
      {!h ? <div style={{ fontSize: 12.5, color: "var(--td)", padding: "8px 0 12px" }}>{"불러오는 중…"}</div>
        : !list || !list.length ? <div style={{ fontSize: 12.5, color: "var(--td)", padding: "8px 0 12px", lineHeight: 1.6 }}>{(opts && opts.empty) || "아직 없어요"}</div>
        : list.map(function (x) { return row(x, opts); })}
    </div>);
  };
  /* 소식 — 공지 · 업데이트를 최신순으로 한 칸에 (고정 공지는 맨 위). 첫날처럼 공지가 하나뿐이어도 칸이 비어 보이지 않게 */
  var news = h ? (h.notice || []).concat(h.update || []).sort(function (a, b) { return ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (ms(b.created_at) - ms(a.created_at)); }).slice(0, 5) : null;
  var go = function (sec, init, label) { return (<button key={label} type="button" onClick={function () { p.onGo(sec, init); }} style={LINK}>{label}</button>); };
  var mineBox = null;
  if (p.canWrite && p.isAdmin) mineBox = box("📥 확인할 글 — 아직 접수 상태", h && h.mine,
    [go("idea", { status: "open" }, "💡 건의 →"), go("bug", { status: "open" }, "🐞 오류 →")], { kind: 1, status: 1, empty: "새로 들어온 건의 · 오류가 없어요 👍" });
  else if (p.canWrite) mineBox = box("✍️ 내가 쓴 글", h && h.mine,
    [go("idea", { mine: true }, "💡 건의 →"), go("bug", { mine: true }, "🐞 오류 →")], { kind: 1, status: 1, empty: "아직 쓴 글이 없어요. 바라는 기능이나 이상한 점을 남겨 주세요." });
  return (<div>
    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4,minmax(0,1fr))", gap: 10, marginBottom: 12 }}>
      {cards.map(function (c) {
        return (<div key={c[0]} role="button" tabIndex={0} onClick={function () { p.onGo(c[0]); }} onKeyDown={function (e) { if (e.key === "Enter") p.onGo(c[0]); }}
          style={Object.assign({}, CARD, { padding: mob ? "14px 13px" : "16px 16px", cursor: "pointer", minWidth: 0 })}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>{c[1]}</div>
          <div style={{ fontSize: 12, color: "var(--td)", marginTop: 10 }}>{c[2]}</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2, color: "var(--t1)" }}>{c[3] + " →"}</div>
          {!mob && <div style={{ fontSize: 12, color: "var(--td)", marginTop: 6, lineHeight: 1.5 }}>{c[4]}</div>}
        </div>);
      })}
    </div>
    {mineBox && <div style={{ marginBottom: 12 }}>{mineBox}</div>}
    {box("📢 소식", news, [go("notice", null, "📢 공지 →"), go("update", null, "🆕 업데이트 →")], { kind: 1, empty: "아직 소식이 없어요" })}
  </div>);
}

/* 목록 한 줄 */
function Row(p) {
  var x = p.x, st = STATUS[x.status] || STATUS.open;
  var notice = !!OFFICIAL[x.kind];
  var fresh = isFresh(x, p.me, p.seen);
  var nImg = Array.isArray(x.images) ? x.images.length : 0;
  var preview = txt(x.body).replace(/\s*\n\s*/g, " ").trim();
  /* 칸마다 한 종류의 글만 있어서 종류 딱지(💡 건의 · 🆕 업데이트 …)는 달지 않는다 */
  var tags = [];
  if (x.pinned) tags.push(<Tag key="pin" c="acc">{"📌 고정"}</Tag>);
  if (!notice) tags.push(<Tag key="st" c={st[1]}>{st[0]}</Tag>);
  if (x.secret) tags.push(<Tag key="sec" title="쓴 사람과 운영자만 볼 수 있어요">{"🔒 비밀글"}</Tag>);
  if (txt(x.answer) && !notice) tags.push(fresh ? <Tag key="ans" c="green" title="운영자 답변이 새로 달렸어요">{"💬 새 답변"}</Tag> : <Tag key="ans" c="green" title="운영자 답변이 달렸어요">{"💬 답변"}</Tag>);
  return (<div onClick={function () { p.onOpen(x.id); }} role="button" tabIndex={0} onKeyDown={function (e) { if (e.key === "Enter") p.onOpen(x.id); }}
    style={Object.assign({}, CARD, { padding: p.mob ? "12px 14px" : "13px 16px", marginBottom: 8, cursor: "pointer" },
      x.pinned ? { background: "linear-gradient(90deg,rgba(255,213,79,.10),rgba(255,213,79,.02))", borderColor: "rgba(255,213,79,.25)" } : null)}>
    {tags.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap", marginBottom: 7 }}>{tags}</div>}
    <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.45, wordBreak: "break-word", color: "var(--t1)" }}>{txt(x.title)}</div>
    {preview && <div style={Object.assign({ fontSize: 13, color: "var(--td)", marginTop: 3, lineHeight: 1.55, wordBreak: "break-word" }, CLAMP2)}>{preview}</div>}
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 12, color: "var(--td)", flexWrap: "wrap" }}>
      <span style={{ fontWeight: 600, color: "var(--t2)" }}>{txt(x.nickname) || "익명"}</span>
      {x.by_admin && txt(x.nickname) !== "운영자" && <Tag c="acc">{"운영자"}</Tag>}
      {x.author_id && p.me && x.author_id === p.me && <Tag>{"내 글"}</Tag>}
      <span>{"· " + ago(x.created_at)}</span>
      {nImg > 0 && <span title={"사진 " + nImg + "장"}>{"· 📷 " + nImg}</span>}
      {!notice && <span style={{ marginLeft: "auto", color: p.voted ? "var(--acc)" : "var(--td)", fontWeight: p.voted ? 700 : 400 }}>{"👍 " + (Number(x.votes) || 0)}</span>}
    </div>
  </div>);
}

/* 글 보기 — 본문 · 사진 · 기기 정보 · 공감 · 운영자 답변 · 고치기 · (운영자) 상태 · 답변 · 고정 */
function Detail(p) {
  var api = p.api, mob = p.mob;
  var _d = useState(null); var d = _d[0]; var setD = _d[1];
  var _u = useState(null); var urls = _u[0]; var setUrls = _u[1];
  var _z = useState(null); var zoom = _z[0]; var setZoom = _z[1];
  var _a = useState(null); var form = _a[0]; var setForm = _a[1];
  var _e = useState(false); var editing = _e[0]; var setEditing = _e[1];
  var b = useBusy(), bv = useBusy(), ba = useBusy();
  var _ok = useState(""); var ok = _ok[0]; var setOk = _ok[1];
  var _n = useState(""); var note = _n[0]; var setNote = _n[1];
  var load = async function () {
    try {
      var r = await api.loadPost(p.id);
      if (!r) { b.setErr("지워졌거나 볼 수 없는 글이에요"); setD(false); return; }
      setD(r);
      setForm({ status: r.post.status, answer: txt(r.post.answer), pinned: !!r.post.pinned });
      var imgs = Array.isArray(r.post.images) ? r.post.images.filter(function (s) { return typeof s === "string" && s; }) : [];
      if (imgs.length) api.mediaUrls(imgs).then(function (m) { setUrls(m || {}); }).catch(function () { setUrls({}); });
    } catch (e) { b.setErr(e.message); setD(false); }
  };
  useEffect(function () { load(); }, [p.id]);
  var back = (<button type="button" onClick={p.onBack} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: "8px 10px 8px 0", marginBottom: 6, minHeight: 36, fontFamily: "inherit" }}>{"← 목록"}</button>);
  if (!d) return (<div>{back}{d === false ? <Msg text={b.err} /> : <div style={{ color: "var(--td)", fontSize: 13 }}>{"불러오는 중…"}</div>}</div>);
  var x = d.post, k = KIND[x.kind] || KIND.idea, st = STATUS[x.status] || STATUS.open;
  var notice = !!OFFICIAL[x.kind];
  var mine = !!d.me && x.author_id === d.me;
  var canEdit = mine || (notice && p.isAdmin);
  var imgs = Array.isArray(x.images) ? x.images.filter(function (s) { return typeof s === "string" && s; }) : [];
  var canVote = !notice && !x.secret && !mine;
  var voteLabel = x.kind === "bug" ? "나도 겪었어요" : "나도 원해요";
  var fresh = isFresh(x, d.me, p.seen);
  var doVote = function () {
    if (!p.canWrite) { bv.setErr("구글 계정으로 로그인하면 공감할 수 있어요"); return; }
    bv.run(async function () { await api.vote(x, !d.voted); await load(); });
  };
  var del = function () {
    if (!window.confirm(mine ? "이 글을 지울까요?" : "이 글을 지울까요? (운영자 권한)")) return;
    b.run(async function () { await api.deletePost(x); if (p.onAlerts) p.onAlerts(); p.onDeleted(); });
  };
  var save = function () {
    setOk("");
    ba.run(async function () {
      await api.adminUpdate(x.id, form.status, form.answer, form.pinned);
      await load(); if (p.onAlerts) p.onAlerts(); setOk("저장했어요");
    });
  };
  var editBtn = canEdit && <Btn sm onClick={function () { setNote(""); setEditing(true); }}>{"✏️ 고치기"}</Btn>;
  var delBtn = (mine || p.isAdmin) && <Btn sm no onClick={del} disabled={b.busy}>{notice ? (x.kind === "update" ? "업데이트 지우기" : "공지 지우기") : mine ? "내 글 지우기" : "글 지우기"}</Btn>;
  return (<div style={{ maxWidth: 760 }}>
    {back}
    <div style={Object.assign({}, CARD, { padding: mob ? "16px 15px" : "20px 22px" })}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
        {x.pinned && <Tag c="acc">{"📌 고정"}</Tag>}
        <Tag c={KIND_TONE[x.kind]}>{k[0] + " " + k[1]}</Tag>
        {!notice && <Tag c={st[1]}>{st[0]}</Tag>}
        {x.secret && <Tag title="쓴 사람과 운영자만 볼 수 있어요">{"🔒 비밀글"}</Tag>}
      </div>
      <h3 style={{ fontSize: 19, fontWeight: 900, margin: "10px 0 6px", lineHeight: 1.4, wordBreak: "break-word", color: "var(--t1)" }}>{txt(x.title)}</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--td)", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, color: "var(--t2)" }}>{txt(x.nickname) || "익명"}</span>{x.by_admin && txt(x.nickname) !== "운영자" && <Tag c="acc">{"운영자"}</Tag>}{mine && <Tag>{"내 글"}</Tag>}
        <span>{"· " + fmtWhen(x.created_at)}</span>
        {x.edited_at && <span title={"고친 시각 " + fmtWhen(x.edited_at)}>{"· 수정됨"}</span>}
      </div>
      {txt(x.body) && <div style={{ marginTop: 14 }}><PostBody text={txt(x.body)} links={notice && x.by_admin} /></div>}
      {imgs.length > 0 && (<div style={{ display: "grid", gridTemplateColumns: imgs.length === 1 ? "1fr" : "1fr 1fr", gap: 8, marginTop: 14 }}>
        {imgs.map(function (s) {
          var u = urls && urls[s];
          return (<button key={s} type="button" title="크게 보기" onClick={function () { if (u) setZoom(u); }} style={{ display: "block", width: "100%", padding: 0, border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden", background: "var(--inner)", cursor: u ? "zoom-in" : "default", minHeight: 120 }}>
            {u ? <img src={u} alt="" style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }} />
              : <span style={{ display: "block", padding: 40, fontSize: 12, color: "var(--td)" }}>{urls ? "사진을 불러오지 못했어요" : "사진 불러오는 중…"}</span>}
          </button>);
        })}
      </div>)}
      {x.env && (mine || p.isAdmin) && envText(x.env) && (<div style={{ marginTop: 14, padding: "9px 12px", borderRadius: 10, background: "var(--inner)", fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
        <span style={KICK}>{"기기 정보 · 쓴 사람과 운영자만 보여요"}</span><div style={{ marginTop: 2 }}>{envText(x.env)}</div></div>)}
      {(!notice || editBtn || delBtn) && (<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        {!notice && <Btn on={d.voted} disabled={!canVote || bv.busy} onClick={doVote}
          title={mine ? "내 글에는 공감할 수 없어요" : x.secret ? "비밀글에는 공감할 수 없어요" : "같은 일을 겪었거나 같은 기능을 바라면 눌러 주세요 — 운영자가 무엇부터 할지 정할 때 봐요"}>
          {"👍 " + voteLabel + " " + (Number(x.votes) || 0)}</Btn>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>{editBtn}{delBtn}</div>
      </div>)}
      <Msg text={bv.err || b.err} /><Msg bad={false} text={note} />
    </div>
    {txt(x.answer) && !notice && (<div style={Object.assign({}, CARD, { marginTop: 10, padding: mob ? "14px 15px" : "16px 22px", borderColor: "rgba(76,175,80,.35)", background: "rgba(76,175,80,.05)" })}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 800, color: "#4CAF50", flexWrap: "wrap" }}>{"💬 운영자 답변"}
        {fresh && <Tag c="green">{"새 답변"}</Tag>}
        {x.answered_at && <span style={{ fontWeight: 500, fontSize: 12, color: "var(--td)" }}>{fmtWhen(x.answered_at)}</span>}</div>
      <div style={{ marginTop: 8 }}><PostBody text={txt(x.answer)} size={14} /></div>
    </div>)}
    {!notice && !txt(x.answer) && mine && (<div style={{ marginTop: 10, fontSize: 12.5, color: "var(--td)", lineHeight: 1.6, padding: "0 4px" }}>
      {"운영자가 확인하면 여기에 답변이 달리고, 메뉴의 고객센터에 빨간 점이 떠요. 더 알릴 것이 생기면 '✏️ 고치기'로 내용을 덧붙여 주세요."}</div>)}
    {p.isAdmin && form && (<div style={Object.assign({}, CARD, { marginTop: 10, padding: mob ? "14px 15px" : "16px 22px", borderStyle: "dashed" })}>
      <div style={Object.assign({}, KICK, { marginBottom: 10 })}>{notice ? "운영자 — 고정 (나에게만 보여요)" : "운영자 — 상태 · 답변 (나에게만 보여요)"}</div>
      {!notice && (<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {Object.keys(STATUS).map(function (s) { return <Btn key={s} sm on={form.status === s} onClick={function () { setForm(Object.assign({}, form, { status: s })); }}>{STATUS[s][0]}</Btn>; })}
      </div>)}
      {!notice && <textarea value={form.answer} maxLength={3000} rows={4} placeholder="답변 — 글쓴이와 이 글을 보는 사람 모두에게 보여요. 비우면 답변이 내려가요"
        onChange={function (e) { setForm(Object.assign({}, form, { answer: e.target.value })); }} style={Object.assign({}, INP, { resize: "vertical", lineHeight: 1.6 })} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--t2)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.pinned} onChange={function (e) { setForm(Object.assign({}, form, { pinned: e.target.checked })); }} />{"맨 위에 고정"}</label>
        <Btn pri sm onClick={save} disabled={ba.busy} style={{ marginLeft: "auto" }}>{ba.busy ? "저장하는 중…" : "저장"}</Btn>
      </div>
      <Msg text={ba.err} /><Msg bad={false} text={ok} />
    </div>)}
    {zoom && <Viewer url={zoom} onClose={function () { setZoom(null); }} />}
    {editing && <Composer api={api} mob={mob} isAdmin={p.isAdmin} edit={x} onClose={function () { setEditing(false); }}
      onDone={function () { setEditing(false); setNote("고쳤어요"); load(); }} />}
  </div>);
}

/* 글쓰기 · 고치기 — 쓰던 글은 이 브라우저에 잠깐 남겨 둔다 (창을 실수로 닫아도 다시 열면 이어 쓴다) */
/* 쓰던 글은 계정마다 따로 — 한 기기에서 두 계정을 써도 섞이지 않게 */
var NICK_KEY = "fb-nick";
function draftKey(uid) { return "fb-draft-" + (uid || ""); }
function readDraft(uid) {
  try {
    var d = JSON.parse(localStorage.getItem(draftKey(uid)) || "null");
    if (!d || typeof d !== "object" || Date.now() - (Number(d.at) || 0) > 7 * 864e5) return null;
    return (txt(d.title) || txt(d.body)) ? d : null;
  } catch (e) { return null; }
}
function Composer(p) {
  var api = p.api, mob = p.mob, edit = p.edit || null;
  var DRAFT_KEY = draftKey(p.uid);
  var draft = useRef(edit ? null : readDraft(p.uid)).current;
  var allowed = function (k) { return !!k && (p.isAdmin || !OFFICIAL[k]); };
  var first = edit ? edit.kind : draft && allowed(draft.kind) ? draft.kind : allowed(p.preset) ? p.preset : "bug";
  var _k = useState(first); var kind = _k[0]; var setKind = _k[1];
  var _t = useState(edit ? txt(edit.title) : draft && draft.kind === first ? txt(draft.title) : ""); var title = _t[0]; var setTitle = _t[1];
  var _b = useState(edit ? txt(edit.body) : draft && draft.kind === first ? txt(draft.body) : ""); var body = _b[0]; var setBody = _b[1];
  var _dr = useState(!!(draft && draft.kind === first)); var restored = _dr[0]; var setRestored = _dr[1];
  var _f = useState([]); var files = _f[0]; var setFiles = _f[1];
  var _n = useState(function () { try { return localStorage.getItem(NICK_KEY) || ""; } catch (e) { return ""; } }); var nick = _n[0]; var setNick = _n[1];
  var _s = useState(false); var secret = _s[0]; var setSecret = _s[1];
  var _e = useState(true); var withEnv = _e[0]; var setWithEnv = _e[1];
  /* 고정 — 공지는 기본으로 고정, 업데이트 내역은 쌓이는 글이라 기본은 안 함. 직접 바꾸면 그대로 둔다 */
  var _pin = useState(first === "notice"); var pin = _pin[0]; var setPin = _pin[1];
  var _pt = useState(false); var pinTouched = _pt[0]; var setPinTouched = _pt[1];
  var env = useRef(envInfo()).current;
  var bz = useBusy();
  var fileRef = useRef(null);
  var previews = useRef({});
  useEffect(function () { return function () { Object.keys(previews.current).forEach(function (k) { try { URL.revokeObjectURL(previews.current[k]); } catch (e) { /* 무시 */ } }); }; }, []);
  /* 쓰던 글 남기기 — 새 글일 때만 (고치기는 서버에 원래 글이 있다) */
  useEffect(function () {
    if (edit) return;
    try {
      if (title.trim() || body.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ kind: kind, title: title, body: body, at: Date.now() }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* 무시 */ }
  }, [kind, title, body]);
  var prev = function (f, i) { var k = f.name + f.size + i; if (!previews.current[k]) previews.current[k] = URL.createObjectURL(f); return previews.current[k]; };
  var PH = { bug: "어떤 화면에서 · 무엇을 했을 때 · 어떻게 됐는지 적어 주세요.\n예) 라인업에서 세트덱 ⚡자동 최적화를 누르면 TOTAL 이 0 으로 보여요",
    idea: "어떤 기능이 있으면 좋을지, 왜 필요한지 적어 주세요.\n예) 덱 연구소 카드 고르기에 '팀별로 보기'가 있으면 좋겠어요", notice: "공지 내용 — '· '로 시작하는 줄은 점 목록으로 보여요",
    update: "바뀐 점을 한 줄씩 '· '로 시작해 적어 주세요.\n예) · 라이브 시너지에 올스타 카드도 셉니다\n· 세트덱 패널 글자가 잘리던 것을 고쳤어요" };
  var kinds = [["bug", "🐞 오류 제보"], ["idea", "💡 건의사항"]];
  if (p.isAdmin) { kinds.push(["notice", "📢 공지"]); kinds.push(["update", "🆕 업데이트 내역"]); }
  var pickKind = function (k) { setKind(k); bz.setErr(""); if (!pinTouched) setPin(k === "notice"); };
  var clearDraft = function () { setTitle(""); setBody(""); setRestored(false); try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ } };
  var addFiles = function (list) {
    var arr = Array.prototype.slice.call(list || []).filter(function (f) { return /^image\//.test(f.type || ""); });
    setFiles(files.concat(arr).slice(0, 2));
    if (files.length + arr.length > 2) bz.setErr("사진은 2장까지 붙일 수 있어요");
  };
  var submit = function () {
    bz.run(async function () {
      if (!title.trim()) throw new Error("제목을 적어 주세요");
      if (!OFFICIAL[kind] && body.trim().length < 5) throw new Error("내용을 조금만 더 적어 주세요 (5자 이상)");
      if (edit) { await api.editPost(edit.id, title.trim(), body.trim()); p.onDone(); return; }
      try { localStorage.setItem(NICK_KEY, nick.trim()); } catch (e) { /* 무시 */ }
      var post = await api.createPost({ kind: kind, title: title.trim(), body: body.trim(), nickname: nick.trim(), secret: !OFFICIAL[kind] && secret,
        env: kind === "bug" && withEnv ? env : null, pinned: !!OFFICIAL[kind] && pin }, files);
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* 무시 */ }
      p.onDone(post);
    });
  };
  var label = function (t, sub) { return (<div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "14px 0 6px" }}><span style={KICK}>{t}</span>{sub && <span style={{ fontSize: 11.5, color: "var(--td)" }}>{sub}</span>}</div>); };
  var check = function (on, set, head, sub) {
    return (<label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "var(--t1)", cursor: "pointer", lineHeight: 1.5 }}>
      <input type="checkbox" checked={on} onChange={function (e) { set(e.target.checked); }} style={{ marginTop: 3 }} />
      <span>{head}{sub && <span style={{ display: "block", fontSize: 12, color: "var(--td)" }}>{sub}</span>}</span></label>);
  };
  var ek = edit && (KIND[edit.kind] || KIND.idea);
  return (<Modal title={edit ? "글 고치기" : "글쓰기"} mobile={mob} onClose={p.onClose}
    foot={<React.Fragment><Btn onClick={p.onClose}>{"취소"}</Btn><Btn pri onClick={submit} disabled={bz.busy}>{bz.busy ? (edit ? "고치는 중…" : "올리는 중…") : edit ? "고치기" : "올리기"}</Btn></React.Fragment>}>
    {edit ? (<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--td)" }}>
      <Tag c={KIND_TONE[edit.kind]}>{ek[0] + " " + ek[1]}</Tag>{"제목 · 내용만 고칠 수 있어요 (사진 · 닉네임 · 비밀글은 그대로)"}</div>)
      : (<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {kinds.map(function (x) { return <Btn key={x[0]} on={kind === x[0]} onClick={function () { pickKind(x[0]); }}>{x[1]}</Btn>; })}
      </div>)}
    {restored && (<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", borderRadius: 10, background: "var(--inner)", fontSize: 12.5, color: "var(--t2)" }}>
      {"📝 쓰던 글을 불러왔어요"}<button type="button" onClick={clearDraft} style={Object.assign({}, LINK, { marginLeft: "auto", color: "var(--acc)", fontWeight: 700 })}>{"새로 쓰기"}</button></div>)}
    {label("제목", title.length + "/60")}
    <input value={title} maxLength={60} placeholder={kind === "bug" ? "예) 세트덱 자동 최적화 뒤 점수가 0 으로 보여요" : kind === "idea" ? "예) 덱 연구소에 팀별 보기 추가" : kind === "update" ? "예) 10/19 업데이트 — 불펜 전술 나누기" : "공지 제목"}
      onChange={function (e) { setTitle(e.target.value); if (bz.err) bz.setErr(""); }} style={INP} />
    {label("내용", body.length + "/3000")}
    <textarea value={body} maxLength={3000} rows={mob ? 6 : 7} placeholder={PH[kind]} onChange={function (e) { setBody(e.target.value); if (bz.err) bz.setErr(""); }}
      style={Object.assign({}, INP, { resize: "vertical", lineHeight: 1.65 })} />
    {!edit && (<React.Fragment>
      {label("사진", "2장까지 · 화면 캡처가 있으면 원인을 훨씬 빨리 찾아요")}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {files.map(function (f, i) {
          return (<div key={f.name + i} style={{ position: "relative", width: 76, height: 76, borderRadius: 10, overflow: "hidden", border: "1px solid var(--bd)", background: "var(--inner)" }}>
            <img src={prev(f, i)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button type="button" aria-label="사진 빼기" onClick={function () { setFiles(files.filter(function (_, j) { return j !== i; })); }}
              style={{ position: "absolute", top: 3, right: 3, width: 24, height: 24, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.65)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>{"✕"}</button>
          </div>);
        })}
        {files.length < 2 && <Btn sm onClick={function () { if (fileRef.current) fileRef.current.click(); }}>{"＋ 사진"}</Btn>}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={function (e) { addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {label("닉네임", OFFICIAL[kind] ? "비우면 '운영자'" : "비우면 '익명' · 다음에도 기억해요")}
      <input value={nick} maxLength={12} placeholder={OFFICIAL[kind] ? "운영자" : "익명"} onChange={function (e) { setNick(e.target.value); }} style={Object.assign({}, INP, { maxWidth: 260 })} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
        {!OFFICIAL[kind] && check(secret, setSecret, "🔒 비밀글", "나와 운영자만 볼 수 있어요")}
        {kind === "bug" && check(withEnv, setWithEnv, "기기 정보 같이 보내기", (envText(env) || "브라우저 · 화면 크기") + " — 나와 운영자만 봐요")}
        {!!OFFICIAL[kind] && check(pin, function (v) { setPin(v); setPinTouched(true); }, "📌 맨 위에 고정", kind === "update" ? "업데이트 내역은 보통 고정하지 않아요 (최신 글이 맨 위에 와요)" : null)}
      </div>
      <div style={{ fontSize: 12, color: "var(--td)", marginTop: 14, lineHeight: 1.6 }}>{"한 사람이 하루에 5개까지 쓸 수 있어요. 게임 계정 정보 같은 개인 정보는 적지 마세요. 욕설 · 광고가 담긴 글은 지울 수 있어요."}</div>
    </React.Fragment>)}
    <Msg text={bz.err} />
  </Modal>);
}
