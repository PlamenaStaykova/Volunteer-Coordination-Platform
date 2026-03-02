import "./profile.css";
import pageHtml from "./profile.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { requireAuth } from "../../lib/guards.js";
import { getIsAdmin, getUserProfile, getUserType, updateUserProfile } from "../../lib/supabase.js";

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

export async function renderProfilePage(mountNode) {
  const user = await requireAuth("/auth");
  if (!user) {
    return;
  }

  document.title = "Volunteer Coordination Platform - My Profile";
  mountNode.innerHTML = "";
  mountNode.append(await renderHeader("profile"));

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

  const [userType, isAdmin] = await Promise.all([getUserType(user), getIsAdmin(user)]);
  const isVolunteer = userType === "volunteer" && !isAdmin;
  const showOrganizerProfileFields = userType === "organizer" || isAdmin;

  organizerProfileFields.hidden = !showOrganizerProfileFields;
  volunteerSkillsFields.hidden = !isVolunteer;

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
      [...profileSkillsGrid.querySelectorAll('input[name="volunteerSkills"]:checked')].map(
        (input) => input.value
      )
    );
  };

  const setSavedVolunteerSkills = (skills = []) => {
    savedVolunteerSkills = normalizeVolunteerSkills(skills);
    updateSelectedSkillsLine();
    renderSelectedSkillsEditor();
    renderVolunteerSkillsOptions();
  };

  const loadProfileData = async () => {
    const { data, error } = await getUserProfile(user);
    if (error) {
      setInlineMessage(profileMessage, error.message || "Unable to load profile.");
      return;
    }

    const nameParts = String(data?.display_name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
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
  });

  renderVolunteerSkillsOptions();
  await loadProfileData();
  mountNode.append(renderFooter());
}
