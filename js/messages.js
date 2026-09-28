// ==========================================================================
// NOI — Mesaje (chat simplu, Faza 5)
// ==========================================================================

import { supabase } from "./config.js";

export async function sendMessage(senderId, receiverId, content) {
  return await supabase
    .from("messages")
    .insert({ sender_id: senderId, receiver_id: receiverId, content })
    .select()
    .single();
}

/** Ultimele `limit` mesaje din conversație, în ordine cronologică. */
export async function getMessages(limit = 100) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, receiver_id, content, created_at, read_at")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Eroare la citirea mesajelor:", error.message);
    return [];
  }
  return data;
}

/** Marchează ca citite toate mesajele primite de userId, încă necitite. */
export async function markMessagesRead(userId) {
  return await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("receiver_id", userId)
    .is("read_at", null);
}

/**
 * Ascultă mesaje noi (INSERT) și schimbări de status citit (UPDATE).
 * callback(row, isUpdate) — isUpdate=true pentru evenimentele de UPDATE.
 */
export function subscribeMessages(callback) {
  return supabase
    .channel("messages-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => callback(payload.new, false)
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages" },
      (payload) => callback(payload.new, true)
    )
    .subscribe();
}
