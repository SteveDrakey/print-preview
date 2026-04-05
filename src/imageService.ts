export type PrinterId = 'h2c' | 'h2d' | 'p1s';

export const PRINTERS: { id: PrinterId; label: string }[] = [
  { id: 'h2c', label: 'Printer 1 (H2C)' },
  { id: 'h2d', label: 'Printer 2 (H2D)' },
  { id: 'p1s', label: 'Printer 3 (P1S)' },
];

export interface LayerImage {
  layer: number;
  url: string;
}

export async function fetchPrinterImages(printer: PrinterId): Promise<LayerImage[]> {
  const res = await fetch(`/api/images?printer=${printer}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.images ?? [];
}
