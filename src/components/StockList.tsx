// Left rail: watchlist and paper-trading portfolio.
import type { ComponentChildren } from "preact";
import { memo } from "preact/compat";
import { formatPercentChange, formatPrice, formatSignedChange } from "../format";
import { store } from "../state";
import type { Stock } from "../stocks";
import { input, label, segment, segmented } from "./ui";
import { usePriceTick, useRevealed } from "./usePriceTick";

const STARTING_CASH_CAD = 100_000;

// In a list row pass `class="shrink-0 whitespace-nowrap"`, so a long name beside it truncates instead of wrapping
// the change onto a second line.
function ChangeText({ value, percent, class: extra = "" }: { value?: number; percent: number; class?: string }) {
  const up = (value ?? percent) >= 0;
  return (
    <span class={`tabular-nums ${up ? "text-up" : "text-down"} ${extra}`}>
      {value !== undefined && `${formatSignedChange(value)} `}
      {value !== undefined ? `(${formatPercentChange(percent)})` : formatPercentChange(percent)}
      {/* A non-breaking space keeps the arrow with its number wherever the text wraps */}
      <span aria-hidden="true">{" "}{up ? "↑" : "↓"}</span>
      <span class="sr-only">{up ? " up" : " down"}</span>
    </span>
  );
}

const rowClass = (selected: boolean) =>
  `flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2.5 text-left transition-[background-color,transform] duration-150 ease-out active:scale-[0.985] ${
    selected ? "bg-raised-hover" : "hover:bg-raised active:bg-raised-hover"
  }`;

// Memoized so a price tick only re-renders the rows whose quote changed.
const WatchlistRow = memo(function WatchlistRow({ stock, selected }: { stock: Stock; selected: boolean }) {
  const pending = stock.synced === false;
  const tick = usePriceTick(pending ? null : stock.price);
  const reveal = useRevealed(pending) ? "enter-fade" : "";
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        class={rowClass(selected)}
        onClick={(event) => {
          store.clickStock(stock.symbol, event.shiftKey);
          event.stopPropagation();
        }}
      >
        <div class="flex w-full items-baseline justify-between gap-3">
          <span class="flex items-baseline gap-1.5">
            <span class="text-sm font-semibold text-ink">{stock.symbol}</span>
            <span class="text-2xs text-ink-subtle">{stock.currency || "USD"}</span>
          </span>
          {pending ? (
            <span class="h-3.5 w-14 animate-pulse rounded bg-raised-hover" aria-label="Loading price" />
          ) : (
            <span class={`text-sm font-medium tabular-nums text-ink ${reveal}`}>
              <span {...tick}>{formatPrice(stock.price)}</span>
            </span>
          )}
        </div>
        <div class="flex w-full items-baseline justify-between gap-3 text-xs">
          <span class="truncate text-ink-muted">{stock.name}</span>
          {pending ? (
            <span class="shrink-0 text-ink-faint">—</span>
          ) : (
            <ChangeText percent={stock.percentChange} class={`shrink-0 whitespace-nowrap ${reveal}`} />
          )}
        </div>
      </button>
    </li>
  );
});

function EmptyNote({ children }: { children: ComponentChildren }) {
  return <p class="px-3 py-6 text-center text-sm text-ink-muted">{children}</p>;
}

