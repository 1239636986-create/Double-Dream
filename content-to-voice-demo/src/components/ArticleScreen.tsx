import type { Article } from "../data/articles";

type Props = {
  article: Article;
  listening: boolean;
  onBack: () => void;
  onOpenSheet: () => void;
  onListen: () => void;
  onShareYuanbao: () => void;
};

export function ArticleScreen({
  article,
  listening,
  onBack,
  onOpenSheet,
  onListen,
  onShareYuanbao,
}: Props) {
  return (
    <div className="screen article-screen">
      <div className="nav-bar">
        <button className="nav-btn" onClick={onBack} aria-label="返回">
          ‹
        </button>
        <div className="title">公众号</div>
        <button className="nav-btn" onClick={onOpenSheet} aria-label="更多">
          ···
        </button>
      </div>

      <div className="scroll-area article-body">
        <div className="article-meta-row">
          <div className="account-avatar">{article.accountAvatar}</div>
          <div className="account-name">{article.account}</div>
        </div>

        <h1 className="article-title">{article.title}</h1>
        <div className="article-byline">
          {article.author} · {article.date}
        </div>

        <div className="inline-actions">
          <button
            className={`inline-action ${listening ? "active" : ""}`}
            onClick={onListen}
          >
            <span aria-hidden>🎧</span>
            {listening ? "朗读中…" : "听全文"}
          </button>
          <button className="inline-action" type="button">
            <span aria-hidden>☆</span>
            星标
          </button>
        </div>

        <div className="article-cover" style={{ background: article.coverGradient }}>
          <span>{article.summaryTitle}</span>
        </div>

        {article.paragraphs.map((p) => (
          <p className="article-paragraph" key={p.slice(0, 24)}>
            {p}
          </p>
        ))}

        {article.themes.map((theme) => (
          <div className="theme-block" key={theme.no}>
            <div className="no">{theme.no}</div>
            <h3>{theme.title}</h3>
            <ul>
              {theme.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="bottom-dock">
        <button className="dock-btn" onClick={onListen}>
          {listening ? "暂停朗读" : "听全文"}
        </button>
        <button className="dock-btn primary" onClick={onShareYuanbao}>
          发给元宝
        </button>
      </div>
    </div>
  );
}
