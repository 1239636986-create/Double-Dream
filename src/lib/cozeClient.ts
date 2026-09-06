export type CozePublicConfig = {
  configured: boolean;
  hasToken: boolean;
  runUrl: string;
};

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
};

export type CozeRunResult = {
  ok: boolean;
  text?: string;
  imageDataUrl?: string | null;
  imageUrls?: string[];
  rows?: CozeExcelRow[];
  data?: unknown;
  error?: string;
};

export async function fetchCozeConfig(): Promise<CozePublicConfig> {
  const resp = await fetch('/api/coze/config');
  if (!resp.ok) {
    throw new Error('无法读取扣子配置');
  }
  return (await resp.json()) as CozePublicConfig;
}

export async function runCozeWorkflow(opts: {
  start_date: string;
  end_date: string;
  video_urls: string[];
  raw_video_data?: unknown[];
  onProgress?: (msg: string) => void;
}): Promise<CozeRunResult> {
  opts.onProgress?.('正在调用扣子工作流…');
  const resp = await fetch('/api/coze/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start_date: opts.start_date,
      end_date: opts.end_date,
      video_urls: opts.video_urls,
      raw_video_data: opts.raw_video_data || [],
    }),
  });
  const json = (await resp.json()) as CozeRunResult & { error?: string };
  if (!resp.ok || json.error) {
    throw new Error(json.error || `扣子工作流失败（HTTP ${resp.status}）`);
  }
  opts.onProgress?.('工作流已完成');
  return json;
}
