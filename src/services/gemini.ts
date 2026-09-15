// Gemini 2.0 Flash AI Service with Google Search Grounding for live financial lookups & company research.
import { getStockExpectedCurrency } from "../stocks";
import { fetchYahooChartSeries } from "./yahooFinance";

const API_KEY_STORAGE_KEY = "marketpulse_gemini_api_key";

export function getGeminiApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey().trim());
}

export function setGeminiApiKey(key: string): void {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  } catch (err) {
    console.error("Failed to save API key to localStorage", err);
  }
}

export function clearGeminiApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear API key from localStorage", err);
  }
}

export type LivePriceResult = {
  price: number;
  change?: number;
  percentChange?: number;
  dayHigh?: number;
  dayLow?: number;
  currency?: string;
  sourceText: string;
  timestamp: string;
};

/**
 * Executes a raw query to Gemini Flash with optional Google Search Grounding.
 */
const CANDIDATE_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.1-flash-lite",
  "gemini-1.5-flash",
];

export async function callGemini(
  prompt: string,
  useSearchGrounding: boolean = false
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key is not configured. Please add your key in AI Settings."
    );
  }

  let lastError: Error | null = null;

  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const requestBody: any = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      };

      if (useSearchGrounding) {
        requestBody.tools = [{ google_search: {} }];
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message =
          errorData?.error?.message ||
          `Gemini API returned error code ${response.status}`;

        // If the model is deprecated or not available, try the next model candidate
        if (
          message.includes("no longer available") ||
          message.includes("not found") ||
          response.status === 404
        ) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      const data = await response.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No response returned from Gemini.";
      return text;
    } catch (err: any) {
      lastError = err;
      if (
        err.message?.includes("no longer available") ||
        err.message?.includes("not found")
      ) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All Gemini models failed.");
}

/**
 * Returns formatted date and time in Eastern Time (ET) to anchor AI searches.
 */
function getMarketDateContext(): { dateStr: string; timeStr: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  return { dateStr, timeStr };
}

/**
 * Uses Gemini with Google Search to fetch the genuine current trading price for any ticker.
 */
