# Ocean 服务器接入规划

> 适用范围：Ocean 后续从离线静态原型扩展到服务器辅助数据更新、处理和 artifact 发布。
> 当前状态：S1 契约入口已建立。真实服务器未接入，当前原型仍可离线运行。
> 最近复核：2026-09-23。

## 1. 服务器在项目中的角色

服务器不是用来替代当前离线原型，也不是让前端直接访问原始数据。服务器的职责是把“找数据、下载、处理、校验、发布 artifact”这一串流程集中管理。

服务器应承担：

- 数据源登记：记录锋面、SST、GFW/AIS、合作方样例等来源、许可、更新频率和访问方式。
- 数据拉取：按日期范围手动或定时拉取数据。
- 本地处理：在受控目录中生成 raw、intermediate 和 authorized aggregate。
- Artifact 发布：只把通过校验、不可逆推出 raw 的前端 artifact 暴露给原型页面。
- 运行观测：记录任务状态、失败原因、缺失日期、artifact 版本和回滚信息。

服务器不应承担：

- 向前端暴露 raw AIS/GFW、MMSI、船名、轨迹或 0.01 度工作网格。
- 让 AI 直接生成 fishing hours、lift、enhanced flag 或科学数值。
- 绕过 `docs/gfw-ais-real-sample-intake.md` 的真实样例 go/no-go。
- 把 missing coverage 解释为 zero fishing activity。

## 2. 分阶段接入策略

### S0：保持离线静态原型

当前状态仍是 S0：页面读取仓库内静态 `.js` artifact，可离线双击打开。这个能力必须保留，因为它适合课堂展示、答辩和无网络环境演示。

验收：

- 不配置服务器时，`prototype-fishing.html` 仍能使用本地 `data/` 文件运行。
- `data-check`、`e2e-check`、`layout-check` 不依赖服务器。
- 服务器接入失败时，页面降级到本地静态数据。

### S1：本地服务器作为数据处理桥

第一步不做复杂部署，只让本地服务器或后端脚本负责下载和处理数据，再输出前端可读 artifact。

目标：

- 将锋面、SST、GFW/AIS 样例的数据拉取和处理流程统一管理。
- 明确 raw、intermediate、authorized aggregate、public artifact 的目录边界。
- 只发布通过校验的 artifact。

当前已完成的 S1 契约入口：

- `server_data/README.md`：说明服务器侧目录边界和禁止提交的数据类型。
- `server_data/sources/sources.example.json`：数据源登记表示例，覆盖 Zenodo 锋面、锋面强度 planned source、NOAA SST、GFW/AIS apparent fishing effort planned source。
- `server_data/public_artifacts/artifact-manifest.example.json`：前端可读 artifact manifest 示例，覆盖图层状态、source 引用、公开边界和 caveat。
- `tools/data-check.mjs`：已校验上述示例，不允许 manifest 指向 raw/intermediate/轨迹类路径，也要求 GFW/AIS 继续使用 apparent fishing effort / fishing hours 口径。

建议目录：

```text
server_data/
├── sources/                 # 数据源登记表和 manifest
├── raw/                     # 原始下载文件，禁止进入 Git
├── intermediate/            # 0.01° 工作网格和空间处理中间表，禁止进入 Git
├── authorized_aggregate/    # 事件级/半径级聚合输入，默认不进入 Git
├── public_artifacts/        # 通过校验后可给前端读取的产物
└── logs/                    # 任务记录、错误和审计日志
```

### S2：内部数据服务器

当真实授权样例和多事件统计稳定后，可以将 S1 迁移到内部服务器。

目标：

- 支持定时检查数据源是否有新日期。
- 支持人工审核后发布 artifact。
- 支持前端通过 manifest 读取最新可用日期和图层状态。
- 支持回滚到上一版 artifact。

### S3：业务化服务器

只有在真实业务数据、权限、部署环境和长期维护机制明确后，才进入 S3。

目标：

- 多用户访问和角色权限。
- 后台任务队列。
- 数据版本管理。
- 服务器监控和告警。
- 内部部署或专网部署。

## 3. 数据流规划

推荐数据流如下：

```text
数据源
  -> source registry
  -> pull job
  -> raw / downloads
  -> intermediate processing
  -> authorized aggregate
  -> validation gate
  -> public artifacts
  -> frontend manifest / static data
```

关键原则：

- raw 和 intermediate 只在服务器受控目录中存在。
- authorized aggregate 仍需审核，默认不公开。
- public artifacts 必须通过数据契约检查。
- 前端只读取 public artifacts 或 artifact manifest。
- 任何不可用状态都输出 unavailable，不输出 0。

## 4. 服务器数据源登记表

服务器接入前，应先建立 `sources.json` 或等价登记表。

建议字段：

| 字段 | 含义 |
|---|---|
| `source_id` | 数据源唯一标识，例如 `zenodo_front_location`、`noaa_sst`、`gfw_effort_public` |
| `source_type` | `front`、`sst`、`gfw_ais_effort`、`partner_ais_derivative` |
| `license` | 许可和署名要求 |
| `credential_mode` | `none`、`env_token`、`server_secret` |
| `update_cadence` | 手动、每日、每周或按需 |
| `date_coverage` | 可用日期范围 |
| `spatial_coverage` | 空间范围 |
| `raw_retention` | raw 保留策略 |
| `public_display_boundary` | 可公开展示边界 |
| `caveat` | 解释限制 |

