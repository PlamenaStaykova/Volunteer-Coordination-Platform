import "./dashboard.css";
import pageHtml from "./dashboard.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { requireAuth, requireRole } from "../../lib/guards.js";
import {
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

function toFilterCountLabel(baseLabel, count) {
  return `${baseLabel} (${count})`;
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

  if (campaigns.length === 0) {
    campaignEmptyState.textContent = getEmptyStateMessage(context.activeFilter);
    campaignEmptyState.hidden = false;
    return;
  }

  campaignEmptyState.hidden = true;
  const isVolunteer = context.userType === "volunteer" || context.isAdmin;

  for (const campaign of campaigns) {
    const item = document.createElement("li");
    item.className = "campaign-item";

    const statusMeta = getCampaignStateMeta(campaign.state);
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
      } else if (hasJoined) {
        const note = document.createElement("span");
        note.textContent = campaign.state === "paused" ? "Campaign is paused." : "You joined this campaign.";
        actions.append(note);
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

  const dashboardError = mountNode.querySelector("#dashboardError");
  const dashboardFiltersSection = mountNode.querySelector(".dashboard-filters");
  const campaignListSection = mountNode.querySelector(".campaign-list-section");
  const createCampaignHeroLink = mountNode.querySelector("#createCampaignHeroLink");
  const filterTabs = [...mountNode.querySelectorAll(".filter-tab")];
  const volunteerMyCampaignsTab = mountNode.querySelector("#volunteerMyCampaignsTab");
  const adminPanel = mountNode.querySelector("#adminPanel");
  const organizerToolsFilters = mountNode.querySelector("#organizerToolsFilters");

  const adminActionMessage = mountNode.querySelector("#adminActionMessage");
  const organizerCampaignList = mountNode.querySelector("#organizerCampaignList");
  const organizerCampaignEmpty = mountNode.querySelector("#organizerCampaignEmpty");
  const adminGalleryCard = mountNode.querySelector("#adminGalleryCard");
  const galleryUploadForm = mountNode.querySelector("#galleryUploadForm");
  const galleryTitle = mountNode.querySelector("#galleryTitle");
  const gallerySortOrder = mountNode.querySelector("#gallerySortOrder");
  const galleryImageFile = mountNode.querySelector("#galleryImageFile");
  const galleryMessage = mountNode.querySelector("#galleryMessage");
  const adminGalleryList = mountNode.querySelector("#adminGalleryList");
  const adminGalleryEmpty = mountNode.querySelector("#adminGalleryEmpty");
  const adminUsersCard = mountNode.querySelector("#adminUsersCard");
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

  let allCampaigns = [];
  let joinedCampaignIds = new Set();
  let volunteerCampaignIds = new Set();
  let organizerCampaigns = [];
  let adminUsers = [];
  let homeGalleryImages = [];
  let activeFilter = "total";
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

    adminUserList.innerHTML = "";
    adminUserEmpty.hidden = adminUsers.length !== 0;

    for (const adminUser of adminUsers) {
      const item = document.createElement("li");
      item.className = "user-admin-item";

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
        </div>
      `;

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

        const { error } = await updateAdminUser({
          user_id: adminUser.user_id,
          display_name: displayName,
          first_name: firstName,
          last_name: lastName,
          phone,
          user_type: selectedRole,
          is_admin: selectedIsAdmin,
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

  const renderOrganizerCampaigns = () => {
    organizerCampaignList.innerHTML = "";
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
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    if (!canManageCampaigns || filteredOrganizerCampaigns.length === 0) {
      organizerCampaignEmpty.textContent = getEmptyStateMessage(activeFilter, true);
      organizerCampaignEmpty.hidden = !canManageCampaigns;
      return;
    }

    organizerCampaignEmpty.hidden = true;

    for (const campaign of filteredOrganizerCampaigns) {
      const item = document.createElement("li");
      item.className = "organizer-campaign-item";
      const statusMeta = getEventStatusMeta(campaign.status);
      const requiredSkills = normalizeVolunteerSkills(campaign.required_skills || []);
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

        if (!payload || payload.capacity <= 0 || payload.end_at <= payload.start_at) {
          setInlineMessage(adminActionMessage, "Provide valid dates and capacity.", "error");
          return;
        }

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

    const predicate = getFilterPredicate(activeFilter, { volunteerCampaignIds });
    const filteredCampaigns = visibleCampaigns
      .filter(predicate)
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    renderCampaignList(filteredCampaigns, mountNode, {
      userType,
      isAdmin,
      activeFilter,
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
      getOrganizerCampaigns(),
      getCampaignDashboardData(),
      getOrganizerCampaignSignupSummary(),
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
