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
          <td className="c-cell c-total"><Money v={rowTotal(c.id)} decimals={false} bold /></td>
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
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>Total Ingresos Proyectados</strong></td>
        <td className="c-cell c-total"><Money v={grand} decimals={false} bold /></td>
        {months.map((mk) => (
          <td key={mk} className="c-cell"><Money v={colTotal(mk)} decimals={false} bold /></td>
        ))}
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
