/**
 * ===============================================================================
 * CHAT SERVICE - REAL-TIME MESSAGING SYSTEM
 * ===============================================================================
 * 
 * PURPOSE:
 * Manages all chat-related operations including conversations, messages, and
 * real-time updates using Supabase as the backend.
 * 
 * DATABASE SCHEMA:
 * ────────────────────────────────────────────────────────────────────────────────
 * 
 * Table: conversations
 * ┌─────────────┬──────────┬─────────────────────────────────────────────┐
 * │ Column      │ Type     │ Description                                 │
 * ├─────────────┼──────────┼─────────────────────────────────────────────┤
 * │ id          │ uuid     │ Primary key (auto-generated)                │
 * │ participant1│ uuid     │ First user in conversation                  │
 * │ participant2│ uuid     │ Second user in conversation                 │
 * │ created_at  │ timestamp│ When conversation was created               │
 * └─────────────┴──────────┴─────────────────────────────────────────────┘
 * 
 * Table: messages
 * ┌─────────────────┬──────────┬───────────────────────────────────────────┐
 * │ Column          │ Type     │ Description                               │
 * ├─────────────────┼──────────┼───────────────────────────────────────────┤
 * │ id              │ uuid     │ Primary key (auto-generated)              │
 * │ conversation_id │ uuid     │ Foreign key → conversations.id            │
 * │ sender_id       │ uuid     │ User who sent the message                 │
 * │ content         │ text     │ Message text or encoded location data     │
 * │ sent_at         │ timestamp│ When message was sent (auto)              │
 * │ is_read         │ boolean  │ Has recipient read the message?           │
 * └─────────────────┴──────────┴───────────────────────────────────────────┘
 * 
 * CONVERSATION MATCHING:
 * ────────────────────────────────────────────────────────────────────────────────
 * A conversation between User A and User B can be stored in either order:
 * - (participant1: A, participant2: B) OR
 * - (participant1: B, participant2: A)
 * 
 * To find existing conversation, we use OR query:
 * (participant1=A AND participant2=B) OR (participant1=B AND participant2=A)
 * 
 * LOCATION SHARING:
 * ────────────────────────────────────────────────────────────────────────────────
 * Location messages are encoded in the content field:
 * Format: "__loc__:6.7970301,79.8999734" (latitude,longitude)
 * Prefix: LOCATION_PREFIX = "__loc__:"
 * 
 * UI detects this prefix to render a map instead of text.
 * 
 * REAL-TIME UPDATES:
 * ────────────────────────────────────────────────────────────────────────────────
 * Uses Supabase Realtime (PostgreSQL LISTEN/NOTIFY) to receive:
 * - New messages (INSERT events)
 * - Message read status updates (UPDATE events)
 * 
 * Two subscription types:
 * 1. subscribeToMessages: Listen to specific conversation
 * 2. subscribeToIncomingMessages: Listen to ALL incoming messages for user
 * 
 * UNREAD MESSAGE TRACKING:
 * ────────────────────────────────────────────────────────────────────────────────
 * Messages are marked unread by default (is_read = false)
 * When user opens a conversation:
 * - markMessagesRead() sets is_read = true for all messages sent by other user
 * - Only updates messages where sender_id ≠ currentUserId
 * 
 * Badge counts calculated by:
 * - getUnreadCounts(): Unread count per conversation
 * - getTotalUnreadCount(): Total unread across all conversations
 * 
 * MAIN FUNCTIONS:
 * ────────────────────────────────────────────────────────────────────────────────
 * - findOrCreateConversation: Get or create conversation between two users
 * - sendMessage: Send text message
 * - sendLocationMessage: Send GPS coordinates as special message
 * - fetchMessages: Load all messages for a conversation
 * - markMessagesRead: Mark messages as read when conversation is opened
 * - getUnreadCounts: Get unread count for each conversation
 * - getTotalUnreadCount: Get total unread messages
 * - getUserConversations: Get all conversations for current user
 * - getLastMessageForConversation: Get most recent message (for preview)
 * - subscribeToMessages: Real-time listener for specific conversation
 * - subscribeToIncomingMessages: Real-time listener for all incoming messages
 * ===============================================================================
 */
