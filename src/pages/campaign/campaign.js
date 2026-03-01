import "./campaign.css";
import pageHtml from "./campaign.html?raw";
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

export async function renderCampaignPage(mountNode, params = {}) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = "/login";
    return;
  }

  const campaignId = params.id || "";
  document.title = "Campaign - Volunteer Coordination Platform";

  mountNode.innerHTML = "";
  mountNode.append(await renderHeader());

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  const mainElement = pageContainer.firstElementChild;
  mountNode.append(mainElement);

  const campaignDetail = mountNode.querySelector("#campaignDetail");
  const campaignMissing = mountNode.querySelector("#campaignMissing");
  const titleEl = mountNode.querySelector("#campaignTitle");
  const orgEl = mountNode.querySelector("#campaignOrg");
  const locationEl = mountNode.querySelector("#campaignLocation");
  const datesEl = mountNode.querySelector("#campaignDates");
  const descriptionEl = mountNode.querySelector("#campaignDescription");
  const maxVolunteersEl = mountNode.querySelector("#campaignMaxVolunteers");
  const vacanciesEl = mountNode.querySelector("#campaignVacancies");

  const { data: campaigns, error } = await getCampaignDashboardData();
  const campaign = campaigns.find((item) => item.id === campaignId);

  if (error || !campaign) {
    campaignMissing.hidden = false;
    mountNode.append(renderFooter());
    return;
  }

  document.title = `${campaign.title} - Volunteer Coordination Platform`;
  titleEl.textContent = campaign.title;
  orgEl.innerHTML = `<strong>Organization:</strong> ${campaign.organization}`;
  locationEl.innerHTML = `<strong>Location:</strong> ${campaign.location}`;
  datesEl.innerHTML = `<strong>Dates:</strong> ${formatDateTime(campaign.start_at)} - ${formatDateTime(campaign.end_at)}`;
  descriptionEl.textContent = campaign.description;
  maxVolunteersEl.textContent = String(campaign.max_volunteers);
  vacanciesEl.textContent = String(campaign.vacancies);
  campaignDetail.hidden = false;

  mountNode.append(renderFooter());
}
