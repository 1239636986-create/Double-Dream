import { useCallback, useEffect, useMemo, useState } from "react";
import { ActionSheet } from "./components/ActionSheet";
import { ArticleScreen } from "./components/ArticleScreen";
import { ListenPlayer } from "./components/ListenPlayer";
import { PhoneShell } from "./components/PhoneShell";
import { SettlementScreen } from "./components/SettlementScreen";
import { VoiceMode } from "./components/VoiceMode";
import { YuanbaoChat } from "./components/YuanbaoChat";
import { demoArticle } from "./data/articles";
import { listenLaterHint, type SettlementItem } from "./data/dialogue";
import { useSpeech } from "./hooks/useSpeech";
import { articleFullText } from "./lib/articleText";
import {
  fetchCozeVoiceConfig,
  runCozeVoice,
  type CozeVoiceConfig,
} from "./lib/cozeVoiceClient";
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

function mapSettlement(
  items: Array<{ type: string; title: string; detail: string }>,
): SettlementItem[] {
  return items.map((item, i) => ({
    id: `coze-s-${i}`,
    type: (["insight", "quote", "action", "todo"].includes(item.type)
      ? item.type
      : "insight") as SettlementItem["type"],
    title: item.title,
    detail: item.detail,
  }));
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("article");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [coze, setCoze] = useState<CozeVoiceConfig | null>(null);
  const [settlementItems, setSettlementItems] = useState<SettlementItem[] | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const { speaking, speak, stop, supported, lineIndex, lineTotal } = useSpeech();

  const cozeReady = Boolean(coze?.configured);
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

  const onCozeSettlement = useCallback(
    (items: Array<{ type: string; title: string; detail: string }>) => {
      if (items.length) setSettlementItems(mapSettlement(items));
    },
    [],
  );

  const refreshSettlement = useCallback(async () => {
    if (!cozeReady) return;
    setRefreshing(true);
    try {
      const result = await runCozeVoice({
        article_title: demoArticle.title,
        article_content: articleFullText(demoArticle),
        user_question:
          "请把刚才对话沉淀为有效信息整理，输出 insight / quote / action / todo 条目（JSON 数组更好）。",
      });
      if (result.settlement.length) {
        setSettlementItems(mapSettlement(result.settlement));
      } else if (result.replyText) {
        setSettlementItems([
          {
            id: "coze-single",
            type: "insight",
            title: "工作流整理结果",
            detail: result.replyText,
          },
        ]);
      }
      showToast("已用扣子重新沉淀");
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [cozeReady, showToast]);

  const activeStep =
    screen === "settlement" ? "settle" : screen === "chat" ? "talk" : "read";

  useEffect(() => {
    const load = () => {
      void fetchCozeVoiceConfig()
        .then(setCoze)
        .catch(() => setCoze(null));
    };
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

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
            已对接你在扣子部署的文本工作流（article_content / article_title /
            user_question）。配置 Token 后，聊天与语音会走真实工作流。
          </p>
        </div>

        <div className={`coze-box ${cozeReady ? "ok" : "warn"}`}>
          <strong>{cozeReady ? "扣子已连接" : "待配置 COZE_API_TOKEN"}</strong>
          <ol>
            <li>打开扣子「部署」页 → 管理 API Token → 生成 Token</li>
            <li>
              仓库根目录复制 <code>.env.example</code> 为 <code>.env</code>，填入 Token（不要发到聊天）
            </li>
            <li>
              确认 <code>COZE_RUN_URL=https://sxk7m33ft7.coze.site/run</code>
            </li>
            <li>
              运行 <code>npm run dev</code>（会同时起前端 5173 + 后端 8787）
            </li>
            <li>回到本页点「发给元宝」验证总结是否来自工作流</li>
          </ol>
          {coze?.runUrl && (
            <p className="coze-url">
              当前：<code>{coze.runUrl}</code>
            </p>
          )}
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
            cozeReady={cozeReady}
            onBack={() => {
              setVoiceOpen(false);
              setScreen("article");
            }}
            onOpenVoice={() => setVoiceOpen(true)}
            onOpenSettlement={() => {
              setVoiceOpen(false);
              setScreen("settlement");
            }}
            onCozeSettlement={onCozeSettlement}
          />
        )}

        {screen === "settlement" && (
          <SettlementScreen
            articleTitle={demoArticle.title}
            items={settlementItems}
            cozeReady={cozeReady}
            refreshing={refreshing}
            onRefreshFromCoze={refreshSettlement}
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
            article={demoArticle}
            cozeReady={cozeReady}
            onCozeSettlement={onCozeSettlement}
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
