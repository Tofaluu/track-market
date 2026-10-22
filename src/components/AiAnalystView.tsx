// Research view: Gemini reports grounded in live Google Search, rendered as sanitized markdown.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { marked } from "marked";
import { formatPercentChange, formatPrice, formatSignedChange } from "../format";
import { analyzeCompanyWithAI, getGeminiApiKey, type AnalysisTopic } from "../services/gemini";
import { store } from "../state";
import type { Stock } from "../stocks";
import { AiSettingsModal } from "./AiSettingsModal";
import { btn, input, label, size } from "./ui";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Model output can quote web pages, so raw HTML in it is shown as text, never parsed.
marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
  },
});

type AiAnalystViewProps = {
  stock: Stock;
};

type CachedReport = {
  activeTopic: AnalysisTopic | null;
  analysisText: string;
  customQuestion: string;
};

const TOPICS: { id: Exclude<AnalysisTopic, "custom">; title: string; blurb: string }[] = [
  { id: "summary", title: "Business and moat", blurb: "What it does and what protects it" },
  { id: "past_week", title: "Why it moved this week", blurb: "News behind the last five trading days" },
  { id: "trajectory", title: "2–5 year outlook", blurb: "Growth drivers, bull and bear cases" },
  { id: "risks", title: "Key risks", blurb: "Macro, valuation and operational exposure" },
];

// Reports survive switching between Chart and Research, and between stocks
const reportCache = new Map<string, CachedReport>();

// A report writes itself in line by line at a steady reading pace, so a long one takes longer; the cap keeps it from
// holding back what's below the fold. styles.css draws the sweep.
const paceSweep = (event: AnimationEvent) => {
  const report = event.currentTarget as HTMLElement;
  if (event.target !== report || event.animationName !== "reveal-sweep") return;
  report.style.animationDuration = `${Math.round(Math.min(2400, Math.max(600, (report.offsetHeight + 120) / 0.6)))}ms`;
};

