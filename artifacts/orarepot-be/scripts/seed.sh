#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GW="${GATEWAY_URL:-http://127.0.0.1:8080}"

echo "Waiting for gateway $GW ..."
for i in $(seq 1 60); do
  if curl -sf "$GW/actuator/health" >/dev/null 2>&1 || curl -sf "$GW/auth/login" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

email="hello@orarepot.com"
pass="orarepot1"

register=$(curl -sS -X POST "$GW/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$email\",\"password\":\"$pass\",\"full_name\":\"Dio\"}" || true)
token=$(python3 - <<PY
import json,sys
raw='''$register'''
try:
    print(json.loads(raw).get("token") or "")
except Exception:
    print("")
PY
)
if [ -z "$token" ]; then
  login=$(curl -sS -X POST "$GW/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}")
  token=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['token'])" "$login")
fi

auth=(-H "authorization: Bearer $token" -H 'content-type: application/json')

merchant=$(curl -sS -X POST "$GW/merchant" "${auth[@]}" \
  -d '{"slug":"ora-repot","displayName":"Ora Repot"}')
merchant_id=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$merchant")

curl -sS -X POST "$GW/members/owners" "${auth[@]}" \
  -d "{\"merchantId\":\"$merchant_id\",\"email\":\"$email\",\"fullName\":\"Dio\"}" >/dev/null

curl -sS -X POST "$GW/billing/wallets" "${auth[@]}" \
  -d "{\"merchant_id\":\"$merchant_id\"}" >/dev/null
curl -sS -X POST "$GW/billing/topups" "${auth[@]}" \
  -d "{\"merchant_id\":\"$merchant_id\",\"amount_idr\":200000,\"customer_name\":\"Dio\"}" >/dev/null

curl -sS -X POST "$GW/merchant/$merchant_id/waba" "${auth[@]}" \
  -d '{"displayName":"Ora Repot","metaWabaId":"1583214010076432","metaPhoneId":"1241209412413230"}' >/dev/null

tpl=$(curl -sS -X POST "$GW/templates" "${auth[@]}" \
  -d "{\"merchantId\":\"$merchant_id\",\"name\":\"otp_verification\",\"languageCode\":\"id\",\"language\":\"Indonesian\",\"body\":\"{{1}} is your verification code. For your security, do not share this code.\",\"category\":\"AUTHENTICATION\",\"buttonLabel\":\"Salin Kode\"}")
tpl_id=$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['id'])" "$tpl")
curl -sS -X PATCH "$GW/templates/$tpl_id" "${auth[@]}" \
  -d '{"status":"ACTIVE","statusLabel":"Aktif"}' >/dev/null

key=$(curl -sS -X POST "$GW/developer/keys" "${auth[@]}" \
  -d "{\"merchantId\":\"$merchant_id\",\"name\":\"local\"}")

python3 - <<PY
import json
print("seed ok")
print("email=hello@orarepot.com")
print("password=orarepot1")
print("merchant_id=$merchant_id")
print("template_id=$tpl_id")
print("api_key=" + json.loads('''$key''').get("key",""))
print("token=$token")
PY
