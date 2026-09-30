import type { EstadoVencimiento, TipoImpuesto } from '../../types';

export interface VencimientosFiltersState {
  cuit: string;
  tipo: TipoImpuesto | 'Todos';
  estado: EstadoVencimiento | 'Todos';
  desde: string; // ISO date or ''
  hasta: string; // ISO date or ''
  soloAlertas: boolean; // solo vencidos o próximos a vencer
  ocultarPresentados: boolean; // saca del calendario y la lista lo ya presentado
}

export const DEFAULT_FILTERS: VencimientosFiltersState = {
  cuit: '',
  tipo: 'Todos',
  estado: 'Todos',
  desde: '',
  hasta: '',
  soloAlertas: false,
  ocultarPresentados: true,
};
