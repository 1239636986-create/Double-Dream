/** Coze / 扣子工作流 API 适配 */

export type CozePublicConfig = {
  configured: boolean;
  hasToken: boolean;
  workflowId: string;
  botId: string;
  appId: string;
  textInputKey: string;
  imageInputKey: string;
  requireMainVisual: boolean;
  applyImageToBackground: boolean;
};

export function readCozeEnv() {
  const token = (process.env.COZE_API_TOKEN || process.env.COZE_PAT || '').trim();
  const workflowId = (process.env.COZE_WORKFLOW_ID || '').trim();
  const botId = (process.env.COZE_BOT_ID || '').trim();
  const appId = (process.env.COZE_APP_ID || '').trim();
  const apiBase = (process.env.COZE_API_BASE || 'https://api.coze.cn').replace(/\/$/, '');
  const textInputKey = (process.env.COZE_TEXT_INPUT_KEY || 'input').trim();
  const imageInputKey = (process.env.COZE_IMAGE_INPUT_KEY || 'image').trim();
  const requireMainVisual = String(process.env.COZE_REQUIRE_MAIN_VISUAL || 'false').toLowerCase() === 'true';
  const applyImageToBackground =
    String(process.env.COZE_APPLY_IMAGE_TO_BACKGROUND ?? 'true').toLowerCase() !== 'false';
  return {
    token,
    workflowId,
    botId,
    appId,
    apiBase,
    textInputKey,
    imageInputKey,
    requireMainVisual,
    applyImageToBackground,
  };
}

export function publicCozeConfig(): CozePublicConfig {
  const e = readCozeEnv();
  return {
    configured: Boolean(e.token && e.workflowId),
    hasToken: Boolean(e.token),
    workflowId: e.workflowId,
    botId: e.botId,
    appId: e.appId,
    textInputKey: e.textInputKey,
    imageInputKey: e.imageInputKey,
    requireMainVisual: e.requireMainVisual,
    applyImageToBackground: e.applyImageToBackground,
  };
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function parseDataUrl(input: string): { mime: string; buffer: Buffer; ext: string } | null {
  const m = String(input).match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) return null;
  const mime = m[1] || 'image/png';
  const buffer = Buffer.from(m[2], 'base64');
  const ext = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : mime.includes('webp') ? 'webp' : mime.includes('gif') ? 'gif' : 'png';
  return { mime, buffer, ext };
}

export async function uploadCozeFile(opts: {
  token: string;
  apiBase: string;
  buffer: Buffer;
  filename: string;
  mime: string;
}): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(opts.buffer)], { type: opts.mime }), opts.filename);
  const resp = await fetch(`${opts.apiBase}/v1/files/upload`, {
    method: 'POST',
    headers: authHeaders(opts.token),
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  const json = (await resp.json()) as {
    code?: number;
    msg?: string;
    data?: { id?: string };
  };
  if (!resp.ok || json.code !== 0 || !json.data?.id) {
    throw new Error(json.msg || `扣子文件上传失败（HTTP ${resp.status}）`);
  }
  return json.data.id;
}

export async function runCozeWorkflow(opts: {
  token: string;
  apiBase: string;
  workflowId: string;
  botId?: string;
  appId?: string;
  parameters: Record<string, unknown>;
}): Promise<{ data: unknown; debugUrl?: string; executeId?: string; raw: unknown }> {
  const body: Record<string, unknown> = {
    workflow_id: opts.workflowId,
    parameters: opts.parameters,
  };
  if (opts.botId) body.bot_id = opts.botId;
  if (opts.appId) body.app_id = opts.appId;

  const resp = await fetch(`${opts.apiBase}/v1/workflow/run`, {
    method: 'POST',
    headers: {
      ...authHeaders(opts.token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(540_000),
  });
  const json = (await resp.json()) as {
    code?: number;
    msg?: string;
    data?: unknown;
    debug_url?: string;
    execute_id?: string;
  };
  if (!resp.ok || (typeof json.code === 'number' && json.code !== 0)) {
    throw new Error(json.msg || `扣子工作流执行失败（HTTP ${resp.status}）`);
  }
  return {
    data: json.data,
    debugUrl: json.debug_url,
    executeId: json.execute_id,
    raw: json,
  };
}

const IMAGE_URL_RE =
  /^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i;
const HOST_HINT_RE = /coze|byteimg|imagex|tos-cn|volces|cdn/i;

export function collectCozeMedia(data: unknown): { text: string; imageUrls: string[] } {
  const textParts: string[] = [];
  const imageUrls: string[] = [];
  const seen = new Set<string>();

  const addImage = (s: string) => {
    if (seen.has(s)) return;
    seen.add(s);
    imageUrls.push(s);
  };

  const looksLikeImage = (s: string, key?: string) => {
    if (/^data:image\//i.test(s)) return true;
    if (IMAGE_URL_RE.test(s)) return true;
    if (/^https?:\/\//i.test(s) && HOST_HINT_RE.test(s)) return true;
    if (key && /^(url|image|img|cover|background|output_image|file_url)$/i.test(key) && /^https?:\/\//i.test(s)) {
      return true;
    }
    return false;
  };

  const walk = (v: unknown, key?: string) => {
    if (v == null) return;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return;
      if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 2_000_000) {
        try {
          walk(JSON.parse(trimmed), key);
          return;
        } catch {
          /* keep as text */
        }
      }
      if (looksLikeImage(trimmed, key)) {
        addImage(trimmed);
        return;
      }
      if (trimmed.length <= 8000) textParts.push(trimmed);
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      textParts.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, key));
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, k);
    }
  };

  walk(data);
  return {
    text: uniqueJoin(textParts),
    imageUrls,
  };
}

function uniqueJoin(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out.join('\n').trim();
}

export async function fetchAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const resp = await fetch(url, {
    headers: { Accept: 'image/*,*/*' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) throw new Error(`下载工作流图片失败（HTTP ${resp.status}）`);
  const buf = Buffer.from(await resp.arrayBuffer());
  const ct = resp.headers.get('content-type') || 'image/png';
  const mime = ct.split(';')[0] || 'image/png';
  return `data:${mime};base64,${buf.toString('base64')}`;
}
