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

  // ── Pantalla completa con doble clic sobre el video (sin botón) ──
  initFullscreenSync();
  initVideoDoubleTap();

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
    Battle.reset();
    Deck.render();
    renderDecks();
    renderDeckFilter();
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

  // Móvil/navegador: el audio queda bloqueado hasta el primer toque → lo activamos ahí
  document.addEventListener('pointerdown', () => {
    const study = document.getElementById('view-study').classList.contains('active');
    document.getElementById(study ? 'bgm-combate' : 'bgm-general').play().catch(() => {});
  }, { once: true });
});

// ══════════════════════════════
// VIEW SWITCHING + PAGE BACKGROUND
// ══════════════════════════════
function switchView(viewId, btnEl) {
  if (viewId !== 'study') exitFullscreen();
  // Combate = pantalla fija sin scroll (ver style.css → body.in-study)
  document.body.classList.toggle('in-study', viewId === 'study');
  window.scrollTo(0, 0);
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

  if (viewId === 'study') Battle.enter();
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
async function resetAndFight(deckId) {
  const state = window.AppState;
  const deck = state.decks.find(d => d.id === deckId);
  if (!deck) return;
  const cards = state.cards.filter(c => c.deckId === deckId);
  if (cards.length === 0) {
    showToast('Este mazo no tiene cartas');
    return;
  }
  const accepted = await confirmDialog({
    title: 'Reiniciar mazo',
    message: `Se borra el progreso de repasos de las ${cards.length} cartas de "${deck.name}" y empiezas desde cero.`,
  });
  if (!accepted) return;
  // Reset SRS for all cards in this deck
  cards.forEach(c => {
    c.interval = 1;
    c.ease = 2.5;
    c.reps = 0;
    c.nextReview = Date.now();
    c.lastRating = null;
  });
  state.activeDeck = deckId;
  state.session = { total: 0, correct: 0 };
  saveState(state);
  Battle.reset();                     // sesión nueva con las cartas ya reiniciadas
  // Switch to combat view with the deck
  const navBtn = document.querySelector('.nav-btn[data-view="study"]');
  switchView('study', navBtn);
  showToast(`Mazo "${deck.name}" reiniciado — a combatir`);
}

// ══════════════════════════════
// POST-BATTLE REPASO
// ══════════════════════════════
function showRepasoDialog(score) {
  const s = score || Battle.state.session;
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
  renderDeckFilter();   // mantiene sincronizados ambos selects
  Deck.render();        // y la lista de cartas
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
  document.getElementById('s-combats').textContent = s.wins + s.draws + s.losses;
  document.getElementById('s-reviews').textContent = s.totalReviews;
  document.getElementById('s-acc').textContent =
    s.totalReviews > 0 ? Math.round((s.totalCorrect / s.totalReviews) * 100) + '%' : '—';
  document.getElementById('s-streak').textContent = s.bestStreak + ' 🔥';
  document.getElementById('s-mastered').textContent = s.cards.filter(isMastered).length;
  document.getElementById('s-wins').textContent = s.wins;
  document.getElementById('s-draws').textContent = s.draws;
  document.getElementById('s-losses').textContent = s.losses;
}

// ══════════════════════════════
// CONFIRM DIALOG (reemplaza al confirm() nativo)
// Devuelve una Promise<boolean>: true = Aceptar, false = Cancelar / Esc / clic afuera
// ══════════════════════════════
function confirmDialog({ title = '¿Seguro?', message = '', okText = 'Aceptar', cancelText = 'Cancelar' } = {}) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    okBtn.textContent = okText;
    cancelBtn.textContent = cancelText;

    const close = (result) => {
      modal.classList.add('hidden');
      okBtn.onclick = cancelBtn.onclick = modal.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };

    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
    modal.onclick = (e) => { if (e.target === modal) close(false); };
    document.addEventListener('keydown', onKey);

    modal.classList.remove('hidden');
    cancelBtn.focus();                  // foco en Cancelar: la acción segura
  });
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

// ══════════════════════════════
// PANTALLA COMPLETA DEL VIDEO (modo horizontal)
// Se activa/desactiva con doble clic (o doble toque) sobre el cuadro del video.
// Pone TODA la página en pantalla completa (así la pregunta y los botones de
// respuesta siguen visibles encima del video) y oculta título + pestañas con la
// clase body.fs. Si el navegador no soporta la API (p. ej. iPhone), queda el modo
// "falso": solo se ocultan título y pestañas.
// ══════════════════════════════
function isRealFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// Si el usuario sale con Esc / gesto del sistema, se restaura la interfaz normal
function initFullscreenSync() {
  const onChange = () => { if (!isRealFullscreen()) exitFullscreen(); };
  document.addEventListener('fullscreenchange', onChange);
  document.addEventListener('webkitfullscreenchange', onChange);
}

// Doble clic / doble toque sobre el cuadro del video → pantalla completa.
// Se escucha en toda la página y se comprueba por posición
// si el clic cayó dentro del cuadro (así funciona aunque haya capas encima).
function initVideoDoubleTap() {
  const inVideoBox = (x, y) => {
    const box = document.getElementById('battle-arena');
    if (!box || !document.getElementById('view-study').classList.contains('active')) return false;
    const r = box.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // Ratón (PC)
  document.addEventListener('dblclick', e => {
    if (e.target.closest('button, #flashcard, #empty-msg')) return;
    if (!inVideoBox(e.clientX, e.clientY)) return;
    e.preventDefault();
    toggleFullscreen();
  });

  // Táctil (móvil): dos toques seguidos
  let lastTap = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', e => {
    if (e.target.closest('button, #flashcard, #empty-msg')) return;
    const t = e.changedTouches[0];
    if (!t || !inVideoBox(t.clientX, t.clientY)) return;
    const now = Date.now();
    if (now - lastTap < 350 && Math.hypot(t.clientX - lastX, t.clientY - lastY) < 40) {
      e.preventDefault();
      lastTap = 0;
      toggleFullscreen();
    } else {
      lastTap = now; lastX = t.clientX; lastY = t.clientY;
    }
  }, { passive: false });
}

async function toggleFullscreen() {
  if (document.body.classList.contains('fs')) { exitFullscreen(); return; }
  document.body.classList.add('fs');
  const el = document.documentElement;
  try {
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) await req.call(el);
  } catch (e) { /* sin API: queda el modo "falso" */ }
  // Como YouTube: al entrar a pantalla completa gira a horizontal automáticamente
  try { await screen.orientation?.lock?.('landscape'); } catch (e) {}
}

function exitFullscreen() {
  const wasOn = document.body.classList.contains('fs');
  document.body.classList.remove('fs');
  try {
    if (isRealFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } catch (e) {}
  if (wasOn) { try { screen.orientation?.unlock?.(); } catch (e) {} }
}
