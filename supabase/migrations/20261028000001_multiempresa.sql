-- Multiempresa: SAN (Rafael Sánchez) y SAS (Grupo Don Félix), cada una con sus
-- bancos, su proyección, FCI e IVA. Solo agrega: no borra ni renombra columnas
-- y los movimientos existentes conservan su banco ('galicia' / 'nacion').
-- Reversión: 20261028000001_multiempresa_rollback.sql
-- Mismo criterio que schema.sql: sin RLS, el rol anon tiene lectura/escritura.

begin;

-- ---------- Empresas ----------
create table empresas (
  id text primary key,
  codigo text not null unique,
  nombre text not null,
  fci_saldo_inicial numeric not null default 0,
  orden int not null default 0
);

insert into empresas (id, codigo, nombre, fci_saldo_inicial, orden)
select 'san', 'SAN', 'Rafael Sánchez', fci_saldo_inicial, 1 from settings where id = 1;
insert into empresas (id, codigo, nombre, fci_saldo_inicial, orden)
values ('sas', 'SAS', 'Grupo Don Félix', 0, 2);

-- ---------- Bancos ----------
create table banks (
  id text primary key,
  empresa_id text not null references empresas (id),
  nombre text not null,
  short text not null,
  color text not null default '#64748b',
  saldo_inicial numeric not null default 0,
  orden int not null default 0,
  activo boolean not null default true
);

-- Galicia y Nación mantienen su id para no tocar los movimientos ni los cheques.
insert into banks (id, empresa_id, nombre, short, color, saldo_inicial, orden)
select 'galicia', 'san', 'Banco Galicia', 'Galicia', '#e87613', saldo_inicial_galicia, 1 from settings where id = 1;
insert into banks (id, empresa_id, nombre, short, color, saldo_inicial, orden)
select 'nacion', 'san', 'Banco Nación', 'Nación', '#1f7fc4', saldo_inicial_nacion, 2 from settings where id = 1;
insert into banks (id, empresa_id, nombre, short, color, saldo_inicial, orden) values
  ('san_credicoop', 'san', 'Banco Credicoop', 'Credicoop', '#0f8a5f', 0, 3),
  ('sas_galicia', 'sas', 'Banco Galicia', 'Galicia', '#c2410c', 0, 4),
  ('sas_macro', 'sas', 'Banco Macro', 'Macro', '#1e3a8a', 0, 5),
  ('sas_credicoop', 'sas', 'Banco Credicoop', 'Credicoop', '#047857', 0, 6);

-- ---------- Movimientos: el banco pasa a ser cualquiera de la tabla banks ----------
alter table movements drop constraint movements_bank_check;
alter table movements add constraint movements_bank_fkey foreign key (bank) references banks (id);

-- ---------- Cheques: pertenecen a una empresa ----------
alter table cheques add column empresa_id text not null default 'san' references empresas (id);
alter table cheques drop constraint cheques_banco_destino_check;

-- El banco destino (si hay) tiene que ser de la misma empresa del cheque.
create function cheques_banco_destino_valido() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.banco_destino <> '' and not exists (
    select 1 from banks b where b.id = new.banco_destino and b.empresa_id = new.empresa_id
  ) then
    raise exception 'El banco destino % no pertenece a la empresa %', new.banco_destino, new.empresa_id;
  end if;
  return new;
end;
$$;

create trigger cheques_banco_destino_valido
  before insert or update of banco_destino, empresa_id on cheques
  for each row execute function cheques_banco_destino_valido();

-- ---------- Proyección, FCI e IVA: por empresa ----------
alter table projection_cells add column empresa_id text not null default 'san' references empresas (id);
alter table projection_cells drop constraint projection_cells_pkey;
alter table projection_cells add primary key (empresa_id, concept_id, month_key);

alter table fci_monthly add column empresa_id text not null default 'san' references empresas (id);
alter table fci_monthly drop constraint fci_monthly_pkey;
alter table fci_monthly add primary key (empresa_id, month_key);

alter table iva_monthly add column empresa_id text not null default 'san' references empresas (id);
alter table iva_monthly drop constraint iva_monthly_pkey;
alter table iva_monthly add primary key (empresa_id, row_name, month_key);

grant select, insert, update, delete on empresas, banks to anon;

commit;
