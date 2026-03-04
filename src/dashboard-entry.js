import "./styles/base.css";
import { renderDashboardPage } from "./pages/dashboard/dashboard.js";

function resolveDashboardFilterFromPath(pathname) {
  const normalizedPath = String(pathname || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");

  if (normalizedPath === "/dashboard/ongoing") {
    return "ongoing";
  }
  if (normalizedPath === "/dashboard/paused") {
    return "paused";
  }
  if (normalizedPath === "/dashboard/ended") {
    return "ended";
  }
  if (normalizedPath === "/dashboard/total") {
    return "total";
  }

  return "total";
}

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderDashboardPage(app, {
  initialFilter: resolveDashboardFilterFromPath(window.location.pathname),
}).catch((error) => {
  console.error("Dashboard page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
