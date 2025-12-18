# Use official Node.js LTS image for ARM64 (Raspberry Pi 4)
FROM node:24.11.1-alpine

# Set working directory
WORKDIR /app

# Prepare non-root user
RUN deluser --remove-home node \
  && addgroup -S node -g 2000 \
  && adduser -S -G node -u 2000 node

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Set non-root user
USER node

# Start the application
CMD ["npm", "start"]