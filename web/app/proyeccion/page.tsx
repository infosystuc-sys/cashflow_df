"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { monthRange, monthLabel } from "@/lib/dates";
import { projTotal, projMonthTotal } from "@/lib/calc";
import { PROJ_CONCEPTS, IVA_ROWS } from "@/lib/constants";
import { downloadXlsx, type Cell } from "@/lib/export";
import { ProjTab } from "@/components/proyeccion/ProjTab";
import { FciTab } from "@/components/proyeccion/FciTab";
import { IvaTab } from "@/components/proyeccion/IvaTab";

const TABS = [
  { id: "proj", label: "Ingresos proyectados" },
  { id: "fci", label: "FCI / Inversiones" },
  { id: "iva", label: "Ventas netas IVA" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function ProyeccionPage() {
  const { state } = useCashflow();
  const [tab, setTab] = useState<TabId>("proj");

  const months = useMemo(
    () => (state ? monthRange(state.settings.rangeStart, state.settings.rangeEnd) : []),
    [state]
  );

  if (!state) return null;

  const st = state;
  const ml = (m: string) => monthLabel(m);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  const exportExcel = () => {
    // Ingresos proyectados
    const proj: Cell[][] = [["Concepto proyectado", "Total", ...months.map(ml)]];
    PROJ_CONCEPTS.forEach((c) => {
      const vals = months.map((mk) => projTotal(st, c.id, mk));
      proj.push([c.name, sum(vals), ...vals]);
    });
    const projCol = months.map((mk) => projMonthTotal(st, mk));
    proj.push(["Total Ingresos Proyectados", sum(projCol), ...projCol]);

    // FCI / Inversiones
    const fci: Cell[][] = [["FCI / Inversiones", "Total", ...months.map(ml)]];
    const susc = months.map((mk) => st.fci.data[mk]?.suscripciones || 0);
    const resc = months.map((mk) => st.fci.data[mk]?.rescates || 0);
    fci.push(["Suscripciones", sum(susc), ...susc]);
    fci.push(["Rescates", sum(resc), ...resc]);
    let saldo = st.fci.saldoInicial || 0;
    const saldoFinal = months.map((mk) => {
      const d = st.fci.data[mk] || { suscripciones: 0, rescates: 0 };
      saldo += (d.suscripciones || 0) - (d.rescates || 0);
      return saldo;
    });
    fci.push(["Saldo Final Inversiones", null, ...saldoFinal]);

    // Ventas netas IVA
    const iva: Cell[][] = [["Ventas netas s/ libros IVA", "Total", ...months.map(ml)]];
    IVA_ROWS.forEach((r) => {
      const vals = months.map((mk) => st.iva[r]?.[mk] || 0);
      iva.push([r, sum(vals), ...vals]);
    });
    const ivaCol = months.map((mk) => IVA_ROWS.reduce((a, r) => a + (st.iva[r]?.[mk] || 0), 0));
    iva.push(["S/ Libro IVA Ventas", sum(ivaCol), ...ivaCol]);

    downloadXlsx("Proyeccion", [
      { name: "Ingresos proyectados", aoa: proj },
      { name: "FCI Inversiones", aoa: fci },
      { name: "Ventas netas IVA", aoa: iva },
    ]);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Proyección</h1>
          <p className="view-sub">Tocá cualquier celda para cargar valores. Los totales alimentan el Cashflow.</p>
        </div>
        <div className="view-head-actions">
          <button className="btn btn--ghost" onClick={exportExcel}>⭳ Exportar a Excel</button>
        </div>
      </div>
      <div className="subtabs">
        {TABS.map((t) => (
          <button key={t.id} className={"subtab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "proj" && <ProjTab state={state} months={months} />}
      {tab === "fci" && <FciTab state={state} months={months} />}
      {tab === "iva" && <IvaTab state={state} months={months} />}
    </div>
  );
}
