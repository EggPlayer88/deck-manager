import { createClient } from '@supabase/supabase-js';

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
export async function loadUserData(userId) {
  if (!supabase || !userId) return null;
  var r = await supabase.from('user_settings').select('sd_state')
    .eq('user_id', userId).eq('key', 'settings').single();
  if (r.error || !r.data) return null;
  return r.data.sd_state || null;
}

export async function saveUserData(userId, data) {
  if (!supabase || !userId) return false;
  var r = await supabase.from('user_settings').upsert({
    user_id: userId,
    key: 'settings',
    sd_state: data,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,key' });
  if (r.error) { console.error('saveUserData error:', r.error); return false; }
  return true;
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

export async function loadGlobalPlayers() {
  if (!supabase) return [];
  /* 캐시 유효하면 재사용 */
  var now = Date.now();
  if (_globalPlayersCache && (now - _globalPlayersCacheTime) < CACHE_TTL) {
    return _globalPlayersCache;
  }
  /* 필요한 컬럼만 선택 (select * 대신) */
  var cols = 'id,name,cardType,year,team,role,position,subPosition,hand,stars,power,accuracy,eye,patience,running,defense,speed,change,stuff,control,stamina,impactType,liveType,setScore';
  var allData = [];
  var page = 0;
  var pageSize = 1000;
  while (true) {
    var r = await supabase.from('global_players').select(cols)
      .order('cardType').order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (r.error || !r.data || r.data.length === 0) break;
    allData = allData.concat(r.data);
    if (r.data.length < pageSize) break;
    page++;
  }
  _globalPlayersCache = allData;
  _globalPlayersCacheTime = Date.now();
  return allData;
}

export function clearGlobalPlayersCache() {
  _globalPlayersCache = null;
  _globalPlayersCacheTime = 0;
}

export async function saveGlobalPlayer(player) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').upsert(player, { onConflict: 'id' });
  return !r.error;
}

export async function saveGlobalPlayers(players) {
  if (!supabase || !players || !players.length) return false;
  var r = await supabase.from('global_players').upsert(players, { onConflict: 'name,cardType,year,impactType,team' });
  return !r.error;
}

export async function deleteGlobalPlayer(id) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').delete().eq('id', id);
  return !r.error;
}

/* ── 선수 사진 (player-photos 버킷) ── */
const PHOTO_BUCKET = 'player-photos';

/* 선수 이름 ↔ 파일명 변환
   원리: 유니코드 코드포인트를 4자리 16진수로 변환
   "김도영" → "AE40B3C4C601"
   숫자/영문은 그대로 유지: "김도영1" → "AE40B3C4C6011"
   디코딩: "AE40" → String.fromCharCode(0xAE40) = "김"
*/
function encodeName(name) {
  var result = '';
  for (var i = 0; i < name.length; i++) {
    var code = name.charCodeAt(i);
    if (code < 128) {
      result += name[i]; /* ASCII는 그대로 */
    } else {
      result += code.toString(16).toUpperCase().padStart(4, '0');
    }
  }
  return result;
}

function decodeName(encoded) {
  /* "AE40B3C4C601" → "김도영", 숫자/영문은 그대로 */
  var result = '';
  var i = 0;
  while (i < encoded.length) {
    /* 4자리 16진수 패턴 확인 (한글 범위: AC00~D7A3) */
    if (i + 4 <= encoded.length) {
      var hex = encoded.slice(i, i + 4);
      var code = parseInt(hex, 16);
      if (code >= 0xAC00 && code <= 0xD7A3 || code >= 0x3131 && code <= 0x318E) {
        result += String.fromCharCode(code);
        i += 4;
        continue;
      }
    }
    result += encoded[i];
    i++;
  }
  return result;
}

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

export async function listPlayerPhotos(playerName) {
  if (!supabase || !playerName) return [];
  var { data, error } = await supabase.storage.from(PHOTO_BUCKET).list('');
  if (error || !data) return [];
  var filtered = data.filter(function(f) {
    /* 확장자 제거 후 디코딩 → 끝 숫자 제거 → 선수이름 비교 */
    var base = f.name.replace(/\.[^.]+$/, '');
    var decoded = decodeName(base);
    var baseName = decoded.replace(/\d+$/, '');
    return baseName === playerName;
  });
  filtered.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return filtered.map(function(f) {
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(f.name).data.publicUrl;
  });
}

export async function deletePlayerPhoto(fileName) {
  if (!supabase) return false;
  var { error } = await supabase.storage.from(PHOTO_BUCKET).remove([fileName]);
  return !error;
}

export async function listAllPhotos() {
  if (!supabase) return [];
  var { data, error } = await supabase.storage.from(PHOTO_BUCKET).list('');
  if (error || !data) return [];
  return data.map(function(f) {
    var base = f.name.replace(/\.[^.]+$/, '');
    /* 디코딩 먼저, 그 다음 끝 숫자 제거 */
    var decoded = decodeName(base);
    var baseName = decoded.replace(/\d+$/, '');
    return {
      storageName: f.name,          /* Supabase Storage 실제 파일명 (삭제 시 사용) */
      name: decoded + f.name.match(/\.[^.]+$/)[0], /* 표시용 원본 한글 파일명 */
      baseName: baseName,
      url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(f.name).data.publicUrl
    };
  });
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

/* ── 선수 사진 위치 전역 관리 ──
   Supabase user_settings 의 admin 계정에 photo_positions JSON으로 저장
   key: "photo_positions", value: {"이승엽": 30, "김도영": 15, ...} */
const PHOTO_POS_KEY = 'photo_positions';
const ADMIN_UID = '35f45af0-2817-4157-9e41-90b3349a21d4';

export async function loadPhotoPosMap() {
  if (!supabase) return {};
  var { data, error } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', ADMIN_UID)
    .eq('key', PHOTO_POS_KEY)
    .single();
  if (error || !data) return {};
  try { return JSON.parse(data.value) || {}; } catch(e) { return {}; }
}

export async function savePhotoPosMap(posMap) {
  if (!supabase) return false;
  var { error } = await supabase.from('user_settings').upsert({
    user_id: ADMIN_UID,
    key: PHOTO_POS_KEY,
    value: JSON.stringify(posMap),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,key' });
  return !error;
}

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
