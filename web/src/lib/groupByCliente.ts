import { normalizeCuit } from './clientes';

export interface ClienteGroup<T> {
  key: string;
  cliente: string;
  cuit: string;
  items: T[];
}

/**
 * Agrupa una lista de filas (vencimientos, tareas, etc.) por cliente, usando el CUIT
 * normalizado como clave cuando está disponible y, si no, el nombre del cliente.
 * Los grupos quedan ordenados alfabéticamente por nombre de cliente.
 */
export function groupByCliente<T>(
  items: T[],
  getCliente: (item: T) => string | undefined,
  getCuit: (item: T) => string | undefined
): ClienteGroup<T>[] {
  const map = new Map<string, ClienteGroup<T>>();

  for (const item of items) {
    const clienteRaw = (getCliente(item) ?? '').trim();
    const cliente = clienteRaw || 'Sin nombre';
    const cuitRaw = getCuit(item);
    const cuitNorm = normalizeCuit(cuitRaw);
    const key = cuitNorm || `nombre:${cliente.toLowerCase()}`;

    let group = map.get(key);
    if (!group) {
      group = { key, cliente, cuit: cuitNorm ? String(cuitRaw) : '', items: [] };
      map.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(map.values()).sort((a, b) => a.cliente.localeCompare(b.cliente, 'es'));
}
