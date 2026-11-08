const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const HTML_RELATIVE = path.join('out', 'vs', 'code', 'electron-sandbox', 'workbench', 'workbench.html');
const CHECKSUM_KEY = 'vs/code/electron-sandbox/workbench/workbench.html';
const SCRIPT_TAG = '<script src="./expand-thinking.js"></script>';
const WORKBENCH_SCRIPT = /(<script\s+src="\.\/workbench\.js"[^>]*><\/script>)/;

function htmlPathFor(appRoot) {
  return path.join(appRoot, HTML_RELATIVE);
}

function productPathFor(appRoot) {
  return path.join(appRoot, 'product.json');
}

function backupPathFor(appRoot) {
  return htmlPathFor(appRoot) + '.expand-thinking.bak';
}

function scriptDestFor(appRoot) {
  return path.join(path.dirname(htmlPathFor(appRoot)), 'expand-thinking.js');
}

function isPatched(html) {
  return html.includes('src="./expand-thinking.js"');
}

function checksumFor(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('base64').replace(/=+$/, '');
}

function checksumPattern() {
  return new RegExp(`("${CHECKSUM_KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:\\s*")[^"]*(")`);
}

function withChecksum(productText, sum) {
  const pattern = checksumPattern();
  if (!pattern.test(productText)) {
    throw new Error(`product.json has no checksum entry for ${CHECKSUM_KEY}`);
  }
  return productText.replace(pattern, `$1${sum}$2`);
}

function insertScript(html) {
  if (isPatched(html)) return html;
  if (!WORKBENCH_SCRIPT.test(html)) {
    throw new Error('Could not find the workbench.js script tag in workbench.html');
  }
  const nl = html.includes('\r\n') ? '\r\n' : '\n';
  return html.replace(WORKBENCH_SCRIPT, `$1${nl}\t\t${SCRIPT_TAG}`);
}

function removeScript(html) {
  return html.replace(/\r?\n[ \t]*<script src="\.\/expand-thinking\.js"><\/script>/, '');
}

async function writeFileAtomic(filePath, contents) {
  const tmp = `${filePath}.expand-thinking.tmp`;
  await fs.writeFile(tmp, contents);
  try {
    await fs.copyFile(tmp, filePath);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

async function updateChecksum(appRoot, htmlBuffer) {
  const productPath = productPathFor(appRoot);
  const productText = await fs.readFile(productPath, 'utf8');
  const next = withChecksum(productText, checksumFor(htmlBuffer));
  if (next !== productText) {
    await writeFileAtomic(productPath, next);
  }
}

async function filesEqual(a, b) {
  try {
    const [left, right] = await Promise.all([fs.readFile(a), fs.readFile(b)]);
    return left.equals(right);
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function enable({ appRoot, extensionRoot }) {
  const htmlPath = htmlPathFor(appRoot);
  const scriptSrc = path.join(extensionRoot, 'media', 'expand-thinking.js');
  const scriptDest = scriptDestFor(appRoot);
  const backupPath = backupPathFor(appRoot);

  const scriptChanged = !(await filesEqual(scriptSrc, scriptDest));
  if (scriptChanged) {
    await fs.copyFile(scriptSrc, scriptDest);
  }

  const original = await fs.readFile(htmlPath);
  const html = original.toString('utf8');
  if (isPatched(html)) {
    return { changed: scriptChanged };
  }

  await fs.copyFile(htmlPath, backupPath);
  const patched = insertScript(html);
  await writeFileAtomic(htmlPath, patched);
  await updateChecksum(appRoot, Buffer.from(patched, 'utf8'));
  return { changed: true };
}

async function disable({ appRoot }) {
  const htmlPath = htmlPathFor(appRoot);
  const backupPath = backupPathFor(appRoot);
  const scriptDest = scriptDestFor(appRoot);
  const current = await fs.readFile(htmlPath, 'utf8');

  let restored;
  try {
    restored = await fs.readFile(backupPath, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    restored = removeScript(current);
  }

  const changed = restored !== current;
  if (changed) {
    await writeFileAtomic(htmlPath, restored);
    await updateChecksum(appRoot, Buffer.from(restored, 'utf8'));
  }
  await fs.rm(scriptDest, { force: true });
  return { changed };
}

module.exports = {
  CHECKSUM_KEY,
  SCRIPT_TAG,
  backupPathFor,
  checksumFor,
  checksumPattern,
  disable,
  enable,
  htmlPathFor,
  insertScript,
  isPatched,
  removeScript,
  withChecksum,
};
