-- Cashflow app schema. No RLS / no auth: the anon key has full read/write,
-- by design (see docs/superpowers/specs/2026-06-12-cashflow-app-design.md).

create table settings (
  id int primary key default 1,
  saldo_inicial_galicia numeric not null default 0,
  saldo_inicial_nacion  numeric not null default 0,
  range_start text not null default '2025-07',
  range_end   text not null default '2027-03',
  fci_saldo_inicial numeric not null default 0,
  constraint settings_single_row check (id = 1)
);

create table movements (
  id uuid primary key default gen_random_uuid(),
  bank text not null check (bank in ('galicia','nacion')),
  descripcion text not null,
  proveedor text not null default '',
  fecha_emision date,
  fecha_pago date not null,
  cheque text not null default '',
  credito numeric not null default 0,
  debito numeric not null default 0,
  grupo text not null,
  transfer_id uuid,
  created_at timestamptz not null default now()
);

create table projection_cells (
  concept_id text not null,
  month_key  text not null,
  cantidad numeric not null default 0,
  precio   numeric not null default 0,
  primary key (concept_id, month_key)
);

create table fci_monthly (
  month_key text primary key,
  suscripciones numeric not null default 0,
  rescates      numeric not null default 0
);

create table iva_monthly (
  row_name  text not null,
  month_key text not null,
  monto numeric not null default 0,
  primary key (row_name, month_key)
);

create table cheques (
  id uuid primary key default gen_random_uuid(),
  cliente text not null default '',
  numero text not null default '',
  banco_emisor text not null default '',
  banco_destino text not null default '' check (banco_destino in ('', 'galicia', 'nacion')),
  importe numeric not null default 0,
  fecha_recepcion date not null,
  fecha_pago date,
  estado text not null default 'en_cartera' check (estado in ('en_cartera', 'depositado', 'endosado', 'cesionado')),
  fecha_deposito date,
  fecha_acreditacion date,
  fecha_rechazo date,
  fecha_endoso date,
  fecha_cesion date,
  endosado_a text not null default '',
  movement_id uuid,
  created_at timestamptz not null default now()
);

-- Grants for the anon role (no-auth app)
grant select, insert, update, delete on settings, movements, projection_cells, fci_monthly, iva_monthly, cheques to anon;

-- ---------- Seed data ----------

insert into settings (id, saldo_inicial_galicia, saldo_inicial_nacion, range_start, range_end, fci_saldo_inicial)
values (1, 50000000, 15742577.77, '2025-07', '2027-03', 0);

