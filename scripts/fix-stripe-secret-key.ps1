# Fix STRIPE_SECRET_KEY on the Cloudflare Worker.
# Run from repo root:  npm run stripe:fix-key

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Fix Stripe Secret Key" -ForegroundColor Cyan
Write-Host "=====================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Stripe (TEST mode): Developers -> API keys -> Secret key -> Reveal" -ForegroundColor White
Write-Host ""
Write-Host "  WRONG:  Publishable key  (pk_test_...)" -ForegroundColor Red
Write-Host "  RIGHT:  Secret key       (sk_test_...)" -ForegroundColor Green
Write-Host ""

$key = (Read-Host "Paste Secret key here").Trim().Trim('"').Trim("'")

if ($key.StartsWith("pk_")) {
  Write-Host "That is a publishable key (pk_). Use the secret key (sk_test_)." -ForegroundColor Red
  exit 1
}

if ($key -match '^(cd |npx |wrangler|C:\\|STRIPE_SECRET_KEY)' -or $key.Contains('\')) {
  Write-Host "That looks like a terminal command or path, not a Stripe key." -ForegroundColor Red
  exit 1
}

if (-not $key.StartsWith("sk_test_") -and -not $key.StartsWith("sk_live_")) {
  Write-Host "Secret key must start with sk_test_ or sk_live_" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "Looks good. Starts with: $($key.Substring(0, 12))..." -ForegroundColor Green
Write-Host "Uploading to Worker..." -ForegroundColor Yellow
Write-Host ""

$tempFile = Join-Path $env:TEMP "stripe-secret-key.txt"
[System.IO.File]::WriteAllText($tempFile, $key, [System.Text.UTF8Encoding]::new($false))

$process = Start-Process -FilePath "cmd.exe" -ArgumentList @(
  "/c",
  "npx wrangler secret put STRIPE_SECRET_KEY < `"$tempFile`""
) -Wait -PassThru -NoNewWindow

Remove-Item -Force -ErrorAction SilentlyContinue $tempFile

if ($process.ExitCode -ne 0) {
  Write-Host "wrangler secret put failed (exit $($process.ExitCode))." -ForegroundColor Red
  Write-Host "Try manually: npx wrangler secret put STRIPE_SECRET_KEY" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "Checking Worker..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$status = Invoke-RestMethod -Uri "https://simple-stream-core.brianbuildzwebs.workers.dev/api/auth/status"
$status | ConvertTo-Json

if ($status.stripe_key_format_valid) {
  Write-Host ""
  Write-Host "Success. Try Subscribe on /pricing." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Upload ran but Worker still has wrong value: $($status.stripe_key_prefix)" -ForegroundColor Red
  Write-Host "Run manually from this folder:" -ForegroundColor Yellow
  Write-Host "  npx wrangler secret put STRIPE_SECRET_KEY" -ForegroundColor Yellow
  Write-Host "Then paste your sk_test_... key when prompted." -ForegroundColor Yellow
  exit 1
}

Write-Host ""