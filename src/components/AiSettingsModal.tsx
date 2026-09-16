import { useState } from "preact/hooks";
import { clearGeminiApiKey, getGeminiApiKey, setGeminiApiKey } from "../services/gemini";
import { store } from "../state";

type AiSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AiSettingsModal({ isOpen, onClose }: AiSettingsModalProps) {
  if (!isOpen) return null;

  const currentKey = getGeminiApiKey();
  const [apiKey, setApiKey] = useState(currentKey);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (apiKey.trim()) {
      setGeminiApiKey(apiKey.trim());
      setSaved(true);
      if (store.stocks.value.length > 0) {
        store.syncAllStocks();
      }
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 700);
    } else {
      clearGeminiApiKey();
      setApiKey("");
      onClose();
    }
  };

  const handleClear = () => {
    clearGeminiApiKey();
    setApiKey("");
    setSaved(false);
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        class="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 class="text-base font-bold text-white">Gemini AI Configuration</h3>
              <p class="text-xs text-zinc-400">Live price queries & equity research</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="text-zinc-500 hover:text-zinc-300 transition"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div class="mt-4 space-y-3 text-xs text-zinc-300">
          <p class="leading-relaxed">
            TrackMarket uses <strong>Google Gemini 3.7 Flash</strong> with real-time web search grounding to fetch live stock prices and generate research summaries.
          </p>

          <div>
            <label class="mb-1.5 block font-semibold text-zinc-300">Gemini API Key</label>
            <input
              type="password"
              value={apiKey}
              onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
              placeholder="AIzaSy..."
              class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div class="flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Don't have a key?{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                class="font-semibold text-violet-400 hover:underline"
              >
                Get a free key at Google AI Studio →
              </a>
            </span>
          </div>

          <div class="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] text-zinc-400">
            <svg class="h-4 w-4 shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div>
              <strong>Private & Secure:</strong> Your API key is stored strictly in your browser's local storage and is sent directly from your device to Google's API. It is never stored on any server.
            </div>
          </div>

          <div class="border-t border-zinc-800/80 pt-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-semibold text-zinc-300">Watchlist Cache</p>
                <p class="text-[11px] text-zinc-500">Clear all stocks from your watchlist</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Clear all stocks from your watchlist?")) {
                    store.resetToDefaultWatchlist();
                    onClose();
                  }
                }}
                class="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Clear Watchlist
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between gap-3">
          {currentKey && (
            <button
              type="button"
              onClick={handleClear}
              class="text-xs text-rose-400 hover:underline"
            >
              Remove Key
            </button>
          )}
          <div class="flex-1" />
          <button
            type="button"
            onClick={onClose}
            class="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-750 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            class="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-violet-500 transition"
          >
            {saved ? "Saved! ✓" : "Save Key"}
          </button>
        </div>
      </div>
    </div>
  );
}
