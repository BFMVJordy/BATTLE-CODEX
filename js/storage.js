/**
 * storage.js — Persistencia (localStorage)
 * Para Capacitor: reemplazá el cuerpo de loadState()/saveState() manteniendo las firmas.
 */

const STORAGE_KEY = 'codex-battle-state';

function defaultState() {
  return {
    cards: [],
    decks: [{ id: 'default', name: 'General', description: 'Mazo por defecto' }],
    totalReviews: 0,
    totalCorrect: 0,
    bestStreak: 0,
    streak: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    activeDeck: 'default',
    seeded: false,                  // las cartas de ejemplo se siembran UNA sola vez
    session: { total: 0, correct: 0 },
    lastSession: null,              // { total, correct, deckId }
    lastSessionCards: [],           // [{ cardId, rating }]
  };
}

/** Repara estados viejos o incompletos para que la app nunca se rompa. */
function normalizeState(raw) {
  const s = { ...defaultState(), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!Array.isArray(s.cards)) s.cards = [];
  if (!Array.isArray(s.decks)) s.decks = [];
  if (!s.decks.some(d => d.id === 'default')) {
    s.decks.unshift({ id: 'default', name: 'General', description: 'Mazo por defecto' });
  }
  if (!s.decks.some(d => d.id === s.activeDeck)) s.activeDeck = 'default';
  if (!s.session || typeof s.session.total !== 'number') s.session = { total: 0, correct: 0 };
  if (!Array.isArray(s.lastSessionCards)) s.lastSessionCards = [];

  s.cards = s.cards.map(c => {
    const card = { interval: 1, ease: 2.5, reps: 0, nextReview: Date.now(), lastRating: null, ...c };
    if (!s.decks.some(d => d.id === card.deckId)) card.deckId = 'default';
    // Migración: antes "Fácil" en carta nueva dejaba reps=1 con 5 días y luego "Bien" la
    // devolvía a 1 día. Esas cartas ya estaban graduadas.
    if (card.reps === 1 && card.interval >= 4) card.reps = 2;
    return card;
  });

  // Estados anteriores a la bandera `seeded`: si ya tenían cartas, no volver a sembrar.
  if (raw && raw.seeded === undefined && s.cards.length > 0) s.seeded = true;
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalizeState(raw ? JSON.parse(raw) : null);
  } catch (e) {
    return normalizeState(null);
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Storage error', e);
  }
}

function resetState() {
  const fresh = defaultState();
  fresh.seeded = true;              // tras borrar todo, no volver a meter cartas de ejemplo
  saveState(fresh);
  return fresh;
}

/** Siembra cartas de ejemplo solo la primera vez que se abre la app. */
function seedSampleCards(state) {
  if (state.seeded) return state;
  state.seeded = true;
  if (state.cards.length > 0) return state;
  [
    ['¿Capital de Japón?', 'Tokio'],
    ['¿Cuánto es 9 × 7?', '63'],
    ['¿En qué año llegó el hombre a la Luna?', '1969'],
    ['¿Símbolo químico del hierro?', 'Fe'],
    ['¿Quién escribió el Quijote?', 'Miguel de Cervantes'],
  ].forEach(([front, back]) => state.cards.push(makeCard(front, back, 'default')));
  return state;
}

let _idCounter = 0;
function makeCard(front, back, deckId) {
  return {
    id: Date.now() * 1000 + (_idCounter++ % 1000),   // entero único (el Math.random() flotante era frágil)
    front,
    back,
    deckId: deckId || 'default',
    interval: 1,
    ease: 2.5,
    reps: 0,
    nextReview: Date.now(),
    lastRating: null,
  };
}

function makeDeck(name, description) {
  return {
    id: 'deck_' + Date.now() + '_' + Math.floor(Math.random() * 1e6),
    name: name || 'Nuevo Mazo',
    description: description || '',
  };
}
