import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, CheckCircle2, Info, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../../lib/api';
import { formatMoney } from '../../lib/format';
import type { PortalResumen } from '../../types';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const COLOR_PORTAL = '#a9c595';
const COLOR_ESTUDIO = '#5c7c4d';
const COLOR_OTRAS = '#94a3b8';
const COLOR_TOPE = '#dc2626';

function ym(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function sumarMeses(mes: string, n: number): string {
  const [y, m] = mes.split('-').map(Number);
  return ym(new Date(y, m - 1 + n, 1));
}
function etiquetaMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} ${String(y).slice(2)}`;
}
function fechaLarga(d: Date): string {
  return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]} de ${d.getFullYear()}`;
}
/** $ 3,8 M / $ 950 mil, para etiquetas cortas en los gráficos. */
function montoCorto(n: number): string {
  if (n >= 1_000_000) return `$ ${(n / 1_000_000).toFixed(1).replace('.', ',')} M`;
  if (n >= 1_000) return `$ ${Math.round(n / 1_000)} mil`;
  return `$ ${Math.round(n)}`;
}

/**
 * Próxima recategorización del Monotributo: es semestral. ARCA evalúa los últimos 12 meses
 * al 31/12 y al 30/6, y el trámite vence (en 2026) el 5 de febrero y el 5 de agosto.
 * ARCA puede mover la fecha exacta cada semestre.
 */
function proximaRecategorizacion(hoy: Date) {
  const y = hoy.getFullYear();
  const hoy0 = new Date(y, hoy.getMonth(), hoy.getDate());
  const candidatos = [
    { limite: new Date(y, 1, 5), desde: new Date(y - 1, 0, 1), hasta: new Date(y - 1, 11, 31), rige: `febrero ${y}` },
    { limite: new Date(y, 7, 5), desde: new Date(y - 1, 6, 1), hasta: new Date(y, 5, 30), rige: `agosto ${y}` },
    { limite: new Date(y + 1, 1, 5), desde: new Date(y, 0, 1), hasta: new Date(y, 11, 31), rige: `febrero ${y + 1}` },
  ];
  const prox = candidatos.find((c) => c.limite.getTime() >= hoy0.getTime()) ?? candidatos[2];
  const dias = Math.round((prox.limite.getTime() - hoy0.getTime()) / 86_400_000);
  return { ...prox, dias };
}

function proximoDia20(hoy: Date): Date {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), 20);
  return hoy.getDate() > 20 ? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 20) : d;
}

interface MesDato {
  mes: string;
  portal: number;
  estudio: number;
  otras: number;
  total: number;
  cargado: boolean;
}

function armarMeses(data: PortalResumen) {
  const monitoreo = new Map<string, number>();
  (data.monitoreo?.meses ?? []).forEach((m) => monitoreo.set(m.mes, Number(m.monto) || 0));
  const portal = new Map<string, number>();
  const estudio = new Map<string, number>();
  data.sistema.forEach((f) => {
    const mapa = f.origen === 'portal' ? portal : estudio;
    mapa.set(f.mes, (mapa.get(f.mes) ?? 0) + (Number(f.importe) || 0));
  });

  const conDatos = [
    ...Array.from(monitoreo.entries()).filter(([, v]) => v > 0).map(([k]) => k),
    ...portal.keys(),
    ...estudio.keys(),
  ].sort();
  const hoy = ym(new Date());
  const fin = conDatos.length > 0 ? conDatos[conDatos.length - 1] : hoy;
  const ultimaColumna = Array.from(monitoreo.keys()).sort().pop();

  const totalMes = (mes: string) => {
    const p = portal.get(mes) ?? 0;
    const e = estudio.get(mes) ?? 0;
    return Math.max(monitoreo.get(mes) ?? 0, p + e);
  };

  const meses: MesDato[] = [];
  for (let i = 11; i >= 0; i--) {
    const mes = sumarMeses(fin, -i);
    const p = portal.get(mes) ?? 0;
    const e = estudio.get(mes) ?? 0;
    const mon = monitoreo.get(mes) ?? 0;
    meses.push({
      mes,
      portal: p,
      estudio: e,
      otras: Math.max(0, mon - p - e),
      total: totalMes(mes),
      cargado: monitoreo.has(mes) || (!!ultimaColumna && mes <= ultimaColumna),
    });
  }
  // Acumulado móvil de 12 meses al cierre de cada mes (lo que mira ARCA para la categoría).
  const acumulados = meses.map((m) => {
    let s = 0;
    for (let i = 0; i < 12; i++) s += totalMes(sumarMeses(m.mes, -i));
    return { mes: m.mes, acumulado: s };
  });
  return { meses, acumulados };
}

