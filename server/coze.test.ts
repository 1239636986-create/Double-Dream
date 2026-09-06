import { collectCozeMedia, parseDataUrl } from './coze';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const nested = collectCozeMedia(
  '{"output":"hello","image":"https://example.com/a.png"}',
);
assert(nested.text.includes('hello'), `expected text, got ${nested.text}`);
assert(nested.imageUrls[0] === 'https://example.com/a.png', `expected image url, got ${nested.imageUrls}`);

const objectOut = collectCozeMedia({
  data: { url: 'https://tos-cn-i-mdko3gqilj.example.com/foo' },
  caption: '海报文案',
});
assert(objectOut.imageUrls.length === 1, `expected 1 image, got ${objectOut.imageUrls.length}`);
assert(objectOut.text.includes('海报文案'), `expected caption, got ${objectOut.text}`);

const parsed = parseDataUrl('data:image/png;base64,iVBORw0KGgo=');
assert(parsed?.ext === 'png', 'expected png ext');
assert(parsed && parsed.buffer.length > 0, 'expected buffer');

console.log('coze parser ok');
