// Exportación a Excel (.xlsx). SheetJS se importa dinámicamente para no sumarlo
// al bundle inicial: solo se carga cuando el usuario aprieta "Exportar".

export type Cell = string | number | null;
export type ExportSheet = { name: string; aoa: Cell[][] };

function sanitizeSheetName(name: string): string {
  const clean = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return clean.slice(0, 31) || "Hoja";
}

export async function downloadXlsx(filename: string, sheets: ExportSheet[]): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.aoa);
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(s.name));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

// dd/mm/yyyy para celdas de fecha (a partir de un ISO 'YYYY-MM-DD').
export function exDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
