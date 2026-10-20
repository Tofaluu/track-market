export type Point = { year: number; mcap: number; price?: number };
export type IntradayPoint = { time: string; price: number };

export const CANADIAN_TSX_SYMBOLS = new Set([
  "XEQT", "VEQT", "VFV", "XIC", "ZEB", "VDY", "XIU", "ZSP", "XAW", "VIU", "VEE",
  "SHOP", "RY", "TD", "BNS", "BMO", "CM", "ENB", "TRP", "CNQ", "SU", "CP", "CNR",
  "CSU", "ATD", "BCE", "T", "MFC", "SLF", "POW", "WCN", "GFL", "NTR", "ABX", "AEM"
]);

export function getStockExpectedCurrency(
  symbol: string,
  sector?: string,
  explicitCurrency?: string
): "USD" | "CAD" {
  if (explicitCurrency === "CAD" || explicitCurrency === "USD") {
    return explicitCurrency;
  }
  const clean = symbol.trim().toUpperCase();
  if (clean.endsWith(".TO")) return "CAD";
  if (CANADIAN_TSX_SYMBOLS.has(clean)) return "CAD";
  if (sector && (sector.includes("Canadian") || sector.includes("TSX"))) return "CAD";
  return "USD";
}

export type Stock = {
  name: string;
  symbol: string;
  date: string;
  mcap: string;
  price: number;
  change: number;
  percentChange: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  peRatio: number;
  sector: string;
  currency?: string;
  /** false while the price is a catalog placeholder awaiting its first live quote. */
  synced?: boolean;
  history: Point[];
  intraday: IntradayPoint[];
};

// Generates smooth intraday price curve ending at current price
export function generateIntraday(currentPrice: number, change: number): IntradayPoint[] {
  const openPrice = Math.max(1, currentPrice - change);
  const times = [
    "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00",
    "14:30", "15:00", "15:30", "16:00"
  ];
  
  const points: IntradayPoint[] = [];
  const range = currentPrice - openPrice;

  times.forEach((time, index) => {
    if (index === 0) {
      points.push({ time, price: Number(openPrice.toFixed(2)) });
    } else if (index === times.length - 1) {
      points.push({ time, price: Number(currentPrice.toFixed(2)) });
    } else {
      const progress = index / (times.length - 1);
      const noise = (Math.sin(index * 1.5) * 0.4 + (index % 2 === 0 ? 0.3 : -0.2)) * (currentPrice * 0.006);
      const intermediate = openPrice + range * progress + noise;
      points.push({ time, price: Number(Math.max(1, intermediate).toFixed(2)) });
    }
  });

  return points;
}

