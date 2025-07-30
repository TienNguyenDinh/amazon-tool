# Vercel Deployment Guide

This project is configured for deployment on Vercel with the following setup:

## Project Structure for Vercel

```
amazon-tool/
├── api/
│   ├── scrape.js       # Serverless function for scraping
│   └── health.js       # Health check endpoint
├── public/
│   ├── index.html      # Frontend application
│   ├── script.js       # Frontend JavaScript
│   └── style.css       # Styles
├── vercel.json         # Vercel configuration
├── package.json        # Dependencies and scripts
└── .vercelignore       # Files to exclude from deployment
```

## Deployment Steps

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## Configuration Details

### Vercel Configuration (`vercel.json`)
- **API Routes**: Located in `/api/` directory
- **Static Files**: Served from `/public/` directory
- **Playwright**: Configured for serverless environment
- **Memory**: Set to 1024MB for browser operations
- **Timeout**: 30 seconds for scraping operations

### Environment Variables
The following environment variables are automatically set:
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` (browsers installed during build)
- `VERCEL=1` (indicates Vercel environment)

### Build Process
- Playwright browsers are installed during the build process
- No additional build steps required for static files

## API Endpoints

After deployment, the following endpoints will be available:

- **Frontend**: `https://your-domain.vercel.app/`
- **Scrape API**: `https://your-domain.vercel.app/api/scrape`
- **Health Check**: `https://your-domain.vercel.app/api/health`

## Performance Considerations

- **Cold Starts**: First request may take longer due to Playwright initialization
- **Memory Usage**: Increased memory allocation for browser operations
- **Timeouts**: 30-second limit for scraping operations
- **File Size**: Large dependencies optimized for serverless deployment

## Troubleshooting

### Common Issues:
1. **Timeout Errors**: Reduce scraping timeout or optimize selectors
2. **Memory Errors**: Increase memory allocation in vercel.json
3. **Browser Launch Errors**: Ensure proper Playwright configuration

### Logs:
View deployment logs in Vercel dashboard or use:
```bash
vercel logs
```
