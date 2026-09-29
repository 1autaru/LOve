import { supabase } from './config.js';
import { compressImage } from './storage.js';
const bucket='profile-media';
export async function loadSettings() {
  const [profiles,couple,date]=await Promise.all([
    supabase.from('profiles').select('id,display_name,avatar_path'),
    supabase.from('couple_settings').select('cover_path,updated_by').eq('id',true).maybeSingle(),
    supabase.from('relationship_info').select('start_date').eq('id',true).maybeSingle(),
  ]);
  if(profiles.error||couple.error||date.error) throw new Error('Setările nu au putut fi încărcate. Verifică internetul și configurarea Supabase.');
  return {profiles:profiles.data,couple:couple.data,date:date.data?.start_date||null};
}
export async function imageURL(path) {
  if(!path) return null;
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path,3600);
  if(error) throw new Error('Fotografia nu a putut fi încărcată.');
  return data.signedUrl;
}
export async function saveName(userId,name) {
  name=name.trim();
  if(!name||name.length>60) throw new Error('Numele trebuie să aibă între 1 și 60 de caractere.');
  const {data,error}=await supabase.from('profiles').update({display_name:name}).eq('id',userId).select('id').single();
  if(error||!data) throw new Error('Numele nu a putut fi salvat.');
}
export async function saveStartDate(userId,date) {
  const today=new Date(); const localToday=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>localToday||!Number.isFinite(Date.parse(date)))
    throw new Error('Alege o dată validă, care nu este în viitor.');
  const {error}=await supabase.from('relationship_info').upsert({id:true,start_date:date,updated_by:userId,updated_at:new Date().toISOString()});
  if(error) throw new Error('Data nu a putut fi salvată.');
}
export function calendarDays(date,now=new Date()) {
  if(!date) return null;
  const start=Date.parse(`${date}T00:00:00Z`);
  const today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  return Number.isFinite(start)?Math.max(0,Math.floor((today-start)/86400000)):null;
}
export async function saveImage(userId,kind,file,oldPath) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>20*1024*1024)
    throw new Error('Alege o imagine JPEG, PNG sau WebP de cel mult 20 MB.');
  const blob=await compressImage(file);
  if(!blob||blob.size>5*1024*1024) throw new Error('Imaginea nu a putut fi pregătită. Încearcă una mai mică.');
  const path=`${userId}/${kind}/${crypto.randomUUID()}.jpg`;
  const {error:uploadError}=await supabase.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});
  if(uploadError) throw new Error('Încărcarea imaginii a eșuat.');
  const result=kind==='avatars'
    ? await supabase.from('profiles').update({avatar_path:path}).eq('id',userId).select('id').single()
    : await supabase.from('couple_settings').upsert({id:true,cover_path:path,updated_by:userId,updated_at:new Date().toISOString()}).select('id').single();
  if(result.error||!result.data) {
    const {error:cleanup}=await supabase.storage.from(bucket).remove([path]);
    throw new Error(cleanup?'Salvarea a eșuat; fișierul rămas trebuie verificat în Storage.':'Salvarea imaginii a eșuat. Încearcă din nou.');
  }
  // Curățăm numai fotografia proprie înlocuită; nu ștergem poza partenerului.
  let warning='';
  if(oldPath?.startsWith(`${userId}/`)&&oldPath!==path) {
    const {error}=await supabase.storage.from(bucket).remove([oldPath]);
    if(error) warning=' Imaginea veche nu a putut fi eliminată din Storage.';
  }
  return warning;
}
