// Frontend constants for Amazon Tool
// Shared constants for frontend JavaScript

// URL Type Detection Constants
const URL_TYPE = {
  PRODUCT: 'product',
  SEARCH: 'search',
  CATEGORY: 'category',
  STORE: 'store',
  UNKNOWN: 'unknown',
};

// URL Pattern Matching
const URL_PATTERNS = {
  PRODUCT: [
    /\/dp\/[A-Z0-9]{10}/,
    /\/gp\/product\/[A-Z0-9]{10}/,
    /\/product\/[A-Z0-9]{10}/,
  ],
  SEARCH: [/\/s\?/, /[?&]k=/, /\/s\/ref=/],
  CATEGORY: [
    /\/gp\/bestsellers/,
    /\/zgbs\//,
    /\/Best-Sellers-/,
    /\/gp\/top-sellers/,
  ],
  STORE: [/\/stores\//, /\/shop\//, /\/brand\//, /seller/, /\/b\?node=/],
};

// URL limits
const URL_LIMITS = {
  MAX_TOTAL_URLS: 15,
  MIN_URLS: 1,
};

// Progress bar constants
const PROGRESS_CONFIG = {
  MIN_VALUE: 0,
  MAX_VALUE: 100,
  INITIAL_VALUE: 5,
  INCREMENT_STEP: 2,
  FAST_INCREMENT_STEP: 5,
  COMPLETION_THRESHOLD: 95,
};

// API Configuration
const API_CONFIG = {
  baseUrl: window.location.origin,
  scrapeEndpoint: '/api/scrape',
  timeout: 45000,
};

// Timing constants for progress animation
const PROGRESS_TIMING = {
  UPDATE_INTERVAL: 100,
  SLOW_PHASE_DURATION: 3000,
  FAST_PHASE_DURATION: 1500,
  COMPLETION_DISPLAY_TIME: 800,
  RESULTS_DELAY: 300,
};

// Column display configuration
const COLUMN_CONFIG = [
  { key: 'title', className: 'title-cell' },
  { key: 'price', className: 'price-cell' },
  { key: 'asin', className: 'asin-cell' },
  { key: 'rating', className: 'rating-cell' },
  { key: 'reviewCount', className: 'reviews-cell' },
  { key: 'url', className: 'url-cell' },
];

// Status messages
const STATUS_MESSAGES = {
  scraping: 'Processing Amazon URLs...',
  scrapingProduct: 'Scraping Amazon product data...',
  scrapingSearch: 'Processing Amazon search results...',
  scrapingCategory: 'Processing Amazon category page...',
  scrapingStore: 'Processing Amazon store page...',
  processing: 'Processing URL {current} of {total} ({type})...',
  generating: 'Processing extracted data...',
  displaying: 'Success! Displaying product information...',
  displayingList: 'Success! Displaying {count} products from list pages...',
  error: 'Error occurred while scraping',
  invalidUrl: 'Please enter a valid Amazon URL',
  networkError: 'Network error. Please check your connection and try again.',
  timeout:
    'Request timed out. The page may be taking too long to load or Amazon may be blocking requests.',
  captcha: 'Amazon detected automated access. Please try again later.',
  rateLimit:
    'Amazon rate limit exceeded. Please wait a few minutes before trying again.',
  serverError: 'Server error occurred. Please try again.',
  serviceUnavailable:
    'Service temporarily unavailable. Please try again in a moment.',
  browserError: 'Browser initialization failed. Please try again.',
  extractionError:
    'Could not extract product data. Please verify this is a valid Amazon page.',
  partialSuccess: 'Some URLs could not be processed. Check individual results.',
  partialListSuccess:
    'Extracted {success} of {total} products. Some products could not be processed.',
  urlTypesDetected: 'Detected URL types: {summary}',
};

// Magic button text
const MAGIC_BUTTON_TEXT = 'Magic Button';

// URL validation patterns
const URL_VALIDATION = {
  URL_PATTERN: /https?:\/\/[^\s]+/g,
  AMAZON_PATTERN: /amazon\./i,
};
