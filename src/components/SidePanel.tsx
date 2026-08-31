import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { autoMatchAssetsByOrder, fileToDataUrl, matchAsset, parseExcelFile } from '@/lib/excel';
import { artboardExportInput, exportPng, exportPsd, exportSelectedLayerPng, resolveExportScale } from '@/lib/export';
import { generateBackground } from '@/lib/liblibClient';
import { ARTBOARD_BASE_HEIGHT, ARTBOARD_WIDTH, BRUSH, CARD_STYLE, EXPORT_PNG_DPI, EXPORT_SCALES, MAX_CARDS, TYPOGRAPHY } from '@/lib/constants';
import { usePosterStore } from '@/store/usePosterStore';
import type { ImportDraftRow, TextColor } from '@/lib/types';
import { ManualBgPainter } from './ManualBgPainter';

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>{title}</h3>
        {hint && <p>{hint}</p>}
      </div>
      <div className="panel-section-body">{children}</div>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <div className="field">
      <div className="field-label">
        <span>{label}</span>
        <span className="mono">{value}</span>
      </div>
      {children}
    </div>
  );
}

function SlotThumb({
  src,
  active,
  onClick,
  onDblClick,
  onClear,
}: {
  src: string;
  active: boolean;
  onClick: () => void;
  onDblClick?: () => void;
  onClear?: () => void;
}) {
  return (
    <div className={`slot-thumb-wrap ${active ? 'on' : ''}`}>
      <button
        type="button"
        className={`slot-thumb ${active ? 'on' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onDblClick?.();
        }}
        title={src ? '双击上传替换；点击选中后 Delete 删除' : '双击上传图片'}
      >
        {src ? <img src={src} alt="" /> : <span>-</span>}
      </button>
      {src && onClear && (
        <button
          type="button"
          className="slot-clear"
          title="删除图片"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export function SidePanel({ step }: { step: number }) {
  const excelRef = useRef<HTMLInputElement>(null);
  const assetsRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const visualRef = useRef<HTMLInputElement>(null);
  const slotUploadRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<{ cardId: string; slot: 'cover' | 'qr' | 'avatar' } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const dragRowId = useRef<string | null>(null);

  const brush = usePosterStore((s) => s.brush);
  const textColor = usePosterStore((s) => s.textColor);
  const generating = usePosterStore((s) => s.generating);
  const generateProgress = usePosterStore((s) => s.generateProgress);
  const statusMessage = usePosterStore((s) => s.statusMessage);
  const maskVisible = usePosterStore((s) => s.maskVisible);
  const cards = usePosterStore((s) => s.cards);
  const importDrafts = usePosterStore((s) => s.importDrafts);
  const cardGroups = usePosterStore((s) => s.cardGroups);
  const assetLibrary = usePosterStore((s) => s.assetLibrary);
  const replaceTarget = usePosterStore((s) => s.replaceTarget);
  const artboardHeight = usePosterStore((s) => s.artboardHeight);
  const cardGap = usePosterStore((s) => s.cardGap);
  const cardHeight = usePosterStore((s) => s.cardHeight);
  const cardRadius = usePosterStore((s) => s.cardRadius);
  const titleFontSize = usePosterStore((s) => s.titleFontSize);
  const keywordFontSize = usePosterStore((s) => s.keywordFontSize);
  const nicknameFontSize = usePosterStore((s) => s.nicknameFontSize);
  const metricsFontSize = usePosterStore((s) => s.metricsFontSize);
  const avatarSize = usePosterStore((s) => s.avatarSize);
  const coverInsetLeft = usePosterStore((s) => s.coverInsetLeft);
  const qrInsetRight = usePosterStore((s) => s.qrInsetRight);
  const avatarGapToCard = usePosterStore((s) => s.avatarGapToCard);
  const cardOpacity = usePosterStore((s) => s.cardOpacity);
  const cardWidth = usePosterStore((s) => s.cardWidth);
  const cardLeft = usePosterStore((s) => s.cardLeft);
  const cardBrightness = usePosterStore((s) => s.cardBrightness);
  const titleKeywordGap = usePosterStore((s) => s.titleKeywordGap);
  const selectedCardId = usePosterStore((s) => s.selectedCardId);
  const showBounds = usePosterStore((s) => s.showBounds);
  const mainVisualDataUrl = usePosterStore((s) => s.mainVisualDataUrl);
  const backgroundDataUrl = usePosterStore((s) => s.aiBackgroundDataUrl || s.backgroundDataUrl);
  const footer = usePosterStore((s) => s.footer);
  const toolMode = usePosterStore((s) => s.toolMode);
  const exportScale = usePosterStore((s) => s.exportScale);
  const exportScaleAuto = usePosterStore((s) => s.exportScaleAuto);

  const draftMap = new Map(importDrafts.map((d) => [d.id, d]));
  let globalIndex = 0;

  const openSlotUpload = (cardId: string, slot: 'cover' | 'qr' | 'avatar') => {
    pendingSlotRef.current = { cardId, slot };
    usePosterStore.getState().selectCard(cardId);
    usePosterStore.getState().setReplaceTarget({ cardId, slot });
    slotUploadRef.current?.click();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const target = usePosterStore.getState().replaceTarget;
      if (!target) return;
      e.preventDefault();
      usePosterStore.getState().clearCardSlot(target.cardId, target.slot);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSelectRow = (id: string, multi: boolean) => {
    setSelectedRowIds((prev) => {
      if (!multi) return prev.includes(id) && prev.length === 1 ? [] : [id];
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  const onDropRow = (targetGroupId: string, index?: number) => {
    const id = dragRowId.current;
    if (!id) return;
    usePosterStore.getState().moveDraftToGroup(id, targetGroupId, index);
    dragRowId.current = null;
  };

  const onExcel = async (file: File) => {
    usePosterStore.getState().setStatus(`正在解析 ${file.name}…`);
    const { rows, warning } = await parseExcelFile(file);
    if (!rows.length) {
      usePosterStore.getState().setStatus(warning || '未解析到有效行，请确认表头含「账号」「文案标题」');
      return;
    }
    usePosterStore.getState().importExcelRows(rows);
    // importExcelRows 会写分组提示；再附上解析摘要
    if (warning) {
      const prev = usePosterStore.getState().statusMessage;
      usePosterStore.getState().setStatus(`${prev}｜${warning}`);
    }
  };

  const onAssetFolder = async (fileList: FileList) => {
    const store = usePosterStore.getState();
    const drafts = store.importDrafts;
    if (!drafts.length) {
      store.setStatus('请先导入 Excel 或保留默认文案');
      return;
    }
    const files = Array.from(fileList);
    const items: Array<{ name: string; dataUrl: string }> = [];
    for (const f of files) {
      if (!f.type.startsWith('image/') && !/\.(png|jpe?g|webp|gif)$/i.test(f.name)) continue;
      items.push({ name: f.name, dataUrl: await fileToDataUrl(f) });
    }
    if (!items.length) {
      store.setStatus('文件夹内未找到图片');
      return;
    }
    const matched = autoMatchAssetsByOrder(
      files.filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name)),
      drafts.length,
    );
    const next = drafts.map((d, i) => {
      const m = matched[i];
      const byNameCover = matchAsset(files, d.coverFileName);
      const byNameQr = matchAsset(files, d.qrFileName);
      const byNameAvatar = matchAsset(files, d.avatarFileName || '');
      const avatarDataUrl = byNameAvatar
        ? items.find((it) => it.name === byNameAvatar.name)?.dataUrl || d.avatarDataUrl
        : m.avatar
          ? items.find((it) => it.name === m.avatar!.name)?.dataUrl || d.avatarDataUrl
          : d.avatarDataUrl;
      const hasAvatar = Boolean(
        avatarDataUrl || d.nickname || d.avatarFileName || byNameAvatar || m.avatar,
      );
      return {
        ...d,
        coverDataUrl: byNameCover
          ? items.find((it) => it.name === byNameCover.name)?.dataUrl || d.coverDataUrl
          : m.cover
            ? items.find((it) => it.name === m.cover!.name)?.dataUrl || d.coverDataUrl
            : d.coverDataUrl,
        qrDataUrl: byNameQr
          ? items.find((it) => it.name === byNameQr.name)?.dataUrl || d.qrDataUrl
          : m.qr
            ? items.find((it) => it.name === m.qr!.name)?.dataUrl || d.qrDataUrl
            : d.qrDataUrl,
        avatarDataUrl,
        coverFileName: byNameCover?.name || m.cover?.name || d.coverFileName,
        qrFileName: byNameQr?.name || m.qr?.name || d.qrFileName,
        avatarFileName: byNameAvatar?.name || m.avatar?.name || d.avatarFileName,
        showAvatar: d.showAvatar || hasAvatar,
      };
    });
    store.applyFolderMatch(items, next);
  };

  const ingestLibraryFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name),
    );
    if (!files.length) {
      usePosterStore.getState().setStatus('请上传图片文件');
      return;
    }
    const items = [];
    for (const f of files) {
      items.push({ name: f.name, dataUrl: await fileToDataUrl(f) });
    }
    usePosterStore.getState().addLibraryAssets(items, true);
  };

  const onDropLibrary = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) void ingestLibraryFiles(e.dataTransfer.files);
  };

  const onMainVisual = async (file: File) => {
    const url = await fileToDataUrl(file);
    const img = new Image();
    img.onload = () => {
      const maxW = 900;
      const scale = Math.min(1, maxW / img.naturalWidth);
      usePosterStore.getState().setMainVisual(url, {
        width: Math.round(img.naturalWidth * scale),
        height: Math.round(img.naturalHeight * scale),
      });
      usePosterStore.getState().setStatus('主视觉已上传');
    };
    img.src = url;
  };

  const onGenerateBg = async () => {
    const store = usePosterStore.getState();
    if (!store.mainVisualDataUrl) {
      store.setStatus('请先上传主视觉');
      return;
    }
    store.setGenerating(true, 0);
    try {
      const dataUrl = await generateBackground({
        imageBase64: store.mainVisualDataUrl,
        targetHeight: store.artboardHeight,
        onProgress: (p, msg) => {
          store.setGenerating(true, p);
          store.setStatus(msg);
        },
      });
      store.setAiBackground(dataUrl);
      store.clearSelection();
      store.setStatus('AI 背景已生成并写入图层');
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      store.setGenerating(false, 0);
    }
  };

  const doExport = async (format: 'png' | 'psd', single = false) => {
    const store = usePosterStore.getState();
    const base = artboardExportInput(store);
    try {
      if (format === 'psd') {
        const input = { ...base, scale: 1 };
        if (single) {
          const card = store.cards.find((c) => c.id === store.selectedCardId) || store.cards[0];
          if (!card) {
            store.setStatus('没有可导出的卡片');
            return;
          }
          const clip = { x: card.x, y: card.y, width: card.width, height: card.height };
          await exportPsd({ ...input, clip }, `card-${card.id.slice(0, 6)}.psd`);
          store.setStatus('卡片 PSD 已导出');
        } else {
          await exportPsd(input, 'poster.psd');
          store.setStatus('PSD 已导出');
        }
        return;
      }

      store.setStatus('正在按原图像素渲染 PNG…');
      const scale = await resolveExportScale(base, {
        scale: store.exportScale,
        auto: store.exportScaleAuto,
      });
      const input = { ...base, scale };
      const scaleTag = scale === 1 ? '' : `@${scale}x`;
      const autoNote = store.exportScaleAuto ? '原图自适应 · ' : '';

      if (single) {
        const card = store.cards.find((c) => c.id === store.selectedCardId) || store.cards[0];
        if (!card) {
          store.setStatus('没有可导出的卡片');
          return;
        }
        const clip = { x: card.x, y: card.y, width: card.width, height: card.height };
        await exportPng({ ...input, clip }, `card-${card.id.slice(0, 6)}${scaleTag}.png`);
        store.setStatus(
          `卡片 PNG 已导出（${autoNote}无损 · ${Math.round(card.width * scale)}×${Math.round(card.height * scale)} · ${EXPORT_PNG_DPI}dpi）`,
        );
      } else {
        await exportPng(input, `poster${scaleTag}.png`);
        store.setStatus(
          `PNG 已导出（${autoNote}无损 · ${Math.round(ARTBOARD_WIDTH * scale)}×${Math.round(store.artboardHeight * scale)} · ${EXPORT_PNG_DPI}dpi）`,
        );
      }
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  const doExportSelectedLayer = async () => {
    const store = usePosterStore.getState();
    try {
      store.setStatus('正在按原图像素渲染图层…');
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
      store.setStatus(
        `已导出图层 PNG（${store.exportScaleAuto ? '原图自适应 · ' : ''}无损 · ${scale}x · ${EXPORT_PNG_DPI}dpi）：${result.filename}`,
      );
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <aside className="side-panel">
      {step === 1 && (
        <Section title="① 主视觉上传" hint="上传一张装饰性参考图，其配色/风格将作为背景生成依据。">
          <button type="button" className="btn-dashed" onClick={() => visualRef.current?.click()}>
            拖拽图片到此处，或点击选择
          </button>
          <input
            ref={visualRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && onMainVisual(e.target.files[0])}
          />
          {mainVisualDataUrl && (
            <div className="asset-chip">
              <img src={mainVisualDataUrl} alt="主视觉" />
              <div>
                <p>主视觉已就绪</p>
                <p className="muted">可作为背景风格参考</p>
              </div>
            </div>
          )}
        </Section>
      )}

      {step === 2 && (
        <>
          <Section
            title="② 背景生成（主色上下渐变）"
            hint="仅使用主视觉图中真实颜色：有背景则复刻上下色带，否则取最显著主色做竖向渐变，不引入图外颜色。"
          >
            <button type="button" className="btn-primary" disabled={generating} onClick={onGenerateBg}>
              {generating ? `生成中 ${Math.round(generateProgress * 100)}%` : '生成融合背景'}
            </button>
            {generating && (
              <div className="progress">
                <div style={{ width: `${Math.round(generateProgress * 100)}%` }} />
              </div>
            )}
            {backgroundDataUrl && !generating && (
              <p className="muted tiny">AI 背景已写入图层，可在右侧调整顺序或隐藏</p>
            )}
          </Section>

          <Section title="手动绘制背景" hint="空白框内吸取颜色并沿路径绘制弥散，写入「手动绘制背景」图层。">
            <ManualBgPainter />
          </Section>
        </>
      )}

      {step === 3 && (
        <Section title="③ 局部透明度蒙版" hint="柔边笔刷涂抹主视觉图层，非破坏性，实时预览。">
          <div className="row">
            <button
              type="button"
              className={brush.erase ? 'active' : ''}
              onClick={() => {
                usePosterStore.getState().setToolMode('mask');
                usePosterStore.getState().setBrush({ erase: true });
              }}
            >
              擦除
            </button>
            <button
              type="button"
              className={!brush.erase ? 'active' : ''}
              onClick={() => {
                usePosterStore.getState().setToolMode('mask');
                usePosterStore.getState().setBrush({ erase: false });
              }}
            >
              恢复 (Alt)
            </button>
          </div>
          <p className="muted tiny">当前模式：{toolMode === 'mask' ? '蒙版绘制' : '请点擦除/恢复进入蒙版'}</p>
          <Field label="笔刷大小 [ ]" value={`${brush.size}px`}>
            <input
              type="range"
              min={BRUSH.sizeMin}
              max={BRUSH.sizeMax}
              value={brush.size}
              onChange={(e) => usePosterStore.getState().setBrush({ size: Number(e.target.value) })}
            />
          </Field>
          <Field label="硬度（羽化）" value={`${brush.hardness}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={brush.hardness}
              onChange={(e) => usePosterStore.getState().setBrush({ hardness: Number(e.target.value) })}
            />
          </Field>
          <Field label="笔刷透明度" value={`${brush.opacity}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={brush.opacity}
              onChange={(e) => usePosterStore.getState().setBrush({ opacity: Number(e.target.value) })}
            />
          </Field>
          <label className="switch-row">
            <span>显示蒙版效果</span>
            <input
              type="checkbox"
              checked={maskVisible}
              onChange={(e) => usePosterStore.getState().setMaskVisible(e.target.checked)}
            />
          </label>
          <div className="row">
            <button type="button" onClick={() => usePosterStore.getState().undo()}>
              撤销 ⌘Z
            </button>
            <button type="button" onClick={() => usePosterStore.getState().redo()}>
              重做
            </button>
          </div>
          <button type="button" className="btn-ghost" onClick={() => usePosterStore.getState().resetMask()}>
            重置蒙版
          </button>
          <button type="button" onClick={() => usePosterStore.getState().setToolMode('select')}>
            返回选择模式
          </button>
        </Section>
      )}

      {step === 4 && (
        <Section
          title="④ 数据导入"
          hint="支持新媒体周报表（自动跳过「第xx期」标题行）。按「账号」分组；曝光(w)/互动中的「/」视为无数据；视频链接可从分享文案中提取。封面/头像/二维码：双击缩略图上传。"
        >
          <div className="row">
            <button type="button" onClick={() => excelRef.current?.click()}>
              选择 Excel
            </button>
            <button type="button" onClick={() => assetsRef.current?.click()}>
              素材文件夹
            </button>
          </div>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onExcel(f);
            }}
          />
          <input
            ref={slotUploadRef}
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
          <input
            ref={assetsRef}
            type="file"
            // @ts-expect-error webkitdirectory
            webkitdirectory=""
            directory=""
            multiple
            hidden
            onChange={(e) => e.target.files && onAssetFolder(e.target.files)}
          />

          <Field label="导入行数" value={`${importDrafts.length} / ${MAX_CARDS}`}>
            <input
              type="range"
              min={1}
              max={MAX_CARDS}
              value={importDrafts.length || 1}
              onChange={(e) => usePosterStore.getState().setImportDraftCount(Number(e.target.value))}
            />
          </Field>

          <div className="row">
            <button
              type="button"
              className="btn-outline compact"
              onClick={() => {
                if (!selectedRowIds.length) {
                  usePosterStore.getState().setStatus('请先点击选中要移入新组的行（⌘/Ctrl 多选）');
                  return;
                }
                usePosterStore.getState().createGroupWithRows(selectedRowIds);
                setSelectedRowIds([]);
              }}
            >
              选中行 → 新分组
            </button>
            <span className="muted tiny">拖拽行首 ☰ 到其他组；点行可选中</span>
          </div>

          <div className="group-list">
            {cardGroups.map((group, gi) => (
              <div
                key={group.id}
                className="card-group"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onDropRow(group.id);
                }}
              >
                <div className="card-group-head">
                  <strong>{group.name}</strong>
                  <span className="muted tiny">{group.rowIds.length} 行</span>
                  {cardGroups.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost compact"
                      onClick={() => usePosterStore.getState().removeGroup(group.id)}
                    >
                      合并
                    </button>
                  )}
                </div>
                <Field
                  label={gi === 0 ? '距画板顶部' : '距上一组底端'}
                  value={`${group.spacing}px`}
                >
                  <input
                    type="range"
                    min={gi === 0 ? 200 : 24}
                    max={gi === 0 ? 1200 : 400}
                    value={group.spacing}
                    onPointerDown={() => usePosterStore.getState().pushHistory()}
                    onChange={(e) =>
                      usePosterStore
                        .getState()
                        .setGroupSpacing(group.id, Number(e.target.value), false)
                    }
                  />
                </Field>
                <div className="data-table rich scroll-x">
                  <div className="data-table-head cols-import">
                    <span />
                    <span>#</span>
                    <span>标题</span>
                    <span>关键词</span>
                    <span>昵称</span>
                    <span>头像</span>
                    <span>封面</span>
                    <span>二维码</span>
                    <span>曝光量</span>
                    <span>互动量</span>
                    <span>链接</span>
                    <span>选项</span>
                  </div>
                  {group.rowIds.map((rid, ri) => {
                    const d = draftMap.get(rid) as ImportDraftRow | undefined;
                    if (!d) return null;
                    globalIndex += 1;
                    const idx = globalIndex;
                    return (
                      <div
                        key={d.id}
                        className={`data-table-row cols-import ${selectedRowIds.includes(d.id) ? 'selected' : ''}`}
                        draggable
                        onDragStart={() => {
                          dragRowId.current = d.id;
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDropRow(group.id, ri);
                        }}
                        onClick={(e) => toggleSelectRow(d.id, e.metaKey || e.ctrlKey || e.shiftKey)}
                      >
                        <span className="drag-handle" title="拖拽调整分组">
                          ☰
                        </span>
                        <span className="mono muted">{idx}</span>
                        <input
                          className="cell-input"
                          value={d.title}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().updateImportDraft(d.id, { title: e.target.value })
                          }
                        />
                        <input
                          className="cell-input tiny"
                          value={d.keywords}
                          placeholder="关键词"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().updateImportDraft(d.id, { keywords: e.target.value })
                          }
                        />
                        <input
                          className="cell-input tiny"
                          value={d.nickname || ''}
                          placeholder="昵称"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore
                              .getState()
                              .updateImportDraft(d.id, {
                                nickname: e.target.value,
                                showAvatar: Boolean(e.target.value || d.avatarDataUrl),
                              })
                          }
                        />
                        <SlotThumb
                          src={d.avatarDataUrl || ''}
                          active={replaceTarget?.cardId === d.id && replaceTarget.slot === 'avatar'}
                          onClick={() =>
                            usePosterStore.getState().setReplaceTarget({ cardId: d.id, slot: 'avatar' })
                          }
                          onDblClick={() => openSlotUpload(d.id, 'avatar')}
                          onClear={() => usePosterStore.getState().clearCardSlot(d.id, 'avatar')}
                        />
                        <SlotThumb
                          src={d.coverDataUrl}
                          active={replaceTarget?.cardId === d.id && replaceTarget.slot === 'cover'}
                          onClick={() =>
                            usePosterStore.getState().setReplaceTarget({ cardId: d.id, slot: 'cover' })
                          }
                          onDblClick={() => openSlotUpload(d.id, 'cover')}
                          onClear={() => usePosterStore.getState().clearCardSlot(d.id, 'cover')}
                        />
                        <SlotThumb
                          src={d.qrDataUrl}
                          active={replaceTarget?.cardId === d.id && replaceTarget.slot === 'qr'}
                          onClick={() =>
                            usePosterStore.getState().setReplaceTarget({ cardId: d.id, slot: 'qr' })
                          }
                          onDblClick={() => openSlotUpload(d.id, 'qr')}
                          onClear={() => usePosterStore.getState().clearCardSlot(d.id, 'qr')}
                        />
                        <input
                          className="cell-input tiny mono"
                          value={d.exposureText || ''}
                          placeholder="32.3w"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().updateImportDraft(d.id, {
                              exposureText: e.target.value,
                              showMetrics: Boolean(e.target.value || d.engagementText),
                            })
                          }
                        />
                        <input
                          className="cell-input tiny mono"
                          value={d.engagementText || ''}
                          placeholder="3201"
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().updateImportDraft(d.id, {
                              engagementText: e.target.value,
                              showMetrics: Boolean(e.target.value || d.exposureText),
                            })
                          }
                        />
                        <input
                          className="cell-input tiny mono"
                          value={d.videoUrl || ''}
                          placeholder="视频链接"
                          title={d.videoUrl || ''}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().updateImportDraft(d.id, {
                              videoUrl: e.target.value,
                            })
                          }
                        />
                        <div className="row-toggles" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className={d.showAvatar ? 'active' : ''}
                            title="显示左侧账号头像与昵称"
                            onClick={() =>
                              usePosterStore.getState().updateImportDraft(d.id, {
                                showAvatar: !d.showAvatar,
                              })
                            }
                          >
                            账号
                          </button>
                          <button
                            type="button"
                            className={d.showMetrics ? 'active' : ''}
                            title="显示投放数据行"
                            onClick={() =>
                              usePosterStore.getState().updateImportDraft(d.id, {
                                showMetrics: !d.showMetrics,
                              })
                            }
                          >
                            数据
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!group.rowIds.length && (
                    <p className="muted tiny empty-group">拖拽行到此组</p>
                  )}
                </div>
              </div>
            ))}
            <div
              className="new-group-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = dragRowId.current;
                if (!id) return;
                usePosterStore.getState().createGroupWithRows([id]);
                dragRowId.current = null;
              }}
            >
              拖拽任意行到此处创建新分组
            </div>
          </div>

          <div className="library-box">
            <div className="library-head">
              <span>素材库</span>
              <button type="button" className="btn-outline compact" onClick={() => libraryRef.current?.click()}>
                ↑ 上传素材
              </button>
            </div>
            <button
              type="button"
              className="btn-dashed library-drop"
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropLibrary}
              onClick={() => libraryRef.current?.click()}
            >
              拖拽封面 / 二维码 / 头像素材到此处
            </button>
            <input
              ref={libraryRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && ingestLibraryFiles(e.target.files)}
            />
            {assetLibrary.length > 0 ? (
              <div className="library-grid">
                {assetLibrary.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`lib-item ${a.kind}`}
                    title={`${a.name} · 点击替换选中槽位`}
                    onClick={() => usePosterStore.getState().applyLibraryAsset(a.id)}
                  >
                    <img src={a.dataUrl} alt={a.name} />
                    <span>{a.kind === 'qr' ? 'QR' : '封面'}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted tiny">尚未上传素材。双击画板封面/二维码后，可点选素材库图片替换。</p>
            )}
            <button type="button" className="btn-primary" onClick={() => usePosterStore.getState().autoMatchLibrary()}>
              按标题顺序自动匹配素材
            </button>
            <p className="muted tiny">
              文件名含 qr / 二维码 的归为二维码；其余按字母序匹配封面。画板双击封面或二维码可选中替换。
            </p>
          </div>
        </Section>
      )}

      {step === 5 && (
        <Section title="⑤ 画板初始化" hint={`宽固定 ${ARTBOARD_WIDTH}px，单屏高 ${ARTBOARD_BASE_HEIGHT}px；内容超出后向下延伸。`}>
          <div className="info-box">
            <p>宽度：{ARTBOARD_WIDTH}px（锁定）</p>
            <p>当前高度：{artboardHeight}px</p>
            <p className="muted">= max({ARTBOARD_BASE_HEIGHT}, 头图 + 卡片总高 + 间距 + 留白)</p>
          </div>
          <label className="switch-row">
            <span>显示画板边界</span>
            <input
              type="checkbox"
              checked={showBounds}
              onChange={(e) => usePosterStore.getState().setShowBounds(e.target.checked)}
            />
          </label>
        </Section>
      )}

      {step === 6 && (
        <Section
          title="⑥ 卡片批量排版"
          hint={`标准版式 ${cardWidth} × ${cardHeight}；按类别调节尺寸、字号、间距与外观。`}
        >
          <div className="batch-group">
            <h4 className="batch-group-title">尺寸与位置</h4>
            <Field label="卡片左边距" value={`${cardLeft}px`}>
              <input
                type="range"
                min={CARD_STYLE.leftMin}
                max={CARD_STYLE.leftMax}
                value={cardLeft}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) => usePosterStore.getState().setCardLeft(Number(e.target.value), false)}
              />
            </Field>
            <Field label="宽度（固定左边）" value={`${cardWidth}px`}>
              <input
                type="range"
                min={CARD_STYLE.widthMin}
                max={CARD_STYLE.widthMax}
                value={cardWidth}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCardWidth(Number(e.target.value), false, 'left')
                }
              />
            </Field>
            <Field label="宽度（固定右边）" value={`${cardWidth}px`}>
              <input
                type="range"
                min={CARD_STYLE.widthMin}
                max={CARD_STYLE.widthMax}
                value={cardWidth}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCardWidth(Number(e.target.value), false, 'right')
                }
              />
            </Field>
            <Field label="统一卡片高度" value={`${cardHeight}px`}>
              <input
                type="range"
                min={120}
                max={360}
                value={cardHeight}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) => usePosterStore.getState().setCardHeight(Number(e.target.value), false)}
              />
            </Field>
            <Field label="头像尺寸" value={`${avatarSize}px`}>
              <input
                type="range"
                min={CARD_STYLE.avatarSizeMin}
                max={CARD_STYLE.avatarSizeMax}
                value={avatarSize}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setAvatarSize(Number(e.target.value), false)
                }
              />
            </Field>
          </div>

          <div className="batch-group">
            <h4 className="batch-group-title">字号</h4>
            <Field label="主标题字号" value={`${titleFontSize}px`}>
              <input
                type="range"
                min={TYPOGRAPHY.titleSizeMin}
                max={TYPOGRAPHY.titleSizeMax}
                value={titleFontSize}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setTitleFontSize(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="关键词字号" value={`${keywordFontSize}px`}>
              <input
                type="range"
                min={TYPOGRAPHY.keywordSizeMin}
                max={TYPOGRAPHY.keywordSizeMax}
                value={keywordFontSize}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setKeywordFontSize(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="投放数据字号" value={`${metricsFontSize}px`}>
              <input
                type="range"
                min={TYPOGRAPHY.metricsSizeMin}
                max={TYPOGRAPHY.metricsSizeMax}
                value={metricsFontSize}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setMetricsFontSize(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="昵称字号" value={`${nicknameFontSize}px`}>
              <input
                type="range"
                min={TYPOGRAPHY.nicknameSizeMin}
                max={TYPOGRAPHY.nicknameSizeMax}
                value={nicknameFontSize}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setNicknameFontSize(Number(e.target.value), false)
                }
              />
            </Field>
          </div>

          <div className="batch-group">
            <h4 className="batch-group-title">间距</h4>
            <Field label="标题与关键词间距" value={`${titleKeywordGap}px`}>
              <input
                type="range"
                min={CARD_STYLE.titleKeywordGapMin}
                max={CARD_STYLE.titleKeywordGapMax}
                value={titleKeywordGap}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setTitleKeywordGap(Number(e.target.value), false)
                }
              />
            </Field>
            <p className="muted tiny">开启投放数据时，同时作用于「标题↔数据」与「数据↔关键词」</p>
            <Field label="封面距左边框" value={`${coverInsetLeft}px`}>
              <input
                type="range"
                min={CARD_STYLE.coverInsetMin}
                max={CARD_STYLE.coverInsetMax}
                value={coverInsetLeft}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCoverInsetLeft(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="二维码距右边框" value={`${qrInsetRight}px`}>
              <input
                type="range"
                min={CARD_STYLE.qrInsetMin}
                max={CARD_STYLE.qrInsetMax}
                value={qrInsetRight}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setQrInsetRight(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="头像与组件框间距" value={`${avatarGapToCard}px`}>
              <input
                type="range"
                min={CARD_STYLE.avatarGapMin}
                max={CARD_STYLE.avatarGapMax}
                value={avatarGapToCard}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setAvatarGapToCard(Number(e.target.value), false)
                }
              />
            </Field>
          </div>

          <div className="batch-group">
            <h4 className="batch-group-title">外观</h4>
            <Field label="卡片深浅明度" value={`${cardBrightness}`}>
              <input
                type="range"
                min={CARD_STYLE.brightnessMin}
                max={CARD_STYLE.brightnessMax}
                value={cardBrightness}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCardBrightness(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="卡片透明度" value={`${cardOpacity}%`}>
              <input
                type="range"
                min={CARD_STYLE.opacityMin}
                max={CARD_STYLE.opacityMax}
                value={cardOpacity}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCardOpacity(Number(e.target.value), false)
                }
              />
            </Field>
            <Field label="卡片圆角" value={`${cardRadius}px`}>
              <input
                type="range"
                min={0}
                max={40}
                value={cardRadius}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setCardRadius(Number(e.target.value), false)
                }
              />
            </Field>
            <div className="field">
              <div className="field-label">
                <span>文字颜色</span>
                <span className="mono">{textColor === '#FFFFFF' ? '白字' : '黑字'}</span>
              </div>
              <div className="row">
                <button
                  type="button"
                  className={textColor === '#FFFFFF' ? 'active' : ''}
                  onClick={() => usePosterStore.getState().setTextColor('#FFFFFF' as TextColor)}
                >
                  白字
                </button>
                <button
                  type="button"
                  className={textColor === '#000000' ? 'active' : ''}
                  onClick={() => usePosterStore.getState().setTextColor('#000000' as TextColor)}
                >
                  黑字
                </button>
              </div>
            </div>
          </div>

          <div className="info-box muted tiny">
            头像默认 100×100 并与组件框垂直居中；投放数据/关键词为细体中灰；二维码右边距变化时中间文案区会随之伸缩。⌘Z 撤回。
          </div>

          <div className="specialty-block">
            <h4>特化卡片造型</h4>
            <p className="muted tiny">
              选中卡片后可应用「侧光暗底」或「热点描边」（上透明下 FF471E 渐变 2pt）；侧光样式可单独调角度、颜色与透明度。
            </p>
            {selectedCardId ? (
              <>
                <p className="tiny">
                  当前：{cards.find((c) => c.id === selectedCardId)?.title || '未命名卡片'}
                </p>
                <div className="row">
                  <button
                    type="button"
                    className={
                      (cards.find((c) => c.id === selectedCardId)?.specialtyStyle || 'none') ===
                      'none'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      usePosterStore.getState().setCardSpecialtyStyle(selectedCardId, 'none')
                    }
                  >
                    默认
                  </button>
                  <button
                    type="button"
                    className={
                      cards.find((c) => c.id === selectedCardId)?.specialtyStyle === 'sideGlow'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      usePosterStore.getState().setCardSpecialtyStyle(selectedCardId, 'sideGlow')
                    }
                  >
                    侧光暗底
                  </button>
                  <button
                    type="button"
                    className={
                      cards.find((c) => c.id === selectedCardId)?.specialtyStyle === 'hotspot'
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      usePosterStore.getState().setCardSpecialtyStyle(selectedCardId, 'hotspot')
                    }
                  >
                    热点描边
                  </button>
                </div>
                {cards.find((c) => c.id === selectedCardId)?.specialtyStyle === 'sideGlow' && (
                  <>
                    <div className="specialty-color-row">
                      <label className="color-pick">
                        <span>侧色 / 发光色</span>
                        <input
                          type="color"
                          value={
                            cards.find((c) => c.id === selectedCardId)?.specialtyAccentColor ||
                            '#322422'
                          }
                          onChange={(e) =>
                            usePosterStore
                              .getState()
                              .setCardSpecialtyAccent(selectedCardId, e.target.value)
                          }
                        />
                      </label>
                      <div className="specialty-swatches">
                        {['#322422', '#915C4E', '#4A3028', '#2A1C18'].map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            className="swatch"
                            style={{ background: hex }}
                            title={hex}
                            onClick={() =>
                              usePosterStore.getState().setCardSpecialtyAccent(selectedCardId, hex)
                            }
                          />
                        ))}
                      </div>
                    </div>
                    <Field
                      label="径向角度"
                      value={`${cards.find((c) => c.id === selectedCardId)?.specialtyAngle ?? 135}°`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={cards.find((c) => c.id === selectedCardId)?.specialtyAngle ?? 135}
                        onPointerDown={() => usePosterStore.getState().pushHistory()}
                        onChange={(e) =>
                          usePosterStore
                            .getState()
                            .setCardSpecialtyAngle(selectedCardId, Number(e.target.value), false)
                        }
                      />
                    </Field>
                    <div className="row">
                      <button
                        type="button"
                        className={
                          (cards.find((c) => c.id === selectedCardId)?.specialtyBgMode || 'dark') ===
                          'dark'
                            ? 'active'
                            : ''
                        }
                        onClick={() =>
                          usePosterStore.getState().setCardSpecialtyBgMode(selectedCardId, 'dark')
                        }
                      >
                        深色背景
                      </button>
                      <button
                        type="button"
                        className={
                          cards.find((c) => c.id === selectedCardId)?.specialtyBgMode === 'white'
                            ? 'active'
                            : ''
                        }
                        onClick={() =>
                          usePosterStore.getState().setCardSpecialtyBgMode(selectedCardId, 'white')
                        }
                      >
                        白色背景
                      </button>
                    </div>
                    <Field
                      label="背景透明度"
                      value={`${cards.find((c) => c.id === selectedCardId)?.specialtyBgOpacity ?? 72}%`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={
                          cards.find((c) => c.id === selectedCardId)?.specialtyBgOpacity ?? 72
                        }
                        onPointerDown={() => usePosterStore.getState().pushHistory()}
                        onChange={(e) =>
                          usePosterStore
                            .getState()
                            .setCardSpecialtyBgOpacity(
                              selectedCardId,
                              Number(e.target.value),
                              false,
                            )
                        }
                      />
                    </Field>
                    <Field
                      label="描边粗细"
                      value={`${cards.find((c) => c.id === selectedCardId)?.specialtyStrokeWidth ?? 1}px`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={8}
                        step={0.5}
                        value={
                          cards.find((c) => c.id === selectedCardId)?.specialtyStrokeWidth ?? 1
                        }
                        onPointerDown={() => usePosterStore.getState().pushHistory()}
                        onChange={(e) =>
                          usePosterStore.getState().setCardSpecialtyStroke(
                            selectedCardId,
                            { specialtyStrokeWidth: Number(e.target.value) },
                            false,
                          )
                        }
                      />
                    </Field>
                    <div className="specialty-color-row">
                      <label className="color-pick">
                        <span>描边色 A</span>
                        <input
                          type="color"
                          value={
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeColorA ||
                            '#FFFFFF'
                          }
                          onChange={(e) =>
                            usePosterStore.getState().setCardSpecialtyStroke(selectedCardId, {
                              specialtyStrokeColorA: e.target.value,
                            })
                          }
                        />
                        <span className="opacity-num-label">透明度</span>
                        <input
                          className="opacity-num"
                          type="number"
                          min={0}
                          max={100}
                          value={
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeOpacityA ??
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeOpacity ??
                            28
                          }
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().setCardSpecialtyStroke(
                              selectedCardId,
                              { specialtyStrokeOpacityA: Number(e.target.value) },
                              false,
                            )
                          }
                        />
                      </label>
                      <label className="color-pick">
                        <span>描边色 B</span>
                        <input
                          type="color"
                          value={
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeColorB ||
                            '#A89080'
                          }
                          onChange={(e) =>
                            usePosterStore.getState().setCardSpecialtyStroke(selectedCardId, {
                              specialtyStrokeColorB: e.target.value,
                            })
                          }
                        />
                        <span className="opacity-num-label">透明度</span>
                        <input
                          className="opacity-num"
                          type="number"
                          min={0}
                          max={100}
                          value={
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeOpacityB ??
                            cards.find((c) => c.id === selectedCardId)?.specialtyStrokeOpacity ??
                            28
                          }
                          onFocus={() => usePosterStore.getState().pushHistory()}
                          onChange={(e) =>
                            usePosterStore.getState().setCardSpecialtyStroke(
                              selectedCardId,
                              { specialtyStrokeOpacityB: Number(e.target.value) },
                              false,
                            )
                          }
                        />
                      </label>
                    </div>
                    <Field
                      label="描边渐变方向"
                      value={`${cards.find((c) => c.id === selectedCardId)?.specialtyStrokeAngle ?? 135}°`}
                    >
                      <input
                        type="range"
                        min={0}
                        max={360}
                        value={
                          cards.find((c) => c.id === selectedCardId)?.specialtyStrokeAngle ?? 135
                        }
                        onPointerDown={() => usePosterStore.getState().pushHistory()}
                        onChange={(e) =>
                          usePosterStore.getState().setCardSpecialtyStroke(
                            selectedCardId,
                            { specialtyStrokeAngle: Number(e.target.value) },
                            false,
                          )
                        }
                      />
                    </Field>
                  </>
                )}
              </>
            ) : (
              <p className="muted tiny">请先点击画板上的某张卡片</p>
            )}
          </div>
        </Section>
      )}

      {step === 7 && (
        <Section title="⑦ 卡片间距微调" hint="组内间距、分组节距与落款间距；画板高度自适应。">
          <Field label="组内卡片间距" value={`${cardGap}px`}>
            <input
              type="range"
              min={0}
              max={200}
              value={cardGap}
              onPointerDown={() => usePosterStore.getState().pushHistory()}
              onChange={(e) => usePosterStore.getState().setCardGap(Number(e.target.value), false)}
            />
          </Field>
          {cardGroups.map((group, gi) => (
            <Field
              key={group.id}
              label={gi === 0 ? `${group.name} · 距顶部` : `${group.name} · 距上组底端`}
              value={`${group.spacing}px`}
            >
              <input
                type="range"
                min={gi === 0 ? 200 : 24}
                max={gi === 0 ? 1200 : 400}
                value={group.spacing}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setGroupSpacing(group.id, Number(e.target.value), false)
                }
              />
            </Field>
          ))}
          <div className="texture-box">
            <div className="library-head">
              <span>底部落款</span>
              <label className="switch-row compact">
                <span>显示</span>
                <input
                  type="checkbox"
                  checked={footer.enabled}
                  onChange={(e) => usePosterStore.getState().setFooter({ enabled: e.target.checked })}
                />
              </label>
            </div>
            <input
              className="cell-input footer-input"
              value={footer.text}
              onFocus={() => usePosterStore.getState().pushHistory()}
              onChange={(e) => usePosterStore.getState().setFooter({ text: e.target.value }, false)}
              placeholder="落款文字"
            />
            <Field label="落款与末卡间距" value={`${footer.gap}px`}>
              <input
                type="range"
                min={24}
                max={240}
                value={footer.gap}
                onPointerDown={() => usePosterStore.getState().pushHistory()}
                onChange={(e) =>
                  usePosterStore.getState().setFooter({ gap: Number(e.target.value) }, false)
                }
              />
            </Field>
          </div>
          <p className="muted tiny">
            画板高度 {artboardHeight}px · {cardGroups.length} 组 · {cards.length} 张
          </p>
        </Section>
      )}

      {step === 8 && (
        <Section
          title="⑧ 导出"
          hint={`PNG 无损。默认「原图」：按上传素材分辨率自动提高倍率，封面/二维码从原图像素采样，避免二次放大发糊。`}
        >
          <Field
            label="导出清晰度"
            value={
              exportScaleAuto
                ? '原图自适应'
                : `${exportScale}x · ${Math.round(ARTBOARD_WIDTH * exportScale)}×${Math.round(artboardHeight * exportScale)}`
            }
          >
            <div className="row export-scale-row">
              <button
                type="button"
                className={exportScaleAuto ? 'active' : 'btn-outline'}
                title="按素材原图像素自动选 1.5x～3x"
                onClick={() => usePosterStore.getState().setExportScaleAuto(true)}
              >
                原图
              </button>
              {EXPORT_SCALES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={!exportScaleAuto && exportScale === s ? 'active' : 'btn-outline'}
                  onClick={() => usePosterStore.getState().setExportScale(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </Field>
          <button type="button" className="btn-primary" onClick={() => void doExport('png')}>
            导出整张 PNG
            {!exportScaleAuto
              ? `（${Math.round(ARTBOARD_WIDTH * exportScale)} × ${Math.round(artboardHeight * exportScale)}）`
              : '（原图像素）'}
          </button>
          <button type="button" onClick={() => void doExport('psd')}>
            导出整张 PSD（1x 逻辑像素）
          </button>
          <button type="button" onClick={() => void doExport('png', true)}>
            导出选中卡片 PNG
          </button>
          <button type="button" className="btn-outline" onClick={() => void doExportSelectedLayer()}>
            导出选中图层 PNG
          </button>
          <div className="info-box muted tiny">
            封面/二维码/主视觉从原图裁切区直出；大幅缩小用多级降采样。源图本身偏低清时无法凭空变清晰。
          </div>
        </Section>
      )}

      {statusMessage && <div className="status">{statusMessage}</div>}
    </aside>
  );
}
