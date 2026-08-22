export type OtpTemplateCategory = 'AUTHENTICATION' | 'UTILITY' | 'MARKETING';
export type OtpTemplateStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'PAUSED';

export type OtpTemplateMetricPoint = {
  label: string;
  delivered: number;
  sent: number;
  read: number;
};

export type OtpTemplate = {
  id: string;
  name: string;
  category: OtpTemplateCategory;
  language: string;
  languageCode: string;
  status: OtpTemplateStatus;
  statusLabel: string;
  body: string;
  buttonLabel?: string;
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  uniqueReplies: number;
  readRate: number;
  amountSpent: number;
  costPerMessage: number;
  updatedAt: string;
  metaId: string;
  series: OtpTemplateMetricPoint[];
};

export const CATEGORY_LABEL: Record<OtpTemplateCategory, string> = {
  AUTHENTICATION: 'Autentikasi',
  UTILITY: 'Utilitas',
  MARKETING: 'Pemasaran',
};

export const STATUS_LABEL: Record<OtpTemplateStatus, string> = {
  ACTIVE: 'Aktif',
  PENDING: 'Menunggu',
  REJECTED: 'Ditolak',
  PAUSED: 'Dijeda',
};

const DEFAULT_SERIES: OtpTemplateMetricPoint[] = [
  { label: '15 Agu', delivered: 42, sent: 48, read: 31 },
  { label: '16 Agu', delivered: 51, sent: 55, read: 38 },
  { label: '17 Agu', delivered: 38, sent: 44, read: 29 },
  { label: '18 Agu', delivered: 61, sent: 66, read: 47 },
  { label: '19 Agu', delivered: 55, sent: 58, read: 41 },
  { label: '20 Agu', delivered: 47, sent: 52, read: 36 },
  { label: '21 Agu', delivered: 58, sent: 63, read: 44 },
  { label: '22 Agu', delivered: 49, sent: 54, read: 37 },
];

