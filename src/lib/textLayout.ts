/**
 * 中文友好换行：优先标点/空格，避免拆开英文数字，禁止单字独占一行。
 * 支持显式换行符 `\n`。
 */
const BREAK_AFTER = /[，。、；：！？…—,\.!?;:\s]/;

function wrapTitleParagraph(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  maxLines: number,
): string[] {
  const raw = text;
  if (!raw) return [''];
  if (measure(raw) <= maxWidth) return [raw];

  const lines: string[] = [];
  let rest = raw;

  while (rest && lines.length < maxLines) {
    if (measure(rest) <= maxWidth) {
      lines.push(rest);
      rest = '';
      break;
    }

    let cut = 0;
    let lastBreak = -1;
    for (let i = 1; i <= rest.length; i++) {
      const slice = rest.slice(0, i);
      if (measure(slice) > maxWidth) break;
      cut = i;
      const ch = rest[i - 1];
      if (BREAK_AFTER.test(ch)) lastBreak = i;
      if (i < rest.length) {
        const a = rest[i - 1];
        const b = rest[i];
        const wordish = /[A-Za-z0-9]/.test(a) && /[A-Za-z0-9]/.test(b);
        if (!wordish && !BREAK_AFTER.test(a)) {
          if (/[\u4e00-\u9fff]/.test(a)) lastBreak = Math.max(lastBreak, i);
        }
      }
    }

    if (cut <= 0) cut = 1;
    let end = lastBreak > 0 ? lastBreak : cut;
    let line = rest.slice(0, end).trimEnd();
    rest = rest.slice(end).trimStart();

    if (rest.length === 1 && lines.length + 1 < maxLines) {
      const merged = line + rest;
      if (measure(merged) <= maxWidth) {
        line = merged;
        rest = '';
      } else if (line.length > 1) {
        rest = line.slice(-1) + rest;
        line = line.slice(0, -1);
      }
    }

    lines.push(line || rest.slice(0, 1));
    if (!line && rest) {
      rest = rest.slice(1);
    }
  }

  if (rest && lines.length) {
    const last = lines[lines.length - 1];
    if (last.length === 1 && rest.length >= 1) {
      lines[lines.length - 1] = last + rest[0];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length === 1 && i > 0) {
      const prev = lines[i - 1];
      if (prev.length > 1) {
        lines[i] = prev.slice(-1) + lines[i];
        lines[i - 1] = prev.slice(0, -1);
      }
    }
  }

  return lines.filter((l, i) => l.length > 0 || i === 0).slice(0, maxLines);
}

export function wrapTitle(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  maxLines = 2,
): string[] {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized.trim() && !normalized.includes('\n')) return [''];

  const paragraphs = normalized.split('\n');
  const lines: string[] = [];
  for (const p of paragraphs) {
    if (lines.length >= maxLines) break;
    const wrapped = wrapTitleParagraph(p, maxWidth, measure, maxLines - lines.length);
    lines.push(...wrapped);
  }
  return lines.length ? lines.slice(0, maxLines) : [''];
}

export function ellipsisLine(text: string, maxWidth: number, measure: (s: string) => number): string {
  const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (measure(flat) <= maxWidth) return flat;
  let end = flat.length;
  while (end > 0 && measure(flat.slice(0, end) + '…') > maxWidth) end--;
  return (flat.slice(0, Math.max(1, end)) + '…').trim();
}

/** 关键词多行展示（保留换行，超出宽度省略） */
export function wrapKeywordLines(
  text: string,
  maxWidth: number,
  measure: (s: string) => number,
  maxLines = 4,
): string[] {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized) return [''];
  const paragraphs = normalized.split('\n');
  const lines: string[] = [];
  for (const p of paragraphs) {
    if (lines.length >= maxLines) break;
    if (!p) {
      lines.push('');
      continue;
    }
    if (measure(p) <= maxWidth) {
      lines.push(p);
      continue;
    }
    // 超宽：拆成多行，末行省略
    let rest = p;
    while (rest && lines.length < maxLines) {
      if (measure(rest) <= maxWidth) {
        lines.push(rest);
        rest = '';
        break;
      }
      let cut = 1;
      for (let i = 1; i <= rest.length; i++) {
        if (measure(rest.slice(0, i)) > maxWidth) break;
        cut = i;
      }
      const isLast = lines.length + 1 >= maxLines;
      if (isLast) {
        lines.push(ellipsisLine(rest, maxWidth, measure));
        rest = '';
      } else {
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
    }
  }
  return lines.length ? lines.slice(0, maxLines) : [''];
}
