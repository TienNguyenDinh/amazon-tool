// Vercel API handler for health check
const { handleCors } = require('../utils/cors');
const { APP_CONFIG } = require('../utils/constants');

module.exports = async (req, res) => {
  // Handle CORS and method validation
  if (!handleCors(req, res, 'GET')) {
    return; // Response already sent by CORS handler
  }

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'Vercel',
    service: APP_CONFIG.SERVICE_NAME,
    version: APP_CONFIG.VERSION,
  });
};
