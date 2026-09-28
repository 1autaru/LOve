// ==========================================================================
// NOI — Photos (Amintiri)
// ==========================================================================

import { supabase } from "./config.js";
import { uploadPhotoFile, deletePhotoFile, getSignedUrl, compressImage } from "./storage.js";

/**
 * Comprimă, încarcă în Storage, și salvează rândul în tabela photos.
 * Dacă insert-ul în DB eșuează, șterge fișierul orfan din Storage.
 */
export async function addPhoto({ userId, file, description, photoDate, albumId }) {
  let compressed;
  try {
    compressed = await compressImage(file);
  } catch (err) {
    return { error: { message: "Format de imagine invalid." } };
  }

  const { path, error: uploadError } = await uploadPhotoFile(userId, compressed);
  if (uploadError) return { error: uploadError };

  const { data, error } = await supabase
    .from("photos")
    .insert({
      user_id: userId,
      storage_path: path,
      description: description || null,
      photo_date: photoDate || null,
      album_id: albumId || null,
    })
    .select()
    .single();

  if (error) {
    await deletePhotoFile(path);
    return { error };
  }
  return { data, error: null };
}

/** Citește o pagină de poze (opțional filtrate pe album), cu URL semnat pentru fiecare. */
export async function getPhotos({ albumId = null, limit = 12, offset = 0 } = {}) {
  let query = supabase
    .from("photos")
    .select("id, user_id, storage_path, description, photo_date, album_id, created_at")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (albumId) query = query.eq("album_id", albumId);

  const { data, error } = await query;
  if (error) {
    console.error("Eroare la citirea fotografiilor:", error.message);
    return [];
  }

  return await Promise.all(
    data.map(async (photo) => ({ ...photo, url: await getSignedUrl(photo.storage_path) }))
  );
}

export async function removePhoto(photoId, storagePath) {
  const { error: dbError } = await supabase.from("photos").delete().eq("id", photoId);
  if (dbError) return { error: dbError };
  await deletePhotoFile(storagePath);
  return { error: null };
}
