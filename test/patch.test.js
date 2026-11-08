const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  CHECKSUM_KEY,
  checksumFor,
  checksumPattern,
  disable,
  enable,
  isPatched,
  removeScript,
  withChecksum,
} = require('../patch');

const FIXTURE_HTML = [
  '<!DOCTYPE html>',
  '<html>',
  '<body aria-label="">',
  '</body>',
  '\t<!-- Startup (do not modify order of script tags!) -->',
  '\t<script src="./workbench.js" type="module"></script>',
  '</html>',
  '',
].join('\n');

function makeApp() {
  const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'expand-thinking-'));
  const extensionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'expand-thinking-ext-'));
  const htmlDir = path.join(appRoot, 'out', 'vs', 'code', 'electron-sandbox', 'workbench');
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(path.join(extensionRoot, 'media'), { recursive: true });
  fs.writeFileSync(path.join(htmlDir, 'workbench.html'), FIXTURE_HTML);
  fs.writeFileSync(path.join(extensionRoot, 'media', 'expand-thinking.js'), '/* script-v1 */\n');
  const product = {
    checksums: {
      [CHECKSUM_KEY]: 'stale',
      'vs/code/electron-sandbox/workbench/workbench.js': 'leave-me',
    },
  };
  fs.writeFileSync(path.join(appRoot, 'product.json'), JSON.stringify(product, null, '\t') + '\n');
  return { appRoot, extensionRoot, htmlDir };
}

test('checksum pattern matches a product.json checksum entry', () => {
  const sum = checksumFor(Buffer.from(FIXTURE_HTML));
  const text = [
    '{',
    '\t"checksums": {',
    '\t\t"vs/base/parts/sandbox/electron-sandbox/preload.js": "leave-me",',
    `\t\t"${CHECKSUM_KEY}": "stale",`,
    '\t\t"vs/code/electron-sandbox/workbench/workbench.js": "leave-me-too"',
    '\t}',
    '}',
    '',
  ].join('\n');
  assert.match(text, checksumPattern());
  const product = JSON.parse(withChecksum(text, sum));
  assert.equal(product.checksums[CHECKSUM_KEY], sum);
  assert.equal(product.checksums['vs/base/parts/sandbox/electron-sandbox/preload.js'], 'leave-me');
  assert.equal(product.checksums['vs/code/electron-sandbox/workbench/workbench.js'], 'leave-me-too');
});

test('enable patches html and checksum, and disable restores both', async () => {
  const { appRoot, extensionRoot, htmlDir } = makeApp();
  const htmlPath = path.join(htmlDir, 'workbench.html');
  const original = fs.readFileSync(htmlPath);

  const first = await enable({ appRoot, extensionRoot });
  assert.equal(first.changed, true);
  const patched = fs.readFileSync(htmlPath, 'utf8');
  assert.equal(isPatched(patched), true);
  assert.match(patched, /workbench\.js" type="module"><\/script>\n\t\t<script src="\.\/expand-thinking\.js"><\/script>/);
  const product = JSON.parse(fs.readFileSync(path.join(appRoot, 'product.json'), 'utf8'));
  assert.equal(product.checksums[CHECKSUM_KEY], checksumFor(fs.readFileSync(htmlPath)));
  assert.equal(product.checksums['vs/code/electron-sandbox/workbench/workbench.js'], 'leave-me');
  assert.equal(fs.existsSync(path.join(htmlDir, 'expand-thinking.js')), true);

  const second = await enable({ appRoot, extensionRoot });
  assert.equal(second.changed, false);

  fs.writeFileSync(path.join(extensionRoot, 'media', 'expand-thinking.js'), '/* script-v2 */\n');
  const third = await enable({ appRoot, extensionRoot });
  assert.equal(third.changed, true);
  assert.equal(fs.readFileSync(path.join(htmlDir, 'expand-thinking.js'), 'utf8'), '/* script-v2 */\n');

  const removed = await disable({ appRoot });
  assert.equal(removed.changed, true);
  assert.deepEqual(fs.readFileSync(htmlPath), original);
  const restored = JSON.parse(fs.readFileSync(path.join(appRoot, 'product.json'), 'utf8'));
  assert.equal(restored.checksums[CHECKSUM_KEY], checksumFor(original));
  assert.equal(fs.existsSync(path.join(htmlDir, 'expand-thinking.js')), false);
  assert.equal(isPatched(removeScript(patched)), false);
});
