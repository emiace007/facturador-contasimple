export interface MonitoreoArca {
  acumulado: number;
  categoriaSugerida: string;
  topeSugerido: number | string;
  ventana: string;
  meses: { mes: string; monto: number }[];
  filaCreada: boolean;
  categoria: string;
  topeCategoria: number;
  aviso: string;
  /** Responsable Inscripto: se guarda para control, sin topes de Monotributo. */
  esRI?: boolean;
}

export interface ResultadoImportacion {
  nuevos: number;
  duplicados: number;
  invalidos: number;
  monitoreo: MonitoreoArca;
}

export interface EstadoImportacion {
  cuit: string;
  comprobantes: number;
  ultimoComprobante: string;
  ultimaImportacion: string;
}

export interface FacturacionRI {
  cuit: string;
  cliente: string;
  condicion: string;
  fuente: 'ARCA' | 'Sistema' | '';
  totalAnio: number;
  meses: { mes: string; arca: number; sistema: number }[];
}

/** Comprobante importado de Mis Comprobantes (hoja ComprobantesARCA). `total` ya viene con signo (NC en negativo). */
export interface ComprobanteGuardado {
  clave: string;
  cuit: string;
  cliente: string;
  fecha: string;
  tipo: number;
  tipoNombre: string;
  ptoVta: number;
  numero: number;
  docReceptor: string;
  receptor: string;
  total: number;
}
