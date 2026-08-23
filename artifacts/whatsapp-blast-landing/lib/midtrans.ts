/** Production origin for Midtrans MAP redirects */
export const MIDTRANS_PUBLIC_ORIGIN = 'https://orarepot.com';

/** Set these in Midtrans MAP → Settings → Snap Preferences → Redirection */
export const MIDTRANS_FINISH_PATH = '/pay/finish';
export const MIDTRANS_ERROR_PATH = '/pay/error';
export const MIDTRANS_UNFINISH_PATH = '/pay/error';

export const MIDTRANS_FINISH_URL = `${MIDTRANS_PUBLIC_ORIGIN}${MIDTRANS_FINISH_PATH}`;
export const MIDTRANS_ERROR_URL = `${MIDTRANS_PUBLIC_ORIGIN}${MIDTRANS_ERROR_PATH}`;

export const midtransClientKey =
  process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.trim() ?? '';

export const midtransMerchantId =
  process.env.NEXT_PUBLIC_MIDTRANS_MERCHANT_ID?.trim() ?? '';

export function isMidtransProduction() {
  const flag = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return midtransClientKey.startsWith('Mid-client-');
}

export function midtransSnapScriptUrl() {
  return isMidtransProduction()
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';
}

export function midtransSnapApiUrl() {
  return isMidtransProduction()
    ? 'https://app.midtrans.com/snap/v1/transactions'
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
}

/** Snap only accepts `id` | `en` — same codes as the site locale. */
export function midtransLanguage(locale: string | null | undefined): 'id' | 'en' {
  return locale === 'en' ? 'en' : 'id';
}

export function midtransItemName(language: 'id' | 'en') {
  return language === 'en' ? 'Ora Repot Deposit' : 'Deposit Ora Repot';
}

export type SnapResult = {
  status_code?: string;
  status_message?: string;
  transaction_id?: string;
  order_id?: string;
  gross_amount?: string;
  payment_type?: string;
  transaction_status?: string;
  fraud_status?: string;
};

export type MidtransSnap = {
  pay: (
    token: string,
    options?: {
      language?: 'en' | 'id';
      onSuccess?: (result: SnapResult) => void;
      onPending?: (result: SnapResult) => void;
      onError?: (result: SnapResult) => void;
      onClose?: () => void;
    },
  ) => void;
  hide: () => void;
};
