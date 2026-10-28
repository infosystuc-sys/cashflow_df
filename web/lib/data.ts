import { supabase } from "./supabase";
import { IVA_ROWS, PROJ_CONCEPTS } from "./constants";
import type { Bank, BankId, Cheque, DbState, Empresa, EmpresaId, Movement } from "./types";

type MovementRow = {
  id: string;
  bank: BankId;
  descripcion: string;
  proveedor: string;
  fecha_emision: string | null;
  fecha_pago: string;
  cheque: string;
  credito: number | string;
  debito: number | string;
  grupo: string;
  transfer_id: string | null;
};

// Supabase/PostgREST devuelve como máximo 1000 filas por request. Para tablas que
// pueden superar ese límite (movements) hay que paginar con .range() hasta agotar.
async function fetchAllRows<T>(table: string): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

type BankRow = {
  id: string;
  empresa_id: string;
  nombre: string;
  short: string;
  color: string;
  saldo_inicial: number | string;
  orden: number;
  activo: boolean;
};

type EmpresaRow = { id: string; codigo: string; nombre: string; fci_saldo_inicial: number | string; orden: number };

function toEmpresa(row: EmpresaRow): Empresa {
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    fciSaldoInicial: Number(row.fci_saldo_inicial),
    orden: row.orden,
  };
}

function toBank(row: BankRow, empresas: Empresa[]): Bank {
  const codigo = empresas.find((e) => e.id === row.empresa_id)?.codigo ?? "";
  return {
    id: row.id,
    empresaId: row.empresa_id,
    name: row.nombre,
    short: row.short,
    label: bankLabel(codigo, row.short),
    color: row.color,
    saldoInicial: Number(row.saldo_inicial),
    orden: row.orden,
    activo: row.activo,
  };
}

export function bankLabel(codigoEmpresa: string, short: string): string {
  return codigoEmpresa ? `${codigoEmpresa} ${short}` : short;
}

type ChequeRow = {
  id: string;
  empresa_id: string;
  cliente: string;
  numero: string;
  banco_emisor: string;
  banco_destino: Cheque["bancoDestino"];
  importe: number | string;
  fecha_recepcion: string;
  fecha_pago: string | null;
  estado: Cheque["estado"];
  fecha_deposito: string | null;
  fecha_acreditacion: string | null;
  fecha_rechazo: string | null;
  fecha_endoso: string | null;
  fecha_cesion: string | null;
  endosado_a: string;
  movement_id: string | null;
};

function toCheque(row: ChequeRow): Cheque {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    cliente: row.cliente,
    numero: row.numero,
    bancoEmisor: row.banco_emisor,
    bancoDestino: row.banco_destino,
    importe: Number(row.importe),
    fechaRecepcion: row.fecha_recepcion,
    fechaPago: row.fecha_pago ?? "",
    estado: row.estado,
    fechaDeposito: row.fecha_deposito ?? "",
    fechaAcreditacion: row.fecha_acreditacion ?? "",
    fechaRechazo: row.fecha_rechazo ?? "",
    fechaEndoso: row.fecha_endoso ?? "",
    fechaCesion: row.fecha_cesion ?? "",
    endosadoA: row.endosado_a,
    movementId: row.movement_id ?? null,
  };
}

export async function fetchAllData(): Promise<DbState> {
  const [settingsRes, empresasRes, banksRes, movementsRows, projectionRes, fciRes, ivaRes, chequesRes] = await Promise.all([
    supabase.from("settings").select("range_start, range_end").eq("id", 1).single(),
    supabase.from("empresas").select("*").order("orden"),
    supabase.from("banks").select("*").order("orden"),
    fetchAllRows<MovementRow>("movements"),
    supabase.from("projection_cells").select("*"),
    supabase.from("fci_monthly").select("*"),
    supabase.from("iva_monthly").select("*"),
    supabase.from("cheques").select("*"),
  ]);

  if (settingsRes.error) throw settingsRes.error;
  if (empresasRes.error) throw empresasRes.error;
  if (banksRes.error) throw banksRes.error;
  if (projectionRes.error) throw projectionRes.error;
  if (fciRes.error) throw fciRes.error;
  if (ivaRes.error) throw ivaRes.error;
  if (chequesRes.error) throw chequesRes.error;

  const empresas = (empresasRes.data as EmpresaRow[]).map(toEmpresa);
  const banks = (banksRes.data as BankRow[]).map((r) => toBank(r, empresas));

  const movements: Movement[] = movementsRows.map((row) => ({
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
    transferId: row.transfer_id ?? null,
  }));

  const projection: DbState["projection"] = {};
  const fci: DbState["fci"] = {};
  const iva: DbState["iva"] = {};
  empresas.forEach((e) => {
    projection[e.id] = {};
    PROJ_CONCEPTS.forEach((c) => (projection[e.id][c.id] = {}));
    fci[e.id] = {};
    iva[e.id] = {};
    IVA_ROWS.forEach((r) => (iva[e.id][r] = {}));
  });

  projectionRes.data.forEach((row) => {
    (projection[row.empresa_id][row.concept_id] ??= {})[row.month_key] = {
      cantidad: Number(row.cantidad),
      precio: Number(row.precio),
    };
  });
  fciRes.data.forEach((row) => {
    fci[row.empresa_id][row.month_key] = { suscripciones: Number(row.suscripciones), rescates: Number(row.rescates) };
  });
  ivaRes.data.forEach((row) => {
    (iva[row.empresa_id][row.row_name] ??= {})[row.month_key] = Number(row.monto);
  });

  return {
    empresas,
    banks,
    rangeStart: settingsRes.data.range_start,
    rangeEnd: settingsRes.data.range_end,
    movements,
    cheques: (chequesRes.data as ChequeRow[]).map(toCheque),
    projection,
    fci,
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
      transfer_id: m.transferId ?? null,
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
    transferId: data.transfer_id ?? null,
  };
}

