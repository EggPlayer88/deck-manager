import { createClient } from '@supabase/supabase-js';
/* 선수 사진의 이름↔파일명 인코딩 규칙은 scripts/photo-lib.mjs 한 곳에만 둔다.
   올리는 쪽(npm run photos)과 읽는 쪽(이 파일)이 같은 규칙을 써야 하므로,
   복사해 두면 한쪽만 바뀌었을 때 이미 올라간 사진을 통째로 못 찾게 된다. */
import { PHOTO_BUCKET, MANIFEST_FILE, encodeName, decodeName, buildManifest, parsePhotoName } from '../scripts/photo-lib.mjs';

var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
var SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export var supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

/* ============ Auth ============ */
export async function signInWithGoogle() {
  if (!supabase) return { error: 'Supabase not configured' };
  return await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
}

export async function signOut() {
  if (!supabase) return {};
  return await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  var r = await supabase.auth.getSession();
  return r.data.session;
}

export async function getProfile(userId) {
  if (!supabase) return null;
  var r = await supabase.from('profiles').select('*').eq('id', userId);
  if (r.error || !r.data || r.data.length === 0) return null;
  return r.data[0];
}

/* ============ User Data (per-user) ============ */
/* 읽기 실패와 "아직 저장한 적 없음" 을 구분한다.

   예전에는 둘 다 null 이었다. 그래서 읽기가 한 번 실패하면 화면에 빈 덱이 뜨고,
   그 상태에서 유저가 카드 하나만 건드려도 빈 덱이 sd_state 를 통째로 덮어써
   저장해 둔 덱이 사라졌다. 복구할 방법은 프로젝트 전체 백업 복원뿐이었다.

   - 행이 없음(신규 유저)  → null. 정상이다
   - 읽기가 실패           → throw. 부르는 쪽이 저장을 포기해야 한다
   - 로그인 세션이 없음    → throw. 아래 sessionTokenFor 설명 참고 */

/* 계정 id(uuid)인가. 게스트 id("guest_1759…")는 uuid 가 아니라 서버에 줄이 있을 수 없다 */
function isAccountId(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''));
}

/* 이 계정으로 로그인된 세션의 토큰. 세션이 없거나 다른 계정의 것이면 null.

   로그인해 둔 탭에서도 세션이 잠깐 없는 순간이 있다. 토큰이 만료됐는데 갱신 요청이 실패하면
   (절전에서 막 깨어났을 때, 통신이 불안정할 때) supabase-js 는 최대 1분 동안 "세션 없음"을 돌려주고,
   그동안의 요청을 anon 키로 보낸다. anon 으로 읽으면 RLS 가 내 줄을 가려서 오류가 아니라
   "행이 없음"(PGRST116)이 온다. 이것을 신규 유저로 받아들이면 화면에 빈 덱이 뜨고,
   세션이 돌아온 뒤 그 빈 덱이 서버의 덱을 덮어쓴다.
   그래서 계정의 줄은 그 계정의 토큰을 직접 붙여서만 읽는다 — 그래야 "행이 없음"을 믿을 수 있다. */
async function sessionTokenFor(userId) {
  var r = await supabase.auth.getSession();
  var s = r && r.data && r.data.session;
  if (!s || !s.access_token || !s.user || s.user.id !== userId) return null;
  return s.access_token;
}

/* 줄을 읽는다. 저장 시각(updated_at)도 함께 받는다 —
   쓸 때 "내가 읽은 뒤로 줄이 바뀌지 않았을 때만" 쓰기 위해서다 (saveUserRow).
   돌려주는 것: { state: sd_state 또는 null, stamp: updated_at 또는 null, exists: 줄이 있는가 } */
