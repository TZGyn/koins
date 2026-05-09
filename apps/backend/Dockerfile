FROM oven/bun AS build

WORKDIR /app

COPY / ./

ARG BETTER_AUTH_SECRET
ARG DATABASE_URL
ARG APP_URL
ARG GOOGLE_OAUTH_CLIENT_ID
ARG GOOGLE_OAUTH_CLIENT_SECRET

ARG TURBO_TELEMETRY_DISABLED=1

RUN bun install
RUN bun run build --filter=!./apps/web

CMD ["/app/apps/backend/build/file-router"]