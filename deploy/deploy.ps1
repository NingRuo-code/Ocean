#requires -Version 5.1
<#
.SYNOPSIS
  海洋锋面 · 一键部署：Windows 本地 → Ubuntu 服务器。

.DESCRIPTION
  流程：预检 → 打包（排除 .git 与数据）→ 上传 → 远程装环境并部署 → 上传原始数据 → 公网验收。
  幂等：可反复执行；远程 remote-setup.sh 本身就是幂等的。

.PARAMETER ServerIp
  实例公网 IP（换系统盘后可能变化，以控制台为准）。

.PARAMETER User
  登录用户，默认 root。

.PARAMETER KeyFile
  私钥路径；不传则退回密码登录（会交互提示）。

.PARAMETER SkipUpload
  只重跑远程环境/权限/服务，不重新上传代码与数据。

.PARAMETER SkipData
  不上传 data\raw（约 118 MB）。适合先跑通站点、数据稍后单独同步。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy\deploy.ps1 -ServerIp <server-ip> -KeyFile <key-file>

.NOTES
  编码约定：本文件必须 CRLF + UTF-8 **带 BOM**。
  无 BOM 时 PowerShell 5.1 会按 GBK 解码中文，产生一堆「假语法错误」。
  验收一律用 curl.exe：本机系统代理（Clash 等）会让 Invoke-WebRequest 误报，curl.exe 不读 WinINET 代理。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerIp,
  [string]$User = "root",
  [string]$KeyFile = "",
  [switch]$SkipUpload,
  [switch]$SkipData
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$PkgName = "ocean-app.tar.gz"
$DataPkgName = "ocean-data-raw.tar.gz"
$Stage = Join-Path ([System.IO.Path]::GetTempPath()) "ocean-stage"
$Package = Join-Path ([System.IO.Path]::GetTempPath()) $PkgName
$DataPackage = Join-Path ([System.IO.Path]::GetTempPath()) $DataPkgName

function Write-Step([string]$Text) { Write-Host ""; Write-Host "=== $Text ===" -ForegroundColor Cyan }
function Assert-LastExit([string]$What) {
  if ($LASTEXITCODE -ne 0) { throw "$What 失败（退出码 $LASTEXITCODE）" }
}
$SshTarget = "$User@$ServerIp"
$SshArgs = @("-o", "StrictHostKeyChecking=accept-new")
$ScpArgs = @("-o", "StrictHostKeyChecking=accept-new")
if ($KeyFile) {
  $SshArgs = @("-i", $KeyFile) + $SshArgs
  $ScpArgs = @("-i", $KeyFile) + $ScpArgs
}
function Invoke-Ssh([string]$Command) {
  & ssh @SshArgs $SshTarget $Command
  Assert-LastExit "ssh 执行"
}
function Invoke-SshCapture([string]$Command) {
  $result = & ssh @SshArgs $SshTarget $Command
  Assert-LastExit "ssh 执行"
  return $result
}
function Invoke-RemoteSetup([string]$SetupArgs) {
  # 远程安装要跑几分钟（apt + pip）：若在前台 ssh 里等，网络抖动或本地中断都会让远端脚本被杀。
  # 因此改成 setsid 后台执行 + 轮询日志，断了也不影响服务器上的进度（脚本本身幂等）。
  $log = "/var/log/ocean-setup.log"
  Invoke-Ssh "setsid nohup bash /tmp/ocean-remote-setup.sh $SetupArgs > $log 2>&1 < /dev/null & echo setup-started"
  $deadline = (Get-Date).AddMinutes(20)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 15
    # ⚠️ 不要用 `pgrep -f ocean-remote-setup.sh` 判断存活：轮询命令自己的命令行里就含这个字符串，
    # pgrep -f 会匹配到自己 → 永远 RUNNING（实测踩到）。改成看日志里的收尾标志。
    $state = (Invoke-SshCapture "grep -q curlexe $log && echo DONE || echo RUNNING") -join " "
    $tail = (Invoke-SshCapture "tail -n 3 $log") -join " | "
    Write-Host ("  [{0}] {1}" -f $state.Trim(), $tail)
    if ($state -match "DONE") { break }
  }
  Write-Host "远程安装日志：ssh $SshTarget 'tail -n 40 $log'" -ForegroundColor DarkGray
}

Write-Step "0/6 预检"
foreach ($tool in @("ssh", "scp", "tar", "curl.exe")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "缺少命令 $tool，请先安装（Windows 自带 OpenSSH 与 tar）" }
}
Write-Host "仓库根目录：$RepoRoot"
if (-not (Test-Path (Join-Path $PSScriptRoot "remote-setup.sh"))) { throw "脚本似乎不在 deploy\ 目录下（当前推断仓库根：$RepoRoot）" }
$port22 = Test-NetConnection $ServerIp -Port 22 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $port22) {
  throw "22 端口不通：请先在控制台放行安全组入方向 22（源填你的公网 IP/32），并确认实例已换 Ubuntu"
}
Write-Host "22 端口可达" -ForegroundColor Green

