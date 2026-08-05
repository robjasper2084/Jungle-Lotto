export function nextRandom(state: number): { state: number; value: number } {
  let x = state >>> 0 || 0x6d2b79f5;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  const next = x >>> 0;
  return { state: next, value: next / 0x100000000 };
}

export function randomInt(state: number, min: number, max: number): { state: number; value: number } {
  const next = nextRandom(state);
  return { state: next.state, value: min + Math.floor(next.value * (max - min + 1)) };
}

export function dailySeed(date = new Date()): number {
  return Number(`${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`) >>> 0;
}
