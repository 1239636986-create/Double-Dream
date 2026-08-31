import { Group, Image as KonvaImage, Rect, Text, Shape, Circle } from 'react-konva';
import useImage from './useImage';
import { ACCOUNT_SIDEBAR, CARD_DEFAULT, HOTSPOT_BORDER_COLOR, HOTSPOT_STROKE_WIDTH, METRICS_BAR, TYPOGRAPHY } from '@/lib/constants';
import { computeCardContentLayout } from '@/lib/cardLayout';
import {
  SPECIALTY_SIDE_GLOW,
  angleToDir,
  gradientLineForRect,
  hexToRgba,
  normalizeSpecialtyStyle,
  specialtyAccentOf,
  specialtyAngleOf,
  specialtyBgColorOf,
  specialtyBgModeOf,
  specialtyBgOpacityOf,
  specialtyCenterOf,
  specialtyStrokeAngleOf,
  specialtyStrokeColorAOf,
  specialtyStrokeColorBOf,
  specialtyStrokeOpacityAOf,
  specialtyStrokeOpacityBOf,
  specialtyStrokeWidthOf,
} from '@/lib/specialtyCard';
import type { SpecialtyBgMode } from '@/lib/specialtyCard';
import { wrapKeywordLines, wrapTitle } from '@/lib/textLayout';
import { coverFitRect } from '@/lib/imageFit';
import { usePosterStore } from '@/store/usePosterStore';
import type { CardItem, ReplaceSlot } from '@/lib/types';
import { useMemo } from 'react';

export type CardTextField = 'title' | 'keywords' | 'exposure' | 'engagement';

function formatMetricsLine(exposure?: string, engagement?: string) {
  const exp = (exposure || '').trim() || '—';
  const eng = (engagement || '').trim() || '—';
  return `曝光量：${exp}    互动量：${eng}`;
}

function axisSnapPos(
  x: number,
  y: number,
  startX: number,
  startY: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  const dx = x - startX;
  const dy = y - startY;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: Math.min(maxX, Math.max(minX, Math.round(x / 4) * 4)),
      y: startY,
    };
  }
  return {
    x: startX,
    y: Math.min(maxY, Math.max(minY, Math.round(y / 4) * 4)),
  };
}

interface Props {
  card: CardItem;
  selected: boolean;
  replaceSlot?: ReplaceSlot | null;
  draggable: boolean;
  /** 正在编辑时隐藏对应文字，避免与 textarea 叠影 */
  editingField?: CardTextField | null;
  onSelect: () => void;
  onChange: (patch: Partial<CardItem>) => void;
  onSlotDblClick: (slot: ReplaceSlot) => void;
  onSlotSelect: (slot: ReplaceSlot) => void;
  onTextDblClick: (field: CardTextField) => void;
  layerOpacity?: number;
}

function measureCanvas() {
  const c = document.createElement('canvas');
  return c.getContext('2d')!;
}

