# syntax=docker/dockerfile:1

# ---- Build stage: compile the Vite SPA to static files ----
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first so this layer is cached unless the manifests change.
# Use `npm install` (not `npm ci`): the committed lock file is generated on
# Windows and lacks Linux-only optional native deps (@emnapi/*, rollup/oxc),
# which `npm ci`'s strict in-sync check rejects.
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Build. The VITE_* values are read from .env in the build context and
# baked into the static bundle here (they are public client-side keys).
COPY . .
RUN npm run build

# ---- Runtime stage: serve the static bundle over HTTPS with Caddy ----
FROM caddy:2-alpine AS runtime
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
