// Rulează înainte de afișare, fără Supabase. Preferințele sunt locale dispozitivului.
(() => {
  const key = 'noi-appearance-v1';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preferences = { style: 'elegant', theme: 'light' };
  try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch {}
  function apply() {
    if (!['elegant','playful'].includes(preferences.style)) preferences.style='elegant';
    if (!['light','dark','system'].includes(preferences.theme)) preferences.theme='light';
    document.documentElement.dataset.look=preferences.style;
    document.documentElement.dataset.theme=preferences.theme==='system'
      ? (system.matches?'dark':'light') : preferences.theme;
    window.dispatchEvent(new CustomEvent('noi-appearance-change', { detail: { ...preferences } }));
  }
  window.NoiAppearance = {
    get: () => ({ ...preferences }),
    set: changes => {
      preferences={...preferences,...changes}; apply();
      try { localStorage.setItem(key,JSON.stringify(preferences)); return true; } catch { return false; }
    },
  };
  system.addEventListener('change',apply);
  window.addEventListener('storage',event=>{
    if(event.key!==key) return;
    try { preferences=JSON.parse(event.newValue)||{style:'elegant',theme:'light'}; apply(); } catch {}
  });
  apply();
})();
