import type { EstadoVencimiento } from '../../types';

interface EstadoSelectProps {
  value: EstadoVencimiento;
  onChange: (estado: EstadoVencimiento) => void;
  disabled?: boolean;
}

const ESTADOS: EstadoVencimiento[] = ['Pendiente', 'En Proceso', 'Presentado'];

const COLORS: Record<EstadoVencimiento, string> = {
  Pendiente: 'bg-slate-100 text-slate-700 border-slate-300',
  'En Proceso': 'bg-blue-50 text-blue-700 border-blue-300',
  Presentado: 'bg-emerald-50 text-emerald-700 border-emerald-300',
};

/** Select nativo pero con look de badge, para cambiar el estado inline desde la tabla. */
export function EstadoSelect({ value, onChange, disabled }: EstadoSelectProps) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as EstadoVencimiento)}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none cursor-pointer disabled:cursor-wait disabled:opacity-60 ${COLORS[value]}`}
    >
      {ESTADOS.map((estado) => (
        <option key={estado} value={estado}>
          {estado}
        </option>
      ))}
    </select>
  );
}