export async function loadUserRow(userId) {
  if (!supabase || !userId) return { state: null, stamp: null, exists: false };
  var q = supabase.from('user_settings').select('sd_state,updated_at')
    .eq('user_id', userId).eq('key', 'settings');
  if (isAccountId(userId)) {
    var token = await sessionTokenFor(userId);
    if (!token) throw new Error('로그인 상태를 확인하지 못했습니다 (세션 만료 또는 통신 불안정)');
    q = q.setHeader('Authorization', 'Bearer ' + token);
  }
  var r = await q.single();
  if (r.error) {
    /* 아래 둘은 "이 사람에게는 저장된 것이 없다" 는 뜻이지 실패가 아니다.
       - PGRST116 : 조건에 맞는 행이 없음 (신규 유저)
       - 22P02    : user_id 가 uuid 형식이 아님. 게스트("guest_1759…")가 여기 걸린다.
                    형식이 어긋난 id 로는 애초에 행이 있을 수 없으므로 "없음"이 맞다.
                    이걸 실패로 보면 게스트가 오류 화면에 막혀 앱을 아예 못 쓴다. */
    if (r.error.code === 'PGRST116' || r.error.code === '22P02') return { state: null, stamp: null, exists: false };
    throw new Error('사용자 데이터를 읽지 못했습니다: '
      + (r.error.message || r.error.code || '알 수 없는 오류'));
  }
  return { state: (r.data && r.data.sd_state) || null, stamp: (r.data && r.data.updated_at) || null, exists: true };
}

export async function loadUserData(userId) {
  return (await loadUserRow(userId)).state;
}

/* 줄을 쓴다 — got(loadUserRow 가 돌려준 것)을 읽은 뒤로 줄이 바뀌지 않았을 때만.

   예전의 saveUserData 는 조건 없이 줄을 통째로 덮어썼다(upsert). 탭이 들고 있던 옛 사본을 그렇게 쓰면
   그 사이 다른 기기·다른 탭이 저장한 것이 전부 되돌아간다. 그래서 부르는 쪽은 쓰기 직전에 줄을 다시 읽어
   바꿀 것만 얹고(덱 매니저의 commit), 여기서는 읽고 쓰는 그 짧은 사이에 끼어든 저장까지 걸러 낸다.

   돌려주는 것: { ok: true, stamp } · { ok: false, conflict: true }(그 사이 줄이 바뀜 — 다시 읽고 다시 얹을 것)
               · { ok: false, error }(통신·권한 실패) */
export async function saveUserRow(userId, data, got) {
  if (!supabase || !userId) return { ok: false, error: new Error('저장할 수 없는 상태입니다') };
  var token = null;
  if (isAccountId(userId)) {
    /* 토큰 없이(anon) 나간 쓰기는 RLS 에 걸려 "0줄 바뀜"이 되는데, 그러면 "줄이 바뀌었다"와 구분이 안 된다 */
    token = await sessionTokenFor(userId);
    if (!token) return { ok: false, error: new Error('로그인 상태를 확인하지 못했습니다 (세션 만료 또는 통신 불안정)') };
  }
  var now = new Date().toISOString();
  var q;
  if (got && got.exists) {
    q = supabase.from('user_settings').update({ sd_state: data, updated_at: now })
      .eq('user_id', userId).eq('key', 'settings');
    /* got.force — 줄이 바뀌지 않았는데도(읽은 시각이 그대로인데도) 조건이 걸리지 않았을 때만 부르는 쪽이 켠다.
       시각 조건 자체가 어긋난 것이라 조건 없이 쓴다 (그렇게라도 저장은 돼야 한다) */
    if (!got.force) q = got.stamp ? q.eq('updated_at', got.stamp) : q.is('updated_at', null);
  } else {
    q = supabase.from('user_settings').insert({ user_id: userId, key: 'settings', sd_state: data, updated_at: now });
  }
  q = q.select('updated_at');
  if (token) q = q.setHeader('Authorization', 'Bearer ' + token);
  var r = await q;
  if (r.error) {
    /* 23505 : 줄이 없는 줄 알고 만들려 했는데 그 사이 다른 곳에서 먼저 만들었다 */
    if (r.error.code === '23505') return { ok: false, conflict: true };
    console.error('saveUserRow error:', r.error);
    /* 통신 실패가 아니라 서버가 이 쓰기 문장을 거절한 경우 — 예전 방식(조건 없는 upsert)으로 한 번 더 써 본다.
       새 방식이 운영 서버의 어떤 설정과 맞지 않더라도 저장 자체는 돼야 한다. 보내는 줄은 이미 최신본에 얹은 것이라
       옛 사본을 덮어쓰던 때와는 다르다. 이렇게 쓴 줄은 savedBy 끝에 "/upsert" 가 붙어 나중에 가려낼 수 있다 */
    if (r.status >= 400 && r.status < 500) {
      var q2 = supabase.from('user_settings').upsert({
        user_id: userId, key: 'settings', updated_at: now,
        sd_state: Object.assign({}, data, { savedBy: String((data && data.savedBy) || '') + '/upsert' })
      }, { onConflict: 'user_id,key' });
      if (token) q2 = q2.setHeader('Authorization', 'Bearer ' + token);
      var r2 = await q2;
      if (!r2.error) return { ok: true, stamp: now, fallback: true };
      console.error('saveUserRow fallback error:', r2.error);
    }
    return { ok: false, error: new Error(r.error.message || r.error.code || '저장하지 못했습니다') };
  }
  if (!r.data || r.data.length === 0) return { ok: false, conflict: true };
  return { ok: true, stamp: r.data[0].updated_at };
}

