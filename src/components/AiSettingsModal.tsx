// Settings dialog: the Gemini API key and watchlist reset.
import { useState } from "preact/hooks";
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from "../services/gemini";
import { store } from "../state";
import { Dialog, DialogHeader } from "./Dialog";
import { btn, input, size } from "./ui";

type AiSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
  return isOpen ? <SettingsDialog onClose={onClose} /> : null;
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [hasStoredKey, setHasStoredKey] = useState(Boolean(getGeminiApiKey()));
  const [confirmingClear, setConfirmingClear] = useState(false);

  const save = (e: Event) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (trimmed) {
      setGeminiApiKey(trimmed);
      if (store.stocks.value.length > 0) store.syncAllStocks();
      store.showToast("Gemini API key saved.");
    } else {
      clearGeminiApiKey();
    }
    onClose();
  };

  const removeKey = () => {
    clearGeminiApiKey();
    setApiKey("");
    setHasStoredKey(false);
  };

  return (
    <Dialog onClose={onClose} labelledBy="settings-title">
      <DialogHeader id="settings-title" title="Settings" onClose={onClose} />

      <form onSubmit={save} class="space-y-6 px-5 py-5">
        <section class="space-y-2">
          <label for="settings-gemini-key" class="block text-sm font-medium text-ink">
            Gemini API key
          </label>
          <p id="settings-gemini-help" class="text-sm text-ink-muted">
            Used for research reports, company-name search, and quotes Yahoo Finance can’t provide. The key stays
            in this browser and is sent only to Google.
          </p>
          <input
            id="settings-gemini-key"
            data-autofocus
            type="password"
            autocomplete="off"
            aria-describedby="settings-gemini-help"
            value={apiKey}
            onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            placeholder="AIza…"
            class={`${input} h-9`}
          />
          <div class="flex items-center justify-between gap-3 text-xs">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              class="text-ink-muted underline decoration-ink-faint underline-offset-[3px] hover:text-ink hover:decoration-ink"
            >
              Get a free key from Google AI Studio
            </a>
            {hasStoredKey && (
              <button type="button" onClick={removeKey} class="text-ink-muted hover:text-down">
                Remove key
              </button>
            )}
          </div>
        </section>

        <section class="flex items-center justify-between gap-4 border-t border-line pt-5">
          <div>
            <p class="text-sm font-medium text-ink">Watchlist</p>
            <p class="text-xs text-ink-muted">
              {confirmingClear ? "Remove every stock from the watchlist?" : "Remove every stock and start over."}
            </p>
          </div>
          {confirmingClear ? (
            <div class="flex shrink-0 gap-2">
              <button type="button" onClick={() => setConfirmingClear(false)} class={`${btn.ghost} ${size.sm}`}>
                Keep
              </button>
              <button
                type="button"
                onClick={() => {
                  store.resetToDefaultWatchlist();
                  onClose();
                }}
                class={`${btn.danger} ${size.sm}`}
              >
                Clear watchlist
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingClear(true)} class={`${btn.secondary} ${size.sm} shrink-0`}>
              Clear watchlist
            </button>
          )}
        </section>

        <div class="flex justify-end gap-2 border-t border-line pt-5">
          <button type="button" onClick={onClose} class={`${btn.ghost} ${size.md}`}>
            Cancel
          </button>
          <button type="submit" class={`${btn.primary} ${size.md}`}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
