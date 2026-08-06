# Transferencia a banco propio (replicación automática entre Galicia y Nación)

**Fecha:** 2026-08-06
**Estado:** Aprobado, pendiente de implementación

## Contexto

La empresa opera con dos bancos, Galicia y Nación (`web/lib/constants.ts`, `BANKS`).
El módulo Movimientos (`app/movimientos/page.tsx`) ya tiene una Agrupación
`"Transf entre cuentas"` (`web/lib/constants.ts`, `GROUPS`), pero en la práctica se
usa para dos casos distintos sin diferenciarlos:

1. Transferencias a bancos/cuentas de terceros (fuera de la empresa).
2. Movimientos internos entre las dos cuentas propias (Galicia ↔ Nación).

Para el caso 2, hoy el usuario carga manualmente dos filas independientes — una
por banco, con el mismo importe y signo opuesto (ver seed en
`supabase/schema.sql`, filas `TRANSFERENCIA`/`GALICIA`) — abriendo "Nuevo
movimiento" dos veces y manteniendo a mano la consistencia de fecha/importe. No
existe ningún vínculo entre esas dos filas: son registros independientes en la
tabla `movements` (`web/lib/data.ts`, `insertMovement`).

## Objetivo

Cuando el usuario carga un movimiento que mueve dinero entre las dos cuentas
propias de la empresa, la app debe generar automáticamente el movimiento
espejo en el otro banco (mismo importe, crédito/débito invertidos), y mantener
ambos movimientos vinculados de forma permanente: editar o borrar uno debe
poder propagarse al otro.

Los movimientos hacia terceros (`"Transf entre cuentas"`) no cambian de
comportamiento.

## Diseño

### 1. Modelo de datos

- **Nueva Agrupación** `"Transferencia a banco propio"` en `GROUPS`
  (`web/lib/constants.ts`), agregada junto a `"Transf entre cuentas"`. Esta
  última se mantiene sin cambios de comportamiento (solo terceros, sin
  replicar).
- **Nueva columna** `transfer_id uuid null` en la tabla `movements`
  (`supabase/schema.sql`). Migración ya aplicada manualmente en la base viva:
  ```sql
  alter table movements add column transfer_id uuid;
  ```
  `schema.sql` se actualiza para reflejar la columna en el `create table` (para
  que una instalación nueva desde cero la incluya).
- Dos movimientos generados por una misma transferencia comparten el mismo
  `transfer_id` (UUID generado en el cliente con `crypto.randomUUID()` al
  crear). Todo el resto de los movimientos (incluidos los de `"Transf entre
  cuentas"`) tienen `transfer_id = null`.
- `Movement` (`web/lib/types.ts`) gana el campo `transferId: string | null`.
  `MovementRow`, `insertMovement`, `insertMovements`, `updateMovement` y el
  mapeo de `fetchAllData` en `web/lib/data.ts` se actualizan para leer/escribir
  `transfer_id`.

### 2. Disparador y creación

- Al elegir Agrupación = `"Transferencia a banco propio"` en `MovEditor.tsx`,
  el botón "Agregar" no guarda directo: primero muestra, dentro del mismo
  modal, una vista previa de lo que se va a crear en el otro banco (banco
  destino, importe, fecha de pago, descripción), con botones "Volver" y
  "Confirmar y crear ambos".
- Al confirmar:
  - Se genera un `transferId` con `crypto.randomUUID()`.
  - Leg A = los datos tal como los cargó el usuario, `bank` = pestaña activa
    (`bankId`), `grupo = "Transferencia a banco propio"`, `transferId`.
  - Leg B = mismo `descripcion`, `proveedor`, `fechaEmision`, `fechaPago`,
    `cheque`, `grupo`, `transferId`; `bank` = el otro banco; `credito`/`debito`
    invertidos respecto a Leg A (`credito_B = debito_A`, `debito_B =
    credito_A`).
  - Ambas filas se insertan en una sola llamada reusando `insertMovements`
    (`web/lib/data.ts`, ya usado por el import de Excel) y se agregan al
    estado local vía `addMovements` del contexto — sin necesidad de refetch.
- Si el usuario elige `"Transf entre cuentas"`, el formulario se comporta
  exactamente igual que hoy (una sola fila, sin vista previa ni replicación).

### 3. Edición de movimientos vinculados