export const stockRecords: Stock[] = [
  {
    name: "iShares Core Equity ETF Portfolio",
    symbol: "XEQT",
    currency: "CAD",
    date: new Date().toISOString(),
    mcap: "5.8 B",
    price: 34.82,
    change: 0.18,
    percentChange: 0.52,
    open: 34.64,
    dayHigh: 34.95,
    dayLow: 34.60,
    volume: 385000,
    peRatio: 17.5,
    sector: "Canadian All-Equity ETF (TSX)",
    history: [
      { year: 2020, mcap: 0.8, price: 21.40 },
      { year: 2021, mcap: 1.8, price: 27.80 },
      { year: 2022, mcap: 2.4, price: 24.30 },
      { year: 2023, mcap: 3.5, price: 27.90 },
      { year: 2024, mcap: 4.6, price: 32.10 },
      { year: 2025, mcap: 5.2, price: 34.10 },
      { year: 2026, mcap: 5.8, price: 34.82 },
    ],
    intraday: generateIntraday(34.82, 0.18),
  },
  {
    name: "NVIDIA",
    symbol: "NVDA",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "2,920 B",
    price: 118.50,
    change: 2.15,
    percentChange: 1.85,
    open: 116.35,
    dayHigh: 120.40,
    dayLow: 115.80,
    volume: 68420000,
    peRatio: 42.4,
    sector: "Semiconductors & AI Hardware",
    history: [
      { year: 2020, mcap: 320, price: 13.05 },
      { year: 2021, mcap: 735, price: 29.41 },
      { year: 2022, mcap: 364, price: 14.61 },
      { year: 2023, mcap: 1220, price: 49.52 },
      { year: 2024, mcap: 2850, price: 115.20 },
      { year: 2025, mcap: 3100, price: 125.40 },
      { year: 2026, mcap: 2920, price: 118.50 },
    ],
    intraday: generateIntraday(118.50, 2.15),
  },
  {
    name: "Apple",
    symbol: "AAPL",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "4,820 B",
    price: 317.50,
    change: 2.06,
    percentChange: 0.65,
    open: 315.44,
    dayHigh: 319.15,
    dayLow: 314.80,
    volume: 52800000,
    peRatio: 34.2,
    sector: "Consumer Electronics & Services",
    history: [
      { year: 2020, mcap: 2250, price: 132.69 },
      { year: 2021, mcap: 2910, price: 177.57 },
      { year: 2022, mcap: 2060, price: 129.93 },
      { year: 2023, mcap: 2980, price: 192.53 },
      { year: 2024, mcap: 3350, price: 220.40 },
      { year: 2025, mcap: 4100, price: 270.50 },
      { year: 2026, mcap: 4820, price: 317.50 },
    ],
    intraday: generateIntraday(317.50, 2.06),
  },
  {
    name: "Microsoft",
    symbol: "MSFT",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "3,140 B",
    price: 422.50,
    change: 3.40,
    percentChange: 0.81,
    open: 419.10,
    dayHigh: 425.80,
    dayLow: 418.20,
    volume: 21500000,
    peRatio: 35.1,
    sector: "Cloud & Enterprise Software",
    history: [
      { year: 2020, mcap: 1680, price: 222.42 },
      { year: 2021, mcap: 2520, price: 336.32 },
      { year: 2022, mcap: 1780, price: 239.82 },
      { year: 2023, mcap: 2790, price: 376.04 },
      { year: 2024, mcap: 3120, price: 415.20 },
      { year: 2025, mcap: 3350, price: 430.10 },
      { year: 2026, mcap: 3140, price: 422.50 },
    ],
    intraday: generateIntraday(422.50, 3.40),
  },
  {
    name: "Alphabet",
    symbol: "GOOGL",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "2,150 B",
    price: 172.80,
    change: -0.95,
    percentChange: -0.55,
    open: 173.75,
    dayHigh: 175.40,
    dayLow: 171.90,
    volume: 19800000,
    peRatio: 24.2,
    sector: "Search, Cloud & AI",
    history: [
      { year: 2020, mcap: 1180, price: 87.63 },
      { year: 2021, mcap: 1920, price: 144.85 },
      { year: 2022, mcap: 1140, price: 88.73 },
      { year: 2023, mcap: 1760, price: 140.93 },
      { year: 2024, mcap: 2150, price: 170.50 },
      { year: 2025, mcap: 2350, price: 184.20 },
      { year: 2026, mcap: 2150, price: 172.80 },
    ],
    intraday: generateIntraday(172.80, -0.95),
  },
  {
    name: "Amazon",
    symbol: "AMZN",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "1,980 B",
    price: 188.20,
    change: 1.60,
    percentChange: 0.86,
    open: 186.60,
    dayHigh: 190.20,
    dayLow: 185.90,
    volume: 32400000,
    peRatio: 43.1,
    sector: "E-Commerce & AWS Cloud",
    history: [
      { year: 2020, mcap: 1630, price: 162.85 },
      { year: 2021, mcap: 1690, price: 166.72 },
      { year: 2022, mcap: 855, price: 84.00 },
      { year: 2023, mcap: 1570, price: 151.94 },
      { year: 2024, mcap: 1950, price: 185.00 },
      { year: 2025, mcap: 2180, price: 205.30 },
      { year: 2026, mcap: 1980, price: 188.20 },
    ],
    intraday: generateIntraday(188.20, 1.60),
  },
  {
    name: "Meta",
    symbol: "META",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "1,310 B",
    price: 515.60,
    change: 4.80,
    percentChange: 0.94,
    open: 510.80,
    dayHigh: 520.40,
    dayLow: 508.90,
    volume: 14200000,
    peRatio: 26.5,
    sector: "Social Media & Meta Intelligence",
    history: [
      { year: 2020, mcap: 778, price: 273.16 },
      { year: 2021, mcap: 926, price: 336.35 },
      { year: 2022, mcap: 320, price: 120.34 },
      { year: 2023, mcap: 909, price: 353.96 },
      { year: 2024, mcap: 1280, price: 502.10 },
      { year: 2025, mcap: 1450, price: 560.40 },
      { year: 2026, mcap: 1310, price: 515.60 },
    ],
    intraday: generateIntraday(515.60, 4.80),
  },
  {
    name: "Tesla",
    symbol: "TSLA",
    currency: "USD",
    date: new Date().toISOString(),
    mcap: "695 B",
    price: 218.40,
    change: -3.20,
    percentChange: -1.44,
    open: 221.60,
    dayHigh: 224.50,
    dayLow: 216.80,
    volume: 58200000,
    peRatio: 64.8,
    sector: "Electric Vehicles & Clean Energy",
    history: [
      { year: 2020, mcap: 668, price: 235.22 },
      { year: 2021, mcap: 1060, price: 352.26 },
      { year: 2022, mcap: 388, price: 123.18 },
      { year: 2023, mcap: 789, price: 248.48 },
      { year: 2024, mcap: 720, price: 225.00 },
      { year: 2025, mcap: 810, price: 255.00 },
      { year: 2026, mcap: 695, price: 218.40 },
    ],
    intraday: generateIntraday(218.40, -3.20),
  },
  {
    name: "Shopify",
    symbol: "SHOP",
    currency: "CAD",
    date: new Date().toISOString(),
    mcap: "104 B",
    price: 104.50,
    change: 1.80,
    percentChange: 1.75,
    open: 102.70,
    dayHigh: 106.20,
    dayLow: 102.10,
    volume: 2480000,
    peRatio: 72.0,
    sector: "Canadian E-Commerce Technology (TSX)",
    history: [
      { year: 2020, mcap: 140, price: 113.00 },
      { year: 2021, mcap: 175, price: 137.00 },
      { year: 2022, mcap: 45, price: 34.50 },
      { year: 2023, mcap: 98, price: 77.90 },
      { year: 2024, mcap: 102, price: 82.40 },
      { year: 2025, mcap: 120, price: 96.00 },
      { year: 2026, mcap: 104, price: 104.50 },
    ],
    intraday: generateIntraday(104.50, 1.80),
  },
  {
    name: "Royal Bank of Canada",
    symbol: "RY",
    currency: "CAD",
    date: new Date().toISOString(),
    mcap: "245 B",
    price: 172.40,
    change: 0.65,
    percentChange: 0.38,
    open: 171.75,
    dayHigh: 173.20,
    dayLow: 171.20,
    volume: 1850000,
    peRatio: 13.5,
    sector: "Canadian Diversified Banking (TSX)",
    history: [
      { year: 2020, mcap: 148, price: 104.50 },
      { year: 2021, mcap: 192, price: 134.20 },
      { year: 2022, mcap: 178, price: 127.00 },
      { year: 2023, mcap: 188, price: 133.90 },
      { year: 2024, mcap: 228, price: 162.00 },
      { year: 2025, mcap: 250, price: 175.40 },
      { year: 2026, mcap: 245, price: 172.40 },
    ],
    intraday: generateIntraday(172.40, 0.65),
  },
];