import { supabase as getSupabase } from './supabase';

/**
 * Conversation type definition
 * Represents a chat conversation between two users
 * 
 * Fields:
 * - id: Unique identifier (UUID from Supabase)
 * - participant1: First user's ID (UUID)
 * - participant2: Second user's ID (UUID)
 * - created_at: Timestamp when conversation was created (optional in type, auto-populated by DB)
 * 
 * Note: The order of participant1/participant2 doesn't matter.
 * A conversation between User A and B can have either user in either position.
 */
export type Conversation = {
  id: string;
  participant1: string | null;
  participant2: string | null;
  created_at?: string;
};

/**
 * Message type definition
 * Represents a single message in a conversation
 * 
 * Fields:
 * - id: Unique identifier (UUID from Supabase)
 * - conversation_id: Which conversation this message belongs to (foreign key)
 * - sender_id: Who sent the message (user UUID)
 * - content: Message text OR encoded location (if starts with LOCATION_PREFIX)
 * - sent_at: ISO timestamp when message was sent (auto-populated by DB)
 * - is_read: Whether recipient has read the message (default: false)
 * 
 * Special content formats:
 * - Regular text: "Hello, how are you?"
 * - Location: "__loc__:6.7970,79.8999" (parsed by UI to show map)
 */
export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  sent_at: string;
  is_read: boolean;
};

/**
 * Location message prefix
 * 
 * Used to encode GPS coordinates in the message content field.
 * When a message starts with this prefix, the UI knows to render a map instead of text.
 * 
 * Format: "__loc__:latitude,longitude"
 * Example: "__loc__:6.7970301,79.8999734"
 * 
 * Parsing in UI:
 * ```tsx
 * if (message.content.startsWith(LOCATION_PREFIX)) {
 *   const coords = message.content.slice(LOCATION_PREFIX.length).split(',');
 *   const lat = parseFloat(coords[0]);
 *   const lng = parseFloat(coords[1]);
 *   // Render map marker at (lat, lng)
 * }
 * ```
 */
export const LOCATION_PREFIX = '__loc__:';

/**
 * Helper function to build Supabase OR query for finding conversations
 * 
 * Since a conversation can have participants in either order:
 * - (participant1: A, participant2: B) OR
 * - (participant1: B, participant2: A)
 * 
 * This builds: "(participant1=A AND participant2=B) OR (participant1=B AND participant2=A)"
 * 
 * Supabase PostgREST syntax:
 * and(condition1,condition2),and(condition3,condition4)
 * 
 * @param a - First user ID
 * @param b - Second user ID
 * @returns OR query string for Supabase
 */
const buildParticipantOr = (a: string, b: string) =>
  `and(participant1.eq.${a},participant2.eq.${b}),and(participant1.eq.${b},participant2.eq.${a})`;

/**
 * Find existing conversation or create new one between two users
 * 
 * FLOW:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Validate both user IDs are provided
 * 2. Search for existing conversation using OR query:
 *    - (participant1=current AND participant2=other) OR
 *    - (participant1=other AND participant2=current)
 * 3. If found: Return existing conversation
 * 4. If not found: Create new conversation with current user as participant1
 * 5. Return the new conversation
 * 
 * ERROR HANDLING:
 * ─────────────────────────────────────────────────────────────────────────────
 * - PGRST116: "No rows found" - This is expected when no conversation exists
 * - Other errors: Thrown to caller (database errors, permission issues)
 * 
 * @param currentUserId - Current user's ID (UUID)
 * @param otherUserId - Other user's ID (UUID)
 * @returns Promise<Conversation> - Existing or newly created conversation
 * @throws Error if user IDs missing or database error occurs
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const conversation = await findOrCreateConversation(user.id, otherUser.id);
 * // Navigate to chat screen with conversation.id
 * ```
 */
