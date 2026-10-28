"use client";

import { useState } from "react";
import { Modal, Field, MoneyInput } from "@/components/ui";
import { useCashflow } from "@/context/CashflowContext";
import { GROUPS, TRANSFER_OWN_BANK_GROUP } from "@/lib/constants";
import { money } from "@/lib/format";
import type { Bank, Movement } from "@/lib/types";

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

function fmtDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function MovEditor({
  bank,
  initial,
  linkedBankName,
  onSave,
  onSaveTransfer,
  onClose,
}: {
  bank: Bank;
  initial: Movement | null;
  linkedBankName?: string;
  onSave: (mov: Movement | Omit<Movement, "id">) => void;
  onSaveTransfer: (legA: Omit<Movement, "id">, legB: Omit<Movement, "id">) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<MovForm>(initial ? { ...initial } : { ...BLANK });
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const set = <K extends keyof MovForm>(k: K, v: MovForm[K]) => setF((p) => ({ ...p, [k]: v }));
  const isIn = ["Ingresos", "Ingreso por Venta de USD", "Rescates"].includes(f.grupo);
  const bankId = bank.id;
  const { db } = useCashflow();
  // Destino de una transferencia a banco propio: cualquier banco activo, de
  // cualquiera de las dos empresas (entre empresas, en el consolidado se anula).
  const destinos = (db?.banks ?? []).filter((b) => b.activo && b.id !== bankId);
  const [otherBankId, setOtherBankId] = useState(
    () => (destinos.find((b) => b.empresaId === bank.empresaId) ?? destinos[0])?.id ?? ""
  );
  const otherBank = destinos.find((b) => b.id === otherBankId);
  const isLinkedEdit = !!(initial && linkedBankName);
  const isNewTransfer = !initial && f.grupo === TRANSFER_OWN_BANK_GROUP;

  const validate = () => {
    if (!f.descripcion.trim()) {
      alert("La descripción es obligatoria.");
      return false;
    }
    if (!f.fechaPago) {
      alert("La fecha de pago es obligatoria (define el mes del cashflow).");
      return false;
    }
    return true;
  };

  const save = () => {
    if (!validate()) return;

    if (isNewTransfer && !otherBank) {
      alert("Elegí el banco destino de la transferencia.");
      return;
    }

    if (isNewTransfer && !confirmingTransfer) {
      setConfirmingTransfer(true);
      return;
    }

    if (isNewTransfer && confirmingTransfer && otherBank) {
      const transferId = crypto.randomUUID();
      const legA: Omit<Movement, "id"> = { ...f, bank: bankId, transferId };
      const legB: Omit<Movement, "id"> = {
        ...f,
        bank: otherBank.id,
        credito: f.debito,
        debito: f.credito,
        transferId,
      };
      onSaveTransfer(legA, legB);
      return;
    }

    if (initial) {
      onSave({ ...f, bank: bankId, id: initial.id, transferId: initial.transferId ?? null });
    } else {
      onSave({ ...f, bank: bankId });
    }
  };

  return (
    <Modal
      title={(initial ? "Editar" : "Nuevo") + " movimiento · " + bank.label}
      width={640}
      onClose={onClose}
      footer={
        confirmingTransfer ? (
          <>
            <button className="btn btn--ghost" onClick={() => setConfirmingTransfer(false)}>Volver</button>
            <button className="btn btn--primary" onClick={save}>Confirmar y crear ambos</button>
          </>
        ) : (
          <>
            <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn--primary" onClick={save}>{initial ? "Guardar cambios" : "Agregar"}</button>
          </>
        )
      }
    >
      {confirmingTransfer ? (
        <div className="transfer-preview">
          <p>
            Se registrará en <strong>{bank.label}</strong>:{" "}
            {f.credito ? `crédito de ${money(f.credito)}` : `débito de ${money(f.debito)}`} el{" "}
            {fmtDate(f.fechaPago)} — {f.descripcion}.
          </p>
          <p>
            Se creará automáticamente en <strong>{otherBank?.label}</strong>:{" "}
            {f.credito ? `débito de ${money(f.credito)}` : `crédito de ${money(f.debito)}`} el{" "}
            {fmtDate(f.fechaPago)} — {f.descripcion}.
          </p>
        </div>
      ) : (
        <>
          <div className="form-grid">
            <Field label="Descripción" wide>
              <input className="inp" autoFocus value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Ej: ESTACION EL BAJO" />
            </Field>
            <Field label="Proveedor / Cliente" wide>
              <input className="inp" value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Agrupación" wide>
              <select className="inp" value={f.grupo} onChange={(e) => set("grupo", e.target.value)} disabled={isLinkedEdit}>
                {GROUPS.filter((g) => g !== "Saldo Inicial").map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
            {isNewTransfer && (
              <Field label="Banco destino" wide>
                <select className="inp" value={otherBankId} onChange={(e) => setOtherBankId(e.target.value)}>
                  {destinos.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </Field>
            )}
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
          {isLinkedEdit && (
            <p className="form-tip">🔗 Vinculado con {linkedBankName}. Los cambios se reflejan también ahí.</p>
          )}
        </>
      )}
    </Modal>
  );
}
