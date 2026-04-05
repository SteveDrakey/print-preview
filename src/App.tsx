import { useState, useEffect, useCallback } from 'react';
import PrinterView from './PrinterView';
import { PRINTERS, type PrinterId } from './imageService';
import { PRODUCTS, REVIEWS, type Product, type Review } from './shopData';

type ViewMode = 'all' | PrinterId;
type FrameLimit = 10 | 30 | 100 | 0;

const FRAME_OPTIONS: { value: FrameLimit; label: string }[] = [
  { value: 10, label: '10' },
  { value: 30, label: '30' },
  { value: 100, label: '100' },
  { value: 0, label: 'All' },
];

function StarRating({ count }: { count: number }) {
  return (
    <span className="text-yellow-400">
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>&#9733;</span>
      ))}
    </span>
  );
}

function App() {
  const [view, setView] = useState<ViewMode>('all');
  const [frameLimit, setFrameLimit] = useState<FrameLimit>(10);
  const [featuredProduct, setFeaturedProduct] = useState<Product>(PRODUCTS[0]);
  const [review, setReview] = useState<Review>(REVIEWS[0]);

  const rotatePromo = useCallback(() => {
    setFeaturedProduct(PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)]);
    setReview(REVIEWS[Math.floor(Math.random() * REVIEWS.length)]);
  }, []);

  useEffect(() => {
    rotatePromo();
    const interval = setInterval(rotatePromo, 15_000);
    return () => clearInterval(interval);
  }, [rotatePromo]);

  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
      {/* Background skyline */}
      <div className="skyline" aria-hidden="true">
        <div className="building building-1" />
        <div className="building building-2" />
        <div className="building building-3" />
        <div className="building building-4" />
        <div className="building building-5" />
        <div className="building building-6" />
        <div className="building building-7" />
        <div className="building building-8" />
        <div className="building building-9" />
        <div className="building building-10" />
        <div className="building building-11" />
        <div className="building building-12" />
        <div className="scaffolding scaffold-1"><div className="scaffolding-rungs" /></div>
        <div className="scaffolding scaffold-2"><div className="scaffolding-rungs" /></div>
      </div>

      {/* Background cranes */}
      <div className="crane crane-1" aria-hidden="true">
        <div className="crane-mast">
          <div className="crane-jib" />
          <div className="crane-counter-jib" style={{ transform: 'translateX(-100%)' }} />
          <div className="crane-cable" />
          <div className="crane-hook" />
        </div>
      </div>
      <div className="crane crane-2" aria-hidden="true">
        <div className="crane-mast">
          <div className="crane-jib" />
          <div className="crane-counter-jib" style={{ transform: 'translateX(-100%)' }} />
          <div className="crane-cable" />
          <div className="crane-hook" />
        </div>
      </div>
      <div className="crane crane-3" aria-hidden="true">
        <div className="crane-mast">
          <div className="crane-jib" />
          <div className="crane-counter-jib" style={{ transform: 'translateX(-100%)' }} />
          <div className="crane-cable" />
          <div className="crane-hook" />
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-700/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center text-lg font-black">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">
                Drakey 3D Prints
              </h1>
              <p className="text-xs text-slate-400">Live construction cam</p>
            </div>
          </div>
          <a
            href="https://www.etsy.com/shop/Drakey3DPrints"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Shop
          </a>
        </div>
      </header>

      {/* Featured product banner */}
      <div className="bg-gradient-to-r from-sky-900/40 to-blue-900/40 border-b border-sky-800/30">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <a
            href={featuredProduct.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:text-sky-300 transition-colors group min-w-0"
          >
            <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-yellow-400">Featured</span>
            <span className="text-sky-200 group-hover:text-sky-100 truncate">{featuredProduct.name}</span>
            <svg className="w-3.5 h-3.5 text-sky-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 shrink-0">
            <StarRating count={review.stars} />
            <span className="italic truncate max-w-xs">"{review.text.slice(0, 60)}..."</span>
          </div>
        </div>
      </div>

      {/* Nav: view tabs + frame limit — stacked on mobile */}
      <nav className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setView('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                view === 'all'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-slate-500 mr-1">Floors</span>
            {FRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFrameLimit(opt.value)}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  frameLimit === opt.value
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Printer views */}
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
                onSelect={() => setView(p.id)}
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

      {/* Review banner */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3">
          <div className="shrink-0 w-8 h-8 bg-yellow-500/10 rounded-full flex items-center justify-center">
            <span className="text-yellow-400 text-sm">&#9733;</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StarRating count={review.stars} />
              <span className="text-xs text-slate-500">{review.reviewer}</span>
            </div>
            <p className="text-sm text-slate-300 italic">"{review.text}"</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-500 text-xs border-t border-slate-800 mt-2">
        <p>
          Watch our builds rise floor by floor &middot; Powered by Bambu Lab
        </p>
        <a
          href="https://www.etsy.com/shop/Drakey3DPrints"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-400 hover:text-sky-300 underline"
        >
          Visit the shop on Etsy
        </a>
      </footer>
    </div>
  );
}

export default App;
