import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, LogOut, Receipt } from 'lucide-react';
import { api } from '../lib/api';
import { clearPortalSession, getPortalSession } from '../lib/portalSession';
import { PortalFacturarModal } from '../components/portal/PortalFacturarModal';
import { PortalCambiarPasswordModal } from '../components/portal/PortalCambiarPasswordModal';
import { ResumenFacturacion } from '../components/portal/ResumenFacturacion';
import { MisHonorarios } from '../components/portal/MisHonorarios';
import { FacturaCompartir } from '../components/facturas/FacturaCompartir';
import { formatFechaFactura, tituloFactura } from '../lib/facturas';
import { formatMoney } from '../lib/format';
import type { PortalSession } from '../types';

/**
 * Dashboard del Portal de Cliente: se renderiza fuera del AppLayout interno
 * (sin sidebar del estudio) porque es una vista que va a abrir el cliente,
 * no el equipo. Lee la sesión de localStorage (ver lib/portalSession) y si no
 * hay una válida manda directo al login.
 */
export default function PortalDashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [facturarOpen, setFacturarOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    const s = getPortalSession();
    if (!s) {
      navigate('/portal/login', { replace: true });
      return;
    }
    setSession(s);
  }, [navigate]);

  const emitidasQuery = useQuery({
    queryKey: ['portal-facturas-emitidas', session?.token],
    queryFn: () => api.getMisFacturasEmitidas(session!.token),
    enabled: !!session,
    retry: false,
  });

  if (!session) return null;

  function handleLogout() {
    clearPortalSession();
    navigate('/portal/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{session.cliente}</h1>
            <p className="text-xs text-slate-400 tabular-nums">CUIT: {session.cuit}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFacturarOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 text-sm font-medium transition-colors"
            >
              <Receipt size={15} />
              Facturar
            </button>
            <button
              onClick={() => setPasswordOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 px-3 py-1.5 text-sm font-medium hover:border-slate-300 transition-colors"
            >
              <KeyRound size={15} />
              Cambiar contraseña
            </button>
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 px-3 py-1.5 text-sm font-medium hover:border-slate-300 transition-colors"
            >
              <LogOut size={15} />
              Salir
            </button>
          </div>
        </div>

        <PortalFacturarModal open={facturarOpen} onClose={() => setFacturarOpen(false)} session={session} />
        <PortalCambiarPasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} session={session} />

        <ResumenFacturacion token={session.token} />

        <MisHonorarios token={session.token} />

        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Facturas emitidas desde el sistema</h2>
          {emitidasQuery.isLoading ? (
            <p className="text-sm text-slate-400 text-center py-6">Cargando...</p>
          ) : (emitidasQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Todavía no hay facturas emitidas desde el sistema.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {(emitidasQuery.data ?? []).map((f) => (
                <div key={f.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {tituloFactura(f.cbteTipo, f.ptoVta, f.numero)}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {f.origen === 'portal' ? 'emitida por vos' : 'emitida por el estudio'}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 tabular-nums">
                      {formatFechaFactura(f.fecha)} · {formatMoney(Number(f.importe))} · {f.receptor || 'Consumidor Final'}
                    </p>
                  </div>
                  <FacturaCompartir
                    compacto
                    url={f.pdfUrl || undefined}
                    titulo={`${tituloFactura(f.cbteTipo, f.ptoVta, f.numero)} - ${session.cliente}`}
                    cargarPdf={() => api.getMiFacturaPdf(session.token, f.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
