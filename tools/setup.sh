#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ -f .env ]; then echo '.env already exists; credentials unchanged.'; exit 0; fi
umask 077
for name in SQL_PASSWORD RABBIT_PASSWORD JWT_KEY DEMO_PASSWORD GRAFANA_PASSWORD; do
  printf '%s=Mf!%s\n' "$name" "$(openssl rand -hex 24)" >> .env
done
echo '.env created. Read DEMO_PASSWORD to sign in.'
