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

// Configuration constants loaded from external file
// Note: constants.js should be loaded before this script

let progressController = {
  currentValue: PROGRESS_CONFIG.MIN_VALUE,
  intervalId: null,
  isComplete: false,
  startTime: null,
  currentPhase: null,
  urlIndex: 0,
  totalUrls: 0,
  isDetailedMode: false,
};

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
  progressController.currentPhase = null;
  progressController.urlIndex = 0;
  progressController.totalUrls = 0;
  progressController.isDetailedMode = false;
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

const hideProgress = () => {
  setTimeout(() => {
    progressBar.classList.add('hidden');
    resetProgressController();
    updateProgressDisplay(PROGRESS_CONFIG.MIN_VALUE);
  }, PROGRESS_TIMING.COMPLETION_DISPLAY_TIME);
};

// Detailed progress management functions
const initializeDetailedProgress = (totalUrls) => {
  progressController.isDetailedMode = true;
  progressController.totalUrls = totalUrls;
  progressController.urlIndex = 0;

  resetProgressController();
  if (progressBar) {
    progressBar.classList.remove('hidden');
  }

  // Start with initialization phase
  updateProgressPhase('INITIALIZING');
};

const updateProgressPhase = (phaseName, customMessage = null) => {
  const phase = PROGRESS_PHASES[phaseName];
  if (!phase) {
    console.warn(`Unknown progress phase: ${phaseName}`);
    return;
  }

  progressController.currentPhase = phaseName;

  // Calculate adjusted percentage based on current URL
  let adjustedPercentage = phase.percentage;
  if (progressController.totalUrls > 1) {
    const urlProgress =
      (progressController.urlIndex / progressController.totalUrls) * 100;
    const phaseContribution = phase.percentage / progressController.totalUrls;
    adjustedPercentage = urlProgress + phaseContribution;
  }

  updateProgressDisplay(
    Math.min(adjustedPercentage, PROGRESS_CONFIG.MAX_VALUE)
  );

  const message = customMessage || phase.message;
  showStatus(message, 'info');
};

const advanceToNextUrl = () => {
  progressController.urlIndex++;

  if (progressController.urlIndex >= progressController.totalUrls) {
    updateProgressPhase('COMPLETE');
    return true; // All URLs processed
  }

  return false; // More URLs to process
};

