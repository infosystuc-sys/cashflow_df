export type BankId = "galicia" | "nacion";

export interface Movement {
  id: string;
  bank: BankId;
  descripcion: string;
  proveedor: string;
  fechaEmision: string; // 'YYYY-MM-DD' or ''
  fechaPago: string; // 'YYYY-MM-DD'
  cheque: string;
  credito: number;
  debito: number;
  grupo: string;
}

export interface ProjectionValue {
  cantidad: number;
  precio: number;
}

// conceptId -> monthKey -> value
export type ProjectionMap = Record<string, Record<string, ProjectionValue>>;

export interface FciMonthData {
  suscripciones: number;
  rescates: number;
}

// monthKey -> data
export type FciData = Record<string, FciMonthData>;

// rowName -> monthKey -> monto
export type IvaData = Record<string, Record<string, number>>;

export interface Settings {
  saldoInicial: Record<BankId, number>;
  rangeStart: string; // 'YYYY-MM'
  rangeEnd: string; // 'YYYY-MM'
}

export interface CashflowState {
  settings: Settings;
  movements: Movement[];
  projection: ProjectionMap;
  fci: { saldoInicial: number; data: FciData };
  iva: IvaData;
}

export interface BankRow extends Movement {
  saldo: number;
}

export interface BankSummary {
  inicial: number;
  ingresos: number;
  ventaUSD: number;
  pagos: number;
  transf: number;
  final: number;
  control: number;
}

export interface CashflowRow {
  key: string;
  label: string;
  saldoInicialBanco: number;
  ingresos: number;
  ventaUSD: number;
  pagos: number;
  invFCI: number;
  transf: number;
  saldoFinalBanco: number;
  saldoInicialFci: number;
  suscripciones: number;
  rescates: number;
  saldoFinalFci: number;
  cierreTotal: number;
  proyTotal: number;
  realIngresos: number;
  vsPresup: number;
}

export interface CashflowResult {
  months: string[];
  rows: CashflowRow[];
}

export interface ProjConcept {
  id: string;
  name: string;
  unidad: string;
  tipo: "unidad" | "monto";
  grupo: "producto" | "servicio" | "otro";
}

export interface Bank {
  id: BankId;
  name: string;
  short: string;
  color: string;
}
