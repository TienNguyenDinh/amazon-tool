// DOM elements
const amazonUrlsTextarea = document.getElementById('amazon-urls-textarea');
const scrapeBtn = document.getElementById('scrape-btn');
const btnText = document.getElementById('btn-text');
const loadingSpinner = document.getElementById('loading-spinner');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.querySelector('.progress-fill');
const resultsSection = document.getElementById('results-section');
const resultsTBody = document.getElementById('results-tbody');

// Configuration constants
const MAGIC_BUTTON_TEXT = 'Magic Button';

// URL type detection constants
const URL_TYPE = {
  PRODUCT: 'product',
  SEARCH: 'search',
  CATEGORY: 'category',
  STORE: 'store',
  UNKNOWN: 'unknown',
};

const URL_LIMITS = {
  MAX_TOTAL_URLS: 15,
  MIN_URLS: 1,
};

// URL pattern detection
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
  STORE: [/\/stores\//, /\/shop\//, /\/brand\//, /seller/],
};

// Progress bar constants to avoid magic numbers
const PROGRESS_CONFIG = {
  MIN_VALUE: 0,
  MAX_VALUE: 100,
  INITIAL_VALUE: 5,
  INCREMENT_STEP: 2,
  FAST_INCREMENT_STEP: 5,
  COMPLETION_THRESHOLD: 95,
};

// Progress controller state
let progressController = {
  currentValue: PROGRESS_CONFIG.MIN_VALUE,
  intervalId: null,
  isComplete: false,
  startTime: null,
};

// Configuration constants optimized for Vercel deployment
const API_CONFIG = {
  baseUrl: window.location.origin,
  scrapeEndpoint: '/api/scrape',
  timeout: 45000, // Increased from 60000 but kept under Vercel's limits
};

// Timing constants for natural progress animation
const PROGRESS_TIMING = {
  UPDATE_INTERVAL: 100, // How often to update progress (ms)
  SLOW_PHASE_DURATION: 3000, // Duration for slow initial progress (ms)
  FAST_PHASE_DURATION: 1500, // Duration for faster completion phase (ms)
  COMPLETION_DISPLAY_TIME: 800, // Time to show 100% before hiding (ms)
  RESULTS_DELAY: 300, // Delay before showing results after 100% (ms)
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
  error: 'Error occurred while scraping',
  invalidUrl: 'Please enter a valid Amazon URL',
  networkError: 'Network error. Please check your connection and try again.',
  timeout:
    'Request timed out. The page may be taking too long to load or Amazon may be blocking requests.',
  captcha: 'Amazon detected automated access. Please try again later.',
  serverError: 'Server error occurred. Please try again.',
  serviceUnavailable:
    'Service temporarily unavailable. Please try again in a moment.',
  browserError: 'Browser initialization failed. Please try again.',
  extractionError:
    'Could not extract product data. Please verify this is a valid Amazon page.',
  partialSuccess: 'Some URLs could not be processed. Check individual results.',
  urlTypesDetected: 'Detected URL types: {summary}',
};

// Column display configuration with order and CSS classes
const COLUMN_CONFIG = [
  { key: 'title', className: 'title-cell' },
  { key: 'price', className: 'price-cell' },
  { key: 'asin', className: 'asin-cell' },
  { key: 'rating', className: 'rating-cell' },
  { key: 'reviewCount', className: 'reviews-cell' },
  { key: 'url', className: 'url-cell' },
];

// Utility functions
const showStatus = (message, type = 'info') => {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = 'block';
};

const hideStatus = () => {
  statusMessage.style.display = 'none';
  statusMessage.className = 'status-message';
};

const clearProgressInterval = () => {
  if (progressController.intervalId) {
    clearInterval(progressController.intervalId);
    progressController.intervalId = null;
  }
};

const resetProgressController = () => {
  clearProgressInterval();
  progressController.currentValue = PROGRESS_CONFIG.MIN_VALUE;
  progressController.isComplete = false;
  progressController.startTime = null;
};

const updateProgressDisplay = (percentage) => {
  if (progressFill) {
    const clampedValue = Math.min(
      Math.max(percentage, PROGRESS_CONFIG.MIN_VALUE),
      PROGRESS_CONFIG.MAX_VALUE
    );
    progressFill.style.width = `${clampedValue}%`;
    progressController.currentValue = clampedValue;
  }
};

