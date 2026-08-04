// Importación de Movimientos desde Excel (mismo formato que exporta la app en
// lib/export.ts). SheetJS se importa dinámicamente para no sumarlo al bundle
// inicial: solo se carga cuando el usuario elige un archivo para importar.

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
