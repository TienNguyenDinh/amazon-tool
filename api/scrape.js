const https = require('https');
const http = require('http');
const { URL } = require('url');
const ExcelJS = require('exceljs');
const cheerio = require('cheerio');

// CSS Selector constants for easy editing
const CSS_SELECTORS = {
  title: {
    primary: '#productTitle',
    fallbacks: [
      'h1.product-title',
      '[data-testid="product-title"]',
      '.product-title',
      'h1',
    ],
  },
  price: {
    primary: '.a-price-whole',
    fallbacks: [
      '.a-offscreen',
      '.a-price .a-offscreen',
      '.a-price-range .a-offscreen',
      '.price',
      '[data-testid="price"]',
    ],
  },
  rating: {
    primary: '[data-hook="average-star-rating"] .a-icon-alt',
    fallbacks: [
      '.cr-widget-FocalReviews .a-icon-alt',
      '.reviewCountTextLinkedHistogram .a-icon-alt',
      '[title*="out of 5 stars"]',
      '.a-icon-star .a-icon-alt',
    ],
  },
  reviewCount: {
    primary: '[data-hook="total-review-count"]',
    fallbacks: [
      '#acrCustomerReviewText',
      '.cr-widget-FocalReviews [data-hook="total-review-count"]',
      'a[href*="#customerReviews"]',
      '.reviewCountTextLinkedHistogram',
    ],
  },
  asin: {
    // ASIN is typically extracted from URL or data attributes
    dataAttributes: ['[data-asin]', '[data-product-id]'],
  },
};

// Regular expressions for data extraction and validation
const REGEX_PATTERNS = {
  asinFromUrl: /\/dp\/([A-Z0-9]{10})/,
  asinFromHtml: /['"](B[A-Z0-9]{9})['"]|data-asin=["']([A-Z0-9]{10})["']/,
  priceCleanup: /[^\d.,]/g,
  ratingExtraction: /([0-9.]+)\s*out\s*of\s*5/i,
  reviewCountExtraction: /([0-9,]+)/,
};

// Configuration constants
const SCRAPING_CONFIG = {
  timeout: 30000,
  waitTime: 1000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRetryAttempts: 2,
  retryDelay: 2000,
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  },
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

const DEFAULT_VALUES = {
  notAvailable: 'N/A',
  extractionFailed: 'Data extraction failed',
};

