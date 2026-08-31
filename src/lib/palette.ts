/** 主视觉真实配色提取 + 上下渐变背景（只用图中出现的颜色） */

type RGB = { r: number; g: number; b: number };

type Bucket = { n: number; r: number; g: number; b: number; score: number };

export async function extractDominantColors(dataUrl: string, count = 3): Promise<string[]> {
  const analysis = await analyzeMainVisualColors(dataUrl);
  return analysis.palette.slice(0, count).map(rgbToHex);
}

/**
 * 分析主视觉：
 * - 若边缘区域有较统一的背景，采样真实上下色带用于复刻
 * - 否则取画面中视觉权重最高的真实主色（及同图内真实辅色）
 * 绝不合成主视觉以外的颜色
 */
export async function analyzeMainVisualColors(dataUrl: string): Promise<{
  hasBackground: boolean;
  /** 自上而下的真实背景色带（有背景时） */
  verticalStops: RGB[];
  /** 最多 3 个真实主色 */
  palette: RGB[];
  dominant: RGB;
}> {
  const img = await loadImage(dataUrl);
  const tw = 96;
  const th = 96;
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);

  const allBuckets = collectBuckets(data, tw, th, () => true);
  const edgeMask = (x: number, y: number) => {
    const mx = Math.floor(tw * 0.12);
    const my = Math.floor(th * 0.14);
    return x < mx || x >= tw - mx || y < my || y >= th - my;
  };
  const edgeBuckets = collectBuckets(data, tw, th, edgeMask);

  const dominant = pickMostProminent(allBuckets) || { r: 40, g: 80, b: 160 };
  const edgeDominant = pickMostProminent(edgeBuckets);

  // 边缘色是否足够成片：最大桶占比 + 与次桶是否同色系
  const edgeTotal = edgeBuckets.reduce((s, b) => s + b.n, 0) || 1;
  const edgeTop = [...edgeBuckets].sort((a, b) => b.n - a.n);
  const edgeCoverage = edgeTop.length ? edgeTop[0].n / edgeTotal : 0;
  const edgeCoherent =
    edgeTop.length >= 2
      ? colorDistance(avgBucket(edgeTop[0]), avgBucket(edgeTop[1])) < 70
      : edgeCoverage > 0.25;
  const hasBackground = edgeCoverage >= 0.22 && (edgeCoherent || edgeCoverage >= 0.38);

  let verticalStops: RGB[] = [];
  if (hasBackground) {
    verticalStops = sampleVerticalEdgeStops(data, tw, th, 10);
  }

  // 调色板：只用真实像素桶，按视觉权重排序，去重相近色
  const ranked = [...allBuckets].sort((a, b) => b.score - a.score);
  const palette: RGB[] = [];
  for (const b of ranked) {
    const c = avgBucket(b);
    if (palette.some((p) => colorDistance(p, c) < 28)) continue;
    palette.push(roundRgb(c));
    if (palette.length >= 3) break;
  }
  if (!palette.length) palette.push(roundRgb(dominant));

  // 有背景时，把上下边缘真实色优先放进 palette
  if (hasBackground && verticalStops.length) {
    const top = verticalStops[0];
    const bot = verticalStops[verticalStops.length - 1];
    const mid = verticalStops[Math.floor(verticalStops.length / 2)];
    const bgPalette = [top, mid, bot].map(roundRgb);
    const merged: RGB[] = [];
    for (const c of [...bgPalette, ...palette]) {
      if (merged.some((p) => colorDistance(p, c) < 24)) continue;
      merged.push(c);
      if (merged.length >= 3) break;
    }
    return {
      hasBackground: true,
      verticalStops: verticalStops.map(roundRgb),
      palette: merged,
      dominant: roundRgb(edgeDominant || dominant),
    };
  }

  return {
    hasBackground: false,
    verticalStops: [],
    palette,
    dominant: roundRgb(dominant),
  };
}

/** 兼容旧名：返回真实主色板（不合成亮/暗变体） */
export async function extractHarmonyPalette(dataUrl: string, maxColors = 3): Promise<RGB[]> {
  const a = await analyzeMainVisualColors(dataUrl);
  return a.palette.slice(0, maxColors);
}

/**
 * 按主视觉真实主色生成上下渐变：
 * 1) 有可复刻背景 → 用边缘纵向采样色带拉伸
 * 2) 否则 → 用画面最明显主色 + 图内真实辅色做简单竖向渐变
 */
