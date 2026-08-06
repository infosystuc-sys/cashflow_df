"use client";

import { Fragment, useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { buildCashflow, projTotal } from "@/lib/calc";
import { monthLabel } from "@/lib/dates";
import { PROJ_CONCEPTS, IVA_ROWS, TRANSFER_OWN_BANK_GROUP } from "@/lib/constants";
import { Money } from "@/components/ui";
import { CellDetailModal, type DrillMode } from "@/components/cashflow/CellDetailModal";
import { downloadXlsx, type Cell } from "@/lib/export";
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

// Filas que provienen de movimientos: al clickear una celda se abre el detalle.
interface DrillSpec {
  grupos: string[];
  mode: DrillMode;
}
// monthKey === "*" -> todas las columnas (celda Total).
type OnDrill = (spec: DrillSpec, monthKey: string, label: string) => void;

function CfRow({
  label,
  rows,
  get,
  opts = {},
  hideEmpty,
  drill,
  onDrill,
}: {
  label: string;
  rows: CashflowRow[];
  get: (r: CashflowRow) => number;
  opts?: RowOpts;
  hideEmpty?: boolean;
  drill?: DrillSpec;
  onDrill?: OnDrill;
}) {
  const vals = rows.map(get);
  if (hideEmpty && vals.every((v) => !v)) return null;
  const total =
    opts.totalMode === "last"
      ? vals.length ? vals[vals.length - 1] : 0
      : opts.totalMode === "none"
      ? null
      : vals.reduce((a, b) => a + (b || 0), 0);
  const canDrill = !!(drill && onDrill);
  const totalDrillable = canDrill && opts.totalMode !== "last" && opts.totalMode !== "none" && !!total;
  return (
    <tr className={"cf-row " + (opts.cls || "")}>
      <td className="c-rowhead sticky-col" style={opts.indent ? { paddingLeft: 28 } : undefined}>
        {label}
      </td>
      <td
        className={"cf-cell c-total" + (totalDrillable ? " cf-cell--drill" : "")}
        onClick={totalDrillable ? () => onDrill!(drill!, "*", label) : undefined}
      >
        {total === null ? "" : <Money v={total} decimals={false} bold signed={opts.signed} />}
      </td>
      {vals.map((v, i) => {
        const cellDrillable = canDrill && !!v;
        return (
          <td
            key={i}
            className={"cf-cell" + (cellDrillable ? " cf-cell--drill" : "")}
            onClick={cellDrillable ? () => onDrill!(drill!, rows[i].key, label) : undefined}
          >
            {opts.blankZero && !v ? "" : <Money v={v} decimals={false} bold={opts.bold} signed={opts.signed} dim={opts.dim} />}
          </td>
        );
      })}
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
  const [drill, setDrill] = useState<{ spec: DrillSpec; monthKey: string; label: string } | null>(null);

  if (!state) return null;

  const openDrill: OnDrill = (spec, monthKey, label) => setDrill({ spec, monthKey, label });

  const drillMovements =
    drill && state
      ? state.movements.filter(
          (m) =>
            drill.spec.grupos.includes(m.grupo) &&
            (drill.monthKey === "*" || m.fechaPago.slice(0, 7) === drill.monthKey)
        )
      : [];
  const drillTitle = drill
    ? `${drill.label} · ${drill.monthKey === "*" ? "Total del período" : monthLabel(drill.monthKey)}`
    : "";

  const prodCant = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.cantidad : 0;
  };
  const prodPrecio = (cid: string, mk: string) => {
    const c = state.projection[cid][mk];
    return c ? c.precio : 0;
  };
  const products = PROJ_CONCEPTS.filter((c) => c.grupo === "producto");

  const exportExcel = () => {
    const st = state;
    const aoa: Cell[][] = [];
    aoa.push(["Concepto", "Total", ...months.map((m) => monthLabel(m))]);
    const section = (label: string) => aoa.push([label]);
    // totalMode: "sum" | "last" | "none"
    const row = (label: string, get: (r: CashflowRow) => number, totalMode: "sum" | "last" | "none" = "sum") => {
      const vals = rows.map(get);
      const total =
        totalMode === "last" ? (vals.length ? vals[vals.length - 1] : 0)
        : totalMode === "none" ? null
        : vals.reduce((a, b) => a + (b || 0), 0);
      aoa.push([label, total, ...vals]);
    };

    section("BANCOS");
    row("Saldo Inicial Bancos", (r) => r.saldoInicialBanco, "none");
    row("Ingresos", (r) => r.ingresos);
    row("Ingreso por Venta de USD", (r) => r.ventaUSD);
    row("Pagos", (r) => r.pagos);
    row("Inversiones en FCI", (r) => r.invFCI);
    row("Transf. entre cuentas / banco propio", (r) => r.transf);
    row("Saldo final Bancos", (r) => r.saldoFinalBanco, "last");
    section("FCI / INVERSIONES");
    row("Saldo Inicial FCI", (r) => r.saldoInicialFci, "none");
    row("Suscripciones", (r) => r.suscripciones);
    row("Rescates", (r) => r.rescates);
    row("Saldo Final Inversiones", (r) => r.saldoFinalFci, "last");
    section("CHEQUES DE TERCEROS");
    row("Saldo Inicial Cartera", (r) => r.chequesSaldoInicial, "none");
    row("Recibidos", (r) => r.chequesRecibidos);
    row("Salida de cartera", (r) => r.chequesSalida);
    row("Rechazados (vuelven a cartera)", (r) => r.chequesRechazados);
    row("Saldo Final Cartera", (r) => r.chequesSaldoFinal, "last");
    row("Acreditado (informativo)", (r) => r.chequesAcreditado);
    row("Saldo cierre mes Banco + FCI", (r) => r.cierreTotal, "last");
    section("INGRESOS PROYECTADOS");
    PROJ_CONCEPTS.forEach((c) => row(c.name, (r) => projTotal(st, c.id, r.key)));
    row("Total Ingresos Proyectados", (r) => r.proyTotal);
    section("REAL VS PRESUPUESTADO");
    row("Ingresos de dinero s/ Bancos (Real)", (r) => r.realIngresos);
    row("Total Ingresos Proyectados", (r) => r.proyTotal);
    row("Ingresos por bancos vs presupuestado", (r) => r.vsPresup);
    section("DETALLE INGRESOS POR PRODUCTO");
    products.forEach((c) => {
      aoa.push([c.name]);
      row(c.unidad, (r) => prodCant(c.id, r.key), "none");
      row("Precio", (r) => prodPrecio(c.id, r.key), "none");
      row("Total", (r) => projTotal(st, c.id, r.key));
    });
    section("VENTAS NETAS SEGÚN LIBROS IVA");
    IVA_ROWS.forEach((rn) => row(rn, (r) => st.iva[rn]?.[r.key] || 0));
    row("S/ Libro IVA Ventas", (r) => IVA_ROWS.reduce((a, rn) => a + (st.iva[rn]?.[r.key] || 0), 0));

    downloadXlsx("Cashflow", [{ name: "Cashflow", aoa }]);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Cashflow · Resumen</h1>
          <p className="view-sub">
            {monthLabel(state.settings.rangeStart)} → {monthLabel(state.settings.rangeEnd)} · recalculado desde Movimientos y Proyección.
          </p>
        </div>
        <div className="view-head-actions">
          <label className="cf-toggle">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
            Ocultar filas sin datos
          </label>
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
        </div>
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
            <CfRow hideEmpty={hideEmpty} label="Saldo Inicial Bancos" rows={rows} get={(r) => r.saldoInicialBanco} opts={{ totalMode: "none", dim: true }} />
            <CfRow hideEmpty={hideEmpty} label="Ingresos" rows={rows} get={(r) => r.ingresos} opts={{ blankZero: true }} drill={{ grupos: ["Ingresos"], mode: "credito" }} onDrill={openDrill} />
            <CfRow hideEmpty={hideEmpty} label="Ingreso por Venta de USD" rows={rows} get={(r) => r.ventaUSD} opts={{ blankZero: true }} drill={{ grupos: ["Ingreso por Venta de USD"], mode: "credito" }} onDrill={openDrill} />
            <CfRow hideEmpty={hideEmpty} label="Pagos" rows={rows} get={(r) => r.pagos} opts={{ blankZero: true, cls: "neg-row" }} drill={{ grupos: ["Pagos"], mode: "debito" }} onDrill={openDrill} />
            <CfRow hideEmpty={hideEmpty} label="Inversiones en FCI" rows={rows} get={(r) => r.invFCI} opts={{ blankZero: true, signed: true }} />
            <CfRow hideEmpty={hideEmpty} label="Transf. entre cuentas / banco propio" rows={rows} get={(r) => r.transf} opts={{ blankZero: true, signed: true }} drill={{ grupos: ["Transf entre cuentas", TRANSFER_OWN_BANK_GROUP], mode: "neto" }} onDrill={openDrill} />
            <CfRow hideEmpty={hideEmpty} label="Saldo final Bancos" rows={rows} get={(r) => r.saldoFinalBanco} opts={{ cls: "cf-strong", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="FCI / INVERSIONES" months={months} accent="var(--violet)" />
            <CfRow hideEmpty={hideEmpty} label="Saldo Inicial FCI" rows={rows} get={(r) => r.saldoInicialFci} opts={{ totalMode: "none", dim: true }} />
            <CfRow hideEmpty={hideEmpty} label="Suscripciones" rows={rows} get={(r) => r.suscripciones} opts={{ blankZero: true }} />
            <CfRow hideEmpty={hideEmpty} label="Rescates" rows={rows} get={(r) => r.rescates} opts={{ blankZero: true }} />
            <CfRow hideEmpty={hideEmpty} label="Saldo Final Inversiones" rows={rows} get={(r) => r.saldoFinalFci} opts={{ cls: "cf-strong", bold: true, totalMode: "last" }} />

            <CfSectionRow label="CHEQUES DE TERCEROS" months={months} accent="var(--teal)" />
            <CfRow hideEmpty={hideEmpty} label="Saldo Inicial Cartera" rows={rows} get={(r) => r.chequesSaldoInicial} opts={{ totalMode: "none", dim: true }} />
            <CfRow hideEmpty={hideEmpty} label="Recibidos" rows={rows} get={(r) => r.chequesRecibidos} opts={{ blankZero: true }} />
            <CfRow hideEmpty={hideEmpty} label="Salida de cartera" rows={rows} get={(r) => r.chequesSalida} opts={{ blankZero: true, cls: "neg-row" }} />
            <CfRow hideEmpty={hideEmpty} label="Rechazados (vuelven a cartera)" rows={rows} get={(r) => r.chequesRechazados} opts={{ blankZero: true }} />
            <CfRow hideEmpty={hideEmpty} label="Saldo Final Cartera" rows={rows} get={(r) => r.chequesSaldoFinal} opts={{ cls: "cf-strong", bold: true, totalMode: "last" }} />
            <CfRow hideEmpty={hideEmpty} label="Acreditado (informativo)" rows={rows} get={(r) => r.chequesAcreditado} opts={{ blankZero: true, dim: true }} />

            <CfRow hideEmpty={hideEmpty} label="Saldo cierre mes Banco + FCI" rows={rows} get={(r) => r.cierreTotal} opts={{ cls: "cf-grand", bold: true, totalMode: "last", signed: true }} />

            <CfSectionRow label="INGRESOS PROYECTADOS" months={months} accent="var(--teal)" />
            {PROJ_CONCEPTS.map((c) => (
              <CfRow hideEmpty={hideEmpty} key={c.id} label={c.name} rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <CfRow hideEmpty={hideEmpty} label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ cls: "cf-strong", bold: true }} />

            <CfSectionRow label="REAL VS PRESUPUESTADO" months={months} accent="var(--amber)" />
            <CfRow hideEmpty={hideEmpty} label="Ingresos de dinero s/ Bancos (Real)" rows={rows} get={(r) => r.realIngresos} opts={{ blankZero: true }} drill={{ grupos: ["Ingresos", "Ingreso por Venta de USD"], mode: "credito" }} onDrill={openDrill} />
            <CfRow hideEmpty={hideEmpty} label="Total Ingresos Proyectados" rows={rows} get={(r) => r.proyTotal} opts={{ blankZero: true, dim: true }} />
            <CfRow hideEmpty={hideEmpty} label="Ingresos por bancos vs presupuestado" rows={rows} get={(r) => r.vsPresup} opts={{ cls: "cf-strong", bold: true, signed: true }} />

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
                  <CfRow hideEmpty={hideEmpty} label={c.unidad} rows={rows} get={(r) => prodCant(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                  <CfRow hideEmpty={hideEmpty} label="Precio" rows={rows} get={(r) => prodPrecio(c.id, r.key)} opts={{ blankZero: true, indent: true, dim: true, totalMode: "none" }} />
                  <CfRow hideEmpty={hideEmpty} label="Total" rows={rows} get={(r) => projTotal(state, c.id, r.key)} opts={{ blankZero: true, indent: true, bold: true }} />
                </Fragment>
              );
            })}

            <CfSectionRow label="VENTAS NETAS SEGÚN LIBROS IVA" months={months} accent="var(--violet)" />
            {IVA_ROWS.map((r) => (
              <CfRow hideEmpty={hideEmpty} key={r} label={r} rows={rows} get={(row) => state.iva[r]?.[row.key] || 0} opts={{ blankZero: true, indent: true, dim: true }} />
            ))}
            <CfRow
              hideEmpty={hideEmpty}
              label="S/ Libro IVA Ventas"
              rows={rows}
              get={(row) => IVA_ROWS.reduce((a, r) => a + (state.iva[r]?.[row.key] || 0), 0)}
              opts={{ cls: "cf-strong", bold: true }}
            />
          </tbody>
        </table>
      </div>

      {drill && (
        <CellDetailModal
          title={drillTitle}
          movements={drillMovements}
          mode={drill.spec.mode}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
