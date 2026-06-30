param(
  [int]$IntervalSeconds = 20,
  [string]$Branch = "main",
  [switch]$SkipSslVerify
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  if ($SkipSslVerify) {
    & git -c http.sslVerify=false @Arguments
  } else {
    & git @Arguments
  }
}

function Get-CurrentHead {
  (Invoke-Git rev-parse HEAD).Trim()
}

function Get-RemoteHead {
  $line = Invoke-Git ls-remote origin "refs/heads/$Branch"
  if (-not $line) {
    throw "Could not read origin/$Branch."
  }
  ($line -split "\s+")[0]
}

function Test-WorkingTreeDirty {
  -not [string]::IsNullOrWhiteSpace((Invoke-Git status --porcelain))
}

function Get-ChangedFiles {
  param([string]$Before, [string]$After)
  Invoke-Git diff --name-only "$Before..$After"
}

function Restart-ForChanges {
  param([string[]]$ChangedFiles)

  $frontendDependencyChanged = $ChangedFiles | Where-Object {
    $_ -in @("frontend/package.json", "frontend/package-lock.json", "frontend/Dockerfile", "docker-compose.yml")
  }
  $backendChanged = $ChangedFiles | Where-Object {
    $_ -like "backend/*" -or $_ -like "prisma/*" -or $_ -in @("docker-compose.yml")
  }
  $nginxChanged = $ChangedFiles | Where-Object { $_ -like "nginx/*" }

  if ($backendChanged) {
    Write-Host "Backend or Prisma changed. Rebuilding api and worker..."
    docker compose up -d --build api worker
  }

  if ($frontendDependencyChanged) {
    Write-Host "Frontend dependencies or Docker config changed. Recreating frontend..."
    docker compose up -d --build frontend
  }

  if ($nginxChanged) {
    Write-Host "Nginx config changed. Recreating nginx..."
    docker compose up -d nginx
  }

  if (-not $backendChanged -and -not $frontendDependencyChanged -and -not $nginxChanged) {
    Write-Host "Only bind-mounted frontend/source files changed. Vite should update live."
  }
}

Write-Host "Watching origin/$Branch every $IntervalSeconds seconds from $repoRoot."
Write-Host "Stop with Ctrl+C."

while ($true) {
  try {
    $localHead = Get-CurrentHead
    $remoteHead = Get-RemoteHead

    if ($localHead -ne $remoteHead) {
      Write-Host "New commit detected: $remoteHead"

      if (Test-WorkingTreeDirty) {
        Write-Warning "Local uncommitted changes exist. Skipping pull to avoid overwriting work."
      } else {
        Invoke-Git fetch origin $Branch
        Invoke-Git checkout $Branch
        Invoke-Git pull --ff-only origin $Branch

        $newHead = Get-CurrentHead
        $changedFiles = @(Get-ChangedFiles -Before $localHead -After $newHead)
        Restart-ForChanges -ChangedFiles $changedFiles

        Write-Host "Updated to $newHead."
      }
    }
  } catch {
    Write-Warning $_.Exception.Message
  }

  Start-Sleep -Seconds $IntervalSeconds
}
