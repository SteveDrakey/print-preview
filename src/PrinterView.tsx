import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { type PrinterId, type LayerImage, fetchPrinterImages } from './imageService';

interface PrinterViewProps {
  printer: PrinterId;
  label: string;
  frameLimit: number;
  compact?: boolean;
  onSelect?: () => void;
}

const TARGET_DURATION_S = 30;
const MAX_FPS = 15;
const TOP_HOLD_S = 3;
const PRELOAD_BATCH = 10;

// Completion heuristic: if no new layer arrives within 2x the typical inter-layer
// gap, treat the build as finished. Clamped so a single slow layer doesn't flag
// completion early and a stalled fast print isn't stuck "in progress" forever.
const COMPLETE_GAP_MULTIPLIER = 2;
const COMPLETE_MIN_MS = 10 * 60 * 1000;
const COMPLETE_MAX_MS = 2 * 60 * 60 * 1000;
const COMPLETE_RECENT_LAYERS = 10;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Evenly sample frames to fit within maxCount
function sampleFrames(frames: LayerImage[], maxCount: number): LayerImage[] {
  if (frames.length <= maxCount) return frames;
  const result: LayerImage[] = [];
  const step = (frames.length - 1) / (maxCount - 1);
  for (let i = 0; i < maxCount; i++) {
    result.push(frames[Math.round(i * step)]);
  }
  return result;
}

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

