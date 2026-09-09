import type { Article } from "../data/articles";

export function articleFullText(article: Article): string {
  const themeBlocks = article.themes
    .map(
      (t) =>
        `${t.no} ${t.title}\n${t.points.map((p) => `- ${p}`).join("\n")}`,
    )
    .join("\n\n");
  return [
    article.title,
    `来源：${article.account}`,
    `作者：${article.author}`,
    `日期：${article.date}`,
    "",
    ...article.paragraphs,
    "",
    themeBlocks,
  ].join("\n");
}
