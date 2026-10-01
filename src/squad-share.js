/** 스쿼드 공유: 구단 테마 + 실제 연구 결과를 합성하는 1080 × 1920 템플릿.
 * 계산/선수 조회에 의존하지 않는다. 미리보기와 실제 다운로드가 같은 렌더러를 쓴다.
 */
export const SQUAD_SIZE = Object.freeze({ width: 1080, height: 1920 });
const theme = (id, name, english, wordmark, ink, accent, field, paper = '#f8f5e8') =>
  Object.freeze({ id, name, english, wordmark, ink, accent, field, paper });
export const SQUAD_THEMES = Object.freeze({
  '기아': theme('kia', '기아', 'KIA TIGERS', 'Tigers', '#164e3e', '#b7193f', '#d4dfc6'),
  '삼성': theme('samsung', '삼성', 'SAMSUNG LIONS', 'Lions', '#153e77', '#1466bb', '#d3e3e9', '#f7f6ed'),
  'LG': theme('lg', 'LG', 'LG TWINS', 'Twins', '#322832', '#b91d52', '#e6d9d9'),
  '두산': theme('doosan', '두산', 'DOOSAN BEARS', 'Bears', '#243353', '#c62c43', '#d9e1dc'),
  'KT': theme('kt', 'KT', 'KT WIZ', 'Wiz', '#303638', '#bd2732', '#dee0d4'),
  'SSG': theme('ssg', 'SSG', 'SSG LANDERS', 'Landers', '#4f3833', '#c12b35', '#e5ddce'),
  '롯데': theme('lotte', '롯데', 'LOTTE GIANTS', 'Giants', '#173c50', '#bc343e', '#cfe2e2'),
  '한화': theme('hanwha', '한화', 'HANWHA EAGLES', 'Eagles', '#41392f', '#c65317', '#e6dec5', '#faf3e5'),
  'NC': theme('nc', 'NC', 'NC DINOS', 'Dinos', '#234356', '#97703a', '#d1e0de'),
  '키움': theme('kiwoom', '키움', 'KIWOOM HEROES', 'Heroes', '#59333f', '#861d3a', '#e1d6cf'),
});
const NEUTRAL = theme('neutral', '내 덱', 'MY BASEBALL SQUAD', 'Baseball', '#334b43', '#786044', '#dae0d3');
export function getSquadTheme(team) {
  const key = String(team || '').trim();
  const canonical = key.toUpperCase() === 'KIA' ? '기아' : key;
  // Object.hasOwn 은 iOS 15.4 이전 사파리에 없다 — 옛 폰에서도 그림이 나오게 예전 방식으로 확인한다.
  return (Object.prototype.hasOwnProperty.call(SQUAD_THEMES, canonical) && SQUAD_THEMES[canonical]) || Object.values(SQUAD_THEMES).find(t => t.english.toLowerCase() === key.toLowerCase() || t.id === key.toLowerCase()) || NEUTRAL;
}
export const BATTER_POSITIONS = Object.freeze({
  CF: [540, 254], LF: [206, 337], RF: [874, 337],
  SS: [364, 578], '2B': [716, 578], '3B': [145, 704], '1B': [935, 704],
  C: [424, 889], DH: [714, 889],
});
export const PITCHER_SLOTS = Object.freeze(['SP1', 'SP2', 'SP3', 'SP4', 'SP5', 'CP', 'RP1', 'RP2', 'RP3', 'RP4', 'RP5', 'RP6']);
const GRADES = {
  '골든글러브': ['골글', '#edc454', '#473913'], '시그니처': ['시그', '#b7194b', '#fffdf6'],
  '임팩트': ['임팩', '#19874b', '#fffdf6'], '국가대표': ['국대', '#216caa', '#fffdf6'],
  '라이브': ['라이브', '#c85a22', '#fffdf6'], '올스타': ['올스타', '#70539c', '#fffdf6'],
  '시즌': ['시즌', '#55704e', '#fffdf6'],
};
const FONT = '"Noto Sans KR", "Malgun Gothic", sans-serif';
export function squadPlayerName(name) { return String(name || '').replace(/^([가-힣]{2,})[A-Z]$/, '$1'); }
export function formatSquadScore(value) {
  if (value == null || value === '') return '—';
  const number = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(number) ? number.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';
}
function round(x, a, b, w, h, r = 12) {
  x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath();
}
function font(x, size, weight = 700, family = FONT) { x.font = `${weight} ${size}px ${family}`; }
function text(x, label, cx, cy, size, ink, maxWidth, align = 'left', weight = 700, family = FONT) {
  x.save(); x.fillStyle = ink; x.textAlign = align; x.textBaseline = 'middle';
  let s = size; font(x, s, weight, family);
  while (maxWidth && x.measureText(String(label)).width > maxWidth && s > 12) font(x, --s, weight, family);
  x.fillText(String(label), cx, cy, maxWidth); x.restore();
}
function rule(x, y, t, dashed = false, left = 28, right = 1052) {
  x.save(); x.strokeStyle = t.ink; x.globalAlpha = .48; x.lineWidth = 1.5;
  if (dashed) x.setLineDash([4, 6]);
  x.beginPath(); x.moveTo(left, y); x.lineTo(right, y); x.stroke(); x.restore();
}
function baseball(x, cx, cy, r, t) {
  x.save(); x.strokeStyle = t.accent; x.lineWidth = 2;
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke();
  for (const side of [-1, 1]) {
    x.beginPath(); x.moveTo(cx + side * r * .40, cy - r * .86);
    x.bezierCurveTo(cx - side * r * .28, cy - r * .3, cx - side * r * .28, cy + r * .3, cx + side * r * .4, cy + r * .86); x.stroke();
    for (let i = -2; i <= 2; i++) {
      const sy = cy + i * r * .28, sx = cx + side * r * (.05 + .07 * i * i);
      x.beginPath(); x.moveTo(sx - 3, sy - 2); x.lineTo(sx + 3, sy + 2); x.stroke();
    }
  } x.restore();
}
function paper(x, t) {
  x.fillStyle = t.paper; x.fillRect(0, 0, 1080, 1920);
  // 일정한 종이 입자: 매번 같은 데이터는 같은 이미지를 만든다.
  let seed = 741;
  x.fillStyle = t.ink; x.globalAlpha = .035;
  for (let i = 0; i < 13500; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; const a = seed % 1080;
    seed = (seed * 1664525 + 1013904223) >>> 0; x.fillRect(a, seed % 1920, 1, 1);
  }
  x.globalAlpha = 1; x.strokeStyle = t.ink; x.lineWidth = 2; x.strokeRect(14, 14, 1052, 1892);
  x.lineWidth = .65; x.strokeRect(21, 21, 1038, 1878);
}
function ticket(x, t, d) {
  text(x, t.english, 52, 47, 18, t.ink, 230, 'left', 700, 'Georgia, serif');
  text(x, t === NEUTRAL ? d.team || t.name : t.name, 48, 119, 98, t.accent, 235, 'left', 900);
  text(x, 'MY SQUAD', 306, 81, 43, t.ink, 312, 'left', 900, 'Georgia, serif');
  x.strokeStyle = t.accent; x.lineWidth = 4;
  x.beginPath(); x.moveTo(307, 113); x.lineTo(614, 105); x.stroke();
  const years = [d.batYear ? `타자 ${d.batYear}` : '', d.pitYear ? `투수 ${d.pitYear}` : ''].filter(Boolean).join(' · ');
  text(x, years || '나만의 야구, 나만의 스쿼드', 306, 147, 23, t.ink, 316, 'left', 600);
  x.save(); x.strokeStyle = t.ink; x.lineWidth = 1.7;
  round(x, 656, 37, 369, 131, 12); x.stroke(); round(x, 663, 44, 355, 117, 8); x.stroke(); x.restore();
  text(x, '덱 점수', 840, 65, 22, t.ink, 180, 'center');
  text(x, formatSquadScore(d.total), 840, 119, 61, t.accent, 324, 'center', 900);
  rule(x, 191, t, false, 14, 1066);
}
function field(x, t) {
  x.save(); x.beginPath(); x.rect(28, 256, 1024, 860); x.clip();
  const home = [540, 1087];
  x.fillStyle = t.field;
  x.beginPath(); x.moveTo(...home); x.arc(...home, 865, Math.PI * 1.21, Math.PI * 1.79); x.closePath(); x.fill();
  x.strokeStyle = t.paper; x.globalAlpha = .7; x.lineWidth = 2;
  x.beginPath(); x.arc(...home, 823, Math.PI * 1.21, Math.PI * 1.79); x.stroke(); x.globalAlpha = 1;
  x.fillStyle = '#e9dfc7'; x.beginPath(); x.moveTo(...home); x.lineTo(180, 724); x.quadraticCurveTo(540, 353, 900, 724); x.closePath(); x.fill();
  x.fillStyle = t.field; x.beginPath(); x.moveTo(540, 1026); x.lineTo(279, 762); x.lineTo(540, 493); x.lineTo(801, 762); x.closePath(); x.fill();
  x.strokeStyle = '#fffdf2'; x.lineWidth = 3; x.globalAlpha = .72;
  x.beginPath(); x.moveTo(0, 547); x.lineTo(...home); x.lineTo(1080, 547); x.stroke();
  x.fillStyle = t.paper;
  for (const [a, b] of [[259, 762], [540, 476], [821, 762]]) {
    x.save(); x.translate(a, b); x.rotate(Math.PI / 4); x.fillRect(-9, -9, 18, 18); x.restore();
  }
  x.fillStyle = '#e9dfc7'; x.beginPath(); x.arc(540, 762, 24, 0, Math.PI * 2); x.fill(); x.restore();
  text(x, t.wordmark, 63, 251, 48, t.accent, 240, 'left', 700, '"Brush Script MT", "Segoe Script", cursive');
  x.fillStyle = t.ink; round(x, 443, 212, 194, 42, 21); x.fill();
  text(x, '야수', 540, 233, 27, t.paper, 150, 'center');
  text(x, 'BASEBALL', 998, 241, 13, t.ink, 130, 'right', 700, 'Georgia, serif');
  text(x, 'COLLECTION', 998, 261, 13, t.ink, 130, 'right', 700, 'Georgia, serif');
  x.save(); x.translate(58, 1040); x.rotate(-.13);
  text(x, 'Play ball!', 0, 0, 38, t.ink, 230, 'left', 500, '"Segoe Script", cursive'); x.restore();
  x.save(); x.translate(828, 1047); x.rotate(-.08);
  text(x, `오늘도 ${t.name}!`, 0, 0, 25, t.ink, 193);
  x.strokeStyle = t.accent; x.lineWidth = 3; x.beginPath(); x.moveTo(15, 28); x.lineTo(180, 22); x.stroke(); x.restore();
}
function badge(x, p, right, top, size = 19) {
  if (!p.ct) return;
  const [label, bg, fg] = GRADES[p.ct] || [p.ct, '#e1ddd0', '#37483f'];
  font(x, size); const w = Math.min(93, Math.max(47, x.measureText(label).width + 17));
  x.fillStyle = '#fffdf5'; round(x, right - w - 3, top - 3, w + 6, 33, 8); x.fill();
  x.fillStyle = bg; round(x, right - w, top, w, 27, 5); x.fill();
  text(x, label, right - w / 2, top + 13.5, size, fg, w - 10, 'center');
}
// 원본 이미지의 알파를 확장해 흰색 스티커 테두리를 만든다.
function stickerImage(x, image, a, b, w, h) {
  const nw = image.naturalWidth || image.width, nh = image.naturalHeight || image.height;
  if (!(nw > 0 && nh > 0)) return false;
  const scale = Math.max(w / nw, h / nh), dw = nw * scale, dh = nh * scale;
  const layer = document.createElement('canvas'); layer.width = Math.ceil(w + 20); layer.height = Math.ceil(h + 20);
  const c = layer.getContext('2d');
  c.drawImage(image, 10 + (w - dw) / 2, 10 + (h - dh) * .20, dw, dh);
  // 그림이 이름 영역으로 넘치지 않도록 사진 영역을 자른다.
  c.clearRect(0, 0, layer.width, 10); c.clearRect(0, h + 10, layer.width, 10);
  c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fffef8'; c.fillRect(0, 0, layer.width, layer.height);
  const outline = document.createElement('canvas'); outline.width = layer.width; outline.height = layer.height;
  const o = outline.getContext('2d');
  for (let i = 0; i < 16; i++) { const r = i * Math.PI / 8; o.drawImage(layer, Math.cos(r) * 4.5, Math.sin(r) * 4.5); }
  x.save(); x.shadowColor = '#243a302a'; x.shadowBlur = 9; x.shadowOffsetY = 5; x.drawImage(outline, a - 10, b - 10); x.restore();
  x.save(); x.beginPath(); x.rect(a, b, w, h); x.clip(); x.drawImage(image, a + (w - dw) / 2, b + (h - dh) * .20, dw, dh); x.restore();
  return true;
}
function placeholder(x, p, a, b, w, h, t) {
  x.save(); x.fillStyle = t.paper; x.shadowColor = '#243a3020'; x.shadowBlur = 9; x.shadowOffsetY = 3;
  round(x, a + 9, b + 6, w - 18, h - 6, 14); x.fill(); x.restore();
  x.strokeStyle = t.ink; x.globalAlpha = .13; round(x, a + 14, b + 11, w - 28, h - 16, 10); x.stroke(); x.globalAlpha = 1;
  text(x, p.slot, a + w / 2, b + h * .56, w * .34, t.ink, w - 30, 'center', 700, 'Georgia, serif');
  // 오른쪽 아래 등급 배지(이름표 위로 솟은 부분)와 겹치지 않게 조금 올려 둔다.
  text(x, p.name ? 'PLAYER COLLECTION' : '선수 미선택', a + w / 2, b + h * .78, 12, t.ink, w - 28, 'center', 500);
}
function batter(x, p, t) {
  const [cx, top] = BATTER_POSITIONS[p.slot], w = 202, h = 197, a = cx - w / 2;
  if (!p.img || !stickerImage(x, p.img, a, top, w, h)) placeholder(x, p, a, top, w, h, t);
  const labelY = top + h - 1;
  x.save(); x.fillStyle = '#fffef7'; x.shadowColor = '#243a3028'; x.shadowBlur = 8; x.shadowOffsetY = 4;
  round(x, a - 3, labelY - 3, w + 6, 49, 12); x.fill(); x.restore();
  x.fillStyle = t.ink; round(x, a + 2, labelY + 2, w - 4, 39, 8); x.fill();
  text(x, p.slot, a + 30, labelY + 22, 21, t.paper, 49, 'center');
  x.fillStyle = '#ffffff42'; x.fillRect(a + 57, labelY + 10, 1, 24);
  text(x, squadPlayerName(p.name) || '미선택', a + 128, labelY + 22, 28, t.paper, 131, 'center');
  badge(x, p, a + w + 5, labelY - 26, 19);
}
function pitcher(x, p, a, b, t) {
  const w = 152, h = 222;
  x.save(); x.shadowColor = '#243a3028'; x.shadowBlur = 8; x.shadowOffsetY = 3;
  x.fillStyle = t.paper; round(x, a, b, w, h, 12); x.fill(); x.restore();
  x.strokeStyle = '#ffffff'; x.lineWidth = 2; round(x, a + 1, b + 1, w - 2, h - 2, 11); x.stroke();
  if (!p.img || !stickerImage(x, p.img, a + 7, b + 32, w - 14, 145)) {
    text(x, p.slot, a + w / 2, b + 107, 44, t.ink, w - 26, 'center', 700, 'Georgia, serif');
    if (!p.name) text(x, '선수 미선택', a + w / 2, b + 146, 13, t.ink, w - 20, 'center', 500);
  }
  text(x, p.slot, a + 11, b + 21, 20, t.ink, 55);
  badge(x, p, a + w - 9, b + 8, 17);
  text(x, squadPlayerName(p.name) || '미선택', a + w / 2, b + h - 23, 27, t.ink, w - 16, 'center', 800);
}
function section(x, title, english, a, y, t, max = 500) {
  baseball(x, a + 15, y, 14, t);
  text(x, title, a + 41, y, 31, t.ink, max);
  font(x, 31); const end = a + 41 + x.measureText(title).width;
  if (english) text(x, english, end + 20, y + 3, 14, t.ink, max - (end - a) - 20, 'left', 500, 'Georgia, serif');
}
/** @param {{team:string,batYear?:string,pitYear?:string,total?:number|string,sub?:string,bats?:Array,pits?:Array}} d */
export function drawSquadCanvas(d = {}) {
  const cv = document.createElement('canvas'); cv.width = SQUAD_SIZE.width; cv.height = SQUAD_SIZE.height;
  const x = cv.getContext('2d'), t = getSquadTheme(d.team);
  paper(x, t); ticket(x, t, d); field(x, t);
  const batMap = new Map((d.bats || []).filter(Boolean).map(p => [p.slot, p]));
  for (const slot of Object.keys(BATTER_POSITIONS)) batter(x, batMap.get(slot) || { slot }, t);
  rule(x, 1154, t, true); section(x, '선발', 'STARTING PITCHERS', 44, 1191, t);
  section(x, '마무리', '', 884, 1191, t, 119);
  const pitMap = new Map((d.pits || []).filter(Boolean).map(p => [p.slot, p]));
  PITCHER_SLOTS.slice(0, 6).forEach((slot, i) => pitcher(x, pitMap.get(slot) || { slot }, 44 + i * 168, 1230, t));
  rule(x, 1481, t, true); section(x, '불펜', 'BULLPEN', 44, 1518, t);
  PITCHER_SLOTS.slice(6).forEach((slot, i) => pitcher(x, pitMap.get(slot) || { slot }, 44 + i * 168, 1558, t));
  rule(x, 1812, t); baseball(x, 540, 1812, 15, t);
  text(x, t.english, 48, 1845, 18, t.ink, 320, 'left', 700, 'Georgia, serif');
  text(x, '덱 연구소 · 컴투스프로야구 V26 덱 매니저', 1032, 1845, 17, t.ink, 590, 'right', 500);
  text(x, d.sub || '나만의 야구, 나만의 스쿼드.', 540, 1880, 18, t.ink, 960, 'center', 500);
  return cv;
}
/** 사진 실패/시간 초과에도 출력. 입력을 변경하지 않으며 선수별 팀으로 사진을 찾는다. */
export async function prepareSquadData(data, resolvePhoto = p => p.photoUrl || '', { timeoutMs = 8000, ImageClass = globalThis.Image } = {}) {
  const cache = new Map();
  function load(url) {
    if (!url || !ImageClass) return Promise.resolve(null);
    if (!cache.has(url)) cache.set(url, new Promise(resolve => {
      const img = new ImageClass(); let timer;
      const finish = value => { clearTimeout(timer); img.onload = null; img.onerror = null; resolve(value); };
      timer = setTimeout(() => finish(null), timeoutMs);
      img.crossOrigin = 'anonymous'; img.onload = () => finish(img); img.onerror = () => finish(null);
      try { img.src = url; } catch { finish(null); }
    }));
    return cache.get(url);
  }
  async function player(p) {
    if (!p) return null;
    let img = p.img;
    if (!img) { try { img = await load(await resolvePhoto(p)); } catch { img = null; } }
    return { ...p, img };
  }
  const [bats, pits] = await Promise.all([(data.bats || []), (data.pits || [])].map(list => Promise.all(list.filter(Boolean).map(player))));
  return { ...data, bats, pits };
}
export async function downloadSquadImage(data, resolvePhoto) {
  const fonts = globalThis.document?.fonts;
  // Canvas만 쓰는 900 굵기도 명시적으로 요청한다. 외부 폰트 실패 시 시스템 한글 폰트로 출력.
  // 그림에 쓰는 글자를 모두 넘겨야 그 글자가 든 글꼴 조각까지 받아 온다 (등급 배지·연도 줄 포함).
  const players = [...(data.bats || []), ...(data.pits || [])].filter(Boolean);
  const characters = [data.team, data.batYear, data.pitYear, data.sub, 'MY SQUAD 덱 점수 야수 선발 마무리 불펜 선수 미선택 오늘도 덱 연구소 컴투스프로야구 V26 덱 매니저 0123456789,.',
    '타자 투수 · — ! PLAYER COLLECTION', ...Object.values(GRADES).map(g => g[0]),
    ...players.map(p => p.name), ...players.map(p => p.ct)].filter(Boolean).join(' ');
  const ready = fonts ? Promise.race([Promise.all([500, 600, 700, 800, 900].map(weight => fonts.load(`${weight} 28px ${FONT}`, characters))).catch(() => {}), new Promise(r => setTimeout(r, 3000))]) : Promise.resolve();
  const [prepared] = await Promise.all([prepareSquadData(data, resolvePhoto), ready]);
  const canvas = drawSquadCanvas(prepared);
  const blob = await new Promise((resolve, reject) => {
    try { canvas.toBlob(b => b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다. 다시 시도해 주세요.')), 'image/png'); }
    catch { reject(new Error('선수 사진을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.')); }
  });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  const now = new Date(), date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  a.href = url; a.download = `스쿼드_${String(data.team || '내덱').replace(/[\\/:*?"<>|]/g, '')}_${date}.png`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  return canvas;
}
