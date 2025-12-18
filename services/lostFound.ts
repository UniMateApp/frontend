import { supabase as getSupabase } from './supabase';

/** List all lost & found posts */
export async function listLostFound() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    // Only return unresolved items by default
    .select('*')
    .eq('resolved', false)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Get a specific lost & found item by ID */
export async function getLostFoundItemById(id: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .select('*')
    // Only fetch if not resolved
    .eq('resolved', false)
    .eq('id', id)
    .single();

  if (error) throw error;
  
  // Map database fields to interface fields for consistency
  if (data) {
    return {
      id: data.id,
      item_name: data.title,
      description: data.description,
      type: data.kind,
      location: data.location,
      contact_info: data.contact,
      image_url: data.image_url,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_resolved: data.resolved,
    };
  }
  
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

/** Mark a lost & found item as resolved (alias for detail view) */
export async function resolveLostFoundItem(id: string) {
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

/** Delete a lost & found item (alias for detail view) */
export async function deleteLostFoundItem(id: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .delete()
    .eq('id', id)
    .select();

  if (error) throw error;
  return { success: true, deleted: data };
}
