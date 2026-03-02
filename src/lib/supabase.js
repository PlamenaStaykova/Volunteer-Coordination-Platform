import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);
const missingConfigMessage =
  "Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.";
const ALLOWED_VOLUNTEER_SKILLS = [
  "Time Management",
  "First Aid",
  "Communication",
  "Teamwork",
  "Event Planning",
  "Child Care",
  "Elderly Care",
  "Fundraising",
  "Logistics Coordination",
  "Public Speaking",
];

if (!hasSupabaseConfig) {
  console.warn(missingConfigMessage);
}

export const supabase = hasSupabaseConfig ? createClient(supabaseUrl, supabaseKey) : null;
const adminSignupClient = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;

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

export async function getPublicCampaignOverview() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.rpc("get_public_campaign_overview");
  return { data: data ?? [], error };
}

export async function getHomeGalleryImages() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.rpc("get_home_gallery_images");
  return { data: data ?? [], error };
}

export async function uploadHomeGalleryImage(file, title = "", sortOrder = 0) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: new Error("User not authenticated.") };
  }

  const fileName = String(file?.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${user.id}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage.from("home-gallery").upload(path, file, {
    upsert: false,
  });
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const { data: publicUrlData } = supabase.storage.from("home-gallery").getPublicUrl(path);
  const imageUrl = publicUrlData?.publicUrl || "";

  const { data, error } = await supabase
    .from("home_gallery_images")
    .insert({
      title: String(title || "").trim() || "Home Gallery Image",
      image_path: path,
      image_url: imageUrl,
      sort_order: Number.isFinite(Number(sortOrder)) ? Number(sortOrder) : 0,
      created_by: user.id,
    })
    .select("id, title, image_url, image_path, sort_order")
    .single();

  if (error) {
    await supabase.storage.from("home-gallery").remove([path]);
  }

  return { data, error };
}

export async function deleteHomeGalleryImage(imageId, imagePath) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { error: deleteRowError } = await supabase.from("home_gallery_images").delete().eq("id", imageId);
  if (deleteRowError) {
    return { error: deleteRowError };
  }

  if (imagePath) {
    const { error: deleteStorageError } = await supabase.storage.from("home-gallery").remove([imagePath]);
    if (deleteStorageError) {
      return { error: deleteStorageError };
    }
  }

  return { error: null };
}

export async function getCampaignDashboardItem(campaignId) {
  const { data, error } = await getCampaignDashboardData();
  if (error) {
    return { data: null, error };
  }

  const campaign = (data ?? []).find((item) => item.id === campaignId) || null;
  return { data: campaign, error: null };
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

function normalizeAuthRole(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "organizer" || normalized === "volunteer") {
    return normalized;
  }

  return null;
}

function normalizeCampaignStatus(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "published" || normalized === "paused" || normalized === "done") {
    return normalized;
  }

  return null;
}

function normalizeSkills(skills = []) {
  const unique = new Set();
  for (const skill of Array.isArray(skills) ? skills : []) {
    const normalized = String(skill || "").trim();
    if (ALLOWED_VOLUNTEER_SKILLS.includes(normalized)) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

const profileSelectColumns = [
  "id",
  "display_name",
  "user_type",
  "auth_role",
  "first_name",
  "last_name",
  "email",
  "phone",
  "organization_name",
  "campaign_manager",
  "volunteer_skills",
].join(", ");

export function getDashboardPathForRole(role) {
  const normalizedRole = normalizeAuthRole(role);
  if (normalizedRole === "admin") {
    return "/dashboard/admin";
  }
  if (normalizedRole === "organizer") {
    return "/dashboard/organizer";
  }
  return "/dashboard/volunteer";
}

export async function getAuthRole(user = null) {
  if (!supabase) {
    return null;
  }

  const currentUser = user || (await getCurrentUser());
  if (!currentUser) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("auth_role, user_type")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!profileError) {
    const profileRole = normalizeAuthRole(profile?.auth_role);
    if (profileRole) {
      return profileRole;
    }
  }

  const metadataRole = normalizeAuthRole(
    currentUser.user_metadata?.auth_role ||
      currentUser.user_metadata?.user_type ||
      currentUser.app_metadata?.auth_role ||
      currentUser.app_metadata?.user_type
  );
  if (metadataRole) {
    return metadataRole;
  }

  const isAdmin = await getIsAdmin(currentUser);
  if (isAdmin) {
    return "admin";
  }

  const userType = await getUserType(currentUser);
  return userType === "organizer" ? "organizer" : "volunteer";
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
    .select("user_type, auth_role, display_name")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!profileError && normalizeAuthRole(profile?.auth_role) === "admin") {
    const metadataUserType = normalizeUserType(currentUser.user_metadata?.user_type || currentUser.app_metadata?.user_type);
    return metadataUserType || "organizer";
  }

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

export async function getUserProfile(user = null) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const currentUser = user || (await getCurrentUser());
  if (!currentUser) {
    return { data: null, error: new Error("User not authenticated.") };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(profileSelectColumns)
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      ...data,
      email: data?.email || currentUser.email || "",
    },
    error: null,
  };
}

