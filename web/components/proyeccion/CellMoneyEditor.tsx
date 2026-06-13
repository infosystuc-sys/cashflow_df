"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";

export function CellMoneyEditor({
  title,
  value,
  onSave,
  onClose,
}: {
  title: string;
  value: number;
  onSave: (val: number) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(value || 0);
  return (
    <Modal
      title={title}
      width={400}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onSave(0)}>Vaciar</button>
          <button className="btn btn--primary" onClick={() => onSave(Number(v) || 0)}>Guardar</button>
        </>
      }
    >
      <Field label="Importe">
        <MoneyInput value={v} onChange={setV} autoFocus />
      </Field>
    </Modal>
  );
}
