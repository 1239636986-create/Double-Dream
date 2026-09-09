export type ChatRole = "user" | "assistant" | "system";

export type SummaryCard = {
  id: string;
  title: string;
  body: string;
  badge: string;
};

export type ChatMessage =
  | {
      id: string;
      role: "user";
      kind: "text" | "article" | "voice";
      text?: string;
      articleTitle?: string;
      articleSource?: string;
      voiceDuration?: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "text" | "summary-cards" | "voice" | "settlement-teaser";
      text?: string;
      cards?: SummaryCard[];
      voiceDuration?: string;
    };

export type VoiceTurn = {
  id: string;
  speaker: "user" | "yuanbao";
  transcript: string;
  duration: string;
};

export type SettlementItem = {
  id: string;
  type: "insight" | "action" | "quote" | "todo";
  title: string;
  detail: string;
};

export const initialChatSeed = (articleTitle: string, source: string): ChatMessage[] => [
  {
    id: "m1",
    role: "user",
    kind: "article",
    articleTitle,
    articleSource: source,
  },
  {
    id: "m2",
    role: "user",
    kind: "text",
    text: "这个说了什么",
  },
];

export const summaryReply: ChatMessage = {
  id: "m3",
  role: "assistant",
  kind: "summary-cards",
  cards: [
    {
      id: "c1",
      title: "Nature Cities 半年主题速览",
      body: "上半年主线围绕城市安全与流动性、真实城市线索、以及基础设施的显性与隐性维度展开，适合快速建立研究地图。",
      badge: "元来是这样",
    },
    {
      id: "c2",
      title: "和你可能相关的切入点",
      body: "地铁热环境、适老化热暴露与行人流动，可串成「移动中的热舒适」选题；文中也点到气候规划里的公平可达性。",
      badge: "元来是这样",
    },
  ],
};

export const voiceScript: VoiceTurn[] = [
  {
    id: "v1",
    speaker: "user",
    transcript: "我想听听，这篇和老年人热不适有什么关系？",
    duration: "0:06",
  },
  {
    id: "v2",
    speaker: "yuanbao",
    transcript:
      "文里第三主题提到地铁热环境。老年人在换乘、候车时更敏感，热不适会提前出现，也会影响他们愿不愿意出门。",
    duration: "0:14",
  },
  {
    id: "v3",
    speaker: "user",
    transcript: "那我下一步可以怎么用这些信息？",
    duration: "0:05",
  },
  {
    id: "v4",
    speaker: "yuanbao",
    transcript:
      "建议沉淀三件事：一是把「移动中的热舒适」写成研究问题；二是记下地铁与街道两类场景；三是后续可对照老年人减热行为建模那篇深读。",
    duration: "0:16",
  },
];

export const settlementItems: SettlementItem[] = [
  {
    id: "s1",
    type: "insight",
    title: "核心洞察",
    detail:
      "Nature Cities 上半年可用「安全流动 × 真实线索 × 显隐基础设施」三条线理解；与适老化最贴近的是地铁热环境与出行公平。",
  },
  {
    id: "s2",
    type: "quote",
    title: "对话金句",
    detail:
      "「老年人在换乘、候车时更敏感，热不适会提前出现，也会影响他们愿不愿意出门。」",
  },
  {
    id: "s3",
    type: "action",
    title: "可执行动作",
    detail: "把「移动中的热舒适」写成一页研究问题，并标注地铁 / 街道两类场景。",
  },
  {
    id: "s4",
    type: "todo",
    title: "待办",
    detail: "深读《老年人热不适差异的动态出现》并与本篇主题 NO.3 对照笔记。",
  },
];

export const listenLaterHint =
  "已加入稍后听。通勤时打开元宝，可继续听全文或语音追问。";
