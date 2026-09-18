import { formatPercentChange, formatPrice, formatSignedChange } from "../format";
import { store } from "../state";

export function StockList() {
  const stocks = store.filteredStocks.value;
  const totalCount = store.stocks.value.length;
  const searchQuery = store.searchQuery.value;

  return (
    <aside class={`flex h-full w-full md:w-[310px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 ${store.selectedStock.value ? 'hidden md:flex' : 'flex'}`}>
      {/* Search & Watchlist Header */}
      <div class="border-b border-zinc-850 p-3 bg-zinc-900/40">
        <div class="mb-3 flex rounded-lg bg-zinc-950 p-1 ring-1 ring-zinc-800">
          <button
            type="button"
            onClick={() => (store.activeTab.value = "watchlist")}
            class={`flex-1 rounded-md py-1 text-xs font-semibold uppercase tracking-wider transition ${
              store.activeTab.value === "watchlist"
                ? "bg-zinc-800 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Watchlist
          </button>
          <button
            type="button"
            onClick={() => {
              if (store.user.value) {
                store.activeTab.value = "portfolio";
              } else {
                store.isAuthModalOpen.value = true;
              }
            }}
            class={`flex-1 rounded-md py-1 text-xs font-semibold uppercase tracking-wider transition ${
              store.activeTab.value === "portfolio"
                ? "bg-violet-600 text-white shadow"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Portfolio
          </button>
        </div>

        {/* Live Filter Input */}
        <div class="relative">
          <input
            type="text"
            value={searchQuery}
            onInput={(e) => store.setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Search by symbol or name..."
            class="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 py-1.5 pl-8 pr-3 text-xs text-zinc-100 placeholder-zinc-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
          />
          <svg
            class="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              type="button"
              onClick={() => store.setSearchQuery("")}
              class="absolute right-2 top-2 text-zinc-500 hover:text-zinc-300 transition"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Stock Cards List */}
      <div class="flex-1 overflow-y-auto p-2 pb-6 space-y-1.5">
        {store.activeTab.value === "portfolio" ? (
          <div class="space-y-4">
            <div class="rounded-xl bg-violet-600/10 border border-violet-500/20 p-4 space-y-3">
              {(() => {
                const isDisplayCad = store.displayCurrency.value === "CAD";

                const positionsValueDb = store.positions.value.reduce((acc, pos) => {
                  const stock = store.stocks.value.find(s => s.symbol === pos.symbol);
                  const isCad = stock ? stock.currency === "CAD" : pos.symbol.endsWith(".TO");
                  const price = stock?.price || pos.average_cost;
                  // Convert price to DB base (CAD) and strictly round to 2 decimals
                  // to prevent floating-point "arbitrage" against the database's rounded ledger
                  const rawNormalizedPriceDb = isCad ? price : price * (1 / store.cadToUsdRate.value);
                  const normalizedPriceDb = parseFloat(rawNormalizedPriceDb.toFixed(2));
                  return acc + (normalizedPriceDb * pos.quantity);
                }, 0);
                
                const totalValueDb = store.cashBalance.value + positionsValueDb; // DB is CAD
                const totalValueDisplay = isDisplayCad ? totalValueDb : totalValueDb * store.cadToUsdRate.value;
                
                const totalReturnDb = totalValueDb - 100000;
                const totalReturnDisplay = isDisplayCad ? totalReturnDb : totalReturnDb * store.cadToUsdRate.value;
                const isPositive = totalReturnDb >= 0;

                const cashBalanceDisplay = isDisplayCad ? store.cashBalance.value : store.cashBalance.value * store.cadToUsdRate.value;

                return (
                  <>
                    <div class="flex items-start justify-between">
                      <div>
                        <div class="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">
                          Total Account Value
                        </div>
                        <div class="text-2xl font-black text-white tabular-nums">
                          {formatPrice(totalValueDisplay)}
                        </div>
                      </div>
                      
                      {/* Currency Toggle */}
                      <button
                        type="button"
                        onClick={() => store.displayCurrency.value = isDisplayCad ? "USD" : "CAD"}
                        class="flex items-center gap-1 rounded bg-zinc-900/80 px-2 py-1 text-[10px] font-bold text-zinc-400 ring-1 ring-zinc-800 transition hover:bg-zinc-800 hover:text-white"
                      >
                        <span class={isDisplayCad ? "text-violet-400" : ""}>CAD</span>
                        <span class="text-zinc-600">|</span>
                        <span class={!isDisplayCad ? "text-violet-400" : ""}>USD</span>
                      </button>
                    </div>
                    
                    <div class="flex items-center gap-4 border-t border-violet-500/20 pt-3">
                      <div class="flex-1">
                        <div class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Available Cash</div>
                        <div class="text-sm font-semibold text-white tabular-nums">{formatPrice(cashBalanceDisplay)}</div>
                      </div>
                      <div class="flex-1">
                        <div class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">All-Time Return</div>
                        <div class={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {formatSignedChange(totalReturnDisplay)}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div class="space-y-1.5">
              <div class="px-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Open Positions</div>
              {(() => {
                const query = store.searchQuery.value.trim().toLowerCase();
                const isDisplayCad = store.displayCurrency.value === "CAD";
                const filteredPositions = store.positions.value.filter(pos => {
                  if (!query) return true;
                  const stock = store.stocks.value.find(s => s.symbol === pos.symbol);
                  return pos.symbol.toLowerCase().includes(query) || (stock && stock.name.toLowerCase().includes(query));
                });
                
                if (store.positions.value.length === 0) {
                  return (
                    <div class="p-4 text-center text-xs text-zinc-500">
                      You don't own any stocks yet. Click TRADE on a stock to buy shares.
                    </div>
                  );
                }
                
                if (filteredPositions.length === 0) {
                  return (
                    <div class="p-4 text-center text-xs text-zinc-500">
                      No positions match your search.
                    </div>
                  );
                }

                return filteredPositions.map(pos => {
                  const stock = store.stocks.value.find(s => s.symbol === pos.symbol);
                  const isCadStock = stock ? stock.currency === "CAD" : pos.symbol.endsWith(".TO");
                  
                  // DB average_cost is always in CAD. Convert to native for display.
                  const avgCostDb = pos.average_cost;
                  const avgCostNative = isCadStock ? avgCostDb : avgCostDb * store.cadToUsdRate.value;
                  
                  const currentPriceNative = stock?.price || avgCostNative;
                  const rawCurrentPriceDb = isCadStock ? currentPriceNative : currentPriceNative * (1 / store.cadToUsdRate.value);
                  const currentPriceDb = parseFloat(rawCurrentPriceDb.toFixed(2));
                  
                  // Position Total Value in the TOGGLED Display Currency
                  const totalValueDb = currentPriceDb * pos.quantity;
                  const totalValueDisplay = isDisplayCad ? totalValueDb : totalValueDb * store.cadToUsdRate.value;
                  
                  // Profit/Loss
                  const profitLossDb = (currentPriceDb - avgCostDb) * pos.quantity;
                  const profitLossDisplay = isDisplayCad ? profitLossDb : profitLossDb * store.cadToUsdRate.value;
                  const profitLossPct = ((currentPriceDb - avgCostDb) / avgCostDb) * 100;
                  const isPositive = profitLossDb >= 0;
                  const selected = store.isSelected(pos.symbol);

                  const displayCurrencyLabel = isDisplayCad ? "CAD" : "USD";
                  const nativeCurrencyLabel = stock?.currency || (pos.symbol.endsWith(".TO") ? "CAD" : "USD");

                  return (
                    <button
                      key={pos.symbol}
                      type="button"
                      class={`group relative flex w-full flex-col rounded-xl border p-2.5 text-left transition-all ${
                        selected
                          ? "border-emerald-500/50 bg-zinc-850/90 shadow-md ring-1 ring-emerald-500/20"
                          : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-850/60"
                      }`}
                      onClick={(event) => {
                        store.clickStock(pos.symbol, event.shiftKey);
                        event.stopPropagation();
                      }}
                    >
                      <div class="flex w-full items-center justify-between">
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold tracking-tight text-white">{pos.symbol}</span>
                          <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
                            {pos.quantity} SHS
                          </span>
                        </div>
                        <div class="text-right flex items-center gap-1 justify-end">
                          <span class="text-[9px] font-medium text-zinc-500">{displayCurrencyLabel}</span>
                          <span class="text-xs font-bold tabular-nums text-white">
                            {formatPrice(totalValueDisplay)}
                          </span>
                        </div>
                      </div>
                      <div class="mt-1.5 flex w-full items-center justify-between gap-2">
                        <div class="flex items-center gap-1">
                          <span class="text-[9px] font-medium text-zinc-500">{nativeCurrencyLabel}</span>
                          <span class="truncate text-[11px] font-medium text-zinc-400">
                            Avg: {formatPrice(avgCostNative)}
                          </span>
                        </div>
                        <div class="shrink-0 flex items-center gap-1">
                          <span class="text-[9px] font-medium text-zinc-500">{displayCurrencyLabel}</span>
                          <div class={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            <span>{formatSignedChange(profitLossDisplay)} ({formatPercentChange(profitLossPct)})</span>
                            <span>{isPositive ? "↑" : "↓"}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        ) : stocks.length === 0 ? (
          <div class="p-6 text-center text-xs text-zinc-500">
            {totalCount === 0
              ? "Your watchlist is empty. Click '+ Add' to monitor stocks."
              : "No stocks match your search."}
          </div>
        ) : (
          stocks.map((stock) => {
            const selected = store.isSelected(stock.symbol);
            const isPositive = stock.change >= 0;

            return (
              <button
                key={stock.symbol}
                type="button"
                class={`group relative flex w-full flex-col rounded-xl border p-2.5 text-left transition-all ${
                  selected
                    ? "border-emerald-500/50 bg-zinc-850/90 shadow-md ring-1 ring-emerald-500/20"
                    : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
                onClick={(event) => {
                  store.clickStock(stock.symbol, event.shiftKey);
                  event.stopPropagation();
                }}
              >
                {/* Top Row: Symbol, Currency Badge & Current Price */}
                <div class="flex w-full items-center justify-between">
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold tracking-tight text-white">{stock.symbol}</span>
                    <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
                      {stock.currency || "USD"}
                    </span>
                  </div>

                  <div class="text-right">
                    <span
                      class={`text-xs font-bold tabular-nums ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatPrice(stock.price)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Full Company Name & Performance Badge */}
                <div class="mt-1.5 flex w-full items-center justify-between gap-2">
                  <span class="truncate text-[11px] font-medium text-zinc-400">
                    {stock.name}
                  </span>

                  <div class="shrink-0">
                    <div
                      class={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                        isPositive
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      <span>{formatPercentChange(stock.percentChange)}</span>
                      <span>{isPositive ? "↑" : "↓"}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
