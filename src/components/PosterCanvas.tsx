import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Image as KonvaImage, Transformer, Circle, Text } from 'react-konva';
import type Konva from 'konva';
import { ARTBOARD_WIDTH, CARD_DEFAULT, TYPOGRAPHY } from '@/lib/constants';
import { computeCardContentLayout } from '@/lib/cardLayout';
import { footerTopY } from '@/lib/export';
import { usePosterStore } from '@/store/usePosterStore';
import { CardLayer, type CardTextField } from './CardLayer';
import useImage from './useImage';
import type { CanvasLayer, ReplaceSlot } from '@/lib/types';

function FreeImageNode({
  layer,
  selected,
  draggable,
  nodeRef,
  onSelect,
  onTransformEnd,
}: {
  layer: CanvasLayer;
  selected: boolean;
  draggable: boolean;
  nodeRef?: (node: Konva.Image | null) => void;
  onSelect: () => void;
  onTransformEnd: () => void;
}) {
  const img = useImage(layer.dataUrl || null);
  if (!img || layer.width == null || layer.height == null) return null;
  return (
    <KonvaImage
      ref={nodeRef as never}
      name={`free-image-${layer.id}`}
      image={img}
      x={layer.x ?? 0}
      y={layer.y ?? 0}
      width={layer.width}
      height={layer.height}
      opacity={(layer.opacity ?? 100) / 100}
      draggable={draggable}
      onClick={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        onSelect();
      }}
      onDragStart={() => onSelect()}
      onDragEnd={(e) => {
        usePosterStore.getState().updateLayerTransform(layer.id, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onTransformEnd={onTransformEnd}
      stroke={selected ? '#6cb6ff' : undefined}
      strokeWidth={selected ? 2 : 0}
    />
  );
}

function FullBleedCustom({
  dataUrl,
  width,
  height,
  opacity,
}: {
  dataUrl: string;
  width: number;
  height: number;
  opacity: number;
}) {
  const img = useImage(dataUrl);
  if (!img) return null;
  return (
    <KonvaImage
      image={img}
      x={0}
      y={0}
      width={width}
      height={height}
      opacity={opacity}
      listening={false}
    />
  );
}

function intersectsArtboard(
  layer: CanvasLayer,
  artboardHeight: number,
): boolean {
  const x = layer.x ?? 0;
  const y = layer.y ?? 0;
  const w = layer.width ?? 0;
  const h = layer.height ?? 0;
  return !(x + w <= 0 || y + h <= 0 || x >= ARTBOARD_WIDTH || y >= artboardHeight);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function importImageFiles(
  files: File[],
  stagePos?: { x: number; y: number },
) {
  const store = usePosterStore.getState();
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await fileToDataUrl(file);
    const natural = await loadImageSize(dataUrl);
    const maxW = ARTBOARD_WIDTH * 0.55;
    const scale = Math.min(1, maxW / natural.width);
    const width = Math.round(natural.width * scale);
    const height = Math.round(natural.height * scale);
    const x = stagePos?.x ?? Math.round((ARTBOARD_WIDTH - width) / 2);
    const y = stagePos?.y ?? Math.round(store.artboardHeight * 0.12);
    store.addImageLayer(dataUrl, { name: file.name.replace(/\.[^.]+$/, ''), x, y, width, height });
  }
}

interface PosterCanvasProps {
  zoom?: number;
  onZoomChange?: (z: number) => void;
}

export function PosterCanvas({ zoom, onZoomChange }: PosterCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const mvRef = useRef<Konva.Image>(null);
  const freeImgRef = useRef<Konva.Image | null>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slotFileRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<{ cardId: string; slot: ReplaceSlot } | null>(null);
  const textEditRef = useRef<HTMLTextAreaElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [innerScale, setInnerScale] = useState(0.35);
  const scale = zoom ?? innerScale;
  const setScale = (z: number | ((prev: number) => number)) => {
    const next = typeof z === 'function' ? z(scale) : z;
    setInnerScale(next);
    onZoomChange?.(next);
  };
  const [stagePos, setStagePos] = useState({ x: 40, y: 40 });
  const painting = useRef(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [textEdit, setTextEdit] = useState<{
    cardId: string;
    field: CardTextField;
    value: string;
    left: number;
    top: number;
    width: number;
    height: number;
    fontSize: number;
    fontWeight: string;
    color: string;
  } | null>(null);

  const artboardHeight = usePosterStore((s) => s.artboardHeight);
  const footer = usePosterStore((s) => s.footer);
  const aiBackgroundDataUrl = usePosterStore((s) => s.aiBackgroundDataUrl || s.backgroundDataUrl);
  const manualBackgroundDataUrl = usePosterStore((s) => s.manualBackgroundDataUrl);
  const mainVisualDataUrl = usePosterStore((s) => s.mainVisualDataUrl);
  const mainVisual = usePosterStore((s) => s.mainVisual);
  const maskVisible = usePosterStore((s) => s.maskVisible);
  const layerStack = usePosterStore((s) => s.layerStack);
  const selectedLayerId = usePosterStore((s) => s.selectedLayerId);
  const cardGroups = usePosterStore((s) => s.cardGroups);
  const showBounds = usePosterStore((s) => s.showBounds);
  const cards = usePosterStore((s) => s.cards);
  const selectedCardId = usePosterStore((s) => s.selectedCardId);
  const replaceTarget = usePosterStore((s) => s.replaceTarget);
  const mainVisualSelected = usePosterStore((s) => s.mainVisualSelected);
  const toolMode = usePosterStore((s) => s.toolMode);
  const brush = usePosterStore((s) => s.brush);
  const maskVersion = usePosterStore((s) => s.maskVersion);

  const aiBgImg = useImage(aiBackgroundDataUrl);
  const manualBgImg = useImage(manualBackgroundDataUrl);
  const mvImg = useImage(mainVisualDataUrl);
  const [composedMv, setComposedMv] = useState<HTMLImageElement | HTMLCanvasElement | undefined>();

  const mvLayerVisible = layerStack.find((l) => l.kind === 'mainVisual')?.visible ?? true;
  const selectedFreeLayer = layerStack.find(
    (l) => l.id === selectedLayerId && l.kind === 'custom' && l.dataUrl && l.width != null,
  );
  const renderOrder = [...layerStack].reverse();
  const freeSelected = Boolean(selectedFreeLayer) && !mainVisualSelected;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mvImg || !mainVisual) {
      setComposedMv(undefined);
      return;
    }
    const store = usePosterStore.getState();
    const mask = store.maskCanvas;
    const applyMask = maskVisible && mask;
    if (!applyMask) {
      setComposedMv(mvImg);
      return;
    }
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(mainVisual.width));
    c.height = Math.max(1, Math.round(mainVisual.height));
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(mvImg, 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0, c.width, c.height);
    setComposedMv(c);
  }, [mvImg, mainVisual, maskVisible, maskVersion]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (toolMode === 'select' && mainVisualSelected && mvRef.current && mainVisual && mvLayerVisible) {
      tr.nodes([mvRef.current]);
      tr.getLayer()?.batchDraw();
    } else if (toolMode === 'select' && freeSelected && freeImgRef.current) {
      tr.nodes([freeImgRef.current]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [toolMode, mainVisualSelected, mainVisual, composedMv, mvLayerVisible, freeSelected, selectedLayerId, selectedFreeLayer]);

  const titleFontSize = usePosterStore((s) => s.titleFontSize);
  const keywordFontSize = usePosterStore((s) => s.keywordFontSize);
  const metricsFontSize = usePosterStore((s) => s.metricsFontSize);
  const coverInsetLeft = usePosterStore((s) => s.coverInsetLeft);
  const qrInsetRight = usePosterStore((s) => s.qrInsetRight);
  const titleKeywordGap = usePosterStore((s) => s.titleKeywordGap);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textEdit) return;
      const store = usePosterStore.getState();
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        store.clearSelection();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = store.replaceTarget;
        if (target) {
          e.preventDefault();
          store.clearCardSlot(target.cardId, target.slot);
          return;
        }
        const free = store.layerStack.find(
          (l) => l.id === store.selectedLayerId && l.kind === 'custom' && !l.locked,
        );
        if (free) {
          e.preventDefault();
          store.removeLayer(free.id);
          return;
        }
      }
      if (e.key === '[') store.setBrush({ size: Math.max(5, store.brush.size - 5) });
      if (e.key === ']') store.setBrush({ size: Math.min(300, store.brush.size + 5) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [textEdit]);

  useEffect(() => {
    if (textEdit) textEditRef.current?.focus();
  }, [textEdit]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (!files.length) return;
      e.preventDefault();
      await importImageFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  const paintAt = (stageX: number, stageY: number, eraseOverride?: boolean) => {
    const store = usePosterStore.getState();
    if (!store.mainVisual || !store.mainVisualDataUrl) return;
    const mv = store.mainVisual;
    const localX = stageX - mv.x;
    const localY = stageY - mv.y;
    if (localX < 0 || localY < 0 || localX > mv.width || localY > mv.height) return;

    const mask = store.ensureMask(Math.round(mv.width), Math.round(mv.height));
    const ctx = mask.getContext('2d')!;
    const r = store.brush.size / 2;
    const soft = 1 - store.brush.hardness / 100;
    const alpha = Math.max(0.15, store.brush.opacity / 100);
    const erase = eraseOverride ?? store.brush.erase;
    if (erase) {
      ctx.globalCompositeOperation = 'destination-out';
      const g2 = ctx.createRadialGradient(localX, localY, r * (1 - soft) * 0.15, localX, localY, r);
      g2.addColorStop(0, `rgba(0,0,0,${alpha})`);
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(localX, localY, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      const grad = ctx.createRadialGradient(localX, localY, r * (1 - soft) * 0.2, localX, localY, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(localX, localY, r, 0, Math.PI * 2);
      ctx.fill();
    }
    store.bumpMaskVersion();
  };

  const beginPaint = (e: {
    evt: MouseEvent;
    target: { getStage: () => { getRelativePointerPosition: () => { x: number; y: number } | null } | null };
  }) => {
    if (toolMode !== 'mask') return false;
    const stage = e.target.getStage();
    const pos = stage?.getRelativePointerPosition();
    if (!pos) return false;
    usePosterStore.getState().pushMaskUndo();
    painting.current = true;
    const erase = e.evt.altKey
      ? !usePosterStore.getState().brush.erase
      : usePosterStore.getState().brush.erase;
    paintAt(pos.x, pos.y, erase);
    return true;
  };

  const openSlotUpload = (cardId: string, slot: ReplaceSlot) => {
    pendingSlotRef.current = { cardId, slot };
    usePosterStore.getState().selectCard(cardId);
    usePosterStore.getState().setReplaceTarget({ cardId, slot });
    slotFileRef.current?.click();
  };

  const beginTextEdit = (cardId: string, field: CardTextField) => {
    const card = usePosterStore.getState().cards.find((c) => c.id === cardId);
    if (!card) return;
    const metricsLine = `曝光量：${(card.exposureText || '').trim() || '—'}    互动量：${(card.engagementText || '').trim() || '—'}`;
    const measureCtx = document.createElement('canvas').getContext('2d')!;
    measureCtx.font = `${TYPOGRAPHY.metricsWeight} ${metricsFontSize}px ${TYPOGRAPHY.fontFamily}`;
    const layout = computeCardContentLayout(card.width, card.height, {
      coverInsetLeft,
      titleFontSize,
      keywordFontSize,
      metricsFontSize,
      showMetrics: card.showMetrics,
      titleKeywordGap,
      qrInsetRight,
      metricsText: metricsLine,
      measureMetrics: (s) => measureCtx.measureText(s).width,
    });
    const lineH = layout.titleSize * 1.25;
    const kwLineH = layout.kwSize * 1.25;
    const titleLinesApprox = Math.min(
      6,
      Math.max(1, card.title.split(/\n/).length + (card.title.length > 12 ? 1 : 0)),
    );
    const kwLinesApprox = Math.min(4, Math.max(1, card.keywords.split(/\n/).length));
    const blockH =
      titleLinesApprox * lineH +
      (layout.showMetrics
        ? layout.titleMetricsGap + layout.metricsBlockH + layout.metricsKeywordGap
        : titleKeywordGap) +
      kwLinesApprox * kwLineH;
    const textTop = (card.height - blockH) / 2;
    const metricsTop = textTop + titleLinesApprox * lineH + layout.titleMetricsGap;
    const kwTop = layout.showMetrics
      ? metricsTop + layout.metricsBlockH + layout.metricsKeywordGap
      : textTop + titleLinesApprox * lineH + titleKeywordGap;

    let artY = textTop;
    let fontSize = layout.titleSize;
    let fontWeight = '600';
    let color: string = TYPOGRAPHY.colorBlack;
    let height = Math.max(lineH * 2, titleLinesApprox * lineH + 12);
    let value = card.title;

    if (field === 'keywords') {
      artY = kwTop;
      fontSize = layout.kwSize;
      fontWeight = '300';
      color = TYPOGRAPHY.colorMidGray;
      height = Math.max(kwLineH * 2, kwLinesApprox * kwLineH + 12);
      value = card.keywords;
    } else if (field === 'exposure') {
      artY = metricsTop;
      fontSize = layout.metricsSize;
      fontWeight = '300';
      color = TYPOGRAPHY.colorMidGray;
      height = Math.max(28, layout.metricsBarHeight + 8);
      value = card.exposureText || '';
    } else if (field === 'engagement') {
      artY = metricsTop;
      fontSize = layout.metricsSize;
      fontWeight = '300';
      color = TYPOGRAPHY.colorMidGray;
      height = Math.max(28, layout.metricsBarHeight + 8);
      value = card.engagementText || '';
    }

    const artX =
      field === 'engagement'
        ? card.x + layout.textX + layout.metricsBarW / 2
        : card.x + layout.textX;
    const editWidth =
      field === 'exposure' || field === 'engagement'
        ? layout.metricsBarW / 2
        : layout.textW;

    setTextEdit({
      cardId,
      field,
      value,
      left: stagePos.x + artX * scale,
      top: stagePos.y + (card.y + artY) * scale,
      width: Math.max(80, editWidth * scale),
      height: Math.max(40, height * scale),
      fontSize: Math.max(12, fontSize * scale),
      fontWeight,
      color,
    });
  };

  const commitTextEdit = (save: boolean) => {
    const edit = textEdit;
    setTextEdit(null);
    if (!edit || !save) return;
    const patch =
      edit.field === 'title'
        ? { title: edit.value }
        : edit.field === 'keywords'
          ? { keywords: edit.value }
          : edit.field === 'exposure'
            ? { exposureText: edit.value, showMetrics: true }
            : { engagementText: edit.value, showMetrics: true };
    usePosterStore.getState().updateImportDraft(edit.cardId, patch, true);
    const msg =
      edit.field === 'title'
        ? '标题已更新'
        : edit.field === 'keywords'
          ? '关键词已更新'
          : edit.field === 'exposure'
            ? '曝光量已更新'
            : '互动量已更新';
    usePosterStore.getState().setStatus(msg);
  };

  const artboardClip = (ctx: Konva.Context) => {
    ctx.beginPath();
    ctx.rect(0, 0, ARTBOARD_WIDTH, artboardHeight);
    ctx.closePath();
  };

  const renderLayerContent = (layer: CanvasLayer) => {
    if (!layer.visible) return null;
    const opacity = (layer.opacity ?? 100) / 100;

    if (layer.kind === 'aiBackground' && aiBgImg) {
      return (
        <KonvaImage
          name="ai-background"
          image={aiBgImg}
          x={0}
          y={0}
          width={ARTBOARD_WIDTH}
          height={artboardHeight}
          opacity={opacity}
          listening={false}
        />
      );
    }

    if (layer.kind === 'manualBackground' && manualBgImg) {
      return (
        <KonvaImage
          name="manual-background"
          image={manualBgImg}
          x={0}
          y={0}
          width={ARTBOARD_WIDTH}
          height={artboardHeight}
          opacity={opacity}
          listening={false}
        />
      );
    }

    if (layer.kind === 'custom' && layer.dataUrl) {
      const isFree = layer.width != null && layer.height != null;
      if (!isFree) {
        return (
          <FullBleedCustom
            dataUrl={layer.dataUrl}
            width={ARTBOARD_WIDTH}
            height={artboardHeight}
            opacity={opacity}
          />
        );
      }
      const selected = selectedLayerId === layer.id && !mainVisualSelected;
      const node = (
        <FreeImageNode
          layer={layer}
          selected={selected}
          draggable={toolMode === 'select'}
          nodeRef={selected ? (n) => { freeImgRef.current = n; } : undefined}
          onSelect={() => usePosterStore.getState().selectLayer(layer.id)}
          onTransformEnd={() => {
            const node = freeImgRef.current;
            if (!node) return;
            const sx = node.scaleX();
            const sy = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            usePosterStore.getState().pushHistory();
            usePosterStore.getState().updateLayerTransform(layer.id, {
              x: node.x(),
              y: node.y(),
              width: Math.max(20, node.width() * sx),
              height: Math.max(20, node.height() * sy),
            });
          }}
        />
      );
      // 与画板相交：裁剪到画板内；完全在画板外：原样显示
      if (intersectsArtboard(layer, artboardHeight)) {
        return (
          <Group key={`free-clip-${layer.id}`} clipFunc={artboardClip}>
            {node}
          </Group>
        );
      }
      return <Group key={`free-out-${layer.id}`}>{node}</Group>;
    }

    if (layer.kind === 'mainVisual' && composedMv && mainVisual) {
      return (
        <KonvaImage
          ref={mvRef}
          name="main-visual"
          image={composedMv}
          x={mainVisual.x}
          y={mainVisual.y}
          width={mainVisual.width}
          height={mainVisual.height}
          opacity={opacity}
          draggable={toolMode === 'select'}
          onMouseDown={(e) => {
            if (toolMode === 'mask') {
              beginPaint(e);
              e.cancelBubble = true;
              return;
            }
            e.cancelBubble = true;
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            if (toolMode !== 'select') return;
            usePosterStore.getState().selectMainVisual(true);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            if (toolMode !== 'select') return;
            usePosterStore.getState().selectMainVisual(true);
          }}
          onDragStart={() => usePosterStore.getState().selectMainVisual(true)}
          onDragEnd={(e) => {
            usePosterStore.getState().updateMainVisualTransform({ x: e.target.x(), y: e.target.y() });
          }}
          onTransformEnd={() => {
            const node = mvRef.current;
            if (!node) return;
            const sx = node.scaleX();
            const sy = node.scaleY();
            node.scaleX(1);
            node.scaleY(1);
            usePosterStore.getState().updateMainVisualTransform({
              x: node.x(),
              y: node.y(),
              width: Math.max(20, node.width() * sx),
              height: Math.max(20, node.height() * sy),
            });
          }}
        />
      );
    }

    if (layer.kind === 'cardGroup' && layer.refId) {
      const group = cardGroups.find((g) => g.id === layer.refId);
      if (!group) return null;
      const groupCards = cards.filter((c) => group.rowIds.includes(c.id));
      return (
        <Group name={`card-group-${layer.refId}`} opacity={opacity}>
          {groupCards.map((card) => (
            <CardLayer
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              replaceSlot={replaceTarget?.cardId === card.id ? replaceTarget.slot : null}
              draggable={toolMode === 'select' && !textEdit}
              editingField={textEdit?.cardId === card.id ? textEdit.field : null}
              onSelect={() => usePosterStore.getState().selectCard(card.id)}
              onSlotDblClick={(slot) => openSlotUpload(card.id, slot)}
              onSlotSelect={(slot) =>
                usePosterStore.getState().setReplaceTarget({ cardId: card.id, slot })
              }
              onTextDblClick={(field) => beginTextEdit(card.id, field)}
              onChange={(patch) => {
                const rest = { ...patch };
                delete rest.height;
                usePosterStore.getState().updateCard(card.id, rest);
                usePosterStore.getState().recomputeArtboardHeight();
              }}
            />
          ))}
        </Group>
      );
    }

    return null;
  };

  return (
    <div
      className={`canvas-wrap ${dragOver ? 'drop-active' : ''}`}
      ref={containerRef}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = [...e.dataTransfer.files];
        const stage = stageRef.current;
        let pos: { x: number; y: number } | undefined;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            pos = {
              x: (pointer.x - stagePos.x) / scale - 80,
              y: (pointer.y - stagePos.y) / scale - 60,
            };
          }
        }
        await importImageFiles(files, pos);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) await importImageFiles(files);
        }}
      />
      <input
        ref={slotFileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          const pending = pendingSlotRef.current;
          pendingSlotRef.current = null;
          if (!file || !pending) return;
          if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(file.name)) {
            usePosterStore.getState().setStatus('请选择图片文件');
            return;
          }
          const dataUrl = await fileToDataUrl(file);
          const patch =
            pending.slot === 'cover'
              ? { coverDataUrl: dataUrl, coverFileName: file.name }
              : pending.slot === 'qr'
                ? { qrDataUrl: dataUrl, qrFileName: file.name }
                : { avatarDataUrl: dataUrl, avatarFileName: file.name, showAvatar: true };
          usePosterStore.getState().updateImportDraft(pending.cardId, patch, true);
          usePosterStore.getState().setReplaceTarget(null);
          usePosterStore
            .getState()
            .setStatus(
              pending.slot === 'cover'
                ? '封面已上传'
                : pending.slot === 'qr'
                  ? '二维码已上传'
                  : '头像已上传',
            );
        }}
      />
      <button
        type="button"
        className="canvas-insert-btn"
        title="插入图片到作业区（也支持拖入 / ⌘V 粘贴）"
        onClick={() => fileInputRef.current?.click()}
      >
        插入图片
      </button>
      {textEdit && (
        <textarea
          ref={textEditRef}
          data-card-text-edit
          className="card-text-editor"
          value={textEdit.value}
          style={{
            left: textEdit.left,
            top: textEdit.top,
            width: textEdit.width,
            height: textEdit.height,
            fontSize: textEdit.fontSize,
            fontWeight: textEdit.fontWeight,
            color: textEdit.color,
            lineHeight: 1.25,
          }}
          onChange={(e) => setTextEdit({ ...textEdit, value: e.target.value })}
          onBlur={() => commitTextEdit(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              commitTextEdit(false);
            }
            // Enter 换行；⌘/Ctrl+Enter 提交
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              commitTextEdit(true);
            }
          }}
        />
      )}
      <Stage
        ref={stageRef}
        width={size.w}
        height={size.h}
        scaleX={scale}
        scaleY={scale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={toolMode === 'select' && !mainVisualSelected && !selectedCardId && !freeSelected}
        onWheel={(e) => {
          e.evt.preventDefault();
          const stage = stageRef.current;
          if (!stage) return;
          const oldScale = scale;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          const direction = e.evt.deltaY > 0 ? -1 : 1;
          const newScale = Math.min(2, Math.max(0.1, oldScale * (direction > 0 ? 1.08 : 1 / 1.08)));
          const mousePointTo = {
            x: (pointer.x - stagePos.x) / oldScale,
            y: (pointer.y - stagePos.y) / oldScale,
          };
          setScale(newScale);
          setStagePos({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          });
        }}
        onDragEnd={(e) => {
          if (e.target === stageRef.current) setStagePos({ x: e.target.x(), y: e.target.y() });
        }}
        onMouseDown={(e) => {
          if (beginPaint(e)) return;
          const name = e.target.name?.() || '';
          if (e.target === stageRef.current || name === 'workspace-bg' || name === 'artboard-bg') {
            usePosterStore.getState().clearSelection();
          }
        }}
        onMouseMove={(e) => {
          const stage = e.target.getStage();
          const pos = stage?.getRelativePointerPosition();
          if (!pos) return;
          if (toolMode === 'mask') setCursor(pos);
          else setCursor(null);
          if (painting.current && toolMode === 'mask') {
            const erase = e.evt.altKey
              ? !usePosterStore.getState().brush.erase
              : usePosterStore.getState().brush.erase;
            paintAt(pos.x, pos.y, erase);
          }
        }}
        onMouseUp={() => {
          painting.current = false;
        }}
        onMouseLeave={() => {
          painting.current = false;
          setCursor(null);
        }}
      >
        <Layer>
          <Rect name="workspace-bg" x={-4000} y={-4000} width={10000} height={20000} fill="#0e0c0b" />

          <Rect
            name="artboard-bg"
            x={0}
            y={0}
            width={ARTBOARD_WIDTH}
            height={artboardHeight}
            fill="#ffffff"
            shadowColor="black"
            shadowBlur={40}
            shadowOpacity={0.35}
          />

          {renderOrder.map((layer) => {
            if (!layer.visible) return null;
            // 自由图片：可画板外显示；相交时内部已裁剪
            if (layer.kind === 'custom' && layer.dataUrl && layer.width != null) {
              return renderLayerContent(layer);
            }
            // 其余图层：始终裁剪在画板内
            return (
              <Group key={layer.id} clipFunc={artboardClip}>
                {renderLayerContent(layer)}
              </Group>
            );
          })}

          <Group clipFunc={artboardClip}>
            {footer.enabled && footer.text && (
              <Text
                x={CARD_DEFAULT.marginX}
                y={footerTopY(cards, footer)}
                width={ARTBOARD_WIDTH - CARD_DEFAULT.marginX * 2}
                height={footer.height}
                text={footer.text}
                align="center"
                verticalAlign="middle"
                fontSize={footer.fontSize}
                fontFamily={TYPOGRAPHY.fontFamily}
                fill={footer.color}
                opacity={0.88}
                listening={false}
              />
            )}
          </Group>

          <Transformer
            ref={trRef}
            rotateEnabled={false}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 20 || newBox.height < 20) return oldBox;
              return newBox;
            }}
          />

          {showBounds && (
            <Rect
              x={0}
              y={0}
              width={ARTBOARD_WIDTH}
              height={artboardHeight}
              stroke="rgba(232, 180, 90, 0.75)"
              strokeWidth={2}
              dash={[8, 6]}
              listening={false}
            />
          )}

          {toolMode === 'mask' && cursor && (
            <Circle
              x={cursor.x}
              y={cursor.y}
              radius={brush.size / 2}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={1 / scale}
              dash={[4 / scale, 4 / scale]}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
