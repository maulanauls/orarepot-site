'use client';

import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type AuthSnackTone = 'error' | 'success' | 'info';

export function AuthSnackbar({
  open,
  message,
  tone = 'error',
  onClose,
}: {
  open: boolean;
  message: string;
  tone?: AuthSnackTone;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open || !message) return;
    const id = window.setTimeout(onClose, 5600);
    return () => window.clearTimeout(id);
  }, [open, message, onClose]);

  if (!open || !message) return null;

  const Icon =
    tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;

  return (
    <div className={`auth-snackbar auth-snackbar-${tone}`} role="alert">
      <span className="auth-snackbar-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <p className="auth-snackbar-text">{message}</p>
      <button
        type="button"
        className="auth-snackbar-close"
        onClick={onClose}
        aria-label="Tutup"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export function friendlyAuthError(raw: string, fallback: string) {
  const text = raw.toLowerCase();
  if (
    text.includes('unreachable') ||
    text.includes('failed to fetch') ||
    text.includes('network')
  ) {
    return fallback;
  }
  return raw;
}
