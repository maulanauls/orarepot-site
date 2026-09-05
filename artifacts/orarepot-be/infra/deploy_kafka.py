#!/usr/bin/env python3
"""One-shot: sync Kafka SASL into local .env and /opt/orarepot-infra on the VPS."""

from __future__ import annotations

import os
import pathlib
import re
import secrets
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
HOST = "root@84.247.149.27"
KEY = os.path.expanduser("~/.ssh/tikn_prod_server")
SSH = [
    "ssh",
    "-i",
    KEY,
    "-o",
    "IdentitiesOnly=yes",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=20",
    HOST,
]
SCP = ["scp", "-i", KEY, "-o", "IdentitiesOnly=yes", "-o", "BatchMode=yes"]


def upsert_block(text: str, block: str) -> str:
    keys = (
        "KAFKA_BROKERS",
        "KAFKA_USERNAME",
        "KAFKA_PASSWORD",
        "KAFKA_SASL_MECHANISM",
        "KAFKA_SSL",
        "KAFKA_SSL_CA",
    )
    for key in keys:
        text = re.sub(rf"^{key}=.*\n", "", text, flags=re.M)
    text = re.sub(r"^# Kafka di VPS.*\n", "", text, flags=re.M)
    text = re.sub(r"^# Offline: docker compose --profile local-kafka.*\n", "", text, flags=re.M)
    if re.search(r"^REDIS_URL=.*$", text, re.M):
        return re.sub(r"^(REDIS_URL=.*\n)", r"\1\n" + block + "\n", text, count=1, flags=re.M)
    return text.rstrip() + "\n" + block


def main() -> int:
    env_path = ROOT / ".env"
    text = env_path.read_text()
    user = "orarepot"
    existing = re.search(r"^KAFKA_PASSWORD=(.+)$", text, re.M)
    brokers = re.search(r"^KAFKA_BROKERS=(.+)$", text, re.M)
    reuse = (
        existing
        and brokers
        and brokers.group(1).strip() == "84.247.149.27:9094"
        and existing.group(1).strip()
        and existing.group(1).strip() != "change-me"
        and re.search(r"^KAFKA_USERNAME=orarepot$", text, re.M)
    )
    pw = existing.group(1).strip() if reuse else secrets.token_urlsafe(32)
    block = (
        "# Kafka di VPS Docker (SASL). Domain tidak diperlukan.\n"
        "KAFKA_BROKERS=84.247.149.27:9094\n"
        f"KAFKA_USERNAME={user}\n"
        f"KAFKA_PASSWORD={pw}\n"
        "KAFKA_SASL_MECHANISM=plain\n"
        "KAFKA_SSL=false\n"
    )
    env_path.write_text(upsert_block(text, block))
    print("local_env_updated")

    subprocess.run(
        SCP + [str(ROOT / "infra/compose.yml"), f"{HOST}:/opt/orarepot-infra/compose.yml"],
        check=True,
    )
    print("compose_copied")

    remote_py = (
        "from pathlib import Path\n"
        "import re\n"
        "p = Path('/opt/orarepot-infra/.env')\n"
        "text = p.read_text()\n"
        "def upsert(text, key, value):\n"
        "    pat = re.compile(r'^' + re.escape(key) + r'=.*$', re.M)\n"
        "    line = key + '=' + value\n"
        "    if pat.search(text):\n"
        "        return pat.sub(line, text, count=1)\n"
        "    return text.rstrip() + '\\n' + line + '\\n'\n"
        f"text = upsert(text, 'KAFKA_USERNAME', {user!r})\n"
        f"text = upsert(text, 'KAFKA_PASSWORD', {pw!r})\n"
        "p.write_text(text)\n"
        "print('remote_env_updated')\n"
    )
    remote = (
        "set -euo pipefail\n"
        "umask 077\n"
        "python3 - <<'PY'\n"
        f"{remote_py}"
        "PY\n"
        "docker network inspect app-network >/dev/null\n"
        "cd /opt/orarepot-infra\n"
        "docker compose config -q\n"
        "docker compose up -d\n"
        "echo COMPOSE_UP_DONE\n"
    )
    r = subprocess.run(SSH + ["bash", "-s"], input=remote, text=True, capture_output=True)
    sys.stdout.write(r.stdout)
    if r.returncode != 0:
        print("REMOTE_FAILED", file=sys.stderr)
        sys.stderr.write(r.stderr[-4000:])
        return r.returncode
    print("remote_ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