export default function PrinterView({ printer, label, frameLimit, compact, onSelect }: PrinterViewProps) {
  const [allFrames, setAllFrames] = useState<LayerImage[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);

  // Previous frame for crossfade
  const [frontUrl, setFrontUrl] = useState<string | null>(null);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);

  // Re-evaluates isComplete on a timer even when no new frames arrive.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Download/recording state
  const [downloadState, setDownloadState] = useState<'idle' | 'recording' | 'error' | 'unsupported'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const showToast = useCallback((msg: string) => {
    setToast(null);
    requestAnimationFrame(() => {
      setToast(msg);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3000);
    });
  }, []);

  // Apply frame limit then sample to max playable count
  const displayFrames = useMemo(() => {
    const limited = frameLimit > 0 ? allFrames.slice(-frameLimit) : allFrames;
    const maxFrames = TARGET_DURATION_S * MAX_FPS;
    return sampleFrames(limited, maxFrames);
  }, [allFrames, frameLimit]);

  // Calculate tick interval: total frames over target duration
  const tickMs = useMemo(() => {
    if (displayFrames.length <= 1) return 500;
    // Reserve time for top-floor hold
    const playSeconds = TARGET_DURATION_S - TOP_HOLD_S;
    return Math.round((playSeconds * 1000) / displayFrames.length);
  }, [displayFrames.length]);

  const topHoldTicks = useMemo(() => {
    if (tickMs <= 0) return 1;
    return Math.round((TOP_HOLD_S * 1000) / tickMs);
  }, [tickMs]);

  const totalTicks = displayFrames.length + topHoldTicks;

  // Infer "complete": median gap between recent layers, doubled and clamped.
  // If the predicted next layer is overdue, the build is treated as finished.
  const isComplete = useMemo(() => {
    if (allFrames.length < 2) return false;
    const recent = allFrames.slice(-COMPLETE_RECENT_LAYERS);
    const gaps: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      const gap = recent[i].timestamp - recent[i - 1].timestamp;
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length === 0) return false;
    const threshold = Math.min(
      Math.max(median(gaps) * COMPLETE_GAP_MULTIPLIER, COMPLETE_MIN_MS),
      COMPLETE_MAX_MS,
    );
    const lastTimestamp = allFrames[allFrames.length - 1].timestamp;
    return now - lastTimestamp > threshold;
  }, [allFrames, now]);

  // Fetch image list from API
  const fetchList = useCallback(async (isInitial: boolean) => {
    if (isInitial) setLoading(true);
    const images = await fetchPrinterImages(printer);

    setAllFrames((prev) => {
      if (!isInitial && prev.length > 0) {
        const existing = new Set(prev.map((f) => f.layer));
        const newOnes = images.filter((f) => !existing.has(f.layer));
        if (newOnes.length === 0) return prev;
        const topFloor = Math.max(...newOnes.map((f) => f.layer));
        showToast(`Floor ${topFloor} rising`);
        return [...prev, ...newOnes].sort((a, b) => a.layer - b.layer);
      }
      return images;
    });

    if (isInitial) setLoading(false);
  }, [printer, showToast]);

  useEffect(() => {
    fetchList(true);
  }, [fetchList]);

  useEffect(() => {
    if (!live) return;
    refreshRef.current = setInterval(() => fetchList(false), 60_000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, [live, fetchList]);

  // Progressive preloading: load first batch, then load ahead of playback
  useEffect(() => {
    if (displayFrames.length === 0) return;
    let cancelled = false;
    setLoadedCount(0);
    setFrameIndex(0);
    loadingRef.current = true;

    async function loadProgressively() {
      for (let i = 0; i < displayFrames.length; i++) {
        if (cancelled) return;
        await preloadImage(displayFrames[i].url);
        if (cancelled) return;
        setLoadedCount(i + 1);
      }
      loadingRef.current = false;
    }

    loadProgressively();
    return () => { cancelled = true; };
  }, [displayFrames]);

  // Playback: start as soon as first batch is loaded
  const canPlay = loadedCount >= Math.min(PRELOAD_BATCH, displayFrames.length);

  useEffect(() => {
    if (!live || !canPlay || displayFrames.length <= 1) {
      if (playRef.current) clearInterval(playRef.current);
      return;
    }

    playRef.current = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        // Loop back after hold at top
        if (next >= totalTicks) return 0;
        // If we've caught up to loaded frames, hold position
        const frameIdx = Math.min(next, displayFrames.length - 1);
        if (frameIdx >= loadedCount) return prev;
        return next;
      });
    }, tickMs);

    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [live, canPlay, displayFrames.length, totalTicks, tickMs, loadedCount]);

  // Map tick index to actual frame (hold on last frame during top-hold ticks)
  const actualFrameIndex = Math.min(frameIndex, displayFrames.length - 1);
  const currentFrame = displayFrames[actualFrameIndex] ?? null;

  // Crossfade: when frame changes, swap layers
  useEffect(() => {
    if (!currentFrame) return;
    setBackUrl(frontUrl);
    setFrontUrl(currentFrame.url);
    setVisible(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true));
    });
  }, [currentFrame?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setFrameIndex(0);
  }, [frameLimit]);

  const startFeed = useCallback(() => {
    setLive(true);
    fetchList(false);
  }, [fetchList]);

  const stopFeed = useCallback(() => {
    setLive(false);
  }, []);

  const handleDownload = useCallback(async () => {
    if (downloadState === 'recording' || displayFrames.length === 0) return;

    // iOS Safari's MediaRecorder only emits MP4, desktop browsers prefer WebM —
    // try MP4 first so iOS works, fall back to WebM elsewhere.
    const mimeCandidates = [
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ];
    const hasMediaRecorder = typeof MediaRecorder !== 'undefined';
    const mimeType = hasMediaRecorder
      ? mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m))
      : undefined;
    const supportsCapture =
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function';
    if (!mimeType || !supportsCapture) {
      setDownloadState('unsupported');
      return;
    }
    const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

    setDownloadState('recording');
    setDownloadProgress(0);

    try {
      // Load images at full resolution as <img> elements we can draw.
      // Same-origin proxy: avoids R2 CORS requirements that would otherwise
      // taint the canvas and prevent MediaRecorder from reading frames.
      const proxyUrl = (layer: number) =>
        `/api/image?key=${encodeURIComponent(`bambu/${printer}/layer_${layer}.jpg`)}`;

      const loadImg = (url: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`image load failed: ${url}`));
          img.src = url;
        });

      const first = await loadImg(proxyUrl(displayFrames[0].layer));
      const width = first.naturalWidth || 1280;
      const height = first.naturalHeight || 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');

      const stream = canvas.captureStream(MAX_FPS);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();

      // Prime canvas before any frames so the stream has content from t=0.
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(first, 0, 0, width, height);

      const hold = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

      for (let i = 0; i < displayFrames.length; i++) {
        const frame = displayFrames[i];
        const img = i === 0 ? first : await loadImg(proxyUrl(frame.layer));
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        setDownloadProgress(Math.round(((i + 1) / displayFrames.length) * 100));
        await hold(tickMs);
      }
      // Top-floor hold matching on-screen playback
      await hold(topHoldTicks * tickMs);

      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${printer}-build.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setDownloadState('idle');
      setDownloadProgress(0);
    } catch (err) {
      console.error('video download failed', err);
      setDownloadState('error');
    }
  }, [downloadState, displayFrames, tickMs, topHoldTicks, printer]);

  // Loading state
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

  // Empty state
  if (allFrames.length === 0) {
    return (
      <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
        <h2 className="text-lg font-semibold text-white mb-3">{label}</h2>
        <div className="aspect-video bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-slate-400">No construction in progress</span>
        </div>
      </div>
    );
  }

  // Paused
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

  // Playing — smooth crossfade
  const loadProgress = displayFrames.length > 0 ? Math.round((loadedCount / displayFrames.length) * 100) : 0;

  return (
    <div className={`bg-slate-900 rounded-xl p-4 border border-slate-700/50 ${compact ? '' : 'max-w-2xl mx-auto'}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">{label}</h2>
        <div className="flex items-center gap-2">
          {loadProgress < 100 && (
            <span className="text-xs text-slate-500 font-mono">{loadProgress}%</span>
          )}
          {isComplete ? (
            <button
              onClick={handleDownload}
              disabled={downloadState === 'recording' || downloadState === 'unsupported'}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              title="Download a video of this build"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v8.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1zm-7 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              {downloadState === 'recording'
                ? `Rendering ${downloadProgress}%`
                : downloadState === 'error'
                  ? 'Retry download'
                  : downloadState === 'unsupported'
                    ? 'Not supported here'
                    : 'Download video'}
            </button>
          ) : (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-700/60"
              title="We'll enable this when no new floors arrive."
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v8.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V4a1 1 0 011-1zm-7 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Download when complete
            </span>
          )}
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
      </div>

      <div
        className={`relative aspect-video bg-slate-800 rounded-lg overflow-hidden ${compact && onSelect ? 'cursor-pointer' : ''}`}
        onClick={compact && onSelect ? onSelect : undefined}
      >
        {/* Back layer — previous frame */}
        {backUrl && (
          <img
            src={backUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}
        {/* Front layer — crossfades in */}
        {frontUrl && (
          <img
            src={frontUrl}
            alt={`${label} floor ${currentFrame?.layer ?? ''}`}
            className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ease-in-out"
            style={{ opacity: visible ? 1 : 0 }}
          />
        )}
        {currentFrame && (
          <>
            <div className="absolute top-2 right-2 bg-black/70 text-sky-300 text-xs px-2 py-1 rounded font-mono">
              Floor {currentFrame.layer}
            </div>
          </>
        )}
        {/* Preload progress bar */}
        {loadProgress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700">
            <div
              className="h-full bg-sky-500 transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
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
