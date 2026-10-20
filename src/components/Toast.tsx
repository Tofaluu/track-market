// Transient status message, announced to screen readers.
import { store } from "../state";

export function Toast() {
  const msg = store.toastMessage.value;

  return (
    <div class="pointer-events-none fixed bottom-12 right-4 z-[100]" role="status" aria-live="polite">
      {msg && (
        <div
          key={msg}
          class="toast-enter max-w-sm rounded-lg border border-line-strong bg-raised px-4 py-3 text-sm text-ink shadow-[0_12px_32px_-12px_rgb(0_0_0_/_0.6)]"
        >
          {msg}
        </div>
      )}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .toast-enter { animation: toast-in 200ms var(--ease-out-quart) both; }
        @media (prefers-reduced-motion: reduce) {
          .toast-enter { animation-name: none; }
        }
      `}</style>
    </div>
  );
}
