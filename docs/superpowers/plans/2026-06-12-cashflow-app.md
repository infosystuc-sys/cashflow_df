# Cashflow App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Claude Design prototype in `project/` into a working Next.js + Supabase application, deployed on Vercel, preserving the existing UI pixel-for-pixel.

**Architecture:** Next.js 15 (App Router, TypeScript) app in `web/`. Pure calculation/formatting logic ported to `lib/*.ts` (unit-tested with Vitest). A `CashflowContext` provider fetches/writes data via `@supabase/supabase-js` against a normalized Postgres schema (`supabase/schema.sql`). Pages and components recreate the prototype's views, styled via a verbatim-ported `globals.css`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, React 19, Vitest, @supabase/supabase-js, Vercel.

**Reference spec:** `docs/superpowers/specs/2026-06-12-cashflow-app-design.md`

---

## File structure (target)

```
web/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.local                 (not committed — Supabase URL/anon key)
├── .env.local.example
├── app/
│   ├── layout.tsx              # CashflowProvider + Sidebar shell
│   ├── globals.css             # ported verbatim from project/Cashflow.html
│   ├── page.tsx                # redirect -> /movimientos
│   ├── movimientos/page.tsx
│   ├── proyeccion/page.tsx
│   ├── cashflow/page.tsx
│   └── ajustes/page.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── ui/
│   │   ├── Modal.tsx
│   │   ├── Field.tsx
│   │   ├── MoneyInput.tsx
│   │   ├── NumInput.tsx
│   │   ├── GroupChip.tsx
│   │   ├── Money.tsx
│   │   └── Confirm.tsx
│   ├── movimientos/
│   │   ├── BankSummaryCard.tsx
│   │   └── MovEditor.tsx
│   └── proyeccion/
│       ├── MatrixShell.tsx
│       ├── CellQPEditor.tsx
│       ├── CellMoneyEditor.tsx
│       ├── ProjTab.tsx
│       ├── FciTab.tsx
│       └── IvaTab.tsx
├── lib/
│   ├── types.ts
│   ├── constants.ts
│   ├── format.ts        (+ format.test.ts)
│   ├── dates.ts          (+ dates.test.ts)
│   ├── calc.ts            (+ calc.test.ts)
│   ├── seed.ts            (+ seed.test.ts)
│   ├── supabase.ts
│   └── data.ts
└── context/
    └── CashflowContext.tsx

supabase/
└── schema.sql
```

---

## Task 1: Scaffold the Next.js project

**Files:**
- Create: `web/` (via `create-next-app`)
- Modify: `web/package.json` (add `vitest`, `@supabase/supabase-js`)
- Create: `web/vitest.config.ts`

- [ ] **Step 1: Initialize the git repository**

This project isn't a git repo yet. From `d:/APP/CASHFLOW`:

```bash
git init
```

Expected: `Initialized empty Git repository in d:/APP/CASHFLOW/.git/`. (If a `.git`
directory already exists, this step is a no-op — `git init` is safe to re-run.)

- [ ] **Step 2: Scaffold with create-next-app**

Run from `d:/APP/CASHFLOW`:

```bash
npx --yes create-next-app@latest web --typescript --eslint --app --no-tailwind --src-dir=false --import-alias "@/*" --use-npm --no-turbopack
```

Answer/flags are chosen so the command is non-interactive.

- [ ] **Step 3: Remove a nested git repo if one was created**

`create-next-app` sometimes runs `git init` in the new folder. The whole project
uses a single git repo at `d:/APP/CASHFLOW` (from Step 1). Check and remove a
nested one:

```bash
ls -la web/.git 2>/dev/null && rm -rf web/.git || echo "no nested repo"
```

- [ ] **Step 4: Install Supabase client and Vitest**

```bash
cd web && npm install @supabase/supabase-js && npm install -D vitest
```

- [ ] **Step 5: Add Vitest config**

Create `web/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Add a test script**

In `web/package.json`, add to `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 7: Verify the scaffold builds**

```bash
cd web && npm run build
```

Expected: build completes successfully (default Next.js starter page).

- [ ] **Step 8: Commit**

```bash
git add web
git commit -m "Scaffold Next.js app for cashflow"
```

---

## Task 2: Domain types and constants

**Files:**
- Create: `web/lib/types.ts`
- Create: `web/lib/constants.ts`

- [ ] **Step 1: Write `web/lib/types.ts`**

```typescript
export type BankId = "galicia" | "nacion";

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
}

export interface ProjectionValue {
  cantidad: number;
  precio: number;
}

// conceptId -> monthKey -> value
export type ProjectionMap = Record<string, Record<string, ProjectionValue>>;

export interface FciMonthData {
  suscripciones: number;
  rescates: number;
}

// monthKey -> data
export type FciData = Record<string, FciMonthData>;

// rowName -> monthKey -> monto
export type IvaData = Record<string, Record<string, number>>;

export interface Settings {
  saldoInicial: Record<BankId, number>;
  rangeStart: string; // 'YYYY-MM'
  rangeEnd: string; // 'YYYY-MM'
}

export interface CashflowState {
  settings: Settings;
  movements: Movement[];
  projection: ProjectionMap;
  fci: { saldoInicial: number; data: FciData };
  iva: IvaData;
}

export interface BankRow extends Movement {
  saldo: number;
}

export interface BankSummary {
  inicial: number;
  ingresos: number;
  ventaUSD: number;
  pagos: number;
  transf: number;
  final: number;
  control: number;
}

export interface CashflowRow {
  key: string;
  label: string;
  saldoInicialBanco: number;
  ingresos: number;
  ventaUSD: number;
  pagos: number;
  invFCI: number;
  transf: number;
  saldoFinalBanco: number;
  saldoInicialFci: number;
  suscripciones: number;
  rescates: number;
  saldoFinalFci: number;
  cierreTotal: number;
  proyTotal: number;
  realIngresos: number;
  vsPresup: number;
}

export interface CashflowResult {
  months: string[];
  rows: CashflowRow[];
}

export interface ProjConcept {
  id: string;
  name: string;
  unidad: string;
  tipo: "unidad" | "monto";
  grupo: "producto" | "servicio" | "otro";
}

export interface Bank {
  id: BankId;
  name: string;
  short: string;
  color: string;
}
```

- [ ] **Step 2: Write `web/lib/constants.ts`**

Ported from `project/app/data.jsx` (`BANKS`, `GROUPS`, `PROJ_CONCEPTS`, `IVA_ROWS`, `MONTHS_ES`):

```typescript
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
```

- [ ] **Step 3: Verify it compiles**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/types.ts web/lib/constants.ts
git commit -m "Add cashflow domain types and constants"
```

---

## Task 3: Formatting helpers (`lib/format.ts`)

Ported from `project/app/data.jsx` (`fmt2`, `fmt0`, `money`, `num`, `parseNum`).

**Files:**
- Create: `web/lib/format.ts`
- Test: `web/lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/lib/format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { money, num, parseNum } from "./format";

describe("money", () => {
  it("renders zero as a dash", () => {
    expect(money(0)).toBe("-");
  });

  it("formats with 2 decimals by default (es-AR)", () => {
    expect(money(1234.5)).toBe("1.234,50");
  });

  it("formats with 0 decimals when decimals=false", () => {
    expect(money(1234.5, false)).toBe("1.235");
  });

  it("returns empty string for null/undefined/NaN/empty", () => {
    expect(money(null)).toBe("");
    expect(money(undefined)).toBe("");
    expect(money(NaN)).toBe("");
    expect(money("")).toBe("");
  });
});

describe("num", () => {
  it("formats integers with thousands separators", () => {
    expect(num(1234)).toBe("1.234");
  });

  it("returns empty string for null/undefined/NaN/empty", () => {
    expect(num(null)).toBe("");
    expect(num(undefined)).toBe("");
    expect(num(NaN)).toBe("");
    expect(num("")).toBe("");
  });
});

