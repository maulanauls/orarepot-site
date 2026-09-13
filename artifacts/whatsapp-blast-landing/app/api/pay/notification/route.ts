import { NextResponse } from 'next/server';

function callbackUrl() {
  if (process.env.BILLING_CALLBACK_URL?.trim()) {
    return process.env.BILLING_CALLBACK_URL.trim();
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://127.0.0.1:8102/billing/payments/midtrans';
  }
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.orarepot.com').replace(
    /\/$/,
    '',
  );
  return `${base}/billing/payments/midtrans`;
}

export async function POST(request: Request) {
  const body = await request.text();
  try {
    const res = await fetch(callbackUrl(), {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || 'application/json' },
      body,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return NextResponse.json({ error: 'billing callback unreachable' }, { status: 502 });
  }
}
