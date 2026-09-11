/**
 * storage.js — Persistence layer
 *
 * Currently uses localStorage so it works instantly in any browser/WebView.
 * For the Capacitor build, replace the body of get()/set() with calls to
 * @capacitor-community/sqlite (or Filesystem) — keep the same function
 * signatures so the rest of the app doesn't need to change.
 */

const STORAGE_KEY = 'codex-battle-state';

const DEFAULT_STATE = {
  cards: [],
  decks: [
    { id: 'default', name: 'General', description: 'Mazo por defecto' }
  ],
  totalReviews: 0,
  totalCorrect: 0,
  bestStreak: 0,
  streak: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  activeDeck: 'default',
  // session-only (not persisted across reset, but saved so a closed app resumes mid-session)
  session: { total: 0, correct: 0 },
  lastSession: null,
  lastSessionCards: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULT_STATE };
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
  const fresh = { ...DEFAULT_STATE, cards: [], decks: [{ id: 'default', name: 'General', description: 'Mazo por defecto' }] };
  saveState(fresh);
  return fresh;
}

/** Seed a few sample cards on first run so the UI isn't empty */
function seedSampleCards(state) {
  if (state.cards.length > 0) return state;
  const samples = [
    ['¿Capital de Japón?', 'Tokio'],
    ['¿Cuánto es 9 × 7?', '63'],
    ['¿En qué año llegó el hombre a la Luna?', '1969'],
    ['¿Símbolo químico del hierro?', 'Fe'],
    ['¿Quién escribió el Quijote?', 'Miguel de Cervantes'],
  ];
  samples.forEach(([front, back]) => {
    state.cards.push(makeCard(front, back, 'default'));
  });
  return state;
}

function makeCard(front, back, deckId) {
  return {
    id: Date.now() + Math.random(),
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
    id: 'deck_' + Date.now() + Math.random(),
    name: name || 'Nuevo Mazo',
    description: description || '',
  };
}
