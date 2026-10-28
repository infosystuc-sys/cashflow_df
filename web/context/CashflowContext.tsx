"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Bank, CashflowState, Cheque, DbState, Empresa, EmpresaId, Movement, Vista } from "@/lib/types";
import { scopeState } from "@/lib/scope";
import {
  fetchAllData,
  insertMovement,
  insertMovements,
  updateMovement as updateMovementInDb,
  deleteMovement as deleteMovementInDb,
  upsertProjectionCell,
  deleteProjectionCell,
  upsertFciMonthly,
  upsertIvaMonthly,
  updateRange,
  updateEmpresa as updateEmpresaInDb,
  updateBank as updateBankInDb,
  insertBank,
  bankLabel,
  insertCheque,
  updateCheque as updateChequeInDb,
  deleteCheque as deleteChequeInDb,
} from "@/lib/data";

const VISTA_KEY = "cf_vista";

// Proyección, FCI e IVA se cargan por empresa: en el consolidado son de solo lectura.
function requireEmpresa(vista: Vista): EmpresaId {
  if (vista === "all") throw new Error("Elegí una empresa para editar (en el consolidado es solo lectura).");
  return vista;
}

interface CashflowContextValue {
  // Estado de la vista elegida (una empresa o el consolidado).
  state: CashflowState | null;
  // Todo lo cargado, sin filtrar por empresa.
  db: DbState | null;
  vista: Vista;
  setVista: (v: Vista) => void;
  loading: boolean;
  error: string | null;
  addMovement: (m: Omit<Movement, "id">) => Promise<Movement>;
  addMovements: (rows: Omit<Movement, "id">[]) => Promise<void>;
  updateMovement: (m: Movement) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  setProjectionCell: (conceptId: string, monthKey: string, cantidad: number, precio: number) => Promise<void>;
  clearProjectionCell: (conceptId: string, monthKey: string) => Promise<void>;
  setFciCell: (monthKey: string, field: "suscripciones" | "rescates", value: number) => Promise<void>;
  setFciSaldoInicial: (value: number) => Promise<void>;
  setIvaCell: (rowName: string, monthKey: string, monto: number) => Promise<void>;
  setRange: (rangeStart: string, rangeEnd: string) => Promise<void>;
  updateEmpresa: (e: Empresa) => Promise<void>;
  updateBank: (b: Bank) => Promise<void>;
  addBank: (b: Omit<Bank, "label">) => Promise<void>;
  addCheque: (c: Omit<Cheque, "id">) => Promise<void>;
  updateCheque: (c: Cheque) => Promise<void>;
  deleteCheque: (id: string) => Promise<void>;
}

const CashflowContext = createContext<CashflowContextValue | null>(null);

