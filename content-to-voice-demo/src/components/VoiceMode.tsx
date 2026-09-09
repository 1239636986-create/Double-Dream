import { useEffect, useState } from "react";
import { voiceScript, type VoiceTurn } from "../data/dialogue";
import { useSpeech } from "../hooks/useSpeech";

type Props = {
  onClose: () => void;
  onFinish: () => void;
};

type Phase = "idle" | "holding" | "user-done" | "ai-speaking" | "done";

export function VoiceMode({ onClose, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [step, setStep] = useState(0);
  const { speak, stop, speaking, supported } = useSpeech();

  useEffect(() => () => stop(), [stop]);

  const currentPair = Math.floor(step / 2);
  const totalPairs = Math.ceil(voiceScript.length / 2);

  const statusTitle =
    phase === "holding"
      ? "正在听你说…"
      : phase === "ai-speaking" || speaking
        ? "元宝回复中"
        : phase === "done"
          ? "本轮语音交流完成"
          : "按住说话，交流想法";

  const statusDesc =
    phase === "done"
      ? "已覆盖热不适关联与下一步用法。可沉淀为有效信息。"
      : supported
        ? "演示会按脚本推进一轮完整对话；真实场景可接 ASR / TTS。"
        : "当前环境不支持系统朗读，仍可走完演示流程。";

  const startHold = () => {
    if (phase === "ai-speaking" || phase === "done") return;
    setPhase("holding");
  };

  const endHold = () => {
    if (phase !== "holding") return;
    const userTurn = voiceScript[step];
    if (!userTurn || userTurn.speaker !== "user") {
      setPhase("idle");
      return;
    }
    setTurns((prev) => [...prev, userTurn]);
    setPhase("user-done");
    const nextIndex = step + 1;
    const aiTurn = voiceScript[nextIndex];
    window.setTimeout(() => {
      if (!aiTurn || aiTurn.speaker !== "yuanbao") {
        setStep(nextIndex);
        setPhase(nextIndex >= voiceScript.length ? "done" : "idle");
        return;
      }
      setTurns((prev) => [...prev, aiTurn]);
      setPhase("ai-speaking");
      setStep(nextIndex + 1);
      speak(aiTurn.transcript, {
        onEnd: () => {
          const finished = nextIndex + 1 >= voiceScript.length;
          setPhase(finished ? "done" : "idle");
        },
      });
    }, 450);
  };

  const autoPlayRest = () => {
    stop();
    setTurns(voiceScript);
    setStep(voiceScript.length);
    setPhase("done");
  };

  return (
    <div className="voice-mode">
      <div
        className={`voice-orb ${
          phase === "holding" ? "listening" : phase === "ai-speaking" ? "speaking-ai" : ""
        }`}
      />
      <div className="voice-status">
        <h3>{statusTitle}</h3>
        <p>
          {statusDesc}
          {phase !== "done" && (
            <>
              {" "}
              （{Math.min(currentPair + (phase === "idle" ? 0 : 1), totalPairs)}/
              {totalPairs}）
            </>
          )}
        </p>
      </div>

      <div className="voice-transcript">
        {turns.map((t) => (
          <div key={t.id} className={`voice-line ${t.speaker}`}>
            <strong>{t.speaker === "user" ? "你" : "元宝"}</strong>
            {" · "}
            {t.transcript}
          </div>
        ))}
      </div>

      {phase !== "done" ? (
        <button
          className={`hold-btn ${phase === "holding" ? "holding" : ""}`}
          onMouseDown={startHold}
          onMouseUp={endHold}
          onMouseLeave={() => phase === "holding" && endHold()}
          onTouchStart={(e) => {
            e.preventDefault();
            startHold();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            endHold();
          }}
        >
          {phase === "holding" ? "松开发送" : "按住说话"}
        </button>
      ) : (
        <button className="hold-btn" onClick={onFinish}>
          去沉淀
        </button>
      )}

      <div className="voice-actions">
        <button onClick={onClose}>返回聊天</button>
        {phase !== "done" && <button onClick={autoPlayRest}>快进完整对话</button>}
        {phase === "done" && (
          <button className="primary" onClick={onFinish}>
            整理有效信息
          </button>
        )}
      </div>
    </div>
  );
}
