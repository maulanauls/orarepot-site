import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Headers,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { bootstrap, HealthModule } from '../common/nest';
import { httpError, insertOutbox, one, q, requireUser } from '../common/db';

@Controller('merchant')
class MerchantController {
  @Get(':id')
  async get(@Param('id') id: string) {
    const merchant = await one(
      `SELECT id, slug::text AS slug, display_name, status::text AS status, locale::text AS locale, created_at
       FROM mt_merchants WHERE id = $1`,
      [id],
    );
    if (!merchant) throw httpError(404, 'merchant not found');
    const subscription = await one(
      `SELECT id, plan::text AS plan, status::text AS status, trial_ends_at,
              current_period_start, current_period_end
       FROM mt_subscriptions WHERE merchant_id = $1
         AND status IN ('trial','active','past_due')
       LIMIT 1`,
      [id],
    );
    return { ...merchant, subscription };
  }

  @Post()
  async create(
    @Headers() headers: Record<string, string>,
    @Body() body: { slug: string; displayName: string; locale?: string },
  ) {
    requireUser(headers);
    const merchant = await one<{ id: string }>(
      `INSERT INTO mt_merchants (slug, display_name, locale)
       VALUES ($1,$2, COALESCE($3::locale_code, 'id'))
       RETURNING id, slug::text AS slug, display_name, status::text AS status`,
      [body.slug, body.displayName, body.locale ?? 'id'],
    );
    if (!merchant) throw httpError(500, 'create failed');
    await q(
      `INSERT INTO mt_subscriptions (merchant_id, plan, status, trial_ends_at, current_period_end)
       VALUES ($1,'trial','trial', now() + interval '14 days', now() + interval '14 days')`,
      [merchant.id],
    );
    await insertOutbox('orarepot.merchant.created', 'merchant', merchant.id, merchant);
    return merchant;
  }

  @Patch(':id')
  async patch(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { displayName?: string; status?: string; locale?: string },
  ) {
    requireUser(headers);
    const row = await one(
      `UPDATE mt_merchants SET
         display_name = COALESCE($2, display_name),
         status = COALESCE($3::merchant_status, status),
         locale = COALESCE($4::locale_code, locale)
       WHERE id = $1
       RETURNING id, slug::text AS slug, display_name, status::text AS status, locale::text AS locale`,
      [id, body.displayName ?? null, body.status ?? null, body.locale ?? null],
    );
    if (!row) throw httpError(404, 'merchant not found');
    return row;
  }

  @Get(':id/waba')
  async waba(@Param('id') id: string) {
    return q(
      `SELECT id, phone_e164, display_name, meta_waba_id, meta_phone_id,
              status::text AS status, connected_at
       FROM mt_waba_accounts WHERE merchant_id = $1`,
      [id],
    );
  }

  @Post(':id/waba')
  async addWaba(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body()
    body: {
      phoneE164?: string;
      displayName?: string;
      metaWabaId?: string;
      metaPhoneId?: string;
    },
  ) {
    requireUser(headers);
    const connected = Boolean(body.metaWabaId && body.metaPhoneId);
    return one(
      `INSERT INTO mt_waba_accounts
         (merchant_id, phone_e164, display_name, meta_waba_id, meta_phone_id, status, connected_at)
       VALUES ($1,$2,$3,$4,$5,$6::waba_status, CASE WHEN $6 = 'connected' THEN now() ELSE NULL END)
       RETURNING id, phone_e164, display_name, meta_waba_id, meta_phone_id, status::text AS status`,
      [
        id,
        body.phoneE164 ?? null,
        body.displayName ?? 'Ora Repot',
        body.metaWabaId ?? null,
        body.metaPhoneId ?? null,
        connected ? 'connected' : 'pending',
      ],
    );
  }
}

@Module({ imports: [HealthModule], controllers: [MerchantController] })
class AppModule {}

bootstrap(AppModule, 'PORT', 8202);