export const OTP_TEMPLATES: OtpTemplate[] = [
  {
    id: 'otp_verification',
    name: 'otp_verification',
    category: 'AUTHENTICATION',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'ACTIVE',
    statusLabel: 'Aktif - Menunggu kualitas',
    body: '{{1}} adalah kode verifikasi Anda. Demi keamanan, jangan bagikan kode ini.',
    buttonLabel: 'Salin Kode',
    messagesSent: 264,
    messagesDelivered: 277,
    messagesRead: 195,
    uniqueReplies: 0,
    readRate: 0.74,
    amountSpent: 94155.6,
    costPerMessage: 356.65,
    updatedAt: '2026-08-08',
    metaId: '1234567890123456',
    series: DEFAULT_SERIES,
  },
  {
    id: 'hello_world',
    name: 'hello_world',
    category: 'UTILITY',
    language: 'English (US)',
    languageCode: 'en_US',
    status: 'ACTIVE',
    statusLabel: 'Aktif - Kualitas tinggi',
    body: 'Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message.',
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    uniqueReplies: 0,
    readRate: 0,
    amountSpent: 0,
    costPerMessage: 0,
    updatedAt: '2026-08-05',
    metaId: '9876543210987654',
    series: DEFAULT_SERIES.map((p) => ({
      ...p,
      delivered: 0,
      sent: 0,
      read: 0,
    })),
  },
  {
    id: 'otp_login',
    name: 'otp_login',
    category: 'AUTHENTICATION',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'ACTIVE',
    statusLabel: 'Aktif - Menunggu kualitas',
    body: 'Kode OTP login Anda adalah *{{1}}*. Berlaku 5 menit.',
    buttonLabel: 'Salin Kode',
    messagesSent: 1842,
    messagesDelivered: 1790,
    messagesRead: 1420,
    uniqueReplies: 12,
    readRate: 0.79,
    amountSpent: 612400,
    costPerMessage: 332.5,
    updatedAt: '2026-08-18',
    metaId: '1122334455667788',
    series: DEFAULT_SERIES.map((p, i) => ({
      ...p,
      delivered: p.delivered + 20 + i * 3,
      sent: p.sent + 22 + i * 3,
      read: p.read + 15 + i * 2,
    })),
  },
  {
    id: 'otp_reset_password',
    name: 'otp_reset_password',
    category: 'AUTHENTICATION',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'PENDING',
    statusLabel: 'Menunggu persetujuan',
    body: 'Gunakan kode *{{1}}* untuk reset password akun Anda. Jangan bagikan kepada siapa pun.',
    buttonLabel: 'Salin Kode',
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    uniqueReplies: 0,
    readRate: 0,
    amountSpent: 0,
    costPerMessage: 0,
    updatedAt: '2026-08-20',
    metaId: '5566778899001122',
    series: DEFAULT_SERIES.map((p) => ({
      ...p,
      delivered: 0,
      sent: 0,
      read: 0,
    })),
  },
  {
    id: 'order_update',
    name: 'order_update',
    category: 'UTILITY',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'ACTIVE',
    statusLabel: 'Aktif - Kualitas sedang',
    body: 'Pesanan *{{1}}* sedang diproses. Estimasi tiba {{2}}.',
    messagesSent: 920,
    messagesDelivered: 901,
    messagesRead: 640,
    uniqueReplies: 48,
    readRate: 0.71,
    amountSpent: 287500,
    costPerMessage: 319.2,
    updatedAt: '2026-08-12',
    metaId: '6677889900112233',
    series: DEFAULT_SERIES,
  },
  {
    id: 'promo_flash_sale',
    name: 'promo_flash_sale',
    category: 'MARKETING',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'PAUSED',
    statusLabel: 'Dijeda',
    body: 'Flash sale hari ini! Diskon hingga {{1}}%. Klaim sebelum habis.',
    messagesSent: 1200,
    messagesDelivered: 1105,
    messagesRead: 720,
    uniqueReplies: 95,
    readRate: 0.65,
    amountSpent: 890000,
    costPerMessage: 805.4,
    updatedAt: '2026-07-28',
    metaId: '7788990011223344',
    series: DEFAULT_SERIES,
  },
  {
    id: 'otp_register',
    name: 'otp_register',
    category: 'AUTHENTICATION',
    language: 'English (US)',
    languageCode: 'en_US',
    status: 'REJECTED',
    statusLabel: 'Ditolak',
    body: 'Your registration code is {{1}}. Do not share this code.',
    buttonLabel: 'Copy Code',
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    uniqueReplies: 0,
    readRate: 0,
    amountSpent: 0,
    costPerMessage: 0,
    updatedAt: '2026-08-01',
    metaId: '8899001122334455',
    series: DEFAULT_SERIES.map((p) => ({
      ...p,
      delivered: 0,
      sent: 0,
      read: 0,
    })),
  },
  {
    id: 'account_verify',
    name: 'account_verify',
    category: 'AUTHENTICATION',
    language: 'Indonesian',
    languageCode: 'id',
    status: 'ACTIVE',
    statusLabel: 'Aktif - Menunggu kualitas',
    body: '*{{1}}* adalah kode verifikasi akun Ora Repot Anda.',
    buttonLabel: 'Salin Kode',
    messagesSent: 540,
    messagesDelivered: 528,
    messagesRead: 410,
    uniqueReplies: 3,
    readRate: 0.78,
    amountSpent: 178200,
    costPerMessage: 337.5,
    updatedAt: '2026-08-15',
    metaId: '9900112233445566',
    series: DEFAULT_SERIES,
  },
];

const STORAGE_KEY = 'orarepot.otpTemplates.extra';

export function formatIdr(n: number) {
  if (!n) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDateId(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function bodyPreview(body: string, max = 36) {
  const plain = body.replace(/\*/g, '');
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

export function renderBodySample(body: string, sample = '123456') {
  return body.replace(/\{\{\s*1\s*\}\}/g, sample).replace(/\{\{\s*2\s*\}\}/g, 'besok');
}

function readExtra(): OtpTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OtpTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeExtra(list: OtpTemplate[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllTemplates(): OtpTemplate[] {
  const extra = readExtra();
  const byId = new Map<string, OtpTemplate>();
  for (const t of OTP_TEMPLATES) byId.set(t.id, t);
  for (const t of extra) byId.set(t.id, t);
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getTemplateById(id: string): OtpTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

export function saveNewTemplate(input: {
  name: string;
  language: string;
  languageCode: string;
  body: string;
  category?: OtpTemplateCategory;
}): OtpTemplate {
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  const id = slug || `template_${Date.now()}`;
  const today = new Date().toISOString().slice(0, 10);
  const template: OtpTemplate = {
    id,
    name: slug || id,
    category: input.category ?? 'AUTHENTICATION',
    language: input.language,
    languageCode: input.languageCode,
    status: 'PENDING',
    statusLabel: 'Menunggu persetujuan',
    body: input.body,
    buttonLabel: 'Salin Kode',
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    uniqueReplies: 0,
    readRate: 0,
    amountSpent: 0,
    costPerMessage: 0,
    updatedAt: today,
    metaId: String(Date.now()),
    series: DEFAULT_SERIES.map((p) => ({
      ...p,
      delivered: 0,
      sent: 0,
      read: 0,
    })),
  };
  const extra = readExtra().filter((t) => t.id !== template.id);
  extra.unshift(template);
  writeExtra(extra);
  return template;
}
