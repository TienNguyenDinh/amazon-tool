// DOM elements
const urlInput = document.getElementById('url-input');
const urlsTextarea = document.getElementById('urls-textarea');
const listsTextarea = document.getElementById('lists-textarea');
const singleModeRadio = document.getElementById('single-mode');
const multipleModeRadio = document.getElementById('multiple-mode');
const listsModeRadio = document.getElementById('lists-mode');
const singleInputContainer = document.getElementById('single-input-container');
const multipleInputContainer = document.getElementById(
  'multiple-input-container'
);
const listsInputContainer = document.getElementById('lists-input-container');
const scrapeBtn = document.getElementById('scrape-btn');
const btnText = document.getElementById('btn-text');
const loadingSpinner = document.getElementById('loading-spinner');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.querySelector('.progress-fill');
const resultsSection = document.getElementById('results-section');
const resultsTBody = document.getElementById('results-tbody');

// Configuration constants
const INPUT_MODE = {
  SINGLE: 'single',
  MULTIPLE: 'multiple',
  LISTS: 'lists',
};

const URL_LIMITS = {
  MAX_MULTIPLE_URLS: 10,
  MAX_LISTS_URLS: 5,
  MIN_MULTIPLE_URLS: 1,
  MIN_LISTS_URLS: 1,
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
  scraping: 'Scraping Amazon product data...',
  scrapingMultiple: 'Scraping multiple Amazon products...',
  scrapingLists: 'Scraping Amazon product lists...',
  processing: 'Processing URL {current} of {total}...',
  generating: 'Processing extracted data...',
  displaying: 'Success! Displaying product information...',
  error: 'Error occurred while scraping',
  invalidUrl: 'Please enter a valid Amazon product URL',
  invalidUrls:
    'One or more URLs are invalid. Please check your Amazon product URLs.',
  invalidListUrls:
    'One or more URLs are invalid. Please check your Amazon list URLs.',
  tooManyUrls: `Please enter no more than ${URL_LIMITS.MAX_MULTIPLE_URLS} URLs`,
  tooManyListUrls: `Please enter no more than ${URL_LIMITS.MAX_LISTS_URLS} URLs`,
  emptyUrlList: 'Please enter at least one Amazon product URL',
  emptyListUrlList: 'Please enter at least one Amazon list URL',
  networkError: 'Network error. Please check your connection and try again.',
  timeout:
    'Request timed out. The page may be taking too long to load or Amazon may be blocking requests.',
  captcha: 'Amazon detected automated access. Please try again later.',
  serverError: 'Server error occurred. Please try again.',
  serviceUnavailable:
    'Service temporarily unavailable. Please try again in a moment.',
  browserError: 'Browser initialization failed. Please try again.',
  extractionError:
    'Could not extract product data. Please verify this is a valid Amazon product page.',
  partialSuccess:
    'Some products could not be scraped. Check individual results.',
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
    btnText.textContent = 'Scrape Product';
    loadingSpinner.classList.add('hidden');
  }
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
    return { valid: true };
  } catch (error) {
    return { valid: false, message: 'Please enter a valid URL format' };
  }
};

const validateMultipleUrls = (urlsText) => {
  if (!urlsText || urlsText.trim() === '') {
    return { valid: false, message: STATUS_MESSAGES.emptyUrlList };
  }

  // Split by newlines and filter out empty lines
  const urls = urlsText
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (urls.length === 0) {
    return { valid: false, message: STATUS_MESSAGES.emptyUrlList };
  }

  if (urls.length > URL_LIMITS.MAX_MULTIPLE_URLS) {
    return { valid: false, message: STATUS_MESSAGES.tooManyUrls };
  }

  // Validate each URL
  const invalidUrls = [];
  for (let i = 0; i < urls.length; i++) {
    const validation = validateAmazonUrl(urls[i]);
    if (!validation.valid) {
      invalidUrls.push(`Line ${i + 1}: ${validation.message}`);
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      message: STATUS_MESSAGES.invalidUrls,
      details: invalidUrls,
    };
  }

  return { valid: true, urls };
};

