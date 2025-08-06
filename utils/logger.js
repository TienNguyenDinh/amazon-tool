// Unified logging utility for Amazon Tool
// Provides consistent logging across all modules

/**
 * Log a message with level and optional context
 * @param {string} message - The message to log
 * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} context - Optional context identifier (e.g., 'Browser', 'Scraper')
 */
const log = (message, level = 'INFO', context = null) => {
  const timestamp = new Date().toISOString();
  const contextPrefix = context ? `[${context}] ` : '';
  console.log(`[${level}] ${contextPrefix}${message}`);
};

/**
 * Log info message
 * @param {string} message - The message to log
 * @param {string} context - Optional context identifier
 */
const logInfo = (message, context = null) => {
  log(message, 'INFO', context);
};

/**
 * Log warning message
 * @param {string} message - The message to log
 * @param {string} context - Optional context identifier
 */
const logWarn = (message, context = null) => {
  log(message, 'WARN', context);
};

/**
 * Log error message
 * @param {string} message - The message to log
 * @param {string} context - Optional context identifier
 */
const logError = (message, context = null) => {
  log(message, 'ERROR', context);
};

/**
 * Log debug message
 * @param {string} message - The message to log
 * @param {string} context - Optional context identifier
 */
const logDebug = (message, context = null) => {
  log(message, 'DEBUG', context);
};

module.exports = {
  log,
  logInfo,
  logWarn,
  logError,
  logDebug,
};
