// Frontend constants for Amazon Tool
// Shared constants for frontend JavaScript

const URL_TYPES = {
  PRODUCT: 'product',
  SEARCH: 'search',
  CATEGORY: 'category',
  STORE: 'store',
  UNKNOWN: 'unknown',
};

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

const URL_LIMITS = {
  MAX_TOTAL_URLS: 15,
  MIN_URLS: 1,
};

const PROGRESS_CONFIG = {
  MIN_VALUE: 0,
  MAX_VALUE: 100,
  INITIAL_VALUE: 5,
  INCREMENT_STEP: 2,
  FAST_INCREMENT_STEP: 5,
  COMPLETION_THRESHOLD: 95,
};

const API_CONFIG = {
  baseUrl: window.location.origin,
  scrapeEndpoint: '/api/scrape',
  timeout: 10000,
};

const PROGRESS_TIMING = {
  UPDATE_INTERVAL: 50,
  SLOW_PHASE_DURATION: 300,
  FAST_PHASE_DURATION: 150,
  COMPLETION_DISPLAY_TIME: 100,
  RESULTS_DELAY: 50,
};

const COLUMN_CONFIG = [
  { key: 'title', className: 'title-cell' },
  { key: 'price', className: 'price-cell' },
  { key: 'asin', className: 'asin-cell' },
  { key: 'rating', className: 'rating-cell' },
  { key: 'reviewCount', className: 'reviews-cell' },
  { key: 'url', className: 'url-cell' },
];

const PROGRESS_PHASES = {
  INITIALIZING: {
    percentage: 5,
    message: '🚀 Getting ready to visit Amazon...',
  },
  URL_VALIDATION: {
    percentage: 10,
    message: '🔍 Checking URL format and detecting page type...',
  },
  REQUEST_PREPARATION: {
    percentage: 15,
    message: '⚙️ Preparing request with proper headers...',
  },
  NETWORK_DELAY: {
    percentage: 20,
    message: '⏳ Adding natural delay to respect rate limits...',
  },
  FETCHING_PAGE: {
    percentage: 35,
    message: '📥 Downloading page content from Amazon...',
  },
  PAGE_ANALYSIS: {
    percentage: 50,
    message: '🔎 Analyzing page structure and content...',
  },
  DATA_EXTRACTION: {
    percentage: 65,
    message: '📊 Extracting product information...',
  },
  PROCESSING_RESULTS: {
    percentage: 80,
    message: '⚡ Processing and organizing data...',
  },
  FINALIZING: {
    percentage: 95,
    message: '🎯 Finishing up and preparing results...',
  },
  COMPLETE: { percentage: 100, message: '✅ Complete! Displaying results...' },
};

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

  listProcessing: 'Found {count} products on page, extracting details...',
  productDetails: 'Extracting product {current} of {total}: {title}...',
  retryAttempt: 'First attempt failed, trying again with different approach...',
  delayWaiting: "Waiting {seconds}s to respect Amazon's rate limits...",
  fallbackMode: 'Using backup extraction method...',
  networkRequest: 'Connecting to Amazon servers...',
  htmlProcessing: 'Processing {size}KB of page data...',
  selectorSearch: 'Looking for product information on the page...',
};

const MAGIC_BUTTON_TEXT = 'Magic Button';

const URL_VALIDATION = {
  URL_PATTERN: /https?:\/\/[^\s]+/g,
  AMAZON_PATTERN: /amazon\./i,
};

const REQUEST_DELAYS = {
  SEARCH_CATEGORY_DELAY: 25,
  PRODUCT_DELAY: 15,
  DELAY_CONVERSION_MS: 1000,
  PROCESSING_DELAY: 500,
  DISPLAY_DELAY: 200,
};

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TIMEOUT: 408,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};
