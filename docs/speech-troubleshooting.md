# 录音与评分排错指南

适用于本项目当前实现。账号、部署、存储和定时器的操作入口见[录音功能操作指南](speech-operations.md)。

## 先收集一条准确错误

1. 记下出错时间、所在题目、当前档案 ID，以及错误发生在「开始录音」「停止后评分」「保存」「回放」哪个阶段。
2. 在课程里展开 **Scores for grown-ups**，记录 **Service code**。如果是保存提示而没有错误码，也记录屏幕文字。
3. 打开 **云开发 → 云函数 → speech-evaluate → 日志**，查看对应时间的调用详情。若排查定时清理，改看 `speech-cleanup`。
4. 提取错误名称、错误描述，以及类似下面这行日志：

   ```text
   SUSU_SPEECH_ERROR {"stage":"save","code":"DATABASE_ERROR"}
   ```

函数启动异常可能只有平台的错误堆栈，不出现 `SUSU_SPEECH_ERROR`。提供这部分即可，不必复制整个请求或环境变量；排错不需要录音 Base64 或 SecretKey。

## 看不到 Record

录音只对获准账号、已接入评分的活动显示。目前试点是「穿衣与整理」的 19 个活动，不是所有英语课程都有录音。

1. 打开 **家长录音设置 → 刷新权限**，确认已开通且档案正确。
2. 未开通时，按申请码在 `speech_family` 检查 `enabled` 是布尔值 `true`，`learnerId` 是有效字符串。
3. 设置页本身报错时先查云函数调用，不能仅通过隐藏的按钮认定账号被撤销。
4. 已开通但没有入口，退出再进试点课程，确认小程序与 `speech-evaluate` 都已更新。课程目标有改动时，需要同步构建和部署清单；不要只改线上 JSON。

## 点 Record 没有麦克风授权弹窗

开始录音前会先检查账号、取得家长同意和预约额度，前面失败时不会走到麦克风授权。已经授权过的设备也不一定再次弹窗。

- 先查看页面错误码，排除权限档案和云调用错误。
- 出现 `PERMISSION` 时，点击 **Microphone settings**，检查微信的小程序录音权限及系统对微信的麦克风权限，再重新进课。
- 家长选择暂不使用后，仍可以听读学习；要录音可再次点 Record。
- `CONSENT_DIALOG` 表示家长确认弹窗没有成功打开。当前按钮文案已控制在微信允许的长度内，应先确认客户端代码已经更新。

## 常见 Service code

| 代码/现象 | 含义与下一步 |
| --- | --- |
| `NETWORK` / We could not connect | 客户端没有成功拿到云函数响应；可能是网络、部署缺失、函数启动异常或平台超时。按下节查日志，不能直接归因于存储 |
| `TIMEOUT` | 等待超时。先重新进入题目查看历史成绩和保存录音，再查对应调用是否完成；不要连续重录排查 |
| `DATABASE_ERROR` / Scores could not be saved | 数据库读写阶段失败。根据日志 stage 检查集合、写入错误或事务问题；不能据此认定没有开通云存储 |
| `STORAGE_NOT_CONFIGURED` | 先确认存储客户端权限已设为私有，再检查 `speech-evaluate` 的 `SPEECH_STORAGE_PRIVATE=true` |
| `FAMILY_ONLY` | 未批准、被撤销，或请求处理期间档案绑定发生变化；刷新家长设置，检查当前账号记录 |
| `UNAUTHORIZED` | 身份或 attempt 不匹配；档案切换后不能继续提交旧档案的录音。重新进课录制 |
| `DISABLED` | `speech-evaluate` 的 `SPEECH_ENABLED` 没有设为 `true` |
| `CONFIGURATION_ERROR` | 检查 SOE 数字 AppID 和两个密钥变量是否完整，不使用微信 `wx…` AppID |
| `SERVICE_NOT_ENABLED` | 检查密钥所属腾讯云账号是否开通「智聆口语评测（新版）」所需能力；避免开通账号和密钥账号不同 |
| `PROVIDER_AUTH` | 腾讯评分鉴权失败，检查 SOE AppID、SecretId、SecretKey 是否同属正确账号 |
| `RESOURCE_EXHAUSTED` | 评测资源不足，去对应腾讯云账号检查资源包/额度 |
| `ACCOUNT_OVERDUE` | 对应服务账号欠费，先处理账单 |
| `PROVIDER_BUSY` | 供应商暂时繁忙，稍后再试 |
| `DAILY_LIMIT` | 当前档案或环境当天预约次数已用完。限额按北京时间计算，取消和无效录音也占预约额度；仍可听读 |
| `TOO_FAST` | 两次预约间隔不足三秒，稍等再试 |
| `NO_SPEECH` / `INVALID_AUDIO` | 录音太短、没有可评测声音或格式不合要求；清晰读完再停止，检查真机麦克风 |
| `ATTEMPT_EXPIRED` | 预约已过期或已处理，重新录音，不复用旧录音请求 |
| `NO_RECORDING` | 当前档案/课程版本/题目还没有可回放的正式录音，或对应正式记录不可用 |
| `STORAGE_ERROR` | 云回放读取或校验失败；查正式文件与记录是否一致，不把存储改为公有读 |

