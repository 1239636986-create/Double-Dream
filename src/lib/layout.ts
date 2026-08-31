import { v4 as uuid } from 'uuid';
import { ARTBOARD_WIDTH, CARD_DEFAULT, CARD_STYLE, cardFillFromBrightness, cardOriginX } from './constants';
import type { CardGroup, CardItem, ImportDraftRow, TextColor } from './types';

export function makeGroup(name: string, rowIds: string[], spacing: number): CardGroup {
  return {
    id: uuid(),
    name,
    rowIds: [...rowIds],
    spacing,
  };
}

export function defaultGroupsForDrafts(drafts: ImportDraftRow[]): CardGroup[] {
  return [makeGroup('分组 1', drafts.map((d) => d.id), CARD_DEFAULT.firstGroupTop)];
}

/**
 * 按「账号」字段自动分组：同账号归一组，组名=账号；
 * 空账号归入「未命名账号」；无任何账号时退回单组。
 * 组顺序与组内行序均按表格出现顺序。
 */
export function groupsByAccountForDrafts(drafts: ImportDraftRow[]): CardGroup[] {
  if (!drafts.length) {
    return [makeGroup('分组 1', [], CARD_DEFAULT.firstGroupTop)];
  }

  const hasAnyAccount = drafts.some((d) => (d.account || '').trim());
  if (!hasAnyAccount) {
    return defaultGroupsForDrafts(drafts);
  }

  const order: string[] = [];
  const buckets = new Map<string, string[]>();
  for (const d of drafts) {
    const key = (d.account || '').trim() || '未命名账号';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(d.id);
  }

  return order.map((name, i) =>
    makeGroup(
      name,
      buckets.get(name)!,
      i === 0 ? CARD_DEFAULT.firstGroupTop : CARD_DEFAULT.sectionGap,
    ),
  );
}

/** 按分组与组内间距排布卡片 */
export function cardsFromDrafts(
  drafts: ImportDraftRow[],
  groups: CardGroup[],
  gap: number,
  radius: number,
  textColor: TextColor,
  height: number,
  fillOpacity: number = CARD_DEFAULT.fillOpacity as number,
  cardWidth: number = CARD_STYLE.widthDefault,
  brightness: number = CARD_STYLE.brightnessDefault,
  cardLeft: number = cardOriginX(),
): CardItem[] {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const cards: CardItem[] = [];
  let prevBottom = 0;
  const left = Math.max(
    CARD_STYLE.leftMin,
    Math.min(CARD_STYLE.leftMax, Math.round(cardLeft)),
  );
  const maxW = Math.max(CARD_STYLE.widthMin, ARTBOARD_WIDTH - left - CARD_DEFAULT.marginX);
  const width = Math.max(
    CARD_STYLE.widthMin,
    Math.min(CARD_STYLE.widthMax, maxW, Math.round(cardWidth)),
  );
  const fill = cardFillFromBrightness(brightness);

  groups.forEach((group, gi) => {
    let y = gi === 0 ? group.spacing : prevBottom + group.spacing;
    let placed = 0;
    for (const id of group.rowIds) {
      const item = byId.get(id);
      if (!item) continue;
      cards.push({
        id: item.id,
        title: item.title,
        keywords: item.keywords,
        coverDataUrl: item.coverDataUrl,
        qrDataUrl: item.qrDataUrl,
        videoUrl: item.videoUrl,
        account: item.account,
        nickname: item.nickname,
        avatarDataUrl: item.avatarDataUrl,
        showAvatar: item.showAvatar,
        showMetrics: item.showMetrics,
        exposureText: item.exposureText,
        engagementText: item.engagementText,
        coverOffsetX: item.coverOffsetX,
        coverOffsetY: item.coverOffsetY,
        qrOffsetX: item.qrOffsetX,
        qrOffsetY: item.qrOffsetY,
        x: left,
        y,
        width,
        height,
        textColor,
        fill,
        fillOpacity,
        borderWidth: CARD_DEFAULT.borderWidth,
        borderColor: CARD_DEFAULT.borderColor,
        borderOpacity: CARD_DEFAULT.borderOpacity,
        radius,
      });
      y += height + gap;
      placed += 1;
    }
    if (placed > 0) prevBottom = y - gap;
  });

  return cards;
}

/** 保证每个 draft 恰好出现在某一组；清理空组（至少保留 1 组） */
export function normalizeGroups(drafts: ImportDraftRow[], groups: CardGroup[]): CardGroup[] {
  const draftIds = new Set(drafts.map((d) => d.id));
  const seen = new Set<string>();
  const next: CardGroup[] = [];

  for (const g of groups) {
    const rowIds = g.rowIds.filter((id) => draftIds.has(id) && !seen.has(id));
    rowIds.forEach((id) => seen.add(id));
    if (rowIds.length) next.push({ ...g, rowIds });
  }

  const orphans = drafts.map((d) => d.id).filter((id) => !seen.has(id));
  if (orphans.length) {
    if (next.length) {
      next[next.length - 1] = {
        ...next[next.length - 1],
        rowIds: [...next[next.length - 1].rowIds, ...orphans],
      };
    } else {
      next.push(makeGroup('分组 1', orphans, CARD_DEFAULT.firstGroupTop));
    }
  }

  if (!next.length) {
    next.push(makeGroup('分组 1', [], CARD_DEFAULT.firstGroupTop));
  }

  return next.map((g, i) => ({
    ...g,
    name: g.name || `分组 ${i + 1}`,
    spacing:
      g.spacing ??
      (i === 0 ? CARD_DEFAULT.firstGroupTop : CARD_DEFAULT.sectionGap),
  }));
}
