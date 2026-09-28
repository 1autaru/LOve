// ==========================================================================
// NOI — Poezii
// ==========================================================================

import { supabase } from "./config.js";

export const MARIA_EMAIL = "mariaingridmircea@gmail.com";

export async function createPoem({ userId, title, content }) {
  return await supabase
    .from("poems")
    .insert({ created_by: userId, title: title || null, content });
}

/** Toate poeziile, cele mai noi primele. */
export async function getPoems() {
  const { data, error } = await supabase
    .from("poems")
    .select("id, created_by, title, content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Eroare la citirea poeziilor:", error.message);
    return [];
  }
  return data;
}

export async function deletePoem(id) {
  return await supabase.from("poems").delete().eq("id", id);
}

export function subscribePoems(callback) {
  return supabase
    .channel("poems-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "poems" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
