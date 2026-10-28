import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";
import type { CashflowState, DbState, FciData, IvaData, ProjectionMap, Vista } from "./types";

// Arma el estado de una vista: una empresa sola o el consolidado ("all").
// En el consolidado se suman las dos empresas; las transferencias entre bancos
// de distinta empresa se anulan solas porque entran sus dos patas.
export function scopeState(db: DbState, vista: Vista): CashflowState {
  const empresaIds = vista === "all" ? db.empresas.map((e) => e.id) : [vista];
  const inScope = (empresaId: string) => empresaIds.includes(empresaId);

  const banks = db.banks.filter((b) => inScope(b.empresaId));
  const bankIds = new Set(banks.map((b) => b.id));

  const saldoInicial: Record<string, number> = {};
  banks.forEach((b) => (saldoInicial[b.id] = b.saldoInicial));

  return {
    banks,
    settings: { saldoInicial, rangeStart: db.rangeStart, rangeEnd: db.rangeEnd },
    movements: db.movements.filter((m) => bankIds.has(m.bank)),
    cheques: db.cheques.filter((c) => inScope(c.empresaId)),
    projection: mergeProjection(empresaIds.map((id) => db.projection[id] ?? {})),
    fci: {
      saldoInicial: db.empresas.filter((e) => inScope(e.id)).reduce((a, e) => a + e.fciSaldoInicial, 0),
      data: mergeFci(empresaIds.map((id) => db.fci[id] ?? {})),
    },
    iva: mergeIva(empresaIds.map((id) => db.iva[id] ?? {})),
  };
}

// Suma cantidades y totales; el precio queda como promedio ponderado para que
// cantidad × precio siga dando el total sumado.
function mergeProjection(maps: ProjectionMap[]): ProjectionMap {
  const out: ProjectionMap = {};
  PROJ_CONCEPTS.forEach((c) => (out[c.id] = {}));
  if (maps.length === 1) {
    PROJ_CONCEPTS.forEach((c) => (out[c.id] = { ...(maps[0][c.id] ?? {}) }));
    return out;
  }
  const acc: Record<string, Record<string, { cantidad: number; total: number }>> = {};
  maps.forEach((m) =>
    Object.entries(m).forEach(([cid, months]) =>
      Object.entries(months).forEach(([mk, v]) => {
        acc[cid] ??= {};
        const a = (acc[cid][mk] ??= { cantidad: 0, total: 0 });
        a.cantidad += Number(v.cantidad) || 0;
        a.total += (Number(v.cantidad) || 0) * (Number(v.precio) || 0);
      })
    )
  );
  Object.entries(acc).forEach(([cid, months]) =>
    Object.entries(months).forEach(([mk, a]) => {
      out[cid] ??= {};
      out[cid][mk] = a.cantidad
        ? { cantidad: a.cantidad, precio: a.total / a.cantidad }
        : { cantidad: 1, precio: a.total };
    })
  );
  return out;
}

function mergeFci(list: FciData[]): FciData {
  const out: FciData = {};
  list.forEach((d) =>
    Object.entries(d).forEach(([mk, v]) => {
      const a = (out[mk] ??= { suscripciones: 0, rescates: 0 });
      a.suscripciones += v.suscripciones;
      a.rescates += v.rescates;
    })
  );
  return out;
}

function mergeIva(list: IvaData[]): IvaData {
  const out: IvaData = {};
  IVA_ROWS.forEach((r) => (out[r] = {}));
  list.forEach((d) =>
    Object.entries(d).forEach(([row, months]) =>
      Object.entries(months).forEach(([mk, v]) => {
        out[row] ??= {};
        out[row][mk] = (out[row][mk] || 0) + v;
      })
    )
  );
  return out;
}
