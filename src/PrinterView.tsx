import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { type PrinterId, type LayerImage, fetchPrinterImages } from './imageService';

interface PrinterViewProps {
  printer: PrinterId;
  label: string;
  frameLimit: number;
  compact?: boolean;
  onSelect?: () => void;
}

const TARGET_LOOP_SECONDS = 30;
const MIN_TICK_MS = 80;
const MAX_TICK_MS = 500;

export default function PrinterView({ printer, label, frameLimit, compact, onSelect }: PrinterViewProps) {
  const [frames, setFrames] = useState<LayerImage[]>([]);
  const [loopIndex, setLoopIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(null);
    // Brief delay to reset animation if a toast is already showing
    requestAnimationFrame(() => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    });
  }, []);

  const preloadImage = useCallback((url: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }, []);

  const loadImages = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    const images = await fetchPrinterImages(printer);

    // Preload all images into browser cache before displaying
    await Promise.all(images.map((img) => preloadImage(img.url)));

    setFrames((prev) => {
      if (!isInitial && prev.length > 0) {
        const existingLayers = new Set(prev.map((f) => f.layer));
        const newFrames = images.filter((f) => !existingLayers.has(f.layer));
        if (newFrames.length === 0) return prev;
        const topFloor = Math.max(...newFrames.map((f) => f.layer));
        showToast(`Floor ${topFloor} rising`);
        return [...prev, ...newFrames].sort((a, b) => a.layer - b.layer);
      }
      return images;
    });

    if (isInitial) setLoading(false);
  }, [printer, showToast, preloadImage]);

  useEffect(() => {
    loadImages(true);
  }, [loadImages]);

  useEffect(() => {
    if (!live) return;
    refreshRef.current = setInterval(() => loadImages(false), 60_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [live, loadImages]);

  const recentFrames = frameLimit > 0 ? frames.slice(-frameLimit) : frames;

  const expandedFrames = useMemo(() => {
    if (recentFrames.length <= 1) return recentFrames;
    const result: LayerImage[] = [];
    for (let i = 0; i < recentFrames.length; i++) {
      const current = recentFrames[i];
      const next = recentFrames[i + 1];
      // Hold proportional to gap, but cap at 5 so big gaps don't dominate
      const hold = next ? Math.min(next.layer - current.layer, 5) : 1;
      for (let j = 0; j < hold; j++) result.push(current);
    }
    // Hold on the top floor for a few extra ticks before restarting
    const TOP_HOLD = 6;
    for (let j = 0; j < TOP_HOLD; j++) result.push(result[result.length - 1]);
    return result;
  }, [recentFrames]);

  useEffect(() => {
    setLoopIndex(0);
  }, [frameLimit]);

  const tickMs = useMemo(() => {
    if (expandedFrames.length <= 1) return MAX_TICK_MS;
    const raw = (TARGET_LOOP_SECONDS * 1000) / expandedFrames.length;
    return Math.max(MIN_TICK_MS, Math.min(MAX_TICK_MS, Math.round(raw)));
  }, [expandedFrames.length]);

  useEffect(() => {
    if (!live || expandedFrames.length <= 1) {
      if (loopRef.current) clearInterval(loopRef.current);
      return;
    }
    loopRef.current = setInterval(() => {
      setLoopIndex((prev) => (prev + 1) % expandedFrames.length);
    }, tickMs);
    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [live, expandedFrames.length, tickMs]);

  const safeIndex = expandedFrames.length > 0 ? loopIndex % expandedFrames.length : 0;
  const currentFrame = expandedFrames[safeIndex] ?? null;

  const startFeed = useCallback(() => {
    setLive(true);
    loadImages(false);
  }, [loadImages]);

  const stopFeed = useCallback(() => {
    setLive(false);
  }, []);

  if (loading) {
    return (
      <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-slate-400 text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-slate-400">No construction in progress</span>
        </div>
      </div>
    );
  }

  if (!live) {
    return (
      <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="relative aspect-video bg-slate-800 rounded-lg overflow-hidden">
          {currentFrame && (
            <>
              <img
                src={currentFrame.url}
                alt={`${label} floor ${currentFrame.layer}`}
                className="w-full h-full object-contain opacity-50"
              />
              <div className="absolute top-2 right-2 bg-black/70 text-sky-300 text-xs px-2 py-1 rounded font-mono">
                Floor {currentFrame.layer}
              </div>
            </>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startFeed}
              className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-sky-500/25"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Resume
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <button
          onClick={stopFeed}
          className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 8a1 1 0 012 0v4a1 1 0 01-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 01-2 0V8z" clipRule="evenodd" />
          </svg>
          Pause
        </button>
      </div>

      <div
        className={`relative aspect-video bg-slate-800 rounded-lg overflow-hidden ${compact && onSelect ? 'cursor-pointer' : ''}`}
        onClick={compact && onSelect ? onSelect : undefined}
      >
        {currentFrame && (
          <>
            <img
              src={currentFrame.url}
              alt={`${label} floor ${currentFrame.layer}`}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 right-2 bg-black/70 text-sky-300 text-xs px-2 py-1 rounded font-mono">
              Floor {currentFrame.layer}
            </div>
            <div className="absolute bottom-2 left-2 bg-black/70 text-slate-300 text-xs px-2 py-1 rounded">
              {recentFrames.length} {recentFrames.length === 1 ? 'floor' : 'floors'}
            </div>
          </>
        )}
        {toast && (
          <div className="floor-toast absolute top-2 left-1/2 -translate-x-1/2 bg-sky-500/90 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
