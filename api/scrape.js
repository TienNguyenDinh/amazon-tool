const { URL } = require('url');
const cheerio = require('cheerio');
const { getPageHtml } = require('../utils/browser');
const { handleCors } = require('../utils/cors');
const { log } = require('../utils/logger');
const {
  APP_CONFIG,
  DEFAULT_VALUES,
  RATE_LIMIT_CONFIG,
  URL_TYPES,
} = require('../utils/constants');
const { detectUrlType, cleanProductUrl } = require('../utils/url-utils');

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
  // List page selectors for extracting product links
  listPages: {
    search: {
      productContainers: [
        '[data-component-type="s-search-result"]',
        '.s-result-item',
        '[data-index]',
        '.sg-col-inner .s-widget',
      ],
      productLinks: [
        'h2 a[href*="/dp/"]',
        '.a-link-normal[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        '.s-link-normal[href*="/dp/"]',
      ],
      listTitle: [
        'h2 a span',
        '.a-size-base-plus',
        '.a-size-mini .a-link-normal span',
      ],
      listPrice: [
        '.a-price .a-offscreen',
        '.a-price-whole',
        '.a-text-price .a-offscreen',
      ],
      listRating: ['.a-icon-alt', '[aria-label*="stars"]'],
    },
    category: {
      productContainers: [
        '.zg-item-immersion',
        '.p13n-sc-uncoverable-faceout',
        '.a-carousel-card',
        '[data-client-recs-list] li',
      ],
      productLinks: [
        '.p13n-sc-truncate a[href*="/dp/"]',
        'a[href*="/gp/product/"]',
        '.a-link-normal[href*="/dp/"]',
      ],
      listTitle: ['.p13n-sc-truncate', '.a-truncate-cut', '.a-size-base-plus'],
      listPrice: ['.a-price .a-offscreen', '.a-text-price .a-offscreen'],
    },
    store: {
      productContainers: [
        // Dynamic content containers (prioritize more specific selectors)
        '[data-cy="aplus-module"]',
        '[data-module-type="ProductGrid"]',
        '[data-csa-c-type="widget"]',
        '[data-widget="ProductGrid"]',
        '[data-widget]',
        '.aplus-module',
        '.aplus-v2',

        // Store-specific containers
        '[data-testid*="storefront"]',
        '[data-testid*="grid"]',
        '[data-testid*="carousel"]',
        '[class*="storefront"]',
        '[class*="widget"]',
        '[data-component*="product"]',
        '[class*="store"]',

        // Product containers
        '[class*="item"]',
        '[class*="card"]',
        '[class*="product"]',
        '.celwidget',
        '.octopus-pc-card',
        '.a-cardui',
        '[data-card-identifier]',
        '[data-testid*="product"]',
        '[data-testid*="card"]',
        '.s-widget-container',
        '.s-result-item',
        '[class*="ProductCard"]',
        '[class*="product-card"]',
        '[data-component-type*="product"]',

        // Additional dynamic containers
        '[data-automation-id*="product"]',
        '[data-cy*="product"]',
        '.fresh-container',
        '.fresh-card',

        // Generic containers as fallback
        'div[class*="a-section"]',
        'div[id*="widget"]',
        'section',
        'article',
      ],
      productLinks: [
        // Direct product links (most reliable)
        'a[href*="/dp/"]',
        '.a-link-normal[href*="/dp/"]',
        'a[href*="/gp/product/"]',

        // Nested product links (more specific searches within containers)
        'h3 a[href*="/dp/"]',
        'h2 a[href*="/dp/"]',
        '[class*="title"] a[href*="/dp/"]',
        '[class*="name"] a[href*="/dp/"]',
        '[data-testid*="title"] a[href*="/dp/"]',

        // Contextual product links
        '[class*="item"] a[href*="/dp/"]',
        '[class*="card"] a[href*="/dp/"]',
        '[class*="product"] a[href*="/dp/"]',
        '.celwidget a[href*="/dp/"]',
        '[data-testid*="product"] a[href*="/dp/"]',
        '[class*="ProductCard"] a[href*="/dp/"]',

        // Dynamic content links
        '[data-cy] a[href*="/dp/"]',
        '.aplus-module a[href*="/dp/"]',
        '[data-widget] a[href*="/dp/"]',
        '[data-automation-id] a[href*="/dp/"]',

        // Image links that point to products
        'a[href*="/dp/"]:has(img)',
      ],
      listTitle: [
        '.octopus-pc-card-content h3',
        '.a-size-base-plus',
        '.s-truncate',
        '[data-testid*="title"]',
        '[class*="ProductCard"] h3',
        '.a-size-mini',
        '.a-link-normal span',
        '[class*="item"] h3',
        '[class*="card"] h3',
        'h2',
        'h3', // Simple heading selectors
      ],
      listPrice: [
        '.a-price .a-offscreen',
        '.a-text-price .a-offscreen',
        '[data-testid*="price"]',
        '.a-price-whole',
        '[class*="price"]',
      ],
    },
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
  timeout: APP_CONFIG.DEFAULT_TIMEOUT,
  waitTime: 1000,
  maxRetryAttempts: APP_CONFIG.MAX_RETRY_ATTEMPTS,
  retryDelay: APP_CONFIG.RETRY_DELAY,
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  },
};

