// Shared class vocabulary so every button, input and chip has the same shape and states.
const base =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out motion-safe:enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const btn = {
  primary: `${base} bg-ink text-canvas hover:bg-white`,
  secondary: `${base} border border-line-strong bg-raised text-ink-soft hover:bg-raised-hover hover:text-ink`,
  ghost: `${base} text-ink-muted hover:bg-raised hover:text-ink`,
  danger: `${base} border border-down/40 text-down hover:bg-down/10`,
};

export const size = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-sm",
};

export const input =
  "w-full rounded-md border border-line-strong bg-canvas px-3 text-sm text-ink placeholder:text-ink-subtle transition-colors focus:border-ink-subtle";

/** Segmented control: container + item (pass `active` for the selected one). */
export const segmented = "flex items-center rounded-md border border-line bg-canvas p-0.5";
export const segment = (active: boolean) =>
  `flex items-center justify-center gap-1.5 rounded-[5px] px-2.5 text-xs font-medium transition-colors ${
    active ? "bg-raised-hover text-ink" : "text-ink-subtle hover:text-ink"
  }`;

/** Small uppercase label for stat tiles and table headers. */
export const label = "text-2xs font-medium uppercase tracking-[0.06em] text-ink-subtle";
