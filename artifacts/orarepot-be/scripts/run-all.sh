#!/usr/bin/env bash
# Start every Ora Repot backend service against the remote Postgres in .env.
# Local .env uses the Midtrans sandbox key. Production Docker uses pipeline/script/env/orarepot-be.env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing $ROOT/.env" >&2
  exit 1
fi

cmd="${1:-up}"

case "$cmd" in
  up)
    docker compose up --build -d
    echo
    mode="$(grep -E '^MIDTRANS_IS_PRODUCTION=' .env | tail -n 1 | cut -d= -f2-)"
    if [[ "$mode" == "true" ]]; then
      echo "Midtrans: production"
    else
      echo "Midtrans: sandbox"
    fi
    echo
    echo "Gateway   http://127.0.0.1:8080"
    echo "identity  http://127.0.0.1:8101"
    echo "billing   http://127.0.0.1:8102"
    echo "otp       http://127.0.0.1:8103"
    echo "members   http://127.0.0.1:8201"
    echo "merchant  http://127.0.0.1:8202"
    echo "templates http://127.0.0.1:8203"
    echo "developer http://127.0.0.1:8204"
    echo "reporting http://127.0.0.1:8205"
    echo
    echo "Logs: $0 logs"
    echo "Stop: $0 down"
    ;;
  down)
    docker compose down
    ;;
  logs)
    docker compose logs -f --tail=100
    ;;
  *)
    echo "Usage: $0 [up|down|logs]" >&2
    exit 1
    ;;
esac
