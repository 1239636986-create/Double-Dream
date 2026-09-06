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

export type CozeRunResult = {
  ok: boolean;
  text?: string;
  imageDataUrl?: string | null;
  imageUrls?: string[];
  debugUrl?: string;
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
  prompt?: string;
  imageBase64?: string;
  extraParameters?: Record<string, unknown>;
  onProgress?: (p: number, msg: string) => void;
}): Promise<CozeRunResult> {
  opts.onProgress?.(0.15, '正在调用扣子工作流…');
  const resp = await fetch('/api/coze/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: opts.prompt || '',
      imageBase64: opts.imageBase64,
      extraParameters: opts.extraParameters,
    }),
  });
  const json = (await resp.json()) as CozeRunResult & { error?: string };
  if (!resp.ok || json.error) {
    throw new Error(json.error || `扣子工作流失败（HTTP ${resp.status}）`);
  }
  opts.onProgress?.(1, '工作流已完成');
  return json;
}
