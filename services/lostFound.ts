import { supabase as getSupabase } from './supabase';

/** List all lost & found posts */
export async function listLostFound() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Create a new lost/found post */
export async function createLostFound(payload: any) {
  if (!payload.created_by) {
    try {
      const supabase = await getSupabase();
      const { data: userRes } = await supabase.auth.getUser();
      payload.created_by = userRes?.user?.id ?? null;
    } catch {
      // ignore if not logged in
    }
  }

  const supabaseClient = await getSupabase();
  const { data, error } = await supabaseClient
    .from('lost_found')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Mark a post as resolved */
export async function resolveLostFound(id: number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .update({ resolved: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Delete a post */
export async function deleteLostFound(id: number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .delete()
    .eq('id', id)
    .select();

  if (error) throw error;
  return { success: true, deleted: data };
}
