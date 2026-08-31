import * as XLSX from 'xlsx';
import { MAX_CARDS } from './constants';
import type { ExcelRow } from './types';

const HEADER_MAP: Record<string, keyof ExcelRow> = {
  账号: 'account',
  昵称: 'nickname',
  账号昵称: 'nickname',
  文案标题: 'title',
  标题: 'title',
  文案: 'title',
  内容关键词: 'keywords',
  视频关键词: 'keywords',
  关键词: 'keywords',
  话题: 'keywords',
  封面图: 'coverFileName',
  封面文件名: 'coverFileName',
  封面: 'coverFileName',
  二维码: 'qrFileName',
  二维码文件名: 'qrFileName',
  头像: 'avatarFileName',
  账号头像: 'avatarFileName',
  曝光量: 'exposureText',
  曝光w: 'exposureText',
  '曝光(w)': 'exposureText',
  曝光: 'exposureText',
  互动量: 'engagementText',
  互动: 'engagementText',
  视频链接: 'videoUrl',
  链接: 'videoUrl',
};

function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .replace(/[\u200b-\u200d\ufeff\u00a0]/g, '')
    .replace(/\s/g, '')
    .replace(/["']/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .trim();
}

function mapHeaderCell(h: unknown): keyof ExcelRow | undefined {
  const nk = normalizeHeader(h);
  if (!nk) return undefined;
  let mapped = HEADER_MAP[nk] ?? HEADER_MAP[String(h).trim()];
  if (!mapped) {
    if (/标题|文案/.test(nk) && !/关键|键/.test(nk)) mapped = 'title';
    else if (/关键词|话题|标签/.test(nk)) mapped = 'keywords';
    else if (/封面/.test(nk)) mapped = 'coverFileName';
    else if (/二维码|qr/i.test(nk)) mapped = 'qrFileName';
    else if (/头像/.test(nk)) mapped = 'avatarFileName';
    else if (/昵称/.test(nk)) mapped = 'nickname';
    else if (/账号|账户/.test(nk)) mapped = 'account';
    else if (/曝光/.test(nk)) mapped = 'exposureText';
    else if (/互动/.test(nk)) mapped = 'engagementText';
    else if (/链接|url|link|douyin|抖音/i.test(nk)) mapped = 'videoUrl';
  }
  return mapped;
}

function looksLikeDispImg(val: string) {
  return /DISPIMG/i.test(val) || /^ID_[A-F0-9]+$/i.test(val);
}

/** 空占位：/、-、空串等 */
function isEmptyPlaceholder(val: string) {
  const v = val.trim();
  return !v || v === '/' || v === '-' || v === '—' || v === '无' || /^n\/?a$/i.test(v);
}

/** 从分享文案中提取抖音等视频链接 */
export function extractVideoUrl(raw: string): string {
  const text = String(raw ?? '').trim();
  if (!text || isEmptyPlaceholder(text)) return '';
  const m =
    text.match(/https?:\/\/v\.douyin\.com\/[A-Za-z0-9_-]+\/?/i) ||
    text.match(/https?:\/\/www\.douyin\.com\/[^\s，。；;）)\]]+/i) ||
    text.match(/https?:\/\/[^\s，。；;）)\]]+/i);
  return m ? m[0].replace(/[，。；;]+$/, '') : text.startsWith('http') ? text : '';
}

/**
 * 曝光列（单位常为 w）：纯数字补 w；已带 w/万 则原样；占位符清空
 */
export function normalizeExposure(raw: string, headerHint = ''): string {
  const v = String(raw ?? '').trim();
  if (isEmptyPlaceholder(v)) return '';
  if (/[wW万]/.test(v)) return v;
  if (/^\d+(\.\d+)?$/.test(v)) {
    const unitW =
      !headerHint || /曝光.*w|（w）|\(w\)|曝光w/i.test(headerHint);
    return unitW ? `${v}w` : v;
  }
  return v;
}

export function normalizeEngagement(raw: string): string {
  const v = String(raw ?? '').trim();
  if (isEmptyPlaceholder(v)) return '';
  return v;
}

/** 在二维表中定位表头行（含「账号」+「文案标题/标题」） */
function findHeaderRowIndex(aoa: unknown[][]): number {
  const limit = Math.min(aoa.length, 40);
  for (let r = 0; r < limit; r++) {
    const cells = (aoa[r] || []).map((c) => normalizeHeader(c));
    const hasAccount = cells.some((c) => c === '账号' || c === '账户' || c.includes('账号'));
    const hasTitle = cells.some(
      (c) => c === '文案标题' || c === '标题' || (c.includes('标题') && !c.includes('关键')),
    );
    if (hasAccount && hasTitle) return r;
  }
  for (let r = 0; r < limit; r++) {
    const cells = (aoa[r] || []).map((c) => normalizeHeader(c));
    if (cells.some((c) => c === '文案标题' || c === '内容关键词')) return r;
  }
  return -1;
}

