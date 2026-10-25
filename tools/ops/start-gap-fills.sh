#!/usr/bin/env bash
# 启动两条"补缺口"队列（各自独立、可中断续跑；已有的日期会跳过，几乎零成本）。
#
# 背景（2026-09-23 体检发现）：
#   渔场 2307 天 / 应约 2922 天（2017-01-01 起）→ 缺约 615 天，
#   抽查 2018-06-15 上游有数据（148 格点 · 2510 小时）→ 是没抓到，不是上游没有。
#   海温 2015/2016/2018 各缺几十天（两轮复查都没补上）。
set -u
cd /opt/ocean
export OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw

# ① 渔场：跑第三轮补 2017-2023 的缺口
if pgrep -f "gfw_pipeline.py" >/dev/null; then
  echo "渔场队列已在跑，跳过"
else
  set -a; . /etc/ocean/gfw.env; set +a
  setsid nohup /opt/ocean/venv/bin/python tools/pipeline/gfw_pipeline.py --workers 3 --passes 2 \
    >> /var/log/ocean-gfw-pipeline.log 2>&1 < /dev/null &
  echo "已启动渔场补缺队列（--workers 3 --passes 2）"
fi

# ② 海温：只为 2018/2016/2015 补缺口，2 路，避免和主队列（4 路）一起把上游压垮
if pgrep -f "sst_pipeline.py --years" >/dev/null; then
  echo "海温补缺队列已在跑，跳过"
else
  # --log 要显式指定：否则它会往主队列的 /var/log/ocean-sst-pipeline.log 里混写
  setsid nohup /opt/ocean/venv/bin/python tools/pipeline/sst_pipeline.py \
    --years 2018 2016 2015 --workers 2 --passes 2 --log /var/log/ocean-sst-gapfill.log \
    >> /var/log/ocean-sst-gapfill.log 2>&1 < /dev/null &
  echo "已启动海温补缺队列（--years 2018 2016 2015 --workers 2）"
fi

sleep 6
echo "--- 当前 pipeline 进程 ---"
ps -eo pid,ppid,etime,cmd | grep "pipeline.py" | grep -v grep | cut -c1-96
echo "--- 取数子进程数 ---"
ps -eo pid,cmd | grep -E "fetch_sst_samples|fetch_gfw_effort" | grep -v grep | wc -l
