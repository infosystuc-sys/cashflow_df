import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseFechaCell, parseMoneyCell, parseMovementsWorkbook, findDuplicate } from "./import";
import type { Movement } from "./types";

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

const HEADER = [
  "Descripción", "Proveedor / Cliente", "Banco", "F. emisión", "F. pago",
  "Cheque", "Agrupación", "Crédito", "Débito", "Saldo",
];

function makeWorkbookBuffer(rows: (string | number | null)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}

describe("parseMovementsWorkbook", () => {
  it("parses valid rows and skips the 'Saldo Inicial' row", async () => {
    const buf = makeWorkbookBuffer([
      ["Saldo Inicial", "", "Banco Galicia", "", "", "", "", null, null, 1000],
      ["Pago proveedor", "Acme", "Banco Galicia", "01/08/2026", "03/08/2026", "", "Pagos", null, 500, 500],
      ["Cobro cliente", "Cliente X", "Banco Galicia", "", "05/08/2026", "", "Ingresos", 800, null, 1300],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      descripcion: "Pago proveedor",
      proveedor: "Acme",
      fechaEmision: "2026-08-01",
      fechaPago: "2026-08-03",
      cheque: "",
      credito: 0,
      debito: 500,
      grupo: "Pagos",
    });
    expect(result.rows[1].credito).toBe(800);
  });

  it("fails fast when required columns are missing", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Descripción", "Importe"], ["Algo", 100]]);
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toMatch(/formato esperado/);
  });

  it("collects every row error and rejects the whole import (todo o nada)", async () => {
    const buf = makeWorkbookBuffer([
      ["Sin fecha de pago", "", "Banco Galicia", "", "", "", "Pagos", null, 100, null],
      ["Grupo invalido", "", "Banco Galicia", "", "10/08/2026", "", "Varios", null, 100, null],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[1].row).toBe(3);
  });

  it("ignores fully blank rows", async () => {
    const buf = makeWorkbookBuffer([
      ["Pago proveedor", "", "Banco Galicia", "", "03/08/2026", "", "Pagos", null, 500, 500],
      ["", "", "", "", "", "", "", null, null, null],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
  });
});

describe("findDuplicate", () => {
  const existing: Movement[] = [
    {
      id: "m1", bank: "galicia", descripcion: "Pago proveedor", proveedor: "",
      fechaEmision: "", fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    },
  ];

  it("matches same fechaPago + normalized descripcion + amount", () => {
    const row = {
      descripcion: "PAGO PROVEEDOR", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)?.id).toBe("m1");
  });

  it("returns null when the date differs", () => {
    const row = {
      descripcion: "Pago proveedor", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-04", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)).toBeNull();
  });

  it("returns null when the amount differs", () => {
    const row = {
      descripcion: "Pago proveedor", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 501, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)).toBeNull();
  });
});
