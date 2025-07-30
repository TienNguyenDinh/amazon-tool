const { chromium } = require('playwright');
const ExcelJS = require('exceljs');

// Configuration constants optimized for Vercel serverless
const SCRAPING_CONFIG = {
  timeout: 25000, // Reduced from 30000 for Vercel limits
  waitTime: 1500, // Reduced from 2000
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

const EXCEL_CONFIG = {
  worksheetName: 'Amazon Product Data',
  fileName: 'product_data.xlsx',
  headers: [
    'Product Title',
    'Price',
    'ASIN',
    'Star Rating',
    'Number of Reviews',
    'Product URL',
  ],
};

const VERCEL_BROWSER_CONFIG = {
  // Optimized browser args for Vercel serverless environment
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-background-networking',
    '--memory-pressure-off',
  ],
};

// Helper function to add random delay
const randomDelay = (min = 800, max = 2000) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Helper function to safely extract text content
const safeTextExtract = async (page, selectors, defaultValue = 'N/A') => {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        return text ? text.trim() : defaultValue;
      }
    } catch (error) {
      console.log(
        `Failed to extract with selector ${selector}:`,
        error.message
      );
    }
  }
  return defaultValue;
};

// Main scraping function optimized for serverless
const scrapeAmazonProduct = async (url) => {
  let browser;
  try {
    console.log(`Starting scrape for URL: ${url}`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error(
        'Invalid Amazon URL provided - URL must contain "amazon."'
      );
    }

    // Launch browser with serverless-optimized configuration
    browser = await chromium.launch({
      headless: true,
      args: VERCEL_BROWSER_CONFIG.args,
    });

    const context = await browser.newContext({
      userAgent: SCRAPING_CONFIG.userAgent,
      viewport: { width: 1280, height: 720 }, // Reduced from 1920x1080
    });

    const page = await context.newPage();

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Navigate to page with reduced timeout for Vercel limits
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPING_CONFIG.timeout,
    });

    // Add human-like delay
    await randomDelay();

    // Check for CAPTCHA or blocking
    const captchaExists = (await page.$('form[action*="captcha"]')) !== null;
    if (captchaExists) {
      throw new Error(
        'CAPTCHA detected - Amazon has detected automated access. Please try again later.'
      );
    }

    // Wait for page to load completely
    await page.waitForTimeout(SCRAPING_CONFIG.waitTime);

    // Extract product data with multiple fallback selectors
    const productData = {
      title: await safeTextExtract(page, [
        '#productTitle',
        'h1[data-automation-id="product-title"]',
        'h1.a-size-large',
      ]),

      price: await safeTextExtract(page, [
        '.a-price-whole',
        '.a-price .a-offscreen',
        '.a-price-range .a-price .a-offscreen',
        'span.a-price-symbol + span.a-price-whole',
      ]),

      asin: await safeTextExtract(page, ['[data-asin]', 'input[name="ASIN"]']),

      rating: await safeTextExtract(page, [
        'span.a-icon-alt',
        'span[data-hook="rating-out-of-text"]',
        '.a-icon-star .a-icon-alt',
      ]),

      reviewCount: await safeTextExtract(page, [
        '#acrCustomerReviewText',
        'span[data-hook="total-review-count"]',
        'a[data-hook="see-all-reviews-link"] span',
      ]),

      url: url,
    };

    // Extract ASIN from data attribute if not found in text
    if (productData.asin === 'N/A') {
      try {
        const asinElement = await page.$('[data-asin]');
        if (asinElement) {
          productData.asin =
            (await asinElement.getAttribute('data-asin')) || 'N/A';
        }
      } catch (error) {
        console.log(
          'Failed to extract ASIN from data attribute:',
          error.message
        );
      }
    }

    console.log('Successfully scraped product data:', productData);
    return productData;
  } catch (error) {
    console.error('Scraping error:', error.message);

    // Enhanced error messages for common deployment issues
    if (
      error.message.includes('Target closed') ||
      error.message.includes('Navigation timeout')
    ) {
      throw new Error(
        'Page loading timeout - The Amazon page took too long to load. Please try again.'
      );
    } else if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
      throw new Error(
        'Network error - Could not connect to Amazon. Please check the URL and try again.'
      );
    } else if (error.message.includes('chromium')) {
      throw new Error(
        'Browser initialization failed - There was an issue starting the web scraper. Please try again.'
      );
    }

    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }
  }
};

// Generate Excel file
const generateExcelFile = async (productData) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(EXCEL_CONFIG.worksheetName);

    // Add headers
    worksheet.addRow(EXCEL_CONFIG.headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data row
    worksheet.addRow([
      productData.title,
      productData.price,
      productData.asin,
      productData.rating,
      productData.reviewCount,
      productData.url,
    ]);

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    console.error('Excel generation error:', error.message);
    throw new Error('Failed to generate Excel file');
  }
};

// Vercel API handler with enhanced error handling
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported for scraping endpoint',
    });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message:
          'Please provide a valid Amazon product URL in the request body',
      });
    }

    console.log(`Received scrape request for: ${url}`);

    // Scrape product data
    const productData = await scrapeAmazonProduct(url);

    // Validate that we got meaningful data
    if (!productData.title || productData.title === 'N/A') {
      throw new Error(
        'Failed to extract product data - The page may not be a valid Amazon product page'
      );
    }

    // Generate Excel file
    const excelBuffer = await generateExcelFile(productData);

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `amazon_product_${timestamp}.xlsx`;

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    // Send Excel file
    res.send(excelBuffer);
  } catch (error) {
    console.error('API error:', error.message);

    // Enhanced error handling for specific deployment issues
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.message.includes('Invalid Amazon URL')) {
      statusCode = 400;
    } else if (error.message.includes('CAPTCHA')) {
      statusCode = 429;
      errorMessage =
        'Amazon has detected automated access. Please wait before trying again.';
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Navigation timeout')
    ) {
      statusCode = 408;
      errorMessage =
        'Request timeout - The page took too long to load. Please try again.';
    } else if (error.message.includes('Browser initialization failed')) {
      statusCode = 503;
      errorMessage =
        'Service temporarily unavailable - Browser could not be initialized. Please try again.';
    } else if (error.message.includes('Failed to extract product data')) {
      statusCode = 422;
      errorMessage =
        'Could not extract product information - Please verify this is a valid Amazon product page.';
    } else if (error.message.includes('Network error')) {
      statusCode = 502;
      errorMessage =
        'Network error - Could not connect to Amazon. Please check the URL and try again.';
    } else {
      // Generic server error
      errorMessage =
        'An unexpected error occurred while processing your request. Please try again.';
    }

    res.status(statusCode).json({
      error: 'Scraping failed',
      message: errorMessage,
      statusCode: statusCode,
    });
  }
};