function cellStr(v: unknown): string {
  if (v == null) return '';
  return String(v).replace(/\u00a0/g, ' ').trim();
}

function sheetToAoa(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
}

function parseAoa(aoa: unknown[][], sheetName?: string): {
  rows: ExcelRow[];
  truncated: boolean;
  warning?: string;
  headerIdx: number;
} {
  if (!aoa.length) {
    return { rows: [], truncated: false, warning: '工作表没有数据行', headerIdx: -1 };
  }

  const headerIdx = findHeaderRowIndex(aoa);
  if (headerIdx < 0) {
    return {
      rows: [],
      truncated: false,
      warning: `未识别到表头（需包含「账号」「文案标题」等列）${sheetName ? `：${sheetName}` : ''}`,
      headerIdx: -1,
    };
  }

  const headerRow = aoa[headerIdx] || [];
  const colMap: Array<{ index: number; field: keyof ExcelRow; header: string }> = [];
  const usedFields = new Set<keyof ExcelRow>();
  headerRow.forEach((cell, index) => {
    const field = mapHeaderCell(cell);
    if (!field || usedFields.has(field)) return;
    usedFields.add(field);
    colMap.push({ index, field, header: cellStr(cell) });
  });

  if (!colMap.some((c) => c.field === 'title')) {
    return {
      rows: [],
      truncated: false,
      warning: '未识别到「文案标题」列，请检查表头',
      headerIdx,
    };
  }

  const exposureHeader =
    colMap.find((c) => c.field === 'exposureText')?.header || '曝光(w)';

  const rows: ExcelRow[] = [];
  let embeddedHint = false;
  let lastAccount = '';

  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r] || [];
    const row: ExcelRow = {
      title: '',
      keywords: '',
      coverFileName: '',
      qrFileName: '',
    };

    for (const { index, field, header } of colMap) {
      const rawVal = cellStr(line[index]);
      if (field === 'account') {
        row.account = rawVal;
      } else if (field === 'nickname') {
        row.nickname = rawVal;
      } else if (field === 'title') {
        row.title = rawVal;
      } else if (field === 'keywords') {
        row.keywords = rawVal.replace(/\s+/g, ' ').trim();
      } else if (field === 'exposureText') {
        row.exposureText = normalizeExposure(rawVal, header || exposureHeader);
      } else if (field === 'engagementText') {
        row.engagementText = normalizeEngagement(rawVal);
      } else if (field === 'videoUrl') {
        row.videoUrl = extractVideoUrl(rawVal);
      } else if (field === 'coverFileName' || field === 'qrFileName' || field === 'avatarFileName') {
        if (looksLikeDispImg(rawVal)) {
          embeddedHint = true;
        } else if (!isEmptyPlaceholder(rawVal)) {
          if (field === 'avatarFileName') row.avatarFileName = rawVal;
          else row[field] = rawVal;
        }
      }
    }

    if (
      normalizeHeader(row.title) === '文案标题' ||
      normalizeHeader(row.account) === '账号' ||
      normalizeHeader(row.keywords) === '内容关键词'
    ) {
      continue;
    }

    if (!row.title && !row.coverFileName && !row.qrFileName && !row.keywords) {
      continue;
    }
    if (!row.title && !row.keywords) continue;

    if (row.account) {
      lastAccount = row.account;
    } else if (lastAccount) {
      row.account = lastAccount;
    }

    if (row.account && !row.nickname) {
      row.nickname = row.account;
    }

    rows.push(row);
  }

  const truncated = rows.length > MAX_CARDS;
  const sliced = rows.slice(0, MAX_CARDS);
  const withUrl = sliced.filter((r) => r.videoUrl).length;
  const withMetrics = sliced.filter((r) => r.exposureText || r.engagementText).length;
  const withAccount = sliced.filter((r) => r.account).length;
  const withCoverName = sliced.filter((r) => r.coverFileName).length;

  const warnings: string[] = [];
  if (sheetName) warnings.push(`工作表「${sheetName}」`);
  if (headerIdx > 0) {
    warnings.push(`已跳过前 ${headerIdx} 行标题区`);
  }
  if (!sliced.length) {
    warnings.push('未解析到有效数据行');
  } else {
    warnings.push(
      `成功 ${sliced.length} 条（账号 ${withAccount}、链接 ${withUrl}、有数据 ${withMetrics}）`,
    );
  }
  if (truncated) warnings.push(`超过 ${MAX_CARDS} 行已截断`);
  if (embeddedHint || (sliced.length && !withCoverName)) {
    warnings.push('封面/二维码需点「素材文件夹」匹配（表内无可用文件名）');
  }

  return {
    rows: sliced,
    truncated,
    warning: warnings.join('；'),
    headerIdx,
  };
}

