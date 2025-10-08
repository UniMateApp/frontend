import { supabase as getSupabase } from './supabase';

export async function upsertProfile(profile: { id: string; full_name?: string | null; avatar_url?: string | null; expo_push_token?: string | null }) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('profiles').upsert([profile]).select().single();
  if (error) throw error;
  return data;
}

export async function getProfile(id: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
