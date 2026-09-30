export type EstadoVencimiento = 'Pendiente' | 'En Proceso' | 'Presentado';

export type TipoImpuesto = 'AFIP' | 'Ingresos Brutos' | 'Municipal' | 'Otro';

export interface Vencimiento {
  id: string;
  cuit: string;
  cliente: string;
  impuesto: string;
  tipo: TipoImpuesto;
  fechaVencimiento: string; // ISO date
  estado: EstadoVencimiento;
  observaciones?: string;
}

export type EstadoTarea = 'Por Hacer' | 'En Proceso' | 'Revisión' | 'Completado';

export type CategoriaTarea = 'Balance' | 'DDJJ' | 'Sueldos' | 'Otro';

export interface Tarea {
  id: string;
  cliente: string;
  obligacion: string;
  categoria: CategoriaTarea;
  responsable: string;
  estado: EstadoTarea;
  fechaLimite: string; // ISO date
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
  categoria: string;
}

/**
 * Ficha de cliente (hoja "PerfilClientes").
 *
 * `categoriasFiscales` viene ya calculada desde el backend a partir del texto libre
 * de "Condición Fiscal" cargado en el Excel del estudio (ej. "RD + Monotributo").
 * Es un string separado por comas, p.ej. "Monotributista, Relación de Dependencia".
 * Ver `lib/clientes.ts` para el detalle de qué implica cada categoría.
 */
export interface Cliente {
  id: string;
  cuit: string;
  cliente: string;
  encargado?: string;
  condicionFiscal?: string;
  categoriasFiscales: string;
  actMensual?: string;
  observaciones?: string;
  activo: boolean;
}

/** Un mes de facturación dentro de la planilla "Fc-Monit." (columnas con fecha como encabezado). */
export interface MesMonto {
  mes: string; // fecha ISO del encabezado de columna (primer día del mes)
  monto: number;
}

/**
 * Fila de la hoja "Fc-Monit.": monitoreo mensual de facturación y categoría de Monotributo.
 * `aviso` viene como texto libre de la planilla ("OK" / "Alerta!"). `categoriaSugerida` y
 * `topeSugerido` sólo vienen cargados cuando el estudio marcó que conviene recategorizar.
 */
export interface FacturacionCliente {
  cliente: string;
  encargado?: string;
  cuit: string;
  condicion?: string;
  accion?: string;
  puntoVenta?: string;
  responsable?: string;
  reportes?: string;
  domFiscal?: string;
  adeudaCcma?: string | number;
  nuestraParte?: string | number;
  categoria?: string;
  topeCategoria?: number;
  aviso?: string;
  acumulado?: number;
  categoriaSugerida?: string;
  topeSugerido?: number;
  meses: MesMonto[];
}

/** Fila de la hoja "Sociedades". */
export interface Sociedad {
  cliente: string;
  cierre?: string;
  vencido?: string;
  periodo?: string;
  vtoGanancias?: string;
  segmento?: string;
  plazoEspera?: string;
  reduccion50?: string;
  ddjjGanancias?: string;
  certificacion?: string;
  pub?: string;
  particSocietaria?: string;
  bsAccPart?: string;
  librosIpj?: string;
  encargado?: string;
  observaciones?: string;
}

/** Fila de la hoja "Ganancias 2025". */
export interface Ganancia {
  cliente: string;
  inscripto?: string;
  cuit?: string;
  vencimiento?: string;
  gcias25?: string | number;
  gcias24?: string | number;
  gcias23?: string | number;
  bsPersonales?: string | number;
  valor?: string | number;
  observaciones?: string;
}

/** Fila de la hoja "Sueldos-Reg.". */
export interface Sueldo {
  cliente: string;
  tramite?: string;
  estado?: string;
  observaciones?: string;
}

/**
 * Fila de la hoja "R.0726" (recategorización de Monotributo). Nunca incluye la columna
 * "CLAVE FISCAL" de esa hoja: el backend la excluye explícitamente por ser una credencial.
 */
