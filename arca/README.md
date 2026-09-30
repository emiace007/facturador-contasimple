# Backend de Facturación Electrónica (ARCA / ex AFIP)

Servicio Node.js aparte del resto de la app (que vive en Apps Script), porque firmar los pedidos ante ARCA requiere criptografía (CMS/PKCS#7) que Google Apps Script no soporta de forma nativa.

## Qué hace

- Login contra **WSAA** (`src/wsaa.js`): firma un ticket con el certificado y la clave privada **del estudio** (un solo certificado, no uno por cliente) y obtiene un token válido ~12hs.
- Llamadas a **WSFEv1** (`src/wsfe.js`): consulta el último comprobante autorizado y pide el CAE de una factura nueva, indicando el CUIT del cliente por el que se factura (`cuitRepresentada`).
- Expone dos endpoints REST (`src/server.js`) para que el resto del sistema (o Apps Script vía `UrlFetchApp`) los llame sin tener que hablar SOAP.

## Antes de arrancar

Primero hay que completar `SETUP_ARCA.md`: generar el certificado del estudio y conseguir que cada cliente delegue el servicio de Facturación Electrónica al CUIT del estudio. Sin eso, este backend no tiene con qué autenticarse.

> **Estado actual:** el código está escrito siguiendo la documentación oficial de WSAA/WSFEv1, pero todavía no se probó contra un certificado real (un problema puntual de entorno impidió correr `npm install` y hacer una prueba en esta sesión). La primera vez que se use con un certificado de homologación real, conviene revisar la respuesta cruda de ARCA ante cualquier error raro — quedaron comentarios en el código marcando los puntos más sensibles (formato de fecha, digest de la firma).

## Configuración

```bash
cd afip-backend
npm install
cp .env.example .env
```

Completar en `.env`:

- `AFIP_ENV`: `homologacion` mientras se prueba, `produccion` cuando ARCA ya tenga el certificado real.
- `AFIP_CERT_PEM` / `AFIP_KEY_PEM`: el certificado y la clave privada del estudio (ver `SETUP_ARCA.md`). Se puede pegar el PEM completo o, si el hosting no admite variables multilínea, codificarlo en base64.
- `BACKEND_API_KEY`: cualquier clave larga al azar, para que solo el sistema principal pueda llamar a este backend.

Correr local:

```bash
npm start
```

Probar que levantó:

```bash
curl http://localhost:3000/health
```

## Endpoints

### `GET /api/facturas/ultimo`

Query params: `cuit`, `ptoVta`, `cbteTipo`.

```json
{ "ok": true, "data": { "ultimoNumero": 42 } }
```

### `POST /api/facturas`

Body:

```json
{
  "cuitRepresentada": "20123456789",
  "ptoVta": 1,
  "docTipo": 80,
  "docNro": "20123456789",
  "importe": 15000,
  "cbteTipo": 11,
  "concepto": 2
}
```

`cbteTipo` (11 = Factura C, el caso típico para monotributistas) y `concepto` (2 = Servicios) tienen ese valor por defecto si no se mandan. Respuesta:

```json
{
  "ok": true,
  "data": {
    "numero": 43,
    "ptoVta": 1,
    "cbteTipo": 11,
    "cae": "71234567890123",
    "caeVencimiento": "20261020",
    "resultado": "A"
  }
}
```

Todas las llamadas van con el header `x-api-key: <BACKEND_API_KEY>`.

## Desplegar en Render (recomendado, tiene plan gratuito)

1. Subir esta carpeta (`afip-backend/`) a un repositorio de GitHub (puede ser privado).
2. En [render.com](https://render.com), crear un **"New Web Service"** apuntando a ese repositorio.
3. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
4. En "Environment", cargar las mismas variables que en `.env` (`AFIP_ENV`, `AFIP_CERT_PEM`, `AFIP_KEY_PEM`, `BACKEND_API_KEY`). Render no necesita `PORT`, lo define solo.
5. Deploy. Render da una URL tipo `https://estudio-bertero-afip.onrender.com`.
6. Probar `https://.../health` desde el navegador.

Con esa URL, el paso siguiente (cuando el certificado ya esté andando) es agregar en `apps-script/Code.gs` una función que llame a `POST /api/facturas` con `UrlFetchApp`, para disparar la facturación desde la app principal.

## Por qué un backend aparte y no meterlo en Apps Script

WSAA exige firmar el pedido de login como CMS/PKCS#7 con la clave privada del estudio. Apps Script no tiene una librería nativa para eso; la alternativa (usar `UrlFetchApp` para llamar a un servicio externo que sí sepa firmar) es exactamente lo que hace este backend. El resto de la app (Sheets, Vencimientos, Tareas, Clientes, etc.) sigue funcionando igual que hasta ahora — esto se suma como una pieza nueva, no reemplaza nada.
