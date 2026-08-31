import { v4 as uuid } from 'uuid';
import type { CardGroup, CanvasLayer, LayerKind } from './types';

export function makeLayer(
  kind: LayerKind,
  name: string,
  opts: Partial<
    Pick<CanvasLayer, 'refId' | 'dataUrl' | 'visible' | 'locked' | 'opacity' | 'x' | 'y' | 'width' | 'height'>
  > = {},
): CanvasLayer {
  return {
    id: uuid(),
    kind,
    name,
    visible: opts.visible ?? true,
    locked: opts.locked ?? kind !== 'custom',
    opacity: opts.opacity ?? 100,
    refId: opts.refId,
    dataUrl: opts.dataUrl ?? null,
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
  };
}

/** 默认图层栈：列表顶部 = 画面最前 */
export function buildDefaultLayerStack(groups: CardGroup[]): CanvasLayer[] {
  const cardLayers = groups.map((g, i) =>
    makeLayer('cardGroup', g.name || `卡组 ${i + 1}`, { refId: g.id, locked: true }),
  );
  return [
    ...cardLayers,
    makeLayer('mainVisual', '主视觉', { locked: true }),
    makeLayer('manualBackground', '手动绘制背景', { locked: true }),
    makeLayer('aiBackground', 'AI背景', { locked: true }),
  ];
}

function ensureSystemTail(others: CanvasLayer[]): CanvasLayer[] {
  const systemKinds: LayerKind[] = ['mainVisual', 'manualBackground', 'aiBackground'];
  const byKind = new Map(others.filter((l) => systemKinds.includes(l.kind)).map((l) => [l.kind, l]));
  const customs = others.filter((l) => l.kind === 'custom');
  const labels: Record<string, string> = {
    mainVisual: '主视觉',
    manualBackground: '手动绘制背景',
    aiBackground: 'AI背景',
  };
  const systemOrdered = systemKinds.map(
    (k) => byKind.get(k) || makeLayer(k, labels[k], { locked: true }),
  );
  return [...customs, ...systemOrdered];
}

/**
 * 同步卡组图层：
 * - 保留已有卡组的显隐与相对拖拽顺序
 * - 新建卡组补到卡组区顶部
 * - 系统层 / 自定义层保持在卡组之下
 */
export function syncCardGroupLayers(stack: CanvasLayer[], groups: CardGroup[]): CanvasLayer[] {
  const groupIds = new Set(groups.map((g) => g.id));
  const prevByRef = new Map(
    stack.filter((l) => l.kind === 'cardGroup' && l.refId).map((l) => [l.refId!, l]),
  );
  const others = stack.filter((l) => l.kind !== 'cardGroup');

  const orderedIds: string[] = [];
  for (const l of stack) {
    if (l.kind === 'cardGroup' && l.refId && groupIds.has(l.refId) && !orderedIds.includes(l.refId)) {
      orderedIds.push(l.refId);
    }
  }
  for (const g of groups) {
    if (!orderedIds.includes(g.id)) orderedIds.unshift(g.id);
  }

  const cardLayers = orderedIds.map((gid, i) => {
    const g = groups.find((x) => x.id === gid)!;
    const prev = prevByRef.get(gid);
    if (prev) return { ...prev, name: g.name || prev.name, refId: gid };
    return makeLayer('cardGroup', g.name || `卡组 ${i + 1}`, { refId: gid, locked: true });
  });

  return [...cardLayers, ...ensureSystemTail(others)];
}

export function reorderLayers(stack: CanvasLayer[], from: number, to: number): CanvasLayer[] {
  if (from === to || from < 0 || to < 0 || from >= stack.length || to >= stack.length) return stack;
  const next = [...stack];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function findLayer(
  stack: CanvasLayer[],
  kind: LayerKind,
  refId?: string,
): CanvasLayer | undefined {
  return stack.find((l) =>
    kind === 'cardGroup' ? l.kind === 'cardGroup' && l.refId === refId : l.kind === kind,
  );
}