if (-not $SkipUpload) {
  Write-Step "1/6 打包应用（排除 .git / 数据 / 依赖缓存）"
  if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
  New-Item -ItemType Directory -Path $Stage | Out-Null
  # robocopy 退出码 < 8 都算成功（0=无变化, 1=有复制）
  robocopy $RepoRoot (Join-Path $Stage "Ocean") /E /NFL /NDL /NJH /NJS /NP `
    /XD .git archive node_modules raw processed cache __pycache__ .venv .pytest_cache .ruff_cache ocean_front_backend.egg-info | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy 打包失败（退出码 $LASTEXITCODE）" }
  if (Test-Path $Package) { Remove-Item $Package -Force }
  & tar -czf $Package -C $Stage "Ocean"
  Assert-LastExit "tar 打包"
  $mb = [math]::Round((Get-Item $Package).Length / 1MB, 2)
  Write-Host "应用包：$Package（$mb MB）" -ForegroundColor Green

  Write-Step "2/6 上传应用包与安装脚本"
  & scp @ScpArgs $Package "$User@${ServerIp}:/tmp/$PkgName"
  Assert-LastExit "scp 应用包"
  & scp @ScpArgs (Join-Path $PSScriptRoot "remote-setup.sh") "$User@${ServerIp}:/tmp/ocean-remote-setup.sh"
  Assert-LastExit "scp 安装脚本"

  Write-Step "3/6 远程安装与部署（后台执行 + 轮询，约 3~8 分钟）"
  Invoke-RemoteSetup "$ServerIp /tmp/$PkgName"
}
else {
  Write-Step "1-3/6 跳过上传，改为重跑远程环境与服务"
  Invoke-RemoteSetup "$ServerIp"
}

if (-not $SkipData) {
  Write-Step "4/6 上传原始数据（data\raw，可选）"
  $RawDir = Join-Path $RepoRoot "data\raw"
  if (-not (Test-Path $RawDir)) { Write-Host "本地没有 $RawDir，跳过数据上传" -ForegroundColor Yellow }
  else {
    # ⚠️ Windows 自带的 bsdtar **打不开非 ASCII 路径**（本仓在中文目录下），
    #    直接把 data\raw 交给 tar -C 会报 could not chdir。
    #    所以先用 robocopy（原生支持 Unicode）暂存到 ASCII 目录，再在那边打包。
    $DataStage = Join-Path "C:\tmp" "ocean-data-stage"
    if (Test-Path $DataStage) { Remove-Item $DataStage -Recurse -Force }
    robocopy $RawDir $DataStage /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy 数据暂存失败（退出码 $LASTEXITCODE）" }
    $stageCount = (Get-ChildItem $DataStage -Recurse -File -Filter *.nc | Measure-Object).Count
    Write-Host "暂存 .nc 文件数：$stageCount"

    if (Test-Path $DataPackage) { Remove-Item $DataPackage -Force }
    & tar -czf $DataPackage -C $DataStage "."
    Assert-LastExit "tar 打包数据"
    $mb = [math]::Round((Get-Item $DataPackage).Length / 1MB, 2)
    Write-Host "数据包：$DataPackage（$mb MB）" -ForegroundColor Green
    & scp @ScpArgs $DataPackage "$User@${ServerIp}:/tmp/$DataPkgName"
    Assert-LastExit "scp 数据包"
    Invoke-Ssh "mkdir -p /srv/ocean/data/raw && tar -xzf /tmp/$DataPkgName -C /srv/ocean/data/raw && rm -f /tmp/$DataPkgName && chown -R ocean:ocean /srv/ocean/data && find /srv/ocean/data/raw -name '*.nc' | wc -l"
    Write-Step "5/6 重跑权限收口与服务重启（remote-setup.sh 幂等）"
    Invoke-RemoteSetup "$ServerIp"
    Write-Step "5.5/6 重建 SQLite 索引（供按日期定位源文件）"
    Invoke-Ssh "curl -sS -m 300 -X POST http://127.0.0.1:8000/api/data/index/rebuild | head -c 300"
    Write-Host ""
  }
}
else {
  Write-Host "按 -SkipData 跳过数据上传（记得稍后单独同步，否则页面与接口都是空态）" -ForegroundColor Yellow
}

Write-Step "6/6 公网验收（curl.exe）"
$health = & curl.exe -sS -m 20 "http://$ServerIp/api/health"
Write-Host "GET /api/health → $health"
$code = & curl.exe -sS -m 20 -o NUL -w "%{http_code}" "http://$ServerIp/"
Write-Host "GET /            → HTTP $code"
$dates = & curl.exe -sS -m 30 "http://$ServerIp/api/catalog"
if ($dates) {
  $count = ([regex]::Matches($dates, "\d{4}-\d{2}-\d{2}")).Count
  Write-Host "catalog 里出现的日期字符串数：$count" -ForegroundColor Green
}
Write-Host ""
Write-Host "完成。浏览器打开 http://$ServerIp/" -ForegroundColor Green
Write-Host "排错：deploy\RUNBOOK.md；远程日志：ssh $User@$ServerIp 'journalctl -u ocean-api -n 50 --no-pager'"
