import { useDroppable } from '@dnd-kit/core';
import clsx from 'clsx';
import type { EstadoTarea, Tarea } from '../../types';
import { TareaCard } from './TareaCard';

interface KanbanColumnProps {
  estado: EstadoTarea;
  label: string;
  tareas: Tarea[];
  accentClassName: string;
  onEstadoChange?: (id: string, estado: EstadoTarea) => void;
}

export function KanbanColumn({ estado, label, tareas, accentClassName, onEstadoChange }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });

  return (
    <div className="flex flex-col w-full min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={clsx('h-2 w-2 rounded-full', accentClassName)} />
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <span className="text-xs text-slate-400 ml-auto">{tareas.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={clsx(
          'flex-1 rounded-xl border-2 border-dashed p-2 space-y-2 min-h-[120px] transition-colors',
          isOver ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200 bg-slate-50/60'
        )}
      >
        {tareas.map((t) => (
          <TareaCard key={t.id} tarea={t} onEstadoChange={onEstadoChange} />
        ))}
        {tareas.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">Sin tareas</p>
        )}
      </div>
    </div>
  );
}
