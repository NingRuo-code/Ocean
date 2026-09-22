# GFW/AIS 真实授权样例接入清单

> 适用范围：Ocean P1 的 Front Response Table 真实/授权样例接入。
> 维护目的：在接入 GFW/AIS apparent fishing effort 前，先锁定数据来源、许可、字段、粒度、公开边界和本地处理规则。
> 最近复核：2026-09-22。

## 1. 接入目标

本清单只服务于一个目标：把真实或授权的 AIS/GFW apparent fishing effort 样例安全转换为 `data/front_response/events.js`，用于“历史 AIS 响应”证据块和研究验证。

它不用于：

- 接入原始 AIS 船轨。
- 发布 MMSI、船名、轨迹点或可逆推出船级活动的数据。
- 把 fishing hours 解释成渔获量、产量、收益、鱼群密度或保证性作业结果。
- 让 AI 补全或生成缺失的 scientific values。

当前仓库默认仍使用 `synthetic_fixture`。真实样例到位前，所有页面和报告都必须继续说明 fixture 只用于验证契约和 UI 路径。

## 2. 允许的数据来源路线

| 路线 | 可接入条件 | 默认用途 | 提交边界 |
|---|---|---|---|
| GFW public apparent fishing effort | 已确认 attribution、license、caveat、非商业/公开展示范围 | 本地验证、课堂/论文方法演示、聚合统计报告 | 只提交经复核的不可逆聚合结果；不提交 raw/API 原始响应 |
| 合作方 AIS 衍生表 | 授权文件明确允许用于本项目；字段已脱敏、聚合，且不含船级可识别信息 | 本地验证、合作范围内报告 | 按授权范围决定是否提交聚合结果；默认不提交源表 |
| 本地 synthetic fixture | 标注 `is_synthetic = true`，不冒充真实证据 | 契约、UI、回归检查 | 可以提交 |

若来源、授权范围或公开边界不明确，结论是 **no-go**：只能保留脚本、清单和本地处理记录，不能把数据产物提交到 Git。

## 3. 本地目录约定

真实/授权样例在本机处理时建议使用以下目录；这些目录不得进入 Git：

```text
local_data/
└── gfw_ais/
    ├── downloads/              # API 下载包、原始 CSV/JSON、人工拿到的源文件
    ├── raw/                    # 解压后的 raw 或近 raw 文件
    ├── intermediate/           # 0.01° 工作网格、buffer 前的细粒度中间表
    └── authorized_aggregate/   # 已脱敏/聚合的本地输入，仍需复核后才可用于生成提交物
```

`downloads/`、`raw/`、`intermediate/` 默认禁止提交。`authorized_aggregate/` 也默认只本地保存；只有在确认不可逆推出源数据、许可允许公开、并且完成本文档 checklist 后，才可以把由它生成的 Front Response Table 作为 `real` 状态进入仓库。

## 4. 最小输入字段

真实或授权样例输入给 `tools/build-front-response.mjs --input <本地授权样例>` 前，应整理成事件级/半径级聚合 JSON。输入必须使用 `front-response-input/v1`，并至少包含以下字段。

### 4.1 来源与授权

```json
{
  "schema_version": "front-response-input/v1",
  "status": "real",
  "is_synthetic": false,
  "source": {
    "kind": "gfw_public",
    "attribution": "Global Fishing Watch",
    "license": "CC BY-NC 4.0 or confirmed project-specific license",
    "accessed_at": "2026-09-22",
    "caveat": "Apparent fishing effort is estimated from AIS behavior and is not catch, production, biomass, revenue, or guaranteed fishing result.",
    "authorization_scope": "local research/classroom/non-commercial demo",
    "public_display_scope": "aggregate figures only; no raw or reconstructable grids"
  }
}
```

`source.kind` 只能使用：

- `gfw_public`
- `partner_ais_derivative`

`synthetic_fixture` 只能用于测试夹具，不能用于真实样例。

### 4.2 时间窗口

```json
{
  "time_window": {
    "sample_start": "2024-07-01",
    "sample_end": "2024-08-31",
    "pre_window_days": 7,
    "post_window_days": [1, 3],
    "exploratory_window_days": [-7, 7]
  }
}
```

P1 默认解释窗口是锋面事件后 1-3 天；前后 7 天只作为研究/人工复核窗口，不替代默认增强判定。

### 4.3 空间窗口与对照区

```json
{
  "spatial_window": {
    "region": "East China Sea prototype window",
    "bbox": [120, 27, 128, 34],
    "buffer_km": [10, 20, 30],
    "control_min_distance_km": 50,
    "control_area_ratio": 1,
    "control_sampling": "same-day same-area non-front cells outside every 50 km front exclusion buffer"
  }
}
```

真实样例生成 `enhanced_flag` 前，必须已经完成非锋面对照区的地理校验：同日、同海区、离任一锋面至少 50 km，并记录采样口径。若对照区无法校验，只能输出 `missing_coverage` / `not_in_sample` / `not_authorized`，不能输出增强判定。

### 4.4 指标与处理口径

```json
{
  "processing": {
    "metric": "apparent_fishing_effort",
    "unit": "fishing_hours",
    "front_id_scope": "local_day",
    "control_validation": "validated before conversion with 50 km exclusion against all same-day front objects",
    "enhancement_rule": "post1_3_hours >= pre7_hours * 1.2 and post1_3_hours > non_front_control_hours"
  }
}
```

