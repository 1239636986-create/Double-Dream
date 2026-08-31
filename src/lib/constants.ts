/** PRD 组件框画板与卡片默认常量（750pt 宽） */

export const ARTBOARD_WIDTH = 750;
export const ARTBOARD_BASE_HEIGHT = 1334;

/** 组件框左侧账号区（头像 + 昵称，可选） */
export const ACCOUNT_SIDEBAR = {
  width: 100,
  avatarSize: 100,
  gapToCard: 12,
  /** 头像与昵称间距 */
  nicknameGap: 8,
  /** 画板左侧留给头像的边距 */
  artboardPad: 8,
} as const;

/** 基础组件框默认左缘（预留左侧账号区） */
export function cardOriginX(): number {
  return ACCOUNT_SIDEBAR.artboardPad + ACCOUNT_SIDEBAR.width + ACCOUNT_SIDEBAR.gapToCard;
}

export const CARD_DEFAULT = {
  width: 620,
  height: 168,
  marginX: 20,
  gap: 12,
  padding: 12,
  elementGap: 12,
  radius: 12,
  coverRadius: 8,
  /** 封面 W:H = 1:1.25 */
  coverRatio: 1 / 1.25,
  qrSize: 96,
  bg: '#FFFFFF',
  borderWidth: 0,
  borderColor: 'rgba(0,0,0,0.08)',
  borderOpacity: 1,
  fillOpacity: 1,
  firstGroupTop: 320,
  sectionGap: 48,
  /** 标题与投放数据间距（可被 titleKeywordGap 覆盖） */
  titleMetricsGap: 8,
  /** 投放数据与关键词间距 */
  metricsKeywordGap: 8,
} as const;

/** 投放数据渐变条：左小圆角 + 蓝紫渐变至透明（宽度随文案实测自适应） */
export const METRICS_BAR = {
  colorLeft: '#8EBCFF',
  colorMid: '#D8D1FF',
  padY: 5,
  padX: 10,
  cornerRadius: 4,
  minWidth: 48,
} as const;

export const FOOTER_DEFAULT = {
  text: '线上营销中心 · 新媒体精彩内容',
  gap: 48,
  height: 64,
  fontSize: 16,
  enabled: true,
} as const;

export const TYPOGRAPHY = {
  fontFamily: '"Noto Sans SC", "Source Han Sans SC", sans-serif',
  titleSize: 26,
  titleSizeMin: 18,
  titleSizeMax: 40,
  titleWeight: 600,
  keywordSize: 14,
  keywordSizeMin: 11,
  keywordSizeMax: 22,
  /** 细体 */
  keywordWeight: 300,
  metricsSize: 12,
  metricsSizeMin: 10,
  metricsSizeMax: 20,
  /** 细体 */
  metricsWeight: 300,
  nicknameSize: 14,
  nicknameSizeMin: 10,
  nicknameSizeMax: 22,
  nicknameWeight: 400,
  colorWhite: '#FFFFFF',
  colorBlack: '#000000',
  colorDarkGray: '#4A4A4A',
  /** 关键词 / 投放数据：中灰 */
  colorMidGray: '#8B8B8B',
} as const;

export const CARD_STYLE = {
  coverInsetMin: 0,
  coverInsetMax: 48,
  coverInsetDefault: 0,
  /** 二维码距组件框右侧 */
  qrInsetMin: 4,
  qrInsetMax: 64,
  qrInsetDefault: 12,
  /** 头像与组件框间距 */
  avatarGapMin: 4,
  avatarGapMax: 48,
  avatarGapDefault: 12,
  opacityMin: 10,
  opacityMax: 100,
  opacityDefault: 100,
  minTextWidth: 48,
  widthMin: 360,
  widthMax: 630,
  widthDefault: 620,
  /** 卡片左缘可调范围 */
  leftMin: 8,
  leftMax: 200,
  brightnessMin: 0,
  brightnessMax: 100,
  brightnessDefault: 100,
  titleKeywordGapMin: 4,
  titleKeywordGapMax: 32,
  titleKeywordGapDefault: 8,
  avatarSizeMin: 40,
  avatarSizeMax: 160,
  avatarSizeDefault: 100,
} as const;

export const MANUAL_BG = {
  opacityMin: 5,
  opacityMax: 100,
  opacityDefault: 100,
} as const;

/** 按明度生成卡片底色；100 = 纯白 */
export function cardFillFromBrightness(brightness: number): string {
  const t = Math.max(0, Math.min(100, brightness)) / 100;
  const v = Math.round(255 * t);
  return `rgb(${v}, ${v}, ${v})`;
}

/** 单次导入上限（周报常见 20+ 条） */
export const MAX_CARDS = 50;

export const BRUSH = {
  sizeMin: 5,
  sizeMax: 300,
  sizeDefault: 48,
  hardnessDefault: 0,
  opacityDefault: 40,
} as const;

export const PROJECT_VERSION = 2;

/** 热点特化描边色 */
export const HOTSPOT_BORDER_COLOR = '#FF471E';
export const HOTSPOT_STROKE_WIDTH = 2;

/** PNG 导出倍率（画板逻辑像素 × scale）；另支持「原图」自适应 */
export const EXPORT_SCALES = [1, 1.5, 2, 3] as const;
export type ExportScale = (typeof EXPORT_SCALES)[number];
export const EXPORT_SCALE_DEFAULT: ExportScale = 2;
/** 默认按素材分辨率自动选倍率（原图优先） */
export const EXPORT_SCALE_AUTO_DEFAULT = true;
/** PNG pHYs 物理分辨率元数据 */
export const EXPORT_PNG_DPI = 300;
/** 自适应倍率上限，避免超大文件 */
export const EXPORT_SCALE_AUTO_MAX = 3;
