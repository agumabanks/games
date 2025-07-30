const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

/**
 * Apply security-related middleware to the given Express app.
 * @param {import('express').Application} app
 */
function applySecurity(app) {
  // Helmet configuration tailored for development and production
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
            'https://fonts.googleapis.com'
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'https://cdn.socket.io',
            'https://cdnjs.cloudflare.com'
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http:'],
          fontSrc: [
            "'self'",
            'https://cdnjs.cloudflare.com',
            'https://fonts.gstatic.com'
          ],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false
    })
  );

  // Enable response compression
  app.use(compression());

  // Basic rate limiting for API routes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.'
    }
  });

  app.use('/api/', limiter);
}

module.exports = applySecurity;