export interface Recategorizacion {
  cliente: string;
  estado?: string;
  cuit?: string;
  condicionFiscal?: string;
  observaciones?: string;
  /** "HACER" | "MENSAJE" | "NO" | otro texto libre cargado por el estudio. */
  accion?: string;
  catActual?: string;
  catNueva?: string;
  encargado?: string;
  define?: string;
  dfeArca?: string;
  obs2?: string;
  honorarios?: string | number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Payload para pedir una factura electrónica real a ARCA (vía el backend AFIP en Render,
 * proxeado por Apps Script). `cbteTipo`/`concepto`/`docTipo` tienen default en el backend
 * (Factura C, Servicios, CUIT) si no se mandan.
 */
export interface FacturaAfipInput {
  cuitRepresentada: string;
  ptoVta: number;
  cbteTipo?: number; // 1=Factura A, 6=Factura B, 11=Factura C
  concepto?: number; // 1=Productos, 2=Servicios, 3=Productos y Servicios
  docTipo?: number; // 80=CUIT, 96=DNI, 99=Consumidor Final
  docNro?: string;
  importe: number;
  /** Alícuota de IVA a discriminar (en %): 21, 10.5, 27, 0, etc. Sólo aplica a Factura A (cbteTipo=1). */
  alicuotaIva?: number;
  /**
   * Condición frente al IVA del receptor (RG 5616/2024). Obligatoria en ARCA a partir del
   * 01/12/2026; hasta esa fecha se acepta como dato no excluyente, pero conviene mandarla
   * siempre. Ver `CONDICIONES_IVA_RECEPTOR` en `lib/condicionIva.ts` para los valores válidos.
   */
  condicionIvaReceptorId?: number;
  /** Fecha de la factura (yyyy-MM-dd). Si no se manda, ARCA usa la de hoy. */
  fechaComprobante?: string;
}

export interface FacturaAfipResult {
  numero: number;
  ptoVta: number;
  cbteTipo: number;
  cae: string;
  caeVencimiento: string;
  resultado: string;
  /** PDF generado y guardado en el historial (si se pudo generar). */
  pdf?: FacturaPdfInfo;
}

export interface UltimaFacturaAfip {
  ultimoNumero: number;
}

/**
 * Sesión del Portal de Cliente: la devuelve el backend al hacer login con
 * usuario/contraseña (acción `loginCliente` en Code.gs). El `token` viaja en
 * cada request posterior; el backend lo resuelve de nuevo a `cuit` cada vez,
 * nunca confía en un CUIT mandado desde el cliente.
 */
export interface PortalSession {
  token: string;
  cliente: string;
  cuit: string;
}

/**
 * Fila de facturación tal como la ve el cliente en su portal (viene de la hoja
 * "Fc-Monit." filtrada por su propio CUIT). Las columnas dependen de los
 * encabezados reales de esa hoja, por eso queda tipada como registro abierto
 * en vez de una interfaz fija.
 */
export type PortalFacturaRow = Record<string, string | number | undefined>;

/** Datos para darle a un cliente su usuario/contraseña de acceso al portal. */
export interface CrearColaboradorInput {
  cliente: string;
  cuit: string;
  usuario: string;
  password: string;
}

export interface CrearColaboradorResult {
  id: string;
  cliente: string;
  cuit: string;
  usuario: string;
}

/**
 * Sesión del equipo interno del estudio: la devuelve el backend al hacer
 * login con usuario/contraseña (acción `loginAdmin` en Code.gs). Reemplaza
 * al PIN compartido de PinGate por un login real por persona.
 */
export interface AdminSession {
  token: string;
  usuario: string;
}

/** PDF generado para una factura emitida (lo devuelve el backend al facturar). */
export interface FacturaPdfInfo {
  id: string;
  url: string;
  fileName: string;
  error?: string;
}

/** Contenido del PDF en base64, para descargar o compartir el archivo. */
export interface FacturaPdfArchivo {
  fileName: string;
  url: string;
  base64: string;
}

/** Datos opcionales que sólo se usan para armar el PDF (no viajan a ARCA). */
export interface FacturaExtra {
  receptorNombre?: string;
  descripcion?: string;
}

/** Fila de la hoja "FacturasEmitidas" (historial). */
export interface FacturaEmitida {
  id: string;
  fecha: string;
  cuitEmisor: string | number;
  emisor: string;
  cbteTipo: number;
  ptoVta: number;
  numero: number;
  docTipo: number;
  docNro: string | number;
  receptor: string;
  importe: number;
  cae: string | number;
  caeVencimiento: string | number;
  pdfUrl: string;
  origen: string;
  creado: string;
}

/** Resumen de facturación para el portal del cliente (acción clienteResumen). */
export interface PortalResumen {
  /** Categorías fiscales, p.ej. "Monotributista" o "Responsable Inscripto, Autónomo". */
  categorias: string;
  /** Fila del monitoreo (hoja Fc-Monit.), si el cliente está cargado ahí. */
  monitoreo: {
    categoria: string;
    topeCategoria: number;
    aviso: string;
    acumulado: number;
    categoriaSugerida: string;
    topeSugerido: number;
    puntoVenta: string;
    /** mes en formato "YYYY-MM". */
    meses: { mes: string; monto: number }[];
  } | null;
  /** Facturas emitidas desde el sistema, por mes y origen ("portal" o "estudio"). */
  sistema: { mes: string; origen: string; importe: number }[];
  recategorizacion: { estado: string; accion: string; catActual: string; catNueva: string; observaciones: string } | null;
  /** fecha en formato "YYYY-MM-DD". */
  vencimientos: { impuesto: string; fecha: string; estado: string }[];
}
