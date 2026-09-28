// ==========================================================================
// NOI — Storage helpers (compresie imagini + Supabase Storage)
// ==========================================================================

import { supabase } from "./config.js";

const BUCKET = "memories";
const MAX_DIMENSION = 1600; // px, pe latura mai lungă
const JPEG_QUALITY = 0.8;

/**
 * Generează un id unic pentru numele fișierului.
 * crypto.randomUUID() există doar în context "sigur" (HTTPS sau
 * localhost) — pe telefon, accesat prin http://<ip-tailscale>...,
 * nu e disponibil și ar arunca o eroare aici, blocând upload-ul
 * exact înainte de a apuca să contacteze Storage-ul. Fallback-ul de
 * mai jos nu e criptografic sigur, dar e suficient pentru un nume
 * de fișier unic.
 */
function generateFileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // cade pe fallback-ul de mai jos
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Redimensionează și comprimă o imagine în browser înainte de upload,
 * ca să economisim Storage (planul free are 1 GB).
 * Returnează un Blob JPEG.
 */
export async function compressImage(file) {
  const img = await loadImage(file);
  const { width, height } = fitDimensions(img.width, img.height, MAX_DIMENSION);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);

  URL.revokeObjectURL(img.src);

  return await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Format de imagine invalid."));
    img.src = URL.createObjectURL(file);
  });
}

function fitDimensions(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  if (w > h) return { width: max, height: Math.round((h / w) * max) };
  return { width: Math.round((w / h) * max), height: max };
}

/** Încarcă un Blob deja comprimat în Storage, sub folderul userului. */
export async function uploadPhotoFile(userId, blob) {
  const path = `${userId}/${generateFileId()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return { path: null, error };
  return { path, error: null };
}

/** Încarcă un Blob comprimat pentru un mesaj programat, sub aceeași
 * regulă RLS ca pozele normale (primul folder = user_id), doar că e
 * nested sub "scheduled/" — nu trebuie nicio politică RLS nouă. */
export async function uploadScheduledPhotoFile(userId, blob) {
  const path = `${userId}/scheduled/${generateFileId()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return { path: null, error };
  return { path, error: null };
}

/** Încarcă poza atașată unui loc de pe Memory Map — aceeași regulă RLS
 * ca restul (primul folder = user_id), doar nested sub "locations/". */
export async function uploadLocationPhotoFile(userId, blob) {
  const path = `${userId}/locations/${generateFileId()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) return { path: null, error };
  return { path, error: null };
}

export async function deletePhotoFile(path) {
  return await supabase.storage.from(BUCKET).remove([path]);
}

/** Bucket-ul e privat — generăm un URL semnat, temporar, pentru afișare. */
export async function getSignedUrl(path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) {
    console.error("Eroare la generarea URL-ului:", error.message);
    return null;
  }
  return data.signedUrl;
}
