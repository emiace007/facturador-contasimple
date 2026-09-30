import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Landmark, Loader2, Plus, Scale, Trash2, Upload, X } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import {
  CATEGORIAS_EGRESO,
  clasificarMovimiento,
  claveMovimiento,
  leerExtracto,
  type Extracto,
} from '../lib/extractos';
import { esNotaCredito, leerMisComprobantes } from '../lib/misComprobantes';
import type { Egreso, EgresoInput } from '../types/egresos';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400';

function Modal({ titulo, onClose, children, ancho }: { titulo: string; onClose: () => void; children: ReactNode; ancho?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 sm:p-4" onClick={onClose}>
      <div
        className={clsx('bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto', ancho ? 'sm:max-w-4xl' : 'sm:max-w-md')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">{titulo}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Importar extracto (Mercado Pago / bancos)
interface Fila extends EgresoInput {
  incluir: boolean;
}

function ImportarExtracto({ cuit, titular, onClose }: { cuit: string; titular: string; onClose: () => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');
  const [extractos, setExtractos] = useState<{ nombre: string; e: Extracto }[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState<'todas' | 'gastos' | 'no'>('todas');
  const guardar = useMutation({
    mutationFn: () => api.importarEgresos(cuit, filas.filter((f) => f.incluir).map(({ incluir: _i, ...f }) => f)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['balance', cuit] }),
  });

  async function leer(files: FileList | null) {
    if (!files?.length) return;
    setLeyendo(true);
    setError('');
    try {
      const nuevas: Fila[] = [];
      const leidos: { nombre: string; e: Extracto }[] = [];
      for (const file of Array.from(files)) {
        const e = await leerExtracto(file);
        leidos.push({ nombre: file.name, e });
        if (e.cuit && e.cuit !== cuit) setError('Ojo: ' + file.name + ' es del CUIT ' + e.cuit + ', no del cliente elegido.');
        const ocurr = new Map<string, number>();
        for (const m of e.movimientos) {
          if (m.importe >= 0) continue; // entradas: no son egresos
          const base = m.fecha + '|' + m.importe.toFixed(2) + '|' + m.descripcion;
          const n = (ocurr.get(base) ?? 0) + 1;
          ocurr.set(base, n);
          const c = clasificarMovimiento(m.descripcion, e.titular || titular);
          nuevas.push({
            clave: claveMovimiento(cuit, e.banco, m, n),
            fecha: m.fecha,
            descripcion: m.descripcion,
            categoria: c.categoria,
            importe: Math.abs(m.importe),
            origen: e.banco,
            referencia: m.referencia,
            esGasto: c.esGasto,
            incluir: true,
          });
        }
      }
      setExtractos((p) => [...p, ...leidos]);
      setFilas((p) => [...p, ...nuevas]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  }

  const set = (i: number, cambios: Partial<Fila>) => setFilas((p) => p.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  const gastos = filas.filter((f) => f.incluir && f.esGasto);
  const totalGastos = gastos.reduce((s, f) => s + f.importe, 0);
  const resumen = useMemo(() => {
    const m = new Map<string, number>();
    gastos.forEach((f) => m.set(f.categoria, (m.get(f.categoria) ?? 0) + f.importe));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [gastos]);
  const visibles = filas.map((f, i) => ({ f, i })).filter(({ f }) => (filtro === 'todas' ? true : filtro === 'gastos' ? f.esGasto : !f.esGasto));

  return (
    <Modal titulo="Subir extracto (Mercado Pago o banco)" onClose={onClose} ancho>
      {guardar.data ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3">
            Se guardaron <b>{guardar.data.nuevos}</b> movimientos{guardar.data.duplicados > 0 && <> ({guardar.data.duplicados} ya estaban cargados)</>}.
          </p>
          <div className="flex justify-end">
            <button className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 font-medium" onClick={onClose}>Listo</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-xs text-slate-500">
            Subí el resumen en <b>PDF</b> (Mercado Pago, Banco de Córdoba y otros con columnas Débito/Crédito) o el reporte en Excel/CSV. Se toman
            solo las <b>salidas</b> y se clasifican solas; revisá la categoría y destildá lo que no es gasto (por ejemplo, pasajes entre cuentas propias o
            retiros). Si subís dos veces el mismo extracto no se duplica.
          </p>
          <button
            onClick={() => ref.current?.click()}
            disabled={leyendo}
            className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50/40 px-4 py-5 text-slate-500 flex flex-col items-center gap-1.5"
          >
            {leyendo ? <Loader2 size={22} className="animate-spin" /> : <Upload size={22} className="text-brand-600" />}
            {leyendo ? 'Leyendo el extracto...' : extractos.length ? 'Agregar otro extracto' : 'Elegir extracto'}
            <span className="text-[11px] text-slate-400">.pdf, .xlsx, .xls o .csv</span>
          </button>
          <input ref={ref} type="file" multiple accept=".pdf,.xlsx,.xls,.csv" className="hidden" onChange={(e) => { leer(e.target.files); e.target.value = ''; }} />
          {error && <p className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">{error}</p>}
          {extractos.map(({ nombre, e }) => (
            <p key={nombre} className="text-xs text-slate-500">
              <b>{e.banco}</b> {e.periodo && '· ' + e.periodo} · {e.movimientos.length} movimientos ({e.movimientos.filter((m) => m.importe < 0).length} salidas) · {nombre}
            </p>
          ))}

          {filas.length > 0 && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                <p className="text-slate-700">
                  Gastos a guardar: <b>{gastos.length}</b> · <b className="tabular-nums">{formatMoney(totalGastos)}</b>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resumen.map(([c, t]) => (
                    <span key={c} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                      {c}: <b className="tabular-nums">{formatMoney(t)}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex bg-slate-100 rounded-xl p-1 text-xs w-fit">
                {([['todas', 'Todas las salidas'], ['gastos', 'Gastos'], ['no', 'No son gasto']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setFiltro(k)} className={clsx('px-2.5 py-1 rounded-lg font-medium', filtro === k ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="max-h-[45vh] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {visibles.slice(0, 600).map(({ f, i }) => (
                  <div key={f.clave} className={clsx('px-3 py-2 flex flex-wrap items-center gap-2', !f.esGasto && 'bg-slate-50')}>
                    <input type="checkbox" checked={f.esGasto} onChange={(e) => set(i, { esGasto: e.target.checked })} title="Es gasto" />
                    <span className="w-20 text-xs text-slate-500 tabular-nums">{f.fecha.split('-').reverse().join('/')}</span>
                    <span className="flex-1 min-w-[160px] text-xs text-slate-700 truncate" title={f.descripcion}>{f.descripcion || '(sin descripción)'}</span>
                    <select value={f.categoria} onChange={(e) => set(i, { categoria: e.target.value })} className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs">
                      {CATEGORIAS_EGRESO.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <span className="w-28 text-right text-xs font-medium tabular-nums">{formatMoney(f.importe)}</span>
                  </div>
                ))}
                {visibles.length > 600 && <p className="px-3 py-2 text-xs text-slate-400">Se muestran 600 de {visibles.length}; se guardan todos.</p>}
              </div>
              {guardar.error && <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{(guardar.error as Error).message}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600 hover:bg-slate-50">Cancelar</button>
                <button
                  onClick={() => guardar.mutate()}
                  disabled={guardar.isPending}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-4 py-2 font-medium"
                >
                  {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
                  Guardar {filas.length} movimientos
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Mis Comprobantes Recibidos
function ImportarRecibidos({ cuit, onClose }: { cuit: string; onClose: () => void }) {
  const qc = useQueryClient();
  const ref = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [filas, setFilas] = useState<EgresoInput[]>([]);
  const guardar = useMutation({
    mutationFn: () => api.importarEgresos(cuit, filas),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['balance', cuit] }),
  });
  async function leer(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    try {
      const nuevas: EgresoInput[] = [];
      for (const file of Array.from(files)) {
        const r = await leerMisComprobantes(file);
        if (!r.esRecibidos) setError(file.name + ': parece de comprobantes EMITIDOS; acá van los RECIBIDOS (compras).');
        for (const c of r.comprobantes) {
          nuevas.push({
            clave: [cuit, 'ARCA recibidos', c.docReceptor, c.tipo, c.ptoVta, c.numero, c.fecha].join('|'),
            fecha: c.fecha,
            descripcion: (c.tipoNombre || 'Comprobante') + ' ' + String(c.ptoVta).padStart(5, '0') + '-' + String(c.numero).padStart(8, '0') + ' · ' + (c.receptor || c.docReceptor),
            categoria: 'Proveedores y compras',
            importe: esNotaCredito(c.tipo) ? -Math.abs(c.total) : Math.abs(c.total),
            origen: 'ARCA recibidos',
            referencia: c.docReceptor,
            esGasto: true,
          });
        }
      }
      setFilas((p) => [...p, ...nuevas]);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const total = filas.reduce((s, f) => s + f.importe, 0);
  return (
    <Modal titulo="Mis Comprobantes Recibidos (compras)" onClose={onClose}>
      {guardar.data ? (
        <div className="space-y-3 text-sm">
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3">
            Se guardaron <b>{guardar.data.nuevos}</b> comprobantes{guardar.data.duplicados > 0 && <> ({guardar.data.duplicados} ya estaban)</>}.
          </p>
          <div className="flex justify-end"><button className="rounded-xl bg-brand-600 text-white px-4 py-2 font-medium" onClick={onClose}>Listo</button></div>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">En ARCA: Mis Comprobantes → <b>Recibidos</b> → Exportar (Excel o CSV). Se muestran como “compras facturadas” para control.</p>
          <button onClick={() => ref.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-400 px-4 py-5 text-slate-500 flex flex-col items-center gap-1.5">
            <FileSpreadsheet size={22} className="text-brand-600" /> Elegir archivo
          </button>
          <input ref={ref} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { leer(e.target.files); e.target.value = ''; }} />
          {error && <p className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 text-xs">{error}</p>}
          {filas.length > 0 && (
            <>
              <p className="text-slate-700">{filas.length} comprobantes · <b className="tabular-nums">{formatMoney(total)}</b></p>
              {guardar.error && <p className="text-xs text-red-600">{(guardar.error as Error).message}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600">Cancelar</button>
                <button onClick={() => guardar.mutate()} disabled={guardar.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 text-white px-4 py-2 font-medium disabled:opacity-50">
                  {guardar.isPending && <Loader2 size={14} className="animate-spin" />} Guardar
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Gasto manual
function GastoManual({ cuit, onClose }: { cuit: string; onClose: () => void }) {
  const qc = useQueryClient();
  const hoy = new Date();
  const [f, setF] = useState<EgresoInput>({
    fecha: hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0'),
    descripcion: '',
    categoria: 'Proveedores y compras',
    importe: 0,
    origen: 'Manual',
    esGasto: true,
  });
  const guardar = useMutation({
    mutationFn: () => api.importarEgresos(cuit, [f]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['balance', cuit] }); onClose(); },
  });
  return (
    <Modal titulo="Cargar gasto" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-500">Fecha</span><input type="date" className={input} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-slate-500">Importe ($)</span><input type="number" inputMode="decimal" className={input} value={f.importe || ''} onChange={(e) => setF({ ...f, importe: Number(e.target.value) })} /></label>
        </div>
        <label className="flex flex-col gap-1"><span className="text-xs text-slate-500">Concepto</span><input className={input} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="Ej: alquiler del local" /></label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Categoría</span>
          <select className={input} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
            {CATEGORIAS_EGRESO.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        {guardar.error && <p className="text-xs text-red-600">{(guardar.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-slate-600">Cancelar</button>
          <button onClick={() => guardar.mutate()} disabled={!(f.importe > 0) || !f.descripcion.trim() || guardar.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 text-white px-4 py-2 font-medium disabled:opacity-50">
            {guardar.isPending && <Loader2 size={14} className="animate-spin" />} Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Gráfico mensual
function GraficoMeses({ meses }: { meses: { mes: string; ingresos: number; egresos: number }[] }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.egresos]));
  const W = 720, H = 200, pad = 26, ancho = (W - pad * 2) / meses.length;
  const y = (v: number) => H - 24 - (v / max) * (H - 44);
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={pad} x2={W - pad} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" />
      ))}
      {meses.map((m, i) => {
        const x = pad + i * ancho;
        const bw = Math.max(4, ancho / 2 - 5);
        return (
          <g key={m.mes}>
            <rect x={x + 3} y={y(m.ingresos)} width={bw} height={Math.max(0, H - 24 - y(m.ingresos))} rx={3} fill="#739660">
              <title>{'Ingresos ' + formatMoney(m.ingresos)}</title>
            </rect>
            <rect x={x + 3 + bw + 2} y={y(m.egresos)} width={bw} height={Math.max(0, H - 24 - y(m.egresos))} rx={3} fill="#e11d48" opacity={0.75}>
              <title>{'Egresos ' + formatMoney(m.egresos)}</title>
            </rect>
            <text x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#64748b">{MESES[Number(m.mes.slice(5, 7)) - 1]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- Página
export default function BalancePage() {
  const qc = useQueryClient();
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes });
  const [cuit, setCuit] = useState('');
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [modal, setModal] = useState<'' | 'extracto' | 'recibidos' | 'manual'>('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [verNoGasto, setVerNoGasto] = useState(false);

  const clientes = clientesQuery.data ?? [];
  const cliente = clientes.find((c) => String(c.cuit).replace(/\D/g, '') === cuit);
  const balanceQuery = useQuery({ queryKey: ['balance', cuit, anio], queryFn: () => api.getBalance(cuit, anio), enabled: !!cuit });
  const b = balanceQuery.data;

  const actualizar = useMutation({
    mutationFn: (p: { clave: string; cambios: Partial<Pick<Egreso, 'categoria' | 'esGasto'>> }) => api.actualizarEgreso(p.clave, p.cambios),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['balance', cuit] }),
  });
  const eliminar = useMutation({
    mutationFn: (claves: string[]) => api.eliminarEgresos(claves),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['balance', cuit] }),
  });

  const tot = useMemo(() => {
    const m = b?.meses ?? [];
    const ingresos = m.reduce((s, x) => s + x.ingresos, 0);
    const egresos = m.reduce((s, x) => s + x.egresos, 0);
    const compras = m.reduce((s, x) => s + x.compras, 0);
    return { ingresos, egresos, compras, resultado: ingresos - egresos };
  }, [b]);

  const movs = (b?.movimientos ?? []).filter(
    (m) => (verNoGasto || m.esGasto) && (!filtroMes || m.fecha.slice(0, 7) === filtroMes) && (!filtroCat || m.categoria === filtroCat)
  );
  const maxCat = Math.max(1, ...(b?.porCategoria ?? []).map((c) => c.total));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Scale size={20} className="text-brand-600" /> Ingresos y egresos
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Balance mensual de cada cliente: lo facturado contra los gastos de sus extractos, compras y cargas manuales.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <span className="text-xs font-medium text-slate-500">Cliente</span>
          <select className={input} value={cuit} onChange={(e) => { setCuit(e.target.value); setFiltroMes(''); setFiltroCat(''); }}>
            <option value="">Elegí un cliente</option>
            {clientes.map((c) => <option key={c.id} value={String(c.cuit).replace(/\D/g, '')}>{c.cliente} · {c.cuit}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Año</span>
          <select className={input} value={anio} onChange={(e) => setAnio(e.target.value)}>
            {[0, 1, 2].map((d) => { const a = String(new Date().getFullYear() - d); return <option key={a}>{a}</option>; })}
          </select>
        </label>
        {cuit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setModal('extracto')} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 text-sm font-medium">
              <Landmark size={15} /> Subir extracto
            </button>
            <button onClick={() => setModal('recibidos')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-sm font-medium">
              <FileSpreadsheet size={15} /> Comprobantes recibidos
            </button>
            <button onClick={() => setModal('manual')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-sm font-medium">
              <Plus size={15} /> Gasto
            </button>
          </div>
        )}
      </div>

      {!cuit ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-12 text-center text-sm text-slate-400">Elegí un cliente para ver su balance.</div>
      ) : balanceQuery.isLoading ? (
        <p className="text-sm text-slate-400 text-center py-10"><Loader2 size={16} className="inline animate-spin mr-1" /> Cargando...</p>
      ) : balanceQuery.isError ? (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{(balanceQuery.error as Error).message}</div>
      ) : b ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Ingresos facturados', tot.ingresos, 'text-brand-700'],
              ['Egresos pagados', tot.egresos, 'text-rose-600'],
              ['Resultado', tot.resultado, tot.resultado >= 0 ? 'text-emerald-700' : 'text-red-600'],
              ['Compras facturadas (ARCA)', tot.compras, 'text-slate-700'],
            ].map(([l, v, c]) => (
              <div key={l as string} className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
                <p className="text-xs text-slate-500">{l as string} {anio}</p>
                <p className={clsx('text-lg sm:text-xl font-semibold tabular-nums', c as string)}>{formatMoney(v)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700">Por mes</h2>
                <span className="text-[11px] text-slate-500"><span className="inline-block h-2 w-2 rounded-sm bg-brand-500 mr-1" />Ingresos <span className="inline-block h-2 w-2 rounded-sm bg-rose-500 ml-3 mr-1" />Egresos</span>
              </div>
              <GraficoMeses meses={b.meses} />
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs tabular-nums">
                  <thead><tr className="text-slate-400"><th className="text-left font-medium py-1">Mes</th><th className="text-right font-medium">Ingresos</th><th className="text-right font-medium">Egresos</th><th className="text-right font-medium">Resultado</th></tr></thead>
                  <tbody>
                    {b.meses.filter((m) => m.ingresos || m.egresos).map((m) => (
                      <tr key={m.mes} className={clsx('border-t border-slate-100 cursor-pointer hover:bg-slate-50', filtroMes === m.mes && 'bg-brand-50')} onClick={() => setFiltroMes(filtroMes === m.mes ? '' : m.mes)}>
                        <td className="py-1.5">{MESES[Number(m.mes.slice(5, 7)) - 1]}</td>
                        <td className="text-right">{formatMoney(m.ingresos)}</td>
                        <td className="text-right text-rose-600">{formatMoney(m.egresos)}</td>
                        <td className={clsx('text-right font-medium', m.ingresos - m.egresos >= 0 ? 'text-emerald-700' : 'text-red-600')}>{formatMoney(m.ingresos - m.egresos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Gastos por categoría</h2>
              {b.porCategoria.length === 0 ? (
                <p className="text-xs text-slate-400">Todavía no hay gastos cargados.</p>
              ) : (
                <div className="space-y-2">
                  {b.porCategoria.map((c) => (
                    <button key={c.categoria} onClick={() => setFiltroCat(filtroCat === c.categoria ? '' : c.categoria)} className={clsx('w-full text-left', filtroCat === c.categoria && 'font-semibold')}>
                      <div className="flex justify-between text-xs"><span className="text-slate-600">{c.categoria}</span><span className="tabular-nums">{formatMoney(c.total)}</span></div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-rose-400" style={{ width: (c.total / maxCat) * 100 + '%' }} /></div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">
                Movimientos ({movs.length}){filtroMes && ' · ' + MESES[Number(filtroMes.slice(5, 7)) - 1]}{filtroCat && ' · ' + filtroCat}
              </h2>
              <div className="flex items-center gap-3 text-xs">
                {(filtroMes || filtroCat) && <button className="text-slate-500 underline" onClick={() => { setFiltroMes(''); setFiltroCat(''); }}>Quitar filtros</button>}
                <label className="flex items-center gap-1.5 text-slate-600"><input type="checkbox" checked={verNoGasto} onChange={(e) => setVerNoGasto(e.target.checked)} /> Ver también lo que no es gasto</label>
              </div>
            </div>
            {movs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No hay movimientos para este filtro.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {movs.slice(0, 400).map((m) => (
                  <div key={m.clave} className={clsx('px-4 py-2 flex flex-wrap items-center gap-2', !m.esGasto && 'bg-slate-50 text-slate-400')}>
                    <input type="checkbox" checked={m.esGasto} title="Es gasto" onChange={(e) => actualizar.mutate({ clave: m.clave, cambios: { esGasto: e.target.checked } })} />
                    <span className="w-20 text-xs tabular-nums text-slate-500">{m.fecha.split('-').reverse().join('/')}</span>
                    <span className="flex-1 min-w-[160px] text-xs truncate" title={m.descripcion}>{m.descripcion}</span>
                    <span className="text-[10px] rounded bg-slate-100 text-slate-500 px-1.5 py-0.5">{m.origen}</span>
                    <select value={m.categoria} onChange={(e) => actualizar.mutate({ clave: m.clave, cambios: { categoria: e.target.value } })} className="rounded-lg border border-slate-200 px-1.5 py-1 text-xs">
                      {CATEGORIAS_EGRESO.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <span className="w-28 text-right text-xs font-medium tabular-nums">{formatMoney(m.importe)}</span>
                    <button className="p-1 text-slate-400 hover:text-red-600" title="Borrar" onClick={() => { if (window.confirm('¿Borrar este movimiento?')) eliminar.mutate([m.clave]); }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {movs.length > 400 && <p className="px-4 py-2 text-xs text-slate-400">Se muestran 400 de {movs.length}. Filtrá por mes o categoría para ver el resto.</p>}
              </div>
            )}
          </div>
        </>
      ) : null}

      {modal === 'extracto' && cuit && <ImportarExtracto cuit={cuit} titular={cliente?.cliente ?? ''} onClose={() => setModal('')} />}
      {modal === 'recibidos' && cuit && <ImportarRecibidos cuit={cuit} onClose={() => setModal('')} />}
      {modal === 'manual' && cuit && <GastoManual cuit={cuit} onClose={() => setModal('')} />}
    </div>
  );
}
