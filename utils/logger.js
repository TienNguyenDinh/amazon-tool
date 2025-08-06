// Unified logging utility for Amazon Tool
// Provides structured, precise logging optimized for AI agent analysis

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

/**
 * Core logging function with structured output
 */
const log = (message, level = 'INFO', context = null, data = null) => {
  if (LOG_LEVELS[level] > CURRENT_LOG_LEVEL) return;

  const timestamp = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm format
  const contextPrefix = context ? `[${context}]` : '[APP]';
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';

  console.log(
    `${timestamp} ${level.padEnd(5)} ${contextPrefix} ${message}${dataStr}`
  );
};

/**
 * Log operation start with timing
 */
const logOperationStart = (operation, context = null, data = null) => {
  log(`→ START ${operation}`, 'INFO', context, data);
  return Date.now();
};

/**
 * Log operation completion with duration
 */
const logOperationEnd = (operation, startTime, context = null, data = null) => {
  const duration = Date.now() - startTime;
  log(`← END ${operation} (${duration}ms)`, 'INFO', context, data);
};

/**
 * Log info message
 */
const logInfo = (message, context = null, data = null) => {
  log(message, 'INFO', context, data);
};

/**
 * Log warning message
 */
const logWarn = (message, context = null, data = null) => {
  log(message, 'WARN', context, data);
};

/**
 * Log error message with structured error info
 */
const logError = (message, context = null, error = null) => {
  const errorData = error
    ? {
        name: error.name,
        message: error.message,
        code: error.code,
      }
    : null;
  log(message, 'ERROR', context, errorData);
};

/**
 * Log debug message
 */
const logDebug = (message, context = null, data = null) => {
  log(message, 'DEBUG', context, data);
};

module.exports = {
  log,
  logInfo,
  logWarn,
  logError,
  logDebug,
  logOperationStart,
  logOperationEnd,
};
