"use client";

import { useMemo, useState } from "react";
import { useCashflow } from "@/context/CashflowContext";
import { monthRange } from "@/lib/dates";
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

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Proyección</h1>
          <p className="view-sub">Tocá cualquier celda para cargar valores. Los totales alimentan el Cashflow.</p>
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
