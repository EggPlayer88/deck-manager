/* 선수 사진 동기화 로직 테스트
   실행:  node test/photo.test.mjs

   파일명 인코딩 규칙은 src/supabase.js 와 scripts/photo-lib.mjs 두 곳에 같은 내용으로 있다.
   한쪽만 고치면 이미 올라간 사진을 못 찾게 되므로, 여기서 규칙 자체를 못 박아 둔다. */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  encodeName, decodeName, playerNameFromStorageName, buildManifest, walkImages,
} from '../scripts/photo-lib.mjs';

let pass = 0, fail = 0;
function eq(label, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got  ${g}\n         want ${w}`); }
}

console.log('\n[파일명 인코딩] src/supabase.js 의 encodeName 과 같아야 한다');
eq('한글 → 4자리 16진수', encodeName('김도영'), 'AE40B3C4C601');
eq('끝 숫자는 그대로', encodeName('이승엽2'), 'C774C2B9C5FD2');
eq('영문은 그대로', encodeName('LG'), 'LG');
eq('왕복', decodeName(encodeName('강백호')), '강백호');
eq('파일명 → 선수 이름', playerNameFromStorageName(encodeName('이승엽2') + '.jpg'), '이승엽');
eq('숫자 없는 파일명', playerNameFromStorageName(encodeName('김도영') + '.jpg'), '김도영');
eq('영문 혼용 이름', playerNameFromStorageName(encodeName('로하스') + '.jpg'), '로하스');

console.log('\n[매니페스트] 이름별 사진 목록만 담는다 — 위치값은 담지 않는다');
const f = (n) => ({ name: encodeName(n) + '.webp' });
const files = [f('이승엽2'), f('이승엽1'), f('김도영')];
const m1 = buildManifest(files);
eq('선수별로 묶인다', Object.keys(m1.photos).sort(), ['김도영', '이승엽']);
eq('한 선수의 여러 장이 파일명 순',
  m1.photos['이승엽'].map((e) => e.f),
  [encodeName('이승엽1') + '.webp', encodeName('이승엽2') + '.webp']);
eq('항목은 파일명만 갖는다', Object.keys(m1.photos['이승엽'][0]), ['f']);
eq('위치값 필드가 없다', m1.posByName, undefined);

console.log('\n[사진 변환] 투명 배경을 지키고, 자르지 않는다');
/* 위쪽에만 불투명한 사각형을 둔 2:3 이미지 — 배경을 딴 누끼 사진을 흉내낸다 */
const src = await sharp({
  create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{
  input: await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 250, g: 240, b: 220, alpha: 1 } } })
    .png().toBuffer(),
  top: 120, left: 312,
}]).png().toBuffer();

const { data, info } = await sharp(src)
  .rotate()
  .resize(600, 900, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85, alphaQuality: 100 })
  .toBuffer({ resolveWithObject: true });

eq('WebP 로 나온다', info.format, 'webp');
eq('알파 채널이 살아 있다 — JPEG 면 투명 배경이 검게 칠해진다', info.hasAlpha, true);
eq('2:3 비율이 그대로다 (자르지 않음)', [info.width, info.height], [600, 900]);

/* 정사각형을 넣어도 비율을 바꾸지 않는다 — 구도는 작업자 몫이다 */
const sq = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .png().toBuffer();
const sqOut = await sharp(sq).resize(600, 900, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85, alphaQuality: 100 }).toBuffer({ resolveWithObject: true });
eq('정사각형은 정사각형 그대로', [sqOut.info.width, sqOut.info.height], [600, 600]);
console.log(`  ·    2:3 결과 ${(data.length / 1024).toFixed(0)}KB`);
console.log('\n[폴더 훑기] 선수사진/ 아래에 폴더째로 넣어도 찾아내야 한다');
{
  const t = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-skip-'));
  fs.mkdirSync(path.join(t, '_현재 웹앱 적용중'), { recursive: true });
  fs.mkdirSync(path.join(t, '올릴것'), { recursive: true });
  fs.writeFileSync(path.join(t, '_현재 웹앱 적용중', '이승엽1.png'), 'x');
  fs.writeFileSync(path.join(t, '올릴것', '김도영.png'), 'x');
  const got = walkImages(fs, path, t).map((p) => p.split(path.sep).join('/'));
  eq('_ 로 시작하는 참고 폴더는 건너뛴다', got, ['올릴것/김도영.png']);
  fs.rmSync(t, { recursive: true, force: true });
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-walk-'));
fs.mkdirSync(path.join(tmp, '20260914 작업분'), { recursive: true });
fs.mkdirSync(path.join(tmp, '기아 추가분', '더 깊은 폴더'), { recursive: true });
fs.writeFileSync(path.join(tmp, '루트선수.jpg'), 'x');
fs.writeFileSync(path.join(tmp, '20260914 작업분', '이승엽1.JPG'), 'x');
fs.writeFileSync(path.join(tmp, '20260914 작업분', '메모.txt'), 'x');
fs.writeFileSync(path.join(tmp, '기아 추가분', '나성범.png'), 'x');
fs.writeFileSync(path.join(tmp, '기아 추가분', '더 깊은 폴더', '김도영.webp'), 'x');
fs.writeFileSync(path.join(tmp, '.sync-cache.json'), '{}');

const found = walkImages(fs, path, tmp).map((p) => p.split(path.sep).join('/')).sort();
eq('하위 폴더까지 찾는다', found, [
  '20260914 작업분/이승엽1.JPG',
  '기아 추가분/더 깊은 폴더/김도영.webp',
  '기아 추가분/나성범.png',
  '루트선수.jpg',
].sort());
eq('사진이 아닌 파일은 거른다', found.some((p) => p.endsWith('.txt')), false);
eq('숨김 파일은 거른다', found.some((p) => p.includes('.sync-cache')), false);
eq('폴더 이름은 매칭에 안 쓴다',
  playerNameFromStorageName(encodeName(path.basename('20260914 작업분/이승엽1.JPG', '.JPG')) + '.jpg'),
  '이승엽');
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n결과: ${pass} 통과 / ${fail} 실패\n`);
process.exit(fail ? 1 : 0);
