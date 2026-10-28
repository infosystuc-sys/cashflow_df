-- Revierte 20261028000001_multiempresa.sql y deja la estructura como antes.
-- ATENCIÓN: borra lo cargado para la SAS y para SAN Credicoop (movimientos,
-- cheques, proyección, FCI, IVA), porque la estructura anterior solo admite
-- Galicia y Nación de una única empresa. Hacer un backup antes de correrlo.

begin;

-- Los saldos iniciales y el saldo FCI vuelven a settings.
update settings set
  saldo_inicial_galicia = (select saldo_inicial from banks where id = 'galicia'),
  saldo_inicial_nacion = (select saldo_inicial from banks where id = 'nacion'),
  fci_saldo_inicial = (select fci_saldo_inicial from empresas where id = 'san')
where id = 1;

delete from movements where bank not in ('galicia', 'nacion');
delete from cheques where empresa_id <> 'san';
delete from projection_cells where empresa_id <> 'san';
delete from fci_monthly where empresa_id <> 'san';
delete from iva_monthly where empresa_id <> 'san';

alter table iva_monthly drop constraint iva_monthly_pkey;
alter table iva_monthly drop column empresa_id;
alter table iva_monthly add primary key (row_name, month_key);

alter table fci_monthly drop constraint fci_monthly_pkey;
alter table fci_monthly drop column empresa_id;
alter table fci_monthly add primary key (month_key);

alter table projection_cells drop constraint projection_cells_pkey;
alter table projection_cells drop column empresa_id;
alter table projection_cells add primary key (concept_id, month_key);

drop trigger cheques_banco_destino_valido on cheques;
drop function cheques_banco_destino_valido();
update cheques set banco_destino = '' where banco_destino not in ('', 'galicia', 'nacion');
alter table cheques add constraint cheques_banco_destino_check check (banco_destino in ('', 'galicia', 'nacion'));
alter table cheques drop column empresa_id;

alter table movements drop constraint movements_bank_fkey;
alter table movements add constraint movements_bank_check check (bank in ('galicia', 'nacion'));

drop table banks;
drop table empresas;

commit;
