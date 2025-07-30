const https = require('https');
const http = require('http');
const { URL } = require('url');
const ExcelJS = require('exceljs');

// Configuration constants
const SCRAPING_CONFIG = {
  timeout: 30000,
  waitTime: 1000,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  maxRetryAttempts: 2,
  retryDelay: 2000,
  headers: {
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  },
};

const EXCEL_CONFIG = {
  worksheetName: 'Amazon Product Data',
  fileName: 'product_data.xlsx',
  headers: [
    'Product Title',
    'Price',
    'ASIN',
    'Star Rating',
    'Number of Reviews',
    'Product URL',
  ],
};

// Simple logging function
const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
};

// HTTP request helper function
const makeHttpRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const requestModule = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': SCRAPING_CONFIG.userAgent,
        ...SCRAPING_CONFIG.headers,
        ...options.headers,
      },
      timeout: SCRAPING_CONFIG.timeout,
    };

    const req = requestModule.request(requestOptions, (res) => {
      let data = '';

      // Handle redirects
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, url).toString();
        log(`Following redirect to: ${redirectUrl}`);
        return makeHttpRequest(redirectUrl, options)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
};

// Simple HTML parser functions
const extractTextBetween = (html, startPattern, endPattern) => {
  const startIndex = html.indexOf(startPattern);
  if (startIndex === -1) return null;

  const contentStart = startIndex + startPattern.length;
  const endIndex = html.indexOf(endPattern, contentStart);
  if (endIndex === -1) return null;

  return html.substring(contentStart, endIndex).trim();
};

const extractTextFromTag = (html, tagPattern) => {
  const match = html.match(tagPattern);
  return match ? match[1].trim() : null;
};

const decodeHtmlEntities = (text) => {
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
};

