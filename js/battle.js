/**
 * battle.js — Flujo de combate / estudio
 *
 * Dos modos:
 *  - 'normal': sesión real. Cada respuesta actualiza la agenda SRS, las stats y la racha.
 *  - 'repaso': práctica post-combate. NO toca la agenda ni las stats; cada carta
 *              sale una sola vez (igual que en la sesión normal).
 */

const ACTION_FALLBACK_MS = 15000;      // tope por si un video nunca dispara 'ended'
const NO_VIDEO_DELAY_MS = 1400;        // avance automático si no hay video de acción

const Battle = {
  state: null,
  mod: null,
  currentCard: null,
  revealed: false,
  rated: false,
  sessionCards: [],   // [{ cardId, rating }] de la sesión normal en curso
  active: false,      // hay una sesión (normal o repaso) en curso
  mode: 'normal',
  sessionDeck: null,
  lastCardId: null,
  repasoQueue: [],
  repasoStats: { total: 0, correct: 0 },
  _advTimer: null,
  _advHandler: null,

  init(state) {
    this.state = state;
    this.mod = ModManager.getConfig();
    document.getElementById('app-title').textContent = 'CODEX BATTLE';
  },

  /** Olvida cualquier sesión en curso (reset de mazo, borrar progreso). */
  reset() {
    this.clearAdvance();
    this.active = false;
    this.mode = 'normal';
    this.currentCard = null;
    this.sessionCards = [];
    this.repasoQueue = [];
  },

  /** Se llama al entrar a la pestaña Combate. Retoma la sesión si sigue vigente. */
  enter() {
    const deckId = this.state.activeDeck || 'default';
    if (this.active && this.sessionDeck === deckId) {
      this.showEmpty(false);
      if (this.currentCard && !this.rated &&
          this.state.cards.some(c => c.id === this.currentCard.id)) {
        this.renderCard(this.currentCard);
      } else {
        this.nextCard();
      }
    } else {
      this.startSession();
    }
  },

  getDeckCards() {
    const deckId = this.state.activeDeck || 'default';
    return this.state.cards.filter(c => c.deckId === deckId);
  },

  /** Cartas disponibles ahora: vencidas y que aún NO se respondieron en esta sesión (cada carta sale una sola vez). */
  getAvailable() {
    const done = new Set(this.sessionCards.map(e => e.cardId));
    return this.getDeckCards().filter(c => isDue(c) && !done.has(c.id));
  },

  startSession() {
    this.clearAdvance();
    this.mode = 'normal';
    this.sessionDeck = this.state.activeDeck || 'default';
    this.state.session = { total: 0, correct: 0 };
    this.state.streak = 0;
    this.sessionCards = [];
    this.currentCard = null;
    this.lastCardId = null;
    this.rated = false;
    document.getElementById('streak-count').textContent = '0';

    if (this.getAvailable().length === 0) {
      this.active = false;
      this.updateCounters();
      this.showEmpty(true);
      return;
    }
    this.active = true;
    this.updateCounters();
    this.showEmpty(false);
    this.nextCard();
  },

  /** Resumen mostrado en el panel vacío: la sesión recién terminada o la última de ESTE mazo. */
  _summary() {
    const st = this.state;
    if (st.session.total > 0) return st.session;
    const l = st.lastSession;
    if (l && l.total > 0 && l.deckId === (st.activeDeck || 'default')) return l;
    return null;
  },

  showEmpty(show, repasoResult) {
    document.getElementById('empty-msg').classList.toggle('hidden', !show);
    document.getElementById('flashcard').classList.toggle('hidden', show);
    document.getElementById('card-section').classList.toggle('hidden', show);
    document.getElementById('battle-arena').classList.toggle('hidden', show);
    if (!show) return;

    if (repasoResult) { this.showRepasoOptions(repasoResult, true); return; }
    const s = this._summary();
    if (s) {
      this.showRepasoOptions(s, false);
    } else {
      document.getElementById('empty-default').classList.remove('hidden');
      document.getElementById('empty-repaso').classList.add('hidden');
    }
  },

  showRepasoOptions(s, isRepaso) {
    const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
    document.getElementById('empty-default').classList.add('hidden');
    document.getElementById('empty-repaso').classList.remove('hidden');
    document.querySelector('#empty-repaso h2').textContent =
      isRepaso ? '🛡 Repaso completado' : '⚔ Combate finalizado';
    document.getElementById('empty-repaso-score').textContent =
      `${s.correct} / ${s.total} correctas — ${pct}%`;

    const msg = document.getElementById('empty-victory-msg');
    if (isRepaso) { msg.classList.add('hidden'); return; }
    msg.classList.remove('hidden');
    if (pct >= 90) {
      msg.textContent = '✨ Tu séptimo sentido está activo. Vuelve más tarde para entrenar, o lánzate a otro duelo.';
    } else if (pct >= 50) {
      msg.textContent = '👑 Hades: "¿Eso es todo? Tu cosmos es una pequeña luz frente a mi oscuridad eterna. Si crees que puedes cerrar mi brecha, vuelve a intentarlo... si te atreves."';
    } else {
      msg.textContent = '💀 Hades: "Ja. Patético. Ni siquiera mereces ser mi espectro. Vuelve cuando tu cosmos arda de verdad... o sigue arrastrándote en el suelo."';
    }
  },

  nextCard() {
    this.clearAdvance();
    if (this.mode === 'repaso') { this.nextRepasoCard(); return; }

    const pool = this.getAvailable();
    if (pool.length === 0) { this.finishSession(); return; }

    // evita repetir la misma carta seguida si hay otras
    let candidates = pool.filter(c => c.id !== this.lastCardId);
    if (candidates.length === 0) candidates = pool;
    this.renderCard(candidates[Math.floor(Math.random() * candidates.length)]);
  },

  nextRepasoCard() {
    while (this.repasoQueue.length) {
      const card = this.state.cards.find(c => c.id === this.repasoQueue[0]);
      if (card) { this.renderCard(card); return; }
      this.repasoQueue.shift();           // la carta fue borrada
    }
    this.finishRepaso();
  },

  renderCard(card) {
    this.currentCard = card;
    this.lastCardId = card.id;
    this.revealed = false;
    this.rated = false;
    document.getElementById('card-label').textContent = 'Pregunta';
    document.getElementById('card-text').textContent = card.front;
    document.getElementById('card-subtext').textContent = '';
    document.getElementById('flashcard').classList.remove('revealed');
    document.getElementById('rating-section').classList.add('hidden');
    document.getElementById('reveal-btn').classList.remove('hidden');
    this.setCombatMedia('idle');
    this.updateCounters();
  },

  finishSession() {
    this.active = false;
    this.currentCard = null;
    const st = this.state;
    this.showEmpty(true);
    if (st.session.total > 0) {
      st.lastSession = { ...st.session, deckId: this.sessionDeck };
      st.lastSessionCards = [...this.sessionCards];
      saveState(st);
      setTimeout(() => Cinematic.show(st.session), 400);
    }
  },

  finishRepaso() {
    this.active = false;
    this.mode = 'normal';
    this.currentCard = null;
    const result = { ...this.repasoStats };
    this.showEmpty(true, result);
    if (result.total > 0) setTimeout(() => Cinematic.show(result, true), 400);
  },

  toggleCard() {
    if (!this.currentCard) return;
    this.revealed = !this.revealed;
    document.getElementById('card-label').textContent = this.revealed ? 'Respuesta' : 'Pregunta';
    document.getElementById('card-text').textContent =
      this.revealed ? this.currentCard.back : this.currentCard.front;
    document.getElementById('flashcard').classList.toggle('revealed', this.revealed);
  },

  hide() {
    if (!this.currentCard || this.rated) return;
    this.revealed = false;
    document.getElementById('card-label').textContent = 'Pregunta';
    document.getElementById('card-text').textContent = this.currentCard.front;
    document.getElementById('card-subtext').textContent = '';
    document.getElementById('flashcard').classList.remove('revealed');
    document.getElementById('rating-section').classList.add('hidden');
    document.getElementById('reveal-btn').classList.remove('hidden');
  },

  reveal() {
    if (!this.currentCard) return;
    if (!this.revealed) {
      this.revealed = true;
      document.getElementById('card-label').textContent = 'Respuesta';
      document.getElementById('card-text').textContent = this.currentCard.back;
      document.getElementById('card-subtext').textContent = '¿Cómo respondiste?';
      document.getElementById('flashcard').classList.add('revealed');
    }
    document.getElementById('reveal-btn').classList.add('hidden');
    document.getElementById('rating-section').classList.remove('hidden');
  },

  rate(rating) {
    if (!this.currentCard) return;
    if (this.rated) { this.advance(); return; }   // segundo clic: saltar la animación

    const card = this.currentCard;
    const idx = this.state.cards.findIndex(c => c.id === card.id);
    if (idx < 0) { this.nextCard(); return; }

    const st = this.state;
    const correct = rating >= PASS_RATING;

    if (this.mode === 'normal') {
      st.totalReviews++;
      st.session.total++;
      if (correct) {
        st.totalCorrect++;
        st.session.correct++;
        st.streak++;
        if (st.streak > st.bestStreak) st.bestStreak = st.streak;
      } else {
        st.streak = 0;
      }
      document.getElementById('streak-count').textContent = st.streak;
      this.sessionCards.push({ cardId: card.id, rating });
      st.cards[idx] = scheduleCard(st.cards[idx], rating);
      saveState(st);
    } else {
      // Repaso: práctica pura, sin tocar agenda ni estadísticas.
      this.repasoStats.total++;
      // Cada carta sale una sola vez: acierte o falle, pasa a la siguiente.
      if (correct) this.repasoStats.correct++;
      this.repasoQueue.shift();
    }
    this.rated = true;

    // ── Feedback visual ──
    const hasVideo = this.setCombatMedia(ratingToMediaKey(rating));
    const fc = document.getElementById('flashcard');
    fc.classList.add(correct ? 'flash-correct' : 'flash-wrong');
    setTimeout(() => fc.classList.remove('flash-correct', 'flash-wrong'), 600);
    this.showCombatText(ModManager.getCombatText(rating), correct);

    this.updateCounters();
    this.armAdvance(hasVideo);
  },

  /** Avanza al terminar el video de acción; con fallback si el video falla o no existe. */
  armAdvance(hasVideo) {
    this.clearAdvance();
    const el = document.getElementById('combat-video');
    this._advHandler = () => this.advance();
    if (hasVideo) {
      el.addEventListener('ended', this._advHandler);
      el.addEventListener('error', this._advHandler);
    }
    this._advTimer = setTimeout(this._advHandler, hasVideo ? ACTION_FALLBACK_MS : NO_VIDEO_DELAY_MS);
  },

  clearAdvance() {
    clearTimeout(this._advTimer);
    this._advTimer = null;
    if (this._advHandler) {
      const el = document.getElementById('combat-video');
      el.removeEventListener('ended', this._advHandler);
      el.removeEventListener('error', this._advHandler);
      this._advHandler = null;
    }
  },

  advance() {
    this.clearAdvance();
    if (!this.active) return;
    // Si el usuario salió de la pestaña Combate, no avanzar: enter() retoma al volver.
    const v = document.getElementById('view-study');
    if (!v || !v.classList.contains('active')) return;
    this.nextCard();
  },

  showCombatText(text, correct) {
    if (!text) return;
    const el = document.getElementById('combat-text');
    el.textContent = text;
    el.style.color = correct ? 'var(--green)' : 'var(--red)';
    el.classList.remove('hidden');
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
    setTimeout(() => el.classList.add('hidden'), 1200);
  },

  /** Devuelve true si quedó reproduciéndose un video (para saber si esperar 'ended'). */
  setCombatMedia(key) {
    const studyView = document.getElementById('view-study');
    if (!studyView || !studyView.classList.contains('active')) return false;

    const media = ModManager.getCombatantMedia('player', key)
      || ModManager.getCombatantMedia('player', 'idle');
    const imgEl = document.getElementById('combat-image');
    const vidEl = document.getElementById('combat-video');

    if (!media) {
      imgEl.classList.add('hidden');
      vidEl.classList.add('hidden');
      vidEl.pause();
      return false;
    }
    if (media.type === 'video') {
      imgEl.classList.add('hidden');
      vidEl.src = media.path;
      vidEl.classList.remove('hidden');
      vidEl.loop = (key === 'idle');
      vidEl.currentTime = 0;
      vidEl.play().catch(() => {});
      return key !== 'idle';
    }
    vidEl.classList.add('hidden');
    vidEl.pause();
    imgEl.src = media.path;
    imgEl.classList.remove('hidden');
    return false;
  },

  updateCounters() {
    const repaso = this.mode === 'repaso';
    document.getElementById('pending-count').textContent =
      repaso ? this.repasoQueue.length : this.getAvailable().length;
    document.getElementById('done-count').textContent =
      repaso ? this.repasoStats.total : this.state.session.total;
  },

  /**
   * Repaso post-combate sobre las cartas de la última sesión.
   * onlyWrong = solo las que se fallaron (Otra vez / Difícil) al menos una vez.
   * No modifica la agenda SRS.
   */
  repasar(onlyWrong) {
    const st = this.state;
    const failed = new Set();
    const ids = [];
    (st.lastSessionCards || []).forEach(e => {
      if (!ids.includes(e.cardId)) ids.push(e.cardId);
      if (e.rating < PASS_RATING) failed.add(e.cardId);
    });
    const exists = id => st.cards.some(c => c.id === id);
    let pool = (onlyWrong ? ids.filter(id => failed.has(id)) : ids).filter(exists);

    if (pool.length === 0) {
      showToast(onlyWrong ? 'No hubo cartas falladas' : 'No hay cartas para repasar');
      return;
    }
    for (let i = pool.length - 1; i > 0; i--) {     // barajar
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.clearAdvance();
    this.mode = 'repaso';
    this.active = true;
    this.sessionDeck = st.activeDeck || 'default';
    this.repasoQueue = pool;
    this.repasoStats = { total: 0, correct: 0 };
    this.lastCardId = null;
    this.showEmpty(false);
    this.nextCard();
  },
};
