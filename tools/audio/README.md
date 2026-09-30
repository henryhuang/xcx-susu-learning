# Ana 本地配音

2026-09-26：全部 49 条素材已生成并替换到 `miniprogram/assets/audio/`。

- 声音：微软 `en-US-AnaNeural`。
- 来源：微软 Edge 语音服务，通过 PyPI `edge-tts==7.2.8` 生成。
- 语速：-8%；没有通过升调制造童声。
- 结果：24kHz、单声道 MP3，49 条文件全部可解码且非静音。
- 验证记录：`ana-validation.json`。
- 旧素材备份：仓库 `audio-candidates/samantha-backup/`。
- 试听合集：仓库 `audio-candidates/ana-preview.mp3`。

本次没有使用 Azure 计费接口，也没有配置支付或订阅。网络服务仅用于制作文件；小程序运行时直接播放本地 MP3。

## 重生成

在本地 Python 虚拟环境安装 `requirements.txt`。执行 `python tools/audio/generate_edge.py` 生成四条试听；执行 `--all` 生成全部素材。生成结果进入仓库 `audio-candidates/ana/`，不会自动覆盖小程序文件。服务可用性由微软控制，但不影响已打包的小程序音频。

`manifest.json` 列出全部台词及现有文件路径，也可以交给真人配音者。

`generate_azure.py` 保留为官方 Azure Speech 接口备选。它需要本地环境变量 `AZURE_SPEECH_KEY` 和 `AZURE_SPEECH_REGION`，可能产生服务费用；本次未使用。密钥不能放进小程序或聊天。

## 中文声音：晓双

目标配置在 `chinese-voice.json`：`zh-CN-XiaoshuangNeural`，语速 -8%，不变调。当前 Edge 通道的声音列表不包含晓双，试生成没有返回音频；需要官方 Azure Speech 服务。当前已通过本地 Azure 配置生成并安装 32 条晓双 MP3；全部通过解码、非静音检查，实际音色记录已更新为 zh-CN-XiaoshuangNeural。原 Tingting 文件已在 audio-candidates 中备份。

在 `tools/audio/azure-speech.local.json` 中填写 `key`（Azure KEY 1）和 `region`（区域代码）。这个本地文件已加入 `.gitignore`，且位于小程序目录外，不会打包进小程序。不要分享该文件或把密钥发到聊天。也可以使用环境变量 `AZURE_SPEECH_KEY`、`AZURE_SPEECH_REGION`，环境变量优先。然后从项目根目录运行：

```sh
python3 tools/audio/generate_xiaoshuang.py
```

默认先生成首页欢迎、古诗、弟子规、情境题和完成语的全部 32 条中文候选，完整解码和非静音校验通过后统一替换。英文不参与此脚本。旧文件与台词/校验记录备份到 `audio-candidates/chinese-before-xiaoshuang-时间戳/`；安装失败会恢复原文件。替换保持资源路径和课程进度不变。

也可以先运行 `--generate-only` 试听候选，再使用 `--install-only` 安装。候选保存到 `audio-candidates/xiaoshuang/`，记录声音名称、时长、音量与 SHA-256。安装前重新检查文件校验和和非静音状态。

旧 `generate_local_weekly.py` 默认不再生成中文，防止覆盖回系统声音；`--english-only` 仅重生成晚间英语。

9 月 11 日晚间英语曾使用 Samantha，已用 `generate_ana_weekly.py` 通过本地 Azure 配置重制为 `en-US-AnaNeural`。脚本先生成并验证全部 16 段，再备份替换，并同步更新语音记录。
