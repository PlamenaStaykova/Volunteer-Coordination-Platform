import "./dashboard.css";
import pageHtml from "./dashboard.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { getCampaignDashboardData, getCurrentUser } from "../../lib/supabase.js";

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

function getFilterPredicate(filter) {
  if (filter === "open") {
    return (campaign) => campaign.state === "open";
  }
  if (filter === "done") {
    return (campaign) => campaign.state === "done";
  }
  return () => true;
}

function renderCampaignList(campaigns, mountNode) {
  const campaignList = mountNode.querySelector("#campaignList");
  const campaignEmptyState = mountNode.querySelector("#campaignEmptyState");

  campaignList.innerHTML = "";

  if (campaigns.length === 0) {
    campaignEmptyState.hidden = false;
    return;
  }

  campaignEmptyState.hidden = true;

  for (const campaign of campaigns) {
    const item = document.createElement("li");
    item.className = "campaign-item";

    const statusLabel = campaign.state === "done" ? "Done" : "Open";
    item.innerHTML = `
      <article class="campaign-card">
        <header class="campaign-header">
          <h3><a class="campaign-title-link" href="/campaign/${campaign.id}">${campaign.title}</a></h3>
          <span class="campaign-status ${campaign.state === "done" ? "is-done" : "is-open"}">${statusLabel}</span>
        </header>
        <p class="campaign-org"><strong>Organization:</strong> ${campaign.organization}</p>
        <p class="campaign-meta"><strong>Location:</strong> ${campaign.location}</p>
        <p class="campaign-meta"><strong>Starts:</strong> ${formatDateTime(campaign.start_at)}</p>
        <p class="campaign-meta"><strong>Ends:</strong> ${formatDateTime(campaign.end_at)}</p>
        <div class="campaign-metrics">
          <span><strong>Max Volunteers:</strong> ${campaign.max_volunteers}</span>
          <span><strong>Vacancies:</strong> ${campaign.vacancies}</span>
        </div>
      </article>
    `;

    campaignList.append(item);
  }
}

export async function renderDashboardPage(mountNode) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/login";
    return;
  }

  document.title = "Volunteer Coordination Platform - Dashboard";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("dashboard"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  const mainElement = pageContainer.firstElementChild;
  mountNode.append(mainElement);

  const activeCampaignsCount = mountNode.querySelector("#activeCampaignsCount");
  const allCampaignsCount = mountNode.querySelector("#allCampaignsCount");
  const dashboardError = mountNode.querySelector("#dashboardError");
  const filterTabs = mountNode.querySelectorAll(".filter-tab");

  const { data: campaigns, error } = await getCampaignDashboardData();

  if (error) {
    dashboardError.hidden = false;
    dashboardError.textContent = error.message || "Unable to load campaigns right now.";
    activeCampaignsCount.textContent = "0";
    allCampaignsCount.textContent = "0";
    renderCampaignList([], mountNode);
    mountNode.append(renderFooter());
    return;
  }

  const activeCampaigns = campaigns.filter((campaign) => campaign.state === "open");
  activeCampaignsCount.textContent = String(activeCampaigns.length);
  allCampaignsCount.textContent = String(campaigns.length);

  let activeFilter = "total";

  const applyFilter = () => {
    const predicate = getFilterPredicate(activeFilter);
    const filteredCampaigns = campaigns.filter(predicate);
    renderCampaignList(filteredCampaigns, mountNode);
  };

  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter || "total";
      filterTabs.forEach((otherTab) => otherTab.classList.remove("is-active"));
      tab.classList.add("is-active");
      applyFilter();
    });
  });

  applyFilter();

  mountNode.append(renderFooter());
}
