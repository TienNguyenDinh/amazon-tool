// DOM elements
const urlInput = document.getElementById('url-input');
const scrapeBtn = document.getElementById('scrape-btn');
const btnText = document.getElementById('btn-text');
const loadingSpinner = document.getElementById('loading-spinner');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.querySelector('.progress-fill');
const resultsSection = document.getElementById('results-section');
const resultsTBody = document.getElementById('results-tbody');

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
  generating: 'Processing extracted data...',
  displaying: 'Success! Displaying product information...',
  error: 'Error occurred while scraping',
  invalidUrl: 'Please enter a valid Amazon product URL',
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

const displayResults = (productData) => {
  try {
    // Clear previous results
    resultsTBody.innerHTML = '';

    // Create a single row with all product data
    const row = document.createElement('tr');

    // Populate each column according to COLUMN_CONFIG order
    COLUMN_CONFIG.forEach(({ key, className }) => {
      const cell = document.createElement('td');
      cell.className = className;

      const formattedValue = formatCellValue(key, productData[key]);

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

    // Show results section
    resultsSection.classList.remove('hidden');

    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    showStatus(STATUS_MESSAGES.displaying, 'success');
  } catch (error) {
    console.error('Display error:', error);
    showStatus('Failed to display results. Please try again.', 'error');
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

// Event listeners
scrapeBtn.addEventListener('click', async () => {
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
});

// Handle Enter key in URL input
urlInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter' && !scrapeBtn.disabled) {
    scrapeBtn.click();
  }
});

// Clear status when user starts typing
urlInput.addEventListener('input', () => {
  if (statusMessage.style.display !== 'none') {
    hideStatus();
  }
});

// Auto-focus URL input on page load
document.addEventListener('DOMContentLoaded', () => {
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

// Export for testing purposes (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateAmazonUrl,
    formatCellValue,
    displayResults,
    handleApiError,
  };
}
