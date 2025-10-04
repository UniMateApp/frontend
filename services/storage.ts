import { supabase } from './supabase';

export async function uploadEventImage(fileBlob, filename) {
  const path = `events/${Date.now()}_${filename}`;
  const { data, error } = await supabase.storage.from('events').upload(path, fileBlob, { upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('events').getPublicUrl(path);
  return urlData.publicUrl;
}