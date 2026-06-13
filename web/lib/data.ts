import { supabase } from "./supabase";
import { seedFci, seedIva, seedMovements, seedProjection, seedSettings } from "./seed";
import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";
import type { CashflowState, Movement } from "./types";

export async function fetchAllData(): Promise<CashflowState> {
  const [settingsRes, movementsRes, projectionRes, fciRes, ivaRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("movements").select("*"),
    supabase.from("projection_cells").select("*"),
    supabase.from("fci_monthly").select("*"),
    supabase.from("iva_monthly").select("*"),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (movementsRes.error) throw movementsRes.error;
  if (projectionRes.error) throw projectionRes.error;
  if (fciRes.error) throw fciRes.error;
  if (ivaRes.error) throw ivaRes.error;

  const s = settingsRes.data;

  const movements: Movement[] = movementsRes.data.map((row) => ({
    id: row.id,
    bank: row.bank,
    descripcion: row.descripcion,
    proveedor: row.proveedor,
    fechaEmision: row.fecha_emision ?? "",
    fechaPago: row.fecha_pago,
    cheque: row.cheque,
    credito: Number(row.credito),
    debito: Number(row.debito),
    grupo: row.grupo,
  }));

  const projection: CashflowState["projection"] = {};
  PROJ_CONCEPTS.forEach((c) => (projection[c.id] = {}));
  projectionRes.data.forEach((row) => {
    projection[row.concept_id][row.month_key] = { cantidad: Number(row.cantidad), precio: Number(row.precio) };
  });

  const fciData: CashflowState["fci"]["data"] = {};
  fciRes.data.forEach((row) => {
    fciData[row.month_key] = { suscripciones: Number(row.suscripciones), rescates: Number(row.rescates) };
  });

  const iva: CashflowState["iva"] = {};
  IVA_ROWS.forEach((r) => (iva[r] = {}));
  ivaRes.data.forEach((row) => {
    iva[row.row_name][row.month_key] = Number(row.monto);
  });

  return {
    settings: {
      saldoInicial: { galicia: Number(s.saldo_inicial_galicia), nacion: Number(s.saldo_inicial_nacion) },
      rangeStart: s.range_start,
      rangeEnd: s.range_end,
    },
    movements,
    projection,
    fci: { saldoInicial: Number(s.fci_saldo_inicial), data: fciData },
    iva,
  };
}

export async function insertMovement(m: Omit<Movement, "id">): Promise<Movement> {
  const { data, error } = await supabase
    .from("movements")
    .insert({
      bank: m.bank,
      descripcion: m.descripcion,
      proveedor: m.proveedor,
      fecha_emision: m.fechaEmision || null,
      fecha_pago: m.fechaPago,
      cheque: m.cheque,
      credito: m.credito,
      debito: m.debito,
      grupo: m.grupo,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    bank: data.bank,
    descripcion: data.descripcion,
    proveedor: data.proveedor,
    fechaEmision: data.fecha_emision ?? "",
    fechaPago: data.fecha_pago,
    cheque: data.cheque,
    credito: Number(data.credito),
    debito: Number(data.debito),
    grupo: data.grupo,
  };
}

export async function updateMovement(m: Movement): Promise<void> {
  const { error } = await supabase
    .from("movements")
    .update({
      bank: m.bank,
      descripcion: m.descripcion,
      proveedor: m.proveedor,
      fecha_emision: m.fechaEmision || null,
      fecha_pago: m.fechaPago,
      cheque: m.cheque,
      credito: m.credito,
      debito: m.debito,
      grupo: m.grupo,
    })
    .eq("id", m.id);
  if (error) throw error;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProjectionCell(
  conceptId: string,
  monthKey: string,
  cantidad: number,
  precio: number
): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .upsert({ concept_id: conceptId, month_key: monthKey, cantidad, precio });
  if (error) throw error;
}

export async function deleteProjectionCell(conceptId: string, monthKey: string): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .delete()
    .eq("concept_id", conceptId)
    .eq("month_key", monthKey);
  if (error) throw error;
}

export async function upsertFciMonthly(
  monthKey: string,
  field: "suscripciones" | "rescates",
  value: number,
  current: { suscripciones: number; rescates: number }
): Promise<void> {
  const next = {
    month_key: monthKey,
    suscripciones: field === "suscripciones" ? value : current.suscripciones,
    rescates: field === "rescates" ? value : current.rescates,
  };
  const { error } = await supabase.from("fci_monthly").upsert(next);
  if (error) throw error;
}

export async function upsertIvaMonthly(rowName: string, monthKey: string, monto: number): Promise<void> {
  if (monto === 0) {
    const { error } = await supabase.from("iva_monthly").delete().eq("row_name", rowName).eq("month_key", monthKey);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("iva_monthly").upsert({ row_name: rowName, month_key: monthKey, monto });
  if (error) throw error;
}

export async function updateSettings(settings: CashflowState["settings"]): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .update({
      saldo_inicial_galicia: settings.saldoInicial.galicia,
      saldo_inicial_nacion: settings.saldoInicial.nacion,
      range_start: settings.rangeStart,
      range_end: settings.rangeEnd,
    })
    .eq("id", 1);
  if (error) throw error;
}

export async function updateFciSaldoInicial(value: number): Promise<void> {
  const { error } = await supabase.from("settings").update({ fci_saldo_inicial: value }).eq("id", 1);
  if (error) throw error;
}

export async function resetToSeed(): Promise<void> {
  await supabase.from("movements").delete().not("id", "is", null);
  await supabase.from("projection_cells").delete().not("concept_id", "is", null);
  await supabase.from("fci_monthly").delete().not("month_key", "is", null);
  await supabase.from("iva_monthly").delete().not("row_name", "is", null);

  const settings = seedSettings();
  const fci = seedFci();
  await supabase
    .from("settings")
    .update({
      saldo_inicial_galicia: settings.saldoInicial.galicia,
      saldo_inicial_nacion: settings.saldoInicial.nacion,
      range_start: settings.rangeStart,
      range_end: settings.rangeEnd,
      fci_saldo_inicial: fci.saldoInicial,
    })
    .eq("id", 1);

  const movements = seedMovements().map((m) => ({
    bank: m.bank,
    descripcion: m.descripcion,
    proveedor: m.proveedor,
    fecha_emision: m.fechaEmision || null,
    fecha_pago: m.fechaPago,
    cheque: m.cheque,
    credito: m.credito,
    debito: m.debito,
    grupo: m.grupo,
  }));
  await supabase.from("movements").insert(movements);

  const projection = seedProjection();
  const projectionRows: { concept_id: string; month_key: string; cantidad: number; precio: number }[] = [];
  Object.entries(projection).forEach(([conceptId, months]) => {
    Object.entries(months).forEach(([monthKey, v]) => {
      projectionRows.push({ concept_id: conceptId, month_key: monthKey, cantidad: v.cantidad, precio: v.precio });
    });
  });
  if (projectionRows.length) await supabase.from("projection_cells").insert(projectionRows);

  const fciRows = Object.entries(fci.data).map(([monthKey, v]) => ({
    month_key: monthKey,
    suscripciones: v.suscripciones,
    rescates: v.rescates,
  }));
  if (fciRows.length) await supabase.from("fci_monthly").insert(fciRows);

  const iva = seedIva();
  const ivaRows: { row_name: string; month_key: string; monto: number }[] = [];
  Object.entries(iva).forEach(([rowName, months]) => {
    Object.entries(months).forEach(([monthKey, monto]) => {
      ivaRows.push({ row_name: rowName, month_key: monthKey, monto });
    });
  });
  if (ivaRows.length) await supabase.from("iva_monthly").insert(ivaRows);
}
