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

首页「数据导入」步骤顶部有与「生成融合背景」同款的 **运行工作流** 按钮，对接已部署地址：

`POST https://sxk7m33ft7.coze.site/run`

请求体与你在扣子部署页复制的 Python 示例一致：

```json
{
  "start_date": "2026-09-01",
  "end_date": "2026-09-06",
  "video_urls": ["https://v.douyin.com/..."],
  "raw_video_data": []
}
```

Token 只放服务端 `.env` 的 `COZE_API_TOKEN`（对应示例里 `Bearer <YOUR_TOKEN>`），不要提交到仓库、也不要贴到聊天里。

若工作流输出是账号/标题/链接等列表，会自动写入画板卡片；若含图片 URL，会写入 AI 背景图层。同步超过约 5 分钟时会自动改走 `/async_run` 并轮询任务。

## 画板默认（PRD）

- 画板宽 **1242**，单屏高 **2208**，高度随卡片延伸
- 卡片 **1162×200**，左右边距 **40**，内边距 **16**，圆角 **20**
- 封面 **3:4**，二维码 **1:1**，标题 34px / 关键词 18px，字色白或黑
