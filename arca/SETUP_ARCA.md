# Cómo habilitar la Facturación Electrónica (ARCA / ex AFIP)

Esta guía es para vos (Antonella), con tu propia Clave Fiscal. Ningún paso de acá lo hago yo por vos — nunca debo ni voy a pedirte ni tocar tu Clave Fiscal.

CUIT del estudio: **27-38645382-4** (Antonella Bertero).

## Idea general

En vez de pedirle un certificado a cada cliente, el estudio saca **un solo certificado digital propio**. Después, cada cliente le delega el servicio "Factura Electrónica" al CUIT del estudio desde su propia cuenta de ARCA. Con ese único certificado, el backend puede emitir facturas "en representación de" cada cliente delegado, sin guardar nunca una clave de un cliente.

Vamos a arrancar por el ambiente de **homologación** (testing, sin validez fiscal real) antes de tocar producción.

## Paso 1 — Generar la clave privada y el CSR

Esto se hace una sola vez, en tu computadora (no en la nube), con OpenSSL. Si tenés Git para Windows instalado, abrí "Git Bash" y corré:

```bash
openssl genrsa -out estudio_bertero.key 2048
openssl req -new -key estudio_bertero.key -subj "/C=AR/O=Antonella Bertero/CN=EstudioBerteroWSFE/serialNumber=CUIT 27386453824" -out estudio_bertero.csr
```

Esto genera dos archivos:
- `estudio_bertero.key` → tu clave privada. **No se sube a ningún lado, no se comparte, no se manda por mail.** Es la que va a firmar las facturas.
- `estudio_bertero.csr` → el pedido de certificado. Este sí se sube a ARCA en el paso siguiente.

Si no tenés Git/OpenSSL instalado, avisame y lo generamos juntos apenas se restablezca mi acceso al entorno de ejecución (hay un problema técnico puntual de mi lado ahora mismo).

## Paso 2 — Pedir el certificado de homologación (WSASS)

1. Entrá a `https://www.afip.gob.ar` (o el dominio ARCA vigente) e iniciá sesión con tu Clave Fiscal.
2. Buscá el servicio **"WSASS - Autogestión de Certificados"** (ambiente de homologación/testing).
3. Elegí **"Nuevo Certificado"**.
4. Pegá el contenido completo del archivo `estudio_bertero.csr` (abrilo con el Bloc de notas y copiá todo, incluyendo las líneas `-----BEGIN CERTIFICATE REQUEST-----` y `-----END CERTIFICATE REQUEST-----`).
5. Confirmá y descargá el certificado que te devuelve (`.crt` o `.pem`). Guardalo junto a la clave privada.

## Paso 3 — Autorizar el servicio "wsfe" para ese certificado

Todavía dentro de WSASS (u "Administrador de Relaciones de Clave Fiscal"):

1. Buscá el certificado que acabás de crear.
2. Click en **"Crear autorización de acceso"** (o "Adherir servicio").
3. Elegí el webservice **"wsfe - Facturación Electrónica"**.
4. Confirmá.

Sin este paso, cualquier llamada al webservice devuelve "Computador no autorizado a acceder al servicio".

## Paso 4 — Delegar el servicio por cada cliente

Este paso lo hace **cada cliente**, no vos, entrando con su propia Clave Fiscal (o vos si tenés delegado el manejo de su clave, como ya hacés hoy para otros trámites):

1. Entrar a "Administrador de Relaciones de Clave Fiscal".
2. Buscar la opción de **nueva relación / delegar un servicio**.
3. Servicio: **Factura Electrónica**.
4. Representante: CUIT del estudio (**27-38645382-4**).
5. Confirmar.

A partir de ahí, el certificado único del estudio puede facturar en nombre de ese cliente.

## Paso 5 — Datos que necesito para conectar el backend

Una vez que tengas el `.crt` (o `.pem`) de ARCA:

- El archivo del certificado.
- El archivo de la clave privada (`estudio_bertero.key`) del paso 1.

Con eso completamos las variables `AFIP_CERT_PEM` y `AFIP_KEY_PEM` en el backend (ver `README.md` de esta carpeta) y probamos la primera conexión contra homologación.

## Sobre producción

Cuando todo esto funcione bien en homologación, para pasar a producción hay que repetir el certificado (uno nuevo, distinto al de testing) a través de "Administrador de Certificados Digitales" con tu Clave Fiscal real, y ahí sí las facturas emitidas tienen validez fiscal. No conviene apurar este paso hasta haber probado varias facturas de prueba en homologación.
