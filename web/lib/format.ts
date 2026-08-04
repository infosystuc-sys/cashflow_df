const fmt2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function money(n: unknown, decimals = true): string {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "";
  const v = Number(n);
  if (v === 0) return "-";
  return (decimals ? fmt2 : fmt0).format(v);
}

export function moneySigned(n: unknown, decimals = true): string {
  return money(n, decimals);
}

export function num(n: unknown): string {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "";
  return fmt0.format(Number(n));
}

export function parseNum(s: unknown): number {
  if (s === null || s === undefined) return 0;
  if (typeof s === "number") return s;
  let t = String(s).trim();
  if (!t) return 0;
  // admite 1.795.836,02 o 1795836.02
  if (t.indexOf(",") > -1) {
    t = t.replace(/\./g, "").replace(",", ".");
  }
  const v = parseFloat(t);
  return Number.isNaN(v) ? 0 : v;
}

export function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
