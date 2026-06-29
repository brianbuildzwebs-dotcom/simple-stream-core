# Upload STRIPE_WEBHOOK_SECRET without a trailing newline (common wrangler paste bug).
# Run: powershell -ExecutionPolicy Bypass -File scripts/set-stripe-webhook-secret.ps1

$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host 'Paste signing secret from Stripe -> Webhooks -> Simple Streamz subscriptions -> Reveal' -ForegroundColor Cyan
Write-Host 'Must start with whsec_' -ForegroundColor Yellow
Write-Host ''

$secret = (Read-Host 'whsec_...').Trim().Trim('"').Trim("'")
if (-not $secret.StartsWith('whsec_')) {
  throw 'Secret must start with whsec_'
}

$tempFile = Join-Path $env:TEMP 'STRIPE_WEBHOOK_SECRET.txt'
[System.IO.File]::WriteAllText($tempFile, $secret, [System.Text.UTF8Encoding]::new($false))

Write-Host 'Uploading to Worker simple-stream-core...' -ForegroundColor Yellow
$process = Start-Process -FilePath 'cmd.exe' -ArgumentList @(
  '/c',
  "npx wrangler secret put STRIPE_WEBHOOK_SECRET < `"$tempFile`""
) -Wait -PassThru -NoNewWindow

Remove-Item -Force -ErrorAction SilentlyContinue $tempFile

if ($process.ExitCode -ne 0) {
  throw 'wrangler secret put failed'
}

Write-Host ''
Write-Host 'Done. In Stripe click Send test event or Resend - expect HTTP 200.' -ForegroundColor Green