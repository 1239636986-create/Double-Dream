import { CARD_DEFAULT, CARD_STYLE, METRICS_BAR, TYPOGRAPHY } from './constants';

/** 卡片内封面/文案/二维码布局（含左边距与防溢出约束） */
export function computeCardContentLayout(
  cardWidth: number,
  cardHeight: number,
  opts: {
    coverInsetLeft: number;
    titleFontSize: number;
    keywordFontSize: number;
    metricsFontSize?: number;
    showMetrics?: boolean;
    /** 标题↔关键词间距；有投放数据时同时作用于标题↔数据、数据↔关键词 */
    titleKeywordGap?: number;
    /** 二维码距组件框右侧的距离 */
    qrInsetRight?: number;
    /** 投放数据完整文案；有则按实测宽度自适应渐变条 */
    metricsText?: string;
    measureMetrics?: (s: string) => number;
  },
) {
  const pad = CARD_DEFAULT.padding;
  const gap = CARD_DEFAULT.elementGap;
  const contentH = Math.max(1, cardHeight - pad * 2);
  const coverH = contentH;
  const coverW = coverH * CARD_DEFAULT.coverRatio;
  const qrSize = Math.min(CARD_DEFAULT.qrSize * (cardHeight / CARD_DEFAULT.height), contentH);
  const minTextW = CARD_STYLE.minTextWidth;
  const metricsSize = opts.metricsFontSize ?? TYPOGRAPHY.metricsSize;
  const showMetrics = Boolean(opts.showMetrics);
  const stackGap =
    opts.titleKeywordGap ??
    (showMetrics ? CARD_DEFAULT.titleMetricsGap : CARD_STYLE.titleKeywordGapDefault);
  const qrInsetRight = Math.max(
    CARD_STYLE.qrInsetMin,
    Math.min(
      CARD_STYLE.qrInsetMax,
      opts.qrInsetRight ?? CARD_STYLE.qrInsetDefault,
    ),
  );

  const rightReserve = gap + minTextW + gap + qrSize + qrInsetRight;
  const maxCoverX = Math.max(0, cardWidth - coverW - rightReserve);
  const coverX = Math.max(0, Math.min(opts.coverInsetLeft, maxCoverX));

  const textX = coverX + coverW + gap;
  const qrX = cardWidth - qrInsetRight - qrSize;
  const textW = Math.max(minTextW, qrX - gap - textX);

  let finalCoverW = coverW;
  let finalCoverX = coverX;
  let finalTextX = textX;
  let finalTextW = textW;
  let finalQrX = qrX;
  if (textX + minTextW + gap + qrSize + qrInsetRight > cardWidth) {
    finalCoverW = Math.max(24, cardWidth - qrInsetRight - rightReserve - Math.min(coverX, pad));
    finalCoverX = Math.min(coverX, Math.max(0, cardWidth - finalCoverW - rightReserve));
    finalQrX = cardWidth - qrInsetRight - qrSize;
    finalTextX = finalCoverX + finalCoverW + gap;
    finalTextW = Math.max(minTextW, finalQrX - gap - finalTextX);
  }

  const titleSize = opts.titleFontSize;
  const kwSize = opts.keywordFontSize;
  const metricsPadX = METRICS_BAR.padX;
  let metricsBarW: number = METRICS_BAR.minWidth;
  let metricsBarHeight: number = Math.round(metricsSize + METRICS_BAR.padY * 2);
  if (showMetrics && opts.metricsText && opts.measureMetrics) {
    const needed = Math.ceil(opts.measureMetrics(opts.metricsText) + metricsPadX * 2);
    if (needed <= finalTextW) {
      metricsBarW = Math.max(METRICS_BAR.minWidth, needed);
    } else {
      /** 超长时占满文案区并换行增高，保证完整可见 */
      metricsBarW = finalTextW;
      metricsBarHeight = Math.round(metricsSize * 1.25 * 2 + METRICS_BAR.padY * 2);
    }
  } else if (showMetrics) {
    metricsBarW = Math.max(METRICS_BAR.minWidth, Math.round(finalTextW * 0.72));
  }
  const metricsBlockH = showMetrics ? metricsBarHeight : 0;

  return {
    pad,
    gap,
    coverX: finalCoverX,
    coverY: pad,
    coverW: finalCoverW,
    coverH,
    qrSize,
    qrX: finalQrX,
    qrY: (cardHeight - qrSize) / 2,
    qrInsetRight,
    textX: finalTextX,
    textW: finalTextW,
    titleSize,
    kwSize,
    metricsSize,
    metricsBarHeight,
    metricsBarW,
    metricsPadX,
    metricsBlockH,
    metricsCornerRadius: METRICS_BAR.cornerRadius,
    titleMetricsGap: showMetrics ? stackGap : 0,
    metricsKeywordGap: showMetrics ? stackGap : 0,
    stackGap,
    showMetrics,
  };
}

export type CardContentLayout = ReturnType<typeof computeCardContentLayout>;

export { TYPOGRAPHY };
