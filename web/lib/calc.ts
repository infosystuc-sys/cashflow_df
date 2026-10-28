import type { BankId, BankRow, BankSummary, CashflowResult, CashflowState } from "./types";
import { PROJ_CONCEPTS, TRANSFER_OWN_BANK_GROUP } from "./constants";
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
  const transfPropio =
    sum((r) => r.grupo === TRANSFER_OWN_BANK_GROUP, "credito") -
    sum((r) => r.grupo === TRANSFER_OWN_BANK_GROUP, "debito");
  const final = inicial + ingresos + ventaUSD - pagos + transf + transfPropio;

  const last = bankRows(state, bankId).slice(-1)[0];
  const lastSaldo = last ? last.saldo : inicial;
  const control = final - lastSaldo;

  return { inicial, ingresos, ventaUSD, pagos, transf, transfPropio, final, control };
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

// Real por mes (de movimientos de todos los bancos de la vista), bucketed por fechaPago
export function realMonth(state: CashflowState, monthKey: string) {
  const inMonth = state.movements.filter((x) => monthKeyFromISO(x.fechaPago) === monthKey);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    inMonth.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const isTransf = (r: CashflowState["movements"][number]) =>
    r.grupo === "Transf entre cuentas" || r.grupo === TRANSFER_OWN_BANK_GROUP;
  const transf = sum(isTransf, "credito") - sum(isTransf, "debito");

  return { ingresos, ventaUSD, pagos, transf };
}

export function fciMonth(state: CashflowState, monthKey: string) {
  const d = state.fci.data[monthKey] || { suscripciones: 0, rescates: 0 };
  return { suscripciones: Number(d.suscripciones) || 0, rescates: Number(d.rescates) || 0 };
}

// Eventos de cartera de cada cheque, derivados de su estado actual y sus fechas
// (ver simplificación aceptada en el spec: solo se conserva el intento más reciente).
type ChequeEvento = { fecha: string; tipo: "recibido" | "salida" | "rechazo"; importe: number };

function chequeEventos(c: CashflowState["cheques"][number]): ChequeEvento[] {
  const eventos: ChequeEvento[] = [];
  if (c.fechaRecepcion) eventos.push({ fecha: c.fechaRecepcion, tipo: "recibido", importe: c.importe });
  if (c.estado === "endosado" && c.fechaEndoso) {
    eventos.push({ fecha: c.fechaEndoso, tipo: "salida", importe: c.importe });
  } else if (c.estado === "cesionado" && c.fechaCesion) {
    eventos.push({ fecha: c.fechaCesion, tipo: "salida", importe: c.importe });
  } else if (c.estado === "depositado" && c.fechaDeposito) {
    eventos.push({ fecha: c.fechaDeposito, tipo: "salida", importe: c.importe });
  } else if (c.estado === "en_cartera" && c.fechaRechazo) {
    if (c.fechaDeposito) eventos.push({ fecha: c.fechaDeposito, tipo: "salida", importe: c.importe });
    eventos.push({ fecha: c.fechaRechazo, tipo: "rechazo", importe: c.importe });
  }
  return eventos;
}

// Saldo de cartera de cheques inmediatamente antes de monthKey, reproduciendo
// cronológicamente todos los eventos anteriores (sin necesitar un saldo inicial manual).
export function chequesCarteraAntes(state: CashflowState, monthKey: string): number {
  return state.cheques
    .flatMap(chequeEventos)
    .filter((e) => (monthKeyFromISO(e.fecha) || "") < monthKey)
    .reduce((a, e) => a + (e.tipo === "salida" ? -e.importe : e.importe), 0);
}

export function chequesResumen(state: CashflowState) {
  const enCartera = state.cheques.filter((c) => c.estado === "en_cartera");
  const depositado = state.cheques.filter((c) => c.estado === "depositado");
  const cesionado = state.cheques.filter((c) => c.estado === "cesionado");
  return {
    totalCartera: enCartera.reduce((a, c) => a + c.importe, 0),
    totalDepositado: depositado.reduce((a, c) => a + c.importe, 0),
    totalCedido: cesionado.reduce((a, c) => a + c.importe, 0),
    cantidadRechazados: enCartera.filter((c) => c.fechaRechazo).length,
  };
}

export function chequesMonth(state: CashflowState, monthKey: string) {
  const eventosMes = state.cheques.flatMap(chequeEventos).filter((e) => monthKeyFromISO(e.fecha) === monthKey);
  const recibidos = eventosMes.filter((e) => e.tipo === "recibido").reduce((a, e) => a + e.importe, 0);
  const salida = eventosMes.filter((e) => e.tipo === "salida").reduce((a, e) => a + e.importe, 0);
  const rechazados = eventosMes.filter((e) => e.tipo === "rechazo").reduce((a, e) => a + e.importe, 0);
  return { recibidos, salida, rechazados };
}

// Construye la matriz completa del cashflow para el rango de meses configurado
export function buildCashflow(state: CashflowState): CashflowResult {
  const months = monthRange(state.settings.rangeStart, state.settings.rangeEnd);
  const bankInicialTotal = state.banks.reduce((a, b) => a + (state.settings.saldoInicial[b.id] || 0), 0);
  let saldoBancoPrev = bankInicialTotal;
  let saldoFciPrev = state.fci.saldoInicial || 0;
  let saldoChequesPrev = months.length ? chequesCarteraAntes(state, months[0]) : 0;

  const rows = months.map((mk, idx) => {
    const r = realMonth(state, mk);
    const fci = fciMonth(state, mk);
    const invFCI = fci.suscripciones - fci.rescates; // dinero que sale del banco hacia FCI
    const cheques = chequesMonth(state, mk);

    const saldoInicialBanco = idx === 0 ? bankInicialTotal : saldoBancoPrev;
    const saldoFinalBanco = saldoInicialBanco + r.ingresos + r.ventaUSD - r.pagos - invFCI + r.transf;

    const saldoInicialFci = idx === 0 ? state.fci.saldoInicial || 0 : saldoFciPrev;
    const saldoFinalFci = saldoInicialFci + fci.suscripciones - fci.rescates;

    const chequesSaldoInicial = saldoChequesPrev;
    const chequesSaldoFinal = chequesSaldoInicial + cheques.recibidos - cheques.salida + cheques.rechazados;

    saldoBancoPrev = saldoFinalBanco;
    saldoFciPrev = saldoFinalFci;
    saldoChequesPrev = chequesSaldoFinal;

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
      chequesSaldoInicial,
      chequesRecibidos: cheques.recibidos,
      chequesSalida: cheques.salida,
      chequesRechazados: cheques.rechazados,
      chequesSaldoFinal,
    };
  });

  return { months, rows };
}
