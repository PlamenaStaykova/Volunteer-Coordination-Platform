import "./styles/base.css";
import { renderCampaignPage } from "./pages/campaign/campaign.js";

function resolveCampaignParams() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const id = params.get("id");

  if (mode === "new") {
    return { mode: "new" };
  }

  if (id) {
    return { id: String(id).trim() };
  }

  return {};
}

const app = document.querySelector("#app");
if (!app) {
  throw new Error("#app container was not found.");
}

renderCampaignPage(app, resolveCampaignParams()).catch((error) => {
  console.error("Campaign page initialization error:", error);
  app.textContent = "Unable to load the page. Please refresh and try again.";
});
