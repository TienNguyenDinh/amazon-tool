# Amazon Product Scraper

A full-stack web application that allows users to input an Amazon product URL, scrapes key data from the product page, and displays the data in a professional table format.

## Features

- 🔍 **Web Scraping**: Uses HTTP requests with intelligent HTML parsing for serverless compatibility
- 📊 **Professional Table Display**: Shows product data in a modern, responsive table format
- 🛡️ **Anti-Blocking**: Implements realistic headers and request patterns
- 🎨 **Modern UI**: Clean, responsive web interface
- ⚡ **Real-time Feedback**: Progress indicators and status updates
- 🔧 **Error Handling**: Comprehensive error handling with user-friendly messages
- ☁️ **Serverless Ready**: Optimized for deployment on Vercel and other serverless platforms

## Data Extracted

- **Product Title**: Main product name
- **Price**: Current product price
- **ASIN**: Amazon Standard Identification Number
- **Star Rating**: Customer rating (e.g., "4.5 out of 5 stars")
- **Number of Reviews**: Total review count
- **Product URL**: Original Amazon URL

## Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **HTTP Requests** - Native Node.js HTTP client for web scraping
- **Cheerio** - HTML parsing and CSS selector support
- **CORS** - Cross-origin resource sharing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with modern design
- **Vanilla JavaScript** - Functionality

## Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Internet connection** (for making requests to Amazon)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd amazon-tool
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

   That's it! No additional browser installation needed.

## Usage

### Starting the Server

1. **Start the application:**
   ```bash
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

2. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

### Using the Application

1. **Copy an Amazon product URL** from your browser
   - Example: `https://www.amazon.com/product-name/dp/B08N5WRWNW`

2. **Paste the URL** into the input field on the web page

3. **Click "Scrape Product"** to start the extraction process

4. **Wait for the process to complete** (5-15 seconds typically)

5. **Download will start automatically** once scraping is complete

### API Usage

You can also use the API directly:

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/your-product-url"}' \
  --output product_data.xlsx
```

## Project Structure

```
amazon-tool/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── vercel.json            # Vercel deployment configuration
├── README.md             # This file
├── api/                  # API endpoints
│   ├── scrape.js         # Main scraping logic
│   └── health.js         # Health check endpoint
└── public/               # Frontend files
    ├── index.html        # Main HTML page
    ├── style.css         # CSS styles
    └── script.js         # Frontend JavaScript
```

## Configuration

### Environment Variables

You can customize the server behavior using environment variables:

```bash
PORT=3000                 # Server port (default: 3000)
```

### Scraping Configuration

Edit the constants in `api/scrape.js` to modify:

- **Timeout settings**: Adjust `SCRAPING_CONFIG.timeout`
- **Wait times**: Modify `SCRAPING_CONFIG.waitTime`
- **User agent**: Update `SCRAPING_CONFIG.userAgent`
- **Request headers**: Customize `SCRAPING_CONFIG.headers`

## Deployment

### Vercel Deployment (Recommended)

This application is optimized for Vercel deployment:

1. **Push your code to GitHub**

2. **Connect to Vercel:**
   - Import your GitHub repository
   - Vercel will automatically detect the configuration

3. **Deploy:**
   - No additional configuration needed
   - The app will work in serverless mode automatically

### Other Platforms

The application can be deployed on any Node.js hosting platform that supports:
- Node.js 18+
- HTTP requests (no browser automation dependencies)

## Troubleshooting

### Common Issues

1. **"Invalid Amazon URL" error**
   - Ensure the URL contains "amazon." in the domain
   - Use direct product page URLs (not search results)

2. **"Network connection error"**
   - Check your internet connection
   - Amazon may be temporarily blocking requests
   - Try again after a few minutes

3. **"Page loading timeout"**
   - Amazon may be experiencing high load
   - Try with a different Amazon product URL
   - Check if the product page loads in your browser

4. **Missing data fields**
   - Some products may not have all data fields
   - Missing fields will show "N/A" in the Excel file
   - Amazon's page structure may vary for different product types

5. **"HTTP 4xx/5xx" errors**
   - The product may not exist or be temporarily unavailable
   - Try with a different product URL
   - Check if the URL is accessible in your browser

### Production Issues

If the app works locally but fails in production:

1. **Check deployment logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Ensure serverless function timeout** is sufficient (25 seconds configured)
4. **Test with different Amazon URLs** to rule out specific product issues

## Development

### Adding New Data Fields

1. Add new patterns to the extraction logic in `api/scrape.js`
2. Update the `EXCEL_CONFIG.headers` array
3. Add the new field to the Excel row generation

### Modifying Scraping Logic

- Edit the `extractProductData` function in `api/scrape.js`
- Add new regex patterns to extract additional data
- Test with various Amazon product pages

## Security Considerations

- This tool uses HTTP requests with realistic headers to minimize detection
- Handles various Amazon response codes gracefully
- No user data is stored or transmitted to third parties
- Uses appropriate request timeouts to avoid hanging requests

## Legal Notice

This tool is for educational and personal use only. Please:

- Respect Amazon's Terms of Service
- Use responsibly and don't overload their servers
- Consider rate limiting for production use
- Be aware that web scraping may violate terms of service

## License

This project is licensed under the ISC License - see the package.json file for details.

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Ensure all dependencies are correctly installed
3. Verify your Node.js version is 18 or higher
4. Check the console/logs for detailed error messages

## Contributing

Feel free to submit issues and enhancement requests!
