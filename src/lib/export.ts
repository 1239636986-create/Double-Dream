import { writePsd } from 'ag-psd';
import { ARTBOARD_WIDTH, ACCOUNT_SIDEBAR, CARD_DEFAULT, CARD_STYLE, EXPORT_PNG_DPI, EXPORT_SCALE_AUTO_MAX, HOTSPOT_BORDER_COLOR, HOTSPOT_STROKE_WIDTH, METRICS_BAR, TYPOGRAPHY } from './constants';
import { computeCardContentLayout } from './cardLayout';
import { coverSourceRect, drawImageCoverHQ, drawImageStretchHQ } from './imageFit';
import {
  specialtyAccentOf,
  specialtyBgOpacityOf,
  specialtyBgModeOf,
  specialtyBgColorOf,
  specialtyCenterOf,
  specialtyAngleOf,
  specialtyStrokeWidthOf,
  specialtyStrokeColorAOf,
  specialtyStrokeColorBOf,
  specialtyStrokeAngleOf,
  specialtyStrokeOpacityAOf,
  specialtyStrokeOpacityBOf,
  normalizeSpecialtyStyle,
  SPECIALTY_SIDE_GLOW,
  gradientLineForRect,
  hexToRgba,
  angleToDir,
} from './specialtyCard';
import { wrapKeywordLines, wrapTitle } from './textLayout';
import type { CardItem, FooterSettings } from './types';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function measureFactory(ctx: CanvasRenderingContext2D) {
  return (s: string) => ctx.measureText(s).width;
}

function drawCard(ctx: CanvasRenderingContext2D, card: CardItem, ox: number, oy: number) {
  const x = card.x - ox;
  const y = card.y - oy;
  const { width: w, height: h, padding: pad, elementGap: gap, coverRatio, coverRadius } = {
    width: card.width,
    height: card.height,
    padding: CARD_DEFAULT.padding,
    elementGap: CARD_DEFAULT.elementGap,
    coverRatio: CARD_DEFAULT.coverRatio,
    coverRadius: CARD_DEFAULT.coverRadius,
  };

  ctx.save();
  // card bg
  roundRect(ctx, x, y, w, h, card.radius);
  ctx.globalAlpha = card.fillOpacity;
  ctx.fillStyle = card.fill;
  ctx.fill();
  ctx.globalAlpha = card.borderOpacity;
  ctx.lineWidth = card.borderWidth;
  ctx.strokeStyle = card.borderColor;
  ctx.stroke();
  ctx.globalAlpha = 1;

  const contentH = h - pad * 2;
  const coverH = contentH;
  const coverW = coverH * coverRatio;
  const qr = Math.min(CARD_DEFAULT.qrSize * (h / CARD_DEFAULT.height), contentH - 4);

  // cover
  const coverX = x + pad;
  const coverY = y + pad;
  if (card.coverDataUrl) {
    // drawn async by caller after images loaded — use placeholder path via image map
  }

  return { coverX, coverY, coverW, coverH, qr, pad, gap, contentH };
}

function formatMetricsLine(exposure?: string, engagement?: string) {
  const exp = (exposure || '').trim() || '—';
  const eng = (engagement || '').trim() || '—';
  return `曝光量：${exp}    互动量：${eng}`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  offsetX = 0,
  offsetY = 0,
  /** 导出倍率：在像素空间绘制原图采样，避免 transform 二次插值发糊 */
  exportScale = 1,
) {
  const s = Math.max(1, exportScale);
  const dx = x * s;
  const dy = y * s;
  const dw = w * s;
  const dh = h * s;
  const rr = r * s;
  ctx.save();
  // 脱离逻辑 transform，直接画到设备像素
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  roundRect(ctx, dx, dy, dw, dh, rr);
  ctx.clip();
  drawImageCoverHQ(ctx, img, dx, dy, dw, dh, offsetX, offsetY, w, h);
  ctx.restore();
}

/** 在像素空间高质量贴图（逻辑坐标 × scale） */
function drawStretchPixelHQ(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  exportScale: number,
) {
  const s = Math.max(1, exportScale);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawImageStretchHQ(ctx, img, x * s, y * s, w * s, h * s);
  ctx.restore();
}

export interface ExportInput {
  width: number;
  height: number;
  backgroundDataUrl: string | null;
  manualBackgroundDataUrl?: string | null;
  mainVisualDataUrl: string | null;
  /** mask: white opaque */
  maskDataUrl: string | null;
  mainVisual: { x: number; y: number; width: number; height: number } | null;
  cards: CardItem[];
  footer?: FooterSettings | null;
  layerStack?: import('./types').CanvasLayer[];
  cardGroups?: import('./types').CardGroup[];
  titleFontSize?: number;
  keywordFontSize?: number;
  nicknameFontSize?: number;
  metricsFontSize?: number;
  avatarSize?: number;
  coverInsetLeft?: number;
  titleKeywordGap?: number;
  qrInsetRight?: number;
  avatarGapToCard?: number;
  clip?: { x: number; y: number; width: number; height: number };
  /** 仅渲染这些图层（按 id）；用于「导出选中图层」 */
  onlyLayerIds?: string[];
  /** 单独导出时跳过页脚 */
  skipFooter?: boolean;
  /** 导出倍率：1 / 1.5 / 2；画布按此放大绘制（文字更锐） */
  scale?: number;
  /** PNG 物理 DPI 元数据，默认 300 */
  dpi?: number;
}

