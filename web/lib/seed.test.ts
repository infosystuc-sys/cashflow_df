import { describe, it, expect } from "vitest";
import { seedMovements, seedState } from "./seed";
import { buildCashflow } from "./calc";
import { monthRange } from "./dates";

describe("seedMovements", () => {
  it("has the expected number of movements per bank", () => {
    const movements = seedMovements();
    expect(movements.filter((m) => m.bank === "galicia")).toHaveLength(16);
    expect(movements.filter((m) => m.bank === "nacion")).toHaveLength(9);
  });
});

describe("seedState", () => {
  it("produces a cashflow with one row per configured month", () => {
    const state = seedState();
    const cf = buildCashflow(state);
    const expectedMonths = monthRange(state.settings.rangeStart, state.settings.rangeEnd);
    expect(cf.months).toEqual(expectedMonths);
    expect(cf.rows).toHaveLength(21); // 2025-07 .. 2027-03
  });
});
