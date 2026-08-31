export type TextColor = '#FFFFFF' | '#000000';

/** 画布图层类型 */
export type LayerKind =
  | 'aiBackground'
  | 'manualBackground'
  | 'mainVisual'
  | 'cardGroup'
  | 'custom';

/** @deprecated 兼容旧代码 */
export type LayerId = LayerKind | 'background' | 'mask' | 'cards';

/** 特化卡片造型（仅造型/光影，不改排版） */
export type SpecialtyCardStyle = 'none' | 'sideGlow' | 'hotspot';

export interface CanvasLayer {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  /** 系统层不可删除 */
  locked: boolean;
  /** 0–100 */
  opacity: number;
  /** cardGroup 关联 cardGroups[].id */
  refId?: string;
  /** custom / 可选覆盖图 */
  dataUrl?: string | null;
  /** 自由图片图层变换（相对画板坐标，可超出画板） */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ExcelRow {
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
}

/** 数据导入草稿行（可编辑，驱动画板卡片） */
export interface ImportDraftRow {
  id: string;
  title: string;
  keywords: string;
  coverFileName: string;
  qrFileName: string;
  coverDataUrl: string;
  qrDataUrl: string;
  videoUrl?: string;
  account?: string;
  /** 账号昵称（画板左侧展示） */
  nickname?: string;
  avatarFileName?: string;
  avatarDataUrl?: string;
  /** 是否展示左侧账号区 */
  showAvatar?: boolean;
  /** 是否展示投放数据行 */
  showMetrics?: boolean;
  exposureText?: string;
  engagementText?: string;
  /** 封面在框内平移（相对居中） */
  coverOffsetX?: number;
  coverOffsetY?: number;
  /** 二维码在框内平移 */
  qrOffsetX?: number;
  qrOffsetY?: number;
}

/** 卡片分组：组内行序 = 画板卡片序；首组 spacing 为距顶，其后为距上一组底端 */
export interface CardGroup {
  id: string;
  name: string;
  rowIds: string[];
  spacing: number;
}

/** 素材库条目 */
export interface AssetLibItem {
  id: string;
  name: string;
  dataUrl: string;
  kind: 'cover' | 'qr' | 'auto';
}

export type ReplaceSlot = 'cover' | 'qr' | 'avatar';

export interface ReplaceTarget {
  cardId: string;
  slot: ReplaceSlot;
}

export interface CardItem {
  id: string;
  title: string;
  keywords: string;
  coverDataUrl: string;
  qrDataUrl: string;
  videoUrl?: string;
  account?: string;
  nickname?: string;
  avatarDataUrl?: string;
  showAvatar?: boolean;
  showMetrics?: boolean;
  exposureText?: string;
  engagementText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  textColor: TextColor;
  fill: string;
  fillOpacity: number;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
  radius: number;
  /** 封面在裁剪框内的平移偏移 */
  coverOffsetX?: number;
  coverOffsetY?: number;
  /** 二维码在框内的平移偏移 */
  qrOffsetX?: number;
  qrOffsetY?: number;
  /** 特化造型样式 */
  specialtyStyle?: SpecialtyCardStyle;
  /** 径向边缘色 / 对角外发光色 */
  specialtyAccentColor?: string;
  /** 特化面板透明度 0–100 */
  specialtyBgOpacity?: number;
  /** 特化背景：深色 / 白色 */
  specialtyBgMode?: 'dark' | 'white';
  /** 径向/对角侧光角度 0–360 */
  specialtyAngle?: number;
  /** 描边粗细 */
  specialtyStrokeWidth?: number;
  /** 描边渐变色 A */
  specialtyStrokeColorA?: string;
  /** 描边渐变色 B */
  specialtyStrokeColorB?: string;
  /** 描边色 A 透明度 0–100 */
  specialtyStrokeOpacityA?: number;
  /** 描边色 B 透明度 0–100 */
  specialtyStrokeOpacityB?: number;
  /** 描边渐变方向 0–360 */
  specialtyStrokeAngle?: number;
  /** @deprecated 兼容旧数据；优先使用 specialtyStrokeOpacityA/B */
  specialtyStrokeOpacity?: number;
}

export type ToolMode = 'select' | 'mask';

export interface BrushSettings {
  size: number;
  hardness: number;
  opacity: number;
  erase: boolean;
}

export interface LayerVisibility {
  background: boolean;
  mainVisual: boolean;
  mask: boolean;
  cards: boolean;
}

export interface FooterSettings {
  enabled: boolean;
  text: string;
  /** 与最后一张卡片底端的间距 */
  gap: number;
  height: number;
  fontSize: number;
  color: TextColor;
}

export interface ProjectStateSnapshot {
  version: number;
  artboardHeight: number;
  backgroundDataUrl: string | null;
  aiBackgroundDataUrl?: string | null;
  manualBackgroundDataUrl?: string | null;
  mainVisualDataUrl: string | null;
  maskDataUrl: string | null;
  mainVisual: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  cards: CardItem[];
  textColor: TextColor;
  layerVisible?: LayerVisibility;
  layerStack?: CanvasLayer[];
  cardGroups?: CardGroup[];
  footer?: FooterSettings;
}
