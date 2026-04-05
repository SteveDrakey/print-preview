import { useState } from 'react';
import PrinterView from './PrinterView';
import { PRINTERS, type PrinterId } from './imageService';

type ViewMode = 'all' | PrinterId;
type FrameLimit = 10 | 30 | 100 | 0;

const FRAME_OPTIONS: { value: FrameLimit; label: string }[] = [
  { value: 10, label: 'Last 10' },
  { value: 30, label: 'Last 30' },
  { value: 100, label: 'Last 100' },
  { value: 0, label: 'All' },
];

function App() {
  const [view, setView] = useState<ViewMode>('all');
  const [frameLimit, setFrameLimit] = useState<FrameLimit>(10);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Drakey 3D Prints
            </h1>
            <p className="text-xs text-gray-400">Live print preview</p>
          </div>
          <a
            href="https://www.etsy.com/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Shop on Etsy
          </a>
        </div>
      </header>

      <nav className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex items-center justify-between gap-4 pb-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setView('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                view === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {PRINTERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setView(p.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  view === p.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 shrink-0">
            {FRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFrameLimit(opt.value)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  frameLimit === opt.value
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {view === 'all' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {PRINTERS.map((p) => (
              <PrinterView
                key={p.id}
                printer={p.id}
                label={p.label}
                frameLimit={frameLimit}
                compact
              />
            ))}
          </div>
        ) : (
          <PrinterView
            printer={view}
            label={PRINTERS.find((p) => p.id === view)!.label}
            frameLimit={frameLimit}
          />
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-500 text-xs border-t border-gray-800 mt-4">
        <p>
          Layer images update live &middot; Powered by Bambu Lab
        </p>
        <a
          href="https://www.etsy.com/shop/Drakey3DPrints"
          target="_blank"
          rel="noopener noreferrer"
          className="text-orange-400 hover:text-orange-300 underline"
        >
          Visit Drakey 3D Prints on Etsy
        </a>
      </footer>
    </div>
  );
}

export default App;
