import { OTP_TEMPLATES } from '@/lib/otp-templates';

export type OtpLogStatus = 'Success' | 'Failed';

export type OtpLog = {
  id: string;
  waktu: string;
  nomor: string;
  tujuan: string;
  status: OtpLogStatus;
  requestId: string;
};

export const OTP_STATUSES: OtpLogStatus[] = ['Success', 'Failed'];

const SEND_KEY = 'orarepot.otp.sends';

const TEMPLATE_NAMES = OTP_TEMPLATES.map((item) => item.name);

export const MOCK_OTP_LOGS: OtpLog[] = Array.from({ length: 48 }, (_, i) => {
  const day = 13 + (i % 7);
  const hour = 8 + (i % 12);
  const min = String((i * 7) % 60).padStart(2, '0');
  const suffix = String(1000 + i).slice(-4);
  return {
    id: String(i + 1),
    waktu: `${day} Mei ${hour}:${min}`,
    nomor: `+62 812-3456-${suffix}`,
    tujuan: TEMPLATE_NAMES[i % TEMPLATE_NAMES.length],
    status: i % 7 === 0 ? 'Failed' : 'Success',
    requestId: `req_${(100000 + i * 37).toString(36)}`,
  };
});

function normalizeStatus(value: unknown): OtpLogStatus {
  return value === 'Failed' ? 'Failed' : 'Success';
}

function normalizeLog(row: Partial<OtpLog> & { status?: string }): OtpLog | null {
  if (!row.id || !row.nomor) return null;
  return {
    id: String(row.id),
    waktu: row.waktu ?? '',
    nomor: row.nomor,
    tujuan: row.tujuan ?? 'otp_verification',
    status: normalizeStatus(row.status),
    requestId: row.requestId ?? '',
  };
}

function readSends(): OtpLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEND_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<OtpLog>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeLog(row))
      .filter((row): row is OtpLog => row !== null);
  } catch {
    return [];
  }
}

export function getSendLogs(): OtpLog[] {
  return readSends();
}

export function appendSendLogs(rows: OtpLog[]) {
  if (typeof window === 'undefined' || rows.length === 0) return;
  localStorage.setItem(SEND_KEY, JSON.stringify([...rows, ...readSends()].slice(0, 200)));
}

export function getAllOtpLogs(): OtpLog[] {
  return [...readSends(), ...MOCK_OTP_LOGS];
}

export function otpLogTemplates(logs: OtpLog[]) {
  const set = new Set<string>(TEMPLATE_NAMES);
  for (const row of logs) {
    if (row.tujuan) set.add(row.tujuan);
  }
  return Array.from(set);
}