function roundRectPath(
  ctx: {
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => void;
    closePath: () => void;
  },
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** 侧光暗底：底板 + 对角侧光 + 基础渐变描边（角度/颜色/粗细/透明度独立） */
function SideGlowChrome({
  width,
  height,
  radius,
  accent,
  bgOpacity,
  bgMode,
  bgColor,
  centerColor,
  angle,
  strokeWidth,
  strokeColorA,
  strokeColorB,
  strokeAngle,
  strokeOpacityA,
  strokeOpacityB,
}: {
  width: number;
  height: number;
  radius: number;
  accent: string;
  bgOpacity: number;
  bgMode: SpecialtyBgMode;
  bgColor: string;
  centerColor: string;
  angle: number;
  strokeWidth: number;
  strokeColorA: string;
  strokeColorB: string;
  strokeAngle: number;
  strokeOpacityA: number;
  strokeOpacityB: number;
}) {
  const dir = angleToDir(angle);
  const fillLine = gradientLineForRect(width, height, angle);
  const strokeLine = gradientLineForRect(width, height, strokeAngle);
  const cx = width / 2;
  const cy = height / 2;
  const diag = Math.hypot(width, height);
  const glowDist = diag * 0.42;
  const g1 = { x: cx - dir.x * glowDist, y: cy - dir.y * glowDist };
  const g2 = { x: cx + dir.x * glowDist, y: cy + dir.y * glowDist };
  const glowR = Math.min(width, height) * 0.55;
  const panelAlpha = bgOpacity / 100;
  const isWhite = bgMode === 'white';
  const strokeVisible = strokeWidth > 0 && (strokeOpacityA > 0 || strokeOpacityB > 0);

  return (
    <>
      {/* 对角外发光 */}
      <Group listening={false} opacity={0.55 + panelAlpha * 0.45}>
        <Rect
          x={g1.x - glowR}
          y={g1.y - glowR}
          width={glowR * 2}
          height={glowR * 2}
          fillRadialGradientStartPoint={{ x: glowR, y: glowR }}
          fillRadialGradientEndPoint={{ x: glowR, y: glowR }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={glowR}
          fillRadialGradientColorStops={[
            0,
            hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity),
            0.45,
            hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity * 0.35),
            1,
            hexToRgba(accent, 0),
          ]}
          listening={false}
        />
        <Rect
          x={g2.x - glowR}
          y={g2.y - glowR}
          width={glowR * 2}
          height={glowR * 2}
          fillRadialGradientStartPoint={{ x: glowR, y: glowR }}
          fillRadialGradientEndPoint={{ x: glowR, y: glowR }}
          fillRadialGradientStartRadius={0}
          fillRadialGradientEndRadius={glowR}
          fillRadialGradientColorStops={[
            0,
            hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity * 0.85),
            0.5,
            hexToRgba(accent, SPECIALTY_SIDE_GLOW.glowOpacity * 0.28),
            1,
            hexToRgba(accent, 0),
          ]}
          listening={false}
        />
      </Group>

      {/* 底板 + 对角侧光填充（无玻璃霜面/高光） */}
      <Group opacity={panelAlpha} listening={false}>
        <Rect
          width={width}
          height={height}
          fill={bgColor}
          cornerRadius={radius}
          listening={false}
        />
        <Rect
          width={width}
          height={height}
          cornerRadius={radius}
          fillLinearGradientStartPoint={{ x: fillLine.x0, y: fillLine.y0 }}
          fillLinearGradientEndPoint={{ x: fillLine.x1, y: fillLine.y1 }}
          fillLinearGradientColorStops={[
            0,
            hexToRgba(accent, isWhite ? 0.35 : 0.7),
            0.38,
            hexToRgba(centerColor, isWhite ? 0.35 : 0.55),
            0.62,
            hexToRgba(centerColor, isWhite ? 0.35 : 0.55),
            1,
            hexToRgba(accent, isWhite ? 0.28 : 0.65),
          ]}
          listening={false}
        />
      </Group>

      {/* 基础渐变描边：A/B 各自透明度 */}
      {strokeVisible && (
        <Shape
          listening={false}
          sceneFunc={(ctx) => {
            const hw = strokeWidth / 2;
            roundRectPath(
              ctx,
              hw,
              hw,
              width - strokeWidth,
              height - strokeWidth,
              Math.max(0, radius - hw),
            );
            const g = ctx.createLinearGradient(
              strokeLine.x0,
              strokeLine.y0,
              strokeLine.x1,
              strokeLine.y1,
            );
            g.addColorStop(0, hexToRgba(strokeColorA, strokeOpacityA / 100));
            g.addColorStop(1, hexToRgba(strokeColorB, strokeOpacityB / 100));
            ctx.strokeStyle = g;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
          }}
        />
      )}

      {/* 可点击命中层 */}
      <Rect
        name="specialty-hit"
        width={width}
        height={height}
        cornerRadius={radius}
        fill="rgba(0,0,0,0.001)"
        listening
      />
    </>
  );
}

/** 热点特化：白底 + 上透明下 FF471E 渐变描边 2pt */
function HotspotChrome({
  width,
  height,
  radius,
  fillOpacity,
}: {
  width: number;
  height: number;
  radius: number;
  fillOpacity: number;
}) {
  const alpha = fillOpacity;
  const strokeW = HOTSPOT_STROKE_WIDTH;
  return (
    <>
      <Rect
        width={width}
        height={height}
        fill="#FFFFFF"
        opacity={alpha}
        cornerRadius={radius}
        listening={false}
      />
      <Shape
        listening={false}
        sceneFunc={(ctx) => {
          const inset = strokeW / 2;
          roundRectPath(
            ctx,
            inset,
            inset,
            width - inset * 2,
            height - inset * 2,
            Math.max(0, radius - inset),
          );
          const g = ctx.createLinearGradient(0, inset, 0, height - inset);
          g.addColorStop(0, 'rgba(255,71,30,0)');
          g.addColorStop(1, HOTSPOT_BORDER_COLOR);
          ctx.strokeStyle = g;
          ctx.lineWidth = strokeW;
          ctx.stroke();
        }}
      />
      <Rect
        name="specialty-hit"
        width={width}
        height={height}
        cornerRadius={radius}
        fill="rgba(0,0,0,0.001)"
        listening
      />
    </>
  );
}

