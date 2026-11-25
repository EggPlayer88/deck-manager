/* 🎮 게임 계정 인증 · 덱 최신화 (2026-11, 사용자 컨셉)

   인증: 게임 프로필 창 '통계' 탭 캡처 1장 — ① 닉네임 ② 자기 소개 오른쪽 연필(내 계정에서만 보임 = 본인 증거)
         ③ 챌린지 모드 · 랭킹 챌린지 · 이전 시즌(점수 · 순위 · 전적 · 승률). 운영자가 보고 승인한다.
   혜택: 인증한 사람은 한 달에 한 번 '덱 최신화'를 요청한다 → 운영자가 하루 1 ~ 2번 지난 시즌 순위(구단별 100위)에서
         그 덱을 in100 처럼 읽어 사이트 덱 형식으로 보낸다 → 유저가 '도착한 덱'을 살펴보고 '반영'을 누른다.

   이 파일은 화면만. 서버 일은 verify-api.js, 덱 얹기 계산은 verify-apply.js, 실제 저장은 App(onApply)이 평소 저장 길로 한다.
   props: open · onClose · mobile · isAdmin · decks · curDeckId · deckMax · tools{ summarize, label, current } · onApply · onChanged · api(시험용) */
import React, { useState, useEffect, useRef } from "react";
import * as realApi from "./verify-api.js";
import { checkShot } from "./shot-check.js";
import { checkPayload, mergeIntoDeck, asNewDeck, diffSlots } from "./verify-apply.js";
import { useBackClose } from "./back-close.js";

export var VERIFY_TEAMS = ["LG", "KT", "SSG", "NC", "두산", "기아", "롯데", "삼성", "한화", "키움"];
var REJECT_PRESETS = ["자기 소개 오른쪽 연필(✏️)이 안 보여요", "챌린지 모드 · 랭킹 챌린지 · 이전 시즌이 안 보여요", "적은 닉네임이 캡처와 달라요", "편집한 캡처로 보여요"];
var FAIL_PRESETS = ["지난 시즌 구단 100위 안에서 찾지 못했어요", "게임 화면을 읽지 못했어요 — 다시 요청해 주세요", "닉네임이 바뀌어 찾지 못했어요 — 다시 인증해 주세요"];