export async function expandBackgroundFromMainVisual(
  dataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  const analysis = await analyzeMainVisualColors(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  if (analysis.hasBackground && analysis.verticalStops.length >= 2) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    const stops = analysis.verticalStops;
    stops.forEach((c, i) => {
      const t = stops.length === 1 ? 0 : i / (stops.length - 1);
      grad.addColorStop(t, rgbToHex(c));
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else {
    const primary = analysis.dominant;
    // 辅色必须来自 palette 中真实存在的颜色；不够则重复主色
    const others = analysis.palette.filter((c) => colorDistance(c, primary) > 18);
    const top = others.find((c) => luminance(c) >= luminance(primary)) || others[0] || primary;
    const bottom =
      others
        .filter((c) => colorDistance(c, top) > 12)
        .sort((a, b) => luminance(a) - luminance(b))[0] || primary;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, rgbToHex(top));
    grad.addColorStop(0.45, rgbToHex(primary));
    grad.addColorStop(1, rgbToHex(bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 极轻噪点（用主色本身），不做额外色罩，避免偏色
  drawSoftNoise(ctx, width, height, analysis.dominant, 0.03);

  return canvas.toDataURL('image/png');
}

function collectBuckets(
  data: Uint8ClampedArray,
  tw: number,
  th: number,
  include: (x: number, y: number) => boolean,
): Bucket[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (!include(x, y)) continue;
      const i = (y * tw + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // 仍保留近白/近黑（背景常见），但降低其视觉权重
      const key = `${r >> 3},${g >> 3},${b >> 3}`;
      const cur = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      cur.n += 1;
      cur.r += r;
      cur.g += g;
      cur.b += b;
      buckets.set(key, cur);
    }
  }
  return [...buckets.values()].map((v) => {
    const avg = { r: v.r / v.n, g: v.g / v.n, b: v.b / v.n };
    const hsl = rgbToHsl(avg.r, avg.g, avg.b);
    // 视觉显著性：面积 ×（饱和度加权）× 避免极端死黑死白垄断
    const extreme =
      hsl.l < 0.06 || hsl.l > 0.94 ? 0.25 : hsl.l < 0.12 || hsl.l > 0.88 ? 0.55 : 1;
    const satBoost = 0.45 + hsl.s * 0.9;
    const score = v.n * satBoost * extreme;
    return { ...v, score };
  });
}

function pickMostProminent(buckets: Bucket[]): RGB | null {
  if (!buckets.length) return null;
  const best = [...buckets].sort((a, b) => b.score - a.score)[0];
  return avgBucket(best);
}

function avgBucket(b: { n: number; r: number; g: number; b: number }): RGB {
  return { r: b.r / b.n, g: b.g / b.n, b: b.b / b.n };
}

/** 沿左右边缘条带自上而下采样真实平均色 */
function sampleVerticalEdgeStops(
  data: Uint8ClampedArray,
  tw: number,
  th: number,
  stopCount: number,
): RGB[] {
  const band = Math.max(2, Math.floor(tw * 0.1));
  const stops: RGB[] = [];
  for (let s = 0; s < stopCount; s++) {
    const y0 = Math.floor((s / stopCount) * th);
    const y1 = Math.floor(((s + 1) / stopCount) * th);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < band; x++) {
        const i = (y * tw + x) * 4;
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
      for (let x = tw - band; x < tw; x++) {
        const i = (y * tw + x) * 4;
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n += 1;
      }
    }
    if (n > 0) stops.push({ r: r / n, g: g / n, b: b / n });
  }
  return stops.length ? stops : [];
}

function colorDistance(a: RGB, b: RGB) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function luminance(c: RGB) {
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

function roundRgb(c: RGB): RGB {
  return { r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) };
}

function drawSoftNoise(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: RGB,
  alpha: number,
) {
  const tw = Math.max(120, Math.round(width / 6));
  const th = Math.max(180, Math.round(height / 6));
  const noise = document.createElement('canvas');
  noise.width = tw;
  noise.height = th;
  const nctx = noise.getContext('2d')!;
  const img = nctx.createImageData(tw, th);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    const a = n > 0.55 ? alpha * 255 * (n - 0.55) * 2.2 : 0;
    img.data[i] = color.r;
    img.data[i + 1] = color.g;
    img.data[i + 2] = color.b;
    img.data[i + 3] = Math.min(255, a);
  }
  nctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(noise, 0, 0, width, height);
  ctx.restore();
}

/** @deprecated 保留给旧调用；内部改为真实色竖向渐变 */
export function createProceduralBackground(width: number, height: number, colors: string[]): string {
  const palette = (colors.length ? colors : ['#1e5ad2', '#3d8cff', '#0f2f7a']).slice(0, 3);
  while (palette.length < 3) palette.push(palette[palette.length - 1]);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, palette[1] || palette[0]);
  grad.addColorStop(0.45, palette[0]);
  grad.addColorStop(1, palette[2] || palette[0]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/png');
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rgbToHex(c: RGB | string) {
  if (typeof c === 'string') return c;
  const r = Math.round(clamp(c.r, 0, 255));
  const g = Math.round(clamp(c.g, 0, 255));
  const b = Math.round(clamp(c.b, 0, 255));
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
