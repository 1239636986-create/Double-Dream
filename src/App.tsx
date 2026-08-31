import { useEffect, useState } from 'react';
import { STEPS, RAIL } from '@/lib/steps';
import { SidePanel } from './components/SidePanel';
import { LayersPanel } from './components/LayersPanel';
import { PosterCanvas } from './components/PosterCanvas';
import { usePosterStore } from '@/store/usePosterStore';
import './styles.css';

function isCardTextEditor(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-card-text-edit]'));
}

export default function App() {
  const [step, setStep] = useState(4);
  const [zoom, setZoom] = useState(0.35);

  useEffect(() => {
    usePosterStore.getState().seedDefaultCards();
  }, []);

  /** 全局 ⌘Z / ⌘⇧Z / ⌘Y：任意步骤与侧栏均可撤回（文本框内保留原生撤回） */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const isZ = e.code === 'KeyZ' || e.key.toLowerCase() === 'z';
      const isY = e.code === 'KeyY' || e.key.toLowerCase() === 'y';
      if (!isZ && !isY) return;

      const el = e.target as HTMLElement | null;
      if (isCardTextEditor(el)) return;
      const tag = el?.tagName;
      const inputType = (el as HTMLInputElement | null)?.type?.toLowerCase?.() ?? '';
      // 普通文本输入保留浏览器原生撤回；滑杆等仍走全局撤回
      if (tag === 'TEXTAREA') return;
      if (
        tag === 'INPUT' &&
        inputType !== 'range' &&
        inputType !== 'checkbox' &&
        inputType !== 'radio' &&
        inputType !== 'button' &&
        inputType !== 'submit' &&
        inputType !== 'color'
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      const store = usePosterStore.getState();
      if (isY || (isZ && e.shiftKey)) store.redo();
      else store.undo();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const saveProject = () => {
    const snap = usePosterStore.getState().toSnapshot();
    const blob = new Blob([JSON.stringify(snap)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poster-project-${Date.now()}.poster.json`;
    a.click();
    URL.revokeObjectURL(url);
    usePosterStore.getState().setStatus('工程已保存');
  };

  const openProject = async (file: File) => {
    const text = await file.text();
    const snap = JSON.parse(text);
    usePosterStore.getState().loadSnapshot(snap);
    usePosterStore.getState().setStatus('工程已打开');
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          <span className="logo">▣</span>
          <h1>长图海报自动化生成工具</h1>
          <span className="badge">PRD v1.7</span>
        </div>
        <nav className="topbar-steps">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={step === s.id ? 'active' : ''}
              onClick={() => setStep(s.id)}
            >
              {s.id}. {s.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-outline"
            title="撤回 ⌘Z"
            onClick={() => usePosterStore.getState().undo()}
          >
            撤回
          </button>
          <button type="button" className="btn-outline" onClick={saveProject}>
            保存工程
          </button>
          <label className="btn-outline file-btn">
            打开工程
            <input
              type="file"
              accept=".json,.poster.json"
              hidden
              onChange={(e) => e.target.files?.[0] && openProject(e.target.files[0])}
            />
          </label>
          <button type="button" className="btn-primary compact" onClick={() => setStep(8)}>
            导出
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="icon-rail">
          {RAIL.map((r) => (
            <button
              key={r.step}
              type="button"
              className={step === r.step ? 'active' : ''}
              onClick={() => setStep(r.step)}
              title={r.label}
            >
              <span className="rail-dot">{r.step}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </aside>

        <SidePanel step={step} />

        <main className="canvas-main">
          <PosterCanvas zoom={zoom} onZoomChange={setZoom} />
          <div className="zoom-bar">
            <button type="button" onClick={() => setZoom((z) => Math.max(0.08, +(z - 0.04).toFixed(2)))}>
              −
            </button>
            <span className="mono">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(1.2, +(z + 0.04).toFixed(2)))}>
              +
            </button>
            <span className="zoom-hint">
              拖入/粘贴图片建层 · 双击文字编辑 · 单击封面/二维码可选中拖拽 · Delete 删除 · ⌘Z 撤回
            </span>
          </div>
        </main>

        <LayersPanel />
      </div>
    </div>
  );
}
