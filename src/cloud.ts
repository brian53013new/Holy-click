import { createClient, type Session, type User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

function isValidSupabaseUrl(value?: string) {
  if (!value || value.includes('YOUR_PROJECT')) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

function isValidPublicAnonKey(value?: string) {
  return Boolean(value && !value.includes('YOUR_PUBLIC_ANON_KEY') && value.startsWith('eyJ'));
}

export const cloudConfigIssue = !supabaseUrl || !supabaseAnonKey
  ? 'missing'
  : !isValidSupabaseUrl(supabaseUrl)
  ? 'invalid-url'
  : !isValidPublicAnonKey(supabaseAnonKey)
  ? 'invalid-key'
  : null;

export const isCloudConfigured = cloudConfigIssue === null;

export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export type CloudUser = User;
export type CloudSession = Session;

export async function loadCloudSave(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('game_saves')
    .select('save_data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.save_data ?? null;
}

export async function saveCloudGame(userId: string, saveData: unknown) {
  if (!supabase) return;
  const { error } = await supabase.from('game_saves').upsert(
    {
      user_id: userId,
      save_data: saveData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