export function CashflowProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DbState | null>(null);
  const [vista, setVistaState] = useState<Vista>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData()
      .then((data) => {
        setDb(data);
        try {
          const saved = localStorage.getItem(VISTA_KEY);
          if (saved && (saved === "all" || data.empresas.some((e) => e.id === saved))) setVistaState(saved);
        } catch {
          // localStorage no disponible: queda el consolidado
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const state = useMemo(() => (db ? scopeState(db, vista) : null), [db, vista]);

  const setVista = (v: Vista) => {
    setVistaState(v);
    try {
      localStorage.setItem(VISTA_KEY, v);
    } catch {
      // localStorage no disponible, ignorar
    }
  };

  const addMovement = async (m: Omit<Movement, "id">) => {
    const created = await insertMovement(m);
    setDb((s) => (s ? { ...s, movements: [...s.movements, created] } : s));
    return created;
  };

  const addMovements = async (rows: Omit<Movement, "id">[]) => {
    const created = await insertMovements(rows);
    setDb((s) => (s ? { ...s, movements: [...s.movements, ...created] } : s));
  };

  const updateMovement = async (m: Movement) => {
    setDb((s) => (s ? { ...s, movements: s.movements.map((x) => (x.id === m.id ? m : x)) } : s));
    await updateMovementInDb(m);
  };

  const deleteMovement = async (id: string) => {
    setDb((s) => (s ? { ...s, movements: s.movements.filter((x) => x.id !== id) } : s));
    await deleteMovementInDb(id);
  };

  const setProjectionCell = async (conceptId: string, monthKey: string, cantidad: number, precio: number) => {
    const emp = requireEmpresa(vista);
    setDb((s) => {
      if (!s) return s;
      const p = s.projection[emp] ?? {};
      return {
        ...s,
        projection: { ...s.projection, [emp]: { ...p, [conceptId]: { ...p[conceptId], [monthKey]: { cantidad, precio } } } },
      };
    });
    await upsertProjectionCell(emp, conceptId, monthKey, cantidad, precio);
  };

  const clearProjectionCell = async (conceptId: string, monthKey: string) => {
    const emp = requireEmpresa(vista);
    setDb((s) => {
      if (!s) return s;
      const p = s.projection[emp] ?? {};
      const months = { ...p[conceptId] };
      delete months[monthKey];
      return { ...s, projection: { ...s.projection, [emp]: { ...p, [conceptId]: months } } };
    });
    await deleteProjectionCell(emp, conceptId, monthKey);
  };

  const setFciCell = async (monthKey: string, field: "suscripciones" | "rescates", value: number) => {
    const emp = requireEmpresa(vista);
    const current = db?.fci[emp]?.[monthKey] ?? { suscripciones: 0, rescates: 0 };
    const next = { ...current, [field]: value };
    setDb((s) => (s ? { ...s, fci: { ...s.fci, [emp]: { ...s.fci[emp], [monthKey]: next } } } : s));
    await upsertFciMonthly(emp, monthKey, field, value, current);
  };

  const updateEmpresa = async (e: Empresa) => {
    setDb((s) => {
      if (!s) return s;
      // El código de la empresa forma parte del nombre visible de sus bancos.
      const banks = s.banks.map((b) => (b.empresaId === e.id ? { ...b, label: bankLabel(e.codigo, b.short) } : b));
      return { ...s, empresas: s.empresas.map((x) => (x.id === e.id ? e : x)), banks };
    });
    await updateEmpresaInDb(e);
  };

  const setFciSaldoInicial = async (value: number) => {
    const emp = requireEmpresa(vista);
    const e = db?.empresas.find((x) => x.id === emp);
    if (e) await updateEmpresa({ ...e, fciSaldoInicial: value });
  };

  const setIvaCell = async (rowName: string, monthKey: string, monto: number) => {
    const emp = requireEmpresa(vista);
    setDb((s) => {
      if (!s) return s;
      const iv = s.iva[emp] ?? {};
      const months = { ...iv[rowName] };
      if (monto === 0) delete months[monthKey];
      else months[monthKey] = monto;
      return { ...s, iva: { ...s.iva, [emp]: { ...iv, [rowName]: months } } };
    });
    await upsertIvaMonthly(emp, rowName, monthKey, monto);
  };

  const setRange = async (rangeStart: string, rangeEnd: string) => {
    setDb((s) => (s ? { ...s, rangeStart, rangeEnd } : s));
    await updateRange(rangeStart, rangeEnd);
  };

  const updateBank = async (b: Bank) => {
    const codigo = db?.empresas.find((e) => e.id === b.empresaId)?.codigo ?? "";
    const next = { ...b, label: bankLabel(codigo, b.short) };
    setDb((s) => (s ? { ...s, banks: s.banks.map((x) => (x.id === b.id ? next : x)) } : s));
    await updateBankInDb(next);
  };

  const addBank = async (b: Omit<Bank, "label">) => {
    await insertBank(b);
    const codigo = db?.empresas.find((e) => e.id === b.empresaId)?.codigo ?? "";
    setDb((s) => (s ? { ...s, banks: [...s.banks, { ...b, label: bankLabel(codigo, b.short) }] } : s));
  };

  const addCheque = async (c: Omit<Cheque, "id">) => {
    const created = await insertCheque(c);
    setDb((s) => (s ? { ...s, cheques: [...s.cheques, created] } : s));
  };

  const updateCheque = async (c: Cheque) => {
    setDb((s) => (s ? { ...s, cheques: s.cheques.map((x) => (x.id === c.id ? c : x)) } : s));
    await updateChequeInDb(c);
  };

  const deleteCheque = async (id: string) => {
    setDb((s) => (s ? { ...s, cheques: s.cheques.filter((x) => x.id !== id) } : s));
    await deleteChequeInDb(id);
  };

  const value: CashflowContextValue = {
    state,
    db,
    vista,
    setVista,
    loading,
    error,
    addMovement,
    addMovements,
    updateMovement,
    deleteMovement,
    setProjectionCell,
    clearProjectionCell,
    setFciCell,
    setFciSaldoInicial,
    setIvaCell,
    setRange,
    updateEmpresa,
    updateBank,
    addBank,
    addCheque,
    updateCheque,
    deleteCheque,
  };

  return <CashflowContext.Provider value={value}>{children}</CashflowContext.Provider>;
}

// "Consolidado" o "SAN – Rafael Sánchez", para títulos y nombres de archivo.
export function useVistaLabel(): { label: string; short: string } {
  const { db, vista } = useCashflow();
  if (vista === "all") return { label: "Consolidado", short: "Consolidado" };
  const e = db?.empresas.find((x) => x.id === vista);
  return e ? { label: `${e.codigo} – ${e.nombre}`, short: e.codigo } : { label: "", short: "" };
}

export function useCashflow() {
  const ctx = useContext(CashflowContext);
  if (!ctx) throw new Error("useCashflow must be used within a CashflowProvider");
  return ctx;
}
