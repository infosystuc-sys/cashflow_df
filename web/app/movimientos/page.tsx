"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { bankRows, bankSummary } from "@/lib/calc";
import { BANKS, GROUPS } from "@/lib/constants";
import { money } from "@/lib/format";
import { monthLabel } from "@/lib/dates";
import { downloadXlsx, exDate, type Cell } from "@/lib/export";
import type { BankId, Movement } from "@/lib/types";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
import { Money, GroupChip, Confirm } from "@/components/ui";
import { MovEditor } from "@/components/movimientos/MovEditor";
import { BankSummaryCard } from "@/components/movimientos/BankSummaryCard";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function norm(s: string) {
  return (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

type SearchCol = "todas" | "descripcion" | "proveedor" | "cheque";

const SEARCH_COLS: { id: SearchCol; label: string }[] = [
  { id: "todas", label: "Todas las columnas" },
  { id: "descripcion", label: "Descripción" },
  { id: "proveedor", label: "Proveedor / Cliente" },
  { id: "cheque", label: "Cheque" },
];

const FILTER_GROUPS = GROUPS.filter((g) => g !== "Saldo Inicial");

export default function MovimientosPage() {
  const { state, addMovement, updateMovement, deleteMovement } = useCashflow();
  const [bankId, setBankId] = useState<BankId>("galicia");
  const [editing, setEditing] = useState<Movement | "new" | null>(null);
  const [confirm, setConfirm] = useState<Movement | null>(null);

  // Filtros
  const [searchCol, setSearchCol] = useState<SearchCol>("todas");
  const [search, setSearch] = useState("");
  const [grupo, setGrupo] = useState<string>("todas");
  // null = usar el default (mes en curso). "todos" = sin filtro de mes.
  const [monthSel, setMonthSel] = useState<string | null>(null);

  const rows = useMemo(() => (state ? bankRows(state, bankId) : []), [state, bankId]);
  const summary = useMemo(() => (state ? bankSummary(state, bankId) : null), [state, bankId]);

  // Meses con datos (ambos bancos), ordenados, para navegar por bloques de mes.
  const months = useMemo(() => {
    if (!state) return [] as string[];
    const set = new Set<string>();
    state.movements.forEach((m) => m.fechaPago && set.add(m.fechaPago.slice(0, 7)));
    return [...set].sort();
  }, [state]);

  // Default: mes en curso si tiene datos; si no, el último mes con datos <= actual;
  // si todos son futuros, el más reciente. Si no hay datos, "todos".
  const defaultMonth = useMemo(() => {
    if (!months.length) return "todos";
    const cur = currentMonthKey();
    if (months.includes(cur)) return cur;
    const past = months.filter((m) => m <= cur);
    return past.length ? past[past.length - 1] : months[months.length - 1];
  }, [months]);

  const selMonth = monthSel ?? defaultMonth;

  // Filtra manteniendo el orden del ledger y recuerda el índice del primer visible
  // (para poder arrastrar el saldo previo).
  const { filtered, firstIdx } = useMemo(() => {
    const q = norm(search.trim());
    const out: typeof rows = [];
    let fi = -1;
    rows.forEach((r, i) => {
      if (grupo !== "todas" && r.grupo !== grupo) return;
      if (selMonth !== "todos" && r.fechaPago.slice(0, 7) !== selMonth) return;
      if (q) {
        const fields =
          searchCol === "descripcion" ? [r.descripcion]
          : searchCol === "proveedor" ? [r.proveedor]
          : searchCol === "cheque" ? [r.cheque]
          : [r.descripcion, r.proveedor, r.cheque];
        if (!fields.some((f) => norm(f).includes(q))) return;
      }
      if (fi === -1) fi = i;
      out.push(r);
    });
    return { filtered: out, firstIdx: fi };
  }, [rows, search, searchCol, grupo, selMonth]);

  // Resumen del encabezado calculado sobre lo filtrado. El "Saldo Inicial" arrastra
  // el saldo del ledger justo antes del primer movimiento visible; el "Saldo final"
  // es el saldo real luego del último visible. Sin filtros equivale al resumen completo.
  const viewSummary = useMemo(() => {
    const absInicial = summary ? summary.inicial : 0;
    const inicial = firstIdx > 0 ? rows[firstIdx - 1].saldo : absInicial;
    let ingresos = 0, ventaUSD = 0, pagos = 0, transf = 0;
    for (const r of filtered) {
      const cr = Number(r.credito) || 0;
      const de = Number(r.debito) || 0;
      if (r.grupo === "Ingresos") ingresos += cr;
      else if (r.grupo === "Ingreso por Venta de USD") ventaUSD += cr;
      else if (r.grupo === "Pagos") pagos += de;
      else if (r.grupo === "Transf entre cuentas") transf += cr - de;
    }
    const final = filtered.length ? filtered[filtered.length - 1].saldo : inicial;
    const control = inicial + ingresos + ventaUSD - pagos + transf - final;
    return { inicial, ingresos, ventaUSD, pagos, transf, final, control };
  }, [rows, filtered, firstIdx, summary]);

  if (!state || !summary) return null;

  const b = BANKS.find((x) => x.id === bankId)!;
  const hasFilters = search.trim() !== "" || grupo !== "todas" || selMonth !== "todos";

  const monthIdx = months.indexOf(selMonth);
  const canPrev = selMonth === "todos" ? months.length > 0 : monthIdx > 0;
  const canNext = selMonth === "todos" ? months.length > 0 : monthIdx >= 0 && monthIdx < months.length - 1;
  const goPrev = () => setMonthSel(selMonth === "todos" ? months[months.length - 1] : months[monthIdx - 1]);
  const goNext = () => setMonthSel(selMonth === "todos" ? months[0] : months[monthIdx + 1]);

  const clearFilters = () => {
    setSearch("");
    setSearchCol("todas");
    setGrupo("todas");
    setMonthSel(null);
  };

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

  const exportExcel = () => {
    const header: Cell[] = ["Descripción", "Proveedor / Cliente", "Banco", "F. emisión", "F. pago", "Cheque", "Agrupación", "Crédito", "Débito", "Saldo"];
    const aoa: Cell[][] = [header];
    aoa.push(["Saldo Inicial", "", b.name, "", "", "", "", "", "", viewSummary.inicial]);
    filtered.forEach((r) => {
      aoa.push([
        r.descripcion, r.proveedor, b.name, exDate(r.fechaEmision), exDate(r.fechaPago), r.cheque, r.grupo,
        r.credito || null, r.debito || null, r.saldo,
      ]);
    });
    const suffix = selMonth === "todos" ? "todos" : selMonth;
    downloadXlsx(`Movimientos_${b.short}_${suffix}`, [{ name: `${b.short} ${suffix}`, aoa }]);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Movimientos</h1>
          <p className="view-sub">Carga diaria por banco · se resumen automáticamente en el Cashflow por fecha de pago.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
          <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo movimiento</button>
        </div>
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

      <BankSummaryCard summary={viewSummary} bankId={bankId} />

      <div className="mov-filters">
        <div className="filt filt--search">
          <span className="filt-label">Buscar</span>
          <div className="filt-search-row">
            <select className="inp" value={searchCol} onChange={(e) => setSearchCol(e.target.value as SearchCol)}>
              {SEARCH_COLS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <input
              className="inp"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribí un valor…"
            />
          </div>
        </div>
        <div className="filt">
          <span className="filt-label">Agrupación</span>
          <select className="inp" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            <option value="todas">Todas</option>
            {FILTER_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="filt">
          <span className="filt-label">Mes</span>
          <div className="filt-month">
            <button className="month-nav" onClick={goPrev} disabled={!canPrev} aria-label="Mes anterior" title="Mes anterior">‹</button>
            <select className="inp" value={selMonth} onChange={(e) => setMonthSel(e.target.value)}>
              <option value="todos">Todos los meses</option>
              {months.map((mk) => (
                <option key={mk} value={mk}>{monthLabel(mk)}</option>
              ))}
            </select>
            <button className="month-nav" onClick={goNext} disabled={!canNext} aria-label="Mes siguiente" title="Mes siguiente">›</button>
          </div>
        </div>
        {hasFilters && (
          <button className="btn btn--ghost filt-clear" onClick={clearFilters}>Limpiar filtros</button>
        )}
      </div>

      {hasFilters && (
        <p className="mov-filter-count">
          Mostrando {filtered.length} de {rows.length} movimientos.
        </p>
      )}

      <div className="table-wrap">
        <table className="grid mov-table">
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
              <td className="c-desc">
                <strong>Saldo Inicial</strong>
                {hasFilters && <span className="row-init-hint"> (arrastre previo)</span>}
              </td>
              <td colSpan={7}></td>
              <td className="c-num"><Money v={viewSummary.inicial} bold /></td>
              <td></td>
            </tr>
            {filtered.map((r) => (
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
            {rows.length > 0 && filtered.length === 0 && (
              <tr><td colSpan={10} className="empty">Sin resultados para los filtros aplicados.</td></tr>
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
