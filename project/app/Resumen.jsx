// Resumen.jsx — Cashflow mensual (lectura, recalculado)
const { useMemo: useMemoR } = React;

function Resumen({ state }) {
  const cf = useMemoR(() => CF.buildCashflow(state), [state]);
  const months = cf.months;
  const rows = cf.rows;

  // helpers de fila
  const Row = ({ label, get, opts = {} }) => {
    const vals = rows.map((r) => get(r));
    const total = opts.totalMode === "last"
      ? (vals.length ? vals[vals.length - 1] : 0)
      : opts.totalMode === "none" ? null
      : vals.reduce((a, b) => a + (b || 0), 0);
    return (
      <tr className={"cf-row " + (opts.cls || "")}>
        <td className="c-rowhead sticky-col" style={opts.indent ? { paddingLeft: 28 } : null}>{label}</td>
        {vals.map((v, i) => (
          <td key={i} className="cf-cell">
            {opts.blankZero && !v ? "" : <Money v={v} decimals={false} bold={opts.bold} signed={opts.signed} dim={opts.dim} />}
          </td>
        ))}
        <td className="cf-cell c-total">
          {total === null ? "" : <Money v={total} decimals={false} bold signed={opts.signed} />}
        </td>
      </tr>
    );
  };

  const SectionRow = ({ label, accent }) => (
    <tr className="cf-section" style={accent ? { "--acc": accent } : null}>
      <td className="c-rowhead sticky-col">{label}</td>
      {months.map((m) => <td key={m} className="cf-cell"></td>)}
      <td className="cf-cell c-total"></td>
    </tr>
  );

  // datos producto para detalle
  const prodCant = (cid, mk) => { const c = state.projection[cid][mk]; return c ? c.cantidad : 0; };
  const prodPrecio = (cid, mk) => { const c = state.projection[cid][mk]; return c ? c.precio : 0; };
  const products = CF.PROJ_CONCEPTS.filter((c) => c.grupo === "producto");

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cashflow · Resumen</h1>
          <p className="view-sub">{CF.monthLabel(state.settings.rangeStart)} → {CF.monthLabel(state.settings.rangeEnd)} · recalculado desde Movimientos y Proyección.</p>
        </div>
      </div>

      <div className="table-wrap matrix-wrap cf-wrap">
        <table className="grid matrix cf-table">
          <thead>
            <tr>
              <th className="c-rowhead sticky-col">Concepto</th>
              {months.map((m) => <th key={m} className="c-mon">{CF.monthLabel(m)}</th>)}
              <th className="c-mon c-total">Total</th>
            </tr>
          </thead>
          <tbody>
            <SectionRow label="BANCOS" accent="var(--accent)" />
            <Row label="Saldo Inicial Bancos" get={(r) => r.saldoInicialBanco} opts={{ totalMode: "none", dim: true }} />
            <Row label="Ingresos" get={(r) => r.ingresos} opts={{ blankZero: true }} />
            <Row label="Ingreso por Venta de USD" get={(r) => r.ventaUSD} opts={{ blankZero: true }} />
            <Row label="Pagos" get={(r) => r.pagos} opts={{ blankZero: true, cls: "neg-row" }} />
            <Row label="Inversiones en FCI" get={(r) => r.invFCI} opts={{ blankZero: true, signed: true }} />
            <Row label="Transf entre cuentas" get={(r) => r.transf} opts={{ blankZero: true, signed: true }} />
            <Row label="Saldo final Bancos" get={(r) => r.saldoFinalBanco} opts={{ cls: "cf-strong", bold: true, totalMode: "last", signed: true }} />

            <SectionRow label="FCI / INVERSIONES" accent="var(--violet)" />
            <Row label="Saldo Inicial FCI" get={(r) => r.saldoInicialFci} opts={{ totalMode: "none", dim: true }} />
            <Row label="Suscripciones" get={(r) => r.suscripciones} opts={{ blankZero: true }} />
            <Row label="Rescates" get={(r) => r.rescates} opts={{ blankZero: true }} />
            <Row label="Saldo Final Inversiones" get={(r) => r.saldoFinalFci} opts={{ cls: "cf-strong", bold: true, totalMode: "last" }} />

            <Row label="Saldo cierre mes Banco + FCI" get={(r) => r.cierreTotal} opts={{ cls: "cf-grand", bold: true, totalMode: "last", signed: true }} />

            <SectionRow label="INGRESOS PROYECTADOS" accent="var(--teal)" />
            {CF.PROJ_CONCEPTS.map((c) => (
              <Row key={c.id} label={c.name} get={(r) => CF.projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <Row label="Total Ingresos Proyectados" get={(r) => r.proyTotal} opts={{ cls: "cf-strong", bold: true }} />

            <SectionRow label="REAL VS PRESUPUESTADO" accent="var(--amber)" />
            <Row label="Ingresos de dinero s/ Bancos (Real)" get={(r) => r.realIngresos} opts={{ blankZero: true }} />
            <Row label="Total Ingresos Proyectados" get={(r) => r.proyTotal} opts={{ blankZero: true, dim: true }} />
            <Row label="Ingresos por bancos vs presupuestado" get={(r) => r.vsPresup} opts={{ cls: "cf-strong", bold: true, signed: true }} />

            <SectionRow label="DETALLE INGRESOS POR PRODUCTO" accent="var(--accent)" />
            {products.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="cf-prodhead"><td className="c-rowhead sticky-col" colSpan={1}>{c.name}</td>
                  {months.map((m) => <td key={m} className="cf-cell"></td>)}<td className="cf-cell c-total"></td></tr>
                <Row label={c.unidad} get={(r) => prodCant(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                <Row label="Precio" get={(r) => prodPrecio(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                <Row label="Total" get={(r) => CF.projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, bold: true }} />
              </React.Fragment>
            ))}

            <SectionRow label="VENTAS NETAS SEGÚN LIBROS IVA" accent="var(--violet)" />
            {CF.IVA_ROWS.map((r) => (
              <Row key={r} label={r} get={(row) => (state.iva[r] || {})[row.key] || 0} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <Row label="S/ Libro IVA Ventas" get={(row) => CF.IVA_ROWS.reduce((a, r) => a + ((state.iva[r] || {})[row.key] || 0), 0)} opts={{ cls: "cf-strong", bold: true }} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

Object.assign(window, { Resumen });
