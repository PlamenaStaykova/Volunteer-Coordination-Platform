import "./dashboard.css";
import pageHtml from "./dashboard.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { requireAuth, requireRole } from "../../lib/guards.js";
import {
  getAdminDashboardOverview,
  adminCreateUser,
  deleteAdminUser,
  deleteCampaign,
  deleteHomeGalleryImage,
  getAdminUsers,
  getCampaignDashboardData,
  getHomeGalleryImages,
  getIsAdmin,
  getJoinedCampaignIds,
  getOrganizerCampaigns,
  getOrganizerCampaignSignupSummary,
  getUserType,
  getVolunteerParticipationCampaigns,
  joinCampaign,
  leaveCampaign,
  setCampaignStatus,
  updateAdminUser,
  uploadHomeGalleryImage,
  updateCampaignWithShift,
} from "../../lib/supabase.js";

const VOLUNTEER_SKILLS = [
  "Time Management",
  "First Aid",
  "Communication",
  "Teamwork",
  "Event Planning",
  "Child Care",
  "Elderly Care",
  "Fundraising",
  "Logistics Coordination",
  "Public Speaking",
];

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

function toDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEmptyStateMessage(filter, organizerView = false) {
  if (filter === "ongoing") {
    return "No ongoing campaigns.";
  }
  if (filter === "paused") {
    return "No paused campaigns.";
  }
  if (filter === "ended") {
    return "No ended campaigns.";
  }

  return organizerView ? "No campaigns created yet." : "No campaigns found for this filter.";
}

function getCampaignStateMeta(state) {
  if (state === "done") {
    return { label: "Done", className: "is-done" };
  }
  if (state === "paused") {
    return { label: "Paused", className: "is-paused" };
  }
  return { label: "Open", className: "is-open" };
}

function getEventStatusMeta(status) {
  if (status === "done") {
    return { label: "Done", className: "is-done" };
  }
  if (status === "paused") {
    return { label: "Paused", className: "is-paused" };
  }
  return { label: "Open", className: "is-open" };
}

function getFilterPredicate(filter, context = {}) {
  if (filter === "my-campaigns") {
    return (campaign) => context.volunteerCampaignIds?.has(campaign.id) || false;
  }
  if (filter === "ongoing") {
    return (campaign) => campaign.state === "open";
  }
  if (filter === "paused") {
    return (campaign) => campaign.state === "paused";
  }
  if (filter === "ended") {
    return (campaign) => campaign.state === "done";
  }
  return () => true;
}

function getCampaignStatusMessage(state) {
  if (state === "paused") {
    return "Campaign is paused.";
  }
  if (state === "done") {
    return "This campaign has ended.";
  }
  return "Campaign is open.";
}

function toFilterCountLabel(baseLabel, count) {
  return `${baseLabel} (${count})`;
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

function normalizeSkillList(skills = []) {
  const unique = new Set();
  for (const skill of Array.isArray(skills) ? skills : []) {
    const normalized = String(skill || "").trim();
    if (normalized) {
      unique.add(normalized);
    }
  }
  return [...unique];
}

function formatSkillsText(skills = [], fallback = "No specific skills set.") {
  const normalized = normalizeSkillList(skills);
  return normalized.length > 0 ? normalized.join(", ") : fallback;
}

function campaignMatchesSearch(campaign, query) {
  if (!query) {
    return true;
  }

  return [
    campaign?.title,
    campaign?.description,
    campaign?.location,
    campaign?.organization,
    campaign?.status,
    campaign?.state,
    formatSkillsText(campaign?.required_skills ?? campaign?.requiredSkills ?? [], ""),
  ].some((value) => matchesSearch(value, query));
}

function createAdminSkillsCell(skills = [], fallback = "No skills set.") {
  const cell = document.createElement("td");
  cell.className = "admin-skills-cell";
  cell.textContent = formatSkillsText(skills, fallback);
  return cell;
}

function createAdminCampaignLinksCell(campaigns = []) {
  const cell = document.createElement("td");
  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    cell.textContent = "-";
    return cell;
  }

  const linksWrap = document.createElement("div");
  linksWrap.className = "admin-campaign-links";
  cell.append(linksWrap);

  let expanded = false;
  const maxCollapsed = 3;
  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "btn btn-small btn-neutral admin-expand-btn";

  const renderLinks = () => {
    linksWrap.innerHTML = "";
    const visible = expanded ? campaigns : campaigns.slice(0, maxCollapsed);
    for (const campaign of visible) {
      const row = document.createElement("div");
      row.className = "admin-campaign-entry";
      const campaignTitle = String(campaign?.title || "Untitled campaign");
      if (campaign?.id) {
        const link = document.createElement("a");
        link.className = "admin-campaign-link";
        link.href = `/campaign/${campaign.id}`;
        link.textContent = campaignTitle;
        row.append(link);
      } else {
        const text = document.createElement("span");
        text.textContent = campaignTitle;
        row.append(text);
      }

      const skillsHint = document.createElement("span");
      skillsHint.className = "admin-campaign-skill-line";
      skillsHint.textContent = `Skills: ${formatSkillsText(
        campaign?.requiredSkills ?? campaign?.required_skills ?? [],
        "No specific skills required."
      )}`;
      row.append(skillsHint);

      linksWrap.append(row);
    }
  };

  renderLinks();

  if (campaigns.length > maxCollapsed) {
    const hiddenCount = campaigns.length - maxCollapsed;
    toggleButton.textContent = `+${hiddenCount} more`;
    toggleButton.addEventListener("click", () => {
      expanded = !expanded;
      toggleButton.textContent = expanded ? "Show less" : `+${hiddenCount} more`;
      renderLinks();
    });
    cell.append(toggleButton);
  }

  return cell;
}

