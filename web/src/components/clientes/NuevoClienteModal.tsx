import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

export interface NuevoClientePayload {
  cliente: string;
  cuit: string;
  encargado: string;
  condicionFiscal: string;
  actMensual: string;
  observaciones: string;
}

interface NuevoClienteModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: NuevoClientePayload) => void;
  submitting?: boolean;
}

const EMPTY: NuevoClientePayload = {
  cliente: '',
  cuit: '',
  encargado: '',
  condicionFiscal: '',
  actMensual: '',
  observaciones: '',
};

export function NuevoClienteModal({ open, onClose, onSubmit, submitting }: NuevoClienteModalProps) {
  const [form, setForm] = useState(EMPTY);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.cliente.trim()) return;
    onSubmit(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Nuevo cliente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Nombre / Razón social *</label>
            <input
              required
              autoFocus
              value={form.cliente}
              onChange={(e) => setForm({ ...form, cliente: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">CUIT</label>
              <input
                value={form.cuit}
                onChange={(e) => setForm({ ...form, cuit: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="20-12345678-9"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Encargado</label>
              <input
                value={form.encargado}
                onChange={(e) => setForm({ ...form, encargado: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="Nombre del encargado"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Condición fiscal</label>
            <input
              value={form.condicionFiscal}
              onChange={(e) => setForm({ ...form, condicionFiscal: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              placeholder="Ej: Monotributo, Responsable Inscripto, RD + Monotributo..."
            />
            <p className="text-xs text-slate-400">
              La categoría (Monotributista, Responsable Inscripto, etc.) se calcula sola a partir de este texto.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Actividad mensual</label>
            <input
              value={form.actMensual}
              onChange={(e) => setForm({ ...form, actMensual: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              placeholder="Ej: actualizar, al día..."
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Observaciones</label>
            <textarea
              value={form.observaciones}
              onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
              rows={2}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 resize-none"
              placeholder="Notas internas sobre este cliente"
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
              {submitting ? 'Guardando...' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
