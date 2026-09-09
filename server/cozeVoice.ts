/** 元宝语音 / 公众号文本工作流（扣子编程已部署） */

export type CozeVoicePayload = {
  article_content: string;
  article_title: string;
  user_question: string;
};

export function normalizeVoicePayload(input: Partial<CozeVoicePayload>): CozeVoicePayload {
  return {
    article_content: String(input.article_content || "").trim(),
    article_title: String(input.article_title || "").trim(),
    user_question: String(input.user_question || "").trim(),
  };
}

export type ParsedVoiceResult = {
  replyText: string;
  cards: Array<{ title: string; body: string }>;
  settlement: Array<{ type: string; title: string; detail: string }>;
  rawText: string;
};

function tryParseJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      /* fall through */
    }
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      return null;
    }
  }
  return null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * 尽量从扣子返回里抽出：回复正文、总结卡片、沉淀条目。
 * 工作流输出形态可能是纯文本或 JSON，两种都兼容。
 */
export function parseVoiceWorkflowResult(data: unknown, fallbackText: string): ParsedVoiceResult {
  const cards: Array<{ title: string; body: string }> = [];
  const settlement: Array<{ type: string; title: string; detail: string }> = [];
  let replyText = "";

  const visit = (v: unknown, depth = 0) => {
    if (v == null || depth > 8) return;
    if (typeof v === "string") {
      const parsed = tryParseJson(v);
      if (parsed) visit(parsed, depth + 1);
      else if (!replyText && v.trim().length > 8) replyText = v.trim();
      return;
    }
    if (Array.isArray(v)) {
      // 卡片数组
      if (
        v.length &&
        v.every((item) => {
          const o = asRecord(item);
          return o && (o.title || o.body || o.content || o.detail);
        })
      ) {
        for (const item of v) {
          const o = asRecord(item)!;
          const title = pickString(o, ["title", "name", "heading"]);
          const body = pickString(o, ["body", "content", "text", "detail", "summary"]);
          const type = pickString(o, ["type", "kind", "category"]);
          if (type && (title || body)) {
            settlement.push({
              type: type.toLowerCase(),
              title: title || type,
              detail: body || title,
            });
          } else if (title || body) {
            cards.push({ title: title || "要点", body: body || title });
          }
        }
        return;
      }
      v.forEach((item) => visit(item, depth + 1));
      return;
    }
    const obj = asRecord(v);
    if (!obj) return;

    if (!replyText) {
      replyText = pickString(obj, [
        "reply",
        "answer",
        "response",
        "output",
        "result",
        "text",
        "message",
        "summary",
        "content",
      ]);
    }

    for (const [k, val] of Object.entries(obj)) {
      if (/card|summary|要点|卡片/i.test(k)) visit(val, depth + 1);
      else if (/settle|note|insight|todo|沉淀|整理/i.test(k)) visit(val, depth + 1);
      else if (typeof val === "object") visit(val, depth + 1);
    }
  };

  visit(data);

  if (!replyText) replyText = fallbackText.trim();
  return {
    replyText: replyText || "工作流已返回，但未解析到可读文本。",
    cards: cards.slice(0, 6),
    settlement: settlement.slice(0, 8),
    rawText: fallbackText,
  };
}
