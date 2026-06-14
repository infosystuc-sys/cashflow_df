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
          <td className="c-cell c-total"><Money v={rowTotal(r)} decimals={false} bold /></td>
          {months.map((mk) => {
            const v = state.iva[r]?.[mk] || 0;
            return (
              <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={() => setEdit({ row: r, monthKey: mk })}>
                {v ? <span className="cell-amt">{money(v, false)}</span> : <span className="cell-add">+</span>}
              </td>
            );
          })}
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>S/ Libro IVA Ventas</strong></td>
        <td className="c-cell c-total"><Money v={months.reduce((a, mk) => a + colTotal(mk), 0)} decimals={false} bold /></td>
        {months.map((mk) => (
          <td key={mk} className="c-cell"><Money v={colTotal(mk)} decimals={false} bold /></td>
        ))}
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
