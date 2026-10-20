// Footer: when quotes last refreshed, a manual refresh, and the watchlist count.
import { useEffect, useState } from "preact/hooks";
import { store } from "../state";

export function StatusBar() {
  const isSyncing = store.isSyncingAll.value;
  const [showSyncing, setShowSyncing] = useState(false);

  // Only show the syncing state if it lasts long enough to notice
  useEffect(() => {
    if (!isSyncing) {
      setShowSyncing(false);
      return;
    }
    const t = setTimeout(() => setShowSyncing(true), 300);
    return () => clearTimeout(t);
  }, [isSyncing]);

  return (
    <footer class="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line bg-surface px-4 text-xs text-ink-subtle">
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate" aria-live="polite">
          {showSyncing ? "Refreshing quotes…" : store.syncMessage.value ?? store.lastMarketUpdate.value}
        </span>
        <button
          type="button"
          onClick={() => store.syncAllStocks()}
          disabled={isSyncing}
          class="rounded px-1 text-ink-muted underline decoration-ink-faint underline-offset-[3px] transition-colors hover:text-ink hover:decoration-ink disabled:no-underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div class="shrink-0 whitespace-nowrap tabular-nums">{store.statusLabel.value}</div>
    </footer>
  );
}
