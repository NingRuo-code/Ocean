# data/ · 生成物（不要手改）

这些 `.js` 文件由脚本生成，页面用 `<script>` 直接引入（可离线双击打开，不需要本地服务器）：

| 文件 | 生成者 | 内容 |
|---|---|---|
| `meta.js` | `Ocean/backend/scripts/export_prototype_data.py` | 数据产品 / 许可 / 可用日期 / 缺什么 |
| `days.js` | 同上（每次导出都会重写） | 清单：已导出的锋面/海温日期（页面按它注入 `<script>`，加日期不用改 HTML） |
| `day/<日期>.js` | 同上（扫描 `data/raw/front/`，`--dates` 可指定） | 真实锋面：对象中心线、锋面带、冷暖侧、缺测掩码、质量统计 |
| `sst/<日期>.js` | 同上（扫描 `data/raw/sst/`，`--no-sst` 可跳过） | 真实海温：NOAA GHRSST 0.05° 逐日，按 0.5 °C 分箱的逐行游程 |
| `clim/same-period.js` | 同上（`--mode clim`） | 往年同期统计（唯一口径：front_present = 半径内线像元 > 0） |
| `base/basemap.js` | `tools/build-basemap.mjs` | Natural Earth 公有领域底图（陆地 / 海岸线 / 200 m·1000 m 等深线） |

```powershell
# 重新生成（在 Ocean/backend 下）
# ① 拉数据（Zenodo 按日期抽单日文件；海温走 NOAA CoastWatch ERDDAP 子集，免账号）
.\.venv\Scripts\python.exe scripts\fetch_zenodo_front_samples.py 2024-08-05 2024-08-06
.\.venv\Scripts\python.exe scripts\fetch_sst_samples.py 2024-08-05 2024-08-06
# ② 导出（扫 raw 目录里所有日期；海温自动跟着导出）
.\.venv\Scripts\python.exe scripts\export_prototype_data.py
.\.venv\Scripts\python.exe scripts\export_prototype_data.py --mode clim
# 底图（在本仓根目录）
node tools\build-basemap.mjs
# 校验
node tools\data-check.mjs
```

完整结构说明、字段含义、来源与许可见 [`../docs/data-schema.md`](../docs/data-schema.md)。
