// ==========================================================================
// NOI — Home dashboard (Faza 3: + meetings & countdown)
// ==========================================================================

import { requireAuth, signOut } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import { getMeAndPartner } from "./profiles.js";
import { MOODS, moodMeta, setMood, getLatestMoods, subscribeMoods } from "./mood.js";
import { setFoodStatus, getLatestFoodStatus, subscribeFoodStatus } from "./food.js";
import {
  getNextMeeting,
  createMeeting,
  subscribeMeetings,
  formatMeetingDate,
  countdownParts,
  formatCountdown,
} from "./meetings.js";
import { drawChallenge, getLatestChallenge, subscribeChallenges } from "./challenges.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) {
  // requireAuth deja a redirecționat spre login.html
  throw new Error("no session");
}

// Declarate aici, sus, ca să existe deja când loadNextMeeting() e apelat
// mai jos (în timpul încărcării inițiale a paginii) — dacă rămân declarate
// mai jos, în secțiunea "Meetings", apelul de mai jos le accesează înainte
// ca `let` să fi fost inițializat, ceea ce arunca ReferenceError și oprea
// tot restul scriptului (inclusiv legarea butoanelor de click).
let countdownTimer = null;
let currentMeeting = null;

const els = {
  setupNotice: document.getElementById("setup-notice"),
  dashboard: document.getElementById("dashboard"),
  greeting: document.getElementById("greeting"),
  myMoodEmoji: document.getElementById("my-mood-emoji"),
  myMoodLabel: document.getElementById("my-mood-label"),
  partnerName: document.getElementById("partner-name"),
  partnerMoodEmoji: document.getElementById("partner-mood-emoji"),
  partnerMoodLabel: document.getElementById("partner-mood-label"),
  moodPicker: document.getElementById("mood-picker"),
  moodOptions: document.getElementById("mood-options"),
  changeMoodBtn: document.getElementById("change-mood-btn"),
  closeMoodPicker: document.getElementById("close-mood-picker"),
  myFoodStatus: document.getElementById("my-food-status"),
  partnerFoodStatus: document.getElementById("partner-food-status"),
  partnerFoodName: document.getElementById("partner-food-name"),
  ateBtn: document.getElementById("ate-btn"),
  notYetBtn: document.getElementById("not-yet-btn"),
  foodTextInput: document.getElementById("food-text-input"),
  logoutBtn: document.getElementById("logout-btn"),
  errorNotice: document.getElementById("error-notice"),
  // Meetings (Faza 3)
  meetingEmpty: document.getElementById("meeting-empty"),
  meetingContent: document.getElementById("meeting-content"),
  meetingTitle: document.getElementById("meeting-title"),
  meetingDatetime: document.getElementById("meeting-datetime"),
  meetingLocation: document.getElementById("meeting-location"),
  meetingNotes: document.getElementById("meeting-notes"),
  meetingCountdown: document.getElementById("meeting-countdown"),
  newMeetingBtn: document.getElementById("new-meeting-btn"),
  newMeetingBtnEmpty: document.getElementById("new-meeting-btn-empty"),
  meetingFormOverlay: document.getElementById("meeting-form-overlay"),
  closeMeetingForm: document.getElementById("close-meeting-form"),
  meetingForm: document.getElementById("meeting-form"),
  meetingFormError: document.getElementById("meeting-form-error"),
  meetingFormSubmit: document.getElementById("meeting-form-submit"),
  meetingTitleInput: document.getElementById("meeting-title-input"),
  meetingDateInput: document.getElementById("meeting-date-input"),
  meetingTimeInput: document.getElementById("meeting-time-input"),
  meetingLocationInput: document.getElementById("meeting-location-input"),
  meetingNotesInput: document.getElementById("meeting-notes-input"),
  // Provocare (Faza 6)
  challengeEmpty: document.getElementById("challenge-empty"),
  challengeContent: document.getElementById("challenge-content"),
  challengeText: document.getElementById("challenge-text"),
  challengeDrawnBy: document.getElementById("challenge-drawn-by"),
  drawChallengeBtn: document.getElementById("draw-challenge-btn"),
};

function showError(message) {
  els.errorNotice.textContent = message;
  els.errorNotice.hidden = false;
  setTimeout(() => { els.errorNotice.hidden = true; }, 4000);
}

// ---------- Încarcă profiluri ----------
const { me, partner } = await getMeAndPartner(user.id);

