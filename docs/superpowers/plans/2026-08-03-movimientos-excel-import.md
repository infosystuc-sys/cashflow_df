# Importación de Movimientos desde Excel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar importación de movimientos desde un archivo Excel (mismo formato que ya exporta la app) al módulo Movimientos, con validación todo-o-nada, detección de posibles duplicados y revisión manual antes de confirmar.

**Architecture:** Un módulo puro `lib/import.ts` (sin dependencias de React/Supabase) parsea y valida el `.xlsx` con SheetJS, devolviendo filas tipadas o una lista de errores. `lib/data.ts` gana un insert en bulk; `CashflowContext` expone `addMovements` para escribirlas todas de una vez y reflejarlas en el estado local. Dos modales nuevos (`ImportErrorsModal`, `ImportReviewModal`) se conectan desde `app/movimientos/page.tsx` junto al botón de exportar ya existente.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, `xlsx` (SheetJS, ya es dependencia del proyecto), Supabase (`@supabase/supabase-js`), Vitest (entorno `node`).

## Global Constraints

- El archivo a importar debe seguir el formato de columnas del export actual: `Descripción, Proveedor / Cliente, Banco, F. emisión, F. pago, Cheque, Agrupación, Crédito, Débito, Saldo`. Columnas mínimas requeridas para reconocer el archivo: `Descripción, F. pago, Agrupación, Crédito, Débito`.
- Las columnas `Banco` y `Saldo` se ignoran siempre al importar.
- La fila con Descripción = "Saldo Inicial" se salta (no es un movimiento real).
- Fechas en celdas: formato `dd/mm/aaaa` (igual que `exDate` de `lib/export.ts`).
- Validación todo-o-nada: si cualquier fila tiene un error, no se inserta nada; se listan todos los errores encontrados.
- Duplicados: mismo `fechaPago` + `descripcion` normalizada (mismo criterio que `norm()`) + mismo importe (crédito o débito). Se muestran en un modal de revisión con checkbox por fila; los duplicados vienen destildados por defecto, los nuevos tildados.
- El banco de destino de TODAS las filas importadas es el de la pestaña activa (`bankId`); la columna Banco del archivo no se usa para esto.
- No hay actualización de movimientos existentes vía import (solo inserción de filas nuevas seleccionadas).
- Seguir los patrones ya existentes en el repo: `lib/export.ts` (import dinámico de `xlsx`), `lib/data.ts` (mapeo camelCase ↔ snake_case de Supabase), `components/ui/index.tsx` (`Modal`, `GroupChip`).

---

## File Structure

- `web/lib/format.ts` — se agrega `norm()` (extraída de `app/movimientos/page.tsx`, hoy duplicada solo ahí; se necesita también en `lib/import.ts`).
- `web/lib/import.ts` — **nuevo**. Parseo y validación del Excel, y detección de duplicados. Sin dependencias de React.
- `web/lib/data.ts` — se agrega `insertMovements` (bulk insert).
- `web/context/CashflowContext.tsx` — se agrega `addMovements`.
- `web/components/movimientos/ImportErrorsModal.tsx` — **nuevo**. Modal de errores de validación.
- `web/components/movimientos/ImportReviewModal.tsx` — **nuevo**. Modal de revisión con checkboxes y detección de duplicados.
- `web/app/movimientos/page.tsx` — botón "Importar desde Excel", input de archivo oculto, wiring de los dos modales nuevos.
- `web/app/globals.css` — clases nuevas para la lista de errores y la fila/chip de "posible duplicado".

---

### Task 1: Extraer `norm()` a `lib/format.ts`

`lib/import.ts` (Task 3) necesita la misma función de normalización de texto que ya usa `app/movimientos/page.tsx` para buscar. Se extrae a un lugar compartido en vez de duplicarla.

**Files:**
- Modify: `web/lib/format.ts`
- Modify: `web/lib/format.test.ts`
- Modify: `web/app/movimientos/page.tsx:7` (import) y `web/app/movimientos/page.tsx:26-28` (función local a eliminar)
- Test: `web/lib/format.test.ts`

**Interfaces:**
- Produces: `norm(s: string): string` exportada desde `@/lib/format`, usada por `lib/import.ts` (Task 4) y `app/movimientos/page.tsx`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `web/lib/format.test.ts`:

```typescript
import { money, norm, num, parseNum } from "./format";
```

(reemplaza el import existente `import { money, num, parseNum } from "./format";` en la línea 2)

Y agregar al final del archivo:

```typescript

describe("norm", () => {
  it("lowercases and strips diacritics", () => {
    expect(norm("ESTACIÓN El Bajo")).toBe("estacion el bajo");
  });

  it("returns an empty string for empty or undefined input", () => {
    expect(norm("")).toBe("");
    expect(norm(undefined as unknown as string)).toBe("");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd web && npm test -- format.test.ts`
Expected: FAIL con `norm is not exported` o similar (todavía no existe en `format.ts`).

- [ ] **Step 3: Implementar `norm` en `lib/format.ts`**

Agregar al final de `web/lib/format.ts`:

```typescript

export function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd web && npm test -- format.test.ts`
Expected: PASS (todos los describe de `format.test.ts`, incluido el nuevo `norm`).

- [ ] **Step 5: Usar la función compartida en la página de Movimientos**

En `web/app/movimientos/page.tsx`, línea 7, cambiar:

```typescript
import { money } from "@/lib/format";
```

por:

```typescript
import { money, norm } from "@/lib/format";
```

Y eliminar la definición local en las líneas 26-28:

```typescript
function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}
```

(sin reemplazo — el resto del archivo ya llama a `norm(...)` como función de módulo, así que no hace falta tocar nada más).

- [ ] **Step 6: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add web/lib/format.ts web/lib/format.test.ts web/app/movimientos/page.tsx
git commit -m "refactor: extraer norm() a lib/format.ts para reutilizarla en import.ts"
```

---

### Task 2: `lib/import.ts` — parseo de celdas (fecha y monto)

**Files:**
- Create: `web/lib/import.ts`
- Test: `web/lib/import.test.ts`

**Interfaces:**
- Produces: `parseFechaCell(v: unknown): string | null`, `parseMoneyCell(v: unknown): number`, usadas por `parseMovementsWorkbook` (Task 3).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `web/lib/import.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseFechaCell, parseMoneyCell } from "./import";

describe("parseFechaCell", () => {
  it("converts dd/mm/yyyy to ISO yyyy-mm-dd", () => {
    expect(parseFechaCell("03/08/2026")).toBe("2026-08-03");
    expect(parseFechaCell("3/8/2026")).toBe("2026-08-03");
  });

  it("returns '' for empty cells", () => {
    expect(parseFechaCell("")).toBe("");
    expect(parseFechaCell(null)).toBe("");
    expect(parseFechaCell(undefined)).toBe("");
  });

  it("returns null for values that aren't dd/mm/yyyy", () => {
    expect(parseFechaCell("no es una fecha")).toBeNull();
    expect(parseFechaCell("2026-08-03")).toBeNull();
    expect(parseFechaCell("32/13/2026")).toBeNull();
  });
});

