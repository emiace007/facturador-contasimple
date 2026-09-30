import { useMemo } from 'react';
import { CalendarDays, ClipboardList, Inbox, User } from 'lucide-react';
import clsx from 'clsx';
import { groupByCliente } from '../../lib/groupByCliente';
import { formatFechaCorta } from '../../lib/dates';
import type { Tarea } from '../../types';
import { ClienteAccordion } from '../ui/ClienteAccordion';

interface TareasPorClienteProps {
  tareas: Tarea[];
}

const ESTADO_CLASSES: Record<string, string> = {
  'Por Hacer': 'bg-slate-100 text-slate-600',
  'En Proceso': 'bg-blue-50 text-blue-700',
  Revisión: 'bg-amber-50 text-amber-700',
  Completado: 'bg-emerald-50 text-emerald-700',
};

const CATEGORIA_COLORS: Record<string, string> = {
  Balance: 'bg-indigo-50 text-indigo-700',
  DDJJ: 'bg-fuchsia-50 text-fuchsia-700',
  Sueldos: 'bg-teal-50 text-teal-700',
  Otro: 'bg-slate-100 text-slate-600',
};

/** Agrupa las tareas por cliente (no hay CUIT en esta hoja, se agrupa por nombre exacto). */
export function TareasPorCliente({ tareas }: TareasPorClienteProps) {
  const grupos = useMemo(() => groupByCliente(tareas, (t) => t.cliente, () => undefined), [tareas]);

  if (tareas.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <Inbox size={32} className="text-slate-300 mb-3" />
        <p className="text-sm font-medium text-slate-600">No hay tareas que coincidan</p>
        <p className="text-sm text-slate-400 mt-1">Probá ajustar los filtros o cargar datos en la hoja Tareas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {grupos.map((g) => {
        const pendientes = g.items.filter((t) => t.estado !== 'Completado').length;

        return (
          <ClienteAccordion
            key={g.key}
            cliente={g.cliente}
            defaultOpen={grupos.length === 1}
            avatarClasses="bg-brand-500"
            resumen={
              <>
                <span className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium">
                  {g.items.length} {g.items.length === 1 ? 'tarea' : 'tareas'}
                </span>
                {pendientes > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 text-xs font-medium">
                    <ClipboardList size={12} />
                    {pendientes} en curso
                  </span>
                )}
              </>
            }
          >
            <div className="divide-y divide-slate-100">
              {g.items.map((t) => (
                <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-white">
                  <div className="min-w-[200px] flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800">{t.obligacion}</p>
                      <span
                        className={clsx(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
                          CATEGORIA_COLORS[t.categoria] ?? CATEGORIA_COLORS.Otro
                        )}
                      >
                        {t.categoria}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {t.responsable || 'Sin asignar'}
                      </span>
                      {t.fechaLimite && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} />
                          {formatFechaCorta(t.fechaLimite)}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-1 text-xs font-medium shrink-0',
                      ESTADO_CLASSES[t.estado] ?? ESTADO_CLASSES['Por Hacer']
                    )}
                  >
                    {t.estado}
                  </span>
                </div>
              ))}
            </div>
          </ClienteAccordion>
        );
      })}
    </div>
  );
}
