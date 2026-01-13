# Fix Firewall for Node.js Backend
# Run this script as Administrator

Write-Host "`n🔧 Fixing Firewall for Port 3001...`n" -ForegroundColor Yellow

# Remove old rule if exists
Write-Host "Removing old firewall rule..." -ForegroundColor Cyan
Remove-NetFirewallRule -DisplayName "Node.js Backend Port 3001" -ErrorAction SilentlyContinue

# Create new rule with ALL profiles (Domain, Private, Public)
Write-Host "Creating new firewall rule..." -ForegroundColor Cyan
New-NetFirewallRule `
    -DisplayName "Node.js Backend Port 3001" `
    -Direction Inbound `
    -LocalPort 3001 `
    -Protocol TCP `
    -Action Allow `
    -Profile Domain,Private,Public `
    -Description "Allow Node.js backend server on port 3001"

Write-Host "`n✅ Firewall rule created successfully!`n" -ForegroundColor Green

# Verify the rule
Write-Host "Verifying rule..." -ForegroundColor Cyan
$rule = Get-NetFirewallRule -DisplayName "Node.js Backend Port 3001"
Write-Host "  Enabled: $($rule.Enabled)" -ForegroundColor White
Write-Host "  Direction: $($rule.Direction)" -ForegroundColor White
Write-Host "  Action: $($rule.Action)" -ForegroundColor White

$portRule = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule
Write-Host "  Protocol: $($portRule.Protocol)" -ForegroundColor White
Write-Host "  LocalPort: $($portRule.LocalPort)`n" -ForegroundColor White

Write-Host "⚠️  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Restart your server: npm run start:dev" -ForegroundColor White
Write-Host "  2. Test from phone: http://192.168.100.20:3001/test.html" -ForegroundColor White
Write-Host "  3. If still not working, check router 'AP Isolation' setting`n" -ForegroundColor White

