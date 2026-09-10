# ---------- deps ----------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# npm ci needs the lockfile; run `npm install` locally once to generate it
RUN npm ci

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- run ----------
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080
RUN groupadd -r app && useradd -r -g app app
COPY --from=build /app/public ./public
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 8080
CMD ["node", "server.js"]
