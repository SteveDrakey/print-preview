import { useState, useEffect } from 'react';

export interface PrinterImages {
  name: string;
  frames: string[];
}

interface OneDriveChild {
  name: string;
  '@microsoft.graph.downloadUrl'?: string;
  '@content.downloadUrl'?: string;
}

function encodeShareUrl(url: string): string {
  const base64 = btoa(url);
  const encoded = base64
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `u!${encoded}`;
}

const SHARE_URL =
  'https://1drv.ms/f/c/891de2a4f284c649/IgD9zArrV9A9Tb2qqP02uLM9AXUWJxNt-H7sfMQW2fs7ATc?e=eP7aMW';

export function useOneDriveImages() {
  const [printers, setPrinters] = useState<PrinterImages[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchImages() {
      try {
        const token = encodeShareUrl(SHARE_URL);

        // Try the OneDrive API (works for personal OneDrive public shares)
        const apiUrl = `https://api.onedrive.com/v1.0/shares/${token}/root/children?select=name,@content.downloadUrl`;
        const res = await fetch(apiUrl);

        if (!res.ok) {
          throw new Error(`OneDrive API returned ${res.status}`);
        }

        const data = await res.json();
        const children: OneDriveChild[] = data.value || [];

        // Group files by printer name: <printer>-<number>.jpg
        const printerMap = new Map<string, { num: number; url: string }[]>();

        for (const child of children) {
          const match = child.name.match(/^(.+)-(\d+)\.jpg$/i);
          if (!match) continue;

          const printerName = match[1];
          const frameNum = parseInt(match[2], 10);
          const downloadUrl =
            child['@content.downloadUrl'] ||
            child['@microsoft.graph.downloadUrl'] ||
            '';

          if (!downloadUrl) continue;

          if (!printerMap.has(printerName)) {
            printerMap.set(printerName, []);
          }
          printerMap.get(printerName)!.push({ num: frameNum, url: downloadUrl });
        }

        if (cancelled) return;

        const result: PrinterImages[] = [];
        for (const [name, frames] of printerMap) {
          frames.sort((a, b) => a.num - b.num);
          result.push({
            name,
            frames: frames.map((f) => f.url),
          });
        }

        result.sort((a, b) => a.name.localeCompare(b.name));
        setPrinters(result);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load images'
        );
        setLoading(false);
      }
    }

    fetchImages();
    return () => {
      cancelled = true;
    };
  }, []);

  return { printers, loading, error };
}
