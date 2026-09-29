import { requireAuth,signOut } from './auth.js';
import { initOfflineBanner } from './offline.js';
import { loadSettings,imageURL,saveName,saveStartDate,saveImage } from './settings.js';
initOfflineBanner();
const $=id=>document.getElementById(id);
const appearance=window.NoiAppearance;
function show(message,error=false){$('settings-notice').textContent=message;$('settings-notice').className=error?'notice notice-error':'notice notice-info';$('settings-notice').hidden=!message;}
for(const key of ['style','theme']) {
  $(`appearance-${key}`).value=appearance.get()[key];
  $(`appearance-${key}`).addEventListener('change',event=>{
    const saved=appearance.set({[key]:event.target.value});
    show(saved?'Preferința a fost salvată pe acest dispozitiv.':'Aspectul s-a schimbat, dar browserul nu permite salvarea preferinței.');
  });
}
window.addEventListener('noi-appearance-change',()=>{
  for(const key of ['style','theme']) $(`appearance-${key}`).value=appearance.get()[key];
});
const user=await requireAuth();
if(!user) throw new Error('no session');
let current;
const previews=new Map();
async function refresh(){
  current=await loadSettings();
  const me=current.profiles.find(profile=>profile.id===user.id);
  if(!me) throw new Error('Acest cont nu are acces la setările voastre.');
  $('profile-name').value=me.display_name;
  $('relationship-date').value=current.date||'';
  for(const [id,path] of [['avatar-current',me.avatar_path],['cover-current',current.couple?.cover_path]]) {
    const img=$(id);img.hidden=true;img.removeAttribute('src');
    if(path){try {img.src=await imageURL(path);img.hidden=false;}catch(error){show(error.message,true);}}
  }
  $('remote-settings').hidden=false;
}
async function submit(event,action){
  event.preventDefault();
  if(!navigator.onLine){show('Ai nevoie de internet pentru salvare.',true);return;}
  const button=event.currentTarget.querySelector('button[type=submit]');button.disabled=true;
  try {const warning=await action();show(`Modificările au fost salvate.${warning||''}`);await refresh();}
  catch(error){show(error.message,true);}finally{button.disabled=false;}
}
$('name-form').addEventListener('submit',event=>submit(event,()=>saveName(user.id,$('profile-name').value)));
$('date-form').addEventListener('submit',event=>submit(event,()=>saveStartDate(user.id,$('relationship-date').value)));
for(const [kind,prefix] of [['avatars','avatar'],['covers','cover']]) {
  $(`${prefix}-file`).addEventListener('change',()=>{
    if(previews.has(prefix)) URL.revokeObjectURL(previews.get(prefix));
    previews.delete(prefix);$(`${prefix}-preview`).hidden=true;
    const file=$(`${prefix}-file`).files[0];if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024){
      $(`${prefix}-file`).value='';show('Alege o imagine JPEG, PNG sau WebP de cel mult 20 MB.',true);return;
    }
    const url=URL.createObjectURL(file);previews.set(prefix,url);$(`${prefix}-preview`).src=url;$(`${prefix}-preview`).hidden=false;
  });
  $(`${prefix}-form`).addEventListener('submit',event=>submit(event,async()=>{
    const file=$(`${prefix}-file`).files[0];if(!file)throw new Error('Selectează mai întâi o fotografie.');
    const oldPath=kind==='avatars'?current.profiles.find(p=>p.id===user.id)?.avatar_path:current.couple?.cover_path;
    const warning=await saveImage(user.id,kind,file,oldPath);
    $(`${prefix}-form`).reset();$(`${prefix}-preview`).hidden=true;$(`${prefix}-preview`).removeAttribute('src');
    if(previews.has(prefix))URL.revokeObjectURL(previews.get(prefix));previews.delete(prefix);
    return warning;
  }));
}
$('settings-logout').addEventListener('click',async()=>{
  $('settings-logout').disabled=true;
  try {const {error}=await signOut();if(error)throw error;location.replace('login.html');}
  catch{show('Nu am putut închide sesiunea. Verifică internetul și reîncearcă.',true);$('settings-logout').disabled=false;}
});
try{await refresh();}catch(error){show(error.message,true);}
