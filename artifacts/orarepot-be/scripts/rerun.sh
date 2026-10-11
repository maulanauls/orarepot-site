#!/usr/bin/env bash
# Rebuild and restart backend services after a code change.
# Uses the local .env (Midtrans sandbox). Does not touch the production deploy env.
#
#   ./scripts/rerun.sh              all services
#   ./scripts/rerun.sh billing      only billing
#   ./scripts/rerun.sh billing identity
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/.env" >&2
  exit 1
fi

if [[ $# -eq 0 ]]; then
  echo "Rebuilding all backend services..."
  docker compose up --build -d --force-recreate
else
  echo "Rebuilding: $*"
  docker compose up --build -d --force-recreate "$@"
fi

echo
mode="$(grep -E '^MIDTRANS_IS_PRODUCTION=' .env | tail -n 1 | cut -d= -f2-)"
if [[ "$mode" == "true" ]]; then
  echo "Midtrans: production"
else
  echo "Midtrans: sandbox"
fi
echo
docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
