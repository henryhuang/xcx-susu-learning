# 酥酥的学习小屋

一款原生微信小程序，按幼儿园反馈单日期组织家庭复习内容。目前的课程覆盖英语、古诗和《弟子规》。课程随小程序内置；配置的服务器也可提供只含课程数据和素材的更新包，下载完成后可离线使用。

## 开始使用

1. 用微信开发者工具导入 [`miniprogram/`](miniprogram/) 目录。项目配置已包含 AppID；实际预览和上传需要有相应权限的微信账号。
2. 在首页按反馈单日期选择课程。当前目录中的默认日期由 [`miniprogram/courses/latest.json`](miniprogram/courses/latest.json) 的 `latestWeekId` 指定。
3. 修改课程前，先阅读[课程编辑指南](docs/course-authoring.md)。

从仓库根目录运行本地检查（需要 Node.js；资源包制作还需要 Python 3）：

```sh
node tools/build-local-courses.js
node tools/validate-courses.js
node miniprogram/tests/smoke.js
node miniprogram/tests/poppy.js
node tools/check-package-size.js
```

远程资源包测试使用仓库内的 r1 固定样本，并要求先导出当前修订号的包：

```sh
node tools/make-course-package.js 8
node miniprogram/tests/remote-courses.js
```

上例中的 `8` 应替换为 `miniprogram/courses/latest.json` 当前的 `revision`。

## 仓库内容

| 路径 | 用途 |
| --- | --- |
| [`miniprogram/`](miniprogram/) | 微信小程序页面、组件、运行时服务及内置素材 |
| [`miniprogram/courses/`](miniprogram/courses/) | 周安排和课程 JSON，课程内容的编辑源 |
| [`miniprogram/schemas/`](miniprogram/schemas/) | 课程数据格式约束 |
| [`tools/`](tools/) | 构建、校验、资源包制作和体积检查脚本 |
| [`tools/audio/`](tools/audio/) | 制作阶段的配音脚本和台词清单 |
| `outputs/` | 导出的资源包；发布时使用指定修订号目录中的 ZIP 与 `latest.json` |

## 文档

- [小程序功能与数据结构](miniprogram/README.md)
- [课程编辑指南](docs/course-authoring.md)
- [资源包发布与验证](docs/course-release.md)
- [音频制作说明](tools/audio/README.md)

课程 JSON 是内容源；`miniprogram/data/local-courses.js` 和 `course-schemas.js` 由构建脚本生成。远程课程配置位于 [`miniprogram/config/courses.js`](miniprogram/config/courses.js)。发布小程序或更新远程资源包前，按[发布指南](docs/course-release.md)检查版本、素材和真机行为。
