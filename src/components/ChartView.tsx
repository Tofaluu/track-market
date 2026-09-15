// Authentic Yahoo Finance interactive chart with real exchange ticks, previous close baseline,
// dynamic crosshair scrubbing, multi-timeframe support, and 100% price parity with header and watchlist feeds.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  formatPercentChange,
  formatPrice,
  formatSignedChange,
  formatVolume,
} from "../format";
import {
  fetchYahooChartSeries,
  type YahooChartPoint,
  type YahooHistoricalChart,
} from "../services/yahooFinance";
import { store } from "../state";
import type { Stock } from "../stocks";

type Timeframe = "1D" | "5D" | "1M" | "6M" | "1Y" | "5Y" | "ALL";

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: "1D", value: "1D" },
  { label: "5D", value: "5D" },
  { label: "1M", value: "1M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "5Y", value: "5Y" },
  { label: "ALL", value: "ALL" },
];

type ChartViewProps = {
  stock: Stock;
};

export function ChartView({ stock }: ChartViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [chartData, setChartData] = useState<YahooHistoricalChart | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<YahooChartPoint | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<YahooChartPoint | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 380 });

  // Track container size dynamically with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setDimensions({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height),
        });
      }
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  // Fetch chart data when symbol or timeframe changes
  const loadChartData = async (tf: Timeframe) => {
    setIsLoading(true);
    setHasError(false);
    setHoveredPoint(null);
    setSelectedPoint(null);

    const result = await fetchYahooChartSeries(
      stock.symbol,
      tf,
      stock.sector,
      stock.currency
    );

    if (result && result.points.length > 0) {
      setChartData(result);
      setHasError(false);
    } else {
      setHasError(true);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadChartData(timeframe);
  }, [stock.symbol, timeframe]);

  // Keep 1D chart updated in real-time when stock price updates via smartSync
  useEffect(() => {
    if (timeframe !== "1D" || !chartData || chartData.points.length === 0) return;

    const lastPoint = chartData.points[chartData.points.length - 1];
    if (lastPoint && lastPoint.price !== stock.price) {
      const updatedPoints = [...chartData.points];
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      });
      const dateStr = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "America/New_York",
      });

      // Update the latest point or append if tick moved forward
      updatedPoints[updatedPoints.length - 1] = {
        ...lastPoint,
        price: stock.price,
        timeStr,
        dateStr,
      };

      setChartData({
        ...chartData,
        currentPrice: stock.price,
        points: updatedPoints,
      });
    }
  }, [stock.price, timeframe]);

  // Calculations for chart rendering
  const points = chartData?.points || [];
  const baselinePrice = useMemo(() => {
    if (!chartData) return stock.price;
    if (timeframe === "1D") {
      return chartData.previousClose;
    }
    return points[0]?.price ?? chartData.previousClose;
  }, [chartData, timeframe, points, stock.price]);

  // Active displayed price and delta
  // Decoupled from hover: stays live unless user explicitly clicks a point on the graph
  const displayPrice = selectedPoint ? selectedPoint.price : stock.price;
  const displayChange = selectedPoint
    ? Number((selectedPoint.price - baselinePrice).toFixed(2))
    : stock.change;
  const displayPercentChange = selectedPoint
    ? baselinePrice > 0
      ? Number((((selectedPoint.price - baselinePrice) / baselinePrice) * 100).toFixed(2))
      : 0
    : stock.percentChange;
  const isPositive = displayChange >= 0;

  // Chart plotting boundaries
  const padding = { top: 24, right: 72, bottom: 32, left: 16 };
  const plotWidth = Math.max(dimensions.width - padding.left - padding.right, 50);
  const plotHeight = Math.max(dimensions.height - padding.top - padding.bottom, 50);

  const { minPrice, maxPrice, scaleX, scaleY, pathD, areaD, yTicks, xLabels } =
    useMemo(() => {
      if (points.length === 0) {
        return {
          minPrice: 0,
          maxPrice: 0,
          scaleX: (_i: number) => 0,
          scaleY: (_p: number) => 0,
          pathD: "",
          areaD: "",
          yTicks: [],
          xLabels: [],
        };
      }

      let min = Infinity;
      let max = -Infinity;

      for (const pt of points) {
        if (pt.price < min) min = pt.price;
        if (pt.price > max) max = pt.price;
      }

      // In 1D view, ensure previous close line is always within scale
      if (timeframe === "1D" && chartData?.previousClose) {
        if (chartData.previousClose < min) min = chartData.previousClose;
        if (chartData.previousClose > max) max = chartData.previousClose;
      }

      // Add breathing room
      const diff = max - min;
      const buffer = diff > 0 ? diff * 0.08 : min * 0.02 || 1;
      const effectiveMin = Math.max(0, min - buffer);
      const effectiveMax = max + buffer;
      const effectiveRange = effectiveMax - effectiveMin || 1;

      const sx = (index: number) => {
        if (points.length <= 1) return padding.left;
        return padding.left + (index / (points.length - 1)) * plotWidth;
      };

      const sy = (price: number) => {
        const ratio = (price - effectiveMin) / effectiveRange;
        return padding.top + plotHeight - ratio * plotHeight;
      };

      // Construct SVG line and area paths
      let d = "";
      for (let i = 0; i < points.length; i++) {
        const x = sx(i);
        const y = sy(points[i].price);
        d += i === 0 ? `M ${x.toFixed(1)},${y.toFixed(1)}` : ` L ${x.toFixed(1)},${y.toFixed(1)}`;
      }

      const areaPath = `${d} L ${(padding.left + plotWidth).toFixed(1)},${(
        padding.top + plotHeight
      ).toFixed(1)} L ${padding.left.toFixed(1)},${(padding.top + plotHeight).toFixed(1)} Z`;

      // 4 horizontal Y price ticks
      const ticksCount = 4;
      const ticks: { price: number; y: number }[] = [];
      for (let i = 0; i <= ticksCount; i++) {
        const p = effectiveMin + (i / ticksCount) * effectiveRange;
        ticks.push({ price: p, y: sy(p) });
      }

      // 5 evenly spaced X timestamp labels
      const labels: { text: string; x: number }[] = [];
      const xTickCount = Math.min(points.length, 5);
      if (points.length > 0) {
        for (let i = 0; i < xTickCount; i++) {
          const idx = Math.floor((i / (xTickCount - 1 || 1)) * (points.length - 1));
          const pt = points[idx];
          if (pt) {
            const labelText =
              timeframe === "1D"
                ? pt.timeStr
                : pt.dateStr;
            labels.push({ text: labelText, x: sx(idx) });
          }
        }
      }

      return {
        minPrice: min,
        maxPrice: max,
        scaleX: sx,
        scaleY: sy,
        pathD: d,
        areaD: areaPath,
        yTicks: ticks,
        xLabels: labels,
      };
    }, [points, timeframe, chartData?.previousClose, dimensions, plotWidth, plotHeight]);

  // Handle cursor scrubbing across the chart
  const handlePointerMove = (e: MouseEvent | TouchEvent) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
    const relX = clientX - rect.left;

    // Constrain within the plotting region
    const clampedX = Math.max(padding.left, Math.min(padding.left + plotWidth, relX));
    const ratio = (clampedX - padding.left) / plotWidth;
    const closestIdx = Math.max(
      0,
      Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))
    );

    setHoveredPoint(points[closestIdx] || null);
  };

  const handleChartClick = (e: MouseEvent) => {
    if (!containerRef.current || points.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const clampedX = Math.max(padding.left, Math.min(padding.left + plotWidth, relX));
    const ratio = (clampedX - padding.left) / plotWidth;
    const closestIdx = Math.max(
      0,
      Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))
    );

    const pt = points[closestIdx];
    if (pt) {
      setSelectedPoint(pt);
    }
  };

  const handlePointerLeave = () => {
    setHoveredPoint(null);
  };

  // Color scheme: Emerald green when gain, Rose red when loss
  const themeColor = isPositive ? "#10b981" : "#f43f5e";
  const themeTailwindText = isPositive ? "text-emerald-400" : "text-rose-400";
  const gradientId = `chart-gradient-${stock.symbol}-${isPositive ? "up" : "down"}`;

  // Find hovered point coordinates on SVG
  const hoveredCoordinates = useMemo(() => {
    if (!hoveredPoint || points.length === 0) return null;
    const idx = points.findIndex((p) => p.timestamp === hoveredPoint.timestamp);
    if (idx === -1) return null;
    return {
      x: scaleX(idx),
      y: scaleY(hoveredPoint.price),
    };
  }, [hoveredPoint, points, scaleX, scaleY]);

  // Find clicked / selected point coordinates on SVG
  const selectedCoordinates = useMemo(() => {
    if (!selectedPoint || points.length === 0) return null;
    const idx = points.findIndex((p) => p.timestamp === selectedPoint.timestamp);
    if (idx === -1) return null;
    return {
      x: scaleX(idx),
      y: scaleY(selectedPoint.price),
    };
  }, [selectedPoint, points, scaleX, scaleY]);

  // Prev close Y level
  const prevCloseY =
    timeframe === "1D" && chartData?.previousClose
      ? scaleY(chartData.previousClose)
      : null;

  return (
    <div class="flex h-full min-h-0 flex-1 flex-col bg-zinc-950 p-6 overflow-hidden select-none">
      {/* Header Info Banner */}
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
            <span class="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
              <span class="relative flex h-1.5 w-1.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span>Yahoo Finance Live</span>
            </span>
          </div>

          {/* Hero Price Display (Live price, or selected point price when clicked) */}
          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div class="flex items-baseline gap-1.5">
              <span class="text-3xl font-extrabold tracking-tight text-white tabular-nums">
                {formatPrice(displayPrice)}
              </span>
              <span class="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {stock.currency || "USD"}
              </span>
            </div>
            <div
              class={`flex items-center gap-1 text-sm font-semibold tabular-nums ${themeTailwindText}`}
            >
              <span>
                {formatSignedChange(displayChange)} ({formatPercentChange(displayPercentChange)})
              </span>
              <span>{isPositive ? "↑" : "↓"}</span>
            </div>

            {/* Parallel badge & action buttons cluster: uniform h-6 height prevents any layout shift */}
            <div class="flex items-center gap-2 flex-wrap">
              {selectedPoint ? (
                <>
                  <span class="h-6 inline-flex items-center rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 text-xs font-medium text-amber-300">
                    {selectedPoint.dateStr} at {selectedPoint.timeStr}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPoint(null)}
                    class="h-6 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 hover:text-white transition shadow-sm"
                    title="Return to real-time live market feed"
                  >
                    <span class="relative flex h-2 w-2">
                      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span>Back to Live Session</span>
                  </button>
                </>
              ) : (
                <span class="h-6 inline-flex items-center text-xs text-zinc-400">
                  {store.isMarketOpen.value ? "Live Market Session" : "Market Closed"}
                </span>
              )}

              <button
                type="button"
                onClick={() => store.setViewMode("ai")}
                class="h-6 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 text-xs font-semibold text-violet-300 hover:bg-violet-500/20 hover:text-white transition"
              >
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                <span>AI Research</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (store.user.value) {
                    store.isTradeModalOpen.value = true;
                  } else {
                    store.isAuthModalOpen.value = true;
                  }
                }}
                class="h-6 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 shadow-sm transition"
              >
                TRADE
              </button>
            </div>
          </div>
        </div>

        {/* Timeframe Selector Tabs */}
        <div class="flex items-center gap-1 rounded-xl bg-zinc-900/90 p-1 border border-zinc-800">
          {TIMEFRAMES.map((tf) => {
            const isActive = timeframe === tf.value;
            return (
              <button
                key={tf.value}
                type="button"
                onClick={() => {
                  setTimeframe(tf.value);
                  setSelectedPoint(null);
                }}
                class={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  isActive
                    ? "bg-zinc-800 text-white shadow-sm border border-zinc-700/80"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chart Canvas Container */}
      <div
        ref={containerRef}
        onClick={handleChartClick}
        onMouseMove={handlePointerMove}
        onTouchMove={handlePointerMove}
        onMouseLeave={handlePointerLeave}
        onTouchEnd={handlePointerLeave}
        class="relative min-h-[200px] flex-1 rounded-xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-2xl flex flex-col justify-center items-center cursor-crosshair"
      >
        {isLoading ? (
          <div class="flex flex-col items-center gap-3 text-zinc-400">
            <div class="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
            <span class="text-xs font-medium tracking-wide">
              Loading {stock.symbol} {timeframe} chart...
            </span>
          </div>
        ) : hasError || points.length === 0 ? (
          <div class="flex flex-col items-center gap-2 p-6 text-center">
            <span class="text-sm font-semibold text-zinc-300">
              Unable to load chart data for {stock.symbol}
            </span>
            <span class="text-xs text-zinc-500">
              Check your connection or try another timeframe.
            </span>
            <button
              type="button"
              onClick={() => loadChartData(timeframe)}
              class="mt-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition"
            >
              Retry
            </button>
          </div>
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            class="overflow-visible"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color={themeColor} stop-opacity="0.28" />
                <stop offset="100%" stop-color={themeColor} stop-opacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={padding.left + plotWidth}
                  y2={tick.y}
                  stroke="rgba(63, 63, 70, 0.35)"
                  stroke-dasharray="3 3"
                  stroke-width="1"
                />
                <text
                  x={padding.left + plotWidth + 8}
                  y={tick.y + 3.5}
                  fill="rgb(113, 113, 122)"
                  font-size="10"
                  font-family="sans-serif"
                  font-weight="500"
                >
                  ${tick.price.toFixed(2)}
                </text>
              </g>
            ))}

            {/* Previous Close Reference Line (1D view) */}
            {prevCloseY !== null && (
              <line
                x1={padding.left}
                y1={prevCloseY}
                x2={padding.left + plotWidth}
                y2={prevCloseY}
                stroke="rgba(161, 161, 170, 0.5)"
                stroke-dasharray="4 4"
                stroke-width="1.2"
              />
            )}

            {/* Area Fill Gradient */}
            <path d={areaD} fill={`url(#${gradientId})`} />

            {/* Main Price Line */}
            <path
              d={pathD}
              fill="none"
              stroke={themeColor}
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            {/* X-Axis Bottom Timestamps */}
            {xLabels.map((lbl, i) => (
              <text
                key={i}
                x={lbl.x}
                y={dimensions.height - 10}
                text-anchor={
                  i === 0
                    ? "start"
                    : i === xLabels.length - 1
                    ? "end"
                    : "middle"
                }
                fill="rgb(113, 113, 122)"
                font-size="10"
                font-family="sans-serif"
                font-weight="500"
              >
                {lbl.text}
              </text>
            ))}

            {/* Pinned Selected Point Marker */}
            {selectedCoordinates && selectedPoint && (
              <g>
                <line
                  x1={selectedCoordinates.x}
                  y1={padding.top}
                  x2={selectedCoordinates.x}
                  y2={padding.top + plotHeight}
                  stroke="rgba(245, 158, 11, 0.8)"
                  stroke-dasharray="4 2"
                  stroke-width="1.5"
                />
                <circle
                  cx={selectedCoordinates.x}
                  cy={selectedCoordinates.y}
                  r="7.5"
                  fill="#f59e0b"
                  fill-opacity="0.35"
                />
                <circle
                  cx={selectedCoordinates.x}
                  cy={selectedCoordinates.y}
                  r="3.5"
                  fill="#ffffff"
                  stroke="#f59e0b"
                  stroke-width="2"
                />
              </g>
            )}

            {/* Active Scrubbing Crosshair & Glowing Marker */}
            {hoveredCoordinates && hoveredPoint && (
              <g>
                {/* Vertical Crosshair Line */}
                <line
                  x1={hoveredCoordinates.x}
                  y1={padding.top}
                  x2={hoveredCoordinates.x}
                  y2={padding.top + plotHeight}
                  stroke="rgba(244, 244, 245, 0.45)"
                  stroke-dasharray="3 3"
                  stroke-width="1.2"
                />

                {/* Horizontal Crosshair Line */}
                <line
                  x1={padding.left}
                  y1={hoveredCoordinates.y}
                  x2={padding.left + plotWidth}
                  y2={hoveredCoordinates.y}
                  stroke="rgba(244, 244, 245, 0.25)"
                  stroke-dasharray="2 2"
                  stroke-width="1"
                />

                {/* Outer Glow Halo */}
                <circle
                  cx={hoveredCoordinates.x}
                  cy={hoveredCoordinates.y}
                  r="7"
                  fill={hoveredPoint.price >= baselinePrice ? "#10b981" : "#f43f5e"}
                  fill-opacity="0.35"
                />

                {/* Inner White Dot */}
                <circle
                  cx={hoveredCoordinates.x}
                  cy={hoveredCoordinates.y}
                  r="3.5"
                  fill="#ffffff"
                  stroke={hoveredPoint.price >= baselinePrice ? "#10b981" : "#f43f5e"}
                  stroke-width="1.5"
                />
              </g>
            )}
          </svg>
        )}

        {/* Hover Tooltip Card */}
        {hoveredPoint && hoveredCoordinates && (
          <div
            class="pointer-events-none absolute z-20 flex flex-col rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md transition-all duration-75"
            style={{
              left: `${Math.min(
                Math.max(16, hoveredCoordinates.x - 70),
                dimensions.width - 160
              )}px`,
              top: `${Math.max(12, hoveredCoordinates.y - 85)}px`,
            }}
          >
            <div class="text-[10px] font-medium text-zinc-400">
              {hoveredPoint.dateStr} • {hoveredPoint.timeStr}
            </div>
            <div class="mt-0.5 flex items-baseline gap-1.5 font-bold">
              <span class="text-sm text-white">{formatPrice(hoveredPoint.price)}</span>
              <span class="text-[10px] text-zinc-400">{stock.currency || "USD"}</span>
            </div>
            <div
              class={`text-[11px] font-semibold ${
                hoveredPoint.price >= baselinePrice ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatSignedChange(hoveredPoint.price - baselinePrice)} (
              {formatPercentChange(
                baselinePrice > 0
                  ? ((hoveredPoint.price - baselinePrice) / baselinePrice) * 100
                  : 0
              )}
              )
            </div>
            {hoveredPoint.volume !== undefined && hoveredPoint.volume > 0 && (
              <div class="mt-0.5 text-[10px] text-zinc-400">
                Vol: {formatVolume(hoveredPoint.volume)}
              </div>
            )}
            <div class="mt-1 border-t border-zinc-800 pt-1 text-[9.5px] font-medium text-zinc-400">
              {selectedPoint && selectedPoint.timestamp === hoveredPoint.timestamp
                ? "✓ Pinned in header"
                : "Click point to view in header"}
            </div>
          </div>
        )}
      </div>

      {/* Key Market Stats Footer Strip */}
      <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 shrink-0">
        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Prev Close
          </div>
          <div class="mt-0.5 text-xs font-bold text-zinc-200 tabular-nums">
            {chartData?.previousClose
              ? formatPrice(chartData.previousClose)
              : formatPrice(stock.price - stock.change)}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Day Range
          </div>
          <div class="mt-0.5 text-xs font-bold text-zinc-200 tabular-nums">
            {chartData?.dayLow && chartData?.dayHigh
              ? `${formatPrice(chartData.dayLow)} - ${formatPrice(chartData.dayHigh)}`
              : `${formatPrice(stock.dayLow ?? minPrice)} - ${formatPrice(stock.dayHigh ?? maxPrice)}`}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Range Low / High
          </div>
          <div class="mt-0.5 text-xs font-bold text-zinc-200 tabular-nums">
            {minPrice > 0 ? `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}` : "—"}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            52-Wk Range
          </div>
          <div class="mt-0.5 text-xs font-bold text-zinc-200 tabular-nums">
            {chartData?.fiftyTwoWeekLow && chartData?.fiftyTwoWeekHigh
              ? `${formatPrice(chartData.fiftyTwoWeekLow)} - ${formatPrice(chartData.fiftyTwoWeekHigh)}`
              : "—"}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Volume
          </div>
          <div class="mt-0.5 text-xs font-bold text-zinc-200 tabular-nums">
            {chartData?.volume
              ? formatVolume(chartData.volume)
              : stock.volume
              ? formatVolume(stock.volume)
              : "—"}
          </div>
        </div>

        <div class="rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 flex flex-col justify-center">
          <div class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Data Source
          </div>
          <div class="mt-0.5 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>Yahoo Finance Feed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
