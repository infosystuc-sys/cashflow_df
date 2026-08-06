# Transferencia a banco propio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the user creates a movement tagged "Transferencia a banco propio" in one bank tab, automatically create and permanently link the mirrored movement in the other bank (Galicia ⇄ Nación), and keep edits/deletes in sync between the two.

**Architecture:** All work happens in `web/` (Next.js App Router, client-side Supabase via `supabase-js`, no server routes). A new nullable `transfer_id` column on `movements` groups two linked rows. `MovEditor.tsx` gains a two-step "preview then confirm" flow for creating a linked pair, and locks the Agrupación field when editing an already-linked row. `app/movimientos/page.tsx` owns the logic to find a movement's counterpart (by `transferId`) and propagate edits/deletes to it via the existing `updateMovement`/`deleteMovement`/`addMovements` context methods — no new context methods needed.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript (strict), Supabase (`supabase-js`, PostgREST, no RLS), Vitest for `lib/**/*.test.ts`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-06-transferencia-banco-propio-design.md`. Follow it exactly; this plan is its task breakdown.
- The DB migration (`alter table movements add column transfer_id uuid;`) has **already been run** by the user against the live Supabase instance. Do not attempt to run it again or via any MCP/CLI.
- New grupo string is exactly `"Transferencia a banco propio"`, exported once as `TRANSFER_OWN_BANK_GROUP` from `web/lib/constants.ts` — never hardcode the literal string anywhere else; import the constant.
- `"Transf entre cuentas"` keeps its exact current behavior everywhere (no replication, own summary line). Do not merge its logic with the new grupo except in the one place the spec calls for (the combined `realMonth` total).
- This codebase has **no component/UI test harness** — `vitest` only runs `lib/**/*.test.ts` (see `web/vitest.config.ts`). Tasks touching `.tsx` files are verified by type-checking (`npx tsc --noEmit`, run from `web/`) plus manual verification in the dev server (Task 8), matching how every other feature in this repo was built (`git log`, `docs/superpowers/specs/*`) — do not invent a new test framework or write component tests.
- `web/lib/data.test.ts`'s `fetchAllData (live Supabase)` test hits the real production database and asserts exact historical row counts; it may already be failing/skipped for reasons unrelated to this feature (real usage has diverged from the original seed). Do not "fix" it as part of this work — out of scope.
- `web/lib/import.ts` (Excel import) is intentionally **not** touched: importing a row with grupo `"Transferencia a banco propio"` inserts a single unlinked row, same as any other grupo today. This is a known, accepted gap (see spec's "Fuera de alcance").
- Keep `web/components/ui/index.tsx`'s `Confirm` component backward-compatible — it's also used by `web/app/cheques/page.tsx`, which must keep rendering exactly as it does today.
- Run all commands from `web/` (e.g. `cd web` first, or prefix each command) unless noted otherwise.

---

### Task 1: `transfer_id` in the data layer

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `web/lib/types.ts`
- Modify: `web/lib/data.ts`

**Interfaces:**
- Produces: `Movement.transferId?: string | null` (optional so existing literals like `seedMovements()`, `calc.test.ts` fixtures, and `import.ts`'s `ParsedRow`-derived inserts keep compiling unchanged — absence means "not linked", same as `null`).
- Produces: `insertMovement`, `insertMovements`, `updateMovement` in `web/lib/data.ts` now read/write `transfer_id` on the `movements` table; `fetchAllData` now returns it on every `Movement`.

- [ ] **Step 1: Update the schema source of truth**

In `supabase/schema.sql`, inside the `create table movements (...)` block, add the new column right after `grupo text not null,`:

```sql
create table movements (
  id uuid primary key default gen_random_uuid(),
  bank text not null check (bank in ('galicia','nacion')),
  descripcion text not null,
  proveedor text not null default '',
  fecha_emision date,
  fecha_pago date not null,
  cheque text not null default '',
  credito numeric not null default 0,
  debito numeric not null default 0,
  grupo text not null,
  transfer_id uuid,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Add `transferId` to the `Movement` type**

In `web/lib/types.ts`, edit the `Movement` interface:

```ts
export interface Movement {
  id: string;
  bank: BankId;
  descripcion: string;
  proveedor: string;
  fechaEmision: string; // 'YYYY-MM-DD' or ''
  fechaPago: string; // 'YYYY-MM-DD'
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
  transferId?: string | null; // shared id between the two legs of a "Transferencia a banco propio"
}
```

- [ ] **Step 3: Read/write `transfer_id` in `web/lib/data.ts`**

Update the `MovementRow` type (add the field):

```ts
type MovementRow = {
  id: string;
  bank: BankId;
  descripcion: string;
  proveedor: string;
  fecha_emision: string | null;
  fecha_pago: string;
  cheque: string;
  credito: number | string;
  debito: number | string;
  grupo: string;
  transfer_id: string | null;
};
```

In `fetchAllData`, add `transferId` to the mapped `Movement`:

```ts
const movements: Movement[] = movementsRows.map((row) => ({
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
  transferId: row.transfer_id ?? null,
}));
```

In `insertMovement`, add `transfer_id: m.transferId ?? null,` to the `.insert({...})` payload, and `transferId: data.transfer_id ?? null,` to the returned object:

```ts
export async function insertMovement(m: Omit<Movement, "id">): Promise<Movement> {
  const { data, error } = await supabase
    .from("movements")
    .insert({
      bank: m.bank,
      descripcion: m.descripcion,
      proveedor: m.proveedor,
      fecha_emision: m.fechaEmision || null,
      fecha_pago: m.fechaPago,
      cheque: m.cheque,
      credito: m.credito,
      debito: m.debito,
      grupo: m.grupo,
      transfer_id: m.transferId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    bank: data.bank,
    descripcion: data.descripcion,
    proveedor: data.proveedor,
    fechaEmision: data.fecha_emision ?? "",
    fechaPago: data.fecha_pago,
    cheque: data.cheque,
    credito: Number(data.credito),
    debito: Number(data.debito),
    grupo: data.grupo,
    transferId: data.transfer_id ?? null,
  };
}
```

Do the same for `insertMovements` (both the mapped insert payload and the mapped return value):

```ts
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
        transfer_id: m.transferId ?? null,
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
    transferId: row.transfer_id ?? null,
  }));
}
```

And add `transfer_id: m.transferId ?? null,` to `updateMovement`'s `.update({...})` payload:

```ts
export async function updateMovement(m: Movement): Promise<void> {
  const { error } = await supabase
    .from("movements")
    .update({
      bank: m.bank,
      descripcion: m.descripcion,
      proveedor: m.proveedor,
      fecha_emision: m.fechaEmision || null,
      fecha_pago: m.fechaPago,
      cheque: m.cheque,
      credito: m.credito,
      debito: m.debito,
      grupo: m.grupo,
      transfer_id: m.transferId ?? null,
    })
    .eq("id", m.id);
  if (error) throw error;
}
```

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors (the field is optional, so every existing call site that omits it — `seed.ts`, `calc.test.ts` fixtures, `import.ts` — still compiles).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql web/lib/types.ts web/lib/data.ts
git commit -m "feat: add transfer_id to movements for linked bank transfers"
```

