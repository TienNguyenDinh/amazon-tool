const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');

const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [Browser] ${message}`);
};

const REALISTIC_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

const getRandomUserAgent = () => {
  return REALISTIC_USER_AGENTS[
    Math.floor(Math.random() * REALISTIC_USER_AGENTS.length)
  ];
};

const getPageHtml = async (url) => {
  return new Promise((resolve, reject) => {
    try {
      log(`Starting page retrieval for: ${url}`);

      const urlObj = new URL(url);
      const selectedUserAgent = getRandomUserAgent();

      log(`Using User-Agent: ${selectedUserAgent.substring(0, 50)}...`);

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': selectedUserAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua':
            '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          DNT: '1',
          Connection: 'keep-alive',
        },
        timeout: 45000,
      };

      const req = https.request(options, (res) => {
        // Handle redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          log(`Following redirect to: ${redirectUrl}`);
          return getPageHtml(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = '';
        const contentEncoding = res.headers['content-encoding'];
        let responseStream = res;

        // Handle compression
        if (contentEncoding === 'gzip') {
          responseStream = res.pipe(zlib.createGunzip());
        } else if (contentEncoding === 'deflate') {
          responseStream = res.pipe(zlib.createInflate());
        } else if (contentEncoding === 'br') {
          responseStream = res.pipe(zlib.createBrotliDecompress());
        }

        responseStream.setEncoding('utf8');

        responseStream.on('data', (chunk) => {
          data += chunk;
        });

        responseStream.on('end', () => {
          if (!data || data.length < 1000) {
            reject(new Error('Received empty or minimal response from Amazon'));
            return;
          }

          log(
            `Successfully retrieved content (${data.length} characters) via HTTPS`
          );
          resolve(data);
        });

        responseStream.on('error', (error) => {
          reject(new Error(`Decompression error: ${error.message}`));
        });

        res.on('error', (error) => {
          reject(new Error(`Response error: ${error.message}`));
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
    } catch (error) {
      reject(new Error(`Page retrieval failed: ${error.message}`));
    }
  });
};

module.exports = { getPageHtml };
