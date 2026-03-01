import "./auth.css";
import pageHtml from "./auth.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import {
  getAuthRole,
  getCurrentUser,
  getDashboardPathForRole,
  signIn,
  signUp,
} from "../../lib/supabase.js";

function clearErrorText(...elements) {
  for (const element of elements) {
    if (element) {
      element.textContent = "";
    }
  }
}

function setMessage(messageNode, text, isSuccess = false) {
  if (!messageNode) {
    return;
  }
  messageNode.textContent = text || "";
  messageNode.classList.toggle("is-success", Boolean(text) && isSuccess);
}

function getRequestedTab(defaultTab = "login") {
  const fromQuery = new URLSearchParams(window.location.search).get("tab");
  if (fromQuery === "login" || fromQuery === "register") {
    return fromQuery;
  }
  return defaultTab === "register" ? "register" : "login";
}

function getRedirectPathForRole(role) {
  return getDashboardPathForRole(role || "volunteer");
}

export async function renderAuthPage(mountNode, options = {}) {
  const defaultTab = options.defaultTab === "register" ? "register" : "login";
  document.title = "Volunteer Coordination Platform - Log In / Register";

  const existingUser = await getCurrentUser();
  if (existingUser) {
    const role = await getAuthRole(existingUser);
    window.location.href = getRedirectPathForRole(role);
    return;
  }

  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("auth"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  const loginTabButton = mountNode.querySelector("#authLoginTab");
  const registerTabButton = mountNode.querySelector("#authRegisterTab");
  const authTitle = mountNode.querySelector("#authTitle");
  const authSubtitle = mountNode.querySelector("#authSubtitle");
  const loginForm = mountNode.querySelector("#unifiedLoginForm");
  const registerForm = mountNode.querySelector("#unifiedRegisterForm");
  const messageNode = mountNode.querySelector("#authUnifiedMessage");

  const loginEmail = mountNode.querySelector("#authLoginEmail");
  const loginPassword = mountNode.querySelector("#authLoginPassword");
  const loginButton = mountNode.querySelector("#authLoginButton");
  const loginEmailError = mountNode.querySelector("#authLoginEmailError");
  const loginPasswordError = mountNode.querySelector("#authLoginPasswordError");

  const registerEmail = mountNode.querySelector("#authRegisterEmail");
  const registerPassword = mountNode.querySelector("#authRegisterPassword");
  const registerPasswordConfirm = mountNode.querySelector("#authRegisterPasswordConfirm");
  const registerButton = mountNode.querySelector("#authRegisterButton");
  const registerEmailError = mountNode.querySelector("#authRegisterEmailError");
  const registerPasswordError = mountNode.querySelector("#authRegisterPasswordError");
  const registerPasswordConfirmError = mountNode.querySelector("#authRegisterPasswordConfirmError");
  const registerRoleError = mountNode.querySelector("#authRegisterRoleError");

  let activeTab = getRequestedTab(defaultTab);
  const applyTabState = () => {
    const isLogin = activeTab === "login";
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
    loginTabButton.classList.toggle("is-active", isLogin);
    registerTabButton.classList.toggle("is-active", !isLogin);
    loginTabButton.setAttribute("aria-selected", String(isLogin));
    registerTabButton.setAttribute("aria-selected", String(!isLogin));
    authTitle.textContent = isLogin ? "Log In" : "Create Account";
    authSubtitle.textContent = isLogin
      ? "Use one account for organizer, volunteer, or admin access."
      : "Register as organizer or volunteer. Admin accounts are managed by admins.";
    setMessage(messageNode, "", false);
    clearErrorText(
      loginEmailError,
      loginPasswordError,
      registerEmailError,
      registerPasswordError,
      registerPasswordConfirmError,
      registerRoleError
    );
  };

  loginTabButton.addEventListener("click", () => {
    activeTab = "login";
    applyTabState();
  });

  registerTabButton.addEventListener("click", () => {
    activeTab = "register";
    applyTabState();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrorText(loginEmailError, loginPasswordError);
    setMessage(messageNode, "", false);

    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    let hasErrors = false;

    if (!email) {
      loginEmailError.textContent = "Email is required";
      hasErrors = true;
    }
    if (!password) {
      loginPasswordError.textContent = "Password is required";
      hasErrors = true;
    }
    if (hasErrors) {
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging In...";
    try {
      const { data, error } = await signIn(email, password);
      if (error) {
        const rawMessage = (error.message || "").toLowerCase();
        const isInvalidCredentials = rawMessage.includes("invalid login credentials");
        setMessage(
          messageNode,
          isInvalidCredentials
            ? "Invalid credentials, or your email is not confirmed yet."
            : error.message || "Failed to log in.",
          false
        );
        loginButton.disabled = false;
        loginButton.textContent = "Log In";
        return;
      }

      const role = await getAuthRole(data?.user || null);
      window.location.href = getRedirectPathForRole(role);
    } catch (_error) {
      setMessage(messageNode, "An unexpected error occurred. Please try again.", false);
      loginButton.disabled = false;
      loginButton.textContent = "Log In";
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrorText(registerEmailError, registerPasswordError, registerPasswordConfirmError, registerRoleError);
    setMessage(messageNode, "", false);

    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const passwordConfirm = registerPasswordConfirm.value;
    const selectedRole = registerForm.querySelector('input[name="registerRole"]:checked')?.value || "";
    let hasErrors = false;

    if (!email) {
      registerEmailError.textContent = "Email is required";
      hasErrors = true;
    }
    if (password.length < 6) {
      registerPasswordError.textContent = "Password must be at least 6 characters";
      hasErrors = true;
    }
    if (password !== passwordConfirm) {
      registerPasswordConfirmError.textContent = "Passwords do not match";
      hasErrors = true;
    }
    if (selectedRole !== "organizer" && selectedRole !== "volunteer") {
      registerRoleError.textContent = "Please choose Organizer or Volunteer.";
      hasErrors = true;
    }
    if (hasErrors) {
      return;
    }

    registerButton.disabled = true;
    registerButton.textContent = "Creating Account...";
    try {
      const { data, error } = await signUp(email, password, selectedRole);
      if (error) {
        setMessage(messageNode, error.message || "Failed to create account.", false);
        registerButton.disabled = false;
        registerButton.textContent = "Create Account";
        return;
      }

      if (data?.session && data?.user) {
        const role = await getAuthRole(data.user);
        window.location.href = getRedirectPathForRole(role);
        return;
      }

      setMessage(
        messageNode,
        "Account created. Confirm your email, then use Log In.",
        true
      );
      activeTab = "login";
      applyTabState();
      loginEmail.value = email;
      loginPassword.focus();
    } catch (_error) {
      setMessage(messageNode, "An unexpected error occurred. Please try again.", false);
    } finally {
      registerButton.disabled = false;
      registerButton.textContent = "Create Account";
    }
  });

  applyTabState();
  mountNode.append(renderFooter());
}
