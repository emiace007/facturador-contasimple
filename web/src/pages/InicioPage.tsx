import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Layers, Package, Plus } from 'lucide-react';
import { api, nombreComercio, type Comercio } from '../lib/api';
import { formatMonto } from '../lib/format';
import { botonGrande, ConComercio } from '../components/Aviso';
import { FilaFactura } from './FacturasPage';

export default function InicioPage() {
  return <ConComercio>{(c) => <Inicio comercio={c} />}</ConComercio>;
}

function Inicio({ comercio }: { comercio: Comercio }) {
  const resumen = useQuery({ queryKey: ['resumen', comercio.id], queryFn: api.resumen, refetchInterval: 30000 });
  const facturas = useQuery({ queryKey: ['facturas', comercio.id], queryFn: api.facturas });
  const r = resumen.data;
  const ultimas = (facturas.data ?? []).slice(0, 5);
  const accesos = [
    { to: '/facturas', label: 'Facturas', icon: FileText },
    { to: '/productos', label: 'Productos', icon: Package },
    { to: '/masiva', label: 'Carga masiva', icon: Layers },
  ];

  return (
    <div className="space-y-5 md:space-y-6">
      <h1 className="text-2xl md:text-3xl font-extrabold text-brand-950 leading-tight">{nombreComercio(comercio)}</h1>

      <section className="rounded-3xl bg-brand-600 text-white p-5 md:p-7 relative overflow-hidden" aria-label="Ventas">
        <div aria-hidden className="absolute -right-14 -top-16 h-40 w-40 rounded-full border-[18px] border-acento-400/80" />
        <div className="relative">
        <p className="text-base text-brand-100">Facturaste hoy</p>
        <p className="mt-1 text-4xl md:text-5xl font-extrabold tabular-nums tracking-tight">
          {r ? formatMonto(r.hoy_total) : '…'}
        </p>
        <p className="mt-1 text-base text-brand-100">
          {r ? (r.hoy_cantidad === 1 ? '1 factura' : `${r.hoy_cantidad} facturas`) : ''}
        </p>
        <div className="mt-5 pt-4 border-t border-white/20 flex items-baseline justify-between gap-3">
          <span className="text-base text-brand-100">En lo que va del mes</span>
          <span className="text-xl font-bold tabular-nums">{r ? formatMonto(r.mes_total) : '…'}</span>
        </div>
        </div>
      </section>

      <Link to="/facturar" className={botonGrande}><Plus size={26} strokeWidth={2.8} /> Nueva factura</Link>

      <nav className="grid grid-cols-3 gap-3" aria-label="Accesos">
        {accesos.map((a) => (
          <Link key={a.to} to={a.to}
            className="flex flex-col items-center justify-center gap-2 h-28 rounded-2xl bg-white border border-slate-200/80 text-brand-800 font-bold text-[15px] text-center hover:border-brand-300 active:bg-brand-50">
            <span className="grid place-items-center h-11 w-11 rounded-xl bg-brand-50 text-brand-600"><a.icon size={24} /></span>
            {a.label}
          </Link>
        ))}
      </nav>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-extrabold text-brand-950">Últimas facturas</h2>
          {ultimas.length > 0 && <Link to="/facturas" className="text-base font-bold text-brand-700">Ver todas</Link>}
        </div>
        {facturas.isLoading && <p className="text-base text-slate-400">Cargando…</p>}
        {!facturas.isLoading && ultimas.length === 0 && (
          <p className="rounded-2xl bg-white border border-dashed border-slate-300 p-6 text-center text-base text-slate-500">
            Todavía no hiciste facturas. Tocá <b>Nueva factura</b> para hacer la primera.
          </p>
        )}
        <div className="space-y-2">
          {ultimas.map((f) => <FilaFactura key={f.id} f={f} />)}
        </div>
      </section>
    </div>
  );
}
