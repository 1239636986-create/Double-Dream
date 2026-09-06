/** 扣子编程已部署工作流（https://<domain>/run） */

export const DEFAULT_COZE_RUN_URL = 'https://sxk7m33ft7.coze.site/run';

export type CozePublicConfig = {
  configured: boolean;
  hasToken: boolean;
  runUrl: string;
};

export type CozeRunPayload = {
  start_date: string;
  end_date: string;
  video_urls: string[];
  raw_video_data: unknown[];
};

export function readCozeEnv() {
  const token = (process.env.COZE_API_TOKEN || process.env.COZE_PAT || '').trim();
  const runUrl = (process.env.COZE_RUN_URL || DEFAULT_COZE_RUN_URL).trim().replace(/\/$/, '');
  return { token, runUrl };
}

export function publicCozeConfig(): CozePublicConfig {
  const e = readCozeEnv();
  return {
    configured: Boolean(e.token),
    hasToken: Boolean(e.token),
    runUrl: e.runUrl,
  };
}

export function cozeServiceBase(runUrl: string): string {
  return runUrl.replace(/\/(async_run|stream_run|run)\/?$/, '');
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readJson(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorFromBody(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body.trim().slice(0, 2000);
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    for (const key of ['error', 'msg', 'message', 'detail', 'error_message']) {
      const v = o[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return fallback;
}

export function normalizePayload(input: Partial<CozeRunPayload>): CozeRunPayload {
  const video_urls = (input.video_urls || [])
    .map((u) => String(u || '').trim())
    .filter((u) => u && u !== 'http://' && u !== 'https://');
  const raw = Array.isArray(input.raw_video_data)
    ? input.raw_video_data.filter((item) => item && typeof item === 'object' && Object.keys(item as object).length > 0)
    : [];
  return {
    start_date: String(input.start_date || '').trim(),
    end_date: String(input.end_date || '').trim(),
    video_urls,
    raw_video_data: raw,
  };
}

async function postJson(url: string, token: string, body: unknown, timeoutMs: number): Promise<{ status: number; data: unknown }> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await readJson(resp);
  return { status: resp.status, data };
}

async function pollAsyncTask(opts: {
  base: string;
  token: string;
  taskId: string;
}): Promise<unknown> {
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const resp = await fetch(`${opts.base}/task/${opts.taskId}`, {
      headers: { Authorization: `Bearer ${opts.token}` },
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await readJson(resp)) as {
      status?: string;
      result?: unknown;
      error?: string | null;
    } | null;
    if (!resp.ok) {
      throw new Error(errorFromBody(data, `查询异步任务失败（HTTP ${resp.status}）`));
    }
    const status = String(data?.status || '');
    if (status === 'completed') return data?.result ?? data;
    if (status === 'failed' || status === 'timeout') {
      throw new Error(data?.error || `扣子工作流${status === 'timeout' ? '超时' : '失败'}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('扣子异步任务等待超时，请稍后在部署页查看运行记录');
}

export async function runPublishedWorkflow(opts: {
  token: string;
  runUrl: string;
  payload: CozeRunPayload;
}): Promise<unknown> {
  const base = cozeServiceBase(opts.runUrl);
  try {
    const { status, data } = await postJson(`${base}/run`, opts.token, opts.payload, 280_000);
    if (status === 401 || status === 403) {
      throw new Error('扣子 Token 无效或无权限，请检查 COZE_API_TOKEN');
    }
    if (status >= 400) {
      throw new Error(errorFromBody(data, `扣子工作流失败（HTTP ${status}）`));
    }
    return data;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const timedOut = err instanceof Error && (err.name === 'TimeoutError' || /timeout|aborted/i.test(msg));
    if (!timedOut) throw err;

    const asyncPost = await postJson(`${base}/async_run`, opts.token, opts.payload, 60_000);
    if (asyncPost.status >= 400) {
      throw new Error(`同步接口超时，异步重试失败：${errorFromBody(asyncPost.data, `HTTP ${asyncPost.status}`)}`);
    }
    const taskId = (asyncPost.data as { task_id?: string } | null)?.task_id;
    if (!taskId) throw new Error('同步超时且异步接口未返回 task_id');
    return pollAsyncTask({ base, token: opts.token, taskId });
  }
}

const IMAGE_URL_RE = /^https?:\/\/.+\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i;
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
    if (/\.(xlsx|xls|csv)(\?|$)/i.test(s)) return false;
    if (/excel/i.test(key || '')) return false;
    if (/^data:image\//i.test(s)) return true;
    if (IMAGE_URL_RE.test(s)) return true;
    if (/^https?:\/\//i.test(s) && HOST_HINT_RE.test(s) && !/\.(xlsx|xls|csv)(\?|$)/i.test(s)) return true;
    if (key && /^(url|image|img|cover|background|output_image|file_url)$/i.test(key) && /^https?:\/\//i.test(s)) {
      return true;
    }
    return false;
  };

  const walk = (v: unknown, key?: string, depth = 0) => {
    if (v == null || depth > 8) return;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) return;
      if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 2_000_000) {
        try {
          walk(JSON.parse(trimmed), key, depth + 1);
          return;
        } catch {
          /* keep as text */
        }
      }
      if (looksLikeImage(trimmed, key)) {
        addImage(trimmed);
        return;
      }
      if (trimmed.length <= 4000 && !key?.includes('schema')) textParts.push(trimmed);
      return;
    }
    if (typeof v === 'number' || typeof v === 'boolean') {
      textParts.push(String(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => walk(item, key, depth + 1));
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, k, depth + 1);
    }
  };

  walk(data);
  return { text: uniqueJoin(textParts).slice(0, 12000), imageUrls };
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

export type CozeExcelRow = {
  account?: string;
  nickname?: string;
  title: string;
  keywords: string;
  coverFileName: string;
  qrFileName: string;
  avatarFileName?: string;
  exposureText?: string;
  engagementText?: string;
  videoUrl?: string;
  coverDataUrl?: string;
  qrDataUrl?: string;
  avatarDataUrl?: string;
};

function strField(obj: Record<string, unknown>, names: string[]): string {
  const lower = Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/\s/g, '').toLowerCase(), v]));
  for (const name of names) {
    const v = obj[name] ?? lower[name.toLowerCase()];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

function objectToExcelRow(item: Record<string, unknown>): CozeExcelRow | null {
  const title = strField(item, ['title', '文案标题', '标题', '文案', 'name', 'video_title', 'desc', 'caption']);
  const keywords = strField(item, ['keywords', '内容关键词', '视频关键词', '关键词', '话题', 'tags']);
  const account = strField(item, ['account', '账号', '账户']);
  const nickname = strField(item, ['nickname', '昵称', '账号昵称', 'author']);
  const videoUrl = strField(item, ['videoUrl', 'video_url', '视频链接', 'url', 'link', 'share_url']);
  const exposureText = strField(item, ['exposureText', 'exposure', '曝光量', '曝光', 'play_count', 'vv']);
  const engagementText = strField(item, ['engagementText', 'engagement', '互动量', '互动']);
  const coverFileName = strField(item, ['coverFileName', 'cover', '封面', 'cover_url']);
  if (!title && !videoUrl && !account && !nickname) return null;
  return {
    title: title || nickname || account || '未命名内容',
    keywords,
    coverFileName,
    qrFileName: strField(item, ['qrFileName', 'qr', '二维码']),
    avatarFileName: strField(item, ['avatarFileName', 'avatar', '头像']),
    videoUrl,
    account,
    nickname: nickname || account,
    exposureText,
    engagementText,
  };
}

export function excelRowsFromCoze(data: unknown): CozeExcelRow[] {
  const arrays: unknown[][] = [];
  const visit = (v: unknown, depth = 0) => {
    if (v == null || depth > 6) return;
    if (typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))) {
      try {
        visit(JSON.parse(v), depth + 1);
      } catch {
        /* ignore */
      }
      return;
    }
    if (Array.isArray(v)) {
      if (v.length && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))) arrays.push(v);
      else v.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof v === 'object') {
      for (const val of Object.values(v as Record<string, unknown>)) visit(val, depth + 1);
    }
  };
  visit(data);

  const rows: CozeExcelRow[] = [];
  const seen = new Set<string>();
  for (const arr of arrays) {
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const row = objectToExcelRow(item as Record<string, unknown>);
      if (!row) continue;
      const key = `${row.title}|${row.videoUrl}|${row.account}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows.slice(0, 50);
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

export function extractExcelUrl(data: unknown): string | null {
  const found: string[] = [];
  const visit = (v: unknown, key?: string, depth = 0) => {
    if (v == null || depth > 8) return;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return;
      if ((s.startsWith('{') || s.startsWith('[')) && s.length < 2_000_000) {
        try {
          visit(JSON.parse(s), key, depth + 1);
          return;
        } catch {
          /* ignore */
        }
      }
      const isExcelKey = /excel|xlsx|workbook|报表|表格/i.test(key || '');
      const isExcelUrl = /^https?:\/\//i.test(s) && (/\.(xlsx|xls|csv)(\?|$)/i.test(s) || isExcelKey);
      if (isExcelUrl) found.push(s);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((item) => visit(item, key, depth + 1));
      return;
    }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) visit(val, k, depth + 1);
    }
  };
  visit(data);
  return found[0] || null;
}

export async function fetchExcelBuffer(url: string): Promise<ArrayBuffer> {
  const resp = await fetch(url, {
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) throw new Error(`下载工作流 Excel 失败（HTTP ${resp.status}）`);
  return resp.arrayBuffer();
}

function isHttpUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

export async function hydrateRowImages(rows: CozeExcelRow[]): Promise<CozeExcelRow[]> {
  const next: CozeExcelRow[] = [];
  for (const row of rows) {
    const copy = { ...row };
    const jobs: Array<Promise<void>> = [];
    if (row.coverFileName && isHttpUrl(row.coverFileName) && !copy.coverDataUrl) {
      jobs.push(
        fetchAsDataUrl(row.coverFileName)
          .then((u) => {
            copy.coverDataUrl = u;
          })
          .catch(() => undefined),
      );
    }
    if (row.qrFileName && isHttpUrl(row.qrFileName) && !copy.qrDataUrl) {
      jobs.push(
        fetchAsDataUrl(row.qrFileName)
          .then((u) => {
            copy.qrDataUrl = u;
          })
          .catch(() => undefined),
      );
    }
    if (row.avatarFileName && isHttpUrl(row.avatarFileName) && !copy.avatarDataUrl) {
      jobs.push(
        fetchAsDataUrl(row.avatarFileName)
          .then((u) => {
            copy.avatarDataUrl = u;
          })
          .catch(() => undefined),
      );
    }
    if (jobs.length) await Promise.all(jobs);
    next.push(copy);
  }
  return next;
}
