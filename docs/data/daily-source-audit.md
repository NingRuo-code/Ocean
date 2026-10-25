# 逐日语义、有效支持与活动记录审计

关联 #37/#38，复用 #36 的来源身份、登记角色及私有定位。入口仍为 `tools/audit-research-baseline.mjs`；新增逐日模式不会下载数据、重建索引、改变展示文件或隐式运行研究分析。

## 运行与回放

先在同一授权小范围输入上生成 #36 快照与私有定位，再显式指定本次日期：

```powershell
node tools/audit-research-baseline.mjs --source-registry docs/data/source-registry.json --out data/processed/source-audit.json --private-out data/processed/source-locators.private.json
node tools/audit-research-baseline.mjs --daily-registry docs/data/daily-audit-registry.json --source-snapshot data/processed/source-audit.json --private-locators data/processed/source-locators.private.json --start 2024-08-05 --end 2024-08-07 --out data/processed/daily-audit.json --report-out data/processed/daily-audit.md --support-out data/processed/daily-support
node tools/audit-research-baseline.mjs --read-daily-snapshot data/processed/daily-audit.json
```

使用项目 Python ≥3.11 及已有 numpy/xarray/NetCDF依赖；需要时设置 `OCEAN_AUDIT_PYTHON` 为该解释器路径。直接回放仅校验冻结JSON身份，不重开登记、原档或有效掩码。内容校验不是数字签名或授权证明。修改源资料后需重新进行显式来源审计，不能继续沿用旧哈希。

公共JSON/Markdown不含实际原档定位、活动逐格坐标/小时或船舶身份。`--support-out` 中的NPZ包含掩码与实际坐标，属于本地加工资料，必须留在已忽略目录，不能直接提交或公开。文件名绑定输入内容、实际数组及坐标；使用它时仍须检查来源、日期、状态、单位和研究资格，不能只看文件存在。未传该选项时不生成几何支持文件。

## 如何解释结果

`parsed` 只表示这个格式的所选切片被成功解析；`unverified` 保留日期、编码等未核项；`conflict` 保留重复和不一致，不择一合并；`missing` 表示登记输入没有成功解析出的该日资料，具体缺口结合 `source_access/source_gaps/errors` 查看。每条证据带来源、文件逻辑ID、实际内容哈希，冻结快照还绑定配置、审计程序和所选日期范围。所有结果的 `research_ready/public_release_approved` 仍为false；许可、空间几何、有效面积与完整月资格由后续任务核定。

### 锋面与SST

- NetCDF读取原始存储值，显式记录CF时间单位、日界、日内容与文件名。标准公历按UTC逐时次分日；不把界面时区套到产品。无效CF时间可保留文件名推断日期，但明确未核实。跨日容器分别列项，同日多时次不自动合成单一日观测。
- 从实际坐标报告端点、步长、单调/规则情况，保留降序。坐标样本、声明窗口与像元边界不混为一谈；没有边界变量证据时不声称格边或有效面积已确定。复杂/曲线网格等未支持格式会记录失败，不替换成默认bbox或0.05°。
- SST依据文件明确单位进行摄氏/开尔文转换，保留缩放、偏移、填充值和原存储值有效范围。未知单位不靠数值大小猜测。附加质量掩码须在登记配置中明确变量和允许值，其产品含义仍需复核，工具不会自行猜海陆/冰/云编码。
- 尚未支持的 `_Unsigned` 编码明确记录文件级错误，不输出错误的摄氏温度；需要支持该产品时应连同填充值和范围属性域独立验收。文本输入先核内容日再筛日期窗口，文件名落在窗口外也不能隐藏内容错配。可选对象为null表示未知，错误类型记录文件级错误并继续其他来源。
- 原始锋面冷暖侧与锋面线由文件 `flag_values/flag_meanings` 解释；缺含义时保持未知，不把固定编码强行套给另一产品。未知侧别不补冷/暖，未检出与缺测分开，也不使用F编号作为跨日身份。
- 前端JS仅解析已知模块的JSON赋值，不执行JavaScript。RLE越界、重叠、掩码矛盾、声明计数不一致均保留失败/冲突。显示掩码标为 `display_mask_only`；SST分档温度不能当作未分档原值，导出日期也不替代原始时间坐标。

### 表观捕捞活动

- 支持显式选择的JSON日网格或CSV记录；字段名可在登记中指定。JSON使用数值型小时，CSV按明确字段解析。显式有限非负0保留为报告零，空值、缺字段、非数、负值、坏坐标分别计数。多船累计超过24小时有效，不自动判错。
- 单位必须来自文件明确声明；CSV缺项或混合单位、JSON顶层与source单位矛盾不能被配置回退确认为小时，冲突亦不能参加守恒比较。
- 无有效记录时总量为null，不能把空列表的数学和0当成有效零观测。无记录、未知覆盖、非空记录分布和声明支持域分别处理，不铺零补全网格。只有来源显式声明稀疏缺格为零、完整域及证据时才保留该声明；本工具仍不实际填零或批准完整覆盖。
- 同格同日重复会冲突，有效分析总量保持未知；原有效记录小时和与“逐格取最大”的反事实诊断分开，后者不当分析结果。现有 `backend/app/fishing_effort.py` 中的最大值栅格化、邻格查找及默认粒度属于后续消费合同核对点，本审计不调用这些默认逻辑。
- 0.01°来自既有ADR要求；实际取得粒度与此比较。0.1°会明确阻塞目标，缺字段不默认0.1°；声明0.01°本身也不证明精度、来源或覆盖已达标。邻格匹配如有声明，会保留其策略及偏移声明，并明确不是目标格直接观测；不会从无匹配元信息的资料推测其查找历史。
- 只有明确同源 `scope_id`、同日、无重复/异常且单位/时间明确的源与展示记录，才比较观测记录总和；范围未经同一性登记、真源缺失或不可比时为 `not_verified`。这项守恒不证明完整海域覆盖，也不代替真实加工链复核。

## 边界与复核

每次日期窗口最多367日，文本输入每文件16MiB，所选NetCDF切片最多200万值；超过预算记录原因，需选择有授权的小范围，不能静默截取。读原档前比对 #36 内容身份，日期范围外的NetCDF时次只保留时间证据、不生成观测支持。来源配置只引用已登记身份，输出不可覆盖输入或相互重叠。

测试：`python -m pytest tools/tests/test_daily_source_audit.py -q`。手算小例覆盖原始掩码、降序坐标、打包温度/单位、跨日/无效时间、重复、JS/RLE、活动零/异常/大于24小时、CSV、守恒及冻结回放。合成数据只证明软件行为；真实本地三日报告另列，不能当完整月、原档或许可通过证据。
