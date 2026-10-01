import { useState } from 'react';
import { api, type Sesion } from '../lib/api';

export default function LoginPage({ onLogin }: { onLogin: (s: Sesion) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setCargando(true);
    try { onLogin({ ...(await api.login(email.trim(), password)), email: email.trim() }); }
    catch (err) { setError((err as Error).message); }
    finally { setCargando(false); }
  }
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-8 bg-brand-600 p-4">
      <img src="/logo.png" alt="ContaSimple" className="h-11 w-auto" />
      <form onSubmit={enviar} className="w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-brand-900/20 p-6 space-y-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-brand-950">Facturador</h1>
          <p className="text-sm text-slate-500">Ingresá con tu email y contraseña.</p>
        </div>
        <input type="email" required autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <input type="password" required autoComplete="current-password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={cargando} className="w-full rounded-xl bg-brand-600 text-white py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-50">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </button>
        <p className="text-xs text-slate-500">¿Te olvidaste la contraseña? Pedile una nueva a quien te dio el usuario.</p>
      </form>
    </div>
  );
}
