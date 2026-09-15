// Centralized application state, undoable actions, and real-time market simulation engine.
import { computed, signal, effect } from "@preact/signals";
import { MAX_STOCKS } from "./constants";
import type { Stock } from "./stocks";
import { stockRecords, generateIntraday, getStockExpectedCurrency } from "./stocks";
import { UndoManager, type Command } from "./undo";
import { GLOBAL_TICKER_DIRECTORY, createStockFromTicker } from "./tickerDatabase";
import {
  batchFetchLivePricesWithAI,
  fetchLivePriceWithAI,
  hasGeminiApiKey,
  type BatchPriceResult,
  type ResolvedAsset,
} from "./services/gemini";
import {
  fetchYahooFinanceQuote,
  batchFetchYahooFinanceQuotes,
} from "./services/yahooFinance";
import { setLastSyncTimestamp } from "./services/smartSync";
import { supabase } from "./services/supabase";

export type ViewMode = "chart" | "ai";
export type Timeframe = "1D" | "1Y" | "5Y" | "ALL";
export type ChartMetric = "price" | "mcap";

/**
 * Checks if North American equity markets (NYSE, NASDAQ, TSX) are currently open.
 * Regular hours: Mon–Fri 9:30 AM – 4:00 PM Eastern Time.
 */
export function isMarketOpen(): boolean {
  try {
    const etString = new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    const etDate = new Date(etString);
    const day = etDate.getDay(); // 0 = Sun, 6 = Sat
    if (day === 0 || day === 6) return false;
    const minutes = etDate.getHours() * 60 + etDate.getMinutes();
    return minutes >= 570 && minutes < 960; // 9:30 AM to 4:00 PM ET
  } catch {
    return false;
  }
}

const STORAGE_KEY = "marketpulse_watchlist_v3";

function loadPersistedWatchlist(): Stock[] | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data === null) return null;
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn("Failed to load persisted watchlist", err);
  }
  return null;
}

function persistWatchlist(stocks: Stock[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
  } catch (err) {
    console.warn("Failed to persist watchlist", err);
  }
}
const UI_STATE_KEY = "marketpulse_ui_state";

function loadUiState() {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export type Position = {
  symbol: string;
  quantity: number;
  average_cost: number;
};

const PORTFOLIO_STATE_KEY = "marketpulse_portfolio_state";

function loadPortfolioState() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_STATE_KEY);
    return raw ? JSON.parse(raw) : { cashBalance: 0, positions: [] };
  } catch {
    return { cashBalance: 0, positions: [] };
  }
}

class StockStore {
  // Initialize with persisted watchlist if present, otherwise empty watchlist
  private initialStocks = loadPersistedWatchlist() ?? [];
  private initialUi = loadUiState();

  stocks = signal<Stock[]>(this.initialStocks);
  selectedSymbols = signal<Set<string>>(new Set<string>(this.initialUi.selectedSymbols || []));
  viewMode = signal<ViewMode>(this.initialUi.viewMode || "chart");
  chartTimeframe = signal<Timeframe>(this.initialUi.chartTimeframe || "1D");
  chartMetric = signal<ChartMetric>("price");

  // Market session schedule (Mon-Fri 9:30 AM - 4:00 PM Eastern Time)
  isMarketOpen = signal<boolean>(isMarketOpen());
  lastMarketUpdate = signal<string>(
    this.initialUi.lastMarketUpdate || (isMarketOpen() ? "Regular Trading Session" : "4:00 PM ET (Market Close)")
  );
  searchQuery = signal<string>("");

  // Real-time AI Quote Synchronization state
  syncingSymbols = signal<Set<string>>(new Set<string>());
  isSyncingAll = signal<boolean>(false);
  syncMessage = signal<string | null>(null);

  // Authentication state
  session = signal<any>(null);
  user = signal<any>(null);
  isAuthModalOpen = signal<boolean>(false);
  isTradeModalOpen = signal<boolean>(false);


  // Portfolio state
  private initialPortfolio = loadPortfolioState();
  cashBalance = signal<number>(this.initialPortfolio.cashBalance);
  positions = signal<Position[]>(this.initialPortfolio.positions);
  activeTab = signal<"watchlist" | "portfolio">(this.initialUi.activeTab || "watchlist");

