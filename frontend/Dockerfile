# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the app
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ARG NEXT_PUBLIC_RULES_ENGINE_API_URL
ARG NEXT_PUBLIC_WEB_BACKEND_API_URL
ARG NEXT_PUBLIC_LANGGRAPH_API_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ASSISTANT_ID

ENV NEXT_PUBLIC_RULES_ENGINE_API_URL=$NEXT_PUBLIC_RULES_ENGINE_API_URL
ENV NEXT_PUBLIC_WEB_BACKEND_API_URL=$NEXT_PUBLIC_WEB_BACKEND_API_URL
ENV NEXT_PUBLIC_LANGGRAPH_API_URL=$NEXT_PUBLIC_LANGGRAPH_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ASSISTANT_ID=$NEXT_PUBLIC_ASSISTANT_ID

RUN npm run build

# Stage 3: Run the app
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start"]
