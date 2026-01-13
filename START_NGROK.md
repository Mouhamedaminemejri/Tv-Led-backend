# 🚀 Quick Start with ngrok

## Step 1: Start Your Server

In your current terminal:
```bash
npm run start:dev
```

Wait for: `🚀 Server running on http://localhost:3001`

## Step 2: Start ngrok

Open a **NEW terminal/PowerShell window** and run:

```bash
ngrok http 3001
```

You'll see something like:
```
Forwarding   https://abc123-def456.ngrok-free.app -> http://localhost:3001
```

## Step 3: Copy the HTTPS URL

Copy the **HTTPS URL** (starts with `https://`)

Example: `https://abc123-def456.ngrok-free.app`

## Step 4: Use on Your Phone

Open your phone browser and go to:

```
https://YOUR-NGROK-URL/led-scanner.html
```

Example:
```
https://abc123-def456.ngrok-free.app/led-scanner.html
```

## ✅ That's It!

The scanner will work from anywhere - your phone, tablet, or any device with internet!

## 🔄 If ngrok URL Changes

- ngrok free accounts get a new URL each time you restart
- Just copy the new URL and use it on your phone
- Or upgrade to ngrok paid plan for a fixed URL

## 💡 Pro Tip

Keep ngrok running in a separate terminal window while you develop. The URL stays active as long as ngrok is running.

