-- Facturador Contasimple — esquema Postgres (multi-comercio).
-- Regla de oro: toda tabla de datos lleva comercio_id y se filtra por él.

create extension if not exists pgcrypto;

create table comercios (
  id uuid primary key default gen_random_uuid(),
  razon_social text not null,
  cuit text not null unique check (cuit ~ '^[0-9]{11}$'),
  condicion_fiscal text not null check (condicion_fiscal in ('monotributo','responsable_inscripto')),
  categoria_monotributo text,                       -- A..K, solo monotributo
  punto_venta int,                                   -- PV por defecto
  domicilio text,
  delegacion_estado text not null default 'pendiente'
    check (delegacion_estado in ('pendiente','verificada','error')),
  delegacion_verificada_en timestamptz,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid references comercios(id) on delete cascade,  -- null = staff del estudio
  email text not null unique,
  password_hash text not null,
  rol text not null check (rol in ('staff','dueno','empleado')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  check ((rol = 'staff') = (comercio_id is null))
);

create table sesiones (
  token_hash text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  vence_en timestamptz not null
);

create table compradores (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  nombre text not null,
  doc_tipo int not null default 99,                 -- 80 CUIT, 96 DNI, 99 consumidor final
  doc_nro text not null default '0',
  condicion_iva_id int not null default 5,          -- 5 = consumidor final
  email text,
  telefono text,
  unique (comercio_id, doc_tipo, doc_nro)
);

create table productos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  nombre text not null,
  precio numeric(14,2) not null check (precio >= 0),
  alicuota_iva numeric(4,1) not null default 21 check (alicuota_iva in (0,10.5,21,27)),
  es_servicio boolean not null default false,
  activo boolean not null default true
);

create table facturas (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  comprador_id uuid references compradores(id),
  cbte_tipo int not null check (cbte_tipo in (1,6,11)),
  punto_venta int not null,
  numero bigint,
  concepto int not null check (concepto in (1,2,3)),
  fecha_comprobante date not null,
  doc_tipo int not null,
  doc_nro text not null,
  condicion_iva_receptor_id int not null,
  receptor_nombre text,
  importe_total numeric(14,2) not null check (importe_total > 0),
  importe_neto numeric(14,2),
  importe_iva numeric(14,2),
  alicuota_iva numeric(4,1),
  estado text not null default 'pendiente' check (estado in ('pendiente','emitida','error')),
  cae text,
  cae_vencimiento date,
  error text,
  lote_id uuid,                                      -- carga masiva
  creado_por uuid references usuarios(id),
  creado_en timestamptz not null default now(),
  -- una factura emitida tiene CAE y número
  check (estado <> 'emitida' or (cae is not null and numero is not null))
);
create unique index facturas_numero_uq on facturas (comercio_id, punto_venta, cbte_tipo, numero) where numero is not null;
create index facturas_comercio_fecha on facturas (comercio_id, fecha_comprobante desc);
create index facturas_lote on facturas (lote_id) where lote_id is not null;

create table factura_items (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  producto_id uuid references productos(id),
  descripcion text not null,
  cantidad numeric(12,3) not null default 1 check (cantidad > 0),
  precio_unitario numeric(14,2) not null
);

create table lotes (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references comercios(id) on delete cascade,
  archivo text,
  total int not null default 0,
  creado_en timestamptz not null default now()
);

create table auditoria (
  id bigserial primary key,
  comercio_id uuid references comercios(id) on delete set null,
  usuario_id uuid references usuarios(id) on delete set null,
  accion text not null,
  detalle jsonb,
  creado_en timestamptz not null default now()
);

-- Rol de la aplicación (se crea primero porque las políticas lo nombran).
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user login; end if;
end $$;

-- Aislamiento por comercio a nivel base de datos (defensa en profundidad):
-- el backend hace `select set_config('app.comercio_id', <uuid>, true)` al inicio de cada transacción.
do $$
declare t text;
begin
  foreach t in array array['compradores','productos','facturas','lotes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($p$create policy aislamiento on %I using (comercio_id = nullif(current_setting('app.comercio_id', true),'')::uuid) with check (comercio_id = nullif(current_setting('app.comercio_id', true),'')::uuid)$p$, t);
  end loop;
end $$;

-- Tablas sin comercio_id (usuarios, sesiones, comercios, auditoria, factura_items): RLS activado y solo las ve el rol de la app.
-- Sin esto, la API pública de Supabase (clave anon) podría leer contraseñas y sesiones.
do $$
declare t text;
begin
  foreach t in array array['comercios','usuarios','sesiones','auditoria','factura_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy solo_app on %I to app_user using (true) with check (true)', t);
  end loop;
end $$;

-- Rol de la aplicación: sin bypass de RLS.
grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;

-- Supabase: la API pública (anon / authenticated) no debe tocar nada. Todo pasa por el backend con app_user.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
    revoke all on all sequences in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
    revoke all on all sequences in schema public from authenticated;
  end if;
end $$;

-- DESPUÉS de correr este archivo, definir la clave del rol de la app (en Supabase SQL Editor, con una clave larga y propia):
--   alter role app_user with password 'PONER-UNA-CLAVE-LARGA-ACA';
