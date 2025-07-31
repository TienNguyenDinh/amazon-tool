const https = require('https');
const http = require('http');
const { URL } = require('url');
const cheerio = require('cheerio');
const zlib = require('zlib');

// CSS Selector constants for easy editing
const CSS_SELECTORS = {
  title: {
    primary: '#productTitle',
    fallbacks: [
      'h1[data-automation-id="product-title"]',
      'h1.product-title',
      '[data-testid="product-title"]',
      '.product-title',
      'h1 span',
      'h1',
    ],
  },
  price: {
    primary: '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    fallbacks: [
      '.a-price .a-offscreen',
      '.a-price-whole',
      '.a-price.aok-align-center .a-offscreen',
      '.a-price-range .a-offscreen',
      '.price',
      '[data-testid="price"]',
      '.a-text-price .a-offscreen',
      'span.a-price.a-text-price .a-offscreen',
    ],
  },
  rating: {
    primary: '[data-hook="average-star-rating"] .a-icon-alt',
    fallbacks: [
      '.a-icon.a-icon-star .a-icon-alt',
      '.cr-widget-FocalReviews .a-icon-alt',
      '.reviewCountTextLinkedHistogram .a-icon-alt',
      '[title*="out of 5 stars"]',
      '.a-icon-star .a-icon-alt',
      'span[data-hook="rating-out-of-text"]',
    ],
  },
  reviewCount: {
    primary: '[data-hook="total-review-count"]',
    fallbacks: [
      '#acrCustomerReviewText',
      '.cr-widget-FocalReviews [data-hook="total-review-count"]',
      'a[href*="#customerReviews"]',
      '.reviewCountTextLinkedHistogram',
      'span[data-hook="total-review-count"]',
      '#acrCustomerReviewLink',
    ],
  },
  asin: {
    // ASIN is typically extracted from URL or data attributes
    dataAttributes: ['[data-asin]', '[data-product-id]', '[data-csa-c-asin]'],
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
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  maxRetryAttempts: 2,
  retryDelay: 2000,
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    DNT: '1',
    'Sec-GPC': '1',
  },
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

