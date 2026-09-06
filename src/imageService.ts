export type PrinterId = 'h2c' | 'h2d' | 'p1s' | 'p2s';

export const PRINTERS: { id: PrinterId; label: string }[] = [
  { id: 'h2c', label: 'H2C' },
  { id: 'h2d', label: 'H2D' },
  { id: 'p1s', label: 'P1S' },
  { id: 'p2s', label: 'P2S' },
];

export interface LayerImage {
  layer: number;
  url: string;
  timestamp: number;
}

export async function fetchPrinterImages(printer: PrinterId): Promise<LayerImage[]> {
  const res = await fetch(`/api/images?printer=${printer}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.images ?? [];
}
