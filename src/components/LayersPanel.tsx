import { useRef, useState } from 'react';
import { usePosterStore } from '@/store/usePosterStore';
import { ARTBOARD_WIDTH } from '@/lib/constants';
import { exportSelectedLayerPng, artboardExportInput, resolveExportScale } from '@/lib/export';
import type { CanvasLayer } from '@/lib/types';

const KIND_BADGE: Record<string, string> = {
  mainVisual: '主视觉',
  aiBackground: 'AI',
  manualBackground: '手绘',
  cardGroup: '卡组',
  custom: '自定义',
};

export function LayersPanel() {
  const layerStack = usePosterStore((s) => s.layerStack);
  const selectedLayerId = usePosterStore((s) => s.selectedLayerId);
  const cards = usePosterStore((s) => s.cards);
  const cardGroups = usePosterStore((s) => s.cardGroups);
  const artboardHeight = usePosterStore((s) => s.artboardHeight);
  const aiBackgroundDataUrl = usePosterStore((s) => s.aiBackgroundDataUrl);
  const manualBackgroundDataUrl = usePosterStore((s) => s.manualBackgroundDataUrl);
  const mainVisualDataUrl = usePosterStore((s) => s.mainVisualDataUrl);

  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const selected = layerStack.find((l) => l.id === selectedLayerId);

  const readyHint = (layer: CanvasLayer) => {
    if (layer.kind === 'aiBackground') return Boolean(aiBackgroundDataUrl);
    if (layer.kind === 'manualBackground') return Boolean(manualBackgroundDataUrl);
    if (layer.kind === 'mainVisual') return Boolean(mainVisualDataUrl);
    if (layer.kind === 'cardGroup') {
      const g = cardGroups.find((x) => x.id === layer.refId);
      return Boolean(g?.rowIds.length);
    }
    return Boolean(layer.dataUrl) || layer.kind === 'custom';
  };

  const cardCount = (layer: CanvasLayer) => {
    if (layer.kind !== 'cardGroup') return '';
    const g = cardGroups.find((x) => x.id === layer.refId);
    return g ? ` · ${g.rowIds.length}` : '';
  };

  const onExportSelected = async () => {
    if (exporting) return;
    setExporting(true);
    const store = usePosterStore.getState();
    try {
      const base = artboardExportInput(store);
      const scale = await resolveExportScale(base, {
        scale: store.exportScale,
        auto: store.exportScaleAuto,
      });
      const result = await exportSelectedLayerPng({ ...store, exportScale: scale });
      if (!result.ok) {
        store.setStatus(result.error);
        return;
      }
      store.setStatus(`已导出图层 PNG：${result.filename}`);
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <aside className="layers-panel">
      <div className="layers-head">
        <span>图层</span>
        <div className="layers-head-actions">
          <button
            type="button"
            className="btn-outline compact"
            title="导出当前选中图层为透明 PNG"
            disabled={!selected || exporting}
            onClick={() => void onExportSelected()}
          >
            {exporting ? '导出中…' : '导出选中'}
          </button>
          <button
            type="button"
            className="btn-outline compact"
            title="新建空白图层"
            onClick={() => usePosterStore.getState().addCustomLayer()}
          >
            + 新建
          </button>
        </div>
      </div>
      <div className="layers-list">
        {layerStack.map((layer, index) => (
          <div
            key={layer.id}
            className={`layer-item ${selectedLayerId === layer.id ? 'on' : ''} ${
              !readyHint(layer) ? 'dim' : ''
            } ${dragOver === index ? 'drag-over' : ''} ${!layer.visible ? 'hidden-layer' : ''}`}
            draggable
            onDragStart={() => {
              dragFrom.current = index;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(index);
            }}
            onDragLeave={() => setDragOver((v) => (v === index ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragFrom.current;
              setDragOver(null);
              dragFrom.current = null;
              if (from == null || from === index) return;
              usePosterStore.getState().reorderLayerStack(from, index);
            }}
            onDragEnd={() => {
              dragFrom.current = null;
              setDragOver(null);
            }}
            onClick={() => usePosterStore.getState().selectLayer(layer.id)}
          >
            <span className="drag-handle" title="拖动排序">
              ⋮⋮
            </span>
            <span className="layer-meta">
              <span className="layer-badge">{KIND_BADGE[layer.kind] || layer.kind}</span>
              <span className="layer-name">
                {layer.name}
                {cardCount(layer)}
              </span>
            </span>
            <span className="layer-opacity-tag">{Math.round(layer.opacity ?? 100)}%</span>
            <button
              type="button"
              className="eye-btn"
              title={layer.visible ? '隐藏' : '显示'}
              onClick={(e) => {
                e.stopPropagation();
                usePosterStore.getState().toggleLayerVisible(layer.id);
              }}
            >
              {layer.visible ? '👁' : '⊘'}
            </button>
            {!layer.locked && (
              <button
                type="button"
                className="eye-btn"
                title="删除图层"
                onClick={(e) => {
                  e.stopPropagation();
                  usePosterStore.getState().removeLayer(layer.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {selected && (
        <div className="layer-opacity-box">
          <div className="field-label">
            <span>图层透明度 · {selected.name}</span>
            <span className="mono">{Math.round(selected.opacity ?? 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={selected.opacity ?? 100}
            onPointerDown={() => usePosterStore.getState().pushHistory()}
            onChange={(e) =>
              usePosterStore.getState().setLayerOpacity(selected.id, Number(e.target.value), false)
            }
          />
          <button
            type="button"
            className="btn-primary compact layer-export-btn"
            disabled={exporting}
            onClick={() => void onExportSelected()}
          >
            {exporting ? '导出中…' : `导出「${selected.name}」PNG`}
          </button>
        </div>
      )}
      <div className="layers-foot">
        <p>
          画板 {ARTBOARD_WIDTH} × {artboardHeight}
        </p>
        <p>
          {cardGroups.length} 卡组 · {cards.length} 张卡片
        </p>
        <p>选中图层可调透明度 / 单独导出 PNG</p>
      </div>
    </aside>
  );
}
