import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const version = process.env.RELEASE_VERSION;
if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('Invalid release version');
const base = 'https://a3s-lab.discovery.intern-ai.org.cn/apps/science-discovery/api/v1/updates/';
await fs.mkdir('mirrored', { recursive: true });
async function get(name, headers = {}) {
  if (!/^[\w.-]+$/.test(name)) throw new Error('Unsafe filename');
  const response = await fetch(base + name, { headers, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response;
}
const records = [];
const verificationName = `release-verification-${version}.json`;
const verificationText = await (await get(verificationName)).text();
const verification = JSON.parse(verificationText);
if (verification.version !== version || !Array.isArray(verification.files)) throw new Error('Invalid center verification report');
await fs.writeFile(path.join('mirrored', verificationName), verificationText);
for (const name of ['latest.yml', 'latest-linux.yml']) {
  const text = await (await get(name)).text();
  if (!new RegExp(`^version:\\s*${version.replaceAll('.', '\\.')}\\s*$`, 'm').test(text)) throw new Error(`${name} does not declare ${version}`);
  const entries = [...text.matchAll(/^\s*- url: ([\w.-]+)\r?\n\s*sha512: (\S+)\r?\n\s*size: (\d+)/gm)];
  if (entries.length !== (name === 'latest.yml' ? 1 : 2)) throw new Error(`Incomplete ${name}`);
  for (const entry of entries) records.push({ name: entry[1], sha512: entry[2], size: Number(entry[3]) });
  await fs.writeFile(path.join('mirrored', name), text);
}
const setup = records.find(record => /-Setup-.*\.exe$/.test(record.name));
if (!setup) throw new Error('Windows feed is not the Setup installer');
records.push({ name: `Duanyan-Science-Discovery-Portable-${version}-x64.exe` });
async function download(record) {
  if (!record.size) {
    const probe = await get(record.name, { Range: 'bytes=0-0' });
    record.size = Number(probe.headers.get('content-range')?.split('/')[1]);
    await probe.body.cancel();
    if (!record.size) throw new Error(`No size for ${record.name}`);
  }
  const file = await fs.open(path.join('mirrored', record.name), 'w');
  const chunkSize = 16 * 1024 * 1024;
  let next = 0;
  try {
    await Promise.all(Array.from({ length: 4 }, async () => {
      for (;;) {
        const start = next;
        next += chunkSize;
        if (start >= record.size) break;
        const end = Math.min(start + chunkSize, record.size) - 1;
        for (let attempt = 1; ; attempt++) {
          try {
            const response = await get(record.name, { Range: `bytes=${start}-${end}` });
            if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${record.size}`) throw new Error('Invalid byte range');
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length !== end - start + 1) throw new Error('Truncated range');
            let offset = 0;
            while (offset < bytes.length) {
              const written = await file.write(bytes, offset, bytes.length - offset, start + offset);
              if (!written.bytesWritten) throw new Error('Write made no progress');
              offset += written.bytesWritten;
            }
            break;
          } catch (error) { if (attempt >= 5) throw error; }
        }
      }
    }));
  } finally { await file.close(); }
  const hash = crypto.createHash('sha512');
  for await (const bytes of (await import('node:fs')).createReadStream(path.join('mirrored', record.name))) hash.update(bytes);
  const actual = hash.digest('base64');
  if (record.sha512 && actual !== record.sha512) throw new Error(`Checksum mismatch: ${record.name}`);
  record.actualSha512 = actual;
  console.log(`Verified ${record.name}: ${record.size} bytes`);
}
await Promise.all(records.map(download));
for (const name of ['release-notes.json', setup.name + '.blockmap']) {
  await fs.writeFile(path.join('mirrored', name), Buffer.from(await (await get(name)).arrayBuffer()));
}
for (const expected of verification.files) {
  const hash = crypto.createHash('sha256');
  const filename = path.join('mirrored', expected.name);
  if (!/^[\w.-]+$/.test(expected.name)) throw new Error('Unsafe verification filename');
  if ((await fs.stat(filename)).size !== expected.size) throw new Error(`Size mismatch: ${expected.name}`);
  for await (const bytes of (await import('node:fs')).createReadStream(filename)) hash.update(bytes);
  if (hash.digest('hex') !== expected.sha256) throw new Error(`Source digest mismatch: ${expected.name}`);
}
const notes = JSON.parse(await fs.readFile('mirrored/release-notes.json', 'utf8')).versions.find(entry => entry.version === version);
if (!notes) throw new Error('Missing release notes');
const text = [notes.summary, ...notes.groups.flatMap(group => [group.title ? `**${group.title}**` : '', ...group.blocks.map(block => block.kind === 'list' ? block.items.map(item => '- ' + item).join('\n') : block.text)]), 'Windows Setup / Portable；Linux AppImage / deb。macOS 保留原始安装包。', `构建源码：\`${verification.sourceRevision}\`。`].filter(Boolean).join('\n\n');
await fs.writeFile('mirror-notes.md', text);
