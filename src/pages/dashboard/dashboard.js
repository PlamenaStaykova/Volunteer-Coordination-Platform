import "./dashboard.css";
import pageHtml from "./dashboard.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import {
  assignVolunteerToCampaign,
  cancelCampaignApplication,
  createCampaignWithShift,
  deleteCampaign,
  getCampaignApplications,
  getCampaignDashboardData,
  getCurrentUser,
  getIsAdmin,
  getJoinedCampaignIds,
  getOrganizerCampaigns,
  getUserProfile,
  getUserType,
  getVolunteerDirectory,
  getVolunteerParticipationCampaigns,
  joinCampaign,
  leaveCampaign,
  setCampaignStatus,
  updateUserProfile,
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

function getFilterPredicate(filter) {
  if (filter === "open") {
    return (campaign) => campaign.state === "open";
  }
  if (filter === "done") {
    return (campaign) => campaign.state === "done";
  }
  return () => true;
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
    campaignEmptyState.hidden = false;
    return;
  }

  campaignEmptyState.hidden = true;
  const isVolunteer = context.userType === "volunteer" && !context.isAdmin;

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

    if (isVolunteer) {
      const actions = document.createElement("div");
      actions.className = "campaign-actions";

      const hasJoined = context.joinedCampaignIds.has(campaign.id);
      if (campaign.state === "open") {
        if (hasJoined) {
          const leaveButton = document.createElement("button");
          leaveButton.type = "button";
          leaveButton.className = "btn btn-neutral btn-small";
          leaveButton.textContent = "Leave Campaign";
          leaveButton.addEventListener("click", async () => {
            await context.onLeaveCampaign(campaign.id);
          });
          actions.append(leaveButton);
        } else {
          const joinButton = document.createElement("button");
          joinButton.type = "button";
          joinButton.className = "btn btn-small";
          joinButton.textContent = campaign.vacancies > 0 ? "Join Campaign" : "Campaign Full";
          joinButton.disabled = campaign.vacancies <= 0;
          joinButton.addEventListener("click", async () => {
            await context.onJoinCampaign(campaign.id);
          });
          actions.append(joinButton);
        }
      } else if (hasJoined) {
        const note = document.createElement("span");
        note.textContent = "You joined this campaign.";
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
  mountNode.append(pageContainer.firstElementChild);

  const profileForm = mountNode.querySelector("#profileForm");
  const profileMessage = mountNode.querySelector("#profileMessage");
  const profileFirstName = mountNode.querySelector("#profileFirstName");
  const profileLastName = mountNode.querySelector("#profileLastName");
  const profileEmail = mountNode.querySelector("#profileEmail");
  const profilePhone = mountNode.querySelector("#profilePhone");
  const volunteerSkillsFields = mountNode.querySelector("#volunteerSkillsFields");
  const selectedSkillsLine = mountNode.querySelector("#selectedSkillsLine");
  const selectedSkillsEditor = mountNode.querySelector("#selectedSkillsEditor");
  const profileSkillsGrid = mountNode.querySelector("#profileSkillsGrid");
  const organizerProfileFields = mountNode.querySelector("#organizerProfileFields");
  const profileOrganizationName = mountNode.querySelector("#profileOrganizationName");
  const profileCampaignManager = mountNode.querySelector("#profileCampaignManager");

  const activeCampaignsCount = mountNode.querySelector("#activeCampaignsCount");
  const allCampaignsCount = mountNode.querySelector("#allCampaignsCount");
  const dashboardError = mountNode.querySelector("#dashboardError");
  const filterTabs = mountNode.querySelectorAll(".filter-tab");
  const adminPanel = mountNode.querySelector("#adminPanel");
  const volunteerParticipationSection = mountNode.querySelector("#volunteerParticipationSection");
  const volunteerCampaignList = mountNode.querySelector("#volunteerCampaignList");
  const volunteerCampaignEmpty = mountNode.querySelector("#volunteerCampaignEmpty");

  const createCampaignForm = mountNode.querySelector("#createCampaignForm");
  const createCampaignMessage = mountNode.querySelector("#createCampaignMessage");
  const adminActionMessage = mountNode.querySelector("#adminActionMessage");
  const organizerCampaignList = mountNode.querySelector("#organizerCampaignList");
  const organizerCampaignEmpty = mountNode.querySelector("#organizerCampaignEmpty");
  const applicationsHint = mountNode.querySelector("#applicationsHint");
  const applicationsList = mountNode.querySelector("#applicationsList");
  const applicationsEmpty = mountNode.querySelector("#applicationsEmpty");
  const assignVolunteerForm = mountNode.querySelector("#assignVolunteerForm");
  const assignCampaignSelect = mountNode.querySelector("#assignCampaignSelect");
  const assignVolunteerSelect = mountNode.querySelector("#assignVolunteerSelect");
  const assignVolunteerMessage = mountNode.querySelector("#assignVolunteerMessage");

  const [userType, isAdmin] = await Promise.all([getUserType(user), getIsAdmin(user)]);
  const canManageCampaigns = userType === "organizer" || isAdmin;
  const isVolunteer = userType === "volunteer" && !isAdmin;
  const showOrganizerProfileFields = userType === "organizer";

  adminPanel.hidden = !canManageCampaigns;
  volunteerParticipationSection.hidden = !isVolunteer;
  organizerProfileFields.hidden = !showOrganizerProfileFields;
  volunteerSkillsFields.hidden = !isVolunteer;

  let allCampaigns = [];
  let joinedCampaignIds = new Set();
  let organizerCampaigns = [];
  let volunteerDirectory = [];
  let selectedApplicationsCampaignId = null;
  let activeFilter = "total";
  let savedVolunteerSkills = [];

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

  const updateSelectedSkillsLine = () => {
    if (!selectedSkillsLine) {
      return;
    }

    selectedSkillsLine.textContent =
      savedVolunteerSkills.length > 0
        ? `Selected: ${savedVolunteerSkills.join(", ")}`
        : "Selected: None";
  };

  const renderSelectedSkillsEditor = () => {
    if (!selectedSkillsEditor) {
      return;
    }

    selectedSkillsEditor.innerHTML = "";
    if (savedVolunteerSkills.length === 0) {
      selectedSkillsEditor.hidden = true;
      return;
    }

    selectedSkillsEditor.hidden = false;
    for (const skill of savedVolunteerSkills) {
      const tag = document.createElement("div");
      tag.className = "selected-skill-tag";

      const label = document.createElement("span");
      label.textContent = skill;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "selected-skill-remove";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${skill}`);
      removeButton.addEventListener("click", () => {
        savedVolunteerSkills = savedVolunteerSkills.filter((value) => value !== skill);
        updateSelectedSkillsLine();
        renderSelectedSkillsEditor();
        renderVolunteerSkillsOptions();
      });

      tag.append(label, removeButton);
      selectedSkillsEditor.append(tag);
    }
  };

  const renderVolunteerSkillsOptions = () => {
    if (!profileSkillsGrid) {
      return;
    }

    const pendingCheckedSkills = new Set(
      [...profileSkillsGrid.querySelectorAll('input[name="volunteerSkills"]:checked')]
        .map((input) => input.value)
        .filter((value) => VOLUNTEER_SKILLS.includes(value))
    );

    profileSkillsGrid.innerHTML = "";
    const selectedSet = new Set(savedVolunteerSkills);
    const availableSkills = VOLUNTEER_SKILLS.filter((skill) => !selectedSet.has(skill));

    if (availableSkills.length === 0) {
      const helper = document.createElement("p");
      helper.className = "skills-help";
      helper.textContent = "All available skills are already selected.";
      profileSkillsGrid.append(helper);
      return;
    }

    for (const skill of availableSkills) {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "volunteerSkills";
      checkbox.value = skill;
      checkbox.checked = pendingCheckedSkills.has(skill);
      label.append(checkbox, document.createTextNode(skill));
      profileSkillsGrid.append(label);
    }
  };

  const getPendingVolunteerSkills = () => {
    if (!profileSkillsGrid) {
      return [];
    }
    return normalizeVolunteerSkills(
      [...profileSkillsGrid.querySelectorAll('input[name="volunteerSkills"]:checked')]
      .map((input) => input.value)
    );
  };

  const setSavedVolunteerSkills = (skills = []) => {
    savedVolunteerSkills = normalizeVolunteerSkills(skills);
    updateSelectedSkillsLine();
    renderSelectedSkillsEditor();
    renderVolunteerSkillsOptions();
  };

  const findOrganizerCampaignById = (campaignId) => {
    return organizerCampaigns.find((campaign) => campaign.id === campaignId) || null;
  };

  const renderVolunteerParticipation = (campaigns) => {
    volunteerCampaignList.innerHTML = "";
    volunteerCampaignEmpty.hidden = campaigns.length !== 0;

    for (const campaign of campaigns) {
      const item = document.createElement("li");
      item.className = "campaign-item";
      item.innerHTML = `
        <article class="campaign-card">
          <header class="campaign-header">
            <h3><a class="campaign-title-link" href="/campaign/${campaign.id}">${campaign.title}</a></h3>
            <span class="campaign-status ${campaign.participation_status === "attended" ? "is-done" : "is-open"}">
              ${campaign.participation_status === "attended" ? "Participated" : "Joined"}
            </span>
          </header>
          <p class="campaign-meta"><strong>Starts:</strong> ${formatDateTime(campaign.start_at)}</p>
          <p class="campaign-meta"><strong>Ends:</strong> ${formatDateTime(campaign.end_at)}</p>
        </article>
      `;
      volunteerCampaignList.append(item);
    }
  };

  const loadApplicationsForCampaign = async (campaignId) => {
    applicationsList.innerHTML = "";
    applicationsEmpty.hidden = true;

    const campaign = findOrganizerCampaignById(campaignId);
    applicationsHint.hidden = false;
    applicationsHint.textContent = campaign
      ? `Showing volunteers for: ${campaign.title}`
      : "Showing volunteers for selected campaign.";

    const { data, error } = await getCampaignApplications(campaignId);
    if (error) {
      applicationsEmpty.hidden = false;
      applicationsEmpty.textContent = error.message || "Unable to load applications.";
      return;
    }

    if (data.length === 0) {
      applicationsEmpty.hidden = false;
      applicationsEmpty.textContent = "No active applications for this campaign.";
      return;
    }

    for (const application of data) {
      const item = document.createElement("li");
      item.className = "application-item";
      item.innerHTML = `
        <p><strong>${application.volunteer_name}</strong> (${application.volunteer_type})</p>
        <p>Status: ${application.status}</p>
      `;

      const actions = document.createElement("div");
      actions.className = "item-actions";
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-small btn-danger";
      removeButton.textContent = "Remove from Campaign";
      removeButton.addEventListener("click", async () => {
        const { error: removeError } = await cancelCampaignApplication(application.signup_id);
        if (removeError) {
          setInlineMessage(adminActionMessage, removeError.message || "Failed to remove volunteer.");
          return;
        }

        setInlineMessage(adminActionMessage, "Volunteer removed from campaign.", "success");
        await loadApplicationsForCampaign(campaignId);
        await loadCampaignData();
      });
      actions.append(removeButton);
      item.append(actions);
      applicationsList.append(item);
    }
  };

  const renderOrganizerCampaigns = () => {
    organizerCampaignList.innerHTML = "";

    if (!canManageCampaigns || organizerCampaigns.length === 0) {
      organizerCampaignEmpty.hidden = !canManageCampaigns;
      return;
    }

    organizerCampaignEmpty.hidden = true;

    for (const campaign of organizerCampaigns) {
      const item = document.createElement("li");
      item.className = "organizer-campaign-item";
      const actionLabel = campaign.status === "done" ? "Reopen" : "Mark Done";

      item.innerHTML = `
        <div class="campaign-title-row">
          <h4>${campaign.title}</h4>
          <button type="button" class="icon-btn" data-action="toggle-edit" aria-label="Edit campaign">&#9998;</button>
        </div>
        <p><strong>Status:</strong> ${campaign.status}</p>
        <p><strong>Dates:</strong> ${formatDateTime(campaign.start_at)} - ${formatDateTime(campaign.end_at)}</p>
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

      const statusButton = document.createElement("button");
      statusButton.type = "button";
      statusButton.className = "btn btn-small";
      statusButton.textContent = actionLabel;
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

      const applicationsButton = document.createElement("button");
      applicationsButton.type = "button";
      applicationsButton.className = "btn btn-small btn-neutral";
      applicationsButton.textContent = "View Volunteers";
      applicationsButton.addEventListener("click", async () => {
        selectedApplicationsCampaignId = campaign.id;
        assignCampaignSelect.value = campaign.id;
        await loadApplicationsForCampaign(campaign.id);
      });
      actions.append(applicationsButton);

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

        if (selectedApplicationsCampaignId === campaign.id) {
          selectedApplicationsCampaignId = null;
          applicationsList.innerHTML = "";
          applicationsHint.hidden = false;
          applicationsHint.textContent = 'Select "View Volunteers" from a campaign above.';
          applicationsEmpty.hidden = true;
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
    const predicate = getFilterPredicate(activeFilter);
    const filteredCampaigns = allCampaigns.filter(predicate);
    renderCampaignList(filteredCampaigns, mountNode, {
      userType,
      isAdmin,
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

  const loadProfileData = async () => {
    const { data, error } = await getUserProfile(user);
    if (error) {
      setInlineMessage(profileMessage, error.message || "Unable to load profile.");
      return;
    }

    const nameParts = String(data?.display_name || "").trim().split(/\s+/).filter(Boolean);
    const fallbackFirstName = nameParts[0] || "";
    const fallbackLastName = nameParts.slice(1).join(" ");

    profileFirstName.value = data?.first_name || fallbackFirstName;
    profileLastName.value = data?.last_name || fallbackLastName;
    profileEmail.value = data?.email || user.email || "";
    profilePhone.value = data?.phone || "";

    if (showOrganizerProfileFields) {
      profileOrganizationName.value = data?.organization_name || "";
      profileCampaignManager.value = data?.campaign_manager || "";
    }
    if (isVolunteer) {
      setSavedVolunteerSkills(data?.volunteer_skills || []);
    }
  };

  const loadCampaignData = async () => {
    const { data, error } = await getCampaignDashboardData();
    if (error) {
      dashboardError.hidden = false;
      dashboardError.textContent = error.message || "Unable to load campaigns right now.";
      activeCampaignsCount.textContent = "0";
      allCampaignsCount.textContent = "0";
      allCampaigns = [];
      applyFilter();
      return;
    }

    dashboardError.hidden = true;
    allCampaigns = data;
    activeCampaignsCount.textContent = String(allCampaigns.filter((campaign) => campaign.state === "open").length);
    allCampaignsCount.textContent = String(allCampaigns.length);
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

    if (!joinedResult.error) {
      joinedCampaignIds = new Set(joinedResult.data);
    }

    if (participationResult.error) {
      volunteerCampaignList.innerHTML = "";
      volunteerCampaignEmpty.hidden = false;
      volunteerCampaignEmpty.textContent = participationResult.error.message || "Unable to load your participation.";
      return;
    }

    renderVolunteerParticipation(participationResult.data);
  };

  const loadOrganizerData = async () => {
    if (!canManageCampaigns) {
      return;
    }

    const [campaignsResult, dashboardResult, volunteersResult] = await Promise.all([
      getOrganizerCampaigns(),
      getCampaignDashboardData(),
      getVolunteerDirectory(),
    ]);

    if (campaignsResult.error) {
      setInlineMessage(adminActionMessage, campaignsResult.error.message || "Unable to load organizer campaigns.");
      organizerCampaigns = [];
    } else {
      const capacityById = new Map((dashboardResult.data ?? []).map((campaign) => [campaign.id, campaign.max_volunteers]));
      organizerCampaigns = (campaignsResult.data ?? []).map((campaign) => ({
        ...campaign,
        capacity: capacityById.get(campaign.id) ?? 10,
      }));
      setInlineMessage(adminActionMessage, "");
    }

    volunteerDirectory = volunteersResult.error ? [] : volunteersResult.data ?? [];

    assignCampaignSelect.innerHTML = "";
    for (const campaign of organizerCampaigns) {
      const option = document.createElement("option");
      option.value = campaign.id;
      option.textContent = campaign.title;
      assignCampaignSelect.append(option);
    }

    assignVolunteerSelect.innerHTML = "";
    for (const volunteer of volunteerDirectory) {
      const option = document.createElement("option");
      option.value = volunteer.id;
      option.textContent = volunteer.display_name;
      assignVolunteerSelect.append(option);
    }

    renderOrganizerCampaigns();

    if (selectedApplicationsCampaignId) {
      await loadApplicationsForCampaign(selectedApplicationsCampaignId);
    } else {
      applicationsHint.hidden = false;
      applicationsHint.textContent = 'Select "View Volunteers" from a campaign above.';
      applicationsList.innerHTML = "";
      applicationsEmpty.hidden = true;
    }
  };

  filterTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeFilter = tab.dataset.filter || "total";
      filterTabs.forEach((otherTab) => otherTab.classList.remove("is-active"));
      tab.classList.add("is-active");
      applyFilter();
    });
  });

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const mergedVolunteerSkills = normalizeVolunteerSkills([
      ...savedVolunteerSkills,
      ...getPendingVolunteerSkills(),
    ]);

    const payload = {
      first_name: profileFirstName.value,
      last_name: profileLastName.value,
      email: profileEmail.value,
      phone: profilePhone.value,
      organization_name: showOrganizerProfileFields ? profileOrganizationName.value : "",
      campaign_manager: showOrganizerProfileFields ? profileCampaignManager.value : "",
      volunteer_skills: isVolunteer ? mergedVolunteerSkills : [],
      user_type: userType === "organizer" ? "organizer" : "volunteer",
    };

    if (!payload.first_name.trim() || !payload.last_name.trim() || !payload.email.trim()) {
      setInlineMessage(profileMessage, "First name, last name, and email are required.");
      return;
    }

    const { data, error } = await updateUserProfile(payload, user);
    if (error) {
      setInlineMessage(profileMessage, error.message || "Unable to save profile.");
      return;
    }

    profileFirstName.value = data?.first_name || payload.first_name.trim();
    profileLastName.value = data?.last_name || payload.last_name.trim();
    profileEmail.value = data?.email || payload.email.trim();
    profilePhone.value = data?.phone || payload.phone.trim();
    if (showOrganizerProfileFields) {
      profileOrganizationName.value = data?.organization_name || payload.organization_name.trim();
      profileCampaignManager.value = data?.campaign_manager || payload.campaign_manager.trim();
    }
    if (isVolunteer) {
      setSavedVolunteerSkills(data?.volunteer_skills || payload.volunteer_skills);
    }

    setInlineMessage(profileMessage, "Profile saved.", "success");
    await loadCampaignData();
  });

  renderVolunteerSkillsOptions();
  if (canManageCampaigns) {
    createCampaignForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = toCampaignPayloadFromForm({
        title: mountNode.querySelector("#createTitle").value,
        description: mountNode.querySelector("#createDescription").value,
        location: mountNode.querySelector("#createLocation").value,
        startAt: mountNode.querySelector("#createStartAt").value,
        endAt: mountNode.querySelector("#createEndAt").value,
        capacity: mountNode.querySelector("#createCapacity").value,
      });

      if (!payload || payload.capacity <= 0 || payload.end_at <= payload.start_at) {
        setInlineMessage(createCampaignMessage, "Provide valid dates and capacity.", "error");
        return;
      }

      const { data, error } = await createCampaignWithShift(payload);
      if (error) {
        setInlineMessage(createCampaignMessage, error.message || "Unable to create campaign.");
        return;
      }

      if (data?.id) {
        window.location.href = `/campaign/${data.id}`;
        return;
      }

      createCampaignForm.reset();
      mountNode.querySelector("#createCapacity").value = "10";
      setInlineMessage(createCampaignMessage, "Campaign created successfully.", "success");
      await loadOrganizerData();
      await loadCampaignData();
    });

    assignVolunteerForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const campaignId = assignCampaignSelect.value;
      const volunteerId = assignVolunteerSelect.value;
      if (!campaignId || !volunteerId) {
        setInlineMessage(assignVolunteerMessage, "Select campaign and volunteer.");
        return;
      }

      const { error } = await assignVolunteerToCampaign(campaignId, volunteerId);
      if (error) {
        setInlineMessage(assignVolunteerMessage, error.message || "Unable to assign volunteer.");
        return;
      }

      setInlineMessage(assignVolunteerMessage, "Volunteer assigned successfully.", "success");
      selectedApplicationsCampaignId = campaignId;
      await loadApplicationsForCampaign(campaignId);
      await loadCampaignData();
    });
  }

  await loadProfileData();
  await loadVolunteerData();
  await loadOrganizerData();
  await loadCampaignData();

  mountNode.append(renderFooter());
}
