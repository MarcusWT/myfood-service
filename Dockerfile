# syntax=docker/dockerfile:1

############################
# Build stage
############################
FROM node:24-slim AS build

WORKDIR /app

# python3/make/g++ are required to build native modules (better-sqlite3, bcrypt)
# from source when no prebuilt binary matches this platform/libc combination.
# This toolchain stays in the build stage only — it is never copied into the
# production image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# Both stages use the identical node:24-slim base image (same libc/arch), so
# native modules built here are safe to reuse in production — prune away
# devDependencies rather than reinstalling everything from scratch.
RUN npm prune --omit=dev

############################
# Production stage
############################
FROM node:24-slim AS production

ENV NODE_ENV=production
# Explicit default so the SQLite file always lands in the directory the
# compose volume mounts, even if DB_PATH is omitted from .env.
ENV DB_PATH=/app/data/myfood.db

WORKDIR /app

# curl is used by the docker-compose healthcheck against GET /health. No
# compiler toolchain is installed here — native modules are copied,
# pre-built, from the build stage above.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system app \
  && useradd --system --gid app --home-dir /app --no-create-home app

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Ensure the data directory exists, is owned by the unprivileged runtime
# user, and is writable for the SQLite file. src/index.ts also calls
# fs.mkdirSync on DB_PATH's parent dir at startup, but we create it here too
# so the volume mount point exists (and is correctly owned) up front.
RUN mkdir -p /app/data && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "dist/index.js"]
