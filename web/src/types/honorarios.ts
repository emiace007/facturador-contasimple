/** Honorarios del estudio: abono mensual por cliente y cuenta corriente (ver Honorarios en Code.gs). */

export interface AbonoHonorario {
  fila: number;
  cuit: string;
  cliente: string;
  monto: number;
  diaVencimiento: number;
  activo: boolean;
  telefono: string;
  email: string;
  observaciones: string;
  actualizado: string;
  /** Positivo = el cliente debe; negativo = saldo a favor. */
  saldo: number;
  ultimoPago: string;
}

export type TipoMovimiento = 'cargo' | 'pago';
export type MedioPago = 'transferencia' | 'mercadopago' | 'efectivo' | '';

export interface MovimientoCuenta {
  id: string;
  fecha: string; // yyyy-MM-dd
  cuit: string;
  cliente: string;
  tipo: TipoMovimiento;
  concepto: string;
  periodo: string; // yyyy-MM
  importe: number;
  medio: MedioPago | string;
  facturaId: string;
  facturaNumero: string;
  cae: string;
  registradoPor: string;
}

export interface ConfigHonorarios {
  alias: string;
  cbu: string;
  titular: string;
  mpLink: string;
  ptoVta: number;
  cuitEmisor: string;
}

export interface ResumenHonorarios {
  clientes: AbonoHonorario[];
  movimientos: MovimientoCuenta[];
  config: ConfigHonorarios;
}

export interface AbonoInput {
  cuit: string;
  cliente: string;
  monto: number;
  diaVencimiento: number;
  activo: boolean;
  telefono: string;
  email: string;
  observaciones: string;
}

export interface MovimientoInput {
  cuit: string;
  cliente: string;
  tipo: TipoMovimiento;
  concepto: string;
  periodo: string;
  importe: number;
  medio: MedioPago;
  fecha: string;
}

export interface ResultadoGenerarCargos {
  periodo: string;
  resultado: { cuit: string; cliente: string; estado: string; importe?: number; factura?: string; errorFactura?: string }[];
  resumen: ResumenHonorarios;
}

export interface HonorariosPortal {
  saldo: number;
  abono: { monto: number; diaVencimiento: number; activo: boolean } | null;
  movimientos: MovimientoCuenta[];
  pago: { alias: string; cbu: string; titular: string; mpLink: string };
}
