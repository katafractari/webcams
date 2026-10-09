# syntax=docker/dockerfile:1
# Build on Forge using the native architecture and a persistent npm cache.
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Prepare non-root user
RUN deluser --remove-home node \
  && addgroup -S node -g 2000 \
  && adduser -S -G node -u 2000 node

# Copy package files
COPY package*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set non-root user
USER node

ENV NODE_ENV=production

# Start the application
CMD ["npm", "start"]
