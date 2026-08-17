"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";
import { BANKS } from "@/lib/constants";
import type { Cheque } from "@/lib/types";

type ChequeForm = {
  cliente: string;
  numero: string;
  bancoEmisor: string;
  bancoDestino: Cheque["bancoDestino"];
  importe: number;
  fechaRecepcion: string;
  fechaPago: string;
};

const BLANK: ChequeForm = {
  cliente: "",
  numero: "",
  bancoEmisor: "",
  bancoDestino: "",
  importe: 0,
  fechaRecepcion: "",
  fechaPago: "",
};

export function ChequeEditor({
  initial,
  onSave,
  onClose,
}: {
  initial: Cheque | null;
  onSave: (cheque: Cheque | Omit<Cheque, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<ChequeForm>(initial ? { ...initial } : { ...BLANK });
  const set = <K extends keyof ChequeForm>(k: K, v: ChequeForm[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!f.cliente.trim()) {
      alert("El cliente es obligatorio.");
      return;
    }
    if (!f.fechaRecepcion) {
      alert("La fecha de recepción es obligatoria (define el mes en el cashflow).");
      return;
    }
    if (initial) {
      onSave({ ...initial, ...f });
    } else {
      onSave({
        ...f,
        estado: "en_cartera",
        fechaDeposito: "",
        fechaAcreditacion: "",
        fechaRechazo: "",
        fechaEndoso: "",
        fechaCesion: "",
        endosadoA: "",
        movementId: null,
      });
    }
  };

  return (
    <Modal
      title={(initial ? "Editar" : "Nuevo") + " cheque"}
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
        <Field label="Cliente / librador" wide>
          <input className="inp" autoFocus value={f.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Ej: AGD" />
        </Field>
        <Field label="N° de cheque">
          <input className="inp" value={f.numero} onChange={(e) => set("numero", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Banco emisor">
          <input className="inp" value={f.bancoEmisor} onChange={(e) => set("bancoEmisor", e.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Banco propio destino">
          <select className="inp" value={f.bancoDestino} onChange={(e) => set("bancoDestino", e.target.value as Cheque["bancoDestino"])}>
            <option value="">Sin definir</option>
            {BANKS.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Importe">
          <MoneyInput value={f.importe} onChange={(v) => set("importe", v)} />
        </Field>
        <Field label="Fecha de recepción" hint="Define el mes en el cashflow">
          <input className="inp" type="date" value={f.fechaRecepcion} onChange={(e) => set("fechaRecepcion", e.target.value)} />
        </Field>
        <Field label="Fecha de pago del cheque">
          <input className="inp" type="date" value={f.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
