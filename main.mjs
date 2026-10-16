import { DOWNLOADS, FIELDS, RELEASE_PAGE, detectPlatform } from './site-data.mjs';

const platform = detectPlatform(navigator);
const primary = document.getElementById('primary-download');
const primaryLabel = document.getElementById('primary-label');
if (platform) {
  primary.href = DOWNLOADS[platform].href;
  primaryLabel.textContent = DOWNLOADS[platform].label;
  const card = document.querySelector(`[data-platform="${platform}"]`);
  card.classList.add('recommended');
  card.querySelector('.recommended-label').hidden = false;
} else {
  primary.href = '#get';
  primaryLabel.textContent = '查看桌面版下载';
}

const fieldButtons = [...document.querySelectorAll('[data-field]')];
for (const button of fieldButtons) {
  button.addEventListener('click', () => {
    const field = FIELDS[button.dataset.field];
    if (!field) return;
    for (const candidate of fieldButtons) candidate.setAttribute('aria-pressed', String(candidate === button));
    document.getElementById('field-question').textContent = field.question;
    document.getElementById('field-description').textContent = field.description;
    document.getElementById('field-tags').replaceChildren(...field.tags.map(tag => {
      const span = document.createElement('span');
      span.textContent = tag;
      return span;
    }));
  });
}

// An optional recovery link, not a tracking redirect or second automatic download.
primary.addEventListener('click', () => {
  if (!platform || document.getElementById('download-feedback')) return;
  const hint = document.createElement('p');
  hint.id = 'download-feedback';
  hint.className = 'download-help';
  hint.setAttribute('role', 'status');
  const fallback = document.createElement('a');
  fallback.href = RELEASE_PAGE;
  fallback.textContent = '下载没有开始？试试 GitHub 发布页。';
  hint.append(fallback);
  document.querySelector('.hero-actions').after(hint);
});
