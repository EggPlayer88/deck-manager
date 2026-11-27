/* 스킬점수표 두 화면이 같이 쓰는 조각 — 📋 스킬점수표(skill-table.jsx · 모두) · 🔒 스킬점수표(비공개)(skill-preview.jsx)
   - 그림판 스킬 아이콘(사용자가 만든 135개, 2026-11-27): 그림 public/skill-icons(s 80px · l 240px), 이름 → 그림 표 skill-icons.js
   - 두 화면 모두 데이터센터가 필요할 때만 불러온다(React.lazy) — 이 파일도 그때만 받는다 */
import React from "react";
import { ICONS, GRADES } from "./skill-icons.js";

export { GRADES };
export var ns = function (s) { return String(s || "").replace(/\s+/g, ""); };
export var fx = function (v) { return (Math.round(v * 100) / 100).toFixed(2); };

/* 보직(타자 / 투수) | 공백 뺀 이름(끝 괄호 '(200224)' · '(버프포함)' 같은 갈래는 뺌) → 그림 번호 · 등급(GRADES 번호) */
export function iconOf(c, n) {
  var a = ICONS[(c === "타자" ? "타" : "투") + "|" + ns(String(n || "").replace(/\(.*?\)$/, ""))];
  return a ? { f: ("00" + a[0]).slice(-3), g: a[1] } : null;
}

/* 아이콘 한 장 — 그림이 없는 스킬은 같은 크기 빈칸(줄 맞춤). cls = 화면마다 마우스 올림 움직임용 이름 */
export function SkIcon(p) {
  var z = p.size, cls = p.cls || "skp";
  if (!p.ic) return <span aria-hidden="true" style={{ display: "inline-block", width: z, height: z, flexShrink: 0 }} />;
  return (<img className={cls + (p.big ? "-icl" : "-ic")} src={"/skill-icons/" + (p.big ? "l" : "s") + "/" + p.ic.f + ".webp"} width={z} height={z} alt="" aria-hidden="true"
    draggable={false} loading="lazy" decoding="async" style={{ display: "block", width: z, height: z, flexShrink: 0 }} />);
}

export function Pill(p) {
  return (<span title={p.title} style={Object.assign({ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: 999, fontSize: 10.5, fontWeight: 700,
    lineHeight: "16px", color: p.color, border: "1px solid " + p.color, whiteSpace: "nowrap", flexShrink: 0, background: "transparent" }, p.style || {})}>{p.children}</span>);
}

export function Seg(p) {
  return (<div role="group" aria-label={p.label} style={Object.assign({ display: "inline-flex", background: "var(--inner)", border: "1px solid var(--bd)", borderRadius: 9, padding: 2, gap: 2 }, p.style || {})}>
    {p.items.map(function (it) {
      var on = p.value === it[0];
      return (<button key={it[0]} type="button" aria-pressed={on} onClick={function () { p.onChange(it[0]); }} title={it[2] || ""}
        style={{ flex: p.grow ? 1 : "0 0 auto", minWidth: 0, padding: p.small ? "4px 8px" : "6px 12px", fontSize: p.small ? 11.5 : 12.5, fontWeight: on ? 800 : 500, borderRadius: 7, cursor: "pointer",
          border: "1px solid " + (on ? "var(--acc)" : "transparent"), background: on ? "var(--ta)" : "transparent", color: on ? "var(--acc)" : "var(--t2)", whiteSpace: "nowrap" }}>{it[1]}</button>);
    })}
  </div>);
}

/* 등급 표시 — 점 색 = 아이콘 테두리 색 */
export function GradeTag(p) {
  var gr = p.ic ? GRADES[p.ic.g] : null; if (!gr) return null;
  return (<span style={Object.assign({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "var(--t2)", whiteSpace: "nowrap" }, p.style || {})}>
    <i style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: gr[1] }} />{gr[0] + (p.role ? " · " + p.role : "")}</span>);
}
