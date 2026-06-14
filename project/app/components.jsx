// components.jsx — UI compartida
const { useState, useEffect, useRef } = React;

// ---------- Modal ----------
function Modal({ title, onClose, children, width = 560, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" style={{ width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---------- Campo de texto / fecha ----------
function Field({ label, children, hint, wide }) {
  return (
    <label className={"field" + (wide ? " field--wide" : "")}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ---------- Input de monto (es-AR) ----------
function MoneyInput({ value, onChange, placeholder = "0,00", autoFocus }) {
  const [text, setText] = useState(value ? CF.money(value) : "");
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  return (
    <input
      ref={ref}
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(CF.parseNum(e.target.value));
      }}
      onBlur={(e) => { const v = CF.parseNum(e.target.value); setText(v ? CF.money(v) : ""); }}
    />
  );
}

// ---------- Input numérico simple (cantidades, precios) ----------
function NumInput({ value, onChange, placeholder = "0", decimals = false }) {
  const [text, setText] = useState(value ? (decimals ? CF.money(value) : CF.num(value)) : "");
  return (
    <input
      className="inp inp--num"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => { setText(e.target.value); onChange(CF.parseNum(e.target.value)); }}
      onBlur={(e) => { const v = CF.parseNum(e.target.value); setText(v ? (decimals ? CF.money(v) : CF.num(v)) : ""); }}
    />
  );
}

// ---------- Chip de agrupación ----------
function GroupChip({ group }) {
  const map = {
    "Ingresos": "chip--in",
    "Pagos": "chip--out",
    "Transf entre cuentas": "chip--transf",
    "Ingreso por Venta de USD": "chip--usd",
    "Saldo Inicial": "chip--init",
  };
  return <span className={"chip " + (map[group] || "")}>{group}</span>;
}

// ---------- Confirmación ----------
function Confirm({ message, onYes, onNo }) {
  return (
    <Modal title="Confirmar" width={420} onClose={onNo}
      footer={<>
        <button className="btn btn--ghost" onClick={onNo}>Cancelar</button>
        <button className="btn btn--danger" onClick={onYes}>Eliminar</button>
      </>}>
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}

// ---------- Celda de dinero para tablas ----------
function Money({ v, decimals = true, dim, bold, signed }) {
  const cls = ["money"];
  if (dim) cls.push("money--dim");
  if (bold) cls.push("money--bold");
  if (signed && v < 0) cls.push("money--neg");
  if (signed && v > 0) cls.push("money--pos");
  return <span className={cls.join(" ")}>{CF.money(v, decimals)}</span>;
}

Object.assign(window, { Modal, Field, MoneyInput, NumInput, GroupChip, Confirm, Money });
