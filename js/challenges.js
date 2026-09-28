// ==========================================================================
// NOI — Provocări random (Faza 6)
// ==========================================================================

import { supabase } from "./config.js";

export const CHALLENGES = [
  "Trimite-i celuilalt o poză cu ce vezi acum.",
  "Spuneți-vă fiecare 3 lucruri care vă plac unul la celălalt.",
  "Alegeți fiecare o melodie și trimiteți-o partenerului.",
  "Faceți o poză împreună la următoarea întâlnire.",
  "Scrieți-vă un mesaj ca și cum ar fi prima întâlnire.",
  "Gătiți ceva nou împreună săptămâna asta.",
  "Faceți o listă cu 5 locuri noi pe care vreți să le vizitați împreună.",
  "Trimiteți-vă un mesaj vocal în loc de text azi.",
  "Alegeți un film pe care niciunul nu l-a văzut și uitați-vă la el împreună.",
  "Spuneți-vă fiecare un motiv pentru care sunteți recunoscători unul pentru celălalt azi.",
  "Faceți un joc de genul „ghicește ce gândesc” la următoarea întâlnire.",
  "Trimiteți-vă o poză din copilărie.",
  "Planificați o mini-excursie de o zi, chiar dacă e doar prin oraș.",
  "Scrieți-i un bilet surprinzător pentru mâine.",
  "Încercați un restaurant nou data viitoare când vă vedeți.",
  "Faceți schimb de playlist-uri preferate.",
  "Spuneți-i un secret mic pe care nu i l-ați mai spus.",
  "Faceți o poză „atunci vs acum” cu o poză mai veche a voastră.",
  "Alegeți o activitate pe care n-ați mai făcut-o împreună și programați-o.",
  "Întrebați-l/o: „ce te face fericit(ă) chiar acum?”",
];

/** Alege o provocare aleatorie din listă (diferită de ultima, dacă se poate). */
export function pickRandomChallenge(excludeText) {
  const pool = CHALLENGES.filter((c) => c !== excludeText);
  const list = pool.length > 0 ? pool : CHALLENGES;
  return list[Math.floor(Math.random() * list.length)];
}

export async function drawChallenge(userId, excludeText) {
  const text = pickRandomChallenge(excludeText);
  return await supabase
    .from("challenge_draws")
    .insert({ challenge_text: text, drawn_by: userId })
    .select()
    .single();
}

/** Ultima provocare trasă (de oricare dintre voi), sau null dacă nu există încă. */
export async function getLatestChallenge() {
  const { data, error } = await supabase
    .from("challenge_draws")
    .select("id, challenge_text, drawn_by, drawn_at")
    .order("drawn_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Eroare la citirea provocării:", error.message);
    return null;
  }
  return data;
}

export function subscribeChallenges(callback) {
  return supabase
    .channel("challenges-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "challenge_draws" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
