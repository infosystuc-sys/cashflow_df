# Cashflow App — Diseño (de prototipo Claude Design a aplicación Next.js + Supabase)

## 1. Contexto y objetivo

`project/` contiene un prototipo exportado desde Claude Design: una app de cashflow
(HTML + React vía Babel en el navegador, sin build) para una operación agropecuaria
con dos bancos (Galicia y Nación). Tiene tres vistas funcionales:

- **Movimientos**: alta/baja/edición de movimientos bancarios por banco, con saldo
  corriente calculado.
- **Proyección**: matriz editable de ingresos proyectados (cantidad × precio por
  concepto y mes), FCI/inversiones (suscripciones/rescates) y ventas netas según
  libros IVA.
- **Cashflow / Resumen**: tabla de solo lectura, recalculada en vivo a partir de
  Movimientos y Proyección, con saldo de bancos, FCI, totales proyectados vs reales.

Hoy todo se persiste en `localStorage` del navegador (un único blob JSON, clave
`cashflow_app_v3`). El objetivo de este proyecto es convertirlo en una aplicación
real, desplegable, con persistencia en una base de datos para poder acceder desde
varios dispositivos.

## 2. Decisiones (confirmadas con el usuario)

- **Sin login.** La app queda abierta: cualquiera con la URL puede ver y editar los
  datos. Es un uso interno/privado; no se monta autenticación en esta vuelta.
- **Persistencia en Supabase (Postgres), con esquema SQL normalizado** (no un único
  `jsonb`).
- **Stack**: Next.js (App Router) + TypeScript, desplegado en Vercel.
- Se **elimina el Tweaks panel** y el protocolo `__edit_mode_*` (son herramientas del
  editor de diseño, no de la app final).
- El **diseño visual se preserva pixel-perfect**: se porta el CSS del prototipo
  (`project/Cashflow.html`) a `globals.css` tal cual, y se recrean los componentes
  con las mismas clases/estructura.

## 3. Arquitectura

```
web/                          # Next.js app (App Router, TS) — raíz del proyecto Vercel
├─ app/
│  ├─ layout.tsx              # shell: sidebar + nav + CashflowProvider
│  ├─ globals.css             # CSS portado de Cashflow.html
│  ├─ page.tsx                # redirect a /movimientos
│  ├─ movimientos/page.tsx
│  ├─ proyeccion/page.tsx
│  ├─ cashflow/page.tsx       # "Resumen"
│  └─ ajustes/page.tsx
├─ components/
│  ├─ ui/                     # Modal, Field, MoneyInput, NumInput, GroupChip, Money, Confirm
│  ├─ movimientos/            # MovEditor, BankSummaryCard, tabla
│  └─ proyeccion/             # MatrixShell, ProjTab, FciTab, IvaTab, editores de celda
├─ lib/
│  ├─ types.ts                # tipos del modelo de datos
│  ├─ cashflow.ts             # lógica portada de CF.* (cálculos, formato, helpers)
│  ├─ supabase.ts             # cliente Supabase (browser, anon key)
│  └─ data.ts                 # capa de acceso a datos: fetch/insert/update/delete por tabla + seed
├─ .env.local                 # NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
└─ ...
supabase/
└─ schema.sql                 # creación de tablas + datos semilla (ver sección 4)
```

### Manejo de estado

Un `CashflowProvider` (componente cliente) en `layout.tsx`:

1. Al montar, hace fetch de las 5 tablas de Supabase y arma en memoria un objeto
   `state` con la misma forma lógica que el `state` actual del prototipo (settings,
   movements, projection, fci, iva).
2. Expone un hook `useCashflow()` con `state` y funciones de mutación (`addMovement`,
   `updateMovement`, `deleteMovement`, `setProjectionCell`, `setFciCell`,
   `setIvaCell`, `setSettings`, `resetToSeed`, etc.).
3. Cada mutación actualiza el estado local de forma optimista **y** dispara el
   `insert`/`update`/`upsert`/`delete` correspondiente en Supabase.
