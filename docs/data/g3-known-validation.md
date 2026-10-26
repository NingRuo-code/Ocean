# G3 V01：已知月成果的年份×季节小例

关联#142/#141，基线main `89405db097eb648de11b3245b7112e0941ed945b`。实施前记录：采用用户已确认的显式G3请求→既有受控实验入口→原A结果兼容读取→同身份候选表/分层证据接缝；独立手算H/E为预期，TDD在真实CLI与公开核心接口核对，不新增测试业务服务。

本批仅合成软件通路。P0#37/#38在已登记本地位置的真实源证据仍缺，不能关闭；#46/#47完整活动基线及现服资源证据仍缺。G3#142无实际前置，可以先开发其明确允许的已知小例，真实资格、科学冻结/接触/分区及推断仍按V02以后验收。

自建CC0单元输入显式经原A API生成被冻结月成果；正式G3读取不再运行A或旧逐行实验。固定124.5/30.2、20km，2023/2024及winter/summer标签，季节归属为日历年（12月不自动移到下一年）。候选含有效零、未知、缺成果及禁止公开的合成反例，全集保留。输入/请求/产物均有预算，沿用既有受控原子保存及只读回放。

仅在同一已登记几何/方法/单位且月份不重复时，按明确的已知H总和/同支持E总和给描述密度；不平均月密度，不把不合格或未知补零，不把A/B混池。所有结果标合成、非研究就绪、非确认性、独立性未评估；协议/分区只引用，不冒称已完成真实冻结。无区间、显著性、稳定性或渔获保证。

小例采用请求预先绑定的源/支持元信息身份，只组合这个严格已知源合同；版本/支持证据不同仍保留候选并拒绝混入。真实跨产品/跨版本的等价性判断留给后续冻结与复用切片，不能只凭单位同名放行。


## 使用

```powershell
node tools/run-front-response-experiment.mjs --g3-validation-request docs/data/g3-known-validation.example.json --input backend/app/examples/g3-known-snapshots.json --output outputs/experiments/g3-known-validation
node tools/run-front-response-experiment.mjs --read-g3-validation-result docs/reports/g3-known-validation-2026-10-26
python tools/build-g3-known-snapshots.py --check
```

执行要求输出目录尚不存在，不覆盖原输入/成功成果；只读命令只接受阅读目录，不能同时加输入/输出选项，不调用Python或读取源文件。失败有真实failed清单且不发布半成品；修改摘要/报告/条件会被现有字节及条件核对拒绝。内容身份用于完整性，不是授权签名。

生成器只在显式调用时，把仓内自建CC0单元输入送进已有A API并生成快照/请求示例，需后端开发依赖；G3读取无此生成步骤。声明公共聚合在逐项许可检查之后投影，未获准项只保留请求身份和原因，不含源值。支持全日历但有空间排除仍为partial，载入日历与计划日历分开。

[实际交付与剩余关口](../reports/ocean-g3-known-validation-implementation-2026-10-26.md)。

本批原字节证据目录在`.gitattributes`单独固定LF，保证Windows Git检出后仍可校验原哈希；实际检出/回放已列入CLI回归，不将其他文件改成相同换行规则。
