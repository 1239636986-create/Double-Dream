# 元宝语音交互 · Content to Voice Demo

基于微信公众号阅读场景的交互演示，并接入扣子（Coze）已部署的「文本工作流」。

## 如何把扣子工作流接到这个 Demo

你截图里的部署已经成功，接口是：

- **URL**：`POST https://sxk7m33ft7.coze.site/run`
- **Body**：`article_content`（公众号文章全文）、`article_title`、`user_question`
- **鉴权**：`Authorization: Bearer <API Token>`

### 操作步骤（必做）

1. 打开扣子 **部署** 页 → **管理 API Token** → 生成 Token  
2. 在仓库**根目录**执行：
   ```bash
   cp .env.example .env
   ```
3. 编辑 `.env`（**不要把 Token 发到聊天或提交到 Git**）：
   ```bash
   COZE_API_TOKEN=你的Token
   COZE_RUN_URL=https://sxk7m33ft7.coze.site/run
   ```
4. 启动（前端 5173 + 后端 8787）：
   ```bash
   npm install
   npm install --prefix content-to-voice-demo
   npm run dev
   ```
5. 打开 http://127.0.0.1:5173  
   - 左侧显示「扣子已连接」= 成功  
   - 点「发给元宝」→ 总结会走 `/api/coze/voice` 调你的工作流  

### 线上（Vercel）

在 Vercel 项目 Environment Variables 增加同样的：

- `COZE_API_TOKEN`
- `COZE_RUN_URL`（可选，默认已是上述地址）

并保证构建使用 `content-to-voice-demo`（本分支 `vercel.json` 已配置）。  
注意：Vercel Serverless 需要把 `/api/coze/voice` 一并部署；当前根目录 `api/index.ts` 若只代理海报能力，本地请用 `npm run dev` 验证。

## 场景对应

| 目标 | Demo |
| --- | --- |
| 更好朗读 | 听全文 / 稍后听 |
| 语音交流 | 元宝聊天 + 按住说话（有 Token 时调扣子） |
| 信息沉淀 | 沉淀页；可「用扣子重新沉淀」 |

## 未配置 Token 时

仍可点通全部 UI，使用本地 Mock 文案。
