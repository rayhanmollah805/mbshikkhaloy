FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG BACKEND_URL=http://backend:3001
ENV BACKEND_URL=$BACKEND_URL NEXT_PUBLIC_API_URL=/api NEXT_TELEMETRY_DISABLED=1
RUN npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["npm", "run", "start"]
