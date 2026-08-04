"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { chequesResumen } from "@/lib/calc";
import { money } from "@/lib/format";
import { BANKS } from "@/lib/constants";
import { downloadXlsx, exDate, type Cell } from "@/lib/export";
import type { Cheque, ChequeEstado } from "@/lib/types";
import { Money, Confirm } from "@/components/ui";
import { ChequeEditor } from "@/components/cheques/ChequeEditor";
import { ChequeActionModal } from "@/components/cheques/ChequeActionModal";
import { ChequeSummaryCard } from "@/components/cheques/ChequeSummaryCard";

type Accion = "depositar" | "endosar" | "acreditar" | "rechazar";

const ESTADO_LABEL: Record<ChequeEstado, string> = {
  en_cartera: "En cartera",
  depositado: "Depositado",
  acreditado: "Acreditado",
  endosado: "Endosado",
};

const ACCION_CFG: Record<Accion, { title: string; dateLabel: string; confirmLabel: string }> = {
  depositar: { title: "Depositar cheque", dateLabel: "Fecha de depósito", confirmLabel: "Depositar" },
  endosar: { title: "Endosar cheque", dateLabel: "Fecha de endoso", confirmLabel: "Endosar" },
  acreditar: { title: "Acreditar cheque", dateLabel: "Fecha de acreditación", confirmLabel: "Acreditar" },
  rechazar: { title: "Rechazar cheque", dateLabel: "Fecha de rechazo", confirmLabel: "Rechazar" },
};

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function bancoNombre(id: string) {
  return BANKS.find((b) => b.id === id)?.short || "";
}

export default function ChequesPage() {
  const { state, addCheque, updateCheque, deleteCheque } = useCashflow();
  const [filtro, setFiltro] = useState<ChequeEstado | "todos">("todos");
  const [editing, setEditing] = useState<Cheque | "new" | null>(null);
  const [accion, setAccion] = useState<{ cheque: Cheque; accion: Accion } | null>(null);
  const [confirm, setConfirm] = useState<Cheque | null>(null);

  const resumen = useMemo(() => (state ? chequesResumen(state) : null), [state]);

  const rows = useMemo(() => {
    if (!state) return [];
    const filtered = filtro === "todos" ? state.cheques : state.cheques.filter((c) => c.estado === filtro);
    return [...filtered].sort((a, b) => (a.fechaRecepcion < b.fechaRecepcion ? -1 : a.fechaRecepcion > b.fechaRecepcion ? 1 : 0));
  }, [state, filtro]);

  if (!state || !resumen) return null;

  const saveCheque = async (c: Cheque | Omit<Cheque, "id">) => {
    try {
      if ("id" in c) await updateCheque(c);
      else await addCheque(c);
      setEditing(null);
    } catch (e) {
      alert("No se pudo guardar el cheque: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const delCheque = async (id: string) => {
    try {
      await deleteCheque(id);
      setConfirm(null);
    } catch (e) {
      alert("No se pudo eliminar el cheque: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  const confirmAccion = async (fecha: string) => {
    if (!accion) return;
    const { cheque, accion: a } = accion;
    const patch: Partial<Cheque> =
      a === "depositar" ? { estado: "depositado", fechaDeposito: fecha }
      : a === "endosar" ? { estado: "endosado", fechaEndoso: fecha }
      : a === "acreditar" ? { estado: "acreditado", fechaAcreditacion: fecha }
      : { estado: "en_cartera", fechaRechazo: fecha };
    try {
      await updateCheque({ ...cheque, ...patch });
    } catch (e) {
      alert("No se pudo actualizar el cheque: " + (e instanceof Error ? e.message : String(e)));
      return;
    }
    setAccion(null);
  };

  const exportExcel = () => {
    const header: Cell[] = ["Cliente", "N° cheque", "Banco emisor", "Banco destino", "Importe", "F. recepción", "F. pago", "Estado", "F. depósito", "F. acreditación", "F. rechazo", "F. endoso"];
    const aoa: Cell[][] = [header];
    rows.forEach((c) => {
      aoa.push([
        c.cliente, c.numero, c.bancoEmisor, bancoNombre(c.bancoDestino), c.importe,
        exDate(c.fechaRecepcion), exDate(c.fechaPago), ESTADO_LABEL[c.estado],
        exDate(c.fechaDeposito), exDate(c.fechaAcreditacion), exDate(c.fechaRechazo), exDate(c.fechaEndoso),
      ]);
    });
    downloadXlsx(`Cheques_${filtro}`, [{ name: "Cheques", aoa }]);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cheques de terceros</h1>
          <p className="view-sub">Ingreso y seguimiento de cheques recibidos · se resumen en el Cashflow.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
          <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo cheque</button>
        </div>
      </div>

      <ChequeSummaryCard resumen={resumen} />

      <div className="bank-tabs">
        <button className={"bank-tab" + (filtro === "todos" ? " active" : "")} onClick={() => setFiltro("todos")}>Todos</button>
        {(Object.keys(ESTADO_LABEL) as ChequeEstado[]).map((e) => (
          <button key={e} className={"bank-tab" + (filtro === e ? " active" : "")} onClick={() => setFiltro(e)}>
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        <table className="grid mov-table">
          <thead>
            <tr>
              <th className="c-prov">Cliente</th>
              <th className="c-chk">N° cheque</th>
              <th className="c-desc">Banco emisor</th>
              <th className="c-desc">Banco destino</th>
              <th className="c-num">Importe</th>
              <th className="c-date">F. recepción</th>
              <th className="c-date">F. pago</th>
              <th className="c-grp">Estado</th>
              <th className="c-act"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="row">
                <td className="c-prov">{c.cliente}</td>
                <td className="c-chk">{c.numero}</td>
                <td className="c-desc">{c.bancoEmisor}</td>
                <td className="c-desc">{bancoNombre(c.bancoDestino)}</td>
                <td className="c-num"><Money v={c.importe} bold /></td>
                <td className="c-date">{fmtDate(c.fechaRecepcion)}</td>
                <td className="c-date">{fmtDate(c.fechaPago)}</td>
                <td className="c-grp">
                  <span className={"chip chip--cheque-" + c.estado}>{ESTADO_LABEL[c.estado]}</span>
                </td>
                <td className="c-act">
                  {c.estado === "en_cartera" && (
                    <>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "depositar" })}>Depositar</button>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "endosar" })}>Endosar</button>
                    </>
                  )}
                  {c.estado === "depositado" && (
                    <>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "acreditar" })}>Acreditar</button>
                      <button className="rowbtn rowbtn--text" onClick={() => setAccion({ cheque: c, accion: "rechazar" })}>Rechazar</button>
                    </>
                  )}
                  <button className="rowbtn" title="Editar" onClick={() => setEditing(c)}>✎</button>
                  <button className="rowbtn rowbtn--del" title="Eliminar" onClick={() => setConfirm(c)}>🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="empty">Sin cheques para este filtro. Agregá el primero con “+ Nuevo cheque”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ChequeEditor
          initial={editing === "new" ? null : editing}
          onSave={saveCheque}
          onClose={() => setEditing(null)}
        />
      )}
      {accion && (
        <ChequeActionModal
          {...ACCION_CFG[accion.accion]}
          onConfirm={confirmAccion}
          onClose={() => setAccion(null)}
        />
      )}
      {confirm && (
        <Confirm
          message={`¿Eliminar el cheque de “${confirm.cliente}” por ${money(confirm.importe)}?`}
          onYes={() => delCheque(confirm.id)}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
