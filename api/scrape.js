const { chromium } = require('playwright');
const ExcelJS = require('exceljs');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration constants with multiple fallback strategies
const SCRAPING_CONFIG = {
  primaryTimeout: 8000,
  fallbackTimeout: 5000,
  emergencyTimeout: 3000,
  waitTime: 300,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRetryAttempts: 3,
  retryDelay: 1500,
  diagnosticsEnabled: true,
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

// Multiple browser configuration strategies
const BROWSER_CONFIGS = {
  minimal: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-extensions',
      '--disable-images',
      '--disable-javascript',
      '--no-first-run',
      '--disable-default-apps',
      '--memory-pressure-off',
    ],
    headless: true,
    timeout: 10000,
  },
  ultraMinimal: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--single-process',
      '--disable-gpu',
    ],
    headless: true,
    timeout: 8000,
  },
  emergency: {
    args: ['--no-sandbox'],
    headless: true,
    timeout: 5000,
  },
};

// Comprehensive diagnostics system
const diagnostics = {
  log: (message, level = 'INFO') => {
    if (SCRAPING_CONFIG.diagnosticsEnabled) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level}] ${message}`);
    }
  },

  error: (message, error = null) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] ${message}`);
    if (error) {
      console.error(`[${timestamp}] [ERROR] Stack:`, error.stack);
    }
  },

  browserState: (browser, context = null, page = null) => {
    const state = {
      browser: browser ? `connected: ${browser.isConnected()}` : 'null',
      context: context ? 'exists' : 'null',
      page: page ? `closed: ${page.isClosed()}` : 'null',
    };
    diagnostics.log(`Browser state: ${JSON.stringify(state)}`);
    return state;
  },
};

// Enhanced browser state validation with detailed diagnostics
const validateBrowserState = (
  browser,
  context = null,
  page = null,
  operation = 'unknown'
) => {
  diagnostics.log(`Validating browser state for operation: ${operation}`);

  if (!browser) {
    const error = `Browser instance is null during ${operation}`;
    diagnostics.error(error);
    throw new Error(error);
  }

  if (!browser.isConnected()) {
    const error = `Browser is not connected during ${operation}`;
    diagnostics.error(error);
    throw new Error(error);
  }

  if (context) {
    try {
      if (context.browser() !== browser) {
        const error = `Context not associated with browser during ${operation}`;
        diagnostics.error(error);
        throw new Error(error);
      }
    } catch (error) {
      diagnostics.error(`Context validation failed during ${operation}`, error);
      throw new Error(
        `Context validation failed during ${operation}: ${error.message}`
      );
    }
  }

  if (page) {
    try {
      if (page.isClosed()) {
        const error = `Page is closed during ${operation}`;
        diagnostics.error(error);
        throw new Error(error);
      }
    } catch (error) {
      diagnostics.error(`Page validation failed during ${operation}`, error);
      throw new Error(
        `Page validation failed during ${operation}: ${error.message}`
      );
    }
  }

  diagnostics.browserState(browser, context, page);
  return true;
};

