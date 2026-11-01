/**
 * srs.js — Repetición espaciada (SM-2 con pasos de aprendizaje estilo Anki)
 * Ratings: 1=Otra vez  2=Difícil  3=Bien  4=Fácil
 *
 * Estados de una carta (según card.reps):
 *   reps 0   → nueva / reaprendiendo
 *   reps 1   → en aprendizaje (ya pasó el primer paso)
 *   reps >=2 → graduada (usa intervalos en días)
 *
 * Aprendizaje:
 *   Otra vez → 1 min      Difícil → 6 min
 *   Bien     → 10 min (1er paso) y luego 1 día (graduación)
 *   Fácil    → graduación inmediata a 5 días
 * Graduadas:
 *   Otra vez → lapso: vuelve a 1 min, ease −0.20
 *   Difícil  → intervalo ×1.2 (mín. +1 día), ease −0.15
 *   Bien     → intervalo × ease (mín. +1 día)
 *   Fácil    → intervalo × ease × 1.3, ease +0.10
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const MIN_EASE = 1.3;
const GRADUATED_REPS = 2;
const PASS_RATING = 3;          // rating >= esto cuenta como acierto en stats/racha
const MATURE_INTERVAL = 21;     // días: una carta "dominada" tiene intervalo >= 21

function isGraduated(card) { return (card.reps || 0) >= GRADUATED_REPS; }

/** Devuelve una carta NUEVA con los campos de agenda actualizados. */
function scheduleCard(card, rating) {
  let { interval = 1, ease = 2.5, reps = 0 } = card;
  const now = Date.now();
  const graduated = reps >= GRADUATED_REPS;

  switch (rating) {
    case 1: // Otra vez
      if (graduated) ease = Math.max(MIN_EASE, ease - 0.2); // solo los lapsos penalizan ease
      return { ...card, interval: 1, ease, reps: 0, nextReview: now + 1 * MIN_MS, lastRating: rating };

    case 2: // Difícil
      if (!graduated) {
        return { ...card, interval, ease, reps, nextReview: now + 6 * MIN_MS, lastRating: rating };
      }
      ease = Math.max(MIN_EASE, ease - 0.15);
      interval = Math.max(interval + 1, Math.round(interval * 1.2));
      return { ...card, interval, ease, reps, nextReview: now + interval * DAY_MS, lastRating: rating };

    case 3: // Bien
      if (reps === 0) {
        return { ...card, interval: 1, ease, reps: 1, nextReview: now + 10 * MIN_MS, lastRating: rating };
      }
      if (reps === 1) {
        return { ...card, interval: 1, ease, reps: 2, nextReview: now + 1 * DAY_MS, lastRating: rating };
      }
      interval = Math.max(interval + 1, Math.round(interval * ease));
      return { ...card, interval, ease, reps: reps + 1, nextReview: now + interval * DAY_MS, lastRating: rating };

    case 4: // Fácil
      if (!graduated) {
        return { ...card, interval: 5, ease: ease + 0.1, reps: GRADUATED_REPS, nextReview: now + 5 * DAY_MS, lastRating: rating };
      }
      interval = Math.max(interval + 2, Math.round(interval * ease * 1.3));
      ease += 0.1;
      return { ...card, interval, ease, reps: reps + 1, nextReview: now + interval * DAY_MS, lastRating: rating };
  }
  return card;
}

/** ¿La carta toca repasarla ahora? */
function isDue(card) {
  return !card.nextReview || Date.now() >= card.nextReview;
}

/** Carta dominada: graduada y con intervalo largo. */
function isMastered(card) {
  return isGraduated(card) && (card.interval || 0) >= MATURE_INTERVAL;
}
