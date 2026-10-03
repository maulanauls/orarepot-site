import 'reflect-metadata';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Module,
  OnModuleInit,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { createHash, randomBytes, createHmac } from 'crypto';
import { bootstrap, HealthModule } from '../common/nest';
import { httpError, one, q, requireUser } from '../common/db';
import { createKafka } from '../common/kafka';

function sha(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

@Controller()
class DeveloperController implements OnModuleInit {
  async onModuleInit() {
    const kafka = createKafka('orarepot-developer');
    if (!kafka) return;
    try {
      const consumer = kafka.consumer({ groupId: 'orarepot-developer' });
      await consumer.connect();
      await consumer.subscribe({ topics: ['orarepot.otp.sent', 'orarepot.otp.failed'] });
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const payload = JSON.parse(message.value.toString()) as {
          merchant_id?: string;
          id?: string;
        };
        if (!payload.merchant_id) return;
        const hook = await one<{ id: string; url: string; secret_hash: string; enabled: boolean }>(
          `SELECT id, url, secret_hash, enabled FROM mt_webhooks WHERE merchant_id = $1`,
          [payload.merchant_id],
        );
        if (!hook || !hook.enabled) return;
        const event = topic.endsWith('failed') ? 'otp.failed' : 'otp.sent';
        const body = JSON.stringify({ event, data: payload });
        const sig = createHmac('sha256', hook.secret_hash).update(body).digest('hex');
        let status = 0;
        let ok = false;
        let responseBody = '';
        try {
          const res = await fetch(hook.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-orarepot-signature': sig,
            },
            body,
          });
          status = res.status;
          ok = res.ok;
          responseBody = await res.text();
        } catch (err) {
          responseBody = err instanceof Error ? err.message : 'fetch failed';
        }
        await q(
          `INSERT INTO cm_webhook_deliveries
             (webhook_id, merchant_id, event, otp_send_id, url, status, http_status, request_body, response_body)
           VALUES ($1,$2,$3::webhook_event,$4,$5,$6::delivery_status,$7,$8::jsonb,$9)`,
          [
            hook.id,
            payload.merchant_id,
            event,
            payload.id ?? null,
            hook.url,
            ok ? 'success' : 'failed',
            status || null,
            body,
            responseBody.slice(0, 2000),
          ],
        );
      },
    });
    } catch (err) {
      console.error('developer kafka consumer skipped', err);
    }
  }

  @Get('developer/keys')
  async keys(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, name, prefix, last4, last_used_at, revoked_at, created_at
       FROM mt_api_keys WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId],
    );
  }

  @Post('developer/keys')
  async createKey(
    @Headers() headers: Record<string, string>,
    @Body() body: { merchantId: string; name: string },
  ) {
    requireUser(headers);
    const raw = `orp_live_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 16);
    const last4 = raw.slice(-4);
    const row = await one(
      `INSERT INTO mt_api_keys (merchant_id, name, prefix, last4, key_hash)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, merchant_id, name, prefix, last4, created_at`,
      [body.merchantId, body.name, prefix, last4, sha(raw)],
    );
    return { ...row, key: raw };
  }

  @Delete('developer/keys/:id')
  async revoke(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    requireUser(headers);
    await q(`UPDATE mt_api_keys SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`, [id]);
    return { ok: true };
  }

  @Get('developer/webhooks')
  async getWebhook(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    const row = await one(
      `SELECT id, merchant_id, url, enabled, events, created_at FROM mt_webhooks WHERE merchant_id = $1`,
      [merchantId],
    );
    return row ?? {};
  }

  @Get('developer/request-logs')
  async requestLogs(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT l.id, l.merchant_id, l.api_key_id, l.method, l.path, l.status,
              host(l.ip)::text AS ip, l.duration_ms, l.created_at,
              k.prefix, k.last4
       FROM cm_api_request_logs l
       LEFT JOIN mt_api_keys k ON k.id = l.api_key_id
       WHERE l.merchant_id = $1
       ORDER BY l.created_at DESC
       LIMIT 100`,
      [merchantId],
    );
  }

  @Get('developer/webhook-deliveries')
  async webhookDeliveries(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, event::text AS event, url, status::text AS status,
              http_status, created_at
       FROM cm_webhook_deliveries
       WHERE merchant_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [merchantId],
    );
  }

  @Put('developer/webhooks')
  async putWebhook(
    @Headers() headers: Record<string, string>,
    @Body() body: { merchantId: string; url: string; enabled?: boolean },
  ) {
    requireUser(headers);
    if (!/^https:\/\//i.test(body.url)) throw httpError(400, 'webhook url must be https');
    const secret = randomBytes(32).toString('hex');
    const row = await one(
      `INSERT INTO mt_webhooks (merchant_id, url, secret_hash, enabled)
       VALUES ($1,$2,$3, COALESCE($4, true))
       ON CONFLICT (merchant_id) DO UPDATE SET url = EXCLUDED.url, secret_hash = EXCLUDED.secret_hash, enabled = EXCLUDED.enabled
       RETURNING id, merchant_id, url, enabled`,
      [body.merchantId, body.url, sha(secret), body.enabled ?? true],
    );
    return { ...row, secret };
  }

  @Post('v1/otp/send')
  async publicSendAlias(
    @Req() req: { headers: Record<string, string>; ip?: string },
    @Body() body: PublicSendBody,
  ) {
    return this.publicSend(req, body);
  }

  @Post('v1/otp/sends')
  async publicSend(@Req() req: { headers: Record<string, string>; ip?: string }, @Body() body: PublicSendBody) {
    const started = Date.now();
    const auth = headerValue(req.headers, 'authorization');
    const raw = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!raw.startsWith('orp_live_')) throw httpError(401, 'api key required');
    const key = await one<{ id: string; merchant_id: string; revoked_at: string | null }>(
      `SELECT id, merchant_id, revoked_at FROM mt_api_keys WHERE key_hash = $1`,
      [sha(raw)],
    );
    if (!key) throw httpError(401, 'invalid api key');
    if (key.revoked_at) throw httpError(401, 'api key revoked');

    const phone = toE164(body.to ?? body.phoneE164 ?? body.phone_e164 ?? '');
    const templateName = (body.template ?? body.templateId ?? body.template_id ?? '').trim();
    const code = (body.code ?? '').trim();
    if (!phone) throw httpError(400, 'to must be E.164, for example +628123456789');
    if (!templateName) throw httpError(400, 'template is required');
    if (code && !/^\d{4,8}$/.test(code)) throw httpError(400, 'code must be 4 to 8 digits');

    const quota = await assertCanSendOtp(key.merchant_id);
    const template = await resolveTemplate(key.merchant_id, templateName);

    const otpUrl = process.env.OTP_URL ?? 'http://127.0.0.1:8103';
    const res = await fetch(`${otpUrl}/otp/sends`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchant_id: key.merchant_id,
        template_id: template.id,
        phone_e164: phone,
        request_id: body.requestId ?? body.request_id,
        code: code || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      request_id?: string;
      status?: string;
      phone_e164?: string;
      cost_idr?: number;
    };
    const status = quotaError(json.error) ? 402 : res.status;
    await q(
      `INSERT INTO cm_api_request_logs (merchant_id, api_key_id, method, path, status, ip, duration_ms)
       VALUES ($1,$2,'POST','/v1/otp/send',$3,$4,$5)`,
      [key.merchant_id, key.id, status, req.ip ?? null, Date.now() - started],
    );
    await q(`UPDATE mt_api_keys SET last_used_at = now() WHERE id = $1`, [key.id]);
    if (!res.ok) {
      if (quotaError(json.error)) {
        throw httpError(402, 'OTP quota is used up for this subscription. Top up in Billing.');
      }
      throw httpError(status, json.error || 'otp send failed');
    }
    const after = await loadQuota(key.merchant_id);
    return {
      request_id: json.request_id,
      status: json.status,
      to: json.phone_e164 ?? phone,
      cost_idr: json.cost_idr ?? 0,
      quota: after ?? quota,
    };
  }
}

