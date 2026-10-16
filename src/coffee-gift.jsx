/* 개발자에게 커피 — 카카오톡 선물하기의 '선물코드'를 받아 둔다 (2026-10-16 사용자 요청: 구석에 아주 작게, 거부감 없게).

   흐름
   - 보내는 사람: 카카오톡 선물하기에서 커피를 고르고 받는 사람 대신 '선물코드'로 결제 → 나온 코드를 여기에 붙여 넣는다.
     친구 추가도, 운영자 신상도 필요 없다
   - 운영자(profiles.is_admin): 같은 창에서 받은 코드를 보고, 카카오톡 선물함 → '선물코드 등록'에 넣는다

   코드는 돈과 같다 — 운영자만 읽는다. 표 · 정책은 supabase/coffee_gifts.sql (보내기는 로그인한 사람만, 하루 5번까지) */
import React, { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

var GIFT_URL = "https://gift.kakao.com";
var CODE_RE = /^[A-Za-z0-9-]{6,40}$/;
var MSG_MAX = 40;

/* 선물코드 정리 — 붙여 넣을 때 딸려 오는 빈칸 · 줄바꿈을 뗀다 */
export function cleanCode(s) { return String(s || "").replace(/\s+/g, "").trim(); }
export function codeOk(s) { return CODE_RE.test(cleanCode(s)); }

function fail(error) {
  var m = (error && (error.message || error.error_description)) || String(error || "");
  if (/coffee_gifts/.test(m) && /does not exist|not find|schema cache/i.test(m)) return new Error("아직 준비 중이에요. 조금 뒤에 다시 해 주세요");
  if (/하루에/.test(m)) return new Error(m);
  if (/JWT|not authenticated|permission denied|row-level security/i.test(m)) return new Error("로그인이 필요해요. 다시 로그인해 주세요");
  return new Error("보내지 못했어요. 잠시 뒤 다시 해 주세요");
}
var realApi = {
  send: async function (code, message) {
    if (!supabase) throw new Error("서버에 연결돼 있지 않아요");
    var r = await supabase.from("coffee_gifts").insert({ code: cleanCode(code), message: message ? message.trim().slice(0, MSG_MAX) : null });
    if (r.error) throw fail(r.error);
  },
  list: async function () {
    if (!supabase) return [];
    var r = await supabase.from("coffee_gifts").select("id,created_at,code,message,used").order("created_at", { ascending: false }).limit(100);
    if (r.error) throw fail(r.error);
    return r.data || [];
  },
  mark: async function (id, used) {
    var r = await supabase.from("coffee_gifts").update({ used: used }).eq("id", id);
    if (r.error) throw fail(r.error);
  }
};

/* ── 구석의 작은 버튼 — 메뉴 맨 아래(side) · 휴대폰 위 막대(bar) ── */
var HOVER = (<style>{".coffee-link:hover{opacity:1 !important;color:var(--t2) !important}"}</style>);
/* 글자는 '개발자에게 커피 한 잔' 그대로 — 줄이면 무슨 메뉴인지 모른다 (2026-10-16 사용자 지정).
   휴대폰 위 막대에서는 칸이 모자라면 뒤를 … 로 자르고 한 줄을 지킨다 */
export function CoffeeLink(p) {
  var tip = "개발자에게 커피 한 잔 — 카카오톡 기프티콘";
  var label = "☕ 개발자에게 커피 한 잔";
  if (p.kind === "bar") {
    return (<React.Fragment><button type="button" className="coffee-link" onClick={p.onClick} title={tip} aria-label={tip}
      style={{ marginLeft: "auto", padding: "4px 4px", fontSize: 10.5, lineHeight: 1.2, background: "none", border: "none", color: "var(--td)", cursor: "pointer", opacity: .8,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0, flexShrink: 1, fontFamily: "inherit" }}>{label}</button>{HOVER}</React.Fragment>);
  }
  return (<React.Fragment><button type="button" className="coffee-link" onClick={p.onClick} title={tip}
    style={{ display: "block", width: "100%", marginTop: 6, padding: "2px 0", fontSize: 10, background: "none", border: "none", color: "var(--td)", cursor: "pointer", opacity: .75, fontFamily: "inherit", whiteSpace: "nowrap" }}>{label}</button>{HOVER}</React.Fragment>);
}

var INP = { width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--bd)", background: "var(--inner)", color: "var(--t1)", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
function Step(p) {
  return (<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
    <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,213,79,.14)", color: "var(--acc)", fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>{p.n}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{p.children}</div>
  </div>);
}
function ago(ts) {
  var s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 3600) return Math.max(1, Math.floor(s / 60)) + "분 전";
  if (s < 86400) return Math.floor(s / 3600) + "시간 전";
  var d = new Date(ts); return (d.getMonth() + 1) + "/" + d.getDate();
}

