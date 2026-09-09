import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionSheet } from "./components/ActionSheet";
import { ArticleScreen } from "./components/ArticleScreen";
import { ListenPlayer } from "./components/ListenPlayer";
import { PhoneShell } from "./components/PhoneShell";
import { SettlementScreen } from "./components/SettlementScreen";
import { VoiceMode } from "./components/VoiceMode";
import { YuanbaoChat } from "./components/YuanbaoChat";
import { demoArticle } from "./data/articles";
import { listenLaterHint } from "./data/dialogue";
import { useSpeech } from "./hooks/useSpeech";
import "./styles/app.css";

type Screen = "article" | "chat" | "settlement";

const steps = [
  {
    id: "read",
    title: "更好朗读",
    desc: "公众号文内「听全文」+ 菜单「稍后听」，降低长文阅读成本",
  },
  {
    id: "talk",
    title: "语音交流想法",
    desc: "转发元宝后按住说话，围绕文章追问与碰撞观点",
  },
  {
    id: "settle",
    title: "有效信息沉淀",
    desc: "对话结束后整理洞察、金句、动作与待办",
  },
] as const;

export default function App() {
  const [screen, setScreen] = useState<Screen>("article");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const { speaking, speak, stop, supported, lineIndex, lineTotal } = useSpeech();

  const listening = speaking;
  const script = demoArticle.listenScript;

  const progressLabel = useMemo(() => {
    if (!listening && !showPlayer) {
      return supported ? "点击播放 · 系统中文朗读" : "演示模式 · 环境无 TTS";
    }
    const total = lineTotal || script.length;
    return `段落 ${Math.min(lineIndex + 1, total)} / ${total}`;
  }, [listening, showPlayer, lineIndex, lineTotal, script.length, supported]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const stopListen = useCallback(() => {
    stop();
    setShowPlayer(false);
  }, [stop]);

  const startListen = useCallback(() => {
    setSheetOpen(false);
    setShowPlayer(true);
    if (!supported) {
      showToast("当前浏览器不支持语音合成，已模拟听全文状态");
      return;
    }
    speak(script, {
      onEnd: () => setShowPlayer(false),
    });
  }, [script, showToast, speak, supported]);

  const toggleListen = () => {
    if (listening) stopListen();
    else startListen();
  };

  const goYuanbao = () => {
    setSheetOpen(false);
    stopListen();
    setScreen("chat");
  };

  const activeStep =
    screen === "settlement" ? "settle" : screen === "chat" ? "talk" : "read";

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return (
    <div className="app-shell">
      <aside className="side-panel">
        <div className="brand-mark">
          <div className="brand-logo" aria-hidden />
          <div className="brand-text">
            <h1>元宝 · Content to Voice</h1>
            <p>公众号朗读 × 语音交流 × 信息沉淀 Demo</p>
          </div>
        </div>

        <div className="side-copy">
          <h2>让长文不只是「看完」，而是「听懂、聊透、留住」</h2>
          <p>
            参考微信公众号阅读与分享面板，演示元宝如何承接文章：先听全文，再语音交换想法，最后把对话沉淀成可执行笔记。
          </p>
        </div>

        <ul className="flow-list">
          {steps.map((step, i) => (
            <li key={step.id} className={activeStep === step.id ? "active" : ""}>
              <div className="step-no">{i + 1}</div>
              <div>
                <strong>{step.title}</strong>
                <span>{step.desc}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="side-actions">
          <button
            className={screen === "article" ? "primary" : ""}
            onClick={() => {
              stopListen();
              setVoiceOpen(false);
              setScreen("article");
            }}
          >
            ① 公众号文章
          </button>
          <button
            className={screen === "chat" && !voiceOpen ? "primary" : ""}
            onClick={() => {
              stopListen();
              setVoiceOpen(false);
              setScreen("chat");
            }}
          >
            ② 元宝对话
          </button>
          <button
            className={voiceOpen ? "primary" : ""}
            onClick={() => {
              setScreen("chat");
              setVoiceOpen(true);
            }}
          >
            ③ 语音交流
          </button>
          <button
            className={screen === "settlement" ? "primary" : ""}
            onClick={() => {
              setVoiceOpen(false);
              setScreen("settlement");
            }}
          >
            ④ 信息沉淀
          </button>
        </div>
      </aside>

      <PhoneShell time={screen === "chat" ? "1:34" : "1:35"}>
        {screen === "article" && (
          <ArticleScreen
            article={demoArticle}
            listening={listening}
            onBack={() => showToast("演示起点：公众号文章页")}
            onOpenSheet={() => setSheetOpen(true)}
            onListen={toggleListen}
            onShareYuanbao={goYuanbao}
          />
        )}

        {screen === "chat" && (
          <YuanbaoChat
            article={demoArticle}
            onBack={() => {
              setVoiceOpen(false);
              setScreen("article");
            }}
            onOpenVoice={() => setVoiceOpen(true)}
            onOpenSettlement={() => {
              setVoiceOpen(false);
              setScreen("settlement");
            }}
          />
        )}

        {screen === "settlement" && (
          <SettlementScreen
            articleTitle={demoArticle.title}
            onBack={() => setScreen("chat")}
            onRestart={() => {
              stopListen();
              setVoiceOpen(false);
              setScreen("article");
            }}
          />
        )}

        {sheetOpen && (
          <ActionSheet
            account={demoArticle.account}
            onClose={() => setSheetOpen(false)}
            onShareYuanbao={goYuanbao}
            onListen={() => {
              setSheetOpen(false);
              startListen();
            }}
            onListenLater={() => {
              setSheetOpen(false);
              showToast(listenLaterHint);
            }}
          />
        )}

        {screen === "article" && showPlayer && (
          <ListenPlayer
            title={demoArticle.summaryTitle}
            playing={listening}
            progressLabel={progressLabel}
            onToggle={toggleListen}
            onClose={stopListen}
            onAsk={() => {
              stopListen();
              goYuanbao();
              setVoiceOpen(true);
            }}
          />
        )}

        {screen === "chat" && voiceOpen && (
          <VoiceMode
            onClose={() => {
              stop();
              setVoiceOpen(false);
            }}
            onFinish={() => {
              stop();
              setVoiceOpen(false);
              setScreen("settlement");
            }}
          />
        )}

        {toast && <div className="toast">{toast}</div>}
      </PhoneShell>
    </div>
  );
}
