export type OtpApiKey = {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt?: string;
  revoked: boolean;
};

export type OtpWebhookEvent = 'otp.sent' | 'otp.failed';

export type OtpWebhook = {
  id: string;
  url: string;
  secret: string;
  events: OtpWebhookEvent[];
  enabled: boolean;
  updatedAt: string;
};

export type OtpWebhookDelivery = {
  id: string;
  event: OtpWebhookEvent;
  url: string;
  status: 'Success' | 'Failed';
  code: number;
  createdAt: string;
};

export type OtpApiRequestLog = {
  id: string;
  method: string;
  path: string;
  status: number;
  createdAt: string;
  keyPrefix: string;
};

export const OTP_WEBHOOK_EVENTS: OtpWebhookEvent[] = ['otp.sent', 'otp.failed'];

const KEYS_KEY = 'orarepot.otp.dev.keys';
const SECRETS_KEY = 'orarepot.otp.dev.keySecrets';
const WEBHOOK_KEY = 'orarepot.otp.dev.webhook';
const DELIVERIES_KEY = 'orarepot.otp.dev.deliveries';
const REQUESTS_KEY = 'orarepot.otp.dev.requests';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function randomToken(bytes = 18) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < bytes; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function getApiKeys(): OtpApiKey[] {
  return readJson<OtpApiKey[]>(KEYS_KEY, []);
}

export function createApiKey(name: string): { key: OtpApiKey; secret: string } {
  const raw = `orp_live_${randomToken(24)}`;
  const key: OtpApiKey = {
    id: `key_${Date.now()}`,
    name: name.trim() || 'Default',
    prefix: raw.slice(0, 12),
    last4: raw.slice(-4),
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  writeJson(KEYS_KEY, [key, ...getApiKeys()]);
  const secrets = readJson<Record<string, string>>(SECRETS_KEY, {});
  secrets[key.id] = raw;
  writeJson(SECRETS_KEY, secrets);
  return { key, secret: raw };
}

export function revokeApiKey(id: string) {
  writeJson(
    KEYS_KEY,
    getApiKeys().map((item) => (item.id === id ? { ...item, revoked: true } : item)),
  );
}

export function getWebhook(): OtpWebhook | null {
  return readJson<OtpWebhook | null>(WEBHOOK_KEY, null);
}

export function saveWebhook(input: {
  url: string;
  events: OtpWebhookEvent[];
  enabled: boolean;
  rotateSecret?: boolean;
}): OtpWebhook {
  const current = getWebhook();
  const next: OtpWebhook = {
    id: current?.id ?? `wh_${Date.now()}`,
    url: input.url.trim(),
    secret:
      input.rotateSecret || !current
        ? `whsec_${randomToken(28)}`
        : current.secret,
    events: input.events,
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };
  writeJson(WEBHOOK_KEY, next);
  return next;
}

export function getWebhookDeliveries(): OtpWebhookDelivery[] {
  return readJson<OtpWebhookDelivery[]>(DELIVERIES_KEY, []);
}

export function testWebhook(): OtpWebhookDelivery | null {
  const webhook = getWebhook();
  if (!webhook?.url) return null;
  const ok = webhook.enabled && webhook.url.startsWith('https://');
  const row: OtpWebhookDelivery = {
    id: `del_${Date.now()}`,
    event: 'otp.sent',
    url: webhook.url,
    status: ok ? 'Success' : 'Failed',
    code: ok ? 200 : webhook.enabled ? 400 : 0,
    createdAt: new Date().toISOString(),
  };
  writeJson(DELIVERIES_KEY, [row, ...getWebhookDeliveries()].slice(0, 80));
  return row;
}

export function getApiRequestLogs(): OtpApiRequestLog[] {
  const stored = readJson<OtpApiRequestLog[]>(REQUESTS_KEY, []);
  if (stored.length > 0) return stored;
  return [
    {
      id: 'req_demo_1',
      method: 'POST',
      path: '/api/v1/otp/send',
      status: 200,
      createdAt: new Date(Date.now() - 3600_000).toISOString(),
      keyPrefix: 'orp_live_ab',
    },
    {
      id: 'req_demo_2',
      method: 'GET',
      path: '/api/v1/otp/logs',
      status: 200,
      createdAt: new Date(Date.now() - 7200_000).toISOString(),
      keyPrefix: 'orp_live_ab',
    },
    {
      id: 'req_demo_3',
      method: 'POST',
      path: '/api/v1/otp/send',
      status: 401,
      createdAt: new Date(Date.now() - 10_800_000).toISOString(),
      keyPrefix: '—',
    },
  ];
}

export function recordApiRequest(path: string, status: number, keyPrefix: string) {
  const row: OtpApiRequestLog = {
    id: `api_${Date.now()}`,
    method: 'POST',
    path,
    status,
    createdAt: new Date().toISOString(),
    keyPrefix,
  };
  writeJson(REQUESTS_KEY, [row, ...getApiRequestLogs()].slice(0, 80));
}

export function maskSecret(secret: string) {
  if (secret.length <= 8) return '••••••••';
  return `${secret.slice(0, 7)}••••${secret.slice(-4)}`;
}
