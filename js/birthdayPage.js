import { requireAuth, onAuthStateChange } from './auth.js';
import { initOfflineBanner } from './offline.js';
import {
  getBirthdayStatus, unlockBirthday, lockBirthday, getBirthdayMedia,
  mediaURL, uploadBirthdayMedia, deleteBirthdayMedia, validateAudio,
} from './birthday.js';

initOfflineBanner();
const user = await requireAuth();
if (!user) throw new Error('no session');
const el = id => document.getElementById(`birthday-${id}`);
let status = null;
let signature = '';
let generation = 0;
let refreshing = false;
const previews = new Map();
function notice(message, error = false) {
  el('notice').textContent = message;
  el('notice').className = error ? 'notice notice-error' : 'notice notice-info';
  el('notice').hidden = !message;
}
function clearContent() {
  generation++;
  el('content').hidden = true;
  document.querySelectorAll('audio').forEach(audio => {
    audio.pause(); audio.removeAttribute('src'); audio.load();
  });
  el('audio-list').replaceChildren(); el('photo-list').replaceChildren();
  for (const url of previews.values()) URL.revokeObjectURL(url);
  previews.clear();
  for (const kind of ['audio', 'photo']) {
    el(`${kind}-form`).reset();
    el(`${kind}-preview`).removeAttribute('src');
    el(`${kind}-preview`).hidden = true;
  }
  signature = '';
}
async function renderMedia(force = false) {
  const currentGeneration = generation;
  const media = await getBirthdayMedia();
  const nextSignature = JSON.stringify(media);
  if ((!force && signature === nextSignature) || currentGeneration !== generation || !status?.can_access) return;
  const audioFragment = document.createDocumentFragment();
  const photoFragment = document.createDocumentFragment();
  for (const item of media) {
    const card = document.createElement('article'); card.className = 'birthday-media';
    const caption = document.createElement('p'); caption.textContent = item.caption || (item.kind === 'audio' ? 'Cântecul nostru' : 'O amintire împreună');
    card.append(caption);
    if (item.kind === 'audio') {
      const audio = document.createElement('audio'); audio.controls = true; audio.preload = 'none';
      const play = document.createElement('button'); play.className = 'btn btn-ghost btn-small';
      play.textContent = 'Încarcă / reîncarcă playerul';
      play.addEventListener('click', async () => {
        play.disabled = true;
        try { audio.src = await mediaURL(item.storage_path); audio.load(); }
        catch (error) { notice(error.message, true); }
        finally { play.disabled = false; }
      });
      audio.addEventListener('error', () => notice('Apasă „Încarcă / reîncarcă playerul”. Dacă eroarea persistă, încearcă un fișier MP3.', true));
      card.append(play, audio); audioFragment.append(card);
    } else {
      const img = document.createElement('img'); img.alt = item.caption || 'Fotografie de la aniversare';
      img.loading = 'lazy';
      try { img.src = await mediaURL(item.storage_path); }
      catch { img.alt = 'Fotografia nu a putut fi încărcată. Reîncarcă pagina.'; }
      card.prepend(img); photoFragment.append(card);
    }
    if (item.user_id === user.id) {
      const remove = document.createElement('button'); remove.className = 'btn btn-ghost btn-small'; remove.textContent = 'Șterge';
      remove.addEventListener('click', async () => {
        if (!confirm('Ștergi definitiv acest fișier?')) return;
        remove.disabled = true;
        try { await deleteBirthdayMedia(item); await renderMedia(true); }
        catch (error) { notice(error.message, true); }
        finally { remove.disabled = false; }
      });
      card.append(remove);
    }
  }
  if (currentGeneration !== generation || !status?.can_access) return;
  el('audio-list').querySelectorAll('audio').forEach(audio => audio.pause());
  el('audio-list').replaceChildren(audioFragment);
  el('photo-list').replaceChildren(photoFragment);
  el('audio-empty').hidden = media.some(item => item.kind === 'audio');
  signature = nextSignature;
}
async function refresh() {
  if (refreshing || !navigator.onLine) return;
  refreshing = true;
  try {
    status = await getBirthdayStatus();
    if (!status) {
      clearContent(); el('locked').hidden = true;
      notice('Acest cont nu are acces la spațiul vostru.', true); return;
    }
    el('date').textContent = 'Se deschide pe ' + new Intl.DateTimeFormat('ro-RO', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Bucharest',
    }).format(new Date(status.unlock_at)) + ' (ora României).';
    el('locked').hidden = status.can_access;
    el('password-form').hidden = !status.is_owner || status.released;
    el('wait').textContent = status.is_owner
      ? 'Poți pregăti cântecul aici. Introdu parola pentru acces timp de o oră.'
      : 'Până atunci, păstrăm puțin mister.';
    el('content').hidden = !status.can_access;
    el('audio-form').hidden = !status.can_access || !status.is_owner;
    el('photo-form').hidden = !status.can_access || !status.released;
    el('photo-note').textContent = status.released
      ? 'Adăugați fotografiile voastre din această zi. Fiecare poate șterge propriile fișiere.'
      : 'Veți putea adăuga fotografii începând din ziua aniversării.';
    el('lock').hidden = !status.can_access || status.released;
    const nav = document.querySelector('a[href="birthday.html"]');
    nav.firstChild.textContent = status.released ? '🎵' : '🔒';
    if (status.can_access) await renderMedia(); else clearContent();
    if (el('notice').textContent === 'Se verifică accesul…') notice('');
  } catch (error) {
    status = null; clearContent(); notice(error.message, true);
  } finally { refreshing = false; }
}
el('password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  let password = el('password').value; el('password').value = '';
  try { await unlockBirthday(password); password = ''; notice(''); await refresh(); }
  catch (error) { notice(error.message, true); }
  finally { password = ''; button.disabled = false; }
});
el('lock').addEventListener('click', async () => {
  try { await lockBirthday(); clearContent(); await refresh(); }
  catch (error) { notice(error.message, true); }
});
for (const kind of ['audio', 'photo']) {
  el(kind).addEventListener('change', () => {
    if (previews.has(kind)) URL.revokeObjectURL(previews.get(kind));
    previews.delete(kind); el(`${kind}-preview`).hidden = true;
    el(`${kind}-preview`).removeAttribute('src');
    const file = el(kind).files[0]; if (!file) return;
    try {
      if (kind === 'audio') validateAudio(file);
      else if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20*1024*1024)
        throw new Error('Alege o fotografie JPEG, PNG sau WebP de cel mult 20 MB.');
      const url = URL.createObjectURL(file); previews.set(kind, url);
      el(`${kind}-preview`).src = url; el(`${kind}-preview`).hidden = false;
    } catch (error) { el(kind).value = ''; notice(error.message, true); }
  });
  el(`${kind}-form`).addEventListener('submit', async event => {
    event.preventDefault();
    const file = el(kind).files[0]; if (!file) return;
    const button = event.currentTarget.querySelector('button'); const label = button.textContent;
    button.disabled = true; button.textContent = 'Se încarcă…';
    try {
      await uploadBirthdayMedia(user.id, kind === 'photo' ? 'photos' : 'audio', file, el(`${kind}-caption`).value);
      notice('Fișierul a fost salvat.'); el(`${kind}-form`).reset();
      if (kind === 'audio') el('audio-preview').pause();
      el(`${kind}-preview`).removeAttribute('src'); el(`${kind}-preview`).hidden = true;
      if (previews.has(kind)) URL.revokeObjectURL(previews.get(kind)); previews.delete(kind);
      await renderMedia(true);
    } catch (error) { notice(error.message, true); }
    finally { button.disabled = false; button.textContent = label; }
  });
}
onAuthStateChange((_event, session) => {
  if (!session || session.user.id !== user.id) {
    status = null; clearContent(); window.location.replace('login.html');
  }
});
window.addEventListener('online', refresh);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 30000);
await refresh();
