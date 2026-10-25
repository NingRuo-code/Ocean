param(
    [string]$HostName = "127.0.0.1",
    [int]$Port = 8000,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$BackendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $BackendRoot
try {
    $UvicornArgs = @("app.main:app", "--host", $HostName, "--port", "$Port")
    if (-not $NoReload) {
        $UvicornArgs += "--reload"
    }
    python -m uvicorn @UvicornArgs
}
finally {
    Pop-Location
}
