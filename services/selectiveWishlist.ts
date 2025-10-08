import { supabase as getSupabase } from './supabase';

export interface WishlistItem {
  id: string;
  profile_id: string;
  item_type: 'event' | 'lost_found';
  item_id: string;
  item_name: string;
  item_description?: string;
  item_url?: string;
  item_image_url?: string;
  added_at: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  category?: string;
  organizer?: string;
  start_at?: string;
  location?: string;
  price?: number;
  image_url?: string;
  attendees?: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  is_resolved?: boolean;
}

export interface LostFoundItem {
  id: string;
  title: string; // Database uses 'title' not 'item_name'
  description?: string;
  kind: 'lost' | 'found'; // Database uses 'kind' not 'type'
  location?: string;
  contact?: string; // Database uses 'contact' not 'contact_info'
  image_url?: string;
  resolved?: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface MappedLostFoundItem {
  id: string;
  item_name: string;
  description?: string;
  type: 'lost' | 'found';
  location?: string;
  contact_info?: string;
  image_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  is_resolved?: boolean;
}

// Get all wishlist items for the authenticated user
export async function getUserWishlistItems(): Promise<WishlistItem[]> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await client
      .from('wishlist')
      .select('*')
      .eq('profile_id', user.id)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching wishlist items:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('getUserWishlistItems error:', error);
    throw error;
  }
}

// Add an event to the user's wishlist
export async function addEventToWishlist(eventId: string): Promise<string> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use the database function to add event to wishlist
    const { data, error } = await client
      .rpc('add_event_to_wishlist', { event_id: eventId });

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Event is already in your wishlist');
      }
      console.error('Error adding event to wishlist:', error);
      throw error;
    }

    return data; // Returns the wishlist item ID
  } catch (error) {
    console.error('addEventToWishlist error:', error);
    throw error;
  }
}

// Add a lost-and-found item to the user's wishlist
export async function addLostFoundToWishlist(lostFoundId: string): Promise<string> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use the database function to add lost-and-found item to wishlist
    const { data, error } = await client
      .rpc('add_lost_found_to_wishlist', { lost_found_id: lostFoundId });

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Item is already in your wishlist');
      }
      console.error('Error adding lost-and-found item to wishlist:', error);
      throw error;
    }

    return data; // Returns the wishlist item ID
  } catch (error) {
    console.error('addLostFoundToWishlist error:', error);
    throw error;
  }
}

// Remove an item from the wishlist
export async function removeFromWishlist(wishlistItemId: string): Promise<void> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await client
      .from('wishlist')
      .delete()
      .eq('id', wishlistItemId)
      .eq('profile_id', user.id); // Ensure user can only delete their own items

    if (error) {
      console.error('Error removing from wishlist:', error);
      throw error;
    }
  } catch (error) {
    console.error('removeFromWishlist error:', error);
    throw error;
  }
}

// Remove item by type and item_id (alternative method)
export async function removeItemFromWishlist(itemType: 'event' | 'lost_found', itemId: string): Promise<void> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await client
      .from('wishlist')
      .delete()
      .eq('profile_id', user.id)
      .eq('item_type', itemType)
      .eq('item_id', itemId);

    if (error) {
      console.error('Error removing item from wishlist:', error);
      throw error;
    }
  } catch (error) {
    console.error('removeItemFromWishlist error:', error);
    throw error;
  }
}

// Check if an event is in the user's wishlist
export async function isEventInWishlist(eventId: string): Promise<boolean> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      return false;
    }

    const { data, error } = await client
      .from('wishlist')
      .select('id')
      .eq('profile_id', user.id)
      .eq('item_type', 'event')
      .eq('item_id', eventId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking if event is in wishlist:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('isEventInWishlist error:', error);
    return false;
  }
}

// Check if a lost-and-found item is in the user's wishlist
export async function isLostFoundInWishlist(lostFoundId: string): Promise<boolean> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      return false;
    }

    const { data, error } = await client
      .from('wishlist')
      .select('id')
      .eq('profile_id', user.id)
      .eq('item_type', 'lost_found')
      .eq('item_id', lostFoundId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking if lost-and-found item is in wishlist:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('isLostFoundInWishlist error:', error);
    return false;
  }
}

// Get events with wishlist status for the current user
export async function getEventsWithWishlistStatus(): Promise<(Event & { isInWishlist: boolean })[]> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    // Get all events
    const { data: events, error: eventsError } = await client
      .from('events')
      .select('*')
      .order('start_at', { ascending: true });

    if (eventsError) {
      throw eventsError;
    }

    if (!user) {
      // If no user, return events with isInWishlist = false
      return (events || []).map(event => ({ ...event, isInWishlist: false }));
    }

    // Get user's wishlist for events
    const { data: wishlistItems, error: wishlistError } = await client
      .from('wishlist')
      .select('item_id')
      .eq('profile_id', user.id)
      .eq('item_type', 'event');

    if (wishlistError) {
      throw wishlistError;
    }

    const wishlistEventIds = new Set((wishlistItems || []).map(item => item.item_id));

    return (events || []).map(event => ({
      ...event,
      isInWishlist: wishlistEventIds.has(event.id)
    }));
  } catch (error) {
    console.error('getEventsWithWishlistStatus error:', error);
    throw error;
  }
}

// Get lost-and-found items with wishlist status for the current user
export async function getLostFoundWithWishlistStatus(): Promise<(MappedLostFoundItem & { isInWishlist: boolean })[]> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    // Get all lost-and-found items
    const { data: lostFoundItems, error: lostFoundError } = await client
      .from('lost_found')
      .select('*')
      .order('created_at', { ascending: false });

    if (lostFoundError) {
      throw lostFoundError;
    }

    if (!user) {
      // If no user, return items with isInWishlist = false and map fields
      return (lostFoundItems || []).map(item => ({
        id: item.id,
        item_name: item.title,
        description: item.description,
        type: item.kind,
        location: item.location,
        contact_info: item.contact,
        image_url: item.image_url,
        created_by: item.created_by,
        created_at: item.created_at,
        updated_at: item.created_at, // Use created_at for updated_at since DB doesn't have updated_at
        is_resolved: item.resolved,
        isInWishlist: false
      }));
    }

    // Get user's wishlist for lost-and-found items
    const { data: wishlistItems, error: wishlistError } = await client
      .from('wishlist')
      .select('item_id')
      .eq('profile_id', user.id)
      .eq('item_type', 'lost_found');

    if (wishlistError) {
      throw wishlistError;
    }

    const wishlistItemIds = new Set((wishlistItems || []).map(item => item.item_id));

    return (lostFoundItems || []).map(item => ({
      id: item.id,
      item_name: item.title,
      description: item.description,
      type: item.kind,
      location: item.location,
      contact_info: item.contact,
      image_url: item.image_url,
      created_by: item.created_by,
      created_at: item.created_at,
      updated_at: item.created_at, // Use created_at for updated_at since DB doesn't have updated_at
      is_resolved: item.resolved,
      isInWishlist: wishlistItemIds.has(item.id)
    }));
  } catch (error) {
    console.error('getLostFoundWithWishlistStatus error:', error);
    throw error;
  }
}

// Subscribe to real-time changes for the user's wishlist
export async function subscribeToWishlistChanges(
  callback: (payload: any) => void
): Promise<() => void> {
  try {
    const client = await getSupabase();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const subscription = client
      .channel('wishlist_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wishlist',
          filter: `profile_id=eq.${user.id}`
        },
        callback
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  } catch (error) {
    console.error('subscribeToWishlistChanges error:', error);
    throw error;
  }
}