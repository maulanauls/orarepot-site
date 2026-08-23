import { OTP_COST_PER_MESSAGE, type OtpTemplate } from '@/lib/otp-templates';
import { appendSendLogs, type OtpLog } from '@/lib/otp-logs';
import { addFeatureSpend, getAccount, remainingBalance } from '@/lib/billing';

export type ParsedPhones = {
  valid: string[];
  invalid: string[];
};

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8') && digits.length >= 9 && digits.length <= 13) {
    digits = `62${digits}`;
  }
  if (!/^\d{10,15}$/.test(digits)) return null;
  return `+${digits}`;
}

export function formatPhoneDisplay(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (digits.startsWith('62') && digits.length >= 10) {
    const rest = digits.slice(2);
    return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`.replace(/-$/, '');
  }
  return e164;
}

export function parsePhoneNumbers(raw: string): ParsedPhones {
  const tokens = raw
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    const phone = normalizePhone(token);
    if (!phone) {
      invalid.push(token);
      continue;
    }
    if (seen.has(phone)) continue;
    seen.add(phone);
    valid.push(phone);
  }
  return { valid, invalid };
}

export function sendOtpBatch(input: {
  phones: string[];
  template: OtpTemplate;
}): { logs: OtpLog[]; cost: number } {
  const now = new Date();
  const waktu = now.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const logs: OtpLog[] = input.phones.map((phone, index) => ({
    id: `send-${now.getTime()}-${index}`,
    waktu,
    nomor: formatPhoneDisplay(phone),
    tujuan: input.template.name,
    status: 'Success',
    requestId: `req_${now.getTime().toString(36)}${index.toString(36)}`,
  }));
  const cost = logs.length * OTP_COST_PER_MESSAGE;
  appendSendLogs(logs);
  addFeatureSpend('otp', cost);
  return { logs, cost };
}

export function canAffordOtp(count: number) {
  return remainingBalance(getAccount()) >= count * OTP_COST_PER_MESSAGE;
}
