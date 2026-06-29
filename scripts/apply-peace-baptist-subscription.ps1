# Open Supabase SQL Editor to activate Peace Baptist paid plan.
# Run: powershell -ExecutionPolicy Bypass -File scripts/apply-peace-baptist-subscription.ps1

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Peace Baptist — activate FaithStart / Basic in Supabase' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Stripe already shows an active subscription for peacebaptist320@gmail.com.' -ForegroundColor Green
Write-Host 'This SQL updates user_subscriptions so the dashboard shows the paid plan.' -ForegroundColor White
Write-Host ''
Write-Host '1. Open Supabase SQL Editor:' -ForegroundColor White
Write-Host '   https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new'
Write-Host ''
Write-Host '2. Paste scripts/apply-peace-baptist-subscription.sql and Run'
Write-Host ''
Write-Host '3. Refresh https://simplestreamz.io/dashboard/profile as peacebaptist320@gmail.com'
Write-Host ''

$open = (Read-Host 'Open SQL Editor in browser now? (Y/n)').Trim().ToLower()
if ($open -ne 'n') {
  Start-Process 'https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new'
}