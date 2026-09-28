// ==========================================================================
// NOI — Configurare Supabase
//
// AICI pui datele proiectului tău Supabase (Faza 1, pasul 5 din instrucțiuni).
//
// IMPORTANT despre securitate:
// - SUPABASE_URL și SUPABASE_ANON_KEY sunt făcute să fie publice.
//   Anon key NU este un secret — este cheia "publică" folosită de orice
//   client (browser). Securitatea reală vine din Row Level Security (RLS),
//   pe care o configurăm în Faza 8.
// - NU pune niciodată aici "service_role key". Acea cheie are acces total
//   la baza de date și trebuie să rămână doar în Supabase Dashboard,
//   niciodată în cod, niciodată pe GitHub.
// ==========================================================================

export const SUPABASE_URL = "https://xypyjxidzjlmitdunzwr.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_CHFX5E9dcp5HwbyTngDRkw_-03d6r8q";

// Client Supabase, folosit de toate celelalte fișiere din js/.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
