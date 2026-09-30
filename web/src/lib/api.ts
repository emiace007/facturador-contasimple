import type {
  AdminSession,
  ApiResponse,
  Cliente,
  CrearColaboradorInput,
  CrearColaboradorResult,
  FacturacionCliente,
  FacturaAfipInput,
  FacturaAfipResult,
  FacturaEmitida,
  FacturaExtra,
  FacturaPdfArchivo,
  Ganancia,
  PortalFacturaRow,
  PortalResumen,
  PortalSession,
  QuickLink,
  Recategorizacion,
  Sociedad,
  Sueldo,
  Tarea,
  UltimaFacturaAfip,
  Vencimiento,
} from '../types';
import { clearAdminSession, getAdminSession } from './adminSession';
import type { ComprobanteGuardado, EstadoImportacion, FacturacionRI, ResultadoImportacion } from '../types/comprobantes';
import type { ComprobanteArca } from './misComprobantes';
import type {
  AbonoInput,
  ConfigHonorarios,
  HonorariosPortal,
  MovimientoInput,
  ResultadoGenerarCargos,
  ResumenHonorarios,
} from '../types/honorarios';
import type { BalanceCliente, EgresoInput } from '../types/egresos';

/** Datos de una persona según la constancia de inscripción de ARCA (padrón A5). */
export interface PersonaPadron {
  cuit: string;
  tipoPersona: string;
  denominacion: string;
  apellido: string;
  nombre: string;
  razonSocial: string;
  estadoClave: string;
  domicilio: { direccion: string; localidad: string; codigoPostal: string; provincia: string };
  condicionIva: string;
  condicionIvaId: number;
  categoriaMonotributo: string;
  impuestos: { id: number; descripcion: string }[];
  actividadPrincipal: string;
  observaciones: string[];
}

const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined;
const API_KEY = import.meta.env.VITE_APPS_SCRIPT_API_KEY as string | undefined;

/**
 * Cliente HTTP hacia el Web App de Google Apps Script.
 *
 * Detalles no obvios:
 * - Las lecturas van por GET con querystring (no dispara CORS preflight).
 * - Las escrituras van por POST con Content-Type "text/plain;charset=utf-8"
 *   en vez de "application/json": así el navegador lo trata como solicitud
 *   simple y evita el preflight OPTIONS, que Apps Script no sabe responder.
 *   El body sigue siendo JSON válido; Apps Script lo parsea igual en doPost.
 */
/** Token de la sesión del equipo interno (vacío en el portal de clientes). */
function adminToken(): string {
  return getAdminSession()?.token ?? '';
}

async function request<T>(
  action: string,
  options?: { method?: 'GET' | 'POST'; body?: Record<string, unknown>; params?: Record<string, string> }
): Promise<T> {
  if (!BASE_URL) {
    throw new Error(
      'Falta VITE_APPS_SCRIPT_URL. Configurá frontend/.env a partir de .env.example.'
    );
  }

  const method = options?.method ?? 'GET';
  let url = BASE_URL;
  let init: RequestInit;

  if (method === 'GET') {
    const params = new URLSearchParams({
      action,
      apiKey: API_KEY ?? '',
      adminToken: adminToken(),
      ...(options?.params ?? {}),
    });
    url = `${BASE_URL}?${params.toString()}`;
    init = { method: 'GET' };
  } else {
    init = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ adminToken: adminToken(), ...options?.body, apiKey: API_KEY ?? '' }),
    };
  }

  const res = await fetch(url, init);
  const json = (await res.json()) as ApiResponse<T>;

  if (!json.ok) {
    // Sesión de administrador vencida o inválida: se limpia y se vuelve al login.
    if (json.error === 'No autorizado' && getAdminSession() && !window.location.pathname.startsWith('/portal')) {
      clearAdminSession();
      window.location.reload();
    }
    throw new Error(json.error ?? 'Error desconocido en la API');
  }
  return json.data as T;
}

