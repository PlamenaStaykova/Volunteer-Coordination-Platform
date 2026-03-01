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

export async function getCampaignDashboardData() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.rpc("get_campaign_dashboard");
  return { data: data ?? [], error };
}

function normalizeUserType(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "organizer" || normalized === "volunteer") {
    return normalized;
  }

  return null;
}

export async function getUserType(user = null) {
  if (!supabase) {
    return null;
  }

  const currentUser = user || (await getCurrentUser());
  if (!currentUser) {
    return null;
  }

  const metadataRole = normalizeUserType(
    currentUser.user_metadata?.user_type || currentUser.app_metadata?.user_type
  );
  if (metadataRole) {
    return metadataRole;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_type, display_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  const profileRole = normalizeUserType(profile?.user_type);
  if (!profileError && profileRole) {
    return profileRole;
  }

  if (!profileError && profile?.display_name) {
    const displayName = profile.display_name.toLowerCase();
    if (displayName.includes("organizer")) {
      return "organizer";
    }
    if (displayName.includes("volunteer")) {
      return "volunteer";
    }
  }

  const { count, error: eventsError } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("created_by", currentUser.id);

  if (!eventsError && (count ?? 0) > 0) {
    return "organizer";
  }

  return "volunteer";
}
