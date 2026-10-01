import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { formatMonto } from '../lib/format';
import { boton, ConComercio, input, label } from '../components/Aviso';

export default function ProductosPage() {
  return <ConComercio>{(c) => <Lista id={c.id} discrimina={c.condicion_fiscal !== 'monotributo'} />}</ConComercio>;
}

function Lista({ id, discrimina }: { id: string; discrimina: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['productos', id], queryFn: api.productos });
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [ali, setAli] = useState(21);
  const m = useMutation({
    mutationFn: () => api.crearProducto({ nombre: nombre.trim(), precio: Number(precio.replace(',', '.')), alicuotaIva: ali, esServicio: false }),
    onSuccess: () => { setNombre(''); setPrecio(''); qc.invalidateQueries({ queryKey: ['productos', id] }); },
  });
  const ok = nombre.trim() && precio !== '' && Number(precio.replace(',', '.')) >= 0;
  const lista = q.data ?? [];
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-brand-950">Productos</h1>
        <p className="text-base text-slate-600 mt-1">Los que cargues acá aparecen como botones en Facturar, para cobrarlos con un toque.</p>
      </div>
      <form className="rounded-2xl bg-white border border-slate-200/80 p-4 grid gap-3 sm:grid-cols-[1fr_10rem_auto] items-end"
        onSubmit={(e) => { e.preventDefault(); if (ok) m.mutate(); }}>
        <label className={label}>Nombre<input className={input} placeholder="Ej.: Alfajor" value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label className={label}>Precio<input className={input} inputMode="decimal" placeholder="0,00" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.,]/g, ''))} /></label>
        {discrimina && (
          <label className={label}>IVA
            <select className={input} value={ali} onChange={(e) => setAli(Number(e.target.value))}>{[21, 10.5, 27, 0].map((a) => <option key={a} value={a}>{String(a).replace('.', ',')}%</option>)}</select>
          </label>
        )}
        <button className={boton + ' w-full sm:w-auto'} disabled={!ok || m.isPending}><Plus size={20} /> Agregar</button>
        {m.error && <p className="sm:col-span-3 text-base text-red-600">{(m.error as Error).message}</p>}
      </form>
      {lista.length === 0 && !q.isLoading && (
        <p className="rounded-2xl bg-white border border-dashed border-slate-300 p-6 text-center text-base text-slate-500">Todavía no cargaste productos.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white border border-slate-200/80 p-4">
            <span className="grid place-items-center h-11 w-11 shrink-0 rounded-xl bg-brand-50 text-brand-600"><Package size={22} /></span>
            <div className="min-w-0">
              <p className="text-base font-bold text-brand-950 truncate">{p.nombre}</p>
              <p className="text-base tabular-nums text-slate-600">{formatMonto(p.precio)}{discrimina && <span className="text-sm text-slate-400"> (IVA {String(Number(p.alicuota_iva)).replace('.', ',')}%)</span>}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
