import { settlementItems, type SettlementItem } from "../data/dialogue";

type Props = {
  articleTitle: string;
  items?: SettlementItem[];
  cozeReady?: boolean;
  onBack: () => void;
  onRestart: () => void;
  onRefreshFromCoze?: () => void;
  refreshing?: boolean;
};

const typeLabel: Record<string, string> = {
  insight: "INSIGHT",
  quote: "QUOTE",
  action: "ACTION",
  todo: "TODO",
};

export function SettlementScreen({
  articleTitle,
  items,
  cozeReady,
  onBack,
  onRestart,
  onRefreshFromCoze,
  refreshing,
}: Props) {
  const list = items?.length ? items : settlementItems;

  return (
    <div className="screen settlement-screen">
      <div className="nav-bar">
        <button className="nav-btn" onClick={onBack} aria-label="返回">
          ‹
        </button>
        <div className="title">信息沉淀</div>
        <button className="nav-btn" onClick={onRestart} aria-label="重来">
          ↺
        </button>
      </div>

      <div className="scroll-area">
        <div className="settlement-hero">
          <div className="eyebrow">VOICE → NOTES</div>
          <h2>语音对话后的有效信息整理</h2>
          <p>
            基于《{articleTitle}》
            {cozeReady ? "，由扣子工作流 / 对话结果整理。" : "（演示数据；配置 Token 后可走扣子生成）。"}
          </p>
        </div>

        <div className="settlement-list">
          {list.map((item) => (
            <article key={item.id} className={`settle-card ${item.type}`}>
              <div className="type">{typeLabel[item.type] || item.type.toUpperCase()}</div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="bottom-dock">
        <button className="dock-btn" onClick={onBack}>
          回到对话
        </button>
        {cozeReady && onRefreshFromCoze ? (
          <button className="dock-btn primary" onClick={onRefreshFromCoze} disabled={refreshing}>
            {refreshing ? "生成中…" : "用扣子重新沉淀"}
          </button>
        ) : (
          <button className="dock-btn primary" onClick={onRestart}>
            再走一遍流程
          </button>
        )}
      </div>
    </div>
  );
}
