import "./styles/base.css";
import { renderAuthPage } from "./pages/auth/auth.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderAuthPage(app, { defaultTab: "login" }).catch((error) => {
  console.error("Auth page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
