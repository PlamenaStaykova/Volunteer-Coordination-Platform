import { getAuthRole, getCurrentUser } from "./supabase.js";

export function hasRole(userRole, requiredRole) {
  if (!userRole) {
    return false;
  }
  if (userRole === "admin") {
    return true;
  }
  return userRole === requiredRole;
}

export async function requireAuth(redirectTo = "/auth/") {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

export async function requireRole(requiredRole, redirectTo = "/dashboard/") {
  const user = await requireAuth("/auth/");
  if (!user) {
    return null;
  }

  const role = await getAuthRole(user);
  if (!hasRole(role, requiredRole)) {
    window.location.href = redirectTo;
    return null;
  }

  return user;
}
