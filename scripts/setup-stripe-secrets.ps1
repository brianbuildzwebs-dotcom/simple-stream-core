# Wire Stripe secrets into the simple-stream-core Cloudflare Worker.
# Run from repo root:  powershell -File scripts/setup-stripe-secrets.ps1

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Simple Streamz - Stripe Worker setup' -ForegroundColor Cyan
Write-Host '====================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Before running this script, complete these steps in Stripe test mode:'
Write-Host '  1. Developers -> API keys -> copy Secret key sk_test_...'
Write-Host '  2. Developers -> Webhooks -> Add endpoint'
Write-Host '     URL: https://simplestreamz.io/api/stripe/webhook'
Write-Host '     Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted'
Write-Host '  3. Open the webhook -> Signing secret whsec_...'
Write-Host ''
Write-Host 'Also run the Supabase migration:'
Write-Host '  supabase/migrations/20260615000002_stripe_subscriptions.sql'
Write-Host ''

Write-Host ''
Write-Host 'IMPORTANT: paste ONLY the key value - not the wrangler command.' -ForegroundColor Yellow
Write-Host 'Secret key must look like: sk_test_51AbCdE...' -ForegroundColor Yellow
Write-Host ''
$secretKey = (Read-Host 'Paste STRIPE_SECRET_KEY sk_test_...').Trim().Trim('"').Trim("'")
if ($secretKey.StartsWith('pk_')) {
  throw 'That is a publishable key pk_. Use the Secret key sk_test_ or sk_live_.'
}
if (-not $secretKey.StartsWith('sk_test_') -and -not $secretKey.StartsWith('sk_live_')) {
  throw 'STRIPE_SECRET_KEY should start with sk_test_ or sk_live_'
}

$webhookSecret = (Read-Host 'Paste STRIPE_WEBHOOK_SECRET whsec_...').Trim().Trim('"').Trim("'")
if (-not $webhookSecret.StartsWith('whsec_')) {
  throw 'STRIPE_WEBHOOK_SECRET should start with whsec_'
}

function Set-WorkerSecret($name, $value) {
  $tempFile = Join-Path $env:TEMP "$name.txt"
  [System.IO.File]::WriteAllText($tempFile, $value, [System.Text.UTF8Encoding]::new($false))
  $process = Start-Process -FilePath 'cmd.exe' -ArgumentList @(
    '/c',
    "npx wrangler secret put $name < `"$tempFile`""
  ) -Wait -PassThru -NoNewWindow
  Remove-Item -Force -ErrorAction SilentlyContinue $tempFile
  if ($process.ExitCode -ne 0) { throw "wrangler secret put $name failed" }
}

Write-Host ''
Write-Host 'Setting Worker secrets...' -ForegroundColor Yellow

Set-WorkerSecret 'STRIPE_SECRET_KEY' $secretKey
Set-WorkerSecret 'STRIPE_WEBHOOK_SECRET' $webhookSecret

Write-Host ''
Write-Host 'Verifying /api/auth/status...' -ForegroundColor Yellow
$status = Invoke-RestMethod -Uri 'https://simplestreamz.io/api/auth/status'
$status | ConvertTo-Json

if ($status.ok -and $status.billing) {
  Write-Host ''
  Write-Host 'Stripe is wired up on the Worker (live sk_ + whsec_ detected).' -ForegroundColor Green
  Write-Host 'Next: Stripe -> Webhooks -> Send test event (expect HTTP 200).' -ForegroundColor Cyan
  Write-Host 'Then test checkout at https://simplestreamz.io/pricing with a real card.' -ForegroundColor Cyan
} else {
  Write-Host ''
  Write-Host 'Secrets were uploaded but billing is not healthy yet. Wait a few seconds and re-check:' -ForegroundColor Yellow
  Write-Host '  https://simplestreamz.io/api/auth/status' -ForegroundColor Yellow
  Write-Host 'Expect: "ok": true and "billing": true' -ForegroundColor Yellow
}