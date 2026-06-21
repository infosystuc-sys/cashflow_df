# Cheques de terceros — Diseño

## Objetivo

Agregar un módulo para registrar y hacer seguimiento de cheques de terceros (recibidos de clientes como forma de pago), y reflejar su impacto en el Cashflow. El módulo es independiente de Movimientos/saldo bancario: acreditar un cheque no genera una fila en Movimientos ni modifica el saldo de ningún banco — solo se refleja como una sección informativa propia dentro del Cashflow.

## Modelo de datos

```typescript
type ChequeEstado = "en_cartera" | "depositado" | "acreditado" | "endosado";

interface Cheque {
  id: string;
  cliente: string;            // librador / quién lo entregó
  numero: string;             // número de cheque
  bancoEmisor: string;        // banco que lo emitió (informativo, texto libre)
  bancoDestino: BankId | "";  // banco propio donde se depositaría/depositó (informativo, no toca Movimientos)
  importe: number;
  fechaRecepcion: string;     // 'YYYY-MM-DD', cuándo entró a cartera
  fechaPago: string;          // 'YYYY-MM-DD', fecha de cobro impresa en el cheque
  estado: ChequeEstado;
  fechaDeposito: string;      // 'YYYY-MM-DD' o '', fecha del depósito más reciente
  fechaAcreditacion: string;  // 'YYYY-MM-DD' o '', fecha en que se confirmó acreditado
  fechaRechazo: string;       // 'YYYY-MM-DD' o '', fecha del rechazo más reciente
  fechaEndoso: string;        // 'YYYY-MM-DD' o '', fecha en que se endosó
}
```

`CashflowState.cheques: Cheque[]` se agrega junto a `movements`, `projection`, `fci`, `iva`.

## Estados y transiciones

```
en_cartera ──(Depositar, fecha)──▶ depositado
depositado ──(Acreditar, fecha)──▶ acreditado          [terminal]
depositado ──(Rechazar, fecha)──▶ en_cartera           (registra fechaRechazo, vuelve a cartera)
en_cartera ──(Endosar, fecha)────▶ endosado             [terminal]
```

- "Rechazado" no es un estado de reposo: es la acción que hace que un cheque `depositado` vuelva a `en_cartera`, dejando registrada `fechaRechazo` para el historial/reportes. El cheque queda inmediatamente disponible para volver a depositarse o gestionarse con el cliente.
- **Simplificación aceptada:** cada campo de fecha (`fechaDeposito`, `fechaAcreditacion`, `fechaRechazo`, `fechaEndoso`) guarda solo el valor del intento más reciente. Si un cheque se redeposita después de un rechazo, se pierde el detalle de las fechas del intento fallido anterior (se sobrescriben). El estado actual y sus fechas asociadas son siempre correctos; lo que no se reconstruye es un historial completo de múltiples ciclos de rechazo/redepósito.

## Reflejo en el Cashflow

Nueva sección "CHEQUES DE TERCEROS" en `app/cashflow/page.tsx`, ubicada entre "FCI / INVERSIONES" y "Saldo cierre mes Banco + FCI". El total de cierre general **no incluye** la cartera de cheques (un cheque en mano no es caja disponible todavía).

Filas, una por mes:

| Fila | Cálculo |
|---|---|
| Saldo Inicial Cartera | saldo final del mes anterior (ver "Cálculo de saldo" abajo) |
| Recibidos | Σ `importe` de cheques con `fechaRecepcion` en el mes |
| Salida de cartera | Σ `importe` de cheques cuyo `estado` actual es `depositado`/`acreditado` con `fechaDeposito` en el mes, **más** los cheques con `estado === "endosado"` con `fechaEndoso` en el mes — restado del saldo |
| Rechazados (vuelven a cartera) | Σ `importe` de cheques con `estado === "en_cartera"` y `fechaRechazo` con valor, cuyo `fechaRechazo` cae en el mes — sumado al saldo |
| Saldo Final Cartera | inicial + Recibidos − Salida + Rechazados |
| Acreditado (informativo) | Σ `importe` de cheques con `estado === "acreditado"` y `fechaAcreditacion` en el mes. No modifica ningún saldo; es solo indicador de cuánta plata se confirmó como caja real ese mes. |

