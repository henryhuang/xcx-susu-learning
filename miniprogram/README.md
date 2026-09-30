## 远程课程资源包（第一版）

内置课程仍为首次使用及缓存损坏时的备用。支持下载完整资源包，启用前检查兼容版本、ZIP 文件清单、下载 MD5、文件大小、JSON schema、课程引用及素材完整性。MD5 用于发现传输损坏，不是数字签名；发布地址须为你控制的 HTTPS 服务器。

制作：在项目根目录执行 `node tools/make-course-package.js 7`，输出在 `outputs/course-package-r7/`。资源包只包含 `data.json`、图片和 MP3；不包含远程 JS、HTML、密钥或程序代码。当前包含四周、十个课程。

部署：先上传 ZIP，再上传同目录的 `latest.json`；将完整 HTTPS latest.json 地址填入 `config/courses.js` 的 `latestUrl`。配置 request 合法域名与 downloadFile 合法域名，使用真实设备验证。ZIP 默认使用 latest.json 同目录的相对地址，也可配置 HTTPS ZIP 绝对地址。没有地址时不会发起网络请求。

首页自动检查更新（间隔至少五分钟），也有“更新课程”按钮。失败继续使用已有课程，下载完整后才替换缓存指针；若更新期间离开首页，新课程将在再次回到首页时启用。学习中不切换资源版本。重启可直接读取已下载课程；缓存不可用时回到内置课程。最多保留当前及上一份包，单包上限 20MB、1000 文件；第一版仅接受导出工具生成的无压缩 ZIP。请勿手工改包或换压缩方法。

后续制作：编辑课程 JSON/素材，然后执行 `node tools/make-course-package.js 2`，每次增加 revision；上传新的 ZIP 后再替换 latest.json。已发布的 ZIP 保持不可变。课程 ID 与 version 不变则保留原学习记录；如果活动含义或 ID 大幅变化，应提升 lesson.version。修订号仅控制资源更新，不自动重置进度。第一版不自动降级；如需发布回退内容，用更高 revision 导出旧内容。

测试：`node tests/remote-courses.js`（需要先在项目根目录导出 r1 包）。涵盖安装、缓存恢复、文件校验失败、危险 ZIP、素材缺失、失败暂存清理与进度保留。线上下载、合法域名及微信原生解压仍需真实地址验证。

# 酥酥的学习小屋

跟着幼儿园每周内容，在家轻松复习的小程序。首页使用中文，按老师反馈单的日期选周；每周有英语、古诗、弟子规三个入口。内置三周课程、语音和汉服形象作为备用；配置下载地址后可从服务器更新课程，下载后离线学习。

## 本地运行

1. 微信开发者工具导入本目录，使用项目已配置的 AppID。
2. 默认显示 2026-09-30 的安排；点击日期可以切换此前三周。
3. 英语使用英文引导和原 Poppy，中文课程使用中文引导和汉服酥酥。
4. 进入课程自动播放欢迎语和当前任务音频，首页只在手动点按钮时播放欢迎语。

中文素材位于 `chinese` 分包，与小程序一起发布。微信首次进入该分包时由平台载入应用自身的代码和素材；这不属于远程课程数据更新。课程页使用 `/chinese/pages/lesson/index`，主包里的共享组件和交互引擎继续复用。

## 已整理的四周内容

| 反馈日期 | 英语 | 古诗 | 弟子规 |
| --- | --- | --- | --- |
| 2026-09-11 | 晚间日常、问答、词尾音 /t/ /d/ | 苏轼《题西林壁》 | 父母呼，应勿缓；父母教，须敬听 |
| 2026-09-18 | Shapes 原有课程 | 聂夷中《公子家》 | 冬则温、出必告、事虽小 |
| 2026-09-24 | My Body 原有课程 | 高鼎《村居》 | 事虽小、物虽小 |
| 2026-09-30 | Ants in Pants：7 个单词、I like pink. / I don't like red. 句型练习、4 句口语 | — | — |

此前日期是反馈单日期；9月30日暂按收到本周内容的日期记录，不自动推算学期周次或实际教学起止时间。英文保留现有 Shapes、My Body，新增 9月11日的晚间学习活动和 9月30日的英语口语活动；原单英文问句明显的语法错误已规范化。中文原文来自提供的反馈单，解释和生活情境为新编亲子学习内容。

9月18日的弟子规同时包括“事虽小”第一句，9月24日进一步学习到“物虽小”，以“温故知新”提示。对应两份课程共用原文音频，保留各周实际学习范围。重复原文不意味着整个周课程完全相同。

## 数据结构 v2

内容源放在 `courses/`，结构为：

```text
courses/
  latest.json                 周目录、默认周
  weeks/2026-09-24.json        本周安排、课程引用、学习/复习标记
  lessons/poem-cunju-v1.json   课程内容、语言、引导、原文、活动
schemas/
  manifest.schema.json
  week.schema.json
  lesson.schema.json
```

- 目录：`schemaVersion`、`revision`、`latestWeekId`、`weeks`。
- 周安排：`id`、`reportDate`、`title`、`items`；每项包含类别、learn/review 标记和课程 ID/版本/本地 JSON 路径。
- 课程：`id`、`version`、`category`、`language.content/guidance`、`presentation`、`intro`、`completion`、`content`、`activities`。
- 原文：诗词作者、朝代及带稳定 ID 的句子。活动通过 `lineIds` 引用句子，原文与逐句音频只维护一次。
- 活动：保留 word/action/choice/sound-examples；新增 read-along、explanation、line-practice。

