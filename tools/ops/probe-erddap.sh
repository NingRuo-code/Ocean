#!/usr/bin/env bash
# ERDDAP 上游可用性探查。用法：ocean-ops erddap [YYYY-MM-DD]
#
# 每条探测**先打印进度再发请求**，且单步超时都很短（最坏合计约 80 秒），
# 所以终端里能一直看到动静，不会像卡死。任何时候 Ctrl+C 都安全（纯只读）。
#
# 判读：
#   ① version 有输出              → ERDDAP 服务在线（不是断网）
#   ② 取一天 200 + 约 120 KB      → 上游健康，队列会自己续上
#   ② 取一天 404 / 正文 unknown   → 数据集列表没加载（上游整站重载），不是我们的问题
#   ④ 只有某个 ID 404 而别的正常  → 那个数据集改名/下线，需要换 --dataset
#
# 坑：URL 里的 [ ] 是 ERDDAP 下标语法，curl 默认当通配符 → 必须有 -g（--globoff），
#     否则 curl 直接 exit=3 URL malformed，请求根本没发出去。
set -u

BASE=${ERDDAP_BASE:-https://coastwatch.noaa.gov/erddap}
DATASET=${ERDDAP_DATASET:-noaacwBLENDEDCsstDaily}
DAY=${1:-2021-06-15}
BODY=/tmp/.ocean-probe-body
# -s 静默、-S 仍然显示错误、-g 关掉 URL 通配
CURL=(curl -g -s -S)

echo "探测 $BASE（数据集 $DATASET，样日 $DAY）"
echo

echo "① 服务版本（最多等 15s）"
version=$("${CURL[@]}" -m 15 "$BASE/version" 2>&1) || version=""
echo "   ${version:-（取不到，可能整站不可用）}"

echo
echo "② 取一天 $DAY（最多等 25s；与 fetcher 完全相同的选择器）"
result=$("${CURL[@]}" -m 25 -o "$BODY" -w '%{http_code} %{time_total}s %{size_download}B' \
  "$BASE/griddap/$DATASET.nc?analysed_sst[(${DAY}T00:00:00Z):1:(${DAY}T23:59:59Z)][(27):1:(34)][(120):1:(128)],mask[(${DAY}T00:00:00Z):1:(${DAY}T23:59:59Z)][(27):1:(34)][(120):1:(128)]" 2>&1)
echo "   HTTP=$result   （200 + 约 120 KB = 上游健康）"
echo "   正文前 160 字节：$(head -c 160 "$BODY" 2>/dev/null | tr '\n' ' ')"

echo
echo "③ 搜索 BLENDEDCsst（最多等 12s；有结果=数据集在列表里）"
search=$("${CURL[@]}" -m 12 -w ' [HTTP %{http_code}]' "$BASE/search/index.csv?searchFor=BLENDEDCsst&itemsPerPage=4" 2>&1) || search=""
printf '   %s\n' "$(printf '%s' "$search" | head -2 | cut -c1-150)"

echo
echo "④ 对照：编造的 ID 与另一个真实产品（各最多等 8s）"
for id in zzzNotARealDataset noaacwCRWdaily; do
  printf '   %-22s %s\n' "$id" "$("${CURL[@]}" -m 8 -o /dev/null -w '%{http_code}' "$BASE/griddap/$id.das" 2>&1)"
done

echo
echo "⑤ 服务页（各最多等 10s）"
printf '   info/index.json  %s\n' "$("${CURL[@]}" -m 10 -o /dev/null -w '%{http_code}' "$BASE/info/index.json" 2>&1)"
printf '   status.html      %s\n' "$("${CURL[@]}" -m 10 -o /dev/null -w '%{http_code} in %{time_total}s' "$BASE/status.html" 2>&1)"

echo
echo "结论速读（核心只看 ① 和 ②）："
echo "  ①有版本 且 ②200+120KB                → 上游健康，队列正在下/已恢复"
echo "  ①有版本 但 ②404 unknown datasetID     → 数据集列表未加载（上游整站重载中），"
echo "      此时 ④ 里我们的真实 ID 会和编造 ID 表现完全一样（都 404）→ 等着，队列重试 + 第二遍复查会自动补"
echo "  ②200 但 ③/⑤ 是 302、④ 编造 ID 404     → 这些都是正常现象（搜索页会重定向；编造 ID 本就该 404）"
rm -f "$BODY"
