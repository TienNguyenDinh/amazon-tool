# Quick Start Guide

## 1. Install Playwright Browsers
```bash
npx playwright install
```

## 2. Start the Server
```bash
npm start
```

## 3. Open Your Browser
Navigate to: http://localhost:3000

## 4. Test the Application
Use this sample Amazon URL to test:
```
https://www.amazon.com/Echo-Dot-3rd-Gen-Charcoal/dp/B07FZ8S74R
```

## Troubleshooting
- If Playwright installation fails, try: `npx playwright install chromium`
- If port 3000 is busy, use: `PORT=3001 npm start`
- If you get CAPTCHA errors, wait a few minutes and try again

## Ready to Use!
The application is now ready for scraping Amazon product data and generating Excel files.
