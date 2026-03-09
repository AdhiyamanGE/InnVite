/**
 * auth.js — Supabase Auth operations (register, login, logout, profile).
 */

import { supabase } from './supabase.js';

export async function register(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() || email.split('@')[0] },
    },
  });
  if (error) return { error };
  return { data };
}

export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { error };
  return { data };
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return { data, error };
}

export async function fetchProfileByEmail(email) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  return { data, error };
}

export async function fetchProfilesByIds(ids) {
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name')
    .in('id', ids);
  return { data: data || [], error };
}

export async function updateDisplayName(userId, displayName) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select()
    .single();
  return { data, error };
}
