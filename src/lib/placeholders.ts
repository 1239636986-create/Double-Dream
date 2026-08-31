/** 占位封面 / 二维码图（无素材时仍能预览卡片） */

export function makePlaceholderCover(label: string, seed = 0): string {
  const canvas = document.createElement('canvas');
  canvas.width = 378;
  canvas.height = 504; // 3:4
  const ctx = canvas.getContext('2d')!;
  const hues = [210, 200, 195, 220, 205, 215];
  const h = hues[seed % hues.length];
  const g = ctx.createLinearGradient(0, 0, 378, 504);
  g.addColorStop(0, `hsl(${h} 70% 55%)`);
  g.addColorStop(1, `hsl(${h + 20} 65% 35%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 378, 504);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 28px "Noto Sans SC", sans-serif';
  ctx.fillText('封面', 24, 48);
  ctx.font = '400 20px "Noto Sans SC", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const t = label.slice(0, 10);
  ctx.fillText(t, 24, 84);
  return canvas.toDataURL('image/png');
}

export function makePlaceholderQr(seed = 0): string {
  const canvas = document.createElement('canvas');
  canvas.width = 296;
  canvas.height = 296;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 296, 296);
  ctx.fillStyle = '#111111';
  // 伪二维码点阵
  const cell = 8;
  let s = (seed + 7) * 1103515245;
  for (let y = 0; y < 296; y += cell) {
    for (let x = 0; x < 296; x += cell) {
      s = (s * 1664525 + 1013904223) >>> 0;
      if (s & 1) ctx.fillRect(x, y, cell - 1, cell - 1);
    }
  }
  // 三定位点
  for (const [ox, oy] of [
    [16, 16],
    [232, 16],
    [16, 232],
  ]) {
    ctx.fillStyle = '#111';
    ctx.fillRect(ox, oy, 48, 48);
    ctx.fillStyle = '#fff';
    ctx.fillRect(ox + 8, oy + 8, 32, 32);
    ctx.fillStyle = '#111';
    ctx.fillRect(ox + 16, oy + 16, 16, 16);
  }
  return canvas.toDataURL('image/png');
}

export const DEFAULT_DEMO_TITLES = [
  { title: '凌晨四点的城市，藏着最真实的一面', keywords: '#城市纪实 #深夜观察 #人间烟火' },
  { title: '把 30 平米的出租屋，改成了理想的家', keywords: '#家居改造 #小户型 #租房生活' },
  { title: '一碗面的三十年，老板从没涨过价', keywords: '#美食探店 #老字号 #城市记忆' },
  { title: '跟着货车司机跑了一趟 1200 公里', keywords: '#纪录片 #在路上 #普通人的一天' },
  { title: '只用一部手机，也能拍出电影感', keywords: '#手机摄影 #调色教程 #干货分享' },
  { title: '我把外婆的老照片，一张张修复好了', keywords: '#老照片修复 #家庭故事 #温暖瞬间' },
];
