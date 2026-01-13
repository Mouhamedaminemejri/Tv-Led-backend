# Image Storage Solution

This project implements a flexible image storage system that works both locally (for development) and on cloud storage (for production).

## Architecture

The storage system uses a **Strategy Pattern** that allows switching between storage providers without changing your code:

- **Local Storage** (Development): Files stored in `uploads/` folder on your machine
- **AWS S3** (Production): Files stored in AWS S3 bucket with CloudFront CDN support

## Configuration

### Local Storage (Default)

Set in `.env`:
```env
STORAGE_TYPE=local
UPLOAD_PATH=uploads
BASE_URL=http://localhost:3001
```

### AWS S3 (Production)

Set in `.env`:
```env
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_CLOUDFRONT_URL=https://your-cloudfront-url.cloudfront.net  # Optional
```

## API Endpoints

### Upload Single Image

```bash
POST /api/upload/single
Content-Type: multipart/form-data

Form Data:
- file: (image file)
- folder: (optional) - default: "products"
```

**Response:**
```json
{
  "success": true,
  "filePath": "products/2024/01/1234567890-123456789.jpg",
  "url": "http://localhost:3001/uploads/products/2024/01/1234567890-123456789.jpg",
  "size": 245678
}
```

### Upload Multiple Images

```bash
POST /api/upload/multiple
Content-Type: multipart/form-data

Form Data:
- files: (array of image files, max 10)
- folder: (optional) - default: "products"
```

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filePath": "products/2024/01/1234567890-123456789.jpg",
      "url": "http://localhost:3001/uploads/products/2024/01/1234567890-123456789.jpg",
      "size": 245678
    }
  ]
}
```

## Features

### ✅ Image Optimization
- Automatic image compression and resizing
- Max width: 1920px (maintains aspect ratio)
- Quality: 85% (high quality, optimized size)
- Format: JPEG (can be changed to WebP/PNG)

### ✅ File Organization
- Files organized by folder/year/month
- Example: `uploads/products/2024/01/filename.jpg`
- Prevents folder clutter
- Easy to backup/archive by date

### ✅ Security
- File type validation (jpg, jpeg, png, webp only)
- Max file size: 5MB per file
- Unique filenames prevent conflicts

### ✅ Scalability
- Easy switch from local to S3
- No code changes needed
- CDN support for fast delivery

## Usage in Your Code

### Upload Images for Products

```typescript
// In your products service or controller
const formData = new FormData();
formData.append('file', imageFile);
formData.append('folder', 'products');

const response = await fetch('http://localhost:3001/api/upload/single', {
  method: 'POST',
  body: formData,
});

const { url, filePath } = await response.json();

// Save filePath to database (relative path)
// Use url for displaying images
```

### Store Image Paths in Database

Store the `filePath` (relative path) in your PostgreSQL database:
```typescript
// Example: Update product with images
await prisma.product.update({
  where: { id: productId },
  data: {
    images: {
      push: filePath  // Add to existing images array
    }
  }
});
```

### Display Images

Use the `url` from upload response or construct URL:
```typescript
// Local storage
const imageUrl = `http://localhost:3001/uploads/${filePath}`;

// S3 storage (automatically handled)
const imageUrl = storageService.getFileUrl(filePath);
```

## Migration to Production

When deploying to production:

1. **Set up AWS S3 bucket**
   - Create S3 bucket
   - Configure CORS
   - Set bucket policy for public read access

2. **Set up CloudFront (Optional but Recommended)**
   - Create CloudFront distribution
   - Point to S3 bucket
   - Use CloudFront URL for faster delivery

3. **Update Environment Variables**
   ```env
   STORAGE_TYPE=s3
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=your-bucket-name
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_CLOUDFRONT_URL=https://your-cloudfront-url.cloudfront.net
   ```

4. **Migrate Existing Images (Optional)**
   - Write a migration script to upload local images to S3
   - Update database URLs if needed

## File Structure

```
uploads/
├── products/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 1234567890-123456789.jpg
│   │   │   └── ...
│   │   └── 02/
│   └── 2025/
└── avatars/
    └── ...
```

## Best Practices

1. **Always validate images** before upload (already done in controller)
2. **Use appropriate folder names** (products, avatars, thumbnails, etc.)
3. **Store relative paths** in database, not full URLs
4. **Use CDN** in production for better performance
5. **Regular backups** of your uploads folder (local) or S3 bucket (production)
6. **Monitor storage usage** and implement cleanup for old/unused images

## Troubleshooting

### Images not displaying
- Check `BASE_URL` in `.env` matches your server URL
- Verify uploads folder exists and has correct permissions
- Check CORS settings if accessing from frontend

### Upload fails
- Check file size (max 5MB)
- Verify file type (jpg, jpeg, png, webp only)
- Check disk space (local storage)
- Verify AWS credentials (S3 storage)


