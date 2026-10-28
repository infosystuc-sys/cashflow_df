"use client";

import { Modal } from "@/components/ui";
import { money } from "@/lib/format";
import { useCashflow } from "@/context/CashflowContext";
import type { Movement } from "@/lib/types";

export type DrillMode = "credito" | "debito" | "neto";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function CellDetailModal({
  title,
  movements,
  mode,
  onClose,
}: {
  title: string;
  movements: Movement[];
  mode: DrillMode;
  onClose: () => void;
}) {
  const { db } = useCashflow();
  const bankShort = (id: string) => db?.banks.find((b) => b.id === id)?.label || id;
  const amount = (m: Movement) =>
    mode === "debito" ? m.debito : mode === "neto" ? m.credito - m.debito : m.credito;
  const rows = [...movements].sort((a, b) => (a.fechaPago < b.fechaPago ? -1 : a.fechaPago > b.fechaPago ? 1 : 0));
  const total = rows.reduce((a, m) => a + amount(m), 0);

  return (
    <Modal
      title={title}
      width={820}
      onClose={onClose}
      footer={
        <>
          <span className="detail-total">
            {rows.length} movimiento{rows.length === 1 ? "" : "s"} · Total <strong>{money(total, false)}</strong>
          </span>
          <button className="btn btn--primary" onClick={onClose}>Cerrar</button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="confirm-msg">No hay movimientos que compongan este monto.</p>
      ) : (
        <div className="detail-scroll">
          <table className="grid mov-table detail-table">
            <thead>
              <tr>
                <th className="c-desc">Descripción</th>
                <th className="c-prov">Proveedor / Cliente</th>
                <th className="c-date">Banco</th>
                <th className="c-date">F. pago</th>
                <th className="c-chk">Cheque</th>
                <th className="c-num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="row">
                  <td className="c-desc">{m.descripcion}</td>
                  <td className="c-prov">{m.proveedor}</td>
                  <td className="c-date">{bankShort(m.bank)}</td>
                  <td className="c-date">{fmtDate(m.fechaPago)}</td>
                  <td className="c-chk">{m.cheque}</td>
                  <td className="c-num">
                    <span className={"money" + (amount(m) < 0 ? " money--neg" : "")}>{money(amount(m), false)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