const validateListUrls = (urlsText) => {
  if (!urlsText || urlsText.trim() === '') {
    return { valid: false, message: STATUS_MESSAGES.emptyListUrlList };
  }

  // Split by newlines and filter out empty lines
  const urls = urlsText
    .split('\n')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (urls.length === 0) {
    return { valid: false, message: STATUS_MESSAGES.emptyListUrlList };
  }

  if (urls.length > URL_LIMITS.MAX_LISTS_URLS) {
    return { valid: false, message: STATUS_MESSAGES.tooManyListUrls };
  }

  // Validate each URL for Amazon list/search URLs
  const invalidUrls = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('amazon.')) {
        invalidUrls.push(`Line ${i + 1}: Please enter a valid Amazon URL`);
      } else if (
        !urlObj.pathname.includes('/s') &&
        !urlObj.pathname.includes('/gp/bestsellers') &&
        !urlObj.pathname.includes('/zgbs') &&
        !urlObj.search.includes('k=')
      ) {
        invalidUrls.push(
          `Line ${i + 1}: Please enter a valid Amazon search or category URL`
        );
      }
    } catch (error) {
      invalidUrls.push(`Line ${i + 1}: Please enter a valid URL format`);
    }
  }

  if (invalidUrls.length > 0) {
    return {
      valid: false,
      message: STATUS_MESSAGES.invalidListUrls,
      details: invalidUrls,
    };
  }

  return { valid: true, urls };
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

