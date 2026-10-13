#requires -Version 5.1
<#
.SYNOPSIS
  Run public HTTP smoke checks against an already-deployed Ocean server.

.DESCRIPTION
  This script intentionally accepts a base URL placeholder such as http://<server-ip>.
  Do not commit real server addresses, credentials, SSH key paths, or incident notes.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [int]$TimeoutSec = 30
)

$ErrorActionPreference = "Stop"
$base = $BaseUrl.TrimEnd("/")

function Invoke-SmokeRequest {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$MustContain = ""
  )

  $url = "$base$Path"
  Write-Host ""
  Write-Host "== $Name ==" -ForegroundColor Cyan
  Write-Host $url
  $response = & curl.exe -fsS -m $TimeoutSec $url
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with curl exit code $LASTEXITCODE"
  }
  $text = ($response -join "`n")
  if ($MustContain -and -not $text.Contains($MustContain)) {
    throw "$Name response did not contain expected marker: $MustContain"
  }
  if ($text.Length -gt 800) {
    Write-Host ($text.Substring(0, 800) + "...")
  }
  else {
    Write-Host $text
  }
}

Invoke-SmokeRequest -Name "frontend" -Path "/" -MustContain "Ocean"
Invoke-SmokeRequest -Name "health" -Path "/api/health" -MustContain '"status":"ok"'
Invoke-SmokeRequest -Name "viewport" -Path "/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4" -MustContain '"coverage"'
Invoke-SmokeRequest -Name "query current state" -Path "/api/query/current-state?date=2024-08-05&bbox=122,27,124.2,29.6&step=4" -MustContain '"kind":"current_state"'
Invoke-SmokeRequest -Name "query front response" -Path "/api/query/front-response?date=2024-08-05&bbox=122,27,124.2,29.6&step=4" -MustContain '"kind":"front_response"'
Invoke-SmokeRequest -Name "query historical comparison" -Path "/api/query/historical-comparison?date=2024-08-05&longitude=120.5&latitude=30.5&radius_deg=1" -MustContain '"kind":"historical_comparison"'

Write-Host ""
Write-Host "Smoke checks passed." -ForegroundColor Green
