import { useState, useEffect } from 'react';
import type { PrinterImages } from '../hooks/useOneDriveImages';

const FRAME_INTERVAL_MS = 10_000;

interface PrinterViewProps {
  printer: PrinterImages;
}

export default function PrinterView({ printer }: PrinterViewProps) {
  const [currentFrame, setCurrentFrame] = useState(0);
  const totalFrames = printer.frames.length;

  useEffect(() => {
    if (totalFrames <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % totalFrames);
    }, FRAME_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [totalFrames]);

  // Reset frame when printer changes
  useEffect(() => {
    setCurrentFrame(0);
  }, [printer.name]);

  return (
    <div className="flex flex-col items-center w-full">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 capitalize">
        {printer.name}
      </h2>

      <div className="relative w-full max-w-2xl aspect-[4/3] bg-gray-100 rounded-xl overflow-hidden shadow-lg">
        {printer.frames.map((url, index) => (
          <img
            key={index}
            src={url}
            alt={`${printer.name} frame ${index + 1}`}
            className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-1000 ${
              index === currentFrame ? 'opacity-100' : 'opacity-0'
            }`}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
      </div>

      {/* Frame indicator */}
      <div className="flex items-center gap-2 mt-4">
        {printer.frames.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentFrame(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
              index === currentFrame
                ? 'bg-indigo-600 scale-125'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
            aria-label={`Go to frame ${index + 1}`}
          />
        ))}
      </div>

      <p className="text-sm text-gray-500 mt-2">
        Frame {currentFrame + 1} of {totalFrames}
      </p>
    </div>
  );
}
