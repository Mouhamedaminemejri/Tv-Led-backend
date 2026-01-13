# 📱 LED Strip Scanner - Setup Guide

## ✅ What's Been Implemented

1. **Backend API Endpoint**: `POST /api/products/quick-add`
2. **Mobile HTML Scanner**: `public/led-scanner.html`
3. **OCR Integration**: Tesseract.js (client-side)
4. **Static File Serving**: Configured in `main.ts`

## 🚀 Quick Start Steps

### Step 1: Start Your Server

```bash
npm run start:dev
```

You should see:
```
🚀 Server running on http://localhost:3001
📱 LED Scanner: http://localhost:3001/led-scanner.html
```

### Step 2: Find Your Computer's IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" (e.g., `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```

### Step 3: Access on Your Phone

1. Make sure your phone is on the **same Wi-Fi network** as your computer
2. Open your phone's browser
3. Go to: `http://YOUR_IP:3001/led-scanner.html`
   - Example: `http://192.168.1.100:3001/led-scanner.html`

### Step 4: Add to Home Screen (Optional)

**iPhone:**
1. Open the scanner page
2. Tap the Share button (square with arrow)
3. Tap "Add to Home Screen"
4. Name it "LED Scanner"

**Android:**
1. Open the scanner page
2. Tap the menu (3 dots)
3. Tap "Add to Home Screen" or "Install App"

## 📸 How to Use

1. **Tap "Take Photo"** button
2. **Take a photo** of the reference code on the LED strip
3. **Wait for OCR** to extract the reference code (or type manually)
4. **Fill in** brand, title, and stock (optional)
5. **Tap "Add to Database"**

## 🔧 Troubleshooting

### Can't Access from Phone?

1. **Check Firewall**: Windows Firewall might be blocking port 3001
   - Go to Windows Defender Firewall → Allow an app
   - Add Node.js or port 3001

2. **Check IP Address**: Make sure you're using the correct IP
   - Both devices must be on same Wi-Fi

3. **Check Server**: Make sure server is running
   - Look for the console messages

### OCR Not Working?

- **Internet Required**: Tesseract.js loads from CDN
- **Good Lighting**: Make sure photo is clear and well-lit
- **Manual Entry**: You can always type the reference manually

### API Errors?

- Check browser console (F12) for error messages
- Make sure backend is running on port 3001
- Check that reference code is unique (duplicates are rejected)

## 🎯 Features

- ✅ **Camera Access**: Direct camera capture on mobile
- ✅ **OCR Extraction**: Auto-extracts reference codes
- ✅ **Manual Override**: Can type reference manually if OCR fails
- ✅ **Duplicate Detection**: Prevents adding same reference twice
- ✅ **Offline OCR**: Works without backend (for OCR part)
- ✅ **Mobile Optimized**: Large buttons, easy to use

## 📝 API Endpoint

**POST** `/api/products/quick-add`

**Request Body:**
```json
{
  "reference": "3HI43DB",
  "brand": "Samsung",
  "title": "LED strip - 3HI43DB",
  "stock": 5
}
```

**Response:**
```json
{
  "id": "uuid",
  "reference": "3HI43DB",
  "brand": "Samsung",
  "title": "LED strip - 3HI43DB",
  "stock": 5,
  ...
}
```

## 🎉 You're Ready!

Just start your server and access the scanner from your phone. Happy scanning! 📸

