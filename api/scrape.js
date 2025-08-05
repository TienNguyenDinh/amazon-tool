const { URL } = require('url');
const cheerio = require('cheerio');
const { getPageHtml } = require('../utils/browser');

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
        '[class*="item"]',
        '[class*="card"]',
        '[data-csa-c-type="widget"]',
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
      ],
      productLinks: [
        // Direct product links (most reliable)
        'a[href*="/dp/"]',
        '.a-link-normal[href*="/dp/"]',
        'a[href*="/gp/product/"]',

        // Contextual product links
        '[class*="item"] a[href*="/dp/"]',
        '[class*="card"] a[href*="/dp/"]',
        '[class*="product"] a[href*="/dp/"]',
        '.celwidget a[href*="/dp/"]',
        '[data-testid*="product"] a[href*="/dp/"]',
        '[class*="ProductCard"] a[href*="/dp/"]',
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
  timeout: 45000, // Increased timeout for better reliability
  waitTime: 1000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRetryAttempts: 3, // Increased retry attempts
  retryDelay: 3000, // Increased delay between retries
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

// List page processing configuration
const LIST_PROCESSING_CONFIG = {
  maxProductsPerList: 10,
  delayBetweenProducts: 1500,
  maxListProcessingTime: 300000, // 5 minutes
  enableFallbackToListData: true,
};

// Timing constants for human-like behavior
const TIMING_CONFIG = {
  minInitialDelay: 1000, // Minimum delay for first attempt
  maxInitialDelay: 3000, // Maximum delay for first attempt
  maxRandomDelay: 2000, // Maximum additional random delay
  delayProbability: 0.5, // Probability of adding delay on first attempt
};

// URL Type constants
const URL_TYPES = {
  PRODUCT: 'product',
  SEARCH: 'search',
  CATEGORY: 'category',
  STORE: 'store',
  UNKNOWN: 'unknown',
};

// Enhanced URL patterns for better detection
const URL_PATTERNS = {
  PRODUCT: [
    /\/dp\/[A-Z0-9]{10}/,
    /\/gp\/product\/[A-Z0-9]{10}/,
    /\/product\/[A-Z0-9]{10}/,
  ],
  SEARCH: [/\/s\?/, /[?&]k=/, /\/s\/ref=/, /\/s$/],
  CATEGORY: [
    /\/gp\/bestsellers/,
    /\/zgbs\//,
    /\/Best-Sellers-/,
    /\/gp\/top-sellers/,
    /\/gp\/new-releases/,
    /\/most-wished-for/,
    /\/movers-and-shakers/,
  ],
  STORE: [/\/stores\//, /\/shop\//, /\/brand\//, /seller/, /\/b\?node=/],
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

// Detect URL type based on patterns
const detectUrlType = (url) => {
  if (!url || typeof url !== 'string') {
    return URL_TYPES.UNKNOWN;
  }

  const cleanUrl = url.trim();

  // Check product patterns first (most specific)
  for (const pattern of URL_PATTERNS.PRODUCT) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.PRODUCT;
    }
  }

  // Check search patterns
  for (const pattern of URL_PATTERNS.SEARCH) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.SEARCH;
    }
  }

  // Check category patterns
  for (const pattern of URL_PATTERNS.CATEGORY) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.CATEGORY;
    }
  }

  // Check store patterns
  for (const pattern of URL_PATTERNS.STORE) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.STORE;
    }
  }

  return URL_TYPES.UNKNOWN;
};