export async function updateUserProfile(payload, user = null) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const currentUser = user || (await getCurrentUser());
  if (!currentUser) {
    return { data: null, error: new Error("User not authenticated.") };
  }

  const resolvedUserType = normalizeUserType(payload?.user_type) || (await getUserType(currentUser)) || "volunteer";
  const firstName = String(payload?.first_name || "").trim();
  const lastName = String(payload?.last_name || "").trim();
  const phone = String(payload?.phone || "").trim();
  const email = String(payload?.email || currentUser.email || "").trim();
  const organizationName = String(payload?.organization_name || "").trim();
  const campaignManager = String(payload?.campaign_manager || "").trim();
  const volunteerSkills = Array.isArray(payload?.volunteer_skills)
    ? payload.volunteer_skills
        .map((skill) => String(skill || "").trim())
        .filter(Boolean)
    : [];

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const displayName =
    fullName ||
    campaignManager ||
    organizationName ||
    currentUser.email?.split("@")[0] ||
    "User";

  const row = {
    id: currentUser.id,
    user_type: resolvedUserType,
    display_name: displayName,
    first_name: firstName || null,
    last_name: lastName || null,
    email: email || null,
    phone: phone || null,
    organization_name: resolvedUserType === "organizer" ? organizationName || null : null,
    campaign_manager: resolvedUserType === "organizer" ? campaignManager || displayName : null,
    volunteer_skills: resolvedUserType === "volunteer" ? volunteerSkills : [],
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "id" })
    .select(profileSelectColumns)
    .single();

  return { data, error };
}

export async function getIsAdmin(user = null) {
  if (!supabase) {
    return false;
  }

  const currentUser = user || (await getCurrentUser());
  if (!currentUser) {
    return false;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("auth_role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!profileError && normalizeAuthRole(profile?.auth_role) === "admin") {
    return true;
  }

  const { count, error } = await supabase
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", currentUser.id)
    .eq("role", "admin");

  if (error) {
    return false;
  }

  return (count ?? 0) > 0;
}

export async function getAdminUsers() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.rpc("admin_list_users");
  return { data: data ?? [], error };
}