var INP = { width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--bd)", background: "var(--inner)", color: "var(--t1)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
var BTN = { padding: "9px 14px", fontSize: 13, fontWeight: 800, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", minHeight: 38 };
function primary(on) { return Object.assign({}, BTN, { background: on ? "var(--acc)" : "var(--inner)", color: on ? "var(--acc-ink)" : "var(--td)", cursor: on ? "pointer" : "default" }); }
var GHOST = Object.assign({}, BTN, { fontWeight: 600, background: "transparent", border: "1px solid var(--bd)", color: "var(--t2)" });
var LINK = { background: "none", border: "none", padding: "6px 2px", fontSize: 12, color: "var(--td)", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" };

/* 화면 오류 경계 — 이 창에서 오류가 나도 앱 전체가 꺼지지 않게 (클럽 라운지 · 고객센터와 같은 생각) */
class SafeBox extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: e }; }
  componentDidCatch(e) { try { console.error("[계정 인증 창]", e); } catch (x) { /* 무시 */ } }
  render() {
    if (!this.state.err) return this.props.children;
    return (<div onClick={this.props.onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,12,.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={function (e) { e.stopPropagation(); }} style={{ maxWidth: 360, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 14, padding: 18, fontSize: 13, lineHeight: 1.6, color: "var(--t1)" }}>
        <b>{"화면을 그리다 문제가 생겼어요"}</b>
        <div style={{ color: "var(--t2)", marginTop: 6 }}>{"덱은 그대로예요. 창을 닫고 다시 열어 주세요. 계속되면 고객센터로 알려 주세요."}</div>
        <button type="button" onClick={this.props.onClose} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 9, border: "1px solid var(--bd)", background: "transparent", color: "var(--t2)", cursor: "pointer", fontFamily: "inherit" }}>{"닫기"}</button>
      </div>
    </div>);
  }
}
/* 올린 캡처 점검값 — 사용자가 보낸 값이라 모양을 믿지 않는다 */
function flagsOf(checks) {
  var f = checks && Array.isArray(checks.flags) ? checks.flags : [];
  return f.filter(function (x) { return x && typeof x === "object" && typeof x.t === "string"; }).slice(0, 12)
    .map(function (x) { return { lv: x.lv === "warn" ? "warn" : "info", t: x.t.slice(0, 160) }; });
}
function kst(ts, withTime) {
  if (!ts) return "";
  var d = new Date(new Date(ts).getTime() + 9 * 3600e3);
  var s = (d.getUTCMonth() + 1) + "월 " + d.getUTCDate() + "일";
  return withTime ? s + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") : s;
}
function fmt(n) { return n == null || isNaN(n) ? "—" : Number(n).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function deckName(decks, d) {
  if (!d) return "";
  var same = (decks || []).filter(function (x) { return x.teamName === d.teamName; });
  var i = same.map(function (x) { return x.deckId; }).indexOf(d.deckId);
  return (d.teamName || "내 덱") + (same.length > 1 ? " " + (i + 1) : "");
}
function Note(p) {
  var c = p.kind === "err" ? "var(--vf-err)" : p.kind === "ok" ? "var(--vf-ok)" : p.kind === "warn" ? "var(--vf-warn)" : "var(--t2)";
  var bg = p.kind === "err" ? "rgba(255,82,82,.08)" : p.kind === "ok" ? "rgba(102,187,106,.08)" : p.kind === "warn" ? "rgba(255,167,38,.08)" : "var(--inner)";
  return (<div style={Object.assign({ fontSize: 12.5, lineHeight: 1.6, color: c, background: bg, borderRadius: 9, padding: "8px 11px" }, p.style || {})}>{p.children}</div>);
}
function Sec(p) {
  return (<div style={{ marginTop: 14 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><b style={{ fontSize: 13.5 }}>{p.title}</b>{p.right && <span style={{ marginLeft: "auto" }}>{p.right}</span>}</div>
    {p.children}
  </div>);
}

/* ── 어떤 화면을 찍는지 — 게임 화면을 본뜬 그림 (실제 캡처 대신: 닉네임 · 게임 그림이 공개 사이트에 안 남게) ── */
export function GuideFigure(p) {
  var W = p.width || 250;
  var mark = function (n) { return (<span style={{ position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)", width: 18, height: 18, borderRadius: "50%", background: "#FF5A5A", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 2px var(--bg)" }}>{n}</span>); };
  var ring = { position: "relative", outline: "2px solid #FF5A5A", outlineOffset: 1, borderRadius: 4 };
  var row = function (k, v) { return (<div style={{ display: "flex", gap: 6, fontSize: 9.5, lineHeight: 1.45 }}><span style={{ color: "#8a94a6", width: 24 }}>{k}</span><span style={{ color: "#1f2633" }}>{v}</span></div>); };
  return (<div aria-label="게임 프로필 통계 탭 예시 그림" style={{ width: W, margin: "0 auto", background: "#6c7486", borderRadius: 12, padding: 8, boxSizing: "border-box", fontFamily: "inherit", userSelect: "none" }}>
    <div style={Object.assign({}, ring, { display: "flex", alignItems: "center", gap: 6, background: "#2b313d", padding: "6px 8px" })}>
      <span style={{ width: 16, height: 16, borderRadius: 4, background: "#c62828", flexShrink: 0 }} />
      <span style={{ color: "#fff", fontSize: 12, fontWeight: 800 }}>{"내 닉네임"}</span>
      {mark(1)}
    </div>
    <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
      <div style={{ flex: 1, background: "#2b313d", color: "#5ce1ff", fontSize: 13, fontWeight: 900, textAlign: "center", padding: "3px 0", borderRadius: 3 }}>{"OVR"}</div>
      <div style={{ flex: 2.4, background: "#f1f3f6", color: "#1f2633", fontSize: 9, padding: "4px 6px", borderRadius: 3 }}>{"타자 · 투수 · 세트덱 · 클럽"}</div>
    </div>
    <div style={Object.assign({}, ring, { display: "flex", alignItems: "center", marginTop: 4, background: "#3a404c", padding: "5px 8px" })}>
      <span style={{ color: "#e8ecf2", fontSize: 9.5, flex: 1 }}>{"자기 소개 (최대 30자까지 입력 가능합니다.)"}</span>
      <span style={{ fontSize: 12, marginRight: 8 }}>{"✏️"}</span>
      {mark(2)}
    </div>
    <div style={{ display: "flex", marginTop: 6, fontSize: 9.5, textAlign: "center" }}>
      {["타자", "투수", "통계", "구단 정보"].map(function (t) { var on = t === "통계"; return (<span key={t} style={{ flex: 1, padding: "4px 0", background: on ? "#0d47a1" : "#d5d9e0", color: on ? "#fff" : "#8a94a6", fontWeight: on ? 800 : 500 }}>{t}</span>); })}
    </div>
    <div style={Object.assign({}, ring, { marginTop: 6, background: "#f1f3f6", paddingBottom: 6 })}>
      <div style={{ background: "#3a404c", color: "#fff", fontSize: 10.5, fontWeight: 800, textAlign: "center", padding: "3px 0" }}>{"챌린지 모드"}</div>
      <div style={{ background: "#5b6270", color: "#fff", fontSize: 10, fontWeight: 700, textAlign: "center", padding: "2px 0" }}>{"랭킹 챌린지"}</div>
      <div style={{ display: "flex", gap: 6, padding: "4px 8px 0" }}>
        {[["이전 시즌", "1,530점", "812 위", "400승 3무 127패", "0.759"], ["최고 시즌", "1,602점", "455 위", "…", "…"]].map(function (c) {
          return (<div key={c[0]} style={{ flex: 1 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#1f2633", marginBottom: 2 }}>{c[0]}</div>
            {row("점수", c[1])}{row("순위", c[2])}{row("전적", c[3])}{row("승률", c[4])}
          </div>);
        })}
      </div>
      {mark(3)}
    </div>
  </div>);
}

/* ── 인증 신청 ── */
function VerifyForm(p) {
  var api = p.api;
  var _n = useState(p.nickname || ""); var nick = _n[0]; var setNick = _n[1];
  var _t = useState(VERIFY_TEAMS.indexOf(p.team) >= 0 ? p.team : ""); var team = _t[0]; var setTeam = _t[1];
  var _f = useState(null); var file = _f[0]; var setFile = _f[1];
  var _u = useState(""); var preview = _u[0]; var setPreview = _u[1];
  var _c = useState(false); var agree = _c[0]; var setAgree = _c[1];
  var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  useEffect(function () { return function () { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);
  var ready = nick.trim() && team && file && agree && !busy;
  var pick = function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!/^image\//.test(f.type || "")) { setErr("그림 파일(캡처)만 올릴 수 있어요"); return; }
    if (f.size > 25 * 1024 * 1024) { setErr("파일이 너무 커요 (25MB 까지)"); return; }
    setErr(""); setFile(f); setPreview(URL.createObjectURL(f));
  };
  var send = async function () {
    if (!ready) return;
    setBusy(true); setErr("");
    try {
      var checks = null;
      try { checks = await checkShot(file); } catch (x) { checks = null; }
      var path = await api.uploadShot(file);
      try { await api.submitVerify(nick.trim(), team, path, checks); }
      catch (x) { api.removeMyShot(path); throw x; }   /* 신청이 안 됐으면 올린 캡처도 남기지 않는다 */
      setBusy(false); p.onDone();
    } catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  return (<div>
    <Sec title="① 이 화면을 캡처해 주세요">
      <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, marginBottom: 10 }}>
        {"게임에서 내 프로필 → "}<b>{"통계"}</b>{" 탭을 열고, 살짝 위로 올려 아래 세 가지가 한 화면에 보이게 찍어요."}
      </div>
      <GuideFigure width={p.mobile ? 236 : 250} />
      <div style={{ display: "grid", gap: 5, marginTop: 10, fontSize: 12.5, lineHeight: 1.55 }}>
        <div><b style={{ color: "#FF5A5A" }}>{"① "}</b>{"닉네임"}</div>
        <div><b style={{ color: "#FF5A5A" }}>{"② "}</b>{"자기 소개 오른쪽 연필(✏️) — "}<b>{"내 계정에서만 보여요"}</b>{". 이게 본인 증거예요"}</div>
        <div><b style={{ color: "#FF5A5A" }}>{"③ "}</b>{"챌린지 모드 · 랭킹 챌린지 · 이전 시즌(점수 · 순위 · 전적 · 승률)"}</div>
      </div>
    </Sec>
    <Sec title="② 닉네임 · 구단 · 캡처">
      <div style={{ display: "grid", gap: 8 }}>
        <input value={nick} maxLength={20} onChange={function (e) { setNick(e.target.value); }} placeholder="게임 닉네임 (캡처와 똑같이)" autoComplete="off" spellCheck={false} style={INP} aria-label="게임 닉네임" />
        <select value={team} onChange={function (e) { setTeam(e.target.value); }} style={INP} aria-label="게임 구단">
          <option value="">{"게임에서 고른 구단"}</option>
          {VERIFY_TEAMS.map(function (t) { return (<option key={t} value={t}>{t}</option>); })}
        </select>
        <label style={Object.assign({}, GHOST, { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textAlign: "center", boxSizing: "border-box" })}>
          <span>{file ? "📷 캡처 바꾸기" : "📷 캡처 고르기"}</span>
          <input type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
        </label>
        {preview && (<img src={preview} alt="고른 캡처" style={{ maxWidth: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 9, border: "1px solid var(--bd)", background: "var(--inner)", justifySelf: "center" }} />)}
      </div>
    </Sec>
    <Sec title="③ 동의">
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.6, color: "var(--t2)", cursor: "pointer" }}>
        <input type="checkbox" checked={agree} onChange={function (e) { setAgree(e.target.checked); }} style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0 }} />
        <span>{"운영자가 게임 안에서 내 프로필 · 덱을 직접 열어 보고 이 사이트로 옮기는 데 동의해요. 캡처는 운영자만 보고, 심사 30일 뒤 지워요."}</span>
      </label>
    </Sec>
    {err && (<Note kind="err" style={{ marginTop: 10 }}>{err}</Note>)}
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      {p.onCancel && (<button type="button" onClick={p.onCancel} style={GHOST}>{"뒤로"}</button>)}
      <button type="button" onClick={send} disabled={!ready} style={Object.assign(primary(ready), { flex: 1 })}>{busy ? "올리는 중…" : "인증 신청"}</button>
    </div>
  </div>);
}

/* ── 덱 최신화 (인증한 사람) ── */
function RefreshBox(p) {
  var api = p.api, me = p.me, decks = p.decks || [];
  var list = me.refresh || [];
  var open = list.filter(function (r) { return r.status === "requested" || r.status === "working"; })[0] || null;
  var arrived = list.filter(function (r) { return r.status === "arrived"; })[0] || null;
  var last = list[0] || null;
  var cur = decks.filter(function (d) { return d.deckId === p.curDeckId; })[0] || null;
  var canNew = decks.length < (p.deckMax || 7);
  var _t = useState(cur ? "deck" : "new"); var target = _t[0]; var setTarget = _t[1];
  var _m = useState(""); var memo = _m[0]; var setMemo = _m[1];
  var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var tgt = target === "new" && !canNew ? (cur ? "deck" : "") : target;
  var send = async function () {
    if (busy || !tgt) return;
    setBusy(true); setErr("");
    try { await api.requestRefresh(tgt, tgt === "deck" ? cur.deckId : null, tgt === "deck" ? deckName(decks, cur) : "새 덱", memo.trim()); setBusy(false); p.reload(); }
    catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  var cancel = async function () {
    setBusy(true); setErr("");
    try { await api.cancelRefresh(open.id); setBusy(false); p.reload(); } catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  var body;
  if (arrived) {
    var sm = arrived.summary || {};
    body = (<div style={{ border: "1px solid rgba(255,213,79,.45)", background: "rgba(255,213,79,.07)", borderRadius: 11, padding: 12 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800 }}>{"📦 덱이 도착했어요"}</div>
      <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, lineHeight: 1.6 }}>
        {kst(arrived.delivered_at, true) + " 수집 · " + (arrived.target === "deck" ? "받을 곳: " + (arrived.deck_label || "지금 덱") : "새 덱으로") + (sm.total ? " · TOTAL " + fmt(sm.total) : "")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={function () { p.openArrived(arrived); }} style={Object.assign(primary(true), { flex: 1 })}>{"살펴보고 반영"}</button>
      </div>
    </div>);
  } else if (open) {
    body = (<Note>
      <div style={{ fontWeight: 800, color: "var(--t1)" }}>{open.status === "working" ? "⏳ 수집 중이에요" : "🕘 요청했어요 — 다음 처리 때 수집해요"}</div>
      <div style={{ marginTop: 2 }}>{kst(open.requested_at, true) + " 요청 · " + (open.target === "deck" ? (open.deck_label || "지금 덱") + "에 덮어쓰기" : "새 덱으로") + (open.memo ? " · " + open.memo : "")}</div>
      {open.status === "requested" && (<button type="button" onClick={cancel} disabled={busy} style={Object.assign({}, LINK, { marginTop: 2 })}>{"요청 거두기"}</button>)}
    </Note>);
  } else if (me.nextAt) {
    body = (<Note>{"이번 달 최신화는 했어요 — 다음은 "}<b>{kst(me.nextAt)}</b>{"부터 할 수 있어요 (한 달에 한 번)"}</Note>);
  } else {
    body = (<div style={{ display: "grid", gap: 8 }}>
      {last && last.status === "failed" && (<Note kind="warn">{"지난 요청은 처리하지 못했어요 — " + (last.reason || "까닭 미상") + ". 횟수는 그대로라 다시 요청할 수 있어요."}</Note>)}
      <div role="radiogroup" aria-label="받을 곳" style={{ display: "grid", gap: 6 }}>
        {cur && (<label style={radioRow(tgt === "deck")}><input type="radio" checked={tgt === "deck"} onChange={function () { setTarget("deck"); }} style={{ width: 16, height: 16 }} />
          <span>{"지금 덱 "}<b>{deckName(decks, cur)}</b>{"에 덮어쓰기"}</span></label>)}
        <label style={Object.assign(radioRow(tgt === "new"), canNew ? {} : { opacity: .5, cursor: "default" })} title={canNew ? "" : "덱이 " + (p.deckMax || 7) + "개라 새 덱을 더 만들 수 없어요"}>
          <input type="radio" disabled={!canNew} checked={tgt === "new"} onChange={function () { setTarget("new"); }} style={{ width: 16, height: 16 }} />
          <span>{"새 덱으로 받기"}{!canNew && (<span style={{ color: "var(--td)", fontSize: 11.5 }}>{" — 덱이 가득 찼어요"}</span>)}</span></label>
      </div>
      <input value={memo} maxLength={100} onChange={function (e) { setMemo(e.target.value); }} placeholder="지난 시즌 순위 (선택 · 예: 812위)" style={INP} aria-label="남길 말" />
      <button type="button" onClick={send} disabled={busy || !tgt} style={primary(!busy && !!tgt)}>{busy ? "보내는 중…" : "덱 최신화 요청"}</button>
    </div>);
  }
  return (<Sec title="🔄 덱 최신화">
    {body}
    {err && (<Note kind="err" style={{ marginTop: 8 }}>{err}</Note>)}
    <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.65, marginTop: 10 }}>
      {"· 한 달에 한 번 (매달 1일에 다시) · 운영자가 하루 1 ~ 2번 게임에서 직접 읽어요"}<br />
      {"· 지난 시즌 랭킹 챌린지 "}<b>{"구단 100위 안"}</b>{"이어야 찾을 수 있어요 — 못 찾으면 횟수는 안 깎여요"}<br />
      {"· 전술(적극 · 분업)과 같은 타순 묶음 안 순서는 게임 화면에 없어 지금 설정을 그대로 써요"}
    </div>
  </Sec>);
}
function radioRow(on) {
  return { display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", borderRadius: 9, border: "1px solid " + (on ? "var(--acc)" : "var(--bd)"), background: on ? "rgba(255,213,79,.06)" : "var(--inner)", fontSize: 12.5, cursor: "pointer", minHeight: 38, boxSizing: "border-box" };
}

/* ── 도착한 덱 살펴보기 · 반영 ── */
var KIND = { same: ["같음", "var(--td)"], stat: ["능력 바뀜", "var(--vf-info)"], card: ["카드 바뀜", "var(--vf-warn)"], "new": ["새로", "var(--vf-ok)"], gone: ["빠짐", "var(--vf-red)"] };
function ArrivedView(p) {
  var api = p.api, row = p.row, decks = p.decks || [], tools = p.tools || {};
  var _d = useState(null); var data = _d[0]; var setData = _d[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
  var tdeck = decks.filter(function (d) { return d.deckId === row.deck_id; })[0] || null;
  var canNew = decks.length < (p.deckMax || 7);
  var _m = useState(row.target === "deck" && tdeck ? "deck" : "new"); var mode = _m[0]; var setMode = _m[1];
  useEffect(function () {
    var alive = true;
    api.loadPayload(row.id).then(function (r) { if (alive) setData(r); }, function (x) { if (alive) setErr(x.message || String(x)); });
    return function () { alive = false; };
  }, [row.id]);
  var bad = data ? checkPayload(data.payload) : "";
  var team = (data && data.payload && data.payload.team) || row.team || "";
  var teamOf = function (d) { var t = d && d.teamName; return t === "KIA" ? "기아" : (t || ""); };
  var teamDiff = mode === "deck" && tdeck && team && teamOf(tdeck) !== team;
  /* 견줄 지금 덱 — 받을 곳이 지금 열린 덱일 때만 화면 값으로 센다. 다른 덱이면 반영할 때 그 덱으로 바꿔 넣는다 */
  var curOpen = mode === "deck" && tdeck && tdeck.deckId === p.curDeckId && tools.current ? tools.current() : null;
  var view = null;
  if (data && !bad) {
    try {
      var stamp = 1;
      var next = mode === "deck" && curOpen ? mergeIntoDeck(curOpen, data.payload, stamp, tools.canon) : asNewDeck(data.payload, stamp);
      var after = tools.summarize ? tools.summarize(next.players, next.lineupMap, next.sdConfig, team) : null;
      var before = curOpen && tools.summarize ? tools.summarize(curOpen.players, curOpen.lineupMap, curOpen.sdState, teamOf(tdeck)) : null;
      var rows = diffSlots(curOpen || { players: [], lineupMap: {} }, next, tools.label, tools.canon);
      view = { after: after, before: before, rows: rows, report: next.report || null };
    } catch (x) { view = { error: x.message || String(x) }; }
  }
  /* 반영은 App 이 맡는다 — 창을 닫고(덱을 바꿔 읽는 동안 이 창이 사라진다) 덱 저장 · 반영 표시 · 알림까지 끝낸다 */
  var apply = function () {
    if (busy || !data || bad) return;
    if (mode === "new" && !canNew) { setErr("덱이 가득 차서 새 덱을 만들 수 없어요 — 지금 덱에 덮어쓰기를 골라 주세요"); return; }
    setBusy(true); setErr("");
    p.onApply(row, data.payload, mode === "deck" ? tdeck.deckId : null);
  };
  var discard = async function () {
    if (!window.confirm("도착한 덱을 버릴까요?\n이번 달 최신화 횟수는 이미 쓴 것으로 남아요.")) return;
    setBusy(true); setErr("");
    try { await api.closeRefresh(row.id, false); setBusy(false); p.onDone("버렸어요"); } catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  var sm = row.summary || {};
  return (<div>
    <button type="button" onClick={p.onBack} style={Object.assign({}, LINK, { textDecoration: "none" })}>{"‹ 돌아가기"}</button>
    <div style={{ fontSize: 15, fontWeight: 900, marginTop: 2 }}>{"📦 도착한 덱"}</div>
    <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 3, lineHeight: 1.6 }}>
      {kst(row.delivered_at, true) + " 게임에서 읽음 · " + (team || row.team || "") + (sm.cards ? " · 카드 " + sm.cards + "장" : "")}
    </div>
    {sm.checks && sm.checks.length > 0 && (<div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
      {sm.checks.map(function (c, i) { return (<span key={i} title={c.tip || ""} style={{ fontSize: 11.5, padding: "2px 8px", borderRadius: 20, background: c.ok ? "rgba(102,187,106,.12)" : "rgba(255,167,38,.14)", color: c.ok ? "var(--vf-ok)" : "var(--vf-warn)" }}>{(c.ok ? "✓ " : "! ") + c.t}</span>); })}
    </div>)}
    <div role="radiogroup" aria-label="넣을 곳" style={{ display: "grid", gap: 6, marginTop: 12 }}>
      {tdeck && (<label style={radioRow(mode === "deck")}><input type="radio" checked={mode === "deck"} onChange={function () { setMode("deck"); }} style={{ width: 16, height: 16 }} />
        <span>{"덱 "}<b>{deckName(decks, tdeck)}</b>{"에 덮어쓰기"}{tdeck.deckId !== p.curDeckId && (<span style={{ color: "var(--td)", fontSize: 11.5 }}>{" — 그 덱으로 바꿔 넣어요"}</span>)}</span></label>)}
      <label style={Object.assign(radioRow(mode === "new"), canNew ? {} : { opacity: .5, cursor: "default" })}>
        <input type="radio" disabled={!canNew} checked={mode === "new"} onChange={function () { setMode("new"); }} style={{ width: 16, height: 16 }} />
        <span>{"새 덱으로 (" + (team || row.team || "") + ")"}{!canNew && (<span style={{ color: "var(--td)", fontSize: 11.5 }}>{" — 덱이 가득 찼어요"}</span>)}</span></label>
    </div>
    {!data && !err && (<Note style={{ marginTop: 12 }}>{"불러오는 중…"}</Note>)}
    {bad && (<Note kind="err" style={{ marginTop: 12 }}>{"이 덱은 반영할 수 없어요 — " + bad + ". 고객센터로 알려 주세요."}</Note>)}
    {view && view.error && (<Note kind="err" style={{ marginTop: 12 }}>{"계산하지 못했어요 — " + view.error}</Note>)}
    {data && !bad && Array.isArray(data.payload.missing) && data.payload.missing.length > 0 && (<Note kind="warn" style={{ marginTop: 12 }}>{"도감에 없는 카드(시즌 카드 등)라 못 옮긴 자리: " + data.payload.missing.join(" · ") + (mode === "deck" ? " — 덮어쓸 때는 그 자리의 지금 선수를 그대로 둬요" : " — 새 덱에서는 비어 있어요. 반영한 뒤 직접 넣어 주세요")}</Note>)}
    {view && !view.error && (<React.Fragment>
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginTop: 12 }}>
        {view.before && (<div style={scoreBox(false)}><div style={{ fontSize: 11, color: "var(--td)" }}>{"지금 덱"}</div><div style={{ fontSize: 17, fontWeight: 900, fontFamily: "var(--h)" }}>{fmt(view.before.total)}</div></div>)}
        <div style={scoreBox(true)}><div style={{ fontSize: 11, color: "var(--td)" }}>{view.before ? "반영 뒤" : "도착한 덱"}</div>
          <div style={{ fontSize: 17, fontWeight: 900, fontFamily: "var(--h)", color: "var(--acc)" }}>{view.after ? fmt(view.after.total) : "—"}</div>
          {view.before && view.after && (<div style={{ fontSize: 11.5, fontWeight: 800, color: view.after.total >= view.before.total ? "var(--vf-ok)" : "var(--vf-red)" }}>{(view.after.total >= view.before.total ? "+" : "") + fmt(view.after.total - view.before.total)}</div>)}
        </div>
        {view.after && (<div style={scoreBox(false)}><div style={{ fontSize: 11, color: "var(--td)" }}>{"셋포"}</div><div style={{ fontSize: 17, fontWeight: 900, fontFamily: "var(--h)" }}>{view.after.setPoint}</div></div>)}
      </div>
      {mode === "deck" && !curOpen && tdeck && (<div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: "var(--t2)" }}>
        <span style={{ flex: 1, minWidth: 160 }}>{"받을 덱(" + deckName(decks, tdeck) + ")이 지금 열린 덱이 아니라 견주지 못했어요"}</span>
        {p.onOpenDeck && (<button type="button" onClick={function () { p.onOpenDeck(tdeck.deckId); }} style={Object.assign({}, GHOST, { padding: "6px 12px", fontSize: 12, minHeight: 32 })}>{"그 덱 열어 비교"}</button>)}
      </div>)}
      {teamDiff && (<Note kind="warn" style={{ marginTop: 8 }}>{"이 덱 구단(" + (teamOf(tdeck) || "없음") + ")이 게임 구단(" + team + ")과 달라요 — 반영하면 덱 구단도 " + team + "(으)로 바뀌어요"}</Note>)}
      <div style={{ marginTop: 12, border: "1px solid var(--bd)", borderRadius: 10, overflow: "hidden" }}>
        {view.rows.map(function (r) {
          var k = KIND[r.kind] || KIND.same;
          return (<div key={r.slot} style={{ display: "grid", gridTemplateColumns: p.mobile ? "38px 1fr auto" : (curOpen ? "40px 1fr 1fr auto" : "40px 1fr auto"), gap: "2px 8px", alignItems: "center", padding: "6px 10px", borderTop: "1px solid var(--bd)", fontSize: 12, background: r.kind === "same" ? "transparent" : "rgba(255,255,255,.02)" }}>
            <span style={{ fontFamily: "var(--m)", fontSize: 11, color: "var(--td)" }}>{r.slot}</span>
            {p.mobile ? (<span style={{ minWidth: 0 }}>
              {curOpen && r.kind !== "same" && r.before && (<span style={{ display: "block", color: "var(--td)", textDecoration: "line-through", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.before}</span>)}
              <span style={{ display: "block", color: r.kind === "gone" ? "var(--td)" : "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.after || "—"}</span>
            </span>) : (<React.Fragment>
              {curOpen && (<span style={{ color: "var(--td)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.before || "—"}</span>)}
              <span style={{ color: r.kind === "gone" ? "var(--td)" : "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.after || "—"}</span>
            </React.Fragment>)}
            <span style={{ fontSize: 11, fontWeight: 700, color: k[1], whiteSpace: "nowrap" }}>{curOpen || r.kind === "same" ? k[0] : ""}</span>
          </div>);
        })}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--td)", lineHeight: 1.65, marginTop: 8 }}>
        {mode === "deck" ? "· 카드 · 훈련 · 특훈 · 강화 · 스킬 · 잠재 · 셋포 구간 · 라커룸 · 포특 레벨 · 불펜 편성은 게임대로 바뀌어요" : "· 게임에서 읽은 그대로 새 덱을 만들어요"}<br />
        {"· 전술 · 같은 타순 묶음 안 순서 · 포특 스킬 · POTM 설정은 지금 덱 설정을 지켜요 (새 덱은 기본값)"}<br />
        {mode === "deck" ? "· '내 선수'에 있던 다른 선수는 그대로 남아요" : ""}
      </div>
    </React.Fragment>)}
    {err && (<Note kind="err" style={{ marginTop: 10 }}>{err}</Note>)}
    <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
      <button type="button" onClick={discard} disabled={busy} style={GHOST} title="도착한 덱을 반영하지 않고 버려요">{"버리기"}</button>
      <button type="button" onClick={p.onBack} disabled={busy} style={GHOST}>{"나중에"}</button>
      <button type="button" onClick={apply} disabled={busy || !data || !!bad || (view && view.error)} style={Object.assign(primary(!busy && !!data && !bad), { flex: 1, minWidth: 110 })}>{busy ? "넣는 중…" : "반영"}</button>
    </div>
  </div>);
}
function scoreBox(hi) { return { flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 10, background: hi ? "rgba(255,213,79,.07)" : "var(--inner)", border: "1px solid " + (hi ? "rgba(255,213,79,.35)" : "var(--bd)") }; }

/* ── 관리자: 인증 심사 ── */
function AdminReview(p) {
  var api = p.api;
  var _l = useState(null); var list = _l[0]; var setList = _l[1];
  var _u = useState({}); var urls = _u[0]; var setUrls = _u[1];
  var _a = useState(null); var accs = _a[0]; var setAccs = _a[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var _b = useState(""); var busy = _b[0]; var setBusy = _b[1];
  var _pv = useState({}); var prev = _pv[0]; var setPrev = _pv[1];
  var _sa = useState(false); var showAcc = _sa[0]; var setShowAcc = _sa[1];
  var load = function () {
    setErr("");
    api.adminPending().then(function (l) { setList(l); return api.shotUrls(l.map(function (x) { return x.shot; })); }).then(function (u) { if (u) setUrls(u); }, function (x) { setErr(x.message); setList(function (o) { return o || []; }); });
  };
  useEffect(function () { load(); api.purgeOldShots().catch(function () {}); }, []);
  var setPv = function (id, k, v) { setPrev(function (o) { var n = Object.assign({}, o); n[id] = Object.assign({}, n[id], (function () { var x = {}; x[k] = v; return x; })()); return n; }); };
  var prevOf = function (id) {
    var v = prev[id] || {}; var o = {}; var any = false;
    ["score", "rank", "w", "d", "l"].forEach(function (k) { var n = parseInt(String(v[k] || "").replace(/[^0-9]/g, ""), 10); if (!isNaN(n)) { o[k] = n; any = true; } });
    return any ? o : null;
  };
  var decide = async function (a, ok) {
    var reason = "";
    if (!ok) {
      reason = window.prompt("반려 사유 (유저에게 보여요)\n\n" + REJECT_PRESETS.map(function (t, i) { return (i + 1) + ". " + t; }).join("\n") + "\n\n번호나 글을 적어 주세요", "1");
      if (reason === null) return;
      var n = parseInt(reason, 10); if (n >= 1 && n <= REJECT_PRESETS.length && String(n) === reason.trim()) reason = REJECT_PRESETS[n - 1];
    }
    setBusy(a.id); setErr("");
    try { await api.reviewVerify(a.id, ok, reason, ok ? prevOf(a.id) : null); setBusy(""); load(); p.onChanged(); }
    catch (x) { setBusy(""); setErr(x.message || String(x)); }
  };
  var revoke = async function (acc) {
    var reason = window.prompt("'" + acc.nickname + "' 연결을 해제할까요? 사유 (유저에게 보여요)", "본인 계정이 아닌 것으로 확인돼 해제했어요");
    if (reason === null) return;
    try { await api.revokeAccount(acc.user_id, reason); setAccs(null); toggleAcc(true); p.onChanged(); } catch (x) { setErr(x.message || String(x)); }
  };
  var toggleAcc = function (force) {
    var on = force === true ? true : !showAcc; setShowAcc(on);
    if (on) api.adminAccounts().then(setAccs, function (x) { setErr(x.message); });
  };
  var pin = { width: "100%", minWidth: 0, padding: "6px 7px", fontSize: 12 };
  return (<div>
    {err && (<Note kind="err" style={{ marginBottom: 10 }}>{err}</Note>)}
    {!list && (<Note>{"불러오는 중…"}</Note>)}
    {list && list.length === 0 && (<Note>{"심사할 신청이 없어요"}</Note>)}
    <div style={{ display: "grid", gap: 12 }}>
      {(list || []).map(function (a) {
        var flags = flagsOf(a.checks);
        return (<div key={a.id} style={{ border: "1px solid var(--bd)", borderRadius: 11, padding: 11, background: "var(--card)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: p.mobile ? "wrap" : "nowrap" }}>
            <a href={urls[a.shot] || undefined} target="_blank" rel="noopener noreferrer" title="크게 보기" style={{ flexShrink: 0, width: p.mobile ? "100%" : 150, display: "block" }}>
              {urls[a.shot] ? (<img src={urls[a.shot]} alt="인증 캡처" style={{ width: "100%", maxHeight: p.mobile ? 380 : 300, objectFit: "contain", borderRadius: 8, background: "var(--inner)" }} />)
                : (<div style={{ height: 120, borderRadius: 8, background: "var(--inner)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--td)" }}>{a.shot ? "캡처 불러오는 중" : "캡처 없음"}</div>)}
            </a>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.65 }}>
              <div style={{ fontSize: 14.5, fontWeight: 900 }}>{a.nickname}<span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>{" · " + a.team}</span></div>
              <div style={{ color: "var(--td)", fontSize: 11.5 }}>{kst(a.created_at, true) + " 신청 · " + String(a.user_id).slice(0, 8)}</div>
              {a.current && (<div style={{ color: "var(--vf-info)" }}>{"지금 연결: " + a.current.nickname + " · " + a.current.team + " (닉네임 바꿈?)"}</div>)}
              {a.conflict && (<div style={{ color: "var(--vf-err)", fontWeight: 700 }}>{"⚠ 이 닉네임은 다른 계정(" + String(a.conflict.user_id).slice(0, 8) + ", " + kst(a.conflict.linked_at) + " 연결)에 연결돼 있어요 — 되찾기면 그 연결을 먼저 해제"}</div>)}
              {flags.map(function (f, i) { return (<div key={i} style={{ color: f.lv === "warn" ? "var(--vf-warn)" : "var(--td)", fontSize: 11.5 }}>{(f.lv === "warn" ? "⚠ " : "· ") + f.t}</div>); })}
              <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 6 }}>{"확인: ① 닉네임 = 적은 닉네임 ② 자기 소개 오른쪽 연필 ③ 챌린지 모드 · 랭킹 챌린지 · 이전 시즌"}</div>
              <div style={{ fontSize: 11, color: "var(--td)", marginTop: 8 }}>{"캡처의 이전 시즌 (선택 — 덱을 찾는 열쇠)"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1.2fr 1fr .8fr 1fr", gap: 4, marginTop: 4 }}>
                {[["score", "점수"], ["rank", "순위"], ["w", "승"], ["d", "무"], ["l", "패"]].map(function (k) {
                  return (<input key={k[0]} value={(prev[a.id] || {})[k[0]] || ""} onChange={function (e) { setPv(a.id, k[0], e.target.value); }} placeholder={k[1]} inputMode="numeric" aria-label={k[1]} style={Object.assign({}, INP, pin)} />);
                })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <button type="button" onClick={function () { decide(a, false); }} disabled={!!busy} style={GHOST}>{"반려"}</button>
                <button type="button" onClick={function () { decide(a, true); }} disabled={!!busy} style={Object.assign(primary(!busy), { flex: 1 })}>{busy === a.id ? "처리 중…" : "승인"}</button>
              </div>
            </div>
          </div>
        </div>);
      })}
    </div>
    <div style={{ marginTop: 14 }}>
      <button type="button" onClick={function () { toggleAcc(); }} style={Object.assign({}, LINK, { textDecoration: "none", fontWeight: 700 })}>{(showAcc ? "▾ " : "▸ ") + "연결된 계정" + (accs ? " " + accs.length : "")}</button>
      {showAcc && (<div style={{ display: "grid", gap: 4, marginTop: 4 }}>
        {(accs || []).map(function (c) {
          return (<div key={c.user_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "6px 9px", borderRadius: 8, background: "var(--inner)" }}>
            <span style={{ fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nickname}</span>
            <span style={{ color: "var(--td)", whiteSpace: "nowrap" }}>{c.team + " · " + kst(c.linked_at)}</span>
            <button type="button" onClick={function () { revoke(c); }} style={Object.assign({}, LINK, { marginLeft: "auto", color: "var(--vf-red)" })}>{"해제"}</button>
          </div>);
        })}
        {accs && accs.length === 0 && (<div style={{ fontSize: 12, color: "var(--td)" }}>{"아직 없어요"}</div>)}
      </div>)}
    </div>
  </div>);
}

/* ── 관리자: 최신화 대기열 (수집 · 도착은 운영자 도구가 보낸다 — 여기서는 보고 실패 처리만) ── */
var ST = { requested: ["기다림", "var(--vf-warn)"], working: ["수집 중", "var(--vf-info)"], arrived: ["도착", "var(--vf-gold)"], applied: ["반영함", "var(--vf-ok)"], discarded: ["버림", "var(--td)"], failed: ["실패", "var(--vf-red)"], cancelled: ["거둠", "var(--td)"] };
function AdminQueue(p) {
  var api = p.api;
  var _q = useState(null); var q = _q[0]; var setQ = _q[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var load = function () { setErr(""); api.adminQueue().then(setQ, function (x) { setErr(x.message); setQ({ open: [], done: [] }); }); };
  useEffect(load, []);
  var failIt = async function (r) {
    var reason = window.prompt("실패 사유 (유저에게 보여요 · 횟수는 안 깎여요)\n\n" + FAIL_PRESETS.map(function (t, i) { return (i + 1) + ". " + t; }).join("\n"), "1");
    if (reason === null) return;
    var n = parseInt(reason, 10); if (n >= 1 && n <= FAIL_PRESETS.length && String(n) === reason.trim()) reason = FAIL_PRESETS[n - 1];
    try { await api.failRefresh(r.id, reason); load(); p.onChanged(); } catch (x) { setErr(x.message || String(x)); }
  };
  var line = function (r, act) {
    var s = ST[r.status] || [r.status, "var(--td)"];
    return (<div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "7px 9px", borderRadius: 8, background: "var(--inner)", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: s[1], minWidth: 44 }}>{s[0]}</span>
      <span style={{ fontWeight: 700 }}>{r.nickname}</span>
      <span style={{ color: "var(--td)" }}>{r.team + " · " + kst(r.requested_at, true) + (r.target === "deck" ? " · 덮어쓰기" : " · 새 덱") + (r.memo ? " · " + r.memo : "") + (r.reason ? " · " + r.reason : "")}</span>
      {act && (<button type="button" onClick={function () { failIt(r); }} style={Object.assign({}, LINK, { marginLeft: "auto", color: "var(--vf-red)" })}>{"실패 처리"}</button>)}
    </div>);
  };
  return (<div>
    {err && (<Note kind="err" style={{ marginBottom: 10 }}>{err}</Note>)}
    <Note style={{ marginBottom: 10 }}>{"수집 · 도착은 운영자 도구가 보내요. 여기서는 기다리는 요청을 보고, 찾지 못한 요청을 실패로 돌릴 수 있어요 (횟수 안 깎임)."}</Note>
    {!q && (<Note>{"불러오는 중…"}</Note>)}
    {q && (<React.Fragment>
      <div style={{ fontSize: 12.5, fontWeight: 800, margin: "4px 0 6px" }}>{"기다림 · 수집 중 " + q.open.length}</div>
      <div style={{ display: "grid", gap: 4 }}>{q.open.map(function (r) { return line(r, true); })}{q.open.length === 0 && (<div style={{ fontSize: 12, color: "var(--td)" }}>{"없어요"}</div>)}</div>
      <div style={{ fontSize: 12.5, fontWeight: 800, margin: "14px 0 6px" }}>{"최근 2주"}</div>
      <div style={{ display: "grid", gap: 4 }}>{q.done.map(function (r) { return line(r, false); })}{q.done.length === 0 && (<div style={{ fontSize: 12, color: "var(--td)" }}>{"없어요"}</div>)}</div>
    </React.Fragment>)}
  </div>);
}

/* ── 창 ── (오류 경계로 감싼다) */
export default function VerifyModal(p) {
  if (!p.open) return null;
  return (<SafeBox onClose={p.onClose}><VerifyModalInner {...p} /></SafeBox>);
}
function VerifyModalInner(p) {
  var api = p.api || realApi;
  var _m = useState(null); var me = _m[0]; var setMe = _m[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var _v = useState("main"); var view = _v[0]; var setView = _v[1];     /* main | form | arrived */
  var _r = useState(null); var arrivedRow = _r[0]; var setArrivedRow = _r[1];
  var _t = useState("me"); var tab = _t[0]; var setTab = _t[1];         /* me | review | queue (관리자) */
  var _d = useState(""); var done = _d[0]; var setDone = _d[1];
  var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
  var autoRef = useRef(false);   /* 알림으로 연 창은 도착한 덱을 한 번만 바로 연다 — 돌아간 뒤 다시 읽어도 튀지 않게 */
  useBackClose(!!p.open, function () { p.onClose(); });
  var seqRef = useRef(0);   /* 늦게 온 옛 대답이 새 상태를 덮지 않게 */
  var reload = function () {
    setErr(""); var my = ++seqRef.current;
    return api.loadMine().then(function (x) { if (my === seqRef.current) setMe(x); return x; },
      function (x) { if (my !== seqRef.current) return; setErr(x.message || String(x)); setMe(function (o) { return o || { refresh: [] }; }); });
  };
  useEffect(function () {
    if (!p.open) { setView("main"); setArrivedRow(null); setDone(""); setTab("me"); autoRef.current = false; return; }
    reload();
  }, [p.open]);
  /* 메뉴의 '도착한 덱' 알림에서 바로 열기 */
  useEffect(function () {
    if (!p.open || !me || !p.openArrived || autoRef.current) return;
    var a = (me.refresh || []).filter(function (r) { return r.status === "arrived"; })[0];
    if (a && view === "main") { autoRef.current = true; setArrivedRow(a); setView("arrived"); }
  }, [p.open, me]);
  if (!p.open) return null;
  var mob = p.mobile;
  var acc = me && me.account, req = me && me.request;
  var changed = function (msg) { setDone(msg || ""); setView("main"); setArrivedRow(null); reload(); if (p.onChanged) p.onChanged(); };
  var cancelReq = async function () {
    setBusy(true);
    try { await api.cancelVerify(); setBusy(false); changed("신청을 거뒀어요"); } catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  var unlink = async function () {
    if (!window.confirm("게임 계정 연결을 풀까요?\n덱 최신화를 못 쓰게 되고, 기다리던 요청도 거둬요. 다시 쓰려면 인증을 새로 받아야 해요.")) return;
    setBusy(true);
    try { await api.unlinkAccount(); setBusy(false); changed("연결을 풀었어요"); } catch (x) { setBusy(false); setErr(x.message || String(x)); }
  };
  var adminTabs = p.isAdmin ? [["me", "내 인증"], ["review", "심사" + (p.alerts && p.alerts.review ? " " + p.alerts.review : "")], ["queue", "최신화 대기열" + (p.alerts && p.alerts.queue ? " " + p.alerts.queue : "")]] : null;
  var main;
  if (tab === "review") main = (<AdminReview api={api} mobile={mob} onChanged={function () { if (p.onChanged) p.onChanged(); }} />);
  else if (tab === "queue") main = (<AdminQueue api={api} mobile={mob} onChanged={function () { if (p.onChanged) p.onChanged(); }} />);
  else if (!me) main = (<Note>{err ? err : "불러오는 중…"}</Note>);
  else if (view === "arrived" && arrivedRow) main = (<ArrivedView api={api} row={arrivedRow} mobile={mob} decks={p.decks} curDeckId={p.curDeckId} deckMax={p.deckMax} tools={p.tools}
    onApply={p.onApply} onOpenDeck={p.onOpenDeck} onBack={function () { setView("main"); setArrivedRow(null); }} onDone={changed} />);
  else if (view === "form" || (!acc && !(req && req.status === "pending"))) {
    var lastBad = req && (req.status === "rejected" || req.status === "revoked") ? req : null;
    main = (<div>
      {acc && (<Note style={{ marginBottom: 6 }}>{"지금 연결: " + acc.nickname + " · " + acc.team + " — 새로 인증하면 승인될 때 이 연결이 바뀌어요"}</Note>)}
      {!acc && (<div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.7 }}>
        {"게임 계정을 인증하면 "}<b>{"한 달에 한 번"}</b>{", 게임 속 내 덱을 운영자가 직접 읽어 이 사이트 덱으로 옮겨 드려요. 손으로 넣을 때 빠지거나 틀리는 칸이 없어져요."}
      </div>)}
      {lastBad && (<Note kind="err" style={{ marginTop: 10 }}>{(lastBad.status === "revoked" ? "연결이 해제됐어요" : "지난 신청이 반려됐어요") + (lastBad.reason ? " — " + lastBad.reason : "") + ". 다시 신청할 수 있어요."}</Note>)}
      <VerifyForm api={api} mobile={mob} nickname={(req && req.nickname) || ""} team={(req && req.team) || p.team || ""}
        onCancel={view === "form" ? function () { setView("main"); } : null} onDone={function () { changed("신청했어요 — 심사가 끝나면 여기서 알려 드려요"); }} />
    </div>);
  } else if (req && req.status === "pending" && !acc) {
    main = (<div>
      <Note kind="warn"><b>{"⏳ 심사 중이에요"}</b>{" — 보통 하루 안에 끝나요"}<br />{req.nickname + " · " + req.team + " · " + kst(req.created_at, true) + " 신청"}</Note>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" onClick={function () { setView("form"); }} style={GHOST}>{"다시 올리기"}</button>
        <button type="button" onClick={cancelReq} disabled={busy} style={GHOST}>{"신청 거두기"}</button>
      </div>
    </div>);
  } else {
    var pv = acc.prev || null;
    main = (<div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px", borderRadius: 11, background: "rgba(102,187,106,.08)", border: "1px solid rgba(102,187,106,.35)" }}>
        <span style={{ fontSize: 22 }}>{"✅"}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.nickname}<span style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)" }}>{" · " + acc.team}</span></div>
          <div style={{ fontSize: 11.5, color: "var(--t2)" }}>{"인증됨 · " + kst(acc.linked_at) + (pv && pv.rank ? " · 인증 때 지난 시즌 " + pv.rank + "위" : "")}</div>
        </div>
      </div>
      {req && req.status === "pending" && (<Note kind="warn" style={{ marginTop: 8 }}>{"새 인증(" + req.nickname + " · " + req.team + ") 심사 중이에요"}</Note>)}
      <RefreshBox api={api} me={me} decks={p.decks} curDeckId={p.curDeckId} deckMax={p.deckMax} reload={reload}
        openArrived={function (r) { setArrivedRow(r); setView("arrived"); }} />
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <button type="button" onClick={function () { setView("form"); }} style={LINK} title="게임 닉네임을 바꿨을 때">{"닉네임 바뀜 · 다시 인증"}</button>
        <button type="button" onClick={unlink} disabled={busy} style={Object.assign({}, LINK, { marginLeft: "auto" })}>{"연결 풀기"}</button>
      </div>
    </div>);
  }
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,12,.6)", display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center" }}>
    <div onClick={function (e) { e.stopPropagation(); }} role="dialog" aria-label="게임 계정 인증"
      style={{ width: mob ? "100%" : (tab === "review" ? 620 : 460), maxHeight: mob ? "90vh" : "88vh", overflowY: "auto", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: mob ? "16px 16px 0 0" : 14, boxShadow: "0 18px 50px rgba(0,0,0,.4)", boxSizing: "border-box" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--bg)", borderBottom: "1px solid var(--bd)" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px" }}>
          <b style={{ fontSize: 14.5 }}>{"🎮 게임 계정 인증"}</b>
          <button type="button" onClick={p.onClose} aria-label="닫기" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 8, minWidth: 34, minHeight: 34 }}>{"✕"}</button>
        </div>
        {adminTabs && (<div style={{ display: "flex", gap: 4, padding: "0 12px 8px" }}>
          {adminTabs.map(function (t) { var on = tab === t[0]; return (<button key={t[0]} type="button" onClick={function () { setTab(t[0]); }}
            style={{ padding: "6px 10px", fontSize: 12, fontWeight: on ? 800 : 500, borderRadius: 8, border: "1px solid " + (on ? "var(--acc)" : "var(--bd)"), background: on ? "rgba(255,213,79,.08)" : "transparent", color: on ? "var(--acc)" : "var(--t2)", cursor: "pointer", fontFamily: "inherit", minHeight: 32 }}>{t[1]}</button>); })}
        </div>)}
      </div>
      <div style={{ padding: "12px 16px 18px" }}>
        {done && tab === "me" && view === "main" && (<Note kind="ok" style={{ marginBottom: 10 }}>{done}</Note>)}
        {err && me && tab === "me" && (<Note kind="err" style={{ marginBottom: 10 }}>{err}</Note>)}
        {main}
      </div>
    </div>
  </div>);
}

