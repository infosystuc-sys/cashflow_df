"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CashflowState, Cheque, Movement } from "@/lib/types";
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
  updateSettings as updateSettingsInDb,
  updateFciSaldoInicial as updateFciSaldoInicialInDb,
  insertCheque,
  updateCheque as updateChequeInDb,
  deleteCheque as deleteChequeInDb,
  resetToSeed,
} from "@/lib/data";

interface CashflowContextValue {
  state: CashflowState | null;
  loading: boolean;
  error: string | null;
  addMovement: (m: Omit<Movement, "id">) => Promise<void>;
  addMovements: (rows: Omit<Movement, "id">[]) => Promise<void>;
  updateMovement: (m: Movement) => Promise<void>;
  deleteMovement: (id: string) => Promise<void>;
  setProjectionCell: (conceptId: string, monthKey: string, cantidad: number, precio: number) => Promise<void>;
  clearProjectionCell: (conceptId: string, monthKey: string) => Promise<void>;
  setFciCell: (monthKey: string, field: "suscripciones" | "rescates", value: number) => Promise<void>;
  setFciSaldoInicial: (value: number) => Promise<void>;
  setIvaCell: (rowName: string, monthKey: string, monto: number) => Promise<void>;
  setSettings: (settings: CashflowState["settings"]) => Promise<void>;
  addCheque: (c: Omit<Cheque, "id">) => Promise<void>;
  updateCheque: (c: Cheque) => Promise<void>;
  deleteCheque: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}

const CashflowContext = createContext<CashflowContextValue | null>(null);

export function CashflowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CashflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllData()
      .then(setState)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const addMovement = async (m: Omit<Movement, "id">) => {
    const created = await insertMovement(m);
    setState((s) => (s ? { ...s, movements: [...s.movements, created] } : s));
  };

  const addMovements = async (rows: Omit<Movement, "id">[]) => {
    const created = await insertMovements(rows);
    setState((s) => (s ? { ...s, movements: [...s.movements, ...created] } : s));
  };

  const updateMovement = async (m: Movement) => {
    setState((s) => (s ? { ...s, movements: s.movements.map((x) => (x.id === m.id ? m : x)) } : s));
    await updateMovementInDb(m);
  };

  const deleteMovement = async (id: string) => {
    setState((s) => (s ? { ...s, movements: s.movements.filter((x) => x.id !== id) } : s));
    await deleteMovementInDb(id);
  };

  const setProjectionCell = async (conceptId: string, monthKey: string, cantidad: number, precio: number) => {
    setState((s) =>
      s
        ? {
            ...s,
            projection: {
              ...s.projection,
              [conceptId]: { ...s.projection[conceptId], [monthKey]: { cantidad, precio } },
            },
          }
        : s
    );
    await upsertProjectionCell(conceptId, monthKey, cantidad, precio);
  };

  const clearProjectionCell = async (conceptId: string, monthKey: string) => {
    setState((s) => {
      if (!s) return s;
      const months = { ...s.projection[conceptId] };
      delete months[monthKey];
      return { ...s, projection: { ...s.projection, [conceptId]: months } };
    });
    await deleteProjectionCell(conceptId, monthKey);
  };

  const setFciCell = async (monthKey: string, field: "suscripciones" | "rescates", value: number) => {
    const current = state?.fci.data[monthKey] ?? { suscripciones: 0, rescates: 0 };
    const next = { ...current, [field]: value };
    setState((s) => (s ? { ...s, fci: { ...s.fci, data: { ...s.fci.data, [monthKey]: next } } } : s));
    await upsertFciMonthly(monthKey, field, value, current);
  };

  const setFciSaldoInicial = async (value: number) => {
    setState((s) => (s ? { ...s, fci: { ...s.fci, saldoInicial: value } } : s));
    await updateFciSaldoInicialInDb(value);
  };

  const setIvaCell = async (rowName: string, monthKey: string, monto: number) => {
    setState((s) => {
      if (!s) return s;
      const months = { ...s.iva[rowName] };
      if (monto === 0) delete months[monthKey];
      else months[monthKey] = monto;
      return { ...s, iva: { ...s.iva, [rowName]: months } };
    });
    await upsertIvaMonthly(rowName, monthKey, monto);
  };

  const setSettings = async (settings: CashflowState["settings"]) => {
    setState((s) => (s ? { ...s, settings } : s));
    await updateSettingsInDb(settings);
  };

  const addCheque = async (c: Omit<Cheque, "id">) => {
    const created = await insertCheque(c);
    setState((s) => (s ? { ...s, cheques: [...s.cheques, created] } : s));
  };

  const updateCheque = async (c: Cheque) => {
    setState((s) => (s ? { ...s, cheques: s.cheques.map((x) => (x.id === c.id ? c : x)) } : s));
    await updateChequeInDb(c);
  };

  const deleteCheque = async (id: string) => {
    setState((s) => (s ? { ...s, cheques: s.cheques.filter((x) => x.id !== id) } : s));
    await deleteChequeInDb(id);
  };

  const reset = async () => {
    await resetToSeed();
    const fresh = await fetchAllData();
    setState(fresh);
  };

  const value: CashflowContextValue = {
    state,
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
    setSettings,
    addCheque,
    updateCheque,
    deleteCheque,
    reset,
  };

  return <CashflowContext.Provider value={value}>{children}</CashflowContext.Provider>;
}

export function useCashflow() {
  const ctx = useContext(CashflowContext);
  if (!ctx) throw new Error("useCashflow must be used within a CashflowProvider");
  return ctx;
}
