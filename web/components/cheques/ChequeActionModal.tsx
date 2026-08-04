"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/ui";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChequeActionModal({
  title,
  dateLabel,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  dateLabel: string;
  confirmLabel: string;
  onConfirm: (fecha: string) => void;
  onClose: () => void;
}) {
  const [fecha, setFecha] = useState(today());

  return (
    <Modal
      title={title}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onConfirm(fecha)} disabled={!fecha}>{confirmLabel}</button>
        </>
      }
    >
      <Field label={dateLabel} wide>
        <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
