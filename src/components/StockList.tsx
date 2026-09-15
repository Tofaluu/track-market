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
                const positionsValue = store.positions.value.reduce((acc, pos) => {
                  const stock = store.stocks.value.find(s => s.symbol === pos.symbol);
                  const price = stock?.price || pos.average_cost;
                  return acc + (price * pos.quantity);
                }, 0);
                
                const totalValue = store.cashBalance.value + positionsValue;
                const totalReturn = totalValue - 100000;
                const isPositive = totalReturn >= 0;

                return (
                  <>
                    <div>
                      <div class="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1">Total Account Value</div>
                      <div class="text-2xl font-black text-white tabular-nums">${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    
                    <div class="flex items-center gap-4 border-t border-violet-500/20 pt-3">
                      <div class="flex-1">
                        <div class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">Available Cash</div>
                        <div class="text-sm font-semibold text-white tabular-nums">${store.cashBalance.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                      </div>
                      <div class="flex-1">
                        <div class="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-0.5">All-Time Return</div>
                        <div class={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                          {isPositive ? "+" : "-"}${Math.abs(totalReturn).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  const currentPrice = stock?.price || pos.average_cost;
                  const totalValue = currentPrice * pos.quantity;
                  const profitLoss = (currentPrice - pos.average_cost) * pos.quantity;
                  const profitLossPct = ((currentPrice - pos.average_cost) / pos.average_cost) * 100;
                  const isPositive = profitLoss >= 0;
                  const selected = store.isSelected(pos.symbol);

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
                        <div class="text-right">
                          <span class="text-xs font-bold tabular-nums text-white">
                            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                      <div class="mt-1.5 flex w-full items-center justify-between gap-2">
                        <span class="truncate text-[11px] font-medium text-zinc-400">
                          Avg: {formatPrice(pos.average_cost)}
                        </span>
                        <div class="shrink-0">
                          <div class={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            <span>{formatSignedChange(profitLoss)} ({formatPercentChange(profitLossPct)})</span>
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
