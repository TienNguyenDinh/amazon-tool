const { chromium } = require('playwright');
const ExcelJS = require('exceljs');

// Configuration constants - simplified and focused
const SCRAPING_CONFIG = {
  timeout: 30000,
  waitTime: 1000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRetryAttempts: 2,
  retryDelay: 2000,
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

// Simplified browser configuration
const BROWSER_CONFIG = {
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--disable-default-apps',
  ],
  headless: true,
  timeout: 30000,
};

// Simple logging function
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// Simplified browser launch function
const launchBrowser = async () => {
  try {
    log('Attempting browser launch for local development...');

    const browser = await chromium.launch(BROWSER_CONFIG);

    if (!browser || !browser.isConnected()) {
      throw new Error('Browser failed to launch properly');
    }

    log('Browser launched successfully');
    return browser;
  } catch (error) {
    log(`Browser launch failed: ${error.message}`, 'ERROR');
    throw new Error(`Browser initialization failed: ${error.message}`);
  }
};

// Extract product data with proper error handling
const extractProductData = async (page, url) => {
  log('Starting data extraction');

  const productData = {
    title: 'N/A',
    price: 'N/A',
    asin: 'N/A',
    rating: 'N/A',
    reviewCount: 'N/A',
    url: url,
  };

  try {
    // Wait for page to be ready
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Extract title
    try {
      const titleElement = await page.waitForSelector('#productTitle', {
        timeout: 5000,
      });
      if (titleElement) {
        const titleText = await titleElement.textContent();
        if (titleText) {
          productData.title = titleText.trim();
        }
      }
    } catch (titleError) {
      log(`Title extraction failed: ${titleError.message}`);
    }

    // Extract price
    try {
      const priceSelectors = [
        '.a-price-whole',
        '.a-offscreen',
        '.a-price .a-offscreen',
      ];
      for (const selector of priceSelectors) {
        try {
          const priceElement = await page.$(selector);
          if (priceElement) {
            const priceText = await priceElement.textContent();
            if (priceText && priceText.trim() !== '') {
              productData.price = priceText.trim();
              break;
            }
          }
        } catch (priceError) {
          continue;
        }
      }
    } catch (priceError) {
      log(`Price extraction failed: ${priceError.message}`);
    }

    // Extract ASIN from URL
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
      productData.asin = asinMatch[1];
    }

    // Extract rating
    try {
      const ratingElement = await page.$('.a-icon-alt');
      if (ratingElement) {
        const ratingText = await ratingElement.textContent();
        if (ratingText && ratingText.includes('out of')) {
          productData.rating = ratingText.trim();
        }
      }
    } catch (ratingError) {
      log(`Rating extraction failed: ${ratingError.message}`);
    }

    // Extract review count
    try {
      const reviewElement = await page.$('#acrCustomerReviewText');
      if (reviewElement) {
        const reviewText = await reviewElement.textContent();
        if (reviewText) {
          productData.reviewCount = reviewText.trim();
        }
      }
    } catch (reviewError) {
      log(`Review count extraction failed: ${reviewError.message}`);
    }

    log(`Successfully extracted data: ${JSON.stringify(productData)}`);
    return productData;
  } catch (error) {
    log(`Data extraction error: ${error.message}`, 'ERROR');

    // Return basic data with ASIN from URL if available
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    return {
      title: 'Data extraction failed',
      price: 'N/A',
      asin: asinMatch ? asinMatch[1] : 'N/A',
      rating: 'N/A',
      reviewCount: 'N/A',
      url: url,
    };
  }
};

// Main scraping function - simplified and robust
const scrapeAmazonProduct = async (url) => {
  let browser = null;
  let context = null;
  let page = null;

  try {
    log(`Starting scrape session for: ${url}`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error('Invalid Amazon URL - URL must contain "amazon."');
    }

    // Clean URL
    const cleanUrl = url.split('?')[0];
    log(`Using clean URL: ${cleanUrl}`);

    // Launch browser
    browser = await launchBrowser();

    // Create context with minimal settings
    context = await browser.newContext({
      userAgent: SCRAPING_CONFIG.userAgent,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });

    // Create page
    page = await context.newPage();

    // Navigate to the URL
    log(`Navigating to: ${cleanUrl}`);
    await page.goto(cleanUrl, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPING_CONFIG.timeout,
    });

    // Wait a moment for dynamic content
    await page.waitForTimeout(SCRAPING_CONFIG.waitTime);

    // Extract product data
    const productData = await extractProductData(page, url);

    log('Scraping completed successfully');
    return productData;
  } catch (error) {
    log(`Scraping error: ${error.message}`, 'ERROR');

    // Classify errors for better user feedback
    if (
      error.message.includes('net::ERR') ||
      error.message.includes('Network')
    ) {
      throw new Error(
        'Network connection error. Please check your internet connection and try again.'
      );
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Navigation timeout')
    ) {
      throw new Error(
        'Page loading timeout. Amazon may be experiencing issues or blocking requests.'
      );
    } else if (
      error.message.includes('Target closed') ||
      error.message.includes('browser has been closed')
    ) {
      throw new Error('Browser connection was interrupted. Please try again.');
    } else if (error.message.includes('Invalid Amazon URL')) {
      throw new Error('Please provide a valid Amazon product URL.');
    } else if (error.message.includes('Browser initialization failed')) {
      throw new Error(
        'Could not start browser. Please ensure Playwright is properly installed.'
      );
    }

    throw error;
  } finally {
    // Clean up resources
    log('Starting cleanup process');

    try {
      if (page && !page.isClosed()) {
        await page.close();
        log('Page closed');
      }
    } catch (pageError) {
      log(`Page cleanup error: ${pageError.message}`, 'ERROR');
    }

    try {
      if (context) {
        await context.close();
        log('Context closed');
      }
    } catch (contextError) {
      log(`Context cleanup error: ${contextError.message}`, 'ERROR');
    }

    try {
      if (browser && browser.isConnected()) {
        await browser.close();
        log('Browser closed');
      }
    } catch (browserError) {
      log(`Browser cleanup error: ${browserError.message}`, 'ERROR');
    }

    log('Cleanup completed');
  }
};

// Generate Excel file function
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
    log(`Excel generation error: ${error.message}`, 'ERROR');
    throw new Error('Failed to generate Excel file');
  }
};

// API handler with proper error handling
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
      message: 'Only POST requests are supported',
    });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a valid Amazon product URL',
      });
    }

    log(`API request received for: ${url}`);

    // Scrape product data
    const productData = await scrapeAmazonProduct(url);

    // Generate Excel file
    const excelBuffer = await generateExcelFile(productData);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `amazon_product_${timestamp}.xlsx`;

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    log('API request completed successfully');

    // Send Excel file
    res.send(excelBuffer);
  } catch (error) {
    log(`API request failed: ${error.message}`, 'ERROR');

    // Determine appropriate status code based on error
    let statusCode = 500;
    let errorMessage = error.message;

    if (
      error.message.includes('Invalid Amazon URL') ||
      error.message.includes('Please provide a valid')
    ) {
      statusCode = 400;
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Page loading timeout')
    ) {
      statusCode = 408;
    } else if (error.message.includes('Network connection error')) {
      statusCode = 502;
    } else if (
      error.message.includes('Browser connection was interrupted') ||
      error.message.includes('Could not start browser')
    ) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      error: 'Scraping failed',
      message: errorMessage,
      statusCode: statusCode,
    });
  }
};
