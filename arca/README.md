# Backend — Facturador Contasimple

API Node/Express: login, comercios, productos, facturas y lotes sobre Postgres (Supabase), y emisión contra ARCA (WSAA + WSFEv1 + padrón A5).
El estudio factura por cuenta de cada comercio (`cuitRepresentada`) con **un único certificado**; ver `SETUP_ARCA.md` para generarlo y para la delegación.

## Correr en local
1. Base Postgres con `../db/schema.sql` cargado (rol `app_user`).
2. Copiar `.env.example` a `.env` y completar `DATABASE_URL`, `CORS_ORIGIN`, `AFIP_*`.
3. `npm install` → `node scripts/crear-staff.js <email> <clave>` → `npm start`.

## Pruebas (sin tocar ARCA)
- `npm test`: prueba de punta a punta con ARCA simulado (necesita `DATABASE_URL` de una base local).
- `node test/dev-server.js`: backend con ARCA simulado para probar la pantalla.

**Producción real:** cada CAE es una factura válida. `AFIP_ENV` arranca en `homologacion`; pasar a `produccion` es una decisión explícita.