`presentation.theme` 仅允许 `poppy` 或 `hanfu`；对应代码内固定的角色形象。欢迎语、完成语、按钮文字由课程配置。英语课程英文引导，古诗/弟子规中文引导；全局返回与首页导航仍为中文。

课程 JSON 中素材仍只使用 `/assets/…` 或 `/chinese/assets/…` 逻辑路径。下载包启用后由客户端映射为缓存文件路径；禁止直接网络素材、路径穿越、脚本字段、任意样式和未知活动类型。远程地址在 `config/courses.js` 配置，导出工具为 `tools/make-course-package.js`。

## 添加或修改本地课程

在仓库根目录执行：

```sh
node tools/build-local-courses.js
node tools/validate-courses.js
```

具体流程：

1. 在 `courses/lessons/` 复制课程 JSON，设置唯一 ID、版本、类别与语言。
2. 添加题目，或填写原文 lines 和活动 lineIds。相同 step 的活动应连续。
3. 将图片和静态音频放进对应本地资源目录，填写路径。制作阶段可生成音频，运行时不调用语音服务。
4. 在对应周文件中引用课程，课程 id/version/category 必须一致；新增一周时同步加入 latest.weeks。
5. 运行 build 和 validate，再在开发者工具检查。

微信运行环境不能直接 `require` 普通 JSON 文件，因此构建工具从 JSON 生成 `data/local-courses.js` 与 `data/course-schemas.js` 两个静态数据模块。它们只导出数据，不包含课程脚本。JSON 是唯一编辑源；修改后必须重新构建。构建检查目录、课程关系和 schema；原始 courses/schemas 文件不进入上传包，生成模块进入主包。

修改已有课程内容时提升 version，以免历史进度对应错误内容；同一内容跨周引用同一 ID/版本，可以继续既有进度。不同范围的课程可以使用不同 ID，但复用相同音频文件。

## 中文学习方式

- **整篇听读**：逐句串联播放，高亮当前句；点击句子单独重听。切换活动、离开页面或点其它声音会取消原来的串联播放。
- **理解原文**：展示原句和面向幼儿的短解释，由家长陪读，避免大段术语。
- **逐句跟读**：一次显示一句，听后自己读，再手动到下一句。没有录音权限、识别评分或强制背诵；关闭页面再进入可恢复到同一句。
- **弟子规生活情境**：从原文进入简单场景，选择做法并解释。答错可以再试，不扣星。

进度按课程 ID+版本保存，记录当前活动 ID、逐句位置、完成活动 ID、最高星数及完成状态。旧的 Shapes/My Body v1 进度会迁移；结构从 v1 升级到 v2 没有改变两门课的活动顺序和内容版本。重开步骤只清除当前和后续活动；重开整课保留历史最高星数。分享只带课程/周 ID，不分享本地学习记录。

## 汉服酥酥

使用内置 image_gen 制作三张透明 PNG，沿用现有圆眼镜、棕色短发与儿童插画风格，穿粉色与奶油色汉服：

- `chinese/assets/images/susu-hanfu-welcome.png`：中文课程欢迎。
- `chinese/assets/images/susu-hanfu-read.png`：原文听读、解释、跟读及思考/再试提示。
- `chinese/assets/images/susu-hanfu-cheer.png`：答对与完成学习。

`components/poppy` 根据 theme 和 pose 选择形象。现有英文六个动作保持原图。汉服母图、制作提示词和来源记录在 `design/hanfu/`，不进入上传包；应用图片缩放到长边 560 像素并保留透明背景。

## 本地音频

原英文 Ana 音频保留。中文目标声音已按用户指定设为晓双 `zh-CN-XiaoshuangNeural`（`tools/audio/chinese-voice.json`）。当前已打包的 32 条中文音频已通过官方 Azure Speech 生成为晓双，并完成解码、非静音检查后替换；原音频已在本地备份。配置后运行 `python3 tools/audio/generate_xiaoshuang.py`：全部中文音频生成、解码及非静音校验通过后才替换，并备份原文件。9 月 11 日晚间英语的 16 段音频已统一替换为 Ana `en-US-AnaNeural`；其他英文语音保持原样。中文生僻读音“凊”“晨则省”使用同音替换制作语音，显示文字保留原文。后续可以换成真人配音，保持文件路径即可。

台词与生成工具：`tools/audio/weekly-manifest.json`、`tools/audio/generate_local_weekly.py`。晓双制作工具使用官方 Azure Speech 服务生成静态 MP3，运行时仍只播放本地文件；英文制作工具使用系统 say 与 ffmpeg。解释文字目前由家长陪读，没有另加逐条解释配音。

微信开发者工具 2.02.2608060 在预览和上传时会读取 `evening-word-1.compressed.mp3` 与 `evening-sound-2.compressed.mp3`，但未自动生成这两个文件。`assets/audio/weekly/` 中保留了与原音频内容相同的两个兼容副本；重新生成晚间英语音频时，`generate_ana_weekly.py` 会同步更新它们。

## 验证

仓库根目录运行：

```sh
node tools/build-local-courses.js
node tools/validate-courses.js
node miniprogram/tests/smoke.js
node miniprogram/tests/poppy.js
node tools/check-package-size.js
```

检查覆盖四周十门课、英语/中文完整流程、串联语音取消、跟读位置恢复、进度迁移、奖励去重、重开、分享与分包路由、非法数据拒绝。透明 PNG 和本地资源引用均检查。

已在微信开发者工具模拟器打开首页、《村居》的汉服欢迎、整篇听读、解释与逐句跟读，控制台无运行错误。工具仍有原有 API 弃用、组件样式选择器和基础库提示；本轮没有通过 CLI 上传或发布。手机/平板真机布局、中文读音听感与好友/朋友圈分享仍需验收。
