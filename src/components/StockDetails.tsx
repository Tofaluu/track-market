// Chooses instructions, chart, or AI view based on current selection state.
import { store } from "../state";
import { AiAnalystView } from "./AiAnalystView";
import { ChartView } from "./ChartView";
import { Instructions } from "./Instructions";

export function StockDetails() {
  const count = store.selectedCount.value;
  const selected = store.selectedStock.value;
  const isAiView = store.viewMode.value === "ai";

  return (
    <section class={`h-full min-w-0 flex-1 overflow-hidden bg-zinc-950 text-zinc-100 ${selected ? 'flex flex-col' : 'hidden md:flex md:flex-col'}`}>
      {count === 0 ? <Instructions multi={false} /> : null}
      {count > 1 ? <Instructions multi={true} /> : null}
      {count === 1 && selected ? (
        <div class="h-full w-full">
          <div class={isAiView ? "hidden" : "h-full w-full"}>
            <ChartView stock={selected} />
          </div>
          <div class={isAiView ? "h-full w-full" : "hidden"}>
            <AiAnalystView stock={selected} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
