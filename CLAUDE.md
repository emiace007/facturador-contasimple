# Facturador para comercios — facturación electrónica ARCA multi-comercio

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
Base copiada. Nada publicado ni creado en GitHub/Netlify/Render/Supabase todavía.
