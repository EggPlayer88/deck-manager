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
  });
  return !r.error;
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
export async function loadGlobalPlayers() {
  if (!supabase) return [];
  var allData = [];
  var page = 0;
  var pageSize = 1000;
  while (true) {
    var r = await supabase.from('global_players').select('*')
      .order('cardType').order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (r.error || !r.data || r.data.length === 0) break;
    allData = allData.concat(r.data);
    if (r.data.length < pageSize) break;
    page++;
  }
  return allData;
}

export async function saveGlobalPlayer(player) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').upsert(player, { onConflict: 'id' });
  return !r.error;
}

export async function saveGlobalPlayers(players) {
  if (!supabase || !players || !players.length) return false;
  var r = await supabase.from('global_players').upsert(players, { onConflict: 'name,cardType,year,impactType' });
  return !r.error;
}

export async function deleteGlobalPlayer(id) {
  if (!supabase) return false;
  var r = await supabase.from('global_players').delete().eq('id', id);
  return !r.error;
}
