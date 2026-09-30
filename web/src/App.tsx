import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import VencimientosPage from './pages/VencimientosPage';
import TareasPage from './pages/TareasPage';
import ClientesPage from './pages/ClientesPage';
import AltaClientesPage from './pages/AltaClientesPage';
import ClientePerfilPage from './pages/ClientePerfilPage';
import ClienteHojaTrabajoPage from './pages/ClienteHojaTrabajoPage';
import FacturacionPage from './pages/FacturacionPage';
import FacturacionMasivaPage from './pages/FacturacionMasivaPage';
import FacturasEmitidasPage from './pages/FacturasEmitidasPage';
import RecategorizacionesPage from './pages/RecategorizacionesPage';
import SociedadesPage from './pages/SociedadesPage';
import GananciasPage from './pages/GananciasPage';
import SueldosPage from './pages/SueldosPage';
import HonorariosPage from './pages/HonorariosPage';
import BalancePage from './pages/BalancePage';
import PortalLoginPage from './pages/PortalLoginPage';
import PortalDashboardPage from './pages/PortalDashboardPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/vencimientos" element={<VencimientosPage />} />
        <Route path="/tareas" element={<TareasPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/alta-clientes" element={<AltaClientesPage />} />
        <Route path="/clientes/:id" element={<ClientePerfilPage />} />
        <Route path="/facturacion" element={<FacturacionPage />} />
        <Route path="/facturacion-masiva" element={<FacturacionMasivaPage />} />
        <Route path="/facturas-emitidas" element={<FacturasEmitidasPage />} />
        <Route path="/recategorizaciones" element={<RecategorizacionesPage />} />
        <Route path="/sociedades" element={<SociedadesPage />} />
        <Route path="/ganancias" element={<GananciasPage />} />
        <Route path="/sueldos" element={<SueldosPage />} />
        <Route path="/honorarios" element={<HonorariosPage />} />
        <Route path="/balance" element={<BalancePage />} />
      </Route>
      <Route path="/clientes/:id/hoja-trabajo" element={<ClienteHojaTrabajoPage />} />
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal" element={<PortalDashboardPage />} />
    </Routes>
  );
}
