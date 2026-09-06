process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import cors from 'cors';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import {
  collectCozeMedia,
  excelRowsFromCoze,
  extractExcelUrl,
  fetchAsDataUrl,
  fetchExcelBuffer,
  hydrateRowImages,
  normalizePayload,
  publicCozeConfig,
  readCozeEnv,
  runPublishedWorkflow,
} from './coze';
import { parseExcel } from '../src/lib/excel';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ACCESS_KEY = process.env.LIBLIB_ACCESS_KEY || '';
const SECRET_KEY = process.env.LIBLIB_SECRET_KEY || '';
const BASE = 'https://openapi.liblibai.cloud';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));

function sign(uri: string) {
  const Timestamp = String(Date.now());
  const SignatureNonce = crypto.randomUUID().replace(/-/g, '');
  const content = `${uri}&${Timestamp}&${SignatureNonce}`;
  const Signature = crypto.createHmac('sha1', SECRET_KEY).update(content).digest('base64');
  return { AccessKey: ACCESS_KEY, Signature, Timestamp, SignatureNonce };
}

function signedUrl(uri: string): string {
  const s = sign(uri);
  const q = new URLSearchParams(s as unknown as Record<string, string>);
  return `${BASE}${uri}?${q.toString()}`;
}

function stripDataUrl(input: string) {
  return String(input).replace(/^data:image\/\w+;base64,/, '');
}

app.get('/api/health', (_req, res) => {
  const coze = publicCozeConfig();
  res.json({
    ok: true,
    hasLiblibKeys: Boolean(ACCESS_KEY && SECRET_KEY),
    hasCoze: coze.configured,
    providers: ['pollinations', 'procedural', ...(ACCESS_KEY && SECRET_KEY ? ['liblib'] : [])],
  });
});

app.get('/api/coze/config', (_req, res) => {
  res.json(publicCozeConfig());
});

