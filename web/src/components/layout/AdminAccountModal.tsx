import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, Loader2, LogOut, X } from 'lucide-react';
import { api } from '../../lib/api';
import { clearAdminSession, getAdminSession } from '../../lib/adminSession';

interface AdminAccountModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de cuenta del equipo interno: permite cambiar la contraseña propia
 * (accion `cambiarPasswordAdmin` en Code.gs) y cerrar sesion. Se abre desde
 * el avatar del Header.
 */
export function AdminAccountModal({ open, onClose }: AdminAccountModalProps) {
  const session = getAdminSession();
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [passwordNueva2, setPasswordNueva2] = useState('');
  const [ok, setOk] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.cambiarPasswordAdmin(session!.token, passwordActual, passwordNueva),
    onSuccess: () => {
      setOk(true);
      setPasswordActual('');
      setPasswordNueva('');
      setPasswordNueva2('');
    },
  });

  if (!open || !session) return null;

  function handleClose() {
    setOk(false);
    mutation.reset();
    onClose();
  }

  function handleLogout() {
    clearAdminSession();
    window.location.reload();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passwordActual || !passwordNueva) return;
    if (passwordNueva !== passwordNueva2) return;
    mutation.mutate();
  }

  const noCoinciden = passwordNueva2.length > 0 && passwordNueva !== passwordNueva2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">Mi cuenta — {session.usuario}</h2>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {ok ? (
          <div className="px-5 py-6 space-y-4 text-center">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-800">Contraseña actualizada</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Contraseña actual</label>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Contraseña nueva</label>
              <input
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Repetir contraseña nueva</label>
              <input
                type="password"
                value={passwordNueva2}
                onChange={(e) => setPasswordNueva2(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              />
              {noCoinciden && <p className="text-xs text-red-600 mt-0.5">Las contraseñas no coinciden.</p>}
            </div>

            {mutation.isError && <p className="text-xs text-red-600">{(mutation.error as Error).message}</p>}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
              <button
                type="submit"
                disabled={mutation.isPending || noCoinciden}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {mutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