export async function renderPosterToCanvas(input: ExportInput): Promise<HTMLCanvasElement> {
  const clip = input.clip ?? { x: 0, y: 0, width: input.width, height: input.height };
  const scale = Math.max(1, input.scale ?? 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(clip.width * scale));
  canvas.height = Math.max(1, Math.round(clip.height * scale));
  const ctx = canvas.getContext('2d')!;

  // 逻辑坐标绘制，由 transform 放大到目标像素
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // PNG 默认透明底：不填充不透明底色
  ctx.clearRect(0, 0, clip.width, clip.height);

  const stack = input.layerStack?.length
    ? [...input.layerStack].reverse()
    : null;
  const only = input.onlyLayerIds?.length ? new Set(input.onlyLayerIds) : null;

  const drawAi = async (opacity = 1) => {
    if (!input.backgroundDataUrl) return;
    const bg = await loadImage(input.backgroundDataUrl);
    ctx.save();
    ctx.globalAlpha = opacity;
    drawStretchPixelHQ(ctx, bg, -clip.x, -clip.y, input.width, input.height, scale);
    ctx.restore();
  };
  const drawManual = async (opacity = 1) => {
    if (!input.manualBackgroundDataUrl) return;
    const bg = await loadImage(input.manualBackgroundDataUrl);
    ctx.save();
    ctx.globalAlpha = opacity;
    drawStretchPixelHQ(ctx, bg, -clip.x, -clip.y, input.width, input.height, scale);
    ctx.restore();
  };
  const drawMv = async (opacity = 1) => {
    if (!input.mainVisualDataUrl || !input.mainVisual) return;
    const mv = await loadImage(input.mainVisualDataUrl);
    const { x, y, width, height } = input.mainVisual;
    const lx = x - clip.x;
    const ly = y - clip.y;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (input.maskDataUrl) {
      const mask = await loadImage(input.maskDataUrl);
      const pw = Math.max(1, Math.round(width * scale));
      const ph = Math.max(1, Math.round(height * scale));
      const off = document.createElement('canvas');
      off.width = pw;
      off.height = ph;
      const octx = off.getContext('2d')!;
      // 原图像素一次采样到最终尺寸，再套蒙版，避免二次缩放
      drawImageStretchHQ(octx, mv, 0, 0, pw, ph);
      octx.globalCompositeOperation = 'destination-in';
      drawImageStretchHQ(octx, mask, 0, 0, pw, ph);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, Math.round(lx * scale), Math.round(ly * scale));
      ctx.restore();
    } else {
      drawStretchPixelHQ(ctx, mv, lx, ly, width, height, scale);
    }
    ctx.restore();
  };
  const cardStyle = {
    titleFontSize: input.titleFontSize ?? TYPOGRAPHY.titleSize,
    keywordFontSize: input.keywordFontSize ?? TYPOGRAPHY.keywordSize,
    nicknameFontSize: input.nicknameFontSize ?? TYPOGRAPHY.nicknameSize,
    metricsFontSize: input.metricsFontSize ?? TYPOGRAPHY.metricsSize,
    avatarSize: input.avatarSize ?? CARD_STYLE.avatarSizeDefault,
    coverInsetLeft: input.coverInsetLeft ?? CARD_STYLE.coverInsetDefault,
    titleKeywordGap: input.titleKeywordGap ?? CARD_STYLE.titleKeywordGapDefault,
    qrInsetRight: input.qrInsetRight ?? CARD_STYLE.qrInsetDefault,
    avatarGapToCard: input.avatarGapToCard ?? CARD_STYLE.avatarGapDefault,
  };
  const drawCards = async (rowIds?: string[], opacity = 1) => {
    const list = rowIds ? input.cards.filter((c) => rowIds.includes(c.id)) : input.cards;
    ctx.save();
    ctx.globalAlpha = opacity;
    for (const card of list) {
      await paintCard(ctx, card, clip.x, clip.y, cardStyle, scale);
    }
    ctx.restore();
  };
  const drawCustom = async (layer: import('./types').CanvasLayer) => {
    if (!layer.dataUrl) return;
    const img = await loadImage(layer.dataUrl);
    const opacity = (layer.opacity ?? 100) / 100;
    ctx.save();
    ctx.globalAlpha = opacity;
    if (layer.width != null && layer.height != null) {
      drawStretchPixelHQ(
        ctx,
        img,
        (layer.x ?? 0) - clip.x,
        (layer.y ?? 0) - clip.y,
        layer.width,
        layer.height,
        scale,
      );
    } else {
      drawStretchPixelHQ(ctx, img, -clip.x, -clip.y, input.width, input.height, scale);
    }
    ctx.restore();
  };

  if (stack) {
    for (const layer of stack) {
      if (only) {
        if (!only.has(layer.id)) continue;
      } else if (!layer.visible) {
        continue;
      }
      const opacity = (layer.opacity ?? 100) / 100;
      if (layer.kind === 'aiBackground') await drawAi(opacity);
      else if (layer.kind === 'manualBackground') await drawManual(opacity);
      else if (layer.kind === 'mainVisual') await drawMv(opacity);
      else if (layer.kind === 'cardGroup')
        await drawCards(
          layer.refId ? input.cardGroups?.find((g) => g.id === layer.refId)?.rowIds : undefined,
          opacity,
        );
      else if (layer.kind === 'custom') await drawCustom(layer);
    }
  } else {
    await drawAi();
    await drawManual();
    await drawMv();
    await drawCards();
  }

  if (!input.skipFooter && input.footer?.enabled && input.footer.text) {
    paintFooter(ctx, input.footer, input.cards, input.width, input.height, clip.x, clip.y);
  }

  return canvas;
}

