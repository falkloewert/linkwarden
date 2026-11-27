#!/usr/bin/env bash
# Evidence kit config of the Linkwarden fork (kit reference: factory/evidence/README.md).

PROJECT_PREFIX=linkwarden
COMPOSE_FILE=docker-compose.factory.yml
APP_URL=http://web:3000
MOCK_URL=http://mock:11434
# Linkwarden takes PRs on dev (check-branch.yml allows PRs into main only from dev).
BASE_BRANCHES=dev
APP_PORT_VAR=FACTORY_WEB_PORT
MOCK_PORT_VAR=FACTORY_MOCK_PORT

# The mock forgets its events and resets the sandbox database to factory/mocks/ollama/seed.sql
# (refuses any database but db/linkwarden_factory).
RESET_REQUESTS="POST $MOCK_URL/_mock/reset"
# Every page of the app loads the announcement banner from linkwarden.app in the browser
# (apps/web/lib/client/getLatestAnnouncement.ts; real answer 2026-11-26: {"id": "2.17"}).
# Served as {} = no announcement, so no banner covers the video.
ROUTED_FIXTURES="https://linkwarden.app/blog/latest-announcement.json => /fixtures/latest-announcement.json"

# vitest in the "unit" service (factory/unit/Dockerfile, sandbox database and the throwaway
# Meilisearch for the *.integration.test.ts files).
UNIT_RUNNER=service
UNIT_SERVICE=unit
UNIT_LABEL="Unit & integration tests (vitest)"
UNIT_CMD='yarn vitest run --reporter=tap-flat apps/web/lib/api 2>&1'
# Upstream skips these two on purpose (also on dev before the factory sandbox).
KNOWN_SKIPS="
apps/web/lib/api/controllers/collections/collectionParents.integration.test.ts > collection parents with a real database > moving a collection > doesn't save a cycle when two opposite moves arrive together
apps/web/lib/api/controllers/migration/importers.integration.test.ts > importers integration > 'Linkwarden' > adds undated links as of the import, after past dates and before future ones
"
SMOKE_CMD="factory/smoke.sh"

ENVIRONMENT_DESC='Linkwarden `web` (web + worker) + PostgreSQL `db` + mock Ollama `mock` + Meilisearch for tests only, no internet'

SCOPE_VERIFICATION_RE='(^|[\/._-])(tests?|__tests__|specs?|mocks?|e2e|evidence)([\/._-]|$)|docker-compose|run-evidence\.sh|smoke\.sh'
SCOPE_SENSITIVE_RE='(^|[\/._-])(auth|security|migrations?|billing|payments?|stripe)([\/._-]|$)|(^|\/)Dockerfile|(^|\/)(docker-)?compose[^\/]*\.ya?ml$|\.github\/|^factory\/|\.env|secret|schema\.prisma'
SCOPE_SENSITIVE_LABEL="Sensitive paths (auth, billing, migrations, Prisma schema, Docker, CI, factory sandbox, secrets)"

# First page loads compile nothing (production build), but login and settings take a few seconds.
PW_TIMEOUT_MS=60000
PW_PROOF_TIMEOUT_MS=90000
