# 02: 让 Front Response Table 契约可执行

**What to build:** 定义并验证 front response event 的最小数据形态，覆盖 `not_available`、缺日期、缺范围、真实响应记录。用一个小型夹具样例打通 `OFData.frontResponse(...)` 到当前页“历史 AIS 响应”卡片，证明数据入口能工作。

**Blocked by:** 01: 锁定 P1 AIS/GFW 数据输入与公开边界.

**Status:** done

- [x] 定义 event-level response 的最小字段：事件身份、日期、本地锋面 ID、buffer 半径、前后窗口 effort、对照区 effort、lift、enhanced flag、status。
- [x] 保持 local front ID 是项目内临时 ID，不暗示长期锋面轨迹。
- [x] `not_available` placeholder 仍能正常驱动 UI 空态。
- [x] 小型夹具能驱动 UI 展示“响应增强/无明显增强”和展开明细。
- [x] 更新项目执行记录，补充 Front Response Table 的字段解释和面试追问口径。

**Implementation note:** `data/front_response/events.js` now uses `schema_version = "front-response/v1"` with `status = "synthetic_fixture"`. `OFData.frontResponse(...)` normalizes records for the current-page card and keeps missing date/range states explicit.
