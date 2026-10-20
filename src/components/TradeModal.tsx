// Paper-trade dialog. Orders are inserted as transactions; a Postgres trigger settles them.
import { useState } from "preact/hooks";
import { store } from "../state";
import { formatPrice } from "../format";
import { supabase } from "../services/supabase";
import type { Stock } from "../stocks";
import { Dialog, DialogHeader } from "./Dialog";
import { btn, input, segment, segmented, size } from "./ui";

type TradeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function TradeModal({ isOpen, onClose }: TradeModalProps) {
  const stock = store.selectedStock.value;
  if (!isOpen || !stock) return null;
  return <TradeDialog stock={stock} onClose={onClose} />;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div class="flex items-baseline justify-between gap-3">
      <dt class="text-ink-muted">{label}</dt>
      <dd class={`tabular-nums ${strong ? "font-semibold text-ink" : "text-ink-soft"}`}>{value}</dd>
    </div>
  );
}

function TradeDialog({ stock, onClose }: { stock: Stock; onClose: () => void }) {
  const [tradeType, setTradeType] = useState<"BUY" | "SELL">("BUY");
  const [shares, setShares] = useState("1");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const rate = store.cadToUsdRate.value;
  const isDisplayCad = store.displayCurrency.value === "CAD";
  const currencyLabel = isDisplayCad ? "CAD" : "USD";
  const isCadStock = stock.currency === "CAD" || stock.symbol.endsWith(".TO");
  const priceAvailable = stock.synced !== false;

  // The ledger is in CAD, rounded to cents, so the order price matches what the database stores.
  const priceCad = parseFloat((isCadStock ? stock.price : stock.price / rate).toFixed(2));
  const toDisplay = (cad: number) => (isDisplayCad ? cad : cad * rate);

  const numShares = Number.parseInt(shares, 10) || 0;
  const cashCad = store.cashBalance.value;
  const ownedShares = store.positions.value.find((p) => p.symbol === stock.symbol)?.quantity || 0;
  const maxShares = tradeType === "BUY" ? Math.max(0, Math.floor(cashCad / (priceCad || 0.01))) : ownedShares;
  const exceedsLimit = numShares > maxShares;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (numShares <= 0 || !store.user.value || loading || !priceAvailable) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.from("transactions").insert({
        user_id: store.user.value.id,
        symbol: stock.symbol,
        trade_type: tradeType,
        quantity: numShares,
        price: priceCad,
      });
      // The settlement trigger rejects orders the account can't cover
      if (error) throw error;

      await store.loadSupabasePortfolio();
      store.showToast(
        `${tradeType === "BUY" ? "Bought" : "Sold"} ${numShares} ${numShares === 1 ? "share" : "shares"} of ${stock.symbol}.`
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "The order didn’t go through. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog onClose={onClose} labelledBy="trade-title" width="max-w-sm">
      <DialogHeader id="trade-title" title={`Trade ${stock.symbol}`} description={stock.name} onClose={onClose} />

      <form onSubmit={handleSubmit} class="space-y-5 px-5 py-5">
        <div class={`${segmented} w-full`} role="group" aria-label="Order side">
          {(["BUY", "SELL"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-pressed={tradeType === side}
              onClick={() => {
                setTradeType(side);
                setErrorMsg("");
              }}
              class={`${segment(tradeType === side)} h-8 flex-1 text-sm`}
            >
              {side === "BUY" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        <div class="flex items-end justify-between gap-3">
          <div class="space-y-1.5">
            <label for="trade-shares" class="block text-sm font-medium text-ink-soft">
              Shares
            </label>
            <input
              id="trade-shares"
              data-autofocus
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={shares}
              aria-describedby="trade-limit"
              onInput={(e) => setShares((e.target as HTMLInputElement).value)}
              class={`${input} h-10 w-32 text-base font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
            />
          </div>
          <button
            type="button"
            onClick={() => setShares(String(maxShares))}
            disabled={maxShares === 0}
            class={`${btn.secondary} ${size.md} h-10`}
          >
            Max ({maxShares})
          </button>
        </div>
        <p id="trade-limit" class="-mt-3 text-xs text-ink-subtle">
          {tradeType === "BUY"
            ? `Your cash covers up to ${maxShares} ${maxShares === 1 ? "share" : "shares"}.`
            : `You own ${ownedShares} ${ownedShares === 1 ? "share" : "shares"}.`}
        </p>

        <dl class="space-y-2 rounded-lg border border-line bg-canvas px-4 py-3 text-sm">
          <Row label={`Price (${currencyLabel})`} value={priceAvailable ? formatPrice(toDisplay(priceCad)) : "Waiting for quote"} />
          <Row label={`Estimated total (${currencyLabel})`} value={formatPrice(toDisplay(priceCad * numShares))} strong />
          <div class="border-t border-line pt-2" />
          <Row label="Cash available" value={formatPrice(toDisplay(cashCad))} />
          <Row label="Shares owned" value={String(ownedShares)} />
        </dl>

        {(errorMsg || exceedsLimit) && (
          <p role="alert" class="text-sm text-down">
            {errorMsg ||
              (tradeType === "BUY"
                ? "That’s more than your cash covers. Lower the number of shares."
                : "You can’t sell more shares than you own.")}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || numShares <= 0 || exceedsLimit || !priceAvailable}
          class={`${btn.primary} ${size.lg} w-full`}
        >
          {loading
            ? "Placing order…"
            : `${tradeType === "BUY" ? "Buy" : "Sell"} ${numShares > 0 ? numShares : ""} ${stock.symbol}`.replace(/\s+/g, " ")}
        </button>
      </form>
    </Dialog>
  );
}
