export type BillingFeature = 'ai' | 'broadcast' | 'otp';
export type PayMethod = 'qris' | 'va';
export type PaySessionStatus = 'pending' | 'paid' | 'expired';

export type FeatureUsage = {
  feature: BillingFeature;
  used: number;
  unitCost: number;
};

export type BillingAccount = {
  deposit: number;
  usage: Record<BillingFeature, FeatureUsage>;
};

export type PaySession = {
  id: string;
  amount: number;
  method: PayMethod;
  bank?: string;
  status: PaySessionStatus;
  createdAt: string;
  expiresAt: string;
  customerName: string;
  customerRef: string;
};

export type Invoice = {
  id: string;
  label: string;
  date: string;
  status: 'paid' | 'pending';
  amount: number;
};

export const FEATURES: BillingFeature[] = ['ai', 'broadcast', 'otp'];

export const TOPUP_PRESETS = [50_000, 100_000, 250_000, 500_000];

export const VA_BANKS = [
  { id: 'bca', label: 'BCA' },
  { id: 'mandiri', label: 'Mandiri' },
  { id: 'bri', label: 'BRI' },
  { id: 'bni', label: 'BNI' },
  { id: 'permata', label: 'Permata' },
  { id: 'cimb', label: 'CIMB' },
] as const;

const ACCOUNT_KEY = 'orarepot.billing.account';
const SESSION_KEY = 'orarepot.billing.sessions';
const INVOICE_KEY = 'orarepot.billing.invoices';

const DEFAULT_ACCOUNT: BillingAccount = {
  deposit: 200_000,
  usage: {
    ai: { feature: 'ai', used: 12_400, unitCost: 50 },
    broadcast: { feature: 'broadcast', used: 8_200, unitCost: 450 },
    otp: { feature: 'otp', used: 21_600, unitCost: 600 },
  },
};

const DEFAULT_INVOICES: Invoice[] = [
  { id: 'INV-2026-0818', label: 'Invoice #018 – Agu 2026', date: '2026-08-18', status: 'paid', amount: 50_000 },
  { id: 'INV-2026-0718', label: 'Invoice #017 – Jul 2026', date: '2026-07-18', status: 'paid', amount: 50_000 },
  { id: 'INV-2026-0618', label: 'Invoice #016 – Jun 2026', date: '2026-06-18', status: 'paid', amount: 100_000 },
];

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

export function formatIdr(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function getAccount(): BillingAccount {
  const stored = readJson<Partial<BillingAccount>>(ACCOUNT_KEY, {});
  return {
    deposit: stored.deposit ?? DEFAULT_ACCOUNT.deposit,
    usage: {
      ai: { ...DEFAULT_ACCOUNT.usage.ai, ...stored.usage?.ai },
      broadcast: { ...DEFAULT_ACCOUNT.usage.broadcast, ...stored.usage?.broadcast },
      otp: { ...DEFAULT_ACCOUNT.usage.otp, ...stored.usage?.otp },
    },
  };
}

export function totalUsed(account: BillingAccount) {
  return FEATURES.reduce((sum, key) => sum + account.usage[key].used, 0);
}

export function remainingBalance(account: BillingAccount) {
  return Math.max(0, account.deposit - totalUsed(account));
}

export function usageSharePct(account: BillingAccount, feature: BillingFeature) {
  if (!account.deposit) return 0;
  return Math.min(100, Math.round((account.usage[feature].used / account.deposit) * 100));
}

export function remainingUnits(account: BillingAccount, feature: BillingFeature) {
  const cost = account.usage[feature].unitCost;
  if (!cost) return 0;
  return Math.floor(remainingBalance(account) / cost);
}

export function addFeatureSpend(feature: BillingFeature, amount: number): BillingAccount {
  const account = getAccount();
  const next: BillingAccount = {
    ...account,
    usage: {
      ...account.usage,
      [feature]: {
        ...account.usage[feature],
        used: account.usage[feature].used + Math.max(0, amount),
      },
    },
  };
  writeJson(ACCOUNT_KEY, next);
  return next;
}

export function getInvoices(): Invoice[] {
  return readJson<Invoice[]>(INVOICE_KEY, DEFAULT_INVOICES);
}

export function getSessions(): PaySession[] {
  return readJson<PaySession[]>(SESSION_KEY, []);
}

export function getSession(id: string): PaySession | undefined {
  return getSessions().find((s) => s.id === id);
}

/** Midtrans may suffix a retry onto the original session id. */
export function getSessionByOrderId(orderId: string): PaySession | undefined {
  if (!orderId) return undefined;
  return getSessions().find(
    (s) => orderId === s.id || orderId.startsWith(`${s.id}-`),
  );
}

export function createPaySession(input: {
  amount: number;
  method: PayMethod;
  bank?: string;
}): PaySession {
  const now = Date.now();
  const session: PaySession = {
    id: `ORP-${String(now).slice(-8)}`,
    amount: input.amount,
    method: input.method,
    bank: input.bank,
    status: 'pending',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 60 * 60 * 1000).toISOString(),
    customerName: 'Ora Repot Merchant',
    customerRef: 'ORAREPOT',
  };
  writeJson(SESSION_KEY, [session, ...getSessions()].slice(0, 40));
  return session;
}

export function updatePaySession(
  id: string,
  patch: Partial<Pick<PaySession, 'method' | 'bank' | 'status'>>,
): PaySession | undefined {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx < 0) return undefined;
  const next = { ...sessions[idx], ...patch };
  sessions[idx] = next;
  writeJson(SESSION_KEY, sessions);
  return next;
}

export function completePaySession(id: string): PaySession | undefined {
  const current = getSessionByOrderId(id) ?? getSession(id);
  if (!current) return undefined;
  if (current.status === 'paid') return current;

  const session = updatePaySession(id, { status: 'paid' });
  if (!session) return undefined;

  const account = getAccount();
  writeJson(ACCOUNT_KEY, {
    ...account,
    deposit: account.deposit + session.amount,
  });

  const invoices = getInvoices();
  const month = new Date().toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
  writeJson(INVOICE_KEY, [
    {
      id: `INV-${session.id}`,
      label: `Invoice ${session.id} – ${month}`,
      date: new Date().toISOString().slice(0, 10),
      status: 'paid' as const,
      amount: session.amount,
    },
    ...invoices,
  ]);

  return session;
}
