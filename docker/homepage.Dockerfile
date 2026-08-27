FROM cgr.dev/chainguard/node:latest-dev AS deps
WORKDIR /app
COPY homepage/package.json ./
RUN npm install

FROM cgr.dev/chainguard/node:latest-dev AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SYSTEM_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SYSTEM_URL=$NEXT_PUBLIC_SYSTEM_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY homepage/ .
RUN npm run build

FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["server.js"]