#requires -Version 5.1
<# Read-only scoped HTTP checks, not deployment, research or release admission. #>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BaseUrl,
  [int]$TimeoutSec = 30,
  [string]$FishingDate = "2024-08-05",
  [switch]$SkipFishing,
  [switch]$RequireReady
)

$ErrorActionPreference = "Stop"
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$checks = [System.Collections.Generic.List[object]]::new()
$checkpoint = "arguments"
$date = "2024-08-05"
$safeFishingDate = $null
$safeViewportSource = $null
$bbox = @(122.0, 27.0, 124.2, 29.6)
$query = "date=$date&bbox=122,27,124.2,29.6&step=4"

function Assert-Contract([bool]$Condition) {
  if (-not $Condition) { throw "contract_failed" }
}
function Test-Number($Value) {
  return (($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) -and
    -not [double]::IsNaN([double]$Value) -and -not [double]::IsInfinity([double]$Value))
}
function Test-ArrayEqual($Actual, $Expected) {
  if ($Actual -isnot [array] -or $Actual.Count -ne $Expected.Count) { return $false }
  for ($i = 0; $i -lt $Expected.Count; $i++) {
    if (-not (Test-Number $Actual[$i]) -or $Actual[$i] -ne $Expected[$i]) { return $false }
  }
  return $true
}
function Read-Endpoint([string]$Path, [switch]$Html) {
  $body = & curl.exe --silent --fail --noproxy "*" --max-time $TimeoutSec --max-filesize 4194304 -- "$base$Path" 2>$null
  if ($LASTEXITCODE -ne 0) { throw "request_failed" }
  $text = $body -join "`n"
  if ($Html) { return $text }
  try { return ($text | ConvertFrom-Json) } catch { throw "invalid_json" }
}
function Add-Check([string]$Name, [string]$Status) {
  $checks.Add([ordered]@{ name = $Name; status = $Status })
}
function Check-ViewportCoverage($Value) {
  Assert-Contract ($Value.status -cin @("ok", "partial", "empty", "unavailable"))
  Assert-Contract (Test-ArrayEqual $Value.requestBbox $bbox)
  foreach ($name in @("fronts", "sst", "fishingEffort")) {
    Assert-Contract ($Value.layers.$name -cin @("available", "partial", "empty", "unavailable"))
  }
  if ($Value.status -ceq "ok") {
    foreach ($name in @("fronts", "sst", "fishingEffort")) { Assert-Contract ($Value.layers.$name -ceq "available") }
    Assert-Contract (Test-ArrayEqual $Value.coveredBbox $bbox)
  }
}
function Check-Query($Value, [string]$Kind) {
  Assert-Contract ($Value.kind -ceq $Kind -and $Value.status -cin @("ok", "partial", "empty", "unavailable"))
  Assert-Contract ($Value.parameters.date -ceq $date -and $Value.source.query_service_version -cmatch "^basic-query-v[0-9]+$")
  Assert-Contract ($Value.caveats -is [array] -and $Value.evidence -is [array] -and $null -ne $Value.metrics)
  Assert-Contract ($Value.coverage.status -ceq $Value.status)
  if ($Kind -cne "historical_comparison") {
    Assert-Contract ($Value.source.service -ceq "viewport" -and $Value.parameters.step -eq 4)
    Assert-Contract (Test-ArrayEqual $Value.parameters.bbox $bbox)
    Check-ViewportCoverage $Value.coverage
  } else {
    Assert-Contract ($Value.source.service -ceq "history.probability")
    Assert-Contract ($Value.parameters.longitude -eq 120.5 -and $Value.parameters.latitude -eq 30.5 -and $Value.parameters.radius_deg -eq 1)
  }
  if ($Value.status -ceq "ok") {
    if ($Kind -ceq "current_state") {
      foreach ($name in @("front_feature_count", "sst_cell_count", "fishing_effort_cell_count")) {
        Assert-Contract ((Test-Number $Value.metrics.$name) -and $Value.metrics.$name -gt 0)
      }
      Assert-Contract ((Test-Number $Value.metrics.total_apparent_fishing_hours) -and $Value.metrics.total_apparent_fishing_hours -ge 0)
    } elseif ($Kind -ceq "front_response") {
      Assert-Contract ((Test-Number $Value.metrics.response_record_count) -and $Value.metrics.response_record_count -gt 0)
      Assert-Contract ((Test-Number $Value.metrics.post_window_apparent_fishing_hours) -and $Value.metrics.post_window_apparent_fishing_hours -ge 0)
    } else {
      foreach ($name in @("same_period_sample_count", "monthly_sample_count")) { Assert-Contract ((Test-Number $Value.metrics.$name) -and $Value.metrics.$name -gt 0) }
      foreach ($name in @("same_period_probability", "monthly_probability")) { Assert-Contract ((Test-Number $Value.metrics.$name) -and $Value.metrics.$name -ge 0 -and $Value.metrics.$name -le 1) }
    }
    Add-Check $checkpoint "ready"
  } else { Add-Check $checkpoint $Value.status }
}

