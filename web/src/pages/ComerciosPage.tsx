import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, setComercioElegido } from '../lib/api';
import { boton, card, input } from '../components/Aviso';

export default function ComerciosPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['comercios'], queryFn: api.comercios });
  const [f, setF] = useState({ razonSocial: '', cuit: '', condicionFiscal: 'monotributo', puntoVenta: '', emailDueno: '', passwordDueno: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => api.crearComercio({ ...f, cuit: f.cuit.replace(/\D/g, ''), puntoVenta: f.puntoVenta ? Number(f.puntoVenta) : null }),
    onSuccess: () => { setF({ ...f, razonSocial: '', cuit: '', puntoVenta: '', emailDueno: '', passwordDueno: '' }); qc.invalidateQueries({ queryKey: ['comercios'] }); },
  });
  const ok = f.razonSocial.trim() && f.cuit.replace(/\D/g, '').length === 11 && f.emailDueno.includes('@') && f.passwordDueno.length >= 8;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Comercios</h1>
      <div className={card + ' grid gap-3 sm:grid-cols-2'}>
        <h2 className="sm:col-span-2 text-sm font-medium text-slate-700">Nuevo comercio</h2>
        <label className="text-xs text-slate-500">Razón social<input className={input} value={f.razonSocial} onChange={set('razonSocial')} /></label>
        <label className="text-xs text-slate-500">CUIT<input className={input} inputMode="numeric" value={f.cuit} onChange={set('cuit')} /></label>
        <label className="text-xs text-slate-500">Condición fiscal
          <select className={input} value={f.condicionFiscal} onChange={set('condicionFiscal')}><option value="monotributo">Monotributo</option><option value="responsable_inscripto">Responsable Inscripto</option></select>
        </label>
        <label className="text-xs text-slate-500">Punto de venta<input className={input} inputMode="numeric" value={f.puntoVenta} onChange={set('puntoVenta')} /></label>
        <label className="text-xs text-slate-500">Email del dueño<input type="email" className={input} value={f.emailDueno} onChange={set('emailDueno')} /></label>
        <label className="text-xs text-slate-500">Contraseña inicial (8+)<input type="text" className={input} value={f.passwordDueno} onChange={set('passwordDueno')} /></label>
        <div className="sm:col-span-2 flex items-center gap-3">
          <button className={boton} disabled={!ok || m.isPending} onClick={() => m.mutate()}>Crear comercio</button>
          {m.error && <span className="text-sm text-red-600">{(m.error as Error).message}</span>}
        </div>
        <p className="sm:col-span-2 text-xs text-slate-400">Recordá que el comercio tiene que delegar el servicio de facturación electrónica (wsfe) al CUIT del estudio en ARCA.</p>
      </div>
      <div className={card + ' !p-0 divide-y divide-slate-100'}>
        {(q.data ?? []).length === 0 && <p className="p-5 text-sm text-slate-400">Todavía no hay comercios.</p>}
        {(q.data ?? []).map((c) => (
          <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div><p className="text-sm font-medium text-slate-800">{c.razon_social}</p>
              <p className="text-xs text-slate-400">{c.cuit} · {c.condicion_fiscal === 'monotributo' ? 'Monotributo' : 'Resp. Inscripto'} · Pto. Vta {c.punto_venta ?? '—'}</p></div>
            <button className="text-sm text-brand-700 hover:underline" onClick={() => { setComercioElegido(c.id); window.location.href = '/facturar'; }}>Facturar por este comercio</button>
          </div>
        ))}
      </div>
    </div>
  );
}
