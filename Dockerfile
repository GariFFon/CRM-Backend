# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies needed for build)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start"]
