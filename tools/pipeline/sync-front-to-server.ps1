# 把本地已下载的锋面 .nc 增量同步到服务器，并重建后端数据索引。
#
# 为什么需要它：服务器直连 Zenodo 读 front_location.zip（18.3 GB）的中央目录会反复
# IncompleteRead，remotezip 开不了归档，所以锋面只能在本地取、再传上去（见 deploy/RUNBOOK.md）。
#
# 幂等：只传服务器上缺的文件，可以反复跑（本地还在下也没关系，下次跑会把新下的补上）。
#
# 用法：
#   powershell -File tools\pipeline\sync-front-to-server.ps1
#   powershell -File tools\pipeline\sync-front-to-server.ps1 -Years 2023,2024 -BatchSize 60
param(
    [string]$Server = 'root@116.62.54.140',
    [string]$RemoteRoot = '/srv/ocean/data/raw/front',
    [string[]]$Years = @(),
    [string]$KeyPath = (Join-Path $env:USERPROFILE '.ssh\id_ed25519_ocean'),
    [int]$BatchSize = 60,
    [string]$RepoRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [switch]$SkipIndexRebuild
)
$ErrorActionPreference = 'Stop'
$sshArgs = @('-n', '-i', $KeyPath, '-o', 'StrictHostKeyChecking=accept-new', $Server)
$localRoot = Join-Path $RepoRoot 'data\raw\front'
$totalUploaded = 0

# 默认同步"本地实际存在的所有年份"。
# 这里曾经硬编码 2015–2024，结果 1991–2014 下好了却从没上传（服务器上正好卡在 3653 个文件 =
# 2015–2024 十年），排查了很久才发现——所以改成自动探测，别再写死年份。
if (-not $Years -or $Years.Count -eq 0) {
    $Years = @(
        Get-ChildItem $localRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match '^\d{4}$' } |
            Sort-Object Name -Descending |
            Select-Object -ExpandProperty Name
    )
    Write-Host "未指定 -Years，按本地目录自动同步这些年份：$($Years -join ',')"
}

foreach ($year in $Years) {
    $localDir = Join-Path $localRoot $year
    if (-not (Test-Path $localDir)) { continue }

    $local = Get-ChildItem $localDir -Filter '*.nc' -File | Select-Object -ExpandProperty Name
    if (-not $local) { continue }

    $remote = @(& ssh @sshArgs "ls $RemoteRoot/$year 2>/dev/null")
    $missing = @($local | Where-Object { $remote -notcontains $_ })
    Write-Host "[$year] 本地 $($local.Count) · 服务器 $($remote.Count) · 待传 $($missing.Count)"
    if (-not $missing) { continue }

    # scp 不会创建远程目录：2014 及更早的年份目录还不存在时，
    # `scp file ocean:/path/2014/` 会直接报 "No such file or directory" 并让整轮同步中断
    # （实测：1992–2014 的文件因此从没传上去过）。所以先把年份目录建好。
    & ssh @sshArgs "mkdir -p $RemoteRoot/$year"
    if ($LASTEXITCODE -ne 0) { throw "无法创建远程目录：$RemoteRoot/$year" }

    for ($i = 0; $i -lt $missing.Count; $i += $BatchSize) {
        $end = [Math]::Min($i + $BatchSize - 1, $missing.Count - 1)
        $batch = @($missing[$i..$end])
        $paths = $batch | ForEach-Object { Join-Path $localDir $_ }
        & scp -q -i $KeyPath $paths "${Server}:$RemoteRoot/$year/"
        if ($LASTEXITCODE -ne 0) { throw "scp 失败：$year 第 $($i / $BatchSize + 1) 批" }
        $totalUploaded += $batch.Count
        Write-Host "  已传 $($totalUploaded) 个（$year，$($i + $batch.Count)/$($missing.Count)）"
    }
}

if ($totalUploaded -gt 0) {
    Write-Host "chown ocean:ocean 并重建索引…"
    & ssh @sshArgs "chown -R ocean:ocean /srv/ocean/data/raw/front"
    if (-not $SkipIndexRebuild) {
        & ssh @sshArgs "curl -s -X POST -o /dev/null -w rebuild=%{http_code} http://127.0.0.1:8000/api/data/index/rebuild; echo"
    }
} else {
    Write-Host "服务器已是最新，无需上传。"
}
Write-Host "完成：本次上传 $totalUploaded 个文件。"