type PublicSendBody = {
  to?: string;
  phoneE164?: string;
  phone_e164?: string;
  template?: string;
  templateId?: string;
  template_id?: string;
  code?: string;
  requestId?: string;
  request_id?: string;
};

const OTP_COST_IDR = 600;

type Quota = {
  plan: string;
  trial_left: number;
  balance_idr: number;
  otp_left: number;
  cost_idr: number;
};

function headerValue(headers: Record<string, string | string[] | undefined>, name: string) {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(raw) ? raw[0] : raw) ?? '';
}

function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  let e164 = '';
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (digits.startsWith('62')) e164 = `+${digits}`;
  else if (digits.startsWith('0')) e164 = `+62${digits.slice(1)}`;
  else e164 = `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

function quotaError(message?: string) {
  const text = (message ?? '').toLowerCase();
  return text.includes('insufficient') || text.includes('quota') || text.includes('balance');
}

async function loadQuota(merchantId: string): Promise<Quota | null> {
  const billingUrl = process.env.BILLING_URL ?? 'http://127.0.0.1:8102';
  const merchantUrl = process.env.MERCHANT_URL ?? 'http://127.0.0.1:8202';
  const [walletRes, merchantRes] = await Promise.all([
    fetch(`${billingUrl}/billing/wallets/${merchantId}`),
    fetch(`${merchantUrl}/merchant/${merchantId}`),
  ]);
  const wallet = walletRes.ok
    ? ((await walletRes.json()) as { remaining_idr?: number; trial_otp_left?: number })
    : null;
  const merchant = merchantRes.ok
    ? ((await merchantRes.json()) as {
        subscription?: { plan?: string; status?: string; trial_ends_at?: string | null } | null;
      })
    : null;
  const balance = Number(wallet?.remaining_idr ?? 0);
  const trialLeft = Number(wallet?.trial_otp_left ?? 0);
  const paidLeft = Math.floor(balance / OTP_COST_IDR);
  return {
    plan: merchant?.subscription?.plan ?? 'trial',
    trial_left: trialLeft,
    balance_idr: balance,
    otp_left: trialLeft + paidLeft,
    cost_idr: OTP_COST_IDR,
  };
}

async function assertCanSendOtp(merchantId: string): Promise<Quota> {
  const merchantUrl = process.env.MERCHANT_URL ?? 'http://127.0.0.1:8202';
  const merchantRes = await fetch(`${merchantUrl}/merchant/${merchantId}`);
  if (!merchantRes.ok) throw httpError(402, 'subscription not found');
  const merchant = (await merchantRes.json()) as {
    subscription?: { plan?: string; status?: string; trial_ends_at?: string | null } | null;
  };
  const sub = merchant.subscription;
  if (!sub || sub.status === 'canceled') {
    throw httpError(402, 'subscription is not active');
  }
  if (sub.plan === 'broadcast') {
    throw httpError(402, 'this plan does not include OTP sends');
  }
  if (sub.status === 'past_due') {
    throw httpError(402, 'subscription payment is past due');
  }
  const quota = await loadQuota(merchantId);
  if (!quota || quota.otp_left < 1) {
    throw httpError(402, 'OTP quota is used up for this subscription. Top up in Billing.');
  }
  return quota;
}

async function resolveTemplate(merchantId: string, nameOrId: string) {
  const templatesUrl = process.env.TEMPLATES_URL ?? 'http://127.0.0.1:8203';
  const internalKey = process.env.INTERNAL_KEY ?? '';
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nameOrId);
  const url = isUuid
    ? `${templatesUrl}/internal/templates/${nameOrId}`
    : `${templatesUrl}/internal/templates/by-name?merchantId=${encodeURIComponent(merchantId)}&name=${encodeURIComponent(nameOrId)}`;
  const res = await fetch(url, { headers: { 'x-internal-key': internalKey } });
  const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: string };
  if (!res.ok || !json.id) throw httpError(400, json.error || 'template not found');
  if (json.status && json.status !== 'ACTIVE') throw httpError(400, 'template is not ACTIVE');
  return { id: json.id };
}

@Module({ imports: [HealthModule], controllers: [DeveloperController] })
class AppModule {}

bootstrap(AppModule, 'PORT', 8204);
