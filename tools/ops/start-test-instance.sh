# 海洋锋面 · 后端**测试实例**（8001）：起 / 停 / 看
#
# 用途：两个人一起在服务器上试新版本，**不碰**生产（127.0.0.1:8000 + nginx 80）。
#
# 用法（服务器上，root）：
#   bash /opt/ocean/tools/ops/start-test-instance.sh start
#   bash /opt/ocean/tools/ops/start-test-instance.sh status
#   bash /opt/ocean/tools/ops/start-test-instance.sh logs
#   bash /opt/ocean/tools/ops/start-test-instance.sh stop
#
# 隔离设计（改前先读，见 deploy/COLLAB.md §3.1）：
#   ① 端口 8001、--workers 1、以 ocean 用户跑   → 与生产互不影响；内存只占约 205 MB
#   ② 数据根 /srv/ocean/data-test：
#        raw        → **软链接**到 /srv/ocean/data/raw（磁盘只剩约 5 GB，拷不动 26 GB）
#        processed  → 独立目录（后端的 processed 固定取 raw 的同级目录，见 backend/app/main.py）
#        cache      → 独立目录
#      首次会把生产的索引复制过来，避免全量重扫 2.6 万+文件（那会吃满 2 vCPU）
#   ③ 日志 /var/log/ocean-api-test.log、PID /run/ocean-api-test.pid，与生产完全分开
#   ④ 只监听 127.0.0.1 —— 绝不对外开端口（API 无鉴权）。看结果用 SSH 隧道：
#        ssh -N -L 8001:127.0.0.1:8001 ocean   →   浏览器/curl 打本机 8001
#
# 编码约定：本文件必须 LF + UTF-8 无 BOM（CRLF 会让 bash 报 `$'\r': command not found`）。

set -euo pipefail

APP_DIR=/opt/ocean
VENV_PY="$APP_DIR/venv/bin/python"
TEST_ROOT=/srv/ocean/data-test
PROD_DATA=/srv/ocean/data
PORT=8001
LOG=/var/log/ocean-api-test.log
PIDFILE=/run/ocean-api-test.pid
RUN_AS=ocean

