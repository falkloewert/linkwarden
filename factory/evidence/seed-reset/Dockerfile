# managed by glass-factory kit v1.4.0 (38d025b), do not edit; change factory/evidence.config.sh or factory/evidence/tests/
# Seed reset for the factory sandbox: POST /reset runs the project's seed.sql against the sandbox
# PostgreSQL. See README.md of the kit, "Database reset".
FROM node:24.11.1-alpine
RUN apk add --no-cache postgresql16-client
COPY server.mjs /app/server.mjs
USER node
EXPOSE 8090
CMD ["node", "/app/server.mjs"]
