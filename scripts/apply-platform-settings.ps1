# Apply platform_settings so Admin launch controls can save.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/apply-platform-settings.ps1

$ErrorActionPreference = "Stop"

$sqlPath = Join-Path $PSScriptRoot "fix-platform-settings-cache.sql"
$sql = Get-Content $sqlPath -Raw
$sqlUrl = "https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new"

Write-Host ""
Write-Host "Simple Streamz — platform_settings fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Launch controls need the platform_settings table visible to the Supabase REST API."
Write-Host "Until you run the SQL below, Admin save/load will show a schema-cache error."
Write-Host ""
Write-Host "Steps:" -ForegroundColor Yellow
Write-Host "  1. Open $sqlUrl"
Write-Host "  2. Paste ALL of the SQL below"
Write-Host "  3. Click Run"
Write-Host "  4. Confirm the last query returns 2 rows: launch_offer and simulcast"
Write-Host "  5. Wait ~30 seconds, then hard-refresh Admin Overview"
Write-Host ""
Write-Host "If it still fails: Supabase Dashboard -> Project Settings -> API -> Reload schema"
Write-Host ""
Write-Host "--- SQL to run ---" -ForegroundColor Green
Write-Host $sql
Write-Host "--- end SQL ---" -ForegroundColor Green
Write-Host ""

try {
  Start-Process $sqlUrl
  Write-Host "Opened Supabase SQL Editor in your browser." -ForegroundColor Cyan
} catch {
  Write-Host "Could not open browser. Use the link above manually." -ForegroundColor DarkYellow
}