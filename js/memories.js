// ==========================================================================
// NOI — Amintiri (Faza 4: photos, albums, Storage)
// ==========================================================================

import { requireAuth } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import { getPhotos, addPhoto, removePhoto } from "./photos.js";
import { getAlbums, createAlbum } from "./albums.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) throw new Error("no session");

const PAGE_SIZE = 12;

const els = {
  errorNotice: document.getElementById("error-notice"),
  albumChips: document.getElementById("album-chips"),
  newAlbumBtn: document.getElementById("new-album-btn"),
  newAlbumForm: document.getElementById("new-album-form"),
  newAlbumInput: document.getElementById("new-album-input"),
  newAlbumSave: document.getElementById("new-album-save"),
  newAlbumCancel: document.getElementById("new-album-cancel"),

  fileInput: document.getElementById("photo-file-input"),
  previewImg: document.getElementById("photo-preview"),
  descriptionInput: document.getElementById("photo-description"),
  dateInput: document.getElementById("photo-date"),
  uploadBtn: document.getElementById("upload-btn"),
  uploadForm: document.getElementById("upload-form"),

  gallery: document.getElementById("gallery"),
  loadMoreBtn: document.getElementById("load-more-btn"),
  emptyState: document.getElementById("empty-state"),
};

function showError(message) {
  els.errorNotice.textContent = message;
  els.errorNotice.hidden = false;
  setTimeout(() => { els.errorNotice.hidden = true; }, 4000);
}

// ---------- Albume ----------
let albums = [];
let currentAlbumId = null; // null = "Toate"

async function loadAlbumChips() {
  albums = await getAlbums();
  els.albumChips.innerHTML = "";

  const allChip = makeChip("Toate", null);
  els.albumChips.appendChild(allChip);

  for (const album of albums) {
    els.albumChips.appendChild(makeChip(album.name, album.id));
  }
}

function makeChip(label, albumId) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "chip" + (albumId === currentAlbumId ? " chip-active" : "");
  chip.textContent = label;
  chip.addEventListener("click", () => {
    currentAlbumId = albumId;
    [...els.albumChips.children].forEach((c) => c.classList.remove("chip-active"));
    chip.classList.add("chip-active");
    resetAndLoadGallery();
  });
  return chip;
}

els.newAlbumBtn.addEventListener("click", () => {
  els.newAlbumForm.hidden = false;
  els.newAlbumInput.focus();
});

els.newAlbumCancel.addEventListener("click", () => {
  els.newAlbumForm.hidden = true;
  els.newAlbumInput.value = "";
});

els.newAlbumSave.addEventListener("click", async () => {
  const name = els.newAlbumInput.value.trim();
  if (!name) return;
  if (!navigator.onLine) {
    showError("Ești offline — albumul nu poate fi creat acum.");
    return;
  }
  const { error } = await createAlbum(user.id, name);
  if (error) {
    showError("Nu am putut crea albumul. Încearcă din nou.");
    return;
  }
  els.newAlbumInput.value = "";
  els.newAlbumForm.hidden = true;
  await loadAlbumChips();
});

// ---------- Upload ----------
let selectedFile = null;

els.fileInput.addEventListener("change", () => {
  const file = els.fileInput.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showError("Fișierul trebuie să fie o imagine.");
    els.fileInput.value = "";
    return;
  }
  selectedFile = file;
  els.previewImg.src = URL.createObjectURL(file);
  els.previewImg.hidden = false;
  els.uploadBtn.disabled = false;
});

els.uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedFile) return;

  if (!navigator.onLine) {
    showError("Ești offline — fotografia nu poate fi încărcată acum.");
    return;
  }

  els.uploadBtn.disabled = true;
  els.uploadBtn.textContent = "Se încarcă…";

  let error = null;
  try {
    ({ error } = await addPhoto({
      userId: user.id,
      file: selectedFile,
      description: els.descriptionInput.value.trim(),
      photoDate: els.dateInput.value || null,
      albumId: currentAlbumId,
    }));
  } catch (err) {
    // Orice eroare neprevăzută (nu doar un { error } întors normal) —
    // nu lăsăm butonul blocat pe "Se încarcă…".
    console.error("Eroare neașteptată la upload:", err);
    error = { message: err?.message || "unknown" };
  } finally {
    els.uploadBtn.disabled = false;
    els.uploadBtn.textContent = "Încarcă poza";
  }

  if (error) {
    showError(
      error.message?.includes("exceeded") || error.statusCode === "413"
        ? "Fișierul e prea mare."
        : "Upload eșuat. Verifică conexiunea și încearcă din nou."
    );
    return;
  }

  els.uploadForm.reset();
  els.previewImg.hidden = true;
  selectedFile = null;
  els.uploadBtn.disabled = true;

  resetAndLoadGallery();
});

// ---------- Galerie ----------
let offset = 0;
let reachedEnd = false;

function resetAndLoadGallery() {
  offset = 0;
  reachedEnd = false;
  els.gallery.innerHTML = "";
  loadMoreGallery();
}

async function loadMoreGallery() {
  els.loadMoreBtn.disabled = true;
  els.loadMoreBtn.textContent = "Se încarcă…";

  const photos = await getPhotos({ albumId: currentAlbumId, limit: PAGE_SIZE, offset });

  for (const photo of photos) {
    els.gallery.appendChild(renderPhotoCard(photo));
  }

  offset += photos.length;
  reachedEnd = photos.length < PAGE_SIZE;

  els.loadMoreBtn.hidden = reachedEnd;
  els.loadMoreBtn.disabled = false;
  els.loadMoreBtn.textContent = "Încarcă mai multe";

  els.emptyState.hidden = offset > 0;
}

function renderPhotoCard(photo) {
  const card = document.createElement("figure");
  card.className = "photo-card";

  const img = document.createElement("img");
  img.src = photo.url || "";
  img.alt = photo.description || "Amintire";
  img.loading = "lazy";
  card.appendChild(img);

  if (photo.description || photo.photo_date) {
    const caption = document.createElement("figcaption");
    caption.className = "photo-caption";
    const parts = [];
    if (photo.photo_date) parts.push(new Date(photo.photo_date).toLocaleDateString("ro-RO"));
    if (photo.description) parts.push(photo.description);
    caption.textContent = parts.join(" — ");
    card.appendChild(caption);
  }

  if (photo.user_id === user.id) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "photo-delete-btn";
    deleteBtn.setAttribute("aria-label", "Șterge fotografia");
    deleteBtn.textContent = "✕";
    deleteBtn.addEventListener("click", async () => {
      if (!navigator.onLine) {
        showError("Ești offline — nu poți șterge acum.");
        return;
      }
      if (!confirm("Ștergi această fotografie?")) return;
      const { error } = await removePhoto(photo.id, photo.storage_path);
      if (error) {
        showError("Nu am putut șterge fotografia.");
        return;
      }
      card.remove();
    });
    card.appendChild(deleteBtn);
  }

  return card;
}

els.loadMoreBtn.addEventListener("click", loadMoreGallery);

// ---------- Init ----------
await loadAlbumChips();
await loadMoreGallery();
