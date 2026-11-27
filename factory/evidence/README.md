# Evidence kit (Level 1)

One command per project that starts the Level 0 sandbox, runs unit checks and Playwright, records one
step-paced proof video (H.264 MP4 + GIF + step screenshots), writes `EVIDENCE.md` and a deterministic
quality gate (`quality-gate.json`). Exit 0 only if everything passes. CI workflow included.

## Install and update

```bash
# from a glass-factory checkout; <repo> = root of the target git repository
kit/evidence/install.sh <repo> [--dir factory]            # first install
kit/evidence/install.sh <repo> [--dir factory] --update   # kit update, or after changing BASE_BRANCHES / SCOPE_*_RE
```

It refuses to run if the managed paths have uncommitted changes, and prints what it changed.

| Path in the project | Owner | Installer |
|---|---|---|
| `factory/evidence/` (Dockerfile, scripts, `run-evidence.sh`, `lib.sh`, `seed-reset/`, this README, `VERSION`) | kit | overwritten on `--update` (header: managed, do not edit) |
| `.github/workflows/level1-evidence.yml` | kit, rendered from the config | overwritten on `--update` |
| `factory/evidence/tests/*.spec.mjs` | project | never touched |
| `factory/evidence.config.sh` | project | commented template only if missing |
| compose file, mocks, smoke script, `.gitignore` | project | never touched |

The project compose file needs a service `evidence` (profile `evidence`): `build.context: ./factory/evidence`,
`user: "${LOCAL_UID:-1000}:${LOCAL_GID:-1000}"`, `depends_on` app and mock (healthy), the sandbox network,
volume `${ARTIFACTS_DIR:-./factory/artifacts}:/artifacts` plus volumes for routed fixtures. No `environment:`
needed, `run-evidence.sh` passes the config. Also set `name: <PROJECT_PREFIX>-factory`. Add `factory/artifacts/` to `.gitignore`.

Run: `factory/evidence/run-evidence.sh [--keep] [--out <dir>]`. Artifacts go to `factory/artifacts/` (wiped each
run, only with the `.evidence-artifacts` marker; an inherited `ARTIFACTS_DIR` is ignored). A `COMPOSE_PROJECT_NAME`
from the environment must start with `<PROJECT_PREFIX>-evidence-` or `-factory`, so a real install is never hit.

## Specs

Specs live in `factory/evidence/tests/`: `*regression.spec.mjs` (fast, video only on failure) and exactly one
`proof-flow.spec.mjs` (the proof video). Every spec imports `test`, `expect`, `APP_URL`, `MOCK_URL`,
`INSPECTOR_URL` from `../scripts/sandbox.mjs` and the step helpers from `../scripts/proof-helpers.mjs`.
The auto fixture resets the project state before each test, routes fixtures, and fails the test if a request
leaves the sandbox. The quality gate (`specs_use_sandbox_fixture`) fails if any spec imports `@playwright/test` (or `playwright`) directly.
Unit test runners of the project collect `*.spec.mjs` by default: exclude the factory folder from them (vitest
`test.exclude`, jest `testPathIgnorePatterns`, CI scripts that list test files); `install.sh` points out the configs it finds. Quality gate and report formats: see the skill `level1-evidence`.

## Database reset (`seed-reset`, PostgreSQL)

Every test starts from the seed (`RESET_REQUESTS`). An app with a database but without a test reset
endpoint gets the kit's seed-reset service instead of a change to its code:

```yaml
  seed-reset:
    build: ./factory/evidence/seed-reset
    environment:
      DATABASE_URL: postgresql://app:local_dev_only@db:5432/app_factory
    volumes:
      - ./factory/seed.sql:/seed/seed.sql:ro
    depends_on:
      web: { condition: service_healthy }   # the app ran its migrations
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8090/health"]
    networks: [sandbox]
```

`RESET_REQUESTS="POST http://seed-reset:8090/reset; POST $MOCK_URL/_mock/reset"`. `POST /reset` runs
`seed.sql` in one transaction. It refuses, on every request:
- a `DATABASE_URL` that is not plain `postgresql://user[:password]@service[:port]/<name>_factory` (one `@`,
  a lowercase service name without dots, not `localhost`, no query string, no percent-encoding, no second host),
- a host that does not resolve to an address on the service's own networks (the sandbox),
- a seed that starts with a psql backslash command. The seed goes to the server as SQL (`psql -c`), so
  `\connect` and other meta-commands never run; psql gets no URL, no inherited `PG*` environment and no `.psqlrc`.

`seed.sql` is project-owned and plain SQL (up to about 120 KB, the size of one command argument): empty the
app tables (keep the migration table), insert the seed rows, and start with a check of `current_database()`
as a second fence. MySQL and other databases are not supported yet.

Logins: a reset usually ends every session (users are re-created). Log in inside each test through a
small project helper next to the specs (`tests/helpers.mjs`); the proof types it visibly, regression
specs fill the form directly.

## Config reference (`factory/evidence.config.sh`)

Plain `KEY=value`, sourced by bash. Required: `PROJECT_PREFIX`, `APP_URL`, `MOCK_URL`.

