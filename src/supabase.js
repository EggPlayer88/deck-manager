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
  var r = await supabase.from('user_settings').select('sd_state').eq('user_id', userId);
  if (r.error || !r.data || r.data.length === 0) return null;
  return r.data[0].sd_state || null;
}

export async function saveUserData(userId, data) {
  if (!supabase || !userId) return false;
  var r = await supabase.from('user_settings').upsert({
    user_id: userId,
    sd_state: data,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id' });
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
      name: f.name,
      baseName: baseName,
      url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(f.name).data.publicUrl
    };
  });
}