function setInlineMessage(element, message, type = "error") {
  if (!element) {
    return;
  }

  if (!message) {
    element.hidden = true;
    element.textContent = "";
    element.classList.remove("is-error", "is-success");
    return;
  }

  element.hidden = false;
  element.textContent = message;
  element.classList.remove("is-error", "is-success");
  element.classList.add(type === "success" ? "is-success" : "is-error");
}

function toCampaignPayloadFromForm(formData) {
  const capacity = Number.parseInt(formData.capacity, 10);
  if (!formData.startAt || !formData.endAt) {
    return null;
  }

  // Date inputs are date-only. Use deterministic in-day times to avoid invalid equal datetimes.
  const startDate = new Date(`${formData.startAt}T09:00:00`);
  const endDate = new Date(`${formData.endAt}T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  return {
    title: formData.title.trim(),
    description: formData.description.trim(),
    location: formData.location.trim(),
    start_at: startDate.toISOString(),
    end_at: endDate.toISOString(),
    capacity: Number.isNaN(capacity) ? 0 : capacity,
  };
}

function renderCampaignList(campaigns, mountNode, context) {
  const campaignList = mountNode.querySelector("#campaignList");
  const campaignEmptyState = mountNode.querySelector("#campaignEmptyState");

  campaignList.innerHTML = "";
  const normalizedSearch = normalizeSearchQuery(context.searchQuery || "");

  if (campaigns.length === 0) {
    campaignEmptyState.textContent = normalizedSearch
      ? "No campaigns match your search."
      : getEmptyStateMessage(context.activeFilter);
    campaignEmptyState.hidden = false;
    return;
  }

  campaignEmptyState.hidden = true;
  const isVolunteer = context.userType === "volunteer" || context.isAdmin;

  for (const campaign of campaigns) {
    const item = document.createElement("li");
    item.className = "campaign-item";

    const statusMeta = getCampaignStateMeta(campaign.state);
    const statusMessage = getCampaignStatusMessage(campaign.state);
    item.innerHTML = `
      <article class="campaign-card">
        <header class="campaign-header">
          <h3><a class="campaign-title-link" href="/campaign/${campaign.id}">${campaign.title}</a></h3>
          <span class="campaign-status ${statusMeta.className}">${statusMeta.label}</span>
        </header>
        <p class="campaign-org"><strong>Organization:</strong> ${campaign.organization}</p>
        <p class="campaign-meta"><strong>Location:</strong> ${campaign.location}</p>
        <p class="campaign-meta"><strong>Starts:</strong> ${formatDateTime(campaign.start_at)}</p>
        <p class="campaign-meta"><strong>Ends:</strong> ${formatDateTime(campaign.end_at)}</p>
        <div class="campaign-metrics">
          <span><strong>Max Volunteers:</strong> ${campaign.max_volunteers}</span>
          <span><strong>Vacancies:</strong> ${campaign.vacancies}</span>
        </div>
        <p class="campaign-status-note">${statusMessage}</p>
      </article>
    `;

    if (isVolunteer) {
      const actions = document.createElement("div");
      actions.className = "campaign-actions";

      const hasJoined = context.joinedCampaignIds.has(campaign.id);
      if (campaign.state === "open") {
        if (hasJoined) {
          const leaveButton = document.createElement("button");
          leaveButton.type = "button";
          leaveButton.className = "btn btn-neutral btn-small";
          leaveButton.textContent = context.useApplicationLabels ? "Cancel Application" : "Leave Campaign";
          leaveButton.addEventListener("click", async () => {
            await context.onLeaveCampaign(campaign.id);
          });
          actions.append(leaveButton);
        } else {
          const joinButton = document.createElement("button");
          joinButton.type = "button";
          joinButton.className = "btn btn-small";
          joinButton.textContent =
            campaign.vacancies > 0
              ? context.useApplicationLabels
                ? "Apply"
                : "Join Campaign"
              : "Campaign Full";
          joinButton.disabled = campaign.vacancies <= 0;
          joinButton.addEventListener("click", async () => {
            await context.onJoinCampaign(campaign.id);
          });
          actions.append(joinButton);
        }
      }
      if (actions.children.length > 0) {
        item.querySelector(".campaign-card").append(actions);
      }
    }

    campaignList.append(item);
  }
}

export async function renderDashboardPage(mountNode) {
  const normalizedPath = window.location.pathname.endsWith("/")
    ? window.location.pathname.slice(0, -1)
    : window.location.pathname;
  let user = null;

  if (normalizedPath === "/dashboard/admin") {
    user = await requireRole("admin", "/dashboard");
  } else if (normalizedPath === "/dashboard/organizer") {
    user = await requireRole("organizer", "/dashboard");
  } else if (normalizedPath === "/dashboard/volunteer") {
    user = await requireRole("volunteer", "/dashboard");
  } else {
    user = await requireAuth("/auth");
  }

  if (!user) {
    return;
  }

  document.title = "Volunteer Coordination Platform - Dashboard";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("dashboard"));

  const pageContainer = document.createElement("div");
  pageContainer.innerHTML = pageHtml;
  mountNode.append(pageContainer.firstElementChild);

  const dashboardTitle = mountNode.querySelector("#dashboardTitle");
  const dashboardSearchInput = mountNode.querySelector("#dashboardSearchInput");
  const dashboardError = mountNode.querySelector("#dashboardError");
  const dashboardFiltersSection = mountNode.querySelector(".dashboard-filters");
  const campaignListSection = mountNode.querySelector(".campaign-list-section");
  const createCampaignHeroLink = mountNode.querySelector("#createCampaignHeroLink");
  const filterTabs = [...mountNode.querySelectorAll(".filter-tab")];
  const volunteerMyCampaignsTab = mountNode.querySelector("#volunteerMyCampaignsTab");
  const adminPanel = mountNode.querySelector("#adminPanel");
  const organizerToolsFilters = mountNode.querySelector("#organizerToolsFilters");

  const adminActionMessage = mountNode.querySelector("#adminActionMessage");
  const managedCampaignsTitle = mountNode.querySelector("#managedCampaignsTitle");
  const organizerCampaignList = mountNode.querySelector("#organizerCampaignList");
  const organizerCampaignEmpty = mountNode.querySelector("#organizerCampaignEmpty");
  const adminOversightCard = mountNode.querySelector("#adminOversightCard");
  const adminOversightMessage = mountNode.querySelector("#adminOversightMessage");
  const adminOversightLoading = mountNode.querySelector("#adminOversightLoading");
  const adminOrganizersBody = mountNode.querySelector("#adminOrganizersBody");
  const adminOrganizersEmpty = mountNode.querySelector("#adminOrganizersEmpty");
  const adminVolunteersBody = mountNode.querySelector("#adminVolunteersBody");
  const adminVolunteersEmpty = mountNode.querySelector("#adminVolunteersEmpty");
  const adminGalleryCard = mountNode.querySelector("#adminGalleryCard");
  const galleryUploadForm = mountNode.querySelector("#galleryUploadForm");
  const galleryTitle = mountNode.querySelector("#galleryTitle");
  const gallerySortOrder = mountNode.querySelector("#gallerySortOrder");
  const galleryImageFile = mountNode.querySelector("#galleryImageFile");
  const galleryMessage = mountNode.querySelector("#galleryMessage");
  const adminGalleryList = mountNode.querySelector("#adminGalleryList");
  const adminGalleryEmpty = mountNode.querySelector("#adminGalleryEmpty");
  const adminUsersCard = mountNode.querySelector("#adminUsersCard");
  const adminUserFilterTabs = [...mountNode.querySelectorAll("[data-user-filter]")];
  const adminCreateUserForm = mountNode.querySelector("#adminCreateUserForm");
  const newUserEmail = mountNode.querySelector("#newUserEmail");
  const newUserPassword = mountNode.querySelector("#newUserPassword");
  const newUserDisplayName = mountNode.querySelector("#newUserDisplayName");
  const newUserRole = mountNode.querySelector("#newUserRole");
  const adminUsersMessage = mountNode.querySelector("#adminUsersMessage");
  const adminUserList = mountNode.querySelector("#adminUserList");
  const adminUserEmpty = mountNode.querySelector("#adminUserEmpty");

  const [userType, isAdmin] = await Promise.all([getUserType(user), getIsAdmin(user)]);
  const canManageCampaigns = userType === "organizer" || isAdmin;
  const isVolunteer = userType === "volunteer" && !isAdmin;

  if (dashboardTitle) {
    dashboardTitle.textContent = isAdmin ? "Admin Dashboard" : "Campaign Dashboard";
  }
  adminPanel.hidden = !canManageCampaigns;
  if (dashboardFiltersSection) {
    dashboardFiltersSection.hidden = canManageCampaigns;
  }
  if (organizerToolsFilters) {
    organizerToolsFilters.hidden = !canManageCampaigns;
  }
  if (campaignListSection) {
    campaignListSection.hidden = canManageCampaigns;
  }
  if (createCampaignHeroLink) {
    createCampaignHeroLink.hidden = !canManageCampaigns;
  }
  if (volunteerMyCampaignsTab) {
    volunteerMyCampaignsTab.hidden = !isVolunteer;
  }
  if (adminGalleryCard) {
    adminGalleryCard.hidden = !isAdmin;
  }
  if (adminUsersCard) {
    adminUsersCard.hidden = !isAdmin;
  }
  if (adminOversightCard) {
    adminOversightCard.hidden = !isAdmin;
  }
  if (managedCampaignsTitle) {
    managedCampaignsTitle.textContent = isAdmin ? "All Campaigns" : "My Campaigns";
  }

  let allCampaigns = [];
  let joinedCampaignIds = new Set();
  let volunteerCampaignIds = new Set();
  let organizerCampaigns = [];
  let adminOverview = { organizers: [], volunteers: [] };
  let adminUsers = [];
  let homeGalleryImages = [];
  let activeFilter = "total";
  let adminUserFilter = "organizer";
  let searchQuery = "";
  const filterTabsByFilter = new Map();

  for (const tab of filterTabs) {
    const filterKey = tab.dataset.filter || "total";
    const baseLabel = tab.textContent.trim().replace(/\s+\(\d+\)\s*$/, "");
    tab.dataset.baseLabel = baseLabel;

    if (!filterTabsByFilter.has(filterKey)) {
      filterTabsByFilter.set(filterKey, []);
    }
    filterTabsByFilter.get(filterKey).push(tab);
  }

  const normalizeVolunteerSkills = (skills = []) => {
    const unique = new Set();
    for (const skill of Array.isArray(skills) ? skills : []) {
      const normalized = String(skill || "").trim();
      if (VOLUNTEER_SKILLS.includes(normalized)) {
        unique.add(normalized);
      }
    }
    return [...unique];
  };

  const renderAdminOversight = () => {
    if (
      !isAdmin ||
      !adminOrganizersBody ||
      !adminVolunteersBody ||
      !adminOrganizersEmpty ||
      !adminVolunteersEmpty
    ) {
      return;
    }

    adminOrganizersBody.innerHTML = "";
    adminVolunteersBody.innerHTML = "";

    const normalizedSearch = normalizeSearchQuery(searchQuery);
    const organizers = (Array.isArray(adminOverview.organizers) ? adminOverview.organizers : []).filter((organizer) => {
      if (!normalizedSearch) {
        return true;
      }

      const organizerMatches =
        matchesSearch(organizer?.name, normalizedSearch) || matchesSearch(organizer?.email, normalizedSearch);
      if (organizerMatches) {
        return true;
      }

      const campaignsCreated = Array.isArray(organizer?.campaignsCreated) ? organizer.campaignsCreated : [];
      return campaignsCreated.some((campaign) => campaignMatchesSearch(campaign, normalizedSearch));
    });
    const volunteers = (Array.isArray(adminOverview.volunteers) ? adminOverview.volunteers : []).filter((volunteer) => {
      if (!normalizedSearch) {
        return true;
      }

      const volunteerSkillsText = formatSkillsText(volunteer?.volunteerSkills ?? [], "");
      const volunteerMatches =
        matchesSearch(volunteer?.name, normalizedSearch) ||
        matchesSearch(volunteer?.email, normalizedSearch) ||
        matchesSearch(volunteerSkillsText, normalizedSearch);
      if (volunteerMatches) {
        return true;
      }

      const campaignsParticipating = Array.isArray(volunteer?.campaignsParticipating)
        ? volunteer.campaignsParticipating
        : [];
      return campaignsParticipating.some((campaign) => campaignMatchesSearch(campaign, normalizedSearch));
    });

    adminOrganizersEmpty.hidden = organizers.length !== 0;
    adminVolunteersEmpty.hidden = volunteers.length !== 0;
    adminOrganizersEmpty.textContent = normalizedSearch ? "No organizers match your search." : "No organizers found.";
    adminVolunteersEmpty.textContent = normalizedSearch ? "No volunteers match your search." : "No volunteers found.";

    for (const organizer of organizers) {
      const campaignsCreated = Array.isArray(organizer?.campaignsCreated) ? organizer.campaignsCreated : [];
      const row = document.createElement("tr");

      const personCell = document.createElement("td");
      personCell.className = "admin-person-label";
      personCell.innerHTML = `
        <strong>${organizer?.name || "Unknown Organizer"}</strong>
        <span>${organizer?.email || "-"}</span>
      `;

      const countCell = document.createElement("td");
      countCell.textContent = String(campaignsCreated.length);

      row.append(personCell, countCell, createAdminCampaignLinksCell(campaignsCreated));
      adminOrganizersBody.append(row);
    }

    for (const volunteer of volunteers) {
      const campaignsParticipating = Array.isArray(volunteer?.campaignsParticipating)
        ? volunteer.campaignsParticipating
        : [];
      const volunteerSkills = Array.isArray(volunteer?.volunteerSkills) ? volunteer.volunteerSkills : [];
      const row = document.createElement("tr");

      const personCell = document.createElement("td");
      personCell.className = "admin-person-label";
      personCell.innerHTML = `
        <strong>${volunteer?.name || "Unknown Volunteer"}</strong>
        <span>${volunteer?.email || "-"}</span>
      `;

      const countCell = document.createElement("td");
      countCell.textContent = String(campaignsParticipating.length);

      row.append(
        personCell,
        createAdminSkillsCell(volunteerSkills, "No volunteer skills listed."),
        countCell,
        createAdminCampaignLinksCell(campaignsParticipating)
      );
      adminVolunteersBody.append(row);
    }
  };

  const setFilterCounter = (filterKey, count) => {
    const tabsForFilter = filterTabsByFilter.get(filterKey) ?? [];
    for (const tab of tabsForFilter) {
      const baseLabel = tab.dataset.baseLabel || tab.textContent.trim().replace(/\s+\(\d+\)\s*$/, "");
      tab.textContent = toFilterCountLabel(baseLabel, count);
    }
  };

  const getVisibleCampaigns = () => {
    const organizerOwnedCampaignIds = new Set(organizerCampaigns.map((campaign) => campaign.id));
    return userType === "organizer" && !isAdmin
      ? allCampaigns.filter((campaign) => organizerOwnedCampaignIds.has(campaign.id))
      : allCampaigns;
  };

  const updateFilterCounters = () => {
    if (canManageCampaigns) {
      const total = organizerCampaigns.length;
      const ongoing = organizerCampaigns.filter((campaign) => campaign.status === "published").length;
      const paused = organizerCampaigns.filter((campaign) => campaign.status === "paused").length;
      const ended = organizerCampaigns.filter((campaign) => campaign.status === "done").length;

      setFilterCounter("total", total);
      setFilterCounter("ongoing", ongoing);
      setFilterCounter("paused", paused);
      setFilterCounter("ended", ended);
      return;
    }

    const visibleCampaigns = getVisibleCampaigns();
    const total = visibleCampaigns.length;
    const ongoing = visibleCampaigns.filter((campaign) => campaign.state === "open").length;
    const paused = visibleCampaigns.filter((campaign) => campaign.state === "paused").length;
    const ended = visibleCampaigns.filter((campaign) => campaign.state === "done").length;
    const myCampaigns = visibleCampaigns.filter((campaign) => volunteerCampaignIds.has(campaign.id)).length;

    setFilterCounter("total", total);
    setFilterCounter("ongoing", ongoing);
    setFilterCounter("paused", paused);
    setFilterCounter("ended", ended);
    setFilterCounter("my-campaigns", myCampaigns);
  };

  const renderHomeGalleryAdminList = () => {
    if (!adminGalleryList || !adminGalleryEmpty) {
      return;
    }

    adminGalleryList.innerHTML = "";
    adminGalleryEmpty.hidden = homeGalleryImages.length !== 0;

    for (const image of homeGalleryImages) {
      const item = document.createElement("li");
      item.className = "application-item gallery-admin-item";
      item.innerHTML = `
        <p><strong>${image.title}</strong></p>
        <p>Sort Order: ${image.sort_order}</p>
        <img src="${image.image_url}" alt="${image.title || "Home gallery"}" loading="lazy" />
      `;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-small btn-danger";
      deleteButton.textContent = "Delete Image";
      deleteButton.addEventListener("click", async () => {
        const shouldDelete = window.confirm(`Delete image "${image.title}"?`);
        if (!shouldDelete) {
          return;
        }

        const { error } = await deleteHomeGalleryImage(image.id, image.image_path);
        if (error) {
          setInlineMessage(galleryMessage, error.message || "Failed to delete image.");
          return;
        }

        setInlineMessage(galleryMessage, "Image deleted.", "success");
        await loadHomeGalleryData();
      });
      actions.append(deleteButton);
      item.append(actions);
      adminGalleryList.append(item);
    }
  };

  const renderAdminUsers = () => {
    if (!adminUserList || !adminUserEmpty) {
      return;
    }

    const normalizedSearch = normalizeSearchQuery(searchQuery);
    const searchAcrossAllRoles = Boolean(normalizedSearch);
    const visibleAdminUsers = adminUsers.filter((adminUser) => {
      if (!searchAcrossAllRoles) {
        if (adminUserFilter === "organizer" && adminUser.user_type !== "organizer") {
          return false;
        }
        if (adminUserFilter === "volunteer" && adminUser.user_type !== "volunteer") {
          return false;
        }
      }

      if (!normalizedSearch) {
        return true;
      }

      const volunteerSkillsText = formatSkillsText(adminUser.volunteer_skills || [], "");
      return [
        adminUser.email,
        adminUser.display_name,
        adminUser.first_name,
        adminUser.last_name,
        adminUser.phone,
        adminUser.user_type,
        volunteerSkillsText,
      ].some((value) => matchesSearch(value, normalizedSearch));
    });

    adminUserList.innerHTML = "";
    adminUserEmpty.hidden = visibleAdminUsers.length !== 0;
    if (normalizedSearch) {
      adminUserEmpty.textContent = "No users match your search.";
    } else {
      adminUserEmpty.textContent = adminUserFilter === "organizer" ? "No organizers found." : "No volunteers found.";
    }

    for (const adminUser of visibleAdminUsers) {
      const item = document.createElement("li");
      item.className = "user-admin-item";
      const normalizedUserSkills = normalizeVolunteerSkills(adminUser.volunteer_skills || []);
      const volunteerSkillsOptions = VOLUNTEER_SKILLS.map(
        (skill) => `
          <label class="admin-skill-option">
            <input data-field="volunteer_skills" type="checkbox" value="${skill}" ${
              normalizedUserSkills.includes(skill) ? "checked" : ""
            } />
            <span>${skill}</span>
          </label>
        `
      ).join("");

      item.innerHTML = `
        <div class="user-admin-main">
          <p><strong>${adminUser.email || "No email"}</strong></p>
          <p>User ID: ${adminUser.user_id}</p>
          <p>Created: ${formatDateTime(adminUser.created_at)}</p>
        </div>
        <div class="user-admin-edit">
          <label>
            Display Name
            <input data-field="display_name" type="text" value="${adminUser.display_name || ""}" />
          </label>
          <label>
            First Name
            <input data-field="first_name" type="text" value="${adminUser.first_name || ""}" />
          </label>
          <label>
            Last Name
            <input data-field="last_name" type="text" value="${adminUser.last_name || ""}" />
          </label>
          <label>
            Phone
            <input data-field="phone" type="text" value="${adminUser.phone || ""}" />
          </label>
          <label>
            Role
            <select data-field="user_type">
              <option value="volunteer" ${adminUser.user_type === "volunteer" ? "selected" : ""}>Volunteer</option>
              <option value="organizer" ${adminUser.user_type === "organizer" ? "selected" : ""}>Organizer</option>
            </select>
          </label>
          <label>
            Admin
            <select data-field="is_admin">
              <option value="false" ${adminUser.is_admin ? "" : "selected"}>No</option>
              <option value="true" ${adminUser.is_admin ? "selected" : ""}>Yes</option>
            </select>
          </label>
          <div data-field="volunteer_skills_editor" class="admin-skill-editor full-width" ${
            adminUser.user_type === "volunteer" ? "" : "hidden"
          }>
            <p>Volunteer Skills</p>
            <div class="admin-skill-grid">
              ${volunteerSkillsOptions}
            </div>
          </div>
        </div>
      `;

      const selectedRoleInput = item.querySelector('[data-field="user_type"]');
      const volunteerSkillsEditor = item.querySelector('[data-field="volunteer_skills_editor"]');
      const toggleVolunteerSkillsEditor = () => {
        if (!selectedRoleInput || !volunteerSkillsEditor) {
          return;
        }
        volunteerSkillsEditor.hidden = selectedRoleInput.value !== "volunteer";
      };
      selectedRoleInput?.addEventListener("change", toggleVolunteerSkillsEditor);
      toggleVolunteerSkillsEditor();

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "btn btn-small";
      saveButton.textContent = "Save User";
      saveButton.addEventListener("click", async () => {
        const displayName = item.querySelector('[data-field="display_name"]').value;
        const firstName = item.querySelector('[data-field="first_name"]').value;
        const lastName = item.querySelector('[data-field="last_name"]').value;
        const phone = item.querySelector('[data-field="phone"]').value;
        const selectedRole = item.querySelector('[data-field="user_type"]').value;
        const selectedIsAdmin = item.querySelector('[data-field="is_admin"]').value === "true";
        const volunteerSkills = normalizeVolunteerSkills(
          [...item.querySelectorAll('input[data-field="volunteer_skills"]:checked')].map((input) => input.value)
        );

        const { error } = await updateAdminUser({
          user_id: adminUser.user_id,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          phone,
          user_type: selectedRole,
          is_admin: selectedIsAdmin,
          volunteer_skills: volunteerSkills,
        });

        if (error) {
          setInlineMessage(adminUsersMessage, error.message || "Failed to update user.");
          return;
        }

        setInlineMessage(adminUsersMessage, "User updated.", "success");
        await loadAdminUsersData();
      });
      actions.append(saveButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-small btn-danger";
      deleteButton.textContent = "Delete User";
      deleteButton.disabled = adminUser.user_id === user.id;
      deleteButton.addEventListener("click", async () => {
        const shouldDelete = window.confirm(`Delete user "${adminUser.email}"?`);
        if (!shouldDelete) {
          return;
        }

        const { error } = await deleteAdminUser(adminUser.user_id);
        if (error) {
          setInlineMessage(adminUsersMessage, error.message || "Failed to delete user.");
          return;
        }

        setInlineMessage(adminUsersMessage, "User deleted.", "success");
        await loadAdminUsersData();
      });
      actions.append(deleteButton);

      item.append(actions);
      adminUserList.append(item);
    }
  };

  const loadHomeGalleryData = async () => {
    if (!isAdmin) {
      return;
    }

    const { data, error } = await getHomeGalleryImages();
    if (error) {
      setInlineMessage(galleryMessage, error.message || "Unable to load home gallery.");
      homeGalleryImages = [];
    } else {
      homeGalleryImages = data ?? [];
      setInlineMessage(galleryMessage, "");
    }

    renderHomeGalleryAdminList();
  };

  const loadAdminUsersData = async () => {
    if (!isAdmin) {
      return;
    }

    const { data, error } = await getAdminUsers();
    if (error) {
      setInlineMessage(adminUsersMessage, error.message || "Unable to load users.");
      adminUsers = [];
    } else {
      adminUsers = data ?? [];
      setInlineMessage(adminUsersMessage, "");
    }

    renderAdminUsers();
  };

  const loadAdminOverviewData = async () => {
    if (!isAdmin) {
      return;
    }

    if (adminOversightLoading) {
      adminOversightLoading.hidden = false;
    }
    setInlineMessage(adminOversightMessage, "");

    const { data, error } = await getAdminDashboardOverview();
    if (error) {
      adminOverview = { organizers: [], volunteers: [] };
      setInlineMessage(adminOversightMessage, error.message || "Unable to load admin overview.");
    } else {
      adminOverview = {
        organizers: data?.organizers ?? [],
        volunteers: data?.volunteers ?? [],
      };
      setInlineMessage(adminOversightMessage, "", "success");
    }

    if (adminOversightLoading) {
      adminOversightLoading.hidden = true;
    }
    renderAdminOversight();
  };

  const renderOrganizerCampaigns = () => {
    organizerCampaignList.innerHTML = "";
    const normalizedSearch = normalizeSearchQuery(searchQuery);
    const filteredOrganizerCampaigns = organizerCampaigns
      .filter((campaign) => {
        if (activeFilter === "ongoing") {
          return campaign.status === "published";
        }
        if (activeFilter === "paused") {
          return campaign.status === "paused";
        }
        if (activeFilter === "ended") {
          return campaign.status === "done";
        }
        return true;
      })
      .filter((campaign) => campaignMatchesSearch(campaign, normalizedSearch))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    if (!canManageCampaigns || filteredOrganizerCampaigns.length === 0) {
      organizerCampaignEmpty.textContent = normalizedSearch
        ? "No campaigns match your search."
        : getEmptyStateMessage(activeFilter, true);
      organizerCampaignEmpty.hidden = !canManageCampaigns;
      return;
    }

    organizerCampaignEmpty.hidden = true;

    for (const campaign of filteredOrganizerCampaigns) {
      const item = document.createElement("li");
      item.className = "organizer-campaign-item";
      const statusMeta = getEventStatusMeta(campaign.status);
      const requiredSkills = normalizeVolunteerSkills(campaign.required_skills || []);
      const requiredSkillsEditorOptions = VOLUNTEER_SKILLS.map(
        (skill) => `
          <label class="admin-skill-option">
            <input name="requiredSkills" type="checkbox" value="${skill}" ${
              requiredSkills.includes(skill) ? "checked" : ""
            } />
            <span>${skill}</span>
          </label>
        `
      ).join("");
      const requiredSkillsSummary =
        requiredSkills.length > 0
          ? requiredSkills.join(", ")
          : "No specific skills are required for this campaign. All volunteers can be invited.";
      const invitedCount = Number(campaign.invited_count || 0);
      const appliedCount = Number(campaign.applied_count || 0);
      const invitedSummary = invitedCount > 0 ? `Yes (${invitedCount})` : "No";
      const appliedSummary = appliedCount > 0 ? `Yes (${appliedCount})` : "No";

      item.innerHTML = `
        <div class="campaign-title-row">
          <h4>${campaign.title}</h4>
          <button type="button" class="icon-btn" data-action="toggle-edit" aria-label="Edit campaign">&#9998;</button>
        </div>
        <p><strong>Status:</strong> <span class="campaign-status ${statusMeta.className}">${statusMeta.label}</span></p>
        <p><strong>Dates:</strong> ${formatDateTime(campaign.start_at)} - ${formatDateTime(campaign.end_at)}</p>
        <p><strong>Required Skills:</strong> ${requiredSkillsSummary}</p>
        <p><strong>Volunteers Invited:</strong> ${invitedSummary}</p>
        <p><strong>Volunteer Applications:</strong> ${appliedSummary}</p>
        <form class="inline-edit-form" hidden>
          <div class="inline-edit-form-grid">
            <label class="full-width">
              Title
              <input name="title" type="text" value="${campaign.title}" required />
            </label>
            <label class="full-width">
              Description
              <textarea name="description" rows="3" required>${campaign.description}</textarea>
            </label>
            <label>
              Location
              <input name="location" type="text" value="${campaign.location}" required />
            </label>
            <label>
              Max Volunteers
              <input name="capacity" type="number" min="1" value="${campaign.capacity || 10}" required />
            </label>
            <label>
              Start
              <input name="startAt" type="date" value="${toDateInputValue(campaign.start_at)}" required />
            </label>
            <label>
              End
              <input name="endAt" type="date" value="${toDateInputValue(campaign.end_at)}" required />
            </label>
            <div class="admin-skill-editor full-width">
              <p>Required Skills</p>
              <div class="admin-skill-grid">
                ${requiredSkillsEditorOptions}
              </div>
            </div>
          </div>
          <div class="item-actions">
            <button type="submit" class="btn btn-small">Save</button>
            <button type="button" class="btn btn-small btn-neutral" data-action="cancel-edit">Cancel</button>
          </div>
        </form>
      `;

      const editToggleButton = item.querySelector('[data-action="toggle-edit"]');
      const inlineEditForm = item.querySelector(".inline-edit-form");
      const cancelEditButton = item.querySelector('[data-action="cancel-edit"]');

      editToggleButton.addEventListener("click", () => {
        inlineEditForm.hidden = !inlineEditForm.hidden;
      });

      cancelEditButton.addEventListener("click", () => {
        inlineEditForm.hidden = true;
      });

      inlineEditForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(inlineEditForm);
        const payload = toCampaignPayloadFromForm({
          title: String(formData.get("title") || ""),
          description: String(formData.get("description") || ""),
          location: String(formData.get("location") || ""),
          startAt: String(formData.get("startAt") || ""),
          endAt: String(formData.get("endAt") || ""),
          capacity: String(formData.get("capacity") || ""),
        });
        const selectedRequiredSkills = normalizeVolunteerSkills(
          [...inlineEditForm.querySelectorAll('input[name="requiredSkills"]:checked')].map((input) => input.value)
        );

        if (!payload || payload.capacity <= 0 || payload.end_at <= payload.start_at) {
          setInlineMessage(adminActionMessage, "Provide valid dates and capacity.", "error");
          return;
        }
        payload.required_skills = selectedRequiredSkills;

        const { error } = await updateCampaignWithShift(campaign.id, payload);
        if (error) {
          setInlineMessage(adminActionMessage, error.message || "Unable to update campaign.");
          return;
        }

        setInlineMessage(adminActionMessage, "Campaign updated successfully.", "success");
        inlineEditForm.hidden = true;
        await loadOrganizerData();
        await loadCampaignData();
      });

      const actions = document.createElement("div");
      actions.className = "item-actions";

      const pauseButton = document.createElement("button");
      pauseButton.type = "button";
      pauseButton.className = "btn btn-small btn-neutral";
      if (campaign.status === "paused") {
        pauseButton.textContent = "Resume";
      } else {
        pauseButton.textContent = "Pause";
      }
      pauseButton.hidden = campaign.status === "done";
      pauseButton.addEventListener("click", async () => {
        const nextStatus = campaign.status === "paused" ? "published" : "paused";
        const { error } = await setCampaignStatus(campaign.id, nextStatus);
        if (error) {
          setInlineMessage(adminActionMessage, error.message || "Failed to update campaign status.");
          return;
        }

        setInlineMessage(adminActionMessage, "Campaign status updated.", "success");
        await loadOrganizerData();
        await loadCampaignData();
      });
      actions.append(pauseButton);

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.className = "btn btn-small";
      statusButton.textContent = campaign.status === "done" ? "Reopen" : "Mark Done";
      statusButton.addEventListener("click", async () => {
        const nextStatus = campaign.status === "done" ? "published" : "done";
        const { error } = await setCampaignStatus(campaign.id, nextStatus);
        if (error) {
          setInlineMessage(adminActionMessage, error.message || "Failed to update campaign status.");
          return;
        }

        setInlineMessage(adminActionMessage, "Campaign status updated.", "success");
        await loadOrganizerData();
        await loadCampaignData();
      });
      actions.append(statusButton);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "btn btn-small btn-danger";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        const shouldDelete = window.confirm(`Delete campaign "${campaign.title}"?`);
        if (!shouldDelete) {
          return;
        }

        const { error } = await deleteCampaign(campaign.id);
        if (error) {
          setInlineMessage(adminActionMessage, error.message || "Failed to delete campaign.");
          return;
        }

        setInlineMessage(adminActionMessage, "Campaign deleted.", "success");
        await loadOrganizerData();
        await loadCampaignData();
      });
      actions.append(deleteButton);

      item.append(actions);
      organizerCampaignList.append(item);
    }
  };

  const applyFilter = () => {
    const visibleCampaigns = getVisibleCampaigns();
    const normalizedSearch = normalizeSearchQuery(searchQuery);

    const predicate = getFilterPredicate(activeFilter, { volunteerCampaignIds });
    const filteredCampaigns = visibleCampaigns
      .filter(predicate)
      .filter((campaign) => campaignMatchesSearch(campaign, normalizedSearch))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    renderCampaignList(filteredCampaigns, mountNode, {
      userType,
      isAdmin,
      activeFilter,
      searchQuery,
      useApplicationLabels: activeFilter === "ongoing" || activeFilter === "my-campaigns",
      joinedCampaignIds,
      onJoinCampaign: async (campaignId) => {
        const { error } = await joinCampaign(campaignId);
        if (error) {
          dashboardError.hidden = false;
          dashboardError.textContent = error.message || "Unable to join campaign right now.";
          return;
        }

        dashboardError.hidden = true;
        await loadVolunteerData();
        await loadCampaignData();
      },
      onLeaveCampaign: async (campaignId) => {
        const { error } = await leaveCampaign(campaignId);
        if (error) {
          dashboardError.hidden = false;
          dashboardError.textContent = error.message || "Unable to leave campaign right now.";
          return;
        }

        dashboardError.hidden = true;
        await loadVolunteerData();
        await loadCampaignData();
      },
    });
  };

  const loadCampaignData = async () => {
    const { data, error } = await getCampaignDashboardData();
    if (error) {
      dashboardError.hidden = false;
      dashboardError.textContent = error.message || "Unable to load campaigns right now.";
      allCampaigns = [];
      updateFilterCounters();
      applyFilter();
      return;
    }

    dashboardError.hidden = true;
    allCampaigns = data;
    updateFilterCounters();
    applyFilter();
  };

  const loadVolunteerData = async () => {
    if (!isVolunteer) {
      return;
    }

    const [joinedResult, participationResult] = await Promise.all([
      getJoinedCampaignIds(),
      getVolunteerParticipationCampaigns(),
    ]);

    if (joinedResult.error) {
      dashboardError.hidden = false;
      dashboardError.textContent = joinedResult.error.message || "Unable to load your joined campaigns.";
      joinedCampaignIds = new Set();
    } else {
      joinedCampaignIds = new Set(joinedResult.data);
    }

    if (participationResult.error) {
      dashboardError.hidden = false;
      dashboardError.textContent =
        participationResult.error.message || "Unable to load your campaign participation.";
      volunteerCampaignIds = new Set(joinedCampaignIds);
      updateFilterCounters();
      return;
    }

    volunteerCampaignIds = new Set((participationResult.data ?? []).map((campaign) => campaign.id));
    for (const joinedId of joinedCampaignIds) {
      volunteerCampaignIds.add(joinedId);
    }
    updateFilterCounters();
  };

  const loadOrganizerData = async () => {
    if (!canManageCampaigns) {
      return;
    }

    const [campaignsResult, dashboardResult, signupSummaryResult] = await Promise.all([
      getOrganizerCampaigns({ includeAll: isAdmin }),
      getCampaignDashboardData(),
      getOrganizerCampaignSignupSummary({ includeAll: isAdmin }),
    ]);

    if (campaignsResult.error) {
      setInlineMessage(adminActionMessage, campaignsResult.error.message || "Unable to load organizer campaigns.");
      organizerCampaigns = [];
    } else {
      const capacityById = new Map((dashboardResult.data ?? []).map((campaign) => [campaign.id, campaign.max_volunteers]));
      const signupSummaryByCampaignId = new Map(
        (signupSummaryResult.data ?? []).map((item) => [
          item.campaign_id,
          {
            invited_count: Number(item.invited_count || 0),
            applied_count: Number(item.applied_count || 0),
          },
        ])
      );
      organizerCampaigns = (campaignsResult.data ?? []).map((campaign) => ({
        ...campaign,
        capacity: capacityById.get(campaign.id) ?? 10,
        invited_count: signupSummaryByCampaignId.get(campaign.id)?.invited_count ?? 0,
        applied_count: signupSummaryByCampaignId.get(campaign.id)?.applied_count ?? 0,
      }));
      setInlineMessage(adminActionMessage, "");
    }

    updateFilterCounters();
    if (isAdmin) {
      await loadAdminOverviewData();
    }
    renderOrganizerCampaigns();
  };

  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter || "total";
      filterTabs.forEach((otherTab) => otherTab.classList.remove("is-active"));
      tab.classList.add("is-active");
      if (canManageCampaigns) {
        renderOrganizerCampaigns();
      }
      applyFilter();
    });
  });

  dashboardSearchInput?.addEventListener("input", () => {
    searchQuery = dashboardSearchInput.value || "";
    applyFilter();
    if (canManageCampaigns) {
      renderOrganizerCampaigns();
    }
    if (isAdmin) {
      renderAdminUsers();
      renderAdminOversight();
    }
  });

  adminUserFilterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      adminUserFilter = tab.dataset.userFilter === "volunteer" ? "volunteer" : "organizer";
      adminUserFilterTabs.forEach((otherTab) => otherTab.classList.remove("is-active"));
      tab.classList.add("is-active");
      renderAdminUsers();
    });
  });

  if (isAdmin) {
    galleryUploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const file = galleryImageFile.files?.[0] || null;
      if (!file) {
        setInlineMessage(galleryMessage, "Select an image file first.");
        return;
      }

      const { error } = await uploadHomeGalleryImage(file, galleryTitle.value, gallerySortOrder.value);
      if (error) {
        setInlineMessage(galleryMessage, error.message || "Unable to upload image.");
        return;
      }

      galleryUploadForm.reset();
      gallerySortOrder.value = "0";
      setInlineMessage(galleryMessage, "Image uploaded.", "success");
      await loadHomeGalleryData();
    });

    adminCreateUserForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = newUserEmail.value.trim();
      const password = newUserPassword.value;
      const role = newUserRole.value;
      const displayName = newUserDisplayName.value.trim();
      if (!email || !password || !displayName) {
        setInlineMessage(adminUsersMessage, "Email, password, and display name are required.");
        return;
      }

      const { error } = await adminCreateUser(email, password, role, displayName);
      if (error) {
        setInlineMessage(adminUsersMessage, error.message || "Unable to create user.");
        return;
      }

      adminCreateUserForm.reset();
      newUserRole.value = "volunteer";
      setInlineMessage(adminUsersMessage, "User account created.", "success");
      await loadAdminUsersData();
    });
  }

  updateFilterCounters();
  await loadVolunteerData();
  await loadOrganizerData();
  await loadHomeGalleryData();
  await loadAdminUsersData();
  await loadCampaignData();

  mountNode.append(renderFooter());
}