/* ============ Global Skills (admin) ============ */
export async function loadGlobalSkills() {
  if (!supabase) return null;
  var r = await supabase.from('global_skills').select('data,weights').order('updated_at', { ascending: false }).limit(1);
  if (r.error || !r.data || r.data.length === 0) return null;
  var sk = r.data[0].data;
  if (r.data[0].weights) sk.weights = r.data[0].weights;
  return sk;
}

export async function saveGlobalSkills(skillsData) {
  if (!supabase) return false;
  var w = skillsData.weights || {};
  var d = Object.assign({}, skillsData);
  delete d.weights;
  var r = await supabase.from('global_skills').upsert({
    id: '00000000-0000-0000-0000-000000000001',
    data: d,
    weights: w,
    updated_at: new Date().toISOString()
  });
  return !r.error;
}

/* ============ Global Players (admin) ============ */
/* 선수도감 캐시 (세션 동안 재사용) */
var _globalPlayersCache = null;
var _globalPlayersCacheTime = 0;
var CACHE_TTL = 10 * 60 * 1000; /* 10분 */

/* 어떤 컬럼 조합이 되는지 기억한다 (매번 실패 재시도하지 않도록) */
var _globalPlayersColTier = 0;

export async function loadGlobalPlayers() {
  if (!supabase) return [];
  /* 캐시 유효하면 재사용 */
  var now = Date.now();
  if (_globalPlayersCache && (now - _globalPlayersCacheTime) < CACHE_TTL) {
    return _globalPlayersCache;
  }
  /* 필요한 컬럼만 선택 (select * 대신) */
  var BASE_COLS = 'id,name,cardType,year,team,role,position,subPosition,hand,stars,power,accuracy,eye,patience,running,defense,speed,change,stuff,control,stamina,impactType,liveType,setScore';
  /* 선수 카드에 귀속되는 값이라 도감(DB)에 있어야 하는 항목.
     DB 마다 있는 컬럼이 달라서 넓은 것부터 차례로 시도하고, 되는 조합을 기억한다.
     한 묶음으로 처리하면 whiteZone 이 없다는 이유로 launchAngle 까지 버려진다. */
  var COL_TIERS = [
    BASE_COLS + ',launchAngle,whiteZone,coldZone',
    BASE_COLS + ',launchAngle',
    BASE_COLS,
  ];
  var tier = _globalPlayersColTier;
  var allData = [];
  var pageSize = 1000;

  for (; tier < COL_TIERS.length; tier++) {
    var cols = COL_TIERS[tier];
    var ok = true;
    allData = [];
    for (var page = 0; ; page++) {
      /* id 까지 정렬해야 페이지 경계가 고정된다.
         (cardType, name) 만으로는 동순위 행이 많아 — 송지만 시그니처만 9장이다 —
         페이지마다 순서가 달라질 수 있고, 그러면 경계에 걸친 행이 통째로 빠진다.
         빠진 행은 도감 업로드에서 "없는 카드" 로 보여 중복이 새로 생긴다. */
      var r = await supabase.from('global_players').select(cols)
        .order('cardType').order('name').order('id')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      if (r.error) {
        if (tier < COL_TIERS.length - 1) {
          console.warn('[global_players] 컬럼 조합 실패 — 다음 조합으로 재시도합니다.', r.error.message);
        }
        ok = false;
        break;
      }
      if (!r.data || r.data.length === 0) break;
      allData = allData.concat(r.data);
      if (r.data.length < pageSize) break;
    }
    if (ok) { _globalPlayersColTier = tier; break; }
  }

  _globalPlayersCache = allData;
  _globalPlayersCacheTime = Date.now();
  return allData;
}

