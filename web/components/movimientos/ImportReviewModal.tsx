"use client";

import { useState } from "react";
import { Modal, GroupChip } from "@/components/ui";
import type { ParsedRow } from "@/lib/import";

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function ImportReviewModal({
  rows,
  duplicateIds,
  onConfirm,
  onClose,
}: {
  rows: ParsedRow[];
  duplicateIds: (string | null)[];
  onConfirm: (selected: ParsedRow[]) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<boolean[]>(rows.map((_, i) => duplicateIds[i] === null));
  const dupCount = duplicateIds.filter((id) => id !== null).length;
  const newCount = rows.length - dupCount;
  const selectedCount = checked.filter(Boolean).length;

  const toggle = (i: number) => setChecked((c) => c.map((v, idx) => (idx === i ? !v : v)));

  return (
    <Modal
      title="Revisar importación"
      width={860}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn--primary"
            disabled={selectedCount === 0}
            onClick={() => onConfirm(rows.filter((_, i) => checked[i]))}
          >
            Importar seleccionados ({selectedCount})
          </button>
        </>
      }
    >
      <p className="form-tip">
        {newCount} nuevos · {dupCount} posibles duplicados. Los posibles duplicados vienen destildados: tildalos si igual querés importarlos.
      </p>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th></th>
              <th>Descripción</th>
              <th>Proveedor / Cliente</th>
              <th>F. pago</th>
              <th>Agrupación</th>
              <th>Crédito</th>
              <th>Débito</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={duplicateIds[i] !== null ? "row-dup" : "row"}>
                <td>
                  <input type="checkbox" checked={checked[i]} onChange={() => toggle(i)} />
                </td>
                <td>{r.descripcion}</td>
                <td>{r.proveedor}</td>
                <td>{fmtDate(r.fechaPago)}</td>
                <td><GroupChip group={r.grupo} /></td>
                <td>{r.credito || ""}</td>
                <td>{r.debito || ""}</td>
                <td>{duplicateIds[i] !== null && <span className="chip chip--dup">posible duplicado</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
