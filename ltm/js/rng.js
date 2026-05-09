/** Fisher–Yates shuffle (in-place). */
export function shuffle(arr, rng = Math.random) {
  const a = arr;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function drawTop(deck) {
  if (deck.length === 0) return undefined;
  return deck.shift();
}

export function randomPick(arr, rng = Math.random) {
  if (!arr.length) return undefined;
  const i = Math.floor(rng() * arr.length);
  return arr.splice(i, 1)[0];
}
