import { useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Cliente, CrearColaboradorResult } from '../../types';

interface GenerarAccesoModalProps {
  open: boolean;
  onClose: () => void;
  cliente: Cliente;
}

function generarPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function usuarioSugerido(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Genera (o regenera) el usuario y contraseña con los que este cliente entra
 * a su propio Portal de Cliente (/portal/login). La contraseña se manda en
 * texto plano en este pedido y el backend la hashea antes de guardarla
 * (sha256Hex_ en Code.gs): este modal es el único lugar donde queda visible
 * en texto plano, por eso conviene copiarla y mandársela al cliente antes de
 * cerrar — después no se puede volver a ver.
 */
export function GenerarAccesoModal({ open, onClose, cliente }: GenerarAccesoModalProps) {
  const [usuario, setUsuario] = useState(() => usuarioSugerido(cliente.cliente));
  const [password, setPassword] = useState(generarPassword);
  const [resultado, setResultado] = useState<CrearColaboradorResult | null>(null);
  const [copiado, setCopiado] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.crearColaborador({ cliente: cliente.cliente, cuit: cliente.cuit, usuario, password }),
    onSuccess: (data) => setResultado(data),
  });

  if (!open) return null;

  function handleClose() {
    if (mutation.isPending) return;
    setResultado(null);
    setCopiado(false);
    mutation.reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!usuario || !password) return;
    mutation.mutate();
  }

  function copiarCredenciales() {
    const texto = `Portal de cliente — Estudio Contable Bertero\nUsuario: ${usuario}\nContraseña: ${password}`;
    navigator.clipboard.writeText(texto).then(() => setCopiado(true));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Acceso al portal — {cliente.cliente}</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {resultado ? (
          <div className="px-5 py-6 space-y-4">
            <div className="flex flex-col items-center text-center gap-2 py-2">
              <CheckCircle2 size={32} className="text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800">Acceso creado</p>
              <p className="text-xs text-slate-500">
                Copiá estos datos y enviáselos al cliente: no se van a volver a mostrar así.
              </p>
            </div>
            <dl className="space-y-1.5 text-sm bg-slate-50 rounded-xl p-4">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Usuario</dt>
                <dd className="font-medium">{resultado.usuario}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Contraseña</dt>
                <dd className="font-medium">{password}</dd>
              </div>
            </dl>
            <button
              onClick={copiarCredenciales}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-300 hover:text-brand-700"
            >
              <Copy size={14} />
              {copiado ? 'Copiado' : 'Copiar usuario y contraseña'}
            </button>
            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            <p className="text-xs text-slate-400 tabular-nums">CUIT: {cliente.cuit || 'sin cargar'}</p>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Usuario *</label>
              <input
                required
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Contraseña *</label>
              <div className="flex gap-2">
                <input
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                />
                <button
                  type="button"
                  onClick={() => setPassword(generarPassword())}
                  title="Generar otra"
                  className="rounded-xl border border-slate-200 px-3 text-slate-500 hover:border-brand-300 hover:text-brand-700"
                >
                  <KeyRound size={15} />
                </button>
              </div>
            </div>

            {!cliente.cuit && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>Este cliente no tiene CUIT cargado: el acceso va a quedar sin facturación vinculada.</span>
              </div>
            )}

            {mutation.isError && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{(mutation.error as Error).message}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={mutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mutation.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {mutation.isPending ? 'Creando...' : 'Crear acceso'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