export async function getAdminDashboardOverview() {
  if (!supabase) {
    return { data: { organizers: [], volunteers: [] }, error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase.rpc("admin_get_dashboard_overview");
  if (error) {
    return { data: { organizers: [], volunteers: [] }, error };
  }

  const organizers = Array.isArray(data?.organizers) ? data.organizers : [];
  const volunteers = Array.isArray(data?.volunteers) ? data.volunteers : [];
  return { data: { organizers, volunteers }, error: null };
}

export async function updateAdminUser(userPayload) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const params = {
    p_user_id: userPayload.user_id,
    p_display_name: userPayload.display_name || null,
    p_first_name: userPayload.first_name || null,
    p_last_name: userPayload.last_name || null,
    p_phone: userPayload.phone || null,
    p_user_type: userPayload.user_type || "volunteer",
    p_is_admin: Boolean(userPayload.is_admin),
    p_volunteer_skills: Array.isArray(userPayload.volunteer_skills) ? userPayload.volunteer_skills : [],
  };

  const { error } = await supabase.rpc("admin_update_user", params);
  return { error };
}

export async function deleteAdminUser(userId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { error } = await supabase.rpc("admin_delete_user", { p_user_id: userId });
  return { error };
}

export async function adminCreateUser(email, password, role = "volunteer", displayName = "") {
  if (!adminSignupClient) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const normalizedRole = role === "organizer" ? "organizer" : role === "admin" ? "volunteer" : "volunteer";
  const metadata = {
    user_type: normalizedRole,
    display_name: displayName || email.split("@")[0],
  };

  const { data, error } = await adminSignupClient.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  });

  if (error) {
    return { data: null, error };
  }

  const createdUserId = data?.user?.id;
  if (!createdUserId) {
    return { data, error: null };
  }

  if (role === "admin" || normalizedRole === "organizer") {
    const { error: updateError } = await updateAdminUser({
      user_id: createdUserId,
      display_name: metadata.display_name,
      first_name: "",
      last_name: "",
      phone: "",
      user_type: normalizedRole,
      is_admin: role === "admin",
    });
    if (updateError) {
      return { data, error: updateError };
    }
  }

  return { data, error: null };
}

export async function getOrganizerCampaigns(options = {}) {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: [], error: new Error("User not authenticated.") };
  }

  let query = supabase
    .from("events")
    .select("id, title, description, location, start_at, end_at, status, required_skills, created_by, created_at")
    .order("created_at", { ascending: false });

  const includeAll = Boolean(options?.includeAll);
  const isAdmin = await getIsAdmin(user);
  if (!includeAll || !isAdmin) {
    query = query.eq("created_by", user.id);
  }

  const { data, error } = await query;

  return { data: data ?? [], error };
}

export async function getOrganizerCampaignSignupSummary(options = {}) {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: [], error: new Error("User not authenticated.") };
  }

  let eventsQuery = supabase.from("events").select("id");
  const includeAll = Boolean(options?.includeAll);
  const isAdmin = await getIsAdmin(user);
  if (!includeAll || !isAdmin) {
    eventsQuery = eventsQuery.eq("created_by", user.id);
  }

  const { data: events, error: eventsError } = await eventsQuery;

  if (eventsError) {
    return { data: [], error: eventsError };
  }

  const eventIds = (events ?? []).map((event) => event.id);
  if (eventIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, event_id")
    .in("event_id", eventIds);

  if (shiftsError) {
    return { data: [], error: shiftsError };
  }

  const shiftIds = (shifts ?? []).map((shift) => shift.id);
  if (shiftIds.length === 0) {
    return { data: [], error: null };
  }

  let signups = [];
  const { data: signupsWithSource, error: signupsWithSourceError } = await supabase
    .from("shift_signups")
    .select("shift_id, user_id, status, signup_source")
    .in("shift_id", shiftIds)
    .in("status", ["signed", "attended"]);

  if (signupsWithSourceError) {
    const missingSourceColumn =
      String(signupsWithSourceError.message || "").includes("signup_source") &&
      String(signupsWithSourceError.message || "").includes("does not exist");
    if (!missingSourceColumn) {
      return { data: [], error: signupsWithSourceError };
    }

    const { data: signupsFallback, error: signupsFallbackError } = await supabase
      .from("shift_signups")
      .select("shift_id, user_id, status")
      .in("shift_id", shiftIds)
      .in("status", ["signed", "attended"]);

    if (signupsFallbackError) {
      return { data: [], error: signupsFallbackError };
    }

    signups = (signupsFallback ?? []).map((signup) => ({
      ...signup,
      signup_source: "applied",
    }));
  } else {
    signups = signupsWithSource ?? [];
  }

  const eventByShiftId = new Map((shifts ?? []).map((shift) => [shift.id, shift.event_id]));
  const summaryByEventId = new Map();

  for (const signup of signups) {
    const eventId = eventByShiftId.get(signup.shift_id);
    if (!eventId) {
      continue;
    }

    if (!summaryByEventId.has(eventId)) {
      summaryByEventId.set(eventId, {
        invitedUsers: new Set(),
        appliedUsers: new Set(),
      });
    }

    const bucket = summaryByEventId.get(eventId);
    const source = signup.signup_source === "invited" ? "invited" : "applied";
    if (source === "invited") {
      bucket.invitedUsers.add(signup.user_id);
    } else {
      bucket.appliedUsers.add(signup.user_id);
    }
  }

  const summary = [...summaryByEventId.entries()].map(([eventId, bucket]) => ({
    campaign_id: eventId,
    invited_count: bucket.invitedUsers.size,
    applied_count: bucket.appliedUsers.size,
  }));

  return { data: summary, error: null };
}