export async function findOrCreateConversation(currentUserId: string, otherUserId: string): Promise<Conversation> {
  // Validate inputs
  if (!currentUserId || !otherUserId) {
    throw new Error('Both current user and other user are required to start a conversation');
  }
  const client = await getSupabase();

  // Try to find existing conversation (either participant order)
  const { data: existing, error: findError } = await client
    .from('conversations')
    .select('*')
    .or(buildParticipantOr(currentUserId, otherUserId))
    .maybeSingle(); // maybeSingle() returns null if no match (doesn't throw error)

  // PGRST116 = "No rows found" - this is expected, not an error
  if (findError && findError.code !== 'PGRST116') {
    throw findError;
  }

  // If conversation exists, return it
  if (existing) return existing as Conversation;

  // Create new conversation
  const { data, error } = await client
    .from('conversations')
    .insert({ participant1: currentUserId, participant2: otherUserId })
    .select()
    .single();

  if (error) throw error;
  return data as Conversation;
}

/**
 * Send a text message in a conversation
 * 
 * FLOW:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Trim whitespace from content
 * 2. Skip if message is empty (after trimming)
 * 3. Insert message into messages table
 * 4. Database automatically populates: id, sent_at, is_read (false)
 * 5. Real-time listeners (subscribeToMessages) receive the new message
 * 
 * DATABASE TRIGGERS:
 * ─────────────────────────────────────────────────────────────────────────────
 * After insert, PostgreSQL triggers notify Supabase Realtime subscribers.
 * Any client listening to this conversation will receive the message instantly.
 * 
 * @param conversationId - Conversation ID (UUID)
 * @param senderId - User sending the message (UUID)
 * @param content - Message text (will be trimmed)
 * @throws Error if database insert fails
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * await sendMessage(conversation.id, user.id, "Hello there!");
 * ```
 */
export async function sendMessage(conversationId: string, senderId: string, content: string) {
  const client = await getSupabase();
  const trimmed = content.trim();
  if (!trimmed) return; // Don't send empty messages
  const { error } = await client
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, content: trimmed });
  if (error) throw error;
}

/**
 * Send GPS location as a special message
 * 
 * ENCODING:
 * ─────────────────────────────────────────────────────────────────────────────
 * Format: "__loc__:latitude,longitude"
 * Example: "__loc__:6.7970301,79.8999734"
 * 
 * This is stored in the same content field as text messages.
 * The UI detects the LOCATION_PREFIX and renders a map instead of text.
 * 
 * @param conversationId - Conversation ID (UUID)
 * @param senderId - User sending the location (UUID)
 * @param coords - GPS coordinates { latitude, longitude }
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const location = await Location.getCurrentPositionAsync();
 * await sendLocationMessage(
 *   conversation.id,
 *   user.id,
 *   { latitude: location.coords.latitude, longitude: location.coords.longitude }
 * );
 * ```
 */
export async function sendLocationMessage(
  conversationId: string,
  senderId: string,
  coords: { latitude: number; longitude: number },
) {
  // Encode coordinates as "__loc__:lat,lng"
  const payload = `${LOCATION_PREFIX}${coords.latitude},${coords.longitude}`;
  return sendMessage(conversationId, senderId, payload);
}

/**
 * Fetch all messages for a conversation
 * 
 * QUERY:
 * ─────────────────────────────────────────────────────────────────────────────
 * SELECT * FROM messages
 * WHERE conversation_id = ?
 * ORDER BY sent_at ASC
 * 
 * ORDERING:
 * ─────────────────────────────────────────────────────────────────────────────
 * ascending: true → Oldest messages first (chronological order)
 * This allows UI to display messages top-to-bottom in chat timeline.
 * 
 * @param conversationId - Conversation ID to fetch messages for
 * @returns Promise<Message[]> - Array of messages (oldest first)
 * @throws Error if database query fails
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const messages = await fetchMessages(conversation.id);
 * // messages[0] = oldest message
 * // messages[messages.length - 1] = newest message
 * ```
 */
export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true }); // Oldest first
  if (error) throw error;
  return (data as Message[]) || [];
}

