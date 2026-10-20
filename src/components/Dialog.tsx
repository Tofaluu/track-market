// Shared modal shell: dialog semantics, Escape to close, focus trapped inside and restored on close.
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

type DialogProps = {
  onClose: () => void;
  /** id of the element that names the dialog (usually its heading) */
  labelledBy: string;
  /** Tailwind width class for the panel */
  width?: string;
  children: ComponentChildren;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({ onClose, labelledBy, width = "max-w-md", children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Respect an explicit autofocus target, otherwise focus the first control.
    const initial =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        class={`w-full ${width} overflow-hidden rounded-xl border border-line-strong bg-surface shadow-[0_24px_64px_-16px_rgb(0_0_0_/_0.7)]`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type DialogHeaderProps = {
  id: string;
  title: string;
  description?: string;
  onClose: () => void;
};

export function DialogHeader({ id, title, description, onClose }: DialogHeaderProps) {
  return (
    <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <h2 id={id} class="text-base font-semibold text-ink">
          {title}
        </h2>
        {description && <p class="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        class="-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition hover:bg-raised hover:text-ink"
      >
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
