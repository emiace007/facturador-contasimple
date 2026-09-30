import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, CreditCard, Wallet } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import { fechaCorta } from '../../lib/honorarios';

/** Tarjeta del portal: saldo de honorarios con el estudio, cómo pagar y últimos movimientos. */
export function MisHonorarios({ token }: { token: string }) {
  const { data } = useQuery({
    queryKey: ['portal-honorarios', token],
    queryFn: () => api.getHonorariosPortal(token),
    retry: false,
  });
  const [copiado, setCopiado] = useState('');

  if (!data || (!data.abono && data.movimientos.length === 0)) return null;

  const debe = data.saldo >= 1;
  const pago = data.pago;

  function copiar(valor: string) {
    navigator.clipboard?.writeText(valor).then(() => {
      setCopiado(valor);
      setTimeout(() => setCopiado(''), 1500);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <Wallet size={16} className="text-brand-600" />
          Honorarios del estudio
        </h2>
        {data.abono && data.abono.activo && (
          <span className="text-xs text-slate-500">
            Abono mensual {formatMoney(data.abono.monto)} · vence el día {data.abono.diaVencimiento}
          </span>
        )}
      </div>

      <div
        className={clsx(
          'rounded-xl px-4 py-3 flex items-center justify-between gap-3',
          debe ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'
        )}
      >
        <div>
          <p className={clsx('text-xs', debe ? 'text-red-700' : 'text-emerald-700')}>{debe ? 'Saldo pendiente' : 'Estás al día'}</p>
          <p className={clsx('text-2xl font-semibold tabular-nums', debe ? 'text-red-700' : 'text-emerald-700')}>
            {formatMoney(Math.max(data.saldo, 0))}
          </p>
        </div>
        {debe && pago.mpLink && (
          <a
            href={pago.mpLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white px-3.5 py-2 text-sm font-medium"
          >
            <CreditCard size={15} />
            Pagar con Mercado Pago
          </a>
        )}
      </div>

      {debe && (pago.alias || pago.cbu) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {[
            { label: 'Alias', valor: pago.alias },
            { label: 'CBU / CVU', valor: pago.cbu },
          ]
            .filter((x) => x.valor)
            .map((x) => (
              <button
                key={x.label}
                onClick={() => copiar(x.valor)}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block text-xs text-slate-400">{x.label}{pago.titular ? ' · ' + pago.titular : ''}</span>
                  <span className="block font-medium text-slate-800 truncate tabular-nums">{x.valor}</span>
                </span>
                {copiado === x.valor ? <Check size={16} className="text-emerald-600 shrink-0" /> : <Copy size={16} className="text-slate-400 shrink-0" />}
              </button>
            ))}
        </div>
      )}

      {data.movimientos.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {[...data.movimientos].reverse().slice(0, 6).map((m) => (
            <li key={m.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-slate-600">
                {fechaCorta(m.fecha)} · {m.concepto || (m.tipo === 'pago' ? 'Pago' : 'Honorarios')}
                {m.facturaNumero && <span className="text-xs text-slate-400"> · Factura C {m.facturaNumero}</span>}
              </span>
              <span className={clsx('tabular-nums font-medium shrink-0', m.tipo === 'pago' ? 'text-emerald-700' : 'text-slate-800')}>
                {m.tipo === 'pago' ? '− ' : ''}
                {formatMoney(m.importe)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