---

### Task 2: New Agrupación value, chip color

**Files:**
- Modify: `web/lib/constants.ts`
- Modify: `web/components/ui/index.tsx`
- Modify: `web/app/globals.css`

**Interfaces:**
- Produces: `TRANSFER_OWN_BANK_GROUP` (exported string constant, value `"Transferencia a banco propio"`) from `web/lib/constants.ts`. Every later task that needs to compare/set this grupo imports this constant.
- Produces: `GROUPS` now includes `TRANSFER_OWN_BANK_GROUP` right after `"Transf entre cuentas"`.

- [ ] **Step 1: Add the constant and extend `GROUPS`**

In `web/lib/constants.ts`:

```ts
export const TRANSFER_OWN_BANK_GROUP = "Transferencia a banco propio";

export const GROUPS = [
  "Saldo Inicial",
  "Ingresos",
  "Pagos",
  "Transf entre cuentas",
  TRANSFER_OWN_BANK_GROUP,
  "Ingreso por Venta de USD",
  "Suscripciones",
  "Rescates",
];
```

- [ ] **Step 2: Add a chip color**

In `web/app/globals.css`, add a new rule right after `.chip--transf` (currently line 186):

```css
.chip--transf-propio{background:#e0f2fe;color:#0369a1;}
```

- [ ] **Step 3: Map the new grupo to that chip class**

