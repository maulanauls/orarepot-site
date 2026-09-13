const KEY = 'orarepot.pendingInvite';

export type PendingInvite = { id: string; token: string };

export function savePendingInvite(invite: PendingInvite) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(invite));
}

export function peekPendingInvite(): PendingInvite | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvite;
    if (!parsed?.id || !parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function takePendingInvite(): PendingInvite | null {
  const pending = peekPendingInvite();
  if (pending) sessionStorage.removeItem(KEY);
  return pending;
}
