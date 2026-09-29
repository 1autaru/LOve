// Independent de Supabase și CDN: pornește inclusiv fără conexiune.
(() => {
  const base = new URL('../', document.currentScript.src);
  const offlinePage = Boolean(document.getElementById('offline-page'));
  let installPrompt;
  const installButton = document.createElement('button');
  installButton.className = 'btn btn-ghost btn-small pwa-install';
  installButton.textContent = 'Instalează Noi';
  installButton.hidden = true;
  document.body.append(installButton);

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    await prompt.prompt();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    document.body.prepend(banner);
  }
  banner.setAttribute('role', 'status');
  function updateConnection() {
    banner.textContent = navigator.onLine
      ? 'Conexiunea a revenit. Poți reveni în aplicație.'
      : 'Ești offline — modificările nu pot fi salvate.';
    banner.classList.toggle('visible', !navigator.onLine || offlinePage);
  }
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  updateConnection();

  // Blochează acțiunile înainte să ajungă la handler-ele paginilor existente.
  function blockOffline(event) {
    if (navigator.onLine || offlinePage) return;
    const control = event.target.closest('button, input[type="file"]');
    if (event.type !== 'submit' && !control) return;
    if (control?.id.startsWith('close-')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    banner.textContent = 'Ești offline. Reconectează-te pentru a folosi această acțiune.';
  }
  document.addEventListener('click', blockOffline, true);
  document.addEventListener('submit', blockOffline, true);

  if (offlinePage) {
    document.getElementById('retry-connection').addEventListener('click', () => {
      location.href = new URL('index.html', base).href;
    });
    document.getElementById('local-theme').addEventListener('click', () => {
      const dark = document.documentElement.dataset.theme !== 'dark';
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.getElementById('local-theme').setAttribute('aria-pressed', String(dark));
    });
  }

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL('service-worker.js', base), {
      scope: base.pathname,
      updateViaCache: 'none',
    })
      .then(registration => registration.update())
      .catch(() => {
        const status = document.getElementById('pwa-status');
        if (status) status.textContent = 'Pregătirea modului offline a eșuat. Reîncearcă online.';
      });
  }
})();
