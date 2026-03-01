import "./login.css";
import pageHtml from "./login.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { signIn, getCurrentUser, getUserType, signOut } from "../../lib/supabase.js";

function getRoleFromQuery() {
  const role = new URLSearchParams(window.location.search).get("role");
  return role === "organizer" || role === "volunteer" ? role : null;
}

export async function renderLoginPage(mountNode) {
  const role = getRoleFromQuery();
  const roleLabel = role ? role[0].toUpperCase() + role.slice(1) : "";
  document.title = roleLabel
    ? `${roleLabel} Log In - Volunteer Coordination Platform`
    : "Log In - Volunteer Coordination Platform";

  // Check if user is already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/dashboard";
    return;
  }

  mountNode.innerHTML = "";
  const activeHeaderLink = role ? `${role}-login` : undefined;
  mountNode.append(await renderHeader(activeHeaderLink));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  const mainElement = pageContainer.firstElementChild;
  mountNode.append(mainElement);

  const form = mountNode.querySelector("#loginForm");
  const loginButton = mountNode.querySelector("#loginButton");
  const authError = mountNode.querySelector("#authError");
  const emailInput = mountNode.querySelector("#loginEmail");
  const passwordInput = mountNode.querySelector("#loginPassword");
  const loginTitle = mountNode.querySelector("#loginTitle");
  const loginSubtitle = mountNode.querySelector("#loginSubtitle");
  const loginRegisterLink = mountNode.querySelector("#loginRegisterLink");

  if (role && loginTitle && loginSubtitle && loginRegisterLink) {
    loginTitle.textContent = `${roleLabel} Log In`;
    loginSubtitle.textContent = `Welcome back! Log in to your ${role} account.`;
    loginRegisterLink.href = `/register?role=${role}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear previous errors
    authError.textContent = "";
    authError.style.color = "";
    document.getElementById("emailError").textContent = "";
    document.getElementById("passwordError").textContent = "";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    let hasErrors = false;

    if (!email) {
      document.getElementById("emailError").textContent = "Email is required";
      hasErrors = true;
    }

    if (!password) {
      document.getElementById("passwordError").textContent = "Password is required";
      hasErrors = true;
    }

    if (hasErrors) return;

    loginButton.disabled = true;
    loginButton.textContent = "Logging In...";

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        const rawMessage = (error.message || "").toLowerCase();
        const isInvalidCredentials = rawMessage.includes("invalid login credentials");

        if (isInvalidCredentials) {
          authError.textContent =
            "Invalid email/password, or your email is not confirmed yet. Please check your inbox for a confirmation email or register again.";
        } else {
          authError.textContent =
            error.message ||
            `Failed to log in${role ? ` as ${role}` : ""}. Please check your credentials.`;
        }

        loginButton.disabled = false;
        loginButton.textContent = "Log In";
        return;
      }

      if (data.user) {
        if (role) {
          const resolvedUserType = await getUserType(data.user);
          if (resolvedUserType && resolvedUserType !== role) {
            await signOut();
            authError.textContent = `This account is ${resolvedUserType}. Please use the ${resolvedUserType} log in section.`;
            loginButton.disabled = false;
            loginButton.textContent = "Log In";
            return;
          }
        }

        // Redirect to dashboard on successful login
        window.location.href = "/dashboard";
      }
    } catch (err) {
      authError.textContent = "An unexpected error occurred. Please try again.";
      loginButton.disabled = false;
      loginButton.textContent = "Log In";
    }
  });

  mountNode.append(renderFooter());
}
