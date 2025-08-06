#!/usr/bin/env node

// Test script for store page scraping improvements
const scrapeHandler = require('./api/scrape');

// Mock request and response objects
const createMockRequest = (url) => ({
  method: 'POST',
  body: { url },
});

const createMockResponse = () => {
  const res = {
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      res.jsonData = data;
      return res;
    },
    setHeader: () => res,
    end: () => res,
  };
  return res;
};

async function testStorePageScraping() {
  console.log('🧪 Testing store page scraping improvements...\n');

  const testUrl =
    'https://www.amazon.com/stores/Bomves/page/50110BDF-6337-4FFF-980C-38A8EBFD4CDB';
  console.log(`🎯 Testing URL: ${testUrl}\n`);

  try {
    const req = createMockRequest(testUrl);
    const res = createMockResponse();

    console.log('⏳ Starting scrape operation...\n');

    await scrapeHandler(req, res);

    console.log('✅ Scrape operation completed!\n');
    console.log('📊 Results:');
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Data:`, JSON.stringify(res.jsonData, null, 2));

    if (res.statusCode === 200 && res.jsonData && res.jsonData.success) {
      const data = res.jsonData.data;
      if (Array.isArray(data)) {
        console.log(
          `\n🎉 Successfully extracted ${data.length} products from store page!`
        );
        data.forEach((product, index) => {
          console.log(`\nProduct ${index + 1}:`);
          console.log(`  Title: ${product.title}`);
          console.log(`  ASIN: ${product.asin}`);
          console.log(`  Price: ${product.price}`);
          console.log(`  URL: ${product.url}`);
        });
      } else {
        console.log(`\n📝 Single product result:`);
        console.log(`  Title: ${data.title}`);
        console.log(`  ASIN: ${data.asin}`);
        console.log(`  Price: ${data.price}`);
        console.log(`  URL: ${data.url}`);

        if (data.asin === 'STORE_PAGE') {
          console.log(
            `\n⚠️  Still getting placeholder store page result - this indicates the issue persists`
          );
        }
      }
    } else {
      console.log(`\n❌ Scraping failed or returned error`);
      if (res.jsonData && res.jsonData.message) {
        console.log(`Error message: ${res.jsonData.message}`);
      }
    }
  } catch (error) {
    console.error('\n💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testStorePageScraping()
    .then(() => {
      console.log('\n🏁 Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testStorePageScraping };