const scrapeMultipleProducts = async (urls) => {
  try {
    // Update UI state
    setButtonState(true);
    showStatus(STATUS_MESSAGES.scrapingMultiple, 'info');
    startGradualProgress();

    // Hide previous results
    resultsSection.classList.add('hidden');

    const results = [];
    const totalUrls = urls.length;

    // Process URLs sequentially to avoid overwhelming the server
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Update status to show current progress
      const progressMessage = STATUS_MESSAGES.processing
        .replace('{current}', i + 1)
        .replace('{total}', totalUrls);
      showStatus(progressMessage, 'info');

      try {
        // Make API request for single URL
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
            results.push(responseData.data);
          } else {
            results.push({ error: 'Invalid response format', url });
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
          results.push({ error: errorMessage, url });
        }
      } catch (error) {
        console.error(`Error scraping ${url}:`, error);
        results.push({ error: error.message || 'Network error', url });
      }

      // Add small delay between requests to be respectful to the server
      if (i < urls.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
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

const scrapeProduct = async (url) => {
  // Create abort controller for timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(
    () => abortController.abort(),
    API_CONFIG.timeout
  );

  try {
    // Update UI state
    setButtonState(true);
    showStatus(STATUS_MESSAGES.scraping, 'info');
    startGradualProgress();

    // Hide previous results
    resultsSection.classList.add('hidden');

    // Make API request
    const response = await fetch(
      `${API_CONFIG.baseUrl}${API_CONFIG.scrapeEndpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
        signal: abortController.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Handle error responses
      let errorData;
      try {
        errorData = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse error response:', jsonError);
      }

      const errorMessage = errorData?.message || `HTTP ${response.status}`;
      throw new Error(errorMessage);
    }

    // Update status for processing
    showStatus(STATUS_MESSAGES.generating, 'info');

    // Get the JSON response
    const responseData = await response.json();

    if (!responseData.success || !responseData.data) {
      throw new Error('Invalid response format from server');
    }

    // Complete progress and display results
    completeProgress(() => {
      displayResults(responseData.data);
    });
  } catch (error) {
    resetProgressController();
    updateProgressDisplay(PROGRESS_CONFIG.MIN_VALUE);
    handleApiError(error);
  } finally {
    // Reset UI state
    setButtonState(false);
    hideProgress();
    clearTimeout(timeoutId);
  }
};

// Input mode management functions
const getCurrentInputMode = () => {
  if (singleModeRadio.checked) return INPUT_MODE.SINGLE;
  if (multipleModeRadio.checked) return INPUT_MODE.MULTIPLE;
  if (listsModeRadio.checked) return INPUT_MODE.LISTS;
  return INPUT_MODE.SINGLE; // fallback
};

const switchInputMode = (mode) => {
  const singleOption = singleModeRadio.closest('.radio-option');
  const multipleOption = multipleModeRadio.closest('.radio-option');
  const listsOption = listsModeRadio.closest('.radio-option');

  // Hide all containers first
  singleInputContainer.classList.add('hidden');
  multipleInputContainer.classList.add('hidden');
  listsInputContainer.classList.add('hidden');

  // Remove active class from all options
  singleOption.classList.remove('active');
  multipleOption.classList.remove('active');
  listsOption.classList.remove('active');

  if (mode === INPUT_MODE.SINGLE) {
    singleInputContainer.classList.remove('hidden');
    singleModeRadio.checked = true;
    btnText.textContent = 'Scrape Product';
    singleOption.classList.add('active');
  } else if (mode === INPUT_MODE.MULTIPLE) {
    multipleInputContainer.classList.remove('hidden');
    multipleModeRadio.checked = true;
    btnText.textContent = 'Scrape Products';
    multipleOption.classList.add('active');
  } else if (mode === INPUT_MODE.LISTS) {
    listsInputContainer.classList.remove('hidden');
    listsModeRadio.checked = true;
    btnText.textContent = 'Scrape Product Lists';
    listsOption.classList.add('active');
  }

  // Clear any existing status messages when switching modes
  hideStatus();
  resultsSection.classList.add('hidden');
};

// Event listeners
scrapeBtn.addEventListener('click', async () => {
  const inputMode = getCurrentInputMode();

  if (inputMode === INPUT_MODE.SINGLE) {
    // Handle single URL mode
    const url = urlInput.value.trim();

    // Validate URL
    const validation = validateAmazonUrl(url);
    if (!validation.valid) {
      showStatus(validation.message, 'error');
      return;
    }

    // Clear previous status
    hideStatus();

    // Start scraping
    await scrapeProduct(url);
  } else if (inputMode === INPUT_MODE.MULTIPLE) {
    // Handle multiple URLs mode
    const urlsText = urlsTextarea.value.trim();

    // Validate URLs
    const validation = validateMultipleUrls(urlsText);
    if (!validation.valid) {
      showStatus(validation.message, 'error');
      if (validation.details) {
        console.error('URL validation details:', validation.details);
      }
      return;
    }

    // Clear previous status
    hideStatus();

    // Start scraping multiple products
    await scrapeMultipleProducts(validation.urls);
  } else if (inputMode === INPUT_MODE.LISTS) {
    // Handle product lists mode
    const urlsText = listsTextarea.value.trim();

    // Validate URLs
    const validation = validateListUrls(urlsText);
    if (!validation.valid) {
      showStatus(validation.message, 'error');
      if (validation.details) {
        console.error('URL validation details:', validation.details);
      }
      return;
    }

    // Clear previous status
    hideStatus();

    // Start scraping product lists (using same function as multiple products for now)
    await scrapeMultipleProducts(validation.urls);
  }
});

// Handle Enter key in URL inputs
urlInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && !scrapeBtn.disabled) {
    scrapeBtn.click();
  }
});

urlsTextarea.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && event.ctrlKey && !scrapeBtn.disabled) {
    // Ctrl+Enter to submit in textarea mode
    scrapeBtn.click();
  }
});

listsTextarea.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && event.ctrlKey && !scrapeBtn.disabled) {
    // Ctrl+Enter to submit in textarea mode
    scrapeBtn.click();
  }
});

// Radio button change handlers
singleModeRadio.addEventListener('change', () => {
  if (singleModeRadio.checked) {
    switchInputMode(INPUT_MODE.SINGLE);
  }
});

multipleModeRadio.addEventListener('change', () => {
  if (multipleModeRadio.checked) {
    switchInputMode(INPUT_MODE.MULTIPLE);
  }
});

listsModeRadio.addEventListener('change', () => {
  if (listsModeRadio.checked) {
    switchInputMode(INPUT_MODE.LISTS);
  }
});

// Handle radio option click events for better UX
const singleOption = document
  .querySelector('#single-mode')
  .closest('.radio-option');
const multipleOption = document
  .querySelector('#multiple-mode')
  .closest('.radio-option');
const listsOption = document
  .querySelector('#lists-mode')
  .closest('.radio-option');

singleOption.addEventListener('click', () => {
  if (!singleModeRadio.checked) {
    singleModeRadio.checked = true;
    switchInputMode(INPUT_MODE.SINGLE);
  }
});

multipleOption.addEventListener('click', () => {
  if (!multipleModeRadio.checked) {
    multipleModeRadio.checked = true;
    switchInputMode(INPUT_MODE.MULTIPLE);
  }
});

listsOption.addEventListener('click', () => {
  if (!listsModeRadio.checked) {
    listsModeRadio.checked = true;
    switchInputMode(INPUT_MODE.LISTS);
  }
});

// Handle keyboard navigation
singleOption.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    singleModeRadio.checked = true;
    switchInputMode(INPUT_MODE.SINGLE);
  }
});

multipleOption.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    multipleModeRadio.checked = true;
    switchInputMode(INPUT_MODE.MULTIPLE);
  }
});

listsOption.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    listsModeRadio.checked = true;
    switchInputMode(INPUT_MODE.LISTS);
  }
});

// Make radio options focusable for keyboard navigation
singleOption.setAttribute('tabindex', '0');
multipleOption.setAttribute('tabindex', '0');
listsOption.setAttribute('tabindex', '0');

// Clear status when user starts typing
urlInput.addEventListener('input', () => {
  if (statusMessage.style.display !== 'none') {
    hideStatus();
  }
});

urlsTextarea.addEventListener('input', () => {
  if (statusMessage.style.display !== 'none') {
    hideStatus();
  }
});

listsTextarea.addEventListener('input', () => {
  if (statusMessage.style.display !== 'none') {
    hideStatus();
  }
});

// Auto-focus appropriate input on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize to single mode
  switchInputMode(INPUT_MODE.SINGLE);
  urlInput.focus();
});

// Handle paste events to automatically clean URLs
urlInput.addEventListener('paste', (event) => {
  setTimeout(() => {
    const pastedValue = urlInput.value.trim();
    if (pastedValue) {
      // Clean up common URL artifacts
      const cleanedUrl = pastedValue
        .replace(/\?ref=.*$/, '') // Remove ref parameters
        .replace(/&ref=.*$/, '')
        .replace(/#.*$/, ''); // Remove fragments

      if (cleanedUrl !== pastedValue) {
        urlInput.value = cleanedUrl;
      }
    }
  }, 0);
});

urlsTextarea.addEventListener('paste', (event) => {
  setTimeout(() => {
    const pastedValue = urlsTextarea.value;
    if (pastedValue) {
      // Clean up URLs in textarea - split by lines and clean each URL
      const cleanedText = pastedValue
        .split('\n')
        .map((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine && trimmedLine.includes('amazon.')) {
            return trimmedLine
              .replace(/\?ref=.*$/, '') // Remove ref parameters
              .replace(/&ref=.*$/, '')
              .replace(/#.*$/, ''); // Remove fragments
          }
          return trimmedLine;
        })
        .join('\n');

      if (cleanedText !== pastedValue) {
        urlsTextarea.value = cleanedText;
      }
    }
  }, 0);
});

listsTextarea.addEventListener('paste', (event) => {
  setTimeout(() => {
    const pastedValue = listsTextarea.value;
    if (pastedValue) {
      // Clean up URLs in textarea - split by lines and clean each URL
      const cleanedText = pastedValue
        .split('\n')
        .map((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine && trimmedLine.includes('amazon.')) {
            return trimmedLine
              .replace(/\?ref=.*$/, '') // Remove ref parameters
              .replace(/&ref=.*$/, '')
              .replace(/#.*$/, ''); // Remove fragments
          }
          return trimmedLine;
        })
        .join('\n');

      if (cleanedText !== pastedValue) {
        listsTextarea.value = cleanedText;
      }
    }
  }, 0);
});

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateAmazonUrl,
    formatCellValue,
    displayResults,
    handleApiError,
  };
}
