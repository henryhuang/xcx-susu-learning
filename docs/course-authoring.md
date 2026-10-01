# 课程编辑指南

在仓库根目录执行本页命令。课程内容的编辑源是 `miniprogram/courses/` 下的 JSON；不要直接编辑 `miniprogram/data/local-courses.js` 或 `course-schemas.js`，它们由构建脚本生成。

## 文件关系

```text
miniprogram/courses/latest.json
  └─ weeks/<日期>.json
       └─ lessons/<课程文件>.json
            └─ /assets/… 或 /chinese/assets/… 素材
```

- `latest.json` 定义 `schemaVersion`、`revision`、`latestWeekId` 和周列表。周列表的 `url` 指向周 JSON。
- 周文件用 `items` 指向课程文件，并声明类别及 `learn`/`review` 模式。引用的课程 ID、版本、类别必须与课程文件一致。
- 课程文件定义语言、形象、欢迎语、完成语、原文和活动。允许的字段与活动类型以 [`lesson.schema.json`](../miniprogram/schemas/lesson.schema.json) 为准。
- 英语课程使用 `poppy`；古诗与《弟子规》使用 `hanfu`。课程素材使用本地逻辑路径；运行时会将下载包中的路径映射到缓存文件。

## 添加或修改课程

1. 复制相近的 `miniprogram/courses/lessons/*.json`，修改课程 ID、版本、文本及活动。活动 ID 在同一课程中须唯一；相同 `step` 的活动应连续。引用原文的活动必须使用该课程 `content.lines` 中已有的 `lineIds`。
2. 把所需图片或音频放在 `miniprogram/assets/` 或 `miniprogram/chinese/assets/`，并在课程 JSON 中引用 `/assets/…` 或 `/chinese/assets/…`。音频在制作阶段生成；小程序运行时播放静态素材。
3. 在相应的 `courses/weeks/<日期>.json` 中添加或更新课程引用。新增周时，也要将其加入 `courses/latest.json` 的 `weeks`；若应默认显示，将 `latestWeekId` 设为该周 ID。
4. 如果修改会改变已有活动的含义或进度对应关系，提升课程 `version`。相同课程跨周复习时可继续使用同一 ID 和版本，以保留学习记录。资源包 `revision` 只控制内容更新，不负责重置进度。
5. 重新构建并检查：

```sh
node tools/build-local-courses.js
node tools/validate-courses.js
node miniprogram/tests/smoke.js
node tools/check-package-size.js
```

构建会校验 JSON 格式、课程引用和部分内容关系；`validate-courses.js` 还会检查本地素材是否存在。完成后在微信开发者工具中打开受影响课程，检查图片、语音和交互。`check-package-size.js` 给出本地源码估算，最终上传体积以开发者工具为准。

## 数据边界

远程课程包只接受声明式 JSON、图片和 MP3。课程文件不支持远程脚本、任意样式、网络素材地址或未定义的活动类型。需要新交互时，应先在小程序代码及 schema 中实现、验证，再编写使用它的课程数据。

更完整的字段说明和学习流程见[小程序 README](../miniprogram/README.md)。
