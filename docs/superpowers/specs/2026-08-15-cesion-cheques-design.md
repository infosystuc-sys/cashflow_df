# Cesión de cheques y vínculo con Movimientos

**Fecha:** 2026-08-15
**Estado:** Aprobado, pendiente de implementación

## Contexto

El módulo de Cheques (`web/app/cheques/page.tsx`, `web/components/cheques/*`) es hoy
**deliberadamente independiente** de Movimientos: acreditar, depositar o endosar un
cheque no toca el saldo bancario ni crea filas en `movements`, por decisión explícita
tomada en `docs/superpowers/specs/2026-06-14-cheques-terceros-design.md` ("Fuera de
alcance (v1)").

Este spec revierte esa decisión para dos de las cuatro transiciones de estado, agrega
un estado nuevo ("Cesionado") y elimina uno ("Acreditado") que la práctica mostró
redundante.

Estado actual (`web/lib/types.ts`, `ChequeEstado`):
```ts
type ChequeEstado = "en_cartera" | "depositado" | "acreditado" | "endosado";
```
Transiciones actuales (`web/app/cheques/page.tsx`, `ACCION_CFG` + botones condicionales
por `c.estado`):
- `en_cartera` → **Depositar** (→ `depositado`) o **Endosar** (→ `endosado`)
- `depositado` → **Acreditar** (→ `acreditado`) o **Rechazar** (→ vuelve a `en_cartera`)
- `acreditado` y `endosado` son terminales, sin acciones.

En la base de datos hoy hay 29 cheques reales: 27 en `en_cartera`, 1 en `depositado`,
**1 en `acreditado`** — este último necesita una migración de datos, no solo de
esquema (ver sección 6).

`bancoDestino` (`Cheque.bancoDestino: BankId | ""`) ya existe como campo tipado contra
los dos bancos propios, pero hoy es puramente informativo — nunca se usa para nada.
Este spec lo convierte en el campo real que decide en qué banco se registra el
movimiento.

## Objetivo

1. Agregar un tercer estado alcanzable desde `en_cartera`: **Cesionado** (el cheque se
   cede a un tercero — factoring/descuento — distinto de Endosar, que es usarlo para
   pagar una compra propia).
2. Eliminar el estado **Acreditado** y la acción "Acreditar": son redundantes una vez
   que Depositar ya registra el movimiento bancario (ver punto 3) — `depositado` pasa
   a ser el estado final para cheques que van a banco propio.
3. Cuando un cheque se **Deposita** o se **Cede**, preguntar a qué banco propio
   (Galicia/Nación) corresponde y registrar automáticamente un movimiento en
   Movimientos por el importe del cheque, vinculado permanentemente a ese cheque.
4. Cuando un cheque se **Endosa**, guardar a quién fue endosado (no toca movimientos).

## Diseño

### 1. Modelo de datos

`supabase/schema.sql`, tabla `cheques` — nuevas columnas:
```sql
fecha_cesion date,
endosado_a text not null default '',
movement_id uuid,
```
`movement_id` es un vínculo simple (sin FK, mismo estilo que el resto del esquema —
sin RLS ni foreign keys en ningún lado) al `id` de la fila en `movements` que este
cheque generó. Un cheque tiene **como mucho un** `movement_id` activo a la vez.

`ChequeEstado` (`web/lib/types.ts`) pasa a:
```ts
export type ChequeEstado = "en_cartera" | "depositado" | "endosado" | "cesionado";
```
`Cheque` gana:
```ts
fechaCesion: string;   // 'YYYY-MM-DD' o ''
endosadoA: string;     // texto libre, '' si no aplica
movementId: string | null;
```
`fechaAcreditacion` **se mantiene** en el tipo y en la tabla (no se borra la columna,
para no perder el dato histórico del cheque que ya estaba acreditado) pero deja de
alimentar ningún cálculo o transición nueva — es un campo muerto a partir de ahora,
igual que puede quedar el de cualquier cheque migrado.

### 2. Ciclo de vida final

```
en_cartera ──Depositar──► depositado ──Rechazar──► en_cartera (borra el movimiento vinculado)
en_cartera ──Endosar────► endosado   (terminal, guarda endosado_a, no toca movimientos)
en_cartera ──Ceder───────► cesionado  (terminal)
```
- **Depositar**: pide banco (obligatorio; precargado con `bancoDestino` si ya estaba
  cargado) y fecha. Crea el movimiento vinculado. Pasa a `depositado` — **estado
  final** para cheques propios (ya no hay paso de "Acreditar").
- **Rechazar** (solo desde `depositado`): pide fecha. **Borra** el movimiento
  vinculado — el dinero nunca entró al banco — y vuelve el cheque a `en_cartera`.
- **Ceder** (solo desde `en_cartera`, nueva acción): pide banco (mismo comportamiento
  que Depositar) y fecha de cesión. Crea el movimiento vinculado por el importe
  completo del cheque (sin edición de monto — la spec no contempla descuento/quita).
  Estado final, sin acciones posteriores.
- **Endosar** (solo desde `en_cartera`): pide fecha **y a quién se endosó**
  (`endosadoA`, texto libre). No crea ni toca movimientos. Estado final.

### 3. El movimiento generado

Al Depositar o Ceder, se inserta una fila en `movements` (vía `insertMovement`,
`web/lib/data.ts`) con:
- `bank`: el banco elegido en la acción.
- `grupo`: `"Ingresos"`.
- `credito`: el `importe` del cheque; `debito`: 0.
- `descripcion`: `` `Cheque ${numero}` `` (o el cliente si no hay número).
- `proveedor`: el `cliente` del cheque.
- `cheque`: el `numero` del cheque (referencia cruzada visual, campo de texto libre
  que `Movement` ya tiene).
- `fechaPago`: la fecha de la acción (`fechaDeposito` o `fechaCesion`).
- El `id` devuelto se guarda como `cheque.movementId`.

**Sincronización posterior:**
- Editar el cheque (`ChequeEditor`) cambiando `importe`, `bancoDestino`, `cliente` o
  `numero` con `movementId` no nulo → actualiza esos mismos campos en el movimiento
  vinculado (`credito`, `bank`, `proveedor`, `cheque`).
- Borrar el cheque → borra en cascada el movimiento vinculado (si existe).
- Rechazar un cheque depositado → borra el movimiento vinculado (ver ciclo de vida).

**Fuera de alcance:** editar o borrar el movimiento *desde la pantalla de
Movimientos* no se propaga de vuelta al cheque — el cheque queda con un
`movementId` que ya no resuelve a nada (huérfano), igual que se aceptó para las
transferencias entre bancos propios. No hay transacciones reales (Supabase vía
PostgREST): si la segunda escritura de una operación en cascada falla, puede quedar
una mitad desincronizada — mismo riesgo ya aceptado en esa feature anterior.

### 4. UI — `ChequeActionModal` y botones por estado

`ChequeActionModal` (`web/components/cheques/ChequeActionModal.tsx`) hoy solo pide una
fecha. Se extiende para aceptar campos adicionales configurables por acción:
- **Depositar** y **Ceder**: fecha + selector de banco (obligatorio, precargado con
  `bancoDestino` si existe).
- **Endosar**: fecha + campo de texto "Endosado a" (obligatorio).
- **Rechazar**: solo fecha, como hoy.

Botones por estado en `app/cheques/page.tsx`:
- `en_cartera` → **Depositar**, **Endosar**, **Ceder** (tres botones).
- `depositado` → **Rechazar** (uno solo; ya no hay "Acreditar").
- `endosado` y `cesionado` → terminales, sin botones.

`ESTADO_LABEL` pierde `"acreditado"` y gana `"cesionado": "Cesionado"` — como los
filtros de la pantalla se derivan de `Object.keys(ESTADO_LABEL)`, el nuevo filtro
aparece solo. Nuevo chip `chip--cheque-cesionado` en `globals.css` — reutiliza el
verde que dejó libre `chip--cheque-acreditado` (`#e9f7ef` / `#15803d`), ya que
conceptualmente ambos comunican "el dinero quedó confirmado". La columna "Endosado a"
se agrega a la tabla de cheques (vacía salvo en filas `endosado`).

### 5. Cálculos (`web/lib/calc.ts`)

`chequeEventos(c)` — nueva rama para `cesionado`, se elimina la mención de
`acreditado`:
```ts
function chequeEventos(c: Cheque): ChequeEvento[] {
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
`chequesResumen` — pierde `acreditadoMes`, gana `totalCedido`; `totalDepositadoPendiente`
se renombra a `totalDepositado` (ya no es "pendiente", es el estado final):
```ts
{ totalCartera, totalDepositado, totalCedido, cantidadRechazados }
```
`ChequeSummaryCard` pasa a mostrar: Total en cartera / Total depositado / Total
cedido / Cheques rechazados.

`chequesMonth` pierde el campo `acreditado` (ya no hay forma de llegar a ese
estado). Como consecuencia, `CashflowRow.chequesAcreditado` (`web/lib/types.ts`) y la
fila "Acreditado (informativo)" en `web/app/cashflow/page.tsx` quedarían siempre en
cero — se eliminan ambos en vez de dejar UI muerta. `buildCashflow` deja de propagar
ese campo.

### 6. Migración SQL (a correr manualmente, igual que la anterior)

```sql
-- 1) El único cheque real hoy en 'acreditado' pasa a 'depositado' (Acreditado deja de existir)
update cheques set estado = 'depositado' where estado = 'acreditado';

-- 2) Columnas nuevas
alter table cheques add column fecha_cesion date;
alter table cheques add column endosado_a text not null default '';
alter table cheques add column movement_id uuid;

-- 3) Nuevo conjunto de estados válidos
alter table cheques drop constraint cheques_estado_check;
alter table cheques add constraint cheques_estado_check
  check (estado in ('en_cartera','depositado','endosado','cesionado'));
```
Nota: el nombre `cheques_estado_check` es el que Postgres asigna por convención a un
`check` de columna sin nombre explícito en el `create table` original; si el `drop
constraint` falla, hay que confirmar el nombre real (Supabase → Table Editor → cheques
→ pestaña de constraints, o `\d cheques` en el SQL editor) y ajustarlo.

## Fuera de alcance

- No se permite editar el importe del movimiento al Ceder (sin descuento/factoring
  parcial) — siempre el importe completo del cheque.
- "Acreditar" no se reemplaza por ningún paso de confirmación manual — Depositar es
  directamente el evento que cuenta como dinero en el banco.
- Sin sincronización en sentido Movimientos → Cheque (ver sección 3).
- No se migran los cheques ya `endosado` para completarles `endosado_a` — queda vacío
  para los históricos, se completa solo hacia adelante.
