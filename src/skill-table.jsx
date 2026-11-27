/* 📋 스킬점수표 — 데이터센터 (2026-11-27 사용자 요청)
   "일반 유저들도 이 아이콘 사용해서 스킬점수표 볼 수 있게 · 고정된 지금 사이트 상 가중치로 스킬점수가 보여서 기존 덱 정보와 일치하게 딱 보기좋은 형태로"

   - 점수 = 지금 사이트 스킬표(getSkillScore 가 읽는 SKILLS_V11 — 관리자 저장본이 있으면 그것)를 데이터센터가 넘겨준 그대로.
     라인업 · 내 선수 · 라인업 분석의 스킬 점수와 같은 값이다(같은 레벨 기준). 이 표는 원래 사이트 코드에 있는 공개 값
   - '내 덱 레벨' = 지금 라인업 선수가 가진 스킬만, 라인업 점수와 같은 유효 레벨로
   - 포수리드(버프포함)는 팀 버프까지 넣은 참고 줄(덱 점수에는 버프를 따로 더한다) — 줄 세우기에서 맨 뒤
   - 그림판 스킬 아이콘 · 등급은 skill-ui.jsx(비공개 표와 같은 조각) */
import React from "react";
import { ns, fx, iconOf, SkIcon, Pill, Seg, GradeTag, GRADES } from "./skill-ui.jsx";

var CATS = ["타자", "선발", "중계", "마무리"];
var LVS = [5, 6, 7, 8, 9, 10];
var KEEP = { cat: "타자", lv: 6, sort: "score", gr: "all" };      /* 다른 메뉴에 갔다 와도 고른 것 그대로(새로 고치면 처음으로) */

function rowsOf(table) {
  var out = [];
  CATS.forEach(function (c) {
    var t = (table && table[c]) || {};
    Object.keys(t).forEach(function (n) {
      var v = t[n]; if (n.charAt(0) === "_" || !Array.isArray(v)) return;
      var s = LVS.map(function (l, i) { var x = v[i]; return typeof x === "number" && isFinite(x) ? x : 0; });
      out.push({ c: c, n: n, k: ns(n), s: s, ic: iconOf(c, n), ref: /버프포함/.test(n), zero: !s.some(Boolean) });
    });
  });
  return out;
}

function LevelGrid(p) {
  var r = p.r, mob = p.mobile;
  return (<div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", columnGap: mob ? 4 : 8, rowGap: 3 }}>
    {LVS.map(function (l, i) {
      var on = !!r.s[i], hi = p.hi === i;
      return (<div key={l} style={{ textAlign: "center", padding: mob ? "5px 0" : "6px 0", borderRadius: 8, background: hi ? "var(--ta)" : "var(--card)", border: "1px solid " + (hi ? "var(--acc)" : "var(--bd)") }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: hi ? "var(--acc)" : "var(--td)" }}>{"Lv" + l}</div>
        <div style={{ fontFamily: "var(--m)", fontSize: mob ? 12.5 : 13.5, fontWeight: 800, color: on ? (hi ? "var(--acc)" : "var(--t1)") : "var(--td)", marginTop: 1 }}>{on ? fx(r.s[i]) : "—"}</div>
      </div>);
    })}
  </div>);
}

