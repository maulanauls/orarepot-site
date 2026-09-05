#!/usr/bin/env python3
"""Sync ClickHouse password into local .env and start it on the VPS."""

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
        "CLICKHOUSE_HOST",
        "CLICKHOUSE_HTTP_PORT",
        "CLICKHOUSE_NATIVE_PORT",
        "CLICKHOUSE_USER",
        "CLICKHOUSE_PASSWORD",
        "CLICKHOUSE_DB",
    )
    for key in keys:
        text = re.sub(rf"^{key}=.*\n", "", text, flags=re.M)
    text = re.sub(r"^# ClickHouse di VPS.*\n", "", text, flags=re.M)
    if re.search(r"^KAFKA_SSL=.*$", text, re.M):
        return re.sub(r"^(KAFKA_SSL=.*\n)", r"\1\n" + block + "\n", text, count=1, flags=re.M)
    return text.rstrip() + "\n" + block


def main() -> int:
    env_path = ROOT / ".env"
    text = env_path.read_text()
    existing = re.search(r"^CLICKHOUSE_PASSWORD=(.+)$", text, re.M)
    reuse = (
        existing
        and existing.group(1).strip()
        and existing.group(1).strip() != "change-me"
    )
    pw = existing.group(1).strip() if reuse else secrets.token_urlsafe(32)
    user = "orarepot"
    db = "orarepot"
    block = (
        "# ClickHouse di VPS Docker. Domain tidak diperlukan.\n"
        "CLICKHOUSE_HOST=84.247.149.27\n"
        "CLICKHOUSE_HTTP_PORT=8123\n"
        "CLICKHOUSE_NATIVE_PORT=9000\n"
        f"CLICKHOUSE_USER={user}\n"
        f"CLICKHOUSE_PASSWORD={pw}\n"
        f"CLICKHOUSE_DB={db}\n"
    )
    env_path.write_text(upsert_block(text, block))
    print("local_env_updated")

    subprocess.run(
        SCP + ["-r", str(ROOT / "infra/clickhouse"), f"{HOST}:/opt/orarepot-infra/clickhouse"],
        check=True,
    )
    subprocess.run(
        SCP + [str(ROOT / "infra/compose.yml"), f"{HOST}:/opt/orarepot-infra/compose.yml"],
        check=True,
    )
    print("files_copied")

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
        f"text = upsert(text, 'CLICKHOUSE_USER', {user!r})\n"
        f"text = upsert(text, 'CLICKHOUSE_PASSWORD', {pw!r})\n"
        f"text = upsert(text, 'CLICKHOUSE_DB', {db!r})\n"
        "p.write_text(text)\n"
        "print('remote_env_updated')\n"
    )
    remote = (
        "set -euo pipefail\n"
        "umask 077\n"
        "python3 - <<'PY'\n"
        f"{remote_py}"
        "PY\n"
        "cd /opt/orarepot-infra\n"
        "docker compose config -q\n"
        "docker compose up -d clickhouse\n"
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
