/* 선수 사진 동기화 — 공용 로직
   웹 UI(src/supabase.js)와 같은 규칙을 쓰므로, 인코딩 규칙을 바꾸려면 양쪽을 함께 고쳐야 한다. */

export const PHOTO_BUCKET = 'player-photos';
/* 매니페스트도 같은 버킷에 둔다. 이름이 '_' 로 시작하므로 선수 사진과 섞이지 않는다. */
export const MANIFEST_FILE = '_index.json';

/* 선수 이름 → 파일명: 유니코드 코드포인트를 4자리 16진수로.
   "김도영" → "AE40B3C4C601", ASCII 는 그대로. src/supabase.js 의 encodeName 과 동일. */
export function encodeName(name) {
  let out = '';
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i);
    out += code < 128 ? name[i] : code.toString(16).toUpperCase().padStart(4, '0');
  }
  return out;
}

export function decodeName(encoded) {
  let out = '';
  let i = 0;
  while (i < encoded.length) {
    if (i + 4 <= encoded.length) {
      const code = parseInt(encoded.slice(i, i + 4), 16);
      if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x318E)) {
        out += String.fromCharCode(code);
        i += 4;
        continue;
      }
    }
    out += encoded[i];
    i++;
  }
  return out;
}

/* 파일명에서 선수 이름을 뽑는다. "이승엽2.png" → "이승엽"
   끝의 숫자는 같은 선수의 몇 번째 사진인지를 뜻하는 구분자다. */
export function playerNameFromStorageName(storageName) {
  const base = storageName.replace(/\.[^.]+$/, '');
  return decodeName(base).replace(/\d+$/, '');
}

/* 버킷 전체 목록. storage.list 의 기본 limit 은 100 이라 반드시 페이지를 넘겨야 한다. */
export async function listAllFiles(supabase, bucket = PHOTO_BUCKET) {
  const PAGE = 1000;
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket)
      .list('', { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`버킷 목록 실패: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
  }
  /* 매니페스트와 폴더 플레이스홀더는 사진이 아니다 */
  return out.filter(f => f.name && !f.name.startsWith('_') && /\.(jpe?g|png|webp)$/i.test(f.name));
}

/* 버킷 파일 목록 → 매니페스트 (이름별 사진 파일 목록)

   카드에서의 세로 위치는 매니페스트에 담지 않는다. 앱이 모든 사진에 같은 고정값을 쓴다.
   위치를 사진마다 다르게 하면 사진을 만들 때 어디가 잘릴지 예측할 수 없어서,
   "규격에 맞춰 만든다" 는 전제가 무너진다. (deck-manager.jsx 의 PHOTO_POS) */
export function buildManifest(files) {
  const photos = {};
  for (const f of files) {
    const name = playerNameFromStorageName(f.name);
    if (!name) continue;
    (photos[name] = photos[name] || []).push({ f: f.name });
  }
  /* 같은 선수의 사진은 파일명 순 — 이승엽1, 이승엽2 순서가 유지된다 */
  for (const list of Object.values(photos)) list.sort((a, b) => a.f.localeCompare(b.f));
  return { v: 1, updatedAt: new Date().toISOString(), photos };
}

/* 폴더를 하위까지 전부 훑어 사진 파일의 상대경로를 모은다.
   선수사진/ 아래에 작업 단위로 폴더를 만들어 넣어도 되게 하려는 것이다.
   폴더 이름은 정리용일 뿐 매칭에 쓰이지 않는다 — 매칭은 파일명으로만 한다. */
export const IMG_RE = /\.(jpe?g|png|webp)$/i;

export function walkImages(fs, path, dir, base = '') {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;   /* .sync-cache.json 같은 숨김 파일 */
    /* '_' 로 시작하는 폴더는 참고·보관용으로 보고 건너뛴다.
       예: _현재 웹앱 적용중/ — 눈으로 보려고 받아둔 것이지 다시 올릴 대상이 아니다. */
    if (e.isDirectory() && e.name.startsWith('_')) continue;
    const rel = base ? path.join(base, e.name) : e.name;
    if (e.isDirectory()) out = out.concat(walkImages(fs, path, path.join(dir, e.name), rel));
    else if (IMG_RE.test(e.name)) out.push(rel);
  }
  return out;
}
