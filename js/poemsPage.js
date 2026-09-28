// ==========================================================================
// NOI — Pagina de Poezii
// ==========================================================================

import { requireAuth } from "./auth.js";
import { initOfflineBanner } from "./offline.js";
import { getMeAndPartner } from "./profiles.js";
import { createPoem, getPoems, subscribePoems, MARIA_EMAIL } from "./poems.js";

initOfflineBanner();

const user = await requireAuth();
if (!user) throw new Error("no session");

const { me } = await getMeAndPartner(user.id);

// Verificarea reală de securitate e în RLS (poems_insert_only_maria);
// asta doar ascunde formularul din interfață pentru celălalt cont.
const canWrite = user.email === MARIA_EMAIL;

const els = {
  errorNotice: document.getElementById("error-notice"),
  newPoemCard: document.getElementById("new-poem-card"),
  poemForm: document.getElementById("poem-form"),
  poemFormSubmit: document.getElementById("poem-form-submit"),
  titleInput: document.getElementById("poem-title-input"),
  contentInput: document.getElementById("poem-content-input"),
  poemsList: document.getElementById("poems-list"),
  poemsEmpty: document.getElementById("poems-empty"),
};

function showError(message) {
  els.errorNotice.textContent = message;
  els.errorNotice.hidden = false;
  setTimeout(() => { els.errorNotice.hidden = true; }, 4000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

els.newPoemCard.hidden = !canWrite;

function renderPoemCard(poem) {
  const card = document.createElement("div");
  card.className = "card poem-card";
  const date = new Date(poem.created_at).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  card.innerHTML = `
    ${poem.title ? `<p class="poem-title">${escapeHtml(poem.title)}</p>` : ""}
    <p class="poem-content">${escapeHtml(poem.content)}</p>
    <p class="text-muted poem-meta" style="font-size: 0.75rem;">${date}</p>
  `;
  return card;
}

async function loadPoems() {
  const poems = await getPoems();
  els.poemsList.innerHTML = "";
  els.poemsEmpty.hidden = poems.length > 0;
  for (const poem of poems) {
    els.poemsList.appendChild(renderPoemCard(poem));
  }
}

await loadPoems();
subscribePoems(() => { loadPoems(); });

// Plasă de siguranță, la fel ca la chat — dacă Realtime nu e activat
// pentru tabela "poems", verificăm oricum periodic.
setInterval(loadPoems, 8000);

if (canWrite) {
  els.poemForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!navigator.onLine) {
      showError("Ești offline — poezia nu poate fi salvată acum.");
      return;
    }

    const title = els.titleInput.value.trim();
    const content = els.contentInput.value.trim();
    if (!content) return;

    els.poemFormSubmit.disabled = true;
    els.poemFormSubmit.textContent = "Se salvează…";

    let error = null;
    try {
      ({ error } = await createPoem({ userId: user.id, title, content }));
    } catch (err) {
      console.error("Eroare neașteptată la salvarea poeziei:", err);
      error = { message: err?.message || "unknown" };
    } finally {
      els.poemFormSubmit.disabled = false;
      els.poemFormSubmit.textContent = "Publică";
    }

    if (error) {
      showError("Nu am putut salva poezia. Încearcă din nou.");
      return;
    }

    els.poemForm.reset();
    await loadPoems();
  });
}
