#!/usr/bin/env bash
# 海温下载"自动计划"（v2，2026-09-24）：上游 ERDDAP 抖动时**不空烧重试**，
# 而且**某个阶段没产出就等上游恢复再重试**，直到真的拿到数据才往下走。
#
# 阶段顺序（2026-09-24 调整）：**先全球（用户优先），东海续跑放最后**。
# 原先把东海续跑放第一位，它要跑一两天，全球粗格 14 小时一天没动。
#   B 全球粗格 1°：2024 + 2023
#   C 全球粗格 1°：2022 + 2021
#   D 全球 0.25°：2024 + 2023（≈5GB；比 1° 细 4 倍）
#   A 东海明细 0.05° 续跑（2002-09–2024，跳过已存在；产品 2002 年 1–8 月无数据）
#   D2 全球 0.05° 全分辨率：默认注释（两年 ≈80–100GB，需先扩盘到 200GB 级）
#
# 用法（服务器上，后台常驻）：
#   cd /opt/ocean && setsid nohup bash tools/pipeline/sst_plan.sh > /var/log/ocean-sst-plan.log 2>&1 &
# 注意：必须 LF 换行（Windows 写的 .sh 带 CRLF 会让 bash 报 $'\r': command not found）。
set -u

PY=/opt/ocean/venv/bin/python
LOG=/var/log/ocean-sst-plan.log
SST_ROOT=/srv/ocean/data/raw
export OCEAN_RAW_DATA_DIR="$SST_ROOT"
cd /opt/ocean

log() { echo "[$(date '+%m-%d %H:%M:%S')] $*"; }

# 上游探活：三种源各用各的探测（某个源挂掉时不该挡住别的链路）
OISST_PROBE="https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/202401/oisst-avhrr-v02r01.20240101.nc"
# CRW CoralTemp v3.1 5km（东海明细的独立备用源；整球单日 11.5MB，只在 ERDDAP 挂时用）
CRW_PROBE="https://www.star.nesdis.noaa.gov/pub/socd/mecb/crw/data/5km/v3.1_op/nc/v1.0/daily/sst/2024/coraltemp_v3.1_20240805.nc"

upstream_code() {   # ERDDAP：与真实抓取同形状的小范围取数
  curl -s -o /dev/null -w '%{http_code}' --max-time 60 \
    "https://coastwatch.noaa.gov/erddap/griddap/noaacwBLENDEDCsstDaily.nc?analysed_sst%5B(2024-01-01T00:00:00Z):1:(2024-01-01T00:00:00Z)%5D%5B(0):20:(60)%5D%5B(100):20:(160)%5D"
}

probe_ok() {   # $1 = erddap | ncei | crw
  local kind="${1:-erddap}" code
  case "$kind" in
    ncei) code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -r 0-100 "$OISST_PROBE"); [ "$code" = "200" ] || [ "$code" = "206" ] ;;
    crw)  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 -r 0-100 "$CRW_PROBE");  [ "$code" = "200" ] || [ "$code" = "206" ] ;;
    *)    code=$(upstream_code); [ "$code" = "200" ] ;;
  esac
}

recent_in() {   # 该目录最近 5 分钟是否有新文件落盘
  find "$1" -name '*.nc' -newermt '-5 minutes' 2>/dev/null | wc -l
}

wait_upstream_for() {   # wait_upstream_for <目录> <erddap|ncei>
  local dir="$1" kind="${2:-erddap}" code
  while :; do
    if [ "$(recent_in "$dir")" -gt 0 ]; then
      log "上游可用（$dir 最近 5 分钟有新文件落盘，跳过探测）"
      return 0
    fi
    if probe_ok "$kind"; then
      return 0
    fi
    case "$kind" in
      ncei) code="NCEI OISST" ;;
      crw)  code="CRW CoralTemp" ;;
      *)    code="ERDDAP" ;;
    esac
    log "上游未就绪（$code 探测失败，$dir 5 分钟无新文件）→ 10 分钟后再试"
    sleep 600
  done
}

