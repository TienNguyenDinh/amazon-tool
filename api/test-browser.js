// Simple test endpoint for browser functionality
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { getPageHtml } = require('../utils/browser');
    const testUrl = 'https://www.amazon.com/dp/B0B7RSV894'; // Simple product page

    console.log('Testing browser with simple product page...');
    const html = await getPageHtml(testUrl);

    res.json({
      success: true,
      htmlLength: html.length,
      hasContent: html.includes('productTitle'),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Browser test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