export function footerTopY(cards: CardItem[], footer: FooterSettings): number {
  if (!cards.length) return Math.max(0, footer.gap);
  const bottom = Math.max(...cards.map((c) => c.y + c.height));
  return bottom + footer.gap;
}

function paintFooter(
  ctx: CanvasRenderingContext2D,
  footer: FooterSettings,
  cards: CardItem[],
  artboardW: number,
  _artboardH: number,
  ox: number,
  oy: number,
) {
  const y = footerTopY(cards, footer) - oy;
  ctx.save();
  ctx.fillStyle = footer.color;
  ctx.globalAlpha = 0.88;
  ctx.font = `500 ${footer.fontSize}px ${TYPOGRAPHY.fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(footer.text, artboardW / 2 - ox, y + footer.height / 2);
  ctx.restore();
}

async function paintCard(
  ctx: CanvasRenderingContext2D,
  card: CardItem,
  ox: number,
  oy: number,
  style?: {
    titleFontSize: number;
    keywordFontSize: number;
    coverInsetLeft: number;
    titleKeywordGap: number;
    nicknameFontSize?: number;
    metricsFontSize?: number;
    avatarSize?: number;
    qrInsetRight?: number;
    avatarGapToCard?: number;
  },
  exportScale = 1,
) {
  const x = card.x - ox;
  const y = card.y - oy;
  const w = card.width;
  const h = card.height;
  const metricsFontSize = style?.metricsFontSize ?? TYPOGRAPHY.metricsSize;
  const titleKeywordGap = style?.titleKeywordGap ?? CARD_STYLE.titleKeywordGapDefault;
  const metricsLine = formatMetricsLine(card.exposureText, card.engagementText);
  ctx.font = `${TYPOGRAPHY.metricsWeight} ${metricsFontSize}px ${TYPOGRAPHY.fontFamily}`;
  const layout = computeCardContentLayout(w, h, {
    coverInsetLeft: style?.coverInsetLeft ?? CARD_STYLE.coverInsetDefault,
    titleFontSize: style?.titleFontSize ?? TYPOGRAPHY.titleSize,
    keywordFontSize: style?.keywordFontSize ?? TYPOGRAPHY.keywordSize,
    metricsFontSize,
    showMetrics: card.showMetrics,
    titleKeywordGap,
    qrInsetRight: style?.qrInsetRight ?? CARD_STYLE.qrInsetDefault,
    metricsText: metricsLine,
    measureMetrics: (s) => ctx.measureText(s).width,
  });
  const nicknameFontSize = style?.nicknameFontSize ?? TYPOGRAPHY.nicknameSize;
  const specialty = normalizeSpecialtyStyle(card.specialtyStyle);
  const isSideGlow = specialty === 'sideGlow';
  const isHotspot = specialty === 'hotspot';
  const isWhiteText = card.textColor === '#FFFFFF';
  const titleColor = isWhiteText ? TYPOGRAPHY.colorWhite : TYPOGRAPHY.colorBlack;
  const subColor = isWhiteText ? 'rgba(255,255,255,0.78)' : TYPOGRAPHY.colorMidGray;
  const nickColor = isWhiteText ? 'rgba(255,255,255,0.88)' : TYPOGRAPHY.colorDarkGray;
  const avatarSize = style?.avatarSize ?? CARD_STYLE.avatarSizeDefault;
  const avatarGap = style?.avatarGapToCard ?? CARD_STYLE.avatarGapDefault;
  const radius = card.radius;
  const accent = specialtyAccentOf(card);
  const bgOpacity = specialtyBgOpacityOf(card);
  const angle = specialtyAngleOf(card);
  const strokeWidth = specialtyStrokeWidthOf(card);
  const strokeColorA = specialtyStrokeColorAOf(card);
  const strokeColorB = specialtyStrokeColorBOf(card);
  const strokeAngle = specialtyStrokeAngleOf(card);
  const strokeOpacityA = specialtyStrokeOpacityAOf(card) / 100;
  const strokeOpacityB = specialtyStrokeOpacityBOf(card) / 100;

  ctx.save();

  if (isSideGlow) {
    const bgMode = specialtyBgModeOf(card);
    const bgColor = specialtyBgColorOf(card);
    const centerColor = specialtyCenterOf(card);
    const isWhite = bgMode === 'white';
    const panelAlpha = bgOpacity / 100;
    const dir = angleToDir(angle);
    const fillLine = gradientLineForRect(w, h, angle);
    const strokeLine = gradientLineForRect(w, h, strokeAngle);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const diag = Math.hypot(w, h);
    const glowDist = diag * 0.42;
    const glowR = Math.min(w, h) * 0.55;
    const g1 = { x: cx - dir.x * glowDist, y: cy - dir.y * glowDist };
    const g2 = { x: cx + dir.x * glowDist, y: cy + dir.y * glowDist };

    // 对角外发光
    ctx.save();
    ctx.globalAlpha = 0.55 + panelAlpha * 0.45;
    for (const g of [g1, g2]) {
      const rg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, glowR);
      rg.addColorStop(0, hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity));
      rg.addColorStop(0.5, hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity * 0.3));
      rg.addColorStop(1, hexToRgba(accent, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(g.x - glowR, g.y - glowR, glowR * 2, glowR * 2);
    }
    ctx.restore();

    // 底板 + 对角侧光（无玻璃霜面/高光）
    ctx.save();
    roundRect(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.globalAlpha = panelAlpha;

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    const lg = ctx.createLinearGradient(
      x + fillLine.x0,
      y + fillLine.y0,
      x + fillLine.x1,
      y + fillLine.y1,
    );
    lg.addColorStop(0, hexToRgba(accent, isWhite ? 0.35 : 0.7));
    lg.addColorStop(0.38, hexToRgba(centerColor, isWhite ? 0.35 : 0.55));
    lg.addColorStop(0.62, hexToRgba(centerColor, isWhite ? 0.35 : 0.55));
    lg.addColorStop(1, hexToRgba(accent, isWhite ? 0.28 : 0.65));
    ctx.fillStyle = lg;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // 基础渐变描边（A/B 各自透明度）
    if (strokeWidth > 0 && (strokeOpacityA > 0 || strokeOpacityB > 0)) {
      ctx.save();
      const hw = strokeWidth / 2;
      roundRect(ctx, x + hw, y + hw, w - strokeWidth, h - strokeWidth, Math.max(0, radius - hw));
      const sg = ctx.createLinearGradient(
        x + strokeLine.x0,
        y + strokeLine.y0,
        x + strokeLine.x1,
        y + strokeLine.y1,
      );
      sg.addColorStop(0, hexToRgba(strokeColorA, strokeOpacityA));
      sg.addColorStop(1, hexToRgba(strokeColorB, strokeOpacityB));
      ctx.strokeStyle = sg;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
      ctx.restore();
    }
  } else if (isHotspot) {
    roundRect(ctx, x, y, w, h, radius);
    ctx.globalAlpha = card.fillOpacity;
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.globalAlpha = 1;
    const inset = HOTSPOT_STROKE_WIDTH / 2;
    roundRect(
      ctx,
      x + inset,
      y + inset,
      w - inset * 2,
      h - inset * 2,
      Math.max(0, radius - inset),
    );
    const g = ctx.createLinearGradient(x + inset, y + inset, x + inset, y + h - inset);
    g.addColorStop(0, 'rgba(255,71,30,0)');
    g.addColorStop(1, HOTSPOT_BORDER_COLOR);
    ctx.strokeStyle = g;
    ctx.lineWidth = HOTSPOT_STROKE_WIDTH;
    ctx.stroke();
  } else {
    roundRect(ctx, x, y, w, h, radius);
    ctx.globalAlpha = card.fillOpacity;
    ctx.fillStyle = card.fill;
    ctx.fill();
    if (card.borderWidth > 0) {
      ctx.globalAlpha = card.borderOpacity;
      ctx.lineWidth = card.borderWidth;
      ctx.strokeStyle = card.borderColor;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  if (card.showAvatar) {
    const nick = card.nickname || card.account || '昵称';
    ctx.font = `${TYPOGRAPHY.nicknameWeight} ${nicknameFontSize}px ${TYPOGRAPHY.fontFamily}`;
    const nickW = Math.ceil(ctx.measureText(nick).width);
    const sidebarW = Math.max(avatarSize, nickW + 4);
    const sidebarX = x - sidebarW - avatarGap;
    const avatarX = sidebarX + (sidebarW - avatarSize) / 2;
    const avatarY = y + (h - avatarSize) / 2;
    if (card.avatarDataUrl) {
      const av = await loadImage(card.avatarDataUrl);
      const s = Math.max(1, exportScale);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      const cx = (avatarX + avatarSize / 2) * s;
      const cy = (avatarY + avatarSize / 2) * s;
      const r = (avatarSize / 2) * s;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      drawImageCoverHQ(
        ctx,
        av,
        avatarX * s,
        avatarY * s,
        avatarSize * s,
        avatarSize * s,
        0,
        0,
        avatarSize,
        avatarSize,
      );
      ctx.restore();
    } else {
      ctx.fillStyle = '#E8E8E8';
      ctx.beginPath();
      const cx = avatarX + avatarSize / 2;
      const cy = avatarY + avatarSize / 2;
      ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = nickColor;
    ctx.font = `${TYPOGRAPHY.nicknameWeight} ${nicknameFontSize}px ${TYPOGRAPHY.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(nick, sidebarX + sidebarW / 2, avatarY + avatarSize + ACCOUNT_SIDEBAR.nicknameGap);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }

  if (card.coverDataUrl) {
    const cover = await loadImage(card.coverDataUrl);
    await drawRoundedImage(
      ctx,
      cover,
      x + layout.coverX,
      y + layout.coverY,
      layout.coverW,
      layout.coverH,
      CARD_DEFAULT.coverRadius,
      card.coverOffsetX ?? 0,
      card.coverOffsetY ?? 0,
      exportScale,
    );
  }

  if (card.qrDataUrl) {
    const qr = await loadImage(card.qrDataUrl);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + layout.qrX - 4, y + layout.qrY - 4, layout.qrSize + 8, layout.qrSize + 8);
    const qx = x + layout.qrX;
    const qy = y + layout.qrY;
    const qs = layout.qrSize;
    const s = Math.max(1, exportScale);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath();
    ctx.rect(qx * s, qy * s, qs * s, qs * s);
    ctx.clip();
    drawImageCoverHQ(
      ctx,
      qr,
      qx * s,
      qy * s,
      qs * s,
      qs * s,
      card.qrOffsetX ?? 0,
      card.qrOffsetY ?? 0,
      qs,
      qs,
    );
    ctx.restore();
  }

  ctx.fillStyle = titleColor;
  ctx.textBaseline = 'top';
  ctx.font = `${TYPOGRAPHY.titleWeight} ${layout.titleSize}px ${TYPOGRAPHY.fontFamily}`;
  const measure = measureFactory(ctx);
  const titleMaxLines = Math.min(6, Math.max(2, (card.title.match(/\n/g)?.length ?? 0) + 2));
  const lines = wrapTitle(card.title, layout.textW, measure, titleMaxLines);
  const lineH = layout.titleSize * 1.25;
  const kwLineH = layout.kwSize * 1.25;
  ctx.font = `${TYPOGRAPHY.keywordWeight} ${layout.kwSize}px ${TYPOGRAPHY.fontFamily}`;
  const kwLines = wrapKeywordLines(card.keywords, layout.textW, measureFactory(ctx), 4);
  const blockH =
    lines.length * lineH +
    (layout.showMetrics
      ? layout.titleMetricsGap + layout.metricsBlockH + layout.metricsKeywordGap
      : titleKeywordGap) +
    kwLines.length * kwLineH;
  let ty = y + (h - blockH) / 2;

  ctx.font = `${TYPOGRAPHY.titleWeight} ${layout.titleSize}px ${TYPOGRAPHY.fontFamily}`;
  for (const line of lines) {
    ctx.fillText(line, x + layout.textX, ty);
    ty += lineH;
  }

  if (layout.showMetrics) {
    ty += layout.titleMetricsGap;
    const barH = layout.metricsBarHeight;
    const barW = layout.metricsBarW;
    const barX = x + layout.textX;
    const barY = ty;
    const r = Math.min(layout.metricsCornerRadius, barH / 2);
    ctx.beginPath();
    ctx.moveTo(barX + r, barY);
    ctx.lineTo(barX + barW, barY);
    ctx.lineTo(barX + barW, barY + barH);
    ctx.lineTo(barX + r, barY + barH);
    ctx.quadraticCurveTo(barX, barY + barH, barX, barY + barH - r);
    ctx.lineTo(barX, barY + r);
    ctx.quadraticCurveTo(barX, barY, barX + r, barY);
    ctx.closePath();
    const lg = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    lg.addColorStop(0, METRICS_BAR.colorLeft);
    lg.addColorStop(0.45, METRICS_BAR.colorMid);
    lg.addColorStop(1, 'rgba(216,209,255,0)');
    ctx.fillStyle = lg;
    ctx.fill();

    ctx.fillStyle = subColor;
    ctx.font = `${TYPOGRAPHY.metricsWeight} ${layout.metricsSize}px ${TYPOGRAPHY.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(
      formatMetricsLine(card.exposureText, card.engagementText),
      barX + layout.metricsPadX,
      barY + barH / 2,
    );
    ctx.textBaseline = 'top';
    ty += layout.metricsBlockH + layout.metricsKeywordGap;
  } else {
    ty += titleKeywordGap;
  }

  ctx.fillStyle = subColor;
  ctx.font = `${TYPOGRAPHY.keywordWeight} ${layout.kwSize}px ${TYPOGRAPHY.fontFamily}`;
  for (const line of kwLines) {
    ctx.fillText(line, x + layout.textX, ty);
    ty += kwLineH;
  }

  ctx.restore();
}

export async function exportPng(input: ExportInput, filename = 'poster.png') {
  const canvas = await renderPosterToCanvas(input);
  await downloadCanvasPng(canvas, filename, input.dpi ?? EXPORT_PNG_DPI);
}

/** CRC32 for PNG chunks */
const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function pngCrc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = PNG_CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32be(n: number): Uint8Array {
  return new Uint8Array([(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff]);
}

/** 向 PNG 写入 pHYs（每米像素数），标记物理 DPI；保持无损 */
export function injectPngDpi(png: ArrayBuffer, dpi = EXPORT_PNG_DPI): Blob {
  const src = new Uint8Array(png);
  if (src.length < 33 || src[0] !== 0x89 || src[1] !== 0x50) {
    return new Blob([src], { type: 'image/png' });
  }
  // 跳过签名，读 IHDR
  let offset = 8;
  const ihdrLen = (src[offset] << 24) | (src[offset + 1] << 16) | (src[offset + 2] << 8) | src[offset + 3];
  const ihdrType = String.fromCharCode(src[offset + 4], src[offset + 5], src[offset + 6], src[offset + 7]);
  if (ihdrType !== 'IHDR') return new Blob([src], { type: 'image/png' });
  const insertAt = offset + 12 + ihdrLen; // after IHDR crc

  // 若已有 pHYs 则替换；否则插入
  let endExistingPhys = insertAt;
  if (
    src.length >= insertAt + 12 &&
    String.fromCharCode(src[insertAt + 4], src[insertAt + 5], src[insertAt + 6], src[insertAt + 7]) ===
      'pHYs'
  ) {
    const physLen =
      (src[insertAt] << 24) | (src[insertAt + 1] << 16) | (src[insertAt + 2] << 8) | src[insertAt + 3];
    endExistingPhys = insertAt + 12 + physLen;
  }

  const ppm = Math.round(dpi / 0.0254); // pixels per meter
  const physData = new Uint8Array(9);
  physData.set(u32be(ppm), 0);
  physData.set(u32be(ppm), 4);
  physData[8] = 1; // unit: meter
  const typeBytes = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // pHYs
  const crcInput = new Uint8Array(4 + physData.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(physData, 4);
  const crc = pngCrc32(crcInput);
  const chunk = new Uint8Array(4 + 4 + physData.length + 4);
  chunk.set(u32be(physData.length), 0);
  chunk.set(typeBytes, 4);
  chunk.set(physData, 8);
  chunk.set(u32be(crc), 8 + physData.length);

  const out = new Uint8Array(src.length - (endExistingPhys - insertAt) + chunk.length);
  out.set(src.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(src.subarray(endExistingPhys), insertAt + chunk.length);
  return new Blob([out], { type: 'image/png' });
}

/**
 * 无损 PNG 下载（image/png，不经 JPEG 有损）；写入 DPI 元数据
 */
export async function downloadCanvasPng(
  canvas: HTMLCanvasElement,
  filename: string,
  dpi = EXPORT_PNG_DPI,
) {
  const raw = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'), // PNG 本身无损，勿传 quality
  );
  if (!raw) throw new Error('PNG 导出失败');
  const buf = await raw.arrayBuffer();
  const blob = injectPngDpi(buf, dpi);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportPsd(input: ExportInput, filename = 'poster.psd') {
  const width = input.clip?.width ?? input.width;
  const height = input.clip?.height ?? input.height;
  const ox = input.clip?.x ?? 0;
  const oy = input.clip?.y ?? 0;

  const children: unknown[] = [];

  // background
  {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#1a120e';
    ctx.fillRect(0, 0, width, height);
    if (input.backgroundDataUrl) {
      const bg = await loadImage(input.backgroundDataUrl);
      ctx.drawImage(bg, -ox, -oy, input.width, input.height);
    }
    children.push({ name: '背景', canvas: c });
  }

  // main visual
  if (input.mainVisualDataUrl && input.mainVisual) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d')!;
    const mv = await loadImage(input.mainVisualDataUrl);
    const { x, y, width: mw, height: mh } = input.mainVisual;
    if (input.maskDataUrl) {
      const mask = await loadImage(input.maskDataUrl);
      const off = document.createElement('canvas');
      off.width = mw;
      off.height = mh;
      const octx = off.getContext('2d')!;
      octx.drawImage(mv, 0, 0, mw, mh);
      octx.globalCompositeOperation = 'destination-in';
      octx.drawImage(mask, 0, 0, mw, mh);
      ctx.drawImage(off, x - ox, y - oy);
    } else {
      ctx.drawImage(mv, x - ox, y - oy, mw, mh);
    }
    children.push({ name: '主视觉', canvas: c });
  }

  for (let i = 0; i < input.cards.length; i++) {
    const card = input.cards[i];
    const groupChildren: unknown[] = [];

    // cover layer
    if (card.coverDataUrl) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d')!;
      const pad = CARD_DEFAULT.padding;
      const coverH = card.height - pad * 2;
      const coverW = coverH * CARD_DEFAULT.coverRatio;
      const cover = await loadImage(card.coverDataUrl);
      await drawRoundedImage(
        ctx,
        cover,
        card.x - ox + pad,
        card.y - oy + pad,
        coverW,
        coverH,
        CARD_DEFAULT.coverRadius,
      );
      groupChildren.push({ name: '封面', canvas: c });
    }

    // title text layer (editable)
    {
      const titleSize = TYPOGRAPHY.titleSize * (card.height / CARD_DEFAULT.height);
      groupChildren.push({
        name: '标题',
        text: {
          text: card.title,
          font: { name: 'Noto Sans SC', size: titleSize },
          color: hexToRgb(card.textColor),
        },
        left: card.x - ox + CARD_DEFAULT.padding + (card.height - CARD_DEFAULT.padding * 2) * CARD_DEFAULT.coverRatio + CARD_DEFAULT.elementGap,
        top: card.y - oy + card.height / 2 - titleSize,
      });
    }

    // keywords
    {
      const kwSize = TYPOGRAPHY.keywordSize * (card.height / CARD_DEFAULT.height);
      groupChildren.push({
        name: '关键词',
        text: {
          text: card.keywords,
          font: { name: 'Noto Sans SC', size: kwSize },
          color: hexToRgb(card.textColor),
        },
        left: card.x - ox + CARD_DEFAULT.padding + (card.height - CARD_DEFAULT.padding * 2) * CARD_DEFAULT.coverRatio + CARD_DEFAULT.elementGap,
        top: card.y - oy + card.height / 2 + 8,
      });
    }

    // qr
    if (card.qrDataUrl) {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d')!;
      const qrSize = Math.min(CARD_DEFAULT.qrSize * (card.height / CARD_DEFAULT.height), card.height - CARD_DEFAULT.padding * 2);
      const qrX = card.x - ox + card.width - CARD_DEFAULT.padding - qrSize;
      const qrY = card.y - oy + (card.height - qrSize) / 2;
      const qr = await loadImage(card.qrDataUrl);
      ctx.fillStyle = '#fff';
      ctx.fillRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8);
      ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);
      groupChildren.push({ name: '二维码', canvas: c });
    }

    children.push({
      name: `卡片${i + 1}`,
      children: groupChildren,
      opened: true,
    });
  }

  const psd = {
    width,
    height,
    children,
  };

  const buffer = writePsd(psd as Parameters<typeof writePsd>[0]);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function snapExportScale(ratio: number): number {
  const capped = Math.min(EXPORT_SCALE_AUTO_MAX, Math.max(1, ratio));
  if (capped >= 2.75) return 3;
  if (capped >= 1.85) return 2;
  if (capped >= 1.25) return 1.5;
  return 1;
}

/**
 * 按素材原图像素估算导出倍率：让封面/二维码/主视觉等尽量接近 1:1 原图像素采样（有上限）
 */
export async function computeNativeExportScale(input: ExportInput): Promise<number> {
  let maxRatio = 1.5;
  const bump = (srcPx: number, logicalPx: number) => {
    if (srcPx > 0 && logicalPx > 0) maxRatio = Math.max(maxRatio, srcPx / logicalPx);
  };
  const consider = async (
    url: string | null | undefined,
    frameW: number,
    frameH: number,
    offsetX = 0,
    offsetY = 0,
  ) => {
    if (!url || frameW <= 0 || frameH <= 0) return;
    try {
      const img = await loadImage(url);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (!iw || !ih) return;
      const { sw, sh } = coverSourceRect(iw, ih, frameW, frameH, offsetX, offsetY);
      bump(sw, frameW);
      bump(sh, frameH);
    } catch {
      /* ignore broken assets */
    }
  };

  await consider(input.backgroundDataUrl, input.width, input.height);
  await consider(input.manualBackgroundDataUrl, input.width, input.height);
  if (input.mainVisual) {
    await consider(input.mainVisualDataUrl, input.mainVisual.width, input.mainVisual.height);
  }

  const avatarSize = input.avatarSize ?? CARD_STYLE.avatarSizeDefault;
  for (const card of input.cards) {
    const metricsLine = formatMetricsLine(card.exposureText, card.engagementText);
    // 布局测量与字号无关紧要，给固定 measure
    const layout = computeCardContentLayout(card.width, card.height, {
      coverInsetLeft: input.coverInsetLeft ?? CARD_STYLE.coverInsetDefault,
      titleFontSize: input.titleFontSize ?? TYPOGRAPHY.titleSize,
      keywordFontSize: input.keywordFontSize ?? TYPOGRAPHY.keywordSize,
      metricsFontSize: input.metricsFontSize ?? TYPOGRAPHY.metricsSize,
      showMetrics: card.showMetrics,
      titleKeywordGap: input.titleKeywordGap ?? CARD_STYLE.titleKeywordGapDefault,
      qrInsetRight: input.qrInsetRight ?? CARD_STYLE.qrInsetDefault,
      metricsText: metricsLine,
      measureMetrics: (s) => s.length * 7,
    });
    await consider(
      card.coverDataUrl,
      layout.coverW,
      layout.coverH,
      card.coverOffsetX ?? 0,
      card.coverOffsetY ?? 0,
    );
    await consider(
      card.qrDataUrl,
      layout.qrSize,
      layout.qrSize,
      card.qrOffsetX ?? 0,
      card.qrOffsetY ?? 0,
    );
    if (card.showAvatar && card.avatarDataUrl) {
      await consider(card.avatarDataUrl, avatarSize, avatarSize);
    }
  }

  for (const layer of input.layerStack || []) {
    if (layer.kind === 'custom' && layer.dataUrl && layer.width != null && layer.height != null) {
      await consider(layer.dataUrl, layer.width, layer.height);
    }
  }

  return snapExportScale(maxRatio);
}

export async function resolveExportScale(
  input: ExportInput,
  opts: { scale?: number; auto?: boolean },
): Promise<number> {
  if (opts.auto) return computeNativeExportScale(input);
  return Math.max(1, opts.scale ?? 1);
}

export function artboardExportInput(state: {
  artboardHeight: number;
  backgroundDataUrl: string | null;
  aiBackgroundDataUrl?: string | null;
  manualBackgroundDataUrl?: string | null;
  mainVisualDataUrl: string | null;
  maskCanvas: HTMLCanvasElement | null;
  mainVisual: { x: number; y: number; width: number; height: number } | null;
  cards: CardItem[];
  footer?: FooterSettings;
  layerStack?: import('./types').CanvasLayer[];
  cardGroups?: import('./types').CardGroup[];
  titleFontSize?: number;
  keywordFontSize?: number;
  nicknameFontSize?: number;
  metricsFontSize?: number;
  avatarSize?: number;
  coverInsetLeft?: number;
  titleKeywordGap?: number;
  qrInsetRight?: number;
  avatarGapToCard?: number;
  exportScale?: number;
}): ExportInput {
  return {
    width: ARTBOARD_WIDTH,
    height: state.artboardHeight,
    backgroundDataUrl: state.aiBackgroundDataUrl || state.backgroundDataUrl,
    manualBackgroundDataUrl: state.manualBackgroundDataUrl || null,
    mainVisualDataUrl: state.mainVisualDataUrl,
    maskDataUrl: state.maskCanvas ? state.maskCanvas.toDataURL('image/png') : null,
    mainVisual: state.mainVisual,
    cards: state.cards,
    footer: state.footer ?? null,
    layerStack: state.layerStack,
    cardGroups: state.cardGroups,
    titleFontSize: state.titleFontSize,
    keywordFontSize: state.keywordFontSize,
    nicknameFontSize: state.nicknameFontSize,
    metricsFontSize: state.metricsFontSize,
    avatarSize: state.avatarSize,
    coverInsetLeft: state.coverInsetLeft,
    titleKeywordGap: state.titleKeywordGap,
    qrInsetRight: state.qrInsetRight,
    avatarGapToCard: state.avatarGapToCard,
    clip: { x: 0, y: 0, width: ARTBOARD_WIDTH, height: state.artboardHeight },
    scale: state.exportScale ?? 1,
    dpi: EXPORT_PNG_DPI,
  };
}

function clampRect(
  x: number,
  y: number,
  w: number,
  h: number,
  maxW: number,
  maxH: number,
  pad = 0,
) {
  const left = Math.max(0, Math.floor(x - pad));
  const top = Math.max(0, Math.floor(y - pad));
  const right = Math.min(maxW, Math.ceil(x + w + pad));
  const bottom = Math.min(maxH, Math.ceil(y + h + pad));
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

function estimateNickWidth(text: string, fontSize: number) {
  // 粗略估算：中文约 1em，英文约 0.55em
  let w = 0;
  for (const ch of text) {
    w += /[\u4e00-\u9fff]/.test(ch) ? fontSize : fontSize * 0.55;
  }
  return Math.ceil(w);
}

/** 计算选中图层内容包围盒（相对画板）；无内容时返回 null */
export function computeLayerClip(
  layer: import('./types').CanvasLayer,
  state: {
    artboardHeight: number;
    mainVisual: { x: number; y: number; width: number; height: number } | null;
    cards: CardItem[];
    cardGroups?: import('./types').CardGroup[];
    avatarSize?: number;
    avatarGapToCard?: number;
    nicknameFontSize?: number;
  },
): { x: number; y: number; width: number; height: number } | null {
  const aw = ARTBOARD_WIDTH;
  const ah = state.artboardHeight;
  const full = { x: 0, y: 0, width: aw, height: ah };

  if (layer.kind === 'aiBackground' || layer.kind === 'manualBackground') {
    return full;
  }

  if (layer.kind === 'mainVisual') {
    const mv = state.mainVisual;
    if (!mv) return null;
    return clampRect(mv.x, mv.y, mv.width, mv.height, aw, ah, 2);
  }

  if (layer.kind === 'custom') {
    if (!layer.dataUrl) return null;
    if (layer.width != null && layer.height != null) {
      return clampRect(layer.x ?? 0, layer.y ?? 0, layer.width, layer.height, aw, ah, 2);
    }
    return full;
  }

  if (layer.kind === 'cardGroup') {
    const group = state.cardGroups?.find((g) => g.id === layer.refId);
    const list = group
      ? state.cards.filter((c) => group.rowIds.includes(c.id))
      : state.cards;
    if (!list.length) return null;

    const avatarSize = state.avatarSize ?? CARD_STYLE.avatarSizeDefault;
    const avatarGap = state.avatarGapToCard ?? CARD_STYLE.avatarGapDefault;
    const nickSize = state.nicknameFontSize ?? TYPOGRAPHY.nicknameSize;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const card of list) {
      let left = card.x;
      let top = card.y;
      let right = card.x + card.width;
      let bottom = card.y + card.height;

      if (card.showAvatar) {
        const nick = card.nickname || card.account || '昵称';
        const sidebarW = Math.max(avatarSize, estimateNickWidth(nick, nickSize) + 4);
        left = Math.min(left, card.x - sidebarW - avatarGap);
        const avatarY = card.y + (card.height - avatarSize) / 2;
        bottom = Math.max(
          bottom,
          avatarY + avatarSize + ACCOUNT_SIDEBAR.nicknameGap + nickSize * 1.25,
        );
      }

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    }

    return clampRect(minX, minY, maxX - minX, maxY - minY, aw, ah, 8);
  }

  return full;
}

function sanitizeFilename(name: string) {
  return (name || 'layer')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

/**
 * 仅导出选中图层为透明底 PNG（紧裁切到图层内容范围）
 */
export async function exportSelectedLayerPng(
  state: Parameters<typeof artboardExportInput>[0] & {
    selectedLayerId: string | null;
  },
  filename?: string,
): Promise<{ ok: true; filename: string } | { ok: false; error: string }> {
  const layerId = state.selectedLayerId;
  if (!layerId) return { ok: false, error: '请先在右侧图层面板选中一个图层' };
  const layer = state.layerStack?.find((l) => l.id === layerId);
  if (!layer) return { ok: false, error: '未找到选中图层' };

  const clip = computeLayerClip(layer, state);
  if (!clip) return { ok: false, error: `图层「${layer.name}」暂无内容可导出` };

  const input: ExportInput = {
    ...artboardExportInput(state),
    clip,
    onlyLayerIds: [layer.id],
    skipFooter: true,
  };

  const scale = state.exportScale ?? 1;
  const scaleTag = scale === 1 ? '' : `@${scale}x`;
  const outName = filename || `${sanitizeFilename(layer.name)}${scaleTag}.png`;
  await exportPng(input, outName);
  return { ok: true, filename: outName };
}