count_global() { find "$SST_ROOT/sst_global" -name '*.nc' 2>/dev/null | wc -l; }
count_regional() { find "$SST_ROOT/sst" -name '*.nc' 2>/dev/null | wc -l; }
free_gb() { df -P "$SST_ROOT" | tail -1 | awk '{printf "%.0f", $4/1048576}'; }

# 数「目标目录 + 指定年份」的文件数：多个阶段共用同一个分辨率目录时（B/C 都写 1deg），
# 只看目录总数会把"已完成"当成"没产出"或反之，所以按年份过滤。
count_target() {   # count_target <目录> [ "2024 2023" | "" ]
  local dir="$1" years="${2:-}"
  if [ -n "$years" ]; then
    find "$dir" -name '*.nc' 2>/dev/null | grep -E "/(${years// /|})/" | wc -l
  else
    find "$dir" -name '*.nc' 2>/dev/null | wc -l
  fi
}

# 自愈执行：跑够 expected 天为止；某一轮没进展就等 10 分钟重试（最多 MAX_ATTEMPTS 次）。
# 已经满足 expected 的阶段直接跳过 —— 重跑整个计划是幂等的，不会把已完成的阶段又跑一遍。
MAX_ATTEMPTS=24
run_phase_guarded() {   # run_phase_guarded <描述> <目录> <年份串|""> <期望天数> <erddap|ncei> <脚本> <参数...>
  local desc="$1" target="$2" years="$3" expected="$4" probe="$5" script="$6"; shift 6
  local attempt=0 before after
  before=$(count_target "$target" "$years")
  if [ "$before" -ge "$expected" ]; then
    log "跳过：$desc（已有 $before/$expected 天）"
    return 0
  fi
  while :; do
    attempt=$((attempt + 1))
    wait_upstream_for "$target" "$probe"
    before=$(count_target "$target" "$years")
    log "开始（第 $attempt 次）：$desc · 已有 $before/$expected 天 · 磁盘可用 $(free_gb)GB"
    "$PY" "$script" "$@" >> "$LOG" 2>&1
    after=$(count_target "$target" "$years")
    if [ "$after" -ge "$expected" ]; then
      log "完成：$desc（$after/$expected 天）"
      return 0
    fi
    if [ "$after" -gt "$before" ]; then
      log "本轮新增 $((after - before)) 天（$after/$expected），继续跑"
      attempt=0                     # 有进展就重置重试计数
      continue
    fi
    log "本轮没有新数据（$after/$expected，多半是上游重载/抖动）"
    if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
      log "达到重试上限 $MAX_ATTEMPTS 次，暂缓 $desc（重跑本脚本会继续）"
      return 1
    fi
    sleep 600
  done
}

log "=== 海温自动计划启动（东海 $(count_regional) 天 · 全球 $(count_global) 天 · 磁盘可用 $(free_gb)GB）==="

# 顺序说明（2026-09-24 调整）：**先全球（用户优先），东海续跑放最后**。
# 参数：<描述> <目录> <年份串> <期望天数> <erddap|ncei> <脚本> <参数...>
#   B/C 共用 sst_global/1deg，所以按年份过滤计数；D 用 0p2deg；E 用 0p25deg（NCEI 直连）。

# 顺序（2026-09-25 再调）：**E 最前** —— ERDDAP 系列阶段现在被上游故障堵住，
# 而 E 走 NCEI 直连、当下就能跑，先把你要的"全球 0.25° 两年"拿下来；
# ERDDAP 恢复后 B/C/D 会自动接力（守卫会一直等，但不空烧）。
# E：全球 0.25°：2024+2023 —— **NCEI OISST v2.1 直连**（单日 1.5MB，绕开 ERDDAP）
run_phase_guarded "E 全球 0.25°（OISST 直连）：2024+2023" "$SST_ROOT/sst_global/0p25deg" "2024 2023" 731 ncei \
  tools/pipeline/fetch_oisst_ncei.py --years 2024 2023 --workers 3

