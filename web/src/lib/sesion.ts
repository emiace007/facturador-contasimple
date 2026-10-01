import { getSesion, type Sesion } from './api';

/** La sesión actual (se lee de localStorage; cambia solo al entrar o salir, que recargan la app). */
export function useSesion(): Sesion | null {
  return getSesion();
}