// Rate limiting configuration - using shared config
const RATE_LIMIT_CONFIG_LOCAL = {
  maxRateLimitRetries: RATE_LIMIT_CONFIG.MAX_RETRIES,
  baseRateLimitDelay: RATE_LIMIT_CONFIG.BASE_DELAY,
  exponentialBackoffMultiplier: RATE_LIMIT_CONFIG.EXPONENTIAL_MULTIPLIER,
  maxRateLimitDelay: RATE_LIMIT_CONFIG.MAX_DELAY,
  respectRetryAfterHeader: RATE_LIMIT_CONFIG.RESPECT_RETRY_AFTER,
};

// List page processing configuration
const LIST_PROCESSING_CONFIG = {
  maxProductsPerList: 10,
  delayBetweenProducts: 1500,
  maxListProcessingTime: 300000, // 5 minutes
  enableFallbackToListData: true,
};

// Timing constants for human-like behavior
const TIMING_CONFIG = {
  minInitialDelay: 2000, // Minimum delay for first attempt
  maxInitialDelay: 5000, // Maximum delay for first attempt
  maxRandomDelay: 3000, // Maximum additional random delay
  delayProbability: 0.8, // Probability of adding delay on first attempt
  humanClickDelay: 500, // Simulate human click/interaction delay
};

// URL Type constants - using shared constants

// Patterns to exclude from store page product extraction
const STORE_URL_EXCLUSIONS = {
  // Footer and promotional links
  FOOTER_LINKS: [
    /plattr=SCFOOT/,
    /plattr=ACOMFO/,
    /ref_=footer_/,
    /ref_=nav_/,
    /ref_=hp_/,
  ],
  // Amazon promotional/service products
  PROMO_PRODUCTS: [
    /B07984JN3L/, // Amazon Business American Express Card
    /B084KP3NG6/, // Amazon Secured Card
    /B0C7S8DFTW/, // Amazon Prime
    /B08N5WRWNW/, // Amazon Gift Card
  ],
  // Service and digital products that are not store products
  SERVICE_PATTERNS: [
    /amazon.*card/i,
    /amazon.*business/i,
    /amazon.*prime/i,
    /amazon.*gift/i,
    /amazon.*credit/i,
  ],
};

// Enhanced URL patterns for better detection - using shared patterns

// Using shared DEFAULT_VALUES from constants

// Using shared logging function

// Calculate delay for rate limiting with exponential backoff
const calculateRateLimitDelay = (attempt, retryAfterMs = null) => {
  if (RATE_LIMIT_CONFIG_LOCAL.respectRetryAfterHeader && retryAfterMs) {
    // Use server-suggested delay, but cap it at our maximum
    return Math.min(retryAfterMs, RATE_LIMIT_CONFIG_LOCAL.maxRateLimitDelay);
  }

  // Calculate exponential backoff delay
  const exponentialDelay =
    RATE_LIMIT_CONFIG_LOCAL.baseRateLimitDelay *
    Math.pow(RATE_LIMIT_CONFIG_LOCAL.exponentialBackoffMultiplier, attempt - 1);

  // Cap the delay at maximum and add some jitter to avoid thundering herd
  const cappedDelay = Math.min(
    exponentialDelay,
    RATE_LIMIT_CONFIG_LOCAL.maxRateLimitDelay
  );
  const jitter = Math.random() * 0.1 * cappedDelay; // Up to 10% jitter

  return Math.floor(cappedDelay + jitter);
};

// Using shared detectUrlType function

// Check if a URL should be excluded from store product extraction
const shouldExcludeStoreUrl = (url, title = '', isDirectSearch = false) => {
  if (!url || typeof url !== 'string') {
    return true;
  }

  // Be more lenient with footer patterns in direct search - they might be valid products
  if (isDirectSearch) {
    // Only exclude clearly promotional ASINs in direct search
    for (const pattern of STORE_URL_EXCLUSIONS.PROMO_PRODUCTS) {
      if (pattern.test(url)) {
        log(`Excluding promotional product in direct search: ${url}`, 'DEBUG');
        return true;
      }
    }

    // Only exclude obvious service patterns in direct search
    const strictServicePatterns = [
      /amazon.*business.*card/i,
      /amazon.*prime.*membership/i,
      /amazon.*gift.*card/i,
      /amazon.*credit.*card/i,
    ];

    for (const pattern of strictServicePatterns) {
      if (pattern.test(url) || (title && pattern.test(title))) {
        log(
          `Excluding service product in direct search: ${url} (${title})`,
          'DEBUG'
        );
        return true;
      }
    }

    // In direct search, don't exclude based on footer patterns - log but allow
    for (const pattern of STORE_URL_EXCLUSIONS.FOOTER_LINKS) {
      if (pattern.test(url)) {
        log(
          `Found footer/promo pattern but allowing in direct search: ${url}`,
          'DEBUG'
        );
        return false; // Allow it
      }
    }

    return false;
  }

  // Original strict filtering for container-based extraction
  // Check footer and promotional link patterns
  for (const pattern of STORE_URL_EXCLUSIONS.FOOTER_LINKS) {
    if (pattern.test(url)) {
      log(`Excluding footer/promo link: ${url}`, 'DEBUG');
      return true;
    }
  }

  // Check specific promotional product ASINs
  for (const pattern of STORE_URL_EXCLUSIONS.PROMO_PRODUCTS) {
    if (pattern.test(url)) {
      log(`Excluding promotional product: ${url}`, 'DEBUG');
      return true;
    }
  }

  // Check service pattern in URL or title
  for (const pattern of STORE_URL_EXCLUSIONS.SERVICE_PATTERNS) {
    if (pattern.test(url) || (title && pattern.test(title))) {
      log(`Excluding service product: ${url} (${title})`, 'DEBUG');
      return true;
    }
  }

  return false;
};

// Using shared cleanProductUrl function

