# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Thêm --ignore-scripts để chặn husky cài đặt git hooks vô ích trong Docker
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-alpine AS production
WORKDIR /app
COPY package*.json ./
# Thêm --ignore-scripts để bỏ qua lỗi không tìm thấy husky
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist

# Mở cổng 3000 (Khớp với file main.ts)
EXPOSE 3000

# Khởi chạy server
CMD ["node", "dist/main"]