/* ---------- Gráfico de barras mensual ---------- */
function GraficoMensual({ meses, topeMensual }: { meses: MesDato[]; topeMensual: number }) {
  const W = 640;
  const H = 240;
  const pad = { l: 8, r: 8, t: 22, b: 30 };
  const max = Math.max(1, ...meses.map((m) => m.total), topeMensual * 1.05);
  const anchoCol = (W - pad.l - pad.r) / meses.length;
  const anchoBarra = anchoCol * 0.62;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Facturación por mes">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {meses.map((m, i) => {
        const x = pad.l + i * anchoCol + (anchoCol - anchoBarra) / 2;
        const segmentos = [
          { v: m.otras, c: COLOR_OTRAS },
          { v: m.estudio, c: COLOR_ESTUDIO },
          { v: m.portal, c: COLOR_PORTAL },
        ];
        let base = 0;
        return (
          <g key={m.mes}>
            <title>{`${etiquetaMes(m.mes)}: ${formatMoney(m.total)}${m.cargado ? '' : ' (el estudio todavía no cargó este mes)'}`}</title>
            {!m.cargado && m.total === 0 && (
              <rect x={x} y={y(max * 0.12)} width={anchoBarra} height={y(0) - y(max * 0.12)} fill="none" stroke="#cbd5e1" strokeDasharray="4 3" rx={3} />
            )}
            {segmentos.map((s, j) => {
              if (s.v <= 0) return null;
              const y0 = y(base + s.v);
              const h = y(base) - y0;
              base += s.v;
              return <rect key={j} x={x} y={y0} width={anchoBarra} height={Math.max(1, h)} fill={s.c} rx={2} />;
            })}
            {m.total > 0 && (
              <text x={x + anchoBarra / 2} y={y(m.total) - 5} textAnchor="middle" fontSize={10} fill="#475569">
                {montoCorto(m.total)}
              </text>
            )}
            <text x={x + anchoBarra / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="#64748b">
              {etiquetaMes(m.mes)}
            </text>
          </g>
        );
      })}
      {topeMensual > 0 && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(topeMensual)} y2={y(topeMensual)} stroke={COLOR_TOPE} strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={W - pad.r} y={y(topeMensual) - 5} textAnchor="end" fontSize={10} fill={COLOR_TOPE}>
            Promedio mensual permitido: {montoCorto(topeMensual)}
          </text>
        </g>
      )}
    </svg>
  );
}