function PortfolioPanel() {
  const isDisplayCad = store.displayCurrency.value === "CAD";
  const rate = store.cadToUsdRate.value;
  const toDisplay = (cad: number) => (isDisplayCad ? cad : cad * rate);
  const currencyLabel = isDisplayCad ? "CAD" : "USD";

  // Values are normalized to the CAD ledger and rounded to cents, matching the database,
  // so sub-cent FX differences never show up as phantom profit.
  const toLedgerCad = (price: number, isCad: boolean) => parseFloat((isCad ? price : price / rate).toFixed(2));

  const positionsValueCad = store.positions.value.reduce((acc, pos) => {
    const stock = store.stocks.value.find((s) => s.symbol === pos.symbol);
    const isCad = stock ? stock.currency === "CAD" : pos.symbol.endsWith(".TO");
    return acc + toLedgerCad(stock?.price || pos.average_cost, isCad) * pos.quantity;
  }, 0);
  const totalCad = store.cashBalance.value + positionsValueCad;
  const returnCad = totalCad - STARTING_CASH_CAD;

  const query = store.searchQuery.value.trim().toLowerCase();
  const positions = store.positions.value.filter((pos) => {
    if (!query) return true;
    const stock = store.stocks.value.find((s) => s.symbol === pos.symbol);
    return pos.symbol.toLowerCase().includes(query) || stock?.name.toLowerCase().includes(query);
  });
  const subTab = store.portfolioSubTab.value;

  return (
    <div>
      <section class="border-b border-line px-3 pb-4 pt-3" aria-label="Account summary">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class={label}>Account value</div>
            <div class="mt-1 text-2xl font-semibold tabular-nums text-ink">{formatPrice(toDisplay(totalCad))}</div>
          </div>
          <div class={segmented} role="group" aria-label="Display currency">
            {(["CAD", "USD"] as const).map((cur) => (
              <button
                key={cur}
                type="button"
                aria-pressed={store.displayCurrency.value === cur}
                onClick={() => (store.displayCurrency.value = cur)}
                class={`${segment(store.displayCurrency.value === cur)} h-6`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>
        <dl class="mt-4 grid grid-cols-2 gap-3">
          <div>
            <dt class={label}>Cash</dt>
            <dd class="mt-0.5 text-sm font-medium tabular-nums text-ink">{formatPrice(toDisplay(store.cashBalance.value))}</dd>
          </div>
          <div>
            <dt class={label}>All-time return</dt>
            <dd class="mt-0.5 text-sm font-medium">
              <ChangeText value={toDisplay(returnCad)} percent={(returnCad / STARTING_CASH_CAD) * 100} />
            </dd>
          </div>
        </dl>
      </section>

      <div class="flex gap-4 px-3 pt-3" role="tablist" aria-label="Portfolio">
        {(["positions", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={subTab === tab}
            onClick={() => (store.portfolioSubTab.value = tab)}
            class={`border-b-2 pb-2 text-xs font-medium capitalize transition-colors ${
              subTab === tab ? "border-ink text-ink" : "border-transparent text-ink-subtle hover:text-ink"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {subTab === "positions" ? (
        store.positions.value.length === 0 ? (
          <EmptyNote>No positions yet. Open a stock and choose Trade to buy your first shares.</EmptyNote>
        ) : positions.length === 0 ? (
          <EmptyNote>No positions match “{store.searchQuery.value}”.</EmptyNote>
        ) : (
          <ul class="mt-1 space-y-0.5 px-1.5">
            {positions.map((pos) => {
              const stock = store.stocks.value.find((s) => s.symbol === pos.symbol);
              const isCad = stock ? stock.currency === "CAD" : pos.symbol.endsWith(".TO");
              const avgCostNative = isCad ? pos.average_cost : pos.average_cost * rate;
              const priceCad = toLedgerCad(stock?.price || avgCostNative, isCad);
              const pnlCad = (priceCad - pos.average_cost) * pos.quantity;
              const pnlPct = ((priceCad - pos.average_cost) / pos.average_cost) * 100;
              const selected = store.isSelected(pos.symbol);
              return (
                <li key={pos.symbol}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    class={rowClass(selected)}
                    onClick={(event) => {
                      store.clickStock(pos.symbol, event.shiftKey);
                      event.stopPropagation();
                    }}
                  >
                    <div class="flex w-full items-baseline justify-between gap-3">
                      <span class="flex items-baseline gap-1.5">
                        <span class="text-sm font-semibold text-ink">{pos.symbol}</span>
                        <span class="text-2xs text-ink-subtle">{pos.quantity} sh</span>
                      </span>
                      <span class="text-sm font-medium tabular-nums text-ink">
                        {formatPrice(toDisplay(priceCad * pos.quantity))}
                        <span class="ml-1 text-2xs font-normal text-ink-subtle">{currencyLabel}</span>
                      </span>
                    </div>
                    <div class="flex w-full items-baseline justify-between gap-3 text-xs">
                      <span class="truncate text-ink-muted">
                        Avg {formatPrice(avgCostNative)} {stock?.currency || (isCad ? "CAD" : "USD")}
                      </span>
                      <ChangeText value={toDisplay(pnlCad)} percent={pnlPct} class="shrink-0 whitespace-nowrap" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : store.transactions.value.length === 0 ? (
        <EmptyNote>No trades yet. Your buys and sells will be listed here.</EmptyNote>
      ) : (
        <ul class="mt-1 divide-y divide-line px-3">
          {store.transactions.value.map((tx) => {
            const isBuy = tx.trade_type === "BUY";
            const price = toDisplay(tx.price);
            const date = new Date(tx.created_at);
            return (
              <li key={tx.id} class="py-2.5">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="flex items-baseline gap-2">
                    <span class={`text-2xs font-semibold uppercase tracking-[0.06em] ${isBuy ? "text-up" : "text-down"}`}>
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                    <span class="text-sm font-semibold text-ink">{tx.symbol}</span>
                  </span>
                  <span class="text-sm font-medium tabular-nums text-ink">
                    {formatPrice(tx.quantity * price)}
                    <span class="ml-1 text-2xs font-normal text-ink-subtle">{currencyLabel}</span>
                  </span>
                </div>
                <div class="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink-muted">
                  <span class="tabular-nums">
                    {tx.quantity} sh @ {formatPrice(price)}
                  </span>
                  <time class="tabular-nums text-ink-subtle" dateTime={tx.created_at}>
                    {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })},{" "}
                    {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function StockList() {
  const stocks = store.filteredStocks.value;
  const totalCount = store.stocks.value.length;
  const searchQuery = store.searchQuery.value;
  const tab = store.activeTab.value;
  const selectedSymbols = store.selectedSymbols.value;

  return (
    <aside
      aria-label="Watchlist and portfolio"
      class={`flex h-full w-full shrink-0 flex-col border-r border-line bg-canvas md:w-[300px] ${
        store.selectedStock.value ? "hidden md:flex" : "flex"
      }`}
    >
      <div class="space-y-2.5 border-b border-line p-3">
        <div class={`${segmented} w-full`} role="group" aria-label="List">
          <button
            type="button"
            aria-pressed={tab === "watchlist"}
            onClick={() => (store.activeTab.value = "watchlist")}
            class={`${segment(tab === "watchlist")} h-7 flex-1`}
          >
            Watchlist
          </button>
          <button
            type="button"
            aria-pressed={tab === "portfolio"}
            onClick={() => {
              if (store.user.value) {
                store.activeTab.value = "portfolio";
              } else {
                store.authModalIntent.value = "portfolio";
                store.isAuthModalOpen.value = true;
              }
            }}
            class={`${segment(tab === "portfolio")} h-7 flex-1`}
          >
            Portfolio
          </button>
        </div>

        <div class="relative">
          <label for="list-filter" class="sr-only">
            Filter by symbol or name
          </label>
          <svg class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="list-filter"
            type="search"
            value={searchQuery}
            onInput={(e) => store.setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Filter by symbol or name"
            class={`${input} h-8 pl-8 text-xs`}
          />
        </div>
      </div>

      <div class="flex-1 overflow-y-auto pb-6">
        {tab === "portfolio" ? (
          <PortfolioPanel />
        ) : stocks.length === 0 ? (
          totalCount === 0 ? (
            <div class="px-4 py-8 text-center">
              <p class="text-sm text-ink-soft">Your watchlist is empty.</p>
              <button
                type="button"
                onClick={() => store.resetToStarterWatchlist()}
                class="mt-2 text-xs text-ink-muted underline decoration-ink-faint underline-offset-[3px] hover:text-ink hover:decoration-ink"
              >
                Restore the starter watchlist
              </button>
            </div>
          ) : (
            <div class="px-4 py-8 text-center">
              <p class="text-sm text-ink-muted">No stocks match “{searchQuery}”.</p>
              <button
                type="button"
                onClick={() => {
                  store.addModalInitialQuery.value = searchQuery;
                  store.isAddModalOpen.value = true;
                }}
                class="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line-strong bg-raised px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:bg-raised-hover hover:text-ink active:scale-[0.97]"
              >
                <span>Add “{searchQuery}” to watchlist</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          )
        ) : (
          <ul class="space-y-0.5 p-1.5">
            {stocks.map((stock) => (
              <WatchlistRow key={stock.symbol} stock={stock} selected={selectedSymbols.has(stock.symbol)} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
