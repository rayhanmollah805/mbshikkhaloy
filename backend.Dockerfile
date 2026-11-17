FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates ffmpeg \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
# prisma.config.ts reads DATABASE_URL even for `generate`; a placeholder is enough at build time.
RUN DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate && npm run build
# The chatbot spawns the `claude` CLI; it only answers when CHATBOT_ANTHROPIC_API_KEY is set.
RUN npm i -g @anthropic-ai/claude-code || echo "claude CLI not installed"
RUN mkdir -p uploads .chatbot-work && chown -R node:node uploads .chatbot-work
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
