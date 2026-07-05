# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .

# Backend URL se ugrađuje u build (Vite import.meta.env). Prosledi ga pri buildu:
#   docker build --build-arg VITE_BACKEND_URL=https://rat.exalt.rs ...
# Ako se izostavi, kod pada na runtime fallback (http://localhost:8000) — u produkciji
# OBAVEZNO proslediti https:// vrednost da kredencijali/kolačići ne idu preko HTTP-a.
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

RUN npm run build

# ---- Serve Stage ----
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
