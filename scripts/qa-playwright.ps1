$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $repoRoot "frontend"

Write-Host "Demetra Playwright QA"
Write-Host "Frontend: $frontendRoot"

Push-Location $frontendRoot
try {
  Write-Host "1/3 Building frontend..."
  npm run build

  Write-Host "2/3 Listing Playwright tests..."
  npx playwright test --list

  Write-Host "3/3 Running Playwright tests..."
  npm run test:e2e
}
finally {
  Pop-Location
}
