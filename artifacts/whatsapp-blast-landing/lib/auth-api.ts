import { API_BASE_URL } from '@/lib/hosts';
import { persistSession, type AuthUser } from '@/lib/session';
import { bootstrapWorkspace, resolveMerchantId } from '@/lib/orarepot-api';

export type { AuthUser };
export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  let e164: string;
  if (trimmed.startsWith('+')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('62')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('0')) {
    e164 = `+62${digits.slice(1)}`;
  } else {
    e164 = `+${digits}`;
  }
  if (!/^\+[1-9][0-9]{7,14}$/.test(e164)) return null;
  return e164;
}

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    if (json.error) return json.error;
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

async function finishAuth(auth: AuthResponse, displayName?: string) {
  persistSession({ token: auth.token, user: auth.user });
  await bootstrapWorkspace(auth.user, displayName).catch(async () => {
    await resolveMerchantId();
  });
  return auth;
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
}): Promise<AuthResponse> {
  const phoneE164 = toE164(input.phone);
  if (!phoneE164) {
    throw new Error('Nomor WhatsApp harus 08xx atau +62…');
  }
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      full_name: input.fullName.trim(),
      phone_e164: phoneE164,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const auth = (await res.json()) as AuthResponse;
  return finishAuth(auth, input.fullName);
}

export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
    }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const auth = (await res.json()) as AuthResponse;
  persistSession({ token: auth.token, user: auth.user });
  await resolveMerchantId();
  return auth;
}

export function persistAuth(auth: AuthResponse) {
  persistSession({ token: auth.token, user: auth.user });
}
