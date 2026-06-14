// Proyeccion.jsx — ABM de proyección (cant×precio), FCI y Ventas IVA
const { useState: useStateP, useMemo: useMemoP } = React;

// Editor de celda cantidad x precio
function CellQPEditor({ concept, monthKey, value, onSave, onClose }) {
  const [cant, setCant] = useStateP(value ? value.cantidad : 0);
  const [precio, setPrecio] = useStateP(value ? value.precio : 0);
  const total = (Number(cant) || 0) * (Number(precio) || 0);
  return (
    <Modal title={concept.name + " · " + CF.monthLong(monthKey)} width={440} onClose={onClose}
      footer={<>
        <button className="btn btn--ghost" onClick={() => onSave(null)}>Vaciar</button>
        <button className="btn btn--primary" onClick={() => onSave({ cantidad: Number(cant) || 0, precio: Number(precio) || 0 })}>Guardar</button>
      </>}>
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
        <strong>{CF.money(total)}</strong>
      </div>
      {concept.tipo === "monto" && <p className="form-tip">Concepto por monto: dejá Cantidad en 1 y cargá el importe en Precio.</p>}
    </Modal>
  );
}

// Editor de monto directo (FCI, IVA)
function CellMoneyEditor({ title, value, onSave, onClose }) {
  const [v, setV] = useStateP(value || 0);
  return (
    <Modal title={title} width={400} onClose={onClose}
      footer={<>
        <button className="btn btn--ghost" onClick={() => onSave(0)}>Vaciar</button>
        <button className="btn btn--primary" onClick={() => onSave(Number(v) || 0)}>Guardar</button>
      </>}>
      <Field label="Importe"><MoneyInput value={v} onChange={setV} autoFocus /></Field>
    </Modal>
  );
}