app.post('/api/coze/run', async (req, res) => {
  const env = readCozeEnv();
  if (!env.token) {
    res.status(500).json({
      error: '未配置扣子 API Token。请在 .env 中填写 COZE_API_TOKEN（部署页「管理 API Token」生成，不要把 Token 写进前端）。',
    });
    return;
  }

  try {
    const payload = normalizePayload({
      start_date: req.body?.start_date,
      end_date: req.body?.end_date,
      video_urls: req.body?.video_urls,
      raw_video_data: req.body?.raw_video_data,
    });

    const data = await runPublishedWorkflow({
      token: env.token,
      runUrl: env.runUrl,
      payload,
    });

    const media = collectCozeMedia(data);
    let rows = excelRowsFromCoze(data);
    const excelUrl = extractExcelUrl(data);
    let excelWarning = '';
    if (excelUrl) {
      const buf = await fetchExcelBuffer(excelUrl);
      const parsed = parseExcel(buf);
      excelWarning = parsed.warning || '';
      if (parsed.rows.length) rows = parsed.rows;
    }
    if (rows.length) {
      rows = await hydrateRowImages(rows);
    }
    let imageDataUrl: string | null = null;
    if (media.imageUrls[0]) {
      try {
        imageDataUrl = await fetchAsDataUrl(media.imageUrls[0]);
      } catch (err) {
        console.warn('[coze] image fetch failed', err);
      }
    }

    res.json({
      ok: true,
      text: rows.length
        ? `已从工作流 Excel 导入 ${rows.length} 行${excelWarning ? `（${excelWarning}）` : ''}`
        : excelUrl
          ? `工作流已完成并生成 Excel，但没有数据行。请填写视频链接后再运行。${excelWarning ? ` ${excelWarning}` : ''}`
          : media.text,
      imageDataUrl,
      imageUrls: media.imageUrls,
      excelUrl,
      rows,
      data,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/** Pollinations FLUX：免密钥，按主视觉配色写 prompt */
async function pollinationsBackground(opts: {
  prompt: string;
  colors?: string[];
  width: number;
  height: number;
}): Promise<Buffer> {
  const colorHint = (opts.colors || []).slice(0, 4).join(', ');
  const prompt = [
    opts.prompt,
    colorHint ? `use ONLY these colors: ${colorHint}` : '',
    'soft diffuse vertical gradient, top to bottom color wash',
    'gentle soft blobs, calm atmosphere, subtle grain',
    'max 3 colors, primary plus accent, same color family',
    'no flowing ribbons, no silk, no aurora trails, no motion streaks',
    'abstract backdrop only, no text, no logo, no watermark, no objects',
    'vertical marketing poster atmosphere',
  ]
    .filter(Boolean)
    .join(', ');

  const w = Math.min(Math.max(opts.width, 512), 1080);
  const h = Math.min(Math.max(opts.height, 512), 1920);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&model=flux&nologo=true&enhance=true&seed=${Date.now() % 1_000_000}`;

  const resp = await fetch(url, {
    headers: {
      Accept: 'image/*',
      'User-Agent': 'poster-tool/1.0',
    },
    signal: AbortSignal.timeout(120_000),
  });
  if (!resp.ok) {
    throw new Error(`Pollinations HTTP ${resp.status}`);
  }
  const ct = resp.headers.get('content-type') || '';
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 1000 || (ct && !ct.includes('image') && !ct.includes('octet-stream'))) {
    throw new Error(`Pollinations 未返回有效图片（${ct || 'unknown'}）`);
  }
  return buf;
}

async function liblibSubmit(opts: {
  prompt: string;
  imageBase64?: string;
  width: number;
  height: number;
}): Promise<string> {
  const hasRef = Boolean(opts.imageBase64);
  const uri = hasRef ? '/api/generate/webui/img2img' : '/api/generate/webui/text2img';
  const generateParams: Record<string, unknown> = {
    prompt: opts.prompt,
    negativePrompt: 'text, watermark, logo, low quality, blurry, ugly',
    steps: 25,
    cfgScale: 7,
    width: opts.width,
    height: opts.height,
    imgCount: 1,
    seed: -1,
    clipSkip: 2,
    sampler: 15,
  };
  if (hasRef) {
    generateParams.sourceImage = stripDataUrl(opts.imageBase64!);
    generateParams.denoisingStrength = 0.55;
  }
  const body = {
    templateUuid: hasRef
      ? '07e00af4fc464c7ab55ff906f8acf1b7'
      : '5d7e67009b344550bc1aa6ccbfa1d7f4',
    generateParams,
  };
  const resp = await fetch(signedUrl(uri), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await resp.json()) as {
    code?: number;
    msg?: string;
    data?: { generateUuid?: string };
  };
  if (!resp.ok || data.code !== 0 || !data.data?.generateUuid) {
    throw new Error(data.msg || 'Liblib 提交失败');
  }
  return data.data.generateUuid;
}

app.post('/api/generate-bg', async (req, res) => {
  try {
    const {
      prompt = 'soft diffuse gradient background, liquid glass, aurora, warm commercial poster atmosphere',
      colors,
      width = 1242,
      height = 2208,
      provider = 'auto',
    } = req.body as {
      prompt?: string;
      imageBase64?: string;
      colors?: string[];
      width?: number;
      height?: number;
      provider?: 'auto' | 'pollinations' | 'liblib';
    };

    const genW = Math.min(Number(width) || 1242, 1080);
    const genH = Math.min(Math.round(genW * ((Number(height) || 2208) / (Number(width) || 1242))), 1920);

    if (provider === 'liblib') {
      if (!ACCESS_KEY || !SECRET_KEY) {
        res.status(500).json({ error: '未配置 Liblib 密钥' });
        return;
      }
      const { imageBase64 } = req.body as { imageBase64?: string };
      const generateUuid = await liblibSubmit({
        prompt,
        imageBase64,
        width: Math.min(genW, 1024),
        height: Math.min(genH, 1820),
      });
      res.json({ mode: 'async', provider: 'liblib', generateUuid });
      return;
    }

    try {
      const buf = await pollinationsBackground({
        prompt,
        colors,
        width: genW,
        height: genH,
      });
      res.json({
        mode: 'sync',
        provider: 'pollinations',
        imageBase64: `data:image/jpeg;base64,${buf.toString('base64')}`,
      });
    } catch (err) {
      res.json({
        mode: 'fallback',
        provider: 'procedural',
        error: err instanceof Error ? err.message : String(err),
        colors: colors || [],
        width: Number(width) || 1242,
        height: Number(height) || 2208,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/liblib/generate', async (req, res) => {
  if (!ACCESS_KEY || !SECRET_KEY) {
    res.status(500).json({
      error: '未配置 Liblib。请使用默认「AI 生成背景」（无需密钥）。',
    });
    return;
  }
  try {
    const {
      prompt = 'soft gradient background, liquid glass, aurora light, apple wallpaper style, seamless, high quality',
      imageBase64,
      width = 1242,
      height = 2208,
    } = req.body as {
      prompt?: string;
      imageBase64?: string;
      width?: number;
      height?: number;
    };
    const generateUuid = await liblibSubmit({
      prompt,
      imageBase64,
      width: Math.min(Number(width) || 1242, 1024),
      height: Math.min(Number(height) || 2208, 1820),
    });
    res.json({ generateUuid });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/liblib/status', async (req, res) => {
  if (!ACCESS_KEY || !SECRET_KEY) {
    res.status(500).json({ error: '未配置密钥' });
    return;
  }
  try {
    const { generateUuid } = req.body as { generateUuid?: string };
    if (!generateUuid) {
      res.status(400).json({ error: '缺少 generateUuid' });
      return;
    }
    const uri = '/api/generate/webui/status';
    const resp = await fetch(signedUrl(uri), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generateUuid }),
    });
    const data = await resp.json();
    res.status(resp.ok ? 200 : 502).json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/proxy-image', async (req, res) => {
  try {
    const url = String(req.query.url || '');
    if (!/^https?:\/\//i.test(url)) {
      res.status(400).json({ error: '非法 url' });
      return;
    }
    const resp = await fetch(url);
    if (!resp.ok) {
      res.status(502).json({ error: '下载失败' });
      return;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct = resp.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', ct);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`[poster-tool] API proxy http://127.0.0.1:${PORT}`);
  console.log('[poster-tool] 默认生图：Pollinations FLUX（免密钥）+ 本地程序化回退');
});
