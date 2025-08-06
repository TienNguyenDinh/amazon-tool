// Simple test endpoint for browser functionality
const { handleCors } = require('../utils/cors');

module.exports = async (req, res) => {
  // Handle CORS and method validation
  if (!handleCors(req, res, 'GET')) {
    return; // Response already sent by CORS handler
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
