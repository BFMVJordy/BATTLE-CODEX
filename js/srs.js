/**
 * SRS.js — SM-2 Spaced Repetition Algorithm
 * Ratings: 1=Again 2=Hard 3=Good 4=Easy
 *
 * Matching Anki defaults:
 *   Learning steps: 1min, 10min
 *   Again → 1min   Hard → 6min   Good → 10min (learning)   Easy → 5d (learning)
 *   Graduated cards use normal SM-2 (days/weeks/months).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a NEW card object with updated scheduling fields.
 * card = { interval, ease, reps, nextReview }
 */
function scheduleCard(card, rating) {
  let { interval = 1, ease = 2.5, reps = 0 } = card;
  const now = Date.now();

  switch (rating) {
    case 1: // Again → 1 min
      reps = 0;
      interval = 1;
      ease = Math.max(1.3, ease - 0.2);
      return { ...card, interval, ease, reps, nextReview: now + 60 * 1000, lastRating: rating };

    case 2: // Hard → 6 min
      interval = Math.max(1, Math.floor(interval * 1.2));
      ease = Math.max(1.3, ease - 0.15);
      return { ...card, interval, ease, reps: card.reps, nextReview: now + 6 * 60 * 1000, lastRating: rating };

    case 3: // Good — 10 min if learning, SM-2 if graduated
      if (reps === 0) {
        reps = 1;
        interval = 1;
        return { ...card, interval, ease, reps, nextReview: now + 10 * 60 * 1000, lastRating: rating };
      }
      if (reps === 1) interval = 1;
      else interval = Math.round(interval * ease);
      reps++;
      break;

    case 4: // Easy — 5 d if new, SM-2 if graduated
      if (reps === 0) {
        reps = 1;
        ease += 0.1;
        interval = 5;
        return { ...card, interval, ease, reps, nextReview: now + 5 * DAY_MS, lastRating: rating };
      }
      interval = Math.round(interval * ease * 1.3);
      ease += 0.1;
      reps++;
      break;
  }

  return {
    ...card,
    interval,
    ease,
    reps,
    nextReview: now + interval * DAY_MS,
    lastRating: rating,
  };
}

/** Whether a card is due for review right now */
function isDue(card) {
  return !card.nextReview || Date.now() >= card.nextReview;
}
