const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');

const server = app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      timezone: config.TIMEZONE,
      llmProvider: config.LLM_PROVIDER
    },
    `Appointment Scheduler Service running on http://localhost:${config.PORT}`
  );
  logger.info(`Swagger API documentation available at http://localhost:${config.PORT}/api/docs`);
});

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info({ signal }, 'Received termination signal, shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed successfully');
    process.exit(0);
  });

  // Force exit if hanging after 5 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

module.exports = server;
