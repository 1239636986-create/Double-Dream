import { useEffect, useRef, useState } from "react";
import type { Article } from "../data/articles";
import {
  initialChatSeed,
  summaryReply,
  type ChatMessage,
  type SummaryCard,
} from "../data/dialogue";
import { articleFullText } from "../lib/articleText";
import { runCozeVoice } from "../lib/cozeVoiceClient";

type Props = {
  article: Article;
  cozeReady: boolean;
  onBack: () => void;
  onOpenVoice: () => void;
  onOpenSettlement: () => void;
  onCozeSettlement?: (items: Array<{ type: string; title: string; detail: string }>) => void;
  autoSummarize?: boolean;
};

export function YuanbaoChat({
  article,
  cozeReady,
  onBack,
  onOpenVoice,
  onOpenSettlement,
  onCozeSettlement,
  autoSummarize = true,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialChatSeed(article.title, article.account),
  );
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [voiceModeHint, setVoiceModeHint] = useState(false);
  const [status, setStatus] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const summarized = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    if (!autoSummarize || summarized.current) return;
    summarized.current = true;
    void (async () => {
      setTyping(true);
      setStatus(cozeReady ? "正在调用扣子工作流总结…" : "演示模式（未配置 Token）");
      try {
        if (cozeReady) {
          const result = await runCozeVoice({
            article_title: article.title,
            article_content: articleFullText(article),
            user_question: "这个说了什么？请总结核心要点，并给出研究切入点。",
          });
          const cards: SummaryCard[] =
            result.cards.length > 0
              ? result.cards.map((c, i) => ({
                  id: `coze-${i}`,
                  title: c.title,
                  body: c.body,
                  badge: "元来是这样",
                }))
              : [
                  {
                    id: "coze-reply",
                    title: "元宝总结",
                    body: result.replyText,
                    badge: "元来是这样",
                  },
                ];
          setMessages((prev) => [
            ...prev,
            { id: `m-coze-${Date.now()}`, role: "assistant", kind: "summary-cards", cards },
          ]);
          if (result.settlement.length) onCozeSettlement?.(result.settlement);
        } else {
          await new Promise((r) => setTimeout(r, 800));
          setMessages((prev) => [...prev, summaryReply]);
        }
        setVoiceModeHint(true);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            kind: "text",
            text: `扣子调用失败：${err instanceof Error ? err.message : String(err)}。已回退演示卡片。`,
          },
          summaryReply,
        ]);
        setVoiceModeHint(true);
      } finally {
        setTyping(false);
        setStatus("");
      }
    })();
  }, [article, autoSummarize, cozeReady, onCozeSettlement]);

  const sendText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", kind: "text", text: trimmed },
    ]);
    setInput("");
    setTyping(true);
    setStatus(cozeReady ? "扣子思考中…" : "演示回复中…");

    void (async () => {
      try {
        if (cozeReady) {
          const result = await runCozeVoice({
            article_title: article.title,
            article_content: articleFullText(article),
            user_question: trimmed,
          });
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              kind: "text",
              text: result.replyText,
            },
            {
              id: `a2-${Date.now()}`,
              role: "assistant",
              kind: "settlement-teaser",
              text: "需要的话，我可以把对话沉淀成洞察 / 动作 / 待办",
            },
          ]);
          if (result.settlement.length) onCozeSettlement?.(result.settlement);
        } else {
          await new Promise((r) => setTimeout(r, 700));
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              kind: "text",
              text: "可以。点下方「语音交流」，边听边聊；聊完后我会帮你沉淀成洞察、动作和待办。（配置 COZE_API_TOKEN 后这里会走真实扣子工作流）",
            },
            {
              id: `a2-${Date.now()}`,
              role: "assistant",
              kind: "settlement-teaser",
              text: "对话结束后可一键整理有效信息",
            },
          ]);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            kind: "text",
            text: `调用失败：${err instanceof Error ? err.message : String(err)}`,
          },
        ]);
      } finally {
        setTyping(false);
        setStatus("");
      }
    })();
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
        {status && <div className="time-chip">{status}</div>}
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
