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

const APP_CONFIG = {
  VERSION: '2.1.0-store-working',
  SERVICE_NAME: 'Amazon Product Scraper',
  DEFAULT_TIMEOUT: 10000,
  MAX_RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 100,
  MINIMAL_RESPONSE_SIZE: 1000,
};

const DEFAULT_VALUES = {
  NOT_AVAILABLE: 'N/A',
  EXTRACTION_FAILED: 'Data extraction failed',
};

const CORS_CONFIG = {
  ORIGIN: '*',
  METHODS: {
    GET: 'GET, OPTIONS',
    POST: 'POST, OPTIONS',
  },
  HEADERS: 'Content-Type',
};

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

const RATE_LIMIT_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY: 100,
  EXPONENTIAL_MULTIPLIER: 2,
  MAX_DELAY: 1000,
  RESPECT_RETRY_AFTER: true,
};

module.exports = {
  URL_TYPES,
  URL_PATTERNS,
  HTTP_STATUS,
  APP_CONFIG,
  DEFAULT_VALUES,
  CORS_CONFIG,
  USER_AGENTS,
  RATE_LIMIT_CONFIG,
};
