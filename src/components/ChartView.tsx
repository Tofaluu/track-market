// Stock detail: live quote header, interactive Yahoo Finance price chart and key stats.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { formatPercentChange, formatPrice, formatSignedChange, formatVolume } from "../format";
import { fetchYahooChartSeries, type YahooChartPoint, type YahooHistoricalChart } from "../services/yahooFinance";
import { store } from "../state";
import type { Stock } from "../stocks";
import { btn, label, segment, segmented, size } from "./ui";

type Timeframe = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "ALL";

const TIMEFRAMES: { label: string; value: Timeframe; long: string }[] = [
  { label: "1D", value: "1D", long: "today" },
  { label: "5D", value: "5D", long: "the past 5 days" },
  { label: "1M", value: "1M", long: "the past month" },
  { label: "6M", value: "6M", long: "the past 6 months" },
  { label: "1Y", value: "1Y", long: "the past year" },
  { label: "5Y", value: "5Y", long: "the past 5 years" },
  { label: "ALL", value: "ALL", long: "all time" },
];

const PADDING = { top: 20, right: 72, bottom: 32, left: 12 };

type ChartViewProps = {
  stock: Stock;
};

export function ChartView({ stock }: ChartViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartData, setChartData] = useState<YahooHistoricalChart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<YahooChartPoint | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 380 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setDimensions({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadChartData = async (tf: Timeframe) => {
    setIsLoading(true);
    setHasError(false);
    setHoveredIndex(null);
    setSelectedPoint(null);
    const result = await fetchYahooChartSeries(stock.symbol, tf, stock.sector, stock.currency);
    if (result && result.points.length > 0) {
      setChartData(result);
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadChartData(timeframe);
  }, [stock.symbol, timeframe]);

  // Keep the 1D line's last point in step with live quotes from the sync scheduler
  useEffect(() => {
    if (timeframe !== "1D" || !chartData || chartData.points.length === 0 || stock.synced === false) return;
    const lastPoint = chartData.points[chartData.points.length - 1];
    if (!lastPoint || lastPoint.price === stock.price) return;
    const now = new Date();
    const points = [...chartData.points];
    points[points.length - 1] = {
      ...lastPoint,
      price: stock.price,
      timeStr: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }),
      dateStr: now.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }),
    };
    setChartData({ ...chartData, currentPrice: stock.price, points });
  }, [stock.price, timeframe]);

  const points = chartData?.points || [];
  const baselinePrice = useMemo(() => {
    if (!chartData) return stock.price;
    if (timeframe === "1D") return chartData.previousClose;
    return points[0]?.price ?? chartData.previousClose;
  }, [chartData, timeframe, points, stock.price]);

  // Until the first live quote arrives, the chart's own data is the most accurate price.
  const live =
    stock.synced === false
      ? chartData
        ? {
            price: chartData.currentPrice,
            change: Number((chartData.currentPrice - chartData.previousClose).toFixed(2)),
            percentChange:
              chartData.previousClose > 0
                ? Number((((chartData.currentPrice - chartData.previousClose) / chartData.previousClose) * 100).toFixed(2))
                : 0,
          }
        : null
      : { price: stock.price, change: stock.change, percentChange: stock.percentChange };

  // The header follows the live quote unless the user pinned a point on the chart
  const displayPrice = selectedPoint ? selectedPoint.price : live?.price;
  const displayChange = selectedPoint ? Number((selectedPoint.price - baselinePrice).toFixed(2)) : live?.change ?? 0;
  const displayPercentChange = selectedPoint
    ? baselinePrice > 0
      ? Number((((selectedPoint.price - baselinePrice) / baselinePrice) * 100).toFixed(2))
      : 0
    : live?.percentChange ?? 0;
  const isPositive = displayChange >= 0;

  const plotWidth = Math.max(dimensions.width - PADDING.left - PADDING.right, 50);
  const plotHeight = Math.max(dimensions.height - PADDING.top - PADDING.bottom, 50);

  const { minPrice, maxPrice, scaleX, scaleY, pathD, areaD, yTicks, xLabels } = useMemo(() => {
    if (points.length === 0) {
      return {
        minPrice: 0,
        maxPrice: 0,
        scaleX: (_i: number) => 0,
        scaleY: (_p: number) => 0,
        pathD: "",
        areaD: "",
        yTicks: [] as { price: number; y: number }[],
        xLabels: [] as { text: string; x: number }[],
      };
    }

    let min = Infinity;
    let max = -Infinity;
    for (const pt of points) {
      if (pt.price < min) min = pt.price;
      if (pt.price > max) max = pt.price;
    }
    // In the 1D view, keep the previous-close baseline inside the scale
    if (timeframe === "1D" && chartData?.previousClose) {
      min = Math.min(min, chartData.previousClose);
      max = Math.max(max, chartData.previousClose);
    }

    const diff = max - min;
    const buffer = diff > 0 ? diff * 0.08 : min * 0.02 || 1;
    const effectiveMin = Math.max(0, min - buffer);
    const effectiveRange = max + buffer - effectiveMin || 1;

    const sx = (index: number) =>
      points.length <= 1 ? PADDING.left : PADDING.left + (index / (points.length - 1)) * plotWidth;
    const sy = (price: number) => PADDING.top + plotHeight - ((price - effectiveMin) / effectiveRange) * plotHeight;

    let d = "";
    for (let i = 0; i < points.length; i++) {
      d += `${i === 0 ? "M" : " L"} ${sx(i).toFixed(1)},${sy(points[i].price).toFixed(1)}`;
    }
    const bottom = (PADDING.top + plotHeight).toFixed(1);
    const area = `${d} L ${(PADDING.left + plotWidth).toFixed(1)},${bottom} L ${PADDING.left.toFixed(1)},${bottom} Z`;

    const ticks: { price: number; y: number }[] = [];
    for (let i = 0; i <= 4; i++) {
      const p = effectiveMin + (i / 4) * effectiveRange;
      ticks.push({ price: p, y: sy(p) });
    }

    const labels: { text: string; x: number }[] = [];
    // Fewer time labels on narrow charts so they never collide
    const xTickCount = Math.min(points.length, plotWidth < 480 ? 3 : 5);
    for (let i = 0; i < xTickCount; i++) {
      const idx = Math.floor((i / (xTickCount - 1 || 1)) * (points.length - 1));
      const pt = points[idx];
      if (pt) labels.push({ text: timeframe === "1D" ? pt.timeStr : pt.dateStr, x: sx(idx) });
    }

    return { minPrice: min, maxPrice: max, scaleX: sx, scaleY: sy, pathD: d, areaD: area, yTicks: ticks, xLabels: labels };
  }, [points, timeframe, chartData?.previousClose, plotWidth, plotHeight]);

  const indexAtClientX = (clientX: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const clamped = Math.max(PADDING.left, Math.min(PADDING.left + plotWidth, clientX - rect.left));
    return Math.round(((clamped - PADDING.left) / plotWidth) * (points.length - 1));
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!containerRef.current || points.length === 0) return;
    setHoveredIndex(indexAtClientX(e.clientX));
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!containerRef.current || points.length === 0) return;
    const pt = points[indexAtClientX(e.clientX)];
    if (pt) setSelectedPoint(pt);
    if (e.pointerType !== "mouse") setHoveredIndex(null);
  };

  // Arrow keys scrub the chart, Enter pins the point, Escape returns to live.
  const onKeyDown = (e: KeyboardEvent) => {
    if (points.length === 0) return;
    const current = hoveredIndex ?? points.length - 1;
    const step = e.shiftKey ? Math.max(1, Math.round(points.length / 10)) : 1;
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = Math.max(0, current - step);
    else if (e.key === "ArrowRight") next = Math.min(points.length - 1, current + step);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = points.length - 1;
    else if (e.key === "Enter" && hoveredIndex !== null) {
      setSelectedPoint(points[hoveredIndex]);
      e.preventDefault();
      return;
    } else if (e.key === "Escape") {
      setHoveredIndex(null);
      setSelectedPoint(null);
      return;
    }
    if (next !== null) {
      setHoveredIndex(next);
      e.preventDefault();
    }
  };

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] ?? null : null;
  const hovered = hoveredPoint && hoveredIndex !== null ? { x: scaleX(hoveredIndex), y: scaleY(hoveredPoint.price) } : null;
  const selectedIndex = selectedPoint ? points.findIndex((p) => p.timestamp === selectedPoint.timestamp) : -1;
  const selected = selectedPoint && selectedIndex !== -1 ? { x: scaleX(selectedIndex), y: scaleY(selectedPoint.price) } : null;
  const prevCloseY = timeframe === "1D" && chartData?.previousClose ? scaleY(chartData.previousClose) : null;

  const lineClass = isPositive ? "stroke-up" : "stroke-down";
  const gradientId = `chart-fill-${stock.symbol}`;
  const currency = stock.currency || "USD";
  const timeframeLong = TIMEFRAMES.find((t) => t.value === timeframe)!.long;
  const changeFor = (price: number) => ({
    abs: price - baselinePrice,
    pct: baselinePrice > 0 ? ((price - baselinePrice) / baselinePrice) * 100 : 0,
  });

  const summary =
    points.length > 1
      ? `${stock.symbol} over ${timeframeLong}: from ${formatPrice(points[0].price)} to ${formatPrice(
          points[points.length - 1].price
        )} ${currency}, ranging ${formatPrice(minPrice)} to ${formatPrice(maxPrice)}. Use the arrow keys to read individual points.`
      : "";

  const stats: [string, string][] = [
    ["Prev close", chartData?.previousClose ? formatPrice(chartData.previousClose) : "—"],
    [
      "Day range",
      chartData?.dayLow && chartData?.dayHigh ? `${formatPrice(chartData.dayLow)} – ${formatPrice(chartData.dayHigh)}` : "—",
    ],
    [`${TIMEFRAMES.find((t) => t.value === timeframe)!.label} range`, minPrice > 0 ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}` : "—"],
    [
      "52-week range",
      chartData?.fiftyTwoWeekLow && chartData?.fiftyTwoWeekHigh
        ? `${formatPrice(chartData.fiftyTwoWeekLow)} – ${formatPrice(chartData.fiftyTwoWeekHigh)}`
        : "—",
    ],
    ["Volume", chartData?.volume ? formatVolume(chartData.volume) : "—"],
  ];

  return (
    <div class="flex h-full min-h-0 flex-1 flex-col overflow-y-auto bg-canvas px-4 py-5 sm:px-6 md:overflow-hidden">
      <header class="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-4 pb-5">
        <div class="min-w-0">
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
          <p class="mt-0.5 text-sm text-ink-muted">
            <span class="font-medium text-ink-soft">{stock.symbol}</span>
            <span aria-hidden="true"> · </span>
            {currency}
            {stock.sector && (
              <>
                <span aria-hidden="true"> · </span>
                {stock.sector}
              </>
            )}
          </p>

          <div class="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-3xl font-semibold tracking-[-0.02em] tabular-nums text-ink">
              {displayPrice !== undefined ? formatPrice(displayPrice) : "—"}
            </span>
            {displayPrice !== undefined && (
              <span class={`text-sm font-medium tabular-nums ${isPositive ? "text-up" : "text-down"}`}>
                {formatSignedChange(displayChange)} ({formatPercentChange(displayPercentChange)})
                <span aria-hidden="true"> {isPositive ? "↑" : "↓"}</span>
              </span>
            )}
            <span class="text-xs text-ink-subtle">
              {selectedPoint
                ? `${selectedPoint.dateStr}, ${selectedPoint.timeStr}`
                : store.isMarketOpen.value
                  ? "Live"
                  : "At close"}
            </span>
            {selectedPoint && (
              <button type="button" onClick={() => setSelectedPoint(null)} class={`${btn.ghost} ${size.sm} -my-1`}>
                Back to live
              </button>
            )}
          </div>
        </div>

        <div class="flex flex-col items-end gap-3 max-sm:w-full max-sm:items-stretch">
          <div class="flex gap-2 max-sm:order-2">
            {/* Desktop switches views from the toolbar */}
            <button type="button" onClick={() => store.setViewMode("ai")} class={`${btn.secondary} ${size.md} max-sm:flex-1 md:hidden`}>
              Research
            </button>
            <button
              type="button"
              onClick={() => {
                if (store.user.value) store.isTradeModalOpen.value = true;
                else store.isAuthModalOpen.value = true;
              }}
              class={`${btn.primary} ${size.md} max-sm:flex-1`}
            >
              Trade
            </button>
          </div>
          <div class={`${segmented} max-sm:order-1`} role="group" aria-label="Timeframe">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                aria-pressed={timeframe === tf.value}
                onClick={() => {
                  setTimeframe(tf.value);
                  setSelectedPoint(null);
                }}
                class={`${segment(timeframe === tf.value)} h-7 tabular-nums max-sm:flex-1`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div
        ref={containerRef}
        tabIndex={points.length > 0 ? 0 : -1}
        role="group"
        aria-roledescription="price chart"
        aria-label={`${stock.symbol} price chart, ${timeframeLong}`}
        aria-describedby={summary ? `chart-summary-${stock.symbol}` : undefined}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerCancel={() => setHoveredIndex(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHoveredIndex(null)}
        style={{ touchAction: "pan-y" }}
        class="relative flex min-h-[240px] flex-1 cursor-crosshair select-none items-center justify-center overflow-hidden rounded-lg border border-line"
      >
        {summary && (
          <p id={`chart-summary-${stock.symbol}`} class="sr-only">
            {summary}
          </p>
        )}
        {isLoading ? (
          <div class="absolute inset-0 p-6" aria-label={`Loading ${stock.symbol} chart`}>
            <div class="h-full w-full animate-pulse rounded bg-surface" />
          </div>
        ) : hasError || points.length === 0 ? (
          <div class="flex flex-col items-center gap-1.5 p-6 text-center" role="alert">
            <p class="text-sm font-medium text-ink-soft">Couldn’t load the {stock.symbol} chart.</p>
            <p class="text-xs text-ink-muted">Yahoo Finance didn’t respond. Check your connection, then retry.</p>
            <button type="button" onClick={() => loadChartData(timeframe)} class={`${btn.secondary} ${size.sm} mt-2`}>
              Retry
            </button>
          </div>
        ) : (
          <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} aria-hidden="true">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: `var(--color-${isPositive ? "up" : "down"})`, stopOpacity: 0.16 }} />
                <stop offset="100%" style={{ stopColor: `var(--color-${isPositive ? "up" : "down"})`, stopOpacity: 0 }} />
              </linearGradient>
            </defs>

            {yTicks.map((tick, i) => (
              <g key={i}>
                <line x1={PADDING.left} y1={tick.y} x2={PADDING.left + plotWidth} y2={tick.y} class="stroke-line" stroke-width="1" />
                <text x={PADDING.left + plotWidth + 10} y={tick.y + 4} class="fill-ink-subtle text-2xs tabular-nums">
                  {formatPrice(tick.price)}
                </text>
              </g>
            ))}

            {prevCloseY !== null && (
              <line
                x1={PADDING.left}
                y1={prevCloseY}
                x2={PADDING.left + plotWidth}
                y2={prevCloseY}
                class="stroke-ink-faint"
                stroke-dasharray="4 4"
                stroke-width="1"
              />
            )}

            <path d={areaD} fill={`url(#${gradientId})`} />
            <path d={pathD} fill="none" class={lineClass} stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />

            {xLabels.map((lbl, i) => (
              <text
                key={i}
                x={lbl.x}
                y={dimensions.height - 11}
                text-anchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
                class="fill-ink-subtle text-2xs tabular-nums"
              >
                {lbl.text}
              </text>
            ))}

            {selected && (
              <g>
                <line x1={selected.x} y1={PADDING.top} x2={selected.x} y2={PADDING.top + plotHeight} class="stroke-ink-soft" stroke-width="1" />
                <circle cx={selected.x} cy={selected.y} r="4" class="fill-ink" />
              </g>
            )}

            {hovered && hoveredPoint && (
              <g>
                <line x1={hovered.x} y1={PADDING.top} x2={hovered.x} y2={PADDING.top + plotHeight} class="stroke-ink-faint" stroke-width="1" />
                <circle
                  cx={hovered.x}
                  cy={hovered.y}
                  r="4"
                  class={`fill-canvas ${hoveredPoint.price >= baselinePrice ? "stroke-up" : "stroke-down"}`}
                  stroke-width="2"
                />
              </g>
            )}
          </svg>
        )}

        {hoveredPoint && hovered && (
          <div
            class="pointer-events-none absolute z-20 rounded-md border border-line-strong bg-raised px-3 py-2 text-xs shadow-[0_8px_24px_-8px_rgb(0_0_0_/_0.6)]"
            style={{
              left: `${Math.min(Math.max(8, hovered.x - 72), dimensions.width - 168)}px`,
              top: `${Math.max(8, hovered.y - 92)}px`,
            }}
            aria-live="polite"
          >
            <div class="text-ink-subtle tabular-nums">
              {hoveredPoint.dateStr}, {hoveredPoint.timeStr}
            </div>
            <div class="mt-0.5 text-sm font-semibold tabular-nums text-ink">
              {formatPrice(hoveredPoint.price)} <span class="text-2xs font-normal text-ink-subtle">{currency}</span>
            </div>
            <div class={`tabular-nums ${changeFor(hoveredPoint.price).abs >= 0 ? "text-up" : "text-down"}`}>
              {formatSignedChange(changeFor(hoveredPoint.price).abs)} ({formatPercentChange(changeFor(hoveredPoint.price).pct)})
            </div>
            {hoveredPoint.volume !== undefined && hoveredPoint.volume > 0 && (
              <div class="text-ink-subtle tabular-nums">Vol {formatVolume(hoveredPoint.volume)}</div>
            )}
            <div class="mt-1 text-2xs text-ink-subtle">
              {selectedPoint?.timestamp === hoveredPoint.timestamp ? "Pinned" : "Click or Enter to pin"}
            </div>
          </div>
        )}
      </div>

      <dl class="mt-4 grid shrink-0 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([name, value]) => (
          <div key={name}>
            <dt class={label}>{name}</dt>
            <dd class="mt-0.5 text-sm font-medium tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p class="mt-3 shrink-0 text-xs text-ink-subtle">Quotes and charts from Yahoo Finance. Prices in {currency}.</p>
    </div>
  );
}