export function clearGlobalPlayersCache() {
  _globalPlayersCache = null;
  _globalPlayersCacheTime = 0;
  _globalPlayersColTier = 0;
}

/* 아직 DB 에 없을 수 있는 컬럼. 저장이 이것 때문에 실패하면 빼고 한 번 더 시도한다.
   (컬럼을 추가하기 전까지 도감 저장이 통째로 막히는 것을 막기 위한 임시 방어) */
var OPTIONAL_PLAYER_COLS = ['whiteZone', 'coldZone'];
function stripOptional(p) {
  var c = Object.assign({}, p);
  OPTIONAL_PLAYER_COLS.forEach(function (k) { delete c[k]; });
  return c;
}

export async function saveGlobalPlayer(player) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').upsert(player, { onConflict: 'id' });
  if (r.error) {
    console.warn('[global_players] 저장 실패 — 선택 컬럼을 빼고 재시도합니다.', r.error.message);
    r = await supabase.from('global_players').upsert(stripOptional(player), { onConflict: 'id' });
  }
  return !r.error;
}

/* 마지막 저장 오류 — 호출부가 사용자에게 알려줄 수 있도록 남긴다.
   값이 아니라 함수로 노출해야 window._SUPABASE 에 담아도 최신값이 읽힌다. */
var lastPlayerSaveError = null;
export function getPlayerSaveError() { return lastPlayerSaveError; }
export function clearPlayerSaveError() { lastPlayerSaveError = null; }

/* 충돌 판정은 기본키(id)로 한다.
   자연키(name,cardType,year,impactType,team)로 걸면 impactType 이 NULL 인 카드
   (임팩트 외 전부)에서 유니크 인덱스가 NULL 을 서로 다른 값으로 보아 매칭에
   실패하고, INSERT 로 넘어가 이미 있는 id 와 부딪혀 global_players_pkey 위반이 난다.
   가져오기는 기존 도감에서 id 를 찾아 물려주므로 id 기준이 맞다. */
var CONFLICT_KEY = 'id';

/* 한 요청 안에 같은 id 가 두 번 들어오면 배치 전체가 실패하므로 미리 걷어낸다
   (뒤엣것이 이긴다). */
function dedupeByConflictKey(players) {
  var seen = {};
  var out = [];
  players.forEach(function (p) {
    var k = p && p.id;
    if (!k) { out.push(p); return; }
    seen[k] = p;
  });
  Object.keys(seen).forEach(function (k) { out.push(seen[k]); });
  return out;
}

export async function saveGlobalPlayers(players) {
  if (!supabase || !players || !players.length) return false;
  var rows = dedupeByConflictKey(players);
  var r = await supabase.from('global_players').upsert(rows, { onConflict: CONFLICT_KEY });
  if (r.error) {
    console.warn('[global_players] 일괄 저장 실패 — 선택 컬럼을 빼고 재시도합니다.', r.error.message);
    r = await supabase.from('global_players').upsert(rows.map(stripOptional), { onConflict: CONFLICT_KEY });
  }
  if (r.error) {
    lastPlayerSaveError = r.error.message || String(r.error);
    console.error('[global_players] 일괄 저장 최종 실패:', r.error);
  }
  return !r.error;
}

export async function deleteGlobalPlayer(id) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').delete().eq('id', id);
  return !r.error;
}

/* ── 선수 사진 (player-photos 버킷) ── */

