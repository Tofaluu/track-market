// Top toolbar with application branding, live streaming controls, undo/redo, view toggles, and universal stock search modal.
import { useState } from "preact/hooks";
import { APP_TITLE } from "../constants";
import { store } from "../state";
import { AddStockModal } from "./AddStockModal";
import { AiSettingsModal } from "./AiSettingsModal";
import { supabase } from "../services/supabase";

type ToolbarProps = {
  onAdd?: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function Toolbar({ onDelete, onUndo, onRedo }: ToolbarProps) {
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState(false);
  const canSingle = store.hasSingleSelection.value;
  const mode = store.viewMode.value;
  const selectedCount = store.selectedCount.value;

  return (
    <>
      <header class="relative z-20 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/90 px-4 backdrop-blur-md">
        {/* Brand & Market Status */}
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/30">
              <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span class="text-base font-bold tracking-tight text-white">{APP_TITLE}</span>
          </div>

          <div class="h-4 w-[1px] bg-zinc-800" />

          {/* Market Status (Open vs Closed) */}
          <div class="flex items-center gap-2">
            <div
              class={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                store.isMarketOpen.value
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-400"
              }`}
              title={
                store.isMarketOpen.value
                  ? "US & Canadian exchanges are open (9:30 AM - 4:00 PM ET)"
                  : "Markets closed overnight/weekend. Official closing prices held."
              }
            >
              <span class="relative flex h-2 w-2">
                {store.isMarketOpen.value && (
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  class={`relative inline-flex h-2 w-2 rounded-full ${
                    store.isMarketOpen.value ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
              </span>
              <span>{store.isMarketOpen.value ? "MARKET OPEN" : "MARKET CLOSED"}</span>
            </div>
          </div>
        </div>

        {/* Middle & Right Controls */}
        <div class="flex items-center gap-2">
          {/* Undo / Redo buttons */}
          <div class="flex items-center rounded-lg border border-zinc-800 bg-zinc-950/60 p-0.5">
            <button
              type="button"
              onClick={onUndo}
              disabled={!store.canUndo.value}
              title="Undo last action (Shift+U)"
              class="flex h-7 w-8 items-center justify-center rounded text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-transparent"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!store.canRedo.value}
              title="Redo action (Shift+R)"
              class="flex h-7 w-8 items-center justify-center rounded text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-600 disabled:hover:bg-transparent"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
            </button>
          </div>

          <div class="h-4 w-[1px] bg-zinc-800" />

          {/* Add Stock & Delete Action Buttons */}
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => store.isAddModalOpen.value = true}
              disabled={!store.canAdd.value}
              title="Search & add any stock from global directory"
              class="flex h-7 items-center gap-1.5 rounded-lg border border-emerald-600/40 bg-emerald-600/15 px-3 text-xs font-semibold text-emerald-300 shadow-sm transition hover:bg-emerald-600/25 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Stock</span>
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={!store.canDelete.value}
              title="Delete selected stocks (Delete key)"
              class="flex h-7 items-center gap-1.5 rounded-lg border border-rose-600/40 bg-rose-600/15 px-3 text-xs font-semibold text-rose-300 shadow-sm transition hover:bg-rose-600/25 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete</span>
              {selectedCount > 1 && (
                <span class="rounded bg-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold text-rose-200">
                  {selectedCount}
                </span>
              )}
            </button>
          </div>

          <div class="h-4 w-[1px] bg-zinc-800" />

          {/* View Mode Segmented Controls (Chart, AI Analyst) */}
          <div class="flex items-center rounded-lg border border-zinc-800 bg-zinc-950/80 p-0.5">
            <button
              type="button"
              onClick={() => store.setViewMode("chart")}
              disabled={!canSingle}
              class={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                mode === "chart" && canSingle
                  ? "bg-zinc-800 text-white shadow"
                  : "text-zinc-400 hover:text-zinc-200 disabled:cursor-not-allowed disabled:text-zinc-650"
              }`}
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span>Chart</span>
            </button>

            <button
              type="button"
              onClick={() => store.setViewMode("ai")}
              disabled={!canSingle}
              class={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${
                mode === "ai" && canSingle
                  ? "bg-violet-600 text-white shadow"
                  : "text-zinc-400 hover:text-violet-300 disabled:cursor-not-allowed disabled:text-zinc-650"
              }`}
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              <span>AI Analyst</span>
            </button>
          </div>

          {/* AI Settings Trigger */}
          <button
            type="button"
            onClick={() => setIsAiSettingsOpen(true)}
            title="Configure Gemini API Key"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 text-xs text-zinc-400 hover:border-zinc-700 hover:text-white transition"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>

          <div class="h-4 w-[1px] bg-zinc-800" />

          {/* User Auth */}
          {store.user.value ? (
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-zinc-400">
                {store.user.value.user_metadata?.username || store.user.value.email?.split("@")[0]}
              </span>
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                title="Sign Out"
                class="flex h-7 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-white transition"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => (store.isAuthModalOpen.value = true)}
              class="flex h-7 items-center justify-center rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Universal Search & Add Modal */}
      <AddStockModal isOpen={store.isAddModalOpen.value} onClose={() => store.isAddModalOpen.value = false} />

      {/* AI Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
      />
    </>
  );
}
