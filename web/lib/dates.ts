import { MONTHS_ES } from "./constants";

export function monthKeyFromISO(iso: string): string | null {
  // iso: 'YYYY-MM-DD' -> 'YYYY-MM'
  if (!iso) return null;
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  // 'YYYY-MM' -> 'jul-25'
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_ES[m - 1]}-${String(y).slice(2)}`;
}

export function monthLong(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const full = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  return `${full[m - 1]} ${y}`;
}

export function addMonth(key: string, delta: number): string {
  let [y, m] = key.split("-").map(Number);
  m += delta;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function monthRange(start: string, end: string): string[] {
  const out: string[] = [];
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