## NETWORK：按顺序排查

1. 在 **家长录音设置** 点击刷新。如果这里也失败，先核对云环境、函数名称、部署状态和当前网络。
2. 确认函数上传显示成功，依赖安装完成；本地修改文件不会自动更新云端。
3. 查 `speech-evaluate` 对应时间日志，留意模块缺失、语法错误、启动失败、函数执行超时等平台错误。当前两个函数建议内存 256 MB、执行超时 40 秒。
4. 日志有 `SUSU_SPEECH_ERROR` 时按它的 code/stage 继续；完全没有对应调用时，也检查小程序调试器 Console 的云调用错误及环境选择。
5. 偶发恢复后，仍验证一次「评分 → 保存完成 → 重进 Play saved」，避免把本机回放当作云保存成功。

代码目前把云调用被拒绝的多种异常统一显示为 `NETWORK`；仅靠这个标签不能确定根因。项目定义的拼写是 `NETWORK`，报告中如果写成 `NERWORK`，以实际截图为准。

## DATABASE_ERROR：查看 stage

| 日志 stage | 优先检查 |
| --- | --- |
| `family` | `speech_family` 是否存在、账号记录能否读取；该阶段也可能包含请求校验 |
| `history` | `speech_summaries`、旧成绩迁移与数据库事务 |
| `reserve` | `speech_quotas`、`speech_attempts` 是否存在，预约事务能否完成 |
| `claim` | attempt 的领取事务和 `speech_attempts` 读取/更新 |
| `save` | 评分后的摘要写入和 attempt 更新 |
| `archive` + `STORAGE_ERROR` | 录音上传、日志或指针提交失败；界面通常保留真实成绩并提供保存重试 |

**已修复问题：重复练习保存时带入 `_id`。** 云数据库读取结果包含 `_id`，但 `set` / `update` 的数据不能带这个字段。当前 `cloudfunctions/speech-evaluate/data.js` 的 `put` 会过滤它，回归测试也模拟该字段。若首次正常、重复后报错，先确认 `speech-evaluate` 已部署包含此修复的整份代码，不能靠删除旧分数解决。

## 星星显示后，录音还在保存

当前正常顺序是：

1. **Listening to your voice…**：云端正在取得并保存真实成绩。
2. 星星动画和 **Well done! Keep practising.** 出现。
3. **Saving your recording…**：独立保存录音，不再调用评分。
4. 保存成功后可用 **Play saved** 回听。

较低分不会上传替换，因此可能没有保存阶段。保存失败时，点击 **Save recording again**；保持当前题的本机录音可用，重试不会重复评分计费。看见星星不能单独证明录音上传成功。

## Listening to your voice… 等得很久

先确认 `speech-evaluate` 和小程序都已经更新：新版评分请求带 `deferRecording: true`，星星不用等待录音上传。只更新课程包不会启用该流程。

腾讯真实评测、网络、云函数冷启动和成绩写入仍需要时间。记录「点 Stop 到星星出现」和「星星出现到保存结束」两个时段，再结合日志区分评测慢还是上传慢。不要直接调低超时、显示模拟成绩或多次提交付费评分来掩盖等待。

## 分数或录音看起来属于别人

1. 家长设置页核对当前档案：爸爸应为 `dad`；酥酥或妈妈代酥酥练习应为 `susu`。
2. 按各自申请码检查 `speech_family.learnerId`，不要只看账号是否已批准。
3. 相同档案共用最高分，这是设计行为；不同档案需要不同 ID。
4. 修改 ID 后退出再进课程。既有数据不会自动从旧档案迁走。

`Play mine` 是本次本机录音，`Play saved` 是当前档案的最高分录音；低分不替换、同分较新替换。`Best` 高于 `Saved recording` 也可能发生在新最高分保存失败或迁入了旧版无音频成绩时。

## 清理函数没有运行

1. `speech-cleanup` 必须已部署，并设置自己的 `SPEECH_CLEANUP_ENABLED=true`。
2. 在开发者工具右键该函数下的 **config.json → 上传触发器**。函数部署和触发器上传是两步。
3. 等待之后一个整点，查看 `speech-cleanup` 云端日志。`deleted: 0` 表示没有清理到文件，不代表故障。
4. 小程序身份调用、缺少 Timer 事件或开关关闭时会返回 `UNAUTHORIZED`；不要通过开放 HTTP 来绕过入口限制。
5. 正式录音应一直保留；废弃/替换文件至少经过安全期，再在定时清理中处理，失败会延后重试。

## 报错反馈模板

```text
出错时间：
设备：开发者工具 / 手机（系统与版本）
当前档案 ID：dad / susu / 其他
课程和题目：
发生阶段：开始录音 / 停止后评分 / 保存 / 回放
页面提示与 Service code：
对应云函数错误名称、描述或 stage/code：
最近是否部署函数、编译客户端或修改账号绑定：
```
