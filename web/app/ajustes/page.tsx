"use client";

import { useState } from "react";
import { addMonth, monthLabel } from "@/lib/dates";
import { useCashflow } from "@/context/CashflowContext";
import { Field, MoneyInput } from "@/components/ui";
import type { Bank, Empresa } from "@/lib/types";

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

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// Texto que se guarda al salir del campo (no en cada tecla).
function TextCommit({ value, onCommit, placeholder }: { value: string; onCommit: (v: string) => void; placeholder?: string }) {
  return (
    <input
      key={value}
      className="inp"
      defaultValue={value}
      placeholder={placeholder}
      onBlur={(e) => {
        const v = e.target.value.trim();
        if (v && v !== value) onCommit(v);
        else e.target.value = value;
      }}
    />
  );
}

function EmpresaCard({ empresa, banks }: { empresa: Empresa; banks: Bank[] }) {
  const { updateEmpresa, updateBank, addBank } = useCashflow();
  const [nuevo, setNuevo] = useState<{ name: string; short: string } | null>(null);
  const run = (p: Promise<void>) => p.catch((e) => alert("No se pudo guardar: " + (e instanceof Error ? e.message : String(e))));

  const crear = () => {
    if (!nuevo || !nuevo.name.trim() || !nuevo.short.trim()) {
      alert("Completá el nombre del banco y el nombre corto.");
      return;
    }
    const id = `${empresa.id}_${slug(nuevo.short)}`;
    if (banks.some((b) => b.id === id)) {
      alert(`Ya existe un banco "${nuevo.short}" en ${empresa.codigo}.`);
      return;
    }
    run(
      addBank({
        id,
        empresaId: empresa.id,
        name: nuevo.name.trim(),
        short: nuevo.short.trim(),
        color: "#64748b",
        saldoInicial: 0,
        orden: Math.max(0, ...banks.map((b) => b.orden)) + 1,
        activo: true,
      }).then(() => setNuevo(null))
    );
  };

  return (
    <div className="settings-card">
      <h3>
        {empresa.codigo} – {empresa.nombre}
      </h3>
      <div className="settings-grid">
        <Field label="Código (prefijo de los bancos)">
          <TextCommit value={empresa.codigo} onCommit={(v) => run(updateEmpresa({ ...empresa, codigo: v.toUpperCase() }))} />
        </Field>
        <Field label="Nombre">
          <TextCommit value={empresa.nombre} onCommit={(v) => run(updateEmpresa({ ...empresa, nombre: v }))} />
        </Field>
      </div>

      <h3 style={{ marginTop: 20 }}>Bancos y saldo inicial</h3>
      <div className="settings-grid">
        {banks.map((b) => (
          <Field
            key={b.id}
            label={
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={b.activo ? undefined : { textDecoration: "line-through" }}>{b.label}</span>
                <span style={{ fontWeight: 500 }}>
                  <input type="checkbox" checked={b.activo} onChange={(e) => run(updateBank({ ...b, activo: e.target.checked }))} /> activo
                </span>
              </span>
            }
          >
            <MoneyInput value={b.saldoInicial} onChange={(v) => run(updateBank({ ...b, saldoInicial: v }))} />
          </Field>
        ))}
      </div>

      {nuevo ? (
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <Field label="Nombre del banco">
            <input className="inp" autoFocus value={nuevo.name} onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })} placeholder="Ej: Banco Santander" />
          </Field>
          <Field label="Nombre corto">
            <input className="inp" value={nuevo.short} onChange={(e) => setNuevo({ ...nuevo, short: e.target.value })} placeholder="Ej: Santander" />
          </Field>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn--primary" onClick={crear}>Agregar banco</button>
            <button className="btn btn--ghost" onClick={() => setNuevo(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn btn--ghost" style={{ marginTop: 16 }} onClick={() => setNuevo({ name: "", short: "" })}>
          + Agregar banco a {empresa.codigo}
        </button>
      )}
    </div>
  );
}

export default function AjustesPage() {
  const { db, setRange } = useCashflow();

  if (!db) return null;

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <h1>Ajustes</h1>
          <p className="view-sub">Empresas, bancos, saldos iniciales y rango del cashflow. Todo se guarda automáticamente.</p>
        </div>
      </div>

      {db.empresas.map((e) => (
        <EmpresaCard key={e.id} empresa={e} banks={db.banks.filter((b) => b.empresaId === e.id)} />
      ))}

      <div className="settings-card">
        <h3>Rango de meses del cashflow</h3>
        <div className="settings-grid">
          <Field label="Mes inicial">
            <select className="inp" value={db.rangeStart} onChange={(e) => setRange(e.target.value, db.rangeEnd)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
          <Field label="Mes final">
            <select className="inp" value={db.rangeEnd} onChange={(e) => setRange(db.rangeStart, e.target.value)}>
              {MONTH_OPTS.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
    </div>
  );
}
