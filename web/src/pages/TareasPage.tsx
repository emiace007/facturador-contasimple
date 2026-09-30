import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Archive, KanbanSquare, Plus, Users } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import type { EstadoTarea, Tarea } from '../types';
import { KanbanColumn } from '../components/tareas/KanbanColumn';
import { TareaCard } from '../components/tareas/TareaCard';
import { TareasPorCliente } from '../components/tareas/TareasPorCliente';
import { NuevaTareaModal } from '../components/tareas/NuevaTareaModal';
import { TareasFilters, DEFAULT_TAREAS_FILTERS, type TareasFiltersState } from '../components/tareas/TareasFilters';
import { KanbanSkeleton } from '../components/ui/Skeleton';

type Vista = 'tablero' | 'cliente';

const COLUMNAS: { estado: EstadoTarea; label: string; accent: string }[] = [
  { estado: 'Por Hacer', label: 'Por Hacer', accent: 'bg-slate-400' },
  { estado: 'En Proceso', label: 'En Proceso', accent: 'bg-blue-500' },
  { estado: 'Revisión', label: 'Revisión', accent: 'bg-amber-500' },
  { estado: 'Completado', label: 'Completado', accent: 'bg-emerald-500' },
];

export default function TareasPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TareasFiltersState>(DEFAULT_TAREAS_FILTERS);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('tablero');

  // Mouse: arrastra al mover 6px. Touch: mantener apretado ~0,25 s para arrastrar,
  // así el dedo puede seguir scrolleando la página normalmente.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tareas'],
    queryFn: api.getTareas,
  });

  const updateEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoTarea }) => api.updateTareaEstado(id, estado),
    onMutate: async ({ id, estado }) => {
      await queryClient.cancelQueries({ queryKey: ['tareas'] });
      const previous = queryClient.getQueryData<Tarea[]>(['tareas']);
      queryClient.setQueryData<Tarea[]>(['tareas'], (old) =>
        old?.map((t) => (t.id === id ? { ...t, estado } : t))
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['tareas'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tareas'] }),
  });

  const createTarea = useMutation({
    mutationFn: (payload: Omit<Tarea, 'id'>) => api.createTarea(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      setModalOpen(false);
    },
  });

  const tareas = data ?? [];
  const completadas = tareas.filter((t) => t.estado === 'Completado').length;
  const archivar = useMutation({
    mutationFn: api.archivarTareasCompletadas,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tareas'] }),
  });

  const responsables = useMemo(
    () => [...new Set(tareas.map((t) => t.responsable).filter(Boolean))].sort(),
    [tareas]
  );

  const filtradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filters.texto) {
        const term = filters.texto.toLowerCase();
        const match = t.cliente?.toLowerCase().includes(term) || t.obligacion?.toLowerCase().includes(term);
        if (!match) return false;
      }
      if (filters.responsable && t.responsable !== filters.responsable) return false;
      if (filters.categoria !== 'Todos' && t.categoria !== filters.categoria) return false;
      return true;
    });
  }, [tareas, filters]);

  const activeTarea = tareas.find((t) => t.id === activeId);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const tareaId = String(active.id);
    const nuevoEstado = over.id as EstadoTarea;
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || tarea.estado === nuevoEstado) return;
    updateEstado.mutate({ id: tareaId, estado: nuevoEstado });
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-sm text-slate-500">
          {vista === 'tablero'
            ? 'Arrastrá las tarjetas o elegí el estado en cada una.'
            : 'Tareas agrupadas por cliente, con su estado actual.'}
        </h2>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setVista('tablero')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                vista === 'tablero' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              <KanbanSquare size={15} />
              Tablero
            </button>
            <button
              onClick={() => setVista('cliente')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                vista === 'cliente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'
              )}
            >
              <Users size={15} />
              Por cliente
            </button>
          </div>

          {completadas > 0 && (
          <button
            onClick={() => {
              if (window.confirm('¿Limpiar las ' + completadas + ' tareas completadas? Se mueven a la hoja Tareas Archivo y dejan de verse en el tablero.')) archivar.mutate();
            }}
            disabled={archivar.isPending}
            className="flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            title="Limpiar completadas"
          >
            <Archive size={15} />
            <span className="hidden sm:inline">Limpiar completadas ({completadas})</span>
            <span className="sm:hidden">{completadas}</span>
          </button>
        )}


          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl transition-colors"
          >
            <Plus size={16} />
            Nueva tarea
          </button>
        </div>
      </div>

      <TareasFilters value={filters} onChange={setFilters} responsables={responsables} />

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudieron cargar las tareas: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <KanbanSkeleton />
      ) : vista === 'tablero' ? (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
            {COLUMNAS.map((col) => (
              <KanbanColumn
                key={col.estado}
                estado={col.estado}
                label={col.label}
                accentClassName={col.accent}
                tareas={filtradas.filter((t) => t.estado === col.estado)}
                onEstadoChange={(id, estado) => updateEstado.mutate({ id, estado })}
              />
            ))}
          </div>

          <DragOverlay>{activeTarea ? <TareaCard tarea={activeTarea} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <TareasPorCliente tareas={filtradas} />
      )}

      <NuevaTareaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        submitting={createTarea.isPending}
        onSubmit={(payload) => createTarea.mutate(payload)}
      />
    </div>
  );
}
