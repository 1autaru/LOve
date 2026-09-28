// ==========================================================================
// NOI — Pagina de statistici
// ==========================================================================

import { requireAuth } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import { getRelationshipStartDate, setRelationshipStartDate, daysSince, getCounts } from "./stats.js";
import { formatMeetingDate } from "./meetings.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) throw new Error("no session");

const els = {
  errorNotice: document.getElementById("error-notice"),
  daysDisplay: document.getElementById("days-display"),
  daysCount: document.getElementById("days-count"),
  daysSinceDate: document.getElementById("days-since-date"),
  daysEmpty: document.getElementById("days-empty"),
  editStartDateBtn: document.getElementById("edit-start-date-btn"),
  setStartDateBtn: document.getElementById("set-start-date-btn"),
  startDateFormOverlay: document.getElementById("start-date-form-overlay"),
  closeStartDateForm: document.getElementById("close-start-date-form"),
  startDateForm: document.getElementById("start-date-form"),
  startDateFormError: document.getElementById("start-date-form-error"),
  startDateFormSubmit: document.getElementById("start-date-form-submit"),
  startDateInput: document.getElementById("start-date-input"),
  statPhotos: document.getElementById("stat-photos"),
  statPoems: document.getElementById("stat-poems"),
  statMeetings: document.getElementById("stat-meetings"),
  statMoods: document.getElementById("stat-moods"),
};

function showError(message) {
  els.errorNotice.textContent = message;
  els.errorNotice.hidden = false;
  setTimeout(() => { els.errorNotice.hidden = true; }, 4000);
}

async function loadDaysTogether() {
  const startDate = await getRelationshipStartDate();
  if (!startDate) {
    els.daysDisplay.hidden = true;
    els.daysEmpty.hidden = false;
    return;
  }
  els.daysEmpty.hidden = true;
  els.daysDisplay.hidden = false;
  els.daysCount.textContent = `${daysSince(startDate)} zile`;
  const { dateLabel } = formatMeetingDate(`${startDate}T00:00:00`);
  els.daysSinceDate.textContent = `Din ${dateLabel}`;
}

async function loadCounts() {
  const counts = await getCounts();
  els.statPhotos.textContent = counts.photos;
  els.statPoems.textContent = counts.poems;
  els.statMeetings.textContent = counts.meetings;
  els.statMoods.textContent = counts.moods;
}

await Promise.all([loadDaysTogether(), loadCounts()]);

function openStartDateForm() {
  els.startDateForm.reset();
  els.startDateFormError.hidden = true;
  els.startDateFormOverlay.hidden = false;
}

function closeStartDateForm() {
  els.startDateFormOverlay.hidden = true;
}

els.setStartDateBtn.addEventListener("click", openStartDateForm);
els.editStartDateBtn.addEventListener("click", openStartDateForm);
els.closeStartDateForm.addEventListener("click", closeStartDateForm);

els.startDateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.startDateFormError.hidden = true;

  if (!navigator.onLine) {
    els.startDateFormError.textContent = "Ești offline — data nu poate fi salvată acum.";
    els.startDateFormError.hidden = false;
    return;
  }

  const dateValue = els.startDateInput.value;
  if (!dateValue) return;

  const chosenDate = new Date(`${dateValue}T00:00:00`);
  if (chosenDate.getTime() > Date.now()) {
    els.startDateFormError.textContent = "Data nu poate fi în viitor.";
    els.startDateFormError.hidden = false;
    return;
  }

  els.startDateFormSubmit.disabled = true;
  let error = null;
  try {
    ({ error } = await setRelationshipStartDate(user.id, dateValue));
  } catch (err) {
    console.error("Eroare neașteptată la salvarea datei:", err);
    error = { message: err?.message || "unknown" };
  } finally {
    els.startDateFormSubmit.disabled = false;
  }

  if (error) {
    els.startDateFormError.textContent = "Nu am putut salva data. Încearcă din nou.";
    els.startDateFormError.hidden = false;
    return;
  }

  closeStartDateForm();
  await loadDaysTogether();
});
