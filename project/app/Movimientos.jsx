// Movimientos.jsx — ABM de movimientos por banco
const { useState: useStateM, useMemo: useMemoM } = React;

function MovEditor({ bankId, initial, onSave, onClose }) {
  const blank = {
    descripcion: "", proveedor: "", fechaEmision: "", fechaPago: "",
    cheque: "", credito: 0, debito: 0, grupo: "Pagos",
  };
  const [f, setF] = useStateM(initial ? { ...initial } : { ...blank });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const isIn = ["Ingresos", "Ingreso por Venta de USD"].includes(f.grupo);

  const save = () => {
    if (!f.descripcion.trim()) { alert("La descripción es obligatoria."); return; }
    if (!f.fechaPago) { alert("La fecha de pago es obligatoria (define el mes del cashflow)."); return; }
    onSave({ ...f, bank: bankId, id: initial ? initial.id : CF.uid() });
  };

  return (
    <Modal
      title={(initial ? "Editar" : "Nuevo") + " movimiento · " + CF.BANKS.find((b) => b.id === bankId).short}
      width={640}
      onClose={onClose}
      footer={<>
        <button className="btn btn--ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn--primary" onClick={save}>{initial ? "Guardar cambios" : "Agregar"}</button>
      </>}
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
            {CF.GROUPS.filter((g) => g !== "Saldo Inicial").map((g) => <option key={g} value={g}>{g}</option>)}
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
        {isIn ? "Sugerencia: para ingresos cargá el monto en Crédito." : "Sugerencia: para pagos y transferencias salientes cargá el monto en Débito."}
      </p>
    </Modal>
  );
}

function BankSummaryCard({ summary, bankId }) {
  const b = CF.BANKS.find((x) => x.id === bankId);
  const items = [
    { k: "Saldo Inicial", v: summary.inicial },
    { k: "Ingresos", v: summary.ingresos, cls: "pos" },
    { k: "Venta de USD", v: summary.ventaUSD, cls: "pos" },
    { k: "Pagos", v: summary.pagos, cls: "neg" },
    { k: "Transf entre cuentas", v: summary.transf },
  ];
  return (
    <div className="sumcard" style={{ "--bk": b.color }}>
      <div className="sumcard-grid">
        {items.map((it) => (
          <div className="sumcard-item" key={it.k}>
            <span className="sumcard-k">{it.k}</span>
            <span className={"sumcard-v " + (it.cls || "")}>{CF.money(it.v)}</span>
          </div>
        ))}
        <div className="sumcard-item sumcard-item--final">
          <span className="sumcard-k">Saldo final</span>
          <span className="sumcard-v big">{CF.money(summary.final)}</span>
        </div>
      </div>
      <div className={"sumcard-control " + (Math.abs(summary.control) < 0.01 ? "ok" : "err")}>
        {Math.abs(summary.control) < 0.01 ? "✓ Control OK" : "⚠ Control: " + CF.money(summary.control)}
      </div>
    </div>
  );
}

function Movimientos({ state, dispatch }) {
  const [bankId, setBankId] = useStateM("galicia");
  const [editing, setEditing] = useStateM(null); // {row} o 'new'
  const [confirm, setConfirm] = useStateM(null);

  const rows = useMemoM(() => CF.bankRows(state, bankId), [state, bankId]);
  const summary = useMemoM(() => CF.bankSummary(state, bankId), [state, bankId]);
  const b = CF.BANKS.find((x) => x.id === bankId);

  const saveMov = (mov) => {
    dispatch((s) => {
      const exists = s.movements.some((m) => m.id === mov.id);
      const movements = exists ? s.movements.map((m) => (m.id === mov.id ? mov : m)) : [...s.movements, mov];
      return { ...s, movements };
    });
    setEditing(null);
  };
  const delMov = (id) => {
    dispatch((s) => ({ ...s, movements: s.movements.filter((m) => m.id !== id) }));
    setConfirm(null);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Movimientos</h1>
          <p className="view-sub">Carga diaria por banco · se resumen automáticamente en el Cashflow por fecha de pago.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setEditing("new")}>+ Nuevo movimiento</button>
      </div>

      <div className="bank-tabs">
        {CF.BANKS.map((bk) => (
          <button
            key={bk.id}
            className={"bank-tab" + (bankId === bk.id ? " active" : "")}
            style={{ "--bk": bk.color }}
            onClick={() => setBankId(bk.id)}
          >
            <span className="bank-dot"></span>{bk.name}
            <span className="bank-count">{state.movements.filter((m) => m.bank === bk.id).length}</span>
          </button>
        ))}
      </div>

      <BankSummaryCard summary={summary} bankId={bankId} />

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="c-desc">Descripción</th>
              <th className="c-prov">Proveedor / Cliente</th>
              <th className="c-date">F. emisión</th>
              <th className="c-date">F. pago</th>
              <th className="c-chk">Cheque</th>
              <th className="c-grp">Agrupación</th>
              <th className="c-num">Crédito</th>
              <th className="c-num">Débito</th>
              <th className="c-num">Saldo</th>
              <th className="c-act"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="row-init" style={{ "--bk": b.color }}>
              <td className="c-desc"><strong>Saldo Inicial</strong></td>
              <td colSpan={7}></td>
              <td className="c-num"><Money v={summary.inicial} bold /></td>
              <td></td>
            </tr>
            {rows.map((r) => (
              <tr key={r.id} className="row" onDoubleClick={() => setEditing(r)}>
                <td className="c-desc">{r.descripcion}</td>
                <td className="c-prov">{r.proveedor}</td>
                <td className="c-date">{fmtDate(r.fechaEmision)}</td>
                <td className="c-date">{fmtDate(r.fechaPago)}</td>
                <td className="c-chk">{r.cheque}</td>
                <td className="c-grp"><GroupChip group={r.grupo} /></td>
                <td className="c-num">{r.credito ? <Money v={r.credito} signed /> : ""}</td>
                <td className="c-num">{r.debito ? <span className="money money--neg">{CF.money(r.debito)}</span> : ""}</td>
                <td className="c-num"><Money v={r.saldo} signed bold /></td>
                <td className="c-act">
                  <button className="rowbtn" title="Editar" onClick={() => setEditing(r)}>✎</button>
                  <button className="rowbtn rowbtn--del" title="Eliminar" onClick={() => setConfirm(r)}>🗑</button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="empty">Sin movimientos. Agregá el primero con “+ Nuevo movimiento”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <MovEditor
          bankId={bankId}
          initial={editing === "new" ? null : editing}
          onSave={saveMov}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <Confirm
          message={`¿Eliminar el movimiento “${confirm.descripcion}”?`}
          onYes={() => delMov(confirm.id)}
          onNo={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

Object.assign(window, { Movimientos });
