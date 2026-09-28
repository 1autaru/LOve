// ==========================================================================
// NOI — Memory Map
// ==========================================================================

import { requireAuth } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import { createLocation, getLocations, subscribeLocations } from "./memoryLocations.js";
import { formatMeetingDate } from "./meetings.js";
import { compressImage, uploadLocationPhotoFile, getSignedUrl } from "./storage.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) throw new Error("no session");

const els = {
  errorNotice: document.getElementById("error-notice"),
  addLocationFab: document.getElementById("add-location-fab"),

  locationFormOverlay: document.getElementById("location-form-overlay"),
  closeLocationForm: document.getElementById("close-location-form"),
  locationFormError: document.getElementById("location-form-error"),
  locationForm: document.getElementById("location-form"),
  locationFormSubmit: document.getElementById("location-form-submit"),
  locationNameInput: document.getElementById("location-name-input"),
  locationDateInput: document.getElementById("location-date-input"),
  locationDescriptionInput: document.getElementById("location-description-input"),
  locationPhotoInput: document.getElementById("location-photo-input"),
  locationPhotoPreview: document.getElementById("location-photo-preview"),
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

// ---------- Harta principală ----------
const DEFAULT_CENTER = [45.9432, 24.9668]; // centrul României
const DEFAULT_ZOOM = 6;

const map = L.map("map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

const markers = new Map(); // id -> L.Marker

async function buildPopupContent(loc) {
  const dateLine = loc.location_date
    ? `<p class="text-muted" style="font-size: 0.78rem; margin-top: 4px;">${formatMeetingDate(`${loc.location_date}T00:00:00`).dateLabel}</p>`
    : "";
  const descLine = loc.description
    ? `<p style="margin-top: 6px; font-size: 0.85rem;">${escapeHtml(loc.description)}</p>`
    : "";

  let photoHtml = "";
  if (loc.photo_path) {
    const url = await getSignedUrl(loc.photo_path);
    if (url) {
      photoHtml = `<img src="${url}" alt="" style="width: 100%; border-radius: 8px; margin-top: 8px; max-height: 140px; object-fit: cover;" />`;
    }
  }

  return `
    <div style="min-width: 180px;">
      <strong>${escapeHtml(loc.name)}</strong>
      ${dateLine}
      ${descLine}
      ${photoHtml}
    </div>
  `;
}

function addMarker(loc) {
  if (markers.has(loc.id)) return;
  const marker = L.marker([loc.latitude, loc.longitude]).addTo(map);
  marker.bindPopup("Se încarcă…");
  marker.on("popupopen", async () => {
    marker.setPopupContent(await buildPopupContent(loc));
  });
  markers.set(loc.id, marker);
}

async function loadLocations() {
  const locations = await getLocations();
  for (const loc of locations) addMarker(loc);

  if (locations.length > 0) {
    const bounds = L.latLngBounds(locations.map((l) => [l.latitude, l.longitude]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }
}

await loadLocations();
subscribeLocations((loc) => addMarker(loc));

// ---------- Formular loc nou (cu mini-hartă pentru poziție) ----------
let pickMap = null;
let pickMarker = null;
let selectedLatLng = null;
let selectedFile = null;

function ensurePickMap() {
  if (pickMap) {
    setTimeout(() => pickMap.invalidateSize(), 50);
    return;
  }
  pickMap = L.map("pick-map").setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  }).addTo(pickMap);

  pickMap.on("click", (event) => {
    selectedLatLng = event.latlng;
    if (pickMarker) {
      pickMarker.setLatLng(selectedLatLng);
    } else {
      pickMarker = L.marker(selectedLatLng).addTo(pickMap);
    }
    els.locationFormSubmit.disabled = false;
  });
}

els.locationPhotoInput.addEventListener("change", () => {
  const file = els.locationPhotoInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Fișierul trebuie să fie o imagine.");
    els.locationPhotoInput.value = "";
    return;
  }
  selectedFile = file;
  els.locationPhotoPreview.src = URL.createObjectURL(file);
  els.locationPhotoPreview.hidden = false;
});

function openLocationForm() {
  els.locationForm.reset();
  els.locationFormError.hidden = true;
  els.locationPhotoPreview.hidden = true;
  els.locationFormSubmit.disabled = true;
  selectedFile = null;
  selectedLatLng = null;
  if (pickMarker) {
    pickMap.removeLayer(pickMarker);
    pickMarker = null;
  }
  els.locationFormOverlay.hidden = false;
  ensurePickMap();
}

function closeLocationForm() {
  els.locationFormOverlay.hidden = true;
}

els.addLocationFab.addEventListener("click", openLocationForm);
els.closeLocationForm.addEventListener("click", closeLocationForm);

els.locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.locationFormError.hidden = true;

  if (!navigator.onLine) {
    els.locationFormError.textContent = "Ești offline — locul nu poate fi salvat acum.";
    els.locationFormError.hidden = false;
    return;
  }

  if (!selectedLatLng) {
    els.locationFormError.textContent = "Apasă pe hartă ca să alegi locul.";
    els.locationFormError.hidden = false;
    return;
  }

  const name = els.locationNameInput.value.trim();
  if (!name) return;

  els.locationFormSubmit.disabled = true;
  els.locationFormSubmit.textContent = "Se salvează…";

  let error = null;
  try {
    let photoPath = null;
    if (selectedFile) {
      const compressed = await compressImage(selectedFile);
      const uploadResult = await uploadLocationPhotoFile(user.id, compressed);
      if (uploadResult.error) throw new Error("Poza nu a putut fi încărcată.");
      photoPath = uploadResult.path;
    }

    ({ error } = await createLocation({
      userId: user.id,
      name,
      latitude: selectedLatLng.lat,
      longitude: selectedLatLng.lng,
      locationDate: els.locationDateInput.value || null,
      description: els.locationDescriptionInput.value.trim(),
      photoPath,
    }));
  } catch (err) {
    console.error("Eroare neașteptată la salvarea locului:", err);
    error = { message: err?.message || "unknown" };
  } finally {
    els.locationFormSubmit.disabled = false;
    els.locationFormSubmit.textContent = "Salvează";
  }

  if (error) {
    els.locationFormError.textContent = "Nu am putut salva locul. Încearcă din nou.";
    els.locationFormError.hidden = false;
    return;
  }

  closeLocationForm();
  await loadLocations();
});
