#!/usr/bin/env bash
# Smoke check of the factory sandbox from the host: reset to the seed, log in through the API,
# read the seeded user (needs the database), and see the mock Ollama answer.
# Ports: FACTORY_WEB_PORT / FACTORY_MOCK_PORT (defaults of docker-compose.factory.yml).
set -euo pipefail

WEB="http://127.0.0.1:${FACTORY_WEB_PORT:-13000}"
MOCK="http://127.0.0.1:${FACTORY_MOCK_PORT:-13434}"

# seed-reset has no host port: reset from inside the sandbox (COMPOSE_PROJECT_NAME of the run).
docker compose -f docker-compose.factory.yml exec -T seed-reset wget -q -O /dev/null --post-data= http://127.0.0.1:8090/reset
curl -sf "$WEB/api/v1/config" | grep -q '"AI_ENABLED":true'

token=$(curl -sf -H 'content-type: application/json' \
  -d '{"username":"tester","password":"factory-local-only","sessionName":"factory-smoke"}' \
  "$WEB/api/v1/session" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
[ -n "$token" ] || { echo "smoke: login failed" >&2; exit 1; }

curl -sf -H "authorization: Bearer $token" "$WEB/api/v1/users/me" | grep -q '"locale":"de"'
curl -sf "$MOCK/api/tags" | grep -q factory-mock

echo "smoke: ok (config AI_ENABLED, login, seeded user locale de, mock ollama)"
