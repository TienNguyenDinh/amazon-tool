// Vercel API handler for health check
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are supported',
    });
  }

  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: 'Vercel',
    service: 'Amazon Product Scraper',
    version: '2.1.0-store-working',
  });
};
