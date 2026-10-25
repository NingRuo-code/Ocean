#requires -Version 5.1
<#
.SYNOPSIS
  探测服务器端口可达性（安全组是否放行 / 服务是否起来）。

.DESCRIPTION
  用 .NET TcpClient 直连并设超时，比 Test-NetConnection 快得多（后者在端口被 FILTERED 时会卡很久）。
  判读规则：
    OPEN            连接成功
    CLOSED/FILTERED 超时或被拒 —— 安全组没放行，或服务没监听
  用途：阶段 A 放行安全组后确认 22 通；阶段 B/C 确认 80 通；排障时区分「安全组」与「服务」两层问题。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy\probe-ports.ps1 -ServerIp <server-ip>
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\deploy\probe-ports.ps1 -ServerIp <server-ip> -Ports 22,80 -TimeoutMs 3000
.NOTES
  编码约定：本文件必须 CRLF + UTF-8 带 BOM（PowerShell 5.1 认中文）。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ServerIp,
  # 注意：用 powershell -File 调用时无法传数组，所以这里收字符串再自己拆
  # 例：-Ports "22,80,443,3389"
  [string]$Ports = "22,80,443,3389",
  [int]$TimeoutMs = 5000
)

$portList = @()
foreach ($item in ($Ports -split ',')) {
  $trimmed = $item.Trim()
  if ($trimmed -ne "") { $portList += [int]$trimmed }
}
if ($portList.Count -eq 0) { throw '没有可探测的端口，请用 -Ports "22,80" 这种写法' }

function Test-TcpPort {
  # 注意：参数不能叫 -Host —— 那是 PowerShell 的只读自动变量，赋值会报「无法覆盖变量 Host」
  param([string]$Target, [int]$Port, [int]$TimeoutMs)
  $client = New-Object System.Net.Sockets.TcpClient
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $async = $client.BeginConnect($Target, $Port, $null, $null)
    $connected = $async.AsyncWaitHandle.WaitOne($TimeoutMs, $false) -and $client.Connected
    $watch.Stop()
    if ($connected) { return @{ State = "OPEN"; Ms = $watch.ElapsedMilliseconds } }
    return @{ State = "CLOSED/FILTERED"; Ms = $watch.ElapsedMilliseconds }
  }
  catch {
    return @{ State = "ERROR"; Ms = $watch.ElapsedMilliseconds }
  }
  finally {
    $client.Close()
  }
}

Write-Host "探测 $ServerIp（超时 ${TimeoutMs}ms）" -ForegroundColor Cyan
foreach ($port in $portList) {
  $result = Test-TcpPort -Target $ServerIp -Port $port -TimeoutMs $TimeoutMs
  $state = [string]$result.State
  $ms = [string]$result.Ms
  $line = "  port " + $port.ToString().PadRight(6) + $state.PadRight(18) + $ms.PadLeft(6) + " ms"
  if ($state -eq "OPEN") { Write-Host $line -ForegroundColor Green } else { Write-Host $line -ForegroundColor DarkGray }
}
Write-Host ""
Write-Host "提示：22 不通 = 安全组没放行（控制台 → 网络与安全组 → 安全组 → 配置规则 → 入方向）；"
Write-Host "      80 不通而服务已启动 = 同上；服务没起来则看 journalctl -u ocean-api -n 50 --no-pager"
