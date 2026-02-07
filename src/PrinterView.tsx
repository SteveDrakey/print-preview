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
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(500);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    const currentMinute = getUKMinutesSinceMidnight();
    const images = await findRecentImages(printer, currentMinute, 60, 10);
    setFrames(images);
    setCurrentIndex(images.length > 0 ? images.length - 1 : 0);
    setLoading(false);
  }, [printer]);

  // Initial load + refresh every 60s
  useEffect(() => {
    loadImages();
    const refreshInterval = setInterval(loadImages, 60_000);
    return () => clearInterval(refreshInterval);
  }, [loadImages]);

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

  if (loading) {
    return (
      <div className={`bg-gray-900 rounded-xl p-4 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Scanning for images...</span>
          </div>
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
      <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>

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
