/**
 * cinematic.js — End-of-session cinematic
 *
 * Ending rules (based on % correct in the session):
 *   >= 90%        -> VICTORY  (Seiya: Se ha acabado!!)
 *   50% - 89%     -> DRAW     (Hades: Ja, patético...)
 *   < 50%         -> DEFEAT   (Aniquilación — armadura rota)
 *
 * Each ending pulls its video/image + title/subtitle from the active mod's
 * mod.json "endings" section. If no media is configured, it just shows
 * the title/subtitle on a black screen.
 */

const Cinematic = {
  show(session) {
    const { total, correct } = session;
    if (total === 0) return;
    const pct = correct / total;

    let type;
    if (pct >= 0.9) type = 'victory';
    else if (pct >= 0.5) type = 'draw';
    else type = 'defeat';

    // Update persisted stats
    const state = window.AppState;
    if (type === 'victory') state.wins++;
    else if (type === 'draw') state.draws++;
    else state.losses++;
    saveState(state);

    const ending = ModManager.getEnding(type) || {};

    const overlay = document.getElementById('cinematic');
    const videoEl = document.getElementById('cinematic-video');
    const imageEl = document.getElementById('cinematic-image');
    const scoreEl = document.getElementById('cinematic-score');
    const titleEl = document.getElementById('cinematic-title');
    const subEl = document.getElementById('cinematic-subtitle');

    scoreEl.textContent = `${correct} / ${total} correctas — ${Math.round(pct * 100)}%`;
    titleEl.textContent = ending.title || this.defaultTitle(type);
    subEl.textContent = ending.subtitle || this.defaultSubtitle(type);

    videoEl.classList.add('hidden');
    imageEl.classList.add('hidden');
    videoEl.pause();

    if (ending.type === 'video' && ending.path) {
      videoEl.src = ending.path;
      videoEl.classList.remove('hidden');
      videoEl.currentTime = 0;
      videoEl.play().catch(() => {});
      videoEl.onended = () => {
        setTimeout(() => this.close(), 1000);
      };
    } else if (ending.type === 'image' && ending.path) {
      imageEl.src = ending.path;
      imageEl.classList.remove('hidden');
    }

    overlay.classList.remove('hidden');

    // Fade in text after a short delay
    setTimeout(() => { scoreEl.style.opacity = '1'; }, 300);
    setTimeout(() => {
      titleEl.style.opacity = '1';
      subEl.style.opacity = '1';
    }, 1000);
  },

  defaultTitle(type) {
    return {
      victory: 'VICTORIA...',
      draw: '💀 DERROTA',
      defeat: '☠ DERROTA',
    }[type];
  },

  defaultSubtitle(type) {
    return {
      victory: 'Seiya: Se ha acabo!!',
      draw: 'Hades: Ja, patético... Pretender entrenar con un Dios es una insolencia.',
      defeat: 'Tu armadura se rompió. Ve con MU a repararla.',
    }[type];
  },

  close() {
    const overlay = document.getElementById('cinematic');
    const videoEl = document.getElementById('cinematic-video');
    overlay.classList.add('hidden');
    videoEl.pause();

    document.getElementById('cinematic-score').style.opacity = '0';
    document.getElementById('cinematic-title').style.opacity = '0';
    document.getElementById('cinematic-subtitle').style.opacity = '0';

    // Show the repaso dialog instead of jumping straight into battle
    showRepasoDialog();
  },
};
