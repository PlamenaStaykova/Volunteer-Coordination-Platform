import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
const missingConfigMessage =
  "Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.";

if (!hasSupabaseConfig) {
  console.warn(missingConfigMessage);
}

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null;

// Get the currently authenticated user
export async function getCurrentUser() {
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to load current user:", error);
    return null;
  }

  return user;
}

// Get current session
export async function getCurrentSession() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("Failed to load current session:", error);
    return null;
  }

  return session;
}

// Sign up with email and password
export async function signUp(email, password, role = null) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const metadata = role ? { user_type: role } : {};
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });
  return { data, error };
}

// Sign in with email and password
export async function signIn(email, password) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

// Sign out
export async function signOut() {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { error } = await supabase.auth.signOut();
  return { error };
}

// Listen to auth state changes
export function onAuthStateChange(callback) {
  if (!supabase) {
    return {
      unsubscribe() {},
    };
  }

  const { data } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );
  return data.subscription;
}