export async function insertMovements(rows: Omit<Movement, "id">[]): Promise<Movement[]> {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from("movements")
    .insert(
      rows.map((m) => ({
        bank: m.bank,
        descripcion: m.descripcion,
        proveedor: m.proveedor,
        fecha_emision: m.fechaEmision || null,
        fecha_pago: m.fechaPago,
        cheque: m.cheque,
        credito: m.credito,
        debito: m.debito,
        grupo: m.grupo,
        transfer_id: m.transferId ?? null,
      }))
    )
    .select();
  if (error) throw error;
  return (data ?? []).map((row) => ({
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
    transferId: row.transfer_id ?? null,
  }));
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
      transfer_id: m.transferId ?? null,
    })
    .eq("id", m.id);
  if (error) throw error;
}

export async function deleteMovement(id: string): Promise<void> {
  const { error } = await supabase.from("movements").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProjectionCell(
  empresaId: EmpresaId,
  conceptId: string,
  monthKey: string,
  cantidad: number,
  precio: number
): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .upsert({ empresa_id: empresaId, concept_id: conceptId, month_key: monthKey, cantidad, precio });
  if (error) throw error;
}

export async function deleteProjectionCell(empresaId: EmpresaId, conceptId: string, monthKey: string): Promise<void> {
  const { error } = await supabase
    .from("projection_cells")
    .delete()
    .eq("empresa_id", empresaId)
    .eq("concept_id", conceptId)
    .eq("month_key", monthKey);
  if (error) throw error;
}

export async function upsertFciMonthly(
  empresaId: EmpresaId,
  monthKey: string,
  field: "suscripciones" | "rescates",
  value: number,
  current: { suscripciones: number; rescates: number }
): Promise<void> {
  const next = {
    empresa_id: empresaId,
    month_key: monthKey,
    suscripciones: field === "suscripciones" ? value : current.suscripciones,
    rescates: field === "rescates" ? value : current.rescates,
  };
  const { error } = await supabase.from("fci_monthly").upsert(next);
  if (error) throw error;
}

export async function upsertIvaMonthly(empresaId: EmpresaId, rowName: string, monthKey: string, monto: number): Promise<void> {
  if (monto === 0) {
    const { error } = await supabase
      .from("iva_monthly")
      .delete()
      .eq("empresa_id", empresaId)
      .eq("row_name", rowName)
      .eq("month_key", monthKey);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("iva_monthly").upsert({ empresa_id: empresaId, row_name: rowName, month_key: monthKey, monto });
  if (error) throw error;
}

export async function updateRange(rangeStart: string, rangeEnd: string): Promise<void> {
  const { error } = await supabase.from("settings").update({ range_start: rangeStart, range_end: rangeEnd }).eq("id", 1);
  if (error) throw error;
}

export async function updateEmpresa(e: Empresa): Promise<void> {
  const { error } = await supabase
    .from("empresas")
    .update({ codigo: e.codigo, nombre: e.nombre, fci_saldo_inicial: e.fciSaldoInicial })
    .eq("id", e.id);
  if (error) throw error;
}

function bankToRow(b: Omit<Bank, "label">) {
  return {
    id: b.id,
    empresa_id: b.empresaId,
    nombre: b.name,
    short: b.short,
    color: b.color,
    saldo_inicial: b.saldoInicial,
    orden: b.orden,
    activo: b.activo,
  };
}

export async function updateBank(b: Bank): Promise<void> {
  const { id, ...row } = bankToRow(b);
  const { error } = await supabase.from("banks").update(row).eq("id", id);
  if (error) throw error;
}

export async function insertBank(b: Omit<Bank, "label">): Promise<void> {
  const { error } = await supabase.from("banks").insert(bankToRow(b));
  if (error) throw error;
}

function chequeToRow(c: Omit<Cheque, "id">) {
  return {
    empresa_id: c.empresaId,
    cliente: c.cliente,
    numero: c.numero,
    banco_emisor: c.bancoEmisor,
    banco_destino: c.bancoDestino,
    importe: c.importe,
    fecha_recepcion: c.fechaRecepcion,
    fecha_pago: c.fechaPago || null,
    estado: c.estado,
    fecha_deposito: c.fechaDeposito || null,
    fecha_acreditacion: c.fechaAcreditacion || null,
    fecha_rechazo: c.fechaRechazo || null,
    fecha_endoso: c.fechaEndoso || null,
    fecha_cesion: c.fechaCesion || null,
    endosado_a: c.endosadoA,
    movement_id: c.movementId,
  };
}

export async function insertCheque(c: Omit<Cheque, "id">): Promise<Cheque> {
  const { data, error } = await supabase.from("cheques").insert(chequeToRow(c)).select().single();
  if (error) throw error;
  return toCheque(data as ChequeRow);
}

export async function updateCheque(c: Cheque): Promise<void> {
  const { error } = await supabase.from("cheques").update(chequeToRow(c)).eq("id", c.id);
  if (error) throw error;
}

export async function deleteCheque(id: string): Promise<void> {
  const { error } = await supabase.from("cheques").delete().eq("id", id);
  if (error) throw error;
}
