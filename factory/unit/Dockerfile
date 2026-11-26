# Unit and integration tests (vitest) for the factory sandbox. The upstream Dockerfile prunes the
# dev dependencies inside its build stage, so this image installs them the same way (no next build).
FROM node:22.23.4-bookworm-slim
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 PRISMA_HIDE_UPDATE_MESSAGE=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /data
RUN apt-get update && apt-get install -yqq --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* && corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY packages/filesystem/package.json ./packages/filesystem/
COPY packages/lib/package.json ./packages/lib/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/router/package.json ./packages/router/
COPY packages/types/package.json ./packages/types/
RUN --mount=type=cache,sharing=locked,target=/root/.yarn/berry/cache \
    yarn workspaces focus linkwarden @linkwarden/web @linkwarden/worker
COPY . .
RUN yarn prisma:generate
CMD ["sleep", "infinity"]
