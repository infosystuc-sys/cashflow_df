# Cesión de cheques Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Cesionado" estado to Cheques, remove the redundant "Acreditado" estado, and make Depositar/Ceder automatically create (and keep in sync) a linked movement in the bank the user chooses, while Endosar records who the cheque was endorsed to.

**Architecture:** All work happens in `web/` (Next.js App Router, client-side Supabase via `supabase-js`, no server routes). A nullable `movement_id` column on `cheques` links a cheque to at most one `movements` row. `ChequeActionModal` gains a configurable extra field (bank picker or free text) driven by which action is open. `app/cheques/page.tsx` composes the existing `addMovement`/`updateMovement`/`deleteMovement`/`updateCheque`/`deleteCheque` context methods to create/sync/cascade-delete that linked movement — no new context methods except widening `addMovement`'s return type so the caller can learn the new row's id.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript (strict), Supabase (`supabase-js`, PostgREST, no RLS), Vitest for `lib/**/*.test.ts`.

**Spec:** `docs/superpowers/specs/2026-08-15-cesion-cheques-design.md`

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-15-cesion-cheques-design.md`. Follow it exactly; this plan is its task breakdown.
- The DB migration in the spec's section 6 has **already been run** by the user against the live Supabase instance (data fix + new columns + new check constraint). Do not attempt to run it again or via any MCP/CLI — only update `supabase/schema.sql` as the source-of-truth doc for fresh installs.
- `ChequeEstado` is exactly `"en_cartera" | "depositado" | "endosado" | "cesionado"` — `"acreditado"` no longer exists anywhere in the codebase after this plan (type, DB check constraint, UI labels, chip CSS, calc.ts branches, CashflowRow field, Cashflow page row).
- "Cesionado" is reachable **only** from `en_cartera` and is terminal (no further actions). "Depositado" is now also terminal except for **Rechazar** (its only remaining action).
- Movements are created (linked via `movementId`) on **Depositar** and **Cesionar** only, always for the cheque's full `importe` (no partial/discounted amount), with `grupo: "Ingresos"`. **Endosar** never touches movements. **Rechazar** deletes the linked movement.
- Editing a cheque's `importe`/`bancoDestino`/`cliente`/`numero` while it has a `movementId` syncs those fields into the linked movement — except an emptied `bancoDestino` must never be propagated (never write an invalid/empty `bank` onto a movement). Deleting a cheque cascades to delete its linked movement.
- This codebase has **no component/UI test harness** — `vitest` only runs `lib/**/*.test.ts` (see `web/vitest.config.ts`). Tasks touching `.tsx` files are verified by type-checking (`npx tsc --noEmit`, run from `web/`) plus manual verification in the dev server (final task), matching how every other feature in this repo was built.
- Run all commands from `web/` (e.g. `cd web` first, or prefix each command) unless noted otherwise.

---

### Task 1: Schema, types, and data layer for cesión

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `web/lib/types.ts`
- Modify: `web/lib/data.ts`
- Modify: `web/lib/seed.ts`

**Interfaces:**
- Produces: `ChequeEstado = "en_cartera" | "depositado" | "endosado" | "cesionado"`. `Cheque` gains `fechaCesion: string`, `endosadoA: string`, `movementId: string | null` — all required (not optional), matching the style of the existing date fields on `Cheque`.
- Produces: `insertCheque`, `updateCheque`, `fetchAllData`'s cheque mapping in `web/lib/data.ts` now read/write `fecha_cesion`, `endosado_a`, `movement_id`.

- [ ] **Step 1: Update the schema source of truth**

In `supabase/schema.sql`, replace the `cheques` table definition (and its seed insert) with:

```sql
create table cheques (
  id uuid primary key default gen_random_uuid(),
  cliente text not null default '',
  numero text not null default '',
  banco_emisor text not null default '',
  banco_destino text not null default '' check (banco_destino in ('', 'galicia', 'nacion')),
  importe numeric not null default 0,
  fecha_recepcion date not null,
  fecha_pago date,
  estado text not null default 'en_cartera' check (estado in ('en_cartera', 'depositado', 'endosado', 'cesionado')),
  fecha_deposito date,
  fecha_acreditacion date,
  fecha_rechazo date,
  fecha_endoso date,
  fecha_cesion date,
  endosado_a text not null default '',
  movement_id uuid,
  created_at timestamptz not null default now()
);
```

And the seed insert near the bottom of the file (the one that currently ends with `'acreditado', '2026-05-18', '2026-05-22'`) to:

```sql
insert into cheques (cliente, numero, banco_emisor, banco_destino, importe, fecha_recepcion, fecha_pago, estado, fecha_deposito, fecha_acreditacion) values
('AGD', '0001234', 'Banco Santander', 'galicia', 14000000, '2026-06-20', '2026-06-30', 'en_cartera', null, null),
('RUIZ RODRIGO', '0005678', 'Banco Macro', 'nacion', 12000000, '2026-06-22', '2026-07-05', 'depositado', '2026-06-29', null),
('ESTANCIA EL AZUL', '0009012', 'Banco Galicia', 'galicia', 8000000, '2026-05-10', '2026-05-20', 'depositado', '2026-05-18', '2026-05-22');
```
(Only the third row's `estado` changes, from `'acreditado'` to `'depositado'` — `fecha_acreditacion` stays as historical data, it just no longer drives anything.)

- [ ] **Step 2: Update the `Cheque` type**

In `web/lib/types.ts`, replace:
```ts
export type ChequeEstado = "en_cartera" | "depositado" | "acreditado" | "endosado";
```
with:
```ts
export type ChequeEstado = "en_cartera" | "depositado" | "endosado" | "cesionado";
```

And replace the `Cheque` interface with:
```ts
export interface Cheque {
  id: string;
  cliente: string;
  numero: string;
  bancoEmisor: string;
  bancoDestino: BankId | "";
  importe: number;
  fechaRecepcion: string; // 'YYYY-MM-DD'
  fechaPago: string; // 'YYYY-MM-DD'
  estado: ChequeEstado;
  fechaDeposito: string; // 'YYYY-MM-DD' o ''
  fechaAcreditacion: string; // 'YYYY-MM-DD' o '' — histórico, ya no se escribe ni se usa
  fechaRechazo: string; // 'YYYY-MM-DD' o ''
  fechaEndoso: string; // 'YYYY-MM-DD' o ''
  fechaCesion: string; // 'YYYY-MM-DD' o ''
  endosadoA: string; // a quién se endosó, '' si no aplica
  movementId: string | null; // id del movimiento vinculado (Depositar/Ceder), null si no tiene
}
```

Also remove `chequesAcreditado: number;` from the `CashflowRow` interface (a few lines below `Cheque` in the same file) — Task 3 removes every place that reads/writes it, this step just removes the field declaration itself.

- [ ] **Step 3: Read/write the new columns in `web/lib/data.ts`**

In `fetchAllData`, the `cheques` mapping (`const cheques: Cheque[] = chequesRes.data.map(...)`) — add the three new fields:
```ts
const cheques: Cheque[] = chequesRes.data.map((row) => ({
  id: row.id,
  cliente: row.cliente,
  numero: row.numero,
  bancoEmisor: row.banco_emisor,
  bancoDestino: row.banco_destino,
  importe: Number(row.importe),
  fechaRecepcion: row.fecha_recepcion,
  fechaPago: row.fecha_pago ?? "",
  estado: row.estado,
  fechaDeposito: row.fecha_deposito ?? "",
  fechaAcreditacion: row.fecha_acreditacion ?? "",
  fechaRechazo: row.fecha_rechazo ?? "",
  fechaEndoso: row.fecha_endoso ?? "",
  fechaCesion: row.fecha_cesion ?? "",
  endosadoA: row.endosado_a,
  movementId: row.movement_id ?? null,
}));
```

`chequeToRow` (used by both `insertCheque` and `updateCheque`) — add the same three fields to the outgoing row:
```ts
function chequeToRow(c: Omit<Cheque, "id">) {
  return {
    cliente: c.cliente,
    numero: c.numero,
    banco_emisor: c.bancoEmisor,
    banco_destino: c.bancoDestino,
    importe: c.importe,
    fecha_recepcion: c.fechaRecepcion,
    fecha_pago: c.fechaPago || null,
    estado: c.estado,
    fecha_deposito: c.fechaDeposito || null,
    fecha_acreditacion: c.fechaAcreditacion || null,
    fecha_rechazo: c.fechaRechazo || null,
    fecha_endoso: c.fechaEndoso || null,
    fecha_cesion: c.fechaCesion || null,
    endosado_a: c.endosadoA,
    movement_id: c.movementId,
  };
}
```

- [ ] **Step 4: Update `seedCheques` in `web/lib/seed.ts`**

Replace the `c()` helper and the returned array in `seedCheques()`:
```ts
export function seedCheques(): SeedCheque[] {
  const c = (
    cliente: string,
    numero: string,
    bancoEmisor: string,
    bancoDestino: Cheque["bancoDestino"],
    importe: number,
    fechaRecepcion: string,
    fechaPago: string,
    estado: Cheque["estado"],
    fechaDeposito = "",
    fechaAcreditacion = "",
    fechaRechazo = "",
    fechaEndoso = "",
    fechaCesion = "",
    endosadoA = "",
    movementId: string | null = null
  ): SeedCheque => ({
    cliente, numero, bancoEmisor, bancoDestino, importe, fechaRecepcion, fechaPago, estado,
    fechaDeposito, fechaAcreditacion, fechaRechazo, fechaEndoso, fechaCesion, endosadoA, movementId,
  });

  return [
    c("AGD", "0001234", "Banco Santander", "galicia", 14000000, "2026-06-20", "2026-06-30", "en_cartera"),
    c("RUIZ RODRIGO", "0005678", "Banco Macro", "nacion", 12000000, "2026-06-22", "2026-07-05", "depositado", "2026-06-29"),
    c("ESTANCIA EL AZUL", "0009012", "Banco Galicia", "galicia", 8000000, "2026-05-10", "2026-05-20", "depositado", "2026-05-18", "2026-05-22"),
  ];
}
```
(Same change as the schema seed: the third row's `estado` goes from `"acreditado"` to `"depositado"`, keeping its old `fechaAcreditacion` value as harmless historical data — note the 8th positional arg here is `fechaAcreditacion`, so `"2026-05-22"` stays exactly where it was.)

- [ ] **Step 5: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: errors in `web/app/cheques/page.tsx`, `web/components/cheques/ChequeEditor.tsx`, `web/lib/calc.ts`, `web/lib/calc.test.ts`, `web/app/cashflow/page.tsx` (all reference `"acreditado"` or the now-missing `chequesAcreditado` field) — that's expected, later tasks fix those. Confirm there are **no** errors inside `supabase/schema.sql` (not a TS file), `web/lib/types.ts`, `web/lib/data.ts`, or `web/lib/seed.ts` themselves.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql web/lib/types.ts web/lib/data.ts web/lib/seed.ts
git commit -m "feat: add cesion fields to Cheque, drop acreditado from ChequeEstado"
```

