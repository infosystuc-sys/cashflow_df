// data.jsx — modelo, persistencia, helpers y datos semilla
// Exporta a window: CF (namespace con todo lo necesario)

// ---------- Constantes ----------
const BANKS = [
  { id: "galicia", name: "Banco Galicia", short: "Galicia", color: "var(--galicia)" },
  { id: "nacion", name: "Banco Nación", short: "Nación", color: "var(--nacion)" },
];

// Agrupaciones de cada movimiento (confirmadas con el usuario)
const GROUPS = [
  "Saldo Inicial",
  "Ingresos",
  "Pagos",
  "Transf entre cuentas",
  "Ingreso por Venta de USD",
];

// Conceptos de la proyección. tipo: 'unidad' (cantidad x precio) o 'monto' (directo, cant=1)
const PROJ_CONCEPTS = [
  { id: "azucar", name: "Azúcar", unidad: "Bolsas", tipo: "unidad", grupo: "producto" },
  { id: "soja", name: "Soja", unidad: "TN", tipo: "unidad", grupo: "producto" },
  { id: "maiz", name: "Maíz", unidad: "TN", tipo: "unidad", grupo: "producto" },
  { id: "sorgo", name: "Sorgo", unidad: "TN", tipo: "unidad", grupo: "producto" },
  { id: "fletes", name: "Fletes", unidad: "$", tipo: "monto", grupo: "servicio" },
  { id: "carleto", name: "Carleto", unidad: "$", tipo: "monto", grupo: "servicio" },
  { id: "servicios", name: "Servicios", unidad: "$", tipo: "monto", grupo: "servicio" },
  { id: "cheques3", name: "Ingresos (Cheques de terceros)", unidad: "$", tipo: "monto", grupo: "otro" },
  { id: "cobranza", name: "Cobranza Campo (neto blanqueo)", unidad: "$", tipo: "monto", grupo: "otro" },
  { id: "compracampo", name: "Compra Campo", unidad: "$", tipo: "monto", grupo: "otro" },
];

// Filas de Ventas netas según libros IVA
const IVA_ROWS = ["Azúcar", "Soja", "Sorgo", "Fletes", "Servicios"];

const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

// ---------- Helpers de fecha / mes ----------
function monthKeyFromISO(iso) {
  // iso: 'YYYY-MM-DD' -> 'YYYY-MM'
  if (!iso) return null;
  return iso.slice(0, 7);
}
function monthLabel(key) {
  // 'YYYY-MM' -> 'jul-25'
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ES[m - 1]}-${String(y).slice(2)}`;
}
function monthLong(key) {
  const [y, m] = key.split("-").map(Number);
  const full = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${full[m - 1]} ${y}`;
}
function addMonth(key, delta) {
  let [y, m] = key.split("-").map(Number);
  m += delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function monthRange(start, end) {
  const out = [];
  let k = start;
  let guard = 0;
  while (guard < 400) {
    out.push(k);
    if (k === end) break;
    k = addMonth(k, 1);
    guard++;
  }
  return out;
}

// ---------- Formato de números (es-AR) ----------
const fmt2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
function money(n, decimals = true) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  const v = Number(n);
  if (v === 0) return "-";
  return (decimals ? fmt2 : fmt0).format(v);
}
function moneySigned(n, decimals = true) {
  return money(n, decimals);
}
function num(n) {
  if (n === null || n === undefined || n === "" || isNaN(n)) return "";
  return fmt0.format(Number(n));
}
function parseNum(s) {
  if (s === null || s === undefined) return 0;
  if (typeof s === "number") return s;
  let t = String(s).trim();
  if (!t) return 0;
  // admite 1.795.836,02 o 1795836.02
  if (t.indexOf(",") > -1) {
    t = t.replace(/\./g, "").replace(",", ".");
  }
  const v = parseFloat(t);
  return isNaN(v) ? 0 : v;
}

// ---------- ID ----------
let _idc = 0;
function uid() {
  _idc++;
  return "id" + Date.now().toString(36) + _idc.toString(36);
}

