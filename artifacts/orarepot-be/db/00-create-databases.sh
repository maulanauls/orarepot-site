#!/bin/bash
set -euo pipefail
# Runs inside the Postgres container on first boot.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE orarepot_identity'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_identity')\gexec
  SELECT 'CREATE DATABASE orarepot_members'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_members')\gexec
  SELECT 'CREATE DATABASE orarepot_merchant'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_merchant')\gexec
  SELECT 'CREATE DATABASE orarepot_billing'    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_billing')\gexec
  SELECT 'CREATE DATABASE orarepot_templates'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_templates')\gexec
  SELECT 'CREATE DATABASE orarepot_otp'        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_otp')\gexec
  SELECT 'CREATE DATABASE orarepot_developer'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_developer')\gexec
  SELECT 'CREATE DATABASE orarepot_warehouse'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'orarepot_warehouse')\gexec
EOSQL

apply() {
  local db="$1"
  local file="$2"
  echo "Applying $file → $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" -f "/docker-entrypoint-initdb.d/sql/${file}"
}

apply orarepot_identity   identity.sql
apply orarepot_members    members.sql
apply orarepot_merchant   merchant.sql
apply orarepot_billing    billing.sql
apply orarepot_templates  templates.sql
apply orarepot_otp        otp.sql
apply orarepot_developer  developer.sql
apply orarepot_warehouse  warehouse.sql
echo "Ora Repot databases ready."
