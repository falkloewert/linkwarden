#!/usr/bin/env bash
# Smoke check of the factory sandbox from the host: reset to the seed, log in through the API,
# read the seeded user (needs the database), and see the mock Ollama answer.
# Ports: FACTORY_WEB_PORT / FACTORY_MOCK_PORT (defaults of docker-compose.factory.yml).
set -euo pipefail

WEB="http://127.0.0.1:${FACTORY_WEB_PORT:-13000}"
MOCK="http://127.0.0.1:${FACTORY_MOCK_PORT:-13434}"
die() { echo "smoke: $*" >&2; exit 1; }

# seed-reset has no host port: reset from inside the sandbox (COMPOSE_PROJECT_NAME of the run).
docker compose -f docker-compose.factory.yml exec -T seed-reset \
  wget -q -O /dev/null --post-data= http://127.0.0.1:8090/reset || die "seed reset failed"

config="$(curl -sS "$WEB/api/v1/config")" || die "GET $WEB/api/v1/config failed"
grep -q '"AI_ENABLED":true' <<< "$config" || die "AI_ENABLED is not true: $config"

session="$(curl -sS -H 'content-type: application/json' \
  -d '{"username":"tester","password":"factory-local-only","sessionName":"factory-smoke"}' \
  "$WEB/api/v1/session")" || die "POST /api/v1/session failed"
token="$(sed -n 's/.*"token":"\([^"]*\)".*/\1/p' <<< "$session")"
[ -n "$token" ] || die "login failed: ${session:0:300}"

me="$(curl -sS -H "authorization: Bearer $token" "$WEB/api/v1/users/me")" || die "GET /api/v1/users/me failed"
grep -q '"locale":"de"' <<< "$me" || die "seeded user is not locale de: ${me:0:300}"
curl -sS "$MOCK/api/tags" | grep -q factory-mock || die "mock ollama has no factory-mock model"

echo "smoke: ok (config AI_ENABLED, login, seeded user locale de, mock ollama)"
