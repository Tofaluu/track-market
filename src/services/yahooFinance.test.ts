import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYahooChartSeries, fetchYahooFinanceQuote, formatYahooSymbol } from "./yahooFinance";

const chartResponse = (meta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ chart: { result: [{ meta, ...extra }] } }), { status: 200 });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatYahooSymbol", () => {
  it("adds the .TO suffix for TSX listings", () => {
    expect(formatYahooSymbol("xeqt")).toBe("XEQT.TO");
    expect(formatYahooSymbol("AC", "Airlines", "CAD")).toBe("AC.TO");
  });

  it("leaves US and already-suffixed symbols alone", () => {
    expect(formatYahooSymbol("AAPL")).toBe("AAPL");
    expect(formatYahooSymbol("SHOP.TO")).toBe("SHOP.TO");
    expect(formatYahooSymbol("ABC.V")).toBe("ABC.V");
  });
});

describe("fetchYahooFinanceQuote", () => {
  it("falls through to the next endpoint when one fails", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }))
      .mockResolvedValueOnce(
        chartResponse({
          regularMarketPrice: 217.456,
          chartPreviousClose: 214.13,
          regularMarketDayHigh: 219.62,
          regularMarketDayLow: 214.7,
          currency: "USD",
          fullExchangeName: "NasdaqGS",
        }),
      );

    const quote = await fetchYahooFinanceQuote("NVDA");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v8/finance/chart/NVDA");
    expect(quote).toMatchObject({
      price: 217.46,
      change: 3.33,
      percentChange: 1.55,
      dayHigh: 219.62,
      dayLow: 214.7,
      currency: "USD",
      sourceText: "Yahoo Finance Live (NasdaqGS)",
    });
  });

  it("returns null when every endpoint fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await fetchYahooFinanceQuote("AAPL")).toBeNull();
  });

  it("skips responses without a price", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => chartResponse({ currency: "USD" }));
    expect(await fetchYahooFinanceQuote("AAPL")).toBeNull();
  });
});

describe("fetchYahooChartSeries", () => {
  it("maps the timeframe to a range and interval and drops empty ticks", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      chartResponse(
        { regularMarketPrice: 45.34, chartPreviousClose: 45.46, currency: "CAD" },
        {
          timestamp: [1_792_416_600, 1_792_417_500, 1_792_418_400],
          indicators: { quote: [{ close: [45.4, null, 45.34], volume: [1000, 0, 2000] }] },
        },
      ),
    );

    const chart = await fetchYahooChartSeries("XEQT", "5D");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/XEQT.TO?range=5d&interval=15m");
    expect(chart?.points.map((p) => p.price)).toEqual([45.4, 45.34]);
    expect(chart).toMatchObject({ currency: "CAD", previousClose: 45.46, currentPrice: 45.34 });
  });
});
