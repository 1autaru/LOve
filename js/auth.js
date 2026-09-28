// ==========================================================================
// NOI — Autentificare (Supabase Auth)
// ==========================================================================

import { supabase } from "./config.js";

/**
 * Autentifică utilizatorul cu email + parolă.
 * Returnează { data, error } — vezi Supabase docs pentru forma exactă.
 */
export async function signIn(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

/** Delogare completă (șterge sesiunea locală). */
export async function signOut() {
  return await supabase.auth.signOut();
}

/** Returnează sesiunea curentă (sau null dacă nu e nimeni logat). */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Eroare la citirea sesiunii:", error.message);
    return null;
  }
  return data.session;
}

/**
 * Protejează o pagină: dacă nu există sesiune, redirecționează spre login.
 * Apelează asta la începutul fiecărei pagini private (app.html etc).
 * Returnează user-ul curent dacă există sesiune.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

/**
 * Ascultă schimbări de autentificare (login/logout în alt tab,
 * expirare sesiune etc). callback primește (event, session).
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}