---

### Task 2: `calc.ts` — cesión event, drop acreditado, reshape `chequesResumen`

**Files:**
- Modify: `web/lib/calc.ts`
- Modify: `web/lib/calc.test.ts`

**Interfaces:**
- Produces: `chequesResumen(state)` now returns `{ totalCartera, totalDepositado, totalCedido, cantidadRechazados }` (was `{ totalCartera, totalDepositadoPendiente, acreditadoMes, cantidadRechazados }`) and drops its `hoy` parameter entirely (it was only used to compute the now-removed `acreditadoMes`). Task 4 (`ChequeSummaryCard`) consumes this exact shape.
- Produces: `chequesMonth(state, monthKey)` now returns `{ recibidos, salida, rechazados }` (drops `acreditado`). `buildCashflow` (same file) stops setting `chequesAcreditado` on each row — Task 3 removes the field from the type and its last two readers.

- [ ] **Step 1: Write the failing tests**

In `web/lib/calc.test.ts`, add `chequesResumen` to the import from `"./calc"` (alongside the existing `chequesCarteraAntes, chequesMonth, buildCashflow`).

Replace the cheques array inside `makeFixture()`:
```ts
    cheques: [
      // Recibido y aún en cartera dentro del rango visible.
      cheque({ id: "c1", importe: 400, fechaRecepcion: "2025-01-05", estado: "en_cartera" }),
      // Recibido ANTES del rango (2024-12), depositado en enero: prueba chequesCarteraAntes.
      cheque({ id: "c2", importe: 100, fechaRecepcion: "2024-12-20", estado: "depositado", fechaDeposito: "2025-01-10" }),
      // Recibido y depositado en enero (mismo mes que la salida).
      cheque({ id: "c3", importe: 50, fechaRecepcion: "2025-01-02", estado: "depositado", fechaDeposito: "2025-01-03" }),
      // Recibido antes del rango, depositado en enero, rechazado (vuelve a cartera) en febrero.
      cheque({ id: "c4", importe: 70, fechaRecepcion: "2024-12-01", estado: "en_cartera", fechaDeposito: "2025-01-15", fechaRechazo: "2025-02-10" }),
      // Recibido y cedido en enero: prueba la rama nueva de chequeEventos para "cesionado".
      cheque({ id: "c5", importe: 30, fechaRecepcion: "2025-01-08", estado: "cesionado", fechaCesion: "2025-01-20" }),
    ],
```

