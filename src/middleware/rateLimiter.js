const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';
const isRateLimitDisabled = process.env.DISABLE_RATE_LIMIT === 'true';

// Create limiter or pass-through based on environment
const createLimiter = (options) => {
  if (isDevelopment || isRateLimitDisabled) {
    return (req, res, next) => next();
  }
  return rateLimit(options);
};

// General API rate limiter
const apiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints rate limiter (stricter)
const authLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    error: 'Too many authentication attempts, please try again after an hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POS endpoints rate limiter
const posLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    error: 'Too many POS requests, please slow down'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Report exports rate limiter
const exportLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: {
    error: 'Too many export requests, please wait a few minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  apiLimiter,
  authLimiter,
  posLimiter,
  exportLimiter
};