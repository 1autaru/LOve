// ==========================================================================
// NOI — Mood system
// ==========================================================================

import { supabase } from "./config.js";

export const MOODS = [
  { id: "in_love", emoji: "🥰", label: "Îndrăgostit(ă)" },
  { id: "happy",   emoji: "😊", label: "Fericit(ă)" },
  { id: "ok",      emoji: "😐", label: "OK" },
  { id: "tired",   emoji: "😴", label: "Obosit(ă)" },
  { id: "sad",     emoji: "😔", label: "Trist(ă)" },
  { id: "angry",   emoji: "😡", label: "Nervos(oasă)" },
  { id: "sick",    emoji: "🤒", label: "Nu mă simt bine" },
  { id: "drained", emoji: "🫠", label: "Distrus(ă)" },
];

export function moodMeta(moodId) {
  return MOODS.find((m) => m.id === moodId) || null;
}

/** Salvează un mood nou pentru utilizatorul curent. */
export async function setMood(userId, moodId) {
  return await supabase.from("moods").insert({ user_id: userId, mood: moodId });
}

/**
 * Returnează cel mai recent mood al fiecărui utilizator:
 * { [user_id]: { mood, created_at } }
 */
export async function getLatestMoods() {
  const { data, error } = await supabase
    .from("moods")
    .select("user_id, mood, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Eroare la citirea mood-urilor:", error.message);
    return {};
  }

  const latest = {};
  for (const row of data) {
    if (!(row.user_id in latest)) latest[row.user_id] = row;
  }
  return latest;
}

/**
 * Ascultă mood-uri noi în timp real. callback(row) primește rândul nou
 * inserat de oricare dintre cei doi utilizatori.
 */
export function subscribeMoods(callback) {
  return supabase
    .channel("moods-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "moods" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
