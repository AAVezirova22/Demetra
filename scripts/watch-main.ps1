param(
  [int]$IntervalSeconds = 20,
  [string]$Branch = "main",
  [switch]$SkipSslVerify,
  [switch]$AllowCredentialPrompt,
  [string]$GitHubToken = $env:GITHUB_TOKEN
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  $previousTerminalPrompt = $env:GIT_TERMINAL_PROMPT
  $previousGcmInteractive = $env:GCM_INTERACTIVE

  if (-not $AllowCredentialPrompt) {
    $env:GIT_TERMINAL_PROMPT = "0"
    $env:GCM_INTERACTIVE = "never"
  }

  try {
    $gitArgs = @()
    if ($SkipSslVerify) {
      $gitArgs += @("-c", "http.sslVerify=false")
    }
    if (-not $AllowCredentialPrompt) {
      $gitArgs += @("-c", "credential.interactive=false", "-c", "credential.helper=", "-c", "core.askPass=")
    }

    & git @gitArgs @Arguments
  } finally {
    $env:GIT_TERMINAL_PROMPT = $previousTerminalPrompt
    $env:GCM_INTERACTIVE = $previousGcmInteractive
  }
}

function Get-CurrentHead {
  (Invoke-Git rev-parse HEAD).Trim()
}

function Get-NetworkRemote {
  $remoteUrl = (Invoke-Git remote get-url origin).Trim()
  if ([string]::IsNullOrWhiteSpace($GitHubToken)) {
    return $remoteUrl
  }

  if ($remoteUrl -match "^https://github\.com/(.+)$") {
    $encodedToken = [Uri]::EscapeDataString($GitHubToken)
    return "https://x-access-token:$encodedToken@github.com/$($Matches[1])"
  }

  Write-Warning "GITHUB_TOKEN is set, but origin is not an HTTPS GitHub URL. Falling back to origin."
  return $remoteUrl
}

function Get-RemoteHead {
  $line = Invoke-Git ls-remote (Get-NetworkRemote) "refs/heads/$Branch"
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
if (-not $AllowCredentialPrompt) {
  Write-Host "Git credential prompts are disabled. The watcher will warn and keep running if authentication is required."
}
if ([string]::IsNullOrWhiteSpace($GitHubToken)) {
  Write-Host "No GITHUB_TOKEN is set. Private repositories may require one for unattended pulls."
} else {
  Write-Host "Using GITHUB_TOKEN for unattended GitHub fetches."
}
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
        Invoke-Git fetch (Get-NetworkRemote) "$Branch`:refs/remotes/origin/$Branch"
        Invoke-Git checkout $Branch
        Invoke-Git merge --ff-only "origin/$Branch"

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
