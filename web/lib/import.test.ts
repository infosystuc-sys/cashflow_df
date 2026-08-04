import { describe, it, expect } from "vitest";
import { parseFechaCell, parseMoneyCell } from "./import";

describe("parseFechaCell", () => {
  it("converts dd/mm/yyyy to ISO yyyy-mm-dd", () => {
    expect(parseFechaCell("03/08/2026")).toBe("2026-08-03");
    expect(parseFechaCell("3/8/2026")).toBe("2026-08-03");
  });

  it("returns '' for empty cells", () => {
    expect(parseFechaCell("")).toBe("");
    expect(parseFechaCell(null)).toBe("");
    expect(parseFechaCell(undefined)).toBe("");
  });

  it("returns null for values that aren't dd/mm/yyyy", () => {
    expect(parseFechaCell("no es una fecha")).toBeNull();
    expect(parseFechaCell("2026-08-03")).toBeNull();
    expect(parseFechaCell("32/13/2026")).toBeNull();
  });
});

describe("parseMoneyCell", () => {
  it("parses es-AR formatted strings", () => {
    expect(parseMoneyCell("1.234,56")).toBe(1234.56);
  });

  it("parses plain decimal strings", () => {
    expect(parseMoneyCell("500")).toBe(500);
  });

  it("passes through numbers unchanged", () => {
    expect(parseMoneyCell(1500)).toBe(1500);
  });

  it("returns 0 for empty cells", () => {
    expect(parseMoneyCell("")).toBe(0);
    expect(parseMoneyCell(null)).toBe(0);
    expect(parseMoneyCell(undefined)).toBe(0);
  });
});
