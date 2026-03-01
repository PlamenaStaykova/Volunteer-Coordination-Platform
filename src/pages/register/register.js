import "./register.css";
import pageHtml from "./register.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { signUp, getCurrentUser } from "../../lib/supabase.js";

function getRoleFromQuery() {
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "organizer" || role === "volunteer" ? role : null;
}

export async function renderRegisterPage(mountNode) {
  const role = getRoleFromQuery();
  const roleLabel = role ? role[0].toUpperCase() + role.slice(1) : "";
  document.title = roleLabel
    ? `${roleLabel} Register - Volunteer Coordination Platform`
    : "Register - Volunteer Coordination Platform";

  // Check if user is already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/dashboard";
    return;
  }

  mountNode.innerHTML = "";
  const activeHeaderLink = role ? `${role}-register` : undefined;
  mountNode.append(await renderHeader(activeHeaderLink));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  const mainElement = pageContainer.firstElementChild;
  mountNode.append(mainElement);

  const form = mountNode.querySelector("#registerForm");
  const registerButton = mountNode.querySelector("#registerButton");
  const authError = mountNode.querySelector("#authError");
  const emailInput = mountNode.querySelector("#registerEmail");
  const passwordInput = mountNode.querySelector("#registerPassword");
  const passwordConfirmInput = mountNode.querySelector("#registerPasswordConfirm");
  const registerTitle = mountNode.querySelector("#registerTitle");
  const registerSubtitle = mountNode.querySelector("#registerSubtitle");
  const registerLoginLink = mountNode.querySelector("#registerLoginLink");

  if (role && registerTitle && registerSubtitle && registerLoginLink) {
    registerTitle.textContent = `${roleLabel} Registration`;
    registerSubtitle.textContent = `Create your ${role} account to start using the platform.`;
    registerLoginLink.href = `/login?role=${role}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear previous errors
    authError.textContent = "";
    authError.style.color = "";
    document.getElementById("emailError").textContent = "";
    document.getElementById("passwordError").textContent = "";
    document.getElementById("passwordConfirmError").textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;

    // Validation
    let hasErrors = false;

    if (!email) {
      document.getElementById("emailError").textContent = "Email is required";
      hasErrors = true;
    }

    if (password.length < 6) {
      document.getElementById("passwordError").textContent = "Password must be at least 6 characters";
      hasErrors = true;
    }

    if (password !== passwordConfirm) {
      document.getElementById("passwordConfirmError").textContent = "Passwords do not match";
      hasErrors = true;
    }

    if (hasErrors) return;

    registerButton.disabled = true;
    registerButton.textContent = "Creating Account...";

    try {
      const { data, error } = await signUp(email, password, role);

      if (error) {
        authError.style.color = "";
        authError.textContent = error.message || "Failed to create account. Please try again.";
        registerButton.disabled = false;
        registerButton.textContent = "Create Account";
        return;
      }

      const requiresEmailConfirmation = !data?.session;

      // Success - show confirmation message and redirect
      authError.style.color = "green";
      if (requiresEmailConfirmation) {
        authError.textContent =
          "Account created successfully. Please confirm your email first, then log in.";
      } else {
        authError.textContent = "Account created successfully! Redirecting to login...";
      }

      setTimeout(() => {
        window.location.href = role ? `/login?role=${role}` : "/login";
      }, 2000);
    } catch (err) {
      authError.style.color = "";
      authError.textContent = "An unexpected error occurred. Please try again.";
      registerButton.disabled = false;
      registerButton.textContent = "Create Account";
    }
  });

  mountNode.append(renderFooter());
}
