// ==========================================================================
// NOI — Profiles (cele două conturi)
// ==========================================================================

import { supabase } from "./config.js";

/** Returnează toate profilurile (exact 2, dar nu presupunem un număr fix). */
export async function getAllProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url");

  if (error) {
    console.error("Eroare la citirea profilurilor:", error.message);
    return [];
  }
  return data;
}

/**
 * Returnează { me, partner } pornind de la id-ul utilizatorului curent.
 * "partner" e primul profil găsit care nu e al tău — funcționează
 * corect pentru cei exact doi utilizatori ai aplicației.
 */
export async function getMeAndPartner(currentUserId) {
  const profiles = await getAllProfiles();
  const me = profiles.find((p) => p.id === currentUserId) || null;
  const partner = profiles.find((p) => p.id !== currentUserId) || null;
  return { me, partner };
}
