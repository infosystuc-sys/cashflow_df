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
