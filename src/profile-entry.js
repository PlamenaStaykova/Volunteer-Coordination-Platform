import "./styles/base.css";
import { renderProfilePage } from "./pages/profile/profile.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderProfilePage(app).catch((error) => {
  console.error("Profile page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
