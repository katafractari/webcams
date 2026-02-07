# Use official Node.js LTS image
FROM node:24.11.1-alpine

# Set working directory
WORKDIR /app

# Prepare non-root user
RUN deluser --remove-home node \
  && addgroup -S node -g 2000 \
  && adduser -S -G node -u 2000 node

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Remove build dependencies to keep image small
RUN apk del python3 make g++

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown node:node /app/data

# Expose port
EXPOSE 3000

# Set non-root user
USER node

# Start the application
CMD ["npm", "start"]
