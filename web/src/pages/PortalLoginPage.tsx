import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Lock, User } from 'lucide-react';
import { api } from '../lib/api';
import { setPortalSession } from '../lib/portalSession';

/**
 * Login del Portal de Cliente: usuario y contraseña propios de cada cliente
 * (los genera el estudio desde la ficha del cliente, ver GenerarAccesoModal).
 * No tiene nada que ver con el PIN de equipo interno (PinGate) — son dos
 * accesos separados a dos partes distintas de la app.
 */
export default function PortalLoginPage() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.loginPortal(usuario, password),
    onSuccess: (session) => {
      setPortalSession(session);
      navigate('/portal', { replace: true });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!usuario || !password) return;
    mutation.mutate();
  }

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-slate-200/70 shadow-lg shadow-slate-200/60 p-8 w-full max-w-sm"
      >
        <img src="/logo.png" alt="Antonella Bertero - Estudio Contable" className="h-28 w-28 mx-auto mb-4 rounded-3xl shadow-md shadow-brand-200" />
        <h1 className="text-base font-semibold text-slate-800 mb-1 text-center">Portal de Cliente</h1>
        <p className="text-sm text-slate-500 mb-5 text-center">
          Estudio Contable Bertero — ingresá con el usuario y contraseña que te dieron.
        </p>

        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Usuario</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="tu.usuario"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Contraseña</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600 mt-3 text-center">{(mutation.error as Error).message}</p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full mt-5 inline-flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
        >
          {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
          {mutation.isPending ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
