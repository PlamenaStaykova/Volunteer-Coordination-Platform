import "./login.css";
import pageHtml from "./login.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { signIn, getCurrentUser } from "../../lib/supabase.js";

export async function renderLoginPage(mountNode) {
  document.title = "Log In - Volunteer Coordination Platform";

  // Check if user is already logged in
  const user = await getCurrentUser();
  if (user) {
    window.location.href = "/dashboard";
    return;
  }

  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("login"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  const mainElement = pageContainer.firstElementChild;
  mountNode.append(mainElement);

  const form = mountNode.querySelector("#loginForm");
  const loginButton = mountNode.querySelector("#loginButton");
  const authError = mountNode.querySelector("#authError");
  const emailInput = mountNode.querySelector("#loginEmail");
  const passwordInput = mountNode.querySelector("#loginPassword");

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
        authError.textContent = error.message || "Failed to log in. Please check your credentials.";
        loginButton.disabled = false;
        loginButton.textContent = "Log In";
        return;
      }

      if (data.user) {
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