const makeHttpRequest = async (url) => {
  return getPageHtml(url);
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
  for (const containerSelector of selectors.productContainers) {
    const found = $(containerSelector);
    if (found.length > 0) {
      containers = found;
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
  containers
    .slice(0, LIST_PROCESSING_CONFIG.maxProductsPerList)
    .each((index, element) => {
      const container = $(element);

      // Try to find product link within container
      let productUrl = null;
      for (const linkSelector of selectors.productLinks) {
        const linkElement = container.find(linkSelector).first();
        if (linkElement.length > 0) {
          const href = linkElement.attr('href');
          if (href) {
            // Convert relative URLs to absolute
            productUrl = href.startsWith('http')
              ? href
              : `https://www.amazon.com${href}`;
            break;
          }
        }
      }

      if (productUrl) {
        productLinks.push({
          url: productUrl,
          containerIndex: index,
        });
      }
    });

  // If no links found in containers, try direct link search on the entire page
  if (productLinks.length === 0) {
    log('No links found in containers, trying direct page search', 'WARN');

    $('a[href*="/dp/"]').each((index, element) => {
      if (index >= LIST_PROCESSING_CONFIG.maxProductsPerList) return false;

      const href = $(element).attr('href');
      if (href) {
        const productUrl = href.startsWith('http')
          ? href
          : `https://www.amazon.com${href}`;

        productLinks.push({
          url: productUrl,
          containerIndex: index,
          source: 'direct-search',
        });
      }
    });
  }

  log(`Extracted ${productLinks.length} product links from list page`);
  return productLinks;
};

// Extract basic product info from list page item (fallback data)
const extractListItemData = ($container, selectors, productUrl) => {
  const listItemData = {
    title: DEFAULT_VALUES.notAvailable,
    price: DEFAULT_VALUES.notAvailable,
    asin: DEFAULT_VALUES.notAvailable,
    rating: DEFAULT_VALUES.notAvailable,
    reviewCount: DEFAULT_VALUES.notAvailable,
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

    // Provide more specific error message for store pages
    if (urlType === 'store') {
      throw new Error(
        'No products found on store page. This store page may not contain product listings, may be using a different layout, or may require authentication to view products.'
      );
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

      // Try to scrape individual product page
      const productData = await scrapeAmazonProduct(productUrl, false); // false = don't process as list
      products.push(productData);

      // Add delay between product requests
      if (i < maxProducts - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, LIST_PROCESSING_CONFIG.delayBetweenProducts)
        );
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
            title: DEFAULT_VALUES.extractionFailed,
            price: DEFAULT_VALUES.notAvailable,
            asin: DEFAULT_VALUES.notAvailable,
            rating: DEFAULT_VALUES.notAvailable,
            reviewCount: DEFAULT_VALUES.notAvailable,
          });
        }
      } else {
        // Add error entry
        products.push({
          error: `Product extraction failed: ${error.message}`,
          url: productUrl,
          title: DEFAULT_VALUES.extractionFailed,
          price: DEFAULT_VALUES.notAvailable,
          asin: DEFAULT_VALUES.notAvailable,
          rating: DEFAULT_VALUES.notAvailable,
          reviewCount: DEFAULT_VALUES.notAvailable,
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

// Main scraping function with retry logic - handles both individual products and list pages
const scrapeAmazonProduct = async (url, processAsList = true) => {
  let lastError;

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

      // Clean URL but preserve important parameters
      const cleanUrl = url.split('#')[0]; // Remove fragment only
      log(`Using clean URL: ${cleanUrl}`);

      // Add random delay to mimic human behavior with better randomization
      const baseDelay =
        attempt === 1
          ? Math.floor(
              Math.random() *
                (TIMING_CONFIG.maxInitialDelay - TIMING_CONFIG.minInitialDelay)
            ) + TIMING_CONFIG.minInitialDelay
          : SCRAPING_CONFIG.retryDelay;
      const randomDelay =
        baseDelay + Math.floor(Math.random() * TIMING_CONFIG.maxRandomDelay);

      if (attempt > 1 || Math.random() < TIMING_CONFIG.delayProbability) {
        log(`Waiting ${Math.round(randomDelay)}ms before request...`);
        await new Promise((resolve) => setTimeout(resolve, randomDelay));
      }

      // Make HTTP request to get the page with realistic headers
      log('Making HTTP request to Amazon...');
      log('=== CALLING makeHttpRequest ===');

      const html = await makeHttpRequest(cleanUrl);
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

        // For store pages, robot detection doesn't always mean complete failure
        if (urlType === URL_TYPES.STORE) {
          log(
            'Store page with robot detection - will attempt extraction anyway',
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
              productData.title !== DEFAULT_VALUES.notAvailable &&
              productData.title !== DEFAULT_VALUES.extractionFailed
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
      }
    } catch (error) {
      lastError = error;
      log(`Scraping attempt ${attempt} failed: ${error.message}`, 'ERROR');

      // Don't retry for certain types of errors
      if (
        error.message.includes('Invalid Amazon URL') ||
        error.message.includes('bot detection') ||
        error.message.includes('rate limit exceeded') ||
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
  } else if (lastError.message.includes('rate limit exceeded')) {
    throw new Error(
      'Amazon rate limit exceeded. Please wait a few minutes before making additional requests.'
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

// Version identifier for debugging
const SCRAPER_VERSION = '2.1.0-store-working';

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
    log('=== API HANDLER START ===');
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a valid Amazon product URL',
      });
    }

    log(`API request received for: ${url}`);
    log(`Scraper version: ${SCRAPER_VERSION}`);

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
