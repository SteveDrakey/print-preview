const BASE_URL = 'https://res.cloudinary.com/dh1i2mqa6/image/upload/v1770469171/bambu';

export type PrinterId = 'h2c' | 'h2d';

export const PRINTERS: { id: PrinterId; label: string }[] = [
  { id: 'h2c', label: 'Printer 1 (H2C)' },
  { id: 'h2d', label: 'Printer 2 (H2D)' },
];

export function getImageUrl(printer: PrinterId, minute: number): string {
  return `${BASE_URL}/${printer}_${minute}.jpg`;
}

/**
 * Probe whether an image exists by attempting to load it.
 * Returns a promise that resolves to true/false.
 */
export function imageExists(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/**
 * Scan backwards from `startMinute` to find up to `count` valid images
 * for a printer, allowing up to `maxGap` consecutive misses before stopping.
 */
export async function findRecentImages(
  printer: PrinterId,
  startMinute: number,
  count: number = 60,
  maxGap: number = 10,
): Promise<{ minute: number; url: string }[]> {
  const results: { minute: number; url: string }[] = [];
  let consecutiveMisses = 0;

  for (let m = startMinute; m >= 0 && results.length < count; m--) {
    const url = getImageUrl(printer, m);
    const exists = await imageExists(url);
    if (exists) {
      results.push({ minute: m, url });
      consecutiveMisses = 0;
    } else {
      consecutiveMisses++;
      if (consecutiveMisses >= maxGap) break;
    }
  }

  return results.reverse(); // oldest first for animation playback
}
