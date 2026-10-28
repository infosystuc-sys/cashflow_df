import { describe, it, expect } from "vitest";
import { scopeState } from "./scope";
import { buildCashflow, projTotal } from "./calc";
import type { Bank, DbState, Movement } from "./types";

function bank(id: string, empresaId: string, saldoInicial: number): Bank {
  const codigo = empresaId.toUpperCase();
  return { id, empresaId, name: id, short: id, label: `${codigo} ${id}`, color: "#000", saldoInicial, orden: 0, activo: true };
}

function mov(id: string, bankId: string, grupo: string, credito: number, debito: number, transferId?: string): Movement {
  return {
    id, bank: bankId, descripcion: id, proveedor: "", fechaEmision: "", fechaPago: "2025-01-10",
    cheque: "", credito, debito, grupo, transferId: transferId ?? null,
  };
}

// SAN: galicia (1000) cobra 300 y le transfiere 200 a la SAS.
// SAS: sas_macro (50) paga 20 y recibe los 200.
function makeDb(): DbState {
  return {
    empresas: [
      { id: "san", codigo: "SAN", nombre: "Rafael Sánchez", fciSaldoInicial: 10, orden: 1 },
      { id: "sas", codigo: "SAS", nombre: "Grupo Don Félix", fciSaldoInicial: 5, orden: 2 },
    ],
    banks: [bank("galicia", "san", 1000), bank("sas_macro", "sas", 50)],
    rangeStart: "2025-01",
    rangeEnd: "2025-01",
    movements: [
      mov("m1", "galicia", "Ingresos", 300, 0),
      mov("t1", "galicia", "Transferencia a banco propio", 0, 200, "tr"),
      mov("t2", "sas_macro", "Transferencia a banco propio", 200, 0, "tr"),
      mov("m2", "sas_macro", "Pagos", 0, 20),
    ],
    cheques: [],
    projection: {
      san: { azucar: { "2025-01": { cantidad: 10, precio: 100 } } },
      sas: { azucar: { "2025-01": { cantidad: 30, precio: 200 } }, fletes: { "2025-01": { cantidad: 1, precio: 70 } } },
    },
    fci: { san: { "2025-01": { suscripciones: 4, rescates: 0 } }, sas: { "2025-01": { suscripciones: 1, rescates: 2 } } },
    iva: { san: { Fletes: { "2025-01": 11 } }, sas: { Fletes: { "2025-01": 22 } } },
  };
}

describe("scopeState", () => {
  it("keeps each empresa's cashflow independent", () => {
    const san = buildCashflow(scopeState(makeDb(), "san")).rows[0];
    expect(san.saldoInicialBanco).toBe(1000);
    expect(san.ingresos).toBe(300);
    expect(san.transf).toBe(-200); // sale hacia la SAS
    expect(san.saldoFinalBanco).toBe(1096); // 1000 + 300 - 200 - 4 (suscripción FCI)

    const sas = buildCashflow(scopeState(makeDb(), "sas")).rows[0];
    expect(sas.saldoInicialBanco).toBe(50);
    expect(sas.pagos).toBe(20);
    expect(sas.transf).toBe(200); // entra desde SAN
    expect(sas.saldoFinalBanco).toBe(231); // 50 - 20 + 200 + 1 (FCI: rescata 2, suscribe 1)
  });

  it("sums both empresas in the consolidated view and cancels transfers between them", () => {
    const all = buildCashflow(scopeState(makeDb(), "all")).rows[0];
    expect(all.saldoInicialBanco).toBe(1050);
    expect(all.ingresos).toBe(300);
    expect(all.pagos).toBe(20);
    expect(all.transf).toBe(0);
    expect(all.saldoFinalBanco).toBe(1327); // = 1096 + 231
    expect(all.saldoInicialFci).toBe(15);
    expect(all.saldoFinalFci).toBe(18); // 15 + 4 + 1 - 2
  });

  it("filters banks, movements and cheques by empresa", () => {
    const db = makeDb();
    db.cheques = [
      { id: "c1", empresaId: "san", cliente: "", numero: "", bancoEmisor: "", bancoDestino: "", importe: 1, fechaRecepcion: "2025-01-01", fechaPago: "", estado: "en_cartera", fechaDeposito: "", fechaAcreditacion: "", fechaRechazo: "", fechaEndoso: "", fechaCesion: "", endosadoA: "", movementId: null },
      { id: "c2", empresaId: "sas", cliente: "", numero: "", bancoEmisor: "", bancoDestino: "", importe: 2, fechaRecepcion: "2025-01-01", fechaPago: "", estado: "en_cartera", fechaDeposito: "", fechaAcreditacion: "", fechaRechazo: "", fechaEndoso: "", fechaCesion: "", endosadoA: "", movementId: null },
    ];
    const sas = scopeState(db, "sas");
    expect(sas.banks.map((b) => b.id)).toEqual(["sas_macro"]);
    expect(sas.movements.map((m) => m.id)).toEqual(["t2", "m2"]);
    expect(sas.cheques.map((c) => c.id)).toEqual(["c2"]);
    expect(scopeState(db, "all").cheques).toHaveLength(2);
  });

  it("merges projection and IVA in the consolidated view", () => {
    const all = scopeState(makeDb(), "all");
    expect(projTotal(all, "azucar", "2025-01")).toBe(1000 + 6000);
    expect(all.projection.azucar["2025-01"].cantidad).toBe(40);
    expect(projTotal(all, "fletes", "2025-01")).toBe(70);
    expect(all.iva.Fletes["2025-01"]).toBe(33);

    const san = scopeState(makeDb(), "san");
    expect(projTotal(san, "azucar", "2025-01")).toBe(1000);
    expect(projTotal(san, "fletes", "2025-01")).toBe(0);
  });
});
