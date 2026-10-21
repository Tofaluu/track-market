// Counts the moves of a live price so its text can flash green or red each time a quote changes it.
import { useRef } from "preact/hooks";

type Tick = { scope: string; price: number | null; count: number; up: boolean };

/**
 * Pass `null` while the price isn't live yet. A new `scope` (the symbol) starts over without a flash.
 * Spread the result onto the price's own span: the changing key restarts the animation.
 */
export function usePriceTick(price: number | null, scope = "") {
  const tick = useRef<Tick>({ scope, price, count: 0, up: true });
  if (tick.current.scope !== scope) {
    tick.current = { scope, price, count: 0, up: true };
  } else if (price !== null) {
    const prev = tick.current.price;
    if (prev !== null && price !== prev) {
      tick.current.count += 1;
      tick.current.up = price > prev;
    }
    tick.current.price = price;
  }
  const { count, up } = tick.current;
  return { key: count, class: count ? (up ? "tick-up" : "tick-down") : "" };
}

/** True once a value that started out loading has arrived, so it fades in once instead of popping in. */
export function useRevealed(pending: boolean) {
  const state = useRef({ wasPending: pending, revealed: false });
  if (state.current.wasPending && !pending) state.current.revealed = true;
  state.current.wasPending = pending;
  return state.current.revealed;
}
