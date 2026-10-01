# Facturador Contasimple — facturación electrónica ARCA para comercios

App para que **comercios** emitan facturas electrónicas (individual o masiva). Derivado del sistema del Estudio Bertero
(repos `estudio-contable-frontend` y `estudio-bertero-afip-backend`), pero **independiente**: no comparte Sheet, Apps Script ni deploy.
Se vende a varios comercios; el estudio factura **por cuenta de cada comercio** (delegación del servicio de facturación al CUIT del estudio).

**Idioma:** UI, mensajes, commits y comentarios en español rioplatense. El usuario final no es programador.

## Estructura
- `web/` — frontend React 18 + Vite + TS + Tailwind + React Query (copia del frontend del estudio).
- `arca/` — backend Node/Express: WSAA, WSFEv1 (CAE), padrón A5 (copia del backend del estudio).

## Decisiones tomadas
- Multi-comercio (SaaS): cada comercio ve solo sus datos.
- Permisos: delegación al CUIT del estudio (`cuitRepresentada`), un solo certificado en el backend.
- Base de datos: **Postgres (Supabase)** en lugar de Google Sheets + Apps Script. El backend `arca/` pasa a ser el único backend.

## Qué se reutiliza / qué no
- Reutilizar: emisión A/B/C, `CondicionIVAReceptor`, fecha elegible (±10 servicios / ±5 productos), cola masiva, plantilla Excel con Fecha, PDF con QR, padrón, login.
- Sacar: clientes del estudio, vencimientos, tareas, honorarios, balance, sociedades, sueldos, recategorizaciones.
- Agregar: catálogo de productos, compradores frecuentes, resumen de ventas y tope de monotributo, alta de comercio (onboarding de la delegación).

## Reglas que NO hay que romper
- Monotributo → Factura C; RI → A (a RI) o B (resto). Validar en frontend y backend.
- Factura B de RI: leyenda Ley 27.743 "IVA Contenido".
- Aislamiento por comercio en TODA consulta (nunca devolver datos de otro comercio).
- **Producción real = cada CAE es una factura válida.** Probar solo en **homologación** salvo pedido explícito del usuario.
- Secretos (certificado, claves) solo en variables de entorno, nunca en el código.

## Estado
- `db/schema.sql`: esquema Postgres con aislamiento por comercio (RLS). Cargado en Supabase por el usuario.
- `arca/`: backend con login, comercios, productos, facturas y lotes sobre Postgres. `npm test` = prueba de punta a punta con ARCA **simulado** (necesita `DATABASE_URL` de una base local con el esquema). `test/dev-server.js` levanta el backend con ARCA simulado para probar la pantalla.
- `web/`: app nueva (login, comercios [estudio], facturar, carga masiva con Excel y columna Fecha, facturas, productos). Variable `VITE_API_URL` = URL del backend.
- Variables del backend: `DATABASE_URL` (rol app_user), `CORS_ORIGIN`, `AFIP_ENV`, `AFIP_CERT_PEM`, `AFIP_KEY_PEM` (las mismas del estudio).
- Pendiente: probar contra la base real de Supabase, probar ARCA en homologación, PDF de factura con QR, verificación de la delegación, subir a GitHub y publicar (Render + Netlify).
- Nada publicado ni creado en GitHub/Netlify/Render todavía.
