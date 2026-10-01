-- Nombre de fantasía del comercio (sale en la factura) e IVA por defecto.
alter table comercios add column if not exists nombre_fantasia text;
alter table comercios add column if not exists alicuota_default numeric(4,1);
alter table comercios drop constraint if exists comercios_alicuota_default_check;
alter table comercios add constraint comercios_alicuota_default_check check (alicuota_default in (0,10.5,21,27));
