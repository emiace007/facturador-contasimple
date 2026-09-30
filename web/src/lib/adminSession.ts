import type { AdminSession } from '../types';

const STORAGE_KEY = 'estudio-contable:admin-session';

export function getAdminSession(): AdminSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
          return JSON.parse(raw) as AdminSession;
    } catch {
          return null;
    }
}

export function setAdminSession(session: AdminSession): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
    localStorage.removeItem(STORAGE_KEY);
}