if (!me) {
  // Contul e autentificat în Supabase Auth, dar nu are încă rând în
  // tabela profiles (vezi pasul din SQL / instrucțiunile din chat).
  els.setupNotice.hidden = false;
  els.dashboard.hidden = true;
} else {
  els.setupNotice.hidden = true;
  els.dashboard.hidden = false;
  els.greeting.textContent = `Salut, ${me.display_name}`;
  els.partnerName.textContent = partner ? partner.display_name : "—";
  els.partnerFoodName.textContent = partner ? partner.display_name : "—";

  await loadMoods();
  await loadFoodStatus();
  await loadNextMeeting();
  await loadChallenge();

  subscribeMoods((row) => {
    if (row.user_id === user.id) renderMyMood(row.mood);
    else if (partner && row.user_id === partner.id) renderPartnerMood(row.mood);
  });

  subscribeFoodStatus((row) => {
    if (row.user_id === user.id) renderMyFood(row.ate, row.food_text);
    else if (partner && row.user_id === partner.id) renderPartnerFood(row.ate, row.food_text);
  });

  // O întâlnire nouă poate fi creată de oricare dintre cei doi — reîncarci
  // "următoarea întâlnire" ori de câte ori se inserează un rând nou,
  // ca să prinzi și cazul în care partenerul a setat una mai apropiată.
  subscribeMeetings(() => { loadNextMeeting(); });

  subscribeChallenges(() => { loadChallenge(); });
}

// ---------- Mood ----------
function renderMyMood(moodId) {
  const meta = moodMeta(moodId);
  els.myMoodEmoji.textContent = meta ? meta.emoji : "❔";
  els.myMoodLabel.textContent = meta ? meta.label : "Nesetat";
}

function renderPartnerMood(moodId) {
  const meta = moodMeta(moodId);
  els.partnerMoodEmoji.textContent = meta ? meta.emoji : "❔";
  els.partnerMoodLabel.textContent = meta ? meta.label : "Nesetat";
}

async function loadMoods() {
  const latest = await getLatestMoods();
  renderMyMood(latest[user.id]?.mood);
  if (partner) renderPartnerMood(latest[partner.id]?.mood);
}

function buildMoodOptions() {
  els.moodOptions.innerHTML = "";
  for (const m of MOODS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mood-option";
    btn.innerHTML = `<span class="mood-option-emoji">${m.emoji}</span><span>${m.label}</span>`;
    btn.addEventListener("click", async () => {
      if (!navigator.onLine) {
        showError("Ești offline — mood-ul nu poate fi salvat acum.");
        return;
      }
      const { error } = await setMood(user.id, m.id);
      if (error) {
        showError("Nu am putut salva mood-ul. Încearcă din nou.");
        return;
      }
      renderMyMood(m.id);
      els.moodPicker.hidden = true;
    });
    els.moodOptions.appendChild(btn);
  }
}
buildMoodOptions();

els.changeMoodBtn.addEventListener("click", () => { els.moodPicker.hidden = false; });
els.closeMoodPicker.addEventListener("click", () => { els.moodPicker.hidden = true; });

// ---------- Food status ----------
function renderMyFood(ate, foodText) {
  if (ate === undefined || ate === null) {
    els.myFoodStatus.textContent = "Nesetat";
    return;
  }
  els.myFoodStatus.textContent = ate
    ? `✅ Am mâncat${foodText ? ` — "${foodText}"` : ""}`
    : "❌ Nu încă";
}

function renderPartnerFood(ate, foodText) {
  if (ate === undefined || ate === null) {
    els.partnerFoodStatus.textContent = "Nesetat";
    return;
  }
  els.partnerFoodStatus.textContent = ate
    ? `✅ A mâncat${foodText ? ` — "${foodText}"` : ""}`
    : "❌ Nu încă";
}

async function loadFoodStatus() {
  const latest = await getLatestFoodStatus();
  const mine = latest[user.id];
  renderMyFood(mine?.ate, mine?.food_text);
  if (partner) {
    const theirs = latest[partner.id];
    renderPartnerFood(theirs?.ate, theirs?.food_text);
  }
}

async function saveFoodStatus(ate) {
  if (!navigator.onLine) {
    showError("Ești offline — statusul nu poate fi salvat acum.");
    return;
  }
  const text = els.foodTextInput.value.trim();
  const { error } = await setFoodStatus(user.id, ate, text || null);
  if (error) {
    showError("Nu am putut salva statusul. Încearcă din nou.");
    return;
  }
  renderMyFood(ate, text || null);
  els.foodTextInput.value = "";
}

els.foodTextInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveFoodStatus(true);
  }
});

els.ateBtn.addEventListener("click", () => saveFoodStatus(true));
els.notYetBtn.addEventListener("click", () => saveFoodStatus(false));

// ---------- Meetings (Faza 3) ----------
function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function tickCountdown() {
  if (!currentMeeting) return;
  const parts = countdownParts(currentMeeting.meeting_at);
  if (parts.expired) {
    // Data a trecut între timp — reîncarcă (va arăta starea "goală"
    // dacă nu mai există nicio întâlnire viitoare).
    stopCountdown();
    loadNextMeeting();
    return;
  }
  els.meetingCountdown.textContent = formatCountdown(parts);
}