export async function getCampaignById(campaignId) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, description, location, start_at, end_at, status, required_skills, created_by, created_at")
    .eq("id", campaignId)
    .maybeSingle();

  if (eventError || !event) {
    return { data: null, error: eventError || new Error("Campaign not found.") };
  }

  const { data: organizerProfile } = await supabase
    .from("profiles")
    .select("display_name, organization_name")
    .eq("id", event.created_by)
    .maybeSingle();

  const { data: dashboardItem } = await getCampaignDashboardItem(campaignId);

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, capacity")
    .eq("event_id", campaignId);

  if (shiftsError) {
    return { data: null, error: shiftsError };
  }

  const shiftIds = (shifts ?? []).map((shift) => shift.id);
  const maxVolunteers = dashboardItem?.max_volunteers ?? (shifts ?? []).reduce((sum, shift) => sum + (shift.capacity || 0), 0);

  let vacancies = dashboardItem?.vacancies;
  if (vacancies == null && shiftIds.length > 0) {
    const { count } = await supabase
      .from("shift_signups")
      .select("id", { count: "exact", head: true })
      .in("shift_id", shiftIds)
      .in("status", ["signed", "attended"]);

    const occupied = count ?? 0;
    vacancies = Math.max(maxVolunteers - occupied, 0);
  }

  return {
    data: {
      ...event,
      organization: organizerProfile?.organization_name || organizerProfile?.display_name || "Unknown Organization",
      max_volunteers: maxVolunteers,
      vacancies: vacancies ?? 0,
      state: event.status === "done" ? "done" : event.status === "paused" ? "paused" : "open",
    },
    error: null,
  };
}

async function getPrimaryShiftForCampaign(campaignId) {
  const { data, error } = await supabase
    .from("shifts")
    .select("id, event_id, title, starts_at, ends_at, capacity, created_at")
    .eq("event_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { data, error };
}

export async function createCampaignWithShift(payload) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: null, error: new Error("User not authenticated.") };
  }

  const eventInsert = {
    title: payload.title,
    description: payload.description,
    location: payload.location,
    start_at: payload.start_at,
    end_at: payload.end_at,
    required_skills: normalizeSkills(payload.required_skills),
    created_by: user.id,
    status: "published",
  };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert(eventInsert)
    .select("id")
    .single();

  if (eventError) {
    return { data: null, error: eventError };
  }

  const { error: shiftError } = await supabase.from("shifts").insert({
    event_id: event.id,
    title: "General Shift",
    starts_at: payload.start_at,
    ends_at: payload.end_at,
    capacity: payload.capacity,
  });

  if (shiftError) {
    await supabase.from("events").delete().eq("id", event.id);
    return { data: null, error: shiftError };
  }

  return { data: event, error: null };
}

