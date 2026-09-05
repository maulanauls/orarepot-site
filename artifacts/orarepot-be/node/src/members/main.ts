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
import { createHash, randomBytes } from 'crypto';
import { bootstrap, HealthModule } from '../common/nest';
import { httpError, insertOutbox, one, q, requireUser } from '../common/db';

@Controller()
class MembersController {
  @Get('members/me')
  async me(@Headers() headers: Record<string, string>) {
    const userId = requireUser(headers);
    return q(
      `SELECT id, merchant_id, user_id, email::text AS email, full_name,
              role::text AS role, status::text AS status, joined_at
       FROM mt_members
       WHERE user_id = $1 AND status = 'active'
       ORDER BY joined_at DESC NULLS LAST, created_at DESC`,
      [userId],
    );
  }

  @Get('members')
  async list(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, user_id, email::text AS email, full_name, image_url,
              role::text AS role, status::text AS status, team_id, joined_at, created_at
       FROM mt_members
       WHERE merchant_id = $1 AND status <> 'removed'
       ORDER BY created_at DESC`,
      [merchantId],
    );
  }

  @Get('teams')
  async teams(@Query('merchantId') merchantId: string) {
    if (!merchantId) throw httpError(400, 'merchantId required');
    return q(
      `SELECT id, merchant_id, name, slug::text AS slug, created_at
       FROM mt_teams WHERE merchant_id = $1 ORDER BY name`,
      [merchantId],
    );
  }

  @Post('teams')
  async createTeam(
    @Headers() headers: Record<string, string>,
    @Body() body: { merchantId: string; name: string; slug: string },
  ) {
    requireUser(headers);
    const row = await one(
      `INSERT INTO mt_teams (merchant_id, name, slug) VALUES ($1,$2,$3)
       RETURNING id, merchant_id, name, slug::text AS slug`,
      [body.merchantId, body.name, body.slug],
    );
    return row;
  }

  @Post('members/owners')
  async bootstrapOwner(
    @Headers() headers: Record<string, string>,
    @Body() body: { merchantId: string; email: string; fullName?: string },
  ) {
    const userId = requireUser(headers);
    const existing = await one<{ id: string }>(
      `SELECT id FROM mt_members WHERE merchant_id = $1 AND role = 'owner' AND status = 'active'`,
      [body.merchantId],
    );
    if (existing) return existing;
    return one(
      `INSERT INTO mt_members (merchant_id, user_id, email, full_name, role, status, joined_at)
       VALUES ($1,$2,$3,$4,'owner','active', now())
       RETURNING id, merchant_id, user_id, email::text AS email, role::text AS role, status::text AS status`,
      [body.merchantId, userId, body.email.toLowerCase(), body.fullName ?? 'Owner'],
    );
  }

  @Post('members/invites')
  async invite(
    @Headers() headers: Record<string, string>,
    @Body()
    body: {
      merchantId: string;
      email: string;
      fullName?: string;
      role?: 'admin' | 'agent';
      teamId?: string | null;
    },
  ) {
    const actor = requireUser(headers);
    if (!body.merchantId || !body.email) throw httpError(400, 'merchantId and email required');
    const role = body.role ?? 'agent';
    const member = await one<{ id: string }>(
      `INSERT INTO mt_members (merchant_id, email, full_name, role, status, team_id, invited_by)
       VALUES ($1,$2,$3,$4,'invited',$5,$6)
       RETURNING id`,
      [
        body.merchantId,
        body.email.toLowerCase(),
        body.fullName ?? null,
        role,
        body.teamId ?? null,
        actor,
      ],
    );
    if (!member) throw httpError(500, 'invite failed');
    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invite = await one(
      `INSERT INTO tx_member_invites
         (merchant_id, member_id, email, role, team_id, invited_by, token_hash, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now() + interval '7 days')
       RETURNING id, email::text AS email, role::text AS role, status::text AS status, expires_at`,
      [body.merchantId, member.id, body.email.toLowerCase(), role, body.teamId ?? null, actor, tokenHash],
    );
    await q(
      `INSERT INTO cm_member_audits (merchant_id, actor_user_id, member_id, action, payload)
       VALUES ($1,$2,$3,'invited',$4::jsonb)`,
      [body.merchantId, actor, member.id, JSON.stringify({ email: body.email, role })],
    );
    await insertOutbox('orarepot.member.invited', 'member', member.id, {
      memberId: member.id,
      email: body.email,
      merchantId: body.merchantId,
    });
    return { ...invite, memberId: member.id, token };
  }

  @Post('members/invites/:id/accept')
  async accept(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { token: string },
  ) {
    const userId = requireUser(headers);
    const tokenHash = createHash('sha256').update(body.token ?? '').digest('hex');
    const invite = await one<{ member_id: string; merchant_id: string; status: string }>(
      `SELECT member_id, merchant_id, status::text AS status
       FROM tx_member_invites WHERE id = $1 AND token_hash = $2`,
      [id, tokenHash],
    );
    if (!invite || invite.status !== 'pending') throw httpError(400, 'invalid invite');
    await q(
      `UPDATE tx_member_invites SET status = 'accepted', accepted_at = now() WHERE id = $1`,
      [id],
    );
    await q(
      `UPDATE mt_members SET user_id = $2, status = 'active', joined_at = now() WHERE id = $1`,
      [invite.member_id, userId],
    );
    await insertOutbox('orarepot.member.joined', 'member', invite.member_id, {
      memberId: invite.member_id,
      userId,
      merchantId: invite.merchant_id,
    });
    return { ok: true, memberId: invite.member_id };
  }

  @Patch('members/:id')
  async patch(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { role?: string; status?: string; teamId?: string | null },
  ) {
    requireUser(headers);
    const row = await one(
      `UPDATE mt_members SET
         role = COALESCE($2::member_role, role),
         status = COALESCE($3::member_status, status),
         team_id = COALESCE($4, team_id)
       WHERE id = $1
       RETURNING id, email::text AS email, role::text AS role, status::text AS status, team_id`,
      [id, body.role ?? null, body.status ?? null, body.teamId ?? null],
    );
    if (!row) throw httpError(404, 'member not found');
    return row;
  }
}

@Module({ imports: [HealthModule], controllers: [MembersController] })
class AppModule {}

bootstrap(AppModule, 'PORT', 8201);
