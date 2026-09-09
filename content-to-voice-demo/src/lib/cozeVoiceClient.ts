export type CozeVoiceConfig = {
  configured: boolean;
  hasToken: boolean;
  runUrl: string;
  voice?: {
    endpoint: string;
    bodyParams: string[];
  };
};

export type CozeVoiceCard = { title: string; body: string };
export type CozeSettlementItem = { type: string; title: string; detail: string };

export type CozeVoiceResult = {
  ok: boolean;
  replyText: string;
  text?: string;
  cards: CozeVoiceCard[];
  settlement: CozeSettlementItem[];
  error?: string;
};

export async function fetchCozeVoiceConfig(): Promise<CozeVoiceConfig> {
  const resp = await fetch("/api/coze/config");
  if (!resp.ok) throw new Error("无法读取扣子配置（请确认已启动后端 npm run dev:server）");
  return (await resp.json()) as CozeVoiceConfig;
}

export async function runCozeVoice(opts: {
  article_content: string;
  article_title: string;
  user_question: string;
}): Promise<CozeVoiceResult> {
  const resp = await fetch("/api/coze/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const json = (await resp.json()) as CozeVoiceResult & { error?: string };
  if (!resp.ok || json.error) {
    throw new Error(json.error || `扣子语音工作流失败（HTTP ${resp.status}）`);
  }
  return {
    ok: true,
    replyText: json.replyText || json.text || "",
    cards: json.cards || [],
    settlement: json.settlement || [],
  };
}
