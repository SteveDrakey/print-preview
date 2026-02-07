import { useEffect, useState, useRef, useCallback } from 'react';
import { type PrinterId, findRecentImages } from './imageService';
import { getUKMinutesSinceMidnight } from './ukTime';

interface PrinterViewProps {
  printer: PrinterId;
  label: string;
  compact?: boolean;
}

interface FrameData {
  minute: number;
  url: string;
}

function formatMinute(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

const LOOP_COUNT = 10;
const LOOP_SPEED = 500;

export default function PrinterView({ printer, label, compact }: PrinterViewProps) {
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [loopIndex, setLoopIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadImages = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
    }
    const currentMinute = getUKMinutesSinceMidnight();
    const images = await findRecentImages(printer, currentMinute, 60, 10);

    setFrames((prev) => {
      if (!isInitial && prev.length > 0) {
        const existingMinutes = new Set(prev.map((f) => f.minute));
        const newFrames = images.filter((f) => !existingMinutes.has(f.minute));
        if (newFrames.length === 0) return prev;
        return [...prev, ...newFrames].sort((a, b) => a.minute - b.minute);
      }
      return images;
    });

    if (isInitial) {
      setLoading(false);
    }
  }, [printer]);

  // Auto-start on mount
  useEffect(() => {
    loadImages(true);
  }, [loadImages]);

  // Auto-refresh every 60s while live
  useEffect(() => {
    if (!live) return;

    refreshRef.current = setInterval(() => {
      loadImages(false);
    }, 60_000);

    return () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };
  }, [live, loadImages]);

  // Loop through the last N frames
  const loopFrames = frames.slice(-LOOP_COUNT);

  useEffect(() => {
    if (!live || loopFrames.length <= 1) {
      if (loopRef.current) clearInterval(loopRef.current);
      return;
    }

    loopRef.current = setInterval(() => {
      setLoopIndex((prev) => (prev + 1) % loopFrames.length);
    }, LOOP_SPEED);

    return () => {
      if (loopRef.current) clearInterval(loopRef.current);
    };
  }, [live, loopFrames.length]);

  // Keep loopIndex in bounds when frames change
  const safeIndex = loopFrames.length > 0 ? loopIndex % loopFrames.length : 0;
  const currentFrame = loopFrames[safeIndex] ?? null;

  const startFeed = useCallback(() => {
    setLive(true);
    loadImages(false);
  }, [loadImages]);

  const stopFeed = useCallback(() => {
    setLive(false);
  }, []);

  // Initial loading
  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // No images found
  if (frames.length === 0) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <span className="text-gray-400">No images found — printer may be idle</span>
        </div>
      </div>
    );
  }

  // Paused — show current frame dimmed with resume button
  if (!live) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
          {currentFrame && (
            <>
              <img
                src={currentFrame.url}
                alt={`${label} at ${formatMinute(currentFrame.minute)}`}
                className="w-full h-full object-contain opacity-50"
              />
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                {formatMinute(currentFrame.minute)} UK
              </div>
            </>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startFeed}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors"
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

  // Live view — looping last 10 frames + pause button
  return (
    <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <button
          onClick={stopFeed}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 8a1 1 0 012 0v4a1 1 0 01-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 01-2 0V8z" clipRule="evenodd" />
          </svg>
          Pause
        </button>
      </div>

      <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
        {currentFrame && (
          <>
            <img
              src={currentFrame.url}
              alt={`${label} at ${formatMinute(currentFrame.minute)}`}
              className="w-full h-full object-contain"
            />
            <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {formatMinute(currentFrame.minute)} UK
            </div>
            <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              {frames.length} {frames.length === 1 ? 'image' : 'images'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
