import { supabase as getSupabase } from './supabase';

export async function listEvents() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('events').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createEvent(payload: any) {
  // ensure created_by is set when possible to satisfy common RLS policies
  if (!payload.created_by) {
    try {
      const supabase = await getSupabase();
      const userRes: any = await supabase.auth.getUser();
      payload.created_by = userRes?.data?.user?.id ?? null;
    } catch {
      // ignore — created_by will be null
    }
  }
  const supabaseClient = await getSupabase();
  const { data, error } = await supabaseClient.from('events').insert([payload]).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id: any, patch: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('events').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: any) {
  console.log('deleteEvent service called with ID:', id, 'Type:', typeof id);
  
  try {
    const supabase = await getSupabase();
    console.log('Supabase client obtained, attempting delete...');
    
    const { data, error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .select(); // Return deleted rows to confirm deletion
    
    console.log('Delete query completed. Error:', error, 'Data:', data);
    
    if (error) {
      console.error('Supabase delete error:', error);
      throw new Error(error.message || 'Database error during deletion');
    }
    
    console.log('Event successfully deleted from database');
    return { success: true, deletedEvent: data };
  } catch (err: any) {
    console.error('deleteEvent service error:', err);
    throw err;
  }
}

export async function getEventById(id: string | number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}