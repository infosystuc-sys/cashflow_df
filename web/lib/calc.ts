import type { BankId, BankRow, BankSummary, CashflowResult, CashflowState } from "./types";
import { PROJ_CONCEPTS } from "./constants";
import { monthKeyFromISO, monthLabel, monthRange } from "./dates";

// Movimientos de un banco ordenados por fechaPago (estable) con saldo corriente
export function bankRows(state: CashflowState, bankId: BankId): BankRow[] {
  const rows = state.movements
    .filter((x) => x.bank === bankId)
    .map((x, i) => ({ ...x, _i: i }));

  rows.sort((a, b) => {
    const fa = a.fechaPago || "9999-12-31";
    const fb = b.fechaPago || "9999-12-31";
    if (fa < fb) return -1;
    if (fa > fb) return 1;
    return a._i - b._i;
  });

  let saldo = state.settings.saldoInicial[bankId] || 0;
  return rows.map((r) => {
    saldo += (Number(r.credito) || 0) - (Number(r.debito) || 0);
    const { _i, ...rest } = r;
    return { ...rest, saldo };
  });
}

export function bankSummary(state: CashflowState, bankId: BankId): BankSummary {
  const rows = state.movements.filter((x) => x.bank === bankId);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    rows.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const inicial = state.settings.saldoInicial[bankId] || 0;
  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf =
    sum((r) => r.grupo === "Transf entre cuentas", "credito") -
    sum((r) => r.grupo === "Transf entre cuentas", "debito");
  const final = inicial + ingresos + ventaUSD - pagos + transf;

  const last = bankRows(state, bankId).slice(-1)[0];
  const lastSaldo = last ? last.saldo : inicial;
  const control = final - lastSaldo;

  return { inicial, ingresos, ventaUSD, pagos, transf, final, control };
}

// Proyección: total por concepto y mes
export function projTotal(state: CashflowState, conceptId: string, monthKey: string): number {
  const cell = state.projection[conceptId] && state.projection[conceptId][monthKey];
  if (!cell) return 0;
  return (Number(cell.cantidad) || 0) * (Number(cell.precio) || 0);
}

export function projMonthTotal(state: CashflowState, monthKey: string): number {
  return PROJ_CONCEPTS.reduce((a, c) => a + projTotal(state, c.id, monthKey), 0);
}

// Real por mes (de movimientos, ambos bancos), bucketed por fechaPago
export function realMonth(state: CashflowState, monthKey: string) {
  const inMonth = state.movements.filter((x) => monthKeyFromISO(x.fechaPago) === monthKey);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    inMonth.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf =
    sum((r) => r.grupo === "Transf entre cuentas", "credito") -
    sum((r) => r.grupo === "Transf entre cuentas", "debito");

  return { ingresos, ventaUSD, pagos, transf };
}

export function fciMonth(state: CashflowState, monthKey: string) {
  const d = state.fci.data[monthKey] || { suscripciones: 0, rescates: 0 };
  return { suscripciones: Number(d.suscripciones) || 0, rescates: Number(d.rescates) || 0 };
}

// Construye la matriz completa del cashflow para el rango de meses configurado
export function buildCashflow(state: CashflowState): CashflowResult {
  const months = monthRange(state.settings.rangeStart, state.settings.rangeEnd);
  const bankInicialTotal = (state.settings.saldoInicial.galicia || 0) + (state.settings.saldoInicial.nacion || 0);
  let saldoBancoPrev = bankInicialTotal;
  let saldoFciPrev = state.fci.saldoInicial || 0;

  const rows = months.map((mk, idx) => {
    const r = realMonth(state, mk);
    const fci = fciMonth(state, mk);
    const invFCI = fci.suscripciones - fci.rescates; // dinero que sale del banco hacia FCI

    const saldoInicialBanco = idx === 0 ? bankInicialTotal : saldoBancoPrev;
    const saldoFinalBanco = saldoInicialBanco + r.ingresos + r.ventaUSD - r.pagos - invFCI + r.transf;

    const saldoInicialFci = idx === 0 ? state.fci.saldoInicial || 0 : saldoFciPrev;
    const saldoFinalFci = saldoInicialFci + fci.suscripciones - fci.rescates;

    saldoBancoPrev = saldoFinalBanco;
    saldoFciPrev = saldoFinalFci;

    const proyTotal = projMonthTotal(state, mk);

    return {
      key: mk,
      label: monthLabel(mk),
      saldoInicialBanco,
      ingresos: r.ingresos,
      ventaUSD: r.ventaUSD,
      pagos: r.pagos,
      invFCI,
      transf: r.transf,
      saldoFinalBanco,
      saldoInicialFci,
      suscripciones: fci.suscripciones,
      rescates: fci.rescates,
      saldoFinalFci,
      cierreTotal: saldoFinalBanco + saldoFinalFci,
      proyTotal,
      realIngresos: r.ingresos + r.ventaUSD,
      vsPresup: r.ingresos + r.ventaUSD - proyTotal,
    };
  });

  return { months, rows };
}
