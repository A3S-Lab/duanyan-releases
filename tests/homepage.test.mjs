import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DOWNLOADS, FIELDS, RELEASE, detectPlatform } from '../site-data.mjs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('download section uses the published release, not unreleased capabilities', () => {
  assert.equal(RELEASE.version, '1.1.8');
  assert.equal(RELEASE.date, '2026-10-15');
  assert.match(html, /当前版本 1\.1\.8/);
  assert.match(html, /2026\.10\.15 发布/);
  const versions = [...html.matchAll(/(?:Setup-|Portable-|Discovery-|Research-|\/v)(\d+\.\d+\.\d+)/g)].map(match => match[1]);
  assert.ok(versions.length >= 8);
  assert.ok(versions.every(version => version === RELEASE.version));
  assert.doesNotMatch(html, /Claude Code|多智能体切换|统一登录/);
});

for (const [name, value, expected] of [
  ['Windows', { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, 'windows'],
  ['Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel' }, 'mac'],
  ['Linux x64', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }, 'linux'],
  ['Android', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' }, null],
  ['iPhone', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, null],
  ['iPad desktop UA', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 }, null],
  ['Linux ARM', { userAgent: 'Mozilla/5.0 (X11; Linux aarch64)' }, null],
  ['Linux ARM64', { userAgent: 'Mozilla/5.0 (X11; Linux arm64)' }, null],
  ['Linux 32-bit', { userAgent: 'Mozilla/5.0 (X11; Linux i686)' }, null],
  ['Linux unknown architecture', { userAgent: 'Mozilla/5.0 (X11; Linux)' }, null],
  ['ChromeOS', { userAgent: 'Mozilla/5.0 (X11; CrOS x86_64)' }, null],
  ['unknown', {}, null],
]) test(`download recommendation: ${name}`, () => assert.equal(detectPlatform(value), expected));

test('primary downloads have static HTML equivalents without JavaScript', () => {
  for (const download of Object.values(DOWNLOADS)) {
    assert.ok(html.includes(`href="${download.href}"`));
    assert.equal(new URL(download.href).protocol, 'https:');
  }
  assert.match(DOWNLOADS.mac.label, /Apple Silicon/);
});

test('local fragments resolve exactly once', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Missing ${id}`);
});

test('all six fields have complete sample content', () => {
  const buttons = [...html.matchAll(/data-field="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(buttons, Object.keys(FIELDS));
  for (const field of Object.values(FIELDS)) {
    assert.ok(field.question.length > 5);
    assert.ok(field.description.length > 15);
    assert.equal(field.tags.length, 3);
  }
  assert.ok(html.includes(FIELDS.breeding.question));
  assert.match(FIELDS.clinical.description, /不用于个体诊疗/);
});

test('marketing copy is not a technical release log or absolute privacy promise', () => {
  assert.doesNotMatch(html, /中心更新源|中心分发目录|278|包名不代表|专业程序按需安装|数据绝不离开|完全离线|全量共享上下文/);
  const introductionText = html.slice(html.indexOf('<main'), html.indexOf('id="get"')).replace(/<[^>]*>/g, '');
  assert.doesNotMatch(introductionText, /1\.1\.8/);
  assert.match(html, /相关输入可能会发往你配置的服务/);
  assert.match(html, /工作台界面与研究流程示意/);
});

test('keyboard access, reduced motion and no external runtime dependencies', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/<summary>/g) || []).length, 3);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(html, /<script[^>]+src="https?:/);
  for (const name of ['styles.css', 'main.mjs', 'mark.svg', 'lab.png']) assert.ok(readFileSync(new URL(`../${name}`, import.meta.url)).length > 0);
});