const makeHttpRequest = async (url, isStoreDerivative = false) => {
  return getPageHtml(url, isStoreDerivative);
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
    return DEFAULT_VALUES.NOT_AVAILABLE;
  }

  // Clean title text and validate
  const cleanedTitle = titleText.replace(/\s+/g, ' ').trim();

  if (cleanedTitle && !cleanedTitle.toLowerCase().includes('amazon.com')) {
    return cleanedTitle;
  }

  return DEFAULT_VALUES.NOT_AVAILABLE;
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
  return DEFAULT_VALUES.NOT_AVAILABLE;
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

  return DEFAULT_VALUES.NOT_AVAILABLE;
};

// Extract and format rating
const extractRating = ($) => {
  const ratingText = extractTextWithSelectors(
    $,
    CSS_SELECTORS.rating,
    'rating'
  );

  if (!ratingText) {
    return DEFAULT_VALUES.NOT_AVAILABLE;
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

  return DEFAULT_VALUES.NOT_AVAILABLE;
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
  return DEFAULT_VALUES.NOT_AVAILABLE;
};

// Extract ASIN from product URL
const extractAsinFromUrl = (url) => {
  if (!url) return DEFAULT_VALUES.NOT_AVAILABLE;

  const asinMatch = url.match(REGEX_PATTERNS.asinFromUrl);
  return asinMatch ? asinMatch[1] : DEFAULT_VALUES.NOT_AVAILABLE;
};

// Extract product URLs from dynamic content (JavaScript, JSON, data attributes)
const extractDynamicStoreProducts = ($) => {
  const productUrls = new Set();
  log('Starting dynamic content extraction...', 'DEBUG');

  // Try to extract from script tags containing JSON data
  $('script').each((index, element) => {
    const scriptContent = $(element).html();
    if (scriptContent) {
      // Enhanced ASIN detection - look for various patterns
      const patterns = [
        // Standard ASIN patterns
        /["\']([B][A-Z0-9]{9})["\']/g,
        /"asin":\s*"([B][A-Z0-9]{9})"/g,
        /"ASIN":\s*"([B][A-Z0-9]{9})"/g,
        /dp\/([B][A-Z0-9]{9})/g,
        /product\/([B][A-Z0-9]{9})/g,
        // Contextual ASIN patterns in store data
        /"product-id":\s*"([B][A-Z0-9]{9})"/g,
        /"productId":\s*"([B][A-Z0-9]{9})"/g,
        /"item-id":\s*"([B][A-Z0-9]{9})"/g,
        /"itemId":\s*"([B][A-Z0-9]{9})"/g,
      ];

      patterns.forEach((pattern, patternIndex) => {
        const matches = [...scriptContent.matchAll(pattern)];
        if (matches.length > 0) {
          log(
            `Found ${matches.length} ASINs with pattern ${patternIndex + 1}`,
            'DEBUG'
          );
          matches.forEach((match) => {
            const asin = match[1];
            if (/^B[A-Z0-9]{9}$/.test(asin)) {
              productUrls.add(`https://www.amazon.com/dp/${asin}`);
            }
          });
        }
      });

      // Look for full product URLs in JSON
      const urlMatches = scriptContent.match(
        /https?:\/\/[^"'\s]*amazon\.com[^"'\s]*\/dp\/[A-Z0-9]{10}[^"'\s]*/g
      );
      if (urlMatches && urlMatches.length > 0) {
        log(`Found ${urlMatches.length} full product URLs in script`, 'DEBUG');
        urlMatches.forEach((url) => {
          // Clean up the URL
          const cleanUrl = url.replace(/['"\\].*$/, '').replace(/[<>].*$/, '');
          if (cleanUrl.includes('/dp/')) {
            productUrls.add(cleanUrl);
          }
        });
      }
    }
  });

  // Try to extract from data attributes
  $('[data-asin], [data-product-id], [data-item-id]').each((index, element) => {
    const asin =
      $(element).attr('data-asin') ||
      $(element).attr('data-product-id') ||
      $(element).attr('data-item-id');
    if (asin && /^B[A-Z0-9]{9}$/.test(asin)) {
      productUrls.add(`https://www.amazon.com/dp/${asin}`);
    }
  });

  // Look for ASINs in data-* attributes containing JSON
  $('[data-json], [data-config], [data-props], [data-state]').each(
    (index, element) => {
      ['data-json', 'data-config', 'data-props', 'data-state'].forEach(
        (attr) => {
          const dataContent = $(element).attr(attr);
          if (dataContent) {
            try {
              // Try to parse as JSON
              const parsed = JSON.parse(dataContent);
              const jsonStr = JSON.stringify(parsed);
              const asinMatches = jsonStr.match(/[A-Z0-9]{10}/g);
              if (asinMatches) {
                asinMatches.forEach((asin) => {
                  if (/^B[A-Z0-9]{9}$/.test(asin)) {
                    productUrls.add(`https://www.amazon.com/dp/${asin}`);
                  }
                });
              }
            } catch (e) {
              // If not valid JSON, search for ASINs in the string
              const asinMatches = dataContent.match(/[A-Z0-9]{10}/g);
              if (asinMatches) {
                asinMatches.forEach((asin) => {
                  if (/^B[A-Z0-9]{9}$/.test(asin)) {
                    productUrls.add(`https://www.amazon.com/dp/${asin}`);
                  }
                });
              }
            }
          }
        }
      );
    }
  );

  // Look for product URLs in any remaining places
  const bodyText = $('body').html();
  if (bodyText) {
    // Find any embedded product URLs
    const urlMatches = bodyText.match(
      /https?:\/\/[^"'\s>]*amazon\.com[^"'\s>]*\/dp\/[A-Z0-9]{10}/g
    );
    if (urlMatches) {
      urlMatches.forEach((url) => {
        // Clean up and normalize the URL
        const cleanUrl = url.replace(/['"\\].*$/, '').replace(/[<>].*$/, '');
        if (cleanUrl.includes('/dp/')) {
          productUrls.add(cleanUrl);
        }
      });
    }
  }

  // Additional extraction attempts for store-specific patterns
  log('Attempting store-specific extraction patterns...', 'DEBUG');

  // Look for any element that might contain product information
  const potentialProductElements = [
    '[data-cy*="product"]',
    '[data-testid*="product"]',
    '[class*="ProductCard"]',
    '[class*="product-card"]',
    '.aplus-module',
    '[data-widget]',
    '[data-automation-id]',
  ];

  potentialProductElements.forEach((selector) => {
    const elements = $(selector);
    if (elements.length > 0) {
      log(
        `Found ${elements.length} potential product elements with: ${selector}`,
        'DEBUG'
      );

      elements.each((index, element) => {
        // Look for ASINs in attributes
        const $el = $(element);
        const attributes = element.attribs || {};

        Object.values(attributes).forEach((value) => {
          if (typeof value === 'string') {
            const asinMatch = value.match(/B[A-Z0-9]{9}/);
            if (asinMatch) {
              productUrls.add(`https://www.amazon.com/dp/${asinMatch[0]}`);
              log(`Found ASIN in attribute: ${asinMatch[0]}`, 'DEBUG');
            }
          }
        });

        // Look for ASINs in text content
        const textContent = $el.text();
        if (textContent) {
          const asinMatch = textContent.match(/B[A-Z0-9]{9}/);
          if (asinMatch) {
            productUrls.add(`https://www.amazon.com/dp/${asinMatch[0]}`);
            log(`Found ASIN in text content: ${asinMatch[0]}`, 'DEBUG');
          }
        }
      });
    }
  });

  const urlArray = Array.from(productUrls);
  log(`Extracted ${urlArray.length} product URLs from dynamic content`, 'INFO');

  if (urlArray.length > 0) {
    log('Dynamic extraction found products:', 'DEBUG');
    urlArray.slice(0, 5).forEach((url, index) => {
      log(`  ${index + 1}. ${url}`, 'DEBUG');
    });
    if (urlArray.length > 5) {
      log(`  ... and ${urlArray.length - 5} more`, 'DEBUG');
    }
  }

  return urlArray;
};

// Extract product links from list pages
const extractProductLinksFromList = ($, urlType) => {
  const productLinks = [];
  const selectors = CSS_SELECTORS.listPages[urlType];

  if (!selectors) {
    log(`No selectors defined for URL type: ${urlType}`, 'WARN');
    return productLinks;
  }

  // Find product containers first
  let containers = $();
  let usedContainerSelector = null;

  for (const containerSelector of selectors.productContainers) {
    const found = $(containerSelector);
    if (found.length > 0) {
      containers = found;
      usedContainerSelector = containerSelector;
      log(
        `Found ${found.length} product containers with selector: ${containerSelector}`
      );
      break;
    }
  }

  if (containers.length === 0) {
    log('No product containers found on list page', 'WARN');
    log(`URL type: ${urlType}`, 'DEBUG');
    log(`Tried selectors: ${selectors.productContainers.join(', ')}`, 'DEBUG');

    // For debugging: log some common elements found on the page
    const commonElements = [
      '[data-testid]',
      '[class*="card"]',
      '[class*="product"]',
      '[class*="item"]',
      'a[href*="/dp/"]',
    ];

    commonElements.forEach((selector) => {
      const found = $(selector);
      if (found.length > 0) {
        log(
          `Found ${found.length} elements with selector: ${selector}`,
          'DEBUG'
        );
      }
    });

    return productLinks;
  }

  // Extract links from containers (limit to configured maximum)
  log(
    `Attempting to extract links from ${Math.min(
      containers.length,
      LIST_PROCESSING_CONFIG.maxProductsPerList
    )} containers using selector: ${usedContainerSelector}`,
    'DEBUG'
  );

  containers
    .slice(0, LIST_PROCESSING_CONFIG.maxProductsPerList)
    .each((index, element) => {
      const container = $(element);
      log(
        `Processing container ${index + 1}/${Math.min(
          containers.length,
          LIST_PROCESSING_CONFIG.maxProductsPerList
        )}`,
        'DEBUG'
      );

      // Try to find product link within container
      let productUrl = null;
      for (const linkSelector of selectors.productLinks) {
        let linkElement;

        // Special handling for image-based selectors
        if (linkSelector.includes(':has(img)')) {
          // Find <a> tags that contain images
          linkElement = container
            .find('a[href*="/dp/"]')
            .filter(function () {
              return $(this).find('img').length > 0;
            })
            .first();
        } else {
          linkElement = container.find(linkSelector).first();
        }

        if (linkElement.length > 0) {
          let href = linkElement.attr('href');

          // If this is an image element, get the parent link
          if (linkElement.is('img')) {
            const parentLink = linkElement.closest('a[href*="/dp/"]');
            if (parentLink.length > 0) {
              href = parentLink.attr('href');
            }
          }

          if (href) {
            // Convert relative URLs to absolute
            productUrl = href.startsWith('http')
              ? href
              : `https://www.amazon.com${href}`;
            log(`Found product link using selector: ${linkSelector}`, 'DEBUG');
            break;
          }
        }
      }

      if (productUrl) {
        // For store pages, filter out footer links and promotional products
        if (urlType === 'store' && shouldExcludeStoreUrl(productUrl)) {
          log(`Filtered out excluded URL: ${productUrl}`, 'DEBUG');
          return; // Skip this container
        }

        productLinks.push({
          url: productUrl,
          containerIndex: index,
        });
        log(
          `Successfully extracted product from container ${
            index + 1
          }: ${productUrl}`,
          'DEBUG'
        );
      } else {
        log(`No product URL found in container ${index + 1}`, 'DEBUG');

        // Debug: log what's actually in this container
        const containerHtml = container.html();
        if (containerHtml && containerHtml.length > 0) {
          log(
            `Container ${index + 1} content preview: ${containerHtml.substring(
              0,
              200
            )}...`,
            'DEBUG'
          );

          // Check for any links at all in this container
          const anyLinks = container.find('a');
          log(
            `Container ${index + 1} contains ${anyLinks.length} total links`,
            'DEBUG'
          );

          // Check for any /dp/ patterns in the container
          const dpPattern = /\/dp\/[A-Z0-9]{10}/;
          if (dpPattern.test(containerHtml)) {
            log(
              `Container ${index + 1} contains /dp/ pattern in HTML`,
              'DEBUG'
            );
          }
        }
      }
    });

  // If no links found in containers, try direct link search on the entire page
  if (productLinks.length === 0) {
    log('No links found in containers, trying direct page search', 'WARN');

    // Enhanced direct search with multiple selectors
    const directSearchSelectors = [
      'a[href*="/dp/"]',
      'a[href*="/gp/product/"]',
      '[href*="/dp/"]', // Can include other element types
    ];

    for (const selector of directSearchSelectors) {
      if (productLinks.length >= LIST_PROCESSING_CONFIG.maxProductsPerList)
        break;

      $(selector).each((index, element) => {
        if (productLinks.length >= LIST_PROCESSING_CONFIG.maxProductsPerList)
          return false;

        let href = $(element).attr('href');
        if (href) {
          const productUrl = href.startsWith('http')
            ? href
            : `https://www.amazon.com${href}`;

          // For store pages, filter out footer links and promotional products
          if (
            urlType === 'store' &&
            shouldExcludeStoreUrl(productUrl, '', true)
          ) {
            log(
              `Filtered out excluded URL in direct search: ${productUrl}`,
              'DEBUG'
            );
            return; // Skip this link
          }

          // Check if we already have this URL to avoid duplicates
          const alreadyExists = productLinks.some(
            (link) => link.url === productUrl
          );
          if (!alreadyExists) {
            productLinks.push({
              url: productUrl,
              containerIndex: productLinks.length,
              source: `direct-search-${selector}`,
            });
            log(`Found product via direct search: ${productUrl}`, 'DEBUG');
          }
        }
      });
    }
  }

  // For store pages, if still no products found, try extracting from JavaScript/data
  if (productLinks.length === 0 && urlType === 'store') {
    log(
      'No products found via selectors, trying JavaScript/data extraction',
      'WARN'
    );

    const dynamicProductUrls = extractDynamicStoreProducts($);

    dynamicProductUrls.forEach((url, index) => {
      if (index >= LIST_PROCESSING_CONFIG.maxProductsPerList) return;

      if (!shouldExcludeStoreUrl(url, '', false)) {
        productLinks.push({
          url: url,
          containerIndex: index,
          source: 'dynamic-extraction',
        });
      }
    });

    // If still no products found after all extraction attempts,
    // and we're on a store page with only promotional/service products,
    // include them but mark them as such
    if (productLinks.length === 0) {
      log(
        'No standard products found, checking for promotional products to include',
        'INFO'
      );

      // Re-scan for promotional products that were excluded
      const promotionalLinks = [];
      $('a[href*="/dp/"]').each((index, element) => {
        if (index >= LIST_PROCESSING_CONFIG.maxProductsPerList) return false;

        const href = $(element).attr('href');
        if (href) {
          const productUrl = href.startsWith('http')
            ? href
            : `https://www.amazon.com${href}`;

          // Check if this was excluded as promotional but might be valid for this store
          const isPromotional = STORE_URL_EXCLUSIONS.PROMO_PRODUCTS.some(
            (pattern) => pattern.test(productUrl)
          );

          if (isPromotional) {
            log(
              `Including promotional product as fallback: ${productUrl}`,
              'INFO'
            );
            promotionalLinks.push({
              url: productUrl,
              containerIndex: index,
              source: 'promotional-fallback',
              isPromotional: true,
            });
          }
        }
      });

      if (promotionalLinks.length > 0) {
        log(
          `Found ${promotionalLinks.length} promotional products as fallback`,
          'INFO'
        );
        productLinks.push(...promotionalLinks);
      }
    }
  }

  log(`Extracted ${productLinks.length} product links from list page`);
  return productLinks;
};

// Extract basic product info from list page item (fallback data)
const extractListItemData = ($container, selectors, productUrl) => {
  const listItemData = {
    title: DEFAULT_VALUES.NOT_AVAILABLE,
    price: DEFAULT_VALUES.NOT_AVAILABLE,
    asin: DEFAULT_VALUES.NOT_AVAILABLE,
    rating: DEFAULT_VALUES.NOT_AVAILABLE,
    reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
    url: productUrl,
    isListData: true,
  };

  // Extract ASIN from URL
  const asinMatch = productUrl.match(REGEX_PATTERNS.asinFromUrl);
  if (asinMatch) {
    listItemData.asin = asinMatch[1];
  }

  // Extract title from list item
  if (selectors.listTitle) {
    for (const titleSelector of selectors.listTitle) {
      const titleElement = $container.find(titleSelector).first();
      if (titleElement.length > 0) {
        const titleText = titleElement.text().trim();
        if (titleText) {
          listItemData.title = titleText;
          break;
        }
      }
    }
  }

  // Extract price from list item
  if (selectors.listPrice) {
    for (const priceSelector of selectors.listPrice) {
      const priceElement = $container.find(priceSelector).first();
      if (priceElement.length > 0) {
        const priceText = priceElement.text().trim();
        if (priceText && priceText.includes('$')) {
          const priceMatch = priceText.match(/\$[\d,]+\.?\d*/);
          if (priceMatch) {
            listItemData.price = priceMatch[0];
            break;
          }
        }
      }
    }
  }

  // Extract rating from list item
  if (selectors.listRating) {
    for (const ratingSelector of selectors.listRating) {
      const ratingElement = $container.find(ratingSelector).first();
      if (ratingElement.length > 0) {
        const ratingText =
          ratingElement.text() || ratingElement.attr('aria-label') || '';
        const ratingMatch = ratingText.match(REGEX_PATTERNS.ratingExtraction);
        if (ratingMatch) {
          listItemData.rating = ratingMatch[1] + ' out of 5 stars';
          break;
        }
      }
    }
  }

  return listItemData;
};

// Process list page and extract multiple products
const processListPage = async (html, url) => {
  log(`Processing list page: ${url}`);

  const urlType = detectUrlType(url);
  const $ = cheerio.load(html);
  const productLinks = extractProductLinksFromList($, urlType);

  if (productLinks.length === 0) {
    const errorDetails = `No products found on ${urlType} page. URL: ${url}`;
    log(errorDetails, 'ERROR');

    // For store pages, check if this is a legitimate store with dynamic content
    if (urlType === 'store') {
      // Enhanced store indicators detection
      const storeIndicators = [
        'brandName',
        'externalWidgetIds',
        'stores-react',
        '/stores/',
        'storefront',
        'aplus-module',
        'widgetId',
        'data-widget',
        'data-cy',
        'data-automation-id',
        '"widgets"',
        '"modules"',
        'React',
      ];

      const hasStoreIndicators =
        storeIndicators.some((indicator) => html.includes(indicator)) ||
        url.includes('/stores/');

      if (hasStoreIndicators) {
        log('Detected legitimate store page with dynamic content', 'INFO');

        // Try dynamic extraction first
        const $ = cheerio.load(html);
        const dynamicUrls = extractDynamicStoreProducts($);

        if (dynamicUrls.length > 0) {
          log(
            `Found ${dynamicUrls.length} products via dynamic extraction`,
            'INFO'
          );
          // Convert to the expected format and return
          const products = [];
          const maxProducts = Math.min(
            dynamicUrls.length,
            LIST_PROCESSING_CONFIG.maxProductsPerList
          );

          for (let i = 0; i < maxProducts; i++) {
            const productUrl = dynamicUrls[i];
            try {
              // Try to get basic product info from the URL
              const basicProductInfo = {
                title: 'Product from store (dynamic)',
                price: DEFAULT_VALUES.NOT_AVAILABLE,
                asin: extractAsinFromUrl(productUrl),
                rating: DEFAULT_VALUES.NOT_AVAILABLE,
                reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
                url: productUrl,
                source: 'dynamic-store-extraction',
              };
              products.push(basicProductInfo);
            } catch (productError) {
              log(
                `Failed to process dynamic product ${productUrl}: ${productError.message}`,
                'WARN'
              );
            }
          }

          return products;
        }

        // Instead of returning a placeholder, throw a more informative error
        // Let's log some debug information first
        const containerSelectors =
          CSS_SELECTORS.listPages.store.productContainers;
        const linkSelectors = CSS_SELECTORS.listPages.store.productLinks;

        log('Store page debugging information:', 'DEBUG');
        log(
          `Found ${containerSelectors.length} container selectors to try`,
          'DEBUG'
        );
        log(`Found ${linkSelectors.length} link selectors to try`, 'DEBUG');

        // Check what elements are actually present on the page
        const debugSelectors = [
          'a[href*="/dp/"]',
          '[data-asin]',
          '[class*="product"]',
          '[data-csa-c-type="widget"]',
          'img[src*="images-amazon"]',
        ];

        debugSelectors.forEach((selector) => {
          const found = $(selector);
          log(
            `Debug: Found ${found.length} elements with selector: ${selector}`,
            'DEBUG'
          );
        });

        throw new Error(
          `No products found on store page despite detecting store indicators. This may be due to:\n` +
            `1. Products loaded entirely via JavaScript after page load\n` +
            `2. Store page using a layout not covered by current selectors\n` +
            `3. Store page requiring authentication or having regional restrictions\n` +
            `4. Store page containing only promotional content without actual products\n` +
            `URL: ${url}`
        );
      } else {
        throw new Error(
          'No products found on store page. This store page may not contain product listings, may be using a different layout, or may require authentication to view products.'
        );
      }
    } else {
      throw new Error(`No products found on the ${urlType} page`);
    }
  }

  const products = [];
  const selectors = CSS_SELECTORS.listPages[urlType];
  const maxProducts = Math.min(
    productLinks.length,
    LIST_PROCESSING_CONFIG.maxProductsPerList
  );

  log(`Processing ${maxProducts} products from list page`);

  for (let i = 0; i < maxProducts; i++) {
    const { url: productUrl, containerIndex } = productLinks[i];

    try {
      log(`Processing product ${i + 1}/${maxProducts}: ${productUrl}`);

      // Try to scrape individual product page with enhanced retry for store-derived URLs
      const productData = await scrapeAmazonProduct(productUrl, false); // false = don't process as list
      products.push(productData);

      // Add longer delay between product requests from store pages to avoid triggering bot detection
      if (i < maxProducts - 1) {
        const delayTime =
          LIST_PROCESSING_CONFIG.delayBetweenProducts +
          Math.floor(Math.random() * 2000); // Add 0-2s random delay
        await new Promise((resolve) => setTimeout(resolve, delayTime));
      }
    } catch (error) {
      log(
        `Failed to scrape individual product ${productUrl}: ${error.message}`,
        'WARN'
      );

      // Fallback to list data if enabled
      if (LIST_PROCESSING_CONFIG.enableFallbackToListData && selectors) {
        try {
          const containers = $(
            CSS_SELECTORS.listPages[urlType].productContainers[0]
          );
          const container = containers.eq(containerIndex);
          if (container.length > 0) {
            const listItemData = extractListItemData(
              container,
              selectors,
              productUrl
            );
            listItemData.error = `Individual page scraping failed: ${error.message}`;
            products.push(listItemData);
            log(`Used fallback list data for product: ${productUrl}`);
          }
        } catch (fallbackError) {
          log(
            `Fallback extraction also failed for ${productUrl}: ${fallbackError.message}`,
            'ERROR'
          );
          products.push({
            error: `Product extraction failed: ${error.message}`,
            url: productUrl,
            title: DEFAULT_VALUES.EXTRACTION_FAILED,
            price: DEFAULT_VALUES.NOT_AVAILABLE,
            asin: DEFAULT_VALUES.NOT_AVAILABLE,
            rating: DEFAULT_VALUES.NOT_AVAILABLE,
            reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
          });
        }
      } else {
        // Add error entry
        products.push({
          error: `Product extraction failed: ${error.message}`,
          url: productUrl,
          title: DEFAULT_VALUES.EXTRACTION_FAILED,
          price: DEFAULT_VALUES.NOT_AVAILABLE,
          asin: DEFAULT_VALUES.NOT_AVAILABLE,
          rating: DEFAULT_VALUES.NOT_AVAILABLE,
          reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
        });
      }
    }
  }

  log(
    `Completed processing list page. Successfully extracted ${
      products.filter((p) => !p.error).length
    }/${products.length} products`
  );
  return products;
};

// Extract product data from HTML using CSS selectors
const extractProductData = (html, url) => {
  log('Starting data extraction from HTML using CSS selectors');

  const productData = {
    title: DEFAULT_VALUES.NOT_AVAILABLE,
    price: DEFAULT_VALUES.NOT_AVAILABLE,
    asin: DEFAULT_VALUES.NOT_AVAILABLE,
    rating: DEFAULT_VALUES.NOT_AVAILABLE,
    reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
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
      title: DEFAULT_VALUES.EXTRACTION_FAILED,
      price: DEFAULT_VALUES.NOT_AVAILABLE,
      asin: asinMatch ? asinMatch[1] : DEFAULT_VALUES.NOT_AVAILABLE,
      rating: DEFAULT_VALUES.NOT_AVAILABLE,
      reviewCount: DEFAULT_VALUES.NOT_AVAILABLE,
      url: url,
    };
  }
};

// Main scraping function with retry logic - handles both individual products and list pages
const scrapeAmazonProduct = async (url, processAsList = true) => {
  let lastError;
  let rateLimitAttempts = 0;

  // Detect URL type first
  const urlType = detectUrlType(url);
  const isListPage =
    processAsList &&
    (urlType === URL_TYPES.SEARCH ||
      urlType === URL_TYPES.CATEGORY ||
      urlType === URL_TYPES.STORE);

  log(`Detected URL type: ${urlType}, processing as list: ${isListPage}`);

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

      // Clean and normalize URL
      const cleanUrl = cleanProductUrl(url);
      log(`Using clean URL: ${cleanUrl}`);

      // Add random delay to mimic human behavior
      // Use longer delays for store pages to reduce rate limiting
      const isStorePage = urlType === URL_TYPES.STORE;
      const baseDelay =
        attempt === 1
          ? Math.floor(
              Math.random() *
                (TIMING_CONFIG.maxInitialDelay - TIMING_CONFIG.minInitialDelay)
            ) + TIMING_CONFIG.minInitialDelay
          : SCRAPING_CONFIG.retryDelay;

      // Add extra delay for store pages on first attempt
      const storePageBonus = isStorePage && attempt === 1 ? 3000 : 0;
      const randomDelay =
        baseDelay +
        storePageBonus +
        Math.floor(Math.random() * TIMING_CONFIG.maxRandomDelay);

      // Always add some delay for first attempt, higher probability for retries
      const shouldDelay =
        attempt === 1 ? Math.random() < TIMING_CONFIG.delayProbability : true; // Always delay on retries

      if (shouldDelay) {
        log(`Waiting ${Math.round(randomDelay)}ms before request...`);
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }

      // Add a small human-like delay before making the actual request
      await new Promise((resolve) =>
        setTimeout(resolve, TIMING_CONFIG.humanClickDelay)
      );

      // Make HTTP request to get the page with realistic headers
      log('Making HTTP request to Amazon...');
      log('=== CALLING makeHttpRequest ===');

      // Detect if this is a store-derived product URL to use appropriate headers
      const isStoreDerivative = urlType === URL_TYPES.PRODUCT && !processAsList;
      const html = await makeHttpRequest(cleanUrl, isStoreDerivative);
      log('=== makeHttpRequest COMPLETED ===');

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

        // For store pages and store-derived products, be more lenient with bot detection
        if (urlType === URL_TYPES.STORE) {
          log(
            'Store page with robot detection - will attempt extraction anyway',
            'INFO'
          );
        } else if (urlType === URL_TYPES.PRODUCT && url.includes('ref_=')) {
          log(
            'Product page from store link with bot detection - continuing extraction',
            'INFO'
          );
        }
      }

      // Process based on URL type
      if (isListPage) {
        log('Processing as list page');
        try {
          const products = await processListPage(html, url);
          log(
            `Scraping completed successfully - extracted ${products.length} products from list`
          );
          return products;
        } catch (listError) {
          // If list page processing fails for store pages, try as individual page
          if (urlType === URL_TYPES.STORE) {
            log(
              'List page processing failed for store, trying as individual page',
              'WARN'
            );
            log(`List error: ${listError.message}`, 'DEBUG');

            const productData = extractProductData(html, url);

            // For store pages, be more lenient with validation
            if (
              productData.title !== DEFAULT_VALUES.NOT_AVAILABLE &&
              productData.title !== DEFAULT_VALUES.EXTRACTION_FAILED
            ) {
              log('Successfully extracted store page as individual page');
              return productData;
            }
          }
          throw listError;
        }
      } else {
        log('Processing as individual product page');
        // Extract product data from HTML
        const productData = extractProductData(html, url);

        // Validate that we extracted meaningful data
        if (
          productData.title === DEFAULT_VALUES.NOT_AVAILABLE &&
          productData.price === DEFAULT_VALUES.NOT_AVAILABLE &&
          productData.rating === DEFAULT_VALUES.NOT_AVAILABLE
        ) {
          throw new Error(
            'No product data could be extracted - page structure may have changed'
          );
        }

        log('Scraping completed successfully');
        return productData;
      }
    } catch (error) {
      lastError = error;
      log(`Scraping attempt ${attempt} failed: ${error.message}`, 'ERROR');

      // Handle HTTP 429 rate limiting errors with special retry logic
      if (error.message.includes('HTTP_429_RATE_LIMIT')) {
        rateLimitAttempts++;

        if (rateLimitAttempts <= RATE_LIMIT_CONFIG_LOCAL.maxRateLimitRetries) {
          // Extract retry-after value if present
          const retryAfterMatch = error.message.match(/RETRY_AFTER_(\d+)/);
          const retryAfterMs = retryAfterMatch
            ? parseInt(retryAfterMatch[1])
            : null;

          const rateLimitDelay = calculateRateLimitDelay(
            rateLimitAttempts,
            retryAfterMs
          );

          log(
            `Rate limit hit (attempt ${rateLimitAttempts}/${
              RATE_LIMIT_CONFIG_LOCAL.maxRateLimitRetries
            }). Waiting ${Math.round(rateLimitDelay / 1000)}s before retry...`,
            'WARN'
          );
          await new Promise((resolve) => setTimeout(resolve, rateLimitDelay));

          // Reset attempt counter to give rate limit retries a fresh chance
          attempt = Math.max(0, attempt - 1);
          continue;
        } else {
          log(
            `Exceeded maximum rate limit retries (${RATE_LIMIT_CONFIG_LOCAL.maxRateLimitRetries})`,
            'ERROR'
          );
          break;
        }
      }

      // Don't retry for certain types of errors (excluding 429 which is handled above)
      if (
        error.message.includes('Invalid Amazon URL') ||
        error.message.includes('bot detection') ||
        error.message.includes('rate limit exceeded') ||
        (error.message.includes('HTTP 4') &&
          !error.message.includes('HTTP_429_RATE_LIMIT'))
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
  } else if (lastError.message.includes('rate limit exceeded')) {
    throw new Error(
      'Amazon rate limit exceeded. Please wait a few minutes before making additional requests.'
    );
  } else if (lastError.message.includes('HTTP_429_RATE_LIMIT')) {
    throw new Error(
      'Amazon is currently rate limiting requests. The system attempted multiple retries with exponential backoff but was unable to complete the request. Please wait several minutes before trying again.'
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
  // Handle CORS and method validation
  if (!handleCors(req, res, 'POST')) {
    return; // Response already sent by CORS handler
  }

  try {
    log('=== API HANDLER START ===');
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a valid Amazon product URL',
      });
    }

    log(`API request received for: ${url}`);
    log(`Scraper version: ${APP_CONFIG.VERSION}`);

    // Scrape product data
    log('=== CALLING scrapeAmazonProduct ===');
    const productData = await scrapeAmazonProduct(url);
    log('=== scrapeAmazonProduct COMPLETED ===');

    log('API request completed successfully');

    // Return JSON response with appropriate format
    // Handle both single product and array of products
    if (Array.isArray(productData)) {
      // List page results
      res.status(200).json({
        success: true,
        data: productData,
        count: productData.length,
        isListResult: true,
      });
    } else {
      // Single product result
      res.status(200).json({
        success: true,
        data: productData,
        count: 1,
        isListResult: false,
      });
    }
  } catch (error) {
    log('=== API HANDLER CAUGHT ERROR ===', 'ERROR');
    log(`Error message: ${error.message}`, 'ERROR');
    log(`Error stack: ${error.stack}`, 'ERROR');
    log('=== END ERROR DEBUG ===', 'ERROR');

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
