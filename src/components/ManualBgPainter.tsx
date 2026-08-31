import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ARTBOARD_BASE_HEIGHT, ARTBOARD_WIDTH, MANUAL_BG } from '@/lib/constants';
import { usePosterStore } from '@/store/usePosterStore';

/** 侧栏空白画板：吸取颜色 + 路径绘制弥散，写入「手动绘制背景」图层 */
export function ManualBgPainter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const undoStack = useRef<ImageData[]>([]);

  const [color, setColor] = useState('#5aa0ff');
  const [brushSize, setBrushSize] = useState(42);
  const [blur, setBlur] = useState(28);
  const [opacity, setOpacity] = useState(55);
  const [canUndo, setCanUndo] = useState(false);

  const manualBackgroundDataUrl = usePosterStore((s) => s.manualBackgroundDataUrl);
  const layerStack = usePosterStore((s) => s.layerStack);
  const manualLayer = layerStack.find((l) => l.kind === 'manualBackground');
  const manualBackgroundOpacity = manualLayer?.opacity ?? 100;

  const pw = 260;
  const ph = Math.round((pw * ARTBOARD_BASE_HEIGHT) / ARTBOARD_WIDTH);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = pw;
    c.height = ph;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, pw, ph);
    undoStack.current = [];
    setCanUndo(false);
  }, [pw, ph]);

  const pushUndo = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    undoStack.current = [
      ...undoStack.current.slice(-29),
      ctx.getImageData(0, 0, c.width, c.height),
    ];
    setCanUndo(true);
  };

  const undoStroke = () => {
    const c = canvasRef.current;
    if (!c || !undoStack.current.length) return;
    const ctx = c.getContext('2d')!;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    ctx.putImageData(prev, 0, 0);
    setCanUndo(undoStack.current.length > 0);
  };

  const posFromEvent = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * pw,
      y: ((e.clientY - rect.top) / rect.height) * ph,
    };
  };

  const stamp = (x: number, y: number) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const r = brushSize / 2;
    const soft = Math.max(0.15, 1 - blur / 80);
    const g = ctx.createRadialGradient(x, y, r * soft * 0.15, x, y, r);
    const a = opacity / 100;
    g.addColorStop(0, hexToRgba(color, a));
    g.addColorStop(0.45, hexToRgba(color, a * 0.45));
    g.addColorStop(1, hexToRgba(color, 0));
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const strokeTo = (x: number, y: number) => {
    const prev = last.current;
    if (!prev) {
      stamp(x, y);
      last.current = { x, y };
      return;
    }
    const dx = x - prev.x;
    const dy = y - prev.y;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(2, brushSize * 0.18);
    const n = Math.ceil(dist / step);
    for (let i = 1; i <= n; i++) {
      stamp(prev.x + (dx * i) / n, prev.y + (dy * i) / n);
    }
    last.current = { x, y };
  };

  const clearPad = () => {
    const c = canvasRef.current;
    if (!c) return;
    pushUndo();
    c.getContext('2d')!.clearRect(0, 0, pw, ph);
  };

  const pickFromMainVisual = async () => {
    const url = usePosterStore.getState().mainVisualDataUrl;
    if (!url) {
      usePosterStore.getState().setStatus('请先上传主视觉再吸取颜色');
      return;
    }
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(
      img,
      img.naturalWidth * 0.4,
      img.naturalHeight * 0.55,
      img.naturalWidth * 0.2,
      img.naturalHeight * 0.2,
      0,
      0,
      1,
      1,
    );
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    setColor(rgbToHex(r, g, b));
    usePosterStore.getState().setStatus(`已吸取主色 ${rgbToHex(r, g, b)}`);
  };

  const applyToLayer = async () => {
    const c = canvasRef.current;
    if (!c) return;
    const store = usePosterStore.getState();
    store.setGenerating(true, 0.3);
    try {
      const soft = softenCanvas(c, blur);
      const h = store.artboardHeight || ARTBOARD_BASE_HEIGHT;
      const out = document.createElement('canvas');
      out.width = ARTBOARD_WIDTH;
      out.height = h;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(soft, 0, 0, ARTBOARD_WIDTH, h);
      store.setManualBackground(out.toDataURL('image/png'));
      const layer = store.layerStack.find((l) => l.kind === 'manualBackground');
      if (layer) store.selectLayer(layer.id);
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      store.setGenerating(false, 0);
    }
  };

  return (
    <div className="manual-bg">
      <div className="manual-bg-toolbar">
        <label className="color-pick">
          <span>颜色</span>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        </label>
        <button type="button" className="btn-outline compact" onClick={pickFromMainVisual}>
          吸取主视觉
        </button>
      </div>
      <div className="field">
        <div className="field-label">
          <span>笔触大小</span>
          <span className="mono">{brushSize}px</span>
        </div>
        <input
          type="range"
          min={12}
          max={120}
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>
      <div className="field">
        <div className="field-label">
          <span>模糊范围</span>
          <span className="mono">{blur}</span>
        </div>
        <input type="range" min={4} max={64} value={blur} onChange={(e) => setBlur(Number(e.target.value))} />
      </div>
      <div className="field">
        <div className="field-label">
          <span>笔触透明度</span>
          <span className="mono">{opacity}%</span>
        </div>
        <input
          type="range"
          min={15}
          max={90}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
        />
      </div>
      <div className="manual-pad-wrap">
        <canvas
          ref={canvasRef}
          className="manual-pad"
          style={{ width: pw, height: ph }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            pushUndo();
            painting.current = true;
            last.current = null;
            const p = posFromEvent(e);
            strokeTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!painting.current) return;
            const p = posFromEvent(e);
            strokeTo(p.x, p.y);
          }}
          onPointerUp={() => {
            painting.current = false;
            last.current = null;
          }}
          onPointerLeave={() => {
            painting.current = false;
            last.current = null;
          }}
        />
        <p className="muted tiny">绘制后写入独立的「手动绘制背景」图层，可在右侧调序/隐藏</p>
      </div>
      <div className="row">
        <button type="button" disabled={!canUndo} onClick={undoStroke}>
          撤回
        </button>
        <button type="button" onClick={clearPad}>
          清空画板
        </button>
        <button type="button" className="btn-primary" onClick={applyToLayer}>
          写入手绘图层
        </button>
      </div>
      {manualBackgroundDataUrl && (
        <div className="field" style={{ marginTop: 12 }}>
          <div className="field-label">
            <span>图层透明度</span>
            <span className="mono">{manualBackgroundOpacity}%</span>
          </div>
          <input
            type="range"
            min={MANUAL_BG.opacityMin}
            max={MANUAL_BG.opacityMax}
            value={manualBackgroundOpacity}
            onPointerDown={() => usePosterStore.getState().pushHistory()}
            onChange={(e) => {
              if (!manualLayer) return;
              usePosterStore.getState().setLayerOpacity(manualLayer.id, Number(e.target.value), false);
            }}
          />
          <p className="muted tiny">写入图层后调节画板上「手动绘制背景」的整体透明度</p>
        </div>
      )}
    </div>
  );
}

function softenCanvas(src: HTMLCanvasElement, blur: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d')!;
  ctx.filter = `blur(${Math.max(0, blur * 0.35)}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = 'none';
  return out;
}

function hexToRgba(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
