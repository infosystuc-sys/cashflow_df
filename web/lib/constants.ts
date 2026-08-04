import type { Bank, ProjConcept } from "./types";

export const BANKS: Bank[] = [
  { id: "galicia", name: "Banco Galicia", short: "Galicia", color: "var(--galicia)" },
  { id: "nacion", name: "Banco Nación", short: "Nación", color: "var(--nacion)" },
];

export const GROUPS = [
  "Saldo Inicial",
  "Ingresos",
  "Pagos",
  "Transf entre cuentas",
  "Ingreso por Venta de USD",
  "Suscripciones",
  "Rescates",
];

export const PROJ_CONCEPTS: ProjConcept[] = [
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

export const IVA_ROWS = ["Azúcar", "Soja", "Sorgo", "Fletes", "Servicios"];

export const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
