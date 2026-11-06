# 显式刷新和保留支持快照（#43）

在维护者本地用原审计入口刷新，`--support-state` 代替 `--out`。输入仍为已经加工的日审计或审核过的区域单元，不会自动取数或重跑原档扫描。

```powershell
node tools/audit-research-baseline.mjs --support-request conditions.json --daily-snapshot daily-audit.json --support-state support-state.json --report-out latest.md
node tools/audit-research-baseline.mjs --read-support-snapshot support-state.json.snapshots/<身份的64位摘要>.json
```

将服务的 `OCEAN_SUPPORT_STATE_PATH` 指向状态文件。`ready`时从相邻的`.snapshots`目录按内容身份取同一份快照，不读取未登记输出，也不会用`OCEAN_SUPPORT_SNAPSHOT_PATH`回退。单独配置旧快照仍可作历史阅读，当前身份未知。每个状态文件管理一份选定条件及其最多三个几何；其他条件不自动匹配或切换。

显式运行先标记scanning，读取并核对已加工输入，再写内容寻址快照和可选报告，最后原子替换回执。输入指纹对应本次实际解析的字节；运行时间在回执中单列。源字节、规则、几何、程序或运行库变化会体现在冻结结果身份中。重跑同输入和协议可复用完全相同的冻结快照。历史快照由原只读命令核对身份；状态、快照和报告是维护者控制的本地文件，不是公开下载目录。

查询只读取状态与冻结结果，并对回执登记的两个已加工输入和三个程序文件检查元信息。收到新回执、快照身份失配或发现这些文件发生变化时不沿用旧资格；文件不可访问时新鲜度未知。内容身份由显式运行产生，文件大小/时间仅用于发现变化，不能证明内容未变。`freshness=current` 的范围是已登记并发布的加工输入与协议，`raw_source_freshness=unknown`；系统不会侦测上游服务、原档或库的所有外部变化。替换来源或方法时显式刷新，不能将同名源当成同一版本。研究、公开权限及真实覆盖按原合同单独判断。

同一个状态文件只允许一个写入者。普通失败标记failed，历史快照保留；进程硬中断后scanning和`.lock`会保留，查询不回退。确认原写入进程已退出后，维护者可移除该状态文件对应的锁文件并显式重跑。普通读取不会清锁、启动任务或尝试恢复，也不会返回私有定位、原档或细格。