export async function uploadPlayerPhoto(file, originalFileName) {
  if (!supabase) return null;
  var ext = originalFileName.split('.').pop().toLowerCase();
  var baseName = originalFileName.replace(/\.[^.]+$/, '');
  var safeFileName = encodeName(baseName) + '.' + ext;
  var { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(safeFileName, file, { upsert: true, contentType: file.type });
  if (error) { console.error('uploadPlayerPhoto error:', error); return null; }
  var { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(safeFileName);
  return urlData?.publicUrl || null;
}

/* 버킷 전체 목록.
   storage.list 의 기본 limit 은 100 이다. 인자를 주지 않으면 101장째부터 조용히 사라지므로
   반드시 페이지를 넘겨 가며 모아야 한다.
   이름이 '_' 로 시작하는 것(_index.json)은 사진이 아니라 매니페스트다. */
async function listAllPhotoFiles() {
  if (!supabase) return [];
  var PAGE = 1000;
  var out = [];
  for (var offset = 0; ; offset += PAGE) {
    var r = await supabase.storage.from(PHOTO_BUCKET)
      .list('', { limit: PAGE, offset: offset, sortBy: { column: 'name', order: 'asc' } });
    if (r.error || !r.data) break;
    out = out.concat(r.data);
    if (r.data.length < PAGE) break;
  }
  return out.filter(function (f) {
    return f.name && f.name.charAt(0) !== '_' && /\.(jpe?g|png|webp)$/i.test(f.name);
  });
}

export function photoPublicUrl(storageName) {
  if (!SUPABASE_URL || !storageName) return '';
  return SUPABASE_URL + '/storage/v1/object/public/' + PHOTO_BUCKET + '/' + storageName;
}

export async function listPlayerPhotos(playerName) {
  if (!supabase || !playerName) return [];
  var data = await listAllPhotoFiles();
  var filtered = data.filter(function(f) {
    /* 폴백 경로라 팀은 가리지 않는다 — 이름만 맞으면 전부 돌려준다.
       (매니페스트가 있을 때는 이 함수를 쓰지 않는다) */
    return parsePhotoName(f.name).name === playerName;
  });
  filtered.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return filtered.map(function(f) { return photoPublicUrl(f.name); });
}

export async function deletePlayerPhoto(fileName) {
  if (!supabase) return false;
  var { error } = await supabase.storage.from(PHOTO_BUCKET).remove([fileName]);
  return !error;
}

export async function listAllPhotos() {
  if (!supabase) return [];
  var data = await listAllPhotoFiles();
  return data.map(function(f) {
    var decoded = decodeName(f.name.replace(/\.[^.]+$/, ''));
    var p = parsePhotoName(f.name);
    return {
      storageName: f.name,          /* Supabase Storage 실제 파일명 (삭제 시 사용) */
      name: decoded + f.name.match(/\.[^.]+$/)[0], /* 표시용 원본 한글 파일명 */
      /* 관리 화면의 묶음 이름. 팀이 붙은 사진은 따로 묶어 보여 준다 */
      baseName: p.team ? (p.name + ' (' + p.team + ')') : p.name,
      player: p.name,
      team: p.team,
      url: photoPublicUrl(f.name)
    };
  });
}

/* ── 사진 매니페스트 (_index.json) ──
   버킷 전체를 선수마다 훑는 대신, 이름→사진 목록을 담은 파일 하나를 받아 쓴다.
   npm run photos 가 만들고, 웹 UI 업로드·삭제 때도 다시 쓴다.

   모양: { v:1, updatedAt, photos: { "이승엽": [{ f:"C774C2B9C5FD1.webp" }, ...] } }
   pos 는 동기화 때 자동 크롭이 찾아낸 세로 위치(%)로, 슬라이더 값이 없을 때의 기본값이 된다. */
/* MANIFEST_FILE 은 scripts/photo-lib.mjs 에서 가져온다 */

/* 저장 모양(파일명) → 앱이 쓰는 모양
     { 선수이름: { '': [url…], '기아': [url…], '삼성': [url…] } }
   '' 는 팀 무관 사진이다. 카드는 팀이 맞는 것을 먼저 쓰고, 없으면 '' 를 쓴다.

   v1(팀 개념이 없던 모양: 이름 → 배열)도 읽는다 — 배포와 매니페스트 갱신 사이에
   옛 파일이 남아 있어도 화면이 깨지지 않게 하기 위해서다. */
function normalizeManifest(m) {
  if (!m || !m.photos) return null;
  var photos = {};
  Object.keys(m.photos).forEach(function (name) {
    var src = m.photos[name];
    var byTeam = {};
    if (Array.isArray(src)) {
      /* v1 — 전부 팀 무관으로 본다 */
      byTeam[''] = src.filter(function (e) { return e && e.f; }).map(function (e) { return photoPublicUrl(e.f); });
    } else if (src && typeof src === 'object') {
      Object.keys(src).forEach(function (team) {
        var urls = (src[team] || []).filter(function (e) { return e && e.f; })
          .map(function (e) { return photoPublicUrl(e.f); });
        if (urls.length) byTeam[team] = urls;
      });
    }
    if (Object.keys(byTeam).length) photos[name] = byTeam;
  });
  return { photos: photos, updatedAt: m.updatedAt || '' };
}

export async function loadPhotoManifest() {
  if (!SUPABASE_URL) return null;
  try {
    /* CDN 캐시를 피하려고 분 단위로 바뀌는 값을 붙인다 (업로드 때 cacheControl 60 과 맞춤) */
    var bust = Math.floor(Date.now() / 60000);
    var res = await fetch(photoPublicUrl(MANIFEST_FILE) + '?v=' + bust);
    if (!res.ok) return null;
    return normalizeManifest(await res.json());
  } catch (e) {
    console.warn('[photo] 매니페스트를 읽지 못했습니다 — 버킷 목록으로 대신합니다.', e && e.message);
    return null;
  }
}

/* 웹 UI 에서 사진을 올리거나 지운 뒤 매니페스트를 다시 쓴다.
   방금 쓴 내용을 loadPhotoManifest 와 같은 모양으로 돌려준다 — CDN 캐시가 갱신되기를
   기다리지 않고 화면에 바로 반영하기 위해서다. 실패하면 null. */
export async function rebuildPhotoManifest() {
  if (!supabase) return null;
  var files = await listAllPhotoFiles();
  var manifest = buildManifest(files);
  var body = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  var r = await supabase.storage.from(PHOTO_BUCKET)
    .upload(MANIFEST_FILE, body, { upsert: true, contentType: 'application/json', cacheControl: '60' });
  if (r.error) { console.error('[photo] 매니페스트 저장 실패:', r.error.message); return null; }
  return normalizeManifest(manifest);
}

/* ── 팀 로고 (team-logos 버킷) ── */
const LOGO_BUCKET = 'team-logos';

/* 팀명 → 인코딩된 파일명 (한글 → 16진수) */
function encodeTeamName(name) {
  /* 영문은 대문자로 통일 (LG/Lg/lg 모두 'LG_1.png'로 매핑) */
  var result = '';
  for (var i = 0; i < name.length; i++) {
    var code = name.charCodeAt(i);
    if (code < 128) { result += name[i].toUpperCase(); }
    else { result += code.toString(16).toUpperCase().padStart(4,'0'); }
  }
  return result;
}

/* 팀 로고 URL 반환
   index: 1=기본, 2=레트로/과거, 3=대체
   나중에 연도 조건에 따라 index를 다르게 전달하면 됨 */
export function getTeamLogoUrl(team, index) {
  if (!team || !SUPABASE_URL) return '';
  var idx = index || 1;
  /* 팀명 인코딩 + '_' 구분자 + 인덱스 (예: AE30C544_1.png) */
  var encoded = encodeTeamName(team) + '_' + idx + '.png';
  return SUPABASE_URL + '/storage/v1/object/public/' + LOGO_BUCKET + '/' + encoded;
}

export async function uploadTeamLogo(file, teamName, index) {
  if (!supabase) return null;
  var idx = index || 1;
  var encoded = encodeTeamName(teamName) + '_' + idx + '.png';
  var { data, error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(encoded, file, { upsert: true, contentType: 'image/png' });
  if (error) { console.error('uploadTeamLogo error:', error); return null; }
  var { data: urlData } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(encoded);
  return urlData?.publicUrl || null;
}

const ADMIN_UID = '35f45af0-2817-4157-9e41-90b3349a21d4';


/* ── POTM 전역 명단 ──
   관리자 계정의 user_settings 에 'potm_list' 키로 저장
   value: JSON 배열 [{name, team}, ...]
   모든 유저가 읽기, 관리자만 쓰기 (앱 레벨에서 관리자 UI만 노출하여 제한) */
const POTM_LIST_KEY = 'potm_list';

export async function loadGlobalPotmList() {
  if (!supabase) return [];
  var { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', ADMIN_UID)
    .eq('key', POTM_LIST_KEY)
    .single();
  if (error || !data) return [];
  try {
    var parsed = JSON.parse(data.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) { return []; }
}

export async function saveGlobalPotmList(potmList) {
  if (!supabase) return false;
  var arr = Array.isArray(potmList) ? potmList : [];
  var { error } = await supabase.from('user_settings').upsert({
    user_id: ADMIN_UID,
    key: POTM_LIST_KEY,
    value: JSON.stringify(arr),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,key' });
  return !error;
}
