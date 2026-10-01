// Cliente del backend (Node). Todas las llamadas llevan el token de sesión.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:3000';

export interface Sesion {
  token: string;
  rol: 'staff' | 'dueno' | 'empleado';
  comercioId: string | null;
  email?: string;
}
export interface Comercio {
  id: string;
  razon_social: string;
  cuit: string;
  condicion_fiscal: 'monotributo' | 'responsable_inscripto';
  punto_venta: number | null;
  delegacion_estado?: string;
  activo?: boolean;
}
export interface Producto {
  id: string;
  nombre: string;
  precio: string;
  alicuota_iva: string;
  es_servicio: boolean;
}
export interface Factura {
  id: string;
  cbte_tipo: number;
  punto_venta: number;
  numero: string | null;
  fecha_comprobante: string;
  doc_tipo: number;
  doc_nro: string;
  receptor_nombre: string | null;
  importe_total: string;
  estado: 'pendiente' | 'emitida' | 'error';
  cae: string | null;
  error: string | null;
  lote_id: string | null;
}
export interface DatosFactura {
  cbteTipo?: number;
  ptoVta?: number;
  concepto?: number;
  docTipo?: number;
  docNro?: string;
  importe: number;
  alicuotaIva?: number;
  condicionIvaReceptorId?: number;
  receptorNombre?: string;
  fechaComprobante?: string;
  items?: { productoId?: string; descripcion: string; cantidad: number; precioUnitario: number }[];
}

const KEY = 'facturador:sesion';
const KEY_COMERCIO = 'facturador:comercio';

export function getSesion(): Sesion | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Sesion) : null;
  } catch {
    return null;
  }
}
export function setSesion(s: Sesion | null) {
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_COMERCIO);
  }
}
/** Comercio elegido por el estudio (staff). Para el dueño de un comercio no hace falta: lo define su usuario. */
export function getComercioElegido(): string | null {
  return localStorage.getItem(KEY_COMERCIO);
}
export function setComercioElegido(id: string | null) {
  if (id) localStorage.setItem(KEY_COMERCIO, id);
  else localStorage.removeItem(KEY_COMERCIO);
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const s = getSesion();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (s) headers.Authorization = `Bearer ${s.token}`;
  if (s?.rol === 'staff') {
    const c = getComercioElegido();
    if (c) headers['x-comercio-id'] = c;
  }
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Probá de nuevo en un momento.', 0);
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && s && path !== '/api/auth/login') {
    setSesion(null);
    window.location.reload();
  }
  // Una factura rechazada por ARCA devuelve 422 con el registro: se deja pasar para mostrar el motivo.
  if (!res.ok && !(res.status === 422 && json.data)) throw new ApiError(json.error || `Error ${res.status}`, res.status);
  return json as T;
}

export const api = {
  login: async (email: string, password: string) =>
    (await request<{ data: Omit<Sesion, 'email'> }>('POST', '/api/auth/login', { email, password })).data,
  miComercio: async () => (await request<{ data: Comercio }>('GET', '/api/comercio')).data,
  comercios: async () => (await request<{ data: Comercio[] }>('GET', '/api/comercios')).data,
  crearComercio: async (d: Record<string, unknown>) => (await request<{ data: Comercio }>('POST', '/api/comercios', d)).data,
  productos: async () => (await request<{ data: Producto[] }>('GET', '/api/productos')).data,
  crearProducto: async (d: { nombre: string; precio: number; alicuotaIva: number; esServicio: boolean }) =>
    (await request<{ data: Producto }>('POST', '/api/productos', d)).data,
  facturas: async () => (await request<{ data: Factura[] }>('GET', '/api/facturas')).data,
  facturar: async (d: DatosFactura) => (await request<{ data: Factura }>('POST', '/api/facturas', d)).data,
  crearLote: async (archivo: string, facturas: DatosFactura[]) =>
    (await request<{ data: { loteId: string; total: number } }>('POST', '/api/lotes', { archivo, facturas })).data,
  lote: async (id: string) =>
    (await request<{ data: { id: string; total: number; resumen: Record<string, number> } }>('GET', `/api/lotes/${id}`)).data,
};

export const TIPOS: Record<number, string> = { 1: 'Factura A', 6: 'Factura B', 11: 'Factura C' };
export function tiposPermitidos(c?: Pick<Comercio, 'condicion_fiscal'> | null): number[] {
  if (!c) return [];
  return c.condicion_fiscal === 'monotributo' ? [11] : [6, 1];
}
export function numeroFactura(f: Pick<Factura, 'cbte_tipo' | 'punto_venta' | 'numero'>): string {
  const t = TIPOS[f.cbte_tipo] ?? `Tipo ${f.cbte_tipo}`;
  return f.numero ? `${t} ${String(f.punto_venta).padStart(5, '0')}-${String(f.numero).padStart(8, '0')}` : t;
}