Update the `cheque()` helper's defaults (it currently defaults `fechaDeposito/fechaAcreditacion/fechaRechazo/fechaEndoso` to `""`) to also default the three new `Cheque` fields:
```ts
function cheque(c: Partial<Cheque> & Pick<Cheque, "id" | "importe" | "fechaRecepcion" | "estado">): Cheque {
  return {
    cliente: "", numero: "", bancoEmisor: "", bancoDestino: "", fechaPago: "",
    fechaDeposito: "", fechaAcreditacion: "", fechaRechazo: "", fechaEndoso: "",
    fechaCesion: "", endosadoA: "", movementId: null,
    ...c,
  };
}
```

Update the `chequesMonth` test:
```ts
describe("chequesMonth", () => {
  it("calcula recibidos/salida/rechazados para enero", () => {
    // recibidos: c1 (400) + c3 (50) + c5 (30) = 480
    // salida: c2 (100, depositado 01-10) + c3 (50, depositado 01-03) + c4 (70, depositado 01-15) + c5 (30, cedido 01-20) = 250
    expect(chequesMonth(makeFixture(), "2025-01")).toEqual({ recibidos: 480, salida: 250, rechazados: 0 });
  });

  it("calcula recibidos/salida/rechazados para febrero", () => {
    // rechazados: c4 vuelve a cartera (70).
    expect(chequesMonth(makeFixture(), "2025-02")).toEqual({ recibidos: 0, salida: 0, rechazados: 70 });
  });
});
```

In the `buildCashflow` test, remove these two lines entirely (the field no longer exists):
```ts
    expect(jan.chequesAcreditado).toBe(0);
```
```ts
    expect(feb.chequesAcreditado).toBe(50); // c3 confirmado en febrero
```
And update the two `chequesRecibidos`/`chequesSalida` lines for `jan` to the new totals (everything else in that test — `chequesSaldoInicial`, `chequesSaldoFinal`, `chequesRechazados`, and all the non-cheque fields — is unchanged, since the fixture edit above nets to the same running balances):
```ts
    expect(jan.chequesRecibidos).toBe(480); // c1 (400) + c3 (50) + c5 (30)
    expect(jan.chequesSalida).toBe(250); // c2 (100) + c3 (50) + c4 (70) + c5 (30)
```

