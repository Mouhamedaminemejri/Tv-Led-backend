# Quick Start - Image Storage

## Setup (One Time)

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Configure environment** (`.env`):
   ```env
   STORAGE_TYPE=local
   UPLOAD_PATH=uploads
   BASE_URL=http://localhost:3001
   ```

3. **Create uploads folder** (will be created automatically, but you can create it manually):
   ```bash
   mkdir uploads
   ```

## Test the Upload API

### Using cURL

**Single Image:**
```bash
curl -X POST http://localhost:3001/api/upload/single \
  -F "file=@/path/to/your/image.jpg" \
  -F "folder=products"
```

**Multiple Images:**
```bash
curl -X POST http://localhost:3001/api/upload/multiple \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg" \
  -F "folder=products"
```

### Using Postman/Insomnia

1. **Method:** POST
2. **URL:** `http://localhost:3001/api/upload/single`
3. **Body:** form-data
4. **Fields:**
   - `file`: (File) Select your image
   - `folder`: (Text, optional) "products"

### Using JavaScript/Frontend

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('folder', 'products');

const response = await fetch('http://localhost:3001/api/upload/single', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Image URL:', result.url);
console.log('File Path:', result.filePath);
```

## Response Format

```json
{
  "success": true,
  "filePath": "products/2024/01/1234567890-123456789.jpg",
  "url": "http://localhost:3001/uploads/products/2024/01/1234567890-123456789.jpg",
  "size": 245678
}
```

## Next Steps

1. **Store filePath in database** (not the full URL)
2. **Use the URL** for displaying images in your frontend
3. **When deploying**, switch to S3 by updating `.env` (see STORAGE.md)

## File Organization

Uploaded files are automatically organized:
```
uploads/
└── products/
    └── 2024/
        └── 01/
            └── 1234567890-123456789.jpg
```

This makes it easy to:
- Find files by date
- Backup by month
- Clean up old files
- Migrate to cloud storage


