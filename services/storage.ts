import { supabase as getSupabase } from './supabase';

export async function uploadEventImage(fileBlob: Blob | Uint8Array, filename: string) {
  const path = `events/${Date.now()}_${filename}`;
  const supabase = await getSupabase();
  const uploadRes = await supabase.storage.from('events').upload(path, fileBlob as any, { upsert: false });
  if (uploadRes.error) throw uploadRes.error;
  const { data: urlData } = supabase.storage.from('events').getPublicUrl(path);
  return urlData.publicUrl;
}