// Process-isolated browser launcher with multiple fallback strategies
const launchBrowserWithFallbacks = async () => {
  const configNames = Object.keys(BROWSER_CONFIGS);
  let lastError = null;

  for (const configName of configNames) {
    const config = BROWSER_CONFIGS[configName];
    diagnostics.log(
      `Attempting browser launch with ${configName} configuration`
    );

    try {
      // Add process isolation for Windows
      if (process.platform === 'win32') {
        config.args.push('--disable-background-timer-throttling');
        config.args.push('--disable-renderer-backgrounding');
        config.args.push('--disable-backgrounding-occluded-windows');
      }

      const browser = await chromium.launch(config);

      // Immediate validation
      if (!browser || !browser.isConnected()) {
        throw new Error(
          `Browser launched with ${configName} but not connected`
        );
      }

      diagnostics.log(
        `Browser successfully launched with ${configName} configuration`
      );
      return { browser, configUsed: configName };
    } catch (error) {
      diagnostics.error(`Browser launch failed with ${configName}`, error);
      lastError = error;

      // Brief delay before trying next configuration
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `All browser launch strategies failed. Last error: ${lastError?.message}`
  );
};

// Process-isolated navigation with comprehensive monitoring
const navigateWithProcessIsolation = async (page, url, browser, context) => {
  diagnostics.log(`Starting process-isolated navigation to: ${url}`);

  // Pre-navigation state validation
  validateBrowserState(browser, context, page, 'pre-navigation');

  // Create a promise that resolves when navigation completes or fails
  const navigationPromise = new Promise(async (resolve, reject) => {
    try {
      // Set up periodic state monitoring during navigation
      const monitoringInterval = setInterval(() => {
        try {
          if (!browser.isConnected()) {
            clearInterval(monitoringInterval);
            reject(
              new Error('Browser disconnected during navigation monitoring')
            );
            return;
          }

          if (page.isClosed()) {
            clearInterval(monitoringInterval);
            reject(new Error('Page closed during navigation monitoring'));
            return;
          }

          diagnostics.log(
            'Navigation monitoring: browser and page still active'
          );
        } catch (monitorError) {
          clearInterval(monitoringInterval);
          reject(
            new Error(`Navigation monitoring failed: ${monitorError.message}`)
          );
        }
      }, 500);

      // Attempt navigation with ultra-short timeout
      await page.goto(url, {
        waitUntil: 'commit',
        timeout: SCRAPING_CONFIG.primaryTimeout,
      });

      clearInterval(monitoringInterval);
      diagnostics.log('Navigation completed successfully');

      // Post-navigation validation
      validateBrowserState(browser, context, page, 'post-navigation');

      resolve();
    } catch (error) {
      diagnostics.error('Navigation failed', error);
      reject(error);
    }
  });

  return navigationPromise;
};

// Alternative approach: Extract data immediately after navigation
const extractDataImmediately = async (page, url) => {
  diagnostics.log('Starting immediate data extraction');

  try {
    // Don't wait - extract immediately
    const productData = {
      title: 'N/A',
      price: 'N/A',
      asin: 'N/A',
      rating: 'N/A',
      reviewCount: 'N/A',
      url: url,
    };

    // Try to extract title quickly
    try {
      const titleElement = await page.$('#productTitle', { timeout: 2000 });
      if (titleElement) {
        const titleText = await titleElement.textContent();
        if (titleText) {
          productData.title = titleText.trim();
        }
      }
    } catch (titleError) {
      diagnostics.log(`Title extraction failed: ${titleError.message}`);
    }

    // Try to extract price quickly
    try {
      const priceElement = await page.$('.a-price-whole', { timeout: 2000 });
      if (priceElement) {
        const priceText = await priceElement.textContent();
        if (priceText) {
          productData.price = priceText.trim();
        }
      }
    } catch (priceError) {
      diagnostics.log(`Price extraction failed: ${priceError.message}`);
    }

    // Extract ASIN from URL as fallback
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
      productData.asin = asinMatch[1];
    }

    diagnostics.log(`Extracted data: ${JSON.stringify(productData)}`);
    return productData;
  } catch (error) {
    diagnostics.error('Immediate data extraction failed', error);

    // Return minimal data with ASIN from URL
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    return {
      title: 'N/A',
      price: 'N/A',
      asin: asinMatch ? asinMatch[1] : 'N/A',
      rating: 'N/A',
      reviewCount: 'N/A',
      url: url,
    };
  }
};

// Helper function to add random delay
const randomDelay = (min = 300, max = 800) => {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
};

