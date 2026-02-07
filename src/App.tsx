import { useState } from 'react';
import PrinterView from './PrinterView';
import { PRINTERS, type PrinterId } from './imageService';

type ViewMode = 'all' | PrinterId;

function App() {
  const [view, setView] = useState<ViewMode>('all');

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-3.5h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z" />
            </svg>
            Shop on Etsy
          </a>
        </div>
      </header>

      {/* View selector tabs */}
      <nav className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setView('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              view === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All Printers
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
      </nav>

      {/* Printer views */}
      <main className="max-w-5xl mx-auto px-4 py-4">
        {view === 'all' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PRINTERS.map((p) => (
              <PrinterView
                key={p.id}
                printer={p.id}
                label={p.label}
                compact
              />
            ))}
          </div>
        ) : (
          <PrinterView
            printer={view}
            label={PRINTERS.find((p) => p.id === view)!.label}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-6 text-center text-gray-500 text-xs border-t border-gray-800 mt-4">
        <p>
          Images refresh every minute &middot; Powered by Bambu Lab printers
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