Add a new test block after the `buildCashflow` describe block:
```ts
describe("chequesResumen", () => {
  it("totaliza en cartera, depositado, cedido y cantidad de rechazados", () => {
    const r = chequesResumen(makeFixture());
    // en_cartera: c1 (400) + c4 (70, vuelto a cartera por rechazo) = 470
    // depositado: c2 (100) + c3 (50) = 150
    // cesionado: c5 (30)
    // rechazados: solo c4 está en_cartera con fechaRechazo cargado
    expect(r).toEqual({ totalCartera: 470, totalDepositado: 150, totalCedido: 30, cantidadRechazados: 1 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run lib/calc.test.ts`
Expected: FAIL — TypeScript will refuse to compile the fixture (`estado: "cesionado"` and `estado: "acreditado"`-adjacent code don't match the current `ChequeEstado`/`Cheque` type yet, since `web/lib/calc.ts` hasn't been updated), and/or the `chequesMonth`/`buildCashflow`/`chequesResumen` assertions fail against the current implementation. Confirm the failure is about the cheque-related code, not something else.

- [ ] **Step 3: Implement in `web/lib/calc.ts`**

Replace `chequeEventos`:
```ts
function chequeEventos(c: CashflowState["cheques"][number]): ChequeEvento[] {
  const eventos: ChequeEvento[] = [];
  if (c.fechaRecepcion) eventos.push({ fecha: c.fechaRecepcion, tipo: "recibido", importe: c.importe });
  if (c.estado === "endosado" && c.fechaEndoso) {
    eventos.push({ fecha: c.fechaEndoso, tipo: "salida", importe: c.importe });
  } else if (c.estado === "cesionado" && c.fechaCesion) {
    eventos.push({ fecha: c.fechaCesion, tipo: "salida", importe: c.importe });
  } else if (c.estado === "depositado" && c.fechaDeposito) {
    eventos.push({ fecha: c.fechaDeposito, tipo: "salida", importe: c.importe });
  } else if (c.estado === "en_cartera" && c.fechaRechazo) {
    if (c.fechaDeposito) eventos.push({ fecha: c.fechaDeposito, tipo: "salida", importe: c.importe });
    eventos.push({ fecha: c.fechaRechazo, tipo: "rechazo", importe: c.importe });
  }
  return eventos;
}
```

Replace `chequesResumen`:
```ts
export function chequesResumen(state: CashflowState) {
  const enCartera = state.cheques.filter((c) => c.estado === "en_cartera");
  const depositado = state.cheques.filter((c) => c.estado === "depositado");
  const cesionado = state.cheques.filter((c) => c.estado === "cesionado");
  return {
    totalCartera: enCartera.reduce((a, c) => a + c.importe, 0),
    totalDepositado: depositado.reduce((a, c) => a + c.importe, 0),
    totalCedido: cesionado.reduce((a, c) => a + c.importe, 0),
    cantidadRechazados: enCartera.filter((c) => c.fechaRechazo).length,
  };
}
```

Replace `chequesMonth`:
```ts
export function chequesMonth(state: CashflowState, monthKey: string) {
  const eventosMes = state.cheques.flatMap(chequeEventos).filter((e) => monthKeyFromISO(e.fecha) === monthKey);
  const recibidos = eventosMes.filter((e) => e.tipo === "recibido").reduce((a, e) => a + e.importe, 0);
  const salida = eventosMes.filter((e) => e.tipo === "salida").reduce((a, e) => a + e.importe, 0);
  const rechazados = eventosMes.filter((e) => e.tipo === "rechazo").reduce((a, e) => a + e.importe, 0);
  return { recibidos, salida, rechazados };
}
```

In `buildCashflow`, remove the line `chequesAcreditado: cheques.acreditado,` from the object literal returned inside `rows.map(...)` (the `cheques` local variable there is still `chequesMonth(state, mk)`, just without an `.acreditado` field to read anymore).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run lib/calc.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add web/lib/calc.ts web/lib/calc.test.ts
git commit -m "feat: add cesionado event and drop acreditado from cheque calculations"
```

---

### Task 3: Remove `chequesAcreditado` from `CashflowRow` and the Cashflow page

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/app/cashflow/page.tsx`

**Interfaces:**
- Consumes: Task 1 already removed the `chequesAcreditado` field declaration from `CashflowRow`; Task 2 already stopped `buildCashflow` from setting it. This task removes the last two *readers* of that now-nonexistent field.

- [ ] **Step 1: Remove the Excel export row**

