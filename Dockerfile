# Dockerfile - Complete Container Setup
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci --only=production
RUN cd backend && npm ci --only=production

# Copy application files
COPY . .

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S matatu -u 1001

# Change ownership
RUN chown -R matatu:nodejs /app
USER matatu

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node backend/utils/healthcheck.js

# Start application
CMD ["npm", "start"]