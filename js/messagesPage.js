// ==========================================================================
// NOI — Mesaje programate / "Deschide-mă când..."
// ==========================================================================

import { requireAuth } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import {
  createScheduledMessage,
  getScheduledMessages,
  subscribeScheduledMessages,
  isUnlocked,
} from "./scheduledMessages.js";
import { formatMeetingDate } from "./meetings.js";
import { compressImage, uploadScheduledPhotoFile, getSignedUrl } from "./storage.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) throw new Error("no session");

const els = {
  errorNotice: document.getElementById("error-notice"),

  newScheduledBtn: document.getElementById("new-scheduled-btn"),
  scheduledEmpty: document.getElementById("scheduled-empty"),
  scheduledList: document.getElementById("scheduled-list"),
  scheduledFormOverlay: document.getElementById("scheduled-form-overlay"),
  closeScheduledForm: document.getElementById("close-scheduled-form"),
  scheduledForm: document.getElementById("scheduled-form"),
  scheduledFormError: document.getElementById("scheduled-form-error"),
  scheduledFormSubmit: document.getElementById("scheduled-form-submit"),
  scheduledTitleInput: document.getElementById("scheduled-title-input"),
  scheduledContentInput: document.getElementById("scheduled-content-input"),
  scheduledDateInput: document.getElementById("scheduled-date-input"),
  scheduledTimeInput: document.getElementById("scheduled-time-input"),
  scheduledPhotoInput: document.getElementById("scheduled-photo-input"),
  scheduledPhotoPreview: document.getElementById("scheduled-photo-preview"),

  openMessageOverlay: document.getElementById("open-message-overlay"),
  openMessageTitle: document.getElementById("open-message-title"),
  openMessagePhoto: document.getElementById("open-message-photo"),
  openMessageContent: document.getElementById("open-message-content"),
  closeOpenMessage: document.getElementById("close-open-message"),
};

function showError(message) {
  els.errorNotice.textContent = message;
  els.errorNotice.hidden = false;
  setTimeout(() => { els.errorNotice.hidden = true; }, 4000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Mesaje programate ----------
let scheduledSelectedFile = null;

els.scheduledPhotoInput.addEventListener("change", () => {
  const file = els.scheduledPhotoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Fișierul trebuie să fie o imagine.");
    els.scheduledPhotoInput.value = "";
    return;
  }
  scheduledSelectedFile = file;
  els.scheduledPhotoPreview.src = URL.createObjectURL(file);
  els.scheduledPhotoPreview.hidden = false;
});

function renderScheduledCard(msg) {
  const unlocked = isUnlocked(msg);
  const card = document.createElement("button");
  card.type = "button";
  card.className = "card scheduled-card" + (unlocked ? " scheduled-unlocked" : " scheduled-locked");

  if (unlocked) {
    card.innerHTML = `
      <p class="eyebrow">💌 ${escapeHtml(msg.title)}</p>
      <p class="text-muted" style="margin-top: 6px;">Apasă ca să deschizi</p>
    `;
    card.addEventListener("click", () => openScheduledMessage(msg));
  } else {
    const { dateLabel, timeLabel } = formatMeetingDate(msg.unlock_at);
    card.disabled = true;
    card.innerHTML = `
      <p class="eyebrow">🔒 ${escapeHtml(msg.title)}</p>
      <p class="text-muted" style="margin-top: 6px;">Se deschide pe ${dateLabel} · ${timeLabel}</p>
    `;
  }
  return card;
}

async function openScheduledMessage(msg) {
  els.openMessageTitle.textContent = msg.title;
  els.openMessageContent.textContent = msg.content;

  if (msg.photo_path) {
    const url = await getSignedUrl(msg.photo_path);
    if (url) {
      els.openMessagePhoto.src = url;
      els.openMessagePhoto.hidden = false;
    } else {
      els.openMessagePhoto.hidden = true;
    }
  } else {
    els.openMessagePhoto.hidden = true;
  }

  els.openMessageOverlay.hidden = false;
}

els.closeOpenMessage.addEventListener("click", () => {
  els.openMessageOverlay.hidden = true;
});

async function loadScheduled() {
  if (!navigator.onLine) return;
  let scheduled;
  try { scheduled = await getScheduledMessages(); }
  catch (error) { showError(error.message); return; }
  els.scheduledList.innerHTML = "";
  els.scheduledEmpty.hidden = scheduled.length > 0;
  for (const msg of scheduled) {
    els.scheduledList.appendChild(renderScheduledCard(msg));
  }
}

await loadScheduled();
subscribeScheduledMessages(() => { loadScheduled(); });

// La fiecare 30s, reîncarcă lista — ca un card blocat să devină
// apăsabil automat imediat ce trece ora, fără refresh manual.
setInterval(loadScheduled, 30000);

function openScheduledForm() {
  els.scheduledForm.reset();
  els.scheduledFormError.hidden = true;
  els.scheduledPhotoPreview.hidden = true;
  scheduledSelectedFile = null;
  els.scheduledFormOverlay.hidden = false;
}

function closeScheduledForm() {
  els.scheduledFormOverlay.hidden = true;
}

els.newScheduledBtn.addEventListener("click", openScheduledForm);
els.closeScheduledForm.addEventListener("click", closeScheduledForm);

els.scheduledForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.scheduledFormError.hidden = true;

  if (!navigator.onLine) {
    els.scheduledFormError.textContent = "Ești offline — mesajul nu poate fi salvat acum.";
    els.scheduledFormError.hidden = false;
    return;
  }

  const title = els.scheduledTitleInput.value.trim();
  const content = els.scheduledContentInput.value.trim();
  const dateValue = els.scheduledDateInput.value;
  const timeValue = els.scheduledTimeInput.value;

  if (!title || !content || !dateValue || !timeValue) {
    els.scheduledFormError.textContent = "Completează titlul, mesajul, data și ora.";
    els.scheduledFormError.hidden = false;
    return;
  }

  const localDate = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(localDate.getTime())) {
    els.scheduledFormError.textContent = "Data sau ora nu sunt valide.";
    els.scheduledFormError.hidden = false;
    return;
  }
  if (localDate.getTime() <= Date.now()) {
    els.scheduledFormError.textContent = "Alege o dată din viitor.";
    els.scheduledFormError.hidden = false;
    return;
  }

  els.scheduledFormSubmit.disabled = true;
  els.scheduledFormSubmit.textContent = "Se salvează…";

  let error = null;
  try {
    let photoPath = null;
    if (scheduledSelectedFile) {
      const compressed = await compressImage(scheduledSelectedFile);
      const uploadResult = await uploadScheduledPhotoFile(user.id, compressed);
      if (uploadResult.error) throw new Error("Poza nu a putut fi încărcată.");
      photoPath = uploadResult.path;
    }

    ({ error } = await createScheduledMessage({
      userId: user.id,
      title,
      content,
      unlockAt: localDate.toISOString(),
      photoPath,
    }));
  } catch (err) {
    console.error("Eroare neașteptată la salvarea mesajului programat:", err);
    error = { message: err?.message || "unknown" };
  } finally {
    els.scheduledFormSubmit.disabled = false;
    els.scheduledFormSubmit.textContent = "Salvează";
  }

  if (error) {
    els.scheduledFormError.textContent = "Nu am putut salva mesajul. Încearcă din nou.";
    els.scheduledFormError.hidden = false;
    return;
  }

  closeScheduledForm();
  await loadScheduled();
});