/* ── 운영자에게만: 받은 코드 ── */
function Inbox(p) {
  var api = p.api;
  var _l = useState(null); var list = _l[0]; var setList = _l[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var _c = useState(null); var copied = _c[0]; var setCopied = _c[1];
  var load = function () { setErr(""); api.list().then(setList, function (e) { setErr(e.message); setList([]); }); };
  useEffect(load, []);
  var copy = function (g) {
    try { navigator.clipboard.writeText(g.code); } catch (e) {}
    setCopied(g.id); setTimeout(function () { setCopied(null); }, 1500);
  };
  var toggle = function (g) {
    var v = !g.used;
    setList(list.map(function (x) { return x.id === g.id ? Object.assign({}, x, { used: v }) : x; }));
    api.mark(g.id, v).catch(function (e) { setErr(e.message); load(); });
  };
  var left = (list || []).filter(function (g) { return !g.used; }).length;
  return (<div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px dashed var(--bd)" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <b style={{ fontSize: 12.5 }}>{"받은 커피"}</b>
      <span style={{ fontSize: 11, color: "var(--td)" }}>{list ? (list.length + "잔 · 등록 안 한 것 " + left) : "불러오는 중"}</span>
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--acc)" }}>{"운영자에게만 보여요"}</span>
    </div>
    {err && (<div style={{ fontSize: 11.5, color: "#FF8A80", marginBottom: 6 }}>{err}</div>)}
    {list && list.length === 0 && !err && (<div style={{ fontSize: 12, color: "var(--td)", padding: "6px 0" }}>{"아직 받은 커피가 없어요"}</div>)}
    <div style={{ display: "grid", gap: 6 }}>
      {(list || []).map(function (g) {
        return (<div key={g.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: "4px 10px", alignItems: "center", padding: "8px 10px", borderRadius: 9, background: "var(--inner)", opacity: g.used ? .5 : 1 }}>
          <input type="checkbox" checked={!!g.used} onChange={function () { toggle(g); }} title="카카오톡에 등록했으면 체크" style={{ margin: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--m)", fontSize: 12.5, letterSpacing: .6, textDecoration: g.used ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.code}</div>
            <div style={{ fontSize: 11, color: "var(--td)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ago(g.created_at) + (g.message ? " · " + g.message : "")}</div>
          </div>
          <button type="button" onClick={function () { copy(g); }} style={{ padding: "4px 9px", fontSize: 11, borderRadius: 7, border: "1px solid var(--bd)", background: "transparent", color: copied === g.id ? "#66BB6A" : "var(--t2)", cursor: "pointer", fontFamily: "inherit" }}>{copied === g.id ? "복사됨" : "복사"}</button>
        </div>);
      })}
    </div>
    <div style={{ fontSize: 10.5, color: "var(--td)", marginTop: 8 }}>{"카카오톡 → 선물하기 → 선물함 → '선물코드 등록'에 붙여 넣은 뒤 체크해 두세요"}</div>
  </div>);
}

/* ── 창 ── */
export default function CoffeeModal(p) {
  var api = p.api || realApi;
  var _c = useState(""); var code = _c[0]; var setCode = _c[1];
  var _m = useState(""); var msg = _m[0]; var setMsg = _m[1];
  var _b = useState(false); var busy = _b[0]; var setBusy = _b[1];
  var _e = useState(""); var err = _e[0]; var setErr = _e[1];
  var _d = useState(false); var done = _d[0]; var setDone = _d[1];
  useEffect(function () { if (!p.open) { setCode(""); setMsg(""); setErr(""); setDone(false); setBusy(false); } }, [p.open]);
  if (!p.open) return null;
  var ok = codeOk(code) && !busy;
  var send = function () {
    if (!ok) { setErr(cleanCode(code) ? "선물코드는 영문 · 숫자 6자 이상이에요" : ""); return; }
    setBusy(true); setErr("");
    api.send(code, msg).then(function () { setBusy(false); setDone(true); }, function (e) { setBusy(false); setErr(e.message); });
  };
  var mob = p.mobile;
  return (<div onClick={p.onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,12,.6)", display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center" }}>
    <div onClick={function (e) { e.stopPropagation(); }} role="dialog" aria-label="개발자에게 커피 한 잔"
      style={{ width: mob ? "100%" : 380, maxHeight: mob ? "88vh" : "86vh", overflowY: "auto", background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: mob ? "16px 16px 0 0" : 14, boxShadow: "0 18px 50px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid var(--bd)" }}>
        <b style={{ fontSize: 14.5 }}>{"☕ 개발자에게 커피 한 잔"}</b>
        <button type="button" onClick={p.onClose} aria-label="닫기" style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--td)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}>{"✕"}</button>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
            <div style={{ fontSize: 34, lineHeight: 1 }}>{"☕"}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, marginTop: 10 }}>{"고마워요! 잘 마실게요"}</div>
            <div style={{ fontSize: 12, color: "var(--td)", marginTop: 6 }}>{"보내 주신 코드는 운영자에게만 전해져요"}</div>
            <button type="button" onClick={p.onClose} style={{ marginTop: 16, padding: "8px 22px", fontSize: 12.5, borderRadius: 9, border: "1px solid var(--bd)", background: "transparent", color: "var(--t2)", cursor: "pointer", fontFamily: "inherit" }}>{"닫기"}</button>
          </div>
        ) : (
          <React.Fragment>
            <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.65, marginBottom: 14 }}>
              {"덱 매니저가 쓸 만했다면 카카오톡 기프티콘으로 응원해 주세요. 안 하셔도 정말 괜찮아요 :)"}
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <Step n="1">
                <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{"카카오톡 선물하기에서 커피를 고르고, 받는 사람 대신 "}<b>{"'선물코드'"}</b>{"로 결제해요"}</div>
                <a href={GIFT_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 7, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, borderRadius: 8, background: "#FEE500", color: "#191600", textDecoration: "none" }}>{"선물하기 열기 ↗"}</a>
              </Step>
              <Step n="2">
                <div style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 7 }}>{"받은 코드를 붙여 넣어 주세요"}</div>
                {p.canSend ? (
                  <React.Fragment>
                    <input value={code} onChange={function (e) { setCode(e.target.value); setErr(""); }} placeholder="선물코드" autoComplete="off" spellCheck={false}
                      style={Object.assign({}, INP, { fontFamily: "var(--m)", letterSpacing: .8, marginBottom: 6 })} />
                    <input value={msg} maxLength={MSG_MAX} onChange={function (e) { setMsg(e.target.value); }} placeholder="한마디 (안 써도 돼요)" style={INP} />
                    {err && (<div style={{ fontSize: 11.5, color: "#FF8A80", marginTop: 6 }}>{err}</div>)}
                    <button type="button" onClick={send} disabled={!ok}
                      style={{ width: "100%", marginTop: 10, padding: "9px 0", fontSize: 13, fontWeight: 800, borderRadius: 9, border: "none", background: ok ? "var(--acc)" : "var(--inner)", color: ok ? "#1a1300" : "var(--td)", cursor: ok ? "pointer" : "default", fontFamily: "inherit" }}>{busy ? "보내는 중…" : "보내기"}</button>
                  </React.Fragment>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--td)", padding: "9px 11px", borderRadius: 9, background: "var(--inner)" }}>{"구글로 로그인하면 보낼 수 있어요"}</div>
                )}
              </Step>
            </div>
            <div style={{ fontSize: 10.5, color: "var(--td)", marginTop: 12, lineHeight: 1.6 }}>{"코드는 운영자만 볼 수 있어요 · 친구 추가는 필요 없어요"}</div>
          </React.Fragment>
        )}
        {p.isAdmin && <Inbox api={api} />}
      </div>
    </div>
  </div>);
}
