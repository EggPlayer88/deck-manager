import { createClient } from '@supabase/supabase-js';

var SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
var SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export var supabase = (SUPABASE_URL && SUPABASE_ANON_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

export async function signInWithGoogle() {
  if (!supabase) return { error: 'Supabase not configured' };
  var result = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  });
  return result;
}

export async function signOut() {
  if (!supabase) return {};
  return await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  var result = await supabase.auth.getSession();
  return result.data.session;
}

export async function getProfile(userId) {
  if (!supabase) return null;
  var result = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return result.data;
}

