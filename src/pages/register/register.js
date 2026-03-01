import "./register.css";
import pageHtml from "./register.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { signUp, getCurrentUser } from "../../lib/supabase.js";

export async function renderRegisterPage(mountNode) {
  document.title = "Register - Volunteer Coordination Platform";

  // Check if user is already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/dashboard";
    return;
  }

  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("register"));

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
      const { data, error } = await signUp(email, password);

      if (error) {
        authError.style.color = "";
        authError.textContent = error.message || "Failed to create account. Please try again.";
        registerButton.disabled = false;
        registerButton.textContent = "Create Account";
        return;
      }

      // Success - show confirmation message and redirect
      authError.style.color = "green";
      authError.textContent = "Account created successfully! Redirecting to login...";

      setTimeout(() => {
        window.location.href = "/login";
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
