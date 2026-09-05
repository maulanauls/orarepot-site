import { API_BASE_URL } from '@/lib/hosts';
import {
  persistSession,
  getMerchantId,
  getStoredUser,
  getToken,
  type AuthUser,
} from '@/lib/session';
import {
  OTP_COST_PER_MESSAGE,
  PLATFORM_OTP_DEFAULTS,
  authTemplateBody,
  isPlatformOtpName,
  platformOtpByName,
  type OtpTemplate,
  type OtpTemplateCategory,
  type OtpTemplateStatus,
} from '@/lib/otp-templates';

export { authTemplateBody };
import type { TeamMember, MemberRole, MemberStatus } from '@/lib/members';
import type { OtpLog } from '@/lib/otp-logs';
import type { OtpApiKey, OtpWebhook } from '@/lib/otp-developer';
import type { BillingAccount, Invoice } from '@/lib/billing';

const EMPTY_SERIES = [
  { label: '—', delivered: 0, sent: 0, read: 0 },
];

async function readError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    if (json.error) return json.error;
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type') && init.body) {
    headers.set('content-type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) throw new Error(await readError(res));
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text.trim()) return undefined as T;
  return JSON.parse(text) as T;
}

function slugify(name: string, email: string) {
  const base = (name || email.split('@')[0] || 'merchant')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  return `${base || 'merchant'}-${Date.now().toString(36)}`;
}

type MerchantRow = { id: string; slug?: string; display_name?: string };
type MemberRow = {
  id: string;
  merchant_id: string;
  email?: string;
  full_name?: string | null;
  role?: string;
  status?: string;
  team_id?: string | null;
};

