"use client";

import { Fragment, useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { buildCashflow, projTotal } from "@/lib/calc";
import { monthLabel } from "@/lib/dates";
import { PROJ_CONCEPTS, IVA_ROWS } from "@/lib/constants";
import { Money } from "@/components/ui";
import type { CashflowRow } from "@/lib/types";

interface RowOpts {
  cls?: string;
  indent?: boolean;
  totalMode?: "sum" | "last" | "none";
  blankZero?: boolean;
  bold?: boolean;
  signed?: boolean;
  dim?: boolean;
}

function CfRow({
  label,
  rows,
  get,
  opts = {},
  hideEmpty,
}: {
  label: string;
  rows: CashflowRow[];
  get: (r: CashflowRow) => number;
  opts?: RowOpts;
  hideEmpty?: boolean;
}) {
  const vals = rows.map(get);
  if (hideEmpty && vals.every((v) => !v)) return null;
  const total =
    opts.totalMode === "last"
      ? vals.length ? vals[vals.length - 1] : 0
      : opts.totalMode === "none"
      ? null
      : vals.reduce((a, b) => a + (b || 0), 0);
  return (
    <tr className={"cf-row " + (opts.cls || "")}>
      <td className="c-rowhead sticky-col" style={opts.indent ? { paddingLeft: 28 } : undefined}>
        {label}
      </td>
      <td className="cf-cell c-total">
        {total === null ? "" : <Money v={total} decimals={false} bold signed={opts.signed} />}
      </td>
      {vals.map((v, i) => (
        <td key={i} className="cf-cell">
          {opts.blankZero && !v ? "" : <Money v={v} decimals={false} bold={opts.bold} signed={opts.signed} dim={opts.dim} />}
        </td>
      ))}
    </tr>
  );
}

function CfSectionRow({ label, months, accent }: { label: string; months: string[]; accent?: string }) {
  return (
    <tr className="cf-section" style={accent ? ({ "--acc": accent } as React.CSSProperties) : undefined}>
      <td className="c-rowhead sticky-col">{label}</td>
      <td className="cf-cell c-total"></td>
      {months.map((m) => (
        <td key={m} className="cf-cell"></td>
      ))}
    </tr>
  );
}

export default function CashflowPage() {
  const { state } = useCashflow();
  const cf = useMemo(() => (state ? buildCashflow(state) : { months: [], rows: [] }), [state]);
  const months = cf.months;
  const rows = cf.rows;
  const [hideEmpty, setHideEmpty] = useState(false);

  if (!state) return null;

  const prodCant = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.cantidad : 0;
  };
  const prodPrecio = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.precio : 0;
  };
  const products = PROJ_CONCEPTS.filter((c) => c.grupo === "producto");
  const Row = (props: Parameters<typeof CfRow>[0]) => <CfRow {...props} hideEmpty={hideEmpty} />;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cashflow · Resumen</h1>
          <p className="view-sub">
            {monthLabel(state.settings.rangeStart)} → {monthLabel(state.settings.rangeEnd)} · recalculado desde Movimientos y Proyección.
          </p>
        </div>
        <label className="cf-toggle">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          Ocultar filas sin datos
        </label>
      </div>

      <div className="table-wrap matrix-wrap cf-wrap">
        <table className="grid matrix cf-table">
          <thead>
            <tr>
              <th className="c-rowhead sticky-col">Concepto</th>
              <th className="c-mon c-total">Total</th>
              {months.map((m) => (
                <th key={m} className="c-mon">{monthLabel(m)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <CfSectionRow label="BANCOS" months={months} accent="var(--accent)" />
            <Row label="Saldo Inicial Bancos" rows={rows} get={(r) => r.saldoInicialBanco} opts={{ totalMode: "none", dim: true }} />
            <Row label="Ingresos" rows={rows} get={(r) => r.ingresos} opts={{ blankZero: true }} />
            <Row label="Ingreso por Venta de USD" rows={rows} get={(r) => r.ventaUSD} opts={{ blankZero: true }} />
            <Row label="Pagos" rows={rows} get={(r) => r.pagos} opts={{ blankZero: true, cls: "neg-row" }} />
            <Row label="Inversiones en FCI" rows={rows} get={(r) => r.invFCI} opts={{ blankZero: true, signed: true }} />
            <Row label="Transf entre cuentas" rows={rows} get={(r) => r.transf} opts={{ blankZero: true, signed: true }} />
            <Row label="Saldo final Bancos" rows={rows} get={(r) => r.saldoFinalBanco} opts={{ cls: "cf-strong", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="FCI / INVERSIONES" months={months} accent="var(--violet)" />
            <Row label="Saldo Inicial FCI" rows={rows} get={(r) => r.saldoInicialFci} opts={{ totalMode: "none", dim: true }} />
            <Row label="Suscripciones" rows={rows} get={(r) => r.suscripciones} opts={{ blankZero: true }} />
            <Row label="Rescates" rows={rows} get={(r) => r.rescates} opts={{ blankZero: true }} />
            <Row label="Saldo Final Inversiones" rows={rows} get={(r) => r.saldoFinalFci} opts={{ cls: "cf-strong", bold: true, totalMode: "last" }} />

            <Row label="Saldo cierre mes Banco + FCI" rows={rows} get={(r) => r.cierreTotal} opts={{ cls: "cf-grand", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="INGRESOS PROYECTADOS" months={months} accent="var(--teal)" />
            {PROJ_CONCEPTS.map((c) => (
              <Row key={c.id} label={c.name} rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <Row label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ cls: "cf-strong", bold: true }} />

            <CfSectionRow label="REAL VS PRESUPUESTADO" months={months} accent="var(--amber)" />
            <Row label="Ingresos de dinero s/ Bancos (Real)" rows={rows} get={(r) => r.realIngresos} opts={{ blankZero: true }} />
            <Row label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ blankZero: true, dim: true }} />
            <Row label="Ingresos por bancos vs presupuestado" rows={rows} get={(r) => r.vsPresup} opts={{ cls: "cf-strong", bold: true, signed: true }} />

            <CfSectionRow label="DETALLE INGRESOS POR PRODUCTO" months={months} accent="var(--accent)" />
            {products.map((c) => {
              if (
                hideEmpty &&
                rows.every((r) => !prodCant(c.id, r.key) && !prodPrecio(c.id, r.key) && !projTotal(state, c.id, r.key))
              ) {
                return null;
              }
              return (
                <Fragment key={c.id}>
                  <tr className="cf-prodhead">
                    <td className="c-rowhead sticky-col">{c.name}</td>
                    <td className="cf-cell c-total"></td>
                    {months.map((m) => (
                      <td key={m} className="cf-cell"></td>
                    ))}
                  </tr>
                  <Row label={c.unidad} rows={rows} get={(r) => prodCant(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                  <Row label="Precio" rows={rows} get={(r) => prodPrecio(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                  <Row label="Total" rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, bold: true }} />
                </Fragment>
              );
            })}

            <CfSectionRow label="VENTAS NETAS SEGÚN LIBROS IVA" months={months} accent="var(--violet)" />
            {IVA_ROWS.map((r) => (
              <Row key={r} label={r} rows={rows} get={(row) => state.iva[r]?.[row.key] || 0} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <Row
              label="S/ Libro IVA Ventas"
              rows={rows}
              get={(row) => IVA_ROWS.reduce((a, r) => a + (state.iva[r]?.[row.key] || 0), 0)}
              opts={{ cls: "cf-strong", bold: true }}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