### Cálculo de saldo inicial (sin número manual)

A diferencia de FCI (que no tiene registros individuales y por eso requiere un "saldo inicial" manual), cada cheque tiene sus propias fechas reales. El saldo de cartera al inicio del rango configurado (`rangeStart`) se calcula reproduciendo cronológicamente todos los eventos de todos los cheques fechados **antes** de `rangeStart` (entradas por `fechaRecepcion`, salidas por `fechaDeposito`/`fechaEndoso`, reingresos por `fechaRechazo`). Esto evita un número manual que se pueda desincronizar de los datos reales: si hay cheques viejos pendientes de antes de usar la app, se cargan con su `fechaRecepcion` real (aunque sea pasada) y el cálculo los toma solos.

## Pantalla "Cheques" (nueva, en el menú lateral)

- Ruta `app/cheques/page.tsx`, ítem nuevo en el sidebar (junto a Movimientos, Proyección, Cashflow, Ajustes).
- Tabla tipo Movimientos con columnas: Cliente, N° cheque, Banco emisor, Importe, Fecha recepción, Fecha de pago, Banco destino, Estado, Acción.
- Filtro por estado (Todos / En cartera / Depositado / Acreditado / Endosado), mostrando "Todos" por defecto.
- Tarjeta de resumen arriba: total en cartera, total depositado pendiente, total acreditado del mes en curso, cantidad de cheques en cartera por rechazo.
- Botón "+ Nuevo cheque" → modal con los campos del alta (cliente, número, banco emisor, importe, fecha recepción, fecha de pago, banco destino). Crea el cheque en estado `en_cartera`.
- Acciones contextuales por fila, cada una pide una fecha (default hoy) antes de confirmar:
  - `en_cartera` → "Depositar" (→ `depositado`, fija `fechaDeposito`) / "Endosar" (→ `endosado`, fija `fechaEndoso`)
  - `depositado` → "Acreditar" (→ `acreditado`, fija `fechaAcreditacion`) / "Rechazar" (→ `en_cartera`, fija `fechaRechazo`)

## Cambios de archivos

- `lib/types.ts`: agrega `ChequeEstado`, `Cheque`, `CashflowState.cheques`, nuevos campos en `CashflowRow` (`chequesSaldoInicial`, `chequesRecibidos`, `chequesSalida`, `chequesRechazados`, `chequesSaldoFinal`, `chequesAcreditado`).
- `lib/calc.ts`: nueva función `chequesMonth(state, monthKey)` + lógica de saldo inicial pre-rango; integración en `buildCashflow()`.
- `context/CashflowContext.tsx`: `addCheque`, `updateChequeEstado(id, nuevoEstado, fecha)`, `deleteCheque`.
- `lib/data.ts`: fetch/upsert/delete contra la tabla `cheques`.
- `supabase/schema.sql`: tabla nueva `cheques` (columnas equivalentes a `Cheque`).
- `app/cheques/page.tsx`: pantalla nueva.
- Sidebar (layout): nuevo ítem de navegación "Cheques".
- `app/cashflow/page.tsx`: nueva sección "CHEQUES DE TERCEROS".

## Fuera de alcance (v1)

- Historial completo de múltiples ciclos de rechazo/redepósito por cheque (ver simplificación aceptada arriba).
- Cualquier impacto automático en Movimientos o en el saldo bancario por banco al acreditar un cheque (el módulo es independiente, por decisión explícita).
- Inclusión de la cartera de cheques en el total "Saldo cierre mes Banco + FCI" (se mantiene como indicador separado).
