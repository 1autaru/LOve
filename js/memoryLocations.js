// ==========================================================================
// NOI — Memory Map: locuri importante
// ==========================================================================

import { supabase } from "./config.js";

export async function createLocation({ userId, name, latitude, longitude, locationDate, description, photoPath }) {
  return await supabase.from("memory_locations").insert({
    created_by: userId,
    name,
    latitude,
    longitude,
    location_date: locationDate || null,
    description: description || null,
    photo_path: photoPath || null,
  });
}

export async function getLocations() {
  const { data, error } = await supabase
    .from("memory_locations")
    .select("id, created_by, name, latitude, longitude, location_date, description, photo_path, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Eroare la citirea locurilor:", error.message);
    return [];
  }
  return data;
}

export async function deleteLocation(id) {
  return await supabase.from("memory_locations").delete().eq("id", id);
}

export function subscribeLocations(callback) {
  return supabase
    .channel("memory-locations-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "memory_locations" },
      (payload) => callback(payload.new)
    )
    .subscribe();
}
