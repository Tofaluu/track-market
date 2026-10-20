// Detail pane when nothing (or several stocks) is selected.
import { useState } from "preact/hooks";
import { formatPercentChange, formatPrice } from "../format";
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from "../services/gemini";
import { store } from "../state";
import { btn, input, label, size } from "./ui";

type InstructionsProps = {
  multi: boolean;
};

const SHORTCUTS: [string, string][] = [
  ["Shift + click", "Select several stocks"],
  ["Delete", "Remove selected"],
  ["Shift + U / R", "Undo / redo"],
  ["Shift + C", "Clear selection"],
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd class="rounded border border-line-strong bg-raised px-1.5 py-0.5 font-sans text-2xs font-medium text-ink-soft">
      {children}
    </kbd>
  );
}

function MultiSelectPanel() {
  const selectedStocks = store.stocks.value.filter((s) => store.isSelected(s.symbol));
  const count = selectedStocks.length;
  return (
    <div class="flex h-full items-center justify-center overflow-y-auto p-8">
      <div class="w-full max-w-md">
        <h2 class="text-xl font-semibold text-ink">{count} stocks selected</h2>
        <p class="mt-1.5 text-sm text-ink-muted">
          Charts and research open for one stock at a time. Shift-click to change the selection.
        </p>
        <ul class="mt-5 divide-y divide-line rounded-lg border border-line">
          {selectedStocks.map((s) => (
            <li key={s.symbol} class="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
              <span class="font-semibold text-ink">{s.symbol}</span>
              <span class="flex items-baseline gap-3 tabular-nums">
                <span class="text-ink-soft">{s.synced === false ? "—" : formatPrice(s.price)}</span>
                <span class={`w-16 text-right text-xs ${s.change >= 0 ? "text-up" : "text-down"}`}>
                  {s.synced === false ? "" : formatPercentChange(s.percentChange)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div class="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => store.deleteSelectedStocks()}
            disabled={!store.canDelete.value}
            class={`${btn.danger} ${size.md}`}
          >
            Remove {count} stocks
          </button>
          <button type="button" onClick={() => store.clearSelection()} class={`${btn.secondary} ${size.md}`}>
            Clear selection
          </button>
        </div>
        {!store.canDelete.value && (
          <p class="mt-2 text-xs text-ink-muted">You hold shares in one of these. Sell them before removing it.</p>
        )}
      </div>
    </div>
  );
}

function GeminiKeyForm() {
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [isConfigured, setIsConfigured] = useState(Boolean(getGeminiApiKey().trim()));
  const [justSaved, setJustSaved] = useState(false);

  const save = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;
    setGeminiApiKey(trimmed);
    setIsConfigured(true);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
    if (store.stocks.value.length > 0) store.syncAllStocks();
  };

  const clear = () => {
    clearGeminiApiKey();
    setApiKey("");
    setIsConfigured(false);
  };

  return (
    <section aria-labelledby="ai-research-heading" class="mt-8 border-t border-line pt-6">
      <div class="flex items-baseline justify-between gap-3">
        <h3 id="ai-research-heading" class="text-sm font-semibold text-ink">
          AI research
        </h3>
        <span class={`text-xs ${isConfigured ? "text-ink-soft" : "text-ink-subtle"}`}>
          {isConfigured ? "Key saved" : "Optional"}
        </span>
      </div>
      <p class="mt-1 text-sm text-ink-muted">
        Research reports and company-name search run on your own Gemini API key. Keys are free from Google
        AI Studio and stay in this browser.
      </p>
      <form
        class="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label for="welcome-gemini-key" class="sr-only">
          Gemini API key
        </label>
        <input
          id="welcome-gemini-key"
          type="password"
          autocomplete="off"
          value={apiKey}
          onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
          placeholder="Paste a Gemini API key"
          class={`${input} h-9`}
        />
        <button type="submit" disabled={!apiKey.trim()} class={`${btn.secondary} ${size.md} h-9 shrink-0`}>
          {justSaved ? "Saved" : isConfigured ? "Update" : "Save"}
        </button>
        {isConfigured && (
          <button type="button" onClick={clear} class={`${btn.ghost} ${size.md} h-9 shrink-0`}>
            Remove
          </button>
        )}
      </form>
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noreferrer"
        class="mt-2 inline-block text-xs text-ink-muted underline decoration-ink-faint underline-offset-[3px] hover:text-ink hover:decoration-ink"
      >
        Get a free key from Google AI Studio
      </a>
    </section>
  );
}

export function Instructions({ multi }: InstructionsProps) {
  if (multi) return <MultiSelectPanel />;

  const first = store.stocks.value[0];

  return (
    <div class="flex h-full w-full items-center justify-center overflow-y-auto p-6 sm:p-10">
      <div class="w-full max-w-lg">
        <h2 class="text-xl font-semibold text-balance text-ink">Select a stock to see its chart</h2>
        <p class="mt-1.5 text-sm text-ink-muted">
          Quotes refresh every 20 seconds while NYSE, NASDAQ and TSX are open. Each stock also has a Research
          view: an AI-written report grounded in a live web search.
        </p>
        <div class="mt-5">
          {first ? (
            <button
              type="button"
              onClick={() => store.clickStock(first.symbol, false)}
              class={`${btn.primary} ${size.lg}`}
            >
              Open {first.symbol}
            </button>
          ) : (
            <button type="button" onClick={() => (store.isAddModalOpen.value = true)} class={`${btn.primary} ${size.lg}`}>
              Add a stock
            </button>
          )}
        </div>

        <GeminiKeyForm />

        <section aria-labelledby="shortcuts-heading" class="mt-8 border-t border-line pt-6">
          <h3 id="shortcuts-heading" class={label}>
            Keyboard
          </h3>
          <dl class="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
            {SHORTCUTS.map(([keys, action]) => (
              <div key={keys} class="contents">
                <dt>
                  <Kbd>{keys}</Kbd>
                </dt>
                <dd class="text-ink-muted">{action}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
