// URL utility functions for Amazon Tool
// Provides consistent URL type detection and validation

const { URL_TYPES, URL_PATTERNS } = require('./constants');

/**
 * Detect URL type based on patterns
 * @param {string} url - The URL to analyze
 * @returns {string} - One of URL_TYPES values
 */
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

/**
 * Validate that a URL is a valid Amazon URL
 * @param {string} url - The URL to validate
 * @returns {Object} - { valid: boolean, message?: string, urlType?: string }
 */
const validateAmazonUrl = (url) => {
  if (!url || url.trim() === '') {
    return { valid: false, message: 'URL is required' };
  }

  try {
    const urlObj = new URL(url);
    if (!urlObj.hostname.includes('amazon.')) {
      return { valid: false, message: 'Please enter a valid Amazon URL' };
    }

    const urlType = detectUrlType(url);
    return { valid: true, urlType };
  } catch (error) {
    return { valid: false, message: 'Please enter a valid URL format' };
  }
};

/**
 * Clean and normalize product URLs to avoid bot detection
 * @param {string} url - The URL to clean
 * @returns {string} - Cleaned URL
 */
const cleanProductUrl = (url) => {
  if (!url) return url;

  try {
    const urlObj = new URL(url);

    // Fix malformed product URLs like /dp/product/ASIN to /dp/ASIN
    urlObj.pathname = urlObj.pathname.replace(
      /\/dp\/product\/([A-Z0-9]{10})/,
      '/dp/$1'
    );
    urlObj.pathname = urlObj.pathname.replace(
      /\/gp\/product\/([A-Z0-9]{10})/,
      '/dp/$1'
    );

    const paramsToRemove = [];

    for (const [key] of urlObj.searchParams) {
      // Remove tracking parameters
      if (
        key.startsWith('plattr') ||
        key.startsWith('pf_') ||
        key.startsWith('tag') ||
        key === 'linkCode' ||
        key === 'camp' ||
        key === 'creative' ||
        key === 'creativeASIN' ||
        key === 'ie' ||
        key.includes('tracking') ||
        key.includes('utm_')
      ) {
        paramsToRemove.push(key);
      }
    }

    // Remove the problematic parameters
    paramsToRemove.forEach((param) => urlObj.searchParams.delete(param));

    // Remove fragment/hash
    urlObj.hash = '';

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, do basic cleaning
    return url.split('#')[0].split('?')[0];
  }
};

module.exports = {
  detectUrlType,
  validateAmazonUrl,
  cleanProductUrl,
  URL_TYPES,
  URL_PATTERNS,
};
