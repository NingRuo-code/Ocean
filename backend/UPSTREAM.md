# UPSTREAM —— backend 的来源与同步方式

本目录是**上游协作仓 `Ocean` 后端快照（vendor）**，不是本仓原创代码；改动前先读第 3 节的纪律。

| 项 | 值 |
|---|---|
| 上游仓库 | `https://github.com/NingRuo-code/Ocean` |
| 上游分支 | `chore/collab-baseline` |
| 快照 commit | `05f8a19`（chore: add collaboration baseline (CI, templates, contributing guide)） |
| 快照日期 | 2026-09-21 |
| 已复制 | `backend/app/`、`backend/scripts/`、`backend/tests/test_api.py`、`backend/pyproject.toml` |
| 未复制 | `.venv/`、`__pycache__/`、`.pytest_cache/`、`.ruff_cache/`、`*.egg-info/`（环境与缓存，本地重建即可） |

> 上游仓未附 LICENSE 文件。本目录仅用于课程项目内部集成，署名上游作者；若需对外分发，先与上游确认授权。

## 1. 本仓对上游快照做的改动

| 文件 | 改动 | 为什么（都是 2026-09-21 实跑时踩到的） |
|---|---|---|
| `pyproject.toml` | 新增 `[build-system]`（setuptools≥68）与 `[tool.setuptools] packages=["app"]` | 上游没有 `[build-system]`，pip 会退回 legacy 后端并**忽略 PEP 621 的 `[project]` 表** → 包能装上但依赖一个都不装；不加 `packages` 还会因 flat-layout 同时发现 `app` 与 `scripts` 而报错 |
| `pyproject.toml` | 新增依赖 `scipy>=1.13,<2`，并**刻意不引入 netcdf4** | ① SST 文件是 NetCDF-3 classic（文件头 `CDF\x01`），`h5netcdf` 只能读 HDF5，必须补一个能读 classic 的引擎；② `netcdf4` 的 C 库在 Windows 上打不开非 ASCII 路径（本仓位于中文目录），一旦安装会被 xarray 优先选中，导致 SST 与锋面**双双读不了**；`scipy` + `h5netcdf` 组合在两个平台上都可用 |
| `app/data_access.py` | `KELVIN_OFFSET` 常量；`load_sst_subset` 时间改为「取最近时刻，且相差 ≤ 1 天」；返回值**统一归一化成开尔文** | ① ERDDAP 子集的 `time` 是 12:00（卫星过境时刻），用 00:00 精确 `sel` 直接 KeyError，上游表现为「SST 文件不包含该日期」；② 该产品 `units=degree_C`，而调用方（main / main_analysis / history / front_objects / ai_agent）统一按 `- 273.15` 换算 —— 改 11 处调用点不如在数据边界归一化一次 |
| `app/history.py` | ① 新增 `_has_newer_netcdf`：sqlite 索引比数据旧时不拿它当指纹；② 新增 `_index_records_exist`：缓存索引与 sqlite 清单里的路径先核存在性再信任 | 数据被改名/删除而索引未重建时，旧清单会把**不存在的路径**带进请求链路（实测直接 500）。指纹只看大小与 mtime，抓不到改名 |
| `app/main.py` | 新增 `_align_combined_grids`，`kind=combined` 前先按经纬取两图交集再合成，并把 `X-Raster-Bounds` 回写成实际覆盖范围 | front 是全局 0.05° 网格，SST 只覆盖数据集裁剪窗口；大半径查询时形状不同（实测 `radius_deg=4` → front 160×160 vs SST 141×160），`render_combined_png` 里布尔索引直接 `IndexError` → 500 |
| `scripts/export_prototype_data.py` | 路径常量：`DEFAULT_RAW_DIR` / `DEFAULT_OUT_DIR` / `DEFAULT_SST_RAW_DIR`，以及生成物头部注释与 `meta.generator` | 适配新仓结构（`<仓根>/data/raw`、`<仓根>/frontend/prototype/data`），原值是按「两个平级仓库」写的 |

`app/**` 其余部分与上游逐字节一致，可用 `git diff` 核对。

## 2. 运行时目录（见 `backend/app/config.py`）

`PROJECT_ROOT = app/config.py 上两级 = <仓根>`，因此默认就是：

```text
<仓根>/data/raw         ← 环境变量 OCEAN_RAW_DATA_DIR 可覆盖
<仓根>/data/cache       ← 环境变量 OCEAN_CACHE_DIR 可覆盖
<仓根>/data/processed   ← SQLite 索引与清单（固定取 raw 的同级 processed）
```

服务器上只需设 `OCEAN_RAW_DATA_DIR=/srv/ocean/data/raw`、`OCEAN_CACHE_DIR=/srv/ocean/data/cache`，代码不改。

## 3. 与上游同步的纪律

1. **上游代码只在上游仓改**：本目录 `app/**` 视为只读镜像；发现 bug 先修 `Ocean` 仓，再同步过来。
2. 同步命令（按需，注意别覆盖本仓的路径改动）：
   ```powershell
   robocopy <Ocean>\backend <本仓>\backend /E /XD .venv __pycache__ .pytest_cache .ruff_cache ocean_front_backend.egg-info
   git --no-pager diff -- backend    # 逐条确认，尤其第 1 节那 4 处路径
   ```
3. 本仓特有改动清单就是第 1 节那张表；同步上游后必须逐条重新核对（尤其别把 `pyproject.toml` 的两处改动覆盖回去，否则服务器上会装不出依赖）。
