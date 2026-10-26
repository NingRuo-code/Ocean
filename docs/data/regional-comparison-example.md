# C01 已知区域快照比较

关联#86/#85，基线main `20816bb9fb9d3827527288dc69a0c659f8b35f79`。本批采用规格中已确认的“显式比较请求→已存在A/B结果→同身份只读产物”验收接缝。独立已知事实核区域身份、原值、单位、月份/公里半径、零与未知、缺快照及条件变化；不新增科学引擎或测试专用网络接口。

## 使用

在仓库根目录及已安装后端依赖的环境运行；每次输出使用新的文件夹，不覆盖旧成果：

```powershell
node tools/run-front-response-experiment.mjs --regional-comparison-request docs/data/regional-comparison-month.example.json --output outputs/experiments/comparison-month-run1
node tools/run-front-response-experiment.mjs --read-regional-comparison-result outputs/experiments/comparison-month-run1
node tools/run-front-response-experiment.mjs --regional-comparison-request docs/data/regional-comparison-event.example.json --output outputs/experiments/comparison-event-run1
```

默认读取`backend/app/examples/regional-known-snapshots.json`，可用`--input`显式指定同合同快照包。Python解释器可用既有`OCEAN_EXPERIMENT_PYTHON`指定；普通冻结回读只使用Node，不依赖Python、原请求或快照包仍存在。回读不接受执行条件，不把旧条件更名为新条件。B01的固定圈模式和旧移动锋面缓冲模式保留原用途。

## 请求、读取与身份

- 2–8个不同固定点，共同半径10/20/30km；稳定候选ID、显示名、原A/B结果ID、导入快照内容SHA、来源ID/版本/输入SHA/许可/支持说明必填。同点改名、重复ID、越界、极点或经度±180表示的相同点拒绝。
- 月度用途仅提供具体年月；事件用途仅提供锚日搜索期。`read_existing_support`明确保留源结果原支持；`descriptive_side_by_side`只并列，不生成排名、差值、显著性或推荐。
- 各候选先核独立公开聚合声明，再核导入内容、原来源及用途、实际点/半径/月份或搜索期、已支持方法和单位。缺结果或不符在原列保留原因及所需A/B成果，不换月、换半径、删候选或启动补算。
- 仅消费自建CC0合成、明确公开的已就绪快照；私有、未知授权、真实研究身份及未支持版本不经本入口放行。这不是生产权限平台或P0真实性认证。公共许可声明须由导入者事先核实，不能用比较器代替许可审查。
- 原A/B `result_id`作为源成果身份原样保留。A Python和B Node冻结文件的数字文本可能不同，所以另用`snapshot_sha256`绑定实际导入对象，包括原结果ID。比较器不重新计算原科学结果身份，更不改写原成果；内容SHA不是发行者签名。
- 比较身份绑定规范请求、提交顺序、候选标签/位置及逐源身份、整个导入包与访问声明、实际行状态和指标。修改条件或来源生成新身份。各地域允许有不同来源内容SHA，不错误要求同一文件哈希。

## 已知样例及来源

快照包共4项：两个A01真实回环HTTP调用和两个B01原CLI显式执行的**自建合成结果**，在C运行之前独立准备；A/B计算完成和冻结回读已核对。C本身只读取它们，不导入A/B计算入口、不准备归档或调用网络/模型。

A输入以原`monthly-known-units.json`闰月例为基础，ID改为`c01-authored-two-region-month`、版本`synthetic-comparison-month/v1`。第一圈124.5/30.2保留原2月已知支持；第二圈125.5/30.2同为20km及2月，2月1日明确0h/4km²，2月2日缺测，其余未准备。源数值分别为H=40/E=7/D=2与H=0/E=4/D=1，日历均29天；不同支持使它们只能受限并列。

B输入以原`fixed-region-event.json`首圈为基础，ID改为`c01-authored-two-region-event`、版本`synthetic-comparison-event/v1`；复制第二圈到125.5/30.2，同20km和同日期/单元/观测，第二圈所有已知活动小时显式为0。两圈搜索期均2024-08-05至08-08，锚日08-05。第一圈前7日H28/E28、0日40/4、后1–3日36/12、后1–7日56/28；第二圈各窗均有效零，不能用它说明真实地区差异。

包内只有自建合成日聚合，未含原逐单元记录、真实AIS或实际GIS。完整真实交接、资格、统计及区域关系没有随样例放行。

## 产物与边界

成功原子发布新的`summary.json`、`report.md`、`manifest.json`，摘要/可读表/逐源证据同身份。冻结读取核产物SHA、用途、资格和嵌套原条件，不执行分析。缺源可以生成`not_ready`比较结果并保留候选，这是读取流程完成而非研究完成；坏请求、损坏/超预算输入或执行失败仅发布failed清单，不发布半成品表。

请求16KiB、输入1MiB、Python过程20秒/4MiB预算；拒绝重复JSON键和坏UTF-8，错误不泄露私人定位。冻结文件与校验清单必须一同保留；这不替代TASK持久服务、可信签名或备份。

数值来自原快照，已知0不等于未知。每列保留实际支持/源状态、方法、许可及原限制；统一名义半径不意味着日期、面积或事件样本已对齐。A/B板分开，B后1–3和后1–7不互补或相加。逐指标/区域对兼容、共同支持衍生、正式A/B成果接入、图表和真实比较仍在C02–C09验收；W接入另行验收。本批不部署生产。
