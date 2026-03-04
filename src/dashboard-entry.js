import "./styles/base.css";
import { renderDashboardPage } from "./pages/dashboard/dashboard.js";

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderDashboardPage(app).catch((error) => {
  console.error("Dashboard page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
