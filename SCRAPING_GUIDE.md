# Web Scraping Guide

## How to Start Scraping Product Images

### Prerequisites
- Make sure your NestJS server is running: `npm run start:dev`
- Ensure you have products in your database

### API Endpoints

#### 1. **Search for a Product** (Test endpoint)
Test if a product exists on the website before scraping:

```bash
GET /api/scraper/search?title=LED strip set LG 32 inch
```

**Example using curl:**
```bash
curl "http://localhost:3001/api/scraper/search?title=LED%20strip%20set%20LG%2032%20inch"
```

**Example using Postman/Thunder Client:**
- Method: GET
- URL: `http://localhost:3001/api/scraper/search?title=LED strip set LG 32 inch`

**Response:**
```json
{
  "title": "Set barete LED LG 32\" - 3 barete - (2A x 6 leduri) + (1B x 7 leduri)",
  "imageUrl": "https://bareteledtv.ro/path/to/image.jpg",
  "url": "https://bareteledtv.ro/product-url"
}
```

---

#### 2. **Scrape a Single Product**
Scrape and download image for a specific product:

```bash
POST /api/scraper/product/:productId
```

**Request Body:**
```json
{
  "title": "LED strip set LG 32 inch - 3 LED strips - (2A x 6 LEDs) + (1B x 7 LEDs)",
  "reference": "1LG3200"
}
```

**Example using curl:**
```bash
curl -X POST "http://localhost:3001/api/scraper/product/YOUR_PRODUCT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "LED strip set LG 32 inch - 3 LED strips",
    "reference": "1LG3200"
  }'
```

**Example using Postman/Thunder Client:**
- Method: POST
- URL: `http://localhost:3001/api/scraper/product/YOUR_PRODUCT_ID`
- Headers: `Content-Type: application/json`
- Body (JSON):
```json
{
  "title": "LED strip set LG 32 inch - 3 LED strips",
  "reference": "1LG3200"
}
```

**Response:**
```json
{
  "success": true,
  "imageUrl": "http://your-storage/products/led-strip-set-lg-32-inch/images/1LG3200-1234567890.jpg",
  "message": "Successfully scraped and stored image for: LED strip set LG 32 inch"
}
```

---

#### 3. **Batch Scrape Products** (Recommended)
Automatically scrape images for products that don't have images:

```bash
POST /api/scraper/batch
```

**Request Body (optional):**
```json
{
  "limit": 10
}
```

**Example using curl:**
```bash
curl -X POST "http://localhost:3001/api/scraper/batch" \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

**Example using Postman/Thunder Client:**
- Method: POST
- URL: `http://localhost:3001/api/scraper/batch`
- Headers: `Content-Type: application/json`
- Body (JSON):
```json
{
  "limit": 10
}
```

**Response:**
```json
{
  "total": 10,
  "success": 8,
  "failed": 2,
  "results": [
    {
      "productId": "uuid-1",
      "title": "LED strip set LG 32 inch",
      "success": true,
      "imageUrl": "http://your-storage/products/led-strip-set-lg-32-inch/images/image.jpg",
      "message": "Successfully scraped and stored image"
    },
    {
      "productId": "uuid-2",
      "title": "Samsung 42 inch LED strip",
      "success": false,
      "message": "Product not found on website"
    }
  ]
}
```

---

## Step-by-Step Guide

### Option 1: Batch Scrape (Easiest)
1. Start your server: `npm run start:dev`
2. Call the batch endpoint:
   ```bash
   curl -X POST "http://localhost:3001/api/scraper/batch" \
     -H "Content-Type: application/json" \
     -d '{"limit": 10}'
   ```
3. The scraper will automatically:
   - Find products without images
   - Search for matching products on the website
   - Download and store images
   - Update product records

### Option 2: Scrape Individual Products
1. Get a product ID from your database
2. Use the single product endpoint with the product's title and reference
3. The image will be downloaded and stored

---

## Image Storage Structure

Images are organized by product title:

```
products/
  ├── led-strip-set-lg-32-inch/
  │   └── images/
  │       └── 1LG3200-1234567890.jpg
  ├── samsung-42-inch-led-strip/
  │   └── images/
  │       └── SAM4200-1234567891.jpg
  └── philips-49-inch-led-strip/
      └── images/
          └── PH4900-1234567892.jpg
```

---

## Tips

1. **Start Small**: Test with `limit: 1` or `limit: 5` first
2. **Check Logs**: Watch your server console for scraping progress
3. **Rate Limiting**: The scraper adds 1 second delay between requests to be respectful
4. **Matching**: Products need at least 50% similarity to match (based on brand, size, model)
5. **Retry Failed**: If a product fails, you can retry it individually

---

## Troubleshooting

**No matches found?**
- Check if the product title matches the website format
- Try searching manually first with the `/search` endpoint
- The website might not have that exact product

**Images not downloading?**
- Check your storage configuration (S3 or local)
- Verify network connectivity
- Check server logs for errors

**Slow scraping?**
- This is normal - there's a 1 second delay between requests
- For faster scraping, you can reduce the delay in the code (not recommended)

