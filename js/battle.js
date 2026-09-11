/**
 * battle.js — Combat / Study flow
 *
 * Handles: showing cards, revealing answers, rating, and swapping
 * the enemy/player media (image or video) according to the active mod.
 */

const Battle = {
  state: null,        // shared app state (from storage.js)
  mod: null,          // active mod config
  currentCard: null,
  revealed: false,
  rated: false,
  queue: [],
  sessionCards: [], // { cardId, rating } for the current session

  init(state) {
    this.state = state;
    this.mod = ModManager.getConfig();

    document.getElementById('app-title').textContent = 'CODEX BATTLE';

    this.startSession();
  },

  getDeckCards() {
    const deckId = this.state.activeDeck || 'default';
    return this.state.cards.filter(c => c.deckId === deckId);
  },

  startSession() {
    this.state.session = { total: 0, correct: 0 };
    this.sessionCards = [];
    this.queue = this.getDeckCards().filter(isDue);
    this.updateCounters();

    if (this.queue.length === 0) {
      this.showEmpty(true);
      return;
    }
    this.showEmpty(false);
    this.nextCard();
  },

  showEmpty(show) {
    document.getElementById('empty-msg').classList.toggle('hidden', !show);
    document.getElementById('card-section').classList.toggle('hidden', show);
    document.getElementById('battle-arena').classList.toggle('hidden', show);

    if (show) {
      const s = this.state.session.total > 0 ? this.state.session : this.state.lastSession;
      if (s && s.total > 0) {
        this.showRepasoOptions(s);
      } else {
        document.getElementById('empty-default').classList.remove('hidden');
        document.getElementById('empty-repaso').classList.add('hidden');
      }
    }
  },

  showRepasoOptions(session) {
    const s = session || this.state.session;
    const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : 0;
    document.getElementById('empty-default').classList.add('hidden');
    document.getElementById('empty-repaso').classList.remove('hidden');
    document.getElementById('empty-repaso-score').textContent =
      `${s.correct} / ${s.total} correctas — ${pct}%`;

    const msg = document.getElementById('empty-victory-msg');
    if (pct >= 90) {
      msg.classList.remove('hidden');
      msg.textContent = '✨ Tu séptimo sentido está activo. Vuelve más tarde para entrenar, o lánzate a otro duelo.';
    } else if (pct >= 50) {
      msg.classList.remove('hidden');
      msg.textContent = '👑 Hades: "¿Eso es todo? Tu cosmos es una pequeña luz frente a mi oscuridad eterna. Si crees que puedes cerrar mi brecha, vuelve a intentarlo... si te atreves."';
    } else {
      msg.classList.remove('hidden');
      msg.textContent = '💀 Hades: "Ja. Patético. Ni siquiera mereces ser mi espectro. Vuelve cuando tu cosmos arda de verdad... o sigue arrastrándote en el suelo."';
    }
  },

  nextCard() {
    const due = this.getDeckCards().filter(isDue);
    if (due.length === 0) {
      this.showEmpty(true);
      // End of session -> save & trigger cinematic if we reviewed anything
      if (this.state.session.total > 0) {
        this.state.lastSession = { ...this.state.session };
        this.state.lastSessionCards = [...this.sessionCards];
        saveState(this.state);
        setTimeout(() => Cinematic.show(this.state.session), 400);
      }
      return;
    }

    this.revealed = false;
    this.rated = false;
    this.currentCard = due[Math.floor(Math.random() * due.length)];

    document.getElementById('card-label').textContent = 'Pregunta';
    document.getElementById('card-text').textContent = this.currentCard.front;
    document.getElementById('card-subtext').textContent = '';
    document.getElementById('flashcard').classList.remove('revealed');
    document.getElementById('rating-section').classList.add('hidden');
    document.getElementById('reveal-btn').classList.remove('hidden');

    this.setCombatMedia('idle');

    this.updateCounters();
  },

  toggleCard() {
    if (!this.currentCard) return;
    if (this.revealed) {
      this.revealed = false;
      document.getElementById('card-label').textContent = 'Pregunta';
      document.getElementById('card-text').textContent = this.currentCard.front;
      document.getElementById('card-subtext').textContent = '';
      document.getElementById('flashcard').classList.remove('revealed');
    } else {
      this.revealed = true;
      document.getElementById('card-label').textContent = 'Respuesta';
      document.getElementById('card-text').textContent = this.currentCard.back;
      document.getElementById('flashcard').classList.add('revealed');
    }
  },

  hide() {
    if (!this.currentCard) return;
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
    if (this.rated) {
      document.getElementById('combat-video').removeEventListener('ended', this._onActionEnded);
      this.nextCard();
      return;
    }
    const card = this.currentCard;
    const idx = this.state.cards.findIndex(c => c.id === card.id);
    if (idx < 0) return;

    this.state.totalReviews++;
    this.state.session.total++;

    const correct = rating >= 3;
    if (correct) {
      this.state.totalCorrect++;
      this.state.session.correct++;
      this.state.streak++;
      if (this.state.streak > this.state.bestStreak) this.state.bestStreak = this.state.streak;
    } else {
      this.state.streak = 0;
    }
    document.getElementById('streak-count').textContent = this.state.streak;

    // ── Visual feedback ──
    const key = ratingToMediaKey(rating);
    this.setCombatMedia(key);
    if (correct) {
      document.getElementById('flashcard').classList.add('flash-correct');
    } else {
      document.getElementById('flashcard').classList.add('flash-wrong');
    }
    setTimeout(() => {
      document.getElementById('flashcard').classList.remove('flash-correct', 'flash-wrong');
    }, 600);

    // Floating combat text
    this.showCombatText(ModManager.getCombatText(rating), correct);

    // Track for post-battle repaso
    this.sessionCards.push({ cardId: card.id, rating });

    // Update scheduling
    this.state.cards[idx] = scheduleCard(this.state.cards[idx], rating);
    saveState(this.state);
    this.updateCounters();
    this.rated = true;

    const el = document.getElementById('combat-video');
    el.removeEventListener('ended', this._onActionEnded);
    el.addEventListener('ended', this._onActionEnded);
  },

  _onActionEnded() {
    const vidEl = document.getElementById('combat-video');
    vidEl.removeEventListener('ended', Battle._onActionEnded);
    Battle.nextCard();
  },

  showCombatText(text, correct) {
    if (!text) return;
    const el = document.getElementById('combat-text');
    el.textContent = text;
    el.style.color = correct ? 'var(--green)' : 'var(--red)';
    el.classList.remove('hidden');
    // restart animation
    el.style.animation = 'none';
    requestAnimationFrame(() => { el.style.animation = ''; });
    setTimeout(() => el.classList.add('hidden'), 1200);
  },

  setCombatMedia(key) {
    const studyView = document.getElementById('view-study');
    if (!studyView || !studyView.classList.contains('active')) return;

    const media = ModManager.getCombatantMedia('player', key)
      || ModManager.getCombatantMedia('player', 'idle');

    const imgEl = document.getElementById('combat-image');
    const vidEl = document.getElementById('combat-video');

    if (!media) {
      imgEl.classList.add('hidden');
      vidEl.classList.add('hidden');
      vidEl.pause();
      return;
    }

    if (media.type === 'video') {
      imgEl.classList.add('hidden');
      vidEl.src = media.path;
      vidEl.classList.remove('hidden');
      vidEl.loop = (key === 'idle');
      vidEl.currentTime = 0;
      vidEl.play().catch(() => {});
    } else {
      vidEl.classList.add('hidden');
      vidEl.pause();
      imgEl.src = media.path;
      imgEl.classList.remove('hidden');
    }
  },

  updateCounters() {
    const due = this.getDeckCards().filter(isDue).length;
    document.getElementById('pending-count').textContent = due;
    document.getElementById('done-count').textContent = this.state.session.total;
  },

  /** Force session cards (or only wrong ones) to be due now. */
  repasar(onlyWrong) {
    const state = this.state;
    const cards = this.sessionCards.length > 0 ? this.sessionCards : (state.lastSessionCards || []);
    cards.forEach(entry => {
      if (onlyWrong && entry.rating >= 3) return;
      const idx = state.cards.findIndex(c => c.id === entry.cardId);
      if (idx >= 0) state.cards[idx].nextReview = Date.now();
    });
    saveState(state);
    this.startSession();
  },
};
