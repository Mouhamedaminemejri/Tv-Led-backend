# 🔧 Fix Phone Connection Timeout

## ✅ What's Working
- Server is listening on `0.0.0.0:3001` ✅
- Firewall rule exists ✅
- Works on PC ✅

## ❌ Problem
Phone gets "connection timeout" - can't reach server.

## 🔍 Most Likely Causes

### 1. Router AP Isolation (Most Common!)

Many routers have "AP Isolation" or "Client Isolation" enabled by default. This **prevents devices on the same WiFi from talking to each other**.

**Fix:**
1. Log into your router admin panel (usually `192.168.1.1` or `192.168.100.1`)
2. Look for "AP Isolation", "Client Isolation", or "Wireless Isolation"
3. **Disable it**
4. Save and restart router
5. Try again from phone

### 2. Windows Defender Additional Blocking

Windows Defender might have extra security blocking connections.

**Fix:**
1. Open **Windows Security** (search in Start menu)
2. Go to **Firewall & network protection**
3. Click **Allow an app through firewall**
4. Click **Change settings** (admin required)
5. Click **Allow another app**
6. Browse to: `C:\Program Files\nodejs\node.exe` (or wherever Node.js is installed)
7. Add it and check ✅ **Private**
8. Click OK

### 3. Firewall Rule Not Applied to Private Network

**Fix: Run PowerShell as Administrator:**

```powershell
# Remove old rule
Remove-NetFirewallRule -DisplayName "Node.js Backend Port 3001" -ErrorAction SilentlyContinue

# Create new rule with ALL profiles
New-NetFirewallRule `
    -DisplayName "Node.js Backend Port 3001" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow `
    -Profile Domain,Private,Public
```

Or run the script I created:
```powershell
# Right-click fix-firewall.ps1 → Run with PowerShell (as Admin)
.\fix-firewall.ps1
```

### 4. Try Different Port

Sometimes port 3001 is blocked. Try 8080:

1. Change server port to 8080
2. Update firewall rule for 8080
3. Test: `http://192.168.100.20:8080/test.html`

## 🧪 Quick Tests

### Test 1: From PC Browser
```
http://192.168.100.20:3001/test.html
```
If this doesn't work, server binding is wrong.

### Test 2: Ping Test
From phone, try pinging your PC:
- Install a network tool app
- Ping: `192.168.100.20`
- If ping fails, it's a network/router issue

### Test 3: Check Router Admin
1. Open router admin: `http://192.168.100.1` (or check your gateway IP)
2. Look for "AP Isolation" or "Wireless Isolation"
3. Disable it

## 🚀 Alternative: Use ngrok (Bypasses Everything)

If firewall/router is too complicated:

1. **Install ngrok**: https://ngrok.com/download
2. **Run**: `ngrok http 3001`
3. **Use the ngrok URL** on your phone (e.g., `https://abc123.ngrok.io/led-scanner.html`)

This works from anywhere, bypasses firewall/router completely!

## 📝 Step-by-Step Fix

1. **Check Router AP Isolation** (most likely fix!)
2. **Run firewall fix script** (as admin)
3. **Restart server**: `npm run start:dev`
4. **Test from phone**: `http://192.168.100.20:3001/test.html`

If still not working, use ngrok - it's the fastest solution!