// Simple logging function
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// HTTP request helper function
const makeHttpRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': SCRAPING_CONFIG.userAgent,
        ...SCRAPING_CONFIG.headers,
        ...options.headers,
      },
      timeout: SCRAPING_CONFIG.timeout,
    };

    const req = requestModule.request(requestOptions, (res) => {
      let data = '';

      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        log(`Following redirect to: ${redirectUrl}`);
        return makeHttpRequest(redirectUrl, options)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

// Extract text using CSS selectors with fallback support
const extractTextWithSelectors = ($, selectorConfig, extractionType) => {
  // Try primary selector first
  let element = $(selectorConfig.primary);
  if (element.length > 0 && element.text().trim()) {
    return element.text().trim();
  }

  // Try fallback selectors
  for (const fallbackSelector of selectorConfig.fallbacks || []) {
    element = $(fallbackSelector);
    if (element.length > 0 && element.text().trim()) {
      log(`Used fallback selector for ${extractionType}: ${fallbackSelector}`);
      return element.text().trim();
    }
  }

  log(`No element found for ${extractionType} using any selector`, 'WARN');
  return null;
};

// Extract and clean title text
const extractTitle = ($) => {
  const titleText = extractTextWithSelectors($, CSS_SELECTORS.title, 'title');

  if (!titleText) {
    return DEFAULT_VALUES.notAvailable;
  }

  // Clean title text and validate
  const cleanedTitle = titleText.replace(/\s+/g, ' ').trim();

  if (cleanedTitle && !cleanedTitle.toLowerCase().includes('amazon.com')) {
    return cleanedTitle;
  }

  return DEFAULT_VALUES.notAvailable;
};

// Extract and format price
const extractPrice = ($) => {
  const priceText = extractTextWithSelectors($, CSS_SELECTORS.price, 'price');

  if (!priceText) {
    return DEFAULT_VALUES.notAvailable;
  }

  // Clean price text using regex pattern
  const cleanedPrice = priceText
    .replace(REGEX_PATTERNS.priceCleanup, '')
    .trim();

  if (cleanedPrice && cleanedPrice !== '') {
    return '$' + cleanedPrice;
  }

  return DEFAULT_VALUES.notAvailable;
};

// Extract ASIN from URL or HTML data attributes
const extractAsin = ($, url) => {
  // First try to extract ASIN from URL using regex
  const urlMatch = url.match(REGEX_PATTERNS.asinFromUrl);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Try to find ASIN in data attributes using CSS selectors
  for (const selector of CSS_SELECTORS.asin.dataAttributes) {
    const element = $(selector);
    if (element.length > 0) {
      const asinValue =
        element.attr('data-asin') || element.attr('data-product-id');
      if (asinValue && asinValue.match(/^[A-Z0-9]{10}$/)) {
        log(`Found ASIN in data attribute: ${asinValue}`);
        return asinValue;
      }
    }
  }

  // Fallback to regex search in HTML content
  const htmlContent = $.html();
  const htmlMatch = htmlContent.match(REGEX_PATTERNS.asinFromHtml);
  if (htmlMatch) {
    return htmlMatch[1] || htmlMatch[2];
  }

  return DEFAULT_VALUES.notAvailable;
};

// Extract and format rating
const extractRating = ($) => {
  const ratingText = extractTextWithSelectors(
    $,
    CSS_SELECTORS.rating,
    'rating'
  );

  if (!ratingText) {
    return DEFAULT_VALUES.notAvailable;
  }

  // Extract numeric rating using regex
  const ratingMatch = ratingText.match(REGEX_PATTERNS.ratingExtraction);
  if (ratingMatch) {
    return ratingMatch[1] + ' out of 5 stars';
  }

  // If the text already contains rating info, use it directly
  if (
    ratingText.toLowerCase().includes('out of') &&
    ratingText.toLowerCase().includes('star')
  ) {
    return ratingText;
  }

  return DEFAULT_VALUES.notAvailable;
};

// Extract and format review count
const extractReviewCount = ($) => {
  const reviewText = extractTextWithSelectors(
    $,
    CSS_SELECTORS.reviewCount,
    'review count'
  );

  if (!reviewText) {
    return DEFAULT_VALUES.notAvailable;
  }

  // Extract numeric count using regex
  const countMatch = reviewText.match(REGEX_PATTERNS.reviewCountExtraction);
  if (countMatch) {
    return countMatch[1] + ' ratings';
  }

  return DEFAULT_VALUES.notAvailable;
};

// Extract product data from HTML using CSS selectors
const extractProductData = (html, url) => {
  log('Starting data extraction from HTML using CSS selectors');

  const productData = {
    title: DEFAULT_VALUES.notAvailable,
    price: DEFAULT_VALUES.notAvailable,
    asin: DEFAULT_VALUES.notAvailable,
    rating: DEFAULT_VALUES.notAvailable,
    reviewCount: DEFAULT_VALUES.notAvailable,
    url: url,
  };

  try {
    // Load HTML into cheerio for CSS selector parsing
    const $ = cheerio.load(html);

    // Extract all product data using CSS selectors
    productData.title = extractTitle($);
    productData.price = extractPrice($);
    productData.asin = extractAsin($, url);
    productData.rating = extractRating($);
    productData.reviewCount = extractReviewCount($);

    log(
      `Successfully extracted data using CSS selectors: ${JSON.stringify(
        productData
      )}`
    );
    return productData;
  } catch (error) {
    log(`Data extraction error: ${error.message}`, 'ERROR');

    // Return basic data with ASIN from URL if available for error cases
    const asinMatch = url.match(REGEX_PATTERNS.asinFromUrl);
    return {
      title: DEFAULT_VALUES.extractionFailed,
      price: DEFAULT_VALUES.notAvailable,
      asin: asinMatch ? asinMatch[1] : DEFAULT_VALUES.notAvailable,
      rating: DEFAULT_VALUES.notAvailable,
      reviewCount: DEFAULT_VALUES.notAvailable,
      url: url,
    };
  }
};

// Main scraping function
const scrapeAmazonProduct = async (url) => {
  try {
    log(`Starting scrape session for: ${url}`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error('Invalid Amazon URL - URL must contain "amazon."');
    }

    // Clean URL
    const cleanUrl = url.split('?')[0];
    log(`Using clean URL: ${cleanUrl}`);

    // Make HTTP request to get the page
    log('Making HTTP request to Amazon...');
    const html = await makeHttpRequest(cleanUrl);

    if (!html || html.length < 1000) {
      throw new Error('Received empty or incomplete response from Amazon');
    }

    log(`Received HTML response (${html.length} characters)`);

    // Extract product data from HTML
    const productData = extractProductData(html, url);

    log('Scraping completed successfully');
    return productData;
  } catch (error) {
    log(`Scraping error: ${error.message}`, 'ERROR');

    // Classify errors for better user feedback
    if (
      error.message.includes('Request failed') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED')
    ) {
      throw new Error(
        'Network connection error. Please check your internet connection and try again.'
      );
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Request timeout')
    ) {
      throw new Error(
        'Page loading timeout. Amazon may be experiencing issues or blocking requests.'
      );
    } else if (error.message.includes('Invalid Amazon URL')) {
      throw new Error('Please provide a valid Amazon product URL.');
    } else if (
      error.message.includes('HTTP 4') ||
      error.message.includes('HTTP 5')
    ) {
      throw new Error(
        'Amazon returned an error response. The product may not exist or be temporarily unavailable.'
      );
    }

    throw error;
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
    } else if (error.message.includes('Amazon returned an error response')) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      error: 'Scraping failed',
      message: errorMessage,
      statusCode: statusCode,
    });
  }
};
