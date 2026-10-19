import { describe, expect, it } from "vitest";
import { getStockExpectedCurrency } from "./stocks";
import { UndoManager } from "./undo";

describe("getStockExpectedCurrency", () => {
  it("prefers an explicit currency", () => {
    expect(getStockExpectedCurrency("XEQT", undefined, "USD")).toBe("USD");
  });

  it("detects TSX listings by suffix, known symbol, or sector", () => {
    expect(getStockExpectedCurrency("ABC.TO")).toBe("CAD");
    expect(getStockExpectedCurrency("ry")).toBe("CAD");
    expect(getStockExpectedCurrency("ZZZ", "Canadian Banks")).toBe("CAD");
  });

  it("defaults to USD", () => {
    expect(getStockExpectedCurrency("AAPL")).toBe("USD");
  });
});

describe("UndoManager", () => {
  it("undoes and redoes commands in order", () => {
    const log: string[] = [];
    const history = new UndoManager();
    const command = (name: string) => ({ do: () => log.push(`do ${name}`), undo: () => log.push(`undo ${name}`) });

    history.execute(command("a"));
    history.execute(command("b"));
    history.undo();
    history.undo();
    history.redo();

    expect(log).toEqual(["undo b", "undo a", "do a"]);
    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(true);
  });

  it("clears the redo stack when a new command runs", () => {
    const history = new UndoManager();
    const noop = { do: () => {}, undo: () => {} };

    history.execute(noop);
    history.undo();
    history.execute(noop);

    expect(history.canRedo).toBe(false);
  });
});
