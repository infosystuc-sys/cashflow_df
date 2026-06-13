"use client";

import { addMonth, monthLabel } from "@/lib/dates";
import { BANKS } from "@/lib/constants";
import { useCashflow } from "@/context/CashflowContext";
import { Field, MoneyInput } from "@/components/ui";
import type { BankId } from "@/lib/types";

function buildMonthOpts(): string[] {
  const opts: string[] = [];
  let k = "2024-01";
  for (let i = 0; i < 60; i++) {
    opts.push(k);
    k = addMonth(k, 1);
  }
  return opts;
}

const MONTH_OPTS = buildMonthOpts();

export default function AjustesPage() {
  const { state, setSettings, reset } = useCashflow();

  if (!state) return null;

  const setSaldo = (bank: BankId, v: number) =>
    setSettings({ ...state.settings, saldoInicial: { ...state.settings.saldoInicial, [bank]: v } });

  const setRange = (key: "rangeStart" | "rangeEnd", v: string) =>
    setSettings({ ...state.settings, [key]: v });

  const doReset = () => {
    if (window.confirm("Esto restaura los datos de ejemplo y borra tus cambios guardados. ¿Continuar?")) {
      reset();
    }
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Ajustes</h1>
          <p className="view-sub">Saldos iniciales, rango del cashflow y datos.</p>
        </div>
      </div>

      <div className="settings-card">
        <h3>Saldo inicial por banco</h3>
        <div className="settings-grid">
          {BANKS.map((b) => (
            <Field key={b.id} label={b.name}>
              <MoneyInput value={state.settings.saldoInicial[b.id]} onChange={(v) => setSaldo(b.id, v)} />
            </Field>
          ))}
        </div>
      </div>

      <div className="settings-card">
        <h3>Rango de meses del cashflow</h3>
        <div className="settings-grid">
          <Field label="Mes inicial">
            <select className="inp" value={state.settings.rangeStart} onChange={(e) => setRange("rangeStart", e.target.value)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="Mes final">
            <select className="inp" value={state.settings.rangeEnd} onChange={(e) => setRange("rangeEnd", e.target.value)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="settings-card">
        <h3>Datos</h3>
        <p className="settings-note">Todo se guarda automáticamente.</p>
        <button className="btn btn--danger" onClick={doReset}>Restaurar datos de ejemplo</button>
      </div>
    </div>
  );
}
