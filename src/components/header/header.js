import "./header.css";
import headerHtml from "./header.html?raw";
import { getAuthRole, getCurrentUser, getDashboardPathForRole, signOut } from "../../lib/supabase.js";

export async function renderHeader(activePage) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = headerHtml;

  const activeLink = wrapper.querySelector(`[data-nav="${activePage}"]`);
  if (activeLink) {
    activeLink.classList.add("active");
  }

  // Check authentication status
  const user = await getCurrentUser();
  const dashboardLink = wrapper.querySelector('[data-nav="dashboard"]');
  const authSection = wrapper.querySelector("#authSection");
  const noAuthSection = wrapper.querySelector("#noAuthSection");
  const userEmail = wrapper.querySelector("#userEmail");
  const logoutButton = wrapper.querySelector("#logoutButton");

  if (user && authSection && noAuthSection && userEmail && logoutButton) {
    if (dashboardLink) {
      const role = await getAuthRole(user);
      dashboardLink.href = getDashboardPathForRole(role);
    }

    // User is logged in
    authSection.classList.add("is-active");
    noAuthSection.classList.add("is-hidden");
    userEmail.textContent = user.email;

    logoutButton.addEventListener("click", async () => {
      const { error } = await signOut();
      if (!error) {
        window.location.href = "/";
      } else {
        console.error("Logout error:", error);
      }
    });
  } else if (authSection && noAuthSection) {
    // User is not logged in
    authSection.classList.remove("is-active");
    noAuthSection.classList.remove("is-hidden");
  }

  return wrapper.firstElementChild;
}
