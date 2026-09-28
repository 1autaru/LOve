// ==========================================================================
// NOI — Mesaje programate / "Deschide-mă când..." (Faza 5)
// ==========================================================================

import { supabase } from "./config.js";

export async function createScheduledMessage({ userId, title, content, unlockAt, photoPath }) {
  return await supabase
    .from("scheduled_messages")
    .insert({ created_by: userId, title, content, unlock_at: unlockAt, photo_path: photoPath || null });
}

/** Toate mesajele programate (ale amândurora), sortate după data de deblocare. */
export async function getScheduledMessages() {
  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("id, created_by, title, content, unlock_at, photo_path, created_at")
    .order("unlock_at", { ascending: true });

  if (error) {
    console.error("Eroare la citirea mesajelor programate:", error.message);
    return [];
  }
  return data;
}

/** Ascultă mesaje programate noi în timp real. */
export function subscribeScheduledMessages(callback) {
  return supabase
    .channel("scheduled-messages-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "scheduled_messages" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

/** true dacă data de deblocare a trecut deja. */
export function isUnlocked(msg) {
  return new Date(msg.unlock_at).getTime() <= Date.now();
}
