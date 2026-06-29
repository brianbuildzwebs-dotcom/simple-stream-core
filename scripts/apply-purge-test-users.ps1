# Print purge-test-users SQL and open Supabase SQL Editor.
# Run: powershell -ExecutionPolicy Bypass -File scripts/apply-purge-test-users.ps1

$ErrorActionPreference = 'Stop'

$sqlPath = Join-Path $PSScriptRoot 'apply-purge-test-users.sql'
$sql = Get-Content $sqlPath -Raw

Write-Host ''
Write-Host 'Simple Streamz — purge test users (keep admins)' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'The admin UI cannot bulk-delete users. In-app delete also blocks admin accounts.' -ForegroundColor Yellow
Write-Host ''
Write-Host '1. Open Supabase SQL Editor:' -ForegroundColor White
Write-Host '   https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new'
Write-Host ''
Write-Host '2. Paste scripts/apply-purge-test-users.sql'
Write-Host ''
Write-Host '3. Run the two PREVIEW sections first — confirm delete list is only test accounts'
Write-Host ''
Write-Host '4. Run the PURGE section (BEGIN ... COMMIT) + VERIFY'
Write-Host ''
Write-Host 'Keeps: every user where profiles.role = admin' -ForegroundColor Green
Write-Host 'Deletes: all other auth users + cascaded app data' -ForegroundColor Red
Write-Host ''
Write-Host 'Note: Cloudflare stream inputs from deleted users may remain in Cloudflare' -ForegroundColor Yellow
Write-Host '      (harmless orphans; clean up in Stream dashboard if you want).'
Write-Host ''
Write-Host '--- SQL file: scripts/apply-purge-test-users.sql ---' -ForegroundColor Green

$open = (Read-Host 'Open SQL Editor in browser now? (Y/n)').Trim().ToLower()
if ($open -ne 'n') {
  Start-Process 'https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new'
}