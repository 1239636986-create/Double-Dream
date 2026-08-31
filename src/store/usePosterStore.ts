import { v4 as uuid } from 'uuid';
import { create } from 'zustand';
import {
  ARTBOARD_BASE_HEIGHT,
  ARTBOARD_WIDTH,
  BRUSH,
  CARD_DEFAULT,
  CARD_STYLE,
  EXPORT_SCALE_DEFAULT,
  EXPORT_SCALE_AUTO_DEFAULT,
  FOOTER_DEFAULT,
  MAX_CARDS,
  PROJECT_VERSION,
  TYPOGRAPHY,
  cardFillFromBrightness,
  cardOriginX,
  type ExportScale,
} from '@/lib/constants';
import { isQrFileName, isAvatarFileName } from '@/lib/excel';
import {
  cardsFromDrafts,
  defaultGroupsForDrafts,
  groupsByAccountForDrafts,
  makeGroup,
  normalizeGroups,
} from '@/lib/layout';
import {
  buildDefaultLayerStack,
  makeLayer,
  reorderLayers,
  syncCardGroupLayers,
} from '@/lib/layers';
import { DEFAULT_DEMO_TITLES, makePlaceholderCover, makePlaceholderQr } from '@/lib/placeholders';
import type {
  AssetLibItem,
  BrushSettings,
  CanvasLayer,
  CardGroup,
  CardItem,
  FooterSettings,
  ImportDraftRow,
  LayerVisibility,
  ProjectStateSnapshot,
  ReplaceTarget,
  TextColor,
  ToolMode,
} from '@/lib/types';

interface HistorySnap {
  importDrafts: ImportDraftRow[];
  cardGroups: CardGroup[];
  cards: CardItem[];
  cardGap: number;
  cardHeight: number;
  cardRadius: number;
  textColor: TextColor;
  backgroundDataUrl: string | null;
  aiBackgroundDataUrl: string | null;
  manualBackgroundDataUrl: string | null;
  mainVisualDataUrl: string | null;
  mainVisual: { x: number; y: number; width: number; height: number } | null;
  assetLibrary: AssetLibItem[];
  artboardHeight: number;
  footer: FooterSettings;
  layerStack: CanvasLayer[];
  titleFontSize: number;
  keywordFontSize: number;
  nicknameFontSize: number;
  metricsFontSize: number;
  avatarSize: number;
  coverInsetLeft: number;
  qrInsetRight: number;
  avatarGapToCard: number;
  cardOpacity: number;
  cardWidth: number;
  cardLeft: number;
  cardBrightness: number;
  titleKeywordGap: number;
}

const MAX_HISTORY = 40;

function normalizeLayer(l: CanvasLayer): CanvasLayer {
  return {
    ...l,
    opacity: typeof l.opacity === 'number' ? l.opacity : 100,
  };
}

function computeArtboardHeight(cards: CardItem[], footer: FooterSettings): number {
  const margin = CARD_DEFAULT.marginX;
  const footerBlock = footer.enabled ? footer.gap + footer.height + margin : margin;
  if (!cards.length) {
    return Math.max(ARTBOARD_BASE_HEIGHT, footerBlock + 400);
  }
  const bottom = Math.max(...cards.map((c) => c.y + c.height));
  return Math.max(ARTBOARD_BASE_HEIGHT, Math.ceil(bottom + footerBlock));
}

function takeSnap(s: {
  importDrafts: ImportDraftRow[];
  cardGroups: CardGroup[];
  cards: CardItem[];
  cardGap: number;
  cardHeight: number;
  cardRadius: number;
  textColor: TextColor;
  backgroundDataUrl: string | null;
  aiBackgroundDataUrl: string | null;
  manualBackgroundDataUrl: string | null;
  mainVisualDataUrl: string | null;
  mainVisual: { x: number; y: number; width: number; height: number } | null;
  assetLibrary: AssetLibItem[];
  artboardHeight: number;
  footer: FooterSettings;
  layerStack: CanvasLayer[];
  titleFontSize: number;
  keywordFontSize: number;
  nicknameFontSize: number;
  metricsFontSize: number;
  avatarSize: number;
  coverInsetLeft: number;
  qrInsetRight: number;
  avatarGapToCard: number;
  cardOpacity: number;
  cardWidth: number;
  cardLeft: number;
  cardBrightness: number;
  titleKeywordGap: number;
}): HistorySnap {
  return {
    importDrafts: s.importDrafts.map((d) => ({ ...d })),
    cardGroups: s.cardGroups.map((g) => ({ ...g, rowIds: [...g.rowIds] })),
    cards: s.cards.map((c) => ({ ...c })),
    cardGap: s.cardGap,
    cardHeight: s.cardHeight,
    cardRadius: s.cardRadius,
    textColor: s.textColor,
    backgroundDataUrl: s.backgroundDataUrl,
    aiBackgroundDataUrl: s.aiBackgroundDataUrl,
    manualBackgroundDataUrl: s.manualBackgroundDataUrl,
    mainVisualDataUrl: s.mainVisualDataUrl,
    mainVisual: s.mainVisual ? { ...s.mainVisual } : null,
    assetLibrary: s.assetLibrary.map((a) => ({ ...a })),
    artboardHeight: s.artboardHeight,
    footer: { ...s.footer },
    layerStack: s.layerStack.map((l) => ({ ...l })),
    titleFontSize: s.titleFontSize,
    keywordFontSize: s.keywordFontSize,
    nicknameFontSize: s.nicknameFontSize,
    metricsFontSize: s.metricsFontSize,
    avatarSize: s.avatarSize,
    coverInsetLeft: s.coverInsetLeft,
    qrInsetRight: s.qrInsetRight,
    avatarGapToCard: s.avatarGapToCard,
    cardOpacity: s.cardOpacity,
    cardWidth: s.cardWidth,
    cardLeft: s.cardLeft,
    cardBrightness: s.cardBrightness,
    titleKeywordGap: s.titleKeywordGap,
  };
}

interface PosterStore {
  artboardHeight: number;
  /** 兼容旧导出：等同 AI 背景 */
  backgroundDataUrl: string | null;
  aiBackgroundDataUrl: string | null;
  manualBackgroundDataUrl: string | null;
  layerStack: CanvasLayer[];
  selectedLayerId: string | null;
  footer: FooterSettings;
  mainVisualDataUrl: string | null;
  maskCanvas: HTMLCanvasElement | null;
  maskVisible: boolean;
  mainVisual: { x: number; y: number; width: number; height: number } | null;
  cards: CardItem[];
  importDrafts: ImportDraftRow[];
  cardGroups: CardGroup[];
  assetLibrary: AssetLibItem[];
  replaceTarget: ReplaceTarget | null;
  selectedCardId: string | null;
  mainVisualSelected: boolean;
  /** @deprecated 由 layerStack 驱动 */
  layerVisible: LayerVisibility;
  textColor: TextColor;
  toolMode: ToolMode;
  brush: BrushSettings;
  cardGap: number;
  cardHeight: number;
  cardRadius: number;
  titleFontSize: number;
  keywordFontSize: number;
  nicknameFontSize: number;
  metricsFontSize: number;
  avatarSize: number;
  coverInsetLeft: number;
  /** 二维码距组件框右侧 */
  qrInsetRight: number;
  /** 头像与组件框间距 */
  avatarGapToCard: number;
  /** 0–100 */
  cardOpacity: number;
  cardWidth: number;
  /** 卡片左缘 x（可调，配合宽度实现左右伸缩） */
  cardLeft: number;
  /** 0–100，50 为默认明度 */
  cardBrightness: number;
  /** 标题与关键词垂直间距（px） */
  titleKeywordGap: number;
  showBounds: boolean;
  generating: boolean;
  generateProgress: number;
  statusMessage: string;
  maskUndoStack: ImageData[];
  maskRedoStack: ImageData[];
  maskVersion: number;
  historyPast: HistorySnap[];
  historyFuture: HistorySnap[];
  seeded: boolean;
  /** PNG 导出倍率 1 / 1.5 / 2 / 3 */
  exportScale: ExportScale;
  /** true = 按素材原图像素自动选倍率（推荐） */
  exportScaleAuto: boolean;

