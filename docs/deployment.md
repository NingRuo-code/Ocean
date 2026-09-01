# 本地部署说明

## 环境

- Windows 10/11
- Python 3.12+
- Node.js 20+
- pnpm

## 数据目录

```text
data/raw/front/YYYY/front_locationYYYYMMDD.nc
data/raw/sst/YYYY/sst_YYYYMMDD.nc
```

第一阶段不需要下载完整 Zenodo 数据集，只需准备演示日期的逐日文件。

## 后端

```powershell
& <python> -m pip install -e backend
& <python> -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

## 前端

```powershell
cd frontend
pnpm install
pnpm run dev -- --host 127.0.0.1 --port 5173
```

生产构建：

```powershell
pnpm run build
```

## 数据准备与检查

生成数据清单：

```powershell
& <python> backend/scripts/build_data_manifest.py
```

查看下一步数据准备计划：

```powershell
& <python> backend/scripts/plan_data_preparation.py
& <python> backend/scripts/plan_data_preparation.py --reference-date 2024-08-05 --target-days 14 --output data/processed/data_preparation_plan.json
```

生成或查看 SQLite 元数据索引：

```powershell
& <python> backend/scripts/build_data_index.py
& <python> backend/scripts/build_data_index.py --summary-only
```

索引文件默认写入：

```text
data/processed/data_index.sqlite
```

它记录本地 front、SST、front_intensity 文件路径、日期覆盖、文件大小、重复日期和 front/SST 配对情况。运行时可通过 `/api/data/index` 查看总体状态，通过 `/api/data/index/{date}` 查看某日命中的本地文件。

规划跨年份同期历史样本，默认只 dry-run：

```powershell
& <python> backend/scripts/prepare_historical_samples.py --reference-date 2024-08-05 --year-start 1982 --year-end 2024 --window-days 3
```

小规模试跑可先限制日期数量：

```powershell
& <python> backend/scripts/prepare_historical_samples.py --limit-dates 6
```

确认网络、账号和磁盘空间后，才加入 `--execute-front` 或 `--execute-sst` 执行真实下载；如果下载后要立即刷新索引，可加 `--rebuild-index`。

检查重复 front/SST 文件，默认只 dry-run：

```powershell
& <python> backend/scripts/deduplicate_data_files.py
```

按日期从 Zenodo `front_location.zip` 抽取 front 文件：

```powershell
& <python> backend/scripts/fetch_zenodo_front_samples.py 2024-08-08 2024-08-09 --continue-on-error
```

## 离线约束

- 运行时只读取 `data/raw` 本地 NetCDF；
- 不使用在线底图、字体或 CDN；
- Copernicus 和 Zenodo 仅用于数据准备，不参与运行时请求；
- 未准备数据时，系统显示等待或无数据状态，不生成伪造科学数值；
- raster PNG 与历史统计缓存保存在 `data/cache`，可删除后自动重建；
- HTML 汇报报告由前端按需下载，不依赖外部模板或联网服务。
