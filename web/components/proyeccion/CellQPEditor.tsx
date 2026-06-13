"use client";

import { useState } from "react";
import { Modal, Field, NumInput, MoneyInput } from "@/components/ui";
import { money } from "@/lib/format";
import { monthLong } from "@/lib/dates";
import type { ProjConcept, ProjectionValue } from "@/lib/types";

export function CellQPEditor({
  concept,
  monthKey,
  value,
  onSave,
  onClose,
}: {
  concept: ProjConcept;
  monthKey: string;
  value: ProjectionValue | undefined;
  onSave: (val: ProjectionValue | null) => void;
  onClose: () => void;
}) {
  const [cant, setCant] = useState(value ? value.cantidad : 0);
  const [precio, setPrecio] = useState(value ? value.precio : 0);
  const total = (Number(cant) || 0) * (Number(precio) || 0);

  return (
    <Modal
      title={concept.name + " · " + monthLong(monthKey)}
      width={440}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={() => onSave(null)}>Vaciar</button>
          <button className="btn btn--primary" onClick={() => onSave({ cantidad: Number(cant) || 0, precio: Number(precio) || 0 })}>Guardar</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={"Cantidad (" + concept.unidad + ")"}>
          <NumInput value={cant} onChange={setCant} />
        </Field>
        <Field label="Precio unitario">
          <MoneyInput value={precio} onChange={setPrecio} />
        </Field>
      </div>
      <div className="cell-total">
        <span>Total</span>
        <strong>{money(total)}</strong>
      </div>
      {concept.tipo === "monto" && (
        <p className="form-tip">Concepto por monto: dejá Cantidad en 1 y cargá el importe en Precio.</p>
      )}
    </Modal>
  );
}