4. Todos los cálculos (`buildCashflow`, `bankRows`, `bankSummary`, `projTotal`, etc.)
   siguen corriendo en el cliente sobre ese `state`, igual que hoy — se recalculan al
   instante con cada edición.

Esto preserva la experiencia actual ("todo se guarda automáticamente", recálculo en
vivo) cambiando solo el destino de la persistencia.

## 4. Modelo de datos (Supabase / Postgres)

```sql
-- fila única de configuración global
create table settings (
  id int primary key default 1,
  saldo_inicial_galicia numeric not null default 0,
  saldo_inicial_nacion  numeric not null default 0,
  range_start text not null default '2025-07',   -- 'YYYY-MM'
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

-- proj[conceptId][monthKey] = {cantidad, precio}
create table projection_cells (
  concept_id text not null,
  month_key  text not null,  -- 'YYYY-MM'
  cantidad numeric not null default 0,
  precio   numeric not null default 0,
  primary key (concept_id, month_key)
);

-- fci.data[monthKey] = {suscripciones, rescates}
create table fci_monthly (
  month_key text primary key,
  suscripciones numeric not null default 0,
  rescates      numeric not null default 0
);

-- iva[row][monthKey] = monto
create table iva_monthly (
  row_name  text not null,
  month_key text not null,
  monto numeric not null default 0,
  primary key (row_name, month_key)
);
```

**RLS**: deshabilitado (default al crear tablas por SQL). El `anon key` tiene
lectura/escritura completa — coherente con "sin login". Si más adelante se quiere
restringir, se puede agregar auth + políticas sin tocar el esquema.

**Datos semilla**: se portan literalmente los valores actuales de
`seedMovements()`, `seedProjection()`, `seedFCI()`, `seedIVA()` y los `settings`
iniciales de `defaultState()` (de `project/app/data.jsx`) como `insert` en
`schema.sql`.

**Constantes que NO van a la base** (son catálogo fijo del dominio, viven en
`lib/cashflow.ts` como hoy): `BANKS`, `GROUPS`, `PROJ_CONCEPTS`, `IVA_ROWS`,
`MONTHS_ES`.

## 5. Mapeo de archivos del prototipo → app nueva

| Prototipo | Destino | Notas |
|---|---|---|
| `Cashflow.html` (bloque `<style>`) | `app/globals.css` | copiado tal cual |
| `app/data.jsx` (constantes + helpers + cálculos) | `lib/cashflow.ts` | mismas funciones, tipadas |
| `app/data.jsx` (persistencia localStorage) | `lib/supabase.ts` + `lib/data.ts` | reemplazado por Supabase |
| `app/components.jsx` | `components/ui/*.tsx` | Modal, Field, MoneyInput, NumInput, GroupChip, Money, Confirm |
| `app/Movimientos.jsx` | `app/movimientos/page.tsx` + `components/movimientos/*` | |
| `app/Proyeccion.jsx` | `app/proyeccion/page.tsx` + `components/proyeccion/*` | |
| `app/Resumen.jsx` | `app/cashflow/page.tsx` | |
| `app/App.jsx` (shell, nav, sidebar) | `app/layout.tsx` | |
| `app/App.jsx` (componente `Ajustes`) | `app/ajustes/page.tsx` | "Restaurar datos de ejemplo" ahora borra y re-siembra las tablas Supabase |
| `tweaks-panel.jsx` | — (no se porta) | herramienta del editor de diseño |

## 6. Despliegue

- Repo Git en la raíz del proyecto (`d:/APP/CASHFLOW`), con `web/` como root
  directory del proyecto Vercel.
- Variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  en `.env.local` para desarrollo y en Vercel para producción.
- Requiere: crear/conectar un proyecto Supabase (vía MCP o dashboard) para obtener
  URL + anon key, y la Vercel CLI (`npm i -g vercel`) para el deploy — se resuelven
  al arrancar la implementación.

## 7. Fuera de alcance (por ahora)

- Autenticación / multiusuario con roles.
- Sincronización en tiempo real entre clientes conectados simultáneamente.
- Exportación de datos (CSV/Excel).
