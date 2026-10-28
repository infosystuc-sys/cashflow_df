"use client";

import { useState } from "react";
import { Modal, Field } from "@/components/ui";
import type { Bank, BankId } from "@/lib/types";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type ChequeActionExtra =
  | { type: "banco"; label: string; initial: BankId | "" }
  | { type: "texto"; label: string; placeholder?: string };

export function ChequeActionModal({
  title,
  dateLabel,
  confirmLabel,
  extra,
  banks,
  onConfirm,
  onClose,
}: {
  title: string;
  dateLabel: string;
  confirmLabel: string;
  extra?: ChequeActionExtra;
  banks: Bank[]; // bancos propios elegibles (los de la empresa del cheque)
  onConfirm: (fecha: string, extraValue: string) => void;
  onClose: () => void;
}) {
  const [fecha, setFecha] = useState(today());
  const [extraValue, setExtraValue] = useState<string>(extra && extra.type === "banco" ? extra.initial : "");

  const canConfirm = !!fecha && (!extra || !!extraValue.trim());

  return (
    <Modal
      title={title}
      width={420}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={() => onConfirm(fecha, extraValue)} disabled={!canConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <Field label={dateLabel} wide>
        <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} autoFocus />
      </Field>
      {extra && extra.type === "banco" && (
        <Field label={extra.label} wide>
          <select className="inp" value={extraValue} onChange={(e) => setExtraValue(e.target.value)}>
            <option value="">Elegir banco…</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </Field>
      )}
      {extra && extra.type === "texto" && (
        <Field label={extra.label} wide>
          <input className="inp" value={extraValue} onChange={(e) => setExtraValue(e.target.value)} placeholder={extra.placeholder} />
        </Field>
      )}
    </Modal>
  );
}
