/**
 * app.js — Entry point: tab navigation, event wiring, mods, stats, decks & backgrounds
 */

window.AppState = null;

document.addEventListener('DOMContentLoaded', () => {
  let state = loadState();
  state = seedSampleCards(state);
  saveState(state);
  window.AppState = state;

  // ── Init modules ──
  Deck.init(state);
  Battle.init(state);

  // ── Tab / Menu navigation ──
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view, btn));
  });
  document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.dataset.view;
      const navBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);
      switchView(viewId, navBtn);
    });
  });

  // ── Flashcard interactions ──
  document.getElementById('reveal-btn').addEventListener('click', () => Battle.reveal());
  document.getElementById('flashcard').addEventListener('click', () => Battle.toggleCard());
  document.querySelectorAll('.rate-btn:not(.btn-hide)').forEach(btn => {
    btn.addEventListener('click', () => Battle.rate(Number(btn.dataset.rating)));
  });
  document.getElementById('hide-btn').addEventListener('click', () => Battle.hide());

  // ── Cinematic skip ──
  document.getElementById('cinematic-skip').addEventListener('click', () => Cinematic.close());

  // ── Repaso overlay ──
  document.getElementById('repaso-all').addEventListener('click', () => closeRepaso(false));
  document.getElementById('repaso-wrong').addEventListener('click', () => closeRepaso(true));
  document.getElementById('repaso-end').addEventListener('click', () => {
    document.getElementById('repaso').classList.add('hidden');
    const navBtn = document.querySelector('.nav-btn[data-view="inicio"]');
    switchView('inicio', navBtn);
  });

  // ── Repaso buttons in empty-msg (post-session combat view) ──
  document.querySelectorAll('#empty-repaso-btns .repaso-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const onlyWrong = btn.dataset.only === 'true';
      Battle.repasar(onlyWrong);
    });
  });

  // ── Deck creator ──
  document.getElementById('add-deck-btn').addEventListener('click', () => addDeck());

  // Deck filter dropdowns (one-time listener via delegation)
  document.getElementById('card-deck-select').addEventListener('change', onDeckFilterChange);
  document.getElementById('deck-filter-select').addEventListener('change', onDeckFilterChange);

  // ── Stats ──
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('¿Borrar TODO el progreso y las cartas?')) return;
    window.AppState = resetState();
    Deck.state = window.AppState;
    Battle.state = window.AppState;
    Deck.render();
    Battle.startSession();
    renderStats();
    showToast('Progreso borrado');
  });

  // ── Initial renders ──
  renderStats();
  renderDecks();
  renderDeckFilter();

  // Set initial page background for inicio from mod
  const inicioBg = ModManager.getPageBg('inicio');
  if (inicioBg) {
    const v = document.getElementById('page-bg-video');
    v.src = inicioBg.path;
    document.getElementById('page-bg').classList.remove('hidden');
    v.play().catch(() => {});
  }

  // Start menu music immediately (autoplay enabled via electron switch)
  document.getElementById('bgm-general').play().catch(() => {});
});

