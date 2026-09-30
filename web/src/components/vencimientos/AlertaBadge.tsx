import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { daysUntil, getUrgencia } from '../../lib/dates';
import type { Vencimiento } from '../../types';

interface AlertaBadgeProps {
  fechaVencimiento: Vencimiento['fechaVencimiento'];
  estado: Vencimiento['estado'];
}

const STYLES = {
  vencido: {
    className: 'bg-red-50 text-red-700 border-red-200',
    icon: AlertCircle,
  },
  proximo: {
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  ok: {
    className: 'bg-slate-50 text-slate-500 border-slate-200',
    icon: CheckCircle2,
  },
} as const;

export function AlertaBadge({ fechaVencimiento, estado }: AlertaBadgeProps) {
  const urgencia = getUrgencia(fechaVencimiento, estado);
  const dias = daysUntil(fechaVencimiento);
  const { className, icon: Icon } = STYLES[urgencia];

  let label: string;
  if (estado === 'Presentado') label = 'Presentado';
  else if (urgencia === 'vencido') label = `Vencido hace ${Math.abs(dias)}d`;
  else if (urgencia === 'proximo') label = dias === 0 ? 'Vence hoy' : `Vence en ${dias}d`;
  else label = 'Al día';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
