import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  Pencil,
  Percent,
  Plus,
  Settings,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { formatMoney } from '../lib/format';
import {
  MEDIOS_PAGO,
  fechaCorta,
  hoyIso,
  linkWhatsapp,
  mensajeRecordatorio,
  nombrePeriodo,
  periodoActual,
} from '../lib/honorarios';
import { FacturaCompartir } from '../components/facturas/FacturaCompartir';
import type {
  AbonoHonorario,
  AbonoInput,
  ConfigHonorarios,
  MedioPago,
  MovimientoInput,
  ResultadoGenerarCargos,
  ResumenHonorarios,
  TipoMovimiento,
} from '../types/honorarios';

const QK = ['honorarios'];

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-base sm:text-sm outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400';
const btnPrimario =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white px-3.5 py-2 text-sm font-medium transition-colors';
const btnSecundario =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-2 text-sm font-medium transition-colors';

function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className={clsx(
          'bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function ErrorMsg({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs">{(error as Error).message}</p>;
}

function Stat({ label, value, tone, icon: Icon }: { label: string; value: string; tone: string; icon: React.ElementType }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-3.5 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
      <div className={clsx('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md', tone)}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-xs sm:text-sm text-slate-500 leading-tight">{label}</p>
        <p className="text-lg sm:text-2xl font-semibold text-slate-800 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function SaldoBadge({ saldo }: { saldo: number }) {
  if (Math.abs(saldo) < 1)
    return <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-xs font-medium">Al día</span>;
  if (saldo < 0)
    return <span className="rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-0.5 text-xs font-medium tabular-nums">A favor {formatMoney(-saldo)}</span>;
  return <span className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 text-xs font-medium tabular-nums">Debe {formatMoney(saldo)}</span>;
}

// ---------------------------------------------------------------- Abono
function AbonoModal({ open, onClose, inicial, onSaved }: { open: boolean; onClose: () => void; inicial: AbonoHonorario | null; onSaved: (r: ResumenHonorarios) => void }) {
  const clientesQuery = useQuery({ queryKey: ['clientes'], queryFn: api.getClientes, enabled: open });
  const [form, setForm] = useState<AbonoInput>(() => ({
    cuit: inicial?.cuit ?? '',
    cliente: inicial?.cliente ?? '',
    monto: inicial?.monto ?? 0,
    diaVencimiento: inicial?.diaVencimiento ?? 10,
    activo: inicial?.activo ?? true,
    telefono: inicial?.telefono ?? '',
    email: inicial?.email ?? '',
    observaciones: inicial?.observaciones ?? '',
  }));
  const guardar = useMutation({ mutationFn: () => api.guardarAbono(form), onSuccess: (r) => { onSaved(r); onClose(); } });
  const set = <K extends keyof AbonoInput>(k: K, v: AbonoInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title={inicial ? 'Editar abono' : 'Nuevo abono mensual'}>
      <div className="space-y-3">
        {!inicial && (
          <Campo label="Cliente">
            <select
              className={inputCls}
              value={form.cuit}
              onChange={(e) => {
                const c = (clientesQuery.data ?? []).find((x) => String(x.cuit).replace(/\D/g, '') === e.target.value);
                setForm((f) => ({ ...f, cuit: e.target.value, cliente: c?.cliente ?? '' }));
              }}
            >
              <option value="">{clientesQuery.isLoading ? 'Cargando clientes...' : 'Elegí un cliente'}</option>
              {(clientesQuery.data ?? []).map((c) => (
                <option key={c.id} value={String(c.cuit).replace(/\D/g, '')}>
                  {c.cliente} · {c.cuit}
                </option>
              ))}
            </select>
          </Campo>
        )}
        {inicial && <p className="text-sm font-medium text-slate-800">{inicial.cliente} <span className="text-xs text-slate-400 tabular-nums">· {inicial.cuit}</span></p>}
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Abono mensual ($)">
            <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.monto || ''} onChange={(e) => set('monto', Number(e.target.value))} />
          </Campo>
          <Campo label="Vence el día">
            <input type="number" min={1} max={28} className={inputCls} value={form.diaVencimiento} onChange={(e) => set('diaVencimiento', Number(e.target.value))} />
          </Campo>
        </div>
        <Campo label="WhatsApp del cliente">
          <input type="tel" className={inputCls} placeholder="Ej: 351 612-3456" value={form.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </Campo>
        <Campo label="Email (opcional)">
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} />
        </Campo>
        <Campo label="Observaciones">
          <input className={inputCls} value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
        </Campo>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} />
          Abono activo (se le genera el cargo cada mes)
        </label>
        <ErrorMsg error={guardar.error} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnSecundario} onClick={onClose}>Cancelar</button>
          <button className={btnPrimario} disabled={!form.cuit || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Movimiento (pago / cargo extra)
function MovimientoModal({ cliente, tipoInicial, onClose, onSaved }: { cliente: AbonoHonorario | null; tipoInicial: TipoMovimiento; onClose: () => void; onSaved: (r: ResumenHonorarios) => void }) {
  const [form, setForm] = useState<MovimientoInput>(() => ({
    cuit: cliente?.cuit ?? '',
    cliente: cliente?.cliente ?? '',
    tipo: tipoInicial,
    concepto: tipoInicial === 'pago' ? 'Pago de honorarios' : '',
    periodo: periodoActual(),
    importe: tipoInicial === 'pago' ? Math.max(cliente?.saldo ?? 0, 0) : 0,
    medio: tipoInicial === 'pago' ? 'transferencia' : '',
    fecha: hoyIso(),
  }));
  const guardar = useMutation({ mutationFn: () => api.registrarMovimiento(form), onSuccess: (r) => { onSaved(r); onClose(); } });
  const set = <K extends keyof MovimientoInput>(k: K, v: MovimientoInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  if (!cliente) return null;

  return (
    <Modal open onClose={onClose} title={form.tipo === 'pago' ? 'Registrar pago' : 'Agregar cargo'}>
      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-800">{cliente.cliente}</p>
        <div className="flex bg-slate-100 rounded-xl p-1">
          {(['pago', 'cargo'] as TipoMovimiento[]).map((t) => (
            <button
              key={t}
              onClick={() => setForm((f) => ({ ...f, tipo: t, concepto: t === 'pago' ? 'Pago de honorarios' : '', medio: t === 'pago' ? 'transferencia' : '' }))}
              className={clsx('flex-1 rounded-lg py-1.5 text-sm font-medium', form.tipo === t ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}
            >
              {t === 'pago' ? 'Pago recibido' : 'Cargo extra'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Importe ($)">
            <input type="number" inputMode="decimal" min={0} className={inputCls} value={form.importe || ''} onChange={(e) => set('importe', Number(e.target.value))} />
          </Campo>
          <Campo label="Fecha">
            <input type="date" className={inputCls} value={form.fecha} onChange={(e) => set('fecha', e.target.value)} />
          </Campo>
        </div>
        {form.tipo === 'pago' ? (
          <Campo label="Medio de pago">
            <select className={inputCls} value={form.medio} onChange={(e) => set('medio', e.target.value as MedioPago)}>
              {MEDIOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </Campo>
        ) : (
          <Campo label="Período">
            <input type="month" className={inputCls} value={form.periodo} onChange={(e) => set('periodo', e.target.value)} />
          </Campo>
        )}
        <Campo label="Concepto">
          <input className={inputCls} placeholder={form.tipo === 'cargo' ? 'Ej: DDJJ Ganancias 2025' : ''} value={form.concepto} onChange={(e) => set('concepto', e.target.value)} />
        </Campo>
        <ErrorMsg error={guardar.error} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnSecundario} onClick={onClose}>Cancelar</button>
          <button className={btnPrimario} disabled={!(form.importe > 0) || guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Cuenta corriente
function CuentaModal({ cliente, data, onClose, onSaved }: { cliente: AbonoHonorario | null; data: ResumenHonorarios; onClose: () => void; onSaved: (r: ResumenHonorarios) => void }) {
  const [errorAccion, setErrorAccion] = useState<unknown>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  if (!cliente) return null;
  const movs = data.movimientos.filter((m) => m.cuit === cliente.cuit);
  let acumulado = 0;
  const filas = movs.map((m) => {
    acumulado += m.tipo === 'pago' ? -m.importe : m.importe;
    return { ...m, saldo: acumulado };
  }).reverse();

  async function accion(id: string, fn: () => Promise<ResumenHonorarios>) {
    setErrorAccion(null);
    setTrabajando(id);
    try {
      onSaved(await fn());
    } catch (e) {
      setErrorAccion(e);
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <Modal open onClose={onClose} title={'Cuenta corriente · ' + cliente.cliente} wide>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <SaldoBadge saldo={cliente.saldo} />
          {!data.config.ptoVta && (
            <p className="text-xs text-amber-700">Para facturar honorarios configurá el punto de venta en "Datos de cobro".</p>
          )}
        </div>
        <ErrorMsg error={errorAccion} />
        {filas.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Todavía no hay movimientos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filas.map((m) => (
              <li key={m.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className={clsx('font-semibold tabular-nums', m.tipo === 'pago' ? 'text-emerald-700' : 'text-slate-800')}>
                      {m.tipo === 'pago' ? '− ' : '+ '}
                      {formatMoney(m.importe)}
                    </span>{' '}
                    · {m.concepto || (m.tipo === 'pago' ? 'Pago' : 'Cargo')}
                  </p>
                  <p className="text-xs text-slate-400">
                    {fechaCorta(m.fecha)}
                    {m.medio && ' · ' + (MEDIOS_PAGO.find((x) => x.value === m.medio)?.label ?? m.medio)}
                    {m.facturaNumero && ' · Factura C ' + m.facturaNumero}
                    {' · saldo ' + formatMoney(m.saldo)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {m.tipo === 'cargo' && !m.cae && data.config.ptoVta > 0 && (
                    <button
                      className={btnSecundario + ' !py-1 !px-2 text-xs'}
                      disabled={trabajando === m.id}
                      onClick={() => accion(m.id, async () => (await api.facturarCargo(m.id)).resumen)}
                    >
                      {trabajando === m.id ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                      Facturar
                    </button>
                  )}
                  {m.facturaId && (
                    <FacturaCompartir compacto titulo={'Factura C ' + m.facturaNumero + ' - Honorarios'} cargarPdf={() => api.getFacturaPdf(m.facturaId)} />
                  )}
                  {!m.cae && (
                    <button
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Borrar movimiento"
                      disabled={trabajando === m.id}
                      onClick={() => {
                        if (window.confirm('¿Borrar este movimiento?')) accion(m.id, () => api.eliminarMovimiento(m.id));
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Generar cargos del mes
function GenerarModal({ open, onClose, onSaved, config }: { open: boolean; onClose: () => void; onSaved: (r: ResumenHonorarios) => void; config: ConfigHonorarios }) {
  const [periodo, setPeriodo] = useState(periodoActual());
  const [facturar, setFacturar] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGenerarCargos | null>(null);
  const generar = useMutation({
    mutationFn: () => api.generarCargos(periodo, facturar),
    onSuccess: (r) => { setResultado(r); onSaved(r.resumen); },
  });
  function cerrar() { setResultado(null); onClose(); }

  return (
    <Modal open={open} onClose={cerrar} title="Generar cargos del mes">
      {resultado ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Resultado de {nombrePeriodo(resultado.periodo)}:</p>
          <ul className="divide-y divide-slate-100 text-sm">
            {resultado.resultado.map((r) => (
              <li key={r.cuit} className="py-2 flex flex-wrap justify-between gap-2">
                <span className="text-slate-800">{r.cliente}</span>
                <span className={clsx('text-xs', r.errorFactura ? 'text-red-600' : r.estado === 'cargado' ? 'text-emerald-700' : 'text-slate-400')}>
                  {r.estado === 'cargado' ? 'Cargo ' + formatMoney(r.importe ?? 0) : r.estado}
                  {r.factura && ' · Factura ' + r.factura}
                  {r.errorFactura && ' · No se facturó: ' + r.errorFactura}
                </span>
              </li>
            ))}
            {resultado.resultado.length === 0 && <li className="py-2 text-slate-400">No hay abonos activos.</li>}
          </ul>
          <div className="flex justify-end"><button className={btnPrimario} onClick={cerrar}>Listo</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Suma el abono del período a la cuenta de cada cliente activo. Si ya estaba cargado, no lo duplica.
          </p>
          <Campo label="Período">
            <input type="month" className={inputCls} value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </Campo>
          <label className={clsx('flex items-start gap-2 text-sm', config.ptoVta ? 'text-slate-600' : 'text-slate-400')}>
            <input type="checkbox" className="mt-0.5" disabled={!config.ptoVta} checked={facturar} onChange={(e) => setFacturar(e.target.checked)} />
            <span>
              Emitir también la Factura C de cada abono en ARCA
              {!config.ptoVta && ' (primero configurá el punto de venta en "Datos de cobro")'}
            </span>
          </label>
          <ErrorMsg error={generar.error} />
          <div className="flex justify-end gap-2">
            <button className={btnSecundario} onClick={cerrar}>Cancelar</button>
            <button className={btnPrimario} disabled={generar.isPending} onClick={() => generar.mutate()}>
              {generar.isPending && <Loader2 size={14} className="animate-spin" />}
              Generar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Ajuste por inflación
function AjusteModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (r: ResumenHonorarios) => void }) {
  const [pct, setPct] = useState<number>(0);
  const [cambios, setCambios] = useState<{ cliente: string; antes: number; ahora: number }[] | null>(null);
  const ajustar = useMutation({ mutationFn: () => api.ajustarAbonos(pct), onSuccess: (r) => { setCambios(r.cambios); onSaved(r.resumen); } });
  function cerrar() { setCambios(null); setPct(0); onClose(); }
  return (
    <Modal open={open} onClose={cerrar} title="Ajustar abonos">
      {cambios ? (
        <div className="space-y-3">
          <ul className="divide-y divide-slate-100 text-sm">
            {cambios.map((c) => (
              <li key={c.cliente} className="py-2 flex justify-between gap-2">
                <span>{c.cliente}</span>
                <span className="tabular-nums text-slate-600">{formatMoney(c.antes)} → <b>{formatMoney(c.ahora)}</b></span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end"><button className={btnPrimario} onClick={cerrar}>Listo</button></div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Aumenta todos los abonos activos en el porcentaje que indiques (por ejemplo, la inflación del período). Redondea al peso.</p>
          <Campo label="Aumento (%)">
            <input type="number" inputMode="decimal" step="0.1" className={inputCls} value={pct || ''} onChange={(e) => setPct(Number(e.target.value))} />
          </Campo>
          <ErrorMsg error={ajustar.error} />
          <div className="flex justify-end gap-2">
            <button className={btnSecundario} onClick={cerrar}>Cancelar</button>
            <button className={btnPrimario} disabled={!pct || ajustar.isPending} onClick={() => ajustar.mutate()}>
              {ajustar.isPending && <Loader2 size={14} className="animate-spin" />}
              Aplicar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- Datos de cobro
function ConfigModal({ open, onClose, inicial, onSaved }: { open: boolean; onClose: () => void; inicial: ConfigHonorarios; onSaved: (r: ResumenHonorarios) => void }) {
  const [cfg, setCfg] = useState<ConfigHonorarios>(inicial);
  const guardar = useMutation({ mutationFn: () => api.guardarConfigHonorarios(cfg), onSuccess: (r) => { onSaved(r); onClose(); } });
  const set = <K extends keyof ConfigHonorarios>(k: K, v: ConfigHonorarios[K]) => setCfg((c) => ({ ...c, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title="Datos de cobro y facturación">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Se muestran en el recordatorio por WhatsApp y en el portal de cada cliente.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Alias"><input className={inputCls} value={cfg.alias} onChange={(e) => set('alias', e.target.value)} /></Campo>
          <Campo label="Titular"><input className={inputCls} value={cfg.titular} onChange={(e) => set('titular', e.target.value)} /></Campo>
        </div>
        <Campo label="CBU / CVU"><input className={inputCls} inputMode="numeric" value={cfg.cbu} onChange={(e) => set('cbu', e.target.value)} /></Campo>
        <Campo label="Link de pago de Mercado Pago"><input className={inputCls} placeholder="https://mpago.la/..." value={cfg.mpLink} onChange={(e) => set('mpLink', e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Campo label="CUIT que factura"><input className={inputCls} inputMode="numeric" value={cfg.cuitEmisor} onChange={(e) => set('cuitEmisor', e.target.value)} /></Campo>
          <Campo label="Punto de venta (Web Services)"><input type="number" min={1} className={inputCls} value={cfg.ptoVta || ''} onChange={(e) => set('ptoVta', Number(e.target.value))} /></Campo>
        </div>
        <ErrorMsg error={guardar.error} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnSecundario} onClick={onClose}>Cancelar</button>
          <button className={btnPrimario} disabled={guardar.isPending} onClick={() => guardar.mutate()}>
            {guardar.isPending && <Loader2 size={14} className="animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- Página
export default function HonorariosPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: QK, queryFn: api.getHonorarios });
  const actualizar = (r: ResumenHonorarios) => queryClient.setQueryData(QK, r);

  const [abonoModal, setAbonoModal] = useState<{ open: boolean; inicial: AbonoHonorario | null }>({ open: false, inicial: null });
  const [movModal, setMovModal] = useState<{ cliente: AbonoHonorario | null; tipo: TipoMovimiento }>({ cliente: null, tipo: 'pago' });
  const [cuentaDe, setCuentaDe] = useState<string | null>(null);
  const [generarOpen, setGenerarOpen] = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'deudores'>('todos');

  const clientes = useMemo(() => {
    const lista = [...(data?.clientes ?? [])].sort((a, b) => b.saldo - a.saldo || a.cliente.localeCompare(b.cliente));
    return filtro === 'deudores' ? lista.filter((c) => c.saldo >= 1) : lista;
  }, [data, filtro]);

  const stats = useMemo(() => {
    const cl = data?.clientes ?? [];
    const periodo = periodoActual();
    return {
      abonos: cl.filter((c) => c.activo).reduce((s, c) => s + c.monto, 0),
      aCobrar: cl.reduce((s, c) => s + Math.max(c.saldo, 0), 0),
      deudores: cl.filter((c) => c.saldo >= 1).length,
      cobradoMes: (data?.movimientos ?? []).filter((m) => m.tipo === 'pago' && m.fecha.slice(0, 7) === periodo).reduce((s, m) => s + m.importe, 0),
    };
  }, [data]);

  const cuentaCliente = cuentaDe ? (data?.clientes ?? []).find((c) => c.cuit === cuentaDe) ?? null : null;
  const config = data?.config;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">Abonos mensuales, cuenta corriente y cobranza de cada cliente.</p>
        <div className="flex flex-wrap gap-2">
          <button className={btnSecundario} onClick={() => setConfigOpen(true)} disabled={!config}>
            <Settings size={15} /> <span className="hidden sm:inline">Datos de cobro</span>
          </button>
          <button className={btnSecundario} onClick={() => setAjusteOpen(true)}>
            <Percent size={15} /> <span className="hidden sm:inline">Ajustar</span>
          </button>
          <button className={btnSecundario} onClick={() => setGenerarOpen(true)} disabled={!config}>
            <CalendarPlus size={15} /> Cargos del mes
          </button>
          <button className={btnPrimario} onClick={() => setAbonoModal({ open: true, inicial: null })}>
            <Plus size={15} /> Nuevo abono
          </button>
        </div>
      </div>

      {config && !config.alias && !config.cbu && !config.mpLink && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle size={17} className="shrink-0 mt-0.5" />
          <p>
            Cargá el alias, CBU o link de Mercado Pago en <button className="underline font-medium" onClick={() => setConfigOpen(true)}>Datos de cobro</button> para que salgan en los recordatorios.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Abonos por mes" value={formatMoney(stats.abonos)} tone="bg-gradient-to-br from-brand-400 to-brand-600" icon={Wallet} />
        <Stat label="A cobrar" value={formatMoney(stats.aCobrar)} tone="bg-gradient-to-br from-red-400 to-red-600" icon={Banknote} />
        <Stat label="Clientes que deben" value={String(stats.deudores)} tone="bg-gradient-to-br from-amber-400 to-amber-600" icon={AlertTriangle} />
        <Stat label="Cobrado este mes" value={formatMoney(stats.cobradoMes)} tone="bg-gradient-to-br from-emerald-400 to-emerald-600" icon={CheckCircle2} />
      </div>

      {isError && <ErrorMsg error={error} />}

      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Clientes ({clientes.length})</h2>
          <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
            {(['todos', 'deudores'] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={clsx('px-2.5 py-1 rounded-lg font-medium', filtro === f ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500')}>
                {f === 'todos' ? 'Todos' : 'Deben'}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400 text-center py-10"><Loader2 size={16} className="inline animate-spin mr-1" /> Cargando...</p>
        ) : clientes.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-sm text-slate-500">{filtro === 'deudores' ? 'Nadie debe honorarios.' : 'Todavía no cargaste abonos.'}</p>
            {filtro === 'todos' && (
              <button className={btnPrimario + ' mt-3'} onClick={() => setAbonoModal({ open: true, inicial: null })}><Plus size={15} /> Cargar el primero</button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {clientes.map((c) => (
              <li key={c.cuit} className="px-4 sm:px-5 py-3 flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4">
                <button className="min-w-0 flex-1 text-left" onClick={() => setCuentaDe(c.cuit)}>
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {c.cliente}
                    {!c.activo && c.monto > 0 && <span className="ml-2 text-xs font-normal text-slate-400">(pausado)</span>}
                  </p>
                  <p className="text-xs text-slate-400 tabular-nums">
                    {c.monto > 0 ? 'Abono ' + formatMoney(c.monto) + ' · vence el ' + c.diaVencimiento : 'Sin abono'}
                    {c.ultimoPago && ' · último pago ' + fechaCorta(c.ultimoPago)}
                  </p>
                </button>
                <div className="flex items-center justify-between md:justify-end gap-2 flex-wrap">
                  <SaldoBadge saldo={c.saldo} />
                  <div className="flex items-center gap-1">
                    <button className={btnSecundario + ' !px-2.5 !py-1.5'} onClick={() => setMovModal({ cliente: c, tipo: 'pago' })} title="Registrar pago">
                      <Banknote size={15} /> <span className="text-xs">Pago</span>
                    </button>
                    {config && c.saldo >= 1 && (
                      <a
                        className={btnSecundario + ' !px-2.5 !py-1.5 !text-emerald-700'}
                        href={linkWhatsapp(c.telefono, mensajeRecordatorio(c, config))}
                        target="_blank"
                        rel="noreferrer"
                        title={c.telefono ? 'Recordar por WhatsApp' : 'Recordar por WhatsApp (elegís el contacto)'}
                      >
                        <MessageCircle size={15} />
                      </a>
                    )}
                    <button className={btnSecundario + ' !px-2.5 !py-1.5'} onClick={() => setCuentaDe(c.cuit)} title="Cuenta corriente">
                      <FileText size={15} />
                    </button>
                    <button className={btnSecundario + ' !px-2.5 !py-1.5'} onClick={() => setAbonoModal({ open: true, inicial: c })} title="Editar abono">
                      <Pencil size={15} />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {abonoModal.open && (
        <AbonoModal open inicial={abonoModal.inicial} onClose={() => setAbonoModal({ open: false, inicial: null })} onSaved={actualizar} />
      )}
      {movModal.cliente && (
        <MovimientoModal cliente={movModal.cliente} tipoInicial={movModal.tipo} onClose={() => setMovModal({ cliente: null, tipo: 'pago' })} onSaved={actualizar} />
      )}
      {data && cuentaCliente && (
        <CuentaModal cliente={cuentaCliente} data={data} onClose={() => setCuentaDe(null)} onSaved={actualizar} />
      )}
      {config && <GenerarModal open={generarOpen} onClose={() => setGenerarOpen(false)} onSaved={actualizar} config={config} />}
      <AjusteModal open={ajusteOpen} onClose={() => setAjusteOpen(false)} onSaved={actualizar} />
      {config && configOpen && <ConfigModal open inicial={config} onClose={() => setConfigOpen(false)} onSaved={actualizar} />}
    </div>
  );
}