/**
 * Mark all unread messages in a conversation as read
 * 
 * QUERY:
 * ─────────────────────────────────────────────────────────────────────────────
 * UPDATE messages
 * SET is_read = true
 * WHERE conversation_id = ?
 *   AND sender_id != currentUserId  -- Only mark messages from other user
 *   AND is_read = false             -- Only update unread messages
 * 
 * WHY CHECK sender_id != currentUserId?
 * ─────────────────────────────────────────────────────────────────────────────
 * - Don't mark your own messages as "read by you"
 * - Only mark messages sent by the other person
 * - This correctly tracks which messages the recipient has seen
 * 
 * WHEN TO CALL:
 * ─────────────────────────────────────────────────────────────────────────────
 * - When user opens a conversation (useEffect in chat screen)
 * - When conversation is in focus and new message arrives
 * 
 * @param conversationId - Conversation ID
 * @param currentUserId - Current user's ID (to exclude their own messages)
 * @throws Error if database update fails
 */
export async function markMessagesRead(conversationId: string, currentUserId: string) {
  const client = await getSupabase();
  const { error } = await client
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', currentUserId) // Only messages from other user
    .eq('is_read', false); // Only unread messages
  if (error) throw error;
}

/**
 * Get unread message counts per conversation for current user
 * 
 * FLOW:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Find all conversations where user is a participant
 *    Query: WHERE participant1 = userId OR participant2 = userId
 * 
 * 2. Fetch all unread messages in those conversations
 *    Query: WHERE conversation_id IN (ids)
 *           AND is_read = false
 *           AND sender_id != currentUserId
 * 
 * 3. Group messages by conversation_id and count them (in JavaScript)
 *    Result: { "convo-123": 5, "convo-456": 2 }
 * 
 * 4. Convert to array: [{ conversation_id: "convo-123", count: 5 }, ...]
 * 
 * WHY COUNT IN JAVASCRIPT?
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase doesn't support GROUP BY with COUNT in PostgREST easily.
 * It's simpler to fetch all unread messages and count them client-side.
 * 
 * @param currentUserId - Current user's ID
 * @returns Array of { conversation_id, count } objects
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const unreadCounts = await getUnreadCounts(user.id);
 * // Display badge on each conversation:
 * // "Chat with Alice (3)" ← 3 unread messages
 * ```
 */
