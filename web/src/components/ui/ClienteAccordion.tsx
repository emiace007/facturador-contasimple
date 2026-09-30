import { useState, type ReactNode } from 'react';
import { ChevronDown, UserCircle2 } from 'lucide-react';
import clsx from 'clsx';

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}

interface ClienteAccordionProps {
  cliente: string;
  cuit?: string;
  /** Chips/badges de resumen que se muestran a la derecha del header (conteos, alertas, etc.). */
  resumen?: ReactNode;
  avatarClasses?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * Grupo colapsable por cliente, reutilizado en Vencimientos y Tareas para que cada cliente
 * tenga "su propio panel" en vez de mostrar todas las filas de todos los clientes mezcladas.
 */
export function ClienteAccordion({
  cliente,
  cuit,
  resumen,
  avatarClasses = 'bg-brand-500',
  defaultOpen = false,
  children,
}: ClienteAccordionProps) {
  const [abierto, setAbierto] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-hidden">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div
          className={clsx(
            'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white font-semibold text-sm',
            avatarClasses
          )}
        >
          {iniciales(cliente) || <UserCircle2 size={18} />}
        </div>

        <div className="min-w-[160px] flex-1">
          <p className="font-medium text-slate-800 truncate">{cliente}</p>
          {cuit && <p className="text-xs text-slate-400 tabular-nums">{cuit}</p>}
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {resumen}
          <ChevronDown size={16} className={clsx('text-slate-400 transition-transform', abierto && 'rotate-180')} />
        </div>
      </button>

      {abierto && <div className="border-t border-slate-100 bg-slate-50/40">{children}</div>}
    </div>
  );
}
