// ========================================
// LOST AND FOUND SERVICE LAYER
// ========================================
// This service handles all database operations for the Lost & Found feature:
// - Fetching lost/found items (list and by ID)
// - Creating new posts
// - Marking items as resolved (soft delete)
// - Hard deleting items
// 
// Database Schema (lost_found table):
// - id: uuid (primary key)
// - title: text (item name)
// - description: text
// - kind: text ('lost' or 'found')
// - location: text ("latitude,longitude" format)
// - contact: text (contact info)
// - image_url: text (Supabase Storage URL)
// - resolved: boolean (soft delete flag)
// - created_by: uuid (user who posted)
// - created_at: timestamp
// - updated_at: timestamp
// ========================================

import { supabase as getSupabase } from './supabase';

// OPERATION 1: LIST ALL POSTS
/** List all lost & found posts that are not resolved */
export async function listLostFound() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found') // Query the lost_found table
    .select('*') // Select all columns
    .eq('resolved', false) // Only return unresolved items (not soft-deleted)
    .order('created_at', { ascending: false }); // Newest first

  if (error) throw error;
  return data;
}

// OPERATION 2: GET SINGLE POST BY ID
/** Get a specific lost & found item by ID with field mapping */
export async function getLostFoundItemById(id: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .select('*')
    .eq('resolved', false) // Only fetch if not resolved (not soft-deleted)
    .eq('id', id) // Match the specific item ID
    .single(); // Expect exactly one result

  if (error) throw error;
  
  // FIELD MAPPING: Convert database schema to UI interface
  // Database uses: title, kind, contact, resolved
  // UI expects: item_name, type, contact_info, is_resolved
  if (data) {
    return {
      id: data.id,
      item_name: data.title, // title -> item_name
      description: data.description,
      type: data.kind, // kind -> type
      location: data.location,
      contact_info: data.contact, // contact -> contact_info
      image_url: data.image_url,
      created_by: data.created_by,
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_resolved: data.resolved, // resolved -> is_resolved
    };
  }
  
  return data;
}

// OPERATION 3: CREATE NEW POST
/** Create a new lost/found post in the database */
export async function createLostFound(payload: any) {
  // Auto-populate created_by if not provided
  if (!payload.created_by) {
    try {
      const supabase = await getSupabase();
      const { data: userRes } = await supabase.auth.getUser();
      payload.created_by = userRes?.user?.id ?? null; // Set to current user ID
    } catch {
      // Ignore if not logged in (allow anonymous posts)
    }
  }

  const supabaseClient = await getSupabase();
  const { data, error } = await supabaseClient
    .from('lost_found')
    .insert([payload]) // Insert the new post
    .select() // Return the inserted row
    .single(); // Expect single result

  if (error) throw error;
  return data; // Returns the created post with database-generated fields
}

// OPERATION 4: SOFT DELETE (RESOLVE)
/** Mark a post as resolved - This is a soft delete */
export async function resolveLostFound(id: number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('lost_found')
    .update({ resolved: true }) // Set resolved flag to true
    .eq('id', id) // Match the specific item
    .select() // Return updated row
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
