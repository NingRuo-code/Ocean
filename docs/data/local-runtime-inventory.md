# 有界本地存储盘点（P1 #47软件切片）

沿规格#45/#47已确认的只读盘点工具→实际文件系统→脱敏报告入口验收，复用P0冻结来源快照；合成目录验证与真实本机清单分别记证。用户已确认暂缺原始资料并拟换服，本批不连接旧服、不将本机硬件当作现服容量，也不解除#47/#228及研究前置。

本次接续同一CLI验收：同一进程、选定root和固定映射读取两次，报告完整层的有符号字节/文件差值。用CLI第一轮观测完成事件后增删已知小文件，独立核对变化；未知/部分层不能变成零变化。仅描述两次逻辑长度之差，不自动推断变化原因、增长率或容量需求。

实施范围：扫描量及时间有界，不追随分层目录路径中的符号链接/Windows重解析点；无法完整遍历的层保留未知总量和已观测下界，文件不能当成空目录。P0快照复用原冻结读取器校验，输出不得覆盖已有文件。正常空目录、缺项、部分支持、预算耗尽、坏快照和已有输出均从原CLI验证，不用私有解析函数替代验收。

## 运行

```powershell
node tools/audit-research-baseline.mjs --source-registry docs/data/source-registry.json --out data/processed/source-audit-new.json
python tools/inventory-runtime.py --snapshot data/processed/source-audit-new.json --out data/processed/local-inventory-new.json --max-entries 100000 --max-seconds 10
```

需要项目已有Node和Python环境；复用来源冻结读取器只核身份，不重新扫描原档。`--root`默认为当前仓库，可显式指定要盘点的本机目录；root是操作者选定的目录，工具不证明它属于哪台服务器。CPU和磁盘字段仍属本机，RAM/IO/带宽/worker/负载未知，不据此给并发或缓存配额。

固定逻辑层与相对root路径如下。缺项只指这些选定位置，不代表主机其他目录也没有对应资料；不把整个磁盘或仓库所有产物都计入。

| 层 | 相对路径 |
| --- | --- |
| raw | data/raw |
| hot_display | frontend/prototype/data |
| derived_unclassified | data/processed |
| indexes | data/indexes |
| staging | data/staging |
| cache | data/cache |
| results | data/outputs |
| backup | data/backups |

默认8层共享最多100000个条目和10秒扫描预算，最大可设置1000000条目、120秒；深度上限64层。流式遍历，在条目间检查预算，不能打断阻塞的单次文件系统调用。配置文件哈希另有每文件32 MiB上限，既定3个路径逐段排除链接。工具不是防御恶意并发改写路径的文件系统隔离器。

`scan.elapsed_ms`包含盘点开始后的硬件/路径元信息及配置哈希耗时，不能当成纯文件遍历耗时；`max_seconds`用于分层遍历中的协作检查，不是整个CLI的强制超时。

## 结果与限制

- `measured`：本次遍历完整，`bytes/files`为逻辑文件长度及文件数；真实空目录才给0。
- `partial`：存在链接、无法读取条目、特殊文件或扫描预算限制，`bytes/files`保持null，已观测的 `observed_bytes/observed_files`只作下界，不能当总量或补齐容量。
- `missing/unavailable`：缺目录、非目录或无法取得路径信息，总量保持null。配置哈希缺项另有 `route_config_status`，不把缺文件等同空配置。

统计不读取各资料文件正文，也不是原档展开大小、内存数组、磁盘已分配块或去重后物理占用；硬链接按文件名分别计数。遍历期间资料可能变化，不宣称全目录原子快照或增长率。所有层相加也不能自动等同磁盘容量需求。

报告形成后才创建输出目录，避免输出操作把原本缺失的层变成“空目录”。先写同目录临时文件，再以不覆盖的硬链接发布；输出盘须支持该操作（常用NTFS/ext4支持），不支持时安全失败，不降级覆盖。已有输出、来源快照或并发写入者不会被替换。重复运行请使用新文件名；不自动删除旧报告、缓存或数据。失败时可能保留未能清理的临时文件，不能视为已发布结果。

CLI成功退出表示形成了这份报告；其中可以有 `partial/missing/unavailable`，不等于全部层完整或服务器已经准入。调用方应逐层检查状态和限制。

## 同一次运行内观察变化

```powershell
python tools/inventory-runtime.py --snapshot data/processed/source-audit-new.json --out data/processed/local-change-new.json --samples 2 --interval-seconds 2
```

默认仍只读一次，不新增进度输出。`--samples 2`在同一进程和选定root路径中进行两次观测；每次独立使用既定扫描预算，在第一次完成后等待指定间隔（默认1秒，可设0至30秒）。`--interval-seconds`不能单独用于一次观测，不接受无穷或NaN。整个命令的预算是两次扫描及间隔，不是持续监测，也不创建后台服务。

两次观测分别完成时，stdout输出仅含事件名、序号和总次数的JSON行 `inventory_observation_complete`；事件表示该轮观察结束，不代表输出已发布或层全部完整。最终报告仍仅在全部观察结束后以不覆盖方式发布，输出目录也到此时才创建。

顶层保留第二次报告，`observations.before`保留第一次的时间、层状态/数量、扫描及配置身份。`observations.changes`只在同一层两次均为measured时给出有符号 `bytes_delta/files_delta`；可为正、负或有效零，任何一侧缺失、未知或部分遍历都保持null，不用相等下界推导零变化。每层仍对应不同的遍历时间窗口，不是原子时点。

`elapsed_between_starts_ms`为本进程单调时钟测得的两次开始间隔，包含第一轮耗时与等待，不用墙上时间差计算。两次复用同一份已校验P0快照作为审计上下文，不重扫或重新批准源资料；目录内容变化不自动变成新的语义/许可/研究资格证据。比较只针对同进程所选路径，不证明跨主机、跨移动目录或恶意替换路径前后身份一致。结果不推断变化原因、增长率、趋势、峰值内存或采购容量；两轮配置哈希均保留以便人工复核。

本机报告只包含固定逻辑层名、状态、数量/字节、配置哈希及来源身份，不含原始文件清单、私有目录、凭据或AIS记录。公开前仍应审核实际硬件/资料摘要；生产目标的路由、版本、资源、备份与容量须等后续实际访问另验。