export function CardLayer({
  card,
  selected,
  replaceSlot,
  draggable,
  editingField,
  onSelect,
  onChange,
  onSlotDblClick,
  onSlotSelect,
  onTextDblClick,
  layerOpacity = 1,
}: Props) {
  const cover = useImage(card.coverDataUrl);
  const qr = useImage(card.qrDataUrl);
  const avatar = useImage(card.avatarDataUrl);
  const titleFontSize = usePosterStore((s) => s.titleFontSize);
  const keywordFontSize = usePosterStore((s) => s.keywordFontSize);
  const coverInsetLeft = usePosterStore((s) => s.coverInsetLeft);
  const qrInsetRight = usePosterStore((s) => s.qrInsetRight);
  const avatarGapToCard = usePosterStore((s) => s.avatarGapToCard);
  const titleKeywordGap = usePosterStore((s) => s.titleKeywordGap);
  const nicknameFontSize = usePosterStore((s) => s.nicknameFontSize);
  const metricsFontSize = usePosterStore((s) => s.metricsFontSize);
  const avatarSize = usePosterStore((s) => s.avatarSize);

  const style = normalizeSpecialtyStyle(card.specialtyStyle);
  const radius = card.radius;
  const accent = specialtyAccentOf(card);
  const bgOpacity = specialtyBgOpacityOf(card);
  const bgMode = specialtyBgModeOf(card);
  const bgColor = specialtyBgColorOf(card);
  const centerColor = specialtyCenterOf(card);
  const angle = specialtyAngleOf(card);
  const strokeWidth = specialtyStrokeWidthOf(card);
  const strokeColorA = specialtyStrokeColorAOf(card);
  const strokeColorB = specialtyStrokeColorBOf(card);
  const strokeAngle = specialtyStrokeAngleOf(card);
  const strokeOpacityA = specialtyStrokeOpacityAOf(card);
  const strokeOpacityB = specialtyStrokeOpacityBOf(card);

  const metricsLine = useMemo(
    () => formatMetricsLine(card.exposureText, card.engagementText),
    [card.exposureText, card.engagementText],
  );

  const layout = useMemo(() => {
    const ctx = measureCanvas();
    ctx.font = `${TYPOGRAPHY.metricsWeight} ${metricsFontSize}px ${TYPOGRAPHY.fontFamily}`;
    return computeCardContentLayout(card.width, card.height, {
      coverInsetLeft,
      titleFontSize,
      keywordFontSize,
      metricsFontSize,
      showMetrics: card.showMetrics,
      titleKeywordGap,
      qrInsetRight,
      metricsText: metricsLine,
      measureMetrics: (s) => ctx.measureText(s).width,
    });
  }, [
    card.width,
    card.height,
    card.showMetrics,
    coverInsetLeft,
    titleFontSize,
    keywordFontSize,
    metricsFontSize,
    titleKeywordGap,
    qrInsetRight,
    metricsLine,
  ]);

  const { titleLines, keywordLines } = useMemo(() => {
    const ctx = measureCanvas();
    const titleMaxLines = Math.min(6, Math.max(2, (card.title.match(/\n/g)?.length ?? 0) + 2));
    ctx.font = `${TYPOGRAPHY.titleWeight} ${layout.titleSize}px ${TYPOGRAPHY.fontFamily}`;
    const lines = wrapTitle(card.title, layout.textW, (s) => ctx.measureText(s).width, titleMaxLines);
    ctx.font = `${TYPOGRAPHY.keywordWeight} ${layout.kwSize}px ${TYPOGRAPHY.fontFamily}`;
    const kws = wrapKeywordLines(card.keywords, layout.textW, (s) => ctx.measureText(s).width, 4);
    return { titleLines: lines, keywordLines: kws };
  }, [card.title, card.keywords, layout.textW, layout.titleSize, layout.kwSize]);

  const lineH = layout.titleSize * 1.25;
  const kwLineH = layout.kwSize * 1.25;
  const blockH =
    titleLines.length * lineH +
    (layout.showMetrics
      ? layout.titleMetricsGap + layout.metricsBlockH + layout.metricsKeywordGap
      : titleKeywordGap) +
    keywordLines.length * kwLineH;
  const textTop = (card.height - blockH) / 2;
  const isSideGlow = style === 'sideGlow';
  const isHotspot = style === 'hotspot';
  const isSpecialty = isSideGlow || isHotspot;
  const metricsTop = textTop + titleLines.length * lineH + layout.titleMetricsGap;
  const kwTop = layout.showMetrics
    ? metricsTop + layout.metricsBlockH + layout.metricsKeywordGap
    : textTop + titleLines.length * lineH + titleKeywordGap;
  const coverSelected = replaceSlot === 'cover';
  const qrSelected = replaceSlot === 'qr';
  const avatarSelected = replaceSlot === 'avatar';
  const slotDragging = coverSelected || qrSelected;
  const isWhiteText = card.textColor === '#FFFFFF';
  const titleColor = isWhiteText ? TYPOGRAPHY.colorWhite : TYPOGRAPHY.colorBlack;
  const subColor = isWhiteText ? 'rgba(255,255,255,0.78)' : TYPOGRAPHY.colorMidGray;
  const nickColor = isWhiteText ? 'rgba(255,255,255,0.88)' : TYPOGRAPHY.colorDarkGray;
  const nickText = card.nickname || card.account || '昵称';
  const nickMeasure = useMemo(() => {
    const ctx = measureCanvas();
    ctx.font = `${TYPOGRAPHY.nicknameWeight} ${nicknameFontSize}px ${TYPOGRAPHY.fontFamily}`;
    return Math.ceil(ctx.measureText(nickText).width);
  }, [nickText, nicknameFontSize]);
  const sidebarW = Math.max(avatarSize, nickMeasure + 4);
  const sidebarOffset = sidebarW + avatarGapToCard;
  const nickLineH = nicknameFontSize * 1.25;
  /** 头像与组件框垂直居中；昵称紧跟头像下方 */
  const avatarY = (card.height - avatarSize) / 2;
  const nickY = avatarY + avatarSize + ACCOUNT_SIDEBAR.nicknameGap;

  const coverFit = useMemo(() => {
    if (!cover) return null;
    return coverFitRect(
      cover.naturalWidth,
      cover.naturalHeight,
      layout.coverW,
      layout.coverH,
      card.coverOffsetX ?? 0,
      card.coverOffsetY ?? 0,
    );
  }, [cover, layout.coverW, layout.coverH, card.coverOffsetX, card.coverOffsetY]);

  const qrFit = useMemo(() => {
    if (!qr) return null;
    return coverFitRect(
      qr.naturalWidth,
      qr.naturalHeight,
      layout.qrSize,
      layout.qrSize,
      card.qrOffsetX ?? 0,
      card.qrOffsetY ?? 0,
    );
  }, [qr, layout.qrSize, card.qrOffsetX, card.qrOffsetY]);

  return (
    <Group
      x={card.x}
      y={card.y}
      opacity={layerOpacity}
      draggable={draggable && !slotDragging}
      onClick={onSelect}
      onTap={onSelect}
      onDragStart={(e) => {
        const node = e.target;
        // 拖的是整卡 Group；从头像热区起拖时也落到此节点
        node.setAttr('dragStartX', node.x());
        node.setAttr('dragStartY', node.y());
      }}
      onDragMove={(e) => {
        const node = e.target;
        const sx = node.getAttr('dragStartX') as number;
        const sy = node.getAttr('dragStartY') as number;
        const pos = axisSnapPos(node.x(), node.y(), sx, sy, 0, 10000, 0, 10000);
        node.x(pos.x);
        node.y(pos.y);
      }}
      onDragEnd={(e) => {
        const node = e.target;
        onChange({ x: node.x(), y: node.y() });
      }}
    >
      {card.showAvatar && (
        <Group
          x={-sidebarOffset}
          y={0}
          draggable={false}
          onClick={(e) => {
            e.cancelBubble = true;
            onSelect();
            onSlotSelect('avatar');
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onSelect();
            onSlotSelect('avatar');
          }}
          onDblClick={(e) => {
            e.cancelBubble = true;
            onSlotDblClick('avatar');
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            onSlotDblClick('avatar');
          }}
        >
          {/* 透明热区：命中后事件冒泡到卡片 Group，保证整卡可拖；头像本身不可单独拖 */}
          <Rect
            x={0}
            y={0}
            width={sidebarW}
            height={Math.max(
              avatarY + avatarSize + ACCOUNT_SIDEBAR.nicknameGap + nickLineH,
              card.height,
            )}
            fill="rgba(0,0,0,0.001)"
          />
          <Group x={(sidebarW - avatarSize) / 2} y={avatarY} listening={false}>
            <Group
              clipFunc={(ctx) => {
                const r = avatarSize / 2;
                ctx.beginPath();
                ctx.arc(r, r, r, 0, Math.PI * 2);
                ctx.closePath();
              }}
            >
              {avatar ? (
                <KonvaImage image={avatar} width={avatarSize} height={avatarSize} />
              ) : (
                <Rect width={avatarSize} height={avatarSize} fill="#E8E8E8" />
              )}
            </Group>
            {avatarSelected && (
              <Circle
                x={avatarSize / 2}
                y={avatarSize / 2}
                radius={avatarSize / 2}
                stroke="#6cb6ff"
                strokeWidth={2}
                listening={false}
              />
            )}
          </Group>
          <Text
            x={0}
            y={nickY}
            width={sidebarW}
            height={nickLineH}
            text={nickText}
            fontSize={nicknameFontSize}
            fontFamily={TYPOGRAPHY.fontFamily}
            fill={nickColor}
            align="center"
            verticalAlign="top"
            wrap="none"
            listening={false}
          />
        </Group>
      )}

      {isSideGlow ? (
        <SideGlowChrome
          width={card.width}
          height={card.height}
          radius={radius}
          accent={accent}
          bgOpacity={bgOpacity}
          bgMode={bgMode}
          bgColor={bgColor}
          centerColor={centerColor}
          angle={angle}
          strokeWidth={strokeWidth}
          strokeColorA={strokeColorA}
          strokeColorB={strokeColorB}
          strokeAngle={strokeAngle}
          strokeOpacityA={strokeOpacityA}
          strokeOpacityB={strokeOpacityB}
        />
      ) : isHotspot ? (
        <HotspotChrome
          width={card.width}
          height={card.height}
          radius={radius}
          fillOpacity={card.fillOpacity}
        />
      ) : (
        <Rect
          width={card.width}
          height={card.height}
          fill={card.fill}
          opacity={card.fillOpacity}
          cornerRadius={radius}
          stroke={selected ? '#6cb6ff' : card.borderColor}
          strokeWidth={selected ? 2 : card.borderWidth}
        />
      )}

      {selected && isSpecialty && (
        <Rect
          width={card.width}
          height={card.height}
          cornerRadius={radius}
          fillEnabled={false}
          stroke="#6cb6ff"
          strokeWidth={2}
          dash={[6, 4]}
          listening={false}
        />
      )}

      <Group
        x={layout.coverX}
        y={layout.coverY}
        clipFunc={(ctx) => {
          const r = CARD_DEFAULT.coverRadius;
          const w = layout.coverW;
          const h = layout.coverH;
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.arcTo(w, 0, w, h, r);
          ctx.arcTo(w, h, 0, h, r);
          ctx.arcTo(0, h, 0, 0, r);
          ctx.arcTo(0, 0, w, 0, r);
          ctx.closePath();
        }}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          onSelect();
          onSlotSelect('cover');
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
          onSelect();
          onSlotSelect('cover');
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
          onSlotDblClick('cover');
        }}
        onDblTap={(e) => {
          e.cancelBubble = true;
          onSlotDblClick('cover');
        }}
      >
        <Rect width={layout.coverW} height={layout.coverH} fill="rgba(0,0,0,0.001)" />
        {cover && coverFit ? (
          <KonvaImage
            image={cover}
            x={coverFit.x}
            y={coverFit.y}
            width={coverFit.width}
            height={coverFit.height}
            draggable={Boolean(coverSelected && draggable)}
            onDragStart={(e) => {
              e.cancelBubble = true;
              const node = e.target;
              node.setAttr('dragStartX', node.x());
              node.setAttr('dragStartY', node.y());
            }}
            onDragMove={(e) => {
              e.cancelBubble = true;
              const node = e.target;
              const sx = node.getAttr('dragStartX') as number;
              const sy = node.getAttr('dragStartY') as number;
              const pos = axisSnapPos(
                node.x(),
                node.y(),
                sx,
                sy,
                coverFit.minX,
                coverFit.maxX,
                coverFit.minY,
                coverFit.maxY,
              );
              node.x(pos.x);
              node.y(pos.y);
            }}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              const node = e.target;
              const pos = axisSnapPos(
                node.x(),
                node.y(),
                node.getAttr('dragStartX') as number,
                node.getAttr('dragStartY') as number,
                coverFit.minX,
                coverFit.maxX,
                coverFit.minY,
                coverFit.maxY,
              );
              node.x(pos.x);
              node.y(pos.y);
              onChange({
                coverOffsetX: pos.x - coverFit.baseX,
                coverOffsetY: pos.y - coverFit.baseY,
              });
            }}
          />
        ) : (
          <Rect width={layout.coverW} height={layout.coverH} fill="rgba(0,0,0,0.06)" listening={false} />
        )}
        {coverSelected && (
          <Rect
            width={layout.coverW}
            height={layout.coverH}
            fillEnabled={false}
            stroke="#6cb6ff"
            strokeWidth={2}
            dash={[6, 4]}
            listening={false}
          />
        )}
      </Group>

      {editingField !== 'title' && (
        <Group
          onDblClick={(e) => {
            e.cancelBubble = true;
            onSelect();
            onTextDblClick('title');
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            onSelect();
            onTextDblClick('title');
          }}
        >
          <Rect
            x={layout.textX}
            y={textTop}
            width={layout.textW}
            height={Math.max(lineH, titleLines.length * lineH)}
            fill="rgba(0,0,0,0.001)"
          />
          {titleLines.map((line, i) => (
            <Text
              key={i}
              x={layout.textX}
              y={textTop + i * lineH}
              width={layout.textW}
              text={line}
              fontSize={layout.titleSize}
              fontFamily={TYPOGRAPHY.fontFamily}
              fontStyle="600"
              fill={titleColor}
              listening={false}
            />
          ))}
        </Group>
      )}

      {layout.showMetrics &&
        editingField !== 'exposure' &&
        editingField !== 'engagement' && (
          <Group>
            <Shape
              x={layout.textX}
              y={metricsTop}
              listening={false}
              sceneFunc={(ctx) => {
                const barH = layout.metricsBarHeight;
                const barW = layout.metricsBarW;
                const r = Math.min(layout.metricsCornerRadius, barH / 2);
                ctx.beginPath();
                ctx.moveTo(r, 0);
                ctx.lineTo(barW, 0);
                ctx.lineTo(barW, barH);
                ctx.lineTo(r, barH);
                ctx.quadraticCurveTo(0, barH, 0, barH - r);
                ctx.lineTo(0, r);
                ctx.quadraticCurveTo(0, 0, r, 0);
                ctx.closePath();
                const g = ctx.createLinearGradient(0, 0, barW, 0);
                g.addColorStop(0, METRICS_BAR.colorLeft);
                g.addColorStop(0.45, METRICS_BAR.colorMid);
                g.addColorStop(1, 'rgba(216,209,255,0)');
                ctx.fillStyle = g;
                ctx.fill();
              }}
            />
            <Text
              x={layout.textX + layout.metricsPadX}
              y={metricsTop}
              width={Math.max(40, layout.metricsBarW - layout.metricsPadX * 2)}
              height={layout.metricsBarHeight}
              text={metricsLine}
              fontSize={layout.metricsSize}
              fontFamily={TYPOGRAPHY.fontFamily}
              fontStyle={`${TYPOGRAPHY.metricsWeight}`}
              fill={subColor}
              verticalAlign="middle"
              wrap="word"
              listening={false}
            />
            <Rect
              x={layout.textX}
              y={metricsTop}
              width={layout.metricsBarW / 2}
              height={layout.metricsBarHeight}
              fill="rgba(0,0,0,0.001)"
              onDblClick={(e) => {
                e.cancelBubble = true;
                onSelect();
                onTextDblClick('exposure');
              }}
              onDblTap={(e) => {
                e.cancelBubble = true;
                onSelect();
                onTextDblClick('exposure');
              }}
            />
            <Rect
              x={layout.textX + layout.metricsBarW / 2}
              y={metricsTop}
              width={layout.metricsBarW / 2}
              height={layout.metricsBarHeight}
              fill="rgba(0,0,0,0.001)"
              onDblClick={(e) => {
                e.cancelBubble = true;
                onSelect();
                onTextDblClick('engagement');
              }}
              onDblTap={(e) => {
                e.cancelBubble = true;
                onSelect();
                onTextDblClick('engagement');
              }}
            />
          </Group>
        )}

      {editingField !== 'keywords' && (
        <Group
          onDblClick={(e) => {
            e.cancelBubble = true;
            onSelect();
            onTextDblClick('keywords');
          }}
          onDblTap={(e) => {
            e.cancelBubble = true;
            onSelect();
            onTextDblClick('keywords');
          }}
        >
          <Rect
            x={layout.textX}
            y={kwTop}
            width={layout.textW}
            height={Math.max(kwLineH, keywordLines.length * kwLineH)}
            fill="rgba(0,0,0,0.001)"
          />
          {keywordLines.map((line, i) => (
            <Text
              key={i}
              x={layout.textX}
              y={kwTop + i * kwLineH}
              width={layout.textW}
              text={line}
              fontSize={layout.kwSize}
              fontFamily={TYPOGRAPHY.fontFamily}
              fontStyle={`${TYPOGRAPHY.keywordWeight}`}
              fill={subColor}
              listening={false}
            />
          ))}
        </Group>
      )}

      <Group
        x={layout.qrX - 4}
        y={layout.qrY - 4}
        onMouseDown={(e) => {
          e.cancelBubble = true;
          onSelect();
          onSlotSelect('qr');
        }}
        onTouchStart={(e) => {
          e.cancelBubble = true;
          onSelect();
          onSlotSelect('qr');
        }}
        onDblClick={(e) => {
          e.cancelBubble = true;
          onSlotDblClick('qr');
        }}
        onDblTap={(e) => {
          e.cancelBubble = true;
          onSlotDblClick('qr');
        }}
      >
        <Rect width={layout.qrSize + 8} height={layout.qrSize + 8} fill="#ffffff" cornerRadius={4} />
        <Group
          x={4}
          y={4}
          clipFunc={(ctx) => {
            ctx.beginPath();
            ctx.rect(0, 0, layout.qrSize, layout.qrSize);
            ctx.closePath();
          }}
        >
          {qr && qrFit ? (
            <KonvaImage
              image={qr}
              x={qrFit.x}
              y={qrFit.y}
              width={qrFit.width}
              height={qrFit.height}
              draggable={Boolean(qrSelected && draggable)}
              onDragStart={(e) => {
                e.cancelBubble = true;
                const node = e.target;
                node.setAttr('dragStartX', node.x());
                node.setAttr('dragStartY', node.y());
              }}
              onDragMove={(e) => {
                e.cancelBubble = true;
                const node = e.target;
                const sx = node.getAttr('dragStartX') as number;
                const sy = node.getAttr('dragStartY') as number;
                const pos = axisSnapPos(
                  node.x(),
                  node.y(),
                  sx,
                  sy,
                  qrFit.minX,
                  qrFit.maxX,
                  qrFit.minY,
                  qrFit.maxY,
                );
                node.x(pos.x);
                node.y(pos.y);
              }}
              onDragEnd={(e) => {
                e.cancelBubble = true;
                const node = e.target;
                const pos = axisSnapPos(
                  node.x(),
                  node.y(),
                  node.getAttr('dragStartX') as number,
                  node.getAttr('dragStartY') as number,
                  qrFit.minX,
                  qrFit.maxX,
                  qrFit.minY,
                  qrFit.maxY,
                );
                node.x(pos.x);
                node.y(pos.y);
                onChange({
                  qrOffsetX: pos.x - qrFit.baseX,
                  qrOffsetY: pos.y - qrFit.baseY,
                });
              }}
            />
          ) : (
            <Rect width={layout.qrSize} height={layout.qrSize} fill="#eee" listening={false} />
          )}
        </Group>
        {qrSelected && (
          <Rect
            width={layout.qrSize + 8}
            height={layout.qrSize + 8}
            fillEnabled={false}
            stroke="#6cb6ff"
            strokeWidth={2}
            dash={[6, 4]}
            listening={false}
          />
        )}
      </Group>
    </Group>
  );
}
