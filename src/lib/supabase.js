import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

export const STORAGE_BUCKET = (import.meta.env.VITE_SUPABASE_BUCKET || "photos").trim() || "photos";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabaseClient = null;

export function getSupabase() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    });
  }

  return supabaseClient;
}

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export function subscribeToAuthChanges(callback) {
  const {
    data: { subscription }
  } = getSupabase().auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });

  return subscription;
}

export async function getCurrentUser() {
  const { data, error } = await getSupabase().auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signInWithPassword({ email, password }) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUpWithPassword({ email, password }) {
  const { data, error } = await getSupabase().auth.signUp({ email, password });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut();

  if (error) {
    throw error;
  }
}