const startGradualProgress = () => {
  try {
    resetProgressController();
    if (!progressBar || !progressFill) {
      console.error('Progress bar elements not found');
      return;
    }

    progressBar.classList.remove('hidden');
    progressController.startTime = Date.now();

    updateProgressDisplay(PROGRESS_CONFIG.INITIAL_VALUE);
    progressController.currentValue = PROGRESS_CONFIG.INITIAL_VALUE;

    progressController.intervalId = setInterval(() => {
      const elapsed = Date.now() - progressController.startTime;
      const isSlowPhase = elapsed < PROGRESS_TIMING.SLOW_PHASE_DURATION;

      if (progressController.currentValue >= PROGRESS_CONFIG.MAX_VALUE) {
        progressController.isComplete = true;
        clearProgressInterval();
        return;
      }

      // Use different increment speeds for natural feeling
      const increment = isSlowPhase
        ? PROGRESS_CONFIG.INCREMENT_STEP
        : PROGRESS_CONFIG.FAST_INCREMENT_STEP;

      // Slow down as we approach completion for natural feel
      const slowdownFactor =
        progressController.currentValue > PROGRESS_CONFIG.COMPLETION_THRESHOLD
          ? 0.5
          : 1;
      const actualIncrement = increment * slowdownFactor;

      updateProgressDisplay(progressController.currentValue + actualIncrement);
    }, PROGRESS_TIMING.UPDATE_INTERVAL);
  } catch (error) {
    console.error('Error starting gradual progress:', error);
  }
};

const completeProgress = (callback) => {
  try {
    // Ensure progress reaches 100%
    clearProgressInterval();
    updateProgressDisplay(PROGRESS_CONFIG.MAX_VALUE);
    progressController.isComplete = true;

    // Show 100% for a moment before executing callback
    setTimeout(() => {
      try {
        if (callback && typeof callback === 'function') {
          callback();
        }
      } catch (error) {
        console.error('Error executing progress completion callback:', error);
      }
    }, PROGRESS_TIMING.RESULTS_DELAY);
  } catch (error) {
    console.error('Error completing progress:', error);
    // Still try to execute callback even if progress completion failed
    if (callback && typeof callback === 'function') {
      callback();
    }
  }
};

const hideProgress = () => {
  setTimeout(() => {
    progressBar.classList.add('hidden');
    resetProgressController();
    updateProgressDisplay(PROGRESS_CONFIG.MIN_VALUE);
  }, PROGRESS_TIMING.COMPLETION_DISPLAY_TIME);
};

const setButtonState = (isLoading) => {
  scrapeBtn.disabled = isLoading;
  if (isLoading) {
    btnText.textContent = 'Scraping...';
    loadingSpinner.classList.remove('hidden');
  } else {
    btnText.textContent = MAGIC_BUTTON_TEXT;
    loadingSpinner.classList.add('hidden');
  }
};

// Detect Amazon URL type based on patterns
const detectUrlType = (url) => {
  if (!url || url.trim() === '') {
    return URL_TYPE.UNKNOWN;
  }

  const cleanUrl = url.trim();

  // Check each URL type pattern
  for (const pattern of URL_PATTERNS.PRODUCT) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPE.PRODUCT;
    }
  }

  for (const pattern of URL_PATTERNS.SEARCH) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPE.SEARCH;
    }
  }

  for (const pattern of URL_PATTERNS.CATEGORY) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPE.CATEGORY;
    }
  }

  for (const pattern of URL_PATTERNS.STORE) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPE.STORE;
    }
  }

  return URL_TYPE.UNKNOWN;
};

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

