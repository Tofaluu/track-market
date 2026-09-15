import { useEffect, useMemo, useState } from "preact/hooks";
import { marked } from "marked";
import { formatPercentChange, formatPrice, formatSignedChange } from "../format";
import {
  analyzeCompanyWithAI,
  getGeminiApiKey,
  type AnalysisTopic,
} from "../services/gemini";
import { store } from "../state";
import type { Stock } from "../stocks";
import { AiSettingsModal } from "./AiSettingsModal";

marked.setOptions({
  gfm: true,
  breaks: true,
});

type AiAnalystViewProps = {
  stock: Stock;
};

type CachedReport = {
  activeTopic: AnalysisTopic | null;
  analysisText: string;
  customQuestion: string;
};

// Global cache preserving generated reports across view toggles and stock switches
const reportCache = new Map<string, CachedReport>();

export function AiAnalystView({ stock }: AiAnalystViewProps) {
  const cached = reportCache.get(stock.symbol.toUpperCase());
  const [activeTopic, setActiveTopic] = useState<AnalysisTopic | null>(
    cached?.activeTopic ?? null
  );
  const [analysisText, setAnalysisText] = useState<string>(
    cached?.analysisText ?? ""
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customQuestion, setCustomQuestion] = useState<string>(
    cached?.customQuestion ?? ""
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Sync state when selected stock changes
  useEffect(() => {
    const existing = reportCache.get(stock.symbol.toUpperCase());
    if (existing) {
      setActiveTopic(existing.activeTopic);
      setAnalysisText(existing.analysisText);
      setCustomQuestion(existing.customQuestion);
    } else {
      setActiveTopic(null);
      setAnalysisText("");
      setCustomQuestion("");
    }
    setErrorMsg(null);
  }, [stock.symbol]);

  const hasApiKey = Boolean(getGeminiApiKey());

  const handleRunAnalysis = async (topic: AnalysisTopic, question?: string) => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }

    setActiveTopic(topic);
    setIsLoading(true);
    setErrorMsg(null);
    setAnalysisText("");

    try {
      const result = await analyzeCompanyWithAI(
        stock.symbol,
        stock.name,
        topic,
        question,
        {
          price: stock.price,
          currency: stock.currency,
          change: stock.change,
          percentChange: stock.percentChange,
          sector: stock.sector,
        }
      );
      setAnalysisText(result);

      // Cache report so switching between chart and AI view never resets the answer
      reportCache.set(stock.symbol.toUpperCase(), {
        activeTopic: topic,
        analysisText: result,
        customQuestion: question ?? customQuestion,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate AI analysis");
    } finally {
      setIsLoading(false);
    }
  };

  const renderedHtml = useMemo(() => {
    if (!analysisText) return "";
    try {
      return marked.parse(analysisText) as string;
    } catch {
      return analysisText;
    }
  }, [analysisText]);

  return (
    <div class="flex h-full min-h-0 flex-1 flex-col bg-zinc-950 p-6 overflow-hidden">
      {/* Header Banner - exact same position and layout as Chart View */}
      <div class="mb-4 flex flex-wrap items-start justify-between gap-4 border-b border-zinc-800/80 pb-4 shrink-0">
        <div>
          <div class="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => (store.selectedSymbols.value = new Set())}
              class="md:hidden flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition mr-1"
            >
              <svg class="h-4 w-4 pr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <h2 class="text-2xl font-bold tracking-tight text-white">{stock.name}</h2>
            <span class="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                {stock.symbol}
              </span>
              <span class="rounded-md bg-zinc-900 border border-zinc-700/80 px-2 py-0.5 text-xs font-semibold text-zinc-300">
                {stock.currency || "USD"}
              </span>
              {stock.sector && (
                <span class="rounded-md bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                  {stock.sector}
                </span>
              )}
              <span class="rounded-md bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[11px] font-medium text-violet-300 flex items-center gap-1.5">
                <span class="relative flex h-1.5 w-1.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" />
                </span>
                <span>Gemini 3.6 AI Analyst</span>
              </span>
            </div>

            {/* Hero Price Display */}
            <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div class="flex items-baseline gap-1.5">
                <span class="text-3xl font-extrabold tracking-tight text-white tabular-nums">
                  {formatPrice(stock.price)}
                </span>
                <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  {stock.currency || "USD"}
                </span>
              </div>
              <div
                class={`flex items-center gap-1 text-sm font-semibold tabular-nums ${
                  stock.change >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                <span>
                  {formatSignedChange(stock.change)} ({formatPercentChange(stock.percentChange)})
                </span>
                <span>{stock.change >= 0 ? "↑" : "↓"}</span>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <span class="h-6 inline-flex items-center text-xs text-zinc-400">
                  {store.isMarketOpen.value ? "Live Market Session" : "Market Closed"}
                </span>

                {/* Back to Chart Button */}
                <button
                  type="button"
                  onClick={() => store.setViewMode("chart")}
                  class="h-6 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:text-white transition shadow-sm"
                  title="Return to interactive financial chart"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                  <span>Back to Interactive Chart</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI Settings */}
          <div class="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Configure Gemini API Key"
              class="inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition shadow-sm"
            >
              <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>AI Settings</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div class="min-h-0 flex-1 overflow-y-auto space-y-5 pb-16 pr-1 select-text">
          {/* Error Alert */}
          {errorMsg && (
          <div class="rounded-xl border border-rose-500/40 bg-rose-950/20 p-4 text-xs text-rose-300">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-1.5">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                {errorMsg}
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                class="font-semibold underline hover:text-white"
              >
                Open AI Settings
              </button>
            </div>
          </div>
        )}

        {/* Quick Research Actions Grid */}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => handleRunAnalysis("summary")}
            disabled={isLoading}
            class={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              activeTopic === "summary"
                ? "border-violet-500 bg-violet-950/30 ring-1 ring-violet-500/50"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850/60"
            }`}
          >
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>
              <span class="text-xs font-bold text-white">Company & Moat</span>
            </div>
            <p class="mt-1.5 text-[11px] text-zinc-400">
              Core business model, competitive moat, and target customers.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRunAnalysis("past_week")}
            disabled={isLoading}
            class={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              activeTopic === "past_week"
                ? "border-violet-500 bg-violet-950/30 ring-1 ring-violet-500/50"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850/60"
            }`}
          >
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
              <span class="text-xs font-bold text-white">Past Week Drivers</span>
            </div>
            <p class="mt-1.5 text-[11px] text-zinc-400">
              Why it moved this week: company news, politics, or macro shifts.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRunAnalysis("trajectory")}
            disabled={isLoading}
            class={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              activeTopic === "trajectory"
                ? "border-violet-500 bg-violet-950/30 ring-1 ring-violet-500/50"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850/60"
            }`}
          >
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 3.82-13.43c2.35-3.3 6.94-3.3 6.94-3.3s.06 4.67-3.15 7.15A22 22 0 0 1 12 15Z"/><path d="M9 11 4.5 6.5"/><path d="m13 15 4.5 4.5"/><path d="m14 10-1-1"/></svg>
              <span class="text-xs font-bold text-white">Future Trajectory</span>
            </div>
            <p class="mt-1.5 text-[11px] text-zinc-400">
              Growth tailwinds, bull/bear cases, and 2-5 year roadmap.
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleRunAnalysis("risks")}
            disabled={isLoading}
            class={`flex flex-col items-start rounded-xl border p-4 text-left transition ${
              activeTopic === "risks"
                ? "border-violet-500 bg-violet-950/30 ring-1 ring-violet-500/50"
                : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-850/60"
            }`}
          >
            <div class="flex items-center gap-2">
              <svg class="h-5 w-5 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              <span class="text-xs font-bold text-white">Key Risks</span>
            </div>
            <p class="mt-1.5 text-[11px] text-zinc-400">
              Macro exposure, valuation pressure, and critical threats.
            </p>
          </button>
        </div>

        {/* Custom Question Prompt Bar */}
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customQuestion.trim()) {
                handleRunAnalysis("custom", customQuestion);
              }
            }}
            class="flex gap-2"
          >
            <input
              type="text"
              value={customQuestion}
              onInput={(e) => setCustomQuestion((e.target as HTMLInputElement).value)}
              placeholder={`Ask AI anything about ${stock.symbol} (e.g. Is ${stock.symbol} good for long-term holding?)...`}
              class="flex-1 rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <button
              type="submit"
              disabled={isLoading || !customQuestion.trim()}
              class="rounded-xl bg-zinc-800 px-5 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition disabled:opacity-50"
            >
              Ask AI
            </button>
          </form>
        </div>

        {/* Analysis Output Container - Fully expands to wrap content */}
        <div class="w-full min-h-[240px] rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-xl">
          {isLoading ? (
            <div class="flex flex-col items-center justify-center py-16 text-center">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent mb-3" />
              <span class="text-xs font-medium text-zinc-300">
                Gemini 3.6 is analyzing {stock.symbol}...
              </span>
              <span class="text-[11px] text-zinc-500 mt-1">
                {activeTopic === "past_week"
                  ? "Searching Google for past week news & events..."
                  : "Synthesizing financial reports & market trends"}
              </span>
            </div>
          ) : analysisText ? (
            <div class="w-full space-y-4">
              <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span class="font-bold text-sm text-zinc-100 uppercase tracking-wider">
                  {activeTopic === "summary"
                    ? "Executive Overview"
                    : activeTopic === "past_week"
                    ? "Past Week Price Drivers & News"
                    : activeTopic === "trajectory"
                    ? "Trajectory & Catalyst Report"
                    : activeTopic === "risks"
                    ? "Risk Assessment"
                    : customQuestion}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(analysisText)}
                  class="flex items-center gap-1.5 rounded-lg border border-zinc-750 bg-zinc-850 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-700 hover:text-white transition"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  <span>Copy Text</span>
                </button>
              </div>
              <div
                class="ai-markdown"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          ) : (
            <div class="flex flex-col items-center justify-center py-14 text-center text-zinc-500">
              <div class="mb-4 text-zinc-600">
                <svg class="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              </div>
              <p class="text-xs">
                Select one of the research modules above or click <strong>Query Real-World Live Price</strong> to begin.
              </p>
              {!hasApiKey && (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  class="mt-3 rounded-lg bg-violet-600/20 border border-violet-500/30 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-600/30 transition"
                >
                  + Configure Gemini API Key to enable AI features
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AiSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