ok() { printf '✅ %s\n' "$*"; }
warn() { printf '⚠️  %s\n' "$*" >&2; }
die() { printf '错误：%s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 root 运行（sudo bash $0 ...）"
[ -x "$VENV_PY" ] || die "找不到 $VENV_PY（后端虚拟环境未安装？）"

# 返回 8001 上监听的 PID（没有则输出空串）
# ⚠️ 末尾必须 `|| true`：本脚本开了 `set -euo pipefail`，
#    而「端口上没有进程」时 grep/cut 管道会返回非 0 —— 若让这个函数以非 0 收尾，
#    `pid="$(port_pid)"` 这种赋值会直接把整个脚本静默干掉（实测踩到：stop 停了进程但一个字都没打印）。
port_pid() {
  ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true
}

ensure_dirs() {
  if [ ! -e "$TEST_ROOT/raw" ]; then
    mkdir -p "$TEST_ROOT/processed" "$TEST_ROOT/cache"
    ln -s "$PROD_DATA/raw" "$TEST_ROOT/raw"
    ok "已建 $TEST_ROOT（raw 是软链接，不占磁盘）"
  fi
  mkdir -p "$TEST_ROOT/processed" "$TEST_ROOT/cache"
  chown -R "$RUN_AS:$RUN_AS" "$TEST_ROOT"

  # 首次：复制生产的索引（约 5.7 MB），省一次全量扫描
  if [ -f "$PROD_DATA/processed/data_index.sqlite" ] \
     && [ ! -f "$TEST_ROOT/processed/data_index.sqlite" ]; then
    cp -a "$PROD_DATA/processed/." "$TEST_ROOT/processed/" 2>/dev/null || warn "索引复制失败，测试实例会自行重建（较慢）"
    chown -R "$RUN_AS:$RUN_AS" "$TEST_ROOT/processed"
    ok "已复制生产索引到 $TEST_ROOT/processed（省一次全量扫描）"
  fi
}

cmd_start() {
  if [ -n "$(port_pid)" ]; then
    warn "端口 $PORT 已经在监听（PID $(port_pid)）。要重启先 stop。"
    exit 0
  fi
  ensure_dirs

  # 磁盘守卫：测试实例本身不占空间，但别在快满的盘上再引新风险（见 deploy/COLLAB.md §3.4）
  FREE_GB="$(df -BG --output=avail / | tail -1 | tr -dc '0-9')"
  [ "${FREE_GB:-99}" -ge 2 ] || warn "根分区只剩 ${FREE_GB} GB，建议先清理再测试"

  # 与 ocean-api.service 完全对齐的启动方式，只改端口/worker 数/数据目录
  # ⚠️ 重定向必须落在**整个后台子 shell** 上（见下面 `) >> "$LOG" 2>&1 < /dev/null &`）：
  #    若只把重定向写在最后一条命令上，调用方一旦把 start 的输出接进管道
  #    （`start | tail -3`、`start | grep ...`），子进程会一直握着管道写端，
  #    管道等不到 EOF → 看起来像「start 卡死」。
  #    实测（2026-10-09）：重定向到文件 2.2 秒返回；接管道 40 秒仍未返回（被 timeout 杀掉）。
  (
    cd "$APP_DIR/backend" || exit 1
    exec setsid nohup runuser -u "$RUN_AS" -- env \
      OCEAN_RAW_DATA_DIR="$TEST_ROOT/raw" \
      OCEAN_CACHE_DIR="$TEST_ROOT/cache" \
      PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 \
      "$VENV_PY" -m uvicorn app.main:app --host 127.0.0.1 --port "$PORT" --workers 1
  ) >> "$LOG" 2>&1 < /dev/null &
  echo $! > "$PIDFILE"
  sleep 2

  # 等健康检查（xarray 首次按需读数据，给 60 秒）
  for _ in $(seq 1 30); do
    if curl -fsS -m 5 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      ok "测试实例已就绪：http://127.0.0.1:$PORT/（PID $(port_pid)，以 $RUN_AS 运行）"
      printf '   看结果（在你本机开隧道）：ssh -N -L %s:127.0.0.1:%s ocean\n' "$PORT" "$PORT"
      printf '   再打开 http://127.0.0.1:%s/api/health · 连前端页面见 deploy/COLLAB.md §3.3\n' "$PORT"
      return 0
    fi
    sleep 2
  done
  warn "60 秒内没起来 → 看日志：tail -n 50 $LOG"
  exit 1
}

cmd_stop() {
  local pid; pid="$(port_pid)"
  if [ -z "$pid" ]; then
    rm -f "$PIDFILE"
    ok "端口 $PORT 上没有进程，无需停止"
    return 0
  fi
  kill "$pid" 2>/dev/null || true
  local i remaining=""
  for i in $(seq 1 10); do
    remaining="$(port_pid)"
    [ -z "$remaining" ] && break
    sleep 1
  done
  if [ -n "$remaining" ]; then
    warn "优雅停止超时，改用 SIGKILL（PID $remaining）"
    kill -9 "$remaining" 2>/dev/null || true
    sleep 1
    remaining="$(port_pid)"
  fi
  rm -f "$PIDFILE"
  if [ -n "$remaining" ]; then
    warn "8001 仍在监听（PID $remaining）—— 请手动检查"
    return 1
  fi
  ok "测试实例已停止（生产的 8000 未受影响：ocean-api=$(systemctl is-active ocean-api)）"
}

cmd_status() {
  local pid; pid="$(port_pid)"
  if [ -z "$pid" ]; then
    echo "测试实例：未运行（端口 $PORT 空闲）"
  else
    echo "测试实例：运行中  PID=$pid  端口=$PORT  $(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ') 运行时长"
    curl -sS -m 5 "http://127.0.0.1:$PORT/api/health" 2>/dev/null | head -c 200; echo
  fi
  echo "生产实例：ocean-api=$(systemctl is-active ocean-api)  端口 8000=$(ss -ltnH 'sport = :8000' | wc -l) 条监听"
  echo "数据根  ：$TEST_ROOT（raw -> $(readlink "$TEST_ROOT/raw" 2>/dev/null || echo '（缺失）')）"
  echo "磁盘    ：$(df -h / | tail -1 | awk '{print $4" 可用 ("$5" 已用)"}')"
}

cmd_logs() {
  [ -f "$LOG" ] || die "还没有日志：$LOG"
  tail -n 50 "$LOG"
}

case "${1:-}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  *) die "用法：$0 {start|stop|status|logs}" ;;
esac