try {
  $uri = $null
  Assert-Contract ([Uri]::TryCreate($BaseUrl, [UriKind]::Absolute, [ref]$uri))
  Assert-Contract ($uri.Scheme -cin @("http", "https") -and -not $uri.UserInfo -and -not $uri.Query -and -not $uri.Fragment)
  Assert-Contract ($TimeoutSec -ge 1 -and $TimeoutSec -le 120)
  $parsedDate = [datetime]::MinValue
  Assert-Contract ([datetime]::TryParseExact($FishingDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$parsedDate))
  $safeFishingDate = $FishingDate
  $base = $uri.AbsoluteUri.TrimEnd("/")

  $checkpoint = "frontend"
  $html = Read-Endpoint "/" -Html
  Assert-Contract ($html.Contains('id="mapSvg"') -and $html.Contains('id="timeDate"'))
  Add-Check $checkpoint "ready"

  $checkpoint = "health"
  $health = Read-Endpoint "/api/health"
  Assert-Contract ($health.status -ceq "ok" -and $health.service -is [string] -and $health.service.Length -gt 0)
  Add-Check $checkpoint "ready"

  $checkpoint = "viewport"
  $viewport = Read-Endpoint "/api/viewport?$query"
  Assert-Contract ($viewport.meta.date -ceq $date -and $viewport.meta.step -eq 4 -and $viewport.meta.source -cin @("fixture", "static_prototype"))
  $safeViewportSource = $viewport.meta.source
  Assert-Contract (Test-ArrayEqual $viewport.meta.bbox $bbox)
  Check-ViewportCoverage $viewport.coverage
  Assert-Contract ($viewport.meta.status -ceq $viewport.coverage.status -and $viewport.caveats -is [array])
  Assert-Contract ($viewport.layers.fronts.features -is [array] -and $viewport.layers.sst.cells -is [array] -and $viewport.layers.fishingEffort.cells -is [array])
  foreach ($name in @("fronts", "sst", "fishingEffort")) {
    $items = if ($name -ceq "fronts") { $viewport.layers.fronts.features } else { $viewport.layers.$name.cells }
    if ($viewport.coverage.layers.$name -cin @("available", "partial")) { Assert-Contract (@($items).Count -gt 0) }
    if ($viewport.coverage.layers.$name -cin @("empty", "unavailable")) { Assert-Contract (@($items).Count -eq 0) }
  }
  if ($viewport.layers.sst.cells.Count -gt 0) {
    Assert-Contract ($viewport.layers.sst.unit -ceq "celsius" -and $viewport.layers.sst.sourceUnit -ceq "degree_C")
  }
  if ($viewport.layers.fishingEffort.cells.Count -gt 0) {
    Assert-Contract ($viewport.layers.fishingEffort.unit -ceq "fishing_hours" -and $viewport.layers.fishingEffort.metric -ceq "apparent_fishing_effort")
  }
  if ($viewport.meta.status -ceq "ok") { Add-Check $checkpoint "ready" } else { Add-Check $checkpoint $viewport.meta.status }

  $checkpoint = "current-state"
  Check-Query (Read-Endpoint "/api/query/current-state?$query") "current_state"
  $checkpoint = "front-response"
  Check-Query (Read-Endpoint "/api/query/front-response?$query") "front_response"
  $checkpoint = "historical-comparison"
  Check-Query (Read-Endpoint "/api/query/historical-comparison?date=$date&longitude=120.5&latitude=30.5&radius_deg=1") "historical_comparison"

  $checkpoint = "fishing-availability"
  if ($SkipFishing) {
    Add-Check $checkpoint "skipped"
    Add-Check "fishing-day" "skipped"
  } else {
    $available = Read-Endpoint "/api/fishing/availability"
    Assert-Contract ($available.ready -is [bool] -and $available.days -is [array])
    Assert-Contract ((Test-Number $available.day_count) -and $available.day_count -eq $available.days.Count)
    Assert-Contract ($available.ready -eq ($available.day_count -gt 0))
    if (-not $available.ready) {
      Add-Check $checkpoint "unavailable"
      Add-Check "fishing-day" "unavailable"
    } else {
      $selectedDays = @($available.days | Where-Object { $_.date -ceq $FishingDate })
      Assert-Contract ($selectedDays.Count -eq 1)
      Add-Check $checkpoint "ready"
      $checkpoint = "fishing-day"
      $fishingDay = Read-Endpoint "/api/fishing/$FishingDate"
      $fishingCells = @()
      if ($fishingDay.cells -is [array]) { $fishingCells = @($fishingDay.cells) }
      Assert-Contract ($fishingDay.date -ceq $FishingDate -and (Test-Number $fishingDay.cell_count))
      if ($fishingDay.cell_count -lt 1 -or $fishingCells.Count -lt 1 -or $fishingDay.cell_count -ne $fishingCells.Count) { throw "empty_activity" }
      Assert-Contract ($selectedDays[0].cell_count -eq $fishingDay.cell_count)
      Assert-Contract ($fishingDay.source.unit -cin @("fishing_hours", "hours", "hour", "h"))
      if ($null -ne $fishingDay.source.metric) { Assert-Contract ($fishingDay.source.metric -ceq "apparent_fishing_effort") }
      foreach ($cell in $fishingCells) {
        Assert-Contract ((Test-Number $cell.hours) -and $cell.hours -ge 0 -and (Test-Number $cell.lon) -and (Test-Number $cell.lat))
        Assert-Contract ([math]::Abs($cell.lon) -le 180 -and [math]::Abs($cell.lat) -le 90)
      }
      Add-Check $checkpoint "ready"
    }
  }
} catch {
  # Never echo remote bodies, transport errors, private locators or argument values.
  Add-Check $checkpoint "failed"
}

$failed = @($checks | Where-Object { $_.status -eq "failed" }).Count -gt 0
$limited = @($checks | Where-Object { $_.status -ne "ready" }).Count -gt 0
$status = if ($failed) { "failed" } elseif ($limited) { "limited" } else { "ready" }
[ordered]@{
  schema = "ocean-server-smoke/v2"; status = $status
  conditions = @{ date = $date; bbox = $bbox; step = 4; fishing_date = $safeFishingDate }
  checks = @($checks.ToArray()); strict = [bool]$RequireReady
  viewport_source = $safeViewportSource
  research_qualified = $false; production_verified = $false; deployment_performed = $false; release_identity_verified = $false
} | ConvertTo-Json -Depth 8
if ($failed) { exit 1 }
if ($RequireReady -and $limited) { exit 2 }
exit 0
