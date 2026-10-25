#!/usr/bin/env bash
# 清理「父进程已消失（PPID=1）」的取数孤儿进程。
#
# 为什么需要：pipeline 被 kill/重启（或父 shell 退出）时，它 fork 出来的 fetch_* 子进程
# 不会跟着死，会变成 PPID=1 的孤儿继续跑；它们和重启后的新一代 worker 抓的是
# **同一批日期**，等于请求量翻倍 → ERDDAP/GFW 限流（404 / 429 打满重试）→ 队列看起来"卡住"。
# 实测：2026-09-22 SST 队列因 2 个孤儿（16:02 启动）与新一代（16:12 启动）抢 2021 日期，
# 40 分钟几乎没有新文件落盘。
#
# 用法（服务器上）：bash /opt/ocean/tools/ops/kill-orphans.sh
set -u
PATTERN=${1:-fetch_sst_samples}
RAW=${OCEAN_RAW_DATA_DIR:-/srv/ocean/data/raw}

echo "清理前 $PATTERN 进程数: $(ps -eo pid,cmd | grep "$PATTERN" | grep -v grep | wc -l)"

orphans=$(ps -eo pid,ppid,cmd | awk -v p="$PATTERN" '$2 == 1 && $0 ~ p {print $1}')
if [ -z "$orphans" ]; then
  echo "没有孤儿进程"
else
  for pid in $orphans; do
    echo "杀掉孤儿 $pid：$(ps -o lstart= -p "$pid" 2>/dev/null | tr -s ' ')"
    kill "$pid" 2>/dev/null || echo "  （已退出）"
  done
  sleep 3
fi

echo
echo "清理后："
ps -eo pid,ppid,etime,cmd | grep "$PATTERN" | grep -v grep | cut -c1-70
echo "$PATTERN 进程数: $(ps -eo pid,cmd | grep "$PATTERN" | grep -v grep | wc -l)"
echo "残留 .part 文件: $(find "$RAW" -name '*.part' 2>/dev/null | wc -l)"
