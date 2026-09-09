export type Article = {
  id: string;
  account: string;
  accountAvatar: string;
  title: string;
  author: string;
  date: string;
  coverGradient: string;
  summaryTitle: string;
  listenScript: string[];
  paragraphs: string[];
  themes: { no: string; title: string; points: string[] }[];
};

export const articles: Article[] = [
  {
    id: "nature-cities-2026",
    account: "人因适老未来工作室",
    accountAvatar: "NC",
    title: "Nature Cities 2026年1~6期 主题及推文",
    author: "人因适老未来工作室",
    date: "2026年3月12日",
    coverGradient: "linear-gradient(145deg, #1a3a2f 0%, #0d1f1a 45%, #143528 100%)",
    summaryTitle: "Nature Cities 2026上半年",
    listenScript: [
      "本文整理了期刊 Nature Cities 在二零二六年一月至六月的核心主题与关键推文。",
      "第一，城市安全与流动性。关注城市风险、低收入城市骑行，以及气候规划中的移动公平。",
      "第二，理解城市的真实线索。从媒体、鸟类与街道视角，看鸟类迁徙与纽约行人流动。",
      "第三，城市基础设施的显性与隐性维度。覆盖社会网络、城市空间，以及地铁热环境问题。",
      "听完后，你可以继续用语音和元宝讨论：哪些主题和你的研究最相关。",
    ],
    paragraphs: [
      "本文整理了期刊 Nature Cities 在 2026 年 1–6 月的核心主题与关键推文，帮助读者快速把握半年研究主线。具体总结如下：",
    ],
    themes: [
      {
        no: "NO.1",
        title: "城市安全与流动性",
        points: [
          "城市风险治理如何影响日常出行决策",
          "低收入城市骑行基础设施与公平性",
          "气候规划中的移动可达性议题",
        ],
      },
      {
        no: "NO.2",
        title: "理解城市的真实线索",
        points: [
          "媒体叙事如何塑造城市感知",
          "鸟类迁徙作为城市生态指示",
          "纽约行人流动数据揭示街道活力",
        ],
      },
      {
        no: "NO.3",
        title: "城市基础设施的显性与隐性维度",
        points: [
          "社会网络与空间形态的耦合",
          "地铁热环境对舒适度与健康的影响",
          "隐性基础设施如何支撑城市韧性",
        ],
      },
    ],
  },
  {
    id: "spca-thermal",
    account: "城市热环境研究前沿",
    accountAvatar: "热",
    title:
      "热环境统计分析方法解析 | 空间主成分分析 (Spatial Principal Component Analysis)",
    author: "城市热环境研究前沿",
    date: "2026年2月28日",
    coverGradient: "linear-gradient(145deg, #2a1f14 0%, #15100c 50%, #3a2818 100%)",
    summaryTitle: "SPCA热环境分析总结",
    listenScript: [
      "这篇推文介绍空间主成分分析，也就是 SPCA，在城市热环境统计中的用法。",
      "传统主成分分析忽略空间依赖，容易把邻近区域的温度关联拆散。",
      "SPCA 把空间权重纳入分解，能识别热岛核心、边缘过渡带，以及季节性结构。",
      "对适老化与热适应用研究来说，它更适合解释老年人活动范围内的热暴露差异。",
    ],
    paragraphs: [
      "空间主成分分析（SPCA）是传统 PCA 在空间数据上的重要扩展，尤其适用于城市热环境的统计刻画。",
      "相较普通 PCA，SPCA 显式纳入空间邻接关系，可识别热岛核心区、过渡带与季节性主成分结构，为后续减热干预提供统计依据。",
    ],
    themes: [
      {
        no: "核心",
        title: "方法要点",
        points: [
          "纳入空间权重，保留邻域温度关联",
          "可分解热岛核心与边缘结构",
          "适合与适老化热暴露研究结合",
        ],
      },
    ],
  },
];

export const demoArticle = articles[0];
