import { describe, it, expect } from "vitest";
import { bankRows, bankSummary, projTotal, projMonthTotal, realMonth, fciMonth, buildCashflow } from "./calc";
import type { CashflowState } from "./types";
import { PROJ_CONCEPTS, IVA_ROWS } from "./constants";

function emptyProjection() {
  const p: CashflowState["projection"] = {};
  PROJ_CONCEPTS.forEach((c) => (p[c.id] = {}));
  return p;
}

function emptyIva() {
  const v: CashflowState["iva"] = {};
  IVA_ROWS.forEach((r) => (v[r] = {}));
  return v;
}

// Small, hand-computable fixture:
// - Galicia starts at 1000, gets +300 (Ingresos) on 2025-01-10, -100 (Pagos) on
//   2025-01-15, +200 (Transf entrante) on 2025-01-12.
// - Nacion starts at 500, sends -200 (Transf saliente) on 2025-01-12.
// - FCI starts at 50, +20/-5 (susc/resc) in 2025-01.
// - Azúcar projection for 2025-01: 10 x 100 = 1000.
function makeFixture(): CashflowState {
  return {
    settings: {
      saldoInicial: { galicia: 1000, nacion: 500 },
      rangeStart: "2025-01",
      rangeEnd: "2025-02",
    },
    movements: [
      { id: "m1", bank: "galicia", descripcion: "Cobro", proveedor: "", fechaEmision: "", fechaPago: "2025-01-10", cheque: "", credito: 300, debito: 0, grupo: "Ingresos" },
      { id: "m2", bank: "galicia", descripcion: "Pago proveedor", proveedor: "", fechaEmision: "", fechaPago: "2025-01-15", cheque: "", credito: 0, debito: 100, grupo: "Pagos" },
      { id: "m3", bank: "nacion", descripcion: "Transferencia", proveedor: "", fechaEmision: "", fechaPago: "2025-01-12", cheque: "", credito: 0, debito: 200, grupo: "Transf entre cuentas" },
      { id: "m4", bank: "galicia", descripcion: "Transferencia recibida", proveedor: "", fechaEmision: "", fechaPago: "2025-01-12", cheque: "", credito: 200, debito: 0, grupo: "Transf entre cuentas" },
    ],
    projection: { ...emptyProjection(), azucar: { "2025-01": { cantidad: 10, precio: 100 } } },
    fci: { saldoInicial: 50, data: { "2025-01": { suscripciones: 20, rescates: 5 } } },
    iva: { ...emptyIva(), "Azúcar": { "2025-01": 1000 } },
  };
}

describe("bankRows", () => {
  it("sorts by fechaPago and accumulates a running balance", () => {
    const rows = bankRows(makeFixture(), "galicia");
    expect(rows.map((r) => r.id)).toEqual(["m1", "m4", "m2"]);
    expect(rows.map((r) => r.saldo)).toEqual([1300, 1500, 1400]);
  });
});

describe("bankSummary", () => {
  it("computes totals and a zero control for galicia", () => {
    const s = bankSummary(makeFixture(), "galicia");
    expect(s).toEqual({ inicial: 1000, ingresos: 300, ventaUSD: 0, pagos: 100, transf: 200, final: 1400, control: 0 });
  });

  it("computes totals and a zero control for nacion", () => {
    const s = bankSummary(makeFixture(), "nacion");
    expect(s).toEqual({ inicial: 500, ingresos: 0, ventaUSD: 0, pagos: 0, transf: -200, final: 300, control: 0 });
  });
});

describe("projTotal / projMonthTotal", () => {
  it("multiplies cantidad x precio for a concept/month", () => {
    expect(projTotal(makeFixture(), "azucar", "2025-01")).toBe(1000);
    expect(projTotal(makeFixture(), "azucar", "2025-02")).toBe(0);
  });

  it("sums all concepts for a month", () => {
    expect(projMonthTotal(makeFixture(), "2025-01")).toBe(1000);
    expect(projMonthTotal(makeFixture(), "2025-02")).toBe(0);
  });
});

describe("realMonth", () => {
  it("buckets movements from both banks by fechaPago", () => {
    expect(realMonth(makeFixture(), "2025-01")).toEqual({ ingresos: 300, ventaUSD: 0, pagos: 100, transf: 0 });
    expect(realMonth(makeFixture(), "2025-02")).toEqual({ ingresos: 0, ventaUSD: 0, pagos: 0, transf: 0 });
  });
});

describe("fciMonth", () => {
  it("reads suscripciones/rescates for a month, defaulting to 0", () => {
    expect(fciMonth(makeFixture(), "2025-01")).toEqual({ suscripciones: 20, rescates: 5 });
    expect(fciMonth(makeFixture(), "2025-02")).toEqual({ suscripciones: 0, rescates: 0 });
  });
});

describe("buildCashflow", () => {
  it("computes the full month-by-month cashflow", () => {
    const cf = buildCashflow(makeFixture());
    expect(cf.months).toEqual(["2025-01", "2025-02"]);

    const jan = cf.rows[0];
    expect(jan.saldoInicialBanco).toBe(1500); // 1000 + 500
    expect(jan.ingresos).toBe(300);
    expect(jan.pagos).toBe(100);
    expect(jan.invFCI).toBe(15); // 20 - 5
    expect(jan.transf).toBe(0); // +200 - 200
    expect(jan.saldoFinalBanco).toBe(1685); // 1500 + 300 - 100 - 15 + 0
    expect(jan.saldoInicialFci).toBe(50);
    expect(jan.saldoFinalFci).toBe(65); // 50 + 20 - 5
    expect(jan.cierreTotal).toBe(1750); // 1685 + 65
    expect(jan.proyTotal).toBe(1000);
    expect(jan.realIngresos).toBe(300);
    expect(jan.vsPresup).toBe(-700); // 300 - 1000

    const feb = cf.rows[1];
    expect(feb.saldoInicialBanco).toBe(1685);
    expect(feb.saldoFinalBanco).toBe(1685);
    expect(feb.saldoInicialFci).toBe(65);
    expect(feb.saldoFinalFci).toBe(65);
    expect(feb.cierreTotal).toBe(1750);
    expect(feb.proyTotal).toBe(0);
    expect(feb.vsPresup).toBe(0);
  });
});
