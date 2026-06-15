# Wire Stripe secrets into the simple-stream-core Cloudflare Worker.
# Run from repo root:  powershell -File scripts/setup-stripe-secrets.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Simple Streamz — Stripe Worker setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before running this script, complete these steps in Stripe (TEST mode):"
Write-Host "  1. Developers -> API keys -> copy Secret key (sk_test_...)"
Write-Host "  2. Developers -> Webhooks -> Add endpoint"
Write-Host "     URL: https://simple-stream-core.brianbuildzwebs.workers.dev/api/stripe/webhook"
Write-Host "     Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted"
Write-Host "  3. Open the new webhook -> Signing secret (whsec_...)"
Write-Host ""
Write-Host "Also run the Supabase migration:"
Write-Host "  supabase/migrations/20260615000002_stripe_subscriptions.sql"
Write-Host ""

$secretKey = Read-Host "Paste STRIPE_SECRET_KEY (sk_test_...)"
if (-not $secretKey.StartsWith("sk_")) {
  throw "STRIPE_SECRET_KEY should start with sk_test_ or sk_live_"
}

$webhookSecret = Read-Host "Paste STRIPE_WEBHOOK_SECRET (whsec_...)"
if (-not $webhookSecret.StartsWith("whsec_")) {
  throw "STRIPE_WEBHOOK_SECRET should start with whsec_"
}

Write-Host ""
Write-Host "Setting Worker secrets..." -ForegroundColor Yellow

$secretKey | npx wrangler secret put STRIPE_SECRET_KEY
if ($LASTEXITCODE -ne 0) { throw "wrangler secret put STRIPE_SECRET_KEY failed" }

$webhookSecret | npx wrangler secret put STRIPE_WEBHOOK_SECRET
if ($LASTEXITCODE -ne 0) { throw "wrangler secret put STRIPE_WEBHOOK_SECRET failed" }

Write-Host ""
Write-Host "Verifying /api/auth/status..." -ForegroundColor Yellow
$status = Invoke-RestMethod -Uri "https://simple-stream-core.brianbuildzwebs.workers.dev/api/auth/status"
$status | ConvertTo-Json

if ($status.stripe_checkout -and $status.stripe_webhook) {
  Write-Host ""
  Write-Host "Stripe is wired up. Test checkout at /pricing with card 4242 4242 4242 4242" -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Secrets were set but status flags are still false. Wait a few seconds and re-check." -ForegroundColor Red
}