import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatMonto } from '../lib/format';
import { boton, card, ConComercio, input } from '../components/Aviso';

export default function ProductosPage() {
  return <ConComercio>{(c) => <Lista id={c.id} />}</ConComercio>;
}

function Lista({ id }: { id: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['productos', id], queryFn: api.productos });
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [ali, setAli] = useState(21);
  const m = useMutation({
    mutationFn: () => api.crearProducto({ nombre: nombre.trim(), precio: Number(precio), alicuotaIva: ali, esServicio: false }),
    onSuccess: () => { setNombre(''); setPrecio(''); qc.invalidateQueries({ queryKey: ['productos', id] }); },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Productos</h1>
      <div className={card + ' flex gap-2 flex-wrap items-end'}>
        <label className="text-xs text-slate-500 flex-1 min-w-[10rem]">Nombre<input className={input} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label className="text-xs text-slate-500 w-32">Precio<input className={input} inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value.replace(',', '.'))} /></label>
        <label className="text-xs text-slate-500 w-24">IVA
          <select className={input} value={ali} onChange={(e) => setAli(Number(e.target.value))}>{[21, 10.5, 27, 0].map((a) => <option key={a} value={a}>{a}%</option>)}</select>
        </label>
        <button className={boton} disabled={!nombre.trim() || !(Number(precio) >= 0) || precio === '' || m.isPending} onClick={() => m.mutate()}>Agregar</button>
      </div>
      {m.error && <p className="text-sm text-red-600">{(m.error as Error).message}</p>}
      <div className={card + ' !p-0 divide-y divide-slate-100'}>
        {(q.data ?? []).length === 0 && <p className="p-5 text-sm text-slate-400">Todavía no cargaste productos.</p>}
        {(q.data ?? []).map((p) => (
          <div key={p.id} className="px-5 py-3 flex justify-between text-sm"><span>{p.nombre}</span><span className="tabular-nums text-slate-600">{formatMonto(p.precio)} · IVA {Number(p.alicuota_iva)}%</span></div>
        ))}
      </div>
    </div>
  );
}