export async function bootstrapWorkspace(user: AuthUser, displayName?: string) {
  const name = displayName?.trim() || user.full_name || user.email.split('@')[0];
  const merchant = await api<MerchantRow>('/merchant', {
    method: 'POST',
    body: JSON.stringify({
      slug: slugify(name, user.email),
      displayName: name,
      locale: 'id',
    }),
  });
  await api('/members/owners', {
    method: 'POST',
    body: JSON.stringify({
      merchantId: merchant.id,
      email: user.email,
      fullName: user.full_name,
    }),
  });
  await api('/billing/wallets', {
    method: 'POST',
    body: JSON.stringify({ merchant_id: merchant.id }),
  });
  await api('/billing/topups', {
    method: 'POST',
    body: JSON.stringify({
      merchant_id: merchant.id,
      amount_idr: 50_000,
      customer_name: user.full_name || name,
    }),
  }).catch(() => undefined);
  for (const def of PLATFORM_OTP_DEFAULTS) {
    await api('/templates', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: merchant.id,
        name: def.name,
        body: def.body,
        category: 'AUTHENTICATION',
        language: def.language,
        languageCode: def.languageCode,
        buttonLabel: def.buttonLabel,
      }),
    })
      .then((row) => {
        const id = (row as { id?: string }).id;
        if (!id) return;
        return api(`/templates/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'ACTIVE',
            statusLabel: 'Aktif',
          }),
        });
      })
      .catch(() => undefined);
  }
  persistSession({
    token: getToken() ?? '',
    user,
    merchantId: merchant.id,
  });
  return merchant.id;
}

export async function resolveMerchantId(): Promise<string> {
  const existing = getMerchantId();
  if (existing) return existing;
  const memberships = await api<MemberRow[]>('/members/me');
  const first = memberships[0];
  if (first?.merchant_id) {
    const user = getStoredUser();
    if (user && getToken()) {
      persistSession({ token: getToken()!, user, merchantId: first.merchant_id });
    }
    return first.merchant_id;
  }
  const user = getStoredUser();
  if (!user) throw new Error('not signed in');
  return bootstrapWorkspace(user);
}

export function mapTemplate(row: Record<string, unknown>): OtpTemplate {
  const status = (row.status as OtpTemplateStatus) ?? 'PENDING';
  const name = String(row.name ?? '');
  const platform = platformOtpByName(name);
  return {
    id: String(row.id),
    name,
    category: (row.category as OtpTemplateCategory) ?? 'AUTHENTICATION',
    language: platform?.language ?? String(row.language ?? 'Indonesian'),
    languageCode: platform?.languageCode ?? String(row.language_code ?? row.languageCode ?? 'id'),
    status,
    statusLabel: String(row.status_label ?? row.statusLabel ?? status),
    body: platform?.body ?? String(row.body ?? ''),
    buttonLabel: platform?.buttonLabel ?? (row.button_label ? String(row.button_label) : 'Salin Kode'),
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    uniqueReplies: 0,
    readRate: 0,
    amountSpent: 0,
    costPerMessage: OTP_COST_PER_MESSAGE,
    updatedAt: String(row.updated_at ?? row.created_at ?? '').slice(0, 10),
    metaId: platform?.name ?? String(row.meta_template_id ?? ''),
    series: EMPTY_SERIES,
  };
}

export async function fetchTemplates(): Promise<OtpTemplate[]> {
  const merchantId = await resolveMerchantId();
  const rows = await api<Record<string, unknown>[]>(
    `/templates?merchantId=${encodeURIComponent(merchantId)}`,
  );
  return (rows ?? []).map(mapTemplate);
}

export async function ensurePlatformTemplates(): Promise<OtpTemplate[]> {
  const existing = await fetchTemplates();
  for (const def of PLATFORM_OTP_DEFAULTS) {
    if (existing.some((item) => item.name === def.name)) continue;
    try {
      const created = await createTemplate({
        name: def.name,
        language: def.language,
        languageCode: def.languageCode,
      });
      await patchTemplate(created.id, {
        status: 'ACTIVE',
        statusLabel: 'Aktif',
      });
    } catch {
      /* duplicate name is fine */
    }
  }
  const next = await fetchTemplates();
  return next
    .filter((item) => isPlatformOtpName(item.name))
    .sort((a, b) => Number(b.languageCode === 'id') - Number(a.languageCode === 'id'));
}

export async function createTemplate(input: {
  name: string;
  language: string;
  languageCode: string;
}): Promise<OtpTemplate> {
  const merchantId = await resolveMerchantId();
  const platform = platformOtpByName(input.name);
  const row = await api<Record<string, unknown>>('/templates', {
    method: 'POST',
    body: JSON.stringify({
      merchantId,
      name: input.name,
      body: platform?.body ?? authTemplateBody(input.languageCode),
      category: 'AUTHENTICATION',
      language: platform?.language ?? input.language,
      languageCode: platform?.languageCode ?? input.languageCode,
      buttonLabel: platform?.buttonLabel ?? (input.languageCode.startsWith('en') ? 'Copy Code' : 'Salin Kode'),
    }),
  });
  return mapTemplate(row);
}

export async function patchTemplate(
  id: string,
  body: Record<string, unknown>,
): Promise<OtpTemplate> {
  const row = await api<Record<string, unknown>>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapTemplate(row);
}

export type OtpSendRow = {
  id: string;
  merchant_id: string;
  template_id: string;
  request_id: string;
  phone_e164: string;
  status: string;
  cost_idr: number;
  error_message?: string | null;
  provider_message_id?: string | null;
  created_at?: string;
};

export async function fetchOtpSends(): Promise<OtpSendRow[]> {
  const merchantId = await resolveMerchantId();
  return api<OtpSendRow[]>(
    `/otp/sends?merchant_id=${encodeURIComponent(merchantId)}`,
  );
}

export function mapOtpLog(row: OtpSendRow, templateName?: string): OtpLog {
  const when = row.created_at ? new Date(row.created_at) : new Date();
  return {
    id: row.id,
    waktu: when.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    nomor: row.phone_e164,
    tujuan: templateName ?? row.template_id,
    status: row.status === 'success' ? 'Success' : 'Failed',
    requestId: row.request_id,
  };
}

export async function sendOtp(input: {
  templateId: string;
  phoneE164: string;
  code: string;
}): Promise<OtpSendRow> {
  const merchantId = await resolveMerchantId();
  return api<OtpSendRow>('/otp/sends', {
    method: 'POST',
    body: JSON.stringify({
      merchant_id: merchantId,
      template_id: input.templateId,
      phone_e164: input.phoneE164,
      code: input.code,
    }),
  });
}

export type WalletRow = {
  merchant_id: string;
  remaining_idr: number;
  deposit_idr: number;
  used_otp_idr: number;
  used_broadcast_idr: number;
  used_ai_idr: number;
};

export async function fetchWallet(): Promise<BillingAccount> {
  const merchantId = await resolveMerchantId();
  const row = await api<WalletRow>(`/billing/wallets/${merchantId}`);
  return {
    deposit: Number(row.deposit_idr ?? 0),
    usage: {
      otp: { feature: 'otp', used: Number(row.used_otp_idr ?? 0), unitCost: 600 },
      broadcast: {
        feature: 'broadcast',
        used: Number(row.used_broadcast_idr ?? 0),
        unitCost: 450,
      },
      ai: { feature: 'ai', used: Number(row.used_ai_idr ?? 0), unitCost: 50 },
    },
  };
}

export async function fetchWalletRemaining(): Promise<number> {
  const merchantId = await resolveMerchantId();
  try {
    const row = await api<WalletRow>(`/billing/wallets/${merchantId}`);
    return Number(row.remaining_idr ?? 0);
  } catch {
    return 0;
  }
}

export async function topupWallet(amountIdr: number, customerName: string) {
  const merchantId = await resolveMerchantId();
  return api('/billing/topups', {
    method: 'POST',
    body: JSON.stringify({
      merchant_id: merchantId,
      amount_idr: amountIdr,
      customer_name: customerName,
    }),
  });
}

export async function fetchInvoices(): Promise<Invoice[]> {
  const merchantId = await resolveMerchantId();
  const rows = await api<
    { id: string; number: string; label: string; amount_idr: number; status: string; issued_on: string }[]
  >(`/billing/invoices/${merchantId}`);
  return (rows ?? []).map((row) => ({
    id: row.number || row.id,
    label: row.label,
    date: row.issued_on,
    status: row.status === 'paid' ? 'paid' : 'pending',
    amount: Number(row.amount_idr ?? 0),
  }));
}

export function mapMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    fullName: row.full_name || row.email || 'Member',
    email: row.email || '',
    role: (row.role as MemberRole) || 'agent',
    status: (row.status as MemberStatus) || 'invited',
    teamName: null,
  };
}

export async function fetchMembers(): Promise<TeamMember[]> {
  const merchantId = await resolveMerchantId();
  const rows = await api<MemberRow[]>(
    `/members?merchantId=${encodeURIComponent(merchantId)}`,
  );
  return (rows ?? []).map(mapMember);
}

export async function inviteMemberApi(input: {
  email: string;
  fullName: string;
  role: Exclude<MemberRole, 'owner'>;
}): Promise<TeamMember> {
  const merchantId = await resolveMerchantId();
  const row = await api<MemberRow & { memberId?: string }>('/members/invites', {
    method: 'POST',
    body: JSON.stringify({
      merchantId,
      email: input.email,
      fullName: input.fullName,
      role: input.role,
    }),
  });
  return {
    id: row.memberId || row.id,
    fullName: input.fullName || input.email,
    email: input.email,
    role: input.role,
    status: 'invited',
    teamName: null,
  };
}

export async function fetchApiKeys(): Promise<OtpApiKey[]> {
  const merchantId = await resolveMerchantId();
  const rows = await api<
    {
      id: string;
      name: string;
      prefix: string;
      last4: string;
      created_at: string;
      last_used_at?: string | null;
      revoked_at?: string | null;
    }[]
  >(`/developer/keys?merchantId=${encodeURIComponent(merchantId)}`);
  return (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    last4: row.last4,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at ?? undefined,
    revoked: Boolean(row.revoked_at),
  }));
}

export async function createApiKeyApi(name: string): Promise<{ key: OtpApiKey; secret: string }> {
  const merchantId = await resolveMerchantId();
  const row = await api<{
    id: string;
    name: string;
    prefix: string;
    last4: string;
    created_at?: string;
    key: string;
  }>('/developer/keys', {
    method: 'POST',
    body: JSON.stringify({ merchantId, name }),
  });
  return {
    secret: row.key,
    key: {
      id: row.id,
      name: row.name,
      prefix: row.prefix,
      last4: row.last4,
      createdAt: row.created_at ?? new Date().toISOString(),
      revoked: false,
    },
  };
}

export async function revokeApiKeyApi(id: string) {
  await api(`/developer/keys/${id}`, { method: 'DELETE' });
}

export async function fetchWebhook(): Promise<OtpWebhook | null> {
  const merchantId = await resolveMerchantId();
  const row = await api<{
    id: string;
    url: string;
    enabled: boolean;
    events?: string[];
    created_at?: string;
  } | null>(`/developer/webhooks?merchantId=${encodeURIComponent(merchantId)}`);
  if (!row?.id) return null;
  return {
    id: row.id,
    url: row.url,
    secret: '',
    events: (row.events as OtpWebhook['events']) ?? ['otp.sent', 'otp.failed'],
    enabled: row.enabled,
    updatedAt: row.created_at ?? new Date().toISOString(),
  };
}

export async function saveWebhookApi(url: string, enabled: boolean) {
  const merchantId = await resolveMerchantId();
  return api<{ id: string; url: string; secret?: string; enabled: boolean }>(
    '/developer/webhooks',
    {
      method: 'PUT',
      body: JSON.stringify({ merchantId, url, enabled }),
    },
  );
}

export type WabaRow = {
  id: string;
  phone_e164?: string | null;
  display_name?: string | null;
  meta_waba_id?: string | null;
  meta_phone_id?: string | null;
  status?: string;
};

export async function fetchWaba(): Promise<WabaRow[]> {
  const merchantId = await resolveMerchantId();
  return api<WabaRow[]>(`/merchant/${merchantId}/waba`);
}

export async function connectWaba(input: {
  displayName?: string;
  metaWabaId?: string;
  metaPhoneId?: string;
}) {
  const merchantId = await resolveMerchantId();
  return api(`/merchant/${merchantId}/waba`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchMe(fullName: string) {
  return api<AuthUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify({ full_name: fullName }),
  });
}

export async function logoutApi() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}