export async function getUnreadCounts(currentUserId: string) {
  const client = await getSupabase();
  
  // Step 1: Get all conversations for this user
  const { data: conversations, error: convoError } = await client
    .from('conversations')
    .select('id')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`);

  if (convoError) throw convoError;
  const ids = (conversations || []).map((c: any) => c.id);
  if (!ids.length) return [] as { conversation_id: string; count: number }[];

  // Step 2: Fetch all unread messages for these conversations
  const { data, error } = await client
    .from('messages')
    .select('conversation_id')
    .eq('is_read', false)
    .neq('sender_id', currentUserId) // Only messages from others
    .in('conversation_id', ids);

  if (error) throw error;
  
  // Step 3: Group by conversation_id and count (in JavaScript)
  const counts = (data || []).reduce((acc: any, msg: any) => {
    const convId = msg.conversation_id;
    acc[convId] = (acc[convId] || 0) + 1;
    return acc;
  }, {});
  
  // Step 4: Convert to array format
  return Object.entries(counts).map(([conversation_id, count]) => ({ 
    conversation_id, 
    count: count as number 
  }));
}

/**
 * Get total count of unread messages across all conversations
 * 
 * FLOW:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Find all conversations for current user
 * 2. Count all unread messages in those conversations using Supabase COUNT
 * 3. Return total number
 * 
 * QUERY:
 * ─────────────────────────────────────────────────────────────────────────────
 * SELECT COUNT(*) FROM messages
 * WHERE conversation_id IN (user's conversation IDs)
 *   AND is_read = false
 *   AND sender_id != currentUserId
 * 
 * OPTIMIZATION:
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses { count: 'exact', head: true } to get count without fetching all rows.
 * This is more efficient than fetching all messages and counting in JavaScript.
 * 
 * @param currentUserId - Current user's ID
 * @returns Total number of unread messages
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const totalUnread = await getTotalUnreadCount(user.id);
 * // Display app-wide notification badge:
 * // Tab Bar: "Chats (12)" ← 12 total unread messages
 * ```
 */
export async function getTotalUnreadCount(currentUserId: string): Promise<number> {
  const client = await getSupabase();
  
  // Get all conversations for this user
  const { data: conversations, error: convoError } = await client
    .from('conversations')
    .select('id')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`);

  if (convoError) throw convoError;
  const ids = (conversations || []).map((c: any) => c.id);
  if (!ids.length) return 0;

  // Count all unread messages (database-level COUNT query)
  const { data, error } = await client
    .from('messages')
    .select('id', { count: 'exact', head: true }) // head: true = don't return rows, just count
    .eq('is_read', false)
    .neq('sender_id', currentUserId)
    .in('conversation_id', ids);

  if (error) throw error;
  return (data as any) || 0;
}

/**
 * Get all conversations for current user
 * 
 * QUERY:
 * ─────────────────────────────────────────────────────────────────────────────
 * SELECT * FROM conversations
 * WHERE participant1 = currentUserId OR participant2 = currentUserId
 * ORDER BY created_at DESC
 * 
 * ORDERING:
 * ─────────────────────────────────────────────────────────────────────────────
 * ascending: false → Newest conversations first
 * 
 * UI typically shows most recent conversations at the top of the chat list.
 * 
 * @param currentUserId - Current user's ID
 * @returns Array of conversations (newest first)
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * const conversations = await getUserConversations(user.id);
 * // For each conversation:
 * // - Get other user's profile
 * // - Get last message for preview
 * // - Get unread count
 * ```
 */
export async function getUserConversations(currentUserId: string) {
  const client = await getSupabase();
  const { data, error } = await client
    .from('conversations')
    .select('*')
    .or(`participant1.eq.${currentUserId},participant2.eq.${currentUserId}`)
    .order('created_at', { ascending: false }); // Newest first
  
  if (error) throw error;
  return (data as Conversation[]) || [];
}

/**
 * Get the most recent message in a conversation
 * 
 * QUERY:
 * ─────────────────────────────────────────────────────────────────────────────
 * SELECT * FROM messages
 * WHERE conversation_id = ?
 * ORDER BY sent_at DESC
 * LIMIT 1
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * Used to display message preview in conversation list:
 * 
 * ┌─────────────────────────────────────────┐
 * │ Alice                              2:30 PM│
 * │ Hey, are you coming to the event?    (3)│ ← Last message + unread count
 * ├─────────────────────────────────────────┤
 * │ Bob                               Yesterday│
 * │ __loc__:6.7970,79.8999                  │ ← Location message (show "📍 Location")
 * └─────────────────────────────────────────┘
 * 
 * @param conversationId - Conversation ID
 * @returns Most recent message or null if no messages yet
 */
export async function getLastMessageForConversation(conversationId: string): Promise<Message | null> {
  const client = await getSupabase();
  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false }) // Newest first
    .limit(1) // Only get the most recent
    .maybeSingle(); // Returns null if no messages (doesn't throw error)
  
  if (error) throw error;
  return data as Message | null;
}

/**
 * Subscribe to real-time updates for a specific conversation
 * 
 * REALTIME EVENTS:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. INSERT: When a new message is sent (by either user)
 *    → Trigger: onInsert(newMessage)
 *    → UI action: Append message to chat, scroll to bottom
 * 
 * 2. UPDATE: When a message is modified (e.g., is_read: false → true)
 *    → Trigger: onUpdate(updatedMessage)
 *    → UI action: Update message read status, remove unread badge
 * 
 * HOW SUPABASE REALTIME WORKS:
 * ─────────────────────────────────────────────────────────────────────────────
 * - Uses PostgreSQL LISTEN/NOTIFY mechanism
 * - When a row is inserted/updated, PostgreSQL broadcasts an event
 * - Supabase Realtime server receives event and pushes to subscribed clients
 * - WebSocket connection maintains live updates
 * 
 * CHANNEL NAME:
 * ─────────────────────────────────────────────────────────────────────────────
 * Format: "messages:{conversationId}"
 * Example: "messages:uuid-1234-5678-90ab-cdef"
 * Each conversation gets its own channel.
 * 
 * @param conversationId - Conversation to subscribe to
 * @param onInsert - Callback when new message arrives
 * @param onUpdate - Optional callback when message is updated (e.g., marked read)
 * @returns Cleanup function to unsubscribe
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * useEffect(() => {
 *   const unsubscribe = subscribeToMessages(
 *     conversation.id,
 *     (msg) => {
 *       setMessages(prev => [...prev, msg]); // Add new message
 *       scrollToBottom();
 *     },
 *     (msg) => {
 *       setMessages(prev => prev.map(m => m.id === msg.id ? msg : m)); // Update message
 *     }
 *   );
 *   return () => { unsubscribe(); }; // Cleanup on unmount
 * }, [conversation.id]);
 * ```
 */