const simulateDetailedProgress = async (urlType, urlIndex, totalUrls) => {
  if (!progressController.isDetailedMode) return;

  progressController.urlIndex = urlIndex;

  const phases = ['URL_VALIDATION', 'REQUEST_PREPARATION'];

  // Add network delay phase for first URL or when there are delays
  if (
    urlIndex === 0 ||
    urlType === URL_TYPES.SEARCH ||
    urlType === URL_TYPES.CATEGORY
  ) {
    phases.push('NETWORK_DELAY');
  }

  phases.push('FETCHING_PAGE', 'PAGE_ANALYSIS', 'DATA_EXTRACTION');

  for (const phase of phases) {
    updateProgressPhase(phase);

    // Simulate realistic timing for each phase
    const delay =
      phase === 'FETCHING_PAGE'
        ? 800
        : phase === 'DATA_EXTRACTION'
        ? 600
        : phase === 'NETWORK_DELAY'
        ? 1200
        : 300;

    await new Promise((resolve) => setTimeout(resolve, delay));

    // Break if not in detailed mode anymore (operation cancelled)
    if (!progressController.isDetailedMode) break;
  }
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
    return URL_TYPES.UNKNOWN;
  }

  const cleanUrl = url.trim();

  // Check each URL type pattern
  for (const pattern of URL_PATTERNS.PRODUCT) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.PRODUCT;
    }
  }

  for (const pattern of URL_PATTERNS.SEARCH) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.SEARCH;
    }
  }

  for (const pattern of URL_PATTERNS.CATEGORY) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.CATEGORY;
    }
  }

  for (const pattern of URL_PATTERNS.STORE) {
    if (pattern.test(cleanUrl)) {
      return URL_TYPES.STORE;
    }
  }

  return URL_TYPES.UNKNOWN;
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
    [URL_TYPES.PRODUCT]: 0,
    [URL_TYPES.SEARCH]: 0,
    [URL_TYPES.CATEGORY]: 0,
    [URL_TYPES.STORE]: 0,
    [URL_TYPES.UNKNOWN]: 0,
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
      urlTypeCount[URL_TYPES.PRODUCT]
    } products, ${urlTypeCount[URL_TYPES.SEARCH]} searches, ${
      urlTypeCount[URL_TYPES.CATEGORY]
    } categories, ${urlTypeCount[URL_TYPES.STORE]} stores, ${
      urlTypeCount[URL_TYPES.UNKNOWN]
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
    const hasListResults = productsArray.some(
      (product) => product.fromListPage
    );

    if (hasErrors && successCount > 0) {
      if (hasListResults) {
        showStatus(
          STATUS_MESSAGES.partialListSuccess
            .replace('{success}', successCount)
            .replace('{total}', productsArray.length),
          'warning'
        );
      } else {
        showStatus(STATUS_MESSAGES.partialSuccess, 'warning');
      }
    } else if (successCount > 0) {
      if (hasListResults) {
        showStatus(
          STATUS_MESSAGES.displayingList.replace('{count}', successCount),
          'success'
        );
      } else {
        showStatus(STATUS_MESSAGES.displaying, 'success');
      }
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

    // Initialize detailed progress tracking
    initializeDetailedProgress(urlData.urls.length);

    // Show detected URL types
    if (urlData.summary) {
      showStatus(
        STATUS_MESSAGES.urlTypesDetected.replace('{summary}', urlData.summary),
        'info'
      );
      await new Promise((resolve) => setTimeout(resolve, 800)); // Show longer for user to read
    }

    // Hide previous results
    resultsSection.classList.add('hidden');

    const results = [];
    const totalUrls = urlData.urls.length;

    // Process URLs sequentially to avoid overwhelming the server
    for (let i = 0; i < urlData.urls.length; i++) {
      const urlItem = urlData.urls[i];
      const { url, type } = urlItem;

      // Show which URL we're working on
      const progressMessage = STATUS_MESSAGES.processing
        .replace('{current}', i + 1)
        .replace('{total}', totalUrls)
        .replace('{type}', type);
      showStatus(progressMessage, 'info');

      // Run detailed progress simulation in parallel with actual request
      const progressPromise = simulateDetailedProgress(type, i, totalUrls);

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
            // Handle both single product and list results
            if (responseData.isListResult && Array.isArray(responseData.data)) {
              // List page result - show friendly message about found products
              const productCount = responseData.data.length;
              updateProgressPhase(
                'DATA_EXTRACTION',
                STATUS_MESSAGES.listProcessing.replace('{count}', productCount)
              );

              // Add each product with metadata
              responseData.data.forEach((productData, productIndex) => {
                const enrichedData = {
                  ...productData,
                  urlType: type,
                  originalIndex: urlItem.index,
                  listIndex: productIndex,
                  fromListPage: true,
                };
                results.push(enrichedData);
              });
            } else {
              // Single product result - show what we extracted
              updateProgressPhase(
                'DATA_EXTRACTION',
                `Extracted: ${responseData.data.title || 'Product details'}`
              );

              const enrichedData = {
                ...responseData.data,
                urlType: type,
                originalIndex: urlItem.index,
                fromListPage: false,
              };
              results.push(enrichedData);
            }
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

      // Wait for progress simulation to complete
      await progressPromise;

      // Advance to next URL or complete
      const isComplete = advanceToNextUrl();

      // Add delay between requests based on URL type
      if (!isComplete) {
        const delay =
          type === URL_TYPES.SEARCH || type === URL_TYPES.CATEGORY
            ? REQUEST_DELAYS.SEARCH_CATEGORY_DELAY
            : REQUEST_DELAYS.PRODUCT_DELAY;
        updateProgressPhase(
          'NETWORK_DELAY',
          STATUS_MESSAGES.delayWaiting.replace(
            '{seconds}',
            (delay / REQUEST_DELAYS.DELAY_CONVERSION_MS).toFixed(1)
          )
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Update status for final processing
    updateProgressPhase('PROCESSING_RESULTS', STATUS_MESSAGES.generating);
    await new Promise((resolve) =>
      setTimeout(resolve, REQUEST_DELAYS.PROCESSING_DELAY)
    );

    // Complete progress and display results
    updateProgressPhase('COMPLETE');
    setTimeout(() => {
      displayResults(results);
    }, REQUEST_DELAYS.DISPLAY_DELAY);

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
      case HTTP_STATUS.BAD_REQUEST:
        showStatus(STATUS_MESSAGES.invalidUrl, 'error');
        break;
      case HTTP_STATUS.REQUEST_TIMEOUT:
        showStatus(STATUS_MESSAGES.timeout, 'warning');
        break;
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        showStatus(STATUS_MESSAGES.extractionError, 'error');
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        showStatus(STATUS_MESSAGES.rateLimit, 'warning');
        break;
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        showStatus(STATUS_MESSAGES.serverError, 'error');
        break;
      case HTTP_STATUS.BAD_GATEWAY:
        showStatus(STATUS_MESSAGES.networkError, 'error');
        break;
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
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

// URL validation constants loaded from constants.js

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
