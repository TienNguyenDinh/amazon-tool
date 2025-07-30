// DOM elements
const urlInput = document.getElementById('url-input');
const scrapeBtn = document.getElementById('scrape-btn');
const btnText = document.getElementById('btn-text');
const loadingSpinner = document.getElementById('loading-spinner');
const statusMessage = document.getElementById('status-message');
const progressBar = document.getElementById('progress-bar');

// Configuration constants optimized for Vercel deployment
const API_CONFIG = {
  baseUrl: window.location.origin,
  scrapeEndpoint: '/api/scrape',
  timeout: 45000, // Increased from 60000 but kept under Vercel's limits
};

const STATUS_MESSAGES = {
  scraping: 'Scraping Amazon product data...',
  generating: 'Generating Excel file...',
  downloading: 'Success! Downloading file...',
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

const showProgress = () => {
  progressBar.classList.remove('hidden');
};

const hideProgress = () => {
  progressBar.classList.add('hidden');
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

const downloadFile = (blob, filename) => {
  try {
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary download link
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    downloadLink.style.display = 'none';

    // Append to body, click, and remove
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Clean up the URL object
    URL.revokeObjectURL(url);

    showStatus('File downloaded successfully!', 'success');
  } catch (error) {
    console.error('Download error:', error);
    showStatus('Failed to download file. Please try again.', 'error');
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
    showProgress();

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

    // Update status for file generation
    showStatus(STATUS_MESSAGES.generating, 'info');

    // Get the response as blob (Excel file)
    const blob = await response.blob();

    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'amazon_product_data.xlsx';

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }

    // Update status for download
    showStatus(STATUS_MESSAGES.downloading, 'success');

    // Trigger download
    downloadFile(blob, filename);
  } catch (error) {
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
    downloadFile,
    handleApiError,
  };
}
