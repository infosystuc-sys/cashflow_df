// Importación de Movimientos desde Excel (mismo formato que exporta la app en
// lib/export.ts). SheetJS se importa dinámicamente para no sumarlo al bundle
// inicial: solo se carga cuando el usuario elige un archivo para importar.

import { GROUPS } from "./constants";

// Convierte una celda de fecha en formato dd/mm/aaaa (el que usa el export) a
// ISO 'YYYY-MM-DD'. Devuelve "" si la celda está vacía, y null si tiene
// contenido pero no matchea ese formato.
export function parseFechaCell(v: unknown): string | null {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = m[3];
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

// Admite números (celda numérica) o texto en formato es-AR (1.234,56) o plano
// (1234.56). Mismo criterio que parseNum() en lib/format.ts.
export function parseMoneyCell(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  let t = String(v).trim();
  if (!t) return 0;
  if (t.indexOf(",") > -1) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}

export type ParsedRow = {
  descripcion: string;
  proveedor: string;
  fechaEmision: string; // ISO 'YYYY-MM-DD' o ''
  fechaPago: string; // ISO 'YYYY-MM-DD'
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
};

export type ImportRowError = { row: number; message: string };

export type ParseResult =
  | { ok: true; rows: ParsedRow[] }
  | { ok: false; errors: ImportRowError[] };

const REQUIRED_HEADERS = ["Descripción", "F. pago", "Agrupación", "Crédito", "Débito"];
const VALID_GROUPS = GROUPS.filter((g) => g !== "Saldo Inicial");

export async function parseMovementsWorkbook(buf: ArrayBuffer): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });

  if (!aoa.length) {
    return { ok: false, errors: [{ row: 0, message: "El archivo está vacío." }] };
  }

  const header = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
  const col = (name: string) => header.indexOf(name);

  const missing = REQUIRED_HEADERS.filter((h) => col(h) === -1);
  if (missing.length) {
    return {
      ok: false,
      errors: [{
        row: 0,
        message: `El archivo no tiene el formato esperado. Faltan columnas: ${missing.join(", ")}.`,
      }],
    };
  }

  const idx = {
    descripcion: col("Descripción"),
    proveedor: col("Proveedor / Cliente"),
    fechaEmision: col("F. emisión"),
    fechaPago: col("F. pago"),
    cheque: col("Cheque"),
    grupo: col("Agrupación"),
    credito: col("Crédito"),
    debito: col("Débito"),
  };

  const cellAt = (raw: unknown[], i: number) => (i === -1 ? "" : raw[i]);
  const errors: ImportRowError[] = [];
  const rows: ParsedRow[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const raw = aoa[i] as unknown[];
    if (!raw || raw.every((c) => c === "" || c === null || c === undefined)) continue;

    const descripcion = String(cellAt(raw, idx.descripcion) ?? "").trim();
    if (descripcion === "Saldo Inicial") continue;

    const rowNum = i + 1; // 1-based incluyendo el encabezado, coincide con la fila que ve el usuario en Excel

    if (!descripcion) {
      errors.push({ row: rowNum, message: "Falta la Descripción." });
      continue;
    }

    const fechaPago = parseFechaCell(cellAt(raw, idx.fechaPago));
    if (!fechaPago) {
      errors.push({ row: rowNum, message: "Falta o es inválida la Fecha de pago (formato esperado dd/mm/aaaa)." });
      continue;
    }

    const grupo = String(cellAt(raw, idx.grupo) ?? "").trim();
    if (!VALID_GROUPS.includes(grupo)) {
      errors.push({
        row: rowNum,
        message: `Agrupación "${grupo}" no es válida. Debe ser una de: ${VALID_GROUPS.join(", ")}.`,
      });
      continue;
    }

    const fechaEmision = parseFechaCell(cellAt(raw, idx.fechaEmision));
    if (fechaEmision === null) {
      errors.push({ row: rowNum, message: "La Fecha de emisión no tiene un formato válido (dd/mm/aaaa)." });
      continue;
    }

    rows.push({
      descripcion,
      proveedor: String(cellAt(raw, idx.proveedor) ?? "").trim(),
      fechaEmision,
      fechaPago,
      cheque: String(cellAt(raw, idx.cheque) ?? "").trim(),
      credito: parseMoneyCell(cellAt(raw, idx.credito)),
      debito: parseMoneyCell(cellAt(raw, idx.debito)),
      grupo,
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, rows };
}
