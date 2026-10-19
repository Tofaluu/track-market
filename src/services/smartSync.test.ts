import { afterEach, describe, expect, it, vi } from "vitest";

// smartSync only needs the store for the trigger path; keep the real store
// (and its Supabase client) out of these scheduling tests.
vi.mock("../state", () => ({ store: {} }));

const { getEtTimeInfo, isCatchUpSyncDue } = await import("./smartSync");

// Wednesday, Oct 14 2026. Eastern Time is UTC-4 (EDT).
const WED_11AM_ET = new Date("2026-10-14T15:00:00Z");
const WED_8PM_ET = new Date("2026-10-15T00:00:00Z");
const SAT_NOON_ET = new Date("2026-10-17T16:00:00Z");

const secondsBefore = (date: Date, seconds: number) => date.getTime() - seconds * 1000;

afterEach(() => {
  vi.useRealTimers();
});

describe("getEtTimeInfo", () => {
  it("converts to Eastern Time regardless of the machine's zone", () => {
    const info = getEtTimeInfo(new Date("2026-10-19T13:30:00Z"));
    expect(info).toMatchObject({ weekday: "Mon", isWeekday: true, hour: 9, minute: 30 });
    expect(info.minutesSinceMidnight).toBe(570);
  });

  it("flags weekends", () => {
    expect(getEtTimeInfo(SAT_NOON_ET).isWeekday).toBe(false);
  });
});

describe("isCatchUpSyncDue", () => {
  it("syncs immediately when nothing has synced yet", () => {
    expect(isCatchUpSyncDue(null)).toBe(true);
  });

  it("polls every 20 seconds during market hours", () => {
    vi.useFakeTimers({ now: WED_11AM_ET });
    expect(isCatchUpSyncDue(secondsBefore(WED_11AM_ET, 10))).toBe(false);
    expect(isCatchUpSyncDue(secondsBefore(WED_11AM_ET, 25))).toBe(true);
  });

  it("backs off to once a minute after the close", () => {
    vi.useFakeTimers({ now: WED_8PM_ET });
    expect(isCatchUpSyncDue(secondsBefore(WED_8PM_ET, 30))).toBe(false);
    expect(isCatchUpSyncDue(secondsBefore(WED_8PM_ET, 90))).toBe(true);
  });

  it("treats weekends as closed", () => {
    vi.useFakeTimers({ now: SAT_NOON_ET });
    expect(isCatchUpSyncDue(secondsBefore(SAT_NOON_ET, 30))).toBe(false);
  });

  it("does not sync when the clock moved backwards", () => {
    vi.useFakeTimers({ now: WED_11AM_ET });
    expect(isCatchUpSyncDue(WED_11AM_ET.getTime() + 60_000)).toBe(false);
  });
});
