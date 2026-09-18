import { useState } from "preact/hooks";
import { store } from "../state";
import { formatPrice } from "../format";
import { supabase } from "../services/supabase";

type TradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TradeModal({ isOpen, onClose }: TradeModalProps) {
  if (!isOpen) return null;

  const stock = store.selectedStock.value;
  if (!stock) return null;

  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isDisplayCad = store.displayCurrency.value === "CAD";
  const usdToCad = 1 / store.cadToUsdRate.value;
  const fxMultiplier = isDisplayCad ? usdToCad : 1;
  const currencyLabel = isDisplayCad ? "CAD" : "USD";

  const isCadStock = stock.currency === "CAD" || stock.symbol.endsWith(".TO");
  // 1. Calculate USD normalized price (always sent to database)
  const normalizedPriceUsd = isCadStock ? stock.price * store.cadToUsdRate.value : stock.price;
  // 2. Calculate display price based on user toggle
  const displayPrice = isDisplayCad 
    ? (isCadStock ? stock.price : stock.price * usdToCad)
    : (isCadStock ? stock.price * store.cadToUsdRate.value : stock.price);

  const numShares = parseInt(shares) || 0;
  const estimatedTotalDisplay = numShares * displayPrice;

  // DB logic uses USD
  const userCashUsd = store.cashBalance.value;
  const userCashDisplay = userCashUsd * fxMultiplier;

  const currentPosition = store.positions.value.find(p => p.symbol === stock.symbol);
  const ownedShares = currentPosition?.quantity || 0;
  const ownedSharesValueDisplay = ownedShares * displayPrice;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (numShares <= 0) return;
    if (!store.user.value) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: store.user.value.id,
        symbol: stock.symbol,
        trade_type: tradeType,
        quantity: numShares,
        price: normalizedPriceUsd, // ALWAYS send USD to database
      });

      if (error) {
        // The PostgreSQL trigger will return an error message if they don't have enough cash/shares
        throw error;
      }

      // Success! Reload their portfolio state from the database
      await store.loadSupabasePortfolio();
      store.showToast(`Successfully ${tradeType === "BUY" ? "bought" : "sold"} ${numShares} shares of ${stock.symbol}!`);
      onClose();
      setShares("1");
    } catch (err: any) {
      setErrorMsg(err.message || "Trade failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        class="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="border-b border-zinc-800 bg-zinc-950/50 p-4">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-lg font-bold text-white">Trade {stock.symbol}</h3>
              <p class="text-xs text-zinc-400">{stock.name}</p>
            </div>
            <button
              onClick={onClose}
              class="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} class="p-5 space-y-5">
          {/* Buy/Sell Toggle */}
          <div class="flex rounded-lg bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => setTradeType("BUY")}
              class={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
                tradeType === "BUY" ? "bg-emerald-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              BUY
            </button>
            <button
              type="button"
              onClick={() => setTradeType("SELL")}
              class={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
                tradeType === "SELL" ? "bg-rose-600 text-white shadow" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              SELL
            </button>
          </div>

          <div class="flex items-center justify-between">
            <label class="text-sm font-semibold text-zinc-300">Shares</label>
            <input
              type="number"
              min="1"
              value={shares}
              onInput={(e) => setShares((e.target as HTMLInputElement).value)}
              class="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-center text-lg font-bold text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          <div class="rounded-xl bg-zinc-950/50 p-4 border border-zinc-800/50 space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-zinc-400">Market Price ({currencyLabel})</span>
              <span class="font-medium text-white">{formatPrice(displayPrice)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-zinc-400">Estimated Total ({currencyLabel})</span>
              <span class="font-bold text-white">{formatPrice(estimatedTotalDisplay)}</span>
            </div>
            
            <div class="my-3 h-px w-full bg-zinc-800/50" />
            
            <div class="flex justify-between text-xs">
              <span class="text-zinc-500">Available Cash</span>
              <span class="font-medium text-zinc-300">${userCashDisplay.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="flex justify-between text-xs mt-1.5">
              <span class="text-zinc-500">Shares Owned</span>
              <span class="font-medium text-zinc-300">
                {ownedShares} ({formatPrice(ownedSharesValueDisplay)})
              </span>
            </div>
          </div>

          {errorMsg && (
            <div class="rounded-lg bg-rose-500/10 p-3 text-xs text-rose-400 border border-rose-500/20">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || numShares <= 0}
            class={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${
              tradeType === "BUY" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
            }`}
          >
            {loading ? "Processing..." : `Submit ${tradeType} Order`}
          </button>
        </form>
      </div>
    </div>
  );
}