function Detail(p) {
  var x = p.x, r = x.r, mob = p.mobile;
  var notes = [];
  if (r.ref) notes.push("팀 버프까지 넣은 참고 값이에요 — 덱 점수(TOTAL)에는 팀 버프를 따로 더해요.");
  if (r.zero) notes.push("점수에 드는 효과가 없는 스킬이에요(모든 레벨 0점).");
  else if (r.s.some(function (v) { return !v; })) notes.push("— 칸은 그 레벨이 없는 거예요(국가대표 스킬은 Lv6 까지).");
  var info = (<div style={{ display: "grid", gap: 6, fontSize: 12, lineHeight: 1.55 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: mob ? 14 : 15, fontWeight: 800, color: "var(--t1)" }}>{r.n}</span>
      <span style={{ fontSize: 11.5, color: "var(--td)" }}>{r.c + " 표"}</span>
    </div>
    {x.my ? (<div><span style={{ color: "var(--td)", fontWeight: 700, marginRight: 8 }}>{"내 라인업"}</span>
      <span style={{ color: "var(--acc)" }}>{x.my.map(function (q) { return q.slot + " " + (q.nm || "") + " Lv" + q.lv; }).join(" · ")}</span></div>) : null}
    {notes.map(function (t) { return <div key={t} style={{ color: "var(--t2)" }}>{t}</div>; })}
  </div>);
  var badge = (<div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, flexShrink: 0, minWidth: mob ? 84 : 116 }}>
    {r.ic ? <SkIcon ic={r.ic} size={mob ? 84 : 116} big cls="skt" /> : <span style={{ width: mob ? 84 : 116, height: mob ? 84 : 116 }} />}
    <GradeTag ic={r.ic} role={r.c === "타자" ? "타자" : "투수"} />
  </div>);
  return (<div className="skt-detail" style={{ padding: mob ? "12px 10px" : "14px 16px 16px", background: "var(--inner)", borderBottom: "1px solid var(--bd)" }}>
    <div style={{ display: "flex", gap: mob ? 12 : 20, alignItems: "flex-start" }}>
      {badge}
      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 12, paddingTop: 2 }}>{info}{!mob && <LevelGrid r={r} hi={x.li} />}</div>
    </div>
    {mob && <div style={{ marginTop: 12 }}><LevelGrid r={r} hi={x.li} mobile /></div>}
  </div>);
}