export async function updateCampaignWithShift(campaignId, payload) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const eventUpdate = {
    title: payload.title,
    description: payload.description,
    location: payload.location,
    start_at: payload.start_at,
    end_at: payload.end_at,
  };
  if (Array.isArray(payload.required_skills)) {
    eventUpdate.required_skills = normalizeSkills(payload.required_skills);
  }

  const { data: updatedEvent, error: eventError } = await supabase
    .from("events")
    .update(eventUpdate)
    .eq("id", campaignId)
    .select("id")
    .single();

  if (eventError) {
    return { data: null, error: eventError };
  }

  const { data: existingShift, error: shiftLookupError } = await getPrimaryShiftForCampaign(campaignId);
  if (shiftLookupError) {
    return { data: null, error: shiftLookupError };
  }

  if (existingShift?.id) {
    const { error: shiftUpdateError } = await supabase
      .from("shifts")
      .update({
        starts_at: payload.start_at,
        ends_at: payload.end_at,
        capacity: payload.capacity,
      })
      .eq("id", existingShift.id);

    if (shiftUpdateError) {
      return { data: null, error: shiftUpdateError };
    }
  } else {
    const { error: shiftInsertError } = await supabase.from("shifts").insert({
      event_id: campaignId,
      title: "General Shift",
      starts_at: payload.start_at,
      ends_at: payload.end_at,
      capacity: payload.capacity,
    });

    if (shiftInsertError) {
      return { data: null, error: shiftInsertError };
    }
  }

  return { data: updatedEvent, error: null };
}

export async function updateCampaignRequiredSkills(campaignId, requiredSkills = []) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const normalizedSkills = normalizeSkills(requiredSkills);
  const { data, error } = await supabase
    .from("events")
    .update({ required_skills: normalizedSkills })
    .eq("id", campaignId)
    .select("id, required_skills")
    .single();

  return { data, error };
}

export async function setCampaignStatus(campaignId, status) {
  if (!supabase) {
    return { data: null, error: new Error(missingConfigMessage) };
  }

  const normalizedStatus = normalizeCampaignStatus(status);
  if (!normalizedStatus) {
    return { data: null, error: new Error("Invalid campaign status.") };
  }

  const { data, error } = await supabase
    .from("events")
    .update({ status: normalizedStatus })
    .eq("id", campaignId)
    .select("id, status")
    .single();

  return { data, error };
}

export async function deleteCampaign(campaignId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { error } = await supabase.from("events").delete().eq("id", campaignId);
  return { error };
}