function readWorkbook(data: Uint8Array | string, kind: 'array' | 'string'): XLSX.WorkBook {
  return XLSX.read(data, { type: kind, cellText: true, cellDates: true });
}

/**
 * 解析新媒体周报 / 标准表：
 * - 自动跳过「第xx期」等标题行，定位真实表头
 * - 多工作表时选中第一个能识别表头的
 * - 账号向下填充；曝光(w) 数字补 w；「/」视为无数据；分享文案提链接
 */
export function parseExcel(buffer: ArrayBuffer): {
  rows: ExcelRow[];
  truncated: boolean;
  warning?: string;
} {
  try {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const wb = readWorkbook(data, 'array');
    return parseWorkbook(wb);
  } catch (err) {
    return {
      rows: [],
      truncated: false,
      warning: `Excel 读取失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function parseWorkbook(wb: XLSX.WorkBook): {
  rows: ExcelRow[];
  truncated: boolean;
  warning?: string;
} {
  if (!wb.SheetNames.length) {
    return { rows: [], truncated: false, warning: 'Excel 没有任何工作表' };
  }

  let best: ReturnType<typeof parseAoa> | null = null;
  const failures: string[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const aoa = sheetToAoa(sheet);
    const result = parseAoa(aoa, wb.SheetNames.length > 1 ? name : undefined);
    if (result.rows.length) {
      best = result;
      break;
    }
    if (result.warning) failures.push(result.warning);
  }

  if (best) {
    return { rows: best.rows, truncated: best.truncated, warning: best.warning };
  }

  return {
    rows: [],
    truncated: false,
    warning: failures[0] || '未识别到表头（需包含「账号」「文案标题」等列）',
  };
}

/** 支持 .xlsx / .xls / .csv（含 UTF-8 BOM） */
export async function parseExcelFile(file: File): Promise<{
  rows: ExcelRow[];
  truncated: boolean;
  warning?: string;
}> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      const text = await file.text();
      const wb = readWorkbook(text, 'string');
      return parseWorkbook(wb);
    }
    const buf = await file.arrayBuffer();
    return parseExcel(buf);
  } catch (err) {
    return {
      rows: [],
      truncated: false,
      warning: `文件解析失败：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function matchAsset(files: File[], fileName: string): File | undefined {
  if (!fileName) return undefined;
  const target = fileName.trim().toLowerCase();
  const base = target.replace(/\.[a-z0-9]+$/, '');
  return (
    files.find((f) => f.name.toLowerCase() === target) ||
    files.find((f) => f.name.toLowerCase().endsWith('/' + target)) ||
    files.find((f) => f.webkitRelativePath?.toLowerCase().endsWith('/' + target)) ||
    files.find((f) => f.name.toLowerCase().replace(/\.[a-z0-9]+$/, '') === base)
  );
}

export function isQrFileName(name: string) {
  const n = name.toLowerCase();
  return /qr|二维码|ecode|code/.test(n) && !/头像|avatar/.test(n);
}

export function isAvatarFileName(name: string) {
  const n = name.toLowerCase();
  return /头像|avatar|head/i.test(n);
}

/** 按文件名排序后，非二维码/头像作封面、二维码作 QR、头像作 avatar，依序匹配行 */
export function autoMatchAssetsByOrder(
  files: File[],
  rowCount: number,
): Array<{ cover?: File; qr?: File; avatar?: File }> {
  const images = files
    .filter((f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const avatars = images.filter((f) => isAvatarFileName(f.name));
  const covers = images.filter((f) => !isQrFileName(f.name) && !isAvatarFileName(f.name));
  const qrs = images.filter((f) => isQrFileName(f.name));
  const result: Array<{ cover?: File; qr?: File; avatar?: File }> = [];
  for (let i = 0; i < rowCount; i++) {
    result.push({ cover: covers[i], qr: qrs[i], avatar: avatars[i] });
  }
  return result;
}