export async function fetchLivePriceWithAI(
  symbol: string,
  name: string,
  explicitCurrency?: string,
  sector?: string
): Promise<LivePriceResult> {
  const { dateStr, timeStr } = getMarketDateContext();
  const expectedCurrency = getStockExpectedCurrency(symbol, sector, explicitCurrency);
  const exchangeDesc =
    expectedCurrency === "CAD"
      ? "TSX (Toronto Stock Exchange) in Canadian Dollars (CAD)"
      : "NASDAQ or NYSE in US Dollars (USD)";
  const tickerQuery = expectedCurrency === "CAD" ? `${symbol} stock TSE` : `${symbol} stock`;

  const prompt = `You are a real-time financial market data agent.
TEMPORAL CONTEXT:
- Today's date: ${dateStr}
- Current Eastern Time: ${timeStr} ET

Perform a Google Search with this exact query: "${tickerQuery}".
This asset (${name}) trades natively on ${exchangeDesc}.

CRITICAL SEARCH & GOOGLE FINANCE WIDGET EXTRACTION INSTRUCTIONS:
1. TARGET THE HEADLINE GOOGLE FINANCE QUOTE BOX:
   - When searching "${tickerQuery}", Google displays a primary quote widget box at the top of search results.
   - The CURRENT TRADING PRICE is the large prominent number displayed beside the currency code (${expectedCurrency}) (e.g. "44.83 CAD" or "331.96 USD").
   - The DAY CHANGE and PERCENT CHANGE are displayed immediately adjacent to that headline number (e.g. "-0.37 (-0.82%) today").
2. REGULAR HOURS VS AFTER-HOURS:
   - If the market is open (9:30 AM - 4:00 PM ET), report the active live real-time trading price from that headline.
   - If the market is closed or in after-hours (4:00 PM - 8:00 PM ET), report TODAY'S (${dateStr}) official regular session closing price from that headline, NOT yesterday's close.
3. CRITICAL DISAMBIGUATION RULES (AVOID COMMON ERRORS):
   - DO NOT report the "Previous close" as the current price! "Previous close" is yesterday's closing price.
   - DO NOT report Open, Day High, Day Low, 52-wk high, or 52-wk low as the current price (e.g. for GOOGL, do not report the day's high of $338.72).
   - DO NOT pick numbers from the "Related" or "People also search for" sidebar on the screen.
   - STRICT NATIVE CURRENCY: Report strictly in ${expectedCurrency}. Never convert between USD and CAD.

Provide the output strictly in this JSON format:
{
  "price": <numeric current trading price in ${expectedCurrency}, e.g. 44.83 or 331.96>,
  "change": <numeric day change in ${expectedCurrency}, e.g. -0.37 or +2.15>,
  "percentChange": <numeric percent change, e.g. -0.82 or 0.65>,
  "dayHigh": <optional numeric day high in ${expectedCurrency}>,
  "dayLow": <optional numeric day low in ${expectedCurrency}>,
  "currency": "${expectedCurrency}",
  "summary": <one-sentence summary of today's price and market movement>
}
Output only the JSON block without markdown backticks if possible, or inside a clean json code block.`;

  const raw = await callGemini(prompt, true);

  // Parse JSON out of response
  let jsonMatch = raw.match(/\{[\s\S]*\}/);
  let parsed: any = null;

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // JSON parse failed, extract with regex fallback below
    }
  }

  // Extract price with regex fallback if JSON parsing wasn't clean
  let price = parsed?.price;
  if (typeof price !== "number" || isNaN(price)) {
    const priceMatch = raw.match(/\$?\s*(\d{1,6}(?:\.\d{1,2})?)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1]);
    }
  }

  const change =
    typeof parsed?.change === "number" ? parsed.change : undefined;

  if (typeof price !== "number" || isNaN(price) || price <= 0) {
    throw new Error(
      `Could not reliably extract price from AI response: ${raw.slice(0, 150)}...`
    );
  }

  const percentChange =
    typeof parsed?.percentChange === "number" ? parsed.percentChange : undefined;
  const dayHigh =
    typeof parsed?.dayHigh === "number" ? Number(parsed.dayHigh.toFixed(2)) : undefined;
  const dayLow =
    typeof parsed?.dayLow === "number" ? Number(parsed.dayLow.toFixed(2)) : undefined;
  const currency = parsed?.currency || expectedCurrency;

  return {
    price: Number(price.toFixed(2)),
    change: change !== undefined ? Number(change.toFixed(2)) : undefined,
    percentChange:
      percentChange !== undefined ? Number(percentChange.toFixed(2)) : undefined,
    dayHigh,
    dayLow,
    currency,
    sourceText: parsed?.summary || raw.trim().slice(0, 200),
    timestamp: new Date().toLocaleTimeString(),
  };
}

function sanitizeAiResponse(text: string): string {
  let cleaned = text.trim();
  // Strip common conversational chatbot prefixes:
  cleaned = cleaned.replace(
    /^(?:here\s+is|certainly|below\s+is|sure|as\s+an?\s+ai|of\s+course)[^\n]*\n+/i,
    ""
  );
  cleaned = cleaned.replace(
    /^(?:here\s+(?:is|are)|in\s+this\s+report|the\s+following\s+is)[^\n]*:\s*\n+/i,
    ""
  );
  cleaned = cleaned.replace(/^---+\s*\n+/, "");
  return cleaned.trim();
}

export type AnalysisTopic = "summary" | "trajectory" | "risks" | "past_week" | "custom";

export type StockAnalysisContext = {
  price?: number;
  currency?: string;
  change?: number;
  percentChange?: number;
  sector?: string;
};

/**
 * Conducts specialized, highly structured institutional AI research on a company or ETF.
 */
