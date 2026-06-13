"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { money, num, parseNum } from "@/lib/format";

export function Modal({
  title,
  onClose,
  children,
  width = 560,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal to <body>: callers may render a Modal inside a <table>/<tbody>
  // (e.g. the Proyección matrix), where a fixed-position backdrop div
  // would otherwise be invalid HTML nesting.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function Field({
  label,
  children,
  hint,
  wide,
}: {
  label: ReactNode;
  children: ReactNode;
  hint?: string;
  wide?: boolean;
}) {
  return (
    <label className={"field" + (wide ? " field--wide" : "")}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  autoFocus,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(value ? money(value) : "");
  const ref = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!focused.current) setText(value ? money(value) : "");
  }, [value]);

  return (
    <input
      ref={ref}
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
      onBlur={(e) => {
        focused.current = false;
        const v = parseNum(e.target.value);
        setText(v ? money(v) : "");
      }}
    />
  );
}

export function NumInput({
  value,
  onChange,
  placeholder = "0",
  decimals = false,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  decimals?: boolean;
}) {
  const [text, setText] = useState(value ? (decimals ? money(value) : num(value)) : "");

  return (
    <input
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseNum(e.target.value));
      }}
      onBlur={(e) => {
        const v = parseNum(e.target.value);
        setText(v ? (decimals ? money(v) : num(v)) : "");
      }}
    />
  );
}

const GROUP_CHIP_CLASS: Record<string, string> = {
  Ingresos: "chip--in",
  Pagos: "chip--out",
  "Transf entre cuentas": "chip--transf",
  "Ingreso por Venta de USD": "chip--usd",
  "Saldo Inicial": "chip--init",
};

export function GroupChip({ group }: { group: string }) {
  return <span className={"chip " + (GROUP_CHIP_CLASS[group] || "")}>{group}</span>;
}

export function Confirm({
  message,
  onYes,
  onNo,
}: {
  message: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal
      title="Confirmar"
      width={420}
      onClose={onNo}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onNo}>
            Cancelar
          </button>
          <button className="btn btn--danger" onClick={onYes}>
            Eliminar
          </button>
        </>
      }
    >
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}

export function Money({
  v,
  decimals = true,
  dim,
  bold,
  signed,
}: {
  v: number;
  decimals?: boolean;
  dim?: boolean;
  bold?: boolean;
  signed?: boolean;
}) {
  const cls = ["money"];
  if (dim) cls.push("money--dim");
  if (bold) cls.push("money--bold");
  if (signed && v < 0) cls.push("money--neg");
  if (signed && v > 0) cls.push("money--pos");
  return <span className={cls.join(" ")}>{money(v, decimals)}</span>;
}
