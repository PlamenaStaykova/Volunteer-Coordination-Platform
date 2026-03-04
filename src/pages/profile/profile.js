import "./profile.css";
import pageHtml from "./profile.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import { requireAuth } from "../../lib/guards.js";
import {
  deleteProfileAvatar,
  getIsAdmin,
  getProfileAvatarSignedUrl,
  getUserProfile,
  getUserType,
  updateUserProfile,
  uploadProfileAvatar,
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
const PROFILE_AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;

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
  const user = await requireAuth("/auth/");
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
  const profileAvatarFile = mountNode.querySelector("#profileAvatarFile");
  const profileAvatarUploadBtn = mountNode.querySelector("#profileAvatarUploadBtn");
  const profileAvatarEditBtn = mountNode.querySelector("#profileAvatarEditBtn");
  const profileAvatarDeleteBtn = mountNode.querySelector("#profileAvatarDeleteBtn");
  const profileAvatarLoading = mountNode.querySelector("#profileAvatarLoading");
  const profileAvatarPreview = mountNode.querySelector("#profileAvatarPreview");
  const profileAvatarPlaceholder = mountNode.querySelector("#profileAvatarPlaceholder");
  const profileAvatarDownloadLink = mountNode.querySelector("#profileAvatarDownloadLink");
  const profileAvatarMessage = mountNode.querySelector("#profileAvatarMessage");
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
  let currentAvatarPath = "";
  let isAvatarUploading = false;

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

  const syncAvatarActionButtons = () => {
    const hasAvatar = Boolean(String(currentAvatarPath || "").trim());
    if (profileAvatarEditBtn) {
      profileAvatarEditBtn.hidden = !hasAvatar;
    }
    if (profileAvatarDeleteBtn) {
      profileAvatarDeleteBtn.hidden = !hasAvatar;
    }
    if (profileAvatarUploadBtn) {
      profileAvatarUploadBtn.textContent = hasAvatar ? "Save Avatar" : "Upload Avatar";
    }
  };

  const setAvatarUploadingState = (isUploading, loadingLabel = "Uploading...") => {
    isAvatarUploading = isUploading;
    if (profileAvatarUploadBtn) {
      profileAvatarUploadBtn.disabled = isUploading;
    }
    if (profileAvatarEditBtn) {
      profileAvatarEditBtn.disabled = isUploading;
    }
    if (profileAvatarDeleteBtn) {
      profileAvatarDeleteBtn.disabled = isUploading;
    }
    if (profileAvatarFile) {
      profileAvatarFile.disabled = isUploading;
    }
    if (profileAvatarLoading) {
      profileAvatarLoading.textContent = loadingLabel;
      profileAvatarLoading.hidden = !isUploading;
    }
    if (!isUploading) {
      syncAvatarActionButtons();
    }
  };

  const setAvatarPreview = (signedUrl = "", avatarPath = "") => {
    const normalizedUrl = String(signedUrl || "").trim();
    const normalizedPath = String(avatarPath || "").trim();

    if (profileAvatarPreview) {
      profileAvatarPreview.hidden = !normalizedUrl;
      profileAvatarPreview.src = normalizedUrl || "";
    }
    if (profileAvatarPlaceholder) {
      profileAvatarPlaceholder.hidden = Boolean(normalizedUrl);
    }
    if (profileAvatarDownloadLink) {
      profileAvatarDownloadLink.hidden = !normalizedUrl;
      profileAvatarDownloadLink.href = normalizedUrl || "#";
      if (normalizedPath) {
        profileAvatarDownloadLink.setAttribute("download", normalizedPath.split("/").pop() || "avatar");
      } else {
        profileAvatarDownloadLink.removeAttribute("download");
      }
    }
  };

  const loadAvatarPreview = async (avatarPath) => {
    const normalizedPath = String(avatarPath || "").trim();
    if (!normalizedPath) {
      setAvatarPreview("", "");
      syncAvatarActionButtons();
      return;
    }

    const { data, error } = await getProfileAvatarSignedUrl(normalizedPath);
    if (error || !data?.signedUrl) {
      setAvatarPreview("", "");
      setInlineMessage(profileAvatarMessage, error?.message || "Unable to load avatar preview.");
      syncAvatarActionButtons();
      return;
    }

    setAvatarPreview(data.signedUrl, normalizedPath);
    setInlineMessage(profileAvatarMessage, "");
    syncAvatarActionButtons();
  };

  profileAvatarPreview?.addEventListener("error", () => {
    setAvatarPreview("", "");
    setInlineMessage(profileAvatarMessage, "Unable to display avatar preview.");
    syncAvatarActionButtons();
  });

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
    currentAvatarPath = String(data?.avatar_url || "").trim();
    await loadAvatarPreview(currentAvatarPath);

    if (showOrganizerProfileFields) {
      profileOrganizationName.value = data?.organization_name || "";
      profileCampaignManager.value = data?.campaign_manager || "";
    }
    if (isVolunteer) {
      setSavedVolunteerSkills(data?.volunteer_skills || []);
    }
  };

  profileAvatarUploadBtn?.addEventListener("click", async () => {
    if (isAvatarUploading) {
      return;
    }

    const selectedFile = profileAvatarFile?.files?.[0] || null;
    if (!selectedFile) {
      setInlineMessage(profileAvatarMessage, "Select an image before uploading.");
      return;
    }

    const selectedFileType = String(selectedFile.type || "").toLowerCase();
    if (!selectedFileType.startsWith("image/")) {
      setInlineMessage(profileAvatarMessage, "Only image files are allowed.");
      return;
    }

    if (Number(selectedFile.size || 0) > PROFILE_AVATAR_MAX_SIZE_BYTES) {
      setInlineMessage(profileAvatarMessage, "Image is too large. Maximum size is 5 MB.");
      return;
    }

    setInlineMessage(profileAvatarMessage, "");
    setAvatarUploadingState(true, "Uploading...");

    try {
      const { data, error } = await uploadProfileAvatar(selectedFile, user);
      if (error) {
        setInlineMessage(profileAvatarMessage, error.message || "Unable to upload avatar.");
        return;
      }

      currentAvatarPath = String(data?.avatar_path || "").trim();
      if (data?.avatar_url) {
        setAvatarPreview(data.avatar_url, currentAvatarPath);
      } else {
        await loadAvatarPreview(currentAvatarPath);
      }

      if (profileAvatarFile) {
        profileAvatarFile.value = "";
      }
      setInlineMessage(profileAvatarMessage, "Avatar uploaded successfully.", "success");
    } finally {
      setAvatarUploadingState(false);
    }
  });

  profileAvatarEditBtn?.addEventListener("click", () => {
    if (isAvatarUploading) {
      return;
    }

    profileAvatarFile?.click();
  });

  profileAvatarDeleteBtn?.addEventListener("click", async () => {
    if (isAvatarUploading) {
      return;
    }

    if (!currentAvatarPath) {
      setInlineMessage(profileAvatarMessage, "No avatar to delete.");
      return;
    }

    const shouldDelete = window.confirm("Delete your current avatar?");
    if (!shouldDelete) {
      return;
    }

    setInlineMessage(profileAvatarMessage, "");
    setAvatarUploadingState(true, "Deleting...");
    try {
      const { error } = await deleteProfileAvatar(user);
      if (error) {
        setInlineMessage(profileAvatarMessage, error.message || "Unable to delete avatar.");
        return;
      }

      currentAvatarPath = "";
      if (profileAvatarFile) {
        profileAvatarFile.value = "";
      }
      setAvatarPreview("", "");
      syncAvatarActionButtons();
      setInlineMessage(profileAvatarMessage, "Avatar deleted.", "success");
    } finally {
      setAvatarUploadingState(false);
    }
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
  });

  renderVolunteerSkillsOptions();
  syncAvatarActionButtons();
  await loadProfileData();
  mountNode.append(renderFooter());
}
