import 'reflect-metadata';
import { Controller, Get, Module, OnModuleInit, Query } from '@nestjs/common';
import { bootstrap, HealthModule } from '../common/nest';
import { httpError, q } from '../common/db';
import { createKafka } from '../common/kafka';

@Controller('reports')
class ReportingController implements OnModuleInit {
  async onModuleInit() {
    const kafka = createKafka('orarepot-reporting');
    if (!kafka) return;
    const consumer = kafka.consumer({ groupId: 'orarepot-reporting' });
    try {
      await consumer.connect();
      await consumer.subscribe({
        topics: [
          'orarepot.otp.sent',
          'orarepot.otp.failed',
          'orarepot.wallet.captured',
          'orarepot.wallet.reserved',
          'orarepot.wallet.released',
          'orarepot.merchant.created',
        ],
      });
    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const p = JSON.parse(message.value.toString()) as Record<string, unknown>;
        if (topic.startsWith('orarepot.otp.')) {
          await q(
            `INSERT INTO fact_otp_sends (id, merchant_id, template_id, phone_e164, status, cost_idr, request_id, occurred_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8::timestamptz, now()))
             ON CONFLICT (id) DO NOTHING`,
            [
              p.id,
              p.merchant_id,
              p.template_id ?? null,
              p.phone_e164 ?? null,
              p.status ?? topic.replace('orarepot.otp.', ''),
              p.cost_idr ?? 0,
              p.request_id ?? null,
              p.occurred_at ?? null,
            ],
          );
        } else if (topic.startsWith('orarepot.wallet.')) {
          await q(
            `INSERT INTO fact_wallet_events (id, merchant_id, entry_type, reason, amount_idr, occurred_at)
             VALUES ($1,$2,$3,$4,$5, now())
             ON CONFLICT (id) DO NOTHING`,
            [
              p.id,
              p.merchant_id ?? p.id,
              topic.replace('orarepot.wallet.', ''),
              topic.replace('orarepot.wallet.', ''),
              p.amount_idr ?? 0,
            ],
          );
        } else if (topic === 'orarepot.merchant.created') {
          await q(
            `INSERT INTO dim_merchants (merchant_id, slug, display_name)
             VALUES ($1,$2,$3)
             ON CONFLICT (merchant_id) DO UPDATE SET slug = EXCLUDED.slug, display_name = EXCLUDED.display_name, updated_at = now()`,
            [p.id, p.slug ?? null, p.display_name ?? null],
          );
        }
      },
    });
    } catch (err) {
      console.error('reporting kafka consumer skipped', err);
    }
  }

  @Get('otp')
  async otp(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, status, cost_idr, phone_e164, occurred_at
       FROM fact_otp_sends WHERE merchant_id = $1
       ORDER BY occurred_at DESC LIMIT 200`,
      [merchantId],
    );
  }

  @Get('wallet')
  async wallet(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, entry_type, reason, amount_idr, occurred_at
       FROM fact_wallet_events WHERE merchant_id = $1
       ORDER BY occurred_at DESC LIMIT 200`,
      [merchantId],
    );
  }
}

@Module({ imports: [HealthModule], controllers: [ReportingController] })
class AppModule {}

bootstrap(AppModule, 'PORT', 8205);