function MatrixShell({ months, children, firstColLabel }) {
  return (
    <div className="table-wrap matrix-wrap">
      <table className="grid matrix">
        <thead>
          <tr>
            <th className="c-rowhead sticky-col">{firstColLabel}</th>
            {months.map((mk) => <th key={mk} className="c-mon">{CF.monthLabel(mk)}</th>)}
            <th className="c-mon c-total">Total</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ProjTab({ state, dispatch, months }) {
  const [edit, setEdit] = useStateP(null); // {conceptId, monthKey}
  const concept = edit ? CF.PROJ_CONCEPTS.find((c) => c.id === edit.conceptId) : null;

  const saveCell = (val) => {
    const { conceptId, monthKey } = edit;
    dispatch((s) => {
      const projection = { ...s.projection, [conceptId]: { ...s.projection[conceptId] } };
      if (!val || ((val.cantidad || 0) === 0 && (val.precio || 0) === 0)) delete projection[conceptId][monthKey];
      else projection[conceptId][monthKey] = val;
      return { ...s, projection };
    });
    setEdit(null);
  };

  const colTotal = (mk) => CF.projMonthTotal(state, mk);
  const rowTotal = (cid) => months.reduce((a, mk) => a + CF.projTotal(state, cid, mk), 0);
  const grand = months.reduce((a, mk) => a + colTotal(mk), 0);

  return (
    <MatrixShell months={months} firstColLabel="Concepto proyectado">
      {CF.PROJ_CONCEPTS.map((c) => (
        <tr key={c.id} className="mrow">
          <td className="c-rowhead sticky-col">
            <span className="mrow-name">{c.name}</span>
            <span className="mrow-unit">{c.unidad}</span>
          </td>
          {months.map((mk) => {
            const t = CF.projTotal(state, c.id, mk);
            const cell = state.projection[c.id][mk];
            return (
              <td key={mk} className={"c-cell" + (t ? " has" : "")} onClick={() => setEdit({ conceptId: c.id, monthKey: mk })}>
                {t ? <span className="cell-amt">{CF.money(t, false)}</span> : <span className="cell-add">+</span>}
                {cell && c.tipo === "unidad" && <span className="cell-sub">{CF.num(cell.cantidad)}×{CF.money(cell.precio, false)}</span>}
              </td>
            );
          })}
          <td className="c-cell c-total"><Money v={rowTotal(c.id)} decimals={false} bold /></td>
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>Total Ingresos Proyectados</strong></td>
        {months.map((mk) => <td key={mk} className="c-cell c-total"><Money v={colTotal(mk)} decimals={false} bold /></td>)}
        <td className="c-cell c-total"><Money v={grand} decimals={false} bold /></td>
      </tr>
      {edit && concept && (
        <CellQPEditor concept={concept} monthKey={edit.monthKey}
          value={state.projection[edit.conceptId][edit.monthKey]} onSave={saveCell} onClose={() => setEdit(null)} />
      )}
    </MatrixShell>
  );
}

function FciTab({ state, dispatch, months }) {
  const [edit, setEdit] = useStateP(null); // {field, monthKey}
  const saveCell = (val) => {
    const { field, monthKey } = edit;
    dispatch((s) => {
      const data = { ...s.fci.data, [monthKey]: { ...(s.fci.data[monthKey] || {}) } };
      data[monthKey][field] = val;
      return { ...s, fci: { ...s.fci, data } };
    });
    setEdit(null);
  };
  const setInicial = (v) => dispatch((s) => ({ ...s, fci: { ...s.fci, saldoInicial: v } }));

  const fields = [
    { id: "suscripciones", label: "Suscripciones", cls: "pos" },
    { id: "rescates", label: "Rescates", cls: "neg" },
  ];
  const saldoFinal = (mk, idx) => {
    let saldo = state.fci.saldoInicial || 0;
    for (let i = 0; i <= idx; i++) {
      const d = state.fci.data[months[i]] || {};
      saldo += (Number(d.suscripciones) || 0) - (Number(d.rescates) || 0);
    }
    return saldo;
  };

  return (
    <>
      <div className="inline-setting">
        <span>Saldo Inicial FCI</span>
        <span className="inline-money"><MoneyInput value={state.fci.saldoInicial} onChange={setInicial} /></span>
      </div>
      <MatrixShell months={months} firstColLabel="FCI / Inversiones">
        {fields.map((f) => (
          <tr key={f.id} className="mrow">
            <td className="c-rowhead sticky-col"><span className={"mrow-name " + f.cls}>{f.label}</span></td>
            {months.map((mk) => {
              const v = (state.fci.data[mk] || {})[f.id] || 0;
              return (
                <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={() => setEdit({ field: f.id, monthKey: mk })}>
                  {v ? <span className="cell-amt">{CF.money(v, false)}</span> : <span className="cell-add">+</span>}
                </td>
              );
            })}
            <td className="c-cell c-total"><Money v={months.reduce((a, mk) => a + ((state.fci.data[mk] || {})[f.id] || 0), 0)} decimals={false} bold /></td>
          </tr>
        ))}
        <tr className="mrow mrow--total">
          <td className="c-rowhead sticky-col"><strong>Saldo Final Inversiones</strong></td>
          {months.map((mk, idx) => <td key={mk} className="c-cell c-total"><Money v={saldoFinal(mk, idx)} decimals={false} bold /></td>)}
          <td className="c-cell c-total"></td>
        </tr>
        {edit && (
          <CellMoneyEditor title={(edit.field === "suscripciones" ? "Suscripciones" : "Rescates") + " · " + CF.monthLong(edit.monthKey)}
            value={(state.fci.data[edit.monthKey] || {})[edit.field] || 0} onSave={saveCell} onClose={() => setEdit(null)} />
        )}
      </MatrixShell>
    </>
  );
}

function IvaTab({ state, dispatch, months }) {
  const [edit, setEdit] = useStateP(null);
  const saveCell = (val) => {
    const { row, monthKey } = edit;
    dispatch((s) => {
      const iva = { ...s.iva, [row]: { ...s.iva[row] } };
      if (!val) delete iva[row][monthKey]; else iva[row][monthKey] = val;
      return { ...s, iva };
    });
    setEdit(null);
  };
  const colTotal = (mk) => CF.IVA_ROWS.reduce((a, r) => a + ((state.iva[r] || {})[mk] || 0), 0);
  const rowTotal = (r) => months.reduce((a, mk) => a + ((state.iva[r] || {})[mk] || 0), 0);

  return (
    <MatrixShell months={months} firstColLabel="Ventas netas s/ libros IVA">
      {CF.IVA_ROWS.map((r) => (
        <tr key={r} className="mrow">
          <td className="c-rowhead sticky-col"><span className="mrow-name">{r}</span></td>
          {months.map((mk) => {
            const v = (state.iva[r] || {})[mk] || 0;
            return (
              <td key={mk} className={"c-cell" + (v ? " has" : "")} onClick={() => setEdit({ row: r, monthKey: mk })}>
                {v ? <span className="cell-amt">{CF.money(v, false)}</span> : <span className="cell-add">+</span>}
              </td>
            );
          })}
          <td className="c-cell c-total"><Money v={rowTotal(r)} decimals={false} bold /></td>
        </tr>
      ))}
      <tr className="mrow mrow--total">
        <td className="c-rowhead sticky-col"><strong>S/ Libro IVA Ventas</strong></td>
        {months.map((mk) => <td key={mk} className="c-cell c-total"><Money v={colTotal(mk)} decimals={false} bold /></td>)}
        <td className="c-cell c-total"><Money v={months.reduce((a, mk) => a + colTotal(mk), 0)} decimals={false} bold /></td>
      </tr>
      {edit && (
        <CellMoneyEditor title={edit.row + " · " + CF.monthLong(edit.monthKey)}
          value={(state.iva[edit.row] || {})[edit.monthKey] || 0} onSave={saveCell} onClose={() => setEdit(null)} />
      )}
    </MatrixShell>
  );
}

function Proyeccion({ state, dispatch }) {
  const [tab, setTab] = useStateP("proj");
  const months = useMemoP(() => CF.monthRange(state.settings.rangeStart, state.settings.rangeEnd), [state.settings.rangeStart, state.settings.rangeEnd]);
  const tabs = [
    { id: "proj", label: "Ingresos proyectados" },
    { id: "fci", label: "FCI / Inversiones" },
    { id: "iva", label: "Ventas netas IVA" },
  ];
  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Proyección</h1>
          <p className="view-sub">Tocá cualquier celda para cargar valores. Los totales alimentan el Cashflow.</p>
        </div>
      </div>
      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t.id} className={"subtab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {tab === "proj" && <ProjTab state={state} dispatch={dispatch} months={months} />}
      {tab === "fci" && <FciTab state={state} dispatch={dispatch} months={months} />}
      {tab === "iva" && <IvaTab state={state} dispatch={dispatch} months={months} />}
    </div>
  );
}

Object.assign(window, { Proyeccion });
