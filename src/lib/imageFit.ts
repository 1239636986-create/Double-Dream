/** object-fit: cover 定位（可带平移偏移，并钳制在框内仍铺满） */
export function coverFitRect(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  offsetX = 0,
  offsetY = 0,
) {
  if (imgW <= 0 || imgH <= 0 || frameW <= 0 || frameH <= 0) {
    return {
      x: 0,
      y: 0,
      width: frameW,
      height: frameH,
      baseX: 0,
      baseY: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
    };
  }
  const scale = Math.max(frameW / imgW, frameH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  const minX = Math.min(0, frameW - width);
  const maxX = Math.max(0, frameW - width);
  const minY = Math.min(0, frameH - height);
  const maxY = Math.max(0, frameH - height);
  const baseX = (frameW - width) / 2;
  const baseY = (frameH - height) / 2;
  const x = Math.min(maxX, Math.max(minX, baseX + offsetX));
  const y = Math.min(maxY, Math.max(minY, baseY + offsetY));
  return { x, y, width, height, baseX, baseY, minX, maxX, minY, maxY };
}

/**
 * cover-fit 可见区域对应的源图像素矩形（用于 9 参 drawImage，避免整图缩放后再裁切）
 */
export function coverSourceRect(
  imgW: number,
  imgH: number,
  frameW: number,
  frameH: number,
  offsetX = 0,
  offsetY = 0,
) {
  const fit = coverFitRect(imgW, imgH, frameW, frameH, offsetX, offsetY);
  if (fit.width <= 0 || fit.height <= 0) {
    return { sx: 0, sy: 0, sw: imgW, sh: imgH };
  }
  const sx = (-fit.x / fit.width) * imgW;
  const sy = (-fit.y / fit.height) * imgH;
  const sw = (frameW / fit.width) * imgW;
  const sh = (frameH / fit.height) * imgH;
  return {
    sx: Math.max(0, Math.min(imgW, sx)),
    sy: Math.max(0, Math.min(imgH, sy)),
    sw: Math.max(1, Math.min(imgW - Math.max(0, sx), sw)),
    sh: Math.max(1, Math.min(imgH - Math.max(0, sy), sh)),
  };
}

/**
 * 高质量位图绘制：源矩形 → 目标矩形。
 * 大幅缩小时用金字塔降采样，减少一次线性插值发糊。
 */
export function drawImageSrcDstHQ(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;

  const outW = Math.max(1, Math.round(dw));
  const outH = Math.max(1, Math.round(dh));
  const srcW = Math.max(1, sw);
  const srcH = Math.max(1, sh);
  const shrink = Math.min(outW / srcW, outH / srcH);

  // 接近 1:1 或放大：直接画；1:1 关平滑以免发糊
  if (shrink >= 0.92) {
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevQual = ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled = shrink < 0.995;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, outW, outH);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.imageSmoothingQuality = prevQual;
    return;
  }

  // 先裁出源区到离屏，再逐级减半
  let cur = document.createElement('canvas');
  cur.width = Math.max(1, Math.round(srcW));
  cur.height = Math.max(1, Math.round(srcH));
  const c0 = cur.getContext('2d')!;
  c0.imageSmoothingEnabled = true;
  c0.imageSmoothingQuality = 'high';
  c0.drawImage(img, sx, sy, sw, sh, 0, 0, cur.width, cur.height);

  let cw = cur.width;
  let ch = cur.height;
  while (cw * 0.5 >= outW && ch * 0.5 >= outH) {
    const nw = Math.max(outW, Math.floor(cw / 2));
    const nh = Math.max(outH, Math.floor(ch / 2));
    if (nw >= cw && nh >= ch) break;
    const next = document.createElement('canvas');
    next.width = nw;
    next.height = nh;
    const nctx = next.getContext('2d')!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
    cur = next;
    cw = nw;
    ch = nh;
  }

  const prevSmooth = ctx.imageSmoothingEnabled;
  const prevQual = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, cw, ch, dx, dy, outW, outH);
  ctx.imageSmoothingEnabled = prevSmooth;
  ctx.imageSmoothingQuality = prevQual;
}

/**
 * object-fit:cover 高质量绘制。
 * @param dx,dy,dw,dh 目标像素框
 * @param frameW,frameH 逻辑框（与 offset 同一单位）；默认等于 dw/dh
 */
export function drawImageCoverHQ(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  offsetX = 0,
  offsetY = 0,
  frameW = dw,
  frameH = dh,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih || dw <= 0 || dh <= 0 || frameW <= 0 || frameH <= 0) return;
  const { sx, sy, sw, sh } = coverSourceRect(iw, ih, frameW, frameH, offsetX, offsetY);
  drawImageSrcDstHQ(ctx, img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * 拉伸填满（背景等）：尽量用原图像素，目标大于原图时允许放大
 */
export function drawImageStretchHQ(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  drawImageSrcDstHQ(ctx, img, 0, 0, iw, ih, x, y, w, h);
}