// Main scraping function with complete rewrite for stability
const scrapeAmazonProduct = async (url) => {
  let browser = null;
  let context = null;
  let page = null;
  let configUsed = null;

  try {
    diagnostics.log(`=== Starting scrape session for: ${url} ===`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error(
        'Invalid Amazon URL provided - URL must contain "amazon."'
      );
    }

    // Clean URL for better success rate
    const cleanUrl = url.split('?')[0]; // Remove query parameters
    diagnostics.log(`Using clean URL: ${cleanUrl}`);

    // Launch browser with fallback strategies
    const launchResult = await launchBrowserWithFallbacks();
    browser = launchResult.browser;
    configUsed = launchResult.configUsed;

    diagnostics.log(
      `Browser launched successfully with ${configUsed} configuration`
    );
    validateBrowserState(browser, null, null, 'post-launch');

    // Create context with minimal options
    context = await browser.newContext({
      userAgent: SCRAPING_CONFIG.userAgent,
      viewport: { width: 1024, height: 768 },
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    validateBrowserState(browser, context, null, 'post-context-creation');
    diagnostics.log('Browser context created successfully');

    // Create page
    page = await context.newPage();
    validateBrowserState(browser, context, page, 'post-page-creation');
    diagnostics.log('Page created successfully');

    // Navigate with process isolation
    await navigateWithProcessIsolation(page, cleanUrl, browser, context);

    // Brief stabilization period
    await randomDelay(200, 500);

    // Validate state before data extraction
    validateBrowserState(browser, context, page, 'pre-data-extraction');

    // Extract data immediately to prevent page closure
    const productData = await extractDataImmediately(page, url);

    diagnostics.log(`=== Scraping completed successfully ===`);
    return productData;
  } catch (error) {
    diagnostics.error('Scraping session failed', error);

    // Enhanced error classification
    if (
      error.message.includes('Target closed') ||
      error.message.includes('browser has been closed') ||
      error.message.includes('Page has been closed') ||
      error.message.includes('Browser connection lost') ||
      error.message.includes('disconnected') ||
      error.message.includes('closed during')
    ) {
      throw new Error(
        `Browser termination detected. Configuration used: ${
          configUsed || 'unknown'
        }. This may indicate system resource limitations or antivirus interference. Try closing other applications and running again.`
      );
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Navigation timeout')
    ) {
      throw new Error(
        'Page loading timeout. Amazon may be experiencing issues or the URL may be invalid.'
      );
    } else if (error.message.includes('net::ERR')) {
      throw new Error(
        'Network connection error. Please check your internet connection and try again.'
      );
    } else if (error.message.includes('All browser launch strategies failed')) {
      throw new Error(
        'Cannot initialize browser. Please ensure Playwright is properly installed: npm install playwright && npx playwright install chromium'
      );
    }

    throw error;
  } finally {
    // Enhanced cleanup with diagnostics
    diagnostics.log('=== Starting cleanup process ===');

    try {
      if (page && !page.isClosed()) {
        diagnostics.log('Closing page...');
        await page.close();
        diagnostics.log('Page closed successfully');
      }
    } catch (pageError) {
      diagnostics.error('Page cleanup failed', pageError);
    }

    try {
      if (context) {
        diagnostics.log('Closing context...');
        await context.close();
        diagnostics.log('Context closed successfully');
      }
    } catch (contextError) {
      diagnostics.error('Context cleanup failed', contextError);
    }

    try {
      if (browser && browser.isConnected()) {
        diagnostics.log('Closing browser...');
        await browser.close();
        diagnostics.log('Browser closed successfully');
      }
    } catch (browserError) {
      diagnostics.error('Browser cleanup failed', browserError);
    }

    diagnostics.log('=== Cleanup process completed ===');
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

    diagnostics.log(`=== API Request received for: ${url} ===`);

    // Scrape product data
    const productData = await scrapeAmazonProduct(url);

    // Validate that we got meaningful data
    if (!productData.title || productData.title === 'N/A') {
      diagnostics.log(
        'Warning: No title extracted, but proceeding with available data'
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

    diagnostics.log(`=== API Request completed successfully ===`);

    // Send Excel file
    res.send(excelBuffer);
  } catch (error) {
    diagnostics.error('API request failed', error);

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
      error.message.includes('Page loading timeout')
    ) {
      statusCode = 408;
      errorMessage =
        'Request timeout - The page took too long to load. Please try again.';
    } else if (
      error.message.includes('Browser termination detected') ||
      error.message.includes('Cannot initialize browser')
    ) {
      statusCode = 503;
      errorMessage =
        'Service temporarily unavailable - Browser initialization failed. Please try again.';
    } else if (error.message.includes('Network connection error')) {
      statusCode = 502;
      errorMessage =
        'Network error - Could not connect to Amazon. Please check your connection.';
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
