import { Search, X } from 'lucide-react';
import type { EstadoVencimiento, TipoImpuesto } from '../../types';
import { DEFAULT_FILTERS, type VencimientosFiltersState } from './types';

interface VencimientosFiltersProps {
  value: VencimientosFiltersState;
  onChange: (next: VencimientosFiltersState) => void;
}

const TIPOS: (TipoImpuesto | 'Todos')[] = ['Todos', 'AFIP', 'Ingresos Brutos', 'Municipal', 'Otro'];
const ESTADOS: (EstadoVencimiento | 'Todos')[] = ['Todos', 'Pendiente', 'En Proceso', 'Presentado'];

export function VencimientosFilters({ value, onChange }: VencimientosFiltersProps) {
  function set<K extends keyof VencimientosFiltersState>(key: K, val: VencimientosFiltersState[K]) {
    onChange({ ...value, [key]: val });
  }

  const hasActiveFilters =
    value.cuit || value.tipo !== 'Todos' || value.estado !== 'Todos' || value.desde || value.hasta || value.soloAlertas || !value.ocultarPresentados;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">CUIT o cliente</label>
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 w-56">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={value.cuit}
            onChange={(e) => set('cuit', e.target.value)}
            placeholder="Buscar..."
            className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Tipo de impuesto</label>
        <select
          value={value.tipo}
          onChange={(e) => set('tipo', e.target.value as VencimientosFiltersState['tipo'])}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Estado</label>
        <select
          value={value.estado}
          onChange={(e) => set('estado', e.target.value as VencimientosFiltersState['estado'])}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Desde</label>
        <input
          type="date"
          value={value.desde}
          onChange={(e) => set('desde', e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Hasta</label>
        <input
          type="date"
          value={value.hasta}
          onChange={(e) => set('hasta', e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
        />
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.soloAlertas}
          onChange={(e) => set('soloAlertas', e.target.checked)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        Solo vencidos / próximos
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600 pb-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.ocultarPresentados}
          onChange={(e) => set('ocultarPresentados', e.target.checked)}
          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        Ocultar presentados
      </label>

      {hasActiveFilters && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 pb-2 ml-auto"
        >
          <X size={14} />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
