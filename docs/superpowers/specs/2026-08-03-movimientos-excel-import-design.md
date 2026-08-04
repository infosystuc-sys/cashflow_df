# Importación de Movimientos desde Excel

**Fecha:** 2026-08-03
**Estado:** Aprobado, pendiente de implementación

## Contexto

El módulo Movimientos (`app/movimientos/page.tsx`) ya soporta **exportar** a Excel
(botón "⭳ Exportar a Excel", implementado en `lib/export.ts` con la librería `xlsx`).
Exporta lo que está visible en pantalla (banco de la pestaña activa + filtros de
búsqueda/grupo/mes aplicados), con las columnas:

```
Descripción | Proveedor / Cliente | Banco | F. emisión | F. pago | Cheque | Agrupación | Crédito | Débito | Saldo
```

más una fila inicial "Saldo Inicial" con el saldo de arrastre.

Lo que falta es la **importación**: cargar movimientos nuevos desde un Excel en
lugar de uno por uno con el editor manual (`MovEditor.tsx`).

## Objetivo y caso de uso

Uso periódico: el usuario arma o pega movimientos nuevos en una planilla (mismo
formato que el export) y los importa a la app para no cargarlos a mano. No es una
migración única ni un mapeo de resúmenes bancarios crudos — el archivo de entrada
sigue el formato de columnas que la app ya exporta.

## Diseño

### 1. Parseo y validación — `lib/import.ts` (nuevo)

- Lee el `.xlsx` con `xlsx` (import dinámico, igual patrón que `lib/export.ts`).
- Identifica las columnas por **encabezado** (no por posición fija), esperando:
  `Descripción, Proveedor / Cliente, Banco, F. emisión, F. pago, Cheque, Agrupación, Crédito, Débito, Saldo`.
- Columnas ignoradas al importar:
  - **Banco**: no se usa; todas las filas se asignan al banco de la pestaña activa
    (ver sección 4).
  - **Saldo**: es un valor calculado (saldo corriente), no un dato propio del
    movimiento — se descarta.
- La fila **"Saldo Inicial"** (columna Descripción = "Saldo Inicial") se salta:
  no es un movimiento real, es el resumen de arrastre del export.
- Si el encabezado no contiene al menos `Descripción, F. pago, Agrupación, Crédito,
  Débito`, se aborta antes de procesar filas con un mensaje de "formato no
  reconocido" (evita interpretar un archivo cualquiera como si fuera válido).
- Validación por fila (sobre las filas restantes, ya sin la de Saldo Inicial):
  - `descripcion`: no vacía.
  - `fechaPago`: presente, convertible de `dd/mm/yyyy` a ISO `yyyy-mm-dd` (inverso
    de `exDate` en `lib/export.ts`).
  - `grupo`: debe ser uno de `GROUPS` (excluyendo "Saldo Inicial"): `Ingresos`,
    `Pagos`, `Transf entre cuentas`, `Ingreso por Venta de USD`.
  - `credito` / `debito`: numéricos; celda vacía → `0`.
  - `proveedor`, `cheque`, `fechaEmision`: opcionales (vacío → `""`).
- **Todo o nada:** si cualquier fila es inválida, se cancela el import completo
  (no se inserta nada) y se muestra un modal con la lista de filas y motivos
  (ej: "Fila 5: falta Fecha de pago", "Fila 8: Agrupación 'Varios' no es válida").
  El usuario corrige el Excel y reintenta.

### 2. Detección de duplicados y revisión

Si todas las filas pasan validación, se comparan contra los movimientos
**existentes del banco activo** (`state.movements.filter(m => m.bank === bankId)`).

Criterio de coincidencia (posible duplicado): misma `fechaPago` + `descripcion`
normalizada (mismo criterio de `norm()` que ya usa la página de Movimientos para
buscar) + mismo importe (el de `credito` si es un ingreso, el de `debito` si es un
egreso).

Se abre un modal de revisión (usando el `Modal` de `components/ui/index.tsx`) con:

- Resumen arriba: "X nuevos · Y posibles duplicados".
- Tabla con una fila por movimiento parseado y checkbox de inclusión:
  - Fila nueva → checkbox tildado por defecto.
  - Fila que matchea un existente → tildada como "posible duplicado" (badge),
    checkbox **destildado** por defecto (el usuario puede tildarla si de verdad
    quiere importarla igual).
- Footer: "Cancelar" / "Importar seleccionados (N)" (N = filas tildadas).

### 3. Inserción — bulk insert

Para no hacer una request por fila en importaciones de decenas/cientos de
movimientos:

- `lib/data.ts`: nueva función `insertMovements(rows: Omit<Movement, "id">[]):
  Promise<Movement[]>` que hace un único `supabase.from("movements").insert([...]).select()`.
- `context/CashflowContext.tsx`: nuevo método `addMovements(rows: Omit<Movement,
  "id">[]): Promise<void>` que llama a `insertMovements` y agrega todas las filas
  devueltas al estado local en un solo `setState`.

### 4. UI

- Nuevo botón "⭱ Importar desde Excel" junto al de exportar, en
  `app/movimientos/page.tsx` (`view-head-actions`).
- Dispara un `<input type="file" accept=".xlsx,.xls">` oculto.
- El banco de destino es siempre el de la pestaña activa (`bankId` del estado de
  la página) — coherente con que el export también es por pestaña/banco activo.
  La columna "Banco" del archivo se ignora, como se definió en la sección 1.
- El flujo de importación es independiente de los filtros de búsqueda/mes
  aplicados en la tabla (esos filtros solo afectan qué se ve/exporta, no qué se
  importa).
- Flujo completo: seleccionar archivo → parseo+validación (si falla: modal de
  errores, fin) → detección de duplicados → modal de revisión → confirmar →
  `addMovements` con las filas tildadas → cerrar modal, tabla ya refleja los
  nuevos movimientos (el `state` se actualiza vía contexto, igual que al agregar
  uno manualmente).

## Fuera de alcance

- No se soporta importar resúmenes bancarios crudos (formato propio de cada
  banco) — el archivo de entrada debe seguir el formato de columnas del export.
- No hay actualización de movimientos existentes vía import (solo inserción de
  nuevos); no se usa ningún ID de fila del Excel para hacer upsert.
- No se valida ni importa la columna Banco por fila — ver sección 1/4.