export const api = {
  getVencimientos: () => request<Vencimiento[]>('vencimientos'),
  getTareas: () => request<Tarea[]>('tareas'),
  getQuickLinks: () => request<QuickLink[]>('accesos'),
  getClientes: () => request<Cliente[]>('clientes'),
  getFacturacion: () => request<FacturacionCliente[]>('facturacion'),
  getSociedades: () => request<Sociedad[]>('sociedades'),
  getGanancias: () => request<Ganancia[]>('ganancias'),
  getSueldos: () => request<Sueldo[]>('sueldos'),
  getRecategorizaciones: () => request<Recategorizacion[]>('recategorizaciones'),

  createCliente: (payload: {
    cliente: string;
    cuit: string;
    encargado: string;
    condicionFiscal: string;
    actMensual: string;
    observaciones: string;
  }) =>
    request<Cliente>('', {
      method: 'POST',
      body: { action: 'create', entity: 'cliente', payload },
    }),

  createVencimiento: (payload: Omit<Vencimiento, 'id'>) =>
    request<Vencimiento>('', {
      method: 'POST',
      body: { action: 'create', entity: 'vencimiento', payload },
    }),

  updateVencimiento: (id: string, payload: Partial<Vencimiento>) =>
    request<Vencimiento>('', {
      method: 'POST',
      body: { action: 'update', entity: 'vencimiento', id, payload },
    }),

  updateTareaEstado: (id: string, estado: Tarea['estado']) =>
    request<Tarea>('', {
      method: 'POST',
      body: { action: 'update', entity: 'tarea', id, payload: { estado } },
    }),

  createTarea: (payload: Omit<Tarea, 'id'>) =>
    request<Tarea>('', {
      method: 'POST',
      body: { action: 'create', entity: 'tarea', payload },
    }),

  updateTarea: (id: string, payload: Partial<Tarea>) =>
    request<Tarea>('', {
      method: 'POST',
      body: { action: 'update', entity: 'tarea', id, payload },
    }),

  /** Último número de comprobante autorizado en ARCA (para saber qué número sigue). */
  consultarUltimaFacturaAfip: (cuit: string, ptoVta: number, cbteTipo = 6) =>
    request<UltimaFacturaAfip>('facturaUltima', {
      method: 'GET',
      params: { cuit, ptoVta: String(ptoVta), cbteTipo: String(cbteTipo) },
    }),

  /** Pide el CAE (emite la factura real) contra ARCA/WSFE, vía el backend AFIP. */
  emitirFacturaAfip: (payload: FacturaAfipInput, extra?: FacturaExtra) =>
    request<FacturaAfipResult>('', {
      method: 'POST',
      body: { action: 'facturar', payload, extra: extra ?? {} },
    }),

  // --- Portal de Cliente ---
  // Estas acciones NO usan la apiKey de administrador: se autentican con
  // usuario/contraseña propios (loginPortal) o con el token de sesión que
  // devuelve ese login (los demás). Ver Code.gs: loginCliente/clienteFacturar.

  /** Login del cliente en su propio portal. Devuelve el token de sesión. */
  loginPortal: (usuario: string, password: string) =>
    request<PortalSession>('', {
      method: 'POST',
      body: { action: 'loginCliente', usuario, password },
    }),

  /** Facturación propia del cliente logueado (filtrada por su CUIT en el backend). */
  getMisFacturasPortal: (token: string) =>
    request<PortalFacturaRow[]>('clienteMisFacturas', {
      method: 'GET',
      params: { token },
    }),

  /**
   * El cliente emite su propia factura real contra ARCA. No manda
   * `cuitRepresentada`: el backend lo fuerza siempre al CUIT de su sesión.
   */
  facturarPortal: (token: string, payload: Omit<FacturaAfipInput, 'cuitRepresentada'>, extra?: FacturaExtra) =>
    request<FacturaAfipResult>('', {
      method: 'POST',
      body: { action: 'clienteFacturar', token, payload, extra: extra ?? {} },
    }),

  /**
   * Condición fiscal del cliente logueado en el portal y los tipos de factura
   * que puede emitir (Monotributo: sólo C; Responsable Inscripto / SAS: A o B).
   */
  getPerfilPortal: (token: string) =>
    request<{ categoriasFiscales: string; tiposPermitidos: number[] }>('', {
      method: 'POST',
      body: { action: 'perfilPortal', token },
    }),

  /** Historial de facturas emitidas (panel del estudio). */
  getFacturasEmitidas: (cuit?: string) =>
    request<FacturaEmitida[]>('', {
      method: 'POST',
      body: { action: 'facturasEmitidas', adminToken: getAdminSession()?.token ?? '', cuit: cuit ?? '' },
    }),

  /** PDF (base64 + link) de una factura del historial, desde el panel del estudio. */
  getFacturaPdf: (id: string) =>
    request<FacturaPdfArchivo>('', {
      method: 'POST',
      body: { action: 'facturaPdf', adminToken: getAdminSession()?.token ?? '', id },
    }),

  /** Resumen gráfico del portal: monitoreo, facturas emitidas, recategorización y vencimientos. */
  getResumenPortal: (token: string) =>
    request<PortalResumen>('', {
      method: 'POST',
      body: { action: 'clienteResumen', token },
    }),

  /** Facturas emitidas por el cliente logueado en el portal. */
  getMisFacturasEmitidas: (token: string) =>
    request<FacturaEmitida[]>('', {
      method: 'POST',
      body: { action: 'clienteFacturasEmitidas', token },
    }),

  /** PDF de una factura propia, desde el portal. */
  getMiFacturaPdf: (token: string, id: string) =>
    request<FacturaPdfArchivo>('', {
      method: 'POST',
      body: { action: 'clienteFacturaPdf', token, id },
    }),

  /** El cliente cambia su propia contraseña del portal. */
  cambiarPasswordCliente: (token: string, passwordActual: string, passwordNueva: string) =>
    request<void>('', {
      method: 'POST',
      body: { action: 'cambiarPasswordCliente', token, passwordActual, passwordNueva },
    }),

  /** Consulta el padrón de ARCA (constancia de inscripción) por CUIT. Solo equipo del estudio. */
  consultarPadron: (cuit: string) =>
    request<PersonaPadron>('', {
      method: 'POST',
      body: { action: 'padron', cuit: cuit.replace(/\D/g, '') },
    }),

  /** Uso interno (con apiKey de administrador): crea/reemplaza el acceso al portal de un cliente. */
  crearColaborador: (payload: CrearColaboradorInput) =>
    request<CrearColaboradorResult>('', {
      method: 'POST',
      body: { action: 'crearColaborador', payload },
    }),

  // --- Login de administrador (equipo interno del estudio) ---
  // Reemplaza al PIN compartido de PinGate: cada persona tiene su propio
  // usuario/contraseña. Ver loginAdmin/cambiarPasswordAdmin en Code.gs.

  /** Login del equipo interno. Devuelve el token de sesión de administrador. */
  loginAdmin: (usuario: string, password: string) =>
    request<AdminSession>('', {
      method: 'POST',
      body: { action: 'loginAdmin', usuario, password },
    }),

  /** El administrador logueado cambia su propia contraseña. */
  cambiarPasswordAdmin: (token: string, passwordActual: string, passwordNueva: string) =>
    request<void>('', {
      method: 'POST',
      body: { action: 'cambiarPasswordAdmin', token, passwordActual, passwordNueva },
    }),
  // --- Honorarios del estudio (abonos, cuenta corriente y cobranza) ---
  getHonorarios: () => request<ResumenHonorarios>('', { method: 'POST', body: { action: 'honorarios' } }),
  guardarAbono: (payload: AbonoInput) => request<ResumenHonorarios>('', { method: 'POST', body: { action: 'guardarAbono', payload } }),
  registrarMovimiento: (payload: MovimientoInput) =>
    request<ResumenHonorarios>('', { method: 'POST', body: { action: 'registrarMovimiento', payload } }),
  eliminarMovimiento: (id: string) => request<ResumenHonorarios>('', { method: 'POST', body: { action: 'eliminarMovimiento', id } }),
  generarCargos: (periodo: string, facturar: boolean) =>
    request<ResultadoGenerarCargos>('', { method: 'POST', body: { action: 'generarCargos', periodo, facturar } }),
  facturarCargo: (id: string) =>
    request<{ numero: string; cae: string; resumen: ResumenHonorarios }>('', { method: 'POST', body: { action: 'facturarCargo', id } }),
  ajustarAbonos: (porcentaje: number) =>
    request<{ cambios: { cliente: string; antes: number; ahora: number }[]; resumen: ResumenHonorarios }>('', {
      method: 'POST',
      body: { action: 'ajustarAbonos', porcentaje },
    }),
  guardarConfigHonorarios: (config: ConfigHonorarios) =>
    request<ResumenHonorarios>('', { method: 'POST', body: { action: 'guardarConfigHonorarios', config } }),
  /** Portal: saldo de honorarios del cliente logueado y datos para pagar. */
  getHonorariosPortal: (token: string) =>
    request<HonorariosPortal>('', { method: 'POST', body: { action: 'clienteHonorarios', token } }),
  // --- Mis Comprobantes (ARCA): importación y monitoreo automático ---
  importarComprobantes: (cuit: string, comprobantes: ComprobanteArca[]) =>
    request<ResultadoImportacion>('', { method: 'POST', body: { action: 'importarComprobantes', cuit, comprobantes } }),
  getEstadoImportaciones: () => request<EstadoImportacion[]>('', { method: 'POST', body: { action: 'estadoImportaciones' } }),
  // --- Vencimientos automáticos por terminación de CUIT ---
  generarVencimientos: (meses: number) =>
    request<{ generados: number; clientes: number; avisos: string[]; detalle: { cliente: string; impuesto: string; fecha: string }[] }>('', {
      method: 'POST',
      body: { action: 'generarVencimientos', meses },
    }),
  // --- Control de Responsables Inscriptos y archivo de completados ---
  getFacturacionRI: () => request<FacturacionRI[]>('', { method: 'POST', body: { action: 'facturacionRI' } }),
  archivarTareasCompletadas: () => request<{ archivadas: number }>('', { method: 'POST', body: { action: 'archivarTareasCompletadas' } }),
  archivarVencimientosPresentados: () =>
    request<{ archivados: number }>('', { method: 'POST', body: { action: 'archivarVencimientosPresentados' } }),
  /** Comprobantes importados de Mis Comprobantes (para sumarlos en Facturas emitidas). */
  getComprobantesArca: () => request<ComprobanteGuardado[]>('', { method: 'POST', body: { action: 'comprobantesArca' } }),
  // --- Ingresos y egresos por cliente ---
  getBalance: (cuit: string, anio: string) => request<BalanceCliente>('', { method: 'POST', body: { action: 'balanceCliente', cuit, anio } }),
  importarEgresos: (cuit: string, movimientos: EgresoInput[]) =>
    request<{ nuevos: number; duplicados: number }>('', { method: 'POST', body: { action: 'importarEgresos', cuit, movimientos } }),
  actualizarEgreso: (clave: string, cambios: { categoria?: string; esGasto?: boolean }) =>
    request<{ ok: boolean }>('', { method: 'POST', body: { action: 'actualizarEgreso', clave, cambios } }),
  eliminarEgresos: (claves: string[]) => request<{ eliminados: number }>('', { method: 'POST', body: { action: 'eliminarEgresos', claves } }),
};
