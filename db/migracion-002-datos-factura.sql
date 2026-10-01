-- Datos del comercio que tienen que figurar en la factura (RG 1415).
alter table comercios add column if not exists iibb text;
alter table comercios add column if not exists inicio_actividades date;
