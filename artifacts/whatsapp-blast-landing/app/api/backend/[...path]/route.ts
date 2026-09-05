import { NextRequest } from 'next/server';

const MAP: Record<string, string> = {
  auth: 'http://127.0.0.1:8101',
  members: 'http://127.0.0.1:8201',
  teams: 'http://127.0.0.1:8201',
  merchant: 'http://127.0.0.1:8202',
  billing: 'http://127.0.0.1:8102',
  templates: 'http://127.0.0.1:8203',
  otp: 'http://127.0.0.1:8103',
  developer: 'http://127.0.0.1:8204',
  v1: 'http://127.0.0.1:8204',
  reports: 'http://127.0.0.1:8205',
};

function userIdFromAuth(header: string | null): string | null {
  if (!header?.startsWith('Bearer ')) return null;
  const parts = header.slice(7).split('.');
  if (parts.length < 2) return null;
  try {
    const json = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
        'utf8',
      ),
    ) as { sub?: string };
    return json.sub ?? null;
  } catch {
    return null;
  }
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const head = path?.[0];
  const base = head ? MAP[head] : undefined;
  if (!base) {
    return Response.json({ error: 'unknown route' }, { status: 404 });
  }
  const target = `${base}/${path.join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const userId = userIdFromAuth(auth);
  if (userId) headers.set('x-user-id', userId);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  try {
    const res = await fetch(target, init);
    const out = new Headers();
    const resType = res.headers.get('content-type');
    if (resType) out.set('content-type', resType);
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return Response.json(
      { error: `backend ${head} unreachable` },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
