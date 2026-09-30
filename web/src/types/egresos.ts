/** Movimiento de egreso de un cliente (hoja Egresos). */
export interface Egreso {
  clave: string;
  fecha: string; // yyyy-MM-dd
  descripcion: string;
  categoria: string;
  importe: number; // positivo = gasto (las notas de crédito recibidas van en negativo)
  origen: string; // 'Mercado Pago' | 'Banco ...' | 'Manual' | 'ARCA recibidos'
  referencia: string;
  esGasto: boolean;
}

export interface EgresoInput {
  clave?: string;
  fecha: string;
  descripcion: string;
  categoria: string;
  importe: number;
  origen: string;
  referencia?: string;
  esGasto: boolean;
}

export interface BalanceCliente {
  anio: string;
  meses: { mes: string; ingresos: number; egresos: number; compras: number }[];
  porCategoria: { categoria: string; total: number }[];
  movimientos: Egreso[];
}
