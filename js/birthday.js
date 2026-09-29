import { supabase } from './config.js';
import { compressImage } from './storage.js';

export const AUDIO_TYPES = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4',
  wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
  aac: 'audio/aac', webm: 'audio/webm',
};
export function validateAudio(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!AUDIO_TYPES[extension]) throw new Error('Alege un fișier MP3, M4A, WAV, OGG, FLAC, AAC sau WebM.');
  if (!file.size || file.size > 25 * 1024 * 1024) throw new Error('Fișierul audio trebuie să aibă cel mult 25 MB și să nu fie gol.');
  return { extension, contentType: AUDIO_TYPES[extension] };
}
export async function getBirthdayStatus() {
  const { data, error } = await supabase.rpc('birthday_status');
  if (error) throw new Error('Nu am putut verifica accesul. Verifică internetul și configurarea aniversării.');
  return data;
}
export async function unlockBirthday(password) {
  const { data, error } = await supabase.rpc('unlock_birthday', { password_input: password });
  if (error) throw new Error('Nu am putut verifica parola. Încearcă din nou.');
  if (!data?.ok) {
    const reasons = {
      rate_limit: 'Prea multe încercări. Așteaptă 15 minute.',
      session: 'Intră din nou în cont pentru a continua.',
      forbidden: 'Acest cont nu poate deschide surpriza înainte de aniversare.',
    };
    throw new Error(reasons[data?.reason] || 'Parola nu este corectă.');
  }
}
export async function lockBirthday() {
  const { error } = await supabase.rpc('lock_birthday');
  if (error) throw new Error('Nu am putut închide accesul. Încearcă din nou.');
}
export async function getBirthdayMedia() {
  const { data, error } = await supabase.from('birthday_media')
    .select('id,user_id,kind,storage_path,caption,created_at')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Nu am putut încărca fișierele aniversării.');
  return data;
}
export async function mediaURL(path) {
  const { data, error } = await supabase.storage.from('birthday').createSignedUrl(path, 600);
  if (error) throw new Error('Fișierul nu este disponibil. Reîncarcă pagina pentru a verifica accesul.');
  return data.signedUrl;
}
export async function uploadBirthdayMedia(userId, kind, file, caption) {
  if (!navigator.onLine) throw new Error('Ai nevoie de internet pentru încărcare.');
  let body = file;
  let extension;
  let contentType;
  if (kind === 'audio') ({ extension, contentType } = validateAudio(file));
  else {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
      throw new Error('Alege o fotografie JPEG, PNG sau WebP.');
    if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Fotografia trebuie să aibă cel mult 20 MB.');
    body = await compressImage(file);
    if (!body) throw new Error('Fotografia nu a putut fi comprimată.');
    extension = 'jpg'; contentType = 'image/jpeg';
  }
  const path = `${userId}/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from('birthday')
    .upload(path, body, { contentType, upsert: false, cacheControl: '0' });
  if (uploadError) throw new Error('Încărcarea a eșuat. Verifică accesul și dimensiunea fișierului.');
  const { error } = await supabase.from('birthday_media')
    .insert({ user_id: userId, kind, storage_path: path, caption: caption.trim().slice(0, 300) });
  if (error) {
    const { error: cleanupError } = await supabase.storage.from('birthday').remove([path]);
    throw new Error(cleanupError
      ? 'Salvarea a eșuat și fișierul încărcat nu a putut fi curățat. Verifică Storage în Supabase.'
      : 'Fișierul nu a putut fi salvat. Încearcă din nou.');
  }
}
export async function deleteBirthdayMedia(media) {
  const { error: storageError } = await supabase.storage.from('birthday').remove([media.storage_path]);
  if (storageError) throw new Error('Fișierul nu a putut fi șters. Încearcă din nou.');
  const { error } = await supabase.from('birthday_media').delete().eq('id', media.id);
  if (error) throw new Error('Fișierul a fost șters, dar lista nu s-a actualizat. Reîncearcă ștergerea.');
}
