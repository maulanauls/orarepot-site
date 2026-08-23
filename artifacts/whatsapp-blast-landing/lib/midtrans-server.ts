import {
  MIDTRANS_ERROR_PATH,
  MIDTRANS_FINISH_PATH,
  MIDTRANS_UNFINISH_PATH,
  midtransItemName,
  midtransLanguage,
  midtransSnapApiUrl,
} from '@/lib/midtrans';

export type SnapTokenInput = {
  orderId: string;
  amount: number;
  customerName: string;
  customerRef?: string;
  origin: string;
  language?: string;
};

export type SnapTokenResult = {
  token: string;
  redirectUrl?: string;
  orderId: string;
};

function serverKey() {
  return process.env.MIDTRANS_SERVER_KEY?.trim() ?? '';
}

export function hasMidtransServerKey() {
  return serverKey().length > 0;
}

function authHeader() {
  return `Basic ${Buffer.from(`${serverKey()}:`).toString('base64')}`;
}

function withSnapLanguage(url: string | undefined, language: 'id' | 'en') {
  if (!url) return url;
  const join = url.includes('?') ? '&' : '?';
  return `${url}${join}language=${language}`;
}

async function postSnapTransaction(input: SnapTokenInput) {
  const language = midtransLanguage(input.language);
  const payload = {
    transaction_details: {
      order_id: input.orderId,
      gross_amount: input.amount,
    },
    item_details: [
      {
        id: 'orarepot-deposit',
        name: midtransItemName(language),
        price: input.amount,
        quantity: 1,
      },
    ],
    customer_details: {
      first_name: input.customerName || 'Ora Repot Merchant',
      last_name: input.customerRef || 'ORAREPOT',
    },
    callbacks: {
      finish: `${input.origin}${MIDTRANS_FINISH_PATH}`,
      error: `${input.origin}${MIDTRANS_ERROR_PATH}`,
      unfinish: `${input.origin}${MIDTRANS_UNFINISH_PATH}`,
    },
  };

  const res = await fetch(midtransSnapApiUrl(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    redirect_url?: string;
    error_messages?: string[];
    status_message?: string;
    status_code?: string;
  };

  return { ok: res.ok, status: res.status, data };
}

function isDuplicateOrder(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes('order_id') &&
    (text.includes('taken') ||
      text.includes('exists') ||
      text.includes('used') ||
      text.includes('sudah') ||
      text.includes('duplicate'))
  );
}

export async function createSnapToken(
  input: SnapTokenInput,
): Promise<SnapTokenResult> {
  if (!hasMidtransServerKey()) {
    throw new Error('MIDTRANS_SERVER_KEY is not set');
  }

  const language = midtransLanguage(input.language);

  const first = await postSnapTransaction(input);
  if (first.ok && first.data.token) {
    return {
      token: first.data.token,
      redirectUrl: withSnapLanguage(first.data.redirect_url, language),
      orderId: input.orderId,
    };
  }

  const message = [
    first.data.status_message,
    ...(first.data.error_messages ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  if (isDuplicateOrder(message)) {
    const retryId = `${input.orderId}-${Date.now().toString(36)}`;
    const retry = await postSnapTransaction({ ...input, orderId: retryId });
    if (retry.ok && retry.data.token) {
      return {
        token: retry.data.token,
        redirectUrl: withSnapLanguage(retry.data.redirect_url, language),
        orderId: retryId,
      };
    }
    throw new Error(
      [retry.data.status_message, ...(retry.data.error_messages ?? [])]
        .filter(Boolean)
        .join(' ') || 'Midtrans rejected the retry order',
    );
  }

  throw new Error(message || `Midtrans Snap error (${first.status})`);
}