  setStatus: (msg: string) => void;
  setExportScale: (scale: ExportScale) => void;
  setExportScaleAuto: (auto: boolean) => void;
  setToolMode: (m: ToolMode) => void;
  setCardGap: (gap: number, recordHistory?: boolean) => void;
  setCardHeight: (h: number, recordHistory?: boolean) => void;
  setCardRadius: (r: number, recordHistory?: boolean) => void;
  setTitleFontSize: (n: number, recordHistory?: boolean) => void;
  setKeywordFontSize: (n: number, recordHistory?: boolean) => void;
  setNicknameFontSize: (n: number, recordHistory?: boolean) => void;
  setMetricsFontSize: (n: number, recordHistory?: boolean) => void;
  setAvatarSize: (n: number, recordHistory?: boolean) => void;
  setCoverInsetLeft: (n: number, recordHistory?: boolean) => void;
  setQrInsetRight: (n: number, recordHistory?: boolean) => void;
  setAvatarGapToCard: (n: number, recordHistory?: boolean) => void;
  setCardOpacity: (n: number, recordHistory?: boolean) => void;
  setCardWidth: (n: number, recordHistory?: boolean, anchor?: 'left' | 'right') => void;
  setCardLeft: (n: number, recordHistory?: boolean) => void;
  setCardBrightness: (n: number, recordHistory?: boolean) => void;
  setTitleKeywordGap: (n: number, recordHistory?: boolean) => void;
  setLayerOpacity: (id: string, n: number, recordHistory?: boolean) => void;
  setShowBounds: (v: boolean) => void;
  setBrush: (partial: Partial<BrushSettings>) => void;
  setTextColor: (c: TextColor) => void;
  setBackground: (url: string | null) => void;
  setAiBackground: (url: string | null) => void;
  setManualBackground: (url: string | null) => void;
  setFooter: (patch: Partial<FooterSettings>, recordHistory?: boolean) => void;
  setMainVisual: (url: string, meta?: { width: number; height: number }) => void;
  updateMainVisualTransform: (t: Partial<{ x: number; y: number; width: number; height: number }>) => void;
  ensureMask: (w: number, h: number) => HTMLCanvasElement;
  setMaskVisible: (v: boolean) => void;
  bumpMaskVersion: () => void;
  pushMaskUndo: () => void;
  undoMask: () => void;
  redoMask: () => void;
  resetMask: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  setCards: (cards: CardItem[]) => void;
  updateCard: (id: string, patch: Partial<CardItem>) => void;
  clearCardSlot: (cardId: string, slot: import('@/lib/types').ReplaceSlot) => void;
  selectCard: (id: string | null) => void;
  selectMainVisual: (v: boolean) => void;
  selectLayer: (id: string | null) => void;
  toggleLayerVisible: (id: string) => void;
  reorderLayerStack: (from: number, to: number) => void;
  addCustomLayer: () => void;
  addImageLayer: (
    dataUrl: string,
    meta?: { name?: string; x?: number; y?: number; width?: number; height?: number },
  ) => void;
  updateLayerTransform: (
    id: string,
    patch: Partial<{ x: number; y: number; width: number; height: number; dataUrl: string | null }>,
  ) => void;
  setCardSpecialtyStyle: (cardId: string, style: import('@/lib/types').SpecialtyCardStyle) => void;
  setCardSpecialtyAccent: (cardId: string, color: string) => void;
  setCardSpecialtyBgOpacity: (cardId: string, opacity: number, recordHistory?: boolean) => void;
  setCardSpecialtyBgMode: (cardId: string, mode: 'dark' | 'white') => void;
  setCardSpecialtyAngle: (cardId: string, angle: number, recordHistory?: boolean) => void;
  setCardSpecialtyStroke: (
    cardId: string,
    patch: Partial<{
      specialtyStrokeWidth: number;
      specialtyStrokeColorA: string;
      specialtyStrokeColorB: string;
      specialtyStrokeOpacityA: number;
      specialtyStrokeOpacityB: number;
      specialtyStrokeAngle: number;
      specialtyStrokeOpacity: number;
    }>,
    recordHistory?: boolean,
  ) => void;
  removeLayer: (id: string) => void;
  renameLayer: (id: string, name: string) => void;
  clearSelection: () => void;
  recomputeArtboardHeight: () => void;
  setGenerating: (v: boolean, progress?: number) => void;
  setImportDrafts: (drafts: ImportDraftRow[]) => void;
  updateImportDraft: (id: string, patch: Partial<ImportDraftRow>, recordHistory?: boolean) => void;
  setImportDraftCount: (count: number) => void;
  syncCardsFromDrafts: () => void;
  seedDefaultCards: () => void;
  createCardsFromAssets: (
    items: Array<{
      title: string;
      keywords: string;
      coverDataUrl: string;
      qrDataUrl: string;
      videoUrl?: string;
      account?: string;
    }>,
  ) => void;
  importExcelRows: (rows: import('@/lib/types').ExcelRow[]) => void;
  addLibraryAssets: (items: Array<{ name: string; dataUrl: string }>, autoFill?: boolean) => void;
  applyFolderMatch: (
    libraryItems: Array<{ name: string; dataUrl: string }>,
    drafts: ImportDraftRow[],
  ) => void;
  applyLibraryAsset: (assetId: string) => void;
  setReplaceTarget: (t: ReplaceTarget | null) => void;
  autoMatchLibrary: () => void;
  setGroupSpacing: (groupId: string, spacing: number, recordHistory?: boolean) => void;
  moveDraftToGroup: (draftId: string, targetGroupId: string, index?: number) => void;
  createGroupWithRows: (rowIds: string[]) => void;
  removeGroup: (groupId: string) => void;
  toSnapshot: () => ProjectStateSnapshot;
  loadSnapshot: (snap: ProjectStateSnapshot) => void;
}

