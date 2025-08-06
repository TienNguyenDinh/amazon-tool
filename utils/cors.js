// CORS middleware utility for Amazon Tool API handlers
// Provides consistent CORS handling across all API endpoints

const { CORS_CONFIG, HTTP_STATUS } = require('./constants');

/**
 * Apply CORS headers to response
 * @param {Object} res - Express response object
 * @param {string} allowedMethods - Allowed HTTP methods (e.g., 'GET, OPTIONS')
 */
const applyCorsHeaders = (res, allowedMethods = CORS_CONFIG.METHODS.GET) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_CONFIG.ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader('Access-Control-Allow-Headers', CORS_CONFIG.HEADERS);
};

/**
 * Handle OPTIONS preflight request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} allowedMethods - Allowed HTTP methods
 * @returns {boolean} - True if OPTIONS was handled, false otherwise
 */
const handleCorsOptions = (
  req,
  res,
  allowedMethods = CORS_CONFIG.METHODS.GET
) => {
  if (req.method === 'OPTIONS') {
    applyCorsHeaders(res, allowedMethods);
    res.status(HTTP_STATUS.OK).end();
    return true;
  }
  return false;
};

/**
 * Validate HTTP method and return error if not allowed
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} allowedMethod - The single allowed method (e.g., 'GET', 'POST')
 * @returns {boolean} - True if method is valid, false if error response was sent
 */
const validateMethod = (req, res, allowedMethod) => {
  if (req.method !== allowedMethod) {
    res.status(HTTP_STATUS.METHOD_NOT_ALLOWED).json({
      error: 'Method not allowed',
      message: `Only ${allowedMethod} requests are supported`,
    });
    return false;
  }
  return true;
};

/**
 * Complete CORS middleware for API handlers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {string} allowedMethod - The single allowed method (e.g., 'GET', 'POST')
 * @returns {boolean} - True if request should continue, false if response was sent
 */
const handleCors = (req, res, allowedMethod) => {
  const allowedMethods =
    allowedMethod === 'GET'
      ? CORS_CONFIG.METHODS.GET
      : CORS_CONFIG.METHODS.POST;

  // Apply CORS headers
  applyCorsHeaders(res, allowedMethods);

  // Handle OPTIONS preflight
  if (handleCorsOptions(req, res, allowedMethods)) {
    return false; // Request was handled
  }

  // Validate method
  if (!validateMethod(req, res, allowedMethod)) {
    return false; // Error response was sent
  }

  return true; // Continue processing
};

module.exports = {
  applyCorsHeaders,
  handleCorsOptions,
  validateMethod,
  handleCors,
};
