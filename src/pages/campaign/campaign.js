import "./campaign.css";
import pageHtml from "./campaign.html?raw";
import { renderHeader } from "../../components/header/header.js";
import { renderFooter } from "../../components/footer/footer.js";
import {
  assignVolunteerToCampaign,
  cancelCampaignApplication,
  deleteCampaign,
  getCampaignApplications,
  getCampaignById,
  getCurrentUser,
  getIsAdmin,
  getJoinedCampaignIds,
  getUserType,
  getVolunteerDirectory,
  joinCampaign,
  leaveCampaign,
  setCampaignStatus,
  updateCampaignWithShift,
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
  mountNode.append(pageContainer.firstElementChild);

  const campaignDetail = mountNode.querySelector("#campaignDetail");
  const campaignStatus = mountNode.querySelector("#campaignStatus");
  const campaignMissing = mountNode.querySelector("#campaignMissing");
  const titleEl = mountNode.querySelector("#campaignTitle");
  const orgEl = mountNode.querySelector("#campaignOrg");
  const locationEl = mountNode.querySelector("#campaignLocation");
  const datesEl = mountNode.querySelector("#campaignDates");
  const descriptionEl = mountNode.querySelector("#campaignDescription");
  const maxVolunteersEl = mountNode.querySelector("#campaignMaxVolunteers");
  const vacanciesEl = mountNode.querySelector("#campaignVacancies");
  const campaignActionMessage = mountNode.querySelector("#campaignActionMessage");
  const volunteerActions = mountNode.querySelector("#volunteerActions");
  const joinCampaignBtn = mountNode.querySelector("#joinCampaignBtn");
  const leaveCampaignBtn = mountNode.querySelector("#leaveCampaignBtn");
  const campaignAdminTools = mountNode.querySelector("#campaignAdminTools");
  const campaignInlineEditor = mountNode.querySelector("#campaignInlineEditor");
  const toggleCampaignStatusBtn = mountNode.querySelector("#toggleCampaignStatusBtn");
  const deleteCampaignBtn = mountNode.querySelector("#deleteCampaignBtn");
  const assignVolunteerForm = mountNode.querySelector("#assignVolunteerForm");
  const assignVolunteerSelect = mountNode.querySelector("#assignVolunteerSelect");
  const applicationsList = mountNode.querySelector("#applicationsList");
  const applicationsEmpty = mountNode.querySelector("#applicationsEmpty");

  const [userType, isAdmin] = await Promise.all([getUserType(user), getIsAdmin(user)]);
  const canVolunteerParticipate = userType === "volunteer" && !isAdmin;
  let campaignData = null;
  let cancelActiveInlineEdit = null;

  const renderApplications = async () => {
    applicationsList.innerHTML = "";
    applicationsEmpty.hidden = true;

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

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-small btn-danger";
      removeButton.textContent = "Remove from Campaign";
      removeButton.addEventListener("click", async () => {
        const { error: removeError } = await cancelCampaignApplication(application.signup_id);
        if (removeError) {
          setInlineMessage(campaignActionMessage, removeError.message || "Failed to remove volunteer.");
          return;
        }

        setInlineMessage(campaignActionMessage, "Volunteer removed from campaign.", "success");
        await loadCampaign();
      });

      item.append(removeButton);
      applicationsList.append(item);
    }
  };

  const getInlineFieldDefinitions = () => [
    {
      key: "title",
      label: "Title",
      ariaLabel: "Edit Title",
      editorType: "text",
      readValue: () => campaignData?.title || "",
      displayValue: () => campaignData?.title || "-",
    },
    {
      key: "description",
      label: "Description",
      ariaLabel: "Edit Description",
      editorType: "textarea",
      readValue: () => campaignData?.description || "",
      displayValue: () => campaignData?.description || "-",
      multiline: true,
    },
    {
      key: "location",
      label: "Location",
      ariaLabel: "Edit Location",
      editorType: "text",
      readValue: () => campaignData?.location || "",
      displayValue: () => campaignData?.location || "-",
    },
    {
      key: "start_at",
      label: "Start",
      ariaLabel: "Edit Start",
      editorType: "date",
      readValue: () => toDateInputValue(campaignData?.start_at),
      displayValue: () => formatDateTime(campaignData?.start_at),
    },
    {
      key: "end_at",
      label: "End",
      ariaLabel: "Edit End",
      editorType: "date",
      readValue: () => toDateInputValue(campaignData?.end_at),
      displayValue: () => formatDateTime(campaignData?.end_at),
    },
    {
      key: "max_volunteers",
      label: "Max Volunteers",
      ariaLabel: "Edit Max Volunteers",
      editorType: "number",
      readValue: () => String(campaignData?.max_volunteers ?? 0),
      displayValue: () => String(campaignData?.max_volunteers ?? 0),
    },
  ];

  const buildCampaignPayloadForField = (fieldKey, rawValue) => {
    const title = fieldKey === "title" ? String(rawValue || "") : String(campaignData?.title || "");
    const description =
      fieldKey === "description" ? String(rawValue || "") : String(campaignData?.description || "");
    const location = fieldKey === "location" ? String(rawValue || "") : String(campaignData?.location || "");
    const startAt =
      fieldKey === "start_at" ? String(rawValue || "") : toDateInputValue(campaignData?.start_at || "");
    const endAt = fieldKey === "end_at" ? String(rawValue || "") : toDateInputValue(campaignData?.end_at || "");
    const capacity =
      fieldKey === "max_volunteers" ? String(rawValue || "") : String(campaignData?.max_volunteers ?? 0);

    if (!title.trim() || !description.trim() || !location.trim()) {
      return { payload: null, validationError: "Title, description, and location are required." };
    }

    if (!Number.isInteger(Number.parseInt(capacity, 10)) || Number.parseInt(capacity, 10) <= 0) {
      return { payload: null, validationError: "Max Volunteers must be a positive integer." };
    }

    const payload = toCampaignPayloadFromForm({
      title,
      description,
      location,
      startAt,
      endAt,
      capacity,
    });

    if (!payload) {
      return { payload: null, validationError: "Start and End must be valid dates." };
    }

    if (payload.end_at <= payload.start_at) {
      return { payload: null, validationError: "End date must be after Start date." };
    }

    return { payload, validationError: null };
  };

  const renderInlineEditorRows = () => {
    if (!campaignInlineEditor || !campaignData) {
      return;
    }

    campaignInlineEditor.innerHTML = "";
    cancelActiveInlineEdit = null;

    for (const field of getInlineFieldDefinitions()) {
      const row = document.createElement("div");
      row.className = "inline-edit-row";
      row.dataset.field = field.key;

      const label = document.createElement("p");
      label.className = "inline-edit-label";
      label.textContent = field.label;

      const valueWrap = document.createElement("div");
      valueWrap.className = "inline-edit-value-wrap";

      const display = document.createElement("p");
      display.className = `inline-edit-value${field.multiline ? " is-multiline" : ""}`;
      display.textContent = field.displayValue();

      const editorWrap = document.createElement("div");
      editorWrap.className = "inline-edit-editor";
      editorWrap.hidden = true;

      let editor;
      if (field.editorType === "textarea") {
        editor = document.createElement("textarea");
        editor.rows = 3;
      } else {
        editor = document.createElement("input");
        editor.type = field.editorType;
        if (field.editorType === "number") {
          editor.min = "1";
          editor.step = "1";
        }
      }
      editor.className = "inline-edit-input";
      editor.required = true;
      editor.value = field.readValue();
      editorWrap.append(editor);

      valueWrap.append(display, editorWrap);

      const controls = document.createElement("div");
      controls.className = "inline-edit-controls";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "icon-btn inline-edit-trigger";
      editButton.setAttribute("aria-label", field.ariaLabel);
      editButton.innerHTML = "&#9998;";

      const actionButtons = document.createElement("div");
      actionButtons.className = "inline-edit-actions";
      actionButtons.hidden = true;

      const saveButton = document.createElement("button");
      saveButton.type = "button";
      saveButton.className = "btn btn-small";
      saveButton.textContent = "Save";

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "btn btn-small btn-neutral";
      cancelButton.textContent = "Cancel";

      actionButtons.append(saveButton, cancelButton);
      controls.append(editButton, actionButtons);

      row.append(label, valueWrap, controls);
      campaignInlineEditor.append(row);

      const closeEditor = () => {
        row.classList.remove("is-editing");
        display.hidden = false;
        editorWrap.hidden = true;
        editButton.hidden = false;
        actionButtons.hidden = true;
      };

      const cancelEditor = () => {
        editor.value = field.readValue();
        closeEditor();
        if (cancelActiveInlineEdit === cancelEditor) {
          cancelActiveInlineEdit = null;
        }
      };

      const openEditor = () => {
        if (cancelActiveInlineEdit && cancelActiveInlineEdit !== cancelEditor) {
          cancelActiveInlineEdit();
        }

        row.classList.add("is-editing");
        display.hidden = true;
        editorWrap.hidden = false;
        editButton.hidden = true;
        actionButtons.hidden = false;
        cancelActiveInlineEdit = cancelEditor;
        editor.focus();
        editor.select?.();
      };

      const saveEditor = async () => {
        const { payload, validationError } = buildCampaignPayloadForField(field.key, editor.value);
        if (validationError) {
          setInlineMessage(campaignActionMessage, validationError);
          return;
        }

        const { error } = await updateCampaignWithShift(campaignId, payload);
        if (error) {
          setInlineMessage(campaignActionMessage, error.message || "Unable to update campaign.");
          return;
        }

        setInlineMessage(campaignActionMessage, `${field.label} updated.`, "success");
        await loadCampaign();
      };

      editButton.addEventListener("click", openEditor);
      cancelButton.addEventListener("click", cancelEditor);
      saveButton.addEventListener("click", saveEditor);

      editor.addEventListener("keydown", async (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancelEditor();
          return;
        }

        if (event.key === "Enter") {
          const isTextarea = field.editorType === "textarea";
          const canSaveWithEnter = !isTextarea || event.ctrlKey || event.metaKey;
          if (!canSaveWithEnter) {
            return;
          }
          event.preventDefault();
          await saveEditor();
        }
      });
    }
  };

  const loadCampaign = async () => {
    const { data, error } = await getCampaignById(campaignId);
    if (error || !data) {
      campaignMissing.hidden = false;
      campaignDetail.hidden = true;
      campaignAdminTools.hidden = true;
      return false;
    }

    campaignMissing.hidden = true;
    campaignData = data;

    document.title = `${campaignData.title} - Volunteer Coordination Platform`;
    titleEl.textContent = campaignData.title;
    campaignStatus.innerHTML = `<strong>Status:</strong> ${campaignData.status}`;
    orgEl.innerHTML = `<strong>Organization:</strong> ${campaignData.organization}`;
    locationEl.innerHTML = `<strong>Location:</strong> ${campaignData.location}`;
    datesEl.innerHTML = `<strong>Dates:</strong> ${formatDateTime(campaignData.start_at)} - ${formatDateTime(campaignData.end_at)}`;
    descriptionEl.textContent = campaignData.description;
    maxVolunteersEl.textContent = String(campaignData.max_volunteers);
    vacanciesEl.textContent = String(campaignData.vacancies);
    campaignDetail.hidden = false;

    const canManage = isAdmin || (userType === "organizer" && campaignData.created_by === user.id);
    campaignAdminTools.hidden = !canManage;

    if (canManage) {
      renderInlineEditorRows();
      toggleCampaignStatusBtn.textContent = campaignData.status === "done" ? "Reopen Campaign" : "Mark Campaign Done";

      const { data: volunteerDirectory } = await getVolunteerDirectory();
      assignVolunteerSelect.innerHTML = "";
      for (const volunteer of volunteerDirectory ?? []) {
        const option = document.createElement("option");
        option.value = volunteer.id;
        option.textContent = volunteer.display_name;
        assignVolunteerSelect.append(option);
      }

      await renderApplications();
    } else if (campaignInlineEditor) {
      campaignInlineEditor.innerHTML = "";
      cancelActiveInlineEdit = null;
    }

    volunteerActions.hidden = !canVolunteerParticipate || campaignData.status === "done";

    if (!volunteerActions.hidden) {
      const { data: joinedCampaignIds } = await getJoinedCampaignIds();
      const hasJoined = (joinedCampaignIds ?? []).includes(campaignId);
      joinCampaignBtn.hidden = hasJoined;
      leaveCampaignBtn.hidden = !hasJoined;
      joinCampaignBtn.disabled = campaignData.vacancies <= 0;
      if (campaignData.vacancies <= 0 && !hasJoined) {
        joinCampaignBtn.textContent = "Campaign Full";
      } else {
        joinCampaignBtn.textContent = "Join Campaign";
      }
    }

    return true;
  };

  joinCampaignBtn.addEventListener("click", async () => {
    if (!canVolunteerParticipate) {
      setInlineMessage(campaignActionMessage, "Only volunteers can join campaigns.");
      return;
    }

    const { error } = await joinCampaign(campaignId);
    if (error) {
      setInlineMessage(campaignActionMessage, error.message || "Unable to join campaign.");
      return;
    }

    setInlineMessage(campaignActionMessage, "You joined this campaign.", "success");
    await loadCampaign();
  });

  leaveCampaignBtn.addEventListener("click", async () => {
    if (!canVolunteerParticipate) {
      setInlineMessage(campaignActionMessage, "Only volunteers can leave campaigns.");
      return;
    }

    const { error } = await leaveCampaign(campaignId);
    if (error) {
      setInlineMessage(campaignActionMessage, error.message || "Unable to leave campaign.");
      return;
    }

    setInlineMessage(campaignActionMessage, "You left this campaign.", "success");
    await loadCampaign();
  });

  toggleCampaignStatusBtn.addEventListener("click", async () => {
    if (!campaignData) {
      return;
    }

    const nextStatus = campaignData.status === "done" ? "published" : "done";
    const { error } = await setCampaignStatus(campaignId, nextStatus);
    if (error) {
      setInlineMessage(campaignActionMessage, error.message || "Unable to update campaign status.");
      return;
    }

    setInlineMessage(campaignActionMessage, "Campaign status updated.", "success");
    await loadCampaign();
  });

  deleteCampaignBtn.addEventListener("click", async () => {
    const shouldDelete = window.confirm("Delete this campaign?");
    if (!shouldDelete) {
      return;
    }

    const { error } = await deleteCampaign(campaignId);
    if (error) {
      setInlineMessage(campaignActionMessage, error.message || "Unable to delete campaign.");
      return;
    }

    window.location.href = "/dashboard";
  });

  assignVolunteerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const volunteerId = assignVolunteerSelect.value;
    if (!volunteerId) {
      setInlineMessage(campaignActionMessage, "Select a volunteer first.");
      return;
    }

    const { error } = await assignVolunteerToCampaign(campaignId, volunteerId);
    if (error) {
      setInlineMessage(campaignActionMessage, error.message || "Unable to assign volunteer.");
      return;
    }

    setInlineMessage(campaignActionMessage, "Volunteer assigned.", "success");
    await loadCampaign();
  });

  const loaded = await loadCampaign();
  if (!loaded) {
    campaignMissing.hidden = false;
  }

  mountNode.append(renderFooter());
}
