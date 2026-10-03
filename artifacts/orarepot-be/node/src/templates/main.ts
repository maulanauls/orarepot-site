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
  Query,
} from '@nestjs/common';
import { bootstrap, HealthModule } from '../common/nest';
import {
  httpError,
  insertOutbox,
  one,
  q,
  requireInternal,
  requireUser,
} from '../common/db';

@Controller()
class TemplatesController {
  @Get('templates')
  async list(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, name, category::text AS category, language, language_code,
              status::text AS status, status_label, body, button_label, meta_template_id, created_at
       FROM mt_templates WHERE merchant_id = $1 ORDER BY created_at DESC`,
      [merchantId],
    );
  }

  @Post('templates')
  async create(
    @Headers() headers: Record<string, string>,
    @Body()
    body: {
      merchantId: string;
      name: string;
      body: string;
      category?: string;
      language?: string;
      languageCode?: string;
      buttonLabel?: string;
    },
  ) {
    requireUser(headers);
    const row = await one<{ id: string }>(
      `INSERT INTO mt_templates
         (merchant_id, name, body, category, language, language_code, button_label, status, status_label)
       VALUES ($1,$2,$3, COALESCE($4::template_category,'AUTHENTICATION'),
               COALESCE($5,'Indonesian'), COALESCE($6,'id'), $7, 'PENDING', 'Menunggu review Meta')
       RETURNING id, merchant_id, name, status::text AS status, body`,
      [
        body.merchantId,
        body.name,
        body.body,
        body.category ?? null,
        body.language ?? null,
        body.languageCode ?? null,
        body.buttonLabel ?? null,
      ],
    );
    if (!row) throw httpError(500, 'create failed');
    await insertOutbox('orarepot.template.updated', 'template', row.id, row);
    return row;
  }

  @Patch('templates/:id')
  async patch(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { status?: string; statusLabel?: string; body?: string; buttonLabel?: string },
  ) {
    requireUser(headers);
    const row = await one<{ id: string }>(
      `UPDATE mt_templates SET
         status = COALESCE($2::template_status, status),
         status_label = COALESCE($3, status_label),
         body = COALESCE($4, body),
         button_label = COALESCE($5, button_label)
       WHERE id = $1
       RETURNING id, merchant_id, name, status::text AS status, body, button_label`,
      [id, body.status ?? null, body.statusLabel ?? null, body.body ?? null, body.buttonLabel ?? null],
    );
    if (!row) throw httpError(404, 'template not found');
    await insertOutbox('orarepot.template.updated', 'template', row.id, row);
    return row;
  }

  @Get('internal/templates/by-name')
  async internalByName(
    @Headers() headers: Record<string, string>,
    @Query('merchantId') merchantId: string,
    @Query('name') name: string,
  ) {
    requireInternal(headers);
    if (!merchantId || !name?.trim()) throw httpError(400, 'merchantId and name required');
    const existing = await one<{ id: string; name: string; status: string; language_code: string }>(
      `SELECT id, name, status::text AS status, language_code
       FROM mt_templates WHERE merchant_id = $1 AND name = $2`,
      [merchantId, name.trim()],
    );
    if (existing) return existing;
    const platform = platformTemplate(name.trim());
    if (!platform) throw httpError(404, 'template not found');
    const created = await one<{ id: string; name: string; status: string; language_code: string }>(
      `INSERT INTO mt_templates
         (merchant_id, name, body, category, language, language_code, button_label, status, status_label)
       VALUES ($1,$2,$3,'AUTHENTICATION',$4,$5,$6,'ACTIVE','Active')
       ON CONFLICT (merchant_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, status::text AS status, language_code`,
      [merchantId, platform.name, platform.body, platform.language, platform.languageCode, platform.button],
    );
    if (!created) throw httpError(500, 'template create failed');
    return created;
  }

  @Get('internal/templates/:id')
  async internalGet(@Headers() headers: Record<string, string>, @Param('id') id: string) {
    requireInternal(headers);
    const row = await one(
      `SELECT id, merchant_id, name, status::text AS status, body, language_code
       FROM mt_templates WHERE id = $1`,
      [id],
    );
    if (!row) throw httpError(404, 'template not found');
    return row;
  }
}

@Module({ imports: [HealthModule], controllers: [TemplatesController] })
class AppModule {}

function platformTemplate(name: string) {
  if (name === 'otp_merchant_id') {
    return {
      name,
      language: 'Indonesian',
      languageCode: 'id',
      body: '*{{1}}* adalah kode verifikasi Anda. Demi keamanan, jangan bagikan kode ini.',
      button: 'Salin Kode',
    };
  }
  if (name === 'otp_merchant') {
    return {
      name,
      language: 'English',
      languageCode: 'en',
      body: '*{{1}}* is your verification code. For your security, do not share this code.',
      button: 'Copy Code',
    };
  }
  return null;
}

bootstrap(AppModule, 'PORT', 8203);
