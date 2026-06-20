# Remove /api/admin from Cloudflare Access so browser fetch + CORS preflight work.
# Admin API stays protected by Supabase JWT + profiles.role = admin in the Worker.
#
# Run: powershell -ExecutionPolicy Bypass -File scripts/fix-cloudflare-access-api.ps1

$ErrorActionPreference = "Stop"

$AccountId = "be90b9dfc7dfcf09a335189f4499ef4f"
$WorkerHost = "simple-stream-core.brianbuildzwebs.workers.dev"
$ExpectedAud = "c0be6912a9528aab4e35bb803271a0619681361d15cb3a3041c629488da324cf"

Write-Host ""
Write-Host "Fix Cloudflare Access - unprotect admin API paths" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Keeps Access on /admin only. Removes /api/admin (fixes 'Failed to fetch')."
Write-Host ""

if (-not $env:CLOUDFLARE_API_TOKEN) {
  $token = (Read-Host "Paste CLOUDFLARE_API_TOKEN (Access:Edit)").Trim()
  if (-not $token) { throw "CLOUDFLARE_API_TOKEN is required" }
  $env:CLOUDFLARE_API_TOKEN = $token
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

$apps = Invoke-CfApi -Method "GET" -Path "/accounts/$AccountId/access/apps?per_page=50"
$app = $apps | Where-Object { $_.aud -eq $ExpectedAud } | Select-Object -First 1
if (-not $app) {
  $app = $apps | Where-Object { $_.name -like "*Simple Streamz*" } | Select-Object -First 1
}
if (-not $app) {
  throw "Could not find Simple Streamz Access app. Update destinations manually in Zero Trust dashboard."
}

Write-Host "Found app: $($app.name) ($($app.id))" -ForegroundColor Green

$destinations = @(
  @{ type = "public"; uri = "$WorkerHost/admin" },
  @{ type = "public"; uri = "$WorkerHost/admin/*" }
)

$updateBody = @{
  name = $app.name
  type = $app.type
  session_duration = $app.session_duration
  app_launcher_visible = $app.app_launcher_visible
  path_cookie_attribute = $app.path_cookie_attribute
  domain = "$WorkerHost/admin"
  destinations = $destinations
}

$updated = Invoke-CfApi -Method "PUT" -Path "/accounts/$AccountId/access/apps/$($app.id)" -Body $updateBody

Write-Host ""
Write-Host "Access app updated." -ForegroundColor Green
Write-Host "  Destinations:"
foreach ($dest in $updated.destinations) {
  Write-Host "    - $($dest.uri)"
}
Write-Host ""
Write-Host "Verify OPTIONS preflight (should be 204/200 from Worker, not 403 from Access):"
Write-Host "  curl.exe -s -D - -o NUL -X OPTIONS https://$WorkerHost/api/admin/users"
Write-Host ""
Write-Host "Then deploy latest Worker if needed: npm run deploy"
Write-Host ""