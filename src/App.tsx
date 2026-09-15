import { useEffect } from "preact/hooks";
import { StockDetails } from "./components/StockDetails";
import { StatusBar } from "./components/StatusBar";
import { StockList } from "./components/StockList";
import { Toolbar } from "./components/Toolbar";
import { AuthModal } from "./components/AuthModal";
import { store } from "./state";
import { initSmartCatchUpSync } from "./services/smartSync";

export function App() {
  useEffect(() => {
    // Start automatic twice-daily catch-up sync engine (9:30 AM & 4:00 PM ET)
    const cleanupSync = initSmartCatchUpSync();

    // Global keyboard shortcuts mirror toolbar actions.
    const handler = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing inside search inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      // Direct Delete / Backspace key on keyboard to delete selected stock
      if (event.key === "Delete" || event.key === "Backspace") {
        if (store.canDelete.value) {
          store.deleteSelectedStocks();
          event.preventDefault();
          return;
        }
      }

      const key = event.key.toLowerCase();
      if (!["a", "d", "c", "u", "r"].includes(key)) return;
      if (!event.shiftKey) return;

      store.handleShortcut(key);
      event.preventDefault();
    };

    window.addEventListener("keydown", handler);
    return () => {
      cleanupSync();
      window.removeEventListener("keydown", handler);
    };
  }, []);

  return (
    <main class="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100 antialiased select-none">
      <Toolbar
        onDelete={() => store.deleteSelectedStocks()}
        onUndo={() => store.undo()}
        onRedo={() => store.redo()}
      />

      <section class="flex min-h-0 flex-1">
        <StockList />
        <StockDetails />
      </section>

      <StatusBar />
      <AuthModal />
    </main>
  );
}
