# --- build stage: compile the SPA ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime stage: serve /api + the built SPA ---
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# tsx + express are runtime deps, so the TypeScript server runs without a separate build step.
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=8080
ENV REPORT_DIR=/reports
EXPOSE 8080
CMD ["npm", "start"]
