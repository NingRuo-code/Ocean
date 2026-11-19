## Parent

[规格 #72](https://github.com/NingRuo-code/Ocean/issues/72)。归属既有 [B #19](https://github.com/NingRuo-code/Ocean/issues/19) 与执行总纲 #13，复用 [实验 #9](https://github.com/NingRuo-code/Ocean/issues/9)；不替代、修改或关闭父级。

## What to build

研究者从同一B入口取得逐日锋面—固定区域状态与可审计事件清单，能解释进入、持续、退出、再次触发、多锋面、缺日和搜索期截断为何产生或不产生一个事件。

每项交付显式受控请求或同一计算适配到可读结果/证据的完整行为，并在本项核对独立小例与边界。复用现有实验、确定性服务及A/P0合同，不新建测试专用业务接口。合成测试、真实资格与实证分开记证；不提交原始AIS、受限细网格、凭据或私人路径。

规格用户故事：1、3、4、5、6、7、8、9、10、11、12、34。

## Acceptance criteria

- [ ] 消费A/#62已验证的源适配、地理距离/面积、公里圆与共同支持合同；记录固定区到锋线的具体空间关系、搜索支持及容差，不重写P0几何或拿显示限点作研究真源。
- [ ] 先形成每日满足/未满足/未知的观测状态，再执行有版本的阈值、持续、合并、退出、再次触发和去抖规则；候选选择只依赖锋面及预登记质量条件，不看活动峰值或响应方向。
- [ ] 锚日由规则决定的首次合格观测确定，0日含义可查；日尺度不声称精确小时级进入，不依据活动峰值移动日期。
- [ ] 缺测不当退出，缺口后首见不自动当新进入；记录连续性不确定与分段关联，搜索期首日已存在/末日未退出及缺上下文分别标截断，不伪造事件起止。
- [ ] 搜索期限定锚日，额外上下文长度由进入/退出/再触发规则决定，实际读取范围可查；不默认前后7日足够证明连续性，也不把范围裁切结果当完整事件。
- [ ] 多锋面按固定区暴露事件处理并保留当日对象关系/歧义，每日F编号重排不拆新事件；同日小时不因对象重复累计，已有追踪仅作观测核对，不宣称物理生命周期身份。
- [ ] 记录固定区相对ADR-0001既有锋面缓冲的几何扩展澄清，保留旧结果口径及0.01°分析目标，不静默替换研究源或混合两种估计对象；输出所有候选、合并和排除理由。
- [ ] 从受控请求到事件结果，用独立日历/解析几何验证连续段、再进入、编号重排、多锋面、缺日、左右截断及无事件；观测不足与充分观测的无事件必须分开。

## Blocked by

- #73 (https://github.com/NingRuo-code/Ocean/issues/73)
- #62 (https://github.com/NingRuo-code/Ocean/issues/62)

## 实施记录 · 2026-11-19

延续 `tools/run-front-response-experiment.mjs --fixed-region-request` 执行入口。注册合成输入使用 `observed-fixed-exposure/v1` 方法与 `front-continuity/v1` 参数。它们绑定固定 WGS84 公里圆、原输入字节和观测规则版本。原 B01 小例和旧移动缓冲报告使用各自原口径，固定海域术语见 [ADR-0002](../../adr/0002-hold-the-event-study-region-fixed.md)。

距离为固定圆至最接近已观测锋线的距离。实现使用 A 的 WGS84 线采样、日观测支持、距离上下界和位置误差，在接近和远离阈值之间保留过渡态。阈值、连续近距离天数和确认退出所需的连续远离日由合成夹具显式登记。锚日是首次合格日观测，跨缺口保留不确定的分段联系，连续远离未满足时保留合并记录。日内对象编号可变化，固定海域观测按空间关系归入事件。

以下 PowerShell 命令复现自有 CC0 样例。运行型 Python 需要既有 A 几何分析依赖。命令生成新的独立输出目录，读取命令使用冻结成果。

```powershell
$source = 'tools/examples/b02-front-continuity.json'
$id = 'sha256:' + (Get-FileHash $source -Algorithm SHA256).Hash.ToLowerInvariant()
$tag = [guid]::NewGuid().ToString('N')
$request = "tmp/b02-request-$tag.json"
$output = "tmp/b02-result-$tag"
@{purpose='fixed_region_event_example'; longitude=0; latitude=0; radius_km=10;
  search_start='2024-08-31'; search_end='2024-08-31'; input_version=$id;
  method_version='observed-fixed-exposure/v1'; parameter_version='front-continuity/v1'} |
    ConvertTo-Json -Compress | Set-Content -Encoding ascii $request
node tools/run-front-response-experiment.mjs --fixed-region-request $request --input $source --output $output
node tools/run-front-response-experiment.mjs --read-fixed-region-result $output
```

样例锚日为 `2024-08-31`，实际观测范围为 `2024-08-29` 至 `2024-09-02`，退出证据不足，记录右截断。该路径交付观测与候选清单。跨月活动窗口资格沿 #75，真实前后资料与冻结方案沿 #83 验收。
