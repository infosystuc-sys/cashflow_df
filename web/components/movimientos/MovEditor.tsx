"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";
import { BANKS, GROUPS } from "@/lib/constants";
import type { BankId, Movement } from "@/lib/types";

type MovForm = {
  descripcion: string;
  proveedor: string;
  fechaEmision: string;
  fechaPago: string;
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
};

const BLANK: MovForm = {
  descripcion: "",
  proveedor: "",
  fechaEmision: "",
  fechaPago: "",
  cheque: "",
  credito: 0,
  debito: 0,
  grupo: "Pagos",
};

export function MovEditor({
  bankId,
  initial,
  onSave,
  onClose,
}: {
  bankId: BankId;
  initial: Movement | null;
  onSave: (mov: Movement | Omit<Movement, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<MovForm>(initial ? { ...initial } : { ...BLANK });
  const set = <K extends keyof MovForm>(k: K, v: MovForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const isIn = ["Ingresos", "Ingreso por Venta de USD"].includes(f.grupo);
  const bank = BANKS.find((b) => b.id === bankId)!;

  const save = () => {
    if (!f.descripcion.trim()) {
      alert("La descripción es obligatoria.");
      return;
    }
    if (!f.fechaPago) {
      alert("La fecha de pago es obligatoria (define el mes del cashflow).");
      return;
    }
    if (initial) {
      onSave({ ...f, bank: bankId, id: initial.id });
    } else {
      onSave({ ...f, bank: bankId });
    }
  };

  return (
    <Modal
      title={(initial ? "Editar" : "Nuevo") + " movimiento · " + bank.short}
      width={640}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={save}>{initial ? "Guardar cambios" : "Agregar"}</button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Descripción" wide>
          <input className="inp" autoFocus value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Ej: ESTACION EL BAJO" />
        </Field>
        <Field label="Proveedor / Cliente" wide>
          <input className="inp" value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Agrupación" wide>
          <select className="inp" value={f.grupo} onChange={(e) => set("grupo", e.target.value)}>
            {GROUPS.filter((g) => g !== "Saldo Inicial").map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de emisión">
          <input className="inp" type="date" value={f.fechaEmision} onChange={(e) => set("fechaEmision", e.target.value)} />
        </Field>
        <Field label="Fecha de pago" hint="Define el mes en el cashflow">
          <input className="inp" type="date" value={f.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
        </Field>
        <Field label="Cheque / Nº">
          <input className="inp" value={f.cheque} onChange={(e) => set("cheque", e.target.value)} placeholder="Opcional" />
        </Field>
        <div className="field"></div>
        <Field label={<span style={{ color: "var(--pos)" }}>Crédito (ingreso)</span>}>
          <MoneyInput value={f.credito} onChange={(v) => set("credito", v)} />
        </Field>
        <Field label={<span style={{ color: "var(--neg)" }}>Débito (egreso)</span>}>
          <MoneyInput value={f.debito} onChange={(v) => set("debito", v)} />
        </Field>
      </div>
      <p className="form-tip">
        {isIn
          ? "Sugerencia: para ingresos cargá el monto en Crédito."
          : "Sugerencia: para pagos y transferencias salientes cargá el monto en Débito."}
      </p>
    </Modal>
  );
}
