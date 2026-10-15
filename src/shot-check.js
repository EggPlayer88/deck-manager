/* 클럽장 인증 캡처 간단 점검 — 편집 프로그램·AI 생성 흔적, 스크린샷다운가.
   올린 원본 파일(줄이기 전)의 바이트와 크기만 본다. 신청을 막지 않고 관리자 심사 카드에 표시만 한다.

   한계: 파일 정보(메타데이터)를 지우고 올리면 걸리지 않는다. 부주의한 위조를 거르는 정도다.
   돌려주는 것: { flags: [{ lv: "warn"|"info", t: 설명 }], w, h, type, size } */

var EDITORS = [
  [/Adobe Photoshop|Photoshop/i, "Photoshop"], [/Lightroom/i, "Lightroom"], [/GIMP/, "GIMP"],
  [/Photopea/i, "Photopea"], [/Pixlr/i, "Pixlr"], [/Canva(?!s)/, "Canva"], [/PicsArt/i, "PicsArt"],
  [/Snapseed/i, "Snapseed"], [/Affinity Photo/i, "Affinity Photo"], [/paint\.net/i, "Paint.NET"],
  [/Meitu/i, "Meitu"], [/Fotor/i, "Fotor"]
];
var AI_MARKS = [
  [/Midjourney/i, "Midjourney"], [/DALL[·\-\s]?E/i, "DALL-E"], [/Stable ?Diffusion/i, "Stable Diffusion"],
  [/NovelAI/i, "NovelAI"], [/Adobe Firefly|Firefly/i, "Adobe Firefly"], [/ComfyUI/i, "ComfyUI"],
  [/OpenAI|ChatGPT/i, "OpenAI"], [/Imagen|Gemini/i, "Google AI"], [/trainedAlgorithmicMedia/i, "AI 생성 표시(IPTC)"],
  [/c2pa\.(?:actions|claim|assertions|hash)/i, "콘텐츠 출처 기록(C2PA)"]
];

/* PNG 글자 덩어리(tEXt·iTXt)의 열쇠 이름 — Stable Diffusion 은 "parameters", ComfyUI 는 "prompt"·"workflow" 에 생성 정보를 넣는다 */
function pngTextKeys(bytes) {
  var keys = [];
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return keys;
  var i = 8;
  while (i + 8 < bytes.length && keys.length < 50) {
    var len = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    var type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      var k = "", j = i + 8;
      while (j < i + 8 + len && j < i + 8 + 80 && bytes[j] !== 0) { k += String.fromCharCode(bytes[j]); j++; }
      keys.push(k);
    }
    if (type === "IEND") break;
    i += 12 + len;
  }
  return keys;
}

/* 바이트에서 흔적을 찾는다. 앞쪽 2MB 와 뒤쪽 256KB 만 본다 (메타데이터는 대개 앞이나 끝에 있다) */
export function scanBytes(bytes) {
  var flags = [];
  var head = bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024));
  var tail = bytes.length > head.length ? bytes.subarray(Math.max(head.length, bytes.length - 256 * 1024)) : new Uint8Array(0);
  var txt = latin1(head) + "\n" + latin1(tail);
  var isPng = bytes[0] === 0x89 && bytes[1] === 0x50, isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  var seen = {};
  EDITORS.forEach(function (e) { if (!seen[e[1]] && e[0].test(txt)) { seen[e[1]] = 1; flags.push({ lv: "warn", t: "편집 프로그램 흔적: " + e[1] }); } });
  AI_MARKS.forEach(function (e) { if (!seen[e[1]] && e[0].test(txt)) { seen[e[1]] = 1; flags.push({ lv: "warn", t: "AI 생성 흔적: " + e[1] }); } });
  if (isPng) {
    var keys = pngTextKeys(bytes);
    if (keys.some(function (k) { return /^(parameters|prompt|workflow|Dream|sd-metadata|invokeai)/i.test(k); }))
      flags.push({ lv: "warn", t: "AI 생성 흔적: 이미지 생성 설정이 들어 있음 (" + keys.filter(function (k) { return /parameters|prompt|workflow|Dream|sd-metadata|invokeai/i.test(k); }).join(", ") + ")" });
  }
  /* 카메라 정보 — 스크린샷에는 보통 없다. 화면을 폰으로 찍은 사진이면 원본이 아닐 수 있다 */
  if (isJpg && /ExposureTime|FNumber|ISOSpeed|FocalLength/.test(txt) && /(Apple|samsung|Samsung|LGE|Google|Xiaomi|HUAWEI|OPPO|vivo|SONY|Canon|NIKON)/.test(txt))
    flags.push({ lv: "info", t: "카메라로 찍은 사진 (스크린샷이 아님)" });
  if (!isPng && !isJpg) flags.push({ lv: "info", t: "PNG·JPEG 가 아닌 파일" });
  return { flags: flags, type: isPng ? "png" : isJpg ? "jpeg" : "other" };
}

/* 크기 — 휴대폰·태블릿 화면 비율(가로든 세로든 4:3 ~ 22:9) 이 아니거나 너무 작으면 잘라냈을 수 있다 */
export function judgeSize(w, h) {
  var flags = [];
  if (!w || !h) return flags;
  var r = Math.max(w, h) / Math.min(w, h);
  if (r < 1.3 || r > 2.5) flags.push({ lv: "info", t: "화면 비율이 휴대폰·태블릿과 다름 (" + w + "×" + h + ") — 잘라낸 이미지일 수 있음" });
  if (Math.max(w, h) < 900) flags.push({ lv: "info", t: "해상도가 낮음 (" + w + "×" + h + ") — 잘라냈거나 다시 저장했을 수 있음" });
  return flags;
}

function latin1(u8) {
  var s = "", CH = 8192;
  for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return s;
}

/* 브라우저에서 — 파일 하나를 점검한다 */
export async function checkShot(file) {
  var buf = new Uint8Array(await file.arrayBuffer());
  var r = scanBytes(buf);
  var dim = await new Promise(function (res) {
    var url = URL.createObjectURL(file); var img = new Image();
    img.onload = function () { res({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = function () { res({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
  return { flags: r.flags.concat(judgeSize(dim.w, dim.h)), w: dim.w, h: dim.h, type: r.type, size: file.size,
    modified: file.lastModified ? new Date(file.lastModified).toISOString() : null, v: 1 };
}
