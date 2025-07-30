const { chromium } = require('playwright');
const ExcelJS = require('exceljs');

// Configuration constants
const SCRAPING_CONFIG = {
  timeout: 30000,
  waitTime: 2000,
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

// Helper function to add random delay
const randomDelay = (min = 1000, max = 3000) => {
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

// Main scraping function
const scrapeAmazonProduct = async (url) => {
  let browser;
  try {
    console.log(`Starting scrape for URL: ${url}`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error('Invalid Amazon URL provided');
    }

    // Launch browser with serverless-friendly configuration
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      userAgent: SCRAPING_CONFIG.userAgent,
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Set additional headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    // Navigate to page with timeout
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: SCRAPING_CONFIG.timeout,
    });

    // Add human-like delay
    await randomDelay();

    // Check for CAPTCHA or blocking
    const captchaExists = (await page.$('form[action*="captcha"]')) !== null;
    if (captchaExists) {
      throw new Error('CAPTCHA detected. Please try again later.');
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
    throw error;
  } finally {
    if (browser) {
      await browser.close();
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

// Vercel API handler
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

    console.log(`Received scrape request for: ${url}`);

    // Scrape product data
    const productData = await scrapeAmazonProduct(url);

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

    // Send appropriate error response
    const statusCode = error.message.includes('Invalid Amazon URL')
      ? 400
      : error.message.includes('CAPTCHA')
      ? 429
      : 500;

    res.status(statusCode).json({
      error: 'Scraping failed',
      message: error.message,
    });
  }
};
