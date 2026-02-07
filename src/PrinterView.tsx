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

export default function PrinterView({ printer, label, compact }: PrinterViewProps) {
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [live, setLive] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadImages = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
    }
    const currentMinute = getUKMinutesSinceMidnight();
    const images = await findRecentImages(printer, currentMinute, 60, 10);

    setFrames((prev) => {
      if (!isInitial && prev.length > 0) {
        // Merge: keep existing frames, add any new ones
        const existingMinutes = new Set(prev.map((f) => f.minute));
        const newFrames = images.filter((f) => !existingMinutes.has(f.minute));
        if (newFrames.length === 0) return prev;
        const merged = [...prev, ...newFrames].sort((a, b) => a.minute - b.minute);
        return merged;
      }
      return images;
    });

    if (isInitial) {
      setCurrentIndex(images.length > 0 ? images.length - 1 : 0);
      setLoading(false);
      setHasLoaded(true);
    } else {
      // On refresh, jump to latest frame so it feels live
      setCurrentIndex((prevIdx) => {
        // Only jump to latest if user was already viewing the latest
        return prevIdx;
      });
    }
  }, [printer]);

  // Start the live feed
  const startFeed = useCallback(() => {
    setLive(true);
    loadImages(true);
  }, [loadImages]);

  // Stop the live feed
  const stopFeed = useCallback(() => {
    setLive(false);
    setPlaying(false);
    if (refreshRef.current) {
      clearInterval(refreshRef.current);
      refreshRef.current = null;
    }
  }, []);

  // Auto-refresh every 60s while live
  useEffect(() => {
    if (!live || !hasLoaded) return;

    refreshRef.current = setInterval(() => {
      loadImages(false);
    }, 60_000);

    return () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current);
        refreshRef.current = null;
      }
    };
  }, [live, hasLoaded, loadImages]);

  // Animation playback
  useEffect(() => {
    if (playing && frames.length > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= frames.length - 1) {
            return 0; // loop
          }
          return prev + 1;
        });
      }, speed);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, frames.length, speed]);

  const currentFrame = frames[currentIndex];

  // Not started yet - show start button
  if (!live && !hasLoaded) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <button
            onClick={startFeed}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
            Start Live View
          </button>
        </div>
      </div>
    );
  }

  // Initial loading (only shown once)
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

  // Stopped after having loaded (show last frame with start button)
  if (!live && hasLoaded) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
          {currentFrame ? (
            <>
              <img
                src={currentFrame.url}
                alt={`${label} at ${formatMinute(currentFrame.minute)}`}
                className="w-full h-full object-contain opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={startFeed}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Resume Live View
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <button
                onClick={startFeed}
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-5 py-3 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Start Live View
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

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

  return (
    <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <button
          onClick={stopFeed}
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Stop
        </button>
      </div>

      {/* Image display */}
      <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
        <img
          src={currentFrame.url}
          alt={`${label} at ${formatMinute(currentFrame.minute)}`}
          className="w-full h-full object-contain"
        />
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {formatMinute(currentFrame.minute)} UK
        </div>
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {frames.length}
        </div>
      </div>

      {/* Controls */}
      <div className="mt-3 space-y-2">
        {/* Scrubber */}
        <input
          type="range"
          min={0}
          max={frames.length - 1}
          value={currentIndex}
          onChange={(e) => {
            setCurrentIndex(Number(e.target.value));
            setPlaying(false);
          }}
          className="w-full accent-orange-500"
        />

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Playback buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setPlaying(false);
              }}
              className="px-2 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              title="Go to start"
            >
              &#9198;
            </button>
            <button
              onClick={() => {
                setCurrentIndex((i) => Math.max(0, i - 1));
                setPlaying(false);
              }}
              className="px-2 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              title="Previous frame"
            >
              &#9664;
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className={`px-3 py-1 rounded text-sm font-medium ${
                playing
                  ? 'bg-orange-600 text-white hover:bg-orange-500'
                  : 'bg-orange-500 text-white hover:bg-orange-400'
              }`}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={() => {
                setCurrentIndex((i) => Math.min(frames.length - 1, i + 1));
                setPlaying(false);
              }}
              className="px-2 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              title="Next frame"
            >
              &#9654;
            </button>
            <button
              onClick={() => {
                setCurrentIndex(frames.length - 1);
                setPlaying(false);
              }}
              className="px-2 py-1 bg-gray-700 text-white rounded text-sm hover:bg-gray-600"
              title="Go to latest"
            >
              &#9197;
            </button>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">Speed:</span>
            {[1000, 500, 200].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 rounded text-xs ${
                  speed === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s === 1000 ? '1x' : s === 500 ? '2x' : '5x'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