export const usePosterStore = create<PosterStore>((set, get) => {
  const rebuildCards = (
    drafts: ImportDraftRow[],
    groups?: CardGroup[],
    patch: Partial<HistorySnap> = {},
  ) => {
    const gap = patch.cardGap ?? get().cardGap;
    const radius = patch.cardRadius ?? get().cardRadius;
    const textColor = patch.textColor ?? get().textColor;
    const height = patch.cardHeight ?? get().cardHeight;
    const cardGroups = normalizeGroups(drafts, groups ?? patch.cardGroups ?? get().cardGroups);
    const cards = cardsFromDrafts(
      drafts,
      cardGroups,
      gap,
      radius,
      textColor,
      height,
      (patch.cardOpacity ?? get().cardOpacity) / 100,
      patch.cardWidth ?? get().cardWidth,
      patch.cardBrightness ?? get().cardBrightness,
      patch.cardLeft ?? get().cardLeft,
    );
    const baseStack = patch.layerStack ?? get().layerStack;
    const layerStack = syncCardGroupLayers(
      baseStack.length ? baseStack : buildDefaultLayerStack(cardGroups),
      cardGroups,
    );
    return {
      cards,
      cardGroups,
      layerStack,
      artboardHeight: computeArtboardHeight(cards, get().footer),
    };
  };

  const withHistory = (mutator: () => void) => {
    get().pushHistory();
    mutator();
  };

  const applySnap = (snap: HistorySnap) => ({
    importDrafts: snap.importDrafts,
    cardGroups: snap.cardGroups,
    cards: snap.cards,
    cardGap: snap.cardGap,
    cardHeight: snap.cardHeight,
    cardRadius: snap.cardRadius,
    textColor: snap.textColor,
    backgroundDataUrl: snap.aiBackgroundDataUrl || snap.backgroundDataUrl,
    aiBackgroundDataUrl: snap.aiBackgroundDataUrl || snap.backgroundDataUrl,
    manualBackgroundDataUrl: snap.manualBackgroundDataUrl,
    mainVisualDataUrl: snap.mainVisualDataUrl,
    mainVisual: snap.mainVisual,
    assetLibrary: snap.assetLibrary,
    artboardHeight: snap.artboardHeight,
    footer: snap.footer,
    layerStack: snap.layerStack,
    titleFontSize: snap.titleFontSize,
    keywordFontSize: snap.keywordFontSize,
    nicknameFontSize: snap.nicknameFontSize ?? TYPOGRAPHY.nicknameSize,
    metricsFontSize: snap.metricsFontSize ?? TYPOGRAPHY.metricsSize,
    avatarSize: snap.avatarSize ?? CARD_STYLE.avatarSizeDefault,
    coverInsetLeft: snap.coverInsetLeft,
    qrInsetRight: snap.qrInsetRight ?? CARD_STYLE.qrInsetDefault,
    avatarGapToCard: snap.avatarGapToCard ?? CARD_STYLE.avatarGapDefault,
    cardOpacity: snap.cardOpacity,
    cardWidth: snap.cardWidth,
    cardLeft: snap.cardLeft ?? cardOriginX(),
    cardBrightness: snap.cardBrightness,
    titleKeywordGap: snap.titleKeywordGap,
  });

  return {
    artboardHeight: ARTBOARD_BASE_HEIGHT,
    backgroundDataUrl: null,
    aiBackgroundDataUrl: null,
    manualBackgroundDataUrl: null,
    layerStack: buildDefaultLayerStack([]),
    selectedLayerId: null,
    footer: {
      enabled: FOOTER_DEFAULT.enabled,
      text: FOOTER_DEFAULT.text,
      gap: FOOTER_DEFAULT.gap,
      height: FOOTER_DEFAULT.height,
      fontSize: FOOTER_DEFAULT.fontSize,
      color: TYPOGRAPHY.colorBlack,
    },
    mainVisualDataUrl: null,
    maskCanvas: null,
    maskVisible: true,
    mainVisual: null,
    cards: [],
    importDrafts: [],
    cardGroups: [],
    assetLibrary: [],
    replaceTarget: null,
    selectedCardId: null,
    mainVisualSelected: false,
    layerVisible: { background: true, mainVisual: true, mask: true, cards: true },
    textColor: TYPOGRAPHY.colorBlack,
    toolMode: 'select',
    brush: {
      size: BRUSH.sizeDefault,
      hardness: BRUSH.hardnessDefault,
      opacity: Math.max(BRUSH.opacityDefault, 55),
      erase: true,
    },
    cardGap: CARD_DEFAULT.gap,
    cardHeight: CARD_DEFAULT.height,
    cardRadius: CARD_DEFAULT.radius,
    titleFontSize: TYPOGRAPHY.titleSize,
    keywordFontSize: TYPOGRAPHY.keywordSize,
    nicknameFontSize: TYPOGRAPHY.nicknameSize,
    metricsFontSize: TYPOGRAPHY.metricsSize,
    avatarSize: CARD_STYLE.avatarSizeDefault,
    coverInsetLeft: CARD_STYLE.coverInsetDefault,
    qrInsetRight: CARD_STYLE.qrInsetDefault,
    avatarGapToCard: CARD_STYLE.avatarGapDefault,
    cardOpacity: CARD_STYLE.opacityDefault,
    cardWidth: CARD_STYLE.widthDefault,
    cardLeft: cardOriginX(),
    cardBrightness: CARD_STYLE.brightnessDefault,
    titleKeywordGap: CARD_STYLE.titleKeywordGapDefault,
    showBounds: true,
    generating: false,
    generateProgress: 0,
    statusMessage: '',
    maskUndoStack: [],
    maskRedoStack: [],
    maskVersion: 0,
    historyPast: [],
    historyFuture: [],
    seeded: false,
    exportScale: EXPORT_SCALE_DEFAULT,
    exportScaleAuto: EXPORT_SCALE_AUTO_DEFAULT,

    setStatus: (msg) => set({ statusMessage: msg }),
    setExportScale: (scale) => set({ exportScale: scale, exportScaleAuto: false }),
    setExportScaleAuto: (auto) => set({ exportScaleAuto: auto }),
    setToolMode: (m) => set({ toolMode: m }),

    pushHistory: () => {
      const snap = takeSnap(get());
      set({
        historyPast: [...get().historyPast.slice(-(MAX_HISTORY - 1)), snap],
        historyFuture: [],
      });
    },

    undo: () => {
      if (get().toolMode === 'mask' && get().maskUndoStack.length) {
        get().undoMask();
        return;
      }
      const past = get().historyPast;
      if (!past.length) {
        get().setStatus('没有可撤回的操作');
        return;
      }
      const current = takeSnap(get());
      const prev = past[past.length - 1];
      set({
        ...applySnap(prev),
        historyPast: past.slice(0, -1),
        historyFuture: [...get().historyFuture, current],
        replaceTarget: null,
        statusMessage: '已撤回',
      });
    },

    redo: () => {
      if (get().toolMode === 'mask' && get().maskRedoStack.length) {
        get().redoMask();
        return;
      }
      const future = get().historyFuture;
      if (!future.length) {
        get().setStatus('没有可重做的操作');
        return;
      }
      const current = takeSnap(get());
      const next = future[future.length - 1];
      set({
        ...applySnap(next),
        historyFuture: future.slice(0, -1),
        historyPast: [...get().historyPast, current],
        replaceTarget: null,
        statusMessage: '已重做',
      });
    },

    setCardGap: (gap, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const built = rebuildCards(get().importDrafts, undefined, { cardGap: gap });
      set({ cardGap: gap, ...built });
    },

    setCardHeight: (h, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const height = Math.max(120, Math.min(360, Math.round(h)));
      const built = rebuildCards(get().importDrafts, undefined, { cardHeight: height });
      set({ cardHeight: height, ...built });
    },

    setCardRadius: (r, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      set({
        cardRadius: r,
        cards: get().cards.map((c) => ({ ...c, radius: r })),
      });
    },

    setTitleFontSize: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const titleFontSize = Math.max(TYPOGRAPHY.titleSizeMin, Math.min(TYPOGRAPHY.titleSizeMax, Math.round(n)));
      set({ titleFontSize });
    },

    setKeywordFontSize: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const keywordFontSize = Math.max(
        TYPOGRAPHY.keywordSizeMin,
        Math.min(TYPOGRAPHY.keywordSizeMax, Math.round(n)),
      );
      set({ keywordFontSize });
    },

    setNicknameFontSize: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const nicknameFontSize = Math.max(
        TYPOGRAPHY.nicknameSizeMin,
        Math.min(TYPOGRAPHY.nicknameSizeMax, Math.round(n)),
      );
      set({ nicknameFontSize });
    },

    setMetricsFontSize: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const metricsFontSize = Math.max(
        TYPOGRAPHY.metricsSizeMin,
        Math.min(TYPOGRAPHY.metricsSizeMax, Math.round(n)),
      );
      set({ metricsFontSize });
    },

    setAvatarSize: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const avatarSize = Math.max(
        CARD_STYLE.avatarSizeMin,
        Math.min(CARD_STYLE.avatarSizeMax, Math.round(n)),
      );
      set({ avatarSize });
    },

    setCoverInsetLeft: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const coverInsetLeft = Math.max(
        CARD_STYLE.coverInsetMin,
        Math.min(CARD_STYLE.coverInsetMax, Math.round(n)),
      );
      set({ coverInsetLeft });
    },

    setQrInsetRight: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const qrInsetRight = Math.max(
        CARD_STYLE.qrInsetMin,
        Math.min(CARD_STYLE.qrInsetMax, Math.round(n)),
      );
      set({ qrInsetRight });
    },

    setAvatarGapToCard: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const avatarGapToCard = Math.max(
        CARD_STYLE.avatarGapMin,
        Math.min(CARD_STYLE.avatarGapMax, Math.round(n)),
      );
      set({ avatarGapToCard });
    },

    setCardOpacity: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const cardOpacity = Math.max(CARD_STYLE.opacityMin, Math.min(CARD_STYLE.opacityMax, Math.round(n)));
      const fillOpacity = cardOpacity / 100;
      set({
        cardOpacity,
        cards: get().cards.map((c) => ({ ...c, fillOpacity })),
      });
    },

    setCardWidth: (n, recordHistory = true, anchor = 'left') => {
      if (recordHistory) get().pushHistory();
      const prevLeft = get().cardLeft;
      const prevWidth = get().cardWidth;
      const rightEdge = prevLeft + prevWidth;
      let cardWidth = Math.max(CARD_STYLE.widthMin, Math.min(CARD_STYLE.widthMax, Math.round(n)));
      let cardLeft = prevLeft;
      if (anchor === 'right') {
        cardLeft = rightEdge - cardWidth;
        cardLeft = Math.max(
          CARD_STYLE.leftMin,
          Math.min(CARD_STYLE.leftMax, cardLeft),
        );
        cardWidth = Math.min(cardWidth, ARTBOARD_WIDTH - cardLeft - CARD_DEFAULT.marginX);
        cardWidth = Math.max(CARD_STYLE.widthMin, cardWidth);
      } else {
        cardWidth = Math.min(cardWidth, ARTBOARD_WIDTH - cardLeft - CARD_DEFAULT.marginX);
        cardWidth = Math.max(CARD_STYLE.widthMin, cardWidth);
      }
      const built = rebuildCards(get().importDrafts, undefined, { cardWidth, cardLeft });
      set({ cardWidth, cardLeft, ...built });
    },

    setCardLeft: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const prevLeft = get().cardLeft;
      const prevWidth = get().cardWidth;
      const rightEdge = prevLeft + prevWidth;
      let cardLeft = Math.max(CARD_STYLE.leftMin, Math.min(CARD_STYLE.leftMax, Math.round(n)));
      let cardWidth = rightEdge - cardLeft;
      if (cardWidth < CARD_STYLE.widthMin) {
        cardWidth = CARD_STYLE.widthMin;
        cardLeft = Math.min(cardLeft, ARTBOARD_WIDTH - CARD_DEFAULT.marginX - cardWidth);
      }
      if (cardLeft + cardWidth > ARTBOARD_WIDTH - CARD_DEFAULT.marginX) {
        cardWidth = Math.max(
          CARD_STYLE.widthMin,
          ARTBOARD_WIDTH - CARD_DEFAULT.marginX - cardLeft,
        );
      }
      const built = rebuildCards(get().importDrafts, undefined, { cardWidth, cardLeft });
      set({ cardWidth, cardLeft, ...built });
    },

    setCardBrightness: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const cardBrightness = Math.max(
        CARD_STYLE.brightnessMin,
        Math.min(CARD_STYLE.brightnessMax, Math.round(n)),
      );
      const fill = cardFillFromBrightness(cardBrightness);
      set({
        cardBrightness,
        cards: get().cards.map((c) => ({ ...c, fill })),
      });
    },

    setTitleKeywordGap: (n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const titleKeywordGap = Math.max(
        CARD_STYLE.titleKeywordGapMin,
        Math.min(CARD_STYLE.titleKeywordGapMax, Math.round(n)),
      );
      set({ titleKeywordGap });
    },

    setLayerOpacity: (id, n, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const opacity = Math.max(0, Math.min(100, Math.round(n)));
      set({
        layerStack: get().layerStack.map((l) => (l.id === id ? { ...l, opacity } : l)),
      });
    },

    setShowBounds: (v) => set({ showBounds: v }),
    setBrush: (partial) => set({ brush: { ...get().brush, ...partial } }),
    setTextColor: (c) => {
      withHistory(() => {
        set({
          textColor: c,
          cards: get().cards.map((card) => ({ ...card, textColor: c })),
        });
      });
    },

    setBackground: (url) => {
      get().setAiBackground(url);
    },

    setAiBackground: (url) => {
      get().pushHistory();
      set({
        aiBackgroundDataUrl: url,
        backgroundDataUrl: url,
        statusMessage: url ? 'AI 背景已更新' : 'AI 背景已清除',
      });
    },

    setManualBackground: (url) => {
      get().pushHistory();
      set({
        manualBackgroundDataUrl: url,
        statusMessage: url ? '手动绘制背景已更新' : '手动绘制背景已清除',
      });
    },

    setFooter: (patch, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const footer = { ...get().footer, ...patch };
      set({
        footer,
        artboardHeight: computeArtboardHeight(get().cards, footer),
      });
    },

    setMainVisual: (url, meta) => {
      withHistory(() => {
        const w = meta?.width ?? ARTBOARD_WIDTH;
        const h = meta?.height ?? Math.round(ARTBOARD_WIDTH * 0.6);
        const x = (ARTBOARD_WIDTH - w) / 2;
        const y = 80;
        set({
          mainVisualDataUrl: url,
          mainVisual: { x, y, width: w, height: h },
          maskCanvas: null,
          maskUndoStack: [],
          maskRedoStack: [],
          maskVersion: 0,
          mainVisualSelected: true,
          selectedCardId: null,
          selectedLayerId: get().layerStack.find((l) => l.kind === 'mainVisual')?.id ?? null,
        });
      });
    },

    updateMainVisualTransform: (t) => {
      const mv = get().mainVisual;
      if (!mv) return;
      set({ mainVisual: { ...mv, ...t } });
    },

    ensureMask: (w, h) => {
      let canvas = get().maskCanvas;
      if (!canvas || canvas.width !== w || canvas.height !== h) {
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        set({ maskCanvas: canvas, maskUndoStack: [], maskRedoStack: [] });
      }
      return canvas;
    },

    setMaskVisible: (v) => set({ maskVisible: v }),
    bumpMaskVersion: () => set({ maskVersion: get().maskVersion + 1 }),

    pushMaskUndo: () => {
      const canvas = get().maskCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      set({
        maskUndoStack: [...get().maskUndoStack.slice(-29), data],
        maskRedoStack: [],
      });
    },

    undoMask: () => {
      const canvas = get().maskCanvas;
      const stack = get().maskUndoStack;
      if (!canvas || !stack.length) return;
      const ctx = canvas.getContext('2d')!;
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const prev = stack[stack.length - 1];
      ctx.putImageData(prev, 0, 0);
      set({
        maskUndoStack: stack.slice(0, -1),
        maskRedoStack: [...get().maskRedoStack, current],
        maskVersion: get().maskVersion + 1,
      });
    },

    redoMask: () => {
      const canvas = get().maskCanvas;
      const stack = get().maskRedoStack;
      if (!canvas || !stack.length) return;
      const ctx = canvas.getContext('2d')!;
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const next = stack[stack.length - 1];
      ctx.putImageData(next, 0, 0);
      set({
        maskRedoStack: stack.slice(0, -1),
        maskUndoStack: [...get().maskUndoStack, current],
        maskVersion: get().maskVersion + 1,
      });
    },

    resetMask: () => {
      const canvas = get().maskCanvas;
      if (!canvas) return;
      get().pushMaskUndo();
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      set({ maskVersion: get().maskVersion + 1 });
    },

    setCards: (cards) => {
      withHistory(() => set({ cards, artboardHeight: computeArtboardHeight(cards, get().footer) }));
    },

    updateCard: (id, patch) => {
      withHistory(() => {
        const drafts = get().importDrafts.map((d) =>
          d.id === id
            ? {
                ...d,
                title: patch.title ?? d.title,
                keywords: patch.keywords ?? d.keywords,
                nickname: patch.nickname ?? d.nickname,
                coverDataUrl: patch.coverDataUrl ?? d.coverDataUrl,
                qrDataUrl: patch.qrDataUrl ?? d.qrDataUrl,
                avatarDataUrl: patch.avatarDataUrl ?? d.avatarDataUrl,
                showAvatar: patch.showAvatar ?? d.showAvatar,
                showMetrics: patch.showMetrics ?? d.showMetrics,
                exposureText: patch.exposureText ?? d.exposureText,
                engagementText: patch.engagementText ?? d.engagementText,
                coverOffsetX:
                  typeof patch.coverOffsetX === 'number' ? patch.coverOffsetX : d.coverOffsetX,
                coverOffsetY:
                  typeof patch.coverOffsetY === 'number' ? patch.coverOffsetY : d.coverOffsetY,
                qrOffsetX: typeof patch.qrOffsetX === 'number' ? patch.qrOffsetX : d.qrOffsetX,
                qrOffsetY: typeof patch.qrOffsetY === 'number' ? patch.qrOffsetY : d.qrOffsetY,
              }
            : d,
        );
        const built = rebuildCards(drafts);
        const cards = built.cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
        set({
          importDrafts: drafts,
          cards,
          cardGroups: built.cardGroups,
          layerStack: built.layerStack,
          artboardHeight: computeArtboardHeight(cards, get().footer),
        });
      });
    },

    clearCardSlot: (cardId, slot) => {
      withHistory(() => {
        const cardPatch =
          slot === 'cover'
            ? { coverDataUrl: '', coverOffsetX: 0, coverOffsetY: 0 }
            : slot === 'qr'
              ? { qrDataUrl: '', qrOffsetX: 0, qrOffsetY: 0 }
              : { avatarDataUrl: '' };
        const draftPatch =
          slot === 'cover'
            ? { ...cardPatch, coverFileName: '' }
            : slot === 'qr'
              ? { ...cardPatch, qrFileName: '' }
              : { ...cardPatch, avatarFileName: '' };
        const statusMessage =
          slot === 'cover' ? '已删除封面' : slot === 'qr' ? '已删除二维码' : '已删除头像';
        set({
          cards: get().cards.map((c) => (c.id === cardId ? { ...c, ...cardPatch } : c)),
          importDrafts: get().importDrafts.map((d) =>
            d.id === cardId ? { ...d, ...draftPatch } : d,
          ),
          replaceTarget: null,
          statusMessage,
        });
      });
    },

    selectCard: (id) => {
      const group = get().cardGroups.find((g) => g.rowIds.includes(id || ''));
      const layerId = group
        ? get().layerStack.find((l) => l.kind === 'cardGroup' && l.refId === group.id)?.id
        : null;
      set({
        selectedCardId: id,
        mainVisualSelected: false,
        selectedLayerId: layerId ?? get().selectedLayerId,
      });
    },
    selectMainVisual: (v) =>
      set({
        mainVisualSelected: v,
        selectedCardId: v ? null : get().selectedCardId,
        selectedLayerId: v
          ? get().layerStack.find((l) => l.kind === 'mainVisual')?.id ?? null
          : get().selectedLayerId,
      }),
    selectLayer: (id) => {
      const layer = get().layerStack.find((l) => l.id === id);
      if (!layer) {
        set({ selectedLayerId: null });
        return;
      }
      if (layer.kind === 'mainVisual') {
        set({
          selectedLayerId: id,
          mainVisualSelected: true,
          selectedCardId: null,
          toolMode: 'select',
        });
      } else if (layer.kind === 'cardGroup') {
        set({
          selectedLayerId: id,
          mainVisualSelected: false,
          toolMode: 'select',
        });
      } else {
        set({
          selectedLayerId: id,
          mainVisualSelected: false,
          selectedCardId: null,
          toolMode: 'select',
        });
      }
    },
    toggleLayerVisible: (id) => {
      get().pushHistory();
      set({
        layerStack: get().layerStack.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
      });
    },
    reorderLayerStack: (from, to) => {
      get().pushHistory();
      set({ layerStack: reorderLayers(get().layerStack, from, to) });
    },
    addCustomLayer: () => {
      get().pushHistory();
      const n = get().layerStack.filter((l) => l.kind === 'custom').length + 1;
      const layer = makeLayer('custom', `新建图层 ${n}`, { locked: false });
      set({
        layerStack: [layer, ...get().layerStack],
        selectedLayerId: layer.id,
        statusMessage: `已新建「${layer.name}」`,
      });
    },

    addImageLayer: (dataUrl, meta = {}) => {
      get().pushHistory();
      const n = get().layerStack.filter((l) => l.kind === 'custom' && l.dataUrl).length + 1;
      const w = meta.width ?? Math.round(ARTBOARD_WIDTH * 0.45);
      const h = meta.height ?? Math.round(w * 0.75);
      const x = meta.x ?? Math.round((ARTBOARD_WIDTH - w) / 2);
      const y = meta.y ?? Math.round(get().artboardHeight * 0.15);
      const layer = makeLayer('custom', meta.name || `图片 ${n}`, {
        locked: false,
        dataUrl,
        x,
        y,
        width: w,
        height: h,
      });
      set({
        layerStack: [layer, ...get().layerStack],
        selectedLayerId: layer.id,
        selectedCardId: null,
        mainVisualSelected: false,
        toolMode: 'select',
        statusMessage: `已导入「${layer.name}」并新建图层`,
      });
    },

    updateLayerTransform: (id, patch) => {
      set({
        layerStack: get().layerStack.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      });
    },

    setCardSpecialtyStyle: (cardId, style) => {
      get().pushHistory();
      const next =
        style === 'sideGlow' ? 'sideGlow' : style === 'hotspot' ? 'hotspot' : 'none';
      set({
        cards: get().cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                specialtyStyle: next,
                specialtyAccentColor:
                  c.specialtyAccentColor ||
                  (next === 'sideGlow' ? '#322422' : c.specialtyAccentColor),
                specialtyBgOpacity:
                  typeof c.specialtyBgOpacity === 'number'
                    ? c.specialtyBgOpacity
                    : next === 'sideGlow'
                      ? 72
                      : next === 'hotspot'
                        ? 100
                        : c.specialtyBgOpacity,
                specialtyBgMode:
                  c.specialtyBgMode ||
                  (next === 'sideGlow' ? 'dark' : next === 'hotspot' ? 'white' : c.specialtyBgMode),
                specialtyAngle:
                  typeof c.specialtyAngle === 'number' ? c.specialtyAngle : next === 'sideGlow' ? 135 : c.specialtyAngle,
                specialtyStrokeWidth:
                  typeof c.specialtyStrokeWidth === 'number'
                    ? c.specialtyStrokeWidth
                    : next === 'sideGlow'
                      ? 1
                      : c.specialtyStrokeWidth,
                specialtyStrokeColorA: c.specialtyStrokeColorA || (next === 'sideGlow' ? '#FFFFFF' : c.specialtyStrokeColorA),
                specialtyStrokeColorB: c.specialtyStrokeColorB || (next === 'sideGlow' ? '#A89080' : c.specialtyStrokeColorB),
                specialtyStrokeAngle:
                  typeof c.specialtyStrokeAngle === 'number'
                    ? c.specialtyStrokeAngle
                    : next === 'sideGlow'
                      ? 135
                      : c.specialtyStrokeAngle,
                specialtyStrokeOpacity:
                  typeof c.specialtyStrokeOpacity === 'number'
                    ? c.specialtyStrokeOpacity
                    : next === 'sideGlow'
                      ? 28
                      : c.specialtyStrokeOpacity,
                specialtyStrokeOpacityA:
                  typeof c.specialtyStrokeOpacityA === 'number'
                    ? c.specialtyStrokeOpacityA
                    : next === 'sideGlow'
                      ? typeof c.specialtyStrokeOpacity === 'number'
                        ? c.specialtyStrokeOpacity
                        : 28
                      : c.specialtyStrokeOpacityA,
                specialtyStrokeOpacityB:
                  typeof c.specialtyStrokeOpacityB === 'number'
                    ? c.specialtyStrokeOpacityB
                    : next === 'sideGlow'
                      ? typeof c.specialtyStrokeOpacity === 'number'
                        ? c.specialtyStrokeOpacity
                        : 28
                      : c.specialtyStrokeOpacityB,
              }
            : c,
        ),
        statusMessage: next === 'none' ? '已恢复默认卡片样式' : next === 'hotspot' ? '已应用热点描边' : '已应用侧光暗底样式',
      });
    },

    setCardSpecialtyAccent: (cardId, color) => {
      get().pushHistory();
      const hex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '#322422';
      set({
        cards: get().cards.map((c) =>
          c.id === cardId ? { ...c, specialtyAccentColor: hex } : c,
        ),
      });
    },

    setCardSpecialtyBgOpacity: (cardId, opacity, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const specialtyBgOpacity = Math.max(0, Math.min(100, Math.round(opacity)));
      set({
        cards: get().cards.map((c) =>
          c.id === cardId ? { ...c, specialtyBgOpacity } : c,
        ),
      });
    },

    setCardSpecialtyBgMode: (cardId, mode) => {
      get().pushHistory();
      set({
        cards: get().cards.map((c) =>
          c.id === cardId ? { ...c, specialtyBgMode: mode === 'white' ? 'white' : 'dark' } : c,
        ),
      });
    },

    setCardSpecialtyAngle: (cardId, angle, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const specialtyAngle = ((Math.round(angle) % 360) + 360) % 360;
      set({
        cards: get().cards.map((c) => (c.id === cardId ? { ...c, specialtyAngle } : c)),
      });
    },

    setCardSpecialtyStroke: (cardId, patch, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      set({
        cards: get().cards.map((c) => {
          if (c.id !== cardId) return c;
          const next = { ...c, ...patch };
          if (typeof patch.specialtyStrokeWidth === 'number') {
            next.specialtyStrokeWidth = Math.max(0, Math.min(12, patch.specialtyStrokeWidth));
          }
          if (typeof patch.specialtyStrokeAngle === 'number') {
            next.specialtyStrokeAngle = ((Math.round(patch.specialtyStrokeAngle) % 360) + 360) % 360;
          }
          if (typeof patch.specialtyStrokeOpacity === 'number') {
            next.specialtyStrokeOpacity = Math.max(0, Math.min(100, Math.round(patch.specialtyStrokeOpacity)));
          }
          if (typeof patch.specialtyStrokeOpacityA === 'number') {
            next.specialtyStrokeOpacityA = Math.max(
              0,
              Math.min(100, Math.round(patch.specialtyStrokeOpacityA)),
            );
          }
          if (typeof patch.specialtyStrokeOpacityB === 'number') {
            next.specialtyStrokeOpacityB = Math.max(
              0,
              Math.min(100, Math.round(patch.specialtyStrokeOpacityB)),
            );
          }
          if (patch.specialtyStrokeColorA && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(patch.specialtyStrokeColorA)) {
            next.specialtyStrokeColorA = patch.specialtyStrokeColorA;
          }
          if (patch.specialtyStrokeColorB && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(patch.specialtyStrokeColorB)) {
            next.specialtyStrokeColorB = patch.specialtyStrokeColorB;
          }
          return next;
        }),
      });
    },

    removeLayer: (id) => {
      const layer = get().layerStack.find((l) => l.id === id);
      if (!layer) return;
      if (layer.locked) {
        get().setStatus('系统图层不可删除，可隐藏');
        return;
      }
      get().pushHistory();
      set({
        layerStack: get().layerStack.filter((l) => l.id !== id),
        selectedLayerId: get().selectedLayerId === id ? null : get().selectedLayerId,
      });
    },
    renameLayer: (id, name) => {
      set({
        layerStack: get().layerStack.map((l) => (l.id === id ? { ...l, name } : l)),
      });
    },
    clearSelection: () =>
      set({
        selectedCardId: null,
        mainVisualSelected: false,
        selectedLayerId: null,
        replaceTarget: null,
      }),

    recomputeArtboardHeight: () =>
      set({ artboardHeight: computeArtboardHeight(get().cards, get().footer) }),
    setGenerating: (v, progress = 0) => set({ generating: v, generateProgress: progress }),

    setImportDrafts: (drafts) => {
      withHistory(() => {
        const built = rebuildCards(drafts);
        set({ importDrafts: drafts, ...built });
      });
    },

    updateImportDraft: (id, patch, recordHistory = false) => {
      if (recordHistory) get().pushHistory();
      const drafts = get().importDrafts.map((d) => (d.id === id ? { ...d, ...patch } : d));
      const built = rebuildCards(drafts);
      set({ importDrafts: drafts, ...built });
    },

    setImportDraftCount: (count) => {
      withHistory(() => {
        const n = Math.max(1, Math.min(MAX_CARDS, count));
        let drafts = [...get().importDrafts];
        let groups = get().cardGroups.map((g) => ({ ...g, rowIds: [...g.rowIds] }));
        if (drafts.length > n) {
          const keep = new Set(drafts.slice(0, n).map((d) => d.id));
          drafts = drafts.slice(0, n);
          groups = groups.map((g) => ({ ...g, rowIds: g.rowIds.filter((id) => keep.has(id)) }));
        }
        while (drafts.length < n) {
          const i = drafts.length;
          const demo = DEFAULT_DEMO_TITLES[i % DEFAULT_DEMO_TITLES.length];
          const id = uuid();
          drafts.push({
            id,
            title: demo.title,
            keywords: demo.keywords,
            coverFileName: '',
            qrFileName: '',
            coverDataUrl: '',
            qrDataUrl: '',
          });
          if (!groups.length) groups = defaultGroupsForDrafts(drafts);
          else {
            groups[groups.length - 1] = {
              ...groups[groups.length - 1],
              rowIds: [...groups[groups.length - 1].rowIds, id],
            };
          }
        }
        const built = rebuildCards(drafts, groups);
        set({ importDrafts: drafts, ...built });
      });
    },

    syncCardsFromDrafts: () => {
      const built = rebuildCards(get().importDrafts);
      set(built);
    },

    seedDefaultCards: () => {
      if (get().seeded && get().cards.length) return;
      const drafts: ImportDraftRow[] = DEFAULT_DEMO_TITLES.map((d, i) => ({
        id: uuid(),
        title: d.title,
        keywords: d.keywords,
        coverFileName: `cover_0${i + 1}.jpg`,
        qrFileName: `qr_0${i + 1}.png`,
        coverDataUrl: makePlaceholderCover(d.title, i),
        qrDataUrl: makePlaceholderQr(i),
      }));
      const groups = defaultGroupsForDrafts(drafts);
      const built = rebuildCards(drafts, groups);
      set({
        importDrafts: drafts,
        ...built,
        seeded: true,
      });
    },

    createCardsFromAssets: (items) => {
      withHistory(() => {
        const drafts: ImportDraftRow[] = items.map((item) => ({
          id: uuid(),
          title: item.title,
          keywords: item.keywords,
          coverFileName: '',
          qrFileName: '',
          coverDataUrl: item.coverDataUrl,
          qrDataUrl: item.qrDataUrl,
          videoUrl: item.videoUrl,
          account: item.account,
        }));
        const groups = defaultGroupsForDrafts(drafts);
        const built = rebuildCards(drafts, groups);
        set({
          importDrafts: drafts,
          ...built,
          selectedCardId: null,
          seeded: true,
        });
      });
    },

    importExcelRows: (rows) => {
      withHistory(() => {
        const drafts: ImportDraftRow[] = rows.map((row) => {
          const hasMetrics = Boolean(row.exposureText || row.engagementText);
          const hasAvatar = Boolean(row.nickname || row.avatarFileName);
          return {
            id: uuid(),
            title: row.title,
            keywords: row.keywords,
            coverFileName: row.coverFileName,
            qrFileName: row.qrFileName,
            avatarFileName: row.avatarFileName,
            coverDataUrl: '',
            qrDataUrl: '',
            avatarDataUrl: '',
            videoUrl: row.videoUrl,
            account: row.account,
            nickname: row.nickname || row.account,
            showMetrics: hasMetrics,
            showAvatar: hasAvatar,
            exposureText: row.exposureText || '',
            engagementText: row.engagementText || '',
          };
        });
        const groups = groupsByAccountForDrafts(drafts);
        const built = rebuildCards(drafts, groups);
        const accountCount = groups.length;
        const hasAccount = drafts.some((d) => (d.account || '').trim());
        set({
          importDrafts: drafts,
          ...built,
          selectedCardId: null,
          seeded: true,
          statusMessage: hasAccount
            ? `已识别 ${drafts.length} 行，按账号分成 ${accountCount} 组；请上传素材匹配封面/二维码`
            : `已识别 ${drafts.length} 行文案（无账号列，单组）；请上传素材匹配封面/二维码`,
        });
      });
    },

    addLibraryAssets: (items, autoFill = true) => {
      withHistory(() => {
        const added: AssetLibItem[] = items.map((it) => ({
          id: uuid(),
          name: it.name,
          dataUrl: it.dataUrl,
          kind: isAvatarFileName(it.name) ? 'cover' : isQrFileName(it.name) ? 'qr' : 'cover',
        }));
        let drafts = get().importDrafts.map((d) => ({ ...d }));
        if (autoFill && drafts.length) {
          const avatars = items.filter((it) => isAvatarFileName(it.name));
          const covers = items.filter(
            (it) => !isQrFileName(it.name) && !isAvatarFileName(it.name),
          );
          const qrs = items.filter((it) => isQrFileName(it.name));
          let ci = 0;
          let qi = 0;
          let ai = 0;
          drafts = drafts.map((d) => {
            const next = { ...d };
            if (!next.coverDataUrl && covers[ci]) {
              next.coverDataUrl = covers[ci].dataUrl;
              next.coverFileName = covers[ci].name;
              ci += 1;
            }
            if (!next.qrDataUrl && qrs[qi]) {
              next.qrDataUrl = qrs[qi].dataUrl;
              next.qrFileName = qrs[qi].name;
              qi += 1;
            }
            if (!next.avatarDataUrl && avatars[ai]) {
              next.avatarDataUrl = avatars[ai].dataUrl;
              next.avatarFileName = avatars[ai].name;
              next.showAvatar = true;
              ai += 1;
            }
            return next;
          });
        }
        const built = rebuildCards(drafts);
        set({
          assetLibrary: [...get().assetLibrary, ...added],
          importDrafts: drafts,
          ...built,
          statusMessage: autoFill
            ? `已加入 ${added.length} 个素材，并按序填入空的封面/二维码`
            : `已加入 ${added.length} 个素材`,
        });
      });
    },

    applyFolderMatch: (libraryItems, drafts) => {
      withHistory(() => {
        const added: AssetLibItem[] = libraryItems.map((it) => ({
          id: uuid(),
          name: it.name,
          dataUrl: it.dataUrl,
          kind: isQrFileName(it.name) ? 'qr' : 'cover',
        }));
        const groups = normalizeGroups(drafts, get().cardGroups);
        const built = rebuildCards(drafts, groups);
        set({
          assetLibrary: [...get().assetLibrary, ...added],
          importDrafts: drafts,
          ...built,
          statusMessage: `素材文件夹已匹配 ${drafts.length} 行`,
        });
      });
    },

    applyLibraryAsset: (assetId) => {
      const asset = get().assetLibrary.find((a) => a.id === assetId);
      const target = get().replaceTarget;
      if (!asset || !target) {
        get().setStatus('请先双击画板封面/二维码，或点击表格中的添加框');
        return;
      }
      withHistory(() => {
        const patch =
          target.slot === 'cover'
            ? { coverDataUrl: asset.dataUrl, coverFileName: asset.name }
            : target.slot === 'qr'
              ? { qrDataUrl: asset.dataUrl, qrFileName: asset.name }
              : { avatarDataUrl: asset.dataUrl, avatarFileName: asset.name, showAvatar: true };
        const drafts = get().importDrafts.map((d) => (d.id === target.cardId ? { ...d, ...patch } : d));
        const built = rebuildCards(drafts);
        set({
          importDrafts: drafts,
          ...built,
          replaceTarget: null,
          selectedCardId: target.cardId,
          statusMessage: `已替换${target.slot === 'cover' ? '封面' : '二维码'}`,
        });
      });
    },

    setReplaceTarget: (t) =>
      set({
        replaceTarget: t,
        selectedCardId: t?.cardId ?? get().selectedCardId,
        mainVisualSelected: false,
        statusMessage: t
          ? `已选中${t.slot === 'cover' ? '封面' : '二维码'}槽位，点击素材库图片替换`
          : get().statusMessage,
      }),

    autoMatchLibrary: () => {
      const lib = [...get().assetLibrary].sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      if (!lib.length) {
        get().setStatus('素材库为空，请先上传或拖入图片');
        return;
      }
      withHistory(() => {
        const covers = lib.filter((a) => a.kind !== 'qr');
        const qrs = lib.filter((a) => a.kind === 'qr');
        // 按分组展示顺序匹配
        const order = get().cardGroups.flatMap((g) => g.rowIds);
        const drafts = get().importDrafts.map((d) => {
          const i = order.indexOf(d.id);
          const idx = i >= 0 ? i : 0;
          return {
            ...d,
            coverDataUrl: covers[idx]?.dataUrl || d.coverDataUrl,
            coverFileName: covers[idx]?.name || d.coverFileName,
            qrDataUrl: qrs[idx]?.dataUrl || d.qrDataUrl,
            qrFileName: qrs[idx]?.name || d.qrFileName,
          };
        });
        const built = rebuildCards(drafts);
        set({
          importDrafts: drafts,
          ...built,
          statusMessage: '已按文件名顺序自动匹配封面/二维码',
        });
      });
    },

    setGroupSpacing: (groupId, spacing, recordHistory = true) => {
      if (recordHistory) get().pushHistory();
      const groups = get().cardGroups.map((g) =>
        g.id === groupId ? { ...g, spacing: Math.max(0, Math.round(spacing)) } : g,
      );
      const built = rebuildCards(get().importDrafts, groups);
      set(built);
    },

    moveDraftToGroup: (draftId, targetGroupId, index) => {
      withHistory(() => {
        let groups = get().cardGroups.map((g) => ({
          ...g,
          rowIds: g.rowIds.filter((id) => id !== draftId),
        }));
        const ti = groups.findIndex((g) => g.id === targetGroupId);
        if (ti < 0) return;
        const rows = [...groups[ti].rowIds];
        const at = index == null ? rows.length : Math.max(0, Math.min(rows.length, index));
        rows.splice(at, 0, draftId);
        groups[ti] = { ...groups[ti], rowIds: rows };
        groups = normalizeGroups(get().importDrafts, groups);
        const built = rebuildCards(get().importDrafts, groups);
        set({ ...built, statusMessage: '已调整分组' });
      });
    },

    createGroupWithRows: (rowIds) => {
      if (!rowIds.length) {
        get().setStatus('请先选择要移入新组的行');
        return;
      }
      withHistory(() => {
        const idSet = new Set(rowIds);
        let groups = get().cardGroups.map((g) => ({
          ...g,
          rowIds: g.rowIds.filter((id) => !idSet.has(id)),
        }));
        const newGroup = makeGroup(
          `分组 ${groups.length + 1}`,
          rowIds.filter((id) => get().importDrafts.some((d) => d.id === id)),
          CARD_DEFAULT.sectionGap,
        );
        groups = normalizeGroups(get().importDrafts, [...groups, newGroup]);
        // 重命名
        groups = groups.map((g, i) => ({ ...g, name: `分组 ${i + 1}` }));
        const built = rebuildCards(get().importDrafts, groups);
        set({ ...built, statusMessage: `已创建 ${newGroup.name}（${newGroup.rowIds.length} 行）` });
      });
    },

    removeGroup: (groupId) => {
      withHistory(() => {
        const groups = get().cardGroups;
        if (groups.length <= 1) {
          get().setStatus('至少保留一个分组');
          return;
        }
        const target = groups.find((g) => g.id === groupId);
        if (!target) return;
        const rest = groups.filter((g) => g.id !== groupId);
        rest[0] = { ...rest[0], rowIds: [...rest[0].rowIds, ...target.rowIds] };
        const renamed = normalizeGroups(get().importDrafts, rest).map((g, i) => ({
          ...g,
          name: `分组 ${i + 1}`,
        }));
        const built = rebuildCards(get().importDrafts, renamed);
        set({ ...built, statusMessage: '已合并分组' });
      });
    },

    toSnapshot: () => {
      const s = get();
      let maskDataUrl: string | null = null;
      if (s.maskCanvas) maskDataUrl = s.maskCanvas.toDataURL('image/png');
      return {
        version: PROJECT_VERSION,
        artboardHeight: s.artboardHeight,
        backgroundDataUrl: s.aiBackgroundDataUrl || s.backgroundDataUrl,
        aiBackgroundDataUrl: s.aiBackgroundDataUrl,
        manualBackgroundDataUrl: s.manualBackgroundDataUrl,
        mainVisualDataUrl: s.mainVisualDataUrl,
        maskDataUrl,
        mainVisual: s.mainVisual,
        cards: s.cards,
        textColor: s.textColor,
        layerVisible: s.layerVisible,
        layerStack: s.layerStack,
        cardGroups: s.cardGroups,
        footer: s.footer,
      };
    },

    loadSnapshot: (snap) => {
      let maskCanvas: HTMLCanvasElement | null = null;
      if (snap.maskDataUrl) {
        const img = new Image();
        img.src = snap.maskDataUrl;
        maskCanvas = document.createElement('canvas');
        const apply = () => {
          maskCanvas!.width = img.naturalWidth || img.width;
          maskCanvas!.height = img.naturalHeight || img.height;
          const ctx = maskCanvas!.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          set({ maskCanvas, maskVersion: get().maskVersion + 1 });
        };
        if (img.complete) apply();
        else img.onload = apply;
      }
      const drafts: ImportDraftRow[] = (snap.cards || []).map((c) => ({
        id: c.id,
        title: c.title,
        keywords: c.keywords,
        coverFileName: '',
        qrFileName: '',
        coverDataUrl: c.coverDataUrl,
        qrDataUrl: c.qrDataUrl,
        videoUrl: c.videoUrl,
        account: c.account,
      }));
      const height = snap.cards?.[0]?.height || CARD_DEFAULT.height;
      const groups = snap.cardGroups?.length
        ? normalizeGroups(drafts, snap.cardGroups)
        : defaultGroupsForDrafts(drafts);
      const footer = snap.footer || {
        enabled: FOOTER_DEFAULT.enabled,
        text: FOOTER_DEFAULT.text,
        gap: FOOTER_DEFAULT.gap,
        height: FOOTER_DEFAULT.height,
        fontSize: FOOTER_DEFAULT.fontSize,
        color: TYPOGRAPHY.colorWhite,
      };
      const aiBg = snap.aiBackgroundDataUrl || snap.backgroundDataUrl;
      const layerStack = syncCardGroupLayers(
        snap.layerStack?.length ? snap.layerStack.map(normalizeLayer) : buildDefaultLayerStack(groups),
        groups,
      );
      set({
        artboardHeight: snap.artboardHeight || ARTBOARD_BASE_HEIGHT,
        backgroundDataUrl: aiBg,
        aiBackgroundDataUrl: aiBg,
        manualBackgroundDataUrl: snap.manualBackgroundDataUrl || null,
        mainVisualDataUrl: snap.mainVisualDataUrl,
        mainVisual: snap.mainVisual,
        cards: (snap.cards || []).map((c) => ({
          ...c,
          x: typeof c.x === 'number' ? c.x : cardOriginX(),
          width: Math.min(CARD_STYLE.widthMax, c.width || CARD_STYLE.widthDefault),
        })),
        importDrafts: drafts,
        cardGroups: groups,
        layerStack,
        textColor: snap.textColor || TYPOGRAPHY.colorBlack,
        cardHeight: height,
        titleFontSize: TYPOGRAPHY.titleSize,
        keywordFontSize: TYPOGRAPHY.keywordSize,
        nicknameFontSize: TYPOGRAPHY.nicknameSize,
        metricsFontSize: TYPOGRAPHY.metricsSize,
        avatarSize: CARD_STYLE.avatarSizeDefault,
        coverInsetLeft: CARD_STYLE.coverInsetDefault,
        qrInsetRight: CARD_STYLE.qrInsetDefault,
        avatarGapToCard: CARD_STYLE.avatarGapDefault,
        cardOpacity: Math.round((snap.cards?.[0]?.fillOpacity ?? CARD_DEFAULT.fillOpacity) * 100),
        cardWidth: Math.min(
          CARD_STYLE.widthMax,
          snap.cards?.[0]?.width || CARD_STYLE.widthDefault,
        ),
        cardLeft: snap.cards?.[0]?.x ?? cardOriginX(),
        cardBrightness: CARD_STYLE.brightnessDefault,
        titleKeywordGap: CARD_STYLE.titleKeywordGapDefault,
        footer,
        layerVisible: snap.layerVisible || { background: true, mainVisual: true, mask: true, cards: true },
        maskUndoStack: [],
        maskRedoStack: [],
        historyPast: [],
        historyFuture: [],
        selectedCardId: null,
        mainVisualSelected: false,
        selectedLayerId: null,
        replaceTarget: null,
        seeded: true,
      });
    },
  };
});