const validateUnifiedUrls = (urlsText) => {
  if (!urlsText || urlsText.trim() === '') {
    return { valid: false, message: 'Please enter at least one Amazon URL' };
  }

  // Split by newlines and filter out empty lines
  const urls = urlsText
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (urls.length === 0) {
    return { valid: false, message: 'Please enter at least one Amazon URL' };
  }

  if (urls.length > URL_LIMITS.MAX_TOTAL_URLS) {
    return {
      valid: false,
      message: `Please enter no more than ${URL_LIMITS.MAX_TOTAL_URLS} URLs`,
    };
  }

  // Validate each URL and collect type information
  const invalidUrls = [];
  const validUrls = [];
  const urlTypeCount = {
    [URL_TYPE.PRODUCT]: 0,
    [URL_TYPE.SEARCH]: 0,
    [URL_TYPE.CATEGORY]: 0,
    [URL_TYPE.STORE]: 0,
    [URL_TYPE.UNKNOWN]: 0,
  };

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const validation = validateAmazonUrl(url);

    if (!validation.valid) {
      invalidUrls.push(`Line ${i + 1}: ${validation.message}`);
    } else {
      validUrls.push({
        url: url,
        type: validation.urlType,
        index: i + 1,
      });
      urlTypeCount[validation.urlType]++;
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      message: 'One or more URLs are invalid. Please check your Amazon URLs.',
      details: invalidUrls,
    };
  }

  return {
    valid: true,
    urls: validUrls,
    typeCount: urlTypeCount,
    summary: `Found ${validUrls.length} valid URLs: ${
      urlTypeCount[URL_TYPE.PRODUCT]
    } products, ${urlTypeCount[URL_TYPE.SEARCH]} searches, ${
      urlTypeCount[URL_TYPE.CATEGORY]
    } categories, ${urlTypeCount[URL_TYPE.STORE]} stores, ${
      urlTypeCount[URL_TYPE.UNKNOWN]
    } other`,
  };
};

const formatCellValue = (key, value) => {
  // Handle N/A values - check for various N/A formats
  if (
    value === 'N/A' ||
    value === 'Data extraction failed' ||
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return { value: 'N/A', isNA: true };
  }

  // Special formatting for URL field - create clickable link
  if (key === 'url') {
    return {
      value: value,
      isLink: true,
    };
  }

  // All other fields return value as-is
  return { value, isNA: false, isLink: false };
};

const displayResults = (productDataArray) => {
  try {
    // Clear previous results
    resultsTBody.innerHTML = '';

    // Handle both single product and array of products
    const productsArray = Array.isArray(productDataArray)
      ? productDataArray
      : [productDataArray];

    // Create rows for each product
    productsArray.forEach((productData, index) => {
      const row = document.createElement('tr');

      // Add error styling if product data indicates failure
      if (productData.error) {
        row.classList.add('error-row');
      }

      // Populate each column according to COLUMN_CONFIG order
      COLUMN_CONFIG.forEach(({ key, className }) => {
        const cell = document.createElement('td');
        cell.className = className;

        let cellValue = productData[key];

        // Handle error case
        if (productData.error) {
          if (key === 'title') {
            cellValue = `Error: ${productData.error}`;
          } else if (key === 'url') {
            cellValue = productData.url || 'N/A';
          } else {
            cellValue = 'N/A';
          }
        }

        const formattedValue = formatCellValue(key, cellValue);

        if (formattedValue.isNA) {
          cell.textContent = formattedValue.value;
          cell.classList.add('na-value');
        } else if (formattedValue.isLink) {
          const link = document.createElement('a');
          link.href = formattedValue.value;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'View Product';
          cell.appendChild(link);
        } else {
          cell.textContent = formattedValue.value;
        }

        row.appendChild(cell);
      });

      resultsTBody.appendChild(row);
    });

    // Show results section
    resultsSection.classList.remove('hidden');

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Determine success message based on results
    const hasErrors = productsArray.some((product) => product.error);
    const successCount = productsArray.filter(
      (product) => !product.error
    ).length;

    if (hasErrors && successCount > 0) {
      showStatus(STATUS_MESSAGES.partialSuccess, 'warning');
    } else if (successCount > 0) {
      showStatus(STATUS_MESSAGES.displaying, 'success');
    } else {
      showStatus('All products failed to scrape', 'error');
    }
  } catch (error) {
    console.error('Display error:', error);
    showStatus('Failed to display results. Please try again.', 'error');
  }
};

