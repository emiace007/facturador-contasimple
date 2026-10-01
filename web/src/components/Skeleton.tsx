import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200', className)} />;
}

/** Placeholder de una tabla mientras carga: header + N filas. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex gap-6">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex items-center gap-6">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={clsx('h-3', c === 0 ? 'w-28' : 'w-14')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder de tarjetas estilo Kanban, agrupadas en columnas. */
export function KanbanSkeleton({ columns = 4, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="space-y-2">
          <Skeleton className="h-4 w-24 mb-3" />
          {Array.from({ length: cardsPerColumn }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder de tarjetas de estadística del Dashboard. */
export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex items-center gap-4">
      <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

/** Placeholder de grilla de tarjetas de clientes. */
export function ClientesGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
