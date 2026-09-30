import { Search, X } from 'lucide-react';
import type { CategoriaTarea } from '../../types';

export interface TareasFiltersState {
  texto: string;
  responsable: string; // '' = todos
  categoria: CategoriaTarea | 'Todos';
}

export const DEFAULT_TAREAS_FILTERS: TareasFiltersState = {
  texto: '',
  responsable: '',
  categoria: 'Todos',
};

interface TareasFiltersProps {
  value: TareasFiltersState;
  onChange: (next: TareasFiltersState) => void;
  responsables: string[];
}

const CATEGORIAS: (CategoriaTarea | 'Todos')[] = ['Todos', 'Balance', 'DDJJ', 'Sueldos', 'Otro'];

export function TareasFilters({ value, onChange, responsables }: TareasFiltersProps) {
  function set<K extends keyof TareasFiltersState>(key: K, val: TareasFiltersState[K]) {
    onChange({ ...value, [key]: val });
  }

  const hasActiveFilters = value.texto || value.responsable || value.categoria !== 'Todos';

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Cliente u obligación</label>
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 w-56">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={value.texto}
            onChange={(e) => set('texto', e.target.value)}
            placeholder="Buscar..."
            className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Responsable</label>
        <select
          value={value.responsable}
          onChange={(e) => set('responsable', e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white min-w-[10rem]"
        >
          <option value="">Todos</option>
          {responsables.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Categoría</label>
        <select
          value={value.categoria}
          onChange={(e) => set('categoria', e.target.value as TareasFiltersState['categoria'])}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
        >
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          onClick={() => onChange(DEFAULT_TAREAS_FILTERS)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 pb-2 ml-auto"
        >
          <X size={14} />
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
