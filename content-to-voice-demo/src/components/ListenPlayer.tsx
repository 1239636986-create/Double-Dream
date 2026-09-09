type Props = {
  title: string;
  playing: boolean;
  progressLabel: string;
  onToggle: () => void;
  onClose: () => void;
  onAsk: () => void;
};

export function ListenPlayer({
  title,
  playing,
  progressLabel,
  onToggle,
  onClose,
  onAsk,
}: Props) {
  return (
    <div className="listen-bar" role="status">
      <button
        className={`pulse ${playing ? "playing" : ""}`}
        onClick={onToggle}
        aria-label={playing ? "暂停" : "继续"}
      >
        {playing ? "Ⅱ" : "▶"}
      </button>
      <div className="listen-meta">
        <strong>听全文 · {title}</strong>
        <span>{progressLabel}</span>
      </div>
      <div className="listen-controls">
        <button onClick={onAsk} title="语音追问">
          🎙
        </button>
        <button onClick={onClose} title="关闭">
          ✕
        </button>
      </div>
    </div>
  );
}