export async function analyzeCompanyWithAI(
  symbol: string,
  name: string,
  topic: AnalysisTopic,
  customQuestion?: string,
  stockContext?: StockAnalysisContext
): Promise<string> {
  const { dateStr } = getMarketDateContext();
  const currentPriceText =
    stockContext?.price !== undefined
      ? `- Current Trading Price: $${stockContext.price.toFixed(2)} ${stockContext.currency || "USD"}`
      : "";

  const commonDirectives = `
TEMPORAL CONTEXT & ACTIVE RESEARCH DIRECTIVES:
- Today's Date: ${dateStr}.
${currentPriceText}
- You MUST perform a Google Search to verify CURRENT, up-to-date real-world facts, recent product/hardware launches, current-year earnings, and modern strategic moves for '${name}' (${symbol}).
- Ground all findings strictly in the current real-world market context as of ${dateStr}. DO NOT rely on outdated pre-trained cutoff assumptions (e.g. verify the latest generation consoles/hardware, current product lineups, and latest quarter results).
- DO NOT include conversational filler, pleasantries, or phrases like "Here is...", "Below is...", or "Certainly!".
- Jump directly into the first markdown header.
- Maintain a concise, plain-English tone. Avoid unnecessary, confusing financial jargon.
- Use bold lead-ins for every bullet point. Keep explanations focused and avoid fluffy filler.
`;

  let prompt = "";
  // Enable Google Search Grounding for all institutional research modules and custom questions
  const useSearch = true;

  if (topic === "summary") {
    prompt = `You are a senior equity research analyst analyzing '${name}' (${symbol}).
Perform a Google Search to verify their CURRENT core business, modern product lineup, and latest revenue drivers as of ${dateStr}.
${commonDirectives}

Provide a structured, concise executive overview using EXACTLY this markdown layout:

### **Core Business & Revenue Model**
* **Primary Activities:** [2 sentences on core operations, modern product lines, or asset allocation if ETF]
* **Monetization & Margins:** [1-2 sentences on current profit drivers, cash flow, or MER/yield if ETF]

### **Competitive Moat**
* **Defensible Advantage:** [1-2 sentences on moat: network effects, scale, proprietary IP/hardware, switching costs, or tax efficiency]
* **Pricing Power:** [1 sentence on customer stickiness or fee durability]

### **Target Market & Client Base**
* **Core Demographics:** [1-2 sentences on core customer profile or ideal investor persona]

### **Executive Takeaway**
[1 punchy sentence synthesizing their long-term competitive durability]`;
  } else if (topic === "past_week") {
    // Fetch verified Yahoo Finance 5-day / weekly chart numbers
    let yahooStatsContext = "";
    try {
      const chart5D = await fetchYahooChartSeries(
        symbol,
        "5D",
        stockContext?.sector,
        stockContext?.currency
      );
      if (chart5D && chart5D.points.length > 0) {
        const startPoint = chart5D.points[0];
        const endPoint = chart5D.points[chart5D.points.length - 1];
        const startPrice = startPoint.price;
        const currentPrice = stockContext?.price ?? endPoint.price;
        const netChange = Number((currentPrice - startPrice).toFixed(2));
        const netPercentChange =
          startPrice > 0 ? Number(((netChange / startPrice) * 100).toFixed(2)) : 0;
        const allPrices = chart5D.points.map((p) => p.price);
        const low5D = Math.min(...allPrices);
        const high5D = Math.max(...allPrices);
        const currency = chart5D.currency || stockContext?.currency || "USD";

        yahooStatsContext = `
VERIFIED YAHOO FINANCE 5-DAY / 1-WEEK CHART DATA:
- Current Price: $${currentPrice.toFixed(2)} ${currency}
- Price 5 Trading Days Ago (${startPoint.dateStr}): $${startPrice.toFixed(2)} ${currency}
- Net 5-Day Change: ${netChange >= 0 ? "+" : ""}$${netChange.toFixed(2)} ${currency} (${netPercentChange >= 0 ? "+" : ""}${netPercentChange.toFixed(2)}%)
- 5-Day Low: $${low5D.toFixed(2)} ${currency} | 5-Day High: $${high5D.toFixed(2)} ${currency}

CRITICAL MANDATORY INSTRUCTIONS:
- You MUST CITE these exact verified Yahoo Finance figures in the "Direction & Net Change" bullet (e.g. mention that it moved from $${startPrice.toFixed(2)} to $${currentPrice.toFixed(2)}, a ${netPercentChange >= 0 ? "+" : ""}${netPercentChange.toFixed(2)}% move, trading in a range of $${low5D.toFixed(2)} - $${high5D.toFixed(2)}).
- Do NOT guess different price numbers. Ground your explanation in the real news that drove this exact price action!
`;
      } else if (stockContext?.price !== undefined) {
        const cur = stockContext.currency || "USD";
        yahooStatsContext = `
VERIFIED YAHOO FINANCE PRICE:
- Current Price: $${stockContext.price.toFixed(2)} ${cur}
${stockContext.change !== undefined ? `- Today's Move: ${stockContext.change >= 0 ? "+" : ""}$${stockContext.change.toFixed(2)} (${stockContext.percentChange !== undefined ? `${stockContext.percentChange >= 0 ? "+" : ""}${stockContext.percentChange.toFixed(2)}%` : ""})` : ""}
`;
      }
    } catch {
      // Continue gracefully with search grounding
    }

    prompt = `You are a market analyst explaining why '${name}' (${symbol}) went up or down over the past 7 days (the 7 days leading up to ${dateStr}).
${commonDirectives}
${yahooStatsContext}
- USE PLAIN, STRAIGHTFORWARD ENGLISH. AVOID CONFUSING WALL STREET JARGON.
- Perform a Google Search to identify real news, earnings reports, regulatory decisions, political developments, product announcements, or broader sector shifts from the past 7 days leading up to ${dateStr}.

Provide a concise breakdown using EXACTLY this markdown layout:

### **Past Week Price Movement**
* **Direction & Net Change:** [Cite the verified Yahoo Finance movement: start price, current price, net percentage move over the past week, and the overall market sentiment]

### **Why It Moved (Past Week Drivers)**
* **[Primary Company Driver]:** [1-2 simple, plain-English sentences on recent company news, earnings, product announcements, or leadership updates]
* **[Macro, Political, or Sector Driver]:** [1-2 simple, plain-English sentences on political headlines, interest rate moves, or industry trends that affected it]

### **Bottom Line**
[1 punchy sentence stating whether this past week's price movement is short-term market noise or a meaningful fundamental shift]`;
  } else if (topic === "trajectory") {
    prompt = `You are a strategic financial analyst conducting a 2–5 year trajectory analysis for '${name}' (${symbol}).
Perform a Google Search to identify their CURRENT upcoming pipeline, next-generation product roadmap (e.g. hardware/software generations), and guidance as of ${dateStr}.
${commonDirectives}

Provide a structured, forward-looking roadmap using EXACTLY this markdown layout:

### **Key Growth Catalysts & Tailwinds (2–5 Years)**
* **[Catalyst 1 Name]:** [1-2 sentences on specific growth driver e.g. next-gen hardware/software cycle, secular inflows, or expansion]
* **[Catalyst 2 Name]:** [1-2 sentences on operational or industry tailwind]
* **[Catalyst 3 Name]:** [1-2 sentences on valuation re-rating or market expansion]

### **Bull vs. Bear Scenarios**
* **Bull Case (Upside):** [2 sentences on realistic upside thesis and target return/valuation]
* **Bear Case (Downside):** [2 sentences on primary risk trigger and potential drawdown]

### **Strategic Consensus Outlook**
* **Consensus Stance:** **[ACCUMULATE / HOLD / BUY ON PULLBACKS / SPECULATIVE]**
* **Rationale:** [2 sentences on optimal investor time horizon and execution approach]`;
  } else if (topic === "risks") {
    prompt = `You are a chief risk officer auditing '${name}' (${symbol}).
Perform a Google Search to identify their CURRENT real-world threats, component costs, macroeconomic exposure, and regulatory challenges as of ${dateStr}.
${commonDirectives}

Provide a structured, objective risk audit using EXACTLY this markdown layout:

### **Critical Risk Factors & Headwinds**
* **Macro & Interest Rate Sensitivity:** [1-2 sentences on inflation, discount rate impact, or economic cycle]
* **Industry & Valuation Pressure:** [1-2 sentences on multiple contraction, product cycle transitions, or competition]
* **Operational & Regulatory Exposure:** [1-2 sentences on supply chain, memory/component costs, legal, or geopolitical friction]
* **Currency & Liquidity:** [1 sentence on FX drag, liquidity, or volatility profile]

### **Vulnerability Assessment**
* **Risk Profile:** **[LOW / MODERATE / HIGH]**
* **Key Vulnerability:** [1-2 sentences identifying the single catalyst that could most impair the thesis]`;
  } else {
    prompt = `You are an institutional financial analyst analyzing '${name}' (${symbol}).
Perform a Google Search to ground your answer in verified real-world facts as of ${dateStr}.
${commonDirectives}

User Question: "${customQuestion}"

Provide a structured, objective response using EXACTLY this markdown layout:

### **Direct Answer**
[1-2 clear, direct sentences directly addressing the user's specific query]

### **Key Financial Factors**
* **[Factor 1]:** [1-2 sentences of contextual evidence or financial rationale]
* **[Factor 2]:** [1-2 sentences of contextual evidence or financial rationale]
* **[Factor 3]:** [1-2 sentences of contextual evidence or financial rationale]

### **Investor Bottom Line**
[1 concise takeaway sentence summarizing the practical implication for an investor]`;
  }

  const raw = await callGemini(prompt, useSearch);
  return sanitizeAiResponse(raw);
}

export type BatchPriceResult = Record<
  string,
  {
    price: number;
    change?: number;
    percentChange?: number;
    dayHigh?: number;
    dayLow?: number;
    currency?: string;
  }
>;

/**
 * Uses Gemini with Google Search to fetch real-world quotes for all active stocks in one query.
 */
export async function batchFetchLivePricesWithAI(
  stocks: { symbol: string; name: string; currency?: string; sector?: string }[]
): Promise<BatchPriceResult> {
  if (stocks.length === 0) return {};

  const { dateStr, timeStr } = getMarketDateContext();
  const stockListLines = stocks
    .map((s) => {
      const cur = getStockExpectedCurrency(s.symbol, s.sector, s.currency);
      const exch = cur === "CAD" ? "TSX (Toronto Stock Exchange)" : "NASDAQ / NYSE";
      return `- ${s.symbol} (${s.name}): REQUIRED CURRENCY = ${cur} (trades natively on ${exch})`;
    })
    .join("\n");

  const prompt = `You are a financial market data agent.
TEMPORAL CONTEXT:
- Today's date: ${dateStr}
- Current Eastern Time: ${timeStr} ET

Perform a Google Search to find current, up-to-date real-world trading prices for each of these assets:
${stockListLines}

SEARCH & GOOGLE FINANCE WIDGET EXTRACTION INSTRUCTIONS:
1. TARGET GOOGLE FINANCE HEADLINE QUOTES:
   - For each asset, query "<SYMBOL> stock" (or "<SYMBOL> stock TSE" for Canadian equities) to trigger the Google Finance headline quote widget.
   - The CURRENT PRICE is the large prominent headline number displayed next to the currency code (e.g. "44.83 CAD" or "331.96 USD").
   - If the market is open (9:30 AM - 4:00 PM ET), report the active real-time trading price from that headline.
   - If the market is closed or in after-hours (4:00 PM - 8:00 PM ET), report TODAY'S (${dateStr}) official regular session closing price from that headline, NOT yesterday's close.
2. STRICT PER-ASSET NATIVE CURRENCIES:
   - For US equities (e.g. AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA, NTDOY): Report strictly in USD (US Dollars). NEVER convert US stocks into CAD!
   - For Canadian equities and ETFs (e.g. XEQT, SHOP, RY, VFV): Report strictly in CAD (Canadian Dollars).
3. CRITICAL DISAMBIGUATION RULES (AVOID COMMON ERRORS):
   - DO NOT report "Previous close" as the current price! "Previous close" is yesterday's close.
   - DO NOT report Open, Day High, Day Low, 52-wk high, or 52-wk low as the current price (e.g. for GOOGL, do not report the day's high of $338.72).
   - DO NOT pick prices from the "Related" sidebar on the screen.

Provide output strictly in this JSON format without markdown wrapping:
{
  "SYMBOL": {
    "price": <numeric current trading price in requested native currency>,
    "change": <numeric day change in native currency>,
    "percentChange": <numeric percent change>,
    "dayHigh": <optional numeric day high in native currency>,
    "dayLow": <optional numeric day low in native currency>,
    "currency": <"USD" or "CAD">
  }
}`;

  const raw = await callGemini(prompt, true);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const results: BatchPriceResult = {};
    for (const [key, val] of Object.entries(parsed)) {
      const item = val as any;
      if (item && typeof item.price === "number") {
        const cleanKey = key.toUpperCase();
        const matchedStock = stocks.find(
          (s) => s.symbol.toUpperCase() === cleanKey || `${s.symbol.toUpperCase()}.TO` === cleanKey
        );
        const expectedCur = getStockExpectedCurrency(
          matchedStock?.symbol || cleanKey,
          matchedStock?.sector,
          matchedStock?.currency
        );

        results[cleanKey] = {
          price: Number(item.price.toFixed(2)),
          change: typeof item.change === "number" ? Number(item.change.toFixed(2)) : undefined,
          percentChange: typeof item.percentChange === "number" ? Number(item.percentChange.toFixed(2)) : undefined,
          dayHigh: typeof item.dayHigh === "number" ? Number(item.dayHigh.toFixed(2)) : undefined,
          dayLow: typeof item.dayLow === "number" ? Number(item.dayLow.toFixed(2)) : undefined,
          currency: item.currency || expectedCur,
        };
      }
    }
    return results;
  } catch {
    return {};
  }
}

export type ResolvedAsset = {
  symbol: string;
  name: string;
  sector: string;
  currency: "USD" | "CAD";
  price: number;
  change: number;
  percentChange: number;
};

/**
 * Uses Gemini with Google Search to identify any company name or ticker on global exchanges,
 * retrieve its official symbol, exchange, currency, and real live trading price.
 */
export async function searchAndResolveStockWithAI(
  query: string
): Promise<ResolvedAsset> {
  const clean = query.trim();
  if (!clean) {
    throw new Error("Please enter a stock ticker or company name to search.");
  }

  const { dateStr, timeStr } = getMarketDateContext();
  const prompt = `You are a real-time financial market asset identifier.
TEMPORAL CONTEXT:
- Today's date: ${dateStr}
- Current Eastern Time: ${timeStr} ET

The user wants to find and add this asset or company to their stock watchlist: "${clean}".

Perform a Google Search to determine if this is a publicly traded company, ETF, or stock on major North American exchanges (NYSE, NASDAQ, TSX Toronto Stock Exchange):
1. Identify the official exchange ticker symbol.
   - For Canadian assets (e.g. Air Canada, Telus, Royal Bank, Canadian Pacific), use the TSX ticker (e.g. AC, T, RY, CP) and currency "CAD".
   - For US assets (e.g. Apple, Toyota, Sony, Ferrari, Novo Nordisk), use the primary US ticker (e.g. AAPL, TM, SONY, RACE, NVO) and currency "USD".
2. Identify the full official company or fund name.
3. Identify the sector or asset category.
4. Retrieve the current trading price and daily price change in its native trading currency from Google Finance (google.com/finance) or the primary exchange. If after-hours or market closed, use today's official 4:00 PM regular session close.

Provide output strictly in this JSON format without markdown wrapping:
{
  "found": true,
  "symbol": <string ticker, uppercase, e.g. "RACE" or "AC">,
  "name": <string official company name, e.g. "Ferrari N.V." or "Air Canada">,
  "sector": <string sector, e.g. "Automotive & Luxury" or "Airlines">,
  "currency": <"USD" or "CAD">,
  "price": <numeric current trading price>,
  "change": <numeric day change>,
  "percentChange": <numeric day percent change>
}
If this company or ticker does not exist on public exchanges, return:
{
  "found": false,
  "error": "No publicly traded stock or ETF was found for '${clean}'."
}`;

  const raw = await callGemini(prompt, true);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Could not parse market search response for "${clean}".`);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.found || !parsed.symbol || typeof parsed.price !== "number") {
      throw new Error(parsed.error || `Could not find a public stock or ETF matching "${clean}".`);
    }

    const cleanSymbol = parsed.symbol.trim().toUpperCase();
    const cur = parsed.currency === "CAD" || cleanSymbol.endsWith(".TO") ? "CAD" : "USD";

    return {
      symbol: cleanSymbol,
      name: parsed.name || cleanSymbol,
      sector: parsed.sector || "Global Equities",
      currency: cur,
      price: Number(parsed.price.toFixed(2)),
      change: typeof parsed.change === "number" ? Number(parsed.change.toFixed(2)) : 0,
      percentChange: typeof parsed.percentChange === "number" ? Number(parsed.percentChange.toFixed(2)) : 0,
    };
  } catch (err: any) {
    throw new Error(err.message || `Failed to identify stock for "${clean}".`);
  }
}
