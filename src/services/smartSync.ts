// Smart Catch-Up Sync Service
// Automatically synchronizes stock prices at market open (9:30 AM ET) and close (4:00 PM ET)
// without requiring persistent backend infrastructure.
import { store } from "../state";

const LAST_SYNC_KEY = "marketpulse_last_sync_timestamp";

export function getLastSyncTimestamp(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return null;
    const ts = parseInt(raw, 10);
    return isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

export function setLastSyncTimestamp(ts: number = Date.now()): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(ts));
  } catch {}
}

export type EtTimeInfo = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
  isWeekday: boolean;
  minutesSinceMidnight: number;
};

export function getEtTimeInfo(date: Date = new Date()): EtTimeInfo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10);
  const minute = parseInt(map.minute, 10);
  const weekday = map.weekday || "";
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const minutesSinceMidnight = hour * 60 + minute;

  return { year, month, day, hour, minute, weekday, isWeekday, minutesSinceMidnight };
}

/**
 * Determines whether an automatic sync is due.
 * - Always triggers if no sync has occurred yet.
 * - During market hours (9:30 AM - 4:00 PM ET): polls every 20 seconds.
 * - Outside market hours: refreshes if prices haven't been updated in the last 60 seconds.
 * - Triggers immediately when market open (9:30 AM ET) or close (4:00 PM ET) is crossed.
 */
export function isCatchUpSyncDue(lastSync: number | null): boolean {
  // If no sync has occurred yet, sync immediately
  if (!lastSync) return true;

  const now = new Date();
  const lastDate = new Date(lastSync);
  const nowMs = now.getTime();
  const lastMs = lastDate.getTime();

  // If clock moved backwards, don't trigger
  if (nowMs < lastMs) return false;

  const nowEt = getEtTimeInfo(now);
  const lastEt = getEtTimeInfo(lastDate);

  const OPEN_MINUTES = 570; // 9:30 AM ET
  const CLOSE_MINUTES = 960; // 4:00 PM ET

  const isMarketOpen =
    nowEt.isWeekday &&
    nowEt.minutesSinceMidnight >= OPEN_MINUTES &&
    nowEt.minutesSinceMidnight < CLOSE_MINUTES;

  // 1. In-session (regular trading hours): sync if older than 20 seconds
  if (isMarketOpen) {
    return nowMs - lastMs >= 20 * 1000;
  }

  // 2. Outside market hours: update if prices haven't been synced in the last 60 seconds (1 minute)
  if (nowMs - lastMs >= 60 * 1000) {
    return true;
  }

  // 3. Market milestones:
  // Crossed 9:30 AM market open today
  if (
    nowEt.isWeekday &&
    lastEt.minutesSinceMidnight < OPEN_MINUTES &&
    nowEt.minutesSinceMidnight >= OPEN_MINUTES
  ) {
    return true;
  }
  // Crossed 4:00 PM market close today
  if (
    nowEt.isWeekday &&
    lastEt.minutesSinceMidnight < CLOSE_MINUTES &&
    nowEt.minutesSinceMidnight >= CLOSE_MINUTES
  ) {
    return true;
  }

  return false;
}

/**
 * Evaluates sync state and triggers automatic batch sync.
 * When force is true (e.g. on page refresh or initial load), triggers unconditionally.
 */
export async function checkAndTriggerCatchUpSync(force = false): Promise<boolean> {
  if (store.stocks.value.length === 0) return false;
  if (store.isSyncingAll.value) return false;

  const lastSync = getLastSyncTimestamp();
  if (!force && !isCatchUpSyncDue(lastSync)) return false;

  await store.syncAllStocks(true);
  return true;
}

/**
 * Initializes automatic background listeners for catch-up syncing and live in-session updates.
 */
export function initSmartCatchUpSync(): () => void {
  // 1. ALWAYS trigger an immediate sync when app loads or page is refreshed
  checkAndTriggerCatchUpSync(true);

  // 2. Check whenever user switches back to this tab/window
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      store.refreshMarketStatus();
      checkAndTriggerCatchUpSync();
    }
  };
  const handleFocus = () => {
    checkAndTriggerCatchUpSync();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);

  // 3. Periodic check every 15 seconds while tab remains open
  const intervalId = setInterval(() => {
    store.refreshMarketStatus();
    if (document.visibilityState === "visible") {
      checkAndTriggerCatchUpSync();
    }
  }, 15 * 1000);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    clearInterval(intervalId);
  };
}
