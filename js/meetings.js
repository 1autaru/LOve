// ==========================================================================
// NOI — Meetings & countdown (Faza 3)
// ==========================================================================

import { supabase } from "./config.js";

/**
 * Returnează următoarea întâlnire viitoare (cea mai apropiată în timp),
 * sau null dacă nu există nicio întâlnire viitoare setată (fie nu s-a
 * setat niciodată una, fie ultima setată a trecut deja).
 */
export async function getNextMeeting() {
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, meeting_at, location, notes, created_by, created_at")
    .gt("meeting_at", new Date().toISOString())
    .order("meeting_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Eroare la citirea următoarei întâlniri:", error.message);
    return null;
  }
  return data;
}

/**
 * Creează o întâlnire nouă.
 * meetingAt trebuie să fie un ISO string (ex: din combinarea unui
 * input type="date" cu unul type="time").
 */
export async function createMeeting({ userId, title, meetingAt, location, notes }) {
  return await supabase.from("meetings").insert({
    created_by: userId,
    title,
    meeting_at: meetingAt,
    location: location || null,
    notes: notes || null,
  });
}

/** Ascultă întâlniri noi în timp real (când partenerul salvează una). */
export function subscribeMeetings(callback) {
  return supabase
    .channel("meetings-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "meetings" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}

/** Formatează un timestamp ISO în { dateLabel: "17 August 2026", timeLabel: "18:00" }. */
export function formatMeetingDate(isoString) {
  const d = new Date(isoString);
  const dateLabel = d.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
  return { dateLabel, timeLabel };
}

/**
 * Calculează timpul rămas până la o dată dată.
 * Returnează { expired: true } dacă data a trecut deja, altfel
 * { expired: false, days, hours, minutes }.
 */
export function countdownParts(isoString) {
  const diffMs = new Date(isoString).getTime() - Date.now();
  if (diffMs <= 0) return { expired: true };

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { expired: false, days, hours, minutes };
}

/** Formatează { days, hours, minutes } în "3 zile 04 ore 27 minute". */
export function formatCountdown({ days, hours, minutes }) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${days} zile ${pad(hours)} ore ${pad(minutes)} minute`;
}