/* ---------- Acumulado de 12 meses vs tope ---------- */
function GraficoAcumulado({ acumulados, tope }: { acumulados: { mes: string; acumulado: number }[]; tope: number }) {
  const W = 640;
  const H = 200;
  const pad = { l: 8, r: 8, t: 20, b: 30 };
  const max = Math.max(1, tope * 1.15, ...acumulados.map((a) => a.acumulado) ) * 1.05;
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, acumulados.length - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const puntos = acumulados.map((a, i) => `${x(i)},${y(a.acumulado)}`).join(' ');
  const area = `${x(0)},${y(0)} ${puntos} ${x(acumulados.length - 1)},${y(0)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Facturado en los últimos 12 meses comparado con el tope">
      <polygon points={area} fill={COLOR_ESTUDIO} opacity={0.08} />
      <polyline points={puntos} fill="none" stroke={COLOR_ESTUDIO} strokeWidth={2.5} strokeLinejoin="round" />
      {acumulados.map((a, i) => (
        <g key={a.mes}>
          <circle cx={x(i)} cy={y(a.acumulado)} r={3.5} fill={tope > 0 && a.acumulado > tope ? COLOR_TOPE : COLOR_ESTUDIO}>
            <title>{`${etiquetaMes(a.mes)}: ${formatMoney(a.acumulado)} en los 12 meses anteriores`}</title>
          </circle>
          {i % 2 === acumulados.length % 2 && (
            <text x={x(i)} y={H - 10} textAnchor="middle" fontSize={11} fill="#64748b">
              {etiquetaMes(a.mes)}
            </text>
          )}
        </g>
      ))}
      {tope > 0 && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(tope)} y2={y(tope)} stroke={COLOR_TOPE} strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={pad.l + 4} y={y(tope) - 5} fontSize={10} fill={COLOR_TOPE}>
            Tope de tu categoría: {montoCorto(tope)}
          </text>
        </g>
      )}
    </svg>
  );
}

function Leyenda({ color, texto, punteado }: { color: string; texto: string; punteado?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span
        className={clsx('inline-block h-2.5 w-2.5 rounded-sm', punteado && 'border border-dashed bg-transparent')}
        style={punteado ? { borderColor: color } : { backgroundColor: color }}
      />
      {texto}
    </span>
  );
}

function Tarjeta({ titulo, valor, detalle, tono = 'normal' }: { titulo: string; valor: string; detalle?: string; tono?: 'normal' | 'ok' | 'alerta' }) {
  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 bg-white shadow-sm',
        tono === 'alerta' ? 'border-red-200 bg-red-50/40' : tono === 'ok' ? 'border-emerald-200' : 'border-slate-200/70'
      )}
    >
      <p className="text-xs text-slate-500">{titulo}</p>
      <p className={clsx('text-xl font-semibold mt-1 tabular-nums', tono === 'alerta' ? 'text-red-700' : 'text-slate-800')}>{valor}</p>
      {detalle && <p className="text-xs text-slate-400 mt-1">{detalle}</p>}
    </div>
  );
}

/**
 * Resumen gráfico de la facturación del cliente en el portal: lo que facturó por mes
 * (emitido por él desde el portal, por el estudio, y lo que el estudio registra en el
 * monitoreo), el acumulado de 12 meses contra el tope de su categoría, la próxima
 * recategorización y sus próximos vencimientos.
 */
export function ResumenFacturacion({ token }: { token: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['portal-resumen', token],
    queryFn: () => api.getResumenPortal(token),
    retry: false,
  });

  const calculo = useMemo(() => (data ? armarMeses(data) : null), [data]);

  if (isLoading) {
    return <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-8 text-center text-sm text-slate-400">Cargando tu resumen...</div>;
  }
  if (isError || !data || !calculo) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
        No se pudo cargar tu resumen: {(error as Error)?.message ?? 'sin datos'}
      </div>
    );
  }

  const hoy = new Date();
  const mon = data.monitoreo;
  const esMonotributo = data.categorias.includes('Monotributista') || !!mon?.categoria;
  const tope = esMonotributo ? Number(mon?.topeCategoria) || 0 : 0;
  const ultimo = calculo.acumulados[calculo.acumulados.length - 1];
  const acumulado = Math.max(Number(mon?.acumulado) || 0, ultimo?.acumulado ?? 0);
  const pct = tope > 0 ? Math.round((acumulado / tope) * 100) : 0;
  const disponible = Math.max(0, tope - acumulado);
  const excedido = tope > 0 && acumulado > tope;
  const recat = proximaRecategorizacion(hoy);
  const facturadoAnio = calculo.meses.filter((m) => m.mes.startsWith(String(hoy.getFullYear()))).reduce((s, m) => s + m.total, 0);
  const hayMesesSinCargar = calculo.meses.some((m) => !m.cargado);
  const sugerida = mon?.categoriaSugerida || (data.recategorizacion?.catNueva ?? '');
  const accionEstudio = (data.recategorizacion?.accion ?? '').toUpperCase();

  const hoyIso = ym(hoy) + '-' + String(hoy.getDate()).padStart(2, '0');
  const vencimientos = data.vencimientos
    .filter((v) => v.fecha && v.fecha >= hoyIso && v.estado !== 'Presentado')
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(0, 5);
  const dia20 = proximoDia20(hoy);

  return (
    <div className="space-y-4">
      {/* Tarjetas */}
      <div className={clsx('grid gap-3', esMonotributo ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2')}>
        {esMonotributo && (
          <Tarjeta titulo="Tu categoría" valor={mon?.categoria || '—'} detalle={tope > 0 ? `Tope anual: ${formatMoney(tope)}` : undefined} />
        )}
        <Tarjeta titulo="Facturado en los últimos 12 meses" valor={formatMoney(acumulado)} detalle={esMonotributo && tope > 0 ? `${pct}% del tope` : undefined} tono={excedido ? 'alerta' : 'normal'} />
        {esMonotributo && (
          <Tarjeta
            titulo={excedido ? 'Te pasaste del tope por' : 'Todavía podés facturar'}
            valor={formatMoney(excedido ? acumulado - tope : disponible)}
            detalle={excedido ? 'Vas a tener que subir de categoría' : 'hasta llegar al tope de tu categoría'}
            tono={excedido ? 'alerta' : 'ok'}
          />
        )}
        <Tarjeta titulo={`Facturado en ${hoy.getFullYear()}`} valor={formatMoney(facturadoAnio)} detalle="según los meses del gráfico" />
      </div>

      {/* Progreso contra el tope */}
      {esMonotributo && tope > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-teal-700" />
              ¿Cuánto usaste del tope de tu categoría?
            </h2>
            <span className={clsx('text-sm font-semibold tabular-nums', excedido ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-emerald-600')}>{pct}%</span>
          </div>
          <div className="h-4 rounded-full bg-slate-100 overflow-hidden relative">
            <div
              className={clsx('h-full rounded-full transition-all', excedido ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1.5 tabular-nums">
            <span>$ 0</span>
            <span>Tope categoría {mon?.categoria}: {formatMoney(tope)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            {excedido
              ? 'Tu facturación de los últimos 12 meses supera el tope de tu categoría. En la próxima recategorización vas a tener que pasar a una categoría más alta.'
              : pct >= 80
              ? 'Estás cerca del tope. Si seguís facturando a este ritmo, puede que tengas que subir de categoría en la próxima recategorización.'
              : 'Estás bien dentro del tope de tu categoría.'}
          </p>
        </div>
      )}

      {/* Gráfico mensual */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Tu facturación mes a mes</h2>
        <p className="text-xs text-slate-400 mb-3">Últimos 12 meses. Pasá el mouse (o tocá) una barra para ver el monto exacto.</p>
        <GraficoMensual meses={calculo.meses} topeMensual={tope > 0 ? tope / 12 : 0} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <Leyenda color={COLOR_PORTAL} texto="Emitidas por vos (portal)" />
          <Leyenda color={COLOR_ESTUDIO} texto="Emitidas por el estudio" />
          <Leyenda color={COLOR_OTRAS} texto="Otras registradas por el estudio" />
          {hayMesesSinCargar && <Leyenda color="#cbd5e1" texto="Mes todavía no cargado" punteado />}
          {tope > 0 && <Leyenda color={COLOR_TOPE} texto="Promedio mensual permitido" punteado />}
        </div>
      </div>

      {/* Acumulado vs tope */}
      {esMonotributo && tope > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Lo que mira ARCA: facturado en los últimos 12 meses</h2>
          <p className="text-xs text-slate-400 mb-3">
            Cada punto suma lo facturado en los 12 meses anteriores. Si la línea pasa la raya roja, corresponde subir de categoría.
          </p>
          <GraficoAcumulado acumulados={calculo.acumulados} tope={tope} />
        </div>
      )}

      <div className={clsx('grid gap-4', esMonotributo ? 'md:grid-cols-2' : '')}>
        {/* Recategorización */}
        {esMonotributo && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <CalendarClock size={16} className="text-teal-700" />
              Próxima recategorización
            </h2>
            <div className="flex items-end gap-3">
              <p className="text-3xl font-semibold text-slate-800 tabular-nums">{recat.dias}</p>
              <p className="text-sm text-slate-500 pb-1">días · vence el {fechaLarga(recat.limite)}</p>
            </div>
            <p className="text-xs text-slate-500">
              Se mira lo facturado del {recat.desde.toLocaleDateString('es-AR')} al {recat.hasta.toLocaleDateString('es-AR')}. La nueva
              categoría rige desde {recat.rige}. Es semestral (febrero y agosto); ARCA confirma la fecha exacta cada vez.
            </p>
            {(sugerida || accionEstudio === 'HACER') && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>
                  {accionEstudio === 'HACER' ? 'El estudio va a gestionar tu recategorización' : 'El estudio sugiere recategorizarte'}
                  {sugerida ? ` a la categoría ${sugerida}` : ''}
                  {data.recategorizacion?.catActual ? ` (hoy estás en ${data.recategorizacion.catActual})` : ''}.
                </span>
              </div>
            )}
            {!sugerida && accionEstudio !== 'HACER' && !excedido && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs text-emerald-800 flex gap-2">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                <span>Por ahora no hay cambios de categoría previstos. Si mantenés la categoría, no tenés que hacer nada.</span>
              </div>
            )}
          </div>
        )}

        {/* Vencimientos */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <CalendarClock size={16} className="text-teal-700" />
            Próximos vencimientos
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {esMonotributo && (
              <li className="py-2 flex justify-between gap-3">
                <span className="text-slate-700">Cuota mensual del Monotributo</span>
                <span className="text-slate-500 tabular-nums whitespace-nowrap">{dia20.toLocaleDateString('es-AR')}</span>
              </li>
            )}
            {esMonotributo && (
              <li className="py-2 flex justify-between gap-3">
                <span className="text-slate-700">Recategorización</span>
                <span className="text-slate-500 tabular-nums whitespace-nowrap">{recat.limite.toLocaleDateString('es-AR')}</span>
              </li>
            )}
            {vencimientos.map((v, i) => (
              <li key={i} className="py-2 flex justify-between gap-3">
                <span className="text-slate-700">{v.impuesto}</span>
                <span className="text-slate-500 tabular-nums whitespace-nowrap">{new Date(v.fecha + 'T12:00:00').toLocaleDateString('es-AR')}</span>
              </li>
            ))}
            {!esMonotributo && vencimientos.length === 0 && (
              <li className="py-2 text-slate-400 text-xs">No hay vencimientos cargados para vos.</li>
            )}
          </ul>
          <p className="text-[11px] text-slate-400 flex gap-1">
            <Info size={12} className="shrink-0 mt-0.5" />
            La cuota del Monotributo vence el día 20 de cada mes (si cae en fin de semana o feriado, pasa al siguiente día hábil).
          </p>
        </div>
      </div>

      {/* Detalle */}
      <details className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
        <summary className="text-sm font-semibold text-slate-700 cursor-pointer">Ver el detalle mes por mes</summary>
        <table className="w-full text-sm mt-3">
          <thead>
            <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
              <th className="py-1.5 pr-2 font-medium">Mes</th>
              <th className="py-1.5 pr-2 font-medium text-right">Por vos</th>
              <th className="py-1.5 pr-2 font-medium text-right">Por el estudio</th>
              <th className="py-1.5 pr-2 font-medium text-right">Otras</th>
              <th className="py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 tabular-nums">
            {[...calculo.meses].reverse().map((m) => (
              <tr key={m.mes}>
                <td className="py-1.5 pr-2 text-slate-700">{etiquetaMes(m.mes)}{!m.cargado && <span className="text-xs text-slate-400"> (sin cargar)</span>}</td>
                <td className="py-1.5 pr-2 text-right text-slate-500">{m.portal ? formatMoney(m.portal) : '—'}</td>
                <td className="py-1.5 pr-2 text-right text-slate-500">{m.estudio ? formatMoney(m.estudio) : '—'}</td>
                <td className="py-1.5 pr-2 text-right text-slate-500">{m.otras ? formatMoney(m.otras) : '—'}</td>
                <td className="py-1.5 text-right font-medium text-slate-800">{m.total ? formatMoney(m.total) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
