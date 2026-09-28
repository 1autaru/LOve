// ==========================================================================
// NOI — Albums
// ==========================================================================

import { supabase } from "./config.js";

export async function getAlbums() {
  const { data, error } = await supabase
    .from("albums")
    .select("id, name, created_by, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Eroare la citirea albumelor:", error.message);
    return [];
  }
  return data;
}

export async function createAlbum(userId, name) {
  return await supabase.from("albums").insert({ name, created_by: userId }).select().single();
}