// ---------- Datos semilla (de las capturas) ----------
function seedMovements() {
  // bank, descripcion, proveedor, fechaEmision, fechaPago, cheque, credito, debito, grupo
  const G = "galicia", N = "nacion";
  const m = (bank, descripcion, proveedor, fechaPago, cheque, credito, debito, grupo, fechaEmision = "") => ({
    id: uid(), bank, descripcion, proveedor, fechaEmision, fechaPago, cheque,
    credito: credito || 0, debito: debito || 0, grupo,
  });
  return [
    // ----- GALICIA -----
    m(G, "ECHEQ EN CARTERA", "", "2026-06-02", "", 60000000, 0, "Ingresos"),
    m(G, "TRANSFERENCIA", "GALICIA", "2026-06-05", "", 115000000, 0, "Transf entre cuentas"),
    m(G, "GASMAX", "", "2026-06-01", "239", 0, 1795836.02, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-15", "258", 0, 21738124.70, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-16", "268", 0, 11000000, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-19", "269", 0, 11000000, "Pagos"),
    m(G, "LUIS S FERRO", "", "2026-06-19", "259", 0, 3000000, "Pagos"),
    m(G, "PETROBAN SRL", "", "2026-06-22", "266", 0, 11477394.79, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-22", "270", 0, 11200000, "Pagos"),
    m(G, "AGRICOLA GARCIA", "", "2026-06-26", "260", 0, 4000000, "Pagos"),
    m(G, "NEUMATICOS EL TIMBO SAS", "", "2026-06-29", "262", 0, 590000, "Pagos"),
    m(G, "NOR TEX SAS", "", "2026-06-30", "257", 0, 2430267.25, "Pagos"),
    m(G, "PENDIENTE DE COBRO", "AGD", "2026-06-30", "", 14000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "RUIZ RODRIGO", "2026-06-30", "", 12000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "ESTANCIA EL AZUL", "2026-06-30", "", 8000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "SOUTH FOUTH", "2026-06-30", "", 4000000, 0, "Ingresos"),
    // ----- NACION -----
    m(N, "BUNGE FACTURA PENDIENTE", "", "2026-06-02", "", 36000000, 0, "Ingresos"),
    m(N, "TRANSFERENCIA", "GALICIA", "2026-06-05", "", 0, 115000000, "Transf entre cuentas"),
    m(N, "SUELDOS", "", "2026-06-05", "", 0, 10000000, "Pagos"),
    m(N, "MERCEDES BENZ -CAMION", "AG424SW", "2026-06-05", "E CUOTAS 48-28", 0, 20679377.13, "Pagos"),
    m(N, "SICORE", "", "2026-06-10", "", 0, 2000000, "Pagos"),
    m(N, "COSECHA soja", "facturar falta", "2026-06-12", "", 25000000, 0, "Ingresos"),
    m(N, "SIN FACTURAR", "FLETE BUNGE", "2026-06-13", "", 20000000, 0, "Ingresos"),
    m(N, "COSECHA CAÑA", "PAGO EN JULIO", "2026-06-14", "", 130000000, 0, "Ingresos"),
    m(N, "SAN MIGUEL FALTA FACTUREAR", "", "2026-06-15", "", 12000000, 0, "Ingresos"),
  ];
}

function seedProjection() {
  // proj[conceptId][monthKey] = { cantidad, precio }
  const p = {};
  PROJ_CONCEPTS.forEach((c) => (p[c.id] = {}));
  const mesesAzucar = ["2025-07","2025-08","2025-09","2025-10","2025-11","2025-12"];
  mesesAzucar.forEach((k) => (p.azucar[k] = { cantidad: 7000, precio: 25000 }));
  p.fletes["2025-07"] = { cantidad: 1, precio: 80000000 };
  p.fletes["2025-08"] = { cantidad: 1, precio: 100000000 };
  p.fletes["2025-09"] = { cantidad: 1, precio: 100000000 };
  p.servicios["2025-07"] = { cantidad: 1, precio: 20000000 };
  p.cheques3["2025-08"] = { cantidad: 1, precio: 344000000 };
  return p;
}

function seedFCI() {
  // fci[monthKey] = { suscripciones, rescates }; saldoInicial aparte
  return {
    saldoInicial: 0,
    data: {
      "2025-07": { suscripciones: 260000000, rescates: 260586228 },
      "2025-08": { suscripciones: 450100000, rescates: 398618319 },
      "2025-09": { suscripciones: 50264223, rescates: 101745915 },
    },
  };
}

function seedIVA() {
  // iva[row][monthKey] = monto
  const v = {};
  IVA_ROWS.forEach((r) => (v[r] = {}));
  v["Azúcar"]["2025-07"] = 131900826; v["Azúcar"]["2025-08"] = 154710744; v["Azúcar"]["2025-09"] = 64125620;
  v["Sorgo"]["2025-07"] = 48559851; v["Sorgo"]["2025-08"] = 46378759; v["Sorgo"]["2025-09"] = 61356893; v["Sorgo"]["2025-10"] = 31378233;
  v["Fletes"]["2025-07"] = 1949799; v["Fletes"]["2025-08"] = 29827779; v["Fletes"]["2025-09"] = 55404284; v["Fletes"]["2025-10"] = 65408269;
  return v;
}

function defaultState() {
  return {
    version: 3,
    settings: {
      saldoInicial: { galicia: 50000000, nacion: 15742577.77 },
      rangeStart: "2025-07",
      rangeEnd: "2027-03",
    },
    movements: seedMovements(),
    projection: seedProjection(),
    fci: seedFCI(),
    iva: seedIVA(),
  };
}

// ---------- Persistencia ----------
const STORAGE_KEY = "cashflow_app_v3";
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    if (!s || s.version !== 3) return defaultState();
    return s;
  } catch (e) {
    return defaultState();
  }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {}
}
function resetState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  return defaultState();
}

