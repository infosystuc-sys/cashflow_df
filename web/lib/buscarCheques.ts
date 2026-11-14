import { norm } from "./format";
import type { Cheque } from "./types";

export type ChequeSearchCol = "todas" | "numero" | "nombre" | "monto";

export const CHEQUE_SEARCH_COLS: { id: ChequeSearchCol; label: string }[] = [
  { id: "todas", label: "Todas las columnas" },
  { id: "numero", label: "N° de cheque" },
  { id: "nombre", label: "A nombre de" },
  { id: "monto", label: "Monto" },
];

const soloDigitos = (s: string) => s.replace(/\D/g, "");

// Número y monto se comparan solo por sus dígitos, así "0001234" encuentra el
// cheque 1234 y "2.347.577,44", "2347577.44" o "2347577" encuentran el mismo importe.
function coincideNumero(c: Cheque, q: string) {
  const d = soloDigitos(q);
  return d !== "" && soloDigitos(c.numero).includes(d.replace(/^0+(?=\d)/, ""));
}

function coincideMonto(c: Cheque, q: string) {
  const d = soloDigitos(q);
  return d !== "" && soloDigitos(c.importe.toFixed(2)).includes(d);
}

function coincideNombre(c: Cheque, q: string) {
  return norm(c.cliente).includes(norm(q));
}

export function chequeCoincide(c: Cheque, col: ChequeSearchCol, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (col === "numero") return coincideNumero(c, q);
  if (col === "nombre") return coincideNombre(c, q);
  if (col === "monto") return coincideMonto(c, q);
  return coincideNumero(c, q) || coincideNombre(c, q) || coincideMonto(c, q);
}
