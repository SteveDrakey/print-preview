import { useState } from 'react';
import { useOneDriveImages } from './hooks/useOneDriveImages';
import PrinterView from './components/PrinterView';

type ViewMode = 'all' | string;

function App() {
  const { printers, loading, error } = useOneDriveImages();
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const visiblePrinters =
    viewMode === 'all'
      ? printers
      : printers.filter((p) => p.name === viewMode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Drakey 3D Prints
          </h1>
          <a
            href="https://www.etsy.com/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M11.5 2C6.81 2 3 5.81 3 10.5S6.81 19 11.5 19h.5v3c4.86-2.34 8-7 8-11.5C20 5.81 16.19 2 11.5 2zm1 14.5h-2v-2h2v2zm0-3.5h-2c0-3.25 3-3 3-5 0-1.1-.9-2-2-2s-2 .9-2 2h-2c0-2.21 1.79-4 4-4s4 1.79 4 4c0 2.5-3 2.75-3 5z" />
            </svg>
            Visit Etsy Shop
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-600 text-lg">
              Loading print previews...
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center max-w-lg mx-auto">
            <p className="text-red-700 font-medium text-lg mb-2">
              Unable to load images
            </p>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-gray-500 text-sm mt-4">
              The OneDrive share may be temporarily unavailable. Please try
              again later.
            </p>
          </div>
        )}

        {/* Printer selector */}
        {!loading && !error && printers.length > 0 && (
          <>
            <nav className="flex flex-wrap justify-center gap-2 mb-8">
              <button
                onClick={() => setViewMode('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  viewMode === 'all'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
                }`}
              >
                View All
              </button>
              {printers.map((printer) => (
                <button
                  key={printer.name}
                  onClick={() => setViewMode(printer.name)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize cursor-pointer ${
                    viewMode === printer.name
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
                  }`}
                >
                  {printer.name}
                </button>
              ))}
            </nav>

            {/* Printer views */}
            <div
              className={`grid gap-8 ${
                viewMode === 'all' && visiblePrinters.length > 1
                  ? 'md:grid-cols-2'
                  : 'grid-cols-1'
              }`}
            >
              {visiblePrinters.map((printer) => (
                <PrinterView key={printer.name} printer={printer} />
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !error && printers.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">
              No print previews available yet.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-500">
          <p>Drakey 3D Prints - Print Preview</p>
          <a
            href="https://www.etsy.com/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-500 hover:text-orange-600 font-medium transition-colors"
          >
            Shop on Etsy
          </a>
        </div>
      </footer>
    </div>
  );
}

export default App;
