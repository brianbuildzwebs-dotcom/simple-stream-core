# Create a Cloudflare Turnstile widget and store the secret on the Worker.
# Requires CLOUDFLARE_API_TOKEN with Account.Turnstile:Edit and Workers Scripts:Edit.

param(
  [string]$AccountId = "be90b9dfc7dfcf09a335189f4499ef4f",
  [string]$WorkerName = "simple-stream-core"
)

$ErrorActionPreference = "Stop"

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host "Set CLOUDFLARE_API_TOKEN first (Dashboard -> API Tokens -> Turnstile Edit + Workers Scripts Edit)."
  exit 1
}

$body = @{
  name = "simple-streamz-register"
  domains = @("simplestreamz.io", "localhost", "127.0.0.1")
  mode = "managed"
} | ConvertTo-Json

$response = Invoke-RestMethod `
  -Method POST `
  -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/challenges/widgets" `
  -Headers @{ Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN" } `
  -ContentType "application/json" `
  -Body $body

if (-not $response.success) {
  Write-Host ($response | ConvertTo-Json -Depth 6)
  exit 1
}

$sitekey = $response.result.sitekey
$secret = $response.result.secret

Write-Host "Site key: $sitekey"
Write-Host "Add to Cloudflare Worker build env / .env:"
Write-Host "  VITE_TURNSTILE_SITE_KEY=$sitekey"

$secret | npx wrangler secret put TURNSTILE_SECRET_KEY --name $WorkerName
Write-Host "Stored TURNSTILE_SECRET_KEY on $WorkerName"