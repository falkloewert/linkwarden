#!/usr/bin/env bash
# Evidence kit config of the Linkwarden fork (kit reference: factory/evidence/README.md).

PROJECT_PREFIX=linkwarden
COMPOSE_FILE=docker-compose.factory.yml
APP_URL=http://web:3000
MOCK_URL=http://mock:11434
APP_PORT_VAR=FACTORY_WEB_PORT
MOCK_PORT_VAR=FACTORY_MOCK_PORT

# The mock forgets its events and resets the sandbox database to factory/mocks/ollama/seed.sql
# (refuses any database but db/linkwarden_factory).
RESET_REQUESTS="POST $MOCK_URL/_mock/reset"

# vitest in the "unit" service (build stage with dev dependencies, sandbox database for the
# *.integration.test.ts files).
UNIT_RUNNER=service
UNIT_SERVICE=unit
UNIT_LABEL="Unit & integration tests (vitest)"
UNIT_CMD='yarn vitest run --reporter=tap-flat apps/web/lib/api 2>&1'
SMOKE_CMD="factory/smoke.sh"

ENVIRONMENT_DESC='Linkwarden `web` (web + worker) + PostgreSQL `db` + mock Ollama `mock`, no Meilisearch, no internet'

SCOPE_VERIFICATION_RE='(^|[\/._-])(tests?|__tests__|specs?|mocks?|e2e|evidence)([\/._-]|$)|docker-compose|run-evidence\.sh|smoke\.sh'
SCOPE_SENSITIVE_RE='(^|[\/._-])(auth|security|migrations?|billing|payments?|stripe)([\/._-]|$)|(^|\/)Dockerfile|(^|\/)(docker-)?compose[^\/]*\.ya?ml$|\.github\/|^factory\/|\.env|secret|schema\.prisma'
SCOPE_SENSITIVE_LABEL="Sensitive paths (auth, billing, migrations, Prisma schema, Docker, CI, factory sandbox, secrets)"

# First page loads compile nothing (production build), but login and settings take a few seconds.
PW_TIMEOUT_MS=60000
PW_PROOF_TIMEOUT_MS=90000
