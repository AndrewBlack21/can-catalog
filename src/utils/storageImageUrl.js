import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export function storageImageUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (!isSupabaseConfigured) return null;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
