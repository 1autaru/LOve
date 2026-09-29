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
  const { data, error } = await supabase.rpc("list_scheduled_messages_secure");

  if (error) {
    console.error("Eroare la citirea mesajelor programate:", error.message);
    throw new Error("Mesajele nu au putut fi încărcate. Verifică internetul și încearcă din nou.");
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
  // Numai serverul decide; schimbarea ceasului telefonului nu deblochează nimic.
  return msg.unlocked === true;
}
