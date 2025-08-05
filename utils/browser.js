const https = require('https');
const { URL } = require('url');

const log = (message, level = 'INFO') => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [Browser] ${message}`);
};

const getPageHtml = async (url) => {
  return new Promise((resolve, reject) => {
    try {
      log(`Starting page retrieval for: ${url}`);

      const urlObj = new URL(url);

      const options = {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        timeout: 30000,
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
        res.setEncoding('utf8');

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (!data || data.length < 1000) {
            reject(new Error('Received empty or minimal response from Amazon'));
            return;
          }

          log(
            `Successfully retrieved content (${data.length} characters) via HTTPS`
          );
          resolve(data);
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
