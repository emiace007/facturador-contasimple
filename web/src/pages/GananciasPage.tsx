import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Search } from 'lucide-react';
import { api } from '../lib/api';
import { displayOrDash, formatMoney, toNumber } from '../lib/format';
import { TableSkeleton } from '../components/ui/Skeleton';

export default function GananciasPage() {
  const [busqueda, setBusqueda] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ganancias'],
    queryFn: api.getGanancias,
  });

  const filas = data ?? [];

  const filtradas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return filas;
    return filas.filter(
      (g) => g.cliente?.toLowerCase().includes(term) || String(g.cuit ?? '').includes(term)
    );
  }, [filas, busqueda]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Landmark size={20} className="text-brand-600" />
          Ganancias 2025
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Situación frente al Impuesto a las Ganancias: inscripción, vencimientos y comparativo entre
          períodos.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o CUIT..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
          />
        </div>
      </div>

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          No se pudo cargar Ganancias 2025: {(error as Error)?.message}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : filtradas.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">
          No hay resultados para este filtro.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Inscripto</th>
                <th className="px-4 py-3">Vencimiento</th>
                <th className="px-4 py-3 text-right">2025</th>
                <th className="px-4 py-3 text-right">2024</th>
                <th className="px-4 py-3 text-right">2023</th>
                <th className="px-4 py-3 text-right">Bs. Personales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.map((g, i) => (
                <tr key={`${g.cliente}-${i}`} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{g.cliente}</p>
                    <p className="text-xs text-slate-400 tabular-nums">{g.cuit || 'Sin CUIT'}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{displayOrDash(g.inscripto)}</td>
                  <td className="px-4 py-3 text-slate-600">{displayOrDash(g.vencimiento)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {toNumber(g.gcias25) > 0 ? formatMoney(g.gcias25) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {toNumber(g.gcias24) > 0 ? formatMoney(g.gcias24) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {toNumber(g.gcias23) > 0 ? formatMoney(g.gcias23) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {toNumber(g.bsPersonales) > 0 ? formatMoney(g.bsPersonales) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
