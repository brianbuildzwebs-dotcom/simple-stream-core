# Apply missing Stripe columns in Supabase.
# Usage: powershell -File scripts/apply-stripe-db-migration.ps1

$ErrorActionPreference = "Stop"

$sqlPath = Join-Path $PSScriptRoot "apply-stripe-db-migration.sql"
$sql = Get-Content $sqlPath -Raw

Write-Host ""
Write-Host "Simple Streamz — Supabase Stripe migration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This adds user_subscriptions.stripe_subscription_id."
Write-Host ""
Write-Host "Option A (recommended): Supabase Dashboard" -ForegroundColor Yellow
Write-Host "  1. Open https://supabase.com/dashboard/project/hxtlrwibkdyirnvejfor/sql/new"
Write-Host "  2. Paste the SQL below and click Run"
Write-Host ""
Write-Host "Option B: Supabase CLI (if project is linked)" -ForegroundColor Yellow
Write-Host "  supabase db push"
Write-Host ""
Write-Host "--- SQL to run ---" -ForegroundColor Green
Write-Host $sql
Write-Host "--- end SQL ---" -ForegroundColor Green
Write-Host ""

if (Get-Command supabase -ErrorAction SilentlyContinue) {
  $run = Read-Host "Try supabase db push now? (y/N)"
  if ($run -eq 'y' -or $run -eq 'Y') {
    Push-Location (Split-Path $PSScriptRoot -Parent)
    supabase db push
    Pop-Location
  }
}