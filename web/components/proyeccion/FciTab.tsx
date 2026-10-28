"use client";

import { useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { money } from "@/lib/format";
import { monthLong } from "@/lib/dates";
import type { CashflowState } from "@/lib/types";
import { Money, MoneyInput } from "@/components/ui";
import { MatrixShell } from "./MatrixShell";
import { CellMoneyEditor } from "./CellMoneyEditor";

const FIELDS: { id: "suscripciones" | "rescates"; label: string; cls: string }[] = [
  { id: "suscripciones", label: "Suscripciones", cls: "pos" },
  { id: "rescates", label: "Rescates", cls: "neg" },
];

export function FciTab({ state, months, readOnly }: { state: CashflowState; months: string[]; readOnly?: boolean }) {
  const { setFciCell, setFciSaldoInicial } = useCashflow();
  const [edit, setEdit] = useState<{ field: "suscripciones" | "rescates"; monthKey: string } | null>(null);

  const saveCell = (val: number) => {
    if (!edit) return;
    setFciCell(edit.monthKey, edit.field, val);
    setEdit(null);
  };

  const saldoFinal = (idx: number) => {
    let saldo = state.fci.saldoInicial || 0;
    for (let i = 0; i <= idx; i++) {
      const d = state.fci.data[months[i]] ?? { suscripciones: 0, rescates: 0 };
      saldo += (d.suscripciones || 0) - (d.rescates || 0);
    }
    return saldo;
  };

  return (
    <>
      <div className="inline-setting">
        <span>Saldo Inicial FCI</span>
        <span className="inline-money">
          {readOnly ? (
            <Money v={state.fci.saldoInicial} decimals={false} bold />
          ) : (
            <MoneyInput value={state.fci.saldoInicial} onChange={setFciSaldoInicial} />
          )}
        </span>
      </div>
      <MatrixShell months={months} firstColLabel="FCI / Inversiones">
        {FIELDS.map((f) => (
          <tr key={f.id} className="mrow">
            <td className="c-rowhead sticky-col"><span className={"mrow-name " + f.cls}>{f.label}</span></td>
            <td className="c-cell c-total">
              <Money
                v={months.reduce((a, mk) => a + (state.fci.data[mk] ?? { suscripciones: 0, rescates: 0 })[f.id], 0)}
                decimals={false}
                bold
              />
            </td>
            {months.map((mk) => {
              const v = (state.fci.data[mk] ?? { suscripciones: 0, rescates: 0 })[f.id];
              return (
                <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={readOnly ? undefined : () => setEdit({ field: f.id, monthKey: mk })}>
                  {v ? <span className="cell-amt">{money(v, false)}</span> : readOnly ? null : <span className="cell-add">+</span>}
                </td>
              );
            })}
          </tr>
        ))}
        <tr className="mrow mrow--total">
          <td className="c-rowhead sticky-col"><strong>Saldo Final Inversiones</strong></td>
          <td className="c-cell c-total"></td>
          {months.map((mk, idx) => (
            <td key={mk} className="c-cell"><Money v={saldoFinal(idx)} decimals={false} bold /></td>
          ))}
        </tr>
        {edit && (
          <CellMoneyEditor
            title={(edit.field === "suscripciones" ? "Suscripciones" : "Rescates") + " · " + monthLong(edit.monthKey)}
            value={(state.fci.data[edit.monthKey] ?? { suscripciones: 0, rescates: 0 })[edit.field]}
            onSave={saveCell}
            onClose={() => setEdit(null)}
          />
        )}
      </MatrixShell>
    </>
  );
}
