import { supabase } from './supabase';

export async function listEvents() {
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEvent(payload: any) {
  // ensure created_by is set when possible to satisfy common RLS policies
  if (!payload.created_by) {
    try {
      const userRes: any = await supabase.auth.getUser();
      payload.created_by = userRes?.data?.user?.id ?? null;
    } catch (e) {
      // ignore — created_by will be null
    }
  }

  const { data, error } = await supabase.from('events').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id: any, patch: any) {
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: any) {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
  return true;
}