`front_id_scope = "local_day"` 是必要边界：`F001` 只表示某一天导出数据里的本地临时锋面对象，不表示跨天追踪出的同一条长期锋面。

### 4.5 公开边界

```json
{
  "public_boundary": {
    "raw_committed": false,
    "fine_grained_committed": false,
    "public_display": "aggregate response table only after authorization review",
    "note": "Do not publish raw AIS/GFW, 0.01 degree working grids, vessel identifiers, tracks, or reconstructable source data."
  }
}
```

`public_boundary` 是转换脚本的必填字段。真实样例提交前必须确认它与来源授权一致。

### 4.6 事件级聚合

以下数值只用于说明输入结构，不是真实 AIS/GFW 证据，也不能被复制到报告或 UI 中当作结论。真实数值必须由本地授权数据处理流程和确定性脚本产生。

```json
{
  "front_events": [
    {
      "date": "2024-08-05",
      "front_id": "F001",
      "buffers": {
        "10": {
          "pre7_hours": 31.2,
          "post1_3_hours": 34,
          "non_front_control_hours": 28.7
        },
        "20": {
          "pre7_hours": 42.5,
          "post1_3_hours": 57.8,
          "non_front_control_hours": 36.4
        },
        "30": {
          "status": "missing_coverage",
          "reason": "coverage below threshold for this buffer"
        }
      }
    }
  ]
}
```

每个 `front_event` 必须覆盖 10 / 20 / 30 km 三档 buffer。覆盖不足也要显式写成不可用状态，不能省略某一档，也不能把缺测写成 `0 fishing hours`。

## 5. 禁止进入 Git 的内容

- 原始 AIS 船轨。
- MMSI、船名、呼号、IMO、单船轨迹点或能识别船舶的信息。
- GFW API 原始响应、下载包、原始 CSV/JSON。
- 日尺度 0.01° apparent fishing effort 工作网格。
- buffer 计算前的细粒度中间表。
- 可以逆推出源数据的分区、分船、分小时、过细空间粒度统计。
- 授权范围不清楚的合作方数据。

## 6. 提交 go / no-go

| 产物 | Go 条件 | No-go 条件 |
|---|---|---|
| `data/front_response/events.js` real 状态 | 只含事件级/半径级聚合；source/license/attribution/caveat 完整；不可逆推出 raw；缺测为 unavailable | 含 raw、细粒度网格、船级信息、授权不清、缺测被写成 0 |
| 验证报告/图 | 只展示聚合统计、窗口、对照和方法边界 | 展示原始轨迹、细粒度热力图、船级活动或把 effort 写成产量 |
| 数据说明/README | 明确 apparent fishing effort、fishing hours、非商业/授权边界、coverage caveat | 暗示真实渔获、收益、保证结果或 AI 生成数值 |
| 本地授权输入 JSON | 默认只在 `local_data/gfw_ais/authorized_aggregate/` 保存 | 未复核就提交，或字段不足以追溯来源和授权 |

## 7. 接入流程

1. 确认来源、授权和公开展示范围，记录到本清单或同级接入记录中。
2. 将 raw/API/download 文件放入 `local_data/gfw_ais/downloads/` 或 `local_data/gfw_ais/raw/`。
3. 在本地完成 0.01° 工作网格、front buffer、非锋面对照区和 coverage 检查。
4. 只把事件级/半径级聚合输入保存到 `local_data/gfw_ais/authorized_aggregate/`。
5. 使用转换脚本生成前端响应表：

```powershell
node tools\build-front-response.mjs --input local_data\gfw_ais\authorized_aggregate\<sample>.json --output data\front_response\events.js
```

6. 检查 `events.js` 的 `status`、`source`、`public_boundary`、`method.control_validation` 和不可用状态。
7. 运行校验：

```powershell
node tools\data-check.mjs
node tools\e2e-check.mjs
node tools\layout-check.mjs
```

8. 只有在全部通过并确认 go 条件后，才允许提交生成物。

## 8. 审核清单

- [ ] 已确认数据来源和授权范围。
- [ ] 已记录 attribution、license、accessed_at、authorization_scope、public_display_scope。
- [ ] 输入只包含事件级/半径级聚合，不含 raw、MMSI、船名、轨迹或细粒度网格。
- [ ] 非锋面对照区完成 50 km 排除校验，并记录 control_validation。
- [ ] 10 / 20 / 30 km 三档 buffer 都有记录；缺失档位使用不可用状态占位。
- [ ] missing coverage / unavailable 没有被写成 0。
- [ ] `metric = "apparent_fishing_effort"` 且 `unit = "fishing_hours"`。
- [ ] UI、报告和说明没有“产量预测”“收益预测”“保证有鱼”等越界措辞。
- [ ] `node tools\data-check.mjs` 通过。
- [ ] `node tools\e2e-check.mjs` 通过。
- [ ] `node tools\layout-check.mjs` 通过。

## 9. 通过标准

完成本清单后，仓库应保持三条边界：

1. 产品层只说“作业线索 / 历史 AIS 响应 / 响应增强”，不说产量或收益预测。
2. 技术层只把 AI 放在证据组织位置，fishing hours、lift 和 enhanced flag 由确定性脚本产生。
3. 数据层不提交 raw、细粒度或可逆推出源数据；真实样例只以可复核、不可逆的 Front Response Table 聚合结果出现。
