import { useState } from 'react';
import { X } from 'lucide-react';
import type { CategoriaTarea, Tarea } from '../../types';

interface NuevaTareaModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Omit<Tarea, 'id'>) => void;
  submitting?: boolean;
}

const CATEGORIAS: CategoriaTarea[] = ['Balance', 'DDJJ', 'Sueldos', 'Otro'];

const EMPTY = {
  cliente: '',
  obligacion: '',
  categoria: 'Balance' as CategoriaTarea,
  responsable: '',
  fechaLimite: '',
};

export function NuevaTareaModal({ open, onClose, onSubmit, submitting }: NuevaTareaModalProps) {
  const [form, setForm] = useState(EMPTY);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cliente || !form.obligacion) return;
    onSubmit({ ...form, estado: 'Por Hacer' });
    setForm(EMPTY);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Nueva tarea</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
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
            <label className="text-xs font-medium text-slate-500">Obligación *</label>
            <input
              required
              value={form.obligacion}
              onChange={(e) => setForm({ ...form, obligacion: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
              placeholder="Ej: Balance anual, DDJJ IVA..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Categoría *</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as CategoriaTarea })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none bg-white"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Responsable</label>
              <input
                value={form.responsable}
                onChange={(e) => setForm({ ...form, responsable: e.target.value })}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
                placeholder="Nombre"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Fecha límite</label>
            <input
              type="date"
              value={form.fechaLimite}
              onChange={(e) => setForm({ ...form, fechaLimite: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none"
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
