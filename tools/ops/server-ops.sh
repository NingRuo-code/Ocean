#!/usr/bin/env bash
# 服务器日常观察脚本 —— 给本机 VS Code 任务用：
#   ssh ocean 'bash /opt/ocean/tools/ops/server-ops.sh health'
#   ssh ocean 'bash /opt/ocean/tools/ops/server-ops.sh data'
#   ssh ocean 'bash /opt/ocean/tools/ops/server-ops.sh perf'
#   ssh ocean 'bash /opt/ocean/tools/ops/server-ops.sh logs'
#   ssh ocean 'bash /opt/ocean/tools/ops/server-ops.sh all'
# 只读：不写数据、不重启服务，随时可跑（队列运行中也可以跑）。
set -u

RAW=${OCEAN_RAW_DATA_DIR:-/srv/ocean/data/raw}
API=http://127.0.0.1:8000/api
HDR=/tmp/.ocean-ops-headers

count_nc() { find "$1" -name '*.nc' 2>/dev/null | wc -l; }

cmd_health() {
  echo "===== 主机 ====="
  uptime
  free -h | head -2
  df -h / | tail -1
  echo
  echo "===== 取数 / 服务进程（PID PPID CPU% MEM% RSS 运行时长）====="
  echo "提示：fetch_sst_samples 的 PPID 若是 1，说明它成了孤儿（会和新一代抢同一批日期，见 RUNBOOK）"
  ps -eo pid,ppid,pcpu,pmem,rss,etime,cmd --sort=-rss 2>/dev/null \
    | grep -E 'uvicorn|pipeline\.py|fetch_' | grep -v grep \
    || echo "（当前没有 uvicorn / pipeline / fetch 进程）"
  echo
  echo "子进程计数：$(ps -eo pid,cmd | grep -E 'fetch_sst_samples|fetch_gfw_effort' | grep -v grep | wc -l)"
}

