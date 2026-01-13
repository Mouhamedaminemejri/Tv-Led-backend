# 🔧 Fix Phone Access Issue

## Problem
Server works on PC but phone can't connect (same WiFi).

## Solution: Windows Firewall

### Quick Fix (Recommended)

1. **Open Windows Defender Firewall**
   - Press `Win + R`
   - Type: `wf.msc`
   - Press Enter

2. **Create Inbound Rule**
   - Click "Inbound Rules" on the left
   - Click "New Rule..." on the right
   - Select "Port" → Next
   - Select "TCP"
   - Enter port: `3001` → Next
   - Select "Allow the connection" → Next
   - Check all (Domain, Private, Public) → Next
   - Name: "Node.js Backend Port 3001"
   - Click Finish

### Alternative: PowerShell Command (Run as Admin)

```powershell
New-NetFirewallRule -DisplayName "Node.js Backend Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow
```

### Test Connection

After fixing firewall, test from phone:
```
http://192.168.100.20:3001/led-scanner.html
```

## Other Checks

1. **Server Binding**: Make sure server listens on `0.0.0.0` (already fixed in main.ts)
2. **Same WiFi**: Both devices must be on same network
3. **IP Address**: Use the IPv4 address from `ipconfig` (192.168.100.20)
4. **Server Running**: Make sure `npm run start:dev` is running

## Quick Test

From phone browser, try:
- `http://192.168.100.20:3001/api/products` (should return JSON)
- If this works but HTML doesn't, it's a static file serving issue

