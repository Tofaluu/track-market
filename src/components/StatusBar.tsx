import { useState, useEffect } from "preact/hooks";
import { formatPercentChange, formatPrice, formatSignedChange } from "../format";
import { store } from "../state";

export function StatusBar() {
  const selected = store.selectedStock.value;
  const lastTick = store.lastMarketUpdate.value;
  const isSyncing = store.isSyncingAll.value;
  
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    if (isSyncing) {
      const t = setTimeout(() => setShowSyncing(true), 300);
      return () => clearTimeout(t);
    } else {
      setShowSyncing(false);
    }
  }, [isSyncing]);

  return (
    <footer class="flex h-8 shrink-0 items-center justify-between border-t border-zinc-850 bg-zinc-950 px-4 text-xs text-zinc-400">
      {/* Selected Stock Live Indicator */}
      <div class="flex items-center gap-2">
        {selected ? (
          <div class="flex items-center gap-1.5 font-medium">
            <span class="text-zinc-200">{selected.name}</span>
            <span class="text-zinc-500">({selected.symbol})</span>
            <span class="text-white font-semibold tabular-nums">{formatPrice(selected.price)}</span>
            <span
              class={`tabular-nums ${
                selected.change >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatSignedChange(selected.change)} ({formatPercentChange(selected.percentChange)})
            </span>
          </div>
        ) : (
          <span class="text-zinc-500">No stock selected</span>
        )}
      </div>

      {/* Exchange Session Status & Timestamp */}
      <div class="hidden items-center gap-2 md:flex text-[11px] text-zinc-500">
        <span
          class={`h-2 w-2 rounded-full ${
            store.isMarketOpen.value
              ? "bg-emerald-400 animate-pulse"
              : "bg-rose-500"
          }`}
        />
        <span class="hidden lg:inline">
          {store.isMarketOpen.value
            ? "TSX / NYSE Regular Session (9:30 AM - 4:00 PM ET)"
            : "Markets Closed • Official Closing Prices Held"}
        </span>
        <span class="lg:hidden">
          {store.isMarketOpen.value
            ? "Regular Session"
            : "Market Closed"}
        </span>
        <span>•</span>
        <button
          type="button"
          onClick={() => store.syncAllStocks()}
          disabled={store.isSyncingAll.value}
          class="hover:text-zinc-300 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title="Click to sync all stocks now"
        >
          {showSyncing ? (
            <span class="inline-flex items-center gap-1 text-emerald-400">
              <svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Syncing live quotes...</span>
            </span>
          ) : (
            <span>{lastTick}</span>
          )}
        </button>
      </div>

      {/* Portfolio Status Label */}
      <div class="font-medium text-zinc-400">{store.statusLabel.value}</div>
    </footer>
  );
}
