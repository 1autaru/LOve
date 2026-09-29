import { loadSettings,imageURL,calendarDays } from './settings.js';
import { requireAuth } from './auth.js';
const user=await requireAuth();
if(user){
  const card=document.getElementById('couple-hero');
  async function refresh(){
    if(!navigator.onLine)return;
    try{
      const data=await loadSettings();
      if(!data.profiles.some(p=>p.id===user.id)){card.hidden=true;return;}
      const people=document.getElementById('couple-people');people.replaceChildren();
      for(const profile of data.profiles){
        const person=document.createElement('span');person.className='couple-person';
        if(profile.avatar_path){try{const img=document.createElement('img');img.src=await imageURL(profile.avatar_path);img.alt='';person.append(img);}catch{}}
        const name=document.createElement('span');name.textContent=profile.display_name;person.append(name);people.append(person);
      }
      const cover=document.getElementById('couple-cover');cover.hidden=true;
      if(data.couple?.cover_path){try{cover.src=await imageURL(data.couple.cover_path);cover.hidden=false;}catch{}}
      const days=calendarDays(data.date);
      document.getElementById('couple-days').textContent=days===null?'Adăugați data voastră în Setări.':`Împreună de ${days} ${days===1?'zi':'zile'}`;
      card.hidden=false;
    }catch{card.hidden=true;}
  }
  await refresh();
  setInterval(()=>{if(!document.hidden)refresh();},60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
