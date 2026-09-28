// ==========================================================================
// NOI — Statistici (Faza 6)
// ==========================================================================

import { supabase } from "./config.js";

export async function getRelationshipStartDate() {
  const { data, error } = await supabase
    .from("relationship_info")
    .select("start_date")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("Eroare la citirea datei:", error.message);
    return null;
  }
  return data?.start_date || null;
}

export async function setRelationshipStartDate(userId, startDate) {
  return await supabase
    .from("relationship_info")
    .upsert({ id: true, start_date: startDate, updated_by: userId, updated_at: new Date().toISOString() });
}

/** Numărul de zile întregi trecute de la data dată (YYYY-MM-DD) până acum. */
export function daysSince(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const diffMs = Date.now() - start.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

/** Numără rândurile din câteva tabele deja existente, în paralel. */
export async function getCounts() {
  const [photos, poems, meetings, moods] = await Promise.all([
    supabase.from("photos").select("id", { count: "exact", head: true }),
    supabase.from("poems").select("id", { count: "exact", head: true }),
    supabase.from("meetings").select("id", { count: "exact", head: true }),
    supabase.from("moods").select("id", { count: "exact", head: true }),
  ]);

  return {
    photos: photos.count ?? 0,
    poems: poems.count ?? 0,
    meetings: meetings.count ?? 0,
    moods: moods.count ?? 0,
  };
}
