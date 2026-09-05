export const AUTH_TOKEN_KEY = 'orarepot.auth.token';
export const AUTH_USER_KEY = 'orarepot.auth.user';
export const AUTH_MERCHANT_KEY = 'orarepot.auth.merchantId';

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone_e164: string | null;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getMerchantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(AUTH_MERCHANT_KEY);
}

export function persistSession(input: {
  token: string;
  user: AuthUser;
  merchantId?: string | null;
}) {
  localStorage.setItem(AUTH_TOKEN_KEY, input.token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(input.user));
  if (input.merchantId) {
    localStorage.setItem(AUTH_MERCHANT_KEY, input.merchantId);
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_MERCHANT_KEY);
}
