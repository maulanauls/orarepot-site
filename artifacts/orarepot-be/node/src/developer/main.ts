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

  @Post('v1/otp/sends')
  async publicSend(@Req() req: { headers: Record<string, string>; ip?: string }, @Body() body: {
    templateId: string;
    phoneE164: string;
    requestId?: string;
    code?: string;
  }) {
    const auth = req.headers.authorization ?? '';
    const raw = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!raw.startsWith('orp_live_')) throw httpError(401, 'api key required');
    const key = await one<{ id: string; merchant_id: string }>(
      `SELECT id, merchant_id FROM mt_api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
      [sha(raw)],
    );
    if (!key) throw httpError(401, 'invalid api key');
    const started = Date.now();
    const otpUrl = process.env.OTP_URL ?? 'http://127.0.0.1:8103';
    const res = await fetch(`${otpUrl}/otp/sends`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchant_id: key.merchant_id,
        template_id: body.templateId,
        phone_e164: body.phoneE164,
        request_id: body.requestId,
        code: body.code,
      }),
    });
    const json = await res.json();
    await q(
      `INSERT INTO cm_api_request_logs (merchant_id, api_key_id, method, path, status, ip, duration_ms)
       VALUES ($1,$2,'POST','/v1/otp/sends',$3,$4,$5)`,
      [key.merchant_id, key.id, res.status, req.ip ?? null, Date.now() - started],
    );
    await q(`UPDATE mt_api_keys SET last_used_at = now() WHERE id = $1`, [key.id]);
    if (!res.ok) throw httpError(res.status, JSON.stringify(json));
    return json;
  }
}

@Module({ imports: [HealthModule], controllers: [DeveloperController] })
class AppModule {}

bootstrap(AppModule, 'PORT', 8204);
