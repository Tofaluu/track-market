// Top toolbar: brand, market session, watchlist actions, view switch, settings and account.
import { useState } from "preact/hooks";
import { APP_TITLE } from "../constants";
import { store } from "../state";
import { AddStockModal } from "./AddStockModal";
import { AiSettingsModal } from "./AiSettingsModal";
import { supabase } from "../services/supabase";
import { btn, segment, segmented, size } from "./ui";

type ToolbarProps = {
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

const iconButton = `${btn.ghost} h-8 w-8`;

export function Toolbar({ onDelete, onUndo, onRedo }: ToolbarProps) {
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const canSingle = store.hasSingleSelection.value;
  const mode = store.viewMode.value;
  const selectedCount = store.selectedCount.value;
  const isOpen = store.isMarketOpen.value;
  const holdsSelected = Array.from(store.selectedSymbols.value).some((sym) =>
    store.positions.value.some((p) => p.symbol === sym && p.quantity > 0)
  );

  return (
    <>
      <header class="relative z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 md:px-4">
        <div class="flex min-w-0 items-center gap-4">
          <div class="flex items-center gap-2 text-ink">
            <svg class="h-5 w-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="4" class="stroke-line-strong fill-raised/40" />
              <path d="M7 14l3-3 3 3 4-5" />
              <path d="M14 9h3v3" />
            </svg>
            <span class="text-[0.9375rem] font-semibold tracking-[-0.01em]">{APP_TITLE}</span>
          </div>

          <div
            class="flex items-center gap-1.5 text-xs text-ink-muted"
            title={
              isOpen
                ? "NYSE, NASDAQ and TSX are open (9:30 AM – 4:00 PM ET)"
                : "Markets are closed. Prices show the last close."
            }
          >
            <span class={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-up" : "bg-ink-faint"}`} aria-hidden="true" />
            <span class="hidden sm:inline">{isOpen ? "Market open" : "Market closed"}</span>
            <span class="sr-only sm:hidden">{isOpen ? "Market open" : "Market closed"}</span>
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-1 md:gap-1.5">
          <div class="hidden items-center md:flex">
            <button
              type="button"
              onClick={onUndo}
              disabled={!store.canUndo.value}
              title="Undo (Shift+U)"
              aria-label="Undo"
              class={iconButton}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!store.canRedo.value}
              title="Redo (Shift+R)"
              aria-label="Redo"
              class={iconButton}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
            </button>
          </div>

          <button
            type="button"
            onClick={() => (store.isAddModalOpen.value = true)}
            disabled={!store.canAdd.value}
            title={store.canAdd.value ? "Add a stock to the watchlist" : "Watchlist is full (50 stocks)"}
            aria-label="Add stock"
            class={`${btn.secondary} ${size.md} max-md:w-8 max-md:px-0`}
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span class="hidden md:inline">Add stock</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!store.canDelete.value}
            title={
              holdsSelected
                ? "You hold shares in this stock. Sell them before removing it."
                : "Remove selected (Delete)"
            }
            aria-label={selectedCount > 1 ? `Remove ${selectedCount} selected stocks` : "Remove selected stock"}
            class={`${btn.ghost} h-8 w-8 hover:text-down`}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
            </svg>
          </button>

          {/* Phones switch views from the stock header instead */}
          <div class={`${segmented} ml-1 hidden md:flex`} role="group" aria-label="View">
            <button
              type="button"
              onClick={() => store.setViewMode("chart")}
              disabled={!canSingle}
              aria-pressed={mode === "chart" && canSingle}
              class={`${segment(mode === "chart" && canSingle)} h-7 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Chart
            </button>
            <button
              type="button"
              onClick={() => store.setViewMode("ai")}
              disabled={!canSingle}
              aria-pressed={mode === "ai" && canSingle}
              class={`${segment(mode === "ai" && canSingle)} h-7 disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Research
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsAiSettingsOpen(true)}
            title="Gemini API key"
            aria-label="Gemini API key settings"
            class={iconButton}
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          {store.user.value ? (
            <div class="flex items-center gap-2 pl-1">
              <span class="hidden max-w-[10rem] truncate text-xs text-ink-muted sm:inline">
                {store.user.value.user_metadata?.username || store.user.value.email?.split("@")[0]}
              </span>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                class={`${btn.secondary} ${size.md}`}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (store.isAuthModalOpen.value = true)}
              class={`${btn.primary} ${size.md} ml-1`}
            >
              Sign in
            </button>
          )}
        </div>
      </header>

      <AddStockModal isOpen={store.isAddModalOpen.value} onClose={() => (store.isAddModalOpen.value = false)} />
      <AiSettingsModal isOpen={isAiSettingsOpen} onClose={() => setIsAiSettingsOpen(false)} />
    </>
  );
}
