import { useState } from 'react';
import { X } from 'lucide-react';
import type { TipoImpuesto, Vencimiento } from '../../types';

interface NuevoVencimientoModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<Vencimiento, 'id'>) => void;
  submitting?: boolean;
}

const TIPOS: TipoImpuesto[] = ['AFIP', 'Ingresos Brutos', 'Municipal', 'Otro'];

const EMPTY = {
  cuit: '',
  cliente: '',
  impuesto: '',
  tipo: 'AFIP' as TipoImpuesto,
  fechaVencimiento: '',
  observaciones: '',
};

export function NuevoVencimientoModal({ open, onClose, onSubmit, submitting }: NuevoVencimientoModalProps) {
  const [form, setForm] = useState(EMPTY);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente || !form.fechaVencimiento || !form.impuesto) return;
    onSubmit({ ...form, estado: 'Pendiente' });
    setForm(EMPTY);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Nuevo vencimiento</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Cliente *</label>
              <input
                required
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                placeholder="Razón social"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">CUIT</label>
              <input
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                placeholder="20-12345678-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Impuesto *</label>
              <input
                required
                value={form.impuesto}
                onChange={(e) => setForm({ ...form, impuesto: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                placeholder="Ej: IVA, Ganancias..."
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tipo *</label>
              <select
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoImpuesto })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Fecha de vencimiento *</label>
            <input
              required
              type="date"
              value={form.fechaVencimiento}
              onChange={(e) => setForm({ ...form, fechaVencimiento: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
