# 🔧 Troubleshoot Phone Connection Timeout

## Problem
Phone shows "connection timeout" - can't reach server at all.

## Quick Fixes (Try in Order)

### Fix 1: Verify Firewall Rule is Correct

1. Open Windows Firewall: `wf.msc`
2. Find "Node.js Backend Port 3001"
3. Right-click → Properties
4. Check:
   - **General Tab**: Enabled = ✅ Checked
   - **Protocols and Ports Tab**: 
     - Protocol: TCP
     - Local Port: 3001
   - **Scope Tab**: 
     - Remote IP: Any
     - Local IP: Any
   - **Advanced Tab**:
     - Profiles: ✅ Private ✅ Domain (Public optional)

### Fix 2: Create Firewall Rule via PowerShell (Run as Admin)

```powershell
# Remove old rule if exists
Remove-NetFirewallRule -DisplayName "Node.js Backend Port 3001" -ErrorAction SilentlyContinue

# Create new rule with all profiles
New-NetFirewallRule -DisplayName "Node.js Backend Port 3001" -Direction Inbound -LocalPort 3001 -Protocol TCP -Action Allow -Profile Domain,Private,Public
```

### Fix 3: Temporarily Disable Firewall (Test Only)

**⚠️ Only for testing - re-enable after!**

1. Open Windows Defender Firewall
2. Click "Turn Windows Defender Firewall on or off"
3. Turn OFF for Private network (temporarily)
4. Test from phone
5. **IMPORTANT**: Turn it back ON after testing!

### Fix 4: Check Windows Defender

Windows Defender might have additional blocking:

1. Open Windows Security
2. Go to Firewall & network protection
3. Click "Allow an app through firewall"
4. Find Node.js or add it manually
5. Check ✅ Private network

### Fix 5: Check Router Settings

Some routers block device-to-device communication:

1. Check if your router has "AP Isolation" or "Client Isolation" enabled
2. Disable it if enabled
3. This prevents devices on same WiFi from talking to each other

### Fix 6: Use Different Port

Try a port that's commonly open (like 8080):

1. Change server port to 8080
2. Update firewall rule for port 8080
3. Test: `http://192.168.100.20:8080/test.html`

### Fix 7: Check Server is Actually Running

From PC, test:
```bash
curl http://192.168.100.20:3001/test.html
```

If this doesn't work from PC itself, server isn't binding correctly.

## Diagnostic Commands

### Check if port is listening:
```powershell
netstat -an | findstr "3001"
```
Should show: `TCP    0.0.0.0:3001` LISTENING

### Test from PC:
```powershell
Test-NetConnection -ComputerName 192.168.100.20 -Port 3001
```

### Check firewall rules:
```powershell
netsh advfirewall firewall show rule name=all | findstr "3001"
```

## Alternative: Use ngrok (Bypass Firewall)

If firewall is too complicated, use ngrok:

1. Install ngrok: https://ngrok.com/download
2. Run: `ngrok http 3001`
3. Use the ngrok URL on your phone (e.g., `https://abc123.ngrok.io/led-scanner.html`)

This bypasses all firewall issues!

