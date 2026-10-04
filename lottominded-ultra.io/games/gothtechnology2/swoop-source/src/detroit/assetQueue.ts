/** Keep the decode budget bounded without waiting for the slowest file in a batch. */
export async function loadAssetQueue<T, R>(items: readonly T[], limit: number, load: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Asset concurrency must be a positive integer');
  const results: R[] = new Array(items.length);
  let next = 0, failed = false;
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await load(items[index], index); }
      catch (error) { failed = true; throw error; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function assetConcurrency(): number {
  if (typeof navigator === 'undefined') return 6;
  const device = navigator as Navigator & { deviceMemory?: number };
  return /Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.deviceMemory ?? 8) <= 4 ? 3 : 6;
}
