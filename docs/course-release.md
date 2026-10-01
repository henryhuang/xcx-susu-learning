# 课程资源包发布与验证

小程序有内置课程作为首次使用和缓存失效时的备用。远程更新通过 `miniprogram/config/courses.js` 的 `latestUrl` 获取资源包索引。若要关闭网络更新，将该地址设为空字符串并重新构建小程序。

## GitHub Actions 发布

仓库的 **Publish courses** 工作流可在 GitHub Actions 页面手动触发，仅从 `main` 分支发布。它以 `miniprogram/courses/latest.json` 的 `revision` 为准，重新构建并运行本地检查，生成资源包，比较线上修订号，然后先上传 ZIP、验证 HTTPS 下载校验和，最后原子替换线上 `latest.json`。线上修订号相同且 ZIP 校验和相同会直接结束；相同修订号对应不同内容或线上版本更新时会报错。

首次使用前，在 GitHub 仓库的 `course-production` Environment 中配置以下 Secrets：

| Secret | 内容 |
| --- | --- |
| `COURSE_SSH_HOST` | 承载 `mivora.cnhalo.com` 静态目录的 SSH 主机名 |
| `COURSE_SSH_USER` | 对课程目录有写入权限的 SSH 用户 |
| `COURSE_SSH_PRIVATE_KEY` | 该用户的专用 SSH 私钥 |
| `COURSE_SSH_KNOWN_HOSTS` | 核实过主机指纹的 `known_hosts` 记录 |
| `COURSE_SSH_PORT` | 可选；省略时使用 22 |

工作流默认写入服务器上的 `/app/mivora/susu-learning`，与仓库中的 Nginx 站点根目录配置对应。如果 SSH 所见路径不同，在同一 Environment 中设置变量 `COURSE_DEPLOY_PATH`。SSH 用户需要能写入该目录；`latest.json` 和 ZIP 由网页服务器读取。工作流不会替你创建 SSH 凭据或修改微信小程序的合法域名配置。

提交课程 JSON、素材、生成的 `miniprogram/data/*.js` 以及工作流后，增加 `revision` 并触发 **Publish courses**。工作流会拒绝生成模块与课程源不一致的提交。发布后仍应在真机确认下载与课程播放。

## 发布步骤

1. 按[课程编辑指南](course-authoring.md)修改课程并运行本地检查。
2. 选择比已发布版本更大的正整数修订号。例如，已发布 r8 后使用 r9：

```sh
node tools/make-course-package.js 9
```

3. 检查 `outputs/course-package-r9/` 中的 `latest.json` 和 `susu-courses-r9.zip`。导出脚本会先重新生成内置数据，再制作只含 `data.json`、图片和 MP3 的无压缩 ZIP，并生成大小及 MD5 清单。
4. 先将 ZIP 上传到由自己控制的 HTTPS 目录，确认可下载；再上传同目录的 `latest.json`。保持已发布 ZIP 不变。索引中的 ZIP 地址默认是相对于 `latest.json` 的文件名，也支持 HTTPS 绝对地址。
5. 确认 `miniprogram/config/courses.js` 的 `latestUrl` 指向完整的 HTTPS `latest.json` 地址，并在微信平台配置对应的 `request` 与 `downloadFile` 合法域名。用真机验证下载、重新打开后的离线读取、课程素材和进度。

如果需要恢复旧内容，应以更高 `revision` 重新导出该内容。客户端只接受修订号递增的更新。课程 ID 和 `version` 决定学习记录是否沿用；单独提高 `revision` 不会重置进度。

## 本地验证

```sh
node tools/build-local-courses.js
node tools/validate-courses.js
node miniprogram/tests/smoke.js
node miniprogram/tests/poppy.js
node tools/check-package-size.js
node tools/make-course-package.js 8
node miniprogram/tests/remote-courses.js
```

示例中的 `8` 应替换为当前课程修订号。`remote-courses.js` 使用仓库内的 r1 固定样本和当前修订号的导出包测试安装、缓存恢复、校验失败、缺失素材与进度保留。不要重新生成 r1 样本。测试中的网络和解压由本地模拟，不能替代真机验证。

客户端在启用资源包前检查索引兼容性、文件大小、MD5、ZIP 条目、课程结构及引用素材。MD5 只能用于发现传输损坏，不能证明发布者身份，因此发布地址应使用受控 HTTPS 服务。资源包上限、文件数量限制及 ZIP 格式以 [`course-package.js`](../miniprogram/services/course-package.js) 中的校验为准。