describe("parseNum", () => {
  it("parses es-AR formatted strings", () => {
    expect(parseNum("1.795.836,02")).toBe(1795836.02);
  });

  it("parses plain decimal strings", () => {
    expect(parseNum("1795836.02")).toBe(1795836.02);
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(parseNum(null)).toBe(0);
    expect(parseNum(undefined)).toBe(0);
    expect(parseNum("")).toBe(0);
  });

  it("passes through numbers unchanged", () => {
    expect(parseNum(1500)).toBe(1500);
  });

  it("returns 0 for unparsable strings", () => {
    expect(parseNum("abc")).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && npm test -- format
```

Expected: FAIL — `./format` has no exported members (file doesn't exist yet).

- [ ] **Step 3: Implement `web/lib/format.ts`**

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npm test -- format
```

Expected: PASS, all 12 assertions green.

- [ ] **Step 5: Commit**

```bash
git add web/lib/format.ts web/lib/format.test.ts
git commit -m "Add money/number formatting helpers"
```

---

## Task 4: Date/month helpers (`lib/dates.ts`)

Ported from `project/app/data.jsx` (`monthKeyFromISO`, `monthLabel`, `monthLong`, `addMonth`, `monthRange`).

**Files:**
- Create: `web/lib/dates.ts`
- Test: `web/lib/dates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/lib/dates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { monthKeyFromISO, monthLabel, monthLong, addMonth, monthRange } from "./dates";

describe("monthKeyFromISO", () => {
  it("extracts YYYY-MM from an ISO date", () => {
    expect(monthKeyFromISO("2025-07-15")).toBe("2025-07");
  });

  it("returns null for empty input", () => {
    expect(monthKeyFromISO("")).toBeNull();
  });
});

describe("monthLabel", () => {
  it("formats a month key as 'mon-yy' in Spanish", () => {
    expect(monthLabel("2025-07")).toBe("jul-25");
    expect(monthLabel("2026-01")).toBe("ene-26");
  });

  it("returns empty string for empty input", () => {
    expect(monthLabel("")).toBe("");
  });
});

describe("monthLong", () => {
  it("formats a month key as 'Month YYYY' in Spanish", () => {
    expect(monthLong("2025-07")).toBe("Julio 2025");
  });
});

describe("addMonth", () => {
  it("adds months within a year", () => {
    expect(addMonth("2025-07", 1)).toBe("2025-08");
  });

  it("rolls over to the next year", () => {
    expect(addMonth("2025-12", 1)).toBe("2026-01");
  });

  it("rolls back to the previous year", () => {
    expect(addMonth("2025-01", -1)).toBe("2024-12");
  });
});

describe("monthRange", () => {
  it("returns an inclusive list of month keys", () => {
    expect(monthRange("2025-07", "2025-09")).toEqual(["2025-07", "2025-08", "2025-09"]);
  });

  it("returns a single key when start === end", () => {
    expect(monthRange("2025-12", "2025-12")).toEqual(["2025-12"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && npm test -- dates
```

Expected: FAIL — `./dates` has no exported members.

- [ ] **Step 3: Implement `web/lib/dates.ts`**

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npm test -- dates
```

Expected: PASS, all 9 assertions green.

- [ ] **Step 5: Commit**

```bash
git add web/lib/dates.ts web/lib/dates.test.ts
git commit -m "Add month/date helpers"
```

---

## Task 5: Calculation engine (`lib/calc.ts`)

Ported from `project/app/data.jsx` (`bankRows`, `bankSummary`, `projTotal`, `projMonthTotal`,
`realMonth`, `fciMonth`, `buildCashflow`). This is the core business logic — every
view derives its numbers from these functions.

**Files:**
- Create: `web/lib/calc.ts`
- Test: `web/lib/calc.test.ts`

- [ ] **Step 1: Write the failing test with a hand-computed fixture**

Create `web/lib/calc.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { bankRows, bankSummary, projTotal, projMonthTotal, realMonth, fciMonth, buildCashflow } from "./calc";
import type { CashflowState } from "./types";
import { PROJ_CONCEPTS, IVA_ROWS } from "./constants";

function emptyProjection() {
  const p: CashflowState["projection"] = {};
  PROJ_CONCEPTS.forEach((c) => (p[c.id] = {}));
  return p;
}

function emptyIva() {
  const v: CashflowState["iva"] = {};
  IVA_ROWS.forEach((r) => (v[r] = {}));
  return v;
}

// Small, hand-computable fixture:
// - Galicia starts at 1000, gets +300 (Ingresos) on 2025-01-10, -100 (Pagos) on
//   2025-01-15, +200 (Transf entrante) on 2025-01-12.
// - Nacion starts at 500, sends -200 (Transf saliente) on 2025-01-12.
// - FCI starts at 50, +20/-5 (susc/resc) in 2025-01.
// - Azúcar projection for 2025-01: 10 x 100 = 1000.
function makeFixture(): CashflowState {
  return {
    settings: {
      saldoInicial: { galicia: 1000, nacion: 500 },
      rangeStart: "2025-01",
      rangeEnd: "2025-02",
    },
    movements: [
      { id: "m1", bank: "galicia", descripcion: "Cobro", proveedor: "", fechaEmision: "", fechaPago: "2025-01-10", cheque: "", credito: 300, debito: 0, grupo: "Ingresos" },
      { id: "m2", bank: "galicia", descripcion: "Pago proveedor", proveedor: "", fechaEmision: "", fechaPago: "2025-01-15", cheque: "", credito: 0, debito: 100, grupo: "Pagos" },
      { id: "m3", bank: "nacion", descripcion: "Transferencia", proveedor: "", fechaEmision: "", fechaPago: "2025-01-12", cheque: "", credito: 0, debito: 200, grupo: "Transf entre cuentas" },
      { id: "m4", bank: "galicia", descripcion: "Transferencia recibida", proveedor: "", fechaEmision: "", fechaPago: "2025-01-12", cheque: "", credito: 200, debito: 0, grupo: "Transf entre cuentas" },
    ],
    projection: { ...emptyProjection(), azucar: { "2025-01": { cantidad: 10, precio: 100 } } },
    fci: { saldoInicial: 50, data: { "2025-01": { suscripciones: 20, rescates: 5 } } },
    iva: { ...emptyIva(), "Azúcar": { "2025-01": 1000 } },
  };
}

describe("bankRows", () => {
  it("sorts by fechaPago and accumulates a running balance", () => {
    const rows = bankRows(makeFixture(), "galicia");
    expect(rows.map((r) => r.id)).toEqual(["m1", "m4", "m2"]);
    expect(rows.map((r) => r.saldo)).toEqual([1300, 1500, 1400]);
  });
});

describe("bankSummary", () => {
  it("computes totals and a zero control for galicia", () => {
    const s = bankSummary(makeFixture(), "galicia");
    expect(s).toEqual({ inicial: 1000, ingresos: 300, ventaUSD: 0, pagos: 100, transf: 200, final: 1400, control: 0 });
  });

  it("computes totals and a zero control for nacion", () => {
    const s = bankSummary(makeFixture(), "nacion");
    expect(s).toEqual({ inicial: 500, ingresos: 0, ventaUSD: 0, pagos: 0, transf: -200, final: 300, control: 0 });
  });
});

describe("projTotal / projMonthTotal", () => {
  it("multiplies cantidad x precio for a concept/month", () => {
    expect(projTotal(makeFixture(), "azucar", "2025-01")).toBe(1000);
    expect(projTotal(makeFixture(), "azucar", "2025-02")).toBe(0);
  });

  it("sums all concepts for a month", () => {
    expect(projMonthTotal(makeFixture(), "2025-01")).toBe(1000);
    expect(projMonthTotal(makeFixture(), "2025-02")).toBe(0);
  });
});

describe("realMonth", () => {
  it("buckets movements from both banks by fechaPago", () => {
    expect(realMonth(makeFixture(), "2025-01")).toEqual({ ingresos: 300, ventaUSD: 0, pagos: 100, transf: 0 });
    expect(realMonth(makeFixture(), "2025-02")).toEqual({ ingresos: 0, ventaUSD: 0, pagos: 0, transf: 0 });
  });
});

describe("fciMonth", () => {
  it("reads suscripciones/rescates for a month, defaulting to 0", () => {
    expect(fciMonth(makeFixture(), "2025-01")).toEqual({ suscripciones: 20, rescates: 5 });
    expect(fciMonth(makeFixture(), "2025-02")).toEqual({ suscripciones: 0, rescates: 0 });
  });
});

describe("buildCashflow", () => {
  it("computes the full month-by-month cashflow", () => {
    const cf = buildCashflow(makeFixture());
    expect(cf.months).toEqual(["2025-01", "2025-02"]);

    const jan = cf.rows[0];
    expect(jan.saldoInicialBanco).toBe(1500); // 1000 + 500
    expect(jan.ingresos).toBe(300);
    expect(jan.pagos).toBe(100);
    expect(jan.invFCI).toBe(15); // 20 - 5
    expect(jan.transf).toBe(0); // +200 - 200
    expect(jan.saldoFinalBanco).toBe(1685); // 1500 + 300 - 100 - 15 + 0
    expect(jan.saldoInicialFci).toBe(50);
    expect(jan.saldoFinalFci).toBe(65); // 50 + 20 - 5
    expect(jan.cierreTotal).toBe(1750); // 1685 + 65
    expect(jan.proyTotal).toBe(1000);
    expect(jan.realIngresos).toBe(300);
    expect(jan.vsPresup).toBe(-700); // 300 - 1000

    const feb = cf.rows[1];
    expect(feb.saldoInicialBanco).toBe(1685);
    expect(feb.saldoFinalBanco).toBe(1685);
    expect(feb.saldoInicialFci).toBe(65);
    expect(feb.saldoFinalFci).toBe(65);
    expect(feb.cierreTotal).toBe(1750);
    expect(feb.proyTotal).toBe(0);
    expect(feb.vsPresup).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && npm test -- calc
```

Expected: FAIL — `./calc` has no exported members.

- [ ] **Step 3: Implement `web/lib/calc.ts`**

```typescript
import type { BankId, BankRow, BankSummary, CashflowResult, CashflowState } from "./types";
import { PROJ_CONCEPTS } from "./constants";
import { monthKeyFromISO, monthLabel, monthRange } from "./dates";

// Movimientos de un banco ordenados por fechaPago (estable) con saldo corriente
export function bankRows(state: CashflowState, bankId: BankId): BankRow[] {
  const rows = state.movements
    .filter((x) => x.bank === bankId)
    .map((x, i) => ({ ...x, _i: i }));

  rows.sort((a, b) => {
    const fa = a.fechaPago || "9999-12-31";
    const fb = b.fechaPago || "9999-12-31";
    if (fa < fb) return -1;
    if (fa > fb) return 1;
    return a._i - b._i;
  });

  let saldo = state.settings.saldoInicial[bankId] || 0;
  return rows.map((r) => {
    saldo += (Number(r.credito) || 0) - (Number(r.debito) || 0);
    const { _i, ...rest } = r;
    return { ...rest, saldo };
  });
}

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
  const final = inicial + ingresos + ventaUSD - pagos + transf;

  const last = bankRows(state, bankId).slice(-1)[0];
  const lastSaldo = last ? last.saldo : inicial;
  const control = final - lastSaldo;

  return { inicial, ingresos, ventaUSD, pagos, transf, final, control };
}

// Proyección: total por concepto y mes
export function projTotal(state: CashflowState, conceptId: string, monthKey: string): number {
  const cell = state.projection[conceptId] && state.projection[conceptId][monthKey];
  if (!cell) return 0;
  return (Number(cell.cantidad) || 0) * (Number(cell.precio) || 0);
}

export function projMonthTotal(state: CashflowState, monthKey: string): number {
  return PROJ_CONCEPTS.reduce((a, c) => a + projTotal(state, c.id, monthKey), 0);
}

// Real por mes (de movimientos, ambos bancos), bucketed por fechaPago
export function realMonth(state: CashflowState, monthKey: string) {
  const inMonth = state.movements.filter((x) => monthKeyFromISO(x.fechaPago) === monthKey);
  const sum = (pred: (r: CashflowState["movements"][number]) => boolean, field: "credito" | "debito") =>
    inMonth.filter(pred).reduce((a, r) => a + (Number(r[field]) || 0), 0);

  const ingresos = sum((r) => r.grupo === "Ingresos", "credito");
  const ventaUSD = sum((r) => r.grupo === "Ingreso por Venta de USD", "credito");
  const pagos = sum((r) => r.grupo === "Pagos", "debito");
  const transf =
    sum((r) => r.grupo === "Transf entre cuentas", "credito") -
    sum((r) => r.grupo === "Transf entre cuentas", "debito");

  return { ingresos, ventaUSD, pagos, transf };
}

export function fciMonth(state: CashflowState, monthKey: string) {
  const d = state.fci.data[monthKey] || { suscripciones: 0, rescates: 0 };
  return { suscripciones: Number(d.suscripciones) || 0, rescates: Number(d.rescates) || 0 };
}

// Construye la matriz completa del cashflow para el rango de meses configurado
export function buildCashflow(state: CashflowState): CashflowResult {
  const months = monthRange(state.settings.rangeStart, state.settings.rangeEnd);
  const bankInicialTotal = (state.settings.saldoInicial.galicia || 0) + (state.settings.saldoInicial.nacion || 0);
  let saldoBancoPrev = bankInicialTotal;
  let saldoFciPrev = state.fci.saldoInicial || 0;

  const rows = months.map((mk, idx) => {
    const r = realMonth(state, mk);
    const fci = fciMonth(state, mk);
    const invFCI = fci.suscripciones - fci.rescates; // dinero que sale del banco hacia FCI

    const saldoInicialBanco = idx === 0 ? bankInicialTotal : saldoBancoPrev;
    const saldoFinalBanco = saldoInicialBanco + r.ingresos + r.ventaUSD - r.pagos - invFCI + r.transf;

    const saldoInicialFci = idx === 0 ? state.fci.saldoInicial || 0 : saldoFciPrev;
    const saldoFinalFci = saldoInicialFci + fci.suscripciones - fci.rescates;

    saldoBancoPrev = saldoFinalBanco;
    saldoFciPrev = saldoFinalFci;

    const proyTotal = projMonthTotal(state, mk);

    return {
      key: mk,
      label: monthLabel(mk),
      saldoInicialBanco,
      ingresos: r.ingresos,
      ventaUSD: r.ventaUSD,
      pagos: r.pagos,
      invFCI,
      transf: r.transf,
      saldoFinalBanco,
      saldoInicialFci,
      suscripciones: fci.suscripciones,
      rescates: fci.rescates,
      saldoFinalFci,
      cierreTotal: saldoFinalBanco + saldoFinalFci,
      proyTotal,
      realIngresos: r.ingresos + r.ventaUSD,
      vsPresup: r.ingresos + r.ventaUSD - proyTotal,
    };
  });

  return { months, rows };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npm test -- calc
```

Expected: PASS, all assertions green.

- [ ] **Step 5: Commit**

```bash
git add web/lib/calc.ts web/lib/calc.test.ts
git commit -m "Add cashflow calculation engine"
```

---

## Task 6: Seed data (`lib/seed.ts`)

Ported from `project/app/data.jsx` (`defaultState`'s settings, `seedMovements`,
`seedProjection`, `seedFCI`, `seedIVA`). Used by `supabase/schema.sql` (Task 7) and
by `resetToSeed()` (Task 8).

**Files:**
- Create: `web/lib/seed.ts`
- Test: `web/lib/seed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/lib/seed.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { seedMovements, seedState } from "./seed";
import { buildCashflow } from "./calc";
import { monthRange } from "./dates";

describe("seedMovements", () => {
  it("has the expected number of movements per bank", () => {
    const movements = seedMovements();
    expect(movements.filter((m) => m.bank === "galicia")).toHaveLength(16);
    expect(movements.filter((m) => m.bank === "nacion")).toHaveLength(9);
  });
});

describe("seedState", () => {
  it("produces a cashflow with one row per configured month", () => {
    const state = seedState();
    const cf = buildCashflow(state);
    const expectedMonths = monthRange(state.settings.rangeStart, state.settings.rangeEnd);
    expect(cf.months).toEqual(expectedMonths);
    expect(cf.rows).toHaveLength(21); // 2025-07 .. 2027-03
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && npm test -- seed
```

Expected: FAIL — `./seed` has no exported members.

- [ ] **Step 3: Implement `web/lib/seed.ts`**

```typescript
import type { CashflowState, FciData, IvaData, Movement, ProjectionMap, Settings } from "./types";
import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";

export type SeedMovement = Omit<Movement, "id">;

export function seedSettings(): Settings {
  return {
    saldoInicial: { galicia: 50000000, nacion: 15742577.77 },
    rangeStart: "2025-07",
    rangeEnd: "2027-03",
  };
}

export function seedMovements(): SeedMovement[] {
  const G = "galicia" as const;
  const N = "nacion" as const;
  const m = (
    bank: SeedMovement["bank"],
    descripcion: string,
    proveedor: string,
    fechaPago: string,
    cheque: string,
    credito: number,
    debito: number,
    grupo: string,
    fechaEmision = ""
  ): SeedMovement => ({ bank, descripcion, proveedor, fechaEmision, fechaPago, cheque, credito, debito, grupo });

  return [
    // ----- GALICIA -----
    m(G, "ECHEQ EN CARTERA", "", "2026-06-02", "", 60000000, 0, "Ingresos"),
    m(G, "TRANSFERENCIA", "GALICIA", "2026-06-05", "", 115000000, 0, "Transf entre cuentas"),
    m(G, "GASMAX", "", "2026-06-01", "239", 0, 1795836.02, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-15", "258", 0, 21738124.7, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-16", "268", 0, 11000000, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-19", "269", 0, 11000000, "Pagos"),
    m(G, "LUIS S FERRO", "", "2026-06-19", "259", 0, 3000000, "Pagos"),
    m(G, "PETROBAN SRL", "", "2026-06-22", "266", 0, 11477394.79, "Pagos"),
    m(G, "ESTACION EL BAJO", "", "2026-06-22", "270", 0, 11200000, "Pagos"),
    m(G, "AGRICOLA GARCIA", "", "2026-06-26", "260", 0, 4000000, "Pagos"),
    m(G, "NEUMATICOS EL TIMBO SAS", "", "2026-06-29", "262", 0, 590000, "Pagos"),
    m(G, "NOR TEX SAS", "", "2026-06-30", "257", 0, 2430267.25, "Pagos"),
    m(G, "PENDIENTE DE COBRO", "AGD", "2026-06-30", "", 14000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "RUIZ RODRIGO", "2026-06-30", "", 12000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "ESTANCIA EL AZUL", "2026-06-30", "", 8000000, 0, "Ingresos"),
    m(G, "PENDIENTE DE COBRO", "SOUTH FOUTH", "2026-06-30", "", 4000000, 0, "Ingresos"),
    // ----- NACION -----
    m(N, "BUNGE FACTURA PENDIENTE", "", "2026-06-02", "", 36000000, 0, "Ingresos"),
    m(N, "TRANSFERENCIA", "GALICIA", "2026-06-05", "", 0, 115000000, "Transf entre cuentas"),
    m(N, "SUELDOS", "", "2026-06-05", "", 0, 10000000, "Pagos"),
    m(N, "MERCEDES BENZ -CAMION", "AG424SW", "2026-06-05", "E CUOTAS 48-28", 0, 20679377.13, "Pagos"),
    m(N, "SICORE", "", "2026-06-10", "", 0, 2000000, "Pagos"),
    m(N, "COSECHA soja", "facturar falta", "2026-06-12", "", 25000000, 0, "Ingresos"),
    m(N, "SIN FACTURAR", "FLETE BUNGE", "2026-06-13", "", 20000000, 0, "Ingresos"),
    m(N, "COSECHA CAÑA", "PAGO EN JULIO", "2026-06-14", "", 130000000, 0, "Ingresos"),
    m(N, "SAN MIGUEL FALTA FACTUREAR", "", "2026-06-15", "", 12000000, 0, "Ingresos"),
  ];
}

export function seedProjection(): ProjectionMap {
  const p: ProjectionMap = {};
  PROJ_CONCEPTS.forEach((c) => (p[c.id] = {}));
  const mesesAzucar = ["2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"];
  mesesAzucar.forEach((k) => (p.azucar[k] = { cantidad: 7000, precio: 25000 }));
  p.fletes["2025-07"] = { cantidad: 1, precio: 80000000 };
  p.fletes["2025-08"] = { cantidad: 1, precio: 100000000 };
  p.fletes["2025-09"] = { cantidad: 1, precio: 100000000 };
  p.servicios["2025-07"] = { cantidad: 1, precio: 20000000 };
  p.cheques3["2025-08"] = { cantidad: 1, precio: 344000000 };
  return p;
}

export function seedFci(): { saldoInicial: number; data: FciData } {
  return {
    saldoInicial: 0,
    data: {
      "2025-07": { suscripciones: 260000000, rescates: 260586228 },
      "2025-08": { suscripciones: 450100000, rescates: 398618319 },
      "2025-09": { suscripciones: 50264223, rescates: 101745915 },
    },
  };
}

export function seedIva(): IvaData {
  const v: IvaData = {};
  IVA_ROWS.forEach((r) => (v[r] = {}));
  v["Azúcar"]["2025-07"] = 131900826;
  v["Azúcar"]["2025-08"] = 154710744;
  v["Azúcar"]["2025-09"] = 64125620;
  v["Sorgo"]["2025-07"] = 48559851;
  v["Sorgo"]["2025-08"] = 46378759;
  v["Sorgo"]["2025-09"] = 61356893;
  v["Sorgo"]["2025-10"] = 31378233;
  v["Fletes"]["2025-07"] = 1949799;
  v["Fletes"]["2025-08"] = 29827779;
  v["Fletes"]["2025-09"] = 55404284;
  v["Fletes"]["2025-10"] = 65408269;
  return v;
}

// Full in-memory state for tests and for the "reset to demo data" flow.
// Movements get synthetic ids here; resetToSeed() (Task 8) inserts seedMovements()
// directly so Postgres assigns real uuids.
export function seedState(): CashflowState {
  return {
    settings: seedSettings(),
    movements: seedMovements().map((m, i) => ({ ...m, id: `seed-${i}` })),
    projection: seedProjection(),
    fci: seedFci(),
    iva: seedIva(),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd web && npm test -- seed
```

Expected: PASS.

- [ ] **Step 5: Run the full test suite**

```bash
cd web && npm test
```

Expected: all tests across `format`, `dates`, `calc`, `seed` pass.

- [ ] **Step 6: Commit**

```bash
git add web/lib/seed.ts web/lib/seed.test.ts
git commit -m "Add seed data for demo cashflow"
```

---

## Task 7: Supabase SQL schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Write `supabase/schema.sql`**

Values mirror `web/lib/seed.ts` exactly (Task 6).

```sql
-- Cashflow app schema. No RLS / no auth: the anon key has full read/write,
-- by design (see docs/superpowers/specs/2026-06-12-cashflow-app-design.md).

create table settings (
  id int primary key default 1,
  saldo_inicial_galicia numeric not null default 0,
  saldo_inicial_nacion  numeric not null default 0,
  range_start text not null default '2025-07',
  range_end   text not null default '2027-03',
  fci_saldo_inicial numeric not null default 0,
  constraint settings_single_row check (id = 1)
);

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
  created_at timestamptz not null default now()
);

create table projection_cells (
  concept_id text not null,
  month_key  text not null,
  cantidad numeric not null default 0,
  precio   numeric not null default 0,
  primary key (concept_id, month_key)
);

create table fci_monthly (
  month_key text primary key,
  suscripciones numeric not null default 0,
  rescates      numeric not null default 0
);

create table iva_monthly (
  row_name  text not null,
  month_key text not null,
  monto numeric not null default 0,
  primary key (row_name, month_key)
);

-- Grants for the anon role (no-auth app)
grant select, insert, update, delete on settings, movements, projection_cells, fci_monthly, iva_monthly to anon;

-- ---------- Seed data ----------

insert into settings (id, saldo_inicial_galicia, saldo_inicial_nacion, range_start, range_end, fci_saldo_inicial)
values (1, 50000000, 15742577.77, '2025-07', '2027-03', 0);

insert into movements (bank, descripcion, proveedor, fecha_emision, fecha_pago, cheque, credito, debito, grupo) values
('galicia', 'ECHEQ EN CARTERA', '', null, '2026-06-02', '', 60000000, 0, 'Ingresos'),
('galicia', 'TRANSFERENCIA', 'GALICIA', null, '2026-06-05', '', 115000000, 0, 'Transf entre cuentas'),
('galicia', 'GASMAX', '', null, '2026-06-01', '239', 0, 1795836.02, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-15', '258', 0, 21738124.70, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-16', '268', 0, 11000000, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-19', '269', 0, 11000000, 'Pagos'),
('galicia', 'LUIS S FERRO', '', null, '2026-06-19', '259', 0, 3000000, 'Pagos'),
('galicia', 'PETROBAN SRL', '', null, '2026-06-22', '266', 0, 11477394.79, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-22', '270', 0, 11200000, 'Pagos'),
('galicia', 'AGRICOLA GARCIA', '', null, '2026-06-26', '260', 0, 4000000, 'Pagos'),
('galicia', 'NEUMATICOS EL TIMBO SAS', '', null, '2026-06-29', '262', 0, 590000, 'Pagos'),
('galicia', 'NOR TEX SAS', '', null, '2026-06-30', '257', 0, 2430267.25, 'Pagos'),
('galicia', 'PENDIENTE DE COBRO', 'AGD', null, '2026-06-30', '', 14000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'RUIZ RODRIGO', null, '2026-06-30', '', 12000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'ESTANCIA EL AZUL', null, '2026-06-30', '', 8000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'SOUTH FOUTH', null, '2026-06-30', '', 4000000, 0, 'Ingresos'),
('nacion', 'BUNGE FACTURA PENDIENTE', '', null, '2026-06-02', '', 36000000, 0, 'Ingresos'),
('nacion', 'TRANSFERENCIA', 'GALICIA', null, '2026-06-05', '', 0, 115000000, 'Transf entre cuentas'),
('nacion', 'SUELDOS', '', null, '2026-06-05', '', 0, 10000000, 'Pagos'),
('nacion', 'MERCEDES BENZ -CAMION', 'AG424SW', null, '2026-06-05', 'E CUOTAS 48-28', 0, 20679377.13, 'Pagos'),
('nacion', 'SICORE', '', null, '2026-06-10', '', 0, 2000000, 'Pagos'),
('nacion', 'COSECHA soja', 'facturar falta', null, '2026-06-12', '', 25000000, 0, 'Ingresos'),
('nacion', 'SIN FACTURAR', 'FLETE BUNGE', null, '2026-06-13', '', 20000000, 0, 'Ingresos'),
('nacion', 'COSECHA CAÑA', 'PAGO EN JULIO', null, '2026-06-14', '', 130000000, 0, 'Ingresos'),
('nacion', 'SAN MIGUEL FALTA FACTUREAR', '', null, '2026-06-15', '', 12000000, 0, 'Ingresos');

insert into projection_cells (concept_id, month_key, cantidad, precio) values
('azucar', '2025-07', 7000, 25000),
('azucar', '2025-08', 7000, 25000),
('azucar', '2025-09', 7000, 25000),
('azucar', '2025-10', 7000, 25000),
('azucar', '2025-11', 7000, 25000),
('azucar', '2025-12', 7000, 25000),
('fletes', '2025-07', 1, 80000000),
('fletes', '2025-08', 1, 100000000),
('fletes', '2025-09', 1, 100000000),
('servicios', '2025-07', 1, 20000000),
('cheques3', '2025-08', 1, 344000000);

insert into fci_monthly (month_key, suscripciones, rescates) values
('2025-07', 260000000, 260586228),
('2025-08', 450100000, 398618319),
('2025-09', 50264223, 101745915);

insert into iva_monthly (row_name, month_key, monto) values
('Azúcar', '2025-07', 131900826),
('Azúcar', '2025-08', 154710744),
('Azúcar', '2025-09', 64125620),
('Sorgo', '2025-07', 48559851),
('Sorgo', '2025-08', 46378759),
('Sorgo', '2025-09', 61356893),
('Sorgo', '2025-10', 31378233),
('Fletes', '2025-07', 1949799),
('Fletes', '2025-08', 29827779),
('Fletes', '2025-09', 55404284),
('Fletes', '2025-10', 65408269);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add Supabase schema and seed data"
```

(The schema is applied to the live Supabase project in Task 8.)

---

## Task 8: Supabase project, client, and data access layer

This task needs a real Supabase project. If no project exists yet, use the
`supabase:supabase` skill (MCP) to create one — if that requires interactive
authentication, pause here and ask the user to either authenticate the Supabase
MCP or provide an existing project's URL + anon key.

**Files:**
- Create: `web/.env.local` (not committed)
- Create: `web/.env.local.example`
- Modify: `web/.gitignore` (allow committing the example file)
- Modify: `web/vitest.config.ts` (load `.env.local` for live tests)
- Create: `web/lib/supabase.ts`
- Create: `web/lib/data.ts`
- Test: `web/lib/data.test.ts`

- [ ] **Step 1: Create/connect the Supabase project and apply the schema**

Using the `supabase:supabase` skill / MCP:

1. Create a new Supabase project (or connect an existing one) for this app.
2. Run the contents of `supabase/schema.sql` against it (SQL editor or MCP SQL
   execution).
3. Get the project's **Project URL** and **anon public key** (Project Settings →
   API).

- [ ] **Step 2: Create env files**

Create `web/.env.local` (replace with the real values from Step 1 — do not commit
this file):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

Create `web/.env.local.example` (this one IS committed, as a template):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Allow the example file past `.env*` in `.gitignore`**

`create-next-app`'s default `web/.gitignore` ignores `.env*` (which would also hide
`.env.local.example`). Append to `web/.gitignore`:

```
!.env.local.example
```

- [ ] **Step 4: Load `.env.local` in Vitest**

Replace `web/vitest.config.ts` with:

```typescript
import { defineConfig, loadEnv } from "vitest/config";

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ""));
  return {
    test: {
      environment: "node",
      include: ["lib/**/*.test.ts"],
    },
  };
});
```

- [ ] **Step 5: Write `web/lib/supabase.ts`**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 6: Write the failing integration test**

Create `web/lib/data.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { fetchAllData } from "./data";

const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

describe.skipIf(!hasSupabase)("fetchAllData (live Supabase)", () => {
  it("fetches a well-formed CashflowState from the seeded database", async () => {
    const state = await fetchAllData();
    expect(state.settings.rangeStart).toBe("2025-07");
    expect(state.settings.rangeEnd).toBe("2027-03");
    expect(state.movements.length).toBeGreaterThanOrEqual(25);
    expect(state.movements.filter((m) => m.bank === "galicia")).toHaveLength(16);
    expect(state.movements.filter((m) => m.bank === "nacion")).toHaveLength(9);
    expect(state.fci.data["2025-07"]).toEqual({ suscripciones: 260000000, rescates: 260586228 });
    expect(state.projection.azucar["2025-07"]).toEqual({ cantidad: 7000, precio: 25000 });
    expect(state.iva["Azúcar"]["2025-07"]).toBe(131900826);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

```bash
cd web && npm test -- data
```

Expected: FAIL — `./data` has no exported members (file doesn't exist yet).

- [ ] **Step 8: Implement `web/lib/data.ts`**

```typescript
import { supabase } from "./supabase";
import { seedFci, seedIva, seedMovements, seedProjection, seedSettings } from "./seed";
import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";
import type { CashflowState, Movement } from "./types";

export async function fetchAllData(): Promise<CashflowState> {
  const [settingsRes, movementsRes, projectionRes, fciRes, ivaRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("movements").select("*"),
    supabase.from("projection_cells").select("*"),
    supabase.from("fci_monthly").select("*"),
    supabase.from("iva_monthly").select("*"),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (movementsRes.error) throw movementsRes.error;
  if (projectionRes.error) throw projectionRes.error;
  if (fciRes.error) throw fciRes.error;
  if (ivaRes.error) throw ivaRes.error;

  const s = settingsRes.data;

  const movements: Movement[] = movementsRes.data.map((row) => ({
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

  const projection: CashflowState["projection"] = {};
  PROJ_CONCEPTS.forEach((c) => (projection[c.id] = {}));
  projectionRes.data.forEach((row) => {
    projection[row.concept_id][row.month_key] = { cantidad: Number(row.cantidad), precio: Number(row.precio) };
  });

  const fciData: CashflowState["fci"]["data"] = {};
  fciRes.data.forEach((row) => {
    fciData[row.month_key] = { suscripciones: Number(row.suscripciones), rescates: Number(row.rescates) };
  });

  const iva: CashflowState["iva"] = {};
  IVA_ROWS.forEach((r) => (iva[r] = {}));
  ivaRes.data.forEach((row) => {
    iva[row.row_name][row.month_key] = Number(row.monto);
  });

  return {
    settings: {
      saldoInicial: { galicia: Number(s.saldo_inicial_galicia), nacion: Number(s.saldo_inicial_nacion) },
      rangeStart: s.range_start,
      rangeEnd: s.range_end,
    },
    movements,
    projection,
    fci: { saldoInicial: Number(s.fci_saldo_inicial), data: fciData },
    iva,
  };
}

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
  };
}

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
    })
    .eq("id", m.id);
  if (error) throw error;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProjectionCell(
  conceptId: string,
  monthKey: string,
  cantidad: number,
  precio: number
): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .upsert({ concept_id: conceptId, month_key: monthKey, cantidad, precio });
  if (error) throw error;
}

export async function deleteProjectionCell(conceptId: string, monthKey: string): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .delete()
    .eq("concept_id", conceptId)
    .eq("month_key", monthKey);
  if (error) throw error;
}

export async function upsertFciMonthly(
  monthKey: string,
  field: "suscripciones" | "rescates",
  value: number,
  current: { suscripciones: number; rescates: number }
): Promise<void> {
  const next = {
    month_key: monthKey,
    suscripciones: field === "suscripciones" ? value : current.suscripciones,
    rescates: field === "rescates" ? value : current.rescates,
  };
  const { error } = await supabase.from("fci_monthly").upsert(next);
  if (error) throw error;
}

export async function upsertIvaMonthly(rowName: string, monthKey: string, monto: number): Promise<void> {
  if (monto === 0) {
    const { error } = await supabase.from("iva_monthly").delete().eq("row_name", rowName).eq("month_key", monthKey);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("iva_monthly").upsert({ row_name: rowName, month_key: monthKey, monto });
  if (error) throw error;
}

export async function updateSettings(settings: CashflowState["settings"]): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .update({
      saldo_inicial_galicia: settings.saldoInicial.galicia,
      saldo_inicial_nacion: settings.saldoInicial.nacion,
      range_start: settings.rangeStart,
      range_end: settings.rangeEnd,
    })
    .eq("id", 1);
  if (error) throw error;
}

export async function updateFciSaldoInicial(value: number): Promise<void> {
  const { error } = await supabase.from("settings").update({ fci_saldo_inicial: value }).eq("id", 1);
  if (error) throw error;
}

export async function resetToSeed(): Promise<void> {
  await supabase.from("movements").delete().not("id", "is", null);
  await supabase.from("projection_cells").delete().not("concept_id", "is", null);
  await supabase.from("fci_monthly").delete().not("month_key", "is", null);
  await supabase.from("iva_monthly").delete().not("row_name", "is", null);

  const settings = seedSettings();
  const fci = seedFci();
  await supabase
    .from("settings")
    .update({
      saldo_inicial_galicia: settings.saldoInicial.galicia,
      saldo_inicial_nacion: settings.saldoInicial.nacion,
      range_start: settings.rangeStart,
      range_end: settings.rangeEnd,
      fci_saldo_inicial: fci.saldoInicial,
    })
    .eq("id", 1);

  const movements = seedMovements().map((m) => ({
    bank: m.bank,
    descripcion: m.descripcion,
    proveedor: m.proveedor,
    fecha_emision: m.fechaEmision || null,
    fecha_pago: m.fechaPago,
    cheque: m.cheque,
    credito: m.credito,
    debito: m.debito,
    grupo: m.grupo,
  }));
  await supabase.from("movements").insert(movements);

  const projection = seedProjection();
  const projectionRows: { concept_id: string; month_key: string; cantidad: number; precio: number }[] = [];
  Object.entries(projection).forEach(([conceptId, months]) => {
    Object.entries(months).forEach(([monthKey, v]) => {
      projectionRows.push({ concept_id: conceptId, month_key: monthKey, cantidad: v.cantidad, precio: v.precio });
    });
  });
  if (projectionRows.length) await supabase.from("projection_cells").insert(projectionRows);

  const fciRows = Object.entries(fci.data).map(([monthKey, v]) => ({
    month_key: monthKey,
    suscripciones: v.suscripciones,
    rescates: v.rescates,
  }));
  if (fciRows.length) await supabase.from("fci_monthly").insert(fciRows);

  const iva = seedIva();
  const ivaRows: { row_name: string; month_key: string; monto: number }[] = [];
  Object.entries(iva).forEach(([rowName, months]) => {
    Object.entries(months).forEach(([monthKey, monto]) => {
      ivaRows.push({ row_name: rowName, month_key: monthKey, monto });
    });
  });
  if (ivaRows.length) await supabase.from("iva_monthly").insert(ivaRows);
}
```

- [ ] **Step 9: Run the test to verify it passes**

```bash
cd web && npm test -- data
```

Expected: PASS — `fetchAllData` returns the seeded data from your live Supabase
project.

- [ ] **Step 10: Commit**

```bash
git add web/lib/supabase.ts web/lib/data.ts web/lib/data.test.ts web/vitest.config.ts web/.env.local.example web/.gitignore
git commit -m "Add Supabase client and data access layer"
```

---

## Task 9: Cashflow context (state + mutations)

This wires the data access layer (Task 8) into a React context that the UI tasks
(11-16) will consume via `useCashflow()`. There's no UI yet to exercise this
manually — verification is via `tsc`, and end-to-end behavior is checked in Task 17
once the views exist.

**Files:**
- Create: `web/context/CashflowContext.tsx`

- [ ] **Step 1: Write `web/context/CashflowContext.tsx`**

```typescript
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CashflowState, Movement } from "@/lib/types";
import {
  fetchAllData,
  insertMovement,
  updateMovement as updateMovementInDb,
  deleteMovement as deleteMovementInDb,
  upsertProjectionCell,
  deleteProjectionCell,
  upsertFciMonthly,
  upsertIvaMonthly,
  updateSettings as updateSettingsInDb,
  updateFciSaldoInicial as updateFciSaldoInicialInDb,
  resetToSeed,
} from "@/lib/data";

interface CashflowContextValue {
  state: CashflowState | null;
  loading: boolean;
  error: string | null;
  addMovement: (m: Omit<Movement, "id">) => Promise<void>;
  updateMovement: (m: Movement) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  setProjectionCell: (conceptId: string, monthKey: string, cantidad: number, precio: number) => Promise<void>;
  clearProjectionCell: (conceptId: string, monthKey: string) => Promise<void>;
  setFciCell: (monthKey: string, field: "suscripciones" | "rescates", value: number) => Promise<void>;
  setFciSaldoInicial: (value: number) => Promise<void>;
  setIvaCell: (rowName: string, monthKey: string, monto: number) => Promise<void>;
  setSettings: (settings: CashflowState["settings"]) => Promise<void>;
  reset: () => Promise<void>;
}

const CashflowContext = createContext<CashflowContextValue | null>(null);

export function CashflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CashflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData()
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const addMovement = async (m: Omit<Movement, "id">) => {
    const created = await insertMovement(m);
    setState((s) => (s ? { ...s, movements: [...s.movements, created] } : s));
  };

  const updateMovement = async (m: Movement) => {
    setState((s) => (s ? { ...s, movements: s.movements.map((x) => (x.id === m.id ? m : x)) } : s));
    await updateMovementInDb(m);
  };

  const deleteMovement = async (id: string) => {
    setState((s) => (s ? { ...s, movements: s.movements.filter((x) => x.id !== id) } : s));
    await deleteMovementInDb(id);
  };

  const setProjectionCell = async (conceptId: string, monthKey: string, cantidad: number, precio: number) => {
    setState((s) =>
      s
        ? {
            ...s,
            projection: {
              ...s.projection,
              [conceptId]: { ...s.projection[conceptId], [monthKey]: { cantidad, precio } },
            },
          }
        : s
    );
    await upsertProjectionCell(conceptId, monthKey, cantidad, precio);
  };

  const clearProjectionCell = async (conceptId: string, monthKey: string) => {
    setState((s) => {
      if (!s) return s;
      const months = { ...s.projection[conceptId] };
      delete months[monthKey];
      return { ...s, projection: { ...s.projection, [conceptId]: months } };
    });
    await deleteProjectionCell(conceptId, monthKey);
  };

  const setFciCell = async (monthKey: string, field: "suscripciones" | "rescates", value: number) => {
    const current = state?.fci.data[monthKey] ?? { suscripciones: 0, rescates: 0 };
    const next = { ...current, [field]: value };
    setState((s) => (s ? { ...s, fci: { ...s.fci, data: { ...s.fci.data, [monthKey]: next } } } : s));
    await upsertFciMonthly(monthKey, field, value, current);
  };

  const setFciSaldoInicial = async (value: number) => {
    setState((s) => (s ? { ...s, fci: { ...s.fci, saldoInicial: value } } : s));
    await updateFciSaldoInicialInDb(value);
  };

  const setIvaCell = async (rowName: string, monthKey: string, monto: number) => {
    setState((s) => {
      if (!s) return s;
      const months = { ...s.iva[rowName] };
      if (monto === 0) delete months[monthKey];
      else months[monthKey] = monto;
      return { ...s, iva: { ...s.iva, [rowName]: months } };
    });
    await upsertIvaMonthly(rowName, monthKey, monto);
  };

  const setSettings = async (settings: CashflowState["settings"]) => {
    setState((s) => (s ? { ...s, settings } : s));
    await updateSettingsInDb(settings);
  };

  const reset = async () => {
    await resetToSeed();
    const fresh = await fetchAllData();
    setState(fresh);
  };

  const value: CashflowContextValue = {
    state,
    loading,
    error,
    addMovement,
    updateMovement,
    deleteMovement,
    setProjectionCell,
    clearProjectionCell,
    setFciCell,
    setFciSaldoInicial,
    setIvaCell,
    setSettings,
    reset,
  };

  return <CashflowContext.Provider value={value}>{children}</CashflowContext.Provider>;
}

export function useCashflow() {
  const ctx = useContext(CashflowContext);
  if (!ctx) throw new Error("useCashflow must be used within a CashflowProvider");
  return ctx;
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/context/CashflowContext.tsx
git commit -m "Add CashflowContext for state and Supabase-backed mutations"
```

---

## Task 10: Global styles (`app/globals.css`)

Pixel-perfect port of the `<style>` block from `project/Cashflow.html`. The only
change is the `body` font-family: it now references `--font-manrope`, a CSS
variable that Task 12 provides via `next/font/google` (so the font loads through
Next's font optimizer instead of the Google Fonts `<link>` tags used in the
prototype).

**Files:**
- Modify: `web/app/globals.css` (replace entire contents)

- [ ] **Step 1: Replace `web/app/globals.css` with the ported CSS**

```css
:root{
  --bg:#eef1f5; --panel:#ffffff; --panel-2:#f8fafc;
  --ink:#1a2433; --ink-soft:#3b4859; --muted:#7c8aa0; --faint:#aab4c4;
  --line:#e3e8ef; --line-strong:#cfd6e1;
  --accent:#2f6df0; --galicia:#e87613; --nacion:#1f7fc4;
  --pos:#15803d; --neg:#dc2626; --violet:#7a4ddb; --teal:#0d9488; --amber:#c2820a;
  --ui-scale:1;
  --radius:12px; --shadow:0 1px 2px rgba(16,24,40,.05),0 1px 3px rgba(16,24,40,.07);
  --shadow-lg:0 12px 40px -8px rgba(16,24,40,.22);
}
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{
  font-family: var(--font-manrope), system-ui, sans-serif;
  background:var(--bg); color:var(--ink);
  font-size:calc(14px * var(--ui-scale));
  -webkit-font-smoothing:antialiased;
}
body[data-density="compact"]{ --row-h:30px; --cell-pad:5px 9px; }
body[data-density="regular"]{ --row-h:38px; --cell-pad:8px 12px; }
body[data-density="comfy"]{ --row-h:46px; --cell-pad:11px 14px; }
.money,.inp--num,.grid td,.grid th{font-variant-numeric:tabular-nums;}
button{font-family:inherit;cursor:pointer;}
h1,h3{margin:0;}

/* ---------- App shell ---------- */
.app{display:flex;height:100vh;overflow:hidden;}
.sidebar{
  width:236px;flex-shrink:0;background:#15202e;color:#cdd6e3;
  display:flex;flex-direction:column;padding:18px 14px;gap:8px;
  transition:width .2s ease,padding .2s ease;
}
.brand{display:flex;align-items:center;gap:11px;padding:6px 8px 16px;position:relative;}
.collapse-btn{
  margin-left:auto;border:0;background:rgba(255,255,255,.07);color:#a9b4c5;
  width:26px;height:26px;border-radius:7px;font-size:14px;line-height:1;flex-shrink:0;transition:.12s;
}
.collapse-btn:hover{background:rgba(255,255,255,.16);color:#fff;}
.brand-mark{
  width:38px;height:38px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,var(--accent),#5b8cff);
  display:grid;place-items:center;color:#fff;font-weight:800;font-size:20px;
}
.brand-txt{display:flex;flex-direction:column;line-height:1.2;}
.brand-txt strong{font-size:16px;letter-spacing:.06em;color:#fff;}
.brand-txt span{font-size:11px;color:#7d8ba0;letter-spacing:.02em;}
.nav{display:flex;flex-direction:column;gap:3px;margin-top:4px;}
.nav-item{
  display:flex;align-items:center;gap:11px;border:0;background:transparent;
  color:#a9b4c5;padding:10px 12px;border-radius:9px;font-size:14px;font-weight:600;
  text-align:left;transition:.12s;
}
.nav-item:hover{background:rgba(255,255,255,.06);color:#fff;}
.nav-item.active{background:var(--accent);color:#fff;}
.nav-ico{width:18px;text-align:center;font-size:15px;opacity:.9;}
.sidebar-foot{
  margin-top:auto;background:rgba(255,255,255,.05);border-radius:10px;
  padding:12px 14px;display:flex;flex-direction:column;gap:3px;
}
.foot-k{font-size:11px;color:#8290a4;font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
.foot-v{font-size:18px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;}

/* ---------- Sidebar collapsed ---------- */
.app.collapsed .sidebar{width:70px;padding:18px 10px;}
.app.collapsed .brand{justify-content:center;padding:6px 0 16px;}
.app.collapsed .brand-txt{display:none;}
.app.collapsed .collapse-btn{position:absolute;top:-2px;right:-4px;margin-left:0;}
.app.collapsed .nav-item{justify-content:center;padding:11px 0;}
.app.collapsed .nav-label{display:none;}
.app.collapsed .nav-ico{font-size:17px;}
.app.collapsed .sidebar-foot{padding:10px 4px;text-align:center;}
.app.collapsed .foot-k{display:none;}
.app.collapsed .foot-v{font-size:11px;letter-spacing:-.02em;}

.main{flex:1;overflow:auto;padding:26px 30px 60px;}
.view{max-width:100%;}
.view-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px;}
.view-head h1{font-size:25px;font-weight:800;letter-spacing:-.01em;}
.view-sub{margin:5px 0 0;color:var(--muted);font-size:13px;}

/* ---------- Buttons ---------- */
.btn{border:1px solid transparent;border-radius:9px;padding:9px 16px;font-size:13.5px;font-weight:700;transition:.12s;}
.btn--primary{background:var(--accent);color:#fff;}
.btn--primary:hover{filter:brightness(1.07);}
.btn--ghost{background:var(--panel);color:var(--ink-soft);border-color:var(--line-strong);}
.btn--ghost:hover{background:var(--panel-2);}
.btn--danger{background:#fff;color:var(--neg);border-color:#f3c2c2;}
.btn--danger:hover{background:#fef2f2;}
.icon-btn{border:0;background:transparent;color:var(--muted);font-size:15px;width:30px;height:30px;border-radius:7px;}
.icon-btn:hover{background:var(--panel-2);color:var(--ink);}

/* ---------- Bank tabs ---------- */
.bank-tabs{display:flex;gap:10px;margin-bottom:16px;}
.bank-tab{
  display:flex;align-items:center;gap:9px;background:var(--panel);border:1.5px solid var(--line);
  border-radius:11px;padding:11px 16px;font-size:14px;font-weight:700;color:var(--ink-soft);transition:.12s;
}
.bank-tab:hover{border-color:var(--line-strong);}
.bank-tab.active{border-color:var(--bk);box-shadow:0 0 0 3px color-mix(in srgb,var(--bk) 16%,transparent);color:var(--ink);}
.bank-dot{width:11px;height:11px;border-radius:50%;background:var(--bk);}
.bank-count{background:var(--panel-2);border:1px solid var(--line);border-radius:20px;padding:1px 9px;font-size:12px;color:var(--muted);}
.bank-tab.active .bank-count{background:color-mix(in srgb,var(--bk) 14%,#fff);border-color:transparent;color:var(--bk);}

/* ---------- Summary card ---------- */
.sumcard{background:var(--panel);border:1px solid var(--line);border-top:3px solid var(--bk);border-radius:var(--radius);box-shadow:var(--shadow);margin-bottom:18px;overflow:hidden;}
.sumcard-grid{display:flex;flex-wrap:wrap;}
.sumcard-item{flex:1 1 150px;min-width:150px;padding:14px 18px;border-right:1px solid var(--line);display:flex;flex-direction:column;gap:5px;}
.sumcard-item:last-child{border-right:0;}
.sumcard-item--final{background:color-mix(in srgb,var(--bk) 7%,#fff);}
.sumcard-k{font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.03em;}
.sumcard-v{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;}
.sumcard-v.big{font-size:20px;font-weight:800;}
.sumcard-v.pos{color:var(--pos);} .sumcard-v.neg{color:var(--neg);}
.sumcard-control{padding:7px 18px;font-size:12.5px;font-weight:700;border-top:1px solid var(--line);}
.sumcard-control.ok{color:var(--pos);background:#f0fdf4;}
.sumcard-control.err{color:var(--neg);background:#fef2f2;}

/* ---------- Tables ---------- */
.table-wrap{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:auto;}
.grid{border-collapse:collapse;width:100%;font-size:13px;}
.grid thead th{
  position:sticky;top:0;z-index:3;background:var(--panel-2);
  text-align:left;font-weight:700;color:var(--muted);font-size:11.5px;
  text-transform:uppercase;letter-spacing:.03em;padding:10px 12px;
  border-bottom:1.5px solid var(--line-strong);white-space:nowrap;
}
.grid td{padding:var(--cell-pad);border-bottom:1px solid var(--line);height:var(--row-h);vertical-align:middle;}
.grid tbody tr.row:hover{background:#f7f9fc;}
.c-num{text-align:right;white-space:nowrap;}
.c-desc{font-weight:600;color:var(--ink);}
.c-prov{color:var(--ink-soft);}
.c-date,.c-chk{color:var(--muted);white-space:nowrap;font-size:12.5px;}
.c-act{text-align:right;white-space:nowrap;width:1%;}
.row-init{background:color-mix(in srgb,var(--bk) 6%,#fff);}
.row-init td{border-bottom:1.5px solid var(--line-strong);}
.empty{text-align:center;color:var(--muted);padding:32px;}

.money{font-variant-numeric:tabular-nums;color:var(--ink);}
.money--dim{color:var(--muted);}
.money--bold{font-weight:700;}
.money--neg{color:var(--neg);}
.money--pos{color:var(--pos);}

.rowbtn{border:0;background:transparent;color:var(--faint);font-size:14px;width:28px;height:28px;border-radius:6px;margin-left:2px;}
.rowbtn:hover{background:var(--panel-2);color:var(--accent);}
.rowbtn--del:hover{color:var(--neg);background:#fef2f2;}

/* chips */
.chip{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11.5px;font-weight:700;white-space:nowrap;}
.chip--in{background:#e9f7ef;color:#15803d;}
.chip--out{background:#fdecec;color:#dc2626;}
.chip--transf{background:#eef0fd;color:#4f46e5;}
.chip--usd{background:#e6f6f4;color:#0d9488;}
.chip--init{background:#f1f3f7;color:#64748b;}

/* ---------- Subtabs ---------- */
.subtabs{display:flex;gap:4px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:4px;margin-bottom:16px;width:max-content;box-shadow:var(--shadow);}
.subtab{border:0;background:transparent;padding:8px 16px;border-radius:7px;font-size:13.5px;font-weight:700;color:var(--muted);}
.subtab:hover{color:var(--ink);}
.subtab.active{background:var(--accent);color:#fff;}

/* ---------- Matrix ---------- */
.matrix-wrap{max-height:calc(100vh - 220px);}
.matrix{font-size:12.5px;}
.matrix .c-mon{text-align:right;min-width:104px;}
.matrix .c-total{text-align:right;background:var(--panel-2);position:sticky;right:0;z-index:2;border-left:1.5px solid var(--line-strong);}
.matrix thead .c-total{z-index:5;}
.sticky-col{position:sticky;left:0;z-index:2;background:var(--panel);min-width:230px;max-width:230px;box-shadow:1px 0 0 var(--line);}
.matrix thead .sticky-col{z-index:6;background:var(--panel-2);}
.c-rowhead{font-weight:600;color:var(--ink);white-space:nowrap;}
.mrow-name{display:block;font-weight:600;}
.mrow-name.pos{color:var(--pos);} .mrow-name.neg{color:var(--neg);}
.mrow-unit{display:block;font-size:11px;color:var(--faint);font-weight:600;}
.c-cell{text-align:right;cursor:default;}
.matrix .c-cell{padding:6px 12px;border-bottom:1px solid var(--line);border-left:1px solid var(--line);}
td.c-cell{cursor:pointer;transition:.1s;}
td.c-cell:hover{background:color-mix(in srgb,var(--accent) 8%,#fff);box-shadow:inset 0 0 0 1.5px color-mix(in srgb,var(--accent) 35%,transparent);}
.cell-amt{font-weight:600;font-variant-numeric:tabular-nums;}
.cell-sub{display:block;font-size:10.5px;color:var(--faint);font-weight:600;}
.cell-add{color:var(--faint);font-size:15px;opacity:0;transition:.1s;}
td.c-cell:hover .cell-add{opacity:1;}
.mrow--total td{background:var(--panel-2);border-top:1.5px solid var(--line-strong);font-weight:700;}
.mrow--total .c-cell{cursor:default;}
.mrow--total td.c-cell:hover{background:var(--panel-2);box-shadow:none;}

.inline-setting{display:flex;align-items:center;gap:14px;margin-bottom:14px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 16px;width:max-content;box-shadow:var(--shadow);}
.inline-setting>span:first-child{font-weight:700;font-size:13.5px;}
.inline-money{width:200px;}

/* ---------- Cashflow specific ---------- */
.cf-table{font-size:12.5px;}
.cf-cell{text-align:right;padding:6px 12px;border-bottom:1px solid var(--line);border-left:1px solid var(--line);white-space:nowrap;}
.cf-row:hover{background:#f7f9fc;}
.cf-section td{background:#1a2433;color:#fff;font-weight:800;font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:7px 12px;border-bottom:0;}
.cf-section .sticky-col{background:#1a2433;color:#fff;border-left:3px solid var(--acc,var(--accent));}
.cf-section .c-total{background:#1a2433;}
.cf-strong td{background:var(--panel-2);font-weight:700;border-top:1px solid var(--line-strong);border-bottom:1.5px solid var(--line-strong);}
.cf-strong .sticky-col{background:var(--panel-2);}
.cf-grand td{background:#eaf0fe;font-weight:800;border-top:2px solid var(--accent);border-bottom:2px solid var(--accent);}
.cf-grand .sticky-col{background:#eaf0fe;color:var(--accent);}
.cf-grand .c-total{background:#eaf0fe;}
.cf-prodhead td{background:#f3f6fa;font-weight:700;color:var(--ink);font-size:12px;}
.cf-prodhead .sticky-col{background:#f3f6fa;}
.neg-row .money{color:var(--neg);}

/* ---------- Modal ---------- */
.modal-backdrop{position:fixed;inset:0;background:rgba(16,24,40,.45);backdrop-filter:blur(2px);display:grid;place-items:center;z-index:50;padding:20px;}
.modal{background:var(--panel);border-radius:16px;box-shadow:var(--shadow-lg);max-width:94vw;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--line);}
.modal-head h3{font-size:16.5px;font-weight:800;}
.modal-body{padding:22px;overflow:auto;}
.modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 22px;border-top:1px solid var(--line);background:var(--panel-2);}
.confirm-msg{margin:0;font-size:14.5px;color:var(--ink-soft);line-height:1.5;}

/* ---------- Forms ---------- */
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;}
.field{display:flex;flex-direction:column;gap:6px;}
.field--wide{grid-column:1 / -1;}
.field-label{font-size:12.5px;font-weight:700;color:var(--ink-soft);}
.field-hint{font-size:11.5px;color:var(--muted);}
.inp{width:100%;border:1.5px solid var(--line-strong);border-radius:9px;padding:9px 12px;font-size:14px;font-family:inherit;color:var(--ink);background:#fff;transition:.12s;}
.inp:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 16%,transparent);}
.inp--num{text-align:right;font-variant-numeric:tabular-nums;}
select.inp{cursor:pointer;}
.form-tip{margin:16px 0 0;font-size:12.5px;color:var(--muted);background:var(--panel-2);border-radius:8px;padding:10px 12px;}
.cell-total{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding:13px 16px;background:#eaf0fe;border-radius:10px;}
.cell-total span{font-weight:700;color:var(--ink-soft);}
.cell-total strong{font-size:19px;font-weight:800;color:var(--accent);font-variant-numeric:tabular-nums;}

/* ---------- Settings ---------- */
.settings-card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:20px 22px;margin-bottom:16px;max-width:640px;}
.settings-card h3{font-size:15px;font-weight:800;margin-bottom:14px;}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.settings-note{font-size:13px;color:var(--muted);margin:0 0 14px;}

#root,.app{height:100vh;}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/globals.css
git commit -m "Port pixel-perfect styles from the prototype"
```

(`npm run build` is run at the end of Task 12, once `layout.tsx` provides the
`--font-manrope` variable this CSS references.)

---

## Task 11: Shared UI primitives

Ports `project/app/components.jsx` to typed React components: `Modal`, `Field`,
`MoneyInput`, `NumInput`, `GroupChip`, `Confirm`, `Money`. These are consumed by
every view task (13-16).

**Files:**
- Create: `web/components/ui/index.tsx`

- [ ] **Step 1: Write `web/components/ui/index.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { money, num, parseNum } from "@/lib/format";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal to <body>: callers may render a Modal inside a <table>/<tbody>
  // (e.g. the Proyección matrix), where a fixed-position backdrop div
  // would otherwise be invalid HTML nesting.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={"field" + (wide ? " field--wide" : "")}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value ? money(value) : "");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  return (
    <input
      ref={ref}
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
      onBlur={(e) => {
        const v = parseNum(e.target.value);
        setText(v ? money(v) : "");
      }}
    />
  );
}

export function NumInput({
  value,
  onChange,
  placeholder = "0",
  decimals = false,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  decimals?: boolean;
}) {
  const [text, setText] = useState(value ? (decimals ? money(value) : num(value)) : "");

  return (
    <input
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
      onBlur={(e) => {
        const v = parseNum(e.target.value);
        setText(v ? (decimals ? money(v) : num(v)) : "");
      }}
    />
  );
}

const GROUP_CHIP_CLASS: Record<string, string> = {
  Ingresos: "chip--in",
  Pagos: "chip--out",
  "Transf entre cuentas": "chip--transf",
  "Ingreso por Venta de USD": "chip--usd",
  "Saldo Inicial": "chip--init",
};

export function GroupChip({ group }: { group: string }) {
  return <span className={"chip " + (GROUP_CHIP_CLASS[group] || "")}>{group}</span>;
}

export function Confirm({
  message,
  onYes,
  onNo,
}: {
  message: string;
  onYes: () => void;
  onNo: () => void;
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
          <button className="btn btn--danger" onClick={onYes}>
            Eliminar
          </button>
        </>
      }
    >
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}

export function Money({
  v,
  decimals = true,
  dim,
  bold,
  signed,
}: {
  v: number;
  decimals?: boolean;
  dim?: boolean;
  bold?: boolean;
  signed?: boolean;
}) {
  const cls = ["money"];
  if (dim) cls.push("money--dim");
  if (bold) cls.push("money--bold");
  if (signed && v < 0) cls.push("money--neg");
  if (signed && v > 0) cls.push("money--pos");
  return <span className={cls.join(" ")}>{money(v, decimals)}</span>;
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/ui/index.tsx
git commit -m "Add shared UI primitives (Modal, Field, inputs, Money, Confirm)"
```

---

## Task 12: App shell — layout, sidebar, root redirect

Ports the shell/nav portion of `project/app/App.jsx` (everything except `Ajustes`,
which is Task 16, and the Tweaks panel, which is not ported). The sidebar's
"Cierre Banco + FCI" figure comes from `buildCashflow(state)`, so this task also
performs the first real end-to-end check of `CashflowContext` (Task 9) against
live Supabase data.

**Files:**
- Modify: `web/app/layout.tsx`
- Modify: `web/app/page.tsx`
- Create: `web/components/AppShell.tsx`
- Create: `web/components/Sidebar.tsx`

- [ ] **Step 1: Write `web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { CashflowProvider } from "@/context/CashflowContext";
import { AppShell } from "@/components/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "CASHFLOW · Galicia · Nación",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={manrope.variable} data-density="regular">
        <CashflowProvider>
          <AppShell>{children}</AppShell>
        </CashflowProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Write `web/components/Sidebar.tsx`**

```tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { buildCashflow } from "@/lib/calc";
import { money } from "@/lib/format";
import { useCashflow } from "@/context/CashflowContext";

const NAV = [
  { href: "/movimientos", label: "Movimientos", icon: "↹" },
  { href: "/proyeccion", label: "Proyección", icon: "◳" },
  { href: "/cashflow", label: "Cashflow", icon: "▦" },
  { href: "/ajustes", label: "Ajustes", icon: "⚙" },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state } = useCashflow();

  let cierre = 0;
  if (state) {
    const cf = buildCashflow(state);
    const last = cf.rows[cf.rows.length - 1];
    cierre = last ? last.cierreTotal : 0;
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">$</div>
        <div className="brand-txt">
          <strong>CASHFLOW</strong>
          <span>Galicia · Nación</span>
        </div>
        <button
          className="collapse-btn"
          onClick={onToggleCollapsed}
          title={collapsed ? "Expandir menú" : "Replegar menú"}
          aria-label="Replegar menú"
        >
          {collapsed ? "»" : "«"}
        </button>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.href}
            className={"nav-item" + (pathname === n.href ? " active" : "")}
            onClick={() => router.push(n.href)}
            title={n.label}
          >
            <span className="nav-ico">{n.icon}</span>
            <span className="nav-label">{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="foot-k">Cierre Banco + FCI</span>
        <span className="foot-v">{money(cierre, false)}</span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Write `web/components/AppShell.tsx`**

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("cf_sidebar_collapsed") === "1");
    } catch {
      // localStorage unavailable, keep default
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("cf_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // localStorage unavailable, ignore
      }
      return next;
    });
  };

  return (
    <div className={"app" + (collapsed ? " collapsed" : "")}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="main">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Replace `web/app/page.tsx` with a redirect**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/movimientos");
}
```

- [ ] **Step 5: Build**

```bash
cd web && npm run build
```

Expected: build succeeds (the `/movimientos` route 404s until Task 13 — that's
expected for now).

- [ ] **Step 6: Commit**

```bash
git add web/app/layout.tsx web/app/page.tsx web/components/AppShell.tsx web/components/Sidebar.tsx
git commit -m "Add app shell: layout, sidebar, and root redirect"
```

---

## Task 13: Movimientos view

Ports `project/app/Movimientos.jsx`: per-bank movement list with running balance,
a summary card, and an add/edit modal. Mutations go through `useCashflow()`
(`addMovement`, `updateMovement`, `deleteMovement`) instead of the prototype's
`dispatch`.

**Files:**
- Create: `web/components/movimientos/BankSummaryCard.tsx`
- Create: `web/components/movimientos/MovEditor.tsx`
- Create: `web/app/movimientos/page.tsx`

- [ ] **Step 1: Write `web/components/movimientos/BankSummaryCard.tsx`**

```tsx
import { BANKS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { BankId, BankSummary } from "@/lib/types";

export function BankSummaryCard({ summary, bankId }: { summary: BankSummary; bankId: BankId }) {
  const b = BANKS.find((x) => x.id === bankId)!;
  const items: { k: string; v: number; cls?: string }[] = [
    { k: "Saldo Inicial", v: summary.inicial },
    { k: "Ingresos", v: summary.ingresos, cls: "pos" },
    { k: "Venta de USD", v: summary.ventaUSD, cls: "pos" },
    { k: "Pagos", v: summary.pagos, cls: "neg" },
    { k: "Transf entre cuentas", v: summary.transf },
  ];

  return (
    <div className="sumcard" style={{ "--bk": b.color } as React.CSSProperties}>
      <div className="sumcard-grid">
        {items.map((it) => (
          <div className="sumcard-item" key={it.k}>
            <span className="sumcard-k">{it.k}</span>
            <span className={"sumcard-v " + (it.cls || "")}>{money(it.v)}</span>
          </div>
        ))}
        <div className="sumcard-item sumcard-item--final">
          <span className="sumcard-k">Saldo final</span>
          <span className="sumcard-v big">{money(summary.final)}</span>
        </div>
      </div>
      <div className={"sumcard-control " + (Math.abs(summary.control) < 0.01 ? "ok" : "err")}>
        {Math.abs(summary.control) < 0.01 ? "✓ Control OK" : "⚠ Control: " + money(summary.control)}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/components/movimientos/MovEditor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";
import { BANKS, GROUPS } from "@/lib/constants";
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

export function MovEditor({
  bankId,
  initial,
  onSave,
  onClose,
}: {
  bankId: BankId;
  initial: Movement | null;
  onSave: (mov: Movement | Omit<Movement, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<MovForm>(initial ? { ...initial } : { ...BLANK });
  const set = <K extends keyof MovForm>(k: K, v: MovForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const isIn = ["Ingresos", "Ingreso por Venta de USD"].includes(f.grupo);
  const bank = BANKS.find((b) => b.id === bankId)!;

  const save = () => {
    if (!f.descripcion.trim()) {
      alert("La descripción es obligatoria.");
      return;
    }
    if (!f.fechaPago) {
      alert("La fecha de pago es obligatoria (define el mes del cashflow).");
      return;
    }
    if (initial) {
      onSave({ ...f, bank: bankId, id: initial.id });
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
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={save}>{initial ? "Guardar cambios" : "Agregar"}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Descripción" wide>
          <input className="inp" autoFocus value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Ej: ESTACION EL BAJO" />
        </Field>
        <Field label="Proveedor / Cliente" wide>
          <input className="inp" value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Agrupación" wide>
          <select className="inp" value={f.grupo} onChange={(e) => set("grupo", e.target.value)}>
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
    </Modal>
  );
}
```

- [ ] **Step 3: Write `web/app/movimientos/page.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { bankRows, bankSummary } from "@/lib/calc";
import { BANKS } from "@/lib/constants";
import { money } from "@/lib/format";
import type { BankId, Movement } from "@/lib/types";
import { Money, GroupChip, Confirm } from "@/components/ui";
import { MovEditor } from "@/components/movimientos/MovEditor";
import { BankSummaryCard } from "@/components/movimientos/BankSummaryCard";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function MovimientosPage() {
  const { state, addMovement, updateMovement, deleteMovement } = useCashflow();
  const [bankId, setBankId] = useState<BankId>("galicia");
  const [editing, setEditing] = useState<Movement | "new" | null>(null);
  const [confirm, setConfirm] = useState<Movement | null>(null);

  const rows = useMemo(() => (state ? bankRows(state, bankId) : []), [state, bankId]);
  const summary = useMemo(() => (state ? bankSummary(state, bankId) : null), [state, bankId]);

  if (!state || !summary) return null;

  const b = BANKS.find((x) => x.id === bankId)!;

  const saveMov = (mov: Movement | Omit<Movement, "id">) => {
    if ("id" in mov) {
      updateMovement(mov);
    } else {
      addMovement(mov);
    }
    setEditing(null);
  };

  const delMov = (id: string) => {
    deleteMovement(id);
    setConfirm(null);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Movimientos</h1>
          <p className="view-sub">Carga diaria por banco · se resumen automáticamente en el Cashflow por fecha de pago.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo movimiento</button>
      </div>

      <div className="bank-tabs">
        {BANKS.map((bk) => (
          <button
            key={bk.id}
            className={"bank-tab" + (bankId === bk.id ? " active" : "")}
            style={{ "--bk": bk.color } as React.CSSProperties}
            onClick={() => setBankId(bk.id)}
          >
            <span className="bank-dot"></span>{bk.name}
            <span className="bank-count">{state.movements.filter((m) => m.bank === bk.id).length}</span>
          </button>
        ))}
      </div>

      <BankSummaryCard summary={summary} bankId={bankId} />

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="c-desc">Descripción</th>
              <th className="c-prov">Proveedor / Cliente</th>
              <th className="c-date">F. emisión</th>
              <th className="c-date">F. pago</th>
              <th className="c-chk">Cheque</th>
              <th className="c-grp">Agrupación</th>
              <th className="c-num">Crédito</th>
              <th className="c-num">Débito</th>
              <th className="c-num">Saldo</th>
              <th className="c-act"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-init" style={{ "--bk": b.color } as React.CSSProperties}>
              <td className="c-desc"><strong>Saldo Inicial</strong></td>
              <td colSpan={7}></td>
              <td className="c-num"><Money v={summary.inicial} bold /></td>
              <td></td>
            </tr>
            {rows.map((r) => (
              <tr key={r.id} className="row" onDoubleClick={() => setEditing(r)}>
                <td className="c-desc">{r.descripcion}</td>
                <td className="c-prov">{r.proveedor}</td>
                <td className="c-date">{fmtDate(r.fechaEmision)}</td>
                <td className="c-date">{fmtDate(r.fechaPago)}</td>
                <td className="c-chk">{r.cheque}</td>
                <td className="c-grp"><GroupChip group={r.grupo} /></td>
                <td className="c-num">{r.credito ? <Money v={r.credito} signed /> : ""}</td>
                <td className="c-num">{r.debito ? <span className="money money--neg">{money(r.debito)}</span> : ""}</td>
                <td className="c-num"><Money v={r.saldo} signed bold /></td>
                <td className="c-act">
                  <button className="rowbtn" title="Editar" onClick={() => setEditing(r)}>✎</button>
                  <button className="rowbtn rowbtn--del" title="Eliminar" onClick={() => setConfirm(r)}>🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="empty">Sin movimientos. Agregá el primero con “+ Nuevo movimiento”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <MovEditor
          bankId={bankId}
          initial={editing === "new" ? null : editing}
          onSave={saveMov}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <Confirm
          message={`¿Eliminar el movimiento “${confirm.descripcion}”?`}
          onYes={() => delMov(confirm.id)}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Type-check and build**

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: no errors. `/movimientos` now builds as a real route.

- [ ] **Step 5: Commit**

```bash
git add web/components/movimientos web/app/movimientos
git commit -m "Add Movimientos view"
```

---

## Task 14: Proyección view

Ports `project/app/Proyeccion.jsx`: three matrix sub-tabs (Ingresos proyectados,
FCI/Inversiones, Ventas netas IVA), each editable cell-by-cell via a modal.
Mutations go through `useCashflow()` (`setProjectionCell`, `clearProjectionCell`,
`setFciCell`, `setFciSaldoInicial`, `setIvaCell`).

**Files:**
- Create: `web/components/proyeccion/MatrixShell.tsx`
- Create: `web/components/proyeccion/CellQPEditor.tsx`
- Create: `web/components/proyeccion/CellMoneyEditor.tsx`
- Create: `web/components/proyeccion/ProjTab.tsx`
- Create: `web/components/proyeccion/FciTab.tsx`
- Create: `web/components/proyeccion/IvaTab.tsx`
- Create: `web/app/proyeccion/page.tsx`

- [ ] **Step 1: Write `web/components/proyeccion/MatrixShell.tsx`**

```tsx
import type { ReactNode } from "react";
import { monthLabel } from "@/lib/dates";

export function MatrixShell({
  months,
  children,
  firstColLabel,
}: {
  months: string[];
  children: ReactNode;
  firstColLabel: string;
}) {
  return (
    <div className="table-wrap matrix-wrap">
      <table className="grid matrix">
        <thead>
          <tr>
            <th className="c-rowhead sticky-col">{firstColLabel}</th>
            {months.map((mk) => (
              <th key={mk} className="c-mon">{monthLabel(mk)}</th>
            ))}
            <th className="c-mon c-total">Total</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write `web/components/proyeccion/CellQPEditor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Modal, Field, NumInput, MoneyInput } from "@/components/ui";
import { money } from "@/lib/format";
import { monthLong } from "@/lib/dates";
import type { ProjConcept, ProjectionValue } from "@/lib/types";

export function CellQPEditor({
  concept,
  monthKey,
  value,
  onSave,
  onClose,
}: {
  concept: ProjConcept;
  monthKey: string;
  value: ProjectionValue | undefined;
  onSave: (val: ProjectionValue | null) => void;
  onClose: () => void;
}) {
  const [cant, setCant] = useState(value ? value.cantidad : 0);
  const [precio, setPrecio] = useState(value ? value.precio : 0);
  const total = (Number(cant) || 0) * (Number(precio) || 0);

  return (
    <Modal
      title={concept.name + " · " + monthLong(monthKey)}
      width={440}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onSave(null)}>Vaciar</button>
          <button className="btn btn--primary" onClick={() => onSave({ cantidad: Number(cant) || 0, precio: Number(precio) || 0 })}>Guardar</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={"Cantidad (" + concept.unidad + ")"}>
          <NumInput value={cant} onChange={setCant} />
        </Field>
        <Field label="Precio unitario">
          <MoneyInput value={precio} onChange={setPrecio} />
        </Field>
      </div>
      <div className="cell-total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
      {concept.tipo === "monto" && (
        <p className="form-tip">Concepto por monto: dejá Cantidad en 1 y cargá el importe en Precio.</p>
      )}
    </Modal>
  );
}
```

- [ ] **Step 3: Write `web/components/proyeccion/CellMoneyEditor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";

export function CellMoneyEditor({
  title,
  value,
  onSave,
  onClose,
}: {
  title: string;
  value: number;
  onSave: (val: number) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(value || 0);
  return (
    <Modal
      title={title}
      width={400}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onSave(0)}>Vaciar</button>
          <button className="btn btn--primary" onClick={() => onSave(Number(v) || 0)}>Guardar</button>
        </>
      }
    >
      <Field label="Importe">
        <MoneyInput value={v} onChange={setV} autoFocus />
      </Field>
    </Modal>
  );
}
```

- [ ] **Step 4: Write `web/components/proyeccion/ProjTab.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { projMonthTotal, projTotal } from "@/lib/calc";
import { PROJ_CONCEPTS } from "@/lib/constants";
import { money, num } from "@/lib/format";
import type { CashflowState, ProjectionValue } from "@/lib/types";
import { Money } from "@/components/ui";
import { MatrixShell } from "./MatrixShell";
import { CellQPEditor } from "./CellQPEditor";

export function ProjTab({ state, months }: { state: CashflowState; months: string[] }) {
  const { setProjectionCell, clearProjectionCell } = useCashflow();
  const [edit, setEdit] = useState<{ conceptId: string; monthKey: string } | null>(null);
  const concept = edit ? PROJ_CONCEPTS.find((c) => c.id === edit.conceptId) ?? null : null;

  const saveCell = (val: ProjectionValue | null) => {
    if (!edit) return;
    const { conceptId, monthKey } = edit;
    if (!val || ((val.cantidad || 0) === 0 && (val.precio || 0) === 0)) {
      clearProjectionCell(conceptId, monthKey);
    } else {
      setProjectionCell(conceptId, monthKey, val.cantidad, val.precio);
    }
    setEdit(null);
  };

  const colTotal = (mk: string) => projMonthTotal(state, mk);
  const rowTotal = (cid: string) => months.reduce((a, mk) => a + projTotal(state, cid, mk), 0);
  const grand = months.reduce((a, mk) => a + colTotal(mk), 0);

  return (
    <MatrixShell months={months} firstColLabel="Concepto proyectado">
      {PROJ_CONCEPTS.map((c) => (
        <tr key={c.id} className="mrow">
          <td className="c-rowhead sticky-col">
            <span className="mrow-name">{c.name}</span>
            <span className="mrow-unit">{c.unidad}</span>
          </td>
          {months.map((mk) => {
            const t = projTotal(state, c.id, mk);
            const cell = state.projection[c.id][mk];
            return (
              <td key={mk} className={"c-cell" + (t ? " has" : "")} onClick={() => setEdit({ conceptId: c.id, monthKey: mk })}>
                {t ? <span className="cell-amt">{money(t, false)}</span> : <span className="cell-add">+</span>}
                {cell && c.tipo === "unidad" && (
                  <span className="cell-sub">{num(cell.cantidad)}×{money(cell.precio, false)}</span>
                )}
              </td>
            );
          })}
          <td className="c-cell c-total"><Money v={rowTotal(c.id)} decimals={false} bold /></td>
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>Total Ingresos Proyectados</strong></td>
        {months.map((mk) => (
          <td key={mk} className="c-cell c-total"><Money v={colTotal(mk)} decimals={false} bold /></td>
        ))}
        <td className="c-cell c-total"><Money v={grand} decimals={false} bold /></td>
      </tr>
      {edit && concept && (
        <CellQPEditor
          concept={concept}
          monthKey={edit.monthKey}
          value={state.projection[edit.conceptId][edit.monthKey]}
          onSave={saveCell}
          onClose={() => setEdit(null)}
        />
      )}
    </MatrixShell>
  );
}
```

- [ ] **Step 5: Write `web/components/proyeccion/FciTab.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { money } from "@/lib/format";
import { monthLong } from "@/lib/dates";
import type { CashflowState } from "@/lib/types";
import { Money, MoneyInput } from "@/components/ui";
import { MatrixShell } from "./MatrixShell";
import { CellMoneyEditor } from "./CellMoneyEditor";

const FIELDS: { id: "suscripciones" | "rescates"; label: string; cls: string }[] = [
  { id: "suscripciones", label: "Suscripciones", cls: "pos" },
  { id: "rescates", label: "Rescates", cls: "neg" },
];

export function FciTab({ state, months }: { state: CashflowState; months: string[] }) {
  const { setFciCell, setFciSaldoInicial } = useCashflow();
  const [edit, setEdit] = useState<{ field: "suscripciones" | "rescates"; monthKey: string } | null>(null);

  const saveCell = (val: number) => {
    if (!edit) return;
    setFciCell(edit.monthKey, edit.field, val);
    setEdit(null);
  };

  const saldoFinal = (idx: number) => {
    let saldo = state.fci.saldoInicial || 0;
    for (let i = 0; i <= idx; i++) {
      const d = state.fci.data[months[i]] ?? { suscripciones: 0, rescates: 0 };
      saldo += (d.suscripciones || 0) - (d.rescates || 0);
    }
    return saldo;
  };

  return (
    <>
      <div className="inline-setting">
        <span>Saldo Inicial FCI</span>
        <span className="inline-money">
          <MoneyInput value={state.fci.saldoInicial} onChange={setFciSaldoInicial} />
        </span>
      </div>
      <MatrixShell months={months} firstColLabel="FCI / Inversiones">
        {FIELDS.map((f) => (
          <tr key={f.id} className="mrow">
            <td className="c-rowhead sticky-col"><span className={"mrow-name " + f.cls}>{f.label}</span></td>
            {months.map((mk) => {
              const v = (state.fci.data[mk] ?? { suscripciones: 0, rescates: 0 })[f.id];
              return (
                <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={() => setEdit({ field: f.id, monthKey: mk })}>
                  {v ? <span className="cell-amt">{money(v, false)}</span> : <span className="cell-add">+</span>}
                </td>
              );
            })}
            <td className="c-cell c-total">
              <Money
                v={months.reduce((a, mk) => a + (state.fci.data[mk] ?? { suscripciones: 0, rescates: 0 })[f.id], 0)}
                decimals={false}
                bold
              />
            </td>
          </tr>
        ))}
        <tr className="mrow mrow--total">
          <td className="c-rowhead sticky-col"><strong>Saldo Final Inversiones</strong></td>
          {months.map((mk, idx) => (
            <td key={mk} className="c-cell c-total"><Money v={saldoFinal(idx)} decimals={false} bold /></td>
          ))}
          <td className="c-cell c-total"></td>
        </tr>
        {edit && (
          <CellMoneyEditor
            title={(edit.field === "suscripciones" ? "Suscripciones" : "Rescates") + " · " + monthLong(edit.monthKey)}
            value={(state.fci.data[edit.monthKey] ?? { suscripciones: 0, rescates: 0 })[edit.field]}
            onSave={saveCell}
            onClose={() => setEdit(null)}
          />
        )}
      </MatrixShell>
    </>
  );
}
```

- [ ] **Step 6: Write `web/components/proyeccion/IvaTab.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { money } from "@/lib/format";
import { monthLong } from "@/lib/dates";
import { IVA_ROWS } from "@/lib/constants";
import type { CashflowState } from "@/lib/types";
import { Money } from "@/components/ui";
import { MatrixShell } from "./MatrixShell";
import { CellMoneyEditor } from "./CellMoneyEditor";

export function IvaTab({ state, months }: { state: CashflowState; months: string[] }) {
  const { setIvaCell } = useCashflow();
  const [edit, setEdit] = useState<{ row: string; monthKey: string } | null>(null);

  const saveCell = (val: number) => {
    if (!edit) return;
    setIvaCell(edit.row, edit.monthKey, val);
    setEdit(null);
  };

  const colTotal = (mk: string) => IVA_ROWS.reduce((a, r) => a + (state.iva[r]?.[mk] || 0), 0);
  const rowTotal = (r: string) => months.reduce((a, mk) => a + (state.iva[r]?.[mk] || 0), 0);

  return (
    <MatrixShell months={months} firstColLabel="Ventas netas s/ libros IVA">
      {IVA_ROWS.map((r) => (
        <tr key={r} className="mrow">
          <td className="c-rowhead sticky-col"><span className="mrow-name">{r}</span></td>
          {months.map((mk) => {
            const v = state.iva[r]?.[mk] || 0;
            return (
              <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={() => setEdit({ row: r, monthKey: mk })}>
                {v ? <span className="cell-amt">{money(v, false)}</span> : <span className="cell-add">+</span>}
              </td>
            );
          })}
          <td className="c-cell c-total"><Money v={rowTotal(r)} decimals={false} bold /></td>
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>S/ Libro IVA Ventas</strong></td>
        {months.map((mk) => (
          <td key={mk} className="c-cell c-total"><Money v={colTotal(mk)} decimals={false} bold /></td>
        ))}
        <td className="c-cell c-total"><Money v={months.reduce((a, mk) => a + colTotal(mk), 0)} decimals={false} bold /></td>
      </tr>
      {edit && (
        <CellMoneyEditor
          title={edit.row + " · " + monthLong(edit.monthKey)}
          value={state.iva[edit.row]?.[edit.monthKey] || 0}
          onSave={saveCell}
          onClose={() => setEdit(null)}
        />
      )}
    </MatrixShell>
  );
}
```

- [ ] **Step 7: Write `web/app/proyeccion/page.tsx`**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { monthRange } from "@/lib/dates";
import { ProjTab } from "@/components/proyeccion/ProjTab";
import { FciTab } from "@/components/proyeccion/FciTab";
import { IvaTab } from "@/components/proyeccion/IvaTab";

const TABS = [
  { id: "proj", label: "Ingresos proyectados" },
  { id: "fci", label: "FCI / Inversiones" },
  { id: "iva", label: "Ventas netas IVA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProyeccionPage() {
  const { state } = useCashflow();
  const [tab, setTab] = useState<TabId>("proj");

  const months = useMemo(
    () => (state ? monthRange(state.settings.rangeStart, state.settings.rangeEnd) : []),
    [state]
  );

  if (!state) return null;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Proyección</h1>
          <p className="view-sub">Tocá cualquier celda para cargar valores. Los totales alimentan el Cashflow.</p>
        </div>
      </div>
      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={"subtab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "proj" && <ProjTab state={state} months={months} />}
      {tab === "fci" && <FciTab state={state} months={months} />}
      {tab === "iva" && <IvaTab state={state} months={months} />}
    </div>
  );
}
```

- [ ] **Step 8: Type-check and build**

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web/components/proyeccion web/app/proyeccion
git commit -m "Add Proyección view"
```

---

## Task 15: Cashflow (Resumen) view

Ports `project/app/Resumen.jsx`: a read-only table recalculated live from
`buildCashflow(state)`, showing bank balances, FCI/investment balances, projected
income, real-vs-budget, per-product detail, and net IVA sales. No mutations — this
view only reads `state` via `useCashflow()`.

**Files:**
- Create: `web/app/cashflow/page.tsx`

- [ ] **Step 1: Write `web/app/cashflow/page.tsx`**

```tsx
"use client";

import { Fragment, useMemo } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { buildCashflow, projTotal } from "@/lib/calc";
import { monthLabel } from "@/lib/dates";
import { PROJ_CONCEPTS, IVA_ROWS } from "@/lib/constants";
import { Money } from "@/components/ui";
import type { CashflowRow } from "@/lib/types";

interface RowOpts {
  cls?: string;
  indent?: boolean;
  totalMode?: "sum" | "last" | "none";
  blankZero?: boolean;
  bold?: boolean;
  signed?: boolean;
  dim?: boolean;
}

function CfRow({
  label,
  rows,
  get,
  opts = {},
}: {
  label: string;
  rows: CashflowRow[];
  get: (r: CashflowRow) => number;
  opts?: RowOpts;
}) {
  const vals = rows.map(get);
  const total =
    opts.totalMode === "last"
      ? vals.length ? vals[vals.length - 1] : 0
      : opts.totalMode === "none"
      ? null
      : vals.reduce((a, b) => a + (b || 0), 0);
  return (
    <tr className={"cf-row " + (opts.cls || "")}>
      <td className="c-rowhead sticky-col" style={opts.indent ? { paddingLeft: 28 } : undefined}>
        {label}
      </td>
      {vals.map((v, i) => (
        <td key={i} className="cf-cell">
          {opts.blankZero && !v ? "" : <Money v={v} decimals={false} bold={opts.bold} signed={opts.signed} dim={opts.dim} />}
        </td>
      ))}
      <td className="cf-cell c-total">
        {total === null ? "" : <Money v={total} decimals={false} bold signed={opts.signed} />}
      </td>
    </tr>
  );
}

function CfSectionRow({ label, months, accent }: { label: string; months: string[]; accent?: string }) {
  return (
    <tr className="cf-section" style={accent ? ({ "--acc": accent } as React.CSSProperties) : undefined}>
      <td className="c-rowhead sticky-col">{label}</td>
      {months.map((m) => (
        <td key={m} className="cf-cell"></td>
      ))}
      <td className="cf-cell c-total"></td>
    </tr>
  );
}

export default function CashflowPage() {
  const { state } = useCashflow();
  const cf = useMemo(() => (state ? buildCashflow(state) : { months: [], rows: [] }), [state]);
  const months = cf.months;
  const rows = cf.rows;

  if (!state) return null;

  const prodCant = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.cantidad : 0;
  };
  const prodPrecio = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.precio : 0;
  };
  const products = PROJ_CONCEPTS.filter((c) => c.grupo === "producto");

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cashflow · Resumen</h1>
          <p className="view-sub">
            {monthLabel(state.settings.rangeStart)} → {monthLabel(state.settings.rangeEnd)} · recalculado desde Movimientos y Proyección.
          </p>
        </div>
      </div>

      <div className="table-wrap matrix-wrap cf-wrap">
        <table className="grid matrix cf-table">
          <thead>
            <tr>
              <th className="c-rowhead sticky-col">Concepto</th>
              {months.map((m) => (
                <th key={m} className="c-mon">{monthLabel(m)}</th>
              ))}
              <th className="c-mon c-total">Total</th>
            </tr>
          </thead>
          <tbody>
            <CfSectionRow label="BANCOS" months={months} accent="var(--accent)" />
            <CfRow label="Saldo Inicial Bancos" rows={rows} get={(r) => r.saldoInicialBanco} opts={{ totalMode: "none", dim: true }} />
            <CfRow label="Ingresos" rows={rows} get={(r) => r.ingresos} opts={{ blankZero: true }} />
            <CfRow label="Ingreso por Venta de USD" rows={rows} get={(r) => r.ventaUSD} opts={{ blankZero: true }} />
            <CfRow label="Pagos" rows={rows} get={(r) => r.pagos} opts={{ blankZero: true, cls: "neg-row" }} />
            <CfRow label="Inversiones en FCI" rows={rows} get={(r) => r.invFCI} opts={{ blankZero: true, signed: true }} />
            <CfRow label="Transf entre cuentas" rows={rows} get={(r) => r.transf} opts={{ blankZero: true, signed: true }} />
            <CfRow label="Saldo final Bancos" rows={rows} get={(r) => r.saldoFinalBanco} opts={{ cls: "cf-strong", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="FCI / INVERSIONES" months={months} accent="var(--violet)" />
            <CfRow label="Saldo Inicial FCI" rows={rows} get={(r) => r.saldoInicialFci} opts={{ totalMode: "none", dim: true }} />
            <CfRow label="Suscripciones" rows={rows} get={(r) => r.suscripciones} opts={{ blankZero: true }} />
            <CfRow label="Rescates" rows={rows} get={(r) => r.rescates} opts={{ blankZero: true }} />
            <CfRow label="Saldo Final Inversiones" rows={rows} get={(r) => r.saldoFinalFci} opts={{ cls: "cf-strong", bold: true, totalMode: "last" }} />

            <CfRow label="Saldo cierre mes Banco + FCI" rows={rows} get={(r) => r.cierreTotal} opts={{ cls: "cf-grand", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="INGRESOS PROYECTADOS" months={months} accent="var(--teal)" />
            {PROJ_CONCEPTS.map((c) => (
              <CfRow key={c.id} label={c.name} rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <CfRow label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ cls: "cf-strong", bold: true }} />

            <CfSectionRow label="REAL VS PRESUPUESTADO" months={months} accent="var(--amber)" />
            <CfRow label="Ingresos de dinero s/ Bancos (Real)" rows={rows} get={(r) => r.realIngresos} opts={{ blankZero: true }} />
            <CfRow label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ blankZero: true, dim: true }} />
            <CfRow label="Ingresos por bancos vs presupuestado" rows={rows} get={(r) => r.vsPresup} opts={{ cls: "cf-strong", bold: true, signed: true }} />

            <CfSectionRow label="DETALLE INGRESOS POR PRODUCTO" months={months} accent="var(--accent)" />
            {products.map((c) => (
              <Fragment key={c.id}>
                <tr className="cf-prodhead">
                  <td className="c-rowhead sticky-col">{c.name}</td>
                  {months.map((m) => (
                    <td key={m} className="cf-cell"></td>
                  ))}
                  <td className="cf-cell c-total"></td>
                </tr>
                <CfRow label={c.unidad} rows={rows} get={(r) => prodCant(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                <CfRow label="Precio" rows={rows} get={(r) => prodPrecio(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                <CfRow label="Total" rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, bold: true }} />
              </Fragment>
            ))}

            <CfSectionRow label="VENTAS NETAS SEGÚN LIBROS IVA" months={months} accent="var(--violet)" />
            {IVA_ROWS.map((r) => (
              <CfRow key={r} label={r} rows={rows} get={(row) => state.iva[r]?.[row.key] || 0} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <CfRow
              label="S/ Libro IVA Ventas"
              rows={rows}
              get={(row) => IVA_ROWS.reduce((a, r) => a + (state.iva[r]?.[row.key] || 0), 0)}
              opts={{ cls: "cf-strong", bold: true }}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: no errors. `/cashflow` now builds as a real route.

- [ ] **Step 3: Commit**

```bash
git add web/app/cashflow
git commit -m "Add Cashflow (Resumen) view"
```

---

## Task 16: Ajustes view

Ports the `Ajustes` component from `project/app/App.jsx`: editable initial bank
balances, the cashflow month range, and a "Restaurar datos de ejemplo" button that
wipes and re-seeds all Supabase tables via `reset()`.

**Files:**
- Create: `web/app/ajustes/page.tsx`

- [ ] **Step 1: Write `web/app/ajustes/page.tsx`**

```tsx
"use client";

import { addMonth, monthLabel } from "@/lib/dates";
import { BANKS } from "@/lib/constants";
import { useCashflow } from "@/context/CashflowContext";
import { Field, MoneyInput } from "@/components/ui";
import type { BankId } from "@/lib/types";

function buildMonthOpts(): string[] {
  const opts: string[] = [];
  let k = "2024-01";
  for (let i = 0; i < 60; i++) {
    opts.push(k);
    k = addMonth(k, 1);
  }
  return opts;
}

const MONTH_OPTS = buildMonthOpts();

export default function AjustesPage() {
  const { state, setSettings, reset } = useCashflow();

  if (!state) return null;

  const setSaldo = (bank: BankId, v: number) =>
    setSettings({ ...state.settings, saldoInicial: { ...state.settings.saldoInicial, [bank]: v } });

  const setRange = (key: "rangeStart" | "rangeEnd", v: string) =>
    setSettings({ ...state.settings, [key]: v });

  const doReset = () => {
    if (window.confirm("Esto restaura los datos de ejemplo y borra tus cambios guardados. ¿Continuar?")) {
      reset();
    }
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Ajustes</h1>
          <p className="view-sub">Saldos iniciales, rango del cashflow y datos.</p>
        </div>
      </div>

      <div className="settings-card">
        <h3>Saldo inicial por banco</h3>
        <div className="settings-grid">
          {BANKS.map((b) => (
            <Field key={b.id} label={b.name}>
              <MoneyInput value={state.settings.saldoInicial[b.id]} onChange={(v) => setSaldo(b.id, v)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Rango de meses del cashflow</h3>
        <div className="settings-grid">
          <Field label="Mes inicial">
            <select className="inp" value={state.settings.rangeStart} onChange={(e) => setRange("rangeStart", e.target.value)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="Mes final">
            <select className="inp" value={state.settings.rangeEnd} onChange={(e) => setRange("rangeEnd", e.target.value)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="settings-card">
        <h3>Datos</h3>
        <p className="settings-note">Todo se guarda automáticamente.</p>
        <button className="btn btn--danger" onClick={doReset}>Restaurar datos de ejemplo</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

```bash
cd web && npx tsc --noEmit && npm run build
```

Expected: no errors. `/ajustes` now builds as a real route.

- [ ] **Step 3: Commit**

```bash
git add web/app/ajustes
git commit -m "Add Ajustes view"
```

---

## Task 17: End-to-end manual verification

All four views now exist and talk to the live Supabase project from Task 8. This
task exercises every view in a real browser (via the Playwright MCP browser tools:
`mcp__plugin_playwright_playwright__browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_type`, `browser_fill_form`, `browser_console_messages`,
`browser_close`), checks the console for errors on each route — especially the
"Warning: validateDOMNesting(...): <div> cannot appear as a descendant of
<tbody>" warning that the `Modal` portal fix (Task 11) was meant to prevent — and
ends by resetting the database back to seed data so the deployed app starts clean.

**Files:** none — this task only runs the app and the browser. If a step reveals a
bug, fix it in the relevant file from Tasks 9-16, re-run that step, then continue.

- [ ] **Step 1: Start the dev server**

```bash
cd web && npm run dev
```

Run this in the background. Expected: a "Ready" log line and the server listening
on `http://localhost:3000`.

- [ ] **Step 2: Open the app and verify Movimientos**

Use `browser_navigate` to go to `http://localhost:3000`.

Expected: the URL becomes `http://localhost:3000/movimientos`. The page shows the
sidebar (brand "CASHFLOW", nav items Movimientos / Proyección / Cashflow /
Ajustes, footer "Cierre Banco + FCI" with a money value), two bank tabs ("Galicia"
and "Nación"), a bank summary card, and a movements table with a "Saldo Inicial"
row plus the seeded movement rows.

- [ ] **Step 3: Check the console on Movimientos**

Use `browser_console_messages`.

Expected: no `error`-level entries and no "validateDOMNesting" warning.

- [ ] **Step 4: Add a movement**

Click "+ Nuevo movimiento". In the modal, fill Descripción = "Prueba E2E", pick a
Fecha de pago inside the current range, and set Crédito = 1000. Save.

Expected: the modal closes, a new row "Prueba E2E" appears with Crédito
"1.000,00", and the bank summary's "Saldo final" increases by 1000 compared to
Step 2.

- [ ] **Step 5: Edit the movement**

Double-click the "Prueba E2E" row (or click its ✎ button). Change Crédito to 2000.
Save.

Expected: the row now shows "2.000,00" and the running "Saldo" column and bank
summary update accordingly.

- [ ] **Step 6: Delete the movement**

Click the 🗑 button on the "Prueba E2E" row. A `Confirm` modal appears with the
text `¿Eliminar el movimiento "Prueba E2E"?`. Click "Eliminar".

Expected: the row is removed, the bank summary returns to its Step 2 values, and
`browser_console_messages` shows no new errors or "validateDOMNesting" warnings
(this confirms the `Modal` portal fix works for a confirm dialog triggered from a
table row).

- [ ] **Step 7: Verify Proyección — Ingresos proyectados tab**

Use `browser_navigate` to go to "Proyección" via the sidebar (or directly to
`/proyeccion`). The "Ingresos proyectados" sub-tab is active by default. None of
the seeded `projection_cells` (Task 7) target `2026-01`, so click the cell for the
"Azúcar" row in the "ene-26" column (the 7th month column — months start at
`jul-25`). A modal opens with Cantidad and Precio both at 0. Enter Cantidad = 10,
Precio = 100. Save.

Expected: the "ene-26" cell for "Azúcar" now shows "1.000,00" and gets the `has`
styling, the "Azúcar" row's Total cell increases by 1.000,00, and the "Total
Ingresos Proyectados" row's "ene-26" cell — previously blank/0, since no concept
has seed data for that month — now shows "1.000,00".
`browser_console_messages` shows no "validateDOMNesting" warning (confirms the
portal fix for `CellQPEditor`).

- [ ] **Step 8: Verify Proyección — FCI / Inversiones tab**

Click the "FCI / Inversiones" sub-tab. The seeded `fci_monthly` rows (Task 7) only
cover `2025-07`..`2025-09`, so `2026-01` ("ene-26") is empty. Click the
"Suscripciones" cell for "ene-26" — the modal opens with Suscripciones and
Rescates both at 0. Enter Suscripciones = 1000. Save.

Expected: the "ene-26" Suscripciones cell shows "1.000,00", and "Saldo Final
Inversiones" for "ene-26" equals "Saldo Final Inversiones" for "dic-25" (the
preceding column) plus 1.000,00 — this relation holds regardless of "Saldo
Inicial FCI" because both columns shift by the same baseline.

Now change "Saldo Inicial FCI" to its current value plus 5000.

Expected: "Saldo Final Inversiones" for "jul-25" (the first month) equals the new
"Saldo Inicial FCI" value plus the seeded `jul-25` suscripciones/rescates
(260.000.000 − 260.586.228 = −586.228,00), i.e. (new Saldo Inicial FCI) −
586.228,00. The "ene-26" = "dic-25" + 1.000,00 relation from the previous check
still holds.

- [ ] **Step 9: Verify Proyección — Ventas netas IVA tab**

Click the "Ventas netas IVA" sub-tab. The seeded `iva_monthly` rows (Task 7) don't
cover `2026-01`, so click the "Azúcar" row's "ene-26" cell (currently blank),
enter 500, and save.

Expected: the cell shows "500,00", the "Azúcar" row's Total increases by 500, and
"S/ Libro IVA Ventas" for "ene-26" — previously 0, since no IVA row has seed data
for that month — now shows "500,00".

- [ ] **Step 10: Verify Cashflow (Resumen) reflects all edits**

Navigate to "Cashflow" (`/cashflow`) and look at the "ene-26" column.

Expected: "Total Ingresos Proyectados" shows "1.000,00" (from Step 7),
"S/ Libro IVA Ventas" shows "500,00" (from Step 9), and "Saldo Final Inversiones"
for "ene-26" equals "Saldo Final Inversiones" for "dic-25" plus 1.000,00 (same
relation as Step 8, now visible on this view). The sidebar's "Cierre Banco + FCI"
figure matches the last row's ("mar-27") "Saldo cierre mes Banco + FCI" value in
the table.

- [ ] **Step 11: Verify Ajustes — saldo inicial and range**

Navigate to "Ajustes" (`/ajustes`). Increase "Banco Galicia"'s saldo inicial by
1000, then navigate back to "Cashflow".

Expected: "Saldo Inicial Bancos" for "jul-25" (the first month) is exactly 1000
higher than its value before this edit, and "Saldo final Bancos" / "Saldo cierre
mes Banco + FCI" shift by the same +1000 across every month (a pure starting-
balance offset propagates unchanged through the running totals).

Back on "Ajustes", change "Mes final" to one month earlier ("feb-27").

Expected: navigating to "Proyección" or "Cashflow" shows one fewer month column,
now ending at "feb-27".

- [ ] **Step 12: Reset to seed data**

On "Ajustes", click "Restaurar datos de ejemplo". A native browser confirm dialog
appears with the text "Esto restaura los datos de ejemplo y borra tus cambios
guardados. ¿Continuar?" — accept it (`browser_handle_dialog` with `accept: true`).

Expected: after the page data reloads, "Proyección", "Cashflow", "Movimientos" and
"Ajustes" all show the original seed values again — the "Prueba E2E" movement is
gone (already deleted in Step 6), the "ene-26" cells edited in Steps 7-9 are blank
again, "Saldo Inicial FCI" is back to 0, the Galicia saldo inicial and month range
match `supabase/schema.sql`'s seed values (`rangeEnd` back to "mar-27").

- [ ] **Step 13: Final console check across all routes**

For each of `/movimientos`, `/proyeccion`, `/cashflow`, `/ajustes`, use
`browser_navigate` followed by `browser_console_messages`.

Expected: no `error`-level entries and no "validateDOMNesting" warnings on any
route.

- [ ] **Step 14: Close the browser and stop the dev server**

Use `browser_close`, then stop the `npm run dev` process.

---

## Task 18: Deploy to Vercel

Deploys `web/` as its own Vercel project, with the Supabase credentials from
`web/.env.local` (Task 8) configured as production environment variables.

**Files:** none — this task only runs CLI commands. `web/.gitignore` (from
`create-next-app`) already ignores `.vercel`, so no `.vercel/project.json` gets
committed.

- [ ] **Step 1: Install the Vercel CLI**

```bash
npm install -g vercel
vercel --version
```

Expected: a version number is printed.

- [ ] **Step 2: Log in**

```bash
vercel whoami
```

If this prints an error instead of a username, log in interactively:

```bash
vercel login
```

This opens a browser (or sends a confirmation email) — the user must complete it.
Re-run `vercel whoami` afterwards to confirm.

- [ ] **Step 3: Link `web/` to a Vercel project**

```bash
cd web && vercel link --yes
```

Expected: output ends with "Linked to <scope>/<project-name>" and creates
`web/.vercel/project.json`.

- [ ] **Step 4: Add the Supabase environment variables to Production**

Run from `web/`, reusing the values already in `.env.local` (Task 8):

```bash
grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2- | tr -d '\r\n' | vercel env add NEXT_PUBLIC_SUPABASE_URL production
grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2- | tr -d '\r\n' | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

Expected: each command prints that the variable was added to the Production
environment. Run `vercel env ls` to confirm both `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are listed under Production.

- [ ] **Step 5: Deploy to production**

```bash
vercel --prod
```

Expected: the build completes successfully and the command prints a production
URL of the form `https://<project-name>.vercel.app`.

- [ ] **Step 6: Verify the deployed app**

Replace `<url>` with the production URL from Step 5:

```bash
curl -s -o /dev/null -w "%{http_code}\n" <url>/movimientos
curl -s -o /dev/null -w "%{http_code}\n" <url>/proyeccion
curl -s -o /dev/null -w "%{http_code}\n" <url>/cashflow
curl -s -o /dev/null -w "%{http_code}\n" <url>/ajustes
```

Expected: all four commands print `200`, confirming the deployed app serves all
four views and can reach the live Supabase project.

---