function renderMeeting(meeting) {
  stopCountdown();
  currentMeeting = meeting;

  if (!meeting) {
    els.meetingEmpty.hidden = false;
    els.meetingContent.hidden = true;
    return;
  }

  els.meetingEmpty.hidden = true;
  els.meetingContent.hidden = false;

  els.meetingTitle.textContent = meeting.title;
  const { dateLabel, timeLabel } = formatMeetingDate(meeting.meeting_at);
  els.meetingDatetime.textContent = `${dateLabel} · ${timeLabel}`;
  els.meetingLocation.textContent = meeting.location ? `📍 ${meeting.location}` : "";
  els.meetingLocation.hidden = !meeting.location;
  els.meetingNotes.textContent = meeting.notes || "";
  els.meetingNotes.hidden = !meeting.notes;

  tickCountdown();
  countdownTimer = setInterval(tickCountdown, 1000);
}

async function loadNextMeeting() {
  const meeting = await getNextMeeting();
  renderMeeting(meeting);
}

function openMeetingForm() {
  els.meetingForm.reset();
  els.meetingFormError.hidden = true;
  els.meetingFormOverlay.hidden = false;
}

function closeMeetingForm() {
  els.meetingFormOverlay.hidden = true;
}

els.newMeetingBtn.addEventListener("click", openMeetingForm);
els.newMeetingBtnEmpty.addEventListener("click", openMeetingForm);
els.closeMeetingForm.addEventListener("click", closeMeetingForm);

els.meetingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.meetingFormError.hidden = true;

  if (!navigator.onLine) {
    els.meetingFormError.textContent = "Ești offline — întâlnirea nu poate fi salvată acum.";
    els.meetingFormError.hidden = false;
    return;
  }

  const title = els.meetingTitleInput.value.trim();
  const dateValue = els.meetingDateInput.value; // "2026-08-17"
  const timeValue = els.meetingTimeInput.value; // "18:00"
  const location = els.meetingLocationInput.value.trim();
  const notes = els.meetingNotesInput.value.trim();

  if (!title || !dateValue || !timeValue) {
    els.meetingFormError.textContent = "Completează titlul, data și ora.";
    els.meetingFormError.hidden = false;
    return;
  }

  // Interpretăm data/ora ca fiind în fusul orar local al telefonului —
  // new Date(...) cu format local face exact asta, apoi trimitem ISO (UTC)
  // către Supabase, care stochează totul ca timestamptz.
  const localDate = new Date(`${dateValue}T${timeValue}:00`);
  if (Number.isNaN(localDate.getTime())) {
    els.meetingFormError.textContent = "Data sau ora nu sunt valide.";
    els.meetingFormError.hidden = false;
    return;
  }
  if (localDate.getTime() <= Date.now()) {
    els.meetingFormError.textContent = "Alege o dată din viitor.";
    els.meetingFormError.hidden = false;
    return;
  }

  els.meetingFormSubmit.disabled = true;
  const { error } = await createMeeting({
    userId: user.id,
    title,
    meetingAt: localDate.toISOString(),
    location,
    notes,
  });
  els.meetingFormSubmit.disabled = false;

  if (error) {
    els.meetingFormError.textContent = "Nu am putut salva întâlnirea. Încearcă din nou.";
    els.meetingFormError.hidden = false;
    return;
  }

  closeMeetingForm();
  await loadNextMeeting();
});

// ---------- Provocare (Faza 6) ----------
function renderChallenge(challenge) {
  if (!challenge) {
    els.challengeEmpty.hidden = false;
    els.challengeContent.hidden = true;
    return;
  }

  els.challengeEmpty.hidden = true;
  els.challengeContent.hidden = false;
  els.challengeText.textContent = challenge.challenge_text;

  let byName = "—";
  if (challenge.drawn_by === user.id) byName = me?.display_name || "tine";
  else if (partner && challenge.drawn_by === partner.id) byName = partner.display_name;
  els.challengeDrawnBy.textContent = `Trasă de ${byName}`;
}

async function loadChallenge() {
  const challenge = await getLatestChallenge();
  renderChallenge(challenge);
}

els.drawChallengeBtn.addEventListener("click", async () => {
  if (!navigator.onLine) {
    showError("Ești offline — provocarea nu poate fi trasă acum.");
    return;
  }
  els.drawChallengeBtn.disabled = true;

  const current = await getLatestChallenge();
  const { error } = await drawChallenge(user.id, current?.challenge_text);

  els.drawChallengeBtn.disabled = false;

  if (error) {
    showError("Nu am putut trage o provocare nouă. Încearcă din nou.");
    return;
  }
  await loadChallenge();
});

// ---------- Logout ----------
els.logoutBtn.addEventListener("click", async () => {
  await signOut();
  window.location.href = "login.html";
});