// HTTP request helper function with compression support
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

      // Handle compressed responses
      let stream = res;
      const encoding = res.headers['content-encoding'];

      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        stream = res.pipe(zlib.createBrotliDecompress());
      }

      let data = '';
      stream.setEncoding('utf8');

      stream.on('data', (chunk) => {
        data += chunk;
      });

      stream.on('end', () => {
        resolve(data);
      });

      stream.on('error', (error) => {
        reject(new Error(`Decompression failed: ${error.message}`));
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
  const priceSelectors = [
    '.a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    '.a-price.aok-align-center .a-offscreen',
    '.a-price .a-offscreen',
    '.a-text-price .a-offscreen',
    'span.a-price.a-text-price .a-offscreen',
    '.a-price-whole',
    '.a-price-range .a-offscreen',
  ];

  for (const selector of priceSelectors) {
    const priceElement = $(selector).first();
    if (priceElement.length > 0) {
      const priceText = priceElement.text().trim();
      if (priceText && priceText.includes('$')) {
        log(`Found price using selector: ${selector}`, 'INFO');

        // Extract just the first valid price
        const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
        if (priceMatch) {
          return priceMatch[0];
        }
      }
    }
  }

  // Fallback: try to find any price-like text in the main product area
  const productPriceArea = $(
    '#apex_desktop, #corePrice_desktop, #priceblock_dealprice, #priceblock_ourprice'
  );
  if (productPriceArea.length > 0) {
    const priceText = productPriceArea
      .find('.a-offscreen')
      .first()
      .text()
      .trim();
    if (priceText && priceText.includes('$')) {
      const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
      if (priceMatch) {
        log(`Found price in product area: ${priceMatch[0]}`, 'INFO');
        return priceMatch[0];
      }
    }
  }

  log('No valid price found with any selector', 'WARN');
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
  const reviewSelectors = [
    '[data-hook="total-review-count"]',
    '#acrCustomerReviewText',
    'a[href*="#customerReviews"]',
    'span[data-hook="total-review-count"]',
    '#acrCustomerReviewLink',
    '.cr-widget-FocalReviews [data-hook="total-review-count"]',
  ];

  for (const selector of reviewSelectors) {
    const reviewElement = $(selector).first();
    if (reviewElement.length > 0) {
      const reviewText = reviewElement.text().trim();
      if (reviewText) {
        log(`Found review count using selector: ${selector}`, 'INFO');

        // Extract numeric count and format consistently
        const countMatch = reviewText.match(/([0-9,]+)/);
        if (countMatch) {
          const count = countMatch[1];
          // Check if it already contains "rating" or "review"
          if (
            reviewText.toLowerCase().includes('rating') ||
            reviewText.toLowerCase().includes('review')
          ) {
            return reviewText; // Return as-is if already formatted
          } else {
            return count + ' ratings'; // Add "ratings" suffix
          }
        }
      }
    }
  }

  log('No review count found with any selector', 'WARN');
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

// Main scraping function with retry logic
const scrapeAmazonProduct = async (url) => {
  let lastError;

  for (
    let attempt = 1;
    attempt <= SCRAPING_CONFIG.maxRetryAttempts;
    attempt++
  ) {
    try {
      log(
        `Starting scrape session for: ${url} (attempt ${attempt}/${SCRAPING_CONFIG.maxRetryAttempts})`
      );

      // Validate URL
      if (!url || !url.includes('amazon.')) {
        throw new Error('Invalid Amazon URL - URL must contain "amazon."');
      }

      // Clean URL but preserve important parameters
      const cleanUrl = url.split('#')[0]; // Remove fragment only
      log(`Using clean URL: ${cleanUrl}`);

      // Add random delay to mimic human behavior
      const baseDelay = attempt === 1 ? 500 : SCRAPING_CONFIG.retryDelay;
      const randomDelay = baseDelay + Math.random() * 1000; // Add 0-1 second random delay

      if (attempt > 1 || Math.random() < 0.3) {
        // 30% chance of delay even on first attempt
        log(`Waiting ${Math.round(randomDelay)}ms before request...`);
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }

      // Make HTTP request to get the page with realistic headers
      log('Making HTTP request to Amazon...');
      const additionalHeaders = {
        Referer: 'https://www.amazon.com/',
        Origin: 'https://www.amazon.com',
        'X-Requested-With': 'XMLHttpRequest',
      };
      const html = await makeHttpRequest(cleanUrl, {
        headers: additionalHeaders,
      });

      if (!html || html.length < 1000) {
        throw new Error(
          'Received empty or incomplete response from Amazon - possible bot detection'
        );
      }

      log(`Received HTML response (${html.length} characters)`);

      // Check for bot detection patterns
      const botDetectionPatterns = [
        'robot',
        'captcha',
        'To discuss automated access',
        'Sorry, we just need to make sure you',
        'Enter the characters you see below',
        'Type the characters you see in this image',
      ];

      const lowerHtml = html.toLowerCase();
      const detectedPattern = botDetectionPatterns.find((pattern) =>
        lowerHtml.includes(pattern.toLowerCase())
      );

      if (detectedPattern) {
        log(`Bot detection pattern found: ${detectedPattern}`, 'WARN');
        log('Continuing with data extraction despite bot detection...', 'INFO');
      }

      // Extract product data from HTML
      const productData = extractProductData(html, url);

      // Validate that we extracted meaningful data
      if (
        productData.title === DEFAULT_VALUES.notAvailable &&
        productData.price === DEFAULT_VALUES.notAvailable &&
        productData.rating === DEFAULT_VALUES.notAvailable
      ) {
        throw new Error(
          'No product data could be extracted - page structure may have changed'
        );
      }

      log('Scraping completed successfully');
      return productData;
    } catch (error) {
      lastError = error;
      log(`Scraping attempt ${attempt} failed: ${error.message}`, 'ERROR');

      // Don't retry for certain types of errors
      if (
        error.message.includes('Invalid Amazon URL') ||
        error.message.includes('bot detection') ||
        error.message.includes('HTTP 4')
      ) {
        break;
      }

      // Continue to next attempt if we have retries left
      if (attempt < SCRAPING_CONFIG.maxRetryAttempts) {
        log(`Will retry in ${SCRAPING_CONFIG.retryDelay}ms...`);
        continue;
      }
    }
  }

  // All attempts failed, classify the final error
  log(`All ${SCRAPING_CONFIG.maxRetryAttempts} attempts failed`, 'ERROR');

  if (
    lastError.message.includes('Request failed') ||
    lastError.message.includes('ENOTFOUND') ||
    lastError.message.includes('ECONNREFUSED')
  ) {
    throw new Error(
      'Network connection error. Please check your internet connection and try again.'
    );
  } else if (
    lastError.message.includes('timeout') ||
    lastError.message.includes('Request timeout')
  ) {
    throw new Error(
      'Page loading timeout. Amazon may be experiencing issues or blocking requests.'
    );
  } else if (lastError.message.includes('Invalid Amazon URL')) {
    throw new Error('Please provide a valid Amazon product URL.');
  } else if (lastError.message.includes('bot detection')) {
    throw new Error(
      'Amazon detected automated access. Please wait a few minutes and try again.'
    );
  } else if (
    lastError.message.includes('HTTP 4') ||
    lastError.message.includes('HTTP 5')
  ) {
    throw new Error(
      'Amazon returned an error response. The product may not exist or be temporarily unavailable.'
    );
  } else if (lastError.message.includes('No product data could be extracted')) {
    throw new Error(
      'Could not extract product information. The page structure may have changed or this may not be a product page.'
    );
  }

  throw lastError;
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

    log('API request completed successfully');

    // Return JSON response instead of Excel file
    res.status(200).json({
      success: true,
      data: productData,
    });
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
