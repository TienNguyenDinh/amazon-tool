const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = process.env.VERCEL === '1';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Start server (only if not running on Vercel)
if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`Amazon Scraper Server running on port ${PORT}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
    console.log(`API endpoint: http://localhost:${PORT}/api/scrape`);
  });
}

module.exports = app;
