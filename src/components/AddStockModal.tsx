// Add-stock dialog: filter the built-in directory, or look up any listed company with Gemini.
import { useMemo, useState } from "preact/hooks";
import { formatPercentChange, formatPrice } from "../format";
import { store } from "../state";
import { GLOBAL_TICKER_DIRECTORY, type TickerInfo } from "../tickerDatabase";
import { hasGeminiApiKey, searchAndResolveStockWithAI } from "../services/gemini";
import { Dialog, DialogHeader } from "./Dialog";
import { btn, input, size } from "./ui";

type AddStockModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type Category = "All" | "Canada" | "Tech" | "Finance" | "Consumer" | "ETFs" | "Growth";

const CATEGORY_MATCHERS: Record<Exclude<Category, "All">, (t: TickerInfo) => boolean> = {
  Canada: (t) => t.sector.includes("Canadian") || t.name.includes("TSX") || t.symbol.includes(".TO"),
  Tech: (t) => ["Semi", "Tech", "Software", "AI", "Internet"].some((k) => t.sector.includes(k)),
  Finance: (t) => ["Bank", "Payment", "Finance", "Crypto"].some((k) => t.sector.includes(k)),
  Consumer: (t) => ["Retail", "Consumer", "Beverage", "Entertainment"].some((k) => t.sector.includes(k)),
  ETFs: (t) => t.sector.includes("ETF") || t.sector.includes("Index"),
  Growth: (t) => ["Disruptive", "Gaming", "Treasury", "Mobility"].some((k) => t.sector.includes(k)),
};

export function AddStockModal({ isOpen, onClose }: AddStockModalProps) {
  return isOpen ? <AddStockDialog onClose={onClose} /> : null;
}

function AddStockDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(store.addModalInitialQuery.value);
  const [category, setCategory] = useState<Category>("All");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const handleClose = () => {
    store.addModalInitialQuery.value = "";
    onClose();
  };

  const currentSymbols = useMemo(
    () => new Set(store.stocks.value.map((s) => s.symbol.toUpperCase())),
    [store.stocks.value]
  );

  const trimmed = query.trim();
  const cleanQuery = trimmed.toUpperCase();

  const results = useMemo(() => {
    const q = trimmed.toLowerCase();
    return GLOBAL_TICKER_DIRECTORY.filter((t) => {
      if (category !== "All" && !CATEGORY_MATCHERS[category](t)) return false;
      if (!q) return true;
      return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.sector.toLowerCase().includes(q);
    });
  }, [trimmed, category]);

  const exactMatch = GLOBAL_TICKER_DIRECTORY.some((t) => t.symbol === cleanQuery);
  const canLookUp = hasGeminiApiKey();

  const addTicker = (ticker: TickerInfo) => {
    store.addStockBySymbol(ticker.symbol);
    handleClose();
  };

  const lookUp = async () => {
    if (!trimmed || isLookingUp || !canLookUp) return;
    setIsLookingUp(true);
    setLookupError(null);
    try {
      const resolved = await searchAndResolveStockWithAI(trimmed);
      store.addVerifiedStock(resolved);
      handleClose();
    } catch (err: any) {
      setLookupError(err?.message || `No NYSE, NASDAQ or TSX listing found for “${trimmed}”.`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const firstAvailable = results.find((t) => !currentSymbols.has(t.symbol));
    if (firstAvailable) addTicker(firstAvailable);
    else if (trimmed && !currentSymbols.has(cleanQuery)) lookUp();
  };

  return (
    <Dialog onClose={handleClose} labelledBy="add-stock-title" width="max-w-xl">
      <div class="flex max-h-[85vh] flex-col">
        <DialogHeader
          id="add-stock-title"
          title="Add a stock"
          description="Pick from popular US and TSX listings, or look up any company by name."
          onClose={handleClose}
        />

        <div class="space-y-3 border-b border-line px-5 py-4">
          <div class="relative">
            <label for="add-stock-search" class="sr-only">
              Search by symbol or company name
            </label>
            <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="add-stock-search"
              data-autofocus
              type="search"
              autocomplete="off"
              value={query}
              onInput={(e) => {
                setQuery((e.target as HTMLInputElement).value);
                setLookupError(null);
              }}
              onKeyDown={onKeyDown}
              placeholder="Symbol or company, e.g. SHOP or Air Canada"
              class={`${input} h-10 pl-9`}
            />
          </div>

          <div class="flex flex-wrap gap-1.5" role="group" aria-label="Category">
            {(["All", ...Object.keys(CATEGORY_MATCHERS)] as Category[]).map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={category === cat}
                onClick={() => setCategory(cat)}
                class={`h-7 rounded-md px-2.5 text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-raised-hover text-ink"
                    : "text-ink-muted hover:bg-raised hover:text-ink"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p class="px-5 py-8 text-center text-sm text-ink-muted">
              {trimmed ? `Nothing in the directory matches “${trimmed}”.` : "No stocks in this category."}
            </p>
          ) : (
            <ul class="divide-y divide-line">
              {results.map((ticker) => {
                const inWatchlist = currentSymbols.has(ticker.symbol);
                const held = store.stocks.value.find((s) => s.symbol === ticker.symbol);
                return (
                  <li key={ticker.symbol} class="flex items-center gap-4 px-5 py-2.5">
                    <span class="w-16 shrink-0 text-sm font-semibold text-ink">{ticker.symbol}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm text-ink-soft">{ticker.name}</span>
                      <span class="block truncate text-xs text-ink-subtle">{ticker.sector}</span>
                    </span>
                    {inWatchlist ? (
                      <span class="shrink-0 text-right text-xs">
                        {held && held.synced !== false ? (
                          <>
                            <span class="block tabular-nums text-ink-soft">{formatPrice(held.price)}</span>
                            <span class={`block tabular-nums ${held.change >= 0 ? "text-up" : "text-down"}`}>
                              {formatPercentChange(held.percentChange)}
                            </span>
                          </>
                        ) : (
                          <span class="text-ink-subtle">In watchlist</span>
                        )}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addTicker(ticker)}
                        aria-label={`Add ${ticker.symbol}`}
                        class={`${btn.secondary} ${size.sm} shrink-0`}
                      >
                        Add
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {trimmed && !exactMatch && (canLookUp || results.length === 0) && (
            <div class="border-t border-line px-5 py-3">
              <div class="flex items-center justify-between gap-4">
                <p class="min-w-0 text-sm text-ink-soft">
                  {canLookUp ? (
                    <>
                      Not in the list? Look up <span class="font-medium text-ink">“{trimmed}”</span> on NYSE,
                      NASDAQ and TSX with Gemini.
                    </>
                  ) : (
                    <>Looking up other companies by name needs a Gemini API key. Add one in Settings, top right.</>
                  )}
                </p>
                {canLookUp && (
                  <button
                    type="button"
                    onClick={lookUp}
                    disabled={isLookingUp}
                    class={`${btn.secondary} ${size.md} shrink-0`}
                  >
                    {isLookingUp ? "Looking up…" : "Look up"}
                  </button>
                )}
              </div>
              {lookupError && (
                <p role="alert" class="mt-2 text-xs text-down">
                  {lookupError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
