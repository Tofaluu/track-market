import { store } from "../state";

export function Toast() {
  const msg = store.toastMessage.value;
  if (!msg) return null;

  return (
    <>
      <style>{`
        @keyframes toast-slide-up {
          0% { opacity: 0; transform: translateY(20px) scale(0.95); }
          10% { opacity: 1; transform: translateY(0) scale(1); }
          90% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(10px) scale(0.95); }
        }
        .toast-anim {
          animation: toast-slide-up 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div class="fixed bottom-6 right-6 z-[100] toast-anim pointer-events-none">
        <div class="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-950/80 px-4 py-3 shadow-2xl backdrop-blur-md ring-1 ring-emerald-500/10">
          <div class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-emerald-100">{msg}</span>
        </div>
      </div>
    </>
  );
}
