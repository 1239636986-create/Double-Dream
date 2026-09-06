# 新媒体海报自动化生成工具

基于 PRD v1.7 的本机 Web 工具。界面布局对齐 `../code` 交互稿：顶栏八步导航、左侧图标栏、参数面板、画布工作区、右侧图层。

## 环境要求

- Node.js 18+
- Chrome 最新版
- （可选）星流 LiblibAI AccessKey / SecretKey
- （可选）扣子 Coze 个人访问令牌 PAT + 已发布工作流 ID

## 启动

```bash
cd poster-tool
cp .env.example .env   # 填写 LIBLIB_ACCESS_KEY / LIBLIB_SECRET_KEY；接入扣子时再填 COZE_API_TOKEN / COZE_WORKFLOW_ID
npm install
npm run dev
```

浏览器打开 http://127.0.0.1:5173  
API 代理默认 http://127.0.0.1:8787

## 使用流程（与交互稿步骤一致）

1. **主视觉上传** → 2. **AI 生成背景** → 3. **蒙版融合**
4. **导入 Excel + 素材文件夹**（最多 20 行）→ 5. **画板** → 6/7. **排版与间距** → 8. **导出**

样例素材可参考上级目录 `海报信息/`（Excel + 封面/二维码图片）。

## 接入扣子工作流

左侧「背景生成」步骤中有一个与「生成融合背景」同款的 **运行工作流** 按钮。点击后由本机服务端调用 [执行工作流 API](https://docs.coze.cn/developer_guides_workflow_run)，PAT 不会下发到浏览器。

请提供（或自行写入 `.env`）：

| 需要提供的内容 | 怎么拿 | 是否必填 |
| --- | --- | --- |
| `COZE_API_TOKEN`（个人访问令牌 PAT） | 扣子开放平台 → 授权 → [个人访问令牌](https://www.coze.cn/open/oauth/pats)，开通 `run` 权限，并授权工作流所在空间 | 必填 |
| `COZE_WORKFLOW_ID` | 工作流编排页 URL 中 `workflow_id=` 后面的数字 | 必填 |
| 工作流已发布为 API | 编排页右上角「发布」；未发布会报错 4200 | 必填 |
| 开始节点输入参数名 | 开始节点里的字段名，例如 `input`、`image` | 建议提供，便于对齐 |
| 结束节点输出字段 | 输出是文案、图片 URL，还是两者都有 | 建议提供 |
| `COZE_BOT_ID` | 智能体开发页 URL 中 `bot=` 后的数字。含数据库/变量节点时需要 | 按工作流而定 |
| `COZE_APP_ID` | 扣子应用 URL 中 `project-ide=` 后的数字。工作流在应用内时需要 | 按工作流而定 |

默认把文本写入 `input`、把当前主视觉上传后写入 `image`（`{"file_id":"..."}`）。若你的开始节点字段名不同，请改 `COZE_TEXT_INPUT_KEY` / `COZE_IMAGE_INPUT_KEY`。

若结束节点输出图片 URL，工具会把它写入「AI 背景」图层；纯文本会显示在按钮下方。

## 画板默认（PRD）

- 画板宽 **1242**，单屏高 **2208**，高度随卡片延伸
- 卡片 **1162×200**，左右边距 **40**，内边距 **16**，圆角 **20**
- 封面 **3:4**，二维码 **1:1**，标题 34px / 关键词 18px，字色白或黑