In `web/components/ui/index.tsx`, add this import at the top of the file alongside the existing imports:

```ts
import { TRANSFER_OWN_BANK_GROUP } from "@/lib/constants";
```

Then update `GROUP_CHIP_CLASS` (computed key, since the string has spaces):

```ts
const GROUP_CHIP_CLASS: Record<string, string> = {
  Ingresos: "chip--in",
  Pagos: "chip--out",
  "Transf entre cuentas": "chip--transf",
  [TRANSFER_OWN_BANK_GROUP]: "chip--transf-propio",
  "Ingreso por Venta de USD": "chip--usd",
  "Saldo Inicial": "chip--init",
  Suscripciones: "chip--fci",
  Rescates: "chip--fci",
};
```

- [ ] **Step 4: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/lib/constants.ts web/components/ui/index.tsx web/app/globals.css
git commit -m "feat: add Transferencia a banco propio grupo and chip color"
```

---

### Task 3: `calc.ts` — per-bank and combined totals

**Files:**
- Modify: `web/lib/calc.ts`
- Modify: `web/lib/calc.test.ts`

**Interfaces:**
- Consumes: `TRANSFER_OWN_BANK_GROUP` from `web/lib/constants.ts` (Task 2).
- Produces: `bankSummary()` now returns an extra `transfPropio: number` field (net crédito − débito for `TRANSFER_OWN_BANK_GROUP`, that bank only). Task 4 depends on this field existing on the returned object.
- Produces: `realMonth()`'s `transf` field now includes movements from **both** `"Transf entre cuentas"` and `TRANSFER_OWN_BANK_GROUP` (still a single field, no new key) — consumed unchanged by `buildCashflow()`.

- [ ] **Step 1: Write the failing tests**

In `web/lib/calc.test.ts`, first update the two existing `bankSummary` expectations (they'll now fail because the returned object has an extra key). Change:

```ts
describe("bankSummary", () => {
  it("computes totals and a zero control for galicia", () => {
    const s = bankSummary(makeFixture(), "galicia");
    expect(s).toEqual({ inicial: 1000, ingresos: 300, ventaUSD: 0, pagos: 100, transf: 200, transfPropio: 0, final: 1400, control: 0 });
  });

  it("computes totals and a zero control for nacion", () => {
    const s = bankSummary(makeFixture(), "nacion");
    expect(s).toEqual({ inicial: 500, ingresos: 0, ventaUSD: 0, pagos: 0, transf: -200, transfPropio: 0, final: 300, control: 0 });
  });
});
```

Then add a new fixture and two new `describe` blocks at the end of the file (after the existing `buildCashflow` block):

```ts
function makeTransferFixture(): CashflowState {
  return {
    settings: { saldoInicial: { galicia: 0, nacion: 0 }, rangeStart: "2025-01", rangeEnd: "2025-01" },
    movements: [
      { id: "t1", bank: "galicia", descripcion: "Transferencia interna", proveedor: "", fechaEmision: "", fechaPago: "2025-01-05", cheque: "", credito: 0, debito: 500, grupo: "Transferencia a banco propio", transferId: "tr-1" },
      { id: "t2", bank: "nacion", descripcion: "Transferencia interna", proveedor: "", fechaEmision: "", fechaPago: "2025-01-05", cheque: "", credito: 500, debito: 0, grupo: "Transferencia a banco propio", transferId: "tr-1" },
    ],
    projection: emptyProjection(),
    fci: { saldoInicial: 0, data: {} },
    iva: emptyIva(),
    cheques: [],
  };
}

describe("bankSummary — Transferencia a banco propio", () => {
  it("keeps it in a separate bucket from Transf entre cuentas, per bank", () => {
    const galicia = bankSummary(makeTransferFixture(), "galicia");
    expect(galicia.transf).toBe(0);
    expect(galicia.transfPropio).toBe(-500);
    expect(galicia.final).toBe(-500);
    expect(galicia.control).toBe(0);

    const nacion = bankSummary(makeTransferFixture(), "nacion");
    expect(nacion.transf).toBe(0);
    expect(nacion.transfPropio).toBe(500);
    expect(nacion.final).toBe(500);
    expect(nacion.control).toBe(0);
  });
});

