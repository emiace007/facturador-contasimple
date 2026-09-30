import { useSyncExternalStore } from 'react';

/**
 * Cola de Facturación masiva compartida por toda la app (no vive dentro de la página):
 * - si cambiás de sección, la emisión sigue corriendo en segundo plano;
 * - se guarda en el navegador, así que al volver (o recargar) la cola sigue ahí.
 * Si se cierra la pestaña mientras emite, la factura que estaba en curso queda marcada
 * para revisar (puede haberse emitido en ARCA) y el resto queda pendiente.
 */
const KEY = 'estudio-contable:cola-facturacion';

interface LineaBase {
  id: string;
  estado: string;
  error?: string;
}

interface Estado {
  cola: LineaBase[];
  procesando: boolean;
}

function cargar(): Estado {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const cola = (JSON.parse(raw) as LineaBase[]).map((l) =>
        l.estado === 'emitiendo'
          ? { ...l, estado: 'error', error: 'Se interrumpió al cerrar la página. Revisá en Facturas emitidas si salió antes de reintentar.' }
          : l
      );
      return { cola, procesando: false };
    }
  } catch {
    /* sin almacenamiento */
  }
  return { cola: [], procesando: false };
}

let estado: Estado = cargar();
const subs = new Set<() => void>();

function avisar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(estado.cola));
  } catch {
    /* sin almacenamiento */
  }
  subs.forEach((f) => f());
}

export function setColaGlobal<T extends LineaBase>(u: T[] | ((prev: T[]) => T[])) {
  const prev = estado.cola as T[];
  estado = { ...estado, cola: typeof u === 'function' ? (u as (p: T[]) => T[])(prev) : u };
  avisar();
}

function antesDeCerrar(e: BeforeUnloadEvent) {
  e.preventDefault();
  e.returnValue = '';
}

export function setProcesandoGlobal(v: boolean) {
  estado = { ...estado, procesando: v };
  if (v) window.addEventListener('beforeunload', antesDeCerrar);
  else window.removeEventListener('beforeunload', antesDeCerrar);
  avisar();
}

function suscribir(cb: () => void) {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

export function useColaFacturacion<T extends LineaBase>(): { cola: T[]; procesando: boolean } {
  const s = useSyncExternalStore(suscribir, () => estado);
  return { cola: s.cola as T[], procesando: s.procesando };
}

/** Resumen para el aviso global del encabezado: cuántas facturas faltan emitir. */
export function useResumenCola(): { procesando: boolean; restantes: number } {
  const { cola, procesando } = useColaFacturacion<LineaBase>();
  return { procesando, restantes: cola.filter((l) => l.estado === 'pendiente' || l.estado === 'emitiendo').length };
}