/* ── 메뉴 단추 — 폰 계정 메뉴 · PC · 태블릿 메뉴 아래쪽 ── */
export function VerifyMenuButton(p) {
  var a = p.alerts || {};
  var dot = (a.arrived || 0) + (p.isAdmin ? (a.review || 0) + (a.queue || 0) : 0) > 0;
  var state = a.arrived ? "덱 도착" : a.verified ? "인증됨" : a.pending ? "심사 중" : "";
  var tip = "게임 계정 인증 · 덱 최신화" + (a.arrived ? " — 도착한 덱이 있어요" : "") + (p.isAdmin && a.review ? " · 심사 " + a.review : "") + (p.isAdmin && a.queue ? " · 대기열 " + a.queue : "");
  return (<button type="button" onClick={p.onClick} title={tip} aria-label={tip}
    style={Object.assign({ display: "flex", alignItems: "center", gap: 6, width: "100%", padding: p.compact ? 5 : 7, fontSize: p.compact ? 11 : 12, background: "var(--inner)", border: "1px solid " + (a.arrived ? "rgba(255,213,79,.55)" : "var(--bd)"), borderRadius: p.round || 4, color: "var(--t2)", cursor: "pointer", marginBottom: p.compact ? 4 : 6, fontFamily: "inherit", boxSizing: "border-box", justifyContent: "center" }, p.style || {})}>
    <span>{"🎮 계정 인증"}</span>
    {state && (<span style={{ fontSize: 10, fontWeight: 800, color: a.arrived ? "var(--acc)" : a.verified ? "var(--vf-ok)" : "var(--vf-warn)" }}>{state}</span>)}
    {dot && (<span style={{ width: 7, height: 7, borderRadius: "50%", background: "#FF5A5A", flexShrink: 0 }} />)}
  </button>);
}
