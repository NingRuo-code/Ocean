#!/usr/bin/env bash
# 启动服务器侧的两条主取数队列（幂等：已在跑就跳过）。
#
# 用法（服务器上）：bash /opt/ocean/tools/ops/start-server-pipelines.sh
#
# ⚠️ 这两条队列是 `setsid nohup` 起的**后台常驻进程，不是 systemd 服务** →
#    服务器重启 / 被 kill 之后要手动再跑一次本脚本（之前只有 /tmp 下有启动脚本，/tmp 会被清空，
#    所以现在把它放进仓库里跟着代码走）。
#    补缺口队列见 tools/ops/start-gap-fills.sh；体检用 ocean-ops {health|years|growth|erddap}。
set -uo pipefail

export OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw
if [ -f /etc/ocean/gfw.env ]; then
  set -a; . /etc/ocean/gfw.env; set +a   # GFW token（注意该文件必须是 LF，CRLF 会把 \r 带进请求头）
fi
cd /opt/ocean || exit 1
PY=/opt/ocean/venv/bin/python

if pgrep -f 'sst_pipeline.py' >/dev/null; then
  echo "[跳过] 海温主队列已在跑"
else
  # --log 显式指定，避免和补缺队列混写同一个日志文件
  setsid nohup "$PY" tools/pipeline/sst_pipeline.py --log /var/log/ocean-sst-pipeline.log \
    >> /var/log/ocean-sst-pipeline.log 2>&1 < /dev/null &
  echo "[启动] 海温主队列（2022 → 2002，4 路并发，每年紧跟一轮复查）"
fi

if pgrep -f 'gfw_pipeline.py' >/dev/null; then
  echo "[跳过] 渔场队列已在跑"
else
  setsid nohup "$PY" tools/pipeline/gfw_pipeline.py --log /var/log/ocean-gfw-pipeline.log \
    >> /var/log/ocean-gfw-pipeline.log 2>&1 < /dev/null &
  echo "[启动] 渔场队列（2024 → 2017，3 路并发，每批 40 天）"
fi

sleep 4
echo
echo "--- 队列进程（PPID=1 说明是独立后台进程，正常）---"
pgrep -af 'pipeline\.py' | grep -v pgrep | head -8
echo "--- 取数子进程数（海温 4 + 渔场 ≤3）---"
pgrep -fc 'fetch_sst_samples|fetch_gfw_effort' || echo 0
echo
echo "下一步："
echo "  ocean-ops health    # 主机/进程体检"
echo "  ocean-ops growth    # 30 秒增长窗口，确认真的在长"
echo "  ocean-ops years     # 逐年覆盖矩阵"