describe("parseMoneyCell", () => {
  it("parses es-AR formatted strings", () => {
    expect(parseMoneyCell("1.234,56")).toBe(1234.56);
  });

  it("parses plain decimal strings", () => {
    expect(parseMoneyCell("500")).toBe(500);
  });

  it("passes through numbers unchanged", () => {
    expect(parseMoneyCell(1500)).toBe(1500);
  });

  it("returns 0 for empty cells", () => {
    expect(parseMoneyCell("")).toBe(0);
    expect(parseMoneyCell(null)).toBe(0);
    expect(parseMoneyCell(undefined)).toBe(0);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd web && npm test -- import.test.ts`
Expected: FAIL — `./import` no existe todavía.

- [ ] **Step 3: Implementar los parsers**

Crear `web/lib/import.ts`:

```typescript
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
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npm test -- import.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/import.ts web/lib/import.test.ts
git commit -m "feat(import): parsers de celdas de fecha y monto para importación de Excel"
```

---

### Task 3: `lib/import.ts` — parseo y validación completa del archivo

**Files:**
- Modify: `web/lib/import.ts`
- Test: `web/lib/import.test.ts`

**Interfaces:**
- Consumes: `parseFechaCell`, `parseMoneyCell` (Task 2).
- Produces: tipos `ParsedRow`, `ImportRowError`, `ParseResult`, y `parseMovementsWorkbook(buf: ArrayBuffer): Promise<ParseResult>` — usada por `findDuplicate` (Task 4, mismo archivo) y por `app/movimientos/page.tsx` (Task 8).

```typescript
type ParsedRow = {
  descripcion: string;
  proveedor: string;
  fechaEmision: string; // ISO 'YYYY-MM-DD' o ''
  fechaPago: string; // ISO 'YYYY-MM-DD'
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
};
type ImportRowError = { row: number; message: string };
type ParseResult = { ok: true; rows: ParsedRow[] } | { ok: false; errors: ImportRowError[] };
```

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `web/lib/import.test.ts` (import de XLSX arriba del todo, junto a los demás imports):

```typescript
import * as XLSX from "xlsx";
import { parseMovementsWorkbook } from "./import";
```

Y agregar, antes del primer `describe`, el helper para construir archivos de prueba en memoria:

```typescript
const HEADER = [
  "Descripción", "Proveedor / Cliente", "Banco", "F. emisión", "F. pago",
  "Cheque", "Agrupación", "Crédito", "Débito", "Saldo",
];

function makeWorkbookBuffer(rows: (string | number | null)[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADER, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
}
```

Y agregar el siguiente `describe`:

```typescript
describe("parseMovementsWorkbook", () => {
  it("parses valid rows and skips the 'Saldo Inicial' row", async () => {
    const buf = makeWorkbookBuffer([
      ["Saldo Inicial", "", "Banco Galicia", "", "", "", "", null, null, 1000],
      ["Pago proveedor", "Acme", "Banco Galicia", "01/08/2026", "03/08/2026", "", "Pagos", null, 500, 500],
      ["Cobro cliente", "Cliente X", "Banco Galicia", "", "05/08/2026", "", "Ingresos", 800, null, 1300],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      descripcion: "Pago proveedor",
      proveedor: "Acme",
      fechaEmision: "2026-08-01",
      fechaPago: "2026-08-03",
      cheque: "",
      credito: 0,
      debito: 500,
      grupo: "Pagos",
    });
    expect(result.rows[1].credito).toBe(800);
  });

  it("fails fast when required columns are missing", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["Descripción", "Importe"], ["Algo", 100]]);
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const buf = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toMatch(/formato esperado/);
  });

  it("collects every row error and rejects the whole import (todo o nada)", async () => {
    const buf = makeWorkbookBuffer([
      ["Sin fecha de pago", "", "Banco Galicia", "", "", "", "Pagos", null, 100, null],
      ["Grupo invalido", "", "Banco Galicia", "", "10/08/2026", "", "Varios", null, 100, null],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].row).toBe(2);
    expect(result.errors[1].row).toBe(3);
  });

  it("ignores fully blank rows", async () => {
    const buf = makeWorkbookBuffer([
      ["Pago proveedor", "", "Banco Galicia", "", "03/08/2026", "", "Pagos", null, 500, 500],
      ["", "", "", "", "", "", "", null, null, null],
    ]);
    const result = await parseMovementsWorkbook(buf);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd web && npm test -- import.test.ts`
Expected: FAIL — `parseMovementsWorkbook is not exported`.

- [ ] **Step 3: Implementar `parseMovementsWorkbook`**

Agregar al final de `web/lib/import.ts` (los tipos van arriba de la función, debajo de los imports que ya existen):

```typescript

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
```

Y agregar el import que falta arriba del todo de `web/lib/import.ts` (antes de los parsers de Task 2):

```typescript
import { GROUPS } from "./constants";
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npm test -- import.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add web/lib/import.ts web/lib/import.test.ts
git commit -m "feat(import): parseo y validación todo-o-nada del Excel de movimientos"
```

---

### Task 4: `lib/import.ts` — detección de duplicados

**Files:**
- Modify: `web/lib/import.ts`
- Test: `web/lib/import.test.ts`

**Interfaces:**
- Consumes: `ParsedRow` (Task 3), `norm` de `@/lib/format` (Task 1), `Movement` de `@/lib/types`.
- Produces: `findDuplicate(row: ParsedRow, existing: Movement[]): Movement | null` — usada por `app/movimientos/page.tsx` (Task 8).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `web/lib/import.test.ts`:

```typescript
import { findDuplicate } from "./import";
import type { Movement } from "./types";
```

(sumar a los imports existentes del archivo, no reemplazar)

```typescript
describe("findDuplicate", () => {
  const existing: Movement[] = [
    {
      id: "m1", bank: "galicia", descripcion: "Pago proveedor", proveedor: "",
      fechaEmision: "", fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    },
  ];

  it("matches same fechaPago + normalized descripcion + amount", () => {
    const row = {
      descripcion: "PAGO PROVEEDOR", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)?.id).toBe("m1");
  });

  it("returns null when the date differs", () => {
    const row = {
      descripcion: "Pago proveedor", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-04", cheque: "", credito: 0, debito: 500, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)).toBeNull();
  });

  it("returns null when the amount differs", () => {
    const row = {
      descripcion: "Pago proveedor", proveedor: "", fechaEmision: "",
      fechaPago: "2026-08-03", cheque: "", credito: 0, debito: 501, grupo: "Pagos",
    };
    expect(findDuplicate(row, existing)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd web && npm test -- import.test.ts`
Expected: FAIL — `findDuplicate is not exported`.

- [ ] **Step 3: Implementar `findDuplicate`**

Agregar el import al inicio de `web/lib/import.ts` (junto a `import { GROUPS } from "./constants";`):

```typescript
import { norm } from "./format";
import type { Movement } from "./types";
```

Y agregar al final del archivo:

```typescript

// Compara una fila parseada contra los movimientos existentes del banco activo
// para marcar posibles duplicados: misma fecha de pago + descripción
// normalizada + mismo importe (crédito o débito, el que corresponda).
export function findDuplicate(row: ParsedRow, existing: Movement[]): Movement | null {
  const amount = row.credito || row.debito;
  return (
    existing.find(
      (m) =>
        m.fechaPago === row.fechaPago &&
        norm(m.descripcion) === norm(row.descripcion) &&
        (m.credito || m.debito) === amount
    ) ?? null
  );
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd web && npm test -- import.test.ts`
Expected: PASS — todos los describe de `import.test.ts` (parseFechaCell, parseMoneyCell, parseMovementsWorkbook, findDuplicate).

- [ ] **Step 5: Commit**

```bash
git add web/lib/import.ts web/lib/import.test.ts
git commit -m "feat(import): detección de posibles duplicados contra movimientos existentes"
```

---

### Task 5: Bulk insert en `lib/data.ts` y `CashflowContext`

No lleva test automatizado nuevo: las demás funciones de `lib/data.ts` que escriben a Supabase (`insertMovement`, `updateMovement`, etc.) tampoco lo tienen — el único test de ese archivo (`data.test.ts`) es de lectura contra una base ya sembrada, y no correspondería mutar datos reales en un test. La verificación de esta pieza ocurre end-to-end en el Task 8 (import real desde el navegador).

**Files:**
- Modify: `web/lib/data.ts`
- Modify: `web/context/CashflowContext.tsx`

**Interfaces:**
- Consumes: `supabase` de `./supabase`, tipo `Movement`/`BankId` de `./types` (ya usados en `lib/data.ts`).
- Produces: `insertMovements(rows: Omit<Movement, "id">[]): Promise<Movement[]>` en `lib/data.ts`; `addMovements(rows: Omit<Movement, "id">[]): Promise<void>` en el valor de `useCashflow()` — consumida por `app/movimientos/page.tsx` (Task 8).

- [ ] **Step 1: Agregar `insertMovements` a `lib/data.ts`**

Insertar justo después de la función `insertMovement` (después de la línea 140, `}` de cierre) en `web/lib/data.ts`:

```typescript

export async function insertMovements(rows: Omit<Movement, "id">[]): Promise<Movement[]> {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from("movements")
    .insert(
      rows.map((m) => ({
        bank: m.bank,
        descripcion: m.descripcion,
        proveedor: m.proveedor,
        fecha_emision: m.fechaEmision || null,
        fecha_pago: m.fechaPago,
        cheque: m.cheque,
        credito: m.credito,
        debito: m.debito,
        grupo: m.grupo,
      }))
    )
    .select();
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    bank: row.bank,
    descripcion: row.descripcion,
    proveedor: row.proveedor,
    fechaEmision: row.fecha_emision ?? "",
    fechaPago: row.fecha_pago,
    cheque: row.cheque,
    credito: Number(row.credito),
    debito: Number(row.debito),
    grupo: row.grupo,
  }));
}
```

- [ ] **Step 2: Agregar `addMovements` a `CashflowContext`**

En `web/context/CashflowContext.tsx`, agregar `insertMovements` al import existente de `./lib/data` (línea 7, junto a `insertMovement`):

```typescript
  insertMovement,
  insertMovements,
```

Agregar a la interfaz `CashflowContextValue` (después de la línea 26, `addMovement: ...`):

```typescript
  addMovements: (rows: Omit<Movement, "id">[]) => Promise<void>;
```

Agregar la implementación después de la función `addMovement` (después de la línea 58, cierre de `addMovement`):

```typescript

  const addMovements = async (rows: Omit<Movement, "id">[]) => {
    const created = await insertMovements(rows);
    setState((s) => (s ? { ...s, movements: [...s.movements, ...created] } : s));
  };
```

Y agregarla al objeto `value` devuelto (después de la línea 148, `addMovement,`):

```typescript
    addMovements,
```

- [ ] **Step 3: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/lib/data.ts web/context/CashflowContext.tsx
git commit -m "feat(import): insert en bulk de movimientos (insertMovements/addMovements)"
```

---

### Task 6: Modal de errores de validación

**Files:**
- Create: `web/components/movimientos/ImportErrorsModal.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `Modal` de `@/components/ui`, `ImportRowError` de `@/lib/import` (Task 3).
- Produces: componente `ImportErrorsModal({ errors, onClose })` — usado por `app/movimientos/page.tsx` (Task 8).

Sin test automatizado: no hay tests de componentes React en este repo (todos los `*.test.ts` son de `lib/`, lógica pura). Se verifica manualmente en el Task 8.

- [ ] **Step 1: Crear el componente**

Crear `web/components/movimientos/ImportErrorsModal.tsx`:

```tsx
"use client";

import { Modal } from "@/components/ui";
import type { ImportRowError } from "@/lib/import";

export function ImportErrorsModal({
  errors,
  onClose,
}: {
  errors: ImportRowError[];
  onClose: () => void;
}) {
  return (
    <Modal
      title="No se pudo importar el archivo"
      width={520}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      <p className="form-tip">
        Corregí estos problemas en el Excel y volvé a intentar la importación. No se cargó ningún movimiento.
      </p>
      <ul className="import-errors">
        {errors.map((e, i) => (
          <li key={i}>
            {e.row > 0 ? <strong>Fila {e.row}: </strong> : null}
            {e.message}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
```

- [ ] **Step 2: Agregar estilos**

Agregar a `web/app/globals.css`, después del bloque `.form-tip` (línea 281):

```css
.import-errors{margin:12px 0 0;padding-left:18px;font-size:13px;color:var(--ink-soft);display:flex;flex-direction:column;gap:6px;}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/components/movimientos/ImportErrorsModal.tsx web/app/globals.css
git commit -m "feat(import): modal de errores de validación al importar"
```

---

### Task 7: Modal de revisión (duplicados + selección)

**Files:**
- Create: `web/components/movimientos/ImportReviewModal.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Consumes: `Modal`, `GroupChip` de `@/components/ui`, `ParsedRow` de `@/lib/import` (Task 3).
- Produces: componente `ImportReviewModal({ rows, duplicateIds, onConfirm, onClose })` — usado por `app/movimientos/page.tsx` (Task 8). `duplicateIds` es un array paralelo a `rows`: `string | null` (id del movimiento existente que matchea, o `null` si la fila es nueva).

Sin test automatizado (mismo motivo que Task 6). Se verifica manualmente en el Task 8.

- [ ] **Step 1: Crear el componente**

Crear `web/components/movimientos/ImportReviewModal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Modal, GroupChip } from "@/components/ui";
import type { ParsedRow } from "@/lib/import";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ImportReviewModal({
  rows,
  duplicateIds,
  onConfirm,
  onClose,
}: {
  rows: ParsedRow[];
  duplicateIds: (string | null)[];
  onConfirm: (selected: ParsedRow[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(rows.map((_, i) => duplicateIds[i] === null));
  const dupCount = duplicateIds.filter((id) => id !== null).length;
  const newCount = rows.length - dupCount;
  const selectedCount = checked.filter(Boolean).length;

  const toggle = (i: number) => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));

  return (
    <Modal
      title="Revisar importación"
      width={860}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn--primary"
            disabled={selectedCount === 0}
            onClick={() => onConfirm(rows.filter((_, i) => checked[i]))}
          >
            Importar seleccionados ({selectedCount})
          </button>
        </>
      }
    >
      <p className="form-tip">
        {newCount} nuevos · {dupCount} posibles duplicados. Los posibles duplicados vienen destildados: tildalos si igual querés importarlos.
      </p>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th></th>
              <th>Descripción</th>
              <th>Proveedor / Cliente</th>
              <th>F. pago</th>
              <th>Agrupación</th>
              <th>Crédito</th>
              <th>Débito</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={duplicateIds[i] !== null ? "row-dup" : "row"}>
                <td>
                  <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
                </td>
                <td>{r.descripcion}</td>
                <td>{r.proveedor}</td>
                <td>{fmtDate(r.fechaPago)}</td>
                <td><GroupChip group={r.grupo} /></td>
                <td>{r.credito || ""}</td>
                <td>{r.debito || ""}</td>
                <td>{duplicateIds[i] !== null && <span className="chip chip--dup">posible duplicado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Agregar estilos**

Agregar a `web/app/globals.css`, después del bloque `.chip--cheque-endosado` (línea 192):

```css
.chip--dup{background:#fff7e6;color:#c2820a;}
.row-dup{background:#fffaf0;}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add web/components/movimientos/ImportReviewModal.tsx web/app/globals.css
git commit -m "feat(import): modal de revisión con selección de filas y aviso de duplicados"
```

---

### Task 8: Wiring en la página de Movimientos + verificación end-to-end

**Files:**
- Modify: `web/app/movimientos/page.tsx`

**Interfaces:**
- Consumes: `parseMovementsWorkbook`, `findDuplicate`, `ParsedRow`, `ImportRowError` de `@/lib/import` (Tasks 3-4); `addMovements` de `useCashflow()` (Task 5); `ImportErrorsModal` (Task 6); `ImportReviewModal` (Task 7).

- [ ] **Step 1: Agregar imports**

En `web/app/movimientos/page.tsx`, cambiar la línea 3:

```typescript
import { useMemo, useState } from "react";
```

por:

```typescript
import { useMemo, useRef, useState } from "react";
```

Y agregar, junto a los demás imports de `lib`/`components` (después de la línea 9, `import { downloadXlsx, exDate, type Cell } from "@/lib/export";`):

```typescript
import { parseMovementsWorkbook, findDuplicate, type ParsedRow, type ImportRowError } from "@/lib/import";
```

Y después de la línea 18 (`import { BankSummaryCard } from "@/components/movimientos/BankSummaryCard";`):

```typescript
import { ImportErrorsModal } from "@/components/movimientos/ImportErrorsModal";
import { ImportReviewModal } from "@/components/movimientos/ImportReviewModal";
```

- [ ] **Step 2: Consumir `addMovements` del contexto**

Nota: el Task 1 borró 3 líneas de este archivo (la función local `norm`), así que la numeración original ya no aplica — ubicar la línea por contenido, no por número.

Cambiar:

```typescript
const { state, addMovement, updateMovement, deleteMovement } = useCashflow();
```

por:

```typescript
const { state, addMovement, addMovements, updateMovement, deleteMovement } = useCashflow();
```

- [ ] **Step 3: Agregar estado y handler de importación**

Justo después de la función `exportExcel` (después del `};` que cierra esa función, la que arma y descarga el `.xlsx`), agregar:

```typescript

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importErrors, setImportErrors] = useState<ImportRowError[] | null>(null);
  const [importReview, setImportReview] = useState<{ rows: ParsedRow[]; duplicateIds: (string | null)[] } | null>(null);

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const buf = await file.arrayBuffer();
    const result = await parseMovementsWorkbook(buf);
    if (!result.ok) {
      setImportErrors(result.errors);
      return;
    }
    const bankMovements = state.movements.filter((m) => m.bank === bankId);
    const duplicateIds = result.rows.map((r) => findDuplicate(r, bankMovements)?.id ?? null);
    setImportReview({ rows: result.rows, duplicateIds });
  };

  const confirmImport = async (selected: ParsedRow[]) => {
    await addMovements(selected.map((r) => ({ ...r, bank: bankId })));
    setImportReview(null);
  };
```

(Este bloque va después del guard `if (!state || !summary) return null;`, igual que `exportExcel`, así que `state` ya está acotado a no-null por TypeScript en este punto — no hace falta chequearlo de nuevo).

- [ ] **Step 4: Agregar el botón e input de archivo**

En el JSX, dentro de `<div className="view-head-actions">` (antes del botón "⭳ Exportar a Excel"), agregar:

```tsx
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={onImportFile}
          />
          <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
            ⭱ Importar desde Excel
          </button>
```

quedando el bloque completo así:

```tsx
        <div className="view-head-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={onImportFile}
          />
          <button className="btn btn--ghost" onClick={() => fileInputRef.current?.click()}>
            ⭱ Importar desde Excel
          </button>
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
          <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo movimiento</button>
        </div>
```

- [ ] **Step 5: Renderizar los modales nuevos**

Junto a los modales existentes al final del JSX (después del bloque `{confirm && (...)}`, antes del cierre `</div>` final del componente), agregar:

```tsx
      {importErrors && (
        <ImportErrorsModal errors={importErrors} onClose={() => setImportErrors(null)} />
      )}
      {importReview && (
        <ImportReviewModal
          rows={importReview.rows}
          duplicateIds={importReview.duplicateIds}
          onConfirm={confirmImport}
          onClose={() => setImportReview(null)}
        />
      )}
```

- [ ] **Step 6: Verificar que compila**

Run: `cd web && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Correr toda la suite de tests**

Run: `cd web && npm test`
Expected: PASS (todos los archivos `lib/*.test.ts`; `data.test.ts` se salta si no hay credenciales de Supabase en el entorno).

- [ ] **Step 8: Verificación manual en el navegador (flujo completo)**

Esta es la única forma real de probar el flujo — es UI conectada a Supabase.

1. Levantar la app: `cd web && npm run dev`, abrir `http://localhost:3000/movimientos`.
2. Con la pestaña de un banco abierta (ej. Banco Galicia), clickear "⭳ Exportar a Excel" para bajar un archivo de referencia con el formato correcto.
3. Abrir ese archivo en Excel/LibreOffice y agregar 2-3 filas nuevas debajo de las existentes (Descripción, F. pago obligatoria, Agrupación con uno de los valores válidos, Crédito o Débito). Dejar sin tocar el resto. Guardar.
4. Clickear "⭱ Importar desde Excel" en la misma pestaña de banco y seleccionar ese archivo.
5. Verificar que se abre el modal de revisión mostrando "N nuevos · 0 posibles duplicados" (las filas viejas del export deberían matchear como duplicados si no se las borró del archivo antes de importar — si se dejaron, verificar que aparecen tildadas como "posible duplicado" y destildadas por defecto).
6. Confirmar la importación con las filas nuevas tildadas. Verificar que aparecen en la tabla de Movimientos con el banco correcto (el de la pestaña activa, sin importar lo que decía la columna Banco del archivo) y que el saldo corrido se recalculó bien.
7. Volver a importar el mismo archivo sin modificarlo: todas las filas deberían aparecer ahora como "posible duplicado" (destildadas por defecto). Cancelar sin confirmar nada y verificar que no se duplicó ningún movimiento.
8. Probar el camino de error: editar el archivo y borrar el valor de "F. pago" de una fila, o poner un valor cualquiera en "Agrupación". Importar: debe aparecer el modal de error listando la fila y el motivo, y no debe haberse insertado ningún movimiento (revisar la tabla).
9. Probar un archivo con formato incorrecto (ej. un `.xlsx` cualquiera sin esas columnas): debe mostrar el error "no tiene el formato esperado" sin intentar interpretarlo.

- [ ] **Step 9: Commit**

```bash
git add web/app/movimientos/page.tsx
git commit -m "feat(import): conectar importación de Excel a la página de Movimientos"
```
