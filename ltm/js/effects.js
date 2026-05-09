import { shuffle } from './rng.js';

export function ensureDeck(deck, discard, catalogIds, rng) {
  if (deck.length === 0 && discard.length > 0) {
    deck.push(...shuffle([...discard], rng));
    discard.length = 0;
  }
}

export function drawCards(deck, discard, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    ensureDeck(deck, discard, null, rng);
    if (deck.length === 0) break;
    out.push(deck.shift());
  }
  return out;
}

/** Apply Boxer + Nurse + M08 penalties/bonuses to a restore amount. */
export function adjustRestoreAmount(state, amount) {
  let n = amount;
  if (state.run.character.special?.boxerRestorePenalty) {
    n = Math.max(0, n - 1);
  }
  if (state.run.nextRestorePenalty > 0) {
    n = Math.max(0, n - state.run.nextRestorePenalty);
    state.run.nextRestorePenalty = 0;
  }
  return n;
}

export function maybeNurseBonus(state, baseAmount) {
  let add = 0;
  if (
    state.run.character.special?.nurseExtraRestore &&
    !state.run.nurseExtraUsed &&
    baseAmount > 0
  ) {
    add = 1;
    state.run.nurseExtraUsed = true;
  }
  return baseAmount + add;
}