export function subscribeToMessages(
  conversationId: string,
  onInsert: (msg: Message) => void,
  onUpdate?: (msg: Message) => void,
) {
  const channelPromise = (async () => {
    const client = await getSupabase();
    const channel = client
      .channel(`messages:${conversationId}`) // Unique channel per conversation
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          onInsert(payload.new as Message); // payload.new = newly inserted row
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        payload => {
          onUpdate?.(payload.new as Message); // payload.new = updated row
        },
      )
      .subscribe(); // Start listening
    
    return channel;
  })();

  // Return cleanup function
  return async () => {
    const channel = await channelPromise;
    const client = await getSupabase();
    await client.removeChannel(channel); // Unsubscribe when component unmounts
  };
}

/**
 * Subscribe to ALL incoming messages for current user (across all conversations)
 * 
 * PURPOSE:
 * ─────────────────────────────────────────────────────────────────────────────
 * Used for global notification listener to:
 * - Show push notifications when user is not in a specific chat
 * - Update total unread count badge on tab bar
 * - Play notification sound for new messages
 * 
 * FILTER:
 * ─────────────────────────────────────────────────────────────────────────────
 * sender_id != currentUserId
 * → Only receive messages sent by OTHER users, not your own
 * 
 * SECURITY (Row-Level Security):
 * ─────────────────────────────────────────────────────────────────────────────
 * Supabase RLS policies ensure user can only see messages from their own
 * conversations. Even though we're listening to all inserts, user will only
 * receive notifications for messages they have permission to read.
 * 
 * CHANNEL NAME:
 * ─────────────────────────────────────────────────────────────────────────────
 * Format: "messages:incoming:{userId}"
 * Example: "messages:incoming:uuid-1234-5678-90ab-cdef"
 * 
 * @param currentUserId - Current user's ID
 * @param onInsert - Callback when ANY new message arrives (from any conversation)
 * @returns Cleanup function to unsubscribe
 * 
 * USAGE:
 * ─────────────────────────────────────────────────────────────────────────────
 * ```tsx
 * // In root App component or MessageNotificationListener
 * useEffect(() => {
 *   const unsubscribe = subscribeToIncomingMessages(user.id, (msg) => {
 *     // Show push notification
 *     Notifications.scheduleNotificationAsync({
 *       content: {
 *         title: 'New message from ' + senderName,
 *         body: msg.content.startsWith('__loc__') ? '📍 Location' : msg.content
 *       }
 *     });
 *     
 *     // Update unread count badge
 *     updateTotalUnreadCount();
 *   });
 *   return () => { unsubscribe(); };
 * }, [user.id]);
 * ```
 */
export function subscribeToIncomingMessages(
  currentUserId: string,
  onInsert: (msg: Message) => void,
) {
  const channelPromise = (async () => {
    const client = await getSupabase();
    const channel = client
      .channel(`messages:incoming:${currentUserId}`) // Global channel for this user
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=neq.${currentUserId}` },
        payload => {
          onInsert(payload.new as Message); // Any new message not sent by current user
        },
      )
      .subscribe();
    
    return channel;
  })();

  // Return cleanup function
  return async () => {
    const channel = await channelPromise;
    const client = await getSupabase();
    await client.removeChannel(channel);
  };
}
