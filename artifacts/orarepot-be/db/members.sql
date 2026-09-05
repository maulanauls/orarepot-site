-- Database: orarepot_members
-- Service: orarepot-members (workspace members, roles, teams, invites)
--
-- Dashboard page: /dashboard/members  ("Anggota Tim")
-- user_id is a logical FK → orarepot_identity.mt_users.id
-- merchant_id is a logical FK → orarepot_merchant.mt_merchants.id
--
-- Role capabilities (enforced in orarepot-members, not extra tables):
--   owner  billing + workspace + members; sees all chats; no auto-assign
--   admin  members + WABA numbers + team settings; sees all chats; no auto-assign
--   agent  customer chats only (own + unassigned); round-robin auto-assign

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE member_role AS ENUM ('owner', 'admin', 'agent');
CREATE TYPE member_status AS ENUM ('invited', 'active', 'suspended', 'removed');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Teams inside a merchant. "Semua team" is represented as team_id IS NULL
-- on the member row (sees every team), not a fake catch-all row.
CREATE TABLE mt_teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  name            text NOT NULL,
  slug            citext NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, slug)
);

CREATE INDEX mt_teams_merchant_idx ON mt_teams (merchant_id);

CREATE TABLE mt_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  user_id         uuid,                          -- set when invite is accepted
  email           citext NOT NULL,
  full_name       text,
  image_url       text,
  role            member_role NOT NULL DEFAULT 'agent',
  status          member_status NOT NULL DEFAULT 'invited',
  team_id         uuid REFERENCES mt_teams (id) ON DELETE SET NULL,
  invited_by      uuid,                          -- → mt_members.id or identity user
  joined_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt_members_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$'),
  CONSTRAINT mt_members_user_when_active
    CHECK (status <> 'active' OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX mt_members_merchant_user_idx
  ON mt_members (merchant_id, user_id)
  WHERE user_id IS NOT NULL AND status <> 'removed';

CREATE UNIQUE INDEX mt_members_merchant_email_idx
  ON mt_members (merchant_id, email)
  WHERE status IN ('invited', 'active', 'suspended');

-- One active owner per merchant.
CREATE UNIQUE INDEX mt_members_one_owner_idx
  ON mt_members (merchant_id)
  WHERE role = 'owner' AND status = 'active';

CREATE INDEX mt_members_merchant_role_idx
  ON mt_members (merchant_id, role)
  WHERE status = 'active';

CREATE INDEX mt_members_team_idx
  ON mt_members (team_id)
  WHERE team_id IS NOT NULL;

CREATE TABLE tx_member_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  member_id       uuid NOT NULL REFERENCES mt_members (id) ON DELETE CASCADE,
  email           citext NOT NULL,
  role            member_role NOT NULL DEFAULT 'agent',
  team_id         uuid REFERENCES mt_teams (id) ON DELETE SET NULL,
  invited_by      uuid NOT NULL,
  token_hash      text NOT NULL UNIQUE,
  status          invite_status NOT NULL DEFAULT 'pending',
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tx_member_invites_no_owner CHECK (role <> 'owner')
);

CREATE INDEX tx_member_invites_merchant_idx
  ON tx_member_invites (merchant_id, created_at DESC);

CREATE INDEX tx_member_invites_pending_idx
  ON tx_member_invites (email, status)
  WHERE status = 'pending';

CREATE TABLE cm_member_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  actor_user_id   uuid,
  member_id       uuid,
  action          text NOT NULL,                 -- invited | role_changed | suspended | removed
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cm_member_audits_merchant_idx
  ON cm_member_audits (merchant_id, created_at DESC);

CREATE TABLE cm_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic           text NOT NULL,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);

CREATE INDEX cm_outbox_unpublished_idx ON cm_outbox (created_at) WHERE published_at IS NULL;

CREATE TRIGGER mt_teams_updated_at
  BEFORE UPDATE ON mt_teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER mt_members_updated_at
  BEFORE UPDATE ON mt_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
