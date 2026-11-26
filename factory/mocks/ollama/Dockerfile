# Mock Ollama + sandbox reset (needs psql for seed.sql).
FROM node:24.11.1-alpine
RUN apk add --no-cache postgresql16-client
USER node
CMD ["node", "/mock/server.mjs"]
