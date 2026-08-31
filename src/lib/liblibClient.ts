import { ARTBOARD_BASE_HEIGHT, ARTBOARD_WIDTH } from './constants';
import {
  analyzeMainVisualColors,
  expandBackgroundFromMainVisual,
  createProceduralBackground,
} from './palette';

/**
 * 背景生成（色准优先）：
 * 默认本地按主视觉真实主色做上下渐变；
 * 有可识别背景时复刻边缘色带；远端 FLUX 易跑色，默认关闭。
 */
export async function generateBackground(opts: {
  imageBase64?: string;
  prompt?: string;
  onProgress?: (p: number, msg: string) => void;
  /** 默认 false：色准优先走本地真实取色 */
  preferRemoteAi?: boolean;
  targetHeight?: number;
}): Promise<string> {
  const { imageBase64, onProgress, preferRemoteAi = false } = opts;

  if (!imageBase64) {
    throw new Error('请先上传主视觉，再生成背景');
  }

  onProgress?.(0.15, '分析主视觉真实主色（仅使用图中颜色）…');
  const analysis = await analyzeMainVisualColors(imageBase64);
  const colors = analysis.palette.map((c) => rgbToHex(c));
  const h = Math.max(ARTBOARD_BASE_HEIGHT, opts.targetHeight || ARTBOARD_BASE_HEIGHT);

  if (preferRemoteAi) {
    onProgress?.(0.3, '尝试远端生图（随后强制压回主视觉色）…');
    try {
      const submit = await fetch('/api/generate-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors,
          prompt: [
            'simple vertical gradient background only',
            'top to bottom smooth color wash',
            `exact colors only: ${colors.join(', ')}`,
            'do not invent new hues',
            'no objects, no text, no logo, no watermark',
            'no flowing ribbons, no aurora, no silk',
          ].join(', '),
          width: ARTBOARD_WIDTH,
          height: h,
          provider: 'pollinations',
        }),
      });
      const json = await submit.json();
      if (submit.ok && json.mode === 'sync' && json.imageBase64) {
        onProgress?.(0.7, '远端结果压回主视觉色板…');
        const remapped = await remapToExactPalette(
          String(json.imageBase64),
          colors,
          ARTBOARD_WIDTH,
          h,
        );
        onProgress?.(1, `背景已生成（色板对齐 · ${colors.join(' / ')}）`);
        return remapped;
      }
    } catch (err) {
      console.warn(err);
    }
  }

  onProgress?.(
    0.55,
    analysis.hasBackground
      ? '检测到主视觉背景，正在复刻上下色带…'
      : `按最显著主色 ${colors[0] || ''} 生成上下渐变…`,
  );
  await sleep(16);
  const dataUrl = await expandBackgroundFromMainVisual(imageBase64, ARTBOARD_WIDTH, h);
  onProgress?.(
    1,
    analysis.hasBackground
      ? `背景已复刻（主视觉色带 · ${colors.join(' / ')}）`
      : `背景已生成（主色渐变 · ${colors.join(' / ')}）`,
  );
  return dataUrl;
}

/** 将任意图量化到给定色板（仅用这些 hex） */
async function remapToExactPalette(
  dataUrl: string,
  colors: string[],
  width: number,
  height: number,
): Promise<string> {
  const palette = colors.map(hexToRgb).filter(Boolean) as Array<{ r: number; g: number; b: number }>;
  if (!palette.length) return dataUrl;
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);
  // 直接用色板做竖向渐变覆盖，保证零跑色
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  if (palette.length === 1) {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[0]);
  } else if (palette.length === 2) {
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(1, colors[1]);
  } else {
    grad.addColorStop(0, colors[1] || colors[0]);
    grad.addColorStop(0.45, colors[0]);
    grad.addColorStop(1, colors[2] || colors[0]);
  }
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (full.length !== 6) return null;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(c: { r: number; g: number; b: number }) {
  return `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function generateBackgroundLegacyFallback(colors: string[]) {
  return createProceduralBackground(ARTBOARD_WIDTH, ARTBOARD_BASE_HEIGHT, colors.slice(0, 3));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