In `web/app/cashflow/page.tsx`, delete this line from `exportExcel` (it's right after the "Saldo Final Cartera" row and before "Saldo cierre mes Banco + FCI"):
```ts
    row("Acreditado (informativo)", (r) => r.chequesAcreditado);
```

- [ ] **Step 2: Remove the on-screen row**

In the same file, delete this `CfRow` (right after "Saldo Final Cartera" and before "Saldo cierre mes Banco + FCI" in the JSX table body):
```tsx
            <CfRow hideEmpty={hideEmpty} label="Acreditado (informativo)" rows={rows} get={(r) => r.chequesAcreditado} opts={{ blankZero: true, dim: true }} />
```

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no more errors in `web/app/cashflow/page.tsx` or `web/lib/types.ts`. Errors may remain in `web/app/cheques/page.tsx`, `web/components/cheques/ChequeEditor.tsx`, `web/lib/calc.test.ts` — those are fixed by later tasks; confirm this file specifically is now clean.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/app/cashflow/page.tsx
git commit -m "chore: remove Acreditado (informativo) row from Cashflow"
```

---

### Task 4: `ChequeSummaryCard` — new tile shape

**Files:**
- Modify: `web/components/cheques/ChequeSummaryCard.tsx`

**Interfaces:**
- Consumes: `chequesResumen()`'s new return shape from Task 2: `{ totalCartera, totalDepositado, totalCedido, cantidadRechazados }`.

- [ ] **Step 1: Replace the component**

```tsx
import { money } from "@/lib/format";

export function ChequeSummaryCard({
  resumen,
}: {
  resumen: { totalCartera: number; totalDepositado: number; totalCedido: number; cantidadRechazados: number };
}) {
  const items: { k: string; v: string; cls?: string }[] = [
    { k: "En cartera", v: money(resumen.totalCartera) },
    { k: "Depositado", v: money(resumen.totalDepositado) },
    { k: "Cedido", v: money(resumen.totalCedido), cls: "pos" },
    { k: "En cartera por rechazo", v: String(resumen.cantidadRechazados) },
  ];

  return (
    <div className="sumcard">
      <div className="sumcard-grid">
        {items.map((it) => (
          <div className="sumcard-item" key={it.k}>
            <span className="sumcard-k">{it.k}</span>
            <span className={"sumcard-v " + (it.cls || "")}>{it.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors inside `web/components/cheques/ChequeSummaryCard.tsx` itself. `web/app/cheques/page.tsx` still has errors from Task 1's `ChequeEstado` change — that's Task 6, not this one.

- [ ] **Step 3: Commit**

```bash
git add web/components/cheques/ChequeSummaryCard.tsx
git commit -m "feat: show cedido instead of acreditado in the cheques summary card"
```

---

### Task 5: `ChequeActionModal` — configurable extra field

**Files:**
- Modify: `web/components/cheques/ChequeActionModal.tsx`

**Interfaces:**
- Produces: a new exported type `ChequeActionExtra = { type: "banco"; label: string; initial: BankId | "" } | { type: "texto"; label: string; placeholder?: string }`. `ChequeActionModal` gains an optional `extra?: ChequeActionExtra` prop, and `onConfirm`'s signature changes from `(fecha: string) => void` to `(fecha: string, extraValue: string) => void` — `extraValue` is the chosen bank id (or `""`) for `"banco"`, or the typed text for `"texto"`, or `""` when `extra` is omitted. Task 6 supplies `extra` per action and reads `extraValue` in `confirmAccion`.

- [ ] **Step 1: Rewrite the component**

```tsx
"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/ui";
import { BANKS } from "@/lib/constants";
import type { BankId } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ChequeActionExtra =
  | { type: "banco"; label: string; initial: BankId | "" }
  | { type: "texto"; label: string; placeholder?: string };

export function ChequeActionModal({
  title,
  dateLabel,
  confirmLabel,
  extra,
  onConfirm,
  onClose,
}: {
  title: string;
  dateLabel: string;
  confirmLabel: string;
  extra?: ChequeActionExtra;
  onConfirm: (fecha: string, extraValue: string) => void;
  onClose: () => void;
}) {
  const [fecha, setFecha] = useState(today());
  const [extraValue, setExtraValue] = useState(extra && extra.type === "banco" ? extra.initial : "");

  const canConfirm = !!fecha && (!extra || !!extraValue.trim());

  return (
    <Modal
      title={title}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onConfirm(fecha, extraValue)} disabled={!canConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <Field label={dateLabel} wide>
        <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
      </Field>
      {extra && extra.type === "banco" && (
        <Field label={extra.label} wide>
          <select className="inp" value={extraValue} onChange={(e) => setExtraValue(e.target.value)}>
            <option value="">Elegir banco…</option>
            {BANKS.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
      )}
      {extra && extra.type === "texto" && (
        <Field label={extra.label} wide>
          <input className="inp" value={extraValue} onChange={(e) => setExtraValue(e.target.value)} placeholder={extra.placeholder} />
        </Field>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: `web/app/cheques/page.tsx` now shows a new error where it renders `<ChequeActionModal {...ACCION_CFG[accion.accion]} onConfirm={confirmAccion} .../>` — `confirmAccion` there still has the old one-argument signature. That's expected; Task 6 fixes it. Confirm no error is reported *inside* `ChequeActionModal.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add web/components/cheques/ChequeActionModal.tsx
git commit -m "feat: support a bank or text field in ChequeActionModal"
```

---

### Task 6: `ChequeEditor` defaults and the cesionado chip color

**Files:**
- Modify: `web/components/cheques/ChequeEditor.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Produces: new cheques created via `ChequeEditor` now include `fechaCesion: "", endosadoA: "", movementId: null` alongside the existing blank state fields — required so the object satisfies the `Cheque` type from Task 1.
- Produces: `.chip--cheque-cesionado` CSS class (reuses the color freed up by removing `.chip--cheque-acreditado`).

- [ ] **Step 1: Extend the new-cheque defaults**

In `web/components/cheques/ChequeEditor.tsx`, inside `save()`, replace the `else` branch (the one building a brand-new cheque) with:
```ts
    } else {
      onSave({
        ...f,
        estado: "en_cartera",
        fechaDeposito: "",
        fechaAcreditacion: "",
        fechaRechazo: "",
        fechaEndoso: "",
        fechaCesion: "",
        endosadoA: "",
        movementId: null,
      });
    }
```

- [ ] **Step 2: Swap the chip CSS class**

In `web/app/globals.css`, replace this line:
```css
.chip--cheque-acreditado{background:#e9f7ef;color:#15803d;}
```
with:
```css
.chip--cheque-cesionado{background:#e9f7ef;color:#15803d;}
```
(Same colors — visually "confirmed funds", same meaning as the old Acreditado chip. Keep it in the same position among the `.chip--cheque-*` rules.)

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors inside `ChequeEditor.tsx` itself (errors remain in `web/app/cheques/page.tsx` — Task 7 fixes those).

- [ ] **Step 4: Commit**

```bash
git add web/components/cheques/ChequeEditor.tsx web/app/globals.css
git commit -m "feat: default new-cheque cesion fields, add cesionado chip color"
```

---

### Task 7: `CashflowContext.addMovement` return type + wire everything in `app/cheques/page.tsx`

**Files:**
- Modify: `web/context/CashflowContext.tsx`
- Modify: `web/app/cheques/page.tsx`

**Interfaces:**
- Consumes: `ChequeActionModal`'s `extra`/`onConfirm(fecha, extraValue)` from Task 5; `ChequeSummaryCard`'s new resumen shape from Task 4; `Cheque.fechaCesion/endosadoA/movementId` and `ChequeEstado` from Task 1.
- Produces: `addMovement` now returns `Promise<Movement>` instead of `Promise<void>` — every other existing caller (`MovEditor` via `movimientos/page.tsx`'s `saveMov`) already ignores the return value, so this is a non-breaking widening.

- [ ] **Step 1: Widen `addMovement`'s return type**

In `web/context/CashflowContext.tsx`, update the interface:
```ts
  addMovement: (m: Omit<Movement, "id">) => Promise<Movement>;
```
And the implementation:
```ts
  const addMovement = async (m: Omit<Movement, "id">) => {
    const created = await insertMovement(m);
    setState((s) => (s ? { ...s, movements: [...s.movements, created] } : s));
    return created;
  };
```

- [ ] **Step 2: Rewrite `web/app/cheques/page.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { chequesResumen } from "@/lib/calc";
import { money } from "@/lib/format";
import { BANKS } from "@/lib/constants";
import { downloadXlsx, exDate, type Cell } from "@/lib/export";
import type { BankId, Cheque, ChequeEstado, Movement } from "@/lib/types";
import { Money, Confirm } from "@/components/ui";
import { ChequeEditor } from "@/components/cheques/ChequeEditor";
import { ChequeActionModal, type ChequeActionExtra } from "@/components/cheques/ChequeActionModal";
import { ChequeSummaryCard } from "@/components/cheques/ChequeSummaryCard";

type Accion = "depositar" | "endosar" | "cesionar" | "rechazar";

const ESTADO_LABEL: Record<ChequeEstado, string> = {
  en_cartera: "En cartera",
  depositado: "Depositado",
  endosado: "Endosado",
  cesionado: "Cesionado",
};

const ACCION_CFG: Record<Accion, { title: string; dateLabel: string; confirmLabel: string; extra?: ChequeActionExtra }> = {
  depositar: {
    title: "Depositar cheque",
    dateLabel: "Fecha de depósito",
    confirmLabel: "Depositar",
    extra: { type: "banco", label: "Banco propio", initial: "" },
  },
  endosar: {
    title: "Endosar cheque",
    dateLabel: "Fecha de endoso",
    confirmLabel: "Endosar",
    extra: { type: "texto", label: "Endosado a", placeholder: "Nombre del beneficiario" },
  },
  cesionar: {
    title: "Ceder cheque",
    dateLabel: "Fecha de cesión",
    confirmLabel: "Ceder",
    extra: { type: "banco", label: "Banco propio", initial: "" },
  },
  rechazar: { title: "Rechazar cheque", dateLabel: "Fecha de rechazo", confirmLabel: "Rechazar" },
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function bancoNombre(id: string) {
  return BANKS.find((b) => b.id === id)?.short || "";
}

export default function ChequesPage() {
  const { state, addCheque, updateCheque, deleteCheque, addMovement, updateMovement, deleteMovement } = useCashflow();
  const [filtro, setFiltro] = useState<ChequeEstado | "todos">("todos");
  const [editing, setEditing] = useState<Cheque | "new" | null>(null);
  const [accion, setAccion] = useState<{ cheque: Cheque; accion: Accion } | null>(null);
  const [confirm, setConfirm] = useState<Cheque | null>(null);

  const resumen = useMemo(() => (state ? chequesResumen(state) : null), [state]);

  const rows = useMemo(() => {
    if (!state) return [];
    const filtered = filtro === "todos" ? state.cheques : state.cheques.filter((c) => c.estado === filtro);
    return [...filtered].sort((a, b) => (a.fechaRecepcion < b.fechaRecepcion ? -1 : a.fechaRecepcion > b.fechaRecepcion ? 1 : 0));
  }, [state, filtro]);

  if (!state || !resumen) return null;

  const saveCheque = async (c: Cheque | Omit<Cheque, "id">) => {
    try {
      if ("id" in c) {
        await updateCheque(c);
        if (c.movementId) {
          const mv = state.movements.find((m) => m.id === c.movementId);
          if (mv) {
            await updateMovement({
              ...mv,
              bank: c.bancoDestino || mv.bank,
              proveedor: c.cliente,
              cheque: c.numero,
              credito: c.importe,
              descripcion: `Cheque ${c.numero || c.cliente}`,
            });
          }
        }
      } else {
        await addCheque(c);
      }
      setEditing(null);
    } catch (e) {
      alert("No se pudo guardar el cheque: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delCheque = async (id: string) => {
    try {
      const c = state.cheques.find((x) => x.id === id);
      if (c?.movementId) await deleteMovement(c.movementId);
      await deleteCheque(id);
      setConfirm(null);
    } catch (e) {
      alert("No se pudo eliminar el cheque: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const confirmAccion = async (fecha: string, extraValue: string) => {
    if (!accion) return;
    const { cheque, accion: a } = accion;
    try {
      if (a === "depositar" || a === "cesionar") {
        const bank = extraValue as BankId;
        const movement: Omit<Movement, "id"> = {
          bank,
          descripcion: `Cheque ${cheque.numero || cheque.cliente}`,
          proveedor: cheque.cliente,
          fechaEmision: "",
          fechaPago: fecha,
          cheque: cheque.numero,
          credito: cheque.importe,
          debito: 0,
          grupo: "Ingresos",
        };
        const created = await addMovement(movement);
        const patch: Partial<Cheque> =
          a === "depositar"
            ? { estado: "depositado", fechaDeposito: fecha, bancoDestino: bank, movementId: created.id }
            : { estado: "cesionado", fechaCesion: fecha, bancoDestino: bank, movementId: created.id };
        await updateCheque({ ...cheque, ...patch });
      } else if (a === "endosar") {
        await updateCheque({ ...cheque, estado: "endosado", fechaEndoso: fecha, endosadoA: extraValue });
      } else {
        if (cheque.movementId) await deleteMovement(cheque.movementId);
        await updateCheque({ ...cheque, estado: "en_cartera", fechaRechazo: fecha, movementId: null });
      }
    } catch (e) {
      alert("No se pudo actualizar el cheque: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    setAccion(null);
  };

  const exportExcel = () => {
    const header: Cell[] = ["Cliente", "N° cheque", "Banco emisor", "Banco destino", "Importe", "F. recepción", "F. pago", "Estado", "F. depósito", "F. rechazo", "F. endoso", "Endosado a", "F. cesión"];
    const aoa: Cell[][] = [header];
    rows.forEach((c) => {
      aoa.push([
        c.cliente, c.numero, c.bancoEmisor, bancoNombre(c.bancoDestino), c.importe,
        exDate(c.fechaRecepcion), exDate(c.fechaPago), ESTADO_LABEL[c.estado],
        exDate(c.fechaDeposito), exDate(c.fechaRechazo), exDate(c.fechaEndoso), c.endosadoA, exDate(c.fechaCesion),
      ]);
    });
    downloadXlsx(`Cheques_${filtro}`, [{ name: "Cheques", aoa }]);
  };

  const accionExtra: ChequeActionExtra | undefined =
    accion && ACCION_CFG[accion.accion].extra?.type === "banco"
      ? { type: "banco", label: "Banco propio", initial: accion.cheque.bancoDestino }
      : accion
      ? ACCION_CFG[accion.accion].extra
      : undefined;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cheques de terceros</h1>
          <p className="view-sub">Ingreso y seguimiento de cheques recibidos · se resumen en el Cashflow.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
          <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo cheque</button>
        </div>
      </div>

      <ChequeSummaryCard resumen={resumen} />

      <div className="bank-tabs">
        <button className={"bank-tab" + (filtro === "todos" ? " active" : "")} onClick={() => setFiltro("todos")}>Todos</button>
        {(Object.keys(ESTADO_LABEL) as ChequeEstado[]).map((e) => (
          <button key={e} className={"bank-tab" + (filtro === e ? " active" : "")} onClick={() => setFiltro(e)}>
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="grid mov-table">
          <thead>
            <tr>
              <th className="c-prov">Cliente</th>
              <th className="c-chk">N° cheque</th>
              <th className="c-desc">Banco emisor</th>
              <th className="c-desc">Banco destino</th>
              <th className="c-num">Importe</th>
              <th className="c-date">F. recepción</th>
              <th className="c-date">F. pago</th>
              <th className="c-grp">Estado</th>
              <th className="c-prov">Endosado a</th>
              <th className="c-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="row">
                <td className="c-prov">{c.cliente}</td>
                <td className="c-chk">{c.numero}</td>
                <td className="c-desc">{c.bancoEmisor}</td>
                <td className="c-desc">{bancoNombre(c.bancoDestino)}</td>
                <td className="c-num"><Money v={c.importe} bold /></td>
                <td className="c-date">{fmtDate(c.fechaRecepcion)}</td>
                <td className="c-date">{fmtDate(c.fechaPago)}</td>
                <td className="c-grp">
                  <span className={"chip chip--cheque-" + c.estado}>{ESTADO_LABEL[c.estado]}</span>
                </td>
                <td className="c-prov">{c.endosadoA}</td>
                <td className="c-act">
                  {c.estado === "en_cartera" && (
                    <>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "depositar" })}>Depositar</button>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "endosar" })}>Endosar</button>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "cesionar" })}>Ceder</button>
                    </>
                  )}
                  {c.estado === "depositado" && (
                    <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "rechazar" })}>Rechazar</button>
                  )}
                  <button className="rowbtn" title="Editar" onClick={() => setEditing(c)}>✎</button>
                  <button className="rowbtn rowbtn--del" title="Eliminar" onClick={() => setConfirm(c)}>🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="empty">Sin cheques para este filtro. Agregá el primero con “+ Nuevo cheque”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ChequeEditor
          initial={editing === "new" ? null : editing}
          onSave={saveCheque}
          onClose={() => setEditing(null)}
        />
      )}
      {accion && (
        <ChequeActionModal
          {...ACCION_CFG[accion.accion]}
          extra={accionExtra}
          onConfirm={confirmAccion}
          onClose={() => setAccion(null)}
        />
      )}
      {confirm && (
        <Confirm
          message={`¿Eliminar el cheque de “${confirm.cliente}” por ${money(confirm.importe)}?`}
          onYes={() => delCheque(confirm.id)}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
```

Note on `accionExtra`: `ACCION_CFG`'s own `extra.initial` for `"depositar"`/`"cesionar"` is always `""` (a static config object can't know which cheque is being acted on) — `accionExtra` recomputes it per-open-modal using `accion.cheque.bancoDestino`, so the bank picker is pre-filled when the cheque already had one set from `ChequeEditor`. For `"endosar"`/`"rechazar"` it just passes through `ACCION_CFG[accion.accion].extra` unchanged (text field / no extra field).

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors anywhere in the project.

- [ ] **Step 4: Run the full lib test suite**

Run: `cd web && npx vitest run lib/calc.test.ts lib/format.test.ts lib/dates.test.ts lib/seed.test.ts lib/import.test.ts`
Expected: PASS (these don't touch Supabase; `lib/data.test.ts` is intentionally excluded — it requires live credentials and asserts exact historical row counts that already drift from real usage, unrelated to this feature).

- [ ] **Step 5: Commit**

```bash
git add web/context/CashflowContext.tsx web/app/cheques/page.tsx
git commit -m "feat: link Depositar/Ceder to a bank movement, capture Endosado a"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only — no code changes).

- [ ] **Step 1: Start the dev server**

Run: `cd web && NEXT_TELEMETRY_DISABLED=1 npx next dev --webpack` (background) and open `http://localhost:3000/cheques`.

- [ ] **Step 2: Verify the summary card and filter tabs**

Confirm the summary card shows exactly 4 tiles: "En cartera", "Depositado", "Cedido", "En cartera por rechazo" — no "Acreditado este mes". Confirm the filter tabs are: Todos, En cartera, Depositado, Endosado, Cesionado — no "Acreditado".

- [ ] **Step 3: Create a cheque and Depositar it**

Click "+ Nuevo cheque", fill Cliente + Fecha de recepción + Importe (e.g. 1000), Banco propio destino = Galicia, save. On the new `en_cartera` row, click "Depositar". Verify the modal shows a date field AND a bank selector pre-filled with "Banco Galicia" (since `bancoDestino` was already set). Confirm.
Expected: the cheque's estado becomes "Depositado" with the chip in the amber `chip--cheque-depositado` color; only a "Rechazar" button remains on that row (no "Acreditar").

- [ ] **Step 4: Verify the linked movement was created**

Go to `/movimientos`, Galicia tab. Verify a new row exists with grupo "Ingresos", crédito = the cheque's importe, and the cheque's número in the Cheque column.

- [ ] **Step 5: Edit the cheque, verify the movement syncs**

Back in `/cheques`, edit that same cheque (✎) and change the Importe to a different value. Save. Go back to `/movimientos` and confirm the linked row's Crédito updated to match — not a second/duplicate row.

- [ ] **Step 6: Rechazar it, verify the movement disappears**

Back in `/cheques`, click "Rechazar" on that cheque, confirm. Verify the cheque returns to `en_cartera` (chip indigo). Go to `/movimientos` and confirm that linked row is gone (not just archived — actually deleted).

- [ ] **Step 7: Ceder a cheque**

On the same (now `en_cartera` again) cheque, click "Ceder". Verify the modal asks for date + bank (this time not pre-filled, since the Rechazar step cleared `movementId` but the cheque's `bancoDestino` — check: it should still show Galicia pre-filled from the original edit, since `bancoDestino` itself was never cleared by Rechazar). Confirm. Verify estado becomes "Cesionado" (green chip), no action buttons remain on that row, and a new "Ingresos" movement appears in `/movimientos` for the chosen bank.

- [ ] **Step 8: Endosar a different cheque**

Create a second test cheque. Click "Endosar". Verify the modal asks for date + a text field "Endosado a" (not a bank picker), and the confirm button stays disabled until you type something. Fill it, confirm. Verify the cheque's row now shows that text in the new "Endosado a" column, estado is "Endosado", and **no** new movement was created in `/movimientos` for it.

- [ ] **Step 9: Delete a cheque with a linked movement**

Delete the "Cesionado" cheque from Step 7 (🗑, confirm). Go to `/movimientos` and verify its linked movement is gone too.

- [ ] **Step 10: Clean up test data**

Delete every cheque created during this verification pass (and confirm no orphaned test movements remain in `/movimientos` on either bank tab) so the real data isn't left polluted with test rows.
