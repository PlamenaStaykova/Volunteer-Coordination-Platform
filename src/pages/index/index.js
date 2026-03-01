import "./index.css";
import pageHtml from "./index.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { getPublicCampaignOverview } from "../../lib/supabase.js";

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export async function renderIndexPage(mountNode) {
  document.title = "Volunteer Coordination Platform - Home";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("home"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  const publicCampaignList = mountNode.querySelector("#publicCampaignList");
  const publicCampaignEmpty = mountNode.querySelector("#publicCampaignEmpty");
  const publicCampaignError = mountNode.querySelector("#publicCampaignError");

  const { data, error } = await getPublicCampaignOverview();
  if (error) {
    publicCampaignError.hidden = false;
    publicCampaignError.textContent = error.message || "Unable to load campaign highlights right now.";
  } else {
    publicCampaignError.hidden = true;
    publicCampaignList.innerHTML = "";
    publicCampaignEmpty.hidden = (data ?? []).length !== 0;

    for (const campaign of data ?? []) {
      const item = document.createElement("li");
      item.className = "public-campaign-item";
      const isEnded = campaign.state === "ended";
      item.innerHTML = `
        <article class="public-campaign-card">
          <header class="public-campaign-head">
            <h3><a href="/campaign/${campaign.id}">${campaign.title}</a></h3>
            <span class="public-campaign-state ${isEnded ? "is-ended" : "is-ongoing"}">
              ${isEnded ? "Ended" : "Ongoing"}
            </span>
          </header>
          <p class="public-campaign-org"><strong>Organization:</strong> ${campaign.organization}</p>
          <p class="public-campaign-period">
            <strong>Period:</strong> ${formatDateTime(campaign.start_at)} - ${formatDateTime(campaign.end_at)}
          </p>
          <p class="public-campaign-volunteers">
            <strong>Volunteers Participated:</strong> ${campaign.volunteers_participated ?? 0}
          </p>
        </article>
      `;
      publicCampaignList.append(item);
    }
  }

  mountNode.append(renderFooter());
}