export async function getCampaignApplications(campaignId) {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id")
    .eq("event_id", campaignId);

  if (shiftsError) {
    return { data: [], error: shiftsError };
  }

  const shiftIds = (shifts ?? []).map((shift) => shift.id);
  if (shiftIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: signups, error: signupsError } = await supabase
    .from("shift_signups")
    .select("id, shift_id, user_id, status, created_at")
    .in("shift_id", shiftIds)
    .in("status", ["signed", "attended"])
    .order("created_at", { ascending: false });

  if (signupsError) {
    return { data: [], error: signupsError };
  }

  const userIds = [...new Set((signups ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, display_name, user_type")
    .in("id", userIds);

  if (profilesError) {
    return { data: [], error: profilesError };
  }

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const enriched = (signups ?? []).map((signup) => {
    const volunteer = profilesById.get(signup.user_id);
    return {
      signup_id: signup.id,
      volunteer_id: signup.user_id,
      volunteer_name: volunteer?.display_name || "Unknown Volunteer",
      volunteer_type: volunteer?.user_type || "volunteer",
      status: signup.status,
    };
  });

  return { data: enriched, error: null };
}

export async function cancelCampaignApplication(signupId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { error } = await supabase
    .from("shift_signups")
    .update({ status: "cancelled" })
    .eq("id", signupId);

  return { error };
}

export async function getVolunteerDirectory() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, user_type, volunteer_skills")
    .eq("user_type", "volunteer")
    .order("display_name", { ascending: true });

  return { data: data ?? [], error };
}

export async function assignVolunteerToCampaign(campaignId, volunteerId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const { data: volunteerProfile, error: volunteerLookupError } = await supabase
    .from("profiles")
    .select("id, user_type, volunteer_skills")
    .eq("id", volunteerId)
    .maybeSingle();

  if (volunteerLookupError) {
    return { error: volunteerLookupError };
  }

  if (!volunteerProfile || normalizeUserType(volunteerProfile.user_type) !== "volunteer") {
    return { error: new Error("Only volunteer users can be invited to a campaign.") };
  }

  const { data: event, error: eventLookupError } = await supabase
    .from("events")
    .select("id, required_skills")
    .eq("id", campaignId)
    .maybeSingle();

  if (eventLookupError) {
    return { error: eventLookupError };
  }

  const requiredSkills = normalizeSkills(event?.required_skills);
  const volunteerSkills = normalizeSkills(volunteerProfile?.volunteer_skills);
  if (requiredSkills.length > 0) {
    const hasMatchingSkill = volunteerSkills.some((skill) => requiredSkills.includes(skill));
    if (!hasMatchingSkill) {
      return {
        error: new Error("Volunteer does not match campaign required skills."),
      };
    }
  }

  const { data: primaryShift, error: shiftError } = await getPrimaryShiftForCampaign(campaignId);
  if (shiftError || !primaryShift?.id) {
    return { error: shiftError || new Error("No shift found for this campaign.") };
  }

  const { data: existingSignup, error: signupLookupError } = await supabase
    .from("shift_signups")
    .select("id, signup_source")
    .eq("shift_id", primaryShift.id)
    .eq("user_id", volunteerId)
    .maybeSingle();

  if (signupLookupError) {
    return { error: signupLookupError };
  }

  if (existingSignup?.id) {
    const { error: updateError } = await supabase
      .from("shift_signups")
      .update({
        status: "signed",
        signup_source: existingSignup.signup_source || "invited",
      })
      .eq("id", existingSignup.id);
    if (!updateError) {
      return { error: null };
    }

    const missingSourceColumn =
      String(updateError.message || "").includes("signup_source") &&
      String(updateError.message || "").includes("does not exist");
    if (!missingSourceColumn) {
      return { error: updateError };
    }

    const { error: fallbackUpdateError } = await supabase
      .from("shift_signups")
      .update({ status: "signed" })
      .eq("id", existingSignup.id);
    return { error: fallbackUpdateError };
  }

  const { error: insertError } = await supabase.from("shift_signups").insert({
    shift_id: primaryShift.id,
    user_id: volunteerId,
    status: "signed",
    signup_source: "invited",
  });

  if (!insertError) {
    return { error: null };
  }

  const missingSourceColumn =
    String(insertError.message || "").includes("signup_source") &&
    String(insertError.message || "").includes("does not exist");
  if (!missingSourceColumn) {
    return { error: insertError };
  }

  const { error: fallbackInsertError } = await supabase.from("shift_signups").insert({
    shift_id: primaryShift.id,
    user_id: volunteerId,
    status: "signed",
  });
  return { error: fallbackInsertError };
}

export async function getJoinedCampaignIds() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: [], error: new Error("User not authenticated.") };
  }

  const { data: signups, error: signupsError } = await supabase
    .from("shift_signups")
    .select("shift_id")
    .eq("user_id", user.id)
    .in("status", ["signed", "attended"]);

  if (signupsError) {
    return { data: [], error: signupsError };
  }

  const shiftIds = [...new Set((signups ?? []).map((signup) => signup.shift_id))];
  if (shiftIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("event_id")
    .in("id", shiftIds);

  if (shiftsError) {
    return { data: [], error: shiftsError };
  }

  const campaignIds = [...new Set((shifts ?? []).map((shift) => shift.event_id))];
  return { data: campaignIds, error: null };
}

