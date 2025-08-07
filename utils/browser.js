const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');
const { log } = require('./logger');
const { USER_AGENTS, APP_CONFIG } = require('./constants');

const getRandomUserAgent = () => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

const getPageHtml = async (url, isStoreDerivative = false) => {
  return new Promise((resolve, reject) => {
    try {
      log(`Starting page retrieval for: ${url}`, 'INFO', 'Browser');

      const urlObj = new URL(url);
      const selectedUserAgent = getRandomUserAgent();

      log(
        `Using User-Agent: ${selectedUserAgent.substring(0, 50)}...`,
        'INFO',
        'Browser'
      );

      const baseHeaders = {
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
        'Upgrade-Insecure-Requests': '1',
        DNT: '1',
        Connection: 'keep-alive',
      };

      // Add referrer for store-derived product links to make them look more natural
      if (isStoreDerivative) {
        baseHeaders['Referer'] = 'https://www.amazon.com/stores/';
        baseHeaders['Sec-Fetch-Site'] = 'same-origin';
      } else {
        baseHeaders['Sec-Fetch-Site'] = 'none';
        baseHeaders['Sec-Fetch-User'] = '?1';
      }

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: baseHeaders,
        timeout: APP_CONFIG.DEFAULT_TIMEOUT,
      };

      const req = https.request(options, (res) => {
        // Handle redirects
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          log(`Following redirect to: ${redirectUrl}`, 'INFO', 'Browser');
          return getPageHtml(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          // Special handling for rate limiting errors
          if (res.statusCode === 429) {
            const retryAfter = res.headers['retry-after'];
            const retryAfterMs = retryAfter
              ? parseInt(retryAfter) * 1000
              : null;
            reject(
              new Error(
                `HTTP_429_RATE_LIMIT${
                  retryAfterMs ? `_RETRY_AFTER_${retryAfterMs}` : ''
                }: ${res.statusMessage}`
              )
            );
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
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
          if (!data || data.length < APP_CONFIG.MINIMAL_RESPONSE_SIZE) {
            reject(new Error('Received empty or minimal response from Amazon'));
            return;
          }

          log(
            `Successfully retrieved content (${data.length} characters) via HTTPS`,
            'INFO',
            'Browser'
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
