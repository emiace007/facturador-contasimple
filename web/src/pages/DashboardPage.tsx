import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  KanbanSquare,
  Landmark,
  Receipt,
  RefreshCcw,
  Users,
  Wallet,
} from 'lucide-react';
import { api } from '../lib/api';
import { getUrgencia } from '../lib/dates';
import { StatCardSkeleton } from '../components/ui/Skeleton';

const MODULOS = [
  {
    to: '/clientes',
    label: 'Clientes',
    desc: 'Perfil y categoría fiscal de cada cliente',
    icon: Users,
    classes: 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md shadow-brand-200',
  },
  {
    to: '/facturacion',
    label: 'Facturación',
    desc: 'Monitoreo mensual y topes de Monotributo',
    icon: Receipt,
    classes: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-200',
  },
  {
    to: '/facturas-emitidas',
    label: 'Facturas emitidas',
    desc: 'Historial de comprobantes con PDF y envío por WhatsApp',
    icon: FileText,
    classes: 'bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md shadow-teal-200',
  },
  {
    to: '/recategorizaciones',
    label: 'Recategorizaciones',
    desc: 'Clientes a recategorizar en Monotributo (R.0726)',
    icon: RefreshCcw,
    classes: 'bg-gradient-to-br from-rose-400 to-rose-600 text-white shadow-md shadow-rose-200',
  },
  {
    to: '/sociedades',
    label: 'Sociedades',
    desc: 'Cierres, Ganancias societarias y libros IPJ',
    icon: Building2,
    classes: 'bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-md shadow-violet-200',
  },
  {
    to: '/ganancias',
    label: 'Ganancias 2025',
    desc: 'Inscripción, vencimientos y comparativo anual',
    icon: Landmark,
    classes: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200',
  },
  {
    to: '/sueldos',
    label: 'Sueldos',
    desc: 'Trámites y estado de liquidación',
    icon: Wallet,
    classes: 'bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-md shadow-sky-200',
  },
];

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: 'default' | 'warning' | 'danger' | 'success';
}

const TONE_CLASSES: Record<StatCardProps['tone'], string> = {
  default: 'bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-md shadow-brand-200',
  warning: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-200',
  danger: 'bg-gradient-to-br from-red-400 to-red-600 text-white shadow-md shadow-red-200',
  success: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-md shadow-emerald-200',
};

function StatCard({ label, value, icon: Icon, tone }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-3.5 sm:p-5 h-full flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5 transition-all duration-200">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${TONE_CLASSES[tone]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs sm:text-sm text-slate-500 leading-tight">{label}</p>
        <p className="text-xl sm:text-2xl font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  // Fase 1: la conexión a Sheets ya funciona (o falla con mensaje claro) acá.
  // Los módulos de Vencimientos y Tareas (Fase 2 y 3) consumirán estos mismos
  // hooks para renderizar tabla/calendario y Kanban respectivamente.
  const vencimientosQuery = useQuery({
    queryKey: ['vencimientos'],
    queryFn: api.getVencimientos,
    retry: false,
  });

  const tareasQuery = useQuery({
    queryKey: ['tareas'],
    queryFn: api.getTareas,
    retry: false,
  });

  const conectado = !vencimientosQuery.isError && !tareasQuery.isError;
  const cargandoStats = vencimientosQuery.isLoading || tareasQuery.isLoading;

  const alertCount = (vencimientosQuery.data ?? []).filter(
    (v) => getUrgencia(v.fechaVencimiento, v.estado) !== 'ok'
  ).length;

  const presentadosEsteMes = (vencimientosQuery.data ?? []).filter((v) => {
    if (v.estado !== 'Presentado') return false;
    const d = new Date(v.fechaVencimiento);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      {!conectado && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Sin conexión a Google Sheets todavía.</p>
            <p className="text-amber-700/80">
              Configurá <code>frontend/.env</code> con la URL del Web App (ver{' '}
              <code>apps-script/SETUP.md</code>) para ver datos reales acá.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cargandoStats ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <Link to="/vencimientos" className="block">
              <StatCard
                label="Vencimientos cargados"
                value={vencimientosQuery.data?.length ?? '—'}
                icon={CalendarClock}
                tone="default"
              />
            </Link>
            <Link to="/vencimientos" className="block">
              <StatCard label="Vencidos / próximos" value={alertCount} icon={AlertTriangle} tone="warning" />
            </Link>
            <Link to="/tareas" className="block">
              <StatCard
                label="Tareas en curso"
                value={tareasQuery.data?.filter((t) => t.estado !== 'Completado').length ?? '—'}
                icon={KanbanSquare}
                tone="default"
              />
            </Link>
            <StatCard label="Presentados este mes" value={presentadosEsteMes} icon={CheckCircle2} tone="success" />
          </>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Módulos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULOS.map(({ to, label, desc, icon: Icon, classes }) => (
            <Link
              key={to}
              to={to}
              className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5 flex items-start gap-4 hover:shadow-lg hover:shadow-brand-100/60 hover:border-brand-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${classes}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{label}</p>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
