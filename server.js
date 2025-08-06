const express = require('express');
const cors = require('cors');
const path = require('path');
const { logInfo, logOperationStart } = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = process.env.VERCEL === '1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes for local development (Vercel handles these automatically in production)
if (!IS_VERCEL) {
  // Import API handlers
  const scrapeHandler = require('./api/scrape');
  const healthHandler = require('./api/health');

  // Setup API routes
  app.post('/api/scrape', scrapeHandler);
  app.get('/api/health', healthHandler);
}

// Start server (only if not running on Vercel)
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    logOperationStart('SERVER_STARTUP', 'SERVER');
    logInfo('Server initialized', 'SERVER', {
      port: PORT,
      endpoints: {
        frontend: `http://localhost:${PORT}`,
        scrape: `http://localhost:${PORT}/api/scrape`,
        health: `http://localhost:${PORT}/api/health`,
      },
    });
  });
}

module.exports = app;