| Key | Default | Meaning |
|---|---|---|
| `PROJECT_PREFIX` | required | Prefix of compose project names (`<prefix>-evidence-<pid>-<rand>`) and of accepted inherited names |
| `COMPOSE_FILE` | `docker-compose.factory.yml` | Sandbox compose file, relative to the repo root |
| `BASE_BRANCHES` | `main` | Branches PRs go into (space-separated, e.g. `main dev`): the workflow runs for PRs into them (rendered by `install.sh`); the first is the local diff base (`BASE_REF` overrides it) |
| `APP_URL`, `MOCK_URL` | required | As the browser inside the sandbox network sees them (`http://web:8080`); service and port are also used to find the host ports |
| `INSPECTOR_URL` | `MOCK_URL` | Page of the mock listing what the app sent |
| `APP_PORT_VAR`, `MOCK_PORT_VAR` | empty | Compose variables for the host ports; the runner sets them to `0` (ephemeral) |
| `SANDBOX_ENV` | empty | `KEY=value` pairs exported to the sandbox unless already set (e.g. mock tick) |
| `RESET_REQUESTS` | empty | `METHOD URL; METHOD URL`, sent before every test |
| `ROUTED_FIXTURES` | empty | `<url glob> => <file in the evidence container>; ...` for hosts outside the sandbox |
| `ALLOWED_ORIGINS` | empty | Extra origins the browser may reach (`;`-separated); everything else is blocked and fails the test |
| `UNIT_RUNNER` | `node` | `node` (throwaway container, repo read-only, no network), `service` (`compose exec`), `none` |
| `UNIT_SERVICE`, `UNIT_NODE_IMAGE`, `UNIT_CMD` | | Service for `service`; image for `node` (default: first `node:` image of the compose file); `sh` snippet printing TAP lines |
| `UNIT_LABEL` | `Unit Tests` | Wording in the report |
| `KNOWN_SKIPS` | empty | Unit cases the project skips on purpose, exact names as `UNIT_CMD` prints them (without `# SKIP`), one per line. They are listed in the report as known skips; any other skip still fails the gate. An entry that no longer shows up is reported in the run log |
| `SMOKE_CMD` | empty | Host command from the repo root, counts as one TAP case; ports in `EVIDENCE_APP_PORT`, `EVIDENCE_MOCK_PORT` and the `*_PORT_VAR` names |
| `ENVIRONMENT_DESC` | empty | Report line "Isolated ... Sandbox (`<this>`, 0 prod secrets)" |
| `SCOPE_VERIFICATION_RE`, `SCOPE_SENSITIVE_RE`, `SCOPE_SENSITIVE_LABEL` | generic | Which changed files must be disclosed in the report; rendered into the workflow by `install.sh` |
| `PW_TIMEOUT_MS`, `PW_PROOF_TIMEOUT_MS` | `45000`, same | Playwright test timeouts |
| `NOTIFY` | `none` | `nextcloud-talk`: push the result and proof video to a Talk room (CI only, see below) |
| `NOTIFY_NC_URL`, `NOTIFY_NC_USER`, `NOTIFY_NC_TALK_ROOM` | | Nextcloud base URL, bot account, room token; rendered into the workflow |
| `NOTIFY_RETENTION_DAYS` | `30` | Uploaded videos older than this are deleted on the next run |

## CI

The workflow runs the sandbox read-only, uploads the bundle and a second job (never checking out PR code)
publishes GIF, MP4 and screenshots to the `factory-evidence-previews` branch and comments on the PR. GIF first.
Public repository: the MP4 link goes through jsDelivr pinned to the commit SHA (plays on phones).
Private repository or MP4 over 20 MB: raw GitHub download, labelled "Download MP4 (phones: use the GIF above)".

## Notify the reviewer (`NOTIFY=nextcloud-talk`)

After the PR comment, the publish job uploads `proof.mp4` into the bot account's files (`Evidence/`) and
shares it into the Talk room with result, test counts and PR link as caption. Talk plays the video in the
app and pushes a notification, also for private repositories. Without a video (sandbox failed early) it
posts the caption as a text message. The step never fails the job.

Setup (once per Nextcloud):
1. A dedicated account for the bot (no admin, no groups, small quota), not a personal or multi-purpose one:
   its app password sits in CI secrets. `occ user:add --password-from-env factory-bot`,
   `occ user:auth-tokens:add factory-bot --name=agent-factory-notify-<date>` (Nextcloud app passwords do not
   expire: rotate them by hand).
2. The bot creates a group conversation and adds the reviewers (Talk API or UI); its token is the last part of the room URL.
3. Config `NOTIFY*`, `install.sh --update`, and the repository secret `NEXTCLOUD_NOTIFY_APP_PASSWORD`
   (`gh secret set NEXTCLOUD_NOTIFY_APP_PASSWORD -R <owner>/<repo>`; needs repo admin). The Nextcloud must
   be reachable from the CI runners.

Platform notes for customers: the video shows the application under test. With Nextcloud Talk it stays on
the customer's own server; with hosted messengers (Telegram, Slack, Teams) it lives on the provider's
servers. Only Nextcloud Talk is implemented and tested so far.