  // Global Toast
  toastMessage = signal<string | null>(null);

  showToast(msg: string) {
    this.toastMessage.value = msg;
    setTimeout(() => {
      if (this.toastMessage.value === msg) {
        this.toastMessage.value = null;
      }
    }, 3500);
  }

  private undoManager = new UndoManager();
  private historyVersion = signal(0);

  constructor() {
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      this.session.value = session;
      this.user.value = session?.user ?? null;
      this.loadSupabaseWatchlist();
      this.loadSupabasePortfolio();
    });

    // Listen for auth changes
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.value = session;
      this.user.value = session?.user ?? null;
      if (session?.user) {
        this.loadSupabaseWatchlist();
        this.loadSupabasePortfolio();
      } else {
        this.cashBalance.value = 0;
        this.positions.value = [];
        this.activeTab.value = "watchlist";
      }
    });

    // Auto-persist UI state
    effect(() => {
      try {
        localStorage.setItem(UI_STATE_KEY, JSON.stringify({
          selectedSymbols: Array.from(this.selectedSymbols.value),
          activeTab: this.activeTab.value,
          viewMode: this.viewMode.value,
          chartTimeframe: this.chartTimeframe.value,
          lastMarketUpdate: this.lastMarketUpdate.value,
        }));
      } catch {}
    });

    // Auto-persist Portfolio state for instant load
    effect(() => {
      try {
        localStorage.setItem(PORTFOLIO_STATE_KEY, JSON.stringify({
          cashBalance: this.cashBalance.value,
          positions: this.positions.value,
        }));
      } catch {}
    });
  }

  async loadSupabasePortfolio() {
    if (!this.user.value) return;
    
    // Load cash balance
    const { data: profile } = await supabase
      .from("profiles")
      .select("cash_balance")
      .eq("id", this.user.value.id)
      .single();
    
    if (profile) {
      this.cashBalance.value = Number(profile.cash_balance);
    }

    // Load positions
    const { data: positions } = await supabase
      .from("positions")
      .select("*")
      .eq("user_id", this.user.value.id);
      
    if (positions) {
      this.positions.value = positions as Position[];
    }
  }

  async loadSupabaseWatchlist() {
    if (!this.user.value) return;
    const { data } = await supabase
      .from("watchlists")
      .select("symbol")
      .order("created_at", { ascending: true });
    
    if (data) {
      const dbSymbols = data.map((r: any) => r.symbol);
      const localStockMap = new Map(this.stocks.value.map(s => [s.symbol, s]));
      
      const nextStocks: Stock[] = [];
      for (const sym of dbSymbols) {
        if (localStockMap.has(sym)) {
          nextStocks.push(localStockMap.get(sym)!);
        } else {
          const catalog = stockRecords.find((s) => s.symbol === sym);
          nextStocks.push(catalog ? { ...catalog } : createStockFromTicker(sym));
        }
      }
      
      this.stocks.value = nextStocks;
      this.save();
      this.normalizeSelection();
      
      if (this.stocks.value.length > 0) {
        this.syncAllStocks();
      }
    }
  }

  save() {
    persistWatchlist(this.stocks.value);
  }

  resetToDefaultWatchlist() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.stocks.value = [];
    this.selectedSymbols.value = new Set<string>();
    this.save();
    if (this.user.value) {
      supabase.from("watchlists").delete().match({ user_id: this.user.value.id }).then();
    }
  }

  canUndo = computed(() => {
    this.historyVersion.value;
    return this.undoManager.canUndo;
  });

  canRedo = computed(() => {
    this.historyVersion.value;
    return this.undoManager.canRedo;
  });

  selectedCount = computed(() => this.selectedSymbols.value.size);

  hasSingleSelection = computed(() => this.selectedCount.value === 1);

  selectedStock = computed<Stock | null>(() => {
    if (this.selectedSymbols.value.size !== 1) return null;
    const symbol = Array.from(this.selectedSymbols.value)[0];
    return this.stocks.value.find((stock) => stock.symbol === symbol) ?? null;
  });

  canAdd = computed(() => this.stocks.value.length < MAX_STOCKS);

  canDelete = computed(
    () => this.stocks.value.length > 0 && this.selectedSymbols.value.size > 0
  );

  statusLabel = computed(() => {
    const count = this.stocks.value.length;
    const selected = this.selectedSymbols.value.size;
    if (count === 0) return "No Stocks (0 Selected)";
    if (count === 1) return `1 Stock (${selected} Selected)`;
    return `${count} Stocks (${selected} Selected)`;
  });

  filteredStocks = computed(() => {
    const query = this.searchQuery.value.trim().toLowerCase();
    if (!query) return this.stocks.value;
    return this.stocks.value.filter(
      (s) =>
        s.symbol.toLowerCase().includes(query) ||
        s.name.toLowerCase().includes(query) ||
        (s.sector && s.sector.toLowerCase().includes(query))
    );
  });

  isSelected(symbol: string) {
    return this.selectedSymbols.value.has(symbol);
  }

  setViewMode(mode: ViewMode) {
    if (!this.hasSingleSelection.value) return;
    this.viewMode.value = mode;
  }

  setTimeframe(tf: Timeframe) {
    this.chartTimeframe.value = tf;
  }

  setChartMetric(metric: ChartMetric) {
    this.chartMetric.value = metric;
  }

  setSearchQuery(query: string) {
    this.searchQuery.value = query;
  }

  updateStockPrice(
    symbol: string,
    newPrice: number,
    newChange?: number,
    newPctChange?: number,
    newDayHigh?: number,
    newDayLow?: number,
    currency?: string
  ) {
    const cleanSymbol = symbol.trim().toUpperCase();
    this.lastMarketUpdate.value = `Updated at ${new Date().toLocaleTimeString()}`;
    this.stocks.value = this.stocks.value.map((s) => {
      if (s.symbol !== cleanSymbol) return s;

      const change =
        newChange !== undefined
          ? newChange
          : Number((newPrice - s.open).toFixed(2));
      const percentChange =
        newPctChange !== undefined
          ? newPctChange
          : Number(((change / s.open) * 100).toFixed(2));

      const updatedHistory = (s.history || []).map((h) =>
        h.year === 2026 ? { ...h, price: newPrice } : h
      );
      const updatedIntraday = generateIntraday(newPrice, change);

      const open = Number((newPrice - change).toFixed(2));
      const calcHigh = Math.max(newPrice, open);
      const calcLow = Math.min(newPrice, open);

      // Prefer genuine dayHigh/dayLow from quote; otherwise recalculate if previous was distorted
      const dayHigh =
        newDayHigh !== undefined && newDayHigh >= newPrice
          ? newDayHigh
          : (s.dayHigh > newPrice * 1.15 || s.dayHigh < newPrice ? calcHigh : Math.max(s.dayHigh, newPrice));

      const dayLow =
        newDayLow !== undefined && newDayLow <= newPrice && newDayLow > 0
          ? newDayLow
          : (s.dayLow < newPrice * 0.85 || s.dayLow > newPrice ? calcLow : Math.min(s.dayLow, newPrice));

      return {
        ...s,
        currency: currency || s.currency || getStockExpectedCurrency(s.symbol, s.sector),
        price: newPrice,
        change,
        percentChange,
        dayHigh,
        dayLow,
        intraday: updatedIntraday,
        history: updatedHistory,
      };
    });
    setLastSyncTimestamp();
    this.save();
  }

  batchUpdatePrices(priceMap: BatchPriceResult) {
    this.lastMarketUpdate.value = `Synced at ${new Date().toLocaleTimeString()}`;
    this.stocks.value = this.stocks.value.map((stock) => {
      const sym = stock.symbol.toUpperCase();
      const update =
        priceMap[sym] ||
        (sym.endsWith(".TO") ? priceMap[sym.replace(".TO", "")] : priceMap[`${sym}.TO`]);

      if (!update) return stock;

      const change =
        update.change !== undefined
          ? update.change
          : Number((update.price - stock.open).toFixed(2));
      const percentChange =
        update.percentChange !== undefined
          ? update.percentChange
          : Number(((change / stock.open) * 100).toFixed(2));

      const updatedHistory = (stock.history || []).map((h) =>
        h.year === 2026 ? { ...h, price: update.price } : h
      );
      const updatedIntraday = generateIntraday(update.price, change);

      const open = Number((update.price - change).toFixed(2));
      const calcHigh = Math.max(update.price, open);
      const calcLow = Math.min(update.price, open);

      const dayHigh =
        update.dayHigh !== undefined && update.dayHigh >= update.price
          ? update.dayHigh
          : (stock.dayHigh > update.price * 1.15 || stock.dayHigh < update.price ? calcHigh : Math.max(stock.dayHigh, update.price));

      const dayLow =
        update.dayLow !== undefined && update.dayLow <= update.price && update.dayLow > 0
          ? update.dayLow
          : (stock.dayLow < update.price * 0.85 || stock.dayLow > update.price ? calcLow : Math.min(stock.dayLow, update.price));

      return {
        ...stock,
        currency: update.currency || stock.currency || getStockExpectedCurrency(stock.symbol, stock.sector),
        price: update.price,
        change,
        percentChange,
        dayHigh,
        dayLow,
        intraday: updatedIntraday,
        history: updatedHistory,
      };
    });
    setLastSyncTimestamp();
    this.save();
  }

  isSyncing(symbol?: string): boolean {
    if (this.isSyncingAll.value) return true;
    if (!symbol) return this.syncingSymbols.value.size > 0;
    return this.syncingSymbols.value.has(symbol.trim().toUpperCase());
  }

  async syncAllStocks(silent = false): Promise<boolean> {
    if (this.stocks.value.length === 0) return false;
    if (this.isSyncingAll.value) return false;

    this.isSyncingAll.value = true;
    if (!silent) this.syncMessage.value = null;

    try {
      // 1. Fetch real-time market quotes from Yahoo Finance
      const yahooResults = await batchFetchYahooFinanceQuotes(this.stocks.value);
      let mergedResults: BatchPriceResult = { ...yahooResults };

      // 2. For any stock missing from Yahoo, fall back to Gemini AI if API key is present
      const missingStocks = this.stocks.value.filter(
        (s) => !mergedResults[s.symbol.toUpperCase()]
      );

      if (missingStocks.length > 0 && hasGeminiApiKey()) {
        try {
          const aiResults = await batchFetchLivePricesWithAI(missingStocks);
          mergedResults = { ...mergedResults, ...aiResults };
        } catch {
          // Keep whatever Yahoo returned
        }
      }

      const count = Object.keys(mergedResults).length;
      if (count > 0) {
        this.batchUpdatePrices(mergedResults);
        setLastSyncTimestamp();
        if (!silent) {
          this.syncMessage.value = `✓ Synced ${count} stocks with live quotes`;
        }
        return true;
      } else {
        if (!silent) this.syncMessage.value = "No updates returned";
        return false;
      }
    } catch (err: any) {
      if (!silent) {
        this.syncMessage.value = err?.message || "Sync failed";
      }
      return false;
    } finally {
      this.isSyncingAll.value = false;
      if (!silent) {
        setTimeout(() => {
          this.syncMessage.value = null;
        }, 4000);
      }
    }
  }

  async syncSingleStock(symbol: string): Promise<boolean> {
    const clean = symbol.trim().toUpperCase();
    const stock = this.stocks.value.find((s) => s.symbol === clean);
    if (!stock) return false;

    const nextSyncing = new Set(this.syncingSymbols.value);
    nextSyncing.add(clean);
    this.syncingSymbols.value = nextSyncing;

    try {
      // 1. Try Yahoo Finance real-time quote first
      const yahooResult = await fetchYahooFinanceQuote(
        stock.symbol,
        stock.sector,
        stock.currency
      );

      if (yahooResult) {
        this.updateStockPrice(
          stock.symbol,
          yahooResult.price,
          yahooResult.change,
          yahooResult.percentChange,
          yahooResult.dayHigh,
          yahooResult.dayLow,
          yahooResult.currency
        );
        return true;
      }

      // 2. Fall back to Gemini AI if API key is configured
      if (hasGeminiApiKey()) {
        const result = await fetchLivePriceWithAI(
          stock.symbol,
          stock.name,
          stock.currency,
          stock.sector
        );
        this.updateStockPrice(
          stock.symbol,
          result.price,
          result.change,
          result.percentChange,
          result.dayHigh,
          result.dayLow,
          result.currency
        );
        return true;
      }

      return false;
    } catch (err) {
      console.warn(`Failed to live-sync price for ${clean}:`, err);
      return false;
    } finally {
      const remaining = new Set(this.syncingSymbols.value);
      remaining.delete(clean);
      this.syncingSymbols.value = remaining;
    }
  }

  // --- Undo/Redo & Watchlist Operations ---

  private normalizeSelection() {
    const available = new Set(this.stocks.value.map((stock) => stock.symbol));
    const next = new Set(
      Array.from(this.selectedSymbols.value).filter((symbol) =>
        available.has(symbol)
      )
    );
    this.selectedSymbols.value = next;
  }

  private pushHistory(command: Command) {
    this.undoManager.execute(command);
    this.historyVersion.value++;
  }

  undo() {
    if (!this.undoManager.canUndo) return;
    this.undoManager.undo();
    this.normalizeSelection();
    this.historyVersion.value++;
  }

  redo() {
    if (!this.undoManager.canRedo) return;
    this.undoManager.redo();
    this.normalizeSelection();
    this.historyVersion.value++;
  }

  availableStocks() {
    const current = new Set(this.stocks.value.map((stock) => stock.symbol));
    return GLOBAL_TICKER_DIRECTORY.filter((stock) => !current.has(stock.symbol));
  }

  addVerifiedStock(resolved: ResolvedAsset) {
    if (!this.canAdd.value) return;
    const cleanSymbol = resolved.symbol.trim().toUpperCase();
    if (this.stocks.value.some((s) => s.symbol === cleanSymbol)) {
      this.selectedSymbols.value = new Set([cleanSymbol]);
      this.viewMode.value = "chart";
      return;
    }

    const open = Number((resolved.price - resolved.change).toFixed(2));
    const newStock: Stock = {
      symbol: cleanSymbol,
      name: resolved.name,
      sector: resolved.sector,
      currency: resolved.currency,
      price: resolved.price,
      change: resolved.change,
      percentChange: resolved.percentChange,
      open,
      dayHigh: Math.max(resolved.price, open),
      dayLow: Math.min(resolved.price, open),
      volume: 0,
      peRatio: 0,
      date: new Date().toISOString(),
      mcap: "—",
      history: [],
      intraday: generateIntraday(resolved.price, resolved.change),
    };

    this.addStock(newStock);
    this.syncSingleStock(newStock.symbol);
  }

  addStockBySymbol(symbol: string) {
    if (!this.canAdd.value) return;
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    if (this.stocks.value.some((s) => s.symbol === cleanSymbol)) {
      this.selectedSymbols.value = new Set([cleanSymbol]);
      this.viewMode.value = "chart";
      return;
    }

    const existingInCatalog = stockRecords.find((s) => s.symbol === cleanSymbol);
    const stock = existingInCatalog ? { ...existingInCatalog } : createStockFromTicker(cleanSymbol);
    this.addStock(stock);
    this.syncSingleStock(stock.symbol);
  }

  private addStock(stock: Stock) {
    const insertIndex = this.stocks.value.length;

    const doAdd = () => {
      const next = this.stocks.value.slice();
      next.splice(insertIndex, 0, stock);
      this.stocks.value = next;
      this.selectedSymbols.value = new Set([stock.symbol]);
      this.viewMode.value = "chart";
      this.save();
      if (this.user.value) {
        supabase.from("watchlists").insert({ user_id: this.user.value.id, symbol: stock.symbol }).then();
      }
    };

    const undoAdd = () => {
      const next = this.stocks.value.slice();
      next.splice(insertIndex, 1);
      this.stocks.value = next;
      this.normalizeSelection();
      this.save();
      if (this.user.value) {
        supabase.from("watchlists").delete().match({ user_id: this.user.value.id, symbol: stock.symbol }).then();
      }
    };

    this.pushHistory({ do: doAdd, undo: undoAdd });
    doAdd();
  }

  addRandomStock() {
    if (!this.canAdd.value) return;

    const available = this.availableStocks();
    if (available.length === 0) return;

    const pick = available[Math.floor(Math.random() * available.length)];
    this.addStockBySymbol(pick.symbol);
  }

  deleteSelectedStocks() {
    if (!this.canDelete.value) return;

    const previousStocks = this.stocks.value.slice();
    const previousSelection = new Set(this.selectedSymbols.value);
    const symbolsToDelete = new Set(previousSelection);

    const selectedIndexes = previousStocks
      .map((stock, index) => ({ stock, index }))
      .filter(({ stock }) => previousSelection.has(stock.symbol))
      .map(({ index }) => index)
      .sort((a, b) => a - b);

    if (selectedIndexes.length === 0) return;

    const topMostDeleted = selectedIndexes[0];

    const doDelete = () => {
      const next = this.stocks.value.filter(
        (stock) => !symbolsToDelete.has(stock.symbol)
      );
      this.stocks.value = next;

      if (next.length === 0) {
        this.selectedSymbols.value = new Set();
      } else {
        const nextIndex = Math.max(0, Math.min(topMostDeleted - 1, next.length - 1));
        this.selectedSymbols.value = new Set([next[nextIndex].symbol]);
        this.viewMode.value = "chart";
      }
      this.save();
      if (this.user.value) {
        for (const sym of symbolsToDelete) {
          supabase.from("watchlists").delete().match({ user_id: this.user.value.id, symbol: sym }).then();
        }
      }
    };

    const undoDelete = () => {
      this.stocks.value = previousStocks.slice();
      this.selectedSymbols.value = new Set(previousSelection);
      if (previousSelection.size === 1) {
        this.viewMode.value = "chart";
      }
      this.save();
      if (this.user.value) {
        for (const sym of symbolsToDelete) {
          supabase.from("watchlists").insert({ user_id: this.user.value.id, symbol: sym }).then();
        }
      }
    };

    this.pushHistory({ do: doDelete, undo: undoDelete });
    doDelete();
  }

  clearSelection() {
    if (this.selectedSymbols.value.size === 0) return;
    const before = new Set(this.selectedSymbols.value);

    const doClear = () => {
      this.selectedSymbols.value = new Set();
    };

    const undoClear = () => {
      this.selectedSymbols.value = new Set(before);
      if (before.size === 1) {
        this.viewMode.value = "chart";
      }
    };

    this.pushHistory({ do: doClear, undo: undoClear });
    doClear();
  }

  clickStock(symbol: string, withShift: boolean) {
    const exists = this.stocks.value.some((stock) => stock.symbol === symbol);
    if (!exists) return;

    const before = new Set(this.selectedSymbols.value);
    const after = new Set(before);

    if (withShift) {
      if (after.has(symbol)) after.delete(symbol);
      else after.add(symbol);
    } else {
      if (before.size === 1 && before.has(symbol)) {
        after.clear();
      } else {
        after.clear();
        after.add(symbol);
      }
    }

    const changed =
      before.size !== after.size ||
      Array.from(before).some((entry) => !after.has(entry));

    if (!changed) return;

    const doSelect = () => {
      this.selectedSymbols.value = new Set(after);
      if (after.size === 1) {
        this.viewMode.value = "chart";
      }
    };

    const undoSelect = () => {
      this.selectedSymbols.value = new Set(before);
      if (before.size === 1) {
        this.viewMode.value = "chart";
      }
    };

    this.pushHistory({ do: doSelect, undo: undoSelect });
    doSelect();
  }

  handleShortcut(key: string) {
    const k = key.toLowerCase();
    const valid = ["a", "d", "c", "u", "r"].includes(k);
    if (!valid) return;

    if (k === "a") {
      this.addRandomStock();
      return;
    }
    if (k === "d") {
      this.deleteSelectedStocks();
      return;
    }
    if (k === "c") {
      this.clearSelection();
      return;
    }
    if (k === "u") {
      this.undo();
      return;
    }
    if (k === "r") {
      this.redo();
    }
  }
}

export const store = new StockStore();
