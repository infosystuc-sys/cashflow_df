import { describe, it, expect } from "vitest";
import { monthKeyFromISO, monthLabel, monthLong, addMonth, monthRange } from "./dates";

describe("monthKeyFromISO", () => {
  it("extracts YYYY-MM from an ISO date", () => {
    expect(monthKeyFromISO("2025-07-15")).toBe("2025-07");
  });

  it("returns null for empty input", () => {
    expect(monthKeyFromISO("")).toBeNull();
  });
});

describe("monthLabel", () => {
  it("formats a month key as 'mon-yy' in Spanish", () => {
    expect(monthLabel("2025-07")).toBe("jul-25");
    expect(monthLabel("2026-01")).toBe("ene-26");
  });

  it("returns empty string for empty input", () => {
    expect(monthLabel("")).toBe("");
  });
});

describe("monthLong", () => {
  it("formats a month key as 'Month YYYY' in Spanish", () => {
    expect(monthLong("2025-07")).toBe("Julio 2025");
  });
});

describe("addMonth", () => {
  it("adds months within a year", () => {
    expect(addMonth("2025-07", 1)).toBe("2025-08");
  });

  it("rolls over to the next year", () => {
    expect(addMonth("2025-12", 1)).toBe("2026-01");
  });

  it("rolls back to the previous year", () => {
    expect(addMonth("2025-01", -1)).toBe("2024-12");
  });
});

describe("monthRange", () => {
  it("returns an inclusive list of month keys", () => {
    expect(monthRange("2025-07", "2025-09")).toEqual(["2025-07", "2025-08", "2025-09"]);
  });

  it("returns a single key when start === end", () => {
    expect(monthRange("2025-12", "2025-12")).toEqual(["2025-12"]);
  });
});
