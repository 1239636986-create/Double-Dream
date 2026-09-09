# 新媒体海报自动化生成工具

基于 PRD v1.7 的本机 Web 工具。界面布局对齐 `../code` 交互稿：顶栏八步导航、左侧图标栏、参数面板、画布工作区、右侧图层。

## 元宝 · Content to Voice Demo（同仓库子项目）

元宝原型在目录 `content-to-voice-demo/`，**不会**替换 Vercel 主站。

- 主站（海报工具）：https://double-dream.vercel.app  
- 本地跑元宝：`npm run dev:yuanbao` → http://127.0.0.1:5173  

### 接入扣子「文本工作流」（元宝）

1. 扣子部署页 → **管理 API Token** → 生成  
2. `cp .env.example .env`，填写 `COZE_API_TOKEN`  
3. `COZE_RUN_URL` 保持 `https://sxk7m33ft7.coze.site/run`  
4. `npm run dev:yuanbao`  

入参：`article_content` / `article_title` / `user_question`（见 `POST /api/coze/voice`）。

---

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

若工作流输出是账号/标题/链接等列表，会自动写入画板卡片；若返回 `excel_url`，会下载该 Excel 并按「所属账号 / 视频标题 / 封面图URL」等列导入。同步超过约 5 分钟时会自动改走 `/async_run` 并轮询任务。

## 更新 Vercel 分享链接

对外固定地址是 **https://double-dream.vercel.app**（跟 `main` 分支走）。当前线上还是合并前的版本；这次扣子按钮在分支 `cursor/coze-workflow-button-1bb0`。

要让分享链接展示最新成果：

1. 把 PR 合并进 `main`：https://github.com/1239636986-create/Double-Dream/pull/1  
   GitHub 已连接 Vercel 时，合并后会自动重新部署生产环境，`https://double-dream.vercel.app` 会换成新页面。
2. 在 [Vercel 项目 Settings → Environment Variables](https://vercel.com/meng-1855/double-dream/settings/environment-variables) 添加：
   - `COZE_API_TOKEN`：扣子部署页生成的 Token（勾选 Production）
   - `COZE_RUN_URL`：`https://sxk7m33ft7.coze.site/run`（可选，代码里已有默认值）
3. 若合并后页面还是旧的，到 Vercel 点 **Redeploy** 一次，并硬刷新浏览器。

不要把 Token 写进仓库。预览部署若打开要登录，是 Vercel Deployment Protection，不影响已公开的 `double-dream.vercel.app`。

## 画板默认（PRD）

- 画板宽 **1242**，单屏高 **2208**，高度随卡片延伸
- 卡片 **1162×200**，左右边距 **40**，内边距 **16**，圆角 **20**
- 封面 **3:4**，二维码 **1:1**，标题 34px / 关键词 18px，字色白或黑
