import { useEffect, useRef, useState } from "react";
import type { Article } from "../data/articles";
import {
  initialChatSeed,
  summaryReply,
  type ChatMessage,
} from "../data/dialogue";

type Props = {
  article: Article;
  onBack: () => void;
  onOpenVoice: () => void;
  onOpenSettlement: () => void;
  autoSummarize?: boolean;
};

export function YuanbaoChat({
  article,
  onBack,
  onOpenVoice,
  onOpenSettlement,
  autoSummarize = true,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialChatSeed(article.title, article.account),
  );
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [voiceModeHint, setVoiceModeHint] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const summarized = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!autoSummarize || summarized.current) return;
    summarized.current = true;
    setTyping(true);
    const t = window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [...prev, summaryReply]);
      setVoiceModeHint(true);
    }, 1100);
    return () => window.clearTimeout(t);
  }, [autoSummarize]);

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", kind: "text", text: trimmed },
    ]);
    setInput("");
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          kind: "text",
          text: "可以。点下方「语音交流」，边听边聊；聊完后我会帮你沉淀成洞察、动作和待办。",
        },
        {
          id: `a2-${Date.now()}`,
          role: "assistant",
          kind: "settlement-teaser",
          text: "对话结束后可一键整理有效信息",
        },
      ]);
    }, 800);
  };

  return (
    <div className="screen chat-screen">
      <div className="nav-bar">
        <button
          className="nav-btn badge-back"
          data-count="573"
          onClick={onBack}
          aria-label="返回"
        >
          ‹
        </button>
        <div className="title">元宝 AI</div>
        <button className="nav-btn" aria-label="更多">
          ···
        </button>
      </div>

      <div className="scroll-area chat-messages">
        <div className="time-chip">下午 1:34</div>
        {messages.map((msg) => (
          <MessageView key={msg.id} msg={msg} onSettlement={onOpenSettlement} />
        ))}
        {typing && (
          <div className="msg-row">
            <div className="avatar assistant" />
            <div className="bubble">
              <span className="typing" aria-label="正在输入">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {voiceModeHint && (
        <div className="quick-chips">
          <button onClick={onOpenVoice}>🎙 语音交流想法</button>
          <button onClick={onOpenSettlement}>✨ 沉淀有效信息</button>
          <button onClick={() => sendText("地铁热环境和适老化怎么连？")}>
            追问地铁热环境
          </button>
        </div>
      )}

      <div className="composer">
        <button
          className="composer-icon active"
          onClick={onOpenVoice}
          title="语音模式"
        >
          ≈
        </button>
        <form
          className="composer-input"
          onSubmit={(e) => {
            e.preventDefault();
            sendText(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="和元宝聊聊这篇文章…"
          />
        </form>
        <div className="composer-right">
          <button onClick={onOpenVoice} title="按住说话">
            🎤
          </button>
          <button onClick={() => sendText(input || "帮我提炼研究切入点")}>＋</button>
        </div>
      </div>
    </div>
  );
}

function MessageView({
  msg,
  onSettlement,
}: {
  msg: ChatMessage;
  onSettlement: () => void;
}) {
  if (msg.role === "user" && msg.kind === "article") {
    return (
      <div className="msg-row user">
        <div className="avatar user">我</div>
        <div className="bubble article-card">
          <div className="thumb">Nature Cities</div>
          <div className="card-body">
            <strong>{msg.articleTitle}</strong>
            <span>{msg.articleSource}</span>
          </div>
        </div>
      </div>
    );
  }

  if (msg.role === "user") {
    return (
      <div className="msg-row user">
        <div className="avatar user">我</div>
        <div className="bubble">{msg.text}</div>
      </div>
    );
  }

  if (msg.kind === "summary-cards" && msg.cards) {
    return (
      <div className="msg-row">
        <div className="avatar assistant" />
        <div className="summary-stack">
          {msg.cards.map((card) => (
            <div className="summary-card" key={card.id}>
              <div className="summary-badge">{card.badge}</div>
              <h4>{card.title}</h4>
              <p>{card.body}</p>
              <div className="summary-footer">
                <span>元宝</span>
                <span>· 要点卡片</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (msg.kind === "settlement-teaser") {
    return (
      <div className="msg-row">
        <div className="avatar assistant" />
        <div className="bubble">
          {msg.text}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={onSettlement}
              style={{
                color: "#19c37d",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              查看信息整理 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="msg-row">
      <div className="avatar assistant" />
      <div className="bubble">{msg.text}</div>
    </div>
  );
}