export function AiAnalystView({ stock }: AiAnalystViewProps) {
  const cached = reportCache.get(stock.symbol.toUpperCase());
  const [activeTopic, setActiveTopic] = useState<AnalysisTopic | null>(cached?.activeTopic ?? null);
  const [analysisText, setAnalysisText] = useState(cached?.analysisText ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [customQuestion, setCustomQuestion] = useState(cached?.customQuestion ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const topicListRef = useRef<HTMLUListElement>(null);
  const [marker, setMarker] = useState<{ top: number; height: number; glide: boolean } | null>(null);

  // The highlight behind the chosen report glides to the next one; it appears in place the first time, and the list
  // re-measures when its width changes and the blurbs rewrap
  useLayoutEffect(() => {
    const list = topicListRef.current;
    if (!list) return;
    const place = (glide: boolean) => {
      const chosen = list.querySelector<HTMLElement>('[aria-current="true"]');
      setMarker((prev) => (chosen ? { top: chosen.offsetTop, height: chosen.offsetHeight, glide: glide && prev !== null } : null));
    };
    place(true);
    const observer = new ResizeObserver(() => place(false));
    observer.observe(list);
    return () => observer.disconnect();
  }, [activeTopic]);

  useEffect(() => {
    const existing = reportCache.get(stock.symbol.toUpperCase());
    setActiveTopic(existing?.activeTopic ?? null);
    setAnalysisText(existing?.analysisText ?? "");
    setCustomQuestion(existing?.customQuestion ?? "");
    setErrorMsg(null);
  }, [stock.symbol]);

  const hasApiKey = Boolean(getGeminiApiKey());

  const runReport = async (topic: AnalysisTopic, question?: string) => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (isLoading) return;
    setActiveTopic(topic);
    setIsLoading(true);
    setErrorMsg(null);
    setAnalysisText("");
    try {
      const result = await analyzeCompanyWithAI(stock.symbol, stock.name, topic, question, {
        price: stock.synced === false ? undefined : stock.price,
        currency: stock.currency,
        change: stock.change,
        percentChange: stock.percentChange,
        sector: stock.sector,
      });
      setAnalysisText(result);
      reportCache.set(stock.symbol.toUpperCase(), {
        activeTopic: topic,
        analysisText: result,
        customQuestion: question ?? customQuestion,
      });
    } catch (err: any) {
      setErrorMsg(err?.message || "Gemini didn’t return a report.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderedHtml = useMemo(() => {
    if (!analysisText) return "";
    try {
      return marked.parse(analysisText) as string;
    } catch {
      return escapeHtml(analysisText);
    }
  }, [analysisText]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(analysisText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      store.showToast("Couldn’t copy. Select the text and copy it manually.");
    }
  };

  const reportTitle =
    activeTopic === "custom" ? customQuestion : TOPICS.find((t) => t.id === activeTopic)?.title ?? "";
  const up = stock.change >= 0;

  return (
    <div class="flex h-full min-h-0 flex-1 flex-col bg-canvas">
      <header class="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-line px-4 py-5 sm:px-6">
        <div key={stock.symbol} class="enter-fade min-w-0">
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (store.selectedSymbols.value = new Set())}
              aria-label="Back to watchlist"
              class={`${btn.ghost} -ml-2 h-8 w-8 md:hidden`}
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 class="truncate text-xl font-semibold tracking-[-0.01em] text-ink">{stock.name}</h2>
          </div>
          <p class="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-sm text-ink-muted">
            <span class="font-medium text-ink-soft">{stock.symbol}</span>
            {stock.synced !== false && (
              <>
                <span class="tabular-nums text-ink-soft">
                  {formatPrice(stock.price)} {stock.currency || "USD"}
                </span>
                <span class={`tabular-nums ${up ? "text-up" : "text-down"}`}>
                  {formatSignedChange(stock.change)} ({formatPercentChange(stock.percentChange)})
                </span>
              </>
            )}
          </p>
        </div>
        {/* Desktop switches views from the toolbar */}
        <button type="button" onClick={() => store.setViewMode("chart")} class={`${btn.secondary} ${size.md} md:hidden`}>
          Chart
        </button>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Reports" class="space-y-6">
            <div>
              <h3 class={label}>Reports</h3>
              <ul ref={topicListRef} class="relative mt-2 space-y-0.5">
                {marker && (
                  <span
                    aria-hidden="true"
                    class={`pointer-events-none absolute inset-x-0 top-0 rounded-md bg-raised-hover ${
                      marker.glide ? "transition-[transform,height] duration-200 ease-out" : ""
                    }`}
                    style={{ transform: `translateY(${marker.top}px)`, height: `${marker.height}px` }}
                  />
                )}
                {TOPICS.map((topic, i) => (
                  <li key={topic.id} class="enter-rise" style={{ "--enter-delay": `${i * 35}ms` }}>
                    <button
                      type="button"
                      onClick={() => runReport(topic.id)}
                      disabled={isLoading}
                      aria-current={activeTopic === topic.id ? "true" : undefined}
                      class={`relative w-full rounded-md px-3 py-2 text-left transition-colors disabled:cursor-wait ${
                        activeTopic === topic.id ? "" : "hover:bg-raised"
                      }`}
                    >
                      <span class="block text-sm font-medium text-ink">{topic.title}</span>
                      <span class="block text-xs text-ink-muted">{topic.blurb}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customQuestion.trim()) runReport("custom", customQuestion.trim());
              }}
              class="enter-rise space-y-2"
              style={{ "--enter-delay": "140ms" }}
            >
              <label for="research-question" class={label}>
                Ask a question
              </label>
              <textarea
                id="research-question"
                rows={3}
                value={customQuestion}
                onInput={(e) => setCustomQuestion((e.target as HTMLTextAreaElement).value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
                  }
                }}
                placeholder={`e.g. How exposed is ${stock.symbol} to interest rates?`}
                class={`${input} resize-none py-2`}
              />
              <button type="submit" disabled={isLoading || !customQuestion.trim()} class={`${btn.secondary} ${size.md} w-full`}>
                Ask
              </button>
            </form>
          </nav>

          <article aria-live="polite" aria-busy={isLoading} class="enter-fade min-w-0" style={{ animationDelay: "60ms", animationFillMode: "backwards" }}>
            {errorMsg ? (
              <div role="alert" class="max-w-prose">
                <h3 class="text-sm font-semibold text-ink">The report didn’t load</h3>
                <p class="mt-1 text-sm text-ink-muted">{errorMsg}</p>
                <div class="mt-3 flex gap-2">
                  {activeTopic && (
                    <button
                      type="button"
                      onClick={() => runReport(activeTopic, activeTopic === "custom" ? customQuestion : undefined)}
                      class={`${btn.secondary} ${size.md}`}
                    >
                      Try again
                    </button>
                  )}
                  <button type="button" onClick={() => setIsSettingsOpen(true)} class={`${btn.ghost} ${size.md}`}>
                    Check API key
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div class="enter-fade max-w-[72ch]">
                <p class="text-sm text-ink-muted">
                  Searching the web and writing {reportTitle ? `“${reportTitle}”` : "the report"} for {stock.symbol}…
                </p>
                <div class="mt-5 space-y-3" aria-hidden="true">
                  {[92, 100, 84, 96, 70].map((w, i) => (
                    <div key={i} class="h-3 animate-pulse rounded bg-raised" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            ) : analysisText ? (
              <div key={`${stock.symbol}:${activeTopic}`} class="reveal-sweep max-w-[72ch]" onAnimationStart={paceSweep}>
                <div class="mb-5 flex items-baseline justify-between gap-4 border-b border-line pb-3">
                  <h3 class="text-base font-semibold text-balance text-ink">{reportTitle}</h3>
                  <button type="button" onClick={copyReport} class={`${btn.ghost} ${size.sm} shrink-0`}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <div class="ai-markdown select-text" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                <p class="mt-8 border-t border-line pt-3 text-xs text-ink-subtle">
                  Written by Gemini from a live Google Search. It can be wrong, and it isn’t financial advice.
                </p>
              </div>
            ) : hasApiKey ? (
              <div class="max-w-prose">
                <h3 class="text-sm font-semibold text-ink">Pick a report</h3>
                <p class="mt-1 text-sm text-ink-muted">
                  Each report runs a fresh Google Search, so it reflects news and earnings up to today. You can also
                  ask your own question about {stock.symbol}.
                </p>
              </div>
            ) : (
              <div class="max-w-prose">
                <h3 class="text-sm font-semibold text-ink">Research needs a Gemini API key</h3>
                <p class="mt-1 text-sm text-ink-muted">
                  Reports run on your own key, so they cost nothing to host. Keys are free from Google AI Studio and
                  stay in this browser.
                </p>
                <button type="button" onClick={() => setIsSettingsOpen(true)} class={`${btn.primary} ${size.md} mt-3`}>
                  Add API key
                </button>
              </div>
            )}
          </article>
        </div>
      </div>

      <AiSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
