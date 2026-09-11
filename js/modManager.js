/**
 * modManager.js — Video/media loader
 *
 * The mod config is embedded directly (no fetch needed), so the app
 * works even when opened from file:// with a double-click.
 *
 * Just drop your .mp4 files in assets/default/ with the right names.
 */

const MOD_CONFIG = {
  "id": "default",
  "name": "Default",

  "pageBg": {
    "inicio": { "type": "video", "src": "bg/inicio.mp4" },
    "study":  { "type": "video", "src": "bg/study.mp4" },
    "mazos":  { "type": "video", "src": "bg/mazos.mp4" },
    "deck":   { "type": "video", "src": "bg/deck.mp4" },
    "stats":  { "type": "video", "src": "bg/stats.mp4" }
  },

  "player": {
    "name": "GUERRERO",
    "idle":  { "type": "video", "src": "battle/reposo.mp4" },
    "good":  { "type": "video", "src": "battle/bien.mp4" },
    "easy":  { "type": "video", "src": "battle/facil.mp4" },
    "hard":  { "type": "video", "src": "battle/dificil.mp4" },
    "again": { "type": "video", "src": "battle/otravez.mp4" }
  },

  "enemy": {
    "name": "DRAGÓN",
    "idle":  { "type": "video", "src": "battle/reposo.mp4" },
    "good":  { "type": "video", "src": "battle/bien.mp4" },
    "easy":  { "type": "video", "src": "battle/facil.mp4" },
    "hard":  { "type": "video", "src": "battle/dificil.mp4" },
    "again": { "type": "video", "src": "battle/otravez.mp4" }
  },

  "combatText": {
    "good":  ["¡Golpe!", "¡Impacto directo!"],
    "easy":  ["¡Golpe especial!", "¡Poder máximo!"],
    "hard":  ["¡Mordida!", "¡El dragón ataca!"],
    "again": ["¡Fuego!", "¡Llamas!"]
  },

  "endings": {
    "victory": {
      "type": "video", "src": "endings/victory.mp4",
      "title": "VICTORIA...",
      "subtitle": "Seiya: Se ha acabo!!"
    },
    "draw": {
      "type": "video", "src": "endings/draw.mp4",
      "title": "ME DAS LÁSTIMA, MORTAL...",
      "subtitle": "Sigue entrenando. Te falta nivel."
    },
    "defeat": {
      "type": "video", "src": "endings/defeat.mp4",
      "title": "DERROTA",
      "subtitle": "Tu ignorancia fue tu condena."
    }
  }
};

const _basePath = 'assets/default/';

const ModManager = {
  getConfig() { return MOD_CONFIG; },

  resolveMedia(entry) {
    if (!entry || !entry.src) return null;
    return { type: entry.type || 'video', path: _basePath + entry.src };
  },

  getCombatText(rating) {
    const key = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[rating];
    const list = MOD_CONFIG.combatText?.[key];
    if (!list || list.length === 0) return '';
    return list[Math.floor(Math.random() * list.length)];
  },

  getCombatantMedia(who, key) {
    return this.resolveMedia(MOD_CONFIG?.[who]?.[key]);
  },

  getPageBg(viewId) {
    return this.resolveMedia(MOD_CONFIG?.pageBg?.[viewId]);
  },

  getEnding(type) {
    const entry = MOD_CONFIG?.endings?.[type];
    if (!entry) return null;
    return { ...this.resolveMedia(entry), title: entry.title || '', subtitle: entry.subtitle || '' };
  },
};

function ratingToMediaKey(rating) {
  return { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' }[rating];
}
