/* 휴대폰 뒤로가기 — 화면 위에 연 창(글 보기 · 창 · 사진 크게 보기 …)이 열려 있으면 그것만 닫는다.
   클럽 라운지 · 오류 · 건의 게시판이 함께 쓴다 (기록 겹 수를 하나로 세야 해서 한 곳에 둔다).

   창을 열 때마다 방문 기록을 하나 쌓고 그 기록에 '몇 겹째인지(club)'를 적어 둔다.
   뒤로가기로 기록이 바뀌면, 바뀐 기록의 겹 수보다 위에 열려 있는 창을 모두 닫는다 —
   한 칸씩 돌아가든, 길게 눌러 여러 칸을 한 번에 돌아가든 같다.
   화면에서 닫을 때는 쌓아 둔 기록을 되돌린다 (selfBack) */
import { useRef, useEffect } from "react";

var backStack = [], popBound = false;
/* 화면이 스스로 되돌린 기록 가운데 아직 popstate 가 오지 않은 수, 그동안 미뤄 둔 '기록 쌓기'.
   창을 닫으며 되돌리는 일과 다른 창을 여는 일이 한꺼번에 일어나면(예: 클럽장 화면 → 인증 심사)
   브라우저가 되돌리기를 나중에 처리해 새로 쌓은 기록까지 지웠다 — 그래서 되돌리기가 다 끝난 뒤에 쌓는다 (2026-10-19) */
var selfBacks = 0, pushQueue = [], backGuard = null;
function flushPush() { var q = pushQueue; pushQueue = []; q.forEach(function (f) { f(); }); }
function bindPop() {
  if (popBound || typeof window === "undefined") return;
  popBound = true;
  /* 기록을 되돌릴 때 브라우저가 스크롤을 맨 위로 되돌려 놓던 것 — 스크롤은 화면이 직접 맞춘다 */
  try { if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual"; } catch (e) { /* 무시 */ }
  window.addEventListener("popstate", function (e) {
    /* 화면이 스스로 되돌린 것 — 이미 닫은 창의 기록이라 할 일이 없다 */
    if (selfBacks > 0) { selfBacks--; if (!selfBacks) { clearTimeout(backGuard); flushPush(); } return; }
    var depth = e.state && typeof e.state.club === "number" ? e.state.club : 0;
    var guard = 0;
    while (backStack.length > depth && guard++ < 50) {
      var top = backStack.pop();
      try { top(); } catch (x) { /* 닫기 실패는 무시 */ }
    }
  });
}
function selfBack() {
  selfBacks++;
  /* popstate 가 끝내 오지 않으면(브라우저가 되돌리기를 버림) 1초 뒤 풀어 준다 — 미뤄 둔 창이 기록을 영영 못 쌓는 일이 없게 */
  clearTimeout(backGuard);
  backGuard = setTimeout(function () { selfBacks = 0; flushPush(); }, 1000);
  try { window.history.back(); } catch (e) { selfBacks = Math.max(0, selfBacks - 1); if (!selfBacks) { clearTimeout(backGuard); flushPush(); } }
}
export function useBackClose(open, close) {
  var ref = useRef(close); ref.current = close;
  useEffect(function () {
    if (!open) return;
    bindPop();
    var fn = function () { ref.current(); };
    var gone = false;
    var push = function () {
      if (gone) return;
      /* 기록을 쌓지 못한 환경(막힘 · 횟수 제한)에서는 아예 맡지 않는다 — 닫을 때 진짜 이전 페이지로 가 버리지 않게 */
      try { window.history.pushState({ club: backStack.length + 1 }, ""); } catch (e) { return; }
      backStack.push(fn);
    };
    if (selfBacks > 0) pushQueue.push(push); else push();
    return function () {
      gone = true;
      var i = backStack.indexOf(fn);
      if (i < 0) return;
      backStack.splice(i, 1);
      selfBack();
    };
  }, [open]);
}