export async function joinCampaign(campaignId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: new Error("User not authenticated.") };
  }

  const userType = await getUserType(user);
  const isAdmin = await getIsAdmin(user);
  if (userType !== "volunteer" && !isAdmin) {
    return { error: new Error("Only volunteers can join campaigns.") };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, status")
    .eq("id", campaignId)
    .maybeSingle();

  if (eventError) {
    return { error: eventError };
  }

  if (!event) {
    return { error: new Error("Campaign not found.") };
  }

  if (event.status !== "published") {
    return { error: new Error("Only ongoing campaigns can be joined.") };
  }

  const { data: primaryShift, error: shiftError } = await getPrimaryShiftForCampaign(campaignId);
  if (shiftError || !primaryShift?.id) {
    return { error: shiftError || new Error("No available shift for this campaign.") };
  }

  const { data: existingSignup, error: signupLookupError } = await supabase
    .from("shift_signups")
    .select("id, status, signup_source")
    .eq("shift_id", primaryShift.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (signupLookupError) {
    return { error: signupLookupError };
  }

  if (existingSignup?.id) {
    const { error: updateError } = await supabase
      .from("shift_signups")
      .update({
        status: "signed",
        signup_source: existingSignup.signup_source || "applied",
      })
      .eq("id", existingSignup.id);
    if (!updateError) {
      return { error: null };
    }

    const missingSourceColumn =
      String(updateError.message || "").includes("signup_source") &&
      String(updateError.message || "").includes("does not exist");
    if (!missingSourceColumn) {
      return { error: updateError };
    }

    const { error: fallbackUpdateError } = await supabase
      .from("shift_signups")
      .update({ status: "signed" })
      .eq("id", existingSignup.id);
    return { error: fallbackUpdateError };
  }

  const { error: insertError } = await supabase.from("shift_signups").insert({
    shift_id: primaryShift.id,
    user_id: user.id,
    status: "signed",
    signup_source: "applied",
  });

  if (!insertError) {
    return { error: null };
  }

  const missingSourceColumn =
    String(insertError.message || "").includes("signup_source") &&
    String(insertError.message || "").includes("does not exist");
  if (!missingSourceColumn) {
    return { error: insertError };
  }

  const { error: fallbackInsertError } = await supabase.from("shift_signups").insert({
    shift_id: primaryShift.id,
    user_id: user.id,
    status: "signed",
  });
  return { error: fallbackInsertError };
}

export async function leaveCampaign(campaignId) {
  if (!supabase) {
    return { error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: new Error("User not authenticated.") };
  }

  const userType = await getUserType(user);
  const isAdmin = await getIsAdmin(user);
  if (userType !== "volunteer" && !isAdmin) {
    return { error: new Error("Only volunteers can leave campaigns.") };
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id")
    .eq("event_id", campaignId);

  if (shiftsError) {
    return { error: shiftsError };
  }

  const shiftIds = (shifts ?? []).map((shift) => shift.id);
  if (shiftIds.length === 0) {
    return { error: null };
  }

  const { error } = await supabase
    .from("shift_signups")
    .update({ status: "cancelled" })
    .eq("user_id", user.id)
    .in("shift_id", shiftIds);

  return { error };
}

export async function getVolunteerParticipationCampaigns() {
  if (!supabase) {
    return { data: [], error: new Error(missingConfigMessage) };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { data: [], error: new Error("User not authenticated.") };
  }

  const { data: signups, error: signupsError } = await supabase
    .from("shift_signups")
    .select("shift_id, status")
    .eq("user_id", user.id)
    .in("status", ["signed", "attended"]);

  if (signupsError) {
    return { data: [], error: signupsError };
  }

  const shiftIds = [...new Set((signups ?? []).map((signup) => signup.shift_id))];
  if (shiftIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, event_id")
    .in("id", shiftIds);

  if (shiftsError) {
    return { data: [], error: shiftsError };
  }

  const eventIds = [...new Set((shifts ?? []).map((shift) => shift.event_id))];
  if (eventIds.length === 0) {
    return { data: [], error: null };
  }

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_at, end_at, status")
    .in("id", eventIds)
    .order("start_at", { ascending: false });

  if (eventsError) {
    return { data: [], error: eventsError };
  }

  const shiftToEvent = new Map((shifts ?? []).map((shift) => [shift.id, shift.event_id]));
  const eventStatus = new Map();
  for (const signup of signups ?? []) {
    const eventId = shiftToEvent.get(signup.shift_id);
    if (!eventId) {
      continue;
    }

    const current = eventStatus.get(eventId);
    if (!current || current === "signed") {
      eventStatus.set(eventId, signup.status);
    }
  }

  const enriched = (events ?? []).map((event) => ({
    ...event,
    participation_status: eventStatus.get(event.id) || "signed",
  }));

  return { data: enriched, error: null };
}
