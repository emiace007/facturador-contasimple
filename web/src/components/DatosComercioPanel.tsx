import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Comercio } from '../lib/api';
import { boton, input } from './Aviso';

/** Datos del comercio que figuran en la factura (domicilio, Ingresos Brutos, inicio de actividades…). */
export default function DatosComercioPanel({ comercio: c, onListo }: { comercio: Comercio; onListo: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    razonSocial: c.razon_social,
    nombreFantasia: c.nombre_fantasia ?? '',
    alicuotaDefault: c.alicuota_default != null ? String(Number(c.alicuota_default)) : '',
    domicilio: c.domicilio ?? '',
    iibb: c.iibb ?? '',
    inicioActividades: c.inicio_actividades ? c.inicio_actividades.slice(0, 10) : '',
    categoriaMonotributo: c.categoria_monotributo ?? '',
    puntoVenta: c.punto_venta ? String(c.punto_venta) : '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const m = useMutation({
    mutationFn: () => api.editarComercio(c.id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comercios'] }); qc.invalidateQueries({ queryKey: ['comercio-actual'] }); onListo(); },
  });
  const mono = c.condicion_fiscal === 'monotributo';
  return (
    <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-slate-200/70 bg-slate-50 p-4">
      <p className="sm:col-span-2 text-xs text-slate-500">Estos datos salen impresos en las facturas. Copialos de la constancia de inscripción.</p>
      <label className="text-xs text-slate-500">Razón social<input className={input} value={f.razonSocial} onChange={set('razonSocial')} /></label>
      <label className="text-xs text-slate-500">Nombre del local (opcional)<input className={input} placeholder="Ej.: Verdulería Don José" value={f.nombreFantasia} onChange={set('nombreFantasia')} /></label>
      <label className="text-xs text-slate-500 sm:col-span-2">Domicilio comercial<input className={input} placeholder="Calle 123, Localidad" value={f.domicilio} onChange={set('domicilio')} /></label>
      <label className="text-xs text-slate-500">N° de Ingresos Brutos<input className={input} placeholder="Si lo dejás vacío se usa el CUIT" value={f.iibb} onChange={set('iibb')} /></label>
      <label className="text-xs text-slate-500">Inicio de actividades<input type="date" className={input} value={f.inicioActividades} onChange={set('inicioActividades')} /></label>
      <label className="text-xs text-slate-500">Punto de venta<input className={input} inputMode="numeric" value={f.puntoVenta} onChange={set('puntoVenta')} /></label>
      {!mono && (
        <label className="text-xs text-slate-500">IVA que se usa normalmente
          <select className={input} value={f.alicuotaDefault} onChange={set('alicuotaDefault')}>
            <option value="">21% (general)</option>
            <option value="10.5">10,5%</option>
            <option value="27">27%</option>
            <option value="0">0%</option>
          </select>
        </label>
      )}
      {mono && (
        <label className="text-xs text-slate-500">Categoría de monotributo
          <select className={input} value={f.categoriaMonotributo} onChange={set('categoriaMonotributo')}>
            <option value="">—</option>
            {'ABCDEFGHIJK'.split('').map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </label>
      )}
      <div className="sm:col-span-2 flex items-center gap-3">
        <button className={boton} disabled={!f.razonSocial.trim() || m.isPending} onClick={() => m.mutate()}>Guardar datos</button>
        <button className="text-sm text-slate-500 hover:underline" onClick={onListo}>Cancelar</button>
        {m.error && <span className="text-sm text-red-600">{(m.error as Error).message}</span>}
      </div>
    </div>
  );
}
