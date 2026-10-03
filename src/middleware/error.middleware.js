const logger = require('../utils/logger');

/**
 * Centralized Express Error Handling Middleware.
 * Catches unhandled errors, logs structured details, and returns safe, standardized JSON responses.
 * Never leaks stack traces or secrets to the client.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.message || 'An unexpected error occurred.';

  logger.error({
    err: {
      message: err.message,
      code: err.code,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    req: {
      id: req.id,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip
    }
  }, 'Unhandled application error');

  return res.status(statusCode).json({
    status: 'error',
    code: errorCode,
    message: statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected internal server error occurred.'
      : errorMessage
  });
}

/**
 * 404 Handler for unmatched routes.
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    status: 'error',
    code: 'ROUTE_NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
