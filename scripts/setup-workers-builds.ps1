# Configure Cloudflare Workers Builds for Node 22 + recommended deploy command.
# Run from repo root: powershell -ExecutionPolicy Bypass -File scripts/setup-workers-builds.ps1
#
# Workers Builds failed with: "Wrangler requires at least Node.js v22.0.0" when CI used Node 20.

$ErrorActionPreference = "Stop"

$WorkerName = "simple-stream-core"

Write-Host ""
Write-Host "Simple Streamz - Workers Builds setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "In Cloudflare dashboard:" -ForegroundColor Yellow
Write-Host "  Workers & Pages -> $WorkerName -> Settings -> Builds"
Write-Host ""
Write-Host "Set these values:" -ForegroundColor Green
Write-Host "  Build command:   npm run build"
Write-Host "  Deploy command:  npm run deploy:ci"
Write-Host ""
Write-Host "Under Build variables and secrets (build-time):" -ForegroundColor Green
Write-Host "  NODE_VERSION = 22"
Write-Host "  (Delete NODE_VERSION if it is set to 20; that overrides .nvmrc)"
Write-Host ""
Write-Host "Required Vite build variables (if not already set):" -ForegroundColor Green
Write-Host "  VITE_SUPABASE_URL"
Write-Host "  VITE_SUPABASE_ANON_KEY"
Write-Host ""
Write-Host "Repo already pins Node 22 via .nvmrc, .node-version, and package.json engines."
Write-Host "After saving, push to main or click Retry deployment on the latest build."
Write-Host ""