const processUnifiedUrls = async (urlData) => {
  try {
    // Update UI state
    setButtonState(true);
    showStatus(STATUS_MESSAGES.scraping, 'info');
    startGradualProgress();

    // Show detected URL types
    if (urlData.summary) {
      showStatus(
        STATUS_MESSAGES.urlTypesDetected.replace('{summary}', urlData.summary),
        'info'
      );
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Show for 2 seconds
    }

    // Hide previous results
    resultsSection.classList.add('hidden');

    const results = [];
    const totalUrls = urlData.urls.length;

    // Process URLs sequentially to avoid overwhelming the server
    for (let i = 0; i < urlData.urls.length; i++) {
      const urlItem = urlData.urls[i];
      const { url, type } = urlItem;

      // Get appropriate status message based on URL type
      let typeSpecificMessage;
      switch (type) {
        case URL_TYPE.PRODUCT:
          typeSpecificMessage = STATUS_MESSAGES.scrapingProduct;
          break;
        case URL_TYPE.SEARCH:
          typeSpecificMessage = STATUS_MESSAGES.scrapingSearch;
          break;
        case URL_TYPE.CATEGORY:
          typeSpecificMessage = STATUS_MESSAGES.scrapingCategory;
          break;
        case URL_TYPE.STORE:
          typeSpecificMessage = STATUS_MESSAGES.scrapingStore;
          break;
        default:
          typeSpecificMessage = STATUS_MESSAGES.scraping;
      }

      // Update status to show current progress with type
      const progressMessage = STATUS_MESSAGES.processing
        .replace('{current}', i + 1)
        .replace('{total}', totalUrls)
        .replace('{type}', type);
      showStatus(progressMessage, 'info');

      try {
        // Make API request for single URL (the backend API remains the same)
        const response = await fetch(
          `${API_CONFIG.baseUrl}${API_CONFIG.scrapeEndpoint}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          }
        );

        if (response.ok) {
          const responseData = await response.json();
          if (responseData.success && responseData.data) {
            // Add URL type information to result
            const enrichedData = {
              ...responseData.data,
              urlType: type,
              originalIndex: urlItem.index,
            };
            results.push(enrichedData);
          } else {
            results.push({
              error: 'Invalid response format',
              url,
              urlType: type,
              originalIndex: urlItem.index,
            });
          }
        } else {
          // Handle HTTP error
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (e) {
            // Use default error message
          }
          results.push({
            error: errorMessage,
            url,
            urlType: type,
            originalIndex: urlItem.index,
          });
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        results.push({
          error: error.message || 'Network error',
          url,
          urlType: type,
          originalIndex: urlItem.index,
        });
      }

      // Add delay between requests based on URL type (search/category may need longer delays)
      if (i < urlData.urls.length - 1) {
        const delay =
          type === URL_TYPE.SEARCH || type === URL_TYPE.CATEGORY ? 2500 : 1500;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Update status for processing
    showStatus(STATUS_MESSAGES.generating, 'info');

    // Complete progress and display results
    completeProgress(() => {
      displayResults(results);
    });

    return results;
  } catch (error) {
    resetProgressController();
    updateProgressDisplay(PROGRESS_CONFIG.MIN_VALUE);
    handleApiError(error);
    throw error;
  } finally {
    // Reset UI state
    setButtonState(false);
    hideProgress();
  }
};

const handleApiError = (error, response = null) => {
  console.error('API Error:', error);

  if (response) {
    switch (response.status) {
      case 400:
        showStatus(STATUS_MESSAGES.invalidUrl, 'error');
        break;
      case 408:
        showStatus(STATUS_MESSAGES.timeout, 'warning');
        break;
      case 422:
        showStatus(STATUS_MESSAGES.extractionError, 'error');
        break;
      case 429:
        showStatus(STATUS_MESSAGES.captcha, 'warning');
        break;
      case 500:
        showStatus(STATUS_MESSAGES.serverError, 'error');
        break;
      case 502:
        showStatus(STATUS_MESSAGES.networkError, 'error');
        break;
      case 503:
        showStatus(STATUS_MESSAGES.serviceUnavailable, 'warning');
        break;
      default:
        showStatus(`${STATUS_MESSAGES.error}: ${response.status}`, 'error');
    }
  } else if (error.name === 'AbortError') {
    showStatus(STATUS_MESSAGES.timeout, 'warning');
  } else {
    showStatus(STATUS_MESSAGES.networkError, 'error');
  }
};

// Event listeners
scrapeBtn.addEventListener('click', async () => {
  // Get URLs from unified input
  const urlsText = amazonUrlsTextarea.value.trim();

  // Validate URLs with unified validation
  const validation = validateUnifiedUrls(urlsText);
  if (!validation.valid) {
    showStatus(validation.message, 'error');
    if (validation.details) {
      console.error('URL validation details:', validation.details);
    }
    return;
  }

  // Clear previous status
  hideStatus();

  // Process URLs with unified logic
  await processUnifiedUrls(validation);
});

// Handle keyboard shortcuts in unified input
amazonUrlsTextarea.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && event.ctrlKey && !scrapeBtn.disabled) {
    // Ctrl+Enter to submit in textarea mode
    event.preventDefault();
    scrapeBtn.click();
  }
});

// Clear status when user starts typing in unified input
amazonUrlsTextarea.addEventListener('input', () => {
  if (statusMessage.style.display !== 'none') {
    hideStatus();
  }
});

// Auto-focus unified input on page load
document.addEventListener('DOMContentLoaded', () => {
  amazonUrlsTextarea.focus();
});

// URL detection constants for paste handling
const URL_VALIDATION = {
  URL_PATTERN: /https?:\/\/[^\s]+/g,
  AMAZON_PATTERN: /amazon\./i,
};

// Handle paste events to automatically clean URLs and add new lines in unified input
amazonUrlsTextarea.addEventListener('paste', (event) => {
  // Prevent the default paste behavior
  event.preventDefault();

  // Get the pasted content from clipboard
  const pastedText = (event.clipboardData || window.clipboardData).getData(
    'text'
  );

  if (pastedText && pastedText.trim()) {
    const currentValue = amazonUrlsTextarea.value;
    const currentCursorPosition = amazonUrlsTextarea.selectionStart;
    const currentCursorEnd = amazonUrlsTextarea.selectionEnd;

    // Check if the pasted text contains a URL
    const urls = pastedText.match(URL_VALIDATION.URL_PATTERN);
    const containsAmazonUrl =
      urls && urls.some((url) => URL_VALIDATION.AMAZON_PATTERN.test(url));

    let processedText = pastedText;
    let shouldAddNewLine = false;

    if (containsAmazonUrl) {
      // Clean up URLs and determine if we should add a new line
      processedText = pastedText
        .split(/\s+/)
        .map((text) => {
          const trimmedText = text.trim();
          if (
            trimmedText &&
            URL_VALIDATION.URL_PATTERN.test(trimmedText) &&
            URL_VALIDATION.AMAZON_PATTERN.test(trimmedText)
          ) {
            shouldAddNewLine = true;
            return trimmedText
              .replace(/\?ref=.*$/, '') // Remove ref parameters
              .replace(/&ref=.*$/, '')
              .replace(/#.*$/, ''); // Remove fragments
          }
          return trimmedText;
        })
        .filter((text) => text.length > 0)
        .join(' ');
    }

    // Insert the processed text at cursor position
    const textBeforeCursor = currentValue.substring(0, currentCursorPosition);
    const textAfterCursor = currentValue.substring(currentCursorEnd);

    let newValue;
    let newCursorPosition;

    if (shouldAddNewLine && containsAmazonUrl) {
      // Add new line after the pasted URL if it's an Amazon URL
      const needsNewLineAfter =
        textAfterCursor.length > 0 && !textAfterCursor.startsWith('\n');
      const needsNewLineBefore =
        textBeforeCursor.length > 0 && !textBeforeCursor.endsWith('\n');

      const beforeNewLine = needsNewLineBefore ? '\n' : '';
      const afterNewLine = needsNewLineAfter ? '\n' : '';

      newValue =
        textBeforeCursor +
        beforeNewLine +
        processedText +
        afterNewLine +
        textAfterCursor;
      newCursorPosition =
        textBeforeCursor.length +
        beforeNewLine.length +
        processedText.length +
        afterNewLine.length;
    } else {
      // Normal paste without new line handling
      newValue = textBeforeCursor + processedText + textAfterCursor;
      newCursorPosition = textBeforeCursor.length + processedText.length;
    }

    // Update the textarea value and cursor position
    amazonUrlsTextarea.value = newValue;
    amazonUrlsTextarea.setSelectionRange(newCursorPosition, newCursorPosition);

    // Trigger input event to clear any status messages
    amazonUrlsTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
});

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateAmazonUrl,
    validateUnifiedUrls,
    detectUrlType,
    formatCellValue,
    displayResults,
    handleApiError,
    processUnifiedUrls,
  };
}