## 5. Job 记录规划

每次服务器运行都应生成 job record，便于复盘和调试。

建议字段：

| 字段 | 含义 |
|---|---|
| `job_id` | 任务 ID |
| `job_type` | `pull`、`process`、`validate`、`publish`、`rollback` |
| `source_id` | 对应数据源 |
| `date_range` | 处理日期范围 |
| `started_at` / `finished_at` | 运行时间 |
| `status` | `success`、`failed`、`partial`、`skipped` |
| `error` | 失败原因 |
| `input_paths` | 输入路径，日志中不得暴露 token |
| `output_artifacts` | 输出 artifact |
| `validation_summary` | 校验摘要 |

## 6. Artifact Manifest 规划

前端不应猜测服务器有哪些数据，而应读取 manifest。

建议字段：

```json
{
  "schema_version": "ocean-artifact-manifest/v1",
  "generated_at": "2026-09-22T00:00:00Z",
  "latest_available_date": "2024-08-31",
  "layers": {
    "front": {
      "status": "real",
      "available_dates": ["2024-08-05"]
    },
    "sst": {
      "status": "real",
      "available_dates": ["2024-08-05"]
    },
    "front_response": {
      "status": "synthetic_fixture",
      "metric": "apparent_fishing_effort",
      "unit": "fishing_hours",
      "caveat": "Not catch, production, revenue, biomass, or guaranteed result."
    },
    "front_intensity": {
      "status": "not_available",
      "reason": "Intensity archive not connected yet."
    }
  }
}
```

## 7. API 或静态发布方式

第一阶段建议优先采用“静态 artifact 发布”，降低复杂度。

### 方式 A：静态 artifact

服务器生成与当前 `data/` 目录兼容的 `.js` 或 `.json` 文件，前端读取 manifest 后加载对应静态文件。

优点：

- 与当前离线原型兼容。
- 容易回滚。
- 不需要复杂接口设计。

限制：

- 不适合高频交互式查询。
- 需要明确缓存和版本。

### 方式 B：受控 API

服务器提供只读 API，例如：

```text
GET /api/artifacts/manifest
GET /api/front-response?date=2024-08-05&range_km=20
GET /api/layers/front?date=2024-08-05
GET /api/jobs/recent
```

要求：

- API 只返回 public artifact 或聚合统计。
- API 不返回 raw、MMSI、轨迹或 0.01° 工作网格。
- API 返回缺测时必须使用 unavailable 状态。

## 8. 凭据与权限

- GFW/API token、合作方凭据、服务器地址和内部路径必须放在服务器环境变量或本地 `.env`。
- `.env` 不进入 Git。
- 运行日志不得打印 token。
- restricted 或 partner 数据源必须有单独的 `authorization_scope`。
- 发布到 public artifacts 前必须经过人工或脚本化 go/no-go。

## 9. 前端降级策略

服务器接入后，前端仍需支持三种状态：

1. **离线静态模式**：只读取仓库 `data/`。
2. **服务器增强模式**：读取服务器 manifest，并加载更新 artifact。
3. **服务器不可用模式**：回退本地静态数据，并显示服务器不可用或数据未更新。

禁止行为：

- 服务器不可用时显示 0。
- 服务器不可用时输出“无响应”。
- 服务器缺少某层时用 synthetic fixture 冒充真实数据。

## 10. 与后续 tickets 的关系

服务器接入应服务以下任务：

- Issue 14：每日数据更新与自动抓取机制。
- Issue 18：服务器接入边界与数据源登记表。
- Issue 19：服务器端数据拉取任务。
- Issue 20：服务器端处理工作区与 artifact 发布。
- Issue 21：前端读取服务器 artifact 的接口。
- Issue 22：服务器凭据与权限管理。
- Issue 23：服务器运行观测与人工复核入口。

服务器接入不应绕过以下文档：

- `docs/data-governance-gfw-ais.md`
- `docs/gfw-ais-real-sample-intake.md`
- `docs/data-schema.md`
- `docs/project-grilling/ocean-p1-execution-notes.md`

## 11. 第一版推荐实现顺序

1. 新增 `server_data/` 本地目录约定，并加入 Git 忽略。
2. 编写 `sources.json` 示例，只登记已有 Zenodo front、NOAA SST、GFW/AIS planned source。
3. 编写 artifact manifest 示例，明确可公开图层、不可用图层、planned 图层和 fallback 规则。
4. 把 source registry 与 artifact manifest 纳入 `node tools/data-check.mjs`。
5. 编写手动 pull job，不做自动发布。
6. 编写 process job，将授权聚合输入转为 public artifacts。
7. 编写 validate job，复用现有数据契约检查。
8. 编写 manifest 生成脚本。
9. 前端增加可选 server manifest 读取，不可用时回退本地数据。
10. 增加 jobs/recent 或本地日志查看入口。

## 12. 阶段验收

服务器接入第一版完成时，应满足：

- 不配置服务器时，现有离线原型不受影响。
- 配置服务器时，前端能读取 manifest 并显示数据新鲜度。
- 服务器端 raw/intermediate 不会进入 Git。
- 发布 artifact 前必须通过校验。
- 服务器失败不产生假数值。
- 文档清楚说明服务器只负责数据更新和 artifact 发布，不改变 AI 与数值计算边界。