# B：全球粗格 1°，2024 + 2023（366 + 365 = 731 天）——ERDDAP 源
run_phase_guarded "B 全球粗格 1°：2024+2023" "$SST_ROOT/sst_global/1deg" "2024 2023" 731 erddap \
  tools/pipeline/sst_global_pipeline.py --stride 20 --years 2024 2023 --workers 3

# C：全球粗格 1°，2022 + 2021（365 + 365 = 730 天）——ERDDAP 源
run_phase_guarded "C 全球粗格 1°：2022+2021" "$SST_ROOT/sst_global/1deg" "2022 2021" 730 erddap \
  tools/pipeline/sst_global_pipeline.py --stride 20 --years 2022 2021 --workers 3

# D：全球 0.2°：2024+2023（ERDDAP 源；比 0.25° 略细，作为 1° 之上的备份档）
run_phase_guarded "D 全球 0.2°：2024+2023" "$SST_ROOT/sst_global/0p2deg" "2024 2023" 731 erddap \
  tools/pipeline/sst_global_pipeline.py --stride 4 --years 2024 2023 --workers 3
#   0.05° 全分辨率两年 ≈ 80–100GB（必须先把盘扩到 200GB 级）——决定扩盘后再取消下面两行
# run_phase_guarded "D2 全球 0.05°：2024+2023" "$SST_ROOT/sst_global/0p05deg" "2024 2023" 731 erddap \
#   tools/pipeline/sst_global_pipeline.py --stride 1 --years 2024 2023 --workers 2

# A：东海 0.05° 明细续跑（**产品实际起点是 2002-09-01**：noaacwBLENDEDCsstDaily 对 2002 年 1–8 月返回
#    "Your query produced no matching results"，所以期望天数是 8,158 天而不是 8,401 —— 写死 8,401 会让守卫
#    "永远追不满"，白等 24 轮后放弃（2026-09-27 核实）。跳过已存在的，放最后因为它要跑更久）
#    --min-free-gb 4：剩余约 1,800 天 × 0.12MB ≈ 0.22GB，而默认 6GB 门槛会把"完全够跑"误判成"没空间"
#    （2026-09-26 就是被它挡在门外，日志："磁盘可用 4.9 GB 低于 6.0 GB，停止队列"）。
run_phase_guarded "A 东海明细 0.05°（续跑）" "$SST_ROOT/sst" "" 8158 erddap \
  tools/pipeline/sst_pipeline.py --workers 4 --min-free-gb 4

# 应急（ERDDAP 再挂时）：把上面 A 那两行注释掉，启用下面这几行 —— 走 CRW CoralTemp v3.1 独立链路。
# 代价：整球单日 11.5MB、国内单流约 20KB/s 且会断流（脚本带 Range 续传重试），本地裁到东海窗口后只落 ~120KB。
# bbox 用 119.9,26.9,128.1,34.1（而不是 120,27,128,34）：CRW 格点在 27.025/34.025/120.025/128.025 上，
# 这样切出来的才是 141×161，与 ERDDAP 版历史文件逐格对齐（否则会少最东/最北各一格）。
# 候选源对比与踩坑见 deploy/RUNBOOK.md「东海明细（0.05°）的备用源调研（2026-09-27）」。
# run_phase_guarded "A' 东海明细 0.05°（CRW 备用源）" "$SST_ROOT/sst" "" 8158 crw \
#   tools/pipeline/fetch_coraltemp_crw.py --bbox 119.9,26.9,128.1,34.1 \
#     --years 2022 2021 2020 2019 2018 2017 2016 2015 2014 2013 2012 2011 2010 2009 2008 2007 2006 2005 2004 2003 2002 \
#     --workers 2 --min-free-gb 4

log "=== 计划结束（东海 $(count_regional) 天 · 全球粗格 $(count_global) 天 · 磁盘可用 $(free_gb)GB）==="