insert into movements (bank, descripcion, proveedor, fecha_emision, fecha_pago, cheque, credito, debito, grupo) values
('galicia', 'ECHEQ EN CARTERA', '', null, '2026-06-02', '', 60000000, 0, 'Ingresos'),
('galicia', 'TRANSFERENCIA', 'GALICIA', null, '2026-06-05', '', 115000000, 0, 'Transf entre cuentas'),
('galicia', 'GASMAX', '', null, '2026-06-01', '239', 0, 1795836.02, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-15', '258', 0, 21738124.70, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-16', '268', 0, 11000000, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-19', '269', 0, 11000000, 'Pagos'),
('galicia', 'LUIS S FERRO', '', null, '2026-06-19', '259', 0, 3000000, 'Pagos'),
('galicia', 'PETROBAN SRL', '', null, '2026-06-22', '266', 0, 11477394.79, 'Pagos'),
('galicia', 'ESTACION EL BAJO', '', null, '2026-06-22', '270', 0, 11200000, 'Pagos'),
('galicia', 'AGRICOLA GARCIA', '', null, '2026-06-26', '260', 0, 4000000, 'Pagos'),
('galicia', 'NEUMATICOS EL TIMBO SAS', '', null, '2026-06-29', '262', 0, 590000, 'Pagos'),
('galicia', 'NOR TEX SAS', '', null, '2026-06-30', '257', 0, 2430267.25, 'Pagos'),
('galicia', 'PENDIENTE DE COBRO', 'AGD', null, '2026-06-30', '', 14000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'RUIZ RODRIGO', null, '2026-06-30', '', 12000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'ESTANCIA EL AZUL', null, '2026-06-30', '', 8000000, 0, 'Ingresos'),
('galicia', 'PENDIENTE DE COBRO', 'SOUTH FOUTH', null, '2026-06-30', '', 4000000, 0, 'Ingresos'),
('nacion', 'BUNGE FACTURA PENDIENTE', '', null, '2026-06-02', '', 36000000, 0, 'Ingresos'),
('nacion', 'TRANSFERENCIA', 'GALICIA', null, '2026-06-05', '', 0, 115000000, 'Transf entre cuentas'),
('nacion', 'SUELDOS', '', null, '2026-06-05', '', 0, 10000000, 'Pagos'),
('nacion', 'MERCEDES BENZ -CAMION', 'AG424SW', null, '2026-06-05', 'E CUOTAS 48-28', 0, 20679377.13, 'Pagos'),
('nacion', 'SICORE', '', null, '2026-06-10', '', 0, 2000000, 'Pagos'),
('nacion', 'COSECHA soja', 'facturar falta', null, '2026-06-12', '', 25000000, 0, 'Ingresos'),
('nacion', 'SIN FACTURAR', 'FLETE BUNGE', null, '2026-06-13', '', 20000000, 0, 'Ingresos'),
('nacion', 'COSECHA CAÑA', 'PAGO EN JULIO', null, '2026-06-14', '', 130000000, 0, 'Ingresos'),
('nacion', 'SAN MIGUEL FALTA FACTUREAR', '', null, '2026-06-15', '', 12000000, 0, 'Ingresos');

insert into projection_cells (concept_id, month_key, cantidad, precio) values
('azucar', '2025-07', 7000, 25000),
('azucar', '2025-08', 7000, 25000),
('azucar', '2025-09', 7000, 25000),
('azucar', '2025-10', 7000, 25000),
('azucar', '2025-11', 7000, 25000),
('azucar', '2025-12', 7000, 25000),
('fletes', '2025-07', 1, 80000000),
('fletes', '2025-08', 1, 100000000),
('fletes', '2025-09', 1, 100000000),
('servicios', '2025-07', 1, 20000000),
('cheques3', '2025-08', 1, 344000000);

insert into fci_monthly (month_key, suscripciones, rescates) values
('2025-07', 260000000, 260586228),
('2025-08', 450100000, 398618319),
('2025-09', 50264223, 101745915);

insert into iva_monthly (row_name, month_key, monto) values
('Azúcar', '2025-07', 131900826),
('Azúcar', '2025-08', 154710744),
('Azúcar', '2025-09', 64125620),
('Sorgo', '2025-07', 48559851),
('Sorgo', '2025-08', 46378759),
('Sorgo', '2025-09', 61356893),
('Sorgo', '2025-10', 31378233),
('Fletes', '2025-07', 1949799),
('Fletes', '2025-08', 29827779),
('Fletes', '2025-09', 55404284),
('Fletes', '2025-10', 65408269);

insert into cheques (cliente, numero, banco_emisor, banco_destino, importe, fecha_recepcion, fecha_pago, estado, fecha_deposito, fecha_acreditacion) values
('AGD', '0001234', 'Banco Santander', 'galicia', 14000000, '2026-06-20', '2026-06-30', 'en_cartera', null, null),
('RUIZ RODRIGO', '0005678', 'Banco Macro', 'nacion', 12000000, '2026-06-22', '2026-07-05', 'depositado', '2026-06-29', null),
('ESTANCIA EL AZUL', '0009012', 'Banco Galicia', 'galicia', 8000000, '2026-05-10', '2026-05-20', 'depositado', '2026-05-18', '2026-05-22');
