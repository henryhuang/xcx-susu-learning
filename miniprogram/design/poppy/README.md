# Poppy 粉色小女孩

角色名 Poppy，小程序名仍为「酥酥的学习小屋」。

- poppy-pink-approved.png：用户确认的粉色形象。
- poppy-pink-transparent.png：内置 image_gen 去背景的生产源图。
- 导出素材：../../assets/images/ 中的 poppy.png、logo.png、logo-256.png、share-cover.png。

最终制作提示词（内置 image_gen）：

Background extraction edit for a production miniapp PNG mascot asset. Remove only the ivory background and ground shadow completely and return a genuinely transparent alpha background. Preserve the approved pink Poppy girl exactly: same face, pink round glasses, dark brown ponytail and bangs, waving hand, pink dress with white bow, pink book, white socks and pink shoes, same colors, proportions and illustration details. Do not redraw or redesign. Keep full body without clipping any hair, hands or shoes. Crop canvas reasonably closely to full character with a small transparent safety margin. No text, no checkerboard painted into image, no background.

## 动作扩展

新增 poppy-listen.png、poppy-think.png、poppy-cheer.png、poppy-celebrate.png，分别对应认真听、思考、加油和庆祝。由内置 image_gen 逐张生成，完整提示词见 poses.json（sharedPrompt 与各动作描述组合）。应用素材缩放到最长边 640 px，透明背景保持不变。源图在本目录，生产素材在 ../../assets/images/。

## 选错时再试一次

新增 poppy-retry.png：歪头、单手摊开、另一只手放在胸前，温柔邀请再试一次。内置 image_gen 制作，完整提示词见 retry-prompt.json。源图为本目录 poppy-retry.png，应用素材为 ../../assets/images/poppy-retry.png（最长边 640 px，透明 PNG）。两门课程的选择题和词尾音题在 feedbackKind 为 try 时使用，答对后切换为 cheer；重听期间保留 retry。
