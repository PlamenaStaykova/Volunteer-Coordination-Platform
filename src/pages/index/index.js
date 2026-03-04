import "./index.css";
import pageHtml from "./index.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import {
  getCampaignCoverPublicUrl,
  getPublicCampaignCoverPaths,
  getPublicCampaignOverview,
} from "../../lib/supabase.js";

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

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesSearch(value, query) {
  if (!query) {
    return true;
  }
  return String(value || "").toLowerCase().includes(query);
}

function publicCampaignMatchesSearch(campaign, query) {
  if (!query) {
    return true;
  }

  return [
    campaign?.title,
    campaign?.description,
    campaign?.organization,
    campaign?.state,
    campaign?.volunteers_participated,
    formatDateTime(campaign?.start_at),
    formatDateTime(campaign?.end_at),
  ].some((value) => matchesSearch(value, query));
}

export async function renderIndexPage(mountNode) {
  document.title = "Volunteer Coordination Platform - Home";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("home"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  const publicCampaignSearchInput = mountNode.querySelector("#publicCampaignSearchInput");
  const publicCampaignList = mountNode.querySelector("#publicCampaignList");
  const publicCampaignEmpty = mountNode.querySelector("#publicCampaignEmpty");
  const publicCampaignError = mountNode.querySelector("#publicCampaignError");
  let publicCampaigns = [];
  let campaignCoverPathById = new Map();
  let searchQuery = "";

  const renderPublicCampaigns = () => {
    const normalizedSearch = normalizeSearchQuery(searchQuery);
    const visibleCampaigns = (publicCampaigns ?? []).filter((campaign) =>
      publicCampaignMatchesSearch(campaign, normalizedSearch)
    );

    publicCampaignList.innerHTML = "";
    publicCampaignEmpty.hidden = visibleCampaigns.length !== 0;
    publicCampaignEmpty.textContent = normalizedSearch
      ? "No campaigns match your search."
      : "No campaigns are available right now.";

    for (const campaign of visibleCampaigns) {
      const item = document.createElement("li");
      item.className = "public-campaign-item";
      const state = campaign.state === "paused" ? "paused" : campaign.state === "ended" ? "ended" : "ongoing";
      const stateLabel = state === "ended" ? "Ended" : state === "paused" ? "Paused" : "Ongoing";
      const coverImagePath = campaignCoverPathById.get(campaign.id) || "";
      const coverImageUrl = getCampaignCoverPublicUrl(coverImagePath);
      item.innerHTML = `
        <article class="public-campaign-card">
          <div class="public-campaign-avatar-wrap">
            ${
              coverImageUrl
                ? `<img src="${coverImageUrl}" alt="${campaign.title}" loading="lazy" />`
                : `<div class="public-campaign-avatar-empty">No avatar uploaded</div>`
            }
          </div>
          <header class="public-campaign-head">
            <h3><a href="/campaign/?id=${campaign.id}">${campaign.title}</a></h3>
            <span class="public-campaign-state is-${state}">
              ${stateLabel}
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
  };

  publicCampaignSearchInput?.addEventListener("input", () => {
    searchQuery = publicCampaignSearchInput.value || "";
    renderPublicCampaigns();
  });

  const { data, error } = await getPublicCampaignOverview();
  if (error) {
    publicCampaignError.hidden = false;
    publicCampaignError.textContent = error.message || "Unable to load campaign highlights right now.";
  } else {
    publicCampaignError.hidden = true;
    publicCampaigns = data ?? [];
    const campaignIds = publicCampaigns.map((campaign) => campaign.id).filter(Boolean);
    const { data: coverRows } = await getPublicCampaignCoverPaths(campaignIds);
    campaignCoverPathById = new Map((coverRows ?? []).map((row) => [row.id, row.cover_image_path || ""]));
    renderPublicCampaigns();
  }

  mountNode.append(renderFooter());
}
