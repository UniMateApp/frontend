import { supabase as getSupabase } from './supabase';

/** Insert one or more notifications into the `notifications` table. */
export async function createNotifications(payloads: Array<any>) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('notifications').insert(payloads).select();
  if (error) throw error;
  return data;
}

/** Convenience helper to create a single notification. */
export async function createNotification(payload: any) {
  const res = await createNotifications([payload]);
  return res?.[0] ?? null;
}

/** List notifications for a specific profile id. */
export async function listNotificationsForUser(profileId: string) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/** Get notifications for the currently signed-in user. */
export async function getNotificationsForCurrentUser() {
  const supabase = await getSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  if (!userId) return [];
  return listNotificationsForUser(userId);
}

/** Mark a specific notification as read. */
export async function markNotificationRead(id: number) {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Mark all notifications for the current user as read. */
export async function markAllNotificationsReadForCurrentUser() {
  const supabase = await getSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  if (!userId) return [];
  const { data, error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', userId)
    .select();

  if (error) throw error;
  return data;
}

/** Subscribe to realtime notification changes for the current user. Returns the subscription object. */
export async function subscribeToNotifications(callback: (payload: any) => void) {
  const supabase = await getSupabase();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id ?? null;
  if (!userId) return null;

  const channel = supabase
    .channel(`notifications_user_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${userId}` }, (payload) => {
      callback(payload);
    })
    .subscribe();

  return channel;
}
