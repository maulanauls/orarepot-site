import { NextResponse } from 'next/server';
import {
  createSnapToken,
  hasMidtransServerKey,
} from '@/lib/midtrans-server';

type SnapBody = {
  orderId?: string;
  amount?: number;
  customerName?: string;
  customerRef?: string;
  language?: string;
};

function requestOrigin(request: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  const header = request.headers.get('origin')?.trim();
  if (header) return header.replace(/\/$/, '');
  return 'http://localhost:5173';
}

export async function POST(request: Request) {
  if (!hasMidtransServerKey()) {
    return NextResponse.json(
      {
        error:
          'MIDTRANS_SERVER_KEY belum diisi. Ambil Server Key dari MAP → Settings → Access Keys, lalu taruh di .env.local.',
      },
      { status: 503 },
    );
  }

  let body: SnapBody;
  try {
    body = (await request.json()) as SnapBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const orderId = String(body.orderId ?? '').trim();
  const amount = Number(body.amount);
  const customerName = String(body.customerName ?? 'Ora Repot Merchant').trim();
  const customerRef = String(body.customerRef ?? 'ORAREPOT').trim();
  const language = body.language;

  if (!/^ORP-[A-Za-z0-9-]+$/.test(orderId)) {
    return NextResponse.json({ error: 'Invalid order id' }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount < 10_000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const snap = await createSnapToken({
      orderId,
      amount,
      customerName,
      customerRef,
      language,
      origin: requestOrigin(request),
    });
    return NextResponse.json(snap);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create Snap token';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
