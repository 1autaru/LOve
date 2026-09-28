// ==========================================================================
// NOI — Food status ("Am mâncat?")
// ==========================================================================

import { supabase } from "./config.js";

/** Salvează un status nou de mâncare pentru utilizatorul curent. */
export async function setFoodStatus(userId, ate, foodText = null) {
  return await supabase
    .from("food_status")
    .insert({ user_id: userId, ate, food_text: foodText || null });
}

/**
 * Returnează cel mai recent status de mâncare al fiecărui utilizator:
 * { [user_id]: { ate, food_text, created_at } }
 */
export async function getLatestFoodStatus() {
  const { data, error } = await supabase
    .from("food_status")
    .select("user_id, ate, food_text, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Eroare la citirea statusului de mâncare:", error.message);
    return {};
  }

  const latest = {};
  for (const row of data) {
    if (!(row.user_id in latest)) latest[row.user_id] = row;
  }
  return latest;
}

/** Ascultă status-uri noi de mâncare în timp real. */
export function subscribeFoodStatus(callback) {
  return supabase
    .channel("food-status-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "food_status" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