// ---------- Cálculos ----------
// Movimientos de un banco ordenados por fechaPago (estable) con saldo corriente
function bankRows(state, bankId) {
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
  rows.forEach((r) => {
    saldo += (Number(r.credito) || 0) - (Number(r.debito) || 0);
    r.saldo = saldo;
  });
  return rows;
}

function bankSummary(state, bankId) {
  const rows = state.movements.filter((x) => x.bank === bankId);
  const sum = (pred, field) => rows.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);
  const inicial = state.settings.saldoInicial[bankId] || 0;
  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf = sum((r) => r.grupo === "Transf entre cuentas", "credito") - sum((r) => r.grupo === "Transf entre cuentas", "debito");
  const final = inicial + ingresos + ventaUSD - pagos + transf;
  const last = bankRows(state, bankId).slice(-1)[0];
  const lastSaldo = last ? last.saldo : inicial;
  const control = final - lastSaldo;
  return { inicial, ingresos, ventaUSD, pagos, transf, final, control };
}

// Proyección: total por concepto y mes
function projTotal(state, conceptId, monthKey) {
  const cell = state.projection[conceptId] && state.projection[conceptId][monthKey];
  if (!cell) return 0;
  return (Number(cell.cantidad) || 0) * (Number(cell.precio) || 0);
}
function projMonthTotal(state, monthKey) {
  return PROJ_CONCEPTS.reduce((a, c) => a + projTotal(state, c.id, monthKey), 0);
}

// Real por mes (de movimientos, ambos bancos), bucketed por fechaPago
function realMonth(state, monthKey) {
  const inMonth = state.movements.filter((x) => monthKeyFromISO(x.fechaPago) === monthKey);
  const sum = (pred, field) => inMonth.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);
  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf = sum((r) => r.grupo === "Transf entre cuentas", "credito") - sum((r) => r.grupo === "Transf entre cuentas", "debito");
  return { ingresos, ventaUSD, pagos, transf };
}

function fciMonth(state, monthKey) {
  const d = state.fci.data[monthKey] || {};
  return { suscripciones: Number(d.suscripciones) || 0, rescates: Number(d.rescates) || 0 };
}

// Construye la matriz completa del cashflow para un rango de meses
function buildCashflow(state) {
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

    const saldoInicialFci = idx === 0 ? (state.fci.saldoInicial || 0) : saldoFciPrev;
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
      vsPresup: (r.ingresos + r.ventaUSD) - proyTotal,
    };
  });
  return { months, rows };
}

// ---------- Export ----------
window.CF = {
  BANKS, GROUPS, PROJ_CONCEPTS, IVA_ROWS, MONTHS_ES,
  monthKeyFromISO, monthLabel, monthLong, addMonth, monthRange,
  money, moneySigned, num, parseNum, uid,
  defaultState, loadState, saveState, resetState, STORAGE_KEY,
  bankRows, bankSummary, projTotal, projMonthTotal, realMonth, fciMonth, buildCashflow,
};
