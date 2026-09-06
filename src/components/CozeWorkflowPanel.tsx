import { useEffect, useMemo, useState } from 'react';
import { fetchCozeConfig, runCozeWorkflow, type CozePublicConfig } from '@/lib/cozeClient';
import { usePosterStore } from '@/store/usePosterStore';

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return { start: isoDate(start), end: isoDate(end) };
}

export function CozeWorkflowPanel() {
  const generating = usePosterStore((s) => s.generating);
  const [config, setConfig] = useState<CozePublicConfig | null>(null);
  const range = useMemo(() => defaultRange(), []);
  const [startDate, setStartDate] = useState(range.start);
  const [endDate, setEndDate] = useState(range.end);
  const [videoUrlsText, setVideoUrlsText] = useState('');
  const [rawJson, setRawJson] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [running, setRunning] = useState(false);
  const [resultText, setResultText] = useState('');

  useEffect(() => {
    void fetchCozeConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  const onRun = async () => {
    const store = usePosterStore.getState();
    const video_urls = videoUrlsText
      .split(/[\n,，]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    let raw_video_data: unknown[] = [];
    if (rawJson.trim()) {
      try {
        const parsed = JSON.parse(rawJson);
        raw_video_data = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        store.setStatus('原始视频数据不是合法 JSON');
        return;
      }
    }

    setRunning(true);
    store.setStatus('正在调用扣子工作流…');
    try {
      const result = await runCozeWorkflow({
        start_date: startDate,
        end_date: endDate,
        video_urls,
        raw_video_data,
        onProgress: (msg) => store.setStatus(msg),
      });
      if (result.imageDataUrl) {
        store.setAiBackground(result.imageDataUrl);
      }
      if (result.rows?.length) {
        store.importExcelRows(result.rows);
      }
      setResultText(result.text || (result.rows?.length ? `已导入 ${result.rows.length} 行` : ''));
      if (result.rows?.length) {
        store.setStatus(`扣子工作流完成，已写入 ${result.rows.length} 条卡片数据`);
      } else if (result.imageDataUrl) {
        store.setStatus('扣子工作流完成，结果已写入背景图层');
      } else {
        store.setStatus('扣子工作流已完成');
      }
    } catch (err) {
      store.setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="panel-section">
      <div className="panel-section-head">
        <h3>扣子工作流</h3>
        <p>填写日期与视频链接后点击运行，调用已部署的 Coze API（sxk7m33ft7.coze.site/run）。</p>
      </div>
      <div className="panel-section-body">
        {config && !config.configured && (
          <div className="info-box muted tiny">
            尚未配置 Token。把部署页生成的 API Token 写入本机 <span className="mono">.env</span> 的{' '}
            <span className="mono">COZE_API_TOKEN</span>（不要贴到页面或仓库里）。
          </div>
        )}
        <div className="row">
          <label className="field">
            <span className="field-label">
              <span>开始日期</span>
            </span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">
              <span>结束日期</span>
            </span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span className="field-label">
            <span>视频链接</span>
            <span className="mono">每行一条</span>
          </span>
          <textarea
            className="coze-prompt"
            rows={4}
            placeholder={'https://v.douyin.com/...\nhttps://v.douyin.com/...'}
            value={videoUrlsText}
            onChange={(e) => setVideoUrlsText(e.target.value)}
          />
        </label>
        <button type="button" className="btn-ghost" onClick={() => setShowRaw((v) => !v)}>
          {showRaw ? '收起原始视频数据' : '高级：原始视频数据 JSON'}
        </button>
        {showRaw && (
          <textarea
            className="coze-prompt"
            rows={4}
            placeholder='[{"id":"..."}]'
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
          />
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={generating || running || !config?.configured}
          onClick={() => void onRun()}
        >
          {running ? '运行中…' : '运行工作流'}
        </button>
        {resultText && <pre className="coze-result">{resultText}</pre>}
      </div>
    </div>
  );
}
