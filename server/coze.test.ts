import { collectCozeMedia, excelRowsFromCoze, normalizePayload } from './coze';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const nested = collectCozeMedia('{"output":"hello","image":"https://example.com/a.png"}');
assert(nested.text.includes('hello'), `expected text, got ${nested.text}`);
assert(nested.imageUrls[0] === 'https://example.com/a.png', `expected image url, got ${nested.imageUrls}`);

const rows = excelRowsFromCoze({
  items: [
    { 账号: 'A', 文案标题: '标题一', 视频链接: 'https://v.douyin.com/abc', 曝光: '12w' },
    { account: 'B', title: '标题二', keywords: '美食' },
  ],
});
assert(rows.length === 2, `expected 2 rows, got ${rows.length}`);
assert(rows[0].title === '标题一', rows[0].title);
assert(rows[0].videoUrl?.includes('douyin'), String(rows[0].videoUrl));

const payload = normalizePayload({
  start_date: '2026-09-01',
  end_date: '2026-09-06',
  video_urls: ['', ' https://v.douyin.com/x ', ''],
  raw_video_data: [{}, { id: '1' }],
});
assert(payload.video_urls.length === 1, String(payload.video_urls));
assert(payload.raw_video_data.length === 1, String(payload.raw_video_data.length));

console.log('coze parser ok');
