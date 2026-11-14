import { describe, it, expect } from "vitest";
import { chequeCoincide } from "./buscarCheques";
import type { Cheque } from "./types";

const ch: Cheque = {
  id: "c1", empresaId: "san", cliente: "Transporte Buenos Viajes", numero: "0070651140", bancoEmisor: "Banco Macro",
  bancoDestino: "", importe: 2347577.44, fechaRecepcion: "2026-10-23", fechaPago: "2026-11-28", estado: "en_cartera",
  fechaDeposito: "", fechaAcreditacion: "", fechaRechazo: "", fechaEndoso: "", fechaCesion: "", endosadoA: "", movementId: null,
};

describe("chequeCoincide", () => {
  it("no filtra con la búsqueda vacía", () => {
    expect(chequeCoincide(ch, "todas", "  ")).toBe(true);
  });

  it("busca por número de cheque, con o sin ceros adelante", () => {
    expect(chequeCoincide(ch, "numero", "70651140")).toBe(true);
    expect(chequeCoincide(ch, "numero", "0070651140")).toBe(true);
    expect(chequeCoincide(ch, "numero", "651")).toBe(true);
    expect(chequeCoincide(ch, "numero", "999")).toBe(false);
  });

  it("busca a nombre de quién está, sin importar mayúsculas ni tildes", () => {
    expect(chequeCoincide(ch, "nombre", "buenos viajes")).toBe(true);
    expect(chequeCoincide(ch, "nombre", "AGD")).toBe(false);
  });

  it("busca por monto en cualquier formato", () => {
    expect(chequeCoincide(ch, "monto", "2.347.577,44")).toBe(true);
    expect(chequeCoincide(ch, "monto", "2347577.44")).toBe(true);
    expect(chequeCoincide(ch, "monto", "2347577")).toBe(true);
    expect(chequeCoincide(ch, "monto", "1.000.000")).toBe(false);
  });

  it("en 'todas' busca en número, nombre y monto", () => {
    expect(chequeCoincide(ch, "todas", "macro")).toBe(false); // el banco emisor no es parte de la búsqueda
    expect(chequeCoincide(ch, "todas", "viajes")).toBe(true);
    expect(chequeCoincide(ch, "todas", "70651140")).toBe(true);
    expect(chequeCoincide(ch, "todas", "2.347.577,44")).toBe(true);
  });

  it("un texto sin dígitos no coincide por número ni por monto", () => {
    expect(chequeCoincide(ch, "numero", "abc")).toBe(false);
    expect(chequeCoincide(ch, "monto", "abc")).toBe(false);
  });
});
