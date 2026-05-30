// Fisher-Yates shuffle — returns a new array, does not mutate the input.
// Used to randomize study session card order so answers/pronunciation are not
// predictable from a fixed sequence.

export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
