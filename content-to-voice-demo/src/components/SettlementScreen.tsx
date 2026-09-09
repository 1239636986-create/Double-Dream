import { settlementItems } from "../data/dialogue";

type Props = {
  articleTitle: string;
  onBack: () => void;
  onRestart: () => void;
};

const typeLabel = {
  insight: "INSIGHT",
  quote: "QUOTE",
  action: "ACTION",
  todo: "TODO",
} as const;

export function SettlementScreen({ articleTitle, onBack, onRestart }: Props) {
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
            基于《{articleTitle}》的朗读与一轮语音交流，自动沉淀洞察、金句、动作与待办，避免聊完就散。
          </p>
        </div>

        <div className="settlement-list">
          {settlementItems.map((item) => (
            <article key={item.id} className={`settle-card ${item.type}`}>
              <div className="type">{typeLabel[item.type]}</div>
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
        <button className="dock-btn primary" onClick={onRestart}>
          再走一遍流程
        </button>
      </div>
    </div>
  );
}
