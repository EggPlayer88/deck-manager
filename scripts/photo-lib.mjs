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

/* 도감에 있는 팀 이름. 파일명의 팀 부분이 이 중 하나여야 카드에 붙는다. */
export const TEAMS = ['키움', '삼성', 'LG', '두산', 'KT', 'SSG', '롯데', '한화', 'NC', '기아'];

/* 파일명 → { 이름, 팀, 번호 }

     이승엽2.png        → { name:'이승엽',  team:'',     idx:2 }   팀 무관 (모든 팀에 씀)
     최형우_삼성.png     → { name:'최형우',  team:'삼성', idx:0 }   삼성 최형우 카드에만
     최형우_기아1.png    → { name:'최형우',  team:'기아', idx:1 }

   같은 선수가 팀을 옮긴 경우(도감 1,085명 중 190명) 유니폼이 다른 사진을 붙이기 위한 것이다.
   카드를 고를 때는 팀이 맞는 사진이 먼저, 없으면 팀 무관 사진이 쓰인다.
   선수 이름에 '_' 가 들어간 경우는 도감에 없어서 구분자로 안전하다. */
export function parsePhotoName(storageName) {
  const decoded = decodeName(storageName.replace(/\.[^.]+$/, ''));
  const cut = decoded.lastIndexOf('_');
  let name = decoded, team = '';
  if (cut > 0) {
    const tail = decoded.slice(cut + 1).replace(/\d+$/, '');
    /* 도감에 있는 팀 이름일 때만 팀으로 본다. 아니면 이름의 일부로 둔다 */
    if (TEAMS.indexOf(tail) >= 0) { name = decoded.slice(0, cut); team = tail; }
  }
  const m = /(\d+)$/.exec(name.length === decoded.length ? decoded : decoded.slice(cut + 1));
  return { name: name.replace(/\d+$/, ''), team, idx: m ? Number(m[1]) : 0 };
}

/* 이름만 필요할 때 (옛 이름 유지 — 부르는 곳이 있다) */
export function playerNameFromStorageName(storageName) {
  return parsePhotoName(storageName).name;
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
    const { name, team } = parsePhotoName(f.name);
    if (!name) continue;
    const byTeam = photos[name] = photos[name] || {};
    (byTeam[team] = byTeam[team] || []).push({ f: f.name });
  }
  /* 같은 선수·같은 팀의 사진은 파일명 순 — 이승엽1, 이승엽2 순서가 유지된다 */
  for (const byTeam of Object.values(photos))
    for (const list of Object.values(byTeam)) list.sort((a, b) => a.f.localeCompare(b.f));
  /* v2 = 팀별로 나뉜 모양. 팀 무관 사진은 "" 키에 들어간다 */
  return { v: 2, updatedAt: new Date().toISOString(), photos };
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
    /* '_' 로 시작하면 폴더든 파일이든 참고·보관용으로 보고 건너뛴다.
       폴더 예: _현재 웹앱 적용중/ — 눈으로 보려고 받아둔 것이지 다시 올릴 대상이 아니다.
       파일 예: _사진규격_가이드.png — 작업용 안내 그림이지 선수 사진이 아니다. */
    if (e.name.startsWith('_')) continue;
    const rel = base ? path.join(base, e.name) : e.name;
    if (e.isDirectory()) out = out.concat(walkImages(fs, path, path.join(dir, e.name), rel));
    else if (IMG_RE.test(e.name)) out.push(rel);
  }
  return out;
}

/* ── 확장자만 다른 중복 찾기 ──
   같은 사진을 새로 올려도 확장자가 다르면 옛 파일이 버킷에 그대로 남는다.
   buildManifest 는 파일명 순으로 첫 장을 고르는데 '.png' 가 '.webp' 보다 앞서서,
   옛 그림이 카드에 뜨고 새 그림은 묻힌다 — 업로드는 성공했는데 웹에는 안 보인다.
   같은 선수의 여러 장(이승엽1 · 이승엽2)은 base 가 다르므로 여기 안 걸린다.
   keep 은 .webp 를 우선한다 (업로드 파이프라인이 내보내는 형식). */
export function findShadowed(files) {
  const byBase = {};
  for (const f of files) {
    const name = typeof f === 'string' ? f : f.name;
    const base = name.replace(/.[^.]+$/, '');
    (byBase[base] = byBase[base] || []).push(name);
  }
  return Object.keys(byBase)
    .filter((b) => byBase[b].length > 1)
    .sort()
    .map((b) => {
      const names = byBase[b].slice().sort();
      const keep = names.filter((n) => /.webp$/i.test(n))[0] || names[0];
      return { base: b, names, keep, drop: names.filter((n) => n !== keep) };
    });
}
