// Instruction and multi-select overview panels.
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { MULTI_SELECT_TEXT, WELCOME_TEXT } from "../constants";
import { formatPercentChange, formatPrice } from "../format";
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from "../services/gemini";
import { store } from "../state";

type InstructionsProps = {
  multi: boolean;
};

export function Instructions({ multi }: InstructionsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      const card = cardRef.current;
      if (!container || !card) return;

      const availH = container.clientHeight - 32;
      const availW = container.clientWidth - 32;
      const cardH = card.offsetHeight;
      const cardW = card.offsetWidth;

      if (cardH > 0 && cardW > 0 && availH > 0 && availW > 0) {
        const factor = Math.min(availH / cardH, availW / cardW);
        // Allow smooth scaling both down and up with browser size & zoom (0.35x - 1.8x)
        setScale(Math.min(1.8, Math.max(0.35, factor)));
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      observer = new ResizeObserver(updateScale);
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", updateScale);
      observer?.disconnect();
    };
  }, [store.stocks.value.length]);

  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [isSaved, setIsSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isKeyConfigured, setIsKeyConfigured] = useState(Boolean(getGeminiApiKey().trim()));

  const handleSaveKey = () => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      setGeminiApiKey(trimmed);
      setIsKeyConfigured(true);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
      if (store.stocks.value.length > 0) {
        store.syncAllStocks();
      }
    } else {
      clearGeminiApiKey();
      setApiKey("");
      setIsKeyConfigured(false);
      setIsSaved(false);
    }
  };

  const handleClearKey = () => {
    clearGeminiApiKey();
    setApiKey("");
    setIsKeyConfigured(false);
    setIsSaved(false);
  };

  const selectedSymbols = Array.from(store.selectedSymbols.value);
  const selectedStocks = store.stocks.value.filter((s) =>
    store.isSelected(s.symbol)
  );

  if (multi) {
    return (
      <div class="flex h-full flex-col items-center justify-center p-8 text-center">
        <div class="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-xl">
          <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white">
            {selectedSymbols.length} Stocks Selected
          </h3>
          <p class="mt-2 text-xs leading-relaxed text-zinc-400">
            {MULTI_SELECT_TEXT.title}
          </p>

          {/* Selected Tickers Preview Chips */}
          <div class="mt-4 flex flex-wrap justify-center gap-2">
            {selectedStocks.map((s) => (
              <div
                key={s.symbol}
                class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs"
              >
                <span class="font-bold text-white">{s.symbol}</span>
                <span class="text-zinc-400">{formatPrice(s.price)}</span>
                <span
                  class={`text-[11px] font-medium ${
                    s.change >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatPercentChange(s.percentChange)}
                </span>
              </div>
            ))}
          </div>

          <div class="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => store.deleteSelectedStocks()}
              class="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-500 transition"
            >
              Delete Selected ({selectedSymbols.length})
            </button>
            <button
              type="button"
              onClick={() => store.clearSelection()}
              class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-750 transition"
            >
              Clear Selection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      class="flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-6"
    >
      <div
        ref={cardRef}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        class="w-full max-w-4xl shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl backdrop-blur"
      >
        <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>

        <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">{WELCOME_TEXT.title}</h2>
        <p class="mt-1.5 text-sm sm:text-base text-zinc-400 leading-relaxed">{WELCOME_TEXT.subtitle}</p>

        <div class="mt-6 space-y-2.5">
          <div class="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Key Features
          </div>
          <div class="grid grid-cols-1 gap-2 text-sm text-zinc-300">
            {WELCOME_TEXT.supported.map((item) => {
              const [title, ...rest] = item.split(" - ");
              const desc = rest.join(" - ");
              return (
                <div
                  key={item}
                  class="flex items-center gap-2.5 rounded-xl bg-zinc-850/60 px-3.5 py-2.5 border border-zinc-800/80 text-sm whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  <span class="text-emerald-400 font-bold shrink-0">✓</span>
                  <div class="leading-normal truncate">
                    <strong class="font-semibold text-zinc-100">{title}</strong>
                    {desc && <span class="text-zinc-300"> – {desc}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gemini API Key Configuration Section (Recommended) */}
        <div class="mt-6 rounded-2xl border border-violet-500/30 bg-violet-950/20 p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
              </span>
              <span class="text-sm font-bold uppercase tracking-wider text-violet-300">
                Gemini API Key (Recommended)
              </span>
            </div>
            {isKeyConfigured && (
              <span class="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Configured
              </span>
            )}
          </div>

          <p class="mt-2.5 text-sm text-zinc-300 leading-relaxed">
            A Gemini API key is recommended to enable AI equity research, deep analyst reports, and intelligent asset discovery. Live market prices sync automatically via real-time exchange feeds.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveKey();
            }}
            class="mt-3.5 space-y-2.5"
          >
            <div class="flex gap-2.5">
              <div class="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
                  placeholder="Paste your Gemini API key (AIzaSy...)"
                  class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40 transition pr-10"
                />
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    class="absolute right-3 top-2.5 text-xs text-zinc-400 hover:text-zinc-200"
                    title={showKey ? "Hide key" : "Show key"}
                  >
                    {showKey ? (
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
                    ) : (
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                )}
              </div>
              <button
                type="submit"
                class="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-500 transition shrink-0"
              >
                {isSaved ? "Saved! ✓" : isKeyConfigured ? "Update Key" : "Save Key"}
              </button>
              {isKeyConfigured && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  class="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm font-medium text-zinc-400 hover:border-rose-800 hover:text-rose-400 transition shrink-0"
                  title="Remove stored API key"
                >
                  Clear
                </button>
              )}
            </div>

            <div class="flex items-center justify-between text-xs text-zinc-400 pt-0.5">
              <span>
                Need an API key?{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  class="font-medium text-violet-400 hover:text-violet-300 hover:underline"
                >
                  Get free key at Google AI Studio ↗
                </a>
              </span>
              <span class="text-zinc-500">Stored locally in browser</span>
            </div>
          </form>
        </div>

        {store.stocks.value.length > 0 ? (
          <div class="mt-5 text-center">
            <button
              type="button"
              onClick={() => store.clickStock(store.stocks.value[0].symbol, false)}
              class="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 hover:shadow-emerald-900/50 transition"
            >
              <span>View {store.stocks.value[0].symbol} Live Analytics</span>
              <span class="text-base">→</span>
            </button>
          </div>
        ) : (
          <div class="mt-5 text-center">
            <button
              type="button"
              onClick={() => store.isAddModalOpen.value = true}
              class="inline-flex items-center gap-2.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 hover:shadow-emerald-900/50 transition"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Your First Stock</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
