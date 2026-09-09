type Props = {
  account: string;
  onClose: () => void;
  onShareYuanbao: () => void;
  onListen: () => void;
  onListenLater: () => void;
};

export function ActionSheet({
  account,
  onClose,
  onShareYuanbao,
  onListen,
  onListenLater,
}: Props) {
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="更多操作"
      >
        <div className="sheet-handle" />
        <div className="sheet-header">
          <span>{account}</span>
          <span>›</span>
        </div>

        <div className="sheet-section-label">转发给</div>
        <div className="forward-row">
          <button className="forward-item" onClick={onShareYuanbao}>
            <div className="forward-avatar yuanbao">
              <span />
              <div className="ai-tag">AI</div>
            </div>
            元宝
          </button>
          <div className="forward-item">
            <div className="forward-avatar" style={{ background: "#3a5a8a" }}>
              友
            </div>
            文件传输
          </div>
          <div className="forward-item">
            <div className="forward-avatar" style={{ background: "#6b4a2a" }}>
              群
            </div>
            研究群
          </div>
        </div>

        <div className="tool-row">
          <div className="tool-item">
            <div className="tool-icon">↗</div>
            发送给朋友
          </div>
          <div className="tool-item">
            <div className="tool-icon">◎</div>
            分享到朋友圈
          </div>
          <div className="tool-item">
            <div className="tool-icon">☆</div>
            收藏
          </div>
        </div>

        <div className="tool-row">
          <div className="tool-item">
            <div className="tool-icon">⧉</div>
            浮窗
          </div>
          <button className="tool-item" onClick={onListen}>
            <div className="tool-icon listen">🎧</div>
            听全文
          </button>
          <button className="tool-item" onClick={onListenLater}>
            <div className="tool-icon">＋≡</div>
            稍后听
          </button>
          <div className="tool-item">
            <div className="tool-icon">⧉</div>
            复制链接
          </div>
        </div>

        <button className="sheet-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  );
}
