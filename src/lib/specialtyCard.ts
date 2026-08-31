import type { SpecialtyCardStyle } from './types';

export type SpecialtyBgMode = 'dark' | 'white';

/** 侧光特化卡片默认参数 */
export const SPECIALTY_SIDE_GLOW = {
  id: 'sideGlow' as const,
  label: '侧光暗底',
  hint: '对角侧光 + 基础渐变描边',
  accentDefault: '#322422',
  glowHint: '#915C4E',
  bgDark: '#0A0A0A',
  bgWhite: '#FFFFFF',
  centerDark: '#0A0A0A',
  centerWhite: '#F7F7F7',
  bgModeDefault: 'dark' as SpecialtyBgMode,
  bgOpacityDefault: 72,
  angleDefault: 135,
  strokeWidthDefault: 1,
  strokeColorADefault: '#FFFFFF',
  strokeColorBDefault: '#A89080',
  strokeAngleDefault: 135,
  strokeOpacityDefault: 28,
  strokeOpacityADefault: 28,
  strokeOpacityBDefault: 28,
  glowOpacity: 0.22,
} as const;

export function normalizeSpecialtyStyle(
  style: SpecialtyCardStyle | string | undefined,
): SpecialtyCardStyle {
  if (style === 'sideGlow') return 'sideGlow';
  if (style === 'hotspot') return 'hotspot';
  return 'none';
}

/** 热点特化：白底 + 上透明下 FF471E 渐变描边 1pt */
export const SPECIALTY_HOTSPOT = {
  id: 'hotspot' as const,
  label: '热点描边',
  borderColor: '#FF471E',
  strokeWidth: 1,
} as const;

export function specialtyAccentOf(card: { specialtyAccentColor?: string }): string {
  return card.specialtyAccentColor || SPECIALTY_SIDE_GLOW.accentDefault;
}

export function specialtyBgModeOf(card: { specialtyBgMode?: SpecialtyBgMode | string }): SpecialtyBgMode {
  return card.specialtyBgMode === 'white' ? 'white' : 'dark';
}

export function specialtyBgOpacityOf(card: { specialtyBgOpacity?: number }): number {
  const n = card.specialtyBgOpacity;
  if (typeof n !== 'number' || Number.isNaN(n)) return SPECIALTY_SIDE_GLOW.bgOpacityDefault;
  return Math.max(0, Math.min(100, n));
}

export function specialtyBgColorOf(card: { specialtyBgMode?: SpecialtyBgMode | string }): string {
  return specialtyBgModeOf(card) === 'white'
    ? SPECIALTY_SIDE_GLOW.bgWhite
    : SPECIALTY_SIDE_GLOW.bgDark;
}

export function specialtyCenterOf(card: { specialtyBgMode?: SpecialtyBgMode | string }): string {
  return specialtyBgModeOf(card) === 'white'
    ? SPECIALTY_SIDE_GLOW.centerWhite
    : SPECIALTY_SIDE_GLOW.centerDark;
}

export function specialtyAngleOf(card: { specialtyAngle?: number }): number {
  const n = card.specialtyAngle;
  if (typeof n !== 'number' || Number.isNaN(n)) return SPECIALTY_SIDE_GLOW.angleDefault;
  return ((n % 360) + 360) % 360;
}

export function specialtyStrokeWidthOf(card: { specialtyStrokeWidth?: number }): number {
  const n = card.specialtyStrokeWidth;
  if (typeof n !== 'number' || Number.isNaN(n)) return SPECIALTY_SIDE_GLOW.strokeWidthDefault;
  return Math.max(0, Math.min(12, n));
}

export function specialtyStrokeColorAOf(card: { specialtyStrokeColorA?: string }): string {
  return card.specialtyStrokeColorA || SPECIALTY_SIDE_GLOW.strokeColorADefault;
}

export function specialtyStrokeColorBOf(card: { specialtyStrokeColorB?: string }): string {
  return card.specialtyStrokeColorB || SPECIALTY_SIDE_GLOW.strokeColorBDefault;
}

export function specialtyStrokeAngleOf(card: { specialtyStrokeAngle?: number }): number {
  const n = card.specialtyStrokeAngle;
  if (typeof n !== 'number' || Number.isNaN(n)) return SPECIALTY_SIDE_GLOW.strokeAngleDefault;
  return ((n % 360) + 360) % 360;
}

export function specialtyStrokeOpacityOf(card: { specialtyStrokeOpacity?: number }): number {
  const n = card.specialtyStrokeOpacity;
  if (typeof n !== 'number' || Number.isNaN(n)) return SPECIALTY_SIDE_GLOW.strokeOpacityDefault;
  return Math.max(0, Math.min(100, n));
}

export function specialtyStrokeOpacityAOf(card: {
  specialtyStrokeOpacityA?: number;
  specialtyStrokeOpacity?: number;
}): number {
  const n = card.specialtyStrokeOpacityA;
  if (typeof n === 'number' && !Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  return specialtyStrokeOpacityOf(card);
}

export function specialtyStrokeOpacityBOf(card: {
  specialtyStrokeOpacityB?: number;
  specialtyStrokeOpacity?: number;
}): number {
  const n = card.specialtyStrokeOpacityB;
  if (typeof n === 'number' && !Number.isNaN(n)) return Math.max(0, Math.min(100, n));
  return specialtyStrokeOpacityOf(card);
}

/** 画布 / 导出共用别名 */
export function specialtyCornerRadiusOf(card: { radius?: number }): number {
  return typeof card.radius === 'number' && !Number.isNaN(card.radius) ? card.radius : 20;
}

export function specialtyFillOf(card: { specialtyAngle?: number }): number {
  return specialtyAngleOf(card);
}

export function specialtyIsDarkOf(card: { specialtyBgMode?: SpecialtyBgMode | string }): boolean {
  return specialtyBgModeOf(card) === 'dark';
}

export function specialtyPanelOpacityOf(card: { specialtyBgOpacity?: number }): number {
  return specialtyBgOpacityOf(card);
}

export function angleToDir(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.cos(rad), y: Math.sin(rad) };
}

export function gradientLineForRect(
  width: number,
  height: number,
  deg: number,
): { x0: number; y0: number; x1: number; y1: number } {
  const { x: dx, y: dy } = angleToDir(deg);
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.hypot(width, height) / 2;
  return {
    x0: cx - dx * len,
    y0: cy - dy * len,
    x1: cx + dx * len,
    y1: cy + dy * len,
  };
}

export function hexToRgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return `rgba(50,36,34,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
