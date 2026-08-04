import { describe, it, expect } from "vitest";
import { money, norm, num, parseNum } from "./format";

describe("money", () => {
  it("renders zero as a dash", () => {
    expect(money(0)).toBe("-");
  });

  it("formats with 2 decimals by default (es-AR)", () => {
    expect(money(1234.5)).toBe("1.234,50");
  });

  it("formats with 0 decimals when decimals=false", () => {
    expect(money(1234.5, false)).toBe("1.235");
  });

  it("returns empty string for null/undefined/NaN/empty", () => {
    expect(money(null)).toBe("");
    expect(money(undefined)).toBe("");
    expect(money(NaN)).toBe("");
    expect(money("")).toBe("");
  });
});

describe("num", () => {
  it("formats integers with thousands separators", () => {
    expect(num(1234)).toBe("1.234");
  });

  it("returns empty string for null/undefined/NaN/empty", () => {
    expect(num(null)).toBe("");
    expect(num(undefined)).toBe("");
    expect(num(NaN)).toBe("");
    expect(num("")).toBe("");
  });
});

describe("parseNum", () => {
  it("parses es-AR formatted strings", () => {
    expect(parseNum("1.795.836,02")).toBe(1795836.02);
  });

  it("parses plain decimal strings", () => {
    expect(parseNum("1795836.02")).toBe(1795836.02);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(parseNum(null)).toBe(0);
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum("")).toBe(0);
  });

  it("passes through numbers unchanged", () => {
    expect(parseNum(1500)).toBe(1500);
  });

  it("returns 0 for unparsable strings", () => {
    expect(parseNum("abc")).toBe(0);
  });
});

describe("norm", () => {
  it("lowercases and strips diacritics", () => {
    expect(norm("ESTACIÓN El Bajo")).toBe("estacion el bajo");
  });

  it("returns an empty string for empty or undefined input", () => {
    expect(norm("")).toBe("");
    expect(norm(undefined as unknown as string)).toBe("");
  });
});
