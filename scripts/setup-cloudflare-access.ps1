# Create Cloudflare Access apps for Simple Streamz admin routes.
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/setup-cloudflare-access.ps1
#
# Prerequisite: enable Zero Trust once in the dashboard:
#   https://dash.cloudflare.com/?to=/:account/zero-trust

$ErrorActionPreference = "Stop"

$AccountId = "be90b9dfc7dfcf09a335189f4499ef4f"
$WorkerHost = "simple-stream-core.brianbuildzwebs.workers.dev"

Write-Host ""
Write-Host "Simple Streamz - Cloudflare Access setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This protects ONLY admin routes (public app stays open):" -ForegroundColor Yellow
Write-Host "  /admin and /admin/*"
Write-Host "  /api/admin and /api/admin/*"
Write-Host ""
Write-Host "Do NOT use Workers -> Enable Cloudflare Access on workers.dev."
Write-Host "That locks the entire site, including embeds and sign-in."
Write-Host ""
Write-Host "Step 1: Enable Zero Trust if you have not already:"
Write-Host "  https://dash.cloudflare.com/?to=/:account/zero-trust"
Write-Host ""

if (-not $env:CLOUDFLARE_API_TOKEN) {
  Write-Host "Set CLOUDFLARE_API_TOKEN with Access:Edit permission, then re-run." -ForegroundColor Yellow
  Write-Host "Create one at: https://dash.cloudflare.com/profile/api-tokens"
  Write-Host ""
  $token = (Read-Host "Or paste API token now").Trim()
  if ($token) {
    $env:CLOUDFLARE_API_TOKEN = $token
  } else {
    throw "CLOUDFLARE_API_TOKEN is required"
  }
}

$headers = @{
  Authorization = "Bearer $env:CLOUDFLARE_API_TOKEN"
  "Content-Type" = "application/json"
}

function Invoke-CfApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null
  )

  $uri = "https://api.cloudflare.com/client/v4$Path"
  $params = @{
    Method = $Method
    Uri = $uri
    Headers = $headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 12)
  }
  $response = Invoke-RestMethod @params
  if (-not $response.success) {
    $message = ($response.errors | ForEach-Object { $_.message }) -join "; "
    throw ('Cloudflare API error: ' + $message)
  }
  return $response.result
}

try {
  Invoke-CfApi -Method "GET" -Path "/accounts/$AccountId/access/apps?per_page=1" | Out-Null
} catch {
  throw "Access API is not available yet. Enable Zero Trust first, then re-run this script."
}

$teamDomain = (Read-Host 'Paste your team domain, e.g. https://yourteam.cloudflareaccess.com').Trim().Trim('"').Trim("'")
if (-not $teamDomain.StartsWith("https://")) {
  $teamDomain = "https://$teamDomain"
}
if (-not $teamDomain.EndsWith(".cloudflareaccess.com")) {
  throw "Team domain should end with .cloudflareaccess.com"
}

$adminEmail = (Read-Host "Paste the ONLY admin email allowed through Access").Trim().ToLower()
if ($adminEmail -notmatch "^[^@\s]+@[^@\s]+\.[^@\s]+$") {
  throw "Enter a valid email address"
}

Write-Host ""
Write-Host "Creating Access application..." -ForegroundColor Cyan

$appBody = @{
  name = "Simple Streamz Admin"
  type = "self_hosted"
  session_duration = "24h"
  app_launcher_visible = $false
  path_cookie_attribute = $true
  domain = "$WorkerHost/admin"
  destinations = @(
    @{ type = "public"; uri = "$WorkerHost/admin" },
    @{ type = "public"; uri = "$WorkerHost/admin/*" },
    @{ type = "public"; uri = "$WorkerHost/api/admin" },
    @{ type = "public"; uri = "$WorkerHost/api/admin/*" }
  )
}

$app = Invoke-CfApi -Method "POST" -Path "/accounts/$AccountId/access/apps" -Body $appBody

Write-Host "Creating allow policy for $adminEmail..." -ForegroundColor Cyan

$policyBody = @{
  decision = "allow"
  name = "Allow Simple Streamz admin"
  precedence = 1
  include = @(
    @{ email = @{ email = $adminEmail } }
  )
}

$policy = Invoke-CfApi -Method "POST" -Path "/accounts/$AccountId/access/apps/$($app.id)/policies" -Body $policyBody

Write-Host ""
Write-Host "Access application created." -ForegroundColor Green
Write-Host "  App ID: $($app.id)"
Write-Host "  AUD tag: $($app.aud)"
Write-Host "  Policy ID: $($policy.id)"
Write-Host ""
Write-Host "Next: add these to wrangler.toml under [vars]:" -ForegroundColor Cyan
Write-Host "  CF_ACCESS_TEAM_DOMAIN = `"$teamDomain`""
Write-Host "  CF_ACCESS_AUD = `"$($app.aud)`""
Write-Host ""
Write-Host "Then deploy: npm run deploy"
Write-Host ""

$setNow = (Read-Host "Update wrangler.toml [vars] automatically now? [y/N]").Trim().ToLower()
if ($setNow -eq "y") {
  $wranglerPath = Join-Path (Get-Location) "wrangler.toml"
  $content = Get-Content $wranglerPath -Raw
  $varsBlock = @"
CF_ACCESS_TEAM_DOMAIN = "$teamDomain"
CF_ACCESS_AUD = "$($app.aud)"
"@
  if ($content -match 'CF_ACCESS_TEAM_DOMAIN\s*=') {
    $content = $content -replace 'CF_ACCESS_TEAM_DOMAIN\s*=\s*".*"', "CF_ACCESS_TEAM_DOMAIN = `"$teamDomain`""
    $content = $content -replace 'CF_ACCESS_AUD\s*=\s*".*"', "CF_ACCESS_AUD = `"$($app.aud)`""
  } else {
    $content = $content.TrimEnd() + "`n$varsBlock`n"
  }
  Set-Content -Path $wranglerPath -Value $content -NoNewline
  Write-Host "wrangler.toml updated. Deploy with: npm run deploy" -ForegroundColor Green
} else {
  Write-Host "Skipped wrangler.toml update. Add the vars manually before deploying." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test:" -ForegroundColor Cyan
Write-Host "  1. Open https://$WorkerHost/admin in a private window"
Write-Host "  2. You should see the Cloudflare Access login"
Write-Host "  3. Sign in with $adminEmail"
Write-Host "  4. Complete app MFA, then use the admin dashboard"
Write-Host ""