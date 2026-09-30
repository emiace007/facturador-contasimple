import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AdminGate } from './components/auth/AdminGate';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Polling liviano: refresca solo, sin necesidad de recargar la página.
      staleTime: 60_000,
      refetchInterval: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

// El Portal de Cliente (/portal, /portal/login) queda afuera del AdminGate: ese
// login es del equipo interno del estudio, no de los clientes que entran a ver
// su propia facturación. El portal ya tiene su propio login (usuario y
// contraseña por cliente, ver PortalLoginPage).
const esRutaPortal = window.location.pathname.startsWith('/portal');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {esRutaPortal ? (
          <App />
        ) : (
          <AdminGate>
            <App />
          </AdminGate>
        )}
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

// App instalable (PWA): el portal de clientes usa su propio manifiesto para que,
// al "Agregar a pantalla de inicio", abra directo en /portal.
if (esRutaPortal) {
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', '/manifest-portal.webmanifest');
}
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
