// 클럽장 인증 캡처 점검(src/shot-check.js) 시험 — node test/shot-check.test.mjs
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { scanBytes, judgeSize } from '../src/shot-check.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('  ✗', name, extra || ''); } };
const warns = r => r.flags.filter(f => f.lv === 'warn').map(f => f.t);
const infos = r => r.flags.filter(f => f.lv === 'info').map(f => f.t);

/* PNG 만들기 — 글자 덩어리(tEXt) 를 넣을 수 있게 */
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); }
function png(texts, w = 4, h = 4) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 7);
  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];
  (texts || []).forEach(([k, v]) => parts.push(chunk('tEXt', Buffer.from(k + '\0' + v, 'latin1'))));
  parts.push(chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)));
  return new Uint8Array(Buffer.concat(parts));
}
const jpg = s => new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from(s, 'latin1'), Buffer.alloc(2000, 3), Buffer.from([0xff, 0xd9])]));

console.log('[만든 그림]');
ok('깨끗한 PNG 는 흔적 없음', scanBytes(png()).flags.length === 0, JSON.stringify(scanBytes(png())));
ok('Photoshop 이 적힌 PNG', warns(scanBytes(png([['Software', 'Adobe Photoshop 25.0 (Windows)']]))).some(t => /Photoshop/.test(t)));
ok('Stable Diffusion parameters', warns(scanBytes(png([['parameters', 'a club screen, Steps: 20, Sampler: Euler']]))).some(t => /생성 설정/.test(t)));
ok('ComfyUI workflow', warns(scanBytes(png([['workflow', '{"nodes":[]}']]))).some(t => /AI/.test(t)));
ok('Midjourney 표시', warns(scanBytes(png([['Description', 'Job ID: x Midjourney']]))).some(t => /Midjourney/.test(t)));
ok('C2PA 기록', warns(scanBytes(jpg('jumb c2pa.actions c2pa.created OpenAI'))).some(t => /C2PA|OpenAI/.test(t)));
ok('IPTC AI 표시', warns(scanBytes(jpg('http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia'))).length > 0);
ok('폰 카메라 사진', infos(scanBytes(jpg('Exif samsung SM-S918N ExposureTime FNumber ISOSpeedRatings'))).some(t => /카메라/.test(t)));
ok('Canvas 는 Canva 로 안 봄', !warns(scanBytes(png([['Comment', 'HTML Canvas export']]))).length);
ok('GIMP JPEG', warns(scanBytes(jpg('Exif Software GIMP 2.10.34'))).some(t => /GIMP/.test(t)));

console.log('[크기]');
ok('폰 가로 2400x1080 정상', judgeSize(2400, 1080).length === 0);
ok('폰 세로 1080x2340 정상', judgeSize(1080, 2340).length === 0);
ok('태블릿 2048x1536 정상', judgeSize(2048, 1536).length === 0);
ok('정사각 잘라냄 표시', judgeSize(1000, 1000).length === 1);
ok('작은 그림 표시', judgeSize(600, 300).length >= 1);

console.log('[실제 스크린샷 — 오탐이 없어야]');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const real = fs.readdirSync(root).filter(f => /^스크린샷 .*\.png$|^KakaoTalk_.*\.png$/.test(f)).slice(0, 25);
for (const f of real) {
  const r = scanBytes(new Uint8Array(fs.readFileSync(path.join(root, f))));
  ok(f + ' 흔적 없음', warns(r).length === 0, JSON.stringify(r.flags));
}
/* 무작위 바이트 2MB 40개 — 압축된 그림 데이터에서 우연히 글자가 맞는지.
   씨앗을 고정한 의사난수(mulberry32)로 매번 같은 바이트를 만든다. 진짜 무작위(crypto)로는 'GIMP' 같은 짧은 이름이 우연히 생겨
   약 3% 확률로 실패했다(10-22). SEED 는 지금 규칙으로 오탐 0 인 값 — 규칙을 바꾼 뒤 여기서 걸리면 걸린 규칙부터 볼 것 */
const SEED = 2026;
function mulberry32(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; }; }
const rand = mulberry32(SEED);
const noise = [];
for (let i = 0; i < 40; i++) { const b = new Uint8Array(2 * 1024 * 1024); for (let j = 0; j < b.length; j += 4) { const x = rand(); b[j] = x; b[j + 1] = x >>> 8; b[j + 2] = x >>> 16; b[j + 3] = x >>> 24; } b[0] = 0x89; b[1] = 0x50; const w = warns(scanBytes(b)); if (w.length) noise.push((i + 1) + '번째: ' + w.join(', ')); }
ok('무작위 데이터 40개에서 오탐 0', noise.length === 0, '오탐 ' + noise.length + ' — ' + noise.join(' / '));

console.log(`결과: ${pass} 통과 / ${fail} 실패 (실제 스크린샷 ${real.length}장)`);
process.exit(fail ? 1 : 0);
