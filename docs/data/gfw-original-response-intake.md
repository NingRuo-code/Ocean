# GFW 原始响应留存（#38）

2026-11-05：用户确认暂无本人 GFW 令牌。本页命令已做无网络预演；真实 GFW 请求、固定产品版本、原始字段和覆盖仍未验收。入口复用 `tools/pipeline/fetch_gfw_effort.py`。

## 当前试验请求

```powershell
python tools/pipeline/fetch_gfw_effort.py --start 2024-08-05 --end 2024-08-08 --split-days --bbox 123.5,29.5,125.5,31.5 --resolution HIGH --temporal DAILY --group-by GEARTYPE --archive-only --out-dir data/raw/fishing-intake --dry-run
```

日期为左闭右开，拆为三份逐日请求；保留空间格点（`spatial-aggregation=false`），按渔具分组。窗口只用于验证契约，不预设有活动或覆盖完整。`HIGH` 是现有客户端使用的枚举；官方文档曾出现 `HIGHT` 拼写，真实接入时仍需核对实际分辨率。0.01°目标不能因请求参数而宣称已经达到。[官方 report 合同](https://globalfishingwatch.org/our-apis/documentation/docs/v3/4wings/report)

获得令牌后只在本机设置 `GFW_TOKEN` 或使用受保护的 `--token-file`。移除 `--dry-run` 才会联网；不要把令牌贴入聊天或写入命令行历史。当前 `latest` 是浮动标识，正式研究前仍须通过官方目录取得可复现版本与日期可用性，并核对归档内的说明；工具不会把 `latest` 自动标为固定版本。[认证说明](https://globalfishingwatch.org/our-apis/documentation/docs/authentication)

## 留存合同

每次成功 HTTP 响应在输出目录的 `archives/<UTC时间与随机身份>/` 留存：

- `response.bin`：响应正文原字节。若为ZIP，全部CSV、许可和caveats成员均原样保留；不会只取第一个CSV后丢弃原包。
- `request.json`：请求方法、URL、日期/粒度/空间参数、请求体、UTC取得时间、响应类型、字节数及SHA256。不写请求头、令牌或原档绝对路径。

清单最后写入，作为归档完成标志；中途失败只留下未完成目录，不冒充有效归档。重跑产生新身份，保留旧响应。归档先于旧版解析，即使旧解析失败仍能检查原包；落盘失败不会再次请求网络。

`--archive-only` 不运行旧展示转换、不写日网格或展示索引；不能与 `--skip-existing` 或 `--rebuild-manifest` 混用，因为存在展示文件并不证明原包已留存。未使用该模式的旧下载流程也会先归档，再执行原有转换；其中模糊字段匹配、小时取整等旧行为仍不能视作科研转换验收。

归档状态仅为 HTTP 响应已留存，`dataset_version_verified/research_ready/public_release_approved` 均为 false。空包、无记录或HTTP成功均不证明零活动、完整覆盖或字段正确。完成真实请求后按 #38 核对日期、小时单位、坐标中心、实际粒度、缺测/显式零、重复及源到展示小时守恒，再推进 #39。

API许可标记已修正为 CC BY-NC 4.0；历史报告中的旧标记不被反向修改。原包、细网格、请求清单和本地工作文件都留在被忽略的 `data/raw`，不得直接提交Git。[官方许可](https://globalfishingwatch.org/our-apis/documentation/docs/license-rate-limits)、[仓库治理规则](../data-governance-gfw-ais.md)