cmd_data() {
  echo "===== 数据规模 ====="
  printf '锋面 front    %6s 个 .nc\n' "$(count_nc "$RAW/front")"
  printf '海温 sst      %6s 个 .nc\n' "$(count_nc "$RAW/sst")"
  printf '渔场 fishing  %6s 天\n' "$(ls "$RAW"/fishing/effort-*.json 2>/dev/null | wc -l)"
  echo
  du -sh "$RAW"/* 2>/dev/null
  df -h /srv | tail -1
  echo
  echo "===== 接口侧视图 ====="
  curl -s "$API/catalog" >/dev/null 2>&1 && \
    curl -s -D "$HDR" "$API/catalog" -o /tmp/.ocean-ops-catalog && \
    jq -r '"catalog：日期 \(.available_dates|length) 个 / 文件 \(.file_count) 个 / cached=\(.cached)"' /tmp/.ocean-ops-catalog 2>/dev/null
  grep -i 'x-catalog-cache' "$HDR" 2>/dev/null | tr -d '\r'
  curl -s "$API/fishing/availability" \
    | jq -r '"fishing：覆盖 \(.days|length) 天 / 合计 \((.days|map(.total_hours)|add)|floor) 小时"' 2>/dev/null
}

timed() { # $1=说明 $2=URL
  printf '%-26s ' "$1"
  curl -s -o /dev/null -D "$HDR" -w '%{http_code}  %{time_total}s  %{size_download}B' "$2"
  grep -i -E 'x-(catalog|raster)-cache|x-raster-scale' "$HDR" 2>/dev/null | tr -d '\r' | paste -sd' ' | sed 's/^/  | /'
  echo
}

cmd_perf() {
  echo "===== 单请求耗时（服务器本机回环）====="
  timed 'catalog（默认不带文件清单）' "$API/catalog"
  timed 'catalog（再来一次，应命中）' "$API/catalog"
  timed 'point 2021-02-10' "$API/point/2021-02-10?longitude=124.5&latitude=30.2"
  timed 'fishing/availability' "$API/fishing/availability"
  timed 'raster sst 2deg' "$API/analysis/2020-05-10/raster?longitude=124.5&latitude=30.2&radius_deg=2&kind=sst"
  timed 'raster sst 2deg（再来一次）' "$API/analysis/2020-05-10/raster?longitude=124.5&latitude=30.2&radius_deg=2&kind=sst"
  echo
  echo "===== 20 并发 catalog（看最慢的一条）====="
  seq 1 20 | xargs -P 20 -I{} curl -s -o /dev/null -w '%{time_total}\n' "$API/catalog" | sort -rn | head -3
  echo
  echo "===== 栅格缓存目录 ====="
  echo "PNG=$(ls /srv/ocean/data/cache/rasters/*.png 2>/dev/null | wc -l)  scale 旁车=$(ls /srv/ocean/data/cache/rasters/*.scale 2>/dev/null | wc -l)"
}

cmd_logs() {
  for f in /var/log/ocean-sst-pipeline.log /var/log/ocean-gfw-pipeline.log /var/log/ocean-front-pipeline.log; do
    [ -f "$f" ] || continue
    echo "===== $f（最后 6 行）====="
    tail -n 6 "$f"
    echo
  done
  echo "===== journalctl -u ocean-api（最后 20 行）====="
  journalctl -u ocean-api -n 20 --no-pager 2>/dev/null || echo "（没有 journalctl 输出）"
}

cmd_erddap() {
  echo "===== ERDDAP 上游可用性 ====="
  echo "判读：version 有输出=服务在线；若**所有** datasetID 都 404、搜索返回空，"
  echo "      说明 ERDDAP 正在全量重载数据集（上游问题），此时队列的重试与第二遍复查会自动补漏。"
  echo
  bash "$(dirname "$0")/probe-erddap.sh"
}

cmd_years() {
  echo "===== 逐年覆盖（锋面 / 海温 / 渔场）====="
  printf '  %-6s %6s %6s %6s\n' 年份 锋面 海温 渔场
  for year in $(seq 1982 2026); do
    front=$(ls "$RAW"/front/"$year"/*.nc 2>/dev/null | wc -l)
    sst=$(ls "$RAW"/sst/"$year"/*.nc 2>/dev/null | wc -l)
    fish=$(ls "$RAW"/fishing/effort-"$year"*.json 2>/dev/null | wc -l)
    if [ "$front" -eq 0 ] && [ "$sst" -eq 0 ] && [ "$fish" -eq 0 ]; then continue; fi
    printf '  %-6s %6s %6s %6s\n' "$year" "$front" "$sst" "$fish"
  done
  echo
  printf '  合计   %6s %6s %6s\n' \
    "$(find "$RAW"/front -name '*.nc' 2>/dev/null | wc -l)" \
    "$(find "$RAW"/sst -name '*.nc' 2>/dev/null | wc -l)" \
    "$(ls "$RAW"/fishing/effort-*.json 2>/dev/null | wc -l)"
}

cmd_growth() {
  a_front=$(find "$RAW"/front -name '*.nc' 2>/dev/null | wc -l)
  a_sst=$(find "$RAW"/sst -name '*.nc' 2>/dev/null | wc -l)
  a_fish=$(ls "$RAW"/fishing/effort-*.json 2>/dev/null | wc -l)
  printf '%s  锋面=%s 海温=%s 渔场=%s\n' "$(date +%H:%M:%S)" "$a_front" "$a_sst" "$a_fish"
  sleep 30
  b_front=$(find "$RAW"/front -name '*.nc' 2>/dev/null | wc -l)
  b_sst=$(find "$RAW"/sst -name '*.nc' 2>/dev/null | wc -l)
  b_fish=$(ls "$RAW"/fishing/effort-*.json 2>/dev/null | wc -l)
  printf '%s  锋面=%s 海温=%s 渔场=%s\n' "$(date +%H:%M:%S)" "$b_front" "$b_sst" "$b_fish"
  printf '30 秒增量：锋面 +%s · 海温 +%s · 渔场 +%s\n' \
    "$((b_front - a_front))" "$((b_sst - a_sst))" "$((b_fish - a_fish))"
}

case "${1:-all}" in
  health) cmd_health ;;
  data) cmd_data ;;
  years) cmd_years ;;
  growth) cmd_growth ;;
  perf) cmd_perf ;;
  logs) cmd_logs ;;
  erddap) cmd_erddap ;;
  all) cmd_health; echo; cmd_data; echo; cmd_logs ;;
  *) echo "用法: bash server-ops.sh {health|data|years|growth|perf|logs|erddap|all}"; exit 2 ;;
esac
