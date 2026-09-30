import type { PortalSession } from '../types';

const STORAGE_KEY = 'estudio-contable:portal-session';

export function getPortalSession(): PortalSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

export function setPortalSession(session: PortalSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearPortalSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
