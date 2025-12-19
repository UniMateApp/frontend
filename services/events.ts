// ========================================
// EVENTS SERVICE LAYER - CRUD OPERATIONS
// ========================================
// This service handles all database operations for the Events feature:
// - List all events (READ)
// - Create new events (CREATE)
// - Update existing events (UPDATE)
// - Delete events (DELETE)
// - Get single event by ID (READ)
// 
// Database Schema (events table):
// - id: uuid (primary key)
// - title: text
// - category: text
// - organizer: text
// - start_at: timestamp
// - end_at: timestamp (nullable)
// - latitude: numeric
// - longitude: numeric
// - location: text (address/name)
// - location_name: text
// - description: text
// - price: numeric (0 for free)
// - image_url: text
// - is_public: boolean
// - is_resolved: boolean (soft delete flag)
// - created_by: uuid (user who created)
// - created_at: timestamp
// ========================================

import { supabase as getSupabase } from './supabase';

// OPERATION 1: LIST ALL EVENTS
/** Fetch all active (non-resolved) events ordered by creation date */
export async function listEvents() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('events') // Query events table
    .select('*') // Select all columns
    .eq('is_resolved', false) // Only show active events (not soft-deleted)
    .order('created_at', { ascending: false }); // Newest first
  if (error) throw error;
  return data;
}

// OPERATION 2: CREATE NEW EVENT
/** Create a new event in the database with auto-populated user ID */
export async function createEvent(payload: any) {
  // AUTO-POPULATE CREATED_BY: Ensure creator's user ID is set for RLS (Row Level Security)
  if (!payload.created_by) {
    try {
      const supabase = await getSupabase();
      const userRes: any = await supabase.auth.getUser();
      payload.created_by = userRes?.data?.user?.id ?? null; // Set to current user ID
    } catch {
      // Ignore if user not authenticated - created_by will be null
    }
  }
  const supabaseClient = await getSupabase();
  const { data, error } = await supabaseClient
    .from('events')
    .insert([payload]) // Insert new event
    .select() // Return the inserted row
    .single(); // Expect single result
  if (error) throw error;
  return data; // Returns created event with database-generated fields (id, created_at)
}

// OPERATION 3: UPDATE EXISTING EVENT
/** Update event details - only fields provided in patch are modified */
export async function updateEvent(id: any, patch: any) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('events')
    .update(patch) // Update with provided fields only (partial update)
    .eq('id', id) // Match event by ID
    .select() // Return updated row
    .single(); // Expect single result
  if (error) throw error;
  return data; // Returns updated event data
}

// OPERATION 4: DELETE EVENT (HARD DELETE)
/** Permanently delete event from database - also cleans up wishlist references */
export async function deleteEvent(id: any) {
  console.log('deleteEvent service called with ID:', id, 'Type:', typeof id);
  
  try {
    const supabase = await getSupabase();
    console.log('Supabase client obtained, attempting delete...');
    
    // STEP 1: CLEANUP WISHLIST REFERENCES
    // Remove event from all users' wishlists before deleting the event
    // This prevents foreign key constraint errors
    try {
      const { error: wishlistError } = await supabase
        .from('selective_wishlist') // Wishlist table
        .delete()
        .eq('item_type', 'event') // Only event wishlist items
        .eq('item_id', String(id)); // Match this specific event
      
      // Continue with event deletion even if wishlist cleanup fails
    } catch (wishlistErr) {
      // Ignore wishlist cleanup errors - event deletion is more important
    }
    
    // STEP 2: DELETE THE EVENT
    const { data, error } = await supabase
      .from('events')
      .delete() // Permanently remove from database
      .eq('id', id) // Match event by ID
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

// OPERATION 5: GET SINGLE EVENT BY ID
/** Fetch detailed information for a specific event */
export async function getEventById(id: string | number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('events')
    .select('*') // Get all event details
    .eq('id', id) // Match by ID
    .single(); // Expect exactly one result
  if (error) throw error;
  return data; // Returns complete event data
}