describe("realMonth — Transferencia a banco propio", () => {
  it("counts it together with Transf entre cuentas in the combined total", () => {
    // A single, deliberately unmatched leg (no counterpart in this fixture)
    // isolates whether realMonth's transf bucket picks up this grupo at all —
    // a balanced pair would net to 0 either way and wouldn't catch a missing merge.
    const state: CashflowState = {
      settings: { saldoInicial: { galicia: 0, nacion: 0 }, rangeStart: "2025-01", rangeEnd: "2025-01" },
      movements: [
        { id: "t1", bank: "galicia", descripcion: "Transferencia interna", proveedor: "", fechaEmision: "", fechaPago: "2025-01-05", cheque: "", credito: 500, debito: 0, grupo: "Transferencia a banco propio" },
      ],
      projection: emptyProjection(),
      fci: { saldoInicial: 0, data: {} },
      iva: emptyIva(),
      cheques: [],
    };
    expect(realMonth(state, "2025-01").transf).toBe(500);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd web && npx vitest run lib/calc.test.ts`
Expected: FAIL — the two updated `bankSummary` assertions fail (missing `transfPropio` key on the actual object), and the two new `describe` blocks fail (`transfPropio` is `undefined`, `realMonth`'s `transf` doesn't merge the new grupo yet).

- [ ] **Step 3: Implement in `web/lib/calc.ts`**

Add the import:

```ts
import { PROJ_CONCEPTS, TRANSFER_OWN_BANK_GROUP } from "./constants";
```

Update `bankSummary`:

```ts
export function bankSummary(state: CashflowState, bankId: BankId): BankSummary {
  const rows = state.movements.filter((x) => x.bank === bankId);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    rows.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const inicial = state.settings.saldoInicial[bankId] || 0;
  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf =
    sum((r) => r.grupo === "Transf entre cuentas", "credito") -
    sum((r) => r.grupo === "Transf entre cuentas", "debito");
  const transfPropio =
    sum((r) => r.grupo === TRANSFER_OWN_BANK_GROUP, "credito") -
    sum((r) => r.grupo === TRANSFER_OWN_BANK_GROUP, "debito");
  const final = inicial + ingresos + ventaUSD - pagos + transf + transfPropio;

  const last = bankRows(state, bankId).slice(-1)[0];
  const lastSaldo = last ? last.saldo : inicial;
  const control = final - lastSaldo;

  return { inicial, ingresos, ventaUSD, pagos, transf, transfPropio, final, control };
}
```

Update `realMonth`:

```ts
export function realMonth(state: CashflowState, monthKey: string) {
  const inMonth = state.movements.filter((x) => monthKeyFromISO(x.fechaPago) === monthKey);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    inMonth.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const isTransf = (r: CashflowState["movements"][number]) =>
    r.grupo === "Transf entre cuentas" || r.grupo === TRANSFER_OWN_BANK_GROUP;
  const transf = sum(isTransf, "credito") - sum(isTransf, "debito");

  return { ingresos, ventaUSD, pagos, transf };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd web && npx vitest run lib/calc.test.ts`
Expected: PASS (all tests in the file, including the pre-existing `buildCashflow` one, which is unaffected since its fixture has no `TRANSFER_OWN_BANK_GROUP` movements).

- [ ] **Step 5: Commit**

```bash
git add web/lib/calc.ts web/lib/calc.test.ts
git commit -m "feat: track Transferencia a banco propio in bank and combined totals"
```

---

### Task 4: `BankSummary` type and summary card row

**Files:**
- Modify: `web/lib/types.ts`
- Modify: `web/components/movimientos/BankSummaryCard.tsx`

**Interfaces:**
- Consumes: `bankSummary().transfPropio` (Task 3).
- Produces: `BankSummary.transfPropio: number` on the type, and a new visible "Transferencia a banco propio" row in the summary card.

- [ ] **Step 1: Add the field to the type**

In `web/lib/types.ts`, edit `BankSummary`:

```ts
export interface BankSummary {
  inicial: number;
  ingresos: number;
  ventaUSD: number;
  pagos: number;
  transf: number;
  transfPropio: number;
  final: number;
  control: number;
}
```

- [ ] **Step 2: Add the row to the card**

In `web/components/movimientos/BankSummaryCard.tsx`, add a new item right after `"Transf entre cuentas"`:

```tsx
const items: { k: string; v: number; cls?: string }[] = [
  { k: "Saldo Inicial", v: summary.inicial },
  { k: "Ingresos", v: summary.ingresos, cls: "pos" },
  { k: "Venta de USD", v: summary.ventaUSD, cls: "pos" },
  { k: "Pagos", v: summary.pagos, cls: "neg" },
  { k: "Transf entre cuentas", v: summary.transf },
  { k: "Transferencia a banco propio", v: summary.transfPropio },
];
```

- [ ] **Step 3: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/components/movimientos/BankSummaryCard.tsx
git commit -m "feat: show Transferencia a banco propio in the bank summary card"
```

---

### Task 5: `Confirm` — optional third action and custom confirm label

**Files:**
- Modify: `web/components/ui/index.tsx`

**Interfaces:**
- Produces: `Confirm` gains two optional props, `yesLabel?: string` (default `"Eliminar"`, unchanged) and `extraAction?: { label: string; onClick: () => void }` (renders a third footer button when present). Existing callers (`web/app/cheques/page.tsx`) that pass neither prop render byte-for-byte identical output. Task 7 uses both.

- [ ] **Step 1: Extend the component**

In `web/components/ui/index.tsx`, replace the `Confirm` function:

```tsx
export function Confirm({
  message,
  onYes,
  onNo,
  yesLabel = "Eliminar",
  extraAction,
}: {
  message: string;
  onYes: () => void;
  onNo: () => void;
  yesLabel?: string;
  extraAction?: { label: string; onClick: () => void };
}) {
  return (
    <Modal
      title="Confirmar"
      width={420}
      onClose={onNo}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onNo}>
            Cancelar
          </button>
          {extraAction && (
            <button className="btn btn--ghost" onClick={extraAction.onClick}>
              {extraAction.label}
            </button>
          )}
          <button className="btn btn--danger" onClick={onYes}>
            {yesLabel}
          </button>
        </>
      }
    >
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors — `web/app/cheques/page.tsx`'s existing `<Confirm message=... onYes=... onNo=... />` call still matches the (now-optional-extended) prop type.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/index.tsx
git commit -m "feat: support a third action and custom label on Confirm"
```

---

### Task 6: `MovEditor` — transfer preview flow and linked-edit lock

**Files:**
- Modify: `web/components/movimientos/MovEditor.tsx`

**Interfaces:**
- Consumes: `TRANSFER_OWN_BANK_GROUP` (Task 2), `BANKS` (existing), `Movement`/`BankId` (existing, extended in Task 1).
- Produces: two new props on `MovEditor` — `linkedBankName?: string` (display name of the counterpart's bank, passed by the page only when a real counterpart exists) and `onSaveTransfer: (legA: Omit<Movement, "id">, legB: Omit<Movement, "id">) => void`. Task 7 implements the page-side logic that computes `linkedBankName` and handles `onSaveTransfer`.

- [ ] **Step 1: Rewrite `web/components/movimientos/MovEditor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";
import { BANKS, GROUPS, TRANSFER_OWN_BANK_GROUP } from "@/lib/constants";
import { money } from "@/lib/format";
import type { BankId, Movement } from "@/lib/types";

type MovForm = {
  descripcion: string;
  proveedor: string;
  fechaEmision: string;
  fechaPago: string;
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
};

const BLANK: MovForm = {
  descripcion: "",
  proveedor: "",
  fechaEmision: "",
  fechaPago: "",
  cheque: "",
  credito: 0,
  debito: 0,
  grupo: "Pagos",
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function MovEditor({
  bankId,
  initial,
  linkedBankName,
  onSave,
  onSaveTransfer,
  onClose,
}: {
  bankId: BankId;
  initial: Movement | null;
  linkedBankName?: string;
  onSave: (mov: Movement | Omit<Movement, "id">) => void;
  onSaveTransfer: (legA: Omit<Movement, "id">, legB: Omit<Movement, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<MovForm>(initial ? { ...initial } : { ...BLANK });
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const set = <K extends keyof MovForm>(k: K, v: MovForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const isIn = ["Ingresos", "Ingreso por Venta de USD", "Rescates"].includes(f.grupo);
  const bank = BANKS.find((b) => b.id === bankId)!;
  const otherBank = BANKS.find((b) => b.id !== bankId)!;
  const isLinkedEdit = !!(initial && linkedBankName);
  const isNewTransfer = !initial && f.grupo === TRANSFER_OWN_BANK_GROUP;

  const validate = () => {
    if (!f.descripcion.trim()) {
      alert("La descripción es obligatoria.");
      return false;
    }
    if (!f.fechaPago) {
      alert("La fecha de pago es obligatoria (define el mes del cashflow).");
      return false;
    }
    return true;
  };

  const save = () => {
    if (!validate()) return;

    if (isNewTransfer && !confirmingTransfer) {
      setConfirmingTransfer(true);
      return;
    }

    if (isNewTransfer && confirmingTransfer) {
      const transferId = crypto.randomUUID();
      const legA: Omit<Movement, "id"> = { ...f, bank: bankId, transferId };
      const legB: Omit<Movement, "id"> = {
        ...f,
        bank: otherBank.id,
        credito: f.debito,
        debito: f.credito,
        transferId,
      };
      onSaveTransfer(legA, legB);
      return;
    }

    if (initial) {
      onSave({ ...f, bank: bankId, id: initial.id, transferId: initial.transferId ?? null });
    } else {
      onSave({ ...f, bank: bankId });
    }
  };

  return (
    <Modal
      title={(initial ? "Editar" : "Nuevo") + " movimiento · " + bank.short}
      width={640}
      onClose={onClose}
      footer={
        confirmingTransfer ? (
          <>
            <button className="btn btn--ghost" onClick={() => setConfirmingTransfer(false)}>Volver</button>
            <button className="btn btn--primary" onClick={save}>Confirmar y crear ambos</button>
          </>
        ) : (
          <>
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" onClick={save}>{initial ? "Guardar cambios" : "Agregar"}</button>
          </>
        )
      }
    >
      {confirmingTransfer ? (
        <div className="transfer-preview">
          <p>
            Se registrará en <strong>{bank.name}</strong>:{" "}
            {f.credito ? `crédito de ${money(f.credito)}` : `débito de ${money(f.debito)}`} el{" "}
            {fmtDate(f.fechaPago)} — {f.descripcion}.
          </p>
          <p>
            Se creará automáticamente en <strong>{otherBank.name}</strong>:{" "}
            {f.credito ? `débito de ${money(f.credito)}` : `crédito de ${money(f.debito)}`} el{" "}
            {fmtDate(f.fechaPago)} — {f.descripcion}.
          </p>
        </div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Descripción" wide>
              <input className="inp" autoFocus value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Ej: ESTACION EL BAJO" />
            </Field>
            <Field label="Proveedor / Cliente" wide>
              <input className="inp" value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Agrupación" wide>
              <select className="inp" value={f.grupo} onChange={(e) => set("grupo", e.target.value)} disabled={isLinkedEdit}>
                {GROUPS.filter((g) => g !== "Saldo Inicial").map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de emisión">
              <input className="inp" type="date" value={f.fechaEmision} onChange={(e) => set("fechaEmision", e.target.value)} />
            </Field>
            <Field label="Fecha de pago" hint="Define el mes en el cashflow">
              <input className="inp" type="date" value={f.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
            </Field>
            <Field label="Cheque / Nº">
              <input className="inp" value={f.cheque} onChange={(e) => set("cheque", e.target.value)} placeholder="Opcional" />
            </Field>
            <div className="field"></div>
            <Field label={<span style={{ color: "var(--pos)" }}>Crédito (ingreso)</span>}>
              <MoneyInput value={f.credito} onChange={(v) => set("credito", v)} />
            </Field>
            <Field label={<span style={{ color: "var(--neg)" }}>Débito (egreso)</span>}>
              <MoneyInput value={f.debito} onChange={(v) => set("debito", v)} />
            </Field>
          </div>
          <p className="form-tip">
            {isIn
              ? "Sugerencia: para ingresos cargá el monto en Crédito."
              : "Sugerencia: para pagos y transferencias salientes cargá el monto en Débito."}
          </p>
          {isLinkedEdit && (
            <p className="form-tip">🔗 Vinculado con {linkedBankName}. Los cambios se reflejan también ahí.</p>
          )}
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: errors from `app/movimientos/page.tsx` — it renders `<MovEditor>` without the new required `onSaveTransfer` prop yet. That's expected; Task 7 fixes it. Confirm the *only* errors are in `app/movimientos/page.tsx` about the missing prop (not inside `MovEditor.tsx` itself).

- [ ] **Step 3: Commit**

```bash
git add web/components/movimientos/MovEditor.tsx
git commit -m "feat: add transfer preview flow and linked-edit lock to MovEditor"
```

---

### Task 7: Wire replication, sync, and linked delete into the Movimientos page

**Files:**
- Modify: `web/app/movimientos/page.tsx`

**Interfaces:**
- Consumes: `MovEditor`'s new `linkedBankName`/`onSaveTransfer` props (Task 6), `Confirm`'s new `yesLabel`/`extraAction` props (Task 5), `TRANSFER_OWN_BANK_GROUP` (Task 2), `addMovements` (existing context method), `Movement.transferId` (Task 1).

- [ ] **Step 1: Import the new constant**

In `web/app/movimientos/page.tsx`, update the constants import:

```ts
import { BANKS, GROUPS, TRANSFER_OWN_BANK_GROUP } from "@/lib/constants";
```

- [ ] **Step 2: Compute the counterpart for the movement being edited**

Add this right after the `rows`/`summary` `useMemo`s (after line 58, before the `months` `useMemo`):

```ts
const editingCounterpart = useMemo(() => {
  if (!state || !editing || editing === "new" || !editing.transferId) return null;
  return state.movements.find((m) => m.transferId === editing.transferId && m.id !== editing.id) ?? null;
}, [state, editing]);

const linkedBankName = editingCounterpart ? BANKS.find((b) => b.id === editingCounterpart.bank)?.name : undefined;
```

- [ ] **Step 3: Extend `viewSummary` to track `transfPropio`**

Replace the `viewSummary` block:

```ts
const viewSummary = useMemo(() => {
  const absInicial = summary ? summary.inicial : 0;
  const inicial = firstIdx > 0 ? rows[firstIdx - 1].saldo : absInicial;
  let ingresos = 0, ventaUSD = 0, pagos = 0, transf = 0, transfPropio = 0;
  for (const r of filtered) {
    const cr = Number(r.credito) || 0;
    const de = Number(r.debito) || 0;
    if (r.grupo === "Ingresos") ingresos += cr;
    else if (r.grupo === "Ingreso por Venta de USD") ventaUSD += cr;
    else if (r.grupo === "Pagos") pagos += de;
    else if (r.grupo === "Transf entre cuentas") transf += cr - de;
    else if (r.grupo === TRANSFER_OWN_BANK_GROUP) transfPropio += cr - de;
  }
  const final = filtered.length ? filtered[filtered.length - 1].saldo : inicial;
  const control = inicial + ingresos + ventaUSD - pagos + transf + transfPropio - final;
  return { inicial, ingresos, ventaUSD, pagos, transf, transfPropio, final, control };
}, [rows, filtered, firstIdx, summary]);
```

- [ ] **Step 4: Extend `saveMov` to sync the counterpart, add `saveTransfer`**

Replace the `saveMov`/`delMov` block:

```ts
const saveMov = (mov: Movement | Omit<Movement, "id">) => {
  if ("id" in mov) {
    updateMovement(mov);
    if (mov.transferId) {
      const counterpart = state.movements.find((m) => m.transferId === mov.transferId && m.id !== mov.id);
      if (counterpart) {
        updateMovement({
          ...counterpart,
          descripcion: mov.descripcion,
          proveedor: mov.proveedor,
          fechaEmision: mov.fechaEmision,
          fechaPago: mov.fechaPago,
          cheque: mov.cheque,
          credito: mov.debito,
          debito: mov.credito,
        });
      }
    }
  } else {
    addMovement(mov);
  }
  setEditing(null);
};

const saveTransfer = (legA: Omit<Movement, "id">, legB: Omit<Movement, "id">) => {
  addMovements([legA, legB]);
  setEditing(null);
};

const confirmCounterpart = useMemo(() => {
  if (!state || !confirm || !confirm.transferId) return null;
  return state.movements.find((m) => m.transferId === confirm.transferId && m.id !== confirm.id) ?? null;
}, [state, confirm]);

const delMov = (id: string) => {
  deleteMovement(id);
  setConfirm(null);
};

const delBoth = () => {
  if (!confirm) return;
  deleteMovement(confirm.id);
  if (confirmCounterpart) deleteMovement(confirmCounterpart.id);
  setConfirm(null);
};
```

- [ ] **Step 5: Pass the new props to `MovEditor`, branch the delete `Confirm`**

Replace the `MovEditor`/`Confirm` JSX at the bottom of the component:

```tsx
{editing && (
  <MovEditor
    bankId={bankId}
    initial={editing === "new" ? null : editing}
    linkedBankName={linkedBankName}
    onSave={saveMov}
    onSaveTransfer={saveTransfer}
    onClose={() => setEditing(null)}
  />
)}
{confirm && confirmCounterpart && (
  <Confirm
    message={`"${confirm.descripcion}" está vinculado con ${BANKS.find((b) => b.id === confirmCounterpart.bank)?.name}. ¿Qué querés eliminar?`}
    yesLabel="Eliminar los dos"
    onYes={delBoth}
    onNo={() => setConfirm(null)}
    extraAction={{ label: "Eliminar solo este", onClick: () => delMov(confirm.id) }}
  />
)}
{confirm && !confirmCounterpart && (
  <Confirm
    message={`¿Eliminar el movimiento "${confirm.descripcion}"?`}
    onYes={() => delMov(confirm.id)}
    onNo={() => setConfirm(null)}
  />
)}
```

- [ ] **Step 6: Type-check**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Run the full lib test suite**

Run: `cd web && npx vitest run lib/calc.test.ts lib/format.test.ts lib/dates.test.ts lib/seed.test.ts lib/import.test.ts`
Expected: PASS (these don't touch Supabase; `lib/data.test.ts` is intentionally excluded here since it requires live credentials — see Global Constraints).

- [ ] **Step 8: Commit**

```bash
git add web/app/movimientos/page.tsx
git commit -m "feat: replicate, sync, and cascade-delete Transferencia a banco propio"
```

---

### Task 8: Manual end-to-end verification

**Files:** none (verification only — no code changes).

- [ ] **Step 1: Start the dev server**

Run: `cd web && NEXT_TELEMETRY_DISABLED=1 npx next dev --webpack` (background) and open `http://localhost:3000/movimientos`.

- [ ] **Step 2: Create a linked transfer**

On the Galicia tab, click "+ Nuevo movimiento". Fill Descripción, Fecha de pago, and a Débito amount; set Agrupación to "Transferencia a banco propio". Click "Agregar" — verify the modal switches to the preview text mentioning both banks and the mirrored amount. Click "Confirmar y crear ambos".
Expected: modal closes; the new row appears in the Galicia table with the "Transferencia a banco propio" chip (new light-blue color); switching to the Nación tab shows a mirrored row with the amount in Crédito instead of Débito, same descripción/fecha.

- [ ] **Step 3: Verify the summary card**

On both bank tabs, check the summary card above the table shows a "Transferencia a banco propio" line with the correct signed amount, and "✓ Control OK" (not a control mismatch).

- [ ] **Step 4: Edit one leg, verify sync**

Double-click the Galicia leg to edit it. Verify the "🔗 Vinculado con Banco Nación" note is visible and the Agrupación dropdown is disabled. Change the Descripción and the Débito amount, save.
Expected: the Nación leg's Descripción and Crédito amount update to match (mirrored) without manually touching it.

- [ ] **Step 5: Delete with "Eliminar solo este"**

Click the trash icon on the Galicia leg. Verify the confirm dialog shows three buttons ("Cancelar", "Eliminar solo este", "Eliminar los dos"). Click "Eliminar solo este".
Expected: only the Galicia leg is removed; the Nación leg remains, and if you open it for edit now, the 🔗 banner and disabled Agrupación no longer appear (orphaned, per spec's "Fuera de alcance").

- [ ] **Step 6: Delete with "Eliminar los dos"**

Create a fresh linked transfer (repeat Step 2). Delete one leg using "Eliminar los dos".
Expected: both legs disappear from both bank tabs.

- [ ] **Step 7: Verify "Transf entre cuentas" is unaffected**

Create a new movement with Agrupación "Transf entre cuentas" (the original, unrelated grupo).
Expected: no preview step, saves immediately as a single row, no counterpart created — identical to pre-existing behavior.