// Extract product data from HTML
const extractProductData = (html, url) => {
  log('Starting data extraction from HTML');

  const productData = {
    title: 'N/A',
    price: 'N/A',
    asin: 'N/A',
    rating: 'N/A',
    reviewCount: 'N/A',
    url: url,
  };

  try {
    // Extract title - multiple patterns to try
    const titlePatterns = [
      /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i,
      /<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([^<]+)<\/h1>/i,
      /<title>([^<]+)<\/title>/i,
    ];

    for (const pattern of titlePatterns) {
      const titleMatch = html.match(pattern);
      if (titleMatch) {
        const title = decodeHtmlEntities(titleMatch[1])
          .replace(/\s+/g, ' ')
          .trim();
        if (title && !title.toLowerCase().includes('amazon.com')) {
          productData.title = title;
          break;
        }
      }
    }

    // Extract price - multiple patterns
    const pricePatterns = [
      /<span[^>]*class="[^"]*a-price-whole[^"]*"[^>]*>([^<]+)<\/span>/i,
      /<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>\$?([^<]+)<\/span>/i,
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>\$?([^<]+)<\/span>/i,
      /Price[^:]*:\s*\$?([0-9,]+\.?[0-9]*)/i,
    ];

    for (const pattern of pricePatterns) {
      const priceMatch = html.match(pattern);
      if (priceMatch) {
        const priceText = priceMatch[1].replace(/[^\d.,]/g, '').trim();
        if (priceText && priceText !== '') {
          productData.price = '$' + priceText;
          break;
        }
      }
    }

    // Extract ASIN from URL or HTML
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    if (asinMatch) {
      productData.asin = asinMatch[1];
    } else {
      // Try to find ASIN in HTML
      const asinHtmlMatch =
        html.match(/['"](B[A-Z0-9]{9})['"]/) ||
        html.match(/data-asin=["']([A-Z0-9]{10})["']/);
      if (asinHtmlMatch) {
        productData.asin = asinHtmlMatch[1];
      }
    }

    // Extract rating
    const ratingPatterns = [
      /([0-9.]+)\s+out\s+of\s+5\s+stars/i,
      /rating[^>]*>([0-9.]+)\s*<\/[^>]*>/i,
      /stars[^>]*>([0-9.]+)/i,
    ];

    for (const pattern of ratingPatterns) {
      const ratingMatch = html.match(pattern);
      if (ratingMatch) {
        productData.rating = ratingMatch[1] + ' out of 5 stars';
        break;
      }
    }

    // Extract review count
    const reviewPatterns = [
      /([0-9,]+)\s+ratings?/i,
      /([0-9,]+)\s+reviews?/i,
      /([0-9,]+)\s+customer\s+reviews?/i,
    ];

    for (const pattern of reviewPatterns) {
      const reviewMatch = html.match(pattern);
      if (reviewMatch) {
        productData.reviewCount = reviewMatch[1] + ' ratings';
        break;
      }
    }

    log(`Successfully extracted data: ${JSON.stringify(productData)}`);
    return productData;
  } catch (error) {
    log(`Data extraction error: ${error.message}`, 'ERROR');

    // Return basic data with ASIN from URL if available
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    return {
      title: 'Data extraction failed',
      price: 'N/A',
      asin: asinMatch ? asinMatch[1] : 'N/A',
      rating: 'N/A',
      reviewCount: 'N/A',
      url: url,
    };
  }
};

// Main scraping function
const scrapeAmazonProduct = async (url) => {
  try {
    log(`Starting scrape session for: ${url}`);

    // Validate URL
    if (!url || !url.includes('amazon.')) {
      throw new Error('Invalid Amazon URL - URL must contain "amazon."');
    }

    // Clean URL
    const cleanUrl = url.split('?')[0];
    log(`Using clean URL: ${cleanUrl}`);

    // Make HTTP request to get the page
    log('Making HTTP request to Amazon...');
    const html = await makeHttpRequest(cleanUrl);

    if (!html || html.length < 1000) {
      throw new Error('Received empty or incomplete response from Amazon');
    }

    log(`Received HTML response (${html.length} characters)`);

    // Extract product data from HTML
    const productData = extractProductData(html, url);

    log('Scraping completed successfully');
    return productData;
  } catch (error) {
    log(`Scraping error: ${error.message}`, 'ERROR');

    // Classify errors for better user feedback
    if (
      error.message.includes('Request failed') ||
      error.message.includes('ENOTFOUND') ||
      error.message.includes('ECONNREFUSED')
    ) {
      throw new Error(
        'Network connection error. Please check your internet connection and try again.'
      );
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Request timeout')
    ) {
      throw new Error(
        'Page loading timeout. Amazon may be experiencing issues or blocking requests.'
      );
    } else if (error.message.includes('Invalid Amazon URL')) {
      throw new Error('Please provide a valid Amazon product URL.');
    } else if (
      error.message.includes('HTTP 4') ||
      error.message.includes('HTTP 5')
    ) {
      throw new Error(
        'Amazon returned an error response. The product may not exist or be temporarily unavailable.'
      );
    }

    throw error;
  }
};

// Generate Excel file function
const generateExcelFile = async (productData) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(EXCEL_CONFIG.worksheetName);

    // Add headers
    worksheet.addRow(EXCEL_CONFIG.headers);

    // Style headers
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add data row
    worksheet.addRow([
      productData.title,
      productData.price,
      productData.asin,
      productData.rating,
      productData.reviewCount,
      productData.url,
    ]);

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    log(`Excel generation error: ${error.message}`, 'ERROR');
    throw new Error('Failed to generate Excel file');
  }
};

// API handler with proper error handling
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported',
    });
  }

  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        error: 'URL is required',
        message: 'Please provide a valid Amazon product URL',
      });
    }

    log(`API request received for: ${url}`);

    // Scrape product data
    const productData = await scrapeAmazonProduct(url);

    // Generate Excel file
    const excelBuffer = await generateExcelFile(productData);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `amazon_product_${timestamp}.xlsx`;

    // Set response headers for file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', excelBuffer.length);

    log('API request completed successfully');

    // Send Excel file
    res.send(excelBuffer);
  } catch (error) {
    log(`API request failed: ${error.message}`, 'ERROR');

    // Determine appropriate status code based on error
    let statusCode = 500;
    let errorMessage = error.message;

    if (
      error.message.includes('Invalid Amazon URL') ||
      error.message.includes('Please provide a valid')
    ) {
      statusCode = 400;
    } else if (
      error.message.includes('timeout') ||
      error.message.includes('Page loading timeout')
    ) {
      statusCode = 408;
    } else if (error.message.includes('Network connection error')) {
      statusCode = 502;
    } else if (error.message.includes('Amazon returned an error response')) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      error: 'Scraping failed',
      message: errorMessage,
      statusCode: statusCode,
    });
  }
};