- Al abrir para editar un movimiento con `transferId` no nulo, `MovEditor.tsx`
  muestra un indicador (ej. "🔗 Vinculado con Banco Nación") y deshabilita el
  selector de Agrupación (queda fijo en `"Transferencia a banco propio"`) para
  evitar que un lado quede en un grupo distinto al del otro.
- Al guardar cambios, `saveMov` (`app/movimientos/page.tsx`) localiza la
  contraparte (`state.movements.find(m => m.transferId === editado.transferId
  && m.id !== editado.id)`) y llama a `updateMovement` dos veces (contexto
  existente, sin cambios de firma): una para el movimiento editado, otra para
  la contraparte con `descripcion`, `proveedor`, `fechaEmision`, `fechaPago` y
  `cheque` sincronizados, y `credito`/`debito` espejados respecto al nuevo
  valor editado.
- Ambos lados son igual de editables (simétrico): no hay un "original" de solo
  lectura.

### 4. Borrado de movimientos vinculados

- `Confirm` (`web/components/ui/index.tsx`) gana dos props opcionales,
  retrocompatibles (no afectan el uso actual en `app/cheques/page.tsx`):
  `yesLabel?: string` y `extraAction?: { label: string; onClick: () => void }`,
  que agrega un tercer botón en el footer si está presente.
- En `app/movimientos/page.tsx`, al pedir confirmación de borrado sobre un
  movimiento con `transferId` no nulo, se arma un `Confirm` con:
  - Mensaje explicando que está vinculado con el otro banco.
  - Botón principal ("Eliminar los dos"): borra el movimiento y su
    contraparte (dos llamadas a `deleteMovement`).
  - `extraAction` ("Eliminar solo este"): borra únicamente el movimiento
    actual, dejando la contraparte con `transferId` apuntando a un registro
    que ya no existe (huérfana, pero funcionalmente es solo un movimiento
    normal sin par — no se reescribe su `transferId` a null; ver "Fuera de
    alcance").
  - "Cancelar": no hace nada, como hoy.

### 5. Cálculos agregados

- **Resumen por banco** (`bankSummary` en `web/lib/calc.ts`, mostrado en
  `BankSummaryCard.tsx`): nuevo campo `transfPropio` (suma de crédito menos
  débito de movimientos con `grupo === "Transferencia a banco propio"` en ese
  banco), como línea separada de `transf` (que sigue siendo solo `"Transf
  entre cuentas"`). `final` y `control` incorporan `transfPropio`. Mismo
  tratamiento en el bloque `viewSummary` local de `app/movimientos/page.tsx`
  (líneas 106-121).
- **Matriz combinada de Cashflow** (`realMonth`/`buildCashflow` en
  `web/lib/calc.ts`, usada por `app/cashflow` o `app/proyeccion`): el cálculo
  de `transf` pasa a sumar ambas Agrupaciones juntas (`"Transf entre cuentas"`
  y `"Transferencia a banco propio"`), sin agregar un campo nuevo — a nivel
  compañía (ambos bancos sumados) las transferencias internas se cancelan
  entre sí igual que las de terceros, así que separarlas ahí no aporta
  información.
- `BankSummaryCard.tsx`: nueva fila "Transferencia a banco propio" en la
  grilla de resumen.
- `GroupChip` (`web/components/ui/index.tsx`) y `globals.css`: nueva clase de
  chip para `"Transferencia a banco propio"` (color distinto pero de la misma
  familia visual que `"Transf entre cuentas"`).
- `FILTER_GROUPS` en `app/movimientos/page.tsx` no requiere cambios (se deriva
  de `GROUPS` filtrando `"Saldo Inicial"`).

## Fuera de alcance

- No se migran retroactivamente las filas históricas de `"Transf entre
  cuentas"` ya cargadas a mano — quedan como están, sin `transfer_id`.
- No hay transacciones atómicas reales: Supabase se usa vía PostgREST
  (`supabase-js`), así que la creación/edición/borrado de las dos filas se
  hace con llamadas secuenciales. Si la segunda falla después de la primera,
  puede quedar una mitad huérfana o desincronizada; se muestra un error si
  ocurre, pero no hay rollback automático. Es el mismo riesgo que ya existe
  hoy con la carga manual duplicada, ahora automatizado.
- "Eliminar solo este" no limpia el `transferId` de la contraparte que queda;
  esa contraparte simplemente deja de tener un par real, pero sigue
  funcionando como un movimiento normal (ya no se le vuelve a mostrar el
  indicador de vínculo porque su contraparte ya no existe en `state.movements`
  — la búsqueda de la contraparte por `id` simplemente no encuentra nada).
