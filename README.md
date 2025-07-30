# Amazon Product Scraper

A full-stack web application that allows users to input an Amazon product URL, scrapes key data from the product page, and provides the data as a downloadable Excel file.

## Features

- 🔍 **Web Scraping**: Uses Playwright for reliable browser automation
- 📊 **Excel Export**: Generates formatted Excel files with product data
- 🛡️ **Anti-Blocking**: Implements human-like delays and realistic headers
- 🎨 **Modern UI**: Clean, responsive web interface
- ⚡ **Real-time Feedback**: Progress indicators and status updates
- 🔧 **Error Handling**: Comprehensive error handling with user-friendly messages

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
- **Playwright** - Browser automation
- **ExcelJS** - Excel file generation
- **CORS** - Cross-origin resource sharing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with modern design
- **Vanilla JavaScript** - Functionality

## Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)
- **Internet connection** (for downloading browser dependencies)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd amazon-tool
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

   This will download the necessary browser binaries (Chromium, Firefox, WebKit). For this project, we only use Chromium.

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

4. **Wait for the process to complete** (10-30 seconds depending on page complexity)

5. **Download will start automatically** once scraping is complete

### API Usage

You can also use the API directly:

```bash
curl -X POST http://localhost:3000/scrape \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/your-product-url"}' \
  --output product_data.xlsx
```

## Project Structure

```
amazon-tool/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── README.md             # This file
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

### Server Configuration

Edit the constants in `server.js` to modify:

- **Timeout settings**: Adjust `SCRAPING_CONFIG.timeout`
- **Wait times**: Modify `SCRAPING_CONFIG.waitTime`
- **User agent**: Update `SCRAPING_CONFIG.userAgent`

## Troubleshooting

### Common Issues

1. **"CAPTCHA detected" error**
   - Amazon has detected automated access
   - Wait a few minutes before trying again
   - Consider using a different network or VPN

2. **"Invalid Amazon URL" error**
   - Ensure the URL contains "amazon." in the domain
   - Use direct product page URLs (not search results)

3. **Timeout errors**
   - Check your internet connection
   - Try with a different Amazon product URL
   - Some pages may load slowly

4. **Missing data fields**
   - Some products may not have all data fields
   - Missing fields will show "N/A" in the Excel file

### Browser Installation Issues

If Playwright browser installation fails:

```bash
# For Linux users who might need additional dependencies
npx playwright install-deps

# For specific browser only
npx playwright install chromium
```

### Port Already in Use

If port 3000 is busy:

```bash
PORT=3001 npm start
```

## Development

### Adding New Data Fields

1. Add new selectors to the `productData` object in `server.js`
2. Update the `EXCEL_CONFIG.headers` array
3. Add the new field to the Excel row generation

### Modifying Scraping Logic

- Edit the `scrapeAmazonProduct` function in `server.js`
- Add new selectors to the `safeTextExtract` calls
- Test with various Amazon product pages

## Security Considerations

- This tool respects Amazon's servers with delays between requests
- Uses realistic browser headers to minimize detection
- Handles CAPTCHA detection gracefully
- No user data is stored or transmitted to third parties

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
3. Verify your Node.js version is 16 or higher
4. Check the console for detailed error messages

## Contributing

Feel free to submit issues and enhancement requests!
