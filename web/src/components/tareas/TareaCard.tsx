import { useDraggable } from '@dnd-kit/core';
import { CalendarDays, User } from 'lucide-react';
import clsx from 'clsx';
import type { EstadoTarea, Tarea } from '../../types';
import { daysUntil, formatFechaCorta } from '../../lib/dates';

interface TareaCardProps {
  tarea: Tarea;
  /** Si se pasa, muestra un selector de estado (útil en celular, donde arrastrar es incómodo). */
  onEstadoChange?: (id: string, estado: EstadoTarea) => void;
}

const ESTADOS: EstadoTarea[] = ['Por Hacer', 'En Proceso', 'Revisión', 'Completado'];

const CATEGORIA_COLORS: Record<string, string> = {
  Balance: 'bg-indigo-50 text-indigo-700',
  DDJJ: 'bg-fuchsia-50 text-fuchsia-700',
  Sueldos: 'bg-teal-50 text-teal-700',
  Otro: 'bg-slate-100 text-slate-600',
};

export function TareaCard({ tarea, onEstadoChange }: TareaCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarea.id,
  });

  const style = transform
    ? { transform: 'translate3d(' + transform.x + 'px, ' + transform.y + 'px, 0)' }
    : undefined;

  const dias = tarea.fechaLimite ? daysUntil(tarea.fechaLimite) : null;
  const vencida = dias !== null && dias < 0 && tarea.estado !== 'Completado';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={clsx(
        'bg-white rounded-xl border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow select-none',
        isDragging ? 'opacity-40 border-brand-300 z-50' : 'border-slate-200'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-slate-800 leading-snug">{tarea.cliente}</p>
        <span
          className={clsx(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
            CATEGORIA_COLORS[tarea.categoria] ?? CATEGORIA_COLORS.Otro
          )}
        >
          {tarea.categoria}
        </span>
      </div>

      <p className="text-xs text-slate-500 mb-2.5">{tarea.obligacion}</p>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <User size={12} />
          {tarea.responsable || 'Sin asignar'}
        </span>
        {tarea.fechaLimite && (
          <span className={clsx('flex items-center gap-1', vencida && 'text-red-600 font-medium')}>
            <CalendarDays size={12} />
            {formatFechaCorta(tarea.fechaLimite)}
          </span>
        )}
      </div>

      {onEstadoChange && (
        <select
          value={tarea.estado}
          onChange={(e) => onEstadoChange(tarea.id, e.target.value as EstadoTarea)}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-brand-400"
          aria-label="Cambiar estado"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