// ══════════════════════════════
// VIEW SWITCHING + PAGE BACKGROUND
// ══════════════════════════════
function switchView(viewId, btnEl) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${viewId}`).classList.add('active');
  if (btnEl) btnEl.classList.add('active');

  // Update page background from mod config
  const bgEl = document.getElementById('page-bg');
  const vidEl = document.getElementById('page-bg-video');
  const imgEl = document.getElementById('page-bg-image');
  const bg = ModManager.getPageBg(viewId);
  if (bg) {
    bgEl.classList.remove('hidden');
    if (bg.type === 'video') {
      imgEl.classList.add('hidden');
      vidEl.src = bg.path;
      vidEl.classList.remove('hidden');
      vidEl.currentTime = 0;
      vidEl.play().catch(() => {});
    } else {
      vidEl.classList.add('hidden');
      vidEl.pause();
      imgEl.src = bg.path;
      imgEl.classList.remove('hidden');
    }
  } else {
    bgEl.classList.add('hidden');
    vidEl.pause();
  }

  // ── Background music ──
  const bgmGeneral = document.getElementById('bgm-general');
  const bgmCombate = document.getElementById('bgm-combate');
  if (viewId === 'study') {
    bgmGeneral.pause();
    bgmGeneral.currentTime = 0;
    bgmCombate.play().catch(() => {});
  } else {
    bgmCombate.pause();
    bgmCombate.currentTime = 0;
    document.getElementById('combat-video').pause();
    bgmGeneral.play().catch(() => {});
  }

  if (viewId === 'study') Battle.startSession();
  if (viewId === 'stats') renderStats();
  if (viewId === 'mazos') renderDecks();
  if (viewId === 'deck') { renderDeckFilter(); Deck.render(); }
}

// ══════════════════════════════
// DECK CREATOR (view-mazos)
// ══════════════════════════════
function addDeck() {
  const nameInput = document.getElementById('new-deck-name');
  const name = nameInput.value.trim();
  if (!name) { showToast('Escribí un nombre para el mazo'); return; }
  const deck = makeDeck(name, '');
  window.AppState.decks.push(deck);
  saveState(window.AppState);
  nameInput.value = '';
  renderDecks();
  renderDeckFilter();
  showToast(`Mazo "${name}" creado`);
}

function deleteDeck(deckId) {
  if (deckId === 'default') { showToast('No podés borrar el mazo por defecto'); return; }
  if (!confirm('¿Borrar este mazo? Las cartas se moverán al mazo General')) return;
  // Move orphan cards to default deck
  const state = window.AppState;
  state.cards.forEach(c => { if (c.deckId === deckId) c.deckId = 'default'; });
  state.decks = state.decks.filter(d => d.id !== deckId);
  if (state.activeDeck === deckId) state.activeDeck = 'default';
  saveState(state);
  renderDecks();
  renderDeckFilter();
  Deck.render();
  showToast('Mazo borrado');
}

function selectDeck(deckId) {
  window.AppState.activeDeck = deckId;
  saveState(window.AppState);
  renderDecks();
  renderDeckFilter();
  Deck.render();
  showToast('Mazo seleccionado');
}

function renderDecks() {
  const container = document.getElementById('deck-list');
  const state = window.AppState;
  if (state.decks.length === 0) {
    container.innerHTML = '<p class="hint-text">No hay mazos todavía. Creá uno arriba.</p>';
    return;
  }
  container.innerHTML = state.decks.map(d => {
    const count = state.cards.filter(c => c.deckId === d.id).length;
    const active = d.id === state.activeDeck;
    return `
      <div class="deck-card ${active ? 'active' : ''}">
        <div class="deck-card-info">
          <h3>${escapeHtml(d.name)}</h3>
          <p>${count} cartas${d.description ? ' — ' + escapeHtml(d.description) : ''}</p>
        </div>
        <div class="deck-card-actions">
          <button class="deck-reset-btn" data-id="${d.id}">⚔️ Jugar</button>
          <button class="deck-select-btn" data-id="${d.id}">${active ? 'Activo' : 'Usar'}</button>
          <button class="deck-del-btn" data-id="${d.id}">Borrar</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.deck-select-btn').forEach(btn => {
    btn.addEventListener('click', () => selectDeck(btn.dataset.id));
  });
  container.querySelectorAll('.deck-del-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteDeck(btn.dataset.id));
  });
  container.querySelectorAll('.deck-reset-btn').forEach(btn => {
    btn.addEventListener('click', () => resetAndFight(btn.dataset.id));
  });
}

// ══════════════════════════════
// RESET DECK + GO TO COMBAT
// ══════════════════════════════
function resetAndFight(deckId) {
  const state = window.AppState;
  const deck = state.decks.find(d => d.id === deckId);
  if (!deck) return;
  const cards = state.cards.filter(c => c.deckId === deckId);
  if (cards.length === 0) {
    showToast('Este mazo no tiene cartas');
    return;
  }
  // Reset SRS for all cards in this deck
  cards.forEach(c => {
    c.interval = 1;
    c.ease = 2.5;
    c.reps = 0;
    c.nextReview = Date.now();
    c.lastRating = null;
  });
  state.activeDeck = deckId;
  saveState(state);
  // Switch to combat view with the deck
  const navBtn = document.querySelector('.nav-btn[data-view="study"]');
  switchView('study', navBtn);
  showToast(`Mazo "${deck.name}" reiniciado — a combatir`);
}

// ══════════════════════════════
// POST-BATTLE REPASO
// ══════════════════════════════
function showRepasoDialog() {
  const s = Battle.state.session;
  document.getElementById('repaso-score').textContent =
    `${s.correct} / ${s.total} correctas — ${s.total > 0 ? Math.round(s.correct / s.total * 100) : 0}%`;
  document.getElementById('repaso').classList.remove('hidden');
}

function closeRepaso(onlyWrong) {
  document.getElementById('repaso').classList.add('hidden');
  Battle.repasar(onlyWrong);
  const navBtn = document.querySelector('.nav-btn[data-view="study"]');
  switchView('study', navBtn);
}

function onDeckFilterChange(e) {
  const state = window.AppState;
  state.activeDeck = e.target.value;
  saveState(state);
  if (e.target.id === 'deck-filter-select') Deck.render();
  renderDecks();
}

function renderDeckFilter() {
  const state = window.AppState;
  ['card-deck-select', 'deck-filter-select'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = state.decks.map(d =>
      `<option value="${d.id}" ${d.id === state.activeDeck ? 'selected' : ''}>${escapeHtml(d.name)}</option>`
    ).join('');
  });
}

// ══════════════════════════════
// STATS VIEW
// ══════════════════════════════
function renderStats() {
  const s = window.AppState;
  document.getElementById('s-total').textContent = s.cards.length;
  document.getElementById('s-reviews').textContent = s.totalReviews;
  document.getElementById('s-acc').textContent =
    s.totalReviews > 0 ? Math.round((s.totalCorrect / s.totalReviews) * 100) + '%' : '—';
  document.getElementById('s-streak').textContent = s.bestStreak + ' 🔥';
  document.getElementById('s-mastered').textContent = s.cards.filter(c => c.reps >= 5).length;
  document.getElementById('s-wins').textContent = s.wins;
  document.getElementById('s-draws').textContent = s.draws;
  document.getElementById('s-losses').textContent = s.losses;
}

// ══════════════════════════════
// TOAST
// ══════════════════════════════
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