export default function SkillTablePage(p) {
  var mob = p.mobile, mine = p.mine || {};
  var all = React.useMemo(function () { return rowsOf(p.table); }, [p.table]);
  var _c = React.useState(KEEP.cat); var cat = _c[0]; var setCat0 = _c[1];
  var _l = React.useState(KEEP.lv); var lv = _l[0]; var setLv0 = _l[1];
  var _s = React.useState(KEEP.sort); var sort = _s[0]; var setSort0 = _s[1];
  var _g = React.useState(KEEP.gr); var gr = _g[0]; var setGr0 = _g[1];
  var _q = React.useState(""); var q = _q[0]; var setQ = _q[1];
  var _o = React.useState(""); var openKey = _o[0]; var setOpenKey = _o[1];
  var keep = function (k, f) { return function (v) { KEEP[k] = v; f(v); }; };
  var setCat = keep("cat", setCat0), setLv = keep("lv", setLv0), setSort = keep("sort", setSort0), setGr = keep("gr", setGr0);
  var myN = (mine[cat] && Object.keys(mine[cat]).length) || 0;
  React.useEffect(function () { if (lv === "my" && !myN) setLv(6); }, [cat, myN]);

  var V = React.useMemo(function () {
    var mineC = mine[cat] || {}, qq = ns(q).toLowerCase();
    var L = all.filter(function (r) { return r.c === cat; }).map(function (r) {
      var my = mineC[r.k] || null;
      var li = lv === "my" ? (my ? Math.min(5, Math.max(0, my[0].lv - 5)) : -1) : lv - 5;
      var s = li >= 0 ? r.s[li] : 0;
      return { r: r, my: my, li: li, s: s, on: s > 0 };
    });
    L = L.filter(function (x) {
      if (lv === "my" && !x.my) return false;
      if (gr !== "all" && !(x.r.ic && String(x.r.ic.g) === gr)) return false;
      if (qq && x.r.k.toLowerCase().indexOf(qq) < 0) return false;
      return true;
    });
    var nm = function (a, b) { return a.r.n.localeCompare(b.r.n, "ko"); };
    L.sort(sort === "name" ? nm : function (a, b) { return (a.r.ref - b.r.ref) || (b.on - a.on) || (b.s - a.s) || nm(a, b); });
    var mx = 1; L.forEach(function (x) { if (!x.r.ref) mx = Math.max(mx, x.s); });
    return { L: L, mx: mx * 1.04 };
  }, [all, cat, lv, sort, gr, q, mine]);

  var catN = function (c) { return all.filter(function (r) { return r.c === c; }).length; };
  var lvTxt = lv === "my" ? "내 레벨" : "Lv" + lv;
  var card = { background: "var(--card)", border: "1px solid var(--bd)", borderRadius: 12 };
  var CSS = (<style>{
    ".skt-row{cursor:pointer;transition:background .15s}.skt-row:hover{background:var(--inner)}.skt-row:focus-visible{outline:2px solid var(--acc);outline-offset:-2px}" +
    ".skt-tbl{container-type:inline-size;container-name:skt}" +
    ".skt-g{display:grid;grid-template-columns:30px minmax(200px,1.5fr) 150px repeat(6,50px);align-items:center;column-gap:10px}" +
    "@container skt (max-width:820px){.skt-g{grid-template-columns:26px minmax(160px,1fr) 136px}.skt-lv{display:none}}" +
    ".skt-ic{transition:transform .18s ease}@media (hover:hover){.skt-row:hover .skt-ic{transform:scale(1.14) rotate(-6deg)}}" +
    ".skt-bar{transition:width .45s cubic-bezier(.2,.8,.2,1)}" +
    "@media (prefers-reduced-motion:reduce){.skt-bar,.skt-ic{transition:none}.skt-row:hover .skt-ic{transform:none}}"
  }</style>);

  /* ── 머리 ── */
  var head = (<div style={Object.assign({}, card, { padding: mob ? "13px 13px 12px" : "16px 18px 14px", marginBottom: 12, borderLeft: "3px solid var(--acc)",
    background: "linear-gradient(135deg, rgba(255,213,79,0.10), rgba(255,213,79,0.015) 55%, transparent), var(--card)" })}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: mob ? 16 : 18 }}>{"📋"}</span>
      <span style={{ fontSize: mob ? 16 : 18, fontWeight: 900, fontFamily: "var(--h)", letterSpacing: 1, color: "var(--t1)" }}>{"스킬점수표"}</span>
      <Pill color="var(--acc)">{"덱 점수와 같은 표"}</Pill>
    </div>
    <div style={{ fontSize: mob ? 12.5 : 13, color: "var(--t2)", lineHeight: 1.6, marginTop: 7 }}>
      {"지금 사이트가 덱 점수(TOTAL)에 쓰는 스킬 점수예요. 라인업 · 내 선수 화면의 스킬 점수와 같은 값이라, 레벨만 맞추면 숫자가 그대로 맞아요."}
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
      <Pill color="var(--t2)" style={{ fontWeight: 600 }}>{"스킬 " + all.length + "개 · Lv5 ~ 10"}</Pill>
      <Pill color="var(--t2)" style={{ fontWeight: 600 }}>{"아이콘 테두리 = 등급"}</Pill>
    </div>
  </div>);

  /* ── 고르기 ── */
  var lvItems = LVS.map(function (l) { return [l, mob ? String(l) : "Lv" + l]; });
  if (myN) lvItems.push(["my", mob ? "내 덱" : "내 덱 레벨", "내 라인업 선수가 가진 스킬만 — 각자 레벨로(라인업 점수와 같은 레벨)"]);
  var grItems = [["all", "전체"]].concat(GRADES.map(function (g, i) { return [String(i), g[0]]; }));
  var controls = (<div style={Object.assign({}, card, { padding: mob ? 10 : 12, marginBottom: 10 })}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Seg label="보직" grow={mob} style={mob ? { width: "100%" } : null} value={cat} onChange={function (c) { setCat(c); setOpenKey(""); }}
        items={CATS.map(function (c) { return [c, c + (mob ? "" : " " + catN(c))]; })} />
      <Seg label="레벨" small={mob} style={mob ? { width: "100%", overflowX: "auto" } : { marginLeft: "auto" }} grow={mob} value={lv} onChange={setLv} items={lvItems} />
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
      <div style={{ position: "relative", flex: mob ? "1 1 100%" : "0 1 220px" }}>
        <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.6 }}>{"🔍"}</span>
        <input value={q} onChange={function (e) { setQ(e.target.value); }} placeholder="스킬 이름" aria-label="스킬 이름 찾기"
          style={{ width: "100%", boxSizing: "border-box", padding: "7px 10px 7px 28px", fontSize: 12.5, background: "var(--bg)", border: "1px solid var(--bd)", borderRadius: 8, color: "var(--t1)" }} />
      </div>
      <Seg label="정렬" small value={sort} onChange={setSort} items={[["score", "점수순"], ["name", "이름순"]]} />
      {mob ? (<select value={gr} onChange={function (e) { setGr(e.target.value); }} aria-label="등급"
          style={{ padding: "6px 8px", fontSize: 12, background: "var(--inner)", border: "1px solid " + (gr === "all" ? "var(--bd)" : "var(--acc)"), borderRadius: 8, color: gr === "all" ? "var(--t2)" : "var(--acc)", fontWeight: 700 }}>
          {grItems.map(function (g) { return <option key={g[0]} value={g[0]}>{g[0] === "all" ? "등급 전체" : g[1]}</option>; })}
        </select>)
        : (<Seg label="등급" small value={gr} onChange={setGr} style={{ marginLeft: "auto" }}
          items={grItems.map(function (g) { return [g[0], g[0] === "all" ? g[1] : (<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: GRADES[+g[0]][1] }} />{g[1]}</span>)]; })} />)}
    </div>
  </div>);

  /* ── 요약 줄 ── */
  var summary = (<div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 12, flexWrap: "wrap", padding: mob ? "2px 2px 8px" : "2px 4px 10px", fontSize: 12, color: "var(--t2)" }}>
    <b style={{ color: "var(--t1)" }}>{cat + " · " + lvTxt}</b>
    <span>{V.L.length + "개" + (gr !== "all" ? " · " + GRADES[+gr][0] : "")}</span>
    <span style={{ marginLeft: mob ? 0 : "auto", fontSize: 11, color: "var(--td)" }}>{mob ? "오른쪽 숫자 = " + lvTxt + " 점수 · 누르면 Lv5 ~ 10" : "막대 = 이 목록 최고 점수 대비 · 줄을 누르면 큰 아이콘"}</span>
  </div>);

  /* ── 한 줄 ── */
  var rowOf = function (x, i) {
    var r = x.r, key = r.c + "|" + r.n, op = openKey === key;
    var toggle = function () { setOpenKey(op ? "" : key); };
    var kd = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
    var tags = [];
    if (x.my) tags.push(<Pill key="my" color="var(--acc)" title={x.my.map(function (q) { return q.slot + " Lv" + q.lv; }).join(" · ")}>{"내 선수" + (x.my.length > 1 ? " " + x.my.length : "")}</Pill>);
    if (r.ref) tags.push(<Pill key="ref" color="var(--vf-info)" title="팀 버프까지 넣은 참고 값이에요(덱 점수에는 버프를 따로 더해요)">{"참고"}</Pill>);
    var bar = (<div style={{ position: "relative", height: 4, borderRadius: 2, background: "var(--bar)", marginTop: 4 }}>
      <div className="skt-bar" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: Math.min(100, x.on ? x.s / V.mx * 100 : 0) + "%", borderRadius: 2, background: "linear-gradient(90deg, rgba(255,213,79,0.35), var(--acc))" }} />
    </div>);
    var none = r.zero ? "0점 · 점수에 드는 효과 없음" : (lv === "my" ? "" : lvTxt + " 없음");
    if (mob) {
      return (<div key={key}>
        <div className="skt-row" role="button" tabIndex={0} aria-expanded={op} onClick={toggle} onKeyDown={kd} data-name={r.n} data-s={x.s} data-li={x.li}
          style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px 8px 8px", borderBottom: op ? "none" : "1px solid var(--bd)", background: x.my ? "rgba(255,213,79,0.035)" : undefined, opacity: x.on ? 1 : 0.55 }}>
          <SkIcon ic={r.ic} size={42} cls="skt" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "var(--m)", fontSize: 10.5, color: "var(--td)", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t1)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
              {tags}
              <span style={{ marginLeft: "auto", fontFamily: "var(--m)", fontSize: 15.5, fontWeight: 800, color: "var(--t1)", flexShrink: 0 }}>{x.on ? fx(x.s) : "—"}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, minWidth: 0 }}>
              <GradeTag ic={r.ic} style={{ fontSize: 10.5 }} />
              {lv === "my" && x.my && <span style={{ fontSize: 10.5, color: "var(--acc)" }}>{"Lv" + x.my[0].lv}</span>}
              {!x.on && <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--td)", whiteSpace: "nowrap" }}>{none}</span>}
            </div>
            {bar}
          </div>
        </div>
        {op && <Detail x={x} mobile />}
      </div>);
    }
    return (<div key={key}>
      <div className="skt-row skt-g" role="button" tabIndex={0} aria-expanded={op} onClick={toggle} onKeyDown={kd} data-name={r.n} data-s={x.s} data-li={x.li}
        style={{ padding: "5px 14px", minHeight: 48, borderBottom: op ? "none" : "1px solid var(--bd)", background: op ? "var(--inner)" : (x.my ? "rgba(255,213,79,0.035)" : undefined), opacity: x.on ? 1 : 0.55 }}>
        <span style={{ fontFamily: "var(--m)", fontSize: 11, color: "var(--td)" }}>{i + 1}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <SkIcon ic={r.ic} size={38} cls="skt" />
          <span style={{ marginLeft: 3, fontSize: 13.5, fontWeight: 700, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
          {tags}
          {lv === "my" && x.my && <span style={{ fontSize: 10.5, color: "var(--acc)", flexShrink: 0 }}>{"Lv" + x.my[0].lv}</span>}
        </span>
        <span style={{ minWidth: 0 }}>
          {x.on ? <span style={{ display: "block", fontFamily: "var(--m)", fontSize: 14.5, fontWeight: 800, color: "var(--t1)", textAlign: "right" }}>{fx(x.s)}</span>
            : <span style={{ display: "block", fontSize: 11, color: "var(--td)", textAlign: "right", whiteSpace: "nowrap" }}>{none || "—"}</span>}
          {bar}
        </span>
        {LVS.map(function (l, j) {
          var hi = x.li === j, v = r.s[j];
          return (<span key={l} className="skt-lv" style={{ fontFamily: "var(--m)", fontSize: 12, textAlign: "right", color: !v ? "var(--td)" : hi ? "var(--acc)" : "var(--t2)", fontWeight: hi ? 800 : 500 }}>{v ? fx(v) : "—"}</span>);
        })}
      </div>
      {op && <Detail x={x} />}
    </div>);
  };

  return (<div>
    {CSS}
    {head}
    {controls}
    {summary}
    <div className="skt-tbl" style={Object.assign({}, card, { overflow: "hidden" })}>
      {!mob && (<div className="skt-g" style={{ padding: "8px 14px", borderBottom: "1px solid var(--bd)", fontSize: 11, fontWeight: 700, color: "var(--td)", background: "var(--inner)" }}>
        <span>{"#"}</span><span>{"스킬"}</span><span style={{ textAlign: "right", color: "var(--acc)" }}>{lvTxt + " 점수"}</span>
        {LVS.map(function (l) { return <span key={l} className="skt-lv" style={{ textAlign: "right", color: lv === l ? "var(--acc)" : undefined }}>{"Lv" + l}</span>; })}
      </div>)}
      {V.L.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 12.5, color: "var(--td)" }}>{q ? "찾는 스킬이 없어요" : "보일 스킬이 없어요"}</div>}
      {V.L.map(rowOf)}
    </div>
    <div style={{ fontSize: 11, color: "var(--td)", lineHeight: 1.65, padding: "12px 4px 4px" }}>
      {"· 라인업 · 내 선수 화면의 스킬 점수와 같은 값이에요(같은 레벨 기준) · — 칸은 그 레벨이 없는 스킬(국가대표 스킬은 Lv6 까지)"}<br />
      {"· 포수리드(버프포함)는 팀 버프까지 넣은 참고 줄이에요 · '내 덱 레벨'은 지금 라인업 선수가 가진 스킬만 라인업 점수와 같은 레벨로 보여요"}
    </div>
  </div>);
}
