import type { Cheque, CashflowState, FciData, IvaData, Movement, ProjectionMap, Settings } from "./types";
import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";

export type SeedMovement = Omit<Movement, "id">;

export function seedSettings(): Settings {
  return {
    saldoInicial: { galicia: 50000000, nacion: 15742577.77 },
    rangeStart: "2025-07",
    rangeEnd: "2027-03",
  };
}

export function seedMovements(): SeedMovement[] {
  const G = "galicia" as const;
  const N = "nacion" as const;
  const m = (
    bank: SeedMovement["bank"],
    descripcion: string,
    proveedor: string,
    fechaPago: string,
    cheque: string,
    credito: number,
    debito: number,
    grupo: string,
    fechaEmision = ""
  ): SeedMovement => ({ bank, descripcion, proveedor, fechaEmision, fechaPago, cheque, credito, debito, grupo });

  return [
    // ----- GALICIA -----
    m(G, "ECHEQ EN CARTERA", "", "2026-06-02", "", 60000000, 0, "Ingresos"),
    m(G, "TRANSFERENCIA", "GALICIA", "2026-06-05", "", 115000000, 0, "Transf entre cuentas"),
    m(G, "GASMAX", "", "2026-06-01", "239", 0, 1795836.02, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-15", "258", 0, 21738124.7, "Pagos"),
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

export function seedProjection(): ProjectionMap {
  const p: ProjectionMap = {};
  PROJ_CONCEPTS.forEach((c) => (p[c.id] = {}));
  const mesesAzucar = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"];
  mesesAzucar.forEach((k) => (p.azucar[k] = { cantidad: 7000, precio: 25000 }));
  p.fletes["2025-07"] = { cantidad: 1, precio: 80000000 };
  p.fletes["2025-08"] = { cantidad: 1, precio: 100000000 };
  p.fletes["2025-09"] = { cantidad: 1, precio: 100000000 };
  p.servicios["2025-07"] = { cantidad: 1, precio: 20000000 };
  p.cheques3["2025-08"] = { cantidad: 1, precio: 344000000 };
  return p;
}

export function seedFci(): { saldoInicial: number; data: FciData } {
  return {
    saldoInicial: 0,
    data: {
      "2025-07": { suscripciones: 260000000, rescates: 260586228 },
      "2025-08": { suscripciones: 450100000, rescates: 398618319 },
      "2025-09": { suscripciones: 50264223, rescates: 101745915 },
    },
  };
}

export function seedIva(): IvaData {
  const v: IvaData = {};
  IVA_ROWS.forEach((r) => (v[r] = {}));
  v["Azúcar"]["2025-07"] = 131900826;
  v["Azúcar"]["2025-08"] = 154710744;
  v["Azúcar"]["2025-09"] = 64125620;
  v["Sorgo"]["2025-07"] = 48559851;
  v["Sorgo"]["2025-08"] = 46378759;
  v["Sorgo"]["2025-09"] = 61356893;
  v["Sorgo"]["2025-10"] = 31378233;
  v["Fletes"]["2025-07"] = 1949799;
  v["Fletes"]["2025-08"] = 29827779;
  v["Fletes"]["2025-09"] = 55404284;
  v["Fletes"]["2025-10"] = 65408269;
  return v;
}

export type SeedCheque = Omit<Cheque, "id">;

export function seedCheques(): SeedCheque[] {
  const c = (
    cliente: string,
    numero: string,
    bancoEmisor: string,
    bancoDestino: Cheque["bancoDestino"],
    importe: number,
    fechaRecepcion: string,
    fechaPago: string,
    estado: Cheque["estado"],
    fechaDeposito = "",
    fechaAcreditacion = "",
    fechaRechazo = "",
    fechaEndoso = ""
  ): SeedCheque => ({
    cliente, numero, bancoEmisor, bancoDestino, importe, fechaRecepcion, fechaPago, estado,
    fechaDeposito, fechaAcreditacion, fechaRechazo, fechaEndoso,
  });

  return [
    c("AGD", "0001234", "Banco Santander", "galicia", 14000000, "2026-06-20", "2026-06-30", "en_cartera"),
    c("RUIZ RODRIGO", "0005678", "Banco Macro", "nacion", 12000000, "2026-06-22", "2026-07-05", "depositado", "2026-06-29"),
    c("ESTANCIA EL AZUL", "0009012", "Banco Galicia", "galicia", 8000000, "2026-05-10", "2026-05-20", "acreditado", "2026-05-18", "2026-05-22"),
  ];
}

// Full in-memory state for tests and for the "reset to demo data" flow.
// Movements/cheques get synthetic ids here; resetToSeed() (Task 8) inserts them
// directly so Postgres assigns real uuids.
export function seedState(): CashflowState {
  return {
    settings: seedSettings(),
    movements: seedMovements().map((m, i) => ({ ...m, id: `seed-${i}` })),
    projection: seedProjection(),
    fci: seedFci(),
    iva: seedIva(),
    cheques: seedCheques().map((c, i) => ({ ...c, id: `seed-cheque-${i}` })),
